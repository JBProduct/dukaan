// Thin wrapper around fetch() for talking to our backend API.
const api = {
  async _req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  },
  get(url) { return this._req('GET', url); },
  post(url, body) { return this._req('POST', url, body || {}); },
  put(url, body) { return this._req('PUT', url, body || {}); },
  del(url) { return this._req('DELETE', url); },
};

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

// Updates the cart count bubble + login/account link in the header, on every page.
async function refreshHeader() {
  try {
    const [{ items }, { user }] = await Promise.all([api.get('/api/cart'), api.get('/api/auth/me')]);
    const count = items.reduce((s, it) => s + it.qty, 0);
    document.querySelectorAll('.js-cart-count').forEach((el) => (el.textContent = count));
    const acctEl = document.querySelector('.js-account-link');
    if (acctEl) {
      acctEl.textContent = user ? `Hi, ${user.name.split(' ')[0]}` : 'Login';
      acctEl.href = user ? '/account.html' : '/login.html';
    }
  } catch (e) { /* non-fatal */ }
}
document.addEventListener('DOMContentLoaded', refreshHeader);

// Wires the header search box (present on every page) to redirect to the catalog with a query.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.js-search-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    window.location.href = '/index.html' + (q ? `?q=${encodeURIComponent(q)}` : '');
  });
});
