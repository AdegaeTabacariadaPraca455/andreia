// ==========================================
// ESTADO GLOBAL DO ADMIN
// ==========================================
let menuData = [];
let availableImages = [];
let selectedCategoryId = null;
let currentEditingItem = null; // { type: 'product'|'category', data: obj, index: int, parentId: str }
let hasUnsavedChanges = false;

// ==========================================
// CONTROLE DE AUTENTICAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    setupEventListeners();
});

function checkLogin() {
    const isLogged = sessionStorage.getItem('andreia_admin_logged') === 'true';
    const loginWrapper = document.getElementById('loginWrapper');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    const resetMenuBtn = document.getElementById('resetMenuBtn');
    
    if (isLogged) {
        loginWrapper.style.display = 'none';
        dashboardContainer.classList.add('active');
        logoutBtn.style.display = 'block';
        if (resetMenuBtn) {
            if (localStorage.getItem('andreia_menu_custom')) {
                resetMenuBtn.style.display = 'block';
            } else {
                resetMenuBtn.style.display = 'none';
            }
        }
        if (hasUnsavedChanges) saveChangesBtn.style.display = 'block';
        
        // Carrega dados se logado
        initDashboard();
    } else {
        loginWrapper.style.display = 'flex';
        dashboardContainer.classList.remove('active');
        logoutBtn.style.display = 'none';
        saveChangesBtn.style.display = 'none';
        if (resetMenuBtn) resetMenuBtn.style.display = 'none';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    
    if (password === 'andreia123') {
        sessionStorage.setItem('andreia_admin_logged', 'true');
        showToast('Login realizado com sucesso!', 'success');
        checkLogin();
    } else {
        showToast('Senha incorreta!', 'error');
    }
}

function handleLogout() {
    sessionStorage.removeItem('andreia_admin_logged');
    showToast('Você saiu do painel.', 'info');
    checkLogin();
}

// ==========================================
// INICIALIZAÇÃO DO PAINEL
// ==========================================
async function initDashboard() {
    try {
        let menuLoaded = false;
        
        // 1. Tenta buscar do localStorage (modificações personalizadas)
        const customMenu = localStorage.getItem('andreia_menu_custom');
        if (customMenu) {
            try {
                menuData = JSON.parse(customMenu);
                if (Array.isArray(menuData) && menuData.length > 0) {
                    menuLoaded = true;
                    console.log('Cardápio carregado de modificações locais (localStorage)');
                }
            } catch (e) {
                console.warn('Erro ao carregar cardápio personalizado do localStorage:', e);
            }
        }
        
        // 2. Tenta buscar da API do servidor
        if (!menuLoaded) {
            try {
                const response = await fetch('/api/menu');
                if (response && response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        menuData = await response.json();
                        if (Array.isArray(menuData)) {
                            menuLoaded = true;
                        }
                    }
                }
            } catch (e) {
                console.warn('Erro ao carregar /api/menu no dashboard, tentando cardapio.json...', e);
            }
        }
        
        // 3. Tenta cardapio.json
        if (!menuLoaded) {
            try {
                const response = await fetch('cardapio.json');
                if (response && response.ok) {
                    menuData = await response.json();
                    if (Array.isArray(menuData)) {
                        menuLoaded = true;
                    }
                }
            } catch (corsErr) {
                console.warn('Erro de CORS ao buscar cardapio.json no dashboard. Tentando window.cardapioData...');
            }
        }
        
        // 4. Tenta window.cardapioData
        if (!menuLoaded && window.cardapioData) {
            menuData = window.cardapioData;
            menuLoaded = true;
        }

        if (!menuLoaded) {
            throw new Error('Não foi possível carregar o cardápio de nenhuma fonte.');
        }
        
        // Carrega imagens dinamicamente (não precisa de await)
        loadAvailableImages();
        
        renderCategories();
        showToast('Dados carregados com sucesso!', 'success');
    } catch (err) {
        showToast('Erro ao inicializar o painel: ' + err.message, 'error');
    }
}

