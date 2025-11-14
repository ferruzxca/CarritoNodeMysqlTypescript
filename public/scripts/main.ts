interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  category: string;
  tags: string[];
  promotions?: { id: string; title: string; discountRate: number }[];
  reviews?: Review[];
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  user: { name: string; avatarUrl: string | null };
}

interface CartItem {
  id: string;
  quantity: number;
  priceCents: number;
  product: { name: string; imageUrl: string; priceCents: number };
}

interface Cart {
  id: string;
  items: CartItem[];
}

interface BlogPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { name: string; avatarUrl: string | null };
}

type SalesPoint = { period: string; total: number };

const productsContainer = document.querySelector<HTMLDivElement>('#products');
const cartItemsContainer = document.querySelector<HTMLUListElement>('#cartItems');
const cartTotalElement = document.querySelector<HTMLSpanElement>('#cartTotal');
const suggestionsList = document.querySelector<HTMLUListElement>('#suggestions');
const reviewsContainer = document.querySelector<HTMLDivElement>('#reviewsList');
const blogContainer = document.querySelector<HTMLDivElement>('#blogPosts');
const salesChart = document.querySelector<HTMLCanvasElement>('#salesChart');
const topProductsList = document.querySelector<HTMLUListElement>('#topProducts');

const fetchJSON = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return undefined as T;
};

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)} MXN`;

const renderProducts = (products: Product[]) => {
  if (!productsContainer) return;
  productsContainer.innerHTML = '';

  products.forEach((product) => {
    const article = document.createElement('article');
    article.className = 'product-card neon-fade';
    article.innerHTML = `
      <img src="${product.imageUrl}" alt="${product.name}" loading="lazy" />
      <div class="product-card__content">
        <h3>${product.name}</h3>
        <p>${product.description.substring(0, 120)}...</p>
        <div class="product-card__tags">
          ${product.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="product-card__actions">
          <span class="price">${formatCurrency(product.priceCents)}</span>
          <button class="btn btn--primary" data-product="${product.id}">Agregar</button>
        </div>
      </div>
    `;
    productsContainer.append(article);
  });
};

const loadProducts = async (params = '') => {
  try {
    const products = await fetchJSON<Product[]>(`/api/products${params}`);
    renderProducts(products);
  } catch (error) {
    console.error('Error cargando productos', error);
  }
};

const loadCart = async () => {
  try {
    const cart = await fetchJSON<Cart | null>('/api/cart');
    if (!cartItemsContainer || !cartTotalElement) return;
    cartItemsContainer.innerHTML = '';
    const items = cart?.items ?? [];
    let total = 0;
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <img src="${item.product.imageUrl}" alt="${item.product.name}" />
        <div class="cart-item__info">
          <strong>${item.product.name}</strong>
          <span>${item.quantity} x ${formatCurrency(item.priceCents)}</span>
        </div>
        <button class="btn" data-remove="${item.id}">Eliminar</button>
      `;
      cartItemsContainer.append(li);
      total += item.priceCents * item.quantity;
    });
    cartTotalElement.textContent = formatCurrency(total);
  } catch (error) {
    console.error('Error cargando carrito', error);
  }
};

const loadReviews = async () => {
  if (!reviewsContainer) return;
  try {
    const products = await fetchJSON<Product[]>('/api/products');
    const reviews = products.flatMap((product) => product.reviews ?? []).slice(0, 6);
    reviewsContainer.innerHTML = reviews
      .map(
        (review) => `
          <article class="review-card">
            <h3>${'★'.repeat(review.rating)}</h3>
            <p>${review.comment}</p>
            <small>${review.user.name}</small>
          </article>
        `
      )
      .join('');
  } catch (error) {
    console.error('Error cargando reseñas', error);
  }
};

const loadBlog = async () => {
  if (!blogContainer) return;
  try {
    const posts = await fetchJSON<BlogPost[]>('/api/blog');
    blogContainer.innerHTML = posts
      .map(
        (post) => `
          <article class="blog-post">
            <h3>${post.title}</h3>
            <p>${post.content.substring(0, 160)}...</p>
            <small>Por ${post.author.name} · ${new Date(post.createdAt).toLocaleDateString('es-MX')}</small>
          </article>
        `
      )
      .join('');
  } catch (error) {
    console.error('Error cargando blog', error);
  }
};

