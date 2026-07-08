// ==========================================
// CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================
let menuData = [];
let cart = [];
const WHATSAPP_PHONE = "5531984684088"; // Telefone da Panificadora
let isScrollingFromClick = false; // Evita conflito no ScrollSpy durante cliques no menu
let scrollTimeout;

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadMenu();
    initCart();
    setupEventListeners();
});

// ==========================================
// CARREGAMENTO DO CARDÁPIO
// ==========================================
async function loadMenu() {
    const menuSections = document.getElementById('menuSections');
    try {
        // Tenta buscar da API do servidor, com fallback para o arquivo local se der erro ou 404
        let response = await fetch('/api/menu').catch(() => null);
        if (!response || !response.ok) {
            response = await fetch('cardapio.json');
        }
        if (!response.ok) throw new Error('Não foi possível carregar o cardápio');
        
        menuData = await response.json();
        
        // Salva cópia local para fallback offline
        localStorage.setItem('andreia_menu_cache', JSON.stringify(menuData));
        
        renderMenu(menuData);
    } catch (err) {
        console.warn('Erro ao carregar cardápio online, carregando do cache...', err);
        const cached = localStorage.getItem('andreia_menu_cache');
        if (cached) {
            menuData = JSON.parse(cached);
            renderMenu(menuData);
        } else {
            menuSections.innerHTML = '<div class="loading-spinner">Erro ao carregar o cardápio. Verifique sua conexão.</div>';
        }
    }
}

// ==========================================
// RENDERIZAÇÃO DINÂMICA
// ==========================================
function renderMenu(categories, filterText = '') {
    const menuSections = document.getElementById('menuSections');
    const sidebarNavList = document.getElementById('sidebarNavList');
    const horizontalNavList = document.getElementById('horizontalNavList');
    
    // Limpa contêineres
    menuSections.innerHTML = '';
    sidebarNavList.innerHTML = '';
    horizontalNavList.innerHTML = '';
    
    // Adiciona link Home/Topo no Horizontal
    const liHome = document.createElement('li');
    liHome.innerHTML = `<a href="#topo" class="h-nav-link active">BEM VINDOS!</a>`;
    horizontalNavList.appendChild(liHome);

    let hasResults = false;
    const searchFilter = filterText.toLowerCase().trim();

    categories.forEach(category => {
        // Se for informativo
        if (category.isInfo) {
            if (searchFilter === '') { // Esconde informativo na busca ativa
                renderInfoSection(category);
                renderCategoryNav(category);
            }
            return;
        }

        // Filtra os produtos
        const filteredProducts = category.products.filter(prod => {
            return prod.title.toLowerCase().includes(searchFilter) || 
                   prod.description.toLowerCase().includes(searchFilter);
        });

        if (filteredProducts.length > 0) {
            hasResults = true;
            
            // Renderiza categoria no menu lateral e horizontal
            renderCategoryNav(category);
            
            // Cria a seção da categoria
            const section = document.createElement('section');
            section.id = category.id;
            section.className = 'menu-category';
            
            section.innerHTML = `
                <h2>${category.title}</h2>
                <div class="products-grid"></div>
            `;
            
            const grid = section.querySelector('.products-grid');
            
            filteredProducts.forEach(product => {
                const card = document.createElement('article');
                card.className = 'product-card';
                
                // Trata caminhos de imagens e fallback
                const imagePath = product.image ? product.image : 'logo.jpg';
                
                card.innerHTML = `
                    <div class="product-image" style="background-image: url('${imagePath}'); background-position: center; background-size: cover;">
                        <h3 class="product-title">${product.title}</h3>
                    </div>
                    <div class="product-info">
                        <p class="product-desc">${product.description || '.'}</p>
                        <div class="product-price-wrapper">
                            <span class="price-prefix">${product.pricePrefix || 'A partir de'}</span>
                            <span class="product-price">${product.price ? 'R$ ' + product.price : 'Sob Consulta'}</span>
                        </div>
                    </div>
                `;
                
                // Clique para abrir modal
                card.addEventListener('click', () => openModal(product));
                grid.appendChild(card);
            });
            
            menuSections.appendChild(section);
        }
    });

    if (!hasResults && searchFilter !== '') {
        menuSections.innerHTML = '<div class="loading-spinner">Nenhum produto encontrado para sua busca.</div>';
    }

    // Re-vincula os cliques nos links de âncoras criados dinamicamente
    setupAnchorNavigation();
    initScrollSpy();
}