function loadAvailableImages() {
    const defaultImages = ['logo.jpg', 'instagram-icon.png', 'whatsapp-button.png', 'Coxinha pequena.jpg'];
    const scannedImages = [];
    
    // Escaneia imagens no menuData atual
    if (Array.isArray(menuData)) {
        menuData.forEach(cat => {
            if (cat.products && Array.isArray(cat.products)) {
                cat.products.forEach(prod => {
                    if (prod.image && !scannedImages.includes(prod.image) && !defaultImages.includes(prod.image)) {
                        scannedImages.push(prod.image);
                    }
                });
            }
        });
    }
    
    // Tenta carregar do servidor se disponível
    try {
        fetch('/api/images')
            .then(res => {
                if (res.ok) {
                    const contentType = res.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return res.json();
                    }
                }
                throw new Error('Sem API');
            })
            .then(serverImgs => {
                if (Array.isArray(serverImgs)) {
                    serverImgs.forEach(img => {
                        if (!scannedImages.includes(img) && !defaultImages.includes(img)) {
                            scannedImages.push(img);
                        }
                    });
                }
                availableImages = [...scannedImages, ...defaultImages];
                // Atualiza o seletor na tela se o modal de produto estiver aberto
                const container = document.getElementById('adminImgSelector');
                if (container) {
                    const selectedOpt = container.querySelector('.img-option.selected');
                    const selectedImg = selectedOpt ? selectedOpt.getAttribute('data-img') : null;
                    renderImageSelector(selectedImg);
                }
            })
            .catch(() => {
                availableImages = [...scannedImages, ...defaultImages];
            });
    } catch (err) {
        availableImages = [...scannedImages, ...defaultImages];
    }
    
    availableImages = [...scannedImages, ...defaultImages];
}

// ==========================================
// RENDERIZAÇÃO DAS CATEGORIAS
// ==========================================
function renderCategories() {
    const list = document.getElementById('adminCategoriesList');
    list.innerHTML = '';
    
    menuData.forEach((category) => {
        const li = document.createElement('li');
        li.className = `admin-list-item ${category.id === selectedCategoryId ? 'selected' : ''}`;
        li.setAttribute('data-id', category.id);
        
        li.innerHTML = `
            <span>${category.title}</span>
            <div class="list-item-actions" style="display: flex; gap: 8px;">
                <button class="action-icon edit-cat" title="Editar nome">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button class="action-icon delete-cat" title="Excluir categoria">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #e74c3c;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        
        // Eventos da categoria
        li.addEventListener('click', (e) => {
            // Se clicar nos botões de ação, não seleciona
            if (e.target.closest('.list-item-actions')) return;
            
            selectedCategoryId = category.id;
            document.querySelectorAll('.admin-list-item').forEach(el => el.classList.remove('selected'));
            li.classList.add('selected');
            renderProducts();
        });
        
        list.appendChild(li);
    });
    
    // Vincula ações dos botões de categorias
    list.querySelectorAll('.edit-cat').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditCategoryModal(menuData[index], index);
        });
    });
    
    list.querySelectorAll('.delete-cat').forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCategory(index);
        });
    });
}

// ==========================================
// RENDERIZAÇÃO DOS PRODUTOS
// ==========================================
function renderProducts() {
    const table = document.getElementById('adminProductsTable');
    const placeholder = document.getElementById('noCategoryPlaceholder');
    const addProductBtn = document.getElementById('addProductBtn');
    const currentCategoryTitle = document.getElementById('currentCategoryTitle');
    const list = document.getElementById('adminProductsList');
    
    list.innerHTML = '';
    
    const category = menuData.find(c => c.id === selectedCategoryId);
    
    if (!category || category.isInfo) {
        table.style.display = 'none';
        placeholder.style.display = 'block';
        addProductBtn.style.display = 'none';
        currentCategoryTitle.textContent = category ? category.title : 'Selecione uma Categoria';
        
        if (category && category.isInfo) {
            placeholder.innerHTML = `Esta é uma seção informativa dinâmica.<br>Conteúdo:<br><pre style="text-align:left; background:#f4f4f4; padding:10px; border-radius:8px; font-size:0.8rem; overflow-x:auto;">${escapeHTML(category.content)}</pre><br><button class="btn-small edit-info-btn">Editar Conteúdo</button>`;
            placeholder.querySelector('.edit-info-btn').addEventListener('click', () => {
                openEditCategoryModal(category, menuData.indexOf(category));
            });
        }
        return;
    }
    
    currentCategoryTitle.textContent = category.title;
    table.style.display = 'table';
    placeholder.style.display = 'none';
    addProductBtn.style.display = 'block';
    
    const products = category.products || [];
    
    if (products.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">Nenhum produto cadastrado nesta categoria.</td></tr>';
        return;
    }
    
    products.forEach((product, index) => {
        const tr = document.createElement('tr');
        const imgPath = product.image ? product.image : 'logo.jpg';
        
        tr.innerHTML = `
            <td><img class="product-thumbnail" src="${imgPath}" alt="${product.title}"></td>
            <td class="product-info-cell">
                <strong>${product.title}</strong>
                <span>${product.description || 'Sem descrição'}</span>
            </td>
            <td><strong>${product.pricePrefix || 'A partir de'} R$ ${product.price || '0,00'}</strong></td>
            <td>
                <button class="action-icon edit-prod" title="Editar produto" style="margin-right: 8px;">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button class="action-icon delete-prod" title="Excluir produto">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #e74c3c;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        `;
        
        tr.querySelector('.edit-prod').addEventListener('click', () => {
            openProductModal(product, index, category.id);
        });
        
        tr.querySelector('.delete-prod').addEventListener('click', () => {
            deleteProduct(category.id, index);
        });
        
        list.appendChild(tr);
    });
}

