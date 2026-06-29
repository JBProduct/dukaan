let currentTab = 'overview';

async function boot() {
  const { user } = await api.get('/api/auth/me');
  if (user && user.isAdmin) {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    renderTab('overview');
  } else {
    document.getElementById('loginGate').style.display = 'block';
    document.getElementById('dashboard').style.display = 'none';
  }
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = document.getElementById('adminFormError');
  errBox.innerHTML = '';
  try {
    const { user } = await api.post('/api/auth/login', {
      email: document.getElementById('adminEmail').value,
      password: document.getElementById('adminPassword').value,
    });
    if (!user.isAdmin) throw new Error('This account does not have admin access.');
    boot();
  } catch (err) {
    errBox.innerHTML = `<div class="form-error">${err.message}</div>`;
  }
});

document.getElementById('adminLogout').addEventListener('click', async (e) => {
  e.preventDefault();
  await api.post('/api/auth/logout');
  boot();
});

document.querySelectorAll('.admin-sidebar nav a[data-tab]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.admin-sidebar nav a[data-tab]').forEach((x) => x.classList.remove('active'));
    a.classList.add('active');
    renderTab(a.dataset.tab);
  });
});

function renderTab(tab) {
  currentTab = tab;
  if (tab === 'overview') renderOverview();
  if (tab === 'products') renderProducts();
  if (tab === 'orders') renderOrders();
}

// ---------- Overview ----------
async function renderOverview() {
  const main = document.getElementById('adminMain');
  const stats = await api.get('/api/admin/stats');
  main.innerHTML = `
    <h2>Overview</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total Revenue</div><div class="value">${money(stats.totalRevenue)}</div></div>
      <div class="stat-card"><div class="label">Orders</div><div class="value">${stats.totalOrders}</div></div>
      <div class="stat-card"><div class="label">Products</div><div class="value">${stats.totalProducts}</div></div>
      <div class="stat-card"><div class="label">Customers</div><div class="value">${stats.totalCustomers}</div></div>
      <div class="stat-card"><div class="label">Low Stock (≤5)</div><div class="value">${stats.lowStock}</div></div>
    </div>`;
}

// ---------- Products ----------
async function renderProducts() {
  const main = document.getElementById('adminMain');
  const { products } = await api.get('/api/admin/products');
  main.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>Products</h2>
      <button class="btn btn-primary" id="addProductBtn">+ Add Product</button>
    </div>
    <table class="admin-table" style="margin-top:14px;">
      <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
      <tbody>
        ${products.map((p) => `
          <tr>
            <td style="font-size:1.4rem;">${p.emoji}</td>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td>${money(p.price)}</td>
            <td>${p.stock === 0 ? '<span class="stock-out">0</span>' : p.stock}</td>
            <td class="table-actions">
              <button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-delete="${p.id}">Delete</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('addProductBtn').onclick = () => openProductModal(null);
  main.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => openProductModal(products.find((p) => p.id === Number(btn.dataset.edit)));
  });
  main.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Delete this product? This cannot be undone.')) return;
      await api.del(`/api/admin/products/${btn.dataset.delete}`);
      showToast('Product deleted');
      renderProducts();
    };
  });
}

function openProductModal(product) {
  const isEdit = !!product;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${isEdit ? 'Edit Product' : 'Add Product'}</h3>
      <div id="modalError"></div>
      <form id="productForm">
        <div class="field"><label>Name</label><input id="f_name" value="${product?.name || ''}" required></div>
        <div class="field">
          <label>Category</label>
          <select id="f_category" required>
            ${['Electronics', 'Fashion', 'Home & Kitchen', 'Beauty'].map((c) => `<option ${product?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div class="field"><label>Price (₹)</label><input id="f_price" type="number" min="1" value="${product?.price || ''}" required></div>
          <div class="field"><label>MRP (₹)</label><input id="f_mrp" type="number" min="1" value="${product?.mrp || ''}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Stock</label><input id="f_stock" type="number" min="0" value="${product?.stock ?? ''}" required></div>
          <div class="field"><label>Emoji icon</label><input id="f_emoji" value="${product?.emoji || '📦'}"></div>
        </div>
        <div class="field"><label>Description</label><textarea id="f_description" rows="3">${product?.description || ''}</textarea></div>
        <div style="display:flex; gap:10px; margin-top:6px;">
          <button type="button" class="btn btn-outline" id="modalCancel" style="flex:1;">Cancel</button>
          <button type="submit" class="btn btn-primary" style="flex:1;">${isEdit ? 'Save Changes' : 'Add Product'}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('#modalCancel').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = backdrop.querySelector('#modalError');
    const payload = {
      name: backdrop.querySelector('#f_name').value,
      category: backdrop.querySelector('#f_category').value,
      price: backdrop.querySelector('#f_price').value,
      mrp: backdrop.querySelector('#f_mrp').value,
      stock: backdrop.querySelector('#f_stock').value,
      emoji: backdrop.querySelector('#f_emoji').value,
      description: backdrop.querySelector('#f_description').value,
    };
    try {
      if (isEdit) await api.put(`/api/admin/products/${product.id}`, payload);
      else await api.post('/api/admin/products', payload);
      backdrop.remove();
      showToast(isEdit ? 'Product updated' : 'Product added');
      renderProducts();
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${err.message}</div>`;
    }
  });
}

// ---------- Orders ----------
async function renderOrders() {
  const main = document.getElementById('adminMain');
  const { orders } = await api.get('/api/admin/orders');
  main.innerHTML = `
    <h2>Orders</h2>
    <table class="admin-table" style="margin-top:14px;">
      <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${orders.map((o) => `
          <tr>
            <td>#${o.id}<br><span style="color:var(--ink-soft); font-size:0.78rem;">${o.delivery.name}</span></td>
            <td>${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
            <td>${o.items.map((it) => `${it.name} ×${it.qty}`).join('<br>')}</td>
            <td>${money(o.total)}</td>
            <td>
              <select class="sort-select status-select" data-id="${o.id}" style="padding:6px 8px;">
                ${['Placed', 'Paid', 'Shipped', 'Delivered', 'Cancelled'].map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    ${orders.length === 0 ? '<p style="color:var(--ink-soft); margin-top:14px;">No orders yet.</p>' : ''}`;

  main.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      await api.put(`/api/admin/orders/${sel.dataset.id}`, { status: sel.value });
      showToast('Order status updated');
    });
  });
}

document.addEventListener('DOMContentLoaded', boot);
