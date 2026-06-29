function priceTagHTML(p) {
  const off = p.mrp > p.price ? Math.round(100 - (p.price / p.mrp) * 100) : 0;
  return `
    <span class="price-tag">
      <span class="tag-clip">${money(p.price)}</span>
      ${p.mrp > p.price ? `<span class="mrp">${money(p.mrp)}</span>` : ''}
      ${off > 0 ? `<span class="off">${off}% off</span>` : ''}
    </span>`;
}

function productCardHTML(p) {
  return `
    <a class="product-card" href="/product.html?id=${p.id}">
      <div class="product-thumb" style="background:${p.color}22;">${p.emoji}</div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <p class="product-name">${p.name}</p>
        <div class="rating-row">
          ${p.numReviews > 0 ? `<span class="rating-pill">${p.rating} ★</span> <span>${p.numReviews} ratings</span>` : '<span>No ratings yet</span>'}
        </div>
        ${priceTagHTML(p)}
        ${p.stock === 0 ? '<span class="stock-out">Out of stock</span>' : ''}
      </div>
    </a>`;
}

async function loadProducts() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const sort = document.getElementById('sortSelect').value;

  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (q) query.set('q', q);
  if (sort) query.set('sort', sort);

  const { products } = await api.get('/api/products?' + query.toString());
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const title = document.getElementById('gridTitle');
  const count = document.getElementById('resultCount');

  title.textContent = q ? `Results for "${q}"` : (category ? category : 'All products');
  count.textContent = products.length ? `${products.length} item${products.length > 1 ? 's' : ''}` : '';

  grid.innerHTML = products.map(productCardHTML).join('');
  grid.style.display = products.length ? '' : 'none';
  empty.style.display = products.length ? 'none' : '';

  document.querySelectorAll('#categoryChips .chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.cat === category);
    chip.href = chip.dataset.cat ? `/index.html?category=${encodeURIComponent(chip.dataset.cat)}` : '/index.html';
  });
}

document.getElementById('sortSelect').addEventListener('change', loadProducts);
document.addEventListener('DOMContentLoaded', loadProducts);