const drawSalesChart = (points: SalesPoint[]) => {
  if (!salesChart) return;
  if (points.length === 0) {
    const ctx = salesChart.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, salesChart.width, salesChart.height);
    ctx.fillStyle = '#9fa6ff';
    ctx.font = '14px Orbitron';
    ctx.fillText('Sin datos suficientes', 20, salesChart.height / 2);
    return;
  }
  const ctx = salesChart.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, salesChart.width, salesChart.height);
  const width = salesChart.width;
  const height = salesChart.height;
  const padding = 40;
  const maxTotal = Math.max(...points.map((p) => p.total), 1);

  ctx.strokeStyle = '#09fbd3';
  ctx.lineWidth = 2;
  ctx.beginPath();

  points.forEach((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.total / maxTotal) * (height - padding * 2);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  points.forEach((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.total / maxTotal) * (height - padding * 2);
    ctx.fillStyle = '#ff2bff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#9fa6ff';
  ctx.font = '12px Orbitron';
  points.forEach((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (point.total / maxTotal) * (height - padding * 2) - 10;
    ctx.fillText(`${point.period}`, x - 20, height - padding + 20);
    ctx.fillText(`$${(point.total / 100).toFixed(0)}k`, x - 20, y);
  });
};

const loadDashboard = async () => {
  if (!salesChart || !topProductsList) return;
  try {
    const data = await fetchJSON<
      { salesByMonth: SalesPoint[]; topProducts: { productId: string; productName: string; totalSold: number }[] }
    >('/api/dashboard');
    drawSalesChart(data.salesByMonth);
    topProductsList.innerHTML = data.topProducts
      .map((item) => `<li>${item.productName} · ${item.totalSold} ventas</li>`)
      .join('');
  } catch (error) {
    document.querySelector<HTMLElement>('#dashboard')?.classList.add('hidden');
  }
};

const setupInteractions = () => {
  document.querySelector('#explore')?.addEventListener('click', () => {
    document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' });
  });

  productsContainer?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const productId = target.getAttribute('data-product');
    if (!productId) return;
    target.setAttribute('disabled', 'true');
    try {
      await fetchJSON('/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity: 1 })
      });
      await loadCart();
    } catch (error) {
      console.error('No se pudo agregar al carrito', error);
    } finally {
      target.removeAttribute('disabled');
    }
  });

  cartItemsContainer?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const itemId = target.getAttribute('data-remove');
    if (!itemId) return;
    try {
      await fetchJSON(`/api/cart/items/${itemId}`, { method: 'DELETE' });
      await loadCart();
    } catch (error) {
      console.error('Error eliminando item', error);
    }
  });

  document.querySelector('#applyFilters')?.addEventListener('click', () => {
    const category = (document.querySelector('#categoryFilter') as HTMLSelectElement).value;
    const minPrice = (document.querySelector('#minPrice') as HTMLInputElement).value;
    const maxPrice = (document.querySelector('#maxPrice') as HTMLInputElement).value;
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);
    void loadProducts(`?${params.toString()}`);
  });

  document.querySelector('#search')?.addEventListener('input', async (event) => {
    const value = (event.target as HTMLInputElement).value;
    if (!value || value.length < 2) {
      if (suggestionsList) suggestionsList.innerHTML = '';
      return;
    }
    try {
      const suggestions = await fetchJSON<{ id: string; name: string; slug: string }[]>(
        `/api/products/search?q=${encodeURIComponent(value)}`
      );
      if (!suggestionsList) return;
      suggestionsList.innerHTML = suggestions
        .map((suggestion) => `<li data-slug="${suggestion.slug}">${suggestion.name}</li>`)
        .join('');
    } catch (error) {
      console.error('Error obteniendo sugerencias', error);
    }
  });

  suggestionsList?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const slug = target.getAttribute('data-slug');
    if (!slug) return;
    window.location.href = `/api/products/${slug}`;
  });

  document.querySelector('#checkout')?.addEventListener('click', async () => {
    try {
      await fetchJSON('/api/cart/checkout', { method: 'POST' });
      alert('Pago completado. Revisa tu correo para la factura.');
      await loadCart();
    } catch (error) {
      const wantsLogin = confirm('Debes iniciar sesión para pagar. ¿Deseas iniciar sesión ahora?');
      if (!wantsLogin) return;
      const email = prompt('Correo electrónico futurista');
      const password = prompt('Contraseña encriptada');
      if (!email || !password) return;
      try {
        await fetchJSON('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        await fetchJSON('/api/cart/checkout', { method: 'POST' });
        alert('Pago completado. Revisa tu correo para la factura.');
        await loadCart();
      } catch (loginError) {
        alert('No se pudo iniciar sesión o completar el pago.');
        console.error(loginError);
      }
    }
  });
};

void loadProducts();
void loadCart();
void loadReviews();
void loadBlog();
void loadDashboard();
setupInteractions();
