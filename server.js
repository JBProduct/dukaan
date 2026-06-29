// Dukaan store server — pure Node.js, zero npm dependencies.
// Run with:  node server.js   (from inside the backend/ folder)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { readDB, writeDB, nextId } = require('./lib/db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  attachUserToSession,
  destroySession,
  parseCookies,
} = require('./lib/auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------- small helpers ----------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

// Ensures every request has a session cookie ("sid"), creating one if missing.
// Returns { token, session, setCookie(res) }
function ensureSession(req, res) {
  const cookies = parseCookies(req);
  let token = cookies.sid;
  let session = token ? getSession(token) : null;
  if (!session) {
    token = createSession(null);
    session = getSession(token);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
  }
  return { token, session };
}

function getCurrentUser(session) {
  if (!session || !session.userId) return null;
  const users = readDB('users');
  const user = users.find((u) => u.id === session.userId);
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function publicProduct(p) {
  return p; // products have no private fields, kept simple
}

// ---------- API route handlers ----------

const routes = [];
function route(method, pattern, handler) {
  // pattern like /api/products/:id -> regex with named group
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[^/]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method, regex, keys, handler });
}

function matchRoute(method, urlPath) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.regex.exec(urlPath);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
  }
  return null;
}

// ----- Auth -----

route('POST', '/api/auth/signup', async (req, res, params, ctx) => {
  const body = await parseBody(req);
  const { name, email, password } = body;
  if (!name || !email || !password || password.length < 6) {
    return sendJSON(res, 400, { error: 'Name, email and a password (6+ chars) are required.' });
  }
  const users = readDB('users');
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return sendJSON(res, 409, { error: 'An account with this email already exists.' });
  }
  const user = {
    id: nextId(users),
    name,
    email,
    password: hashPassword(password),
    isAdmin: false,
    createdAt: Date.now(),
  };
  users.push(user);
  writeDB('users', users);
  attachUserToSession(ctx.token, user.id);
  const { password: _pw, ...safe } = user;
  sendJSON(res, 201, { user: safe });
});

route('POST', '/api/auth/login', async (req, res, params, ctx) => {
  const body = await parseBody(req);
  const { email, password } = body;
  const users = readDB('users');
  const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !verifyPassword(password || '', user.password)) {
    return sendJSON(res, 401, { error: 'Invalid email or password.' });
  }
  attachUserToSession(ctx.token, user.id);
  const { password: _pw, ...safe } = user;
  sendJSON(res, 200, { user: safe });
});

route('POST', '/api/auth/logout', async (req, res, params, ctx) => {
  destroySession(ctx.token);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
  sendJSON(res, 200, { ok: true });
});

route('GET', '/api/auth/me', async (req, res, params, ctx) => {
  sendJSON(res, 200, { user: getCurrentUser(ctx.session) });
});

// ----- Products (public) -----

route('GET', '/api/products', async (req, res, params, ctx, query) => {
  let products = readDB('products');
  if (query.category) products = products.filter((p) => p.category === query.category);
  if (query.q) {
    const q = query.q.toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }
  if (query.sort === 'price_asc') products = [...products].sort((a, b) => a.price - b.price);
  if (query.sort === 'price_desc') products = [...products].sort((a, b) => b.price - a.price);
  if (query.sort === 'rating') products = [...products].sort((a, b) => b.rating - a.rating);
  sendJSON(res, 200, { products: products.map(publicProduct) });
});

route('GET', '/api/products/:id', async (req, res, params) => {
  const products = readDB('products');
  const product = products.find((p) => p.id === Number(params.id));
  if (!product) return sendJSON(res, 404, { error: 'Product not found.' });
  sendJSON(res, 200, { product });
});

// ----- Cart (works for guests too, tied to session cookie) -----

function getCart(token) {
  const carts = readDB('carts');
  return carts.find((c) => c.token === token) || { token, items: [] };
}

function saveCart(cart) {
  const carts = readDB('carts');
  const idx = carts.findIndex((c) => c.token === cart.token);
  if (idx >= 0) carts[idx] = cart;
  else carts.push(cart);
  writeDB('carts', carts);
}

function hydrateCart(cart) {
  const products = readDB('products');
  const items = cart.items
    .map((it) => {
      const product = products.find((p) => p.id === it.productId);
      if (!product) return null;
      return { product, qty: it.qty, lineTotal: product.price * it.qty };
    })
    .filter(Boolean);
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  return { items, subtotal };
}