// ==========================================
// MODAL: CATEGORIAS (ADICIONAR / EDITAR)
// ==========================================
function openEditCategoryModal(category = null, index = null) {
    const modal = document.getElementById('adminModal');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    
    titleEl.textContent = category ? 'Editar Categoria' : 'Nova Categoria';
    currentEditingItem = category ? { type: 'category', data: category, index } : { type: 'category', data: null, index: null };
    
    bodyEl.innerHTML = `
        <div class="modal-form-grid">
            <div class="form-group">
                <label for="categoryTitle">Título da Categoria *</label>
                <input type="text" id="categoryTitle" required value="${category ? category.title : ''}">
            </div>
            ${category && category.isInfo ? `
            <div class="form-group">
                <label for="categoryContent">Conteúdo Informativo (HTML) *</label>
                <textarea id="categoryContent" required style="height: 180px;">${category.content}</textarea>
            </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.add('active');
}

// ==========================================
// MODAL: PRODUTOS (ADICIONAR / EDITAR)
// ==========================================
function openProductModal(product = null, index = null, categoryId) {
    const modal = document.getElementById('adminModal');
    const titleEl = document.getElementById('adminModalTitle');
    const bodyEl = document.getElementById('adminModalBody');
    
    titleEl.textContent = product ? 'Editar Produto' : 'Novo Produto';
    currentEditingItem = { type: 'product', data: product, index, parentId: categoryId };
    
    bodyEl.innerHTML = `
        <div class="modal-form-grid">
            <div class="form-group">
                <label for="prodTitle">Título do Produto *</label>
                <input type="text" id="prodTitle" required value="${product ? product.title : ''}">
            </div>
            <div class="form-group">
                <label for="prodDesc">Descrição</label>
                <textarea id="prodDesc" placeholder="Ingredientes, fatias, etc.">${product ? product.description : ''}</textarea>
            </div>
            <div style="display:flex; gap:15px;">
                <div class="form-group" style="flex:1;">
                    <label for="prodPricePrefix">Prefixo do Preço</label>
                    <input type="text" id="prodPricePrefix" placeholder="A partir de / Kg / Cada" value="${product ? (product.pricePrefix || 'A partir de') : 'A partir de'}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label for="prodPrice">Valor Exibido (R$) *</label>
                    <input type="text" id="prodPrice" required placeholder="95,00" value="${product ? product.price : ''}">
                </div>
            </div>
            
            <!-- SELETOR DE IMAGEM -->
            <div class="form-group">
                <label>Selecionar Foto do Produto</label>
                <div class="img-selector-container" id="adminImgSelector">
                    <!-- Loaded dynamically -->
                </div>
            </div>
            
            <!-- FAZER UPLOAD DE NOVA IMAGEM -->
            <div class="form-group" style="background:#f9f9f9; padding:10px; border-radius:8px; border:1px dashed #ccc;">
                <label for="imageUpload">Enviar Nova Imagem (.jpg, .png)</label>
                <input type="file" id="imageUpload" accept="image/*">
            </div>

            <!-- GERENCIADOR DE VARIAÇÕES -->
            <div class="form-group" style="margin-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label style="margin-bottom:0;">Variações e Preços Específicos</label>
                    <button type="button" class="btn-small" id="addVarRowBtn">+ Add Var</button>
                </div>
                <ul class="variations-manager-list" id="modalVariationsList">
                    <!-- Dynamic rows -->
                </ul>
            </div>
        </div>
    `;
    
    // Renderiza seletor de fotos
    renderImageSelector(product ? product.image : null);
    
    // Renderiza variações se existirem
    const variationsList = document.getElementById('modalVariationsList');
    if (product && product.variations) {
        product.variations.forEach(v => addVariationRow(v.name, v.price));
    }
    
    // Adiciona evento do botão de nova variação
    document.getElementById('addVarRowBtn').addEventListener('click', () => addVariationRow('', ''));
    
    // Evento de Upload de imagem
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    
    modal.classList.add('active');
}

