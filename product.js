async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get('id');
  const root = document.getElementById('pdpRoot');
  try {
    const { product: p } = await api.get(`/api/products/${id}`);
    document.title = `${p.name} — Dukaan`;
    const off = p.mrp > p.price ? Math.round(100 - (p.price / p.mrp) * 100) : 0;

    root.innerHTML = `
      <div class="pdp">
        <div class="pdp-image" style="background:${p.color}22;">${p.emoji}</div>
        <div class="pdp-info">
          <span class="product-cat">${p.category}</span>
          <h1>${p.name}</h1>
          <div class="rating-row">
            ${p.numReviews > 0 ? `<span class="rating-pill">${p.rating} ★</span> <span>${p.numReviews} ratings</span>` : '<span>No ratings yet</span>'}
          </div>
          <div class="pdp-price-block">
            <span class="price-tag">
              <span class="tag-clip" style="font-size:1.05rem;">${money(p.price)}</span>
              ${p.mrp > p.price ? `<span class="mrp">${money(p.mrp)}</span>` : ''}
              ${off > 0 ? `<span class="off">${off}% off</span>` : ''}
            </span>
            <p style="margin-top:10px; color:var(--ink-soft); font-size:0.88rem;">Inclusive of all taxes. ${p.price >= 999 ? 'Free delivery.' : 'Delivery charges apply below ₹999.'}</p>
          </div>
          <p>${p.description}</p>
          ${p.stock === 0
            ? '<p class="stock-out" style="margin-top:14px;">Currently out of stock</p>'
            : `<p style="color:var(--ink-soft); font-size:0.85rem; margin-top:14px;">${p.stock <= 5 ? `Only ${p.stock} left!` : 'In stock'}</p>`}
          <div style="margin-top:16px; display:flex; align-items:center; gap:14px;">
            <span style="font-size:0.85rem; font-weight:600;">Quantity</span>
            <div class="qty-stepper">
              <button type="button" id="qtyMinus">−</button>
              <input type="text" id="qtyValue" value="1" readonly>
              <button type="button" id="qtyPlus">+</button>
            </div>
          </div>
          <div class="pdp-actions">
            <button class="btn btn-secondary" id="addToCartBtn" ${p.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
            <button class="btn btn-primary" id="buyNowBtn" ${p.stock === 0 ? 'disabled' : ''}>Buy Now</button>
          </div>
        </div>
      </div>`;

    let qty = 1;
    const qtyEl = document.getElementById('qtyValue');
    document.getElementById('qtyMinus').onclick = () => { qty = Math.max(1, qty - 1); qtyEl.value = qty; };
    document.getElementById('qtyPlus').onclick = () => { qty = Math.min(p.stock, qty + 1); qtyEl.value = qty; };

    document.getElementById('addToCartBtn').onclick = async () => {
      await api.post('/api/cart', { productId: p.id, qty });
      showToast('Added to cart');
      refreshHeader();
    };
    document.getElementById('buyNowBtn').onclick = async () => {
      await api.post('/api/cart', { productId: p.id, qty });
      window.location.href = '/cart.html';
    };
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><div class="icon">🚫</div><p>${e.message}</p><a class="btn btn-outline" href="/index.html">Back to shop</a></div>`;
  }
}
document.addEventListener('DOMContentLoaded', loadProduct);
