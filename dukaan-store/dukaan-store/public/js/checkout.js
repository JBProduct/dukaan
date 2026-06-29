async function initCheckout() {
  const { user } = await api.get('/api/auth/me');
  if (!user) { window.location.href = '/login.html?redirect=/checkout.html'; return; }

  const { items, subtotal } = await api.get('/api/cart');
  if (items.length === 0) { window.location.href = '/cart.html'; return; }

  const shipping = subtotal >= 999 ? 0 : 49;
  const total = subtotal + shipping;
  const root = document.getElementById('checkoutRoot');

  root.innerHTML = `
    <div class="checkout-form">
      <div class="checkout-section">
        <h3 style="margin-bottom:14px;">Delivery Address</h3>
        <form id="checkoutForm">
          <div class="field"><label>Full name</label><input id="name" value="${user.name}" required></div>
          <div class="field"><label>Phone number</label><input id="phone" type="tel" required></div>
          <div class="field"><label>Address</label><textarea id="address" rows="2" required></textarea></div>
          <div class="field-row">
            <div class="field"><label>City</label><input id="city" required></div>
            <div class="field"><label>Pincode</label><input id="pincode" required></div>
          </div>

          <h3 style="margin:20px 0 14px;">Payment Method</h3>
          <div class="pay-options">
            <label class="pay-option selected"><input type="radio" name="pay" value="COD" checked> Cash on Delivery</label>
            <label class="pay-option"><input type="radio" name="pay" value="UPI"> UPI</label>
            <label class="pay-option"><input type="radio" name="pay" value="Card"> Card</label>
          </div>
          <p style="font-size:0.78rem; color:var(--ink-soft); margin-top:10px;">This is a demo checkout — no real payment is processed. See README to connect a live payment gateway.</p>

          <button class="btn btn-primary btn-block" style="margin-top:18px;" type="submit">Place Order — ${money(total)}</button>
        </form>
      </div>
    </div>
    <div class="cart-summary">
      <h3 style="margin-bottom:14px;">Order Summary</h3>
      ${items.map((it) => `
        <div class="summary-row"><span>${it.product.name} × ${it.qty}</span><span>${money(it.lineTotal)}</span></div>
      `).join('')}
      <div class="summary-row"><span>Delivery</span><span>${shipping === 0 ? 'FREE' : money(shipping)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${money(total)}</span></div>
    </div>`;

  root.querySelectorAll('.pay-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      root.querySelectorAll('.pay-option').forEach((o) => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('formError');
    errBox.innerHTML = '';
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const { order } = await api.post('/api/checkout', {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        pincode: document.getElementById('pincode').value,
        paymentMethod: document.querySelector('input[name=pay]:checked').value,
      });
      window.location.href = `/order-success.html?id=${order.id}`;
    } catch (err) {
      errBox.innerHTML = `<div class="form-error">${err.message}</div>`;
      btn.disabled = false; btn.textContent = `Place Order — ${money(total)}`;
    }
  });
}
document.addEventListener('DOMContentLoaded', initCheckout);
