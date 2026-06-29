async function renderCart() {
  const root = document.getElementById('cartRoot');
  const { items, subtotal } = await api.get('/api/cart');

  if (items.length === 0) {
    root.innerHTML = `
      <div class="empty-state" style="width:100%;">
        <div class="icon">🛒</div>
        <p>Your cart is empty.</p>
        <a class="btn btn-primary" href="/index.html">Start shopping</a>
      </div>`;
    return;
  }

  const shipping = subtotal >= 999 ? 0 : 49;
  const total = subtotal + shipping;

  root.innerHTML = `
    <div class="cart-items">
      ${items.map((it) => `
        <div class="cart-row" data-id="${it.product.id}">
          <div class="thumb" style="background:${it.product.color}22;">${it.product.emoji}</div>
          <div class="info">
            <div class="name">${it.product.name}</div>
            <div style="color:var(--ink-soft); font-size:0.85rem;">${money(it.product.price)} each</div>
            <div class="qty-stepper" style="margin-top:8px;">
              <button type="button" class="qty-minus">−</button>
              <input type="text" class="qty-value" value="${it.qty}" readonly>
              <button type="button" class="qty-plus">+</button>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'JetBrains Mono',monospace; font-weight:700;">${money(it.lineTotal)}</div>
            <button class="remove">Remove</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="cart-summary">
      <h3 style="margin-bottom:14px;">Price Details</h3>
      <div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="summary-row"><span>Delivery</span><span>${shipping === 0 ? 'FREE' : money(shipping)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${money(total)}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:16px;" id="checkoutBtn">Proceed to Checkout</button>
    </div>`;

  root.querySelectorAll('.cart-row').forEach((row) => {
    const id = row.dataset.id;
    const qtyEl = row.querySelector('.qty-value');
    let qty = Number(qtyEl.value);

    row.querySelector('.qty-minus').onclick = async () => {
      qty = Math.max(1, qty - 1);
      await api.post('/api/cart', { productId: id, qty });
      renderCart(); refreshHeader();
    };
    row.querySelector('.qty-plus').onclick = async () => {
      qty += 1;
      await api.post('/api/cart', { productId: id, qty });
      renderCart(); refreshHeader();
    };
    row.querySelector('.remove').onclick = async () => {
      await api.del(`/api/cart/${id}`);
      renderCart(); refreshHeader();
    };
  });

  document.getElementById('checkoutBtn').onclick = async () => {
    const { user } = await api.get('/api/auth/me');
    window.location.href = user ? '/checkout.html' : '/login.html?redirect=/checkout.html';
  };
}
document.addEventListener('DOMContentLoaded', renderCart);
