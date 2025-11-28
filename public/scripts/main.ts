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

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type CheckoutStep = 'invoice' | 'shipping' | 'confirmation';

type CheckoutSummary = {
  orderId: string;
  invoiceUrl?: string;
  totalCents: number;
  items: { name: string; quantity: number; priceCents: number }[];
  emailSent: boolean;
};

type ShippingOption = {
  id: string;
  name: string;
  eta: string;
  description: string;
  priceCents: number;
  badge: string;
  perks: string[];
};

type CheckoutResponse = {
  message: string;
  orderId: string;
  invoiceUrl: string;
  emailSent: boolean;
};

type ShareInvoiceResponse = {
  message: string;
  invoiceUrl: string;
};

const shippingOptionsCatalog: ShippingOption[] = [
  {
    id: 'drone',
    name: 'Entrega con dron autónomo',
    eta: '2 - 4 horas',
    description: 'Dron sigiloso con refrigeración líquida para hardware sensible.',
    priceCents: 19900,
    badge: 'Ultra rápido',
    perks: ['Seguimiento en vivo', 'Autorización biométrica', 'Seguro antigravedad']
  },
  {
    id: 'neon-rider',
    name: 'Neon Rider nocturno',
    eta: '24 horas',
    description: 'Mensajero especializado en zonas urbanas con cámaras ONV.',
    priceCents: 8900,
    badge: 'Balanceado',
    perks: ['Notificaciones proactivas', 'Sellado anti-manipulación', 'Firma holográfica']
  },
  {
    id: 'pickup',
    name: 'Recolecta en cápsula segura',
    eta: 'Listo en 4 horas',
    description: 'Resguardo en lockers 24/7 con autenticación facial.',
    priceCents: 0,
    badge: 'Sin costo',
    perks: ['Acceso 24/7', 'Locker refrigerado', 'Código dinámico']
  }
];

const productsContainer = document.querySelector<HTMLDivElement>('#products');
const cartItemsContainer = document.querySelector<HTMLUListElement>('#cartItems');
const cartTotalElement = document.querySelector<HTMLSpanElement>('#cartTotal');
const suggestionsList = document.querySelector<HTMLUListElement>('#suggestions');
const searchInput = document.querySelector<HTMLInputElement>('#search');
const reviewsContainer = document.querySelector<HTMLDivElement>('#reviewsList');
const blogContainer = document.querySelector<HTMLDivElement>('#blogPosts');
const salesChart = document.querySelector<HTMLCanvasElement>('#salesChart');
const topProductsList = document.querySelector<HTMLUListElement>('#topProducts');
const registerForm = document.querySelector<HTMLFormElement>('#registerForm');
const loginForm = document.querySelector<HTMLFormElement>('#loginForm');
const logoutButton = document.querySelector<HTMLButtonElement>('#logoutButton');
const authStatusElement = document.querySelector<HTMLParagraphElement>('#authStatus');
const authPanelElement = document.querySelector<HTMLElement>('#auth');
const authPanelBody = document.querySelector<HTMLDivElement>('#authPanelBody');
const toggleAuthPanelButton = document.querySelector<HTMLButtonElement>('#toggleAuthPanel');
const checkoutFlowSection = document.querySelector<HTMLElement>('#checkoutFlow');
const checkoutFlowStatusElement = document.querySelector<HTMLParagraphElement>('#checkoutFlowStatus');
const dismissCheckoutFlowButton = document.querySelector<HTMLButtonElement>('#dismissCheckoutFlow');
const invoiceNumberElement = document.querySelector<HTMLSpanElement>('#invoiceNumber');
const invoiceUserElement = document.querySelector<HTMLSpanElement>('#invoiceUser');
const invoiceItemsList = document.querySelector<HTMLUListElement>('#invoiceItems');
const invoiceTotalValue = document.querySelector<HTMLSpanElement>('#invoiceTotal');
const invoiceAutoStatus = document.querySelector<HTMLSpanElement>('#invoiceAutoStatus');
const invoiceShareStatus = document.querySelector<HTMLParagraphElement>('#invoiceShareStatus');
const invoiceWhatsAppInput = document.querySelector<HTMLInputElement>('#invoiceWhatsApp');
const invoiceTelegramInput = document.querySelector<HTMLInputElement>('#invoiceTelegram');
const sendInvoiceEmailButton = document.querySelector<HTMLButtonElement>('#sendInvoiceEmail');
const sendInvoiceWhatsAppButton = document.querySelector<HTMLButtonElement>('#sendInvoiceWhatsApp');
const sendInvoiceTelegramButton = document.querySelector<HTMLButtonElement>('#sendInvoiceTelegram');
const downloadInvoiceLink = document.querySelector<HTMLAnchorElement>('#downloadInvoice');
const goToShippingButton = document.querySelector<HTMLButtonElement>('#goToShipping');
const backToInvoiceButton = document.querySelector<HTMLButtonElement>('#backToInvoice');
const backToShippingButton = document.querySelector<HTMLButtonElement>('#backToShipping');
const confirmShippingButton = document.querySelector<HTMLButtonElement>('#confirmShippingButton');
const finishCheckoutFlowButton = document.querySelector<HTMLButtonElement>('#finishCheckoutFlow');
const shippingOptionsContainer = document.querySelector<HTMLDivElement>('#shippingOptions');
const shippingSummaryContainer = document.querySelector<HTMLDivElement>('#shippingSummary');
const trackingTimelineContainer = document.querySelector<HTMLDivElement>('#trackingTimeline');