function renderCategoryNav(category) {
    const sidebarNavList = document.getElementById('sidebarNavList');
    const horizontalNavList = document.getElementById('horizontalNavList');
    
    // Sidebar
    const liSide = document.createElement('li');
    liSide.innerHTML = `<a href="#${category.id}" class="nav-link">${category.title.split('(')[0].trim()}</a>`;
    sidebarNavList.appendChild(liSide);
    
    // Horizontal
    const liHoriz = document.createElement('li');
    liHoriz.innerHTML = `<a href="#${category.id}" class="h-nav-link">${category.title.split('(')[0].toUpperCase()}</a>`;
    horizontalNavList.appendChild(liHoriz);
}

function renderInfoSection(category) {
    const menuSections = document.getElementById('menuSections');
    const section = document.createElement('section');
    section.id = category.id;
    section.className = 'menu-category';
    section.style.marginTop = '50px';
    section.style.paddingTop = '30px';
    section.style.borderTop = '1px solid var(--border-color)';
    
    section.innerHTML = `
        <h2>${category.title}</h2>
        ${category.content}
    `;
    menuSections.appendChild(section);
}

function setupAnchorNavigation() {
    const navLinks = document.querySelectorAll('.nav-link, .h-nav-link, .btn-primary');
    navLinks.forEach(link => {
        // Remove listeners antigos clonando
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        
        newLink.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (!href.startsWith('#')) return;
            e.preventDefault();
            
            // Ativa flag de scroll manual por clique
            isScrollingFromClick = true;
            clearTimeout(scrollTimeout);
            
            // Set active class
            if (this.classList.contains('nav-link')) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            } else if (this.classList.contains('h-nav-link')) {
                document.querySelectorAll('.h-nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }

            // Fecha sidebar no mobile
            const hamburger = document.getElementById('hamburger');
            const sidebarNav = document.getElementById('sidebarNav');
            const sidebarFooter = document.getElementById('sidebarFooter');
            if (window.innerWidth < 992 && this.classList.contains('nav-link')) {
                hamburger.classList.remove('active');
                sidebarNav.classList.remove('active');
                sidebarFooter.classList.remove('active');
            }

            // Scroll suave com offset
            if (href === '#topo') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                scrollTimeout = setTimeout(() => {
                    isScrollingFromClick = false;
                }, 800);
                return;
            }
            
            const targetSection = document.querySelector(href);
            if (targetSection) {
                const headerOffset = window.innerWidth < 992 ? 140 : 80;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                scrollTimeout = setTimeout(() => {
                    isScrollingFromClick = false;
                }, 800);
            } else {
                isScrollingFromClick = false;
            }
        });
    });
}

// ==========================================
// MODAL DE DETALHES DO PRODUTO
// ==========================================
function openModal(product) {
    const modalOverlay = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalObs = document.getElementById('modalObs');
    const modalVariations = document.getElementById('modalVariations');
    const modalImage = document.getElementById('modalImage');
    
    if (product.image) {
        modalImage.style.backgroundImage = `url('${product.image}')`;
        modalImage.style.display = 'block';
        
        // Detecta dimensões da imagem para ajustar o encaixe dinamicamente
        const tempImg = new Image();
        tempImg.src = product.image;
        tempImg.onload = function() {
            if (tempImg.naturalWidth >= tempImg.naturalHeight) {
                // Se a imagem for horizontal (landscape), usa cover (recorta apenas nas laterais)
                modalImage.style.backgroundSize = 'cover';
            } else {
                // Se for vertical (portrait) ou quadrada alta, usa contain para não cortar topo/base
                modalImage.style.backgroundSize = 'contain';
            }
        };
    } else {
        modalImage.style.backgroundImage = 'none';
        modalImage.style.display = 'none';
    }
    
    modalTitle.textContent = product.title;
    modalObs.textContent = product.description && product.description.trim().length > 1 && product.description !== "." 
        ? product.description 
        : 'Selecione a opção desejada para adicionar ao seu pedido:';
    
    modalVariations.innerHTML = '';
    
    const vars = product.variations || [];
    
    if (vars.length > 0) {
        vars.forEach(v => {
            const li = document.createElement('li');
            const cartItem = findCartItem(product.title, v.name);
            const qty = cartItem ? cartItem.quantity : 0;
            
            li.innerHTML = `
                <div class="var-name-price">
                    <span class="var-name">${v.name}</span>
                    <span class="var-price">${v.price && v.price !== '-' ? 'R$ ' + v.price : ''}</span>
                </div>
                <div class="var-add-control" data-product="${product.title}" data-variation="${v.name}" data-price="${v.price}">
                    ${qty > 0 ? `
                        <button class="var-qty-btn decrease-var">-</button>
                        <span class="qty-val">${qty}</span>
                        <button class="var-qty-btn increase-var">+</button>
                    ` : `
                        <button class="var-add-btn add-to-cart-btn">Adicionar</button>
                    `}
                </div>
            `;
            modalVariations.appendChild(li);
        });
    } else {
        // Produto sem variações declaradas no JSON
        const li = document.createElement('li');
        const cartItem = findCartItem(product.title, product.title);
        const qty = cartItem ? cartItem.quantity : 0;
        
        li.innerHTML = `
            <div class="var-name-price">
                <span class="var-name">${product.title}</span>
                <span class="var-price">${product.price ? 'R$ ' + product.price : 'Sob Consulta'}</span>
            </div>
            <div class="var-add-control" data-product="${product.title}" data-variation="${product.title}" data-price="${product.price || '0'}">
                ${qty > 0 ? `
                    <button class="var-qty-btn decrease-var">-</button>
                    <span class="qty-val">${qty}</span>
                    <button class="var-qty-btn increase-var">+</button>
                ` : `
                    <button class="var-add-btn add-to-cart-btn">Adicionar</button>
                `}
            </div>
        `;
        modalVariations.appendChild(li);
    }
    
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Bloqueia rolagem ao fundo
    
    // Vincula eventos de clique no modal
    setupModalCartEvents(product);
}