route('GET', '/api/cart', async (req, res, params, ctx) => {
  const cart = getCart(ctx.token);
  sendJSON(res, 200, hydrateCart(cart));
});

route('POST', '/api/cart', async (req, res, params, ctx) => {
  const body = await parseBody(req);
  const { productId, qty } = body;
  const products = readDB('products');
  const product = products.find((p) => p.id === Number(productId));
  if (!product) return sendJSON(res, 404, { error: 'Product not found.' });

  const cart = getCart(ctx.token);
  const existing = cart.items.find((it) => it.productId === product.id);
  const newQty = Math.max(1, Number(qty) || 1);
  if (existing) existing.qty = newQty;
  else cart.items.push({ productId: product.id, qty: newQty });
  saveCart(cart);
  sendJSON(res, 200, hydrateCart(cart));
});

route('DELETE', '/api/cart/:productId', async (req, res, params, ctx) => {
  const cart = getCart(ctx.token);
  cart.items = cart.items.filter((it) => it.productId !== Number(params.productId));
  saveCart(cart);
  sendJSON(res, 200, hydrateCart(cart));
});

route('POST', '/api/cart/clear', async (req, res, params, ctx) => {
  const cart = getCart(ctx.token);
  cart.items = [];
  saveCart(cart);
  sendJSON(res, 200, hydrateCart(cart));
});

// ----- Checkout / Orders -----
// Payment note: this uses a MOCK payment step so the demo works without a merchant account.
// To go live, swap processPayment() below for a real Razorpay/Stripe server-side call —
// see README.md "Connecting a real payment gateway".

function processPayment({ amount, method }) {
  // Simulate a payment gateway call. Always succeeds in this demo build.
  return {
    success: true,
    transactionId: 'TXN' + crypto.randomBytes(6).toString('hex').toUpperCase(),
    method,
    amount,
  };
}

route('POST', '/api/checkout', async (req, res, params, ctx) => {
  const user = getCurrentUser(ctx.session);
  if (!user) return sendJSON(res, 401, { error: 'Please log in to place an order.' });

  const body = await parseBody(req);
  const { name, phone, address, city, pincode, paymentMethod } = body;
  if (!name || !phone || !address || !city || !pincode) {
    return sendJSON(res, 400, { error: 'Please fill in all delivery details.' });
  }

  const cart = getCart(ctx.token);
  if (cart.items.length === 0) return sendJSON(res, 400, { error: 'Your cart is empty.' });

  const products = readDB('products');
  // Validate stock
  for (const it of cart.items) {
    const product = products.find((p) => p.id === it.productId);
    if (!product || product.stock < it.qty) {
      return sendJSON(res, 409, {
        error: `${product ? product.name : 'An item'} doesn't have enough stock right now.`,
      });
    }
  }

  const { items, subtotal } = hydrateCart(cart);
  const shipping = subtotal >= 999 ? 0 : 49;
  const total = subtotal + shipping;

  const payment = processPayment({ amount: total, method: paymentMethod || 'COD' });
  if (!payment.success) return sendJSON(res, 402, { error: 'Payment failed. Please try again.' });

  // decrement stock
  for (const it of items) {
    const p = products.find((x) => x.id === it.product.id);
    p.stock -= it.qty;
  }
  writeDB('products', products);

  const orders = readDB('orders');
  const order = {
    id: nextId(orders),
    userId: user.id,
    items: items.map((it) => ({
      productId: it.product.id,
      name: it.product.name,
      price: it.product.price,
      qty: it.qty,
    })),
    subtotal,
    shipping,
    total,
    delivery: { name, phone, address, city, pincode },
    payment,
    status: paymentMethod === 'COD' ? 'Placed' : 'Paid',
    createdAt: Date.now(),
  };
  orders.push(order);
  writeDB('orders', orders);

  cart.items = [];
  saveCart(cart);

  sendJSON(res, 201, { order });
});