let sessionUser: SessionUser | null = null;
let latestCartData: Cart | null = null;
let lastCheckoutSummary: CheckoutSummary | null = null;
let selectedShippingOption: ShippingOption | null = null;
let currentCheckoutStep: CheckoutStep = 'invoice';
let authPanelExpanded = false;

const fetchJSON = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const message = (parsed as { message?: string })?.message ?? raw;
        throw new Error(typeof message === 'string' ? message : raw);
      } catch {
        throw new Error(raw);
      }
    }
    throw new Error('No se pudo completar la solicitud.');
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

const setAuthPanelState = (expanded: boolean): void => {
  authPanelExpanded = expanded;
  if (!authPanelElement || !authPanelBody || !toggleAuthPanelButton) return;
  toggleAuthPanelButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  toggleAuthPanelButton.textContent = expanded ? 'Ocultar panel' : 'Mostrar panel';
  if (expanded) {
    authPanelElement.classList.remove('collapsed');
    authPanelBody.removeAttribute('hidden');
  } else {
    authPanelElement.classList.add('collapsed');
    authPanelBody.setAttribute('hidden', 'true');
  }
};

const openAuthPanel = (): void => setAuthPanelState(true);
const collapseAuthPanel = (): void => setAuthPanelState(false);

const cloneCartForInvoice = (cart: Cart): Cart => ({
  id: cart.id,
  items: cart.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    priceCents: item.priceCents,
    product: { ...item.product }
  }))
});

const buildCheckoutSummary = (cart: Cart, response: CheckoutResponse): CheckoutSummary => {
  const items = cart.items.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
    priceCents: item.priceCents
  }));
  const totalCents = items.reduce((acc, item) => acc + item.priceCents * item.quantity, 0);
  return {
    orderId: response.orderId,
    invoiceUrl: response.invoiceUrl,
    totalCents,
    items,
    emailSent: response.emailSent
  };
};

const updateCheckoutFlowStatus = (step: CheckoutStep) => {
  if (!checkoutFlowStatusElement) return;
  const messages: Record<CheckoutStep, string> = {
    invoice: 'Factura generada y lista para compartirse.',
    shipping: 'Selecciona cómo llegara tu pedido futurista.',
    confirmation: 'Confirmación lista. Monitorea el trayecto simulado del paquete.'
  };
  checkoutFlowStatusElement.textContent = messages[step];
};