function fecharModal() {
    const modalOverlay = document.getElementById('productModal');
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function setupModalCartEvents(product) {
    const modalVariations = document.getElementById('modalVariations');
    
    // Clona o elemento para limpar qualquer listener de clique anterior acumulado
    const newModalVariations = modalVariations.cloneNode(true);
    modalVariations.parentNode.replaceChild(newModalVariations, modalVariations);
    
    newModalVariations.addEventListener('click', (e) => {
        const target = e.target;
        const container = target.closest('.var-add-control');
        if (!container) return;
        
        const pTitle = container.getAttribute('data-product');
        const vName = container.getAttribute('data-variation');
        const pPrice = container.getAttribute('data-price');
        
        if (target.classList.contains('add-to-cart-btn')) {
            addToCart(pTitle, vName, pPrice);
            openModal(product); // Recarrega o modal para atualizar botões
        } else if (target.classList.contains('increase-var')) {
            updateCartQuantity(pTitle, vName, 1);
            openModal(product);
        } else if (target.classList.contains('decrease-var')) {
            updateCartQuantity(pTitle, vName, -1);
            openModal(product);
        }
    });
}

// ==========================================
// GESTÃO DO CARRINHO DE COMPRAS
// ==========================================
function initCart() {
    const savedCart = localStorage.getItem('andreia_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('andreia_cart', JSON.stringify(cart));
    updateCartUI();
}

function findCartItem(product, variation) {
    return cart.find(item => item.product === product && item.variation === variation);
}

function addToCart(product, variation, price) {
    const existing = findCartItem(product, variation);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            product,
            variation,
            price: price,
            quantity: 1
        });
    }
    saveCart();
}

function updateCartQuantity(product, variation, delta) {
    const item = findCartItem(product, variation);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            cart = cart.filter(i => !(i.product === product && i.variation === variation));
        }
        saveCart();
    }
}