route('GET', '/api/orders', async (req, res, params, ctx) => {
  const user = getCurrentUser(ctx.session);
  if (!user) return sendJSON(res, 401, { error: 'Please log in.' });
  const orders = readDB('orders')
    .filter((o) => o.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  sendJSON(res, 200, { orders });
});

route('GET', '/api/orders/:id', async (req, res, params, ctx) => {
  const user = getCurrentUser(ctx.session);
  if (!user) return sendJSON(res, 401, { error: 'Please log in.' });
  const order = readDB('orders').find((o) => o.id === Number(params.id) && o.userId === user.id);
  if (!order) return sendJSON(res, 404, { error: 'Order not found.' });
  sendJSON(res, 200, { order });
});

// ----- Admin (requires isAdmin) -----

function requireAdmin(ctx, res) {
  const user = getCurrentUser(ctx.session);
  if (!user || !user.isAdmin) {
    sendJSON(res, 403, { error: 'Admin access only.' });
    return null;
  }
  return user;
}

route('GET', '/api/admin/stats', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  const products = readDB('products');
  const orders = readDB('orders');
  const users = readDB('users');
  sendJSON(res, 200, {
    totalProducts: products.length,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + o.total, 0),
    totalCustomers: users.filter((u) => !u.isAdmin).length,
    lowStock: products.filter((p) => p.stock <= 5).length,
  });
});

route('GET', '/api/admin/products', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  sendJSON(res, 200, { products: readDB('products') });
});

route('POST', '/api/admin/products', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  const body = await parseBody(req);
  const { name, category, price, mrp, stock, description, emoji, color } = body;
  if (!name || !category || !price) {
    return sendJSON(res, 400, { error: 'Name, category and price are required.' });
  }
  const products = readDB('products');
  const product = {
    id: nextId(products),
    name,
    category,
    price: Number(price),
    mrp: Number(mrp) || Number(price),
    stock: Number(stock) || 0,
    rating: 0,
    numReviews: 0,
    emoji: emoji || '📦',
    color: color || '#1A2A52',
    description: description || '',
  };
  products.push(product);
  writeDB('products', products);
  sendJSON(res, 201, { product });
});

route('PUT', '/api/admin/products/:id', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  const body = await parseBody(req);
  const products = readDB('products');
  const product = products.find((p) => p.id === Number(params.id));
  if (!product) return sendJSON(res, 404, { error: 'Product not found.' });
  Object.assign(product, {
    name: body.name ?? product.name,
    category: body.category ?? product.category,
    price: body.price !== undefined ? Number(body.price) : product.price,
    mrp: body.mrp !== undefined ? Number(body.mrp) : product.mrp,
    stock: body.stock !== undefined ? Number(body.stock) : product.stock,
    description: body.description ?? product.description,
    emoji: body.emoji ?? product.emoji,
    color: body.color ?? product.color,
  });
  writeDB('products', products);
  sendJSON(res, 200, { product });
});

route('DELETE', '/api/admin/products/:id', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  let products = readDB('products');
  const before = products.length;
  products = products.filter((p) => p.id !== Number(params.id));
  writeDB('products', products);
  sendJSON(res, 200, { deleted: before !== products.length });
});

route('GET', '/api/admin/orders', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  const orders = readDB('orders').sort((a, b) => b.createdAt - a.createdAt);
  sendJSON(res, 200, { orders });
});

route('PUT', '/api/admin/orders/:id', async (req, res, params, ctx) => {
  if (!requireAdmin(ctx, res)) return;
  const body = await parseBody(req);
  const orders = readDB('orders');
  const order = orders.find((o) => o.id === Number(params.id));
  if (!order) return sendJSON(res, 404, { error: 'Order not found.' });
  if (body.status) order.status = body.status;
  writeDB('orders', orders);
  sendJSON(res, 200, { order });
});

// ---------- static file serving ----------

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(PUBLIC_DIR, filePath);

  // prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA-ish fallback for clean URLs without .html
      const withHtml = filePath + '.html';
      fs.readFile(withHtml, (err2, data2) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          return res.end('<h1>404</h1><p>Page not found.</p>');
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- main request handler ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  if (!urlPath.startsWith('/api/')) {
    return serveStatic(req, res, urlPath);
  }

  const ctx = ensureSession(req, res);
  const match = matchRoute(req.method, urlPath);
  if (!match) return sendJSON(res, 404, { error: 'Not found.' });

  try {
    await match.handler(req, res, match.params, ctx, query);
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Something went wrong on our end.' });
  }
});

server.listen(PORT, () => {
  console.log(`\n🛍️  Dukaan store running at http://localhost:${PORT}`);
  console.log(`   Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`   Admin login: admin@dukaan.test / admin123\n`);
});