const updateCheckoutStep = (step: CheckoutStep) => {
  currentCheckoutStep = step;
  checkoutFlowSection?.querySelectorAll('[data-step]').forEach((panelElement) => {
    const panel = panelElement as HTMLElement;
    panel.classList.toggle('hidden', panel.dataset.step !== step);
  });
  checkoutFlowSection?.querySelectorAll('[data-step-indicator]').forEach((indicatorElement) => {
    const indicator = indicatorElement as HTMLElement;
    indicator.classList.toggle('is-active', indicator.dataset.stepIndicator === step);
  });
  updateCheckoutFlowStatus(step);
};

const renderShippingOptions = () => {
  if (!shippingOptionsContainer) return;
  shippingOptionsContainer.innerHTML = shippingOptionsCatalog
    .map(
      (option) => `
        <button type="button" class="shipping-option-card" data-option="${option.id}">
          <span class="shipping-option-card__badge">${option.badge}</span>
          <strong>${option.name}</strong>
          <span>${option.description}</span>
          <span>ETA: ${option.eta}</span>
          <span>${formatCurrency(option.priceCents)}</span>
          <ul class="shipping-option-card__perks">
            ${option.perks.map((perk) => `<li>• ${perk}</li>`).join('')}
          </ul>
        </button>
      `
    )
    .join('');
};

const resetShippingSelection = () => {
  selectedShippingOption = null;
  confirmShippingButton?.setAttribute('disabled', 'true');
  shippingSummaryContainer && (shippingSummaryContainer.innerHTML = '');
  trackingTimelineContainer && (trackingTimelineContainer.innerHTML = '');
  shippingOptionsContainer
    ?.querySelectorAll('.shipping-option-card')
    .forEach((card) => card.classList.remove('is-selected'));
};

const renderInvoiceSummary = (summary: CheckoutSummary) => {
  if (!invoiceNumberElement || !invoiceItemsList || !invoiceTotalValue) return;
  invoiceNumberElement.textContent = `#${summary.orderId}`;
  if (invoiceUserElement) {
    invoiceUserElement.textContent = sessionUser ? `${sessionUser.name} · ${sessionUser.email}` : 'Cliente verificado';
  }
  invoiceItemsList.innerHTML =
    summary.items
      .map(
        (item) => `
          <li class="invoice-item">
            <div>
              <strong>${item.name}</strong>
              <span>${item.quantity} x ${formatCurrency(item.priceCents)}</span>
            </div>
            <strong>${formatCurrency(item.priceCents * item.quantity)}</strong>
          </li>
        `
      )
      .join('') || '<li class="invoice-item"><strong>Sin productos en la orden.</strong></li>';
  invoiceTotalValue.textContent = formatCurrency(summary.totalCents);
  if (invoiceAutoStatus) {
    invoiceAutoStatus.textContent = 'Factura generada. Elige correo, WhatsApp o Telegram para enviarla, o descárgala.';
  }
  if (invoiceShareStatus) {
    invoiceShareStatus.classList.add('hidden');
    invoiceShareStatus.textContent = '';
  }
  if (invoiceWhatsAppInput) {
    invoiceWhatsAppInput.value = invoiceWhatsAppInput.value || '';
  }
  if (invoiceTelegramInput) {
    invoiceTelegramInput.value = invoiceTelegramInput.value || '';
  }
  if (sendInvoiceEmailButton) {
    sendInvoiceEmailButton.disabled = false;
    sendInvoiceEmailButton.textContent = 'Enviar por correo';
  }
  if (sendInvoiceWhatsAppButton) {
    sendInvoiceWhatsAppButton.disabled = false;
    sendInvoiceWhatsAppButton.textContent = 'Enviar por WhatsApp';
  }
  if (sendInvoiceTelegramButton) {
    sendInvoiceTelegramButton.disabled = false;
    sendInvoiceTelegramButton.textContent = 'Enviar por Telegram';
  }
  if (downloadInvoiceLink) {
    if (summary.invoiceUrl) {
      downloadInvoiceLink.href = summary.invoiceUrl;
      downloadInvoiceLink.removeAttribute('aria-disabled');
      downloadInvoiceLink.setAttribute('download', `factura-${summary.orderId}.pdf`);
    } else {
      downloadInvoiceLink.href = '#';
      downloadInvoiceLink.setAttribute('aria-disabled', 'true');
      downloadInvoiceLink.removeAttribute('download');
    }
  }
};