function renderImageSelector(selectedImage = null) {
    const container = document.getElementById('adminImgSelector');
    container.innerHTML = '';
    
    availableImages.forEach(img => {
        const option = document.createElement('div');
        option.className = `img-option ${img === selectedImage ? 'selected' : ''}`;
        option.setAttribute('data-img', img);
        option.innerHTML = `<img src="${img}" alt="${img}">`;
        
        option.addEventListener('click', () => {
            container.querySelectorAll('.img-option').forEach(el => el.classList.remove('selected'));
            option.classList.add('selected');
        });
        
        container.appendChild(option);
    });
}

function addVariationRow(name = '', price = '') {
    const list = document.getElementById('modalVariationsList');
    const li = document.createElement('li');
    li.className = 'variation-row';
    
    li.innerHTML = `
        <input type="text" class="var-input-name" placeholder="Ex: Tamanho PPP (6 pessoas)" style="flex:2;" required value="${name}">
        <input type="text" class="var-input-price" placeholder="Preço (ex: 95,00 ou -)" style="flex:1;" required value="${price}">
        <button type="button" class="action-icon remove-var-row" title="Remover variação">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #e74c3c;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
    `;
    
    li.querySelector('.remove-var-row').addEventListener('click', () => {
        li.remove();
    });
    
    list.appendChild(li);
}

// ==========================================
// UPLOAD DE IMAGEM VIA API E COMPRESSÃO BASE64
// ==========================================
function compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Limite máximo de tamanho (600px)
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                // Preenche o fundo com branco (evita fundo preto em imagens PNG com transparência ao salvar em JPEG)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converte para Base64 em formato JPEG com compressão
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                    resolve(dataUrl);
                } catch(e) {
                    reject(e);
                }
            };
            img.onerror = function() {
                reject(new Error('Erro ao carregar a imagem para processamento.'));
            };
            img.src = event.target.result;
        };
        reader.onerror = function() {
            reject(new Error('Erro ao ler o arquivo de imagem.'));
        };
        reader.readAsDataURL(file);
    });
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    let compressedBase64 = null;
    try {
        showToast('Processando e comprimindo imagem...', 'info');
        compressedBase64 = await compressAndConvertToBase64(file);
    } catch (err) {
        showToast('Erro ao processar imagem: ' + err.message, 'error');
        return;
    }
    
    // Tenta primeiro enviar para a API (se estiver rodando com o servidor python local)
    const formData = new FormData();
    formData.append('image', file);
    formData.append('filename', file.name);
    
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast('Imagem enviada para o servidor com sucesso!', 'success');
            
            // Adiciona a imagem carregada do servidor nas imagens disponíveis e renderiza
            loadAvailableImages();
            renderImageSelector(data.filepath);
            return;
        }
    } catch (err) {
        console.warn('Erro ao enviar imagem para a API (normal em hospedagem estática Vercel):', err);
    }
    
    // Se falhar a API (como na Vercel), usa a versão comprimida Base64
    showToast('Upload indisponível. Usando imagem embutida (Base64)...', 'success');
    
    if (!availableImages.includes(compressedBase64)) {
        availableImages.unshift(compressedBase64);
    }
    renderImageSelector(compressedBase64);
}