function updateCartUI() {
    const cartCountBadge = document.getElementById('cartCountBadge');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartCheckoutArea = document.getElementById('cartCheckoutArea');
    const cartDrawerFooter = document.getElementById('cartDrawerFooter');
    const clearCartBtn = document.getElementById('clearCartBtn');
    
    // Contagem de itens
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalItems > 0) {
        cartCountBadge.textContent = totalItems;
        cartCountBadge.style.display = 'flex';
        cartCheckoutArea.style.display = 'block';
        cartDrawerFooter.style.display = 'block';
        if (clearCartBtn) clearCartBtn.style.display = 'block';
    } else {
        cartCountBadge.style.display = 'none';
        cartCheckoutArea.style.display = 'none';
        cartDrawerFooter.style.display = 'none';
        if (clearCartBtn) clearCartBtn.style.display = 'none';
    }
    
    // Lista de itens no Drawer
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<p class="empty-cart-msg">Seu carrinho está vazio.</p>';
        cartSubtotal.textContent = 'R$ 0,00';
        return;
    }
    
    cartItemsList.innerHTML = '';
    let totalVal = 0;
    
    cart.forEach(item => {
        const itemTotal = parsePrice(item.price) * item.quantity;
        totalVal += itemTotal;
        
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-title">${item.product}</div>
                <div class="cart-item-variation">${item.variation !== item.product ? item.variation : ''}</div>
                <div class="cart-item-price">${item.price && item.price !== '-' ? 'R$ ' + item.price : 'Sob consulta'}</div>
            </div>
            <div class="cart-item-actions">
                <button class="qty-btn dec-qty" data-prod="${item.product}" data-var="${item.variation}">-</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn inc-qty" data-prod="${item.product}" data-var="${item.variation}">+</button>
            </div>
        `;
        cartItemsList.appendChild(div);
    });
    
    cartSubtotal.textContent = formatMoney(totalVal);
}

// Auxiliar para ler preços em string
function parsePrice(priceStr) {
    if (!priceStr || priceStr === '-') return 0;
    const match = priceStr.match(/[\d\.,]+/);
    if (!match) return 0;
    const numStr = match[0].replace(/\./g, '').replace(',', '.');
    return parseFloat(numStr) || 0;
}

function formatMoney(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
}

// ==========================================
// CONFIGURAÇÃO DOS COMPORTAMENTOS DO APP
// ==========================================
function setupEventListeners() {
    // Menu Hambúrguer (Mobile)
    const hamburger = document.getElementById('hamburger');
    const sidebarNav = document.getElementById('sidebarNav');
    const sidebarFooter = document.getElementById('sidebarFooter');
    
    if(hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            sidebarNav.classList.toggle('active');
            sidebarFooter.classList.toggle('active');
        });
    }
    
    // Info Pill Dropdown
    const infoPillBtn = document.getElementById('infoPillBtn');
    const infoDropdown = document.getElementById('infoDropdown');
    
    if(infoPillBtn) {
        infoPillBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = infoPillBtn.getAttribute('aria-expanded') === 'true';
            infoPillBtn.setAttribute('aria-expanded', !isExpanded);
            infoDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!infoPillBtn.contains(e.target) && !infoDropdown.contains(e.target)) {
                infoPillBtn.setAttribute('aria-expanded', 'false');
                infoDropdown.classList.remove('show');
            }
        });
    }

    // Modal de produto fechar
    const closeModalBtn = document.getElementById('closeModal');
    const productModal = document.getElementById('productModal');
    
    if(closeModalBtn) closeModalBtn.addEventListener('click', fecharModal);
    if(productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target === productModal) fecharModal();
        });
    }

    // Toggle do Carrinho
    const cartToggleBtn = document.getElementById('cartToggleBtn');
    const closeCartDrawer = document.getElementById('closeCartDrawer');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    
    function toggleCart() {
        cartDrawer.classList.toggle('active');
        cartOverlay.classList.toggle('active');
    }
    
    if(cartToggleBtn) cartToggleBtn.addEventListener('click', toggleCart);
    if(closeCartDrawer) closeCartDrawer.addEventListener('click', toggleCart);
    if(cartOverlay) cartOverlay.addEventListener('click', toggleCart);

    // Esvaziar Carrinho
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente esvaziar o seu carrinho?')) {
                cart = [];
                saveCart();
            }
        });
    }

    // Eventos de clique nas quantidades do carrinho
    const cartItemsList = document.getElementById('cartItemsList');
    cartItemsList.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('qty-btn')) return;
        
        const product = btn.getAttribute('data-prod');
        const variation = btn.getAttribute('data-var');
        
        if (btn.classList.contains('inc-qty')) {
            updateCartQuantity(product, variation, 1);
        } else if (btn.classList.contains('dec-qty')) {
            updateCartQuantity(product, variation, -1);
        }
    });

    // Filtros de entrega/retirada no Checkout
    const deliveryType = document.getElementById('deliveryType');
    const addressGroup = document.getElementById('addressGroup');
    const clientAddress = document.getElementById('clientAddress');
    
    if(deliveryType) {
        deliveryType.addEventListener('change', () => {
            if (deliveryType.value === 'entrega') {
                addressGroup.style.display = 'block';
                clientAddress.setAttribute('required', 'true');
            } else {
                addressGroup.style.display = 'none';
                clientAddress.removeAttribute('required');
            }
        });
    }

    // Filtros de forma de pagamento
    const paymentMethod = document.getElementById('paymentMethod');
    const changeGroup = document.getElementById('changeGroup');
    const cashChange = document.getElementById('cashChange');
    
    if(paymentMethod) {
        paymentMethod.addEventListener('change', () => {
            if (paymentMethod.value === 'Dinheiro') {
                changeGroup.style.display = 'block';
            } else {
                changeGroup.style.display = 'none';
                cashChange.value = '';
            }
        });
    }

    // Enviar pedido para o WhatsApp
    const sendOrderBtn = document.getElementById('sendOrderBtn');
    if(sendOrderBtn) {
        sendOrderBtn.addEventListener('click', sendWhatsAppOrder);
    }

    // Lógica da Barra de Pesquisa
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if(searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value;
            if (query.trim().length > 0) {
                clearSearchBtn.style.display = 'block';
            } else {
                clearSearchBtn.style.display = 'none';
            }
            renderMenu(menuData, query);
        });
    }
    
    if(clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            renderMenu(menuData);
        });
    }
}

// ==========================================
// CONSTRUÇÃO E ENVIO DO PEDIDO PARA WHATSAPP
// ==========================================
function sendWhatsAppOrder() {
    const name = document.getElementById('clientName').value.trim();
    const delivery = document.getElementById('deliveryType').value;
    const address = document.getElementById('clientAddress').value.trim();
    const payment = document.getElementById('paymentMethod').value;
    const change = document.getElementById('cashChange').value.trim();
    
    // Validação básica
    if (!name) {
        alert('Por favor, informe seu nome.');
        return;
    }
    if (delivery === 'entrega' && !address) {
        alert('Por favor, preencha o endereço completo de entrega.');
        return;
    }
    
    // Monta a mensagem
    let msg = `*NOVO PEDIDO - PANIFICADORA ANDRÉIA*\n`;
    msg += `------------------------------------\n`;
    msg += `*Cliente:* ${name}\n`;
    msg += `*Entrega:* ${delivery === 'entrega' ? 'Entrega em Domicílio' : 'Retirar na Panificadora'}\n`;
    
    if (delivery === 'entrega') {
        msg += `*Endereço:* ${address}\n`;
    }
    
    msg += `*Pagamento:* ${payment}\n`;
    if (payment === 'Dinheiro' && change) {
        msg += `*Troco para:* ${change}\n`;
    }
    
    msg += `------------------------------------\n`;
    msg += `*ITENS DO PEDIDO:*\n\n`;
    
    let subtotal = 0;
    cart.forEach(item => {
        const itemPrice = parsePrice(item.price);
        const itemTotal = itemPrice * item.quantity;
        subtotal += itemTotal;
        
        msg += `• *${item.quantity}x* ${item.product}\n`;
        if (item.variation !== item.product) {
            msg += `  _Opção:_ ${item.variation}\n`;
        }
        msg += `  _Valor:_ ${item.price && item.price !== '-' ? 'R$ ' + item.price : 'Sob Consulta'} (${formatMoney(itemTotal)})\n\n`;
    });
    
    msg += `------------------------------------\n`;
    msg += `*TOTAL DO PEDIDO:* ${formatMoney(subtotal)}\n`;
    msg += `------------------------------------\n`;
    msg += `_Solicitação enviada via Cardápio Digital._`;
    
    // Codifica para URL do WhatsApp
    const encodedMsg = encodeURIComponent(msg);
    const waUrl = `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodedMsg}&type=phone_number&app_absent=0`;
    
    // Abre no navegador/app
    window.open(waUrl, '_blank');
    
    // Opcional: limpa carrinho após envio
    cart = [];
    saveCart();
    
    // Fecha o carrinho
    const cartDrawer = document.getElementById('cartDrawer');
    const cartOverlay = document.getElementById('cartOverlay');
    cartDrawer.classList.remove('active');
    cartOverlay.classList.remove('active');
    
    // Limpa formulário
    document.getElementById('checkoutForm').reset();
    document.getElementById('addressGroup').style.display = 'none';
    document.getElementById('changeGroup').style.display = 'none';
}

// ==========================================
// SCROLLSPY (INTERSECTION OBSERVER)
// ==========================================
function initScrollSpy() {
    const sections = document.querySelectorAll('.menu-category');
    const navLinks = document.querySelectorAll('.nav-link');
    const hNavLinks = document.querySelectorAll('.h-nav-link');
    
    if (sections.length === 0) return;
    
    const observerOptions = {
        root: null,
        rootMargin: '-120px 0px -60% 0px',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        if (isScrollingFromClick) return;
        
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                
                // Atualiza Links do Menu Lateral
                navLinks.forEach(link => {
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
                
                // Atualiza Links do Menu Horizontal
                hNavLinks.forEach(link => {
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                        // Scroll horizontal suave para centralizar o item
                        const container = document.getElementById('horizontalNavList').parentElement;
                        const linkLeft = link.offsetLeft;
                        const linkWidth = link.offsetWidth;
                        const containerWidth = container.offsetWidth;
                        
                        container.scrollTo({
                            left: linkLeft - (containerWidth / 2) + (linkWidth / 2),
                            behavior: 'smooth'
                        });
                    } else {
                        link.classList.remove('active');
                    }
                });
            }
        });
    }, observerOptions);
    
    sections.forEach(section => observer.observe(section));
}