const renderShippingSummary = (option: ShippingOption) => {
  if (!shippingSummaryContainer || !lastCheckoutSummary) return;
  shippingSummaryContainer.innerHTML = `
    <strong>${option.name}</strong>
    <span>${option.description}</span>
    <span>Tiempo estimado: ${option.eta}</span>
    <span>Costo de envío: ${formatCurrency(option.priceCents)}</span>
    <span>Pedido asociado: #${lastCheckoutSummary.orderId}</span>
  `;
};

const renderTrackingTimeline = (option: ShippingOption) => {
  if (!trackingTimelineContainer) return;
  const now = new Date();
  const hours = (offset: number) => new Date(now.getTime() + offset * 60 * 60 * 1000);
  const steps = [
    { title: 'Factura generada', detail: 'Factura futurista lista para compartirse.', timestamp: now },
    { title: 'Paquete preparándose', detail: 'El almacén holográfico segmenta tus artículos.', timestamp: hours(1) },
    { title: 'En tránsito', detail: option.name, timestamp: hours(2) },
    { title: 'Entrega estimada', detail: option.eta, timestamp: hours(4) }
  ];
  trackingTimelineContainer.innerHTML = steps
    .map(
      (step) => `
        <div class="tracking-step">
          <strong>${step.title}</strong>
          <span>${step.detail}</span>
          <span>${step.timestamp.toLocaleString('es-MX')}</span>
        </div>
      `
    )
    .join('');
};