// ==========================================
// EXCLUSÃO (CRUD)
// ==========================================
function deleteCategory(index) {
    const category = menuData[index];
    if (confirm(`Tem certeza que deseja excluir a categoria "${category.title}"? Todos os produtos dentro dela serão removidos.`)) {
        menuData.splice(index, 1);
        if (selectedCategoryId === category.id) selectedCategoryId = null;
        markUnsaved();
        renderCategories();
        renderProducts();
        showToast('Categoria excluída.', 'success');
    }
}

function deleteProduct(categoryId, index) {
    const category = menuData.find(c => c.id === categoryId);
    if (!category) return;
    
    const prod = category.products[index];
    if (confirm(`Deseja excluir o produto "${prod.title}"?`)) {
        category.products.splice(index, 1);
        markUnsaved();
        renderProducts();
        showToast('Produto excluído.', 'success');
    }
}

// ==========================================
// SUBMIT DO MODAL (SALVAR ALTERAÇÕES EM MEMÓRIA)
// ==========================================
function handleModalSubmit(e) {
    e.preventDefault();
    
    if (currentEditingItem.type === 'category') {
        const titleVal = document.getElementById('categoryTitle').value.trim();
        const contentArea = document.getElementById('categoryContent');
        
        if (currentEditingItem.data) {
            // Editando existente
            currentEditingItem.data.title = titleVal;
            if (contentArea) currentEditingItem.data.content = contentArea.value.trim();
        } else {
            // Nova categoria
            const cleanId = titleVal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
            const newCat = {
                id: cleanId + '-' + Date.now().toString().slice(-4),
                title: titleVal,
                products: []
            };
            menuData.push(newCat);
        }
        
        markUnsaved();
        renderCategories();
        renderProducts();
        fecharModal();
        showToast('Categoria atualizada em memória!', 'success');
        
    } else if (currentEditingItem.type === 'product') {
        const titleVal = document.getElementById('prodTitle').value.trim();
        const descVal = document.getElementById('prodDesc').value.trim();
        const prefixVal = document.getElementById('prodPricePrefix').value.trim();
        const priceVal = document.getElementById('prodPrice').value.trim();
        
        // Pega imagem selecionada
        const selectedImgEl = document.querySelector('.img-option.selected');
        const imgVal = selectedImgEl ? selectedImgEl.getAttribute('data-img') : 'logo.jpg';
        
        // Pega variações do DOM
        const variations = [];
        const varRows = document.querySelectorAll('.variation-row');
        varRows.forEach(row => {
            const vName = row.querySelector('.var-input-name').value.trim();
            const vPrice = row.querySelector('.var-input-price').value.trim();
            variations.push({ name: vName, price: vPrice });
        });
        
        const parentCategory = menuData.find(c => c.id === currentEditingItem.parentId);
        if (!parentCategory) return;
        
        const newProductData = {
            title: titleVal,
            description: descVal,
            pricePrefix: prefixVal,
            price: priceVal,
            image: imgVal,
            variations: variations
        };
        
        if (currentEditingItem.data) {
            // Editando existente
            parentCategory.products[currentEditingItem.index] = newProductData;
        } else {
            // Adicionando novo
            if (!parentCategory.products) parentCategory.products = [];
            parentCategory.products.push(newProductData);
        }
        
        markUnsaved();
        renderProducts();
        fecharModal();
        showToast('Produto atualizado em memória!', 'success');
    }
}