const showCheckoutFlow = (summary: CheckoutSummary) => {
  lastCheckoutSummary = summary;
  renderInvoiceSummary(summary);
  renderShippingOptions();
  resetShippingSelection();
  updateCheckoutStep('invoice');
  checkoutFlowSection?.classList.remove('hidden');
  dismissCheckoutFlowButton?.classList.remove('hidden');
  checkoutFlowSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const handleInvoiceShare = async (method: 'email' | 'whatsapp' | 'telegram') => {
  if (!invoiceShareStatus || !lastCheckoutSummary) return;

  const payload: Record<string, unknown> = { method };
  const targetButton =
    method === 'email'
      ? sendInvoiceEmailButton
      : method === 'whatsapp'
        ? sendInvoiceWhatsAppButton
        : sendInvoiceTelegramButton;

  if (method === 'whatsapp') {
    const phone = invoiceWhatsAppInput?.value.trim();
    if (!phone) {
      invoiceShareStatus.textContent = 'Ingresa un numero de WhatsApp con lada internacional.';
      invoiceShareStatus.classList.remove('hidden');
      return;
    }
    payload.phone = phone;
  }
  if (method === 'telegram') {
    const chatId = invoiceTelegramInput?.value.trim();
    if (!chatId) {
      invoiceShareStatus.textContent = 'Ingresa el chat ID de Telegram.';
      invoiceShareStatus.classList.remove('hidden');
      return;
    }
    payload.telegramChatId = chatId;
  }

  invoiceShareStatus.textContent =
    method === 'email'
      ? 'Reenviando la factura a tu correo...'
      : method === 'whatsapp'
        ? 'Enviando PDF por WhatsApp...'
        : 'Enviando PDF por Telegram...';
  invoiceShareStatus.classList.remove('hidden');
  targetButton?.setAttribute('disabled', 'true');

  try {
    const response = await fetchJSON<ShareInvoiceResponse>(
      `/api/cart/orders/${lastCheckoutSummary.orderId}/share`,
      { method: 'POST', body: JSON.stringify(payload) }
    );

    if (method === 'email' && sendInvoiceEmailButton) {
      sendInvoiceEmailButton.textContent = 'Correo enviado';
    }
    if (method === 'whatsapp' && sendInvoiceWhatsAppButton) {
      sendInvoiceWhatsAppButton.textContent = 'WhatsApp enviado';
    }
    if (method === 'telegram' && sendInvoiceTelegramButton) {
      sendInvoiceTelegramButton.textContent = 'Telegram enviado';
    }

    if (downloadInvoiceLink && response.invoiceUrl) {
      downloadInvoiceLink.href = response.invoiceUrl;
      downloadInvoiceLink.removeAttribute('aria-disabled');
      downloadInvoiceLink.setAttribute('download', `factura-${lastCheckoutSummary.orderId}.pdf`);
    }
    if (lastCheckoutSummary) {
      lastCheckoutSummary.invoiceUrl = response.invoiceUrl;
    }

    invoiceShareStatus.textContent = response.message;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo compartir la factura.';
    invoiceShareStatus.textContent = message;
  } finally {
    targetButton?.removeAttribute('disabled');
  }
};

const hideCheckoutFlow = () => {
  checkoutFlowSection?.classList.add('hidden');
  dismissCheckoutFlowButton?.classList.add('hidden');
  lastCheckoutSummary = null;
  resetShippingSelection();
  updateCheckoutStep('invoice');
};

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
    latestCartData = cart;
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
            <small>${review.user?.name ?? 'Usuario anónimo'}</small>
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

const setAuthStatus = (user: SessionUser | null): void => {
  sessionUser = user;
  if (!authStatusElement) return;
  if (user) {
    authStatusElement.textContent = `Sesión activa: ${user.name} (${user.role})`;
    logoutButton?.classList.remove('hidden');
    collapseAuthPanel();
  } else {
    authStatusElement.textContent = 'Sin sesión. Despliega el submenú para autenticarte.';
    logoutButton?.classList.add('hidden');
    hideCheckoutFlow();
  }
};

const loadCurrentUser = async (): Promise<void> => {
  try {
    const { user } = await fetchJSON<{ user: SessionUser | null }>('/api/auth/me');
    setAuthStatus(user ?? null);
  } catch {
    setAuthStatus(null);
  }
};

const setupAuthForms = () => {
  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const payload = {
      name: (formData.get('name') ?? '').toString().trim(),
      email: (formData.get('email') ?? '').toString().toLowerCase(),
      password: (formData.get('password') ?? '').toString(),
      role: (formData.get('role') || undefined)?.toString() || undefined
    };
    try {
      await fetchJSON('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      alert('Usuario registrado correctamente. Ahora puedes iniciar sesión.');
      registerForm.reset();
    } catch (error) {
      alert('No se pudo registrar el usuario.');
      console.error('Error creando usuario', error);
    }
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
      email: (formData.get('email') ?? '').toString().toLowerCase(),
      password: (formData.get('password') ?? '').toString()
    };
    try {
      await fetchJSON('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      alert('Autenticación exitosa. Ya puedes generar tu factura.');
      loginForm.reset();
      await loadCurrentUser();
    } catch (error) {
      alert('Credenciales inválidas, intenta nuevamente.');
      console.error('Error al iniciar sesión', error);
    }
  });

  logoutButton?.addEventListener('click', async () => {
    try {
      await fetchJSON('/api/auth/logout', { method: 'POST' });
      alert('Sesión cerrada.');
      await loadCurrentUser();
    } catch (error) {
      alert('No se pudo cerrar sesión.');
      console.error('Error cerrando sesión', error);
    }
  });
};

const setupAuthPanelToggle = () => {
  toggleAuthPanelButton?.addEventListener('click', () => {
    setAuthPanelState(!authPanelExpanded);
  });
};