// ==========================================
// SALVAR NO SERVIDOR (PERSISTÊNCIA)
// ==========================================
async function saveAllDataToServer() {
    // Salva no localStorage local imediatamente para persistência instantânea no navegador do admin
    localStorage.setItem('andreia_menu_custom', JSON.stringify(menuData));
    hasUnsavedChanges = false;
    document.getElementById('saveChangesBtn').style.display = 'none';
    
    const resetMenuBtn = document.getElementById('resetMenuBtn');
    if (resetMenuBtn) resetMenuBtn.style.display = 'block';
    
    try {
        showToast('Salvando alterações no navegador...', 'info');
        
        const res = await fetch('/api/menu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(menuData)
        });
        
        if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                if (data && data.status === 'success') {
                    showToast('Cardápio sincronizado com o servidor com sucesso!', 'success');
                    return;
                }
            }
        }
        throw new Error('Servidor estático');
    } catch (err) {
        showToast('Salvo localmente! Baixando arquivos para atualizar o GitHub...', 'success');
        // Oferece fallback de download do arquivo JSON atualizado
        downloadBackupJson();
    }
}

function downloadBackupJson() {
    const jsonStr = JSON.stringify(menuData, null, 2);
    
    // 1. Baixar cardapio.json
    const dataStrJson = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const dlAnchorJson = document.createElement('a');
    dlAnchorJson.setAttribute("href", dataStrJson);
    dlAnchorJson.setAttribute("download", "cardapio.json");
    dlAnchorJson.click();
    
    // 2. Baixar cardapio-data.js (para funcionamento via file://)
    const jsContent = "window.cardapioData = " + jsonStr + ";";
    const dataStrJs = "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent);
    const dlAnchorJs = document.createElement('a');
    dlAnchorJs.setAttribute("href", dataStrJs);
    dlAnchorJs.setAttribute("download", "cardapio-data.js");
    
    // Pequeno delay para garantir que ambos os downloads iniciem no navegador
    setTimeout(() => {
        dlAnchorJs.click();
    }, 300);
    
    alert('As edições foram salvas com sucesso no seu navegador!\n\nPara atualizar o site definitivamente na Vercel para todos os clientes:\n1. Substitua os arquivos "cardapio.json" e "cardapio-data.js" na pasta do seu projeto pelos novos baixados.\n2. Faça o envio (push) para o seu repositório no GitHub.');
}

function markUnsaved() {
    hasUnsavedChanges = true;
    document.getElementById('saveChangesBtn').style.display = 'block';
}

// ==========================================
// EVENT LISTENERS E DIÁLOGOS
// ==========================================
function setupEventListeners() {
    // Form de Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Botão de Sair
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Botão Salvar Geral
    document.getElementById('saveChangesBtn').addEventListener('click', saveAllDataToServer);
    
    // Botão Restaurar Padrão
    const resetMenuBtn = document.getElementById('resetMenuBtn');
    if (resetMenuBtn) {
        resetMenuBtn.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja descartar as alterações salvas localmente neste navegador e recarregar os dados do servidor?')) {
                localStorage.removeItem('andreia_menu_custom');
                showToast('Cache limpo! Recarregando dados...', 'info');
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        });
    }
    
    // Modal fechar
    const closeAdminModal = document.getElementById('closeAdminModal');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    
    if(closeAdminModal) closeAdminModal.addEventListener('click', fecharModal);
    if(cancelModalBtn) cancelModalBtn.addEventListener('click', fecharModal);
    
    // Submit do Modal
    document.getElementById('adminModalForm').addEventListener('submit', handleModalSubmit);

    // Botões de adição
    document.getElementById('addCategoryBtn').addEventListener('click', () => openEditCategoryModal());
    document.getElementById('addProductBtn').addEventListener('click', () => {
        if (selectedCategoryId) openProductModal(null, null, selectedCategoryId);
    });
    
    // Avisa o usuário se tentar fechar a aba com alterações não salvas
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'Você possui alterações não salvas no cardápio. Deseja sair mesmo assim?';
        }
    });
}

function fecharModal() {
    const modal = document.getElementById('adminModal');
    modal.classList.remove('active');
    currentEditingItem = null;
}

// ==========================================
// SISTEMA DE NOTIFICAÇÃO (TOAST)
// ==========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    
    toast.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center;">${iconSvg}</span> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Remove toast após 3.5 segundos
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// AUXILIARES
// ==========================================
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