const setupCheckoutFlow = () => {
  sendInvoiceEmailButton?.addEventListener('click', () => void handleInvoiceShare('email'));
  sendInvoiceWhatsAppButton?.addEventListener('click', () => void handleInvoiceShare('whatsapp'));
  sendInvoiceTelegramButton?.addEventListener('click', () => void handleInvoiceShare('telegram'));
  downloadInvoiceLink?.addEventListener('click', (event) => {
    if (lastCheckoutSummary?.invoiceUrl) return;
    event.preventDefault();
    alert('El PDF aún no está disponible. Intenta nuevamente en unos segundos.');
  });
  goToShippingButton?.addEventListener('click', () => {
    if (!lastCheckoutSummary) return;
    updateCheckoutStep('shipping');
  });
  backToInvoiceButton?.addEventListener('click', () => updateCheckoutStep('invoice'));
  backToShippingButton?.addEventListener('click', () => updateCheckoutStep('shipping'));
  confirmShippingButton?.addEventListener('click', () => {
    if (!selectedShippingOption || !lastCheckoutSummary) return;
    renderShippingSummary(selectedShippingOption);
    renderTrackingTimeline(selectedShippingOption);
    updateCheckoutStep('confirmation');
  });
  finishCheckoutFlowButton?.addEventListener('click', () => hideCheckoutFlow());
  dismissCheckoutFlowButton?.addEventListener('click', () => hideCheckoutFlow());
  shippingOptionsContainer?.addEventListener('click', (event) => {
    const optionButton = (event.target as HTMLElement).closest<HTMLButtonElement>('.shipping-option-card');
    if (!optionButton) return;
    const option = shippingOptionsCatalog.find((entry) => entry.id === optionButton.dataset.option);
    if (!option) return;
    selectedShippingOption = option;
    shippingOptionsContainer?.querySelectorAll('.shipping-option-card').forEach((card) => {
      card.classList.toggle('is-selected', card === optionButton);
    });
    confirmShippingButton?.removeAttribute('disabled');
  });
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

  searchInput?.addEventListener('input', async (event) => {
    const value = (event.target as HTMLInputElement).value;
    if (!value || value.length < 2) {
      if (suggestionsList) suggestionsList.innerHTML = '';
      if (!value) {
        void loadProducts();
      }
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

  suggestionsList?.addEventListener('click', async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLLIElement>('li[data-slug]');
    if (!target || !suggestionsList) return;
    const slug = target.getAttribute('data-slug');
    if (!slug) return;
    try {
      const product = await fetchJSON<Product>(`/api/products/${slug}`);
      renderProducts([product]);
      suggestionsList.innerHTML = '';
      if (searchInput) {
        searchInput.value = product.name;
      }
      productsContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Error mostrando el producto seleccionado', error);
    }
  });

  document.querySelector('#checkout')?.addEventListener('click', async () => {
    if (!sessionUser) {
      alert('Debes iniciar sesión para generar tu factura y continuar con el checkout.');
      openAuthPanel();
      authPanelElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!latestCartData) {
      await loadCart();
    }
    if (!latestCartData || latestCartData.items.length === 0) {
      alert('Tu carrito está vacío. Agrega mercancía antes de continuar.');
      return;
    }
    const cartSnapshot = cloneCartForInvoice(latestCartData);
    try {
      const response = await fetchJSON<CheckoutResponse>('/api/cart/checkout', { method: 'POST' });
      const summary = buildCheckoutSummary(cartSnapshot, response);
      await loadCart();
      showCheckoutFlow(summary);
    } catch (error) {
      alert('No se pudo procesar el checkout. Verifica tu sesión e inténtalo nuevamente.');
      console.error('Error completando checkout', error);
      await loadCurrentUser();
    }
  });
};

void loadProducts();
void loadCart();
void loadReviews();
void loadBlog();
void loadDashboard();
void loadCurrentUser();
setupAuthPanelToggle();
setupAuthForms();
setupCheckoutFlow();
setupInteractions();
