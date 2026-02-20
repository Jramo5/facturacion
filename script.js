// ==========================================
// JAVASCRIPT CORREGIDO v2.4.1
// ==========================================

// ==========================================
// BASES DE DATOS PREDEFINIDAS
// ==========================================
const DEFAULT_DATABASE = {
    "stores": [],
    "sellers": [],
    "clients": []
};

const DEFAULT_PRODUCTS = [];

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let PRODUCT_CATALOG = [];
let DATABASE = { stores: [], sellers: [], clients: [] };
const IVA_RATE = 0.13;
let currentPaymentStatus = "pending";
let tempSelectedStatus = "pending";
let filteredProducts = [];
let currentSelection = { clientId: null, sellerId: null, storeId: null };
let tempSelectedClientId = null;
let editingProductIndex = null;
let currentPaymentDate = null; // v2.4.0
let selectedInvoices = new Set(); // v2.4.1

// ==========================================
// v2.6.0: CONFIGURACIÓN LOCAL DE TIENDA
// ==========================================

const DEFAULT_STORE_CONFIG = {
    name: '',
    phone: '',
    address: '',
    email: '',
    logoUrl: ''
};

function loadStoreConfig() {
    return loadFromLocalStorage('factura_store_config', DEFAULT_STORE_CONFIG);
}

function saveStoreConfig() {
    const name    = document.getElementById('cfg-store-name').value.trim();
    const phone   = document.getElementById('cfg-store-phone').value.trim();
    const address = document.getElementById('cfg-store-address').value.trim();
    const email   = document.getElementById('cfg-store-email').value.trim();
    const logoUrl = document.getElementById('cfg-store-logo').value.trim();

    if (!name || !phone || !address) {
        alert('⚠️ Completa al menos nombre, teléfono y dirección.');
        return;
    }

    const config = { name, phone, address, email, logoUrl };
    saveToLocalStorage('factura_store_config', config);
    applyStoreConfigToInvoice();
    hideStoreConfigForm();
    refreshStoreConfigDisplay();
    alert('✅ Configuración de tienda guardada localmente.');
}

function applyStoreConfigToInvoice() {
    const config = loadStoreConfig();

    const nameEl    = document.getElementById('store-name-display');
    const addrEl    = document.getElementById('store-address-display');
    const phoneEl   = document.getElementById('store-phone-display');
    const emailEl   = document.getElementById('store-email-display');
    const logoWrap  = document.querySelector('.company-logo');

    if (config.name) {
        if (nameEl)  nameEl.textContent  = config.name;
        if (addrEl)  addrEl.textContent  = config.address || '';
        if (phoneEl) phoneEl.textContent = config.phone   || '---';
        if (emailEl) {
            if (config.email) {
                emailEl.textContent = 'Email: ' + config.email;
                emailEl.style.display = '';
            } else {
                emailEl.style.display = 'none';
            }
        }
    }

    // Logo desde URL
    if (logoWrap) {
        if (config.logoUrl) {
            logoWrap.innerHTML = `<img src="${config.logoUrl}" alt="Logo" style="max-width:100%; max-height:100px; object-fit:contain;" onerror="this.style.display='none'">`;
        } else {
            // No hay logo configurado — dejar vacío o svg placeholder
            if (!logoWrap.querySelector('svg') && !logoWrap.querySelector('img')) {
                logoWrap.innerHTML = '';
            }
        }
    }
}

function showStoreConfigForm() {
    const config = loadStoreConfig();
    document.getElementById('cfg-store-name').value    = config.name    || '';
    document.getElementById('cfg-store-phone').value   = config.phone   || '';
    document.getElementById('cfg-store-address').value = config.address || '';
    document.getElementById('cfg-store-email').value   = config.email   || '';
    document.getElementById('cfg-store-logo').value    = config.logoUrl || '';
    document.getElementById('store-config-form').style.display    = 'block';
    document.getElementById('store-config-actions').style.display = 'none';
}

function hideStoreConfigForm() {
    document.getElementById('store-config-form').style.display    = 'none';
    document.getElementById('store-config-actions').style.display = '';
}

function clearStoreConfig() {
    if (!confirm('¿Borrar la configuración de tienda guardada localmente?')) return;
    localStorage.removeItem('factura_store_config');
    applyStoreConfigToInvoice();
    refreshStoreConfigDisplay();
    alert('✅ Configuración de tienda borrada.');
}

function refreshStoreConfigDisplay() {
    const config  = loadStoreConfig();
    const display = document.getElementById('store-config-display');
    if (!display) return;
    if (config.name) {
        display.innerHTML = `
            <p><strong>Nombre:</strong> ${config.name}</p>
            <p><strong>Teléfono:</strong> ${config.phone || '---'}</p>
            <p><strong>Dirección:</strong> ${config.address || '---'}</p>
            ${config.email   ? `<p><strong>Email:</strong> ${config.email}</p>` : ''}
            ${config.logoUrl ? `<p><strong>Logo:</strong> <a href="${config.logoUrl}" target="_blank" style="font-size:0.85em;">Ver URL</a></p>` : ''}
        `;
    } else {
        display.innerHTML = '<p style="color:#999; font-style:italic;">Sin configuración guardada. Haz clic en ⚙️ Configurar.</p>';
    }
}


function saveToLocalStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch (e) { console.error("Error guardando:", e); return false; }
}

function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) { console.error("Error cargando:", e); return defaultValue; }
}

function initializeApp() {
    DATABASE = loadFromLocalStorage('factura_database', DEFAULT_DATABASE);
    PRODUCT_CATALOG = loadFromLocalStorage('factura_products', DEFAULT_PRODUCTS);
    filteredProducts = PRODUCT_CATALOG;
    loadProductList();
    applyStoreConfigToInvoice(); // v2.6.0: cargar config local de tienda
    console.log("App v2.6.0 iniciada | Clientes:", DATABASE.clients.length, "| Productos:", PRODUCT_CATALOG.length);
}

// ==========================================
// HISTORIAL
// ==========================================
function saveInvoiceToHistory(invoiceData) {
    let history = loadFromLocalStorage('factura_history', []);
    const existingIdx = history.findIndex(inv => inv.invoiceNumber === invoiceData.invoiceNumber);
    if (existingIdx !== -1) {
        history[existingIdx] = invoiceData;
    } else {
        history.unshift(invoiceData);
        if (history.length > 50) history = history.slice(0, 50);
    }
    saveToLocalStorage('factura_history', history);
}

function loadInvoiceHistory() {
    return loadFromLocalStorage('factura_history', []);
}

function deleteInvoiceFromHistory(invoiceNumber) {
    let history = loadInvoiceHistory();
    history = history.filter(inv => inv.invoiceNumber !== invoiceNumber);
    saveToLocalStorage('factura_history', history);
    _historyCache = _historyCache.filter(inv => inv.invoiceNumber !== invoiceNumber);
}

let _historyCache = [];

function openHistoryModal() {
    _historyCache = loadInvoiceHistory();
    const searchInput = document.getElementById('history-search');
    searchInput.value = '';
    document.getElementById('history-search-clear').style.display = 'none';
    document.getElementById('history-result-count').textContent = '';
    renderHistoryItems(_historyCache);
    document.getElementById('history-modal').classList.add('active');
    setTimeout(() => searchInput.focus(), 150);
}

function closeHistoryModal() {
    document.getElementById('history-modal').classList.remove('active');
    _historyCache = [];
    selectedInvoices.clear(); // v2.4.1: Limpiar selección
}

function clearHistorySearch() {
    const input = document.getElementById('history-search');
    input.value = '';
    document.getElementById('history-search-clear').style.display = 'none';
    document.getElementById('history-result-count').textContent = '';
    renderHistoryItems(_historyCache);
    input.focus();
}

function filterHistory(term) {
    const clearBtn = document.getElementById('history-search-clear');
    clearBtn.style.display = term.length > 0 ? 'block' : 'none';

    if (term.trim().length === 0) {
        document.getElementById('history-result-count').textContent = '';
        renderHistoryItems(_historyCache);
        return;
    }

    const q = term.trim().toLowerCase();
    const filtered = _historyCache.filter(inv => {
        if (inv.invoiceNumber.toLowerCase().includes(q)) return true;
        const client = DATABASE.clients.find(c => c.id === inv.clientId);
        if (client && client.name.toLowerCase().includes(q)) return true;
        return false;
    });

    const total = _historyCache.length;
    const found = filtered.length;
    const countEl = document.getElementById('history-result-count');
    if (found === 0) {
        countEl.textContent = `Sin resultados para "${term}"`;
        countEl.style.color = '#dc3545';
    } else {
        countEl.textContent = `${found} de ${total} facturas`;
        countEl.style.color = '#28a745';
    }
    renderHistoryItems(filtered, q);
}

function highlightMatch(text, term) {
    if (!term) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'),
        '<mark style="background:#fff176;padding:0 1px;border-radius:2px;">$1</mark>');
}

function renderHistoryItems(list, highlightTerm) {
    const listContainer = document.getElementById('invoice-history-list');

    if (list.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">${highlightTerm ? '🔎' : '📭'}</div>
                <p>${highlightTerm ? 'No se encontraron facturas' : 'No hay facturas guardadas'}</p>
            </div>`;
        return;
    }

    listContainer.innerHTML = list.map(inv => {
        const client = DATABASE.clients.find(c => c.id === inv.clientId);
        const clientName = client ? client.name : 'Cliente desconocido';
        const statusMap = {
            paid:    ['paid',    'PAGADO'],
            credit:  ['credit',  'CRÉDITO'],
            pending: ['pending', 'PENDIENTE']
        };
        const [statusClass, statusText] = statusMap[inv.paymentStatus] || statusMap.pending;
        const numDisplay    = highlightMatch(inv.invoiceNumber, highlightTerm);
        const clientDisplay = highlightMatch(clientName, highlightTerm);
        const isSelected = selectedInvoices.has(inv.invoiceNumber);

        return `
            <div class="invoice-history-item history-item ${isSelected ? 'selected' : ''}" data-invoice-number="${inv.invoiceNumber}">
                <input type="checkbox" 
                       class="history-item-checkbox" 
                       ${isSelected ? 'checked' : ''} 
                       onchange="toggleInvoiceSelection('${inv.invoiceNumber}', this.checked)"
                       onclick="event.stopPropagation()">
                <div class="history-item-content">
                    <div class="invoice-header-info">
                        <div class="invoice-number-hist">#${numDisplay}</div>
                        <div class="invoice-date-hist">${inv.invoiceDate}</div>
                    </div>
                    <div class="invoice-status-badge ${statusClass}">${statusText}</div>
                    <div class="client-name-hist">${clientDisplay}</div>
                    <div class="invoice-total-hist">$${inv.totals.total.toFixed(2)}</div>
                    <div class="invoice-history-actions">
                        <button class="btn btn-info btn-small" onclick='event.stopPropagation(); loadInvoiceFromHistory(${JSON.stringify(inv).replace(/'/g, "&apos;")})'>📂 Cargar</button>
                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteInvoiceFromHistory('${inv.invoiceNumber}'); filterHistory(document.getElementById('history-search').value);">🗑️</button>
                    </div>
                </div>
            </div>`;
    }).join('');
    
    updateSelectionCount();
}

function loadInvoiceFromHistory(invoiceData) {
    loadInvoice(invoiceData);
    closeHistoryModal();
}

// ==========================================
// MODAL ESTADO
// ==========================================
function openStatusModal() {
    tempSelectedStatus = currentPaymentStatus;
    document.querySelectorAll('.status-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(`status-${currentPaymentStatus}`).classList.add('selected');
    
    // v2.4.0: Inicializar campo de fecha de pago
    const paymentContainer = document.getElementById('payment-date-container');
    const dateInput = document.getElementById('payment-date-input');
    
    if (currentPaymentStatus === 'paid') {
        if (paymentContainer) paymentContainer.style.display = 'block';
        
        if (dateInput) {
            if (currentPaymentDate) {
                // Convertir DD/MM/YY a YYYY-MM-DD para el input
                const parts = currentPaymentDate.split('/');
                if (parts.length === 3) {
                    const fullYear = '20' + parts[2];
                    dateInput.value = `${fullYear}-${parts[1]}-${parts[0]}`;
                }
            } else {
                // Si no hay fecha guardada, usar fecha de hoy
                dateInput.value = new Date().toISOString().split('T')[0];
            }
        }
    } else {
        if (paymentContainer) paymentContainer.style.display = 'none';
    }
    
    document.getElementById('status-modal').classList.add('active');
}

function closeStatusModal() {
    document.getElementById('status-modal').classList.remove('active');
}

function selectStatus(status) {
    tempSelectedStatus = status;
    document.querySelectorAll('.status-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(`status-${status}`).classList.add('selected');
    
    // v2.4.0: Mostrar campo de fecha si es PAGADO
    const paymentContainer = document.getElementById('payment-date-container');
    const dateInput = document.getElementById('payment-date-input');
    
    if (paymentContainer) {
        if (status === 'paid') {
            paymentContainer.style.display = 'block';
            
            if (dateInput) {
                if (currentPaymentDate) {
                    // Si ya hay una fecha guardada, convertirla de DD/MM/YY a YYYY-MM-DD
                    const parts = currentPaymentDate.split('/');
                    if (parts.length === 3) {
                        const fullYear = '20' + parts[2];
                        dateInput.value = `${fullYear}-${parts[1]}-${parts[0]}`;
                    }
                } else {
                    // Si no hay fecha guardada, usar hoy
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
            }
        } else {
            paymentContainer.style.display = 'none';
        }
    }
}

function applyStatusChange() {
    setPaymentStatus(tempSelectedStatus);
    
    // v2.4.0: Guardar fecha de pago si es PAGADO
    if (tempSelectedStatus === 'paid') {
        const dateInput = document.getElementById('payment-date-input');
        if (dateInput && dateInput.value) {
            // Convertir desde formato YYYY-MM-DD del input a DD/MM/YY
            const parts = dateInput.value.split('-'); // ["2026", "02", "15"]
            if (parts.length === 3) {
                const day = parts[2];
                const month = parts[1];
                const year = parts[0].slice(-2);
                currentPaymentDate = `${day}/${month}/${year}`;
            }
        }
    } else {
        currentPaymentDate = null;
    }
    updatePaymentDateDisplay();
    
    closeStatusModal();
}

// ==========================================
// MODAL COMPARTIR
// ==========================================
function openShareModal() {
    if (document.getElementById('invoice-items-body').children.length === 0) {
        alert("No hay productos en la factura");
        return;
    }
    document.getElementById('share-modal').classList.add('active');
}

function closeShareModal() {
    document.getElementById('share-modal').classList.remove('active');
}

function shareAsPDF() {
    closeShareModal();
    generatePDF();
}

function shareAsImage() {
    closeShareModal();
    generateImage();
}

// ==========================================
// MODAL DATOS
// ==========================================
function openDataModal() {
    clearProductSearch();
    refreshDataModalInfo();
    renderProductsList();
    refreshStoreConfigDisplay(); // v2.6.0
    document.getElementById('data-modal').classList.add('active');
}

function closeDataModal() {
    document.getElementById('data-modal').classList.remove('active');
    hideAddProductForm();
    cancelEditProduct();
}

function refreshDataModalInfo() {
    const productsSource = loadFromLocalStorage('factura_products_source', 'Predeterminado');
    document.getElementById('products-source-label').textContent = productsSource;
    document.getElementById('products-count-label').textContent = PRODUCT_CATALOG.length;
    document.getElementById('products-badge').textContent = PRODUCT_CATALOG.length;
    document.getElementById('db-clients-count').textContent = DATABASE.clients.length;
    document.getElementById('db-sellers-count').textContent = DATABASE.sellers.length;
    document.getElementById('db-stores-count').textContent = DATABASE.stores.length;
    
    // v2.4.0: Info de historial
    const history = loadInvoiceHistory();
    const histCountEl = document.getElementById('history-count-label');
    const histTotalEl = document.getElementById('history-total-label');
    if (histCountEl) histCountEl.textContent = history.length;
    if (histTotalEl) {
        const total = history.reduce((sum, inv) => sum + (inv.totals?.total || 0), 0);
        histTotalEl.textContent = total.toFixed(2);
    }
}

// ---------- PRODUCTOS ----------

function triggerLoadProducts() {
    document.getElementById('load-products-file').click();
}

function loadProductsFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) {
                alert('❌ El archivo debe contener un array de productos.\nEjemplo:\n[{"name":"Camisa","price":25,"wholesale":20}]');
                return;
            }
            const valid = data.every(p => p.name && typeof p.price === 'number');
            if (!valid) {
                alert('❌ Cada producto debe tener al menos "name" (texto) y "price" (número).');
                return;
            }
            PRODUCT_CATALOG = data;
            filteredProducts = PRODUCT_CATALOG;
            saveToLocalStorage('factura_products', PRODUCT_CATALOG);
            saveToLocalStorage('factura_products_source', file.name);
            loadProductList();
            refreshDataModalInfo();
            clearProductSearch();
            renderProductsList();
            alert(`✅ ${data.length} productos cargados desde "${file.name}"`);
        } catch (err) {
            alert('❌ Error al leer el archivo JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function downloadProductsJSON() {
    const data = JSON.stringify(PRODUCT_CATALOG, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = getDateStamp();
    a.href = url;
    a.download = `productos_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadDatabaseJSON() {
    const exportData = {
        version: "2.5.0",
        exportedAt: new Date().toISOString(),
        stores: DATABASE.stores,
        sellers: DATABASE.sellers,
        clients: DATABASE.clients
    };
    const data = JSON.stringify(exportData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = getDateStamp();
    a.href = url;
    a.download = `base_datos_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function filterProductsList(searchTerm) {
    const term = searchTerm.trim().toLowerCase();
    const clearBtn = document.getElementById('clear-product-search');
    const resultsInfo = document.getElementById('product-search-results-info');

    if (term.length === 0) {
        clearBtn.classList.remove('active');
        filteredProducts = PRODUCT_CATALOG;
        resultsInfo.textContent = '';
    } else {
        clearBtn.classList.add('active');
        filteredProducts = PRODUCT_CATALOG.filter(p =>
            p.name.toLowerCase().includes(term)
        );
        if (filteredProducts.length === 0) {
            resultsInfo.textContent = `Sin resultados para "${searchTerm}"`;
            resultsInfo.style.color = '#dc3545';
        } else {
            resultsInfo.textContent = `${filteredProducts.length} de ${PRODUCT_CATALOG.length} productos`;
            resultsInfo.style.color = '#28a745';
        }
    }
    renderProductsList();
}

function clearProductSearch() {
    const input = document.getElementById('product-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clear-product-search');
    if (clearBtn) clearBtn.classList.remove('active');
    const resultsInfo = document.getElementById('product-search-results-info');
    if (resultsInfo) resultsInfo.textContent = '';
    filteredProducts = PRODUCT_CATALOG;
    renderProductsList();
}

function renderProductsList() {
    const container = document.getElementById('products-list-container');
    if (!container) return;

    const searchVal = document.getElementById('product-search-input')
        ? document.getElementById('product-search-input').value.trim()
        : '';
    const productsToShow = searchVal !== '' ? filteredProducts : PRODUCT_CATALOG;

    if (productsToShow.length === 0) {
        container.innerHTML = '<p class="info-text" style="text-align:center;padding:15px;">No hay productos que mostrar</p>';
        return;
    }

    container.innerHTML = productsToShow.map((p) => {
        const originalIndex = PRODUCT_CATALOG.indexOf(p);
        const codeHtml = p.code ? `<div class="product-code-badge">📦 ${p.code}</div>` : '';
        return `
        <div class="product-list-item" id="prod-item-${originalIndex}">
            <div class="product-info">
                <div class="product-name">${p.name}</div>
                <div class="product-prices">
                    Unitario: $${p.price.toFixed(2)}
                    ${p.wholesale ? ' | Mayoreo: $' + p.wholesale.toFixed(2) : ''}
                </div>
                ${codeHtml}
            </div>
            <div class="product-actions">
                <button class="btn btn-warning btn-small" style="padding:6px 10px;width:auto;" onclick="showEditProductForm(${originalIndex})">✏️</button>
                <button class="btn btn-danger btn-small" style="padding:6px 10px;width:auto;" onclick="deleteProduct(${originalIndex})">🗑️</button>
            </div>
        </div>
        <div class="product-edit-form" id="edit-prod-form-${originalIndex}">
            <div class="controls-grid" style="gap:8px;">
                <div class="input-group">
                    <label>Código de Barras</label>
                    <div class="barcode-input-group">
                        <input id="edit-prod-code-${originalIndex}" value="${p.code || ''}" placeholder="Código de barras">
                        <button class="btn btn-scan btn-small" onclick="openBarcodeScanner('edit-prod-code-${originalIndex}', null)" title="Escanear">📷 <span class="scan-label-text">Escanear</span></button>
                    </div>
                </div>
                <div class="input-group">
                    <label>Nombre *</label>
                    <input id="edit-prod-name-${originalIndex}" value="${p.name}">
                </div>
                <div class="input-group">
                    <label>Precio Unitario *</label>
                    <input type="number" id="edit-prod-price-${originalIndex}" step="0.01" value="${p.price}">
                </div>
                <div class="input-group">
                    <label>Precio Mayoreo</label>
                    <input type="number" id="edit-prod-wholesale-${originalIndex}" step="0.01" value="${p.wholesale || ''}">
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-small" style="flex:1" onclick="cancelEditProduct(${originalIndex})">Cancelar</button>
                <button class="btn btn-success btn-small" style="flex:1" onclick="saveEditProduct(${originalIndex})">💾 Guardar</button>
            </div>
        </div>`;
    }).join('');
}

function showAddProductForm() {
    const form = document.getElementById('add-product-form');
    form.classList.add('active');
    document.getElementById('new-prod-name').focus();
}

function hideAddProductForm() {
    document.getElementById('add-product-form').classList.remove('active');
    document.getElementById('new-prod-name').value = '';
    document.getElementById('new-prod-price').value = '';
    document.getElementById('new-prod-wholesale').value = '';
    const codeEl = document.getElementById('new-prod-code');
    if (codeEl) codeEl.value = '';
}

function saveNewProduct() {
    const name = document.getElementById('new-prod-name').value.trim();
    const price = parseFloat(document.getElementById('new-prod-price').value);
    const wholesale = parseFloat(document.getElementById('new-prod-wholesale').value) || null;
    const code = document.getElementById('new-prod-code') ? document.getElementById('new-prod-code').value.trim() : '';
    if (!name || isNaN(price) || price <= 0) { alert('Complete nombre y precio unitario válido'); return; }
    const newProduct = { name, price, code: code || '' };
    if (wholesale && wholesale > 0) newProduct.wholesale = wholesale;
    PRODUCT_CATALOG.push(newProduct);
    saveToLocalStorage('factura_products', PRODUCT_CATALOG);
    saveToLocalStorage('factura_products_source', 'Personalizado');
    loadProductList();
    hideAddProductForm();
    clearProductSearch();
    refreshDataModalInfo();
    renderProductsList();
}

function showEditProductForm(index) {
    cancelEditProduct();
    const formEl = document.getElementById(`edit-prod-form-${index}`);
    if (formEl) formEl.classList.add('active');
    editingProductIndex = index;
}

function cancelEditProduct(index) {
    if (index !== undefined) {
        const formEl = document.getElementById(`edit-prod-form-${index}`);
        if (formEl) formEl.classList.remove('active');
    } else {
        document.querySelectorAll('.product-edit-form').forEach(f => f.classList.remove('active'));
    }
    editingProductIndex = null;
}

function saveEditProduct(index) {
    const name = document.getElementById(`edit-prod-name-${index}`).value.trim();
    const price = parseFloat(document.getElementById(`edit-prod-price-${index}`).value);
    const wholesale = parseFloat(document.getElementById(`edit-prod-wholesale-${index}`).value) || null;
    const codeEl = document.getElementById(`edit-prod-code-${index}`);
    const code = codeEl ? codeEl.value.trim() : (PRODUCT_CATALOG[index].code || '');
    if (!name || isNaN(price) || price <= 0) { alert('Complete nombre y precio unitario válido'); return; }
    PRODUCT_CATALOG[index] = { name, price, code };
    if (wholesale && wholesale > 0) PRODUCT_CATALOG[index].wholesale = wholesale;
    saveToLocalStorage('factura_products', PRODUCT_CATALOG);
    saveToLocalStorage('factura_products_source', 'Personalizado');
    loadProductList();
    refreshDataModalInfo();
    filterProductsList(document.getElementById('product-search-input').value);
}

function deleteProduct(index) {
    if (!confirm(`¿Eliminar "${PRODUCT_CATALOG[index].name}"?`)) return;
    PRODUCT_CATALOG.splice(index, 1);
    saveToLocalStorage('factura_products', PRODUCT_CATALOG);
    saveToLocalStorage('factura_products_source', 'Personalizado');
    loadProductList();
    refreshDataModalInfo();
    filterProductsList(document.getElementById('product-search-input').value);
}

// ---------- BASE DE DATOS ----------


// ==========================================
// v2.4.0: FILTROS DE HISTORIAL
// ==========================================
function parseDateFromInvoice(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = 2000 + parseInt(parts[2]);
        return new Date(year, month, day);
    }
    return new Date();
}

function applyHistoryFilters() {
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const status = document.getElementById('filter-status').value;
    
    let filtered = _historyCache;
    
    if (dateFrom || dateTo) {
        filtered = filtered.filter(inv => {
            const invDate = parseDateFromInvoice(inv.invoiceDate);
            const fromDate = dateFrom ? new Date(dateFrom) : null;
            const toDate = dateTo ? new Date(dateTo) : null;
            
            if (fromDate && invDate < fromDate) return false;
            if (toDate && invDate > toDate) return false;
            return true;
        });
    }
    
    if (status !== 'all') {
        filtered = filtered.filter(inv => inv.paymentStatus === status);
    }
    
    renderHistoryItems(filtered);
    const countEl = document.getElementById('history-result-count');
    if (countEl && filtered.length < _historyCache.length) {
        countEl.textContent = `Mostrando ${filtered.length} de ${_historyCache.length} facturas`;
        countEl.style.color = '#28a745';
    } else if (countEl) {
        countEl.textContent = '';
    }
}

function clearHistoryFilters() {
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-status').value = 'all';
    const countEl = document.getElementById('history-result-count');
    if (countEl) countEl.textContent = '';
    const searchInput = document.getElementById('history-search');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('history-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    renderHistoryItems(_historyCache);
}

// ==========================================
// v2.4.0: GESTIÓN DE HISTORIAL
// ==========================================
function triggerLoadHistory() {
    document.getElementById('load-history-file').click();
}

function loadHistoryFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) {
                alert('❌ El archivo debe contener un array de facturas');
                return;
            }
            
            let currentHistory = loadInvoiceHistory();
            let added = 0, updated = 0, skipped = 0;
            
            data.forEach(newInv => {
                const existingIdx = currentHistory.findIndex(
                    inv => inv.invoiceNumber === newInv.invoiceNumber
                );
                
                if (existingIdx !== -1) {
                    const existing = currentHistory[existingIdx];
                    const isSame = JSON.stringify(existing.items) === JSON.stringify(newInv.items) &&
                                   existing.paymentStatus === newInv.paymentStatus &&
                                   existing.totals?.total === newInv.totals?.total;
                    
                    if (isSame) {
                        skipped++;
                    } else {
                        currentHistory[existingIdx] = newInv;
                        updated++;
                    }
                } else {
                    currentHistory.push(newInv);
                    added++;
                }
            });
            
            saveToLocalStorage('factura_history', currentHistory);
            refreshDataModalInfo();
            alert(`✅ Historial procesado\n➕ Añadidas: ${added}\n✏️ Actualizadas: ${updated}\n⏭️ Omitidas (duplicadas): ${skipped}`);
            
        } catch(err) {
            alert('❌ Error al leer el archivo: ' + err.message);
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

function downloadHistoryJSON() {
    const history = loadInvoiceHistory();
    if (history.length === 0) {
        alert('No hay facturas en el historial para exportar');
        return;
    }
    
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = getDateStamp();
    a.href = url;
    a.download = `historial_facturas_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ Exportadas ${history.length} facturas`);
}

function clearAllHistory() {
    const count = loadInvoiceHistory().length;
    if (count === 0) {
        alert('El historial ya está vacío');
        return;
    }
    
    if (!confirm(`⚠️ ¿Borrar TODAS las ${count} facturas del historial?\n\nEsta acción NO se puede deshacer.`)) {
        return;
    }
    
    if (!confirm('🚨 ÚLTIMA CONFIRMACIÓN\n\n¿Estás completamente seguro?')) {
        return;
    }
    
    localStorage.removeItem('factura_history');
    _historyCache = [];
    refreshDataModalInfo();
    alert('✅ Historial borrado completamente');
}

function triggerLoadDatabase() {
    document.getElementById('load-database-file').click();
}

function loadDatabaseFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.clients || !data.sellers || !data.stores) {
                alert('❌ El archivo debe tener las claves: "clients", "sellers", "stores"');
                return;
            }
            let added = 0, updated = 0;
            ['clients', 'sellers', 'stores'].forEach(key => {
                if (!Array.isArray(data[key])) return;
                data[key].forEach(newRecord => {
                    const existingIndex = DATABASE[key].findIndex(r => r.id === newRecord.id);
                    if (existingIndex !== -1) {
                        DATABASE[key][existingIndex] = { ...DATABASE[key][existingIndex], ...newRecord };
                        updated++;
                    } else {
                        DATABASE[key].push(newRecord);
                        added++;
                    }
                });
            });
            saveToLocalStorage('factura_database', DATABASE);
            refreshDataModalInfo();
            alert(`✅ Base de datos actualizada\n➕ Añadidos: ${added}\n✏️ Actualizados: ${updated}`);
        } catch (err) {
            alert('❌ Error al leer el archivo JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ==========================================
// AUTOCOMPLETE CLIENTES
// ==========================================
function initClientAutocomplete() {
    const searchInput = document.getElementById('client-search');
    const resultsContainer = document.getElementById('client-autocomplete-results');

    searchInput.addEventListener('input', function (e) {
        const searchTerm = e.target.value.trim().toLowerCase();
        if (searchTerm.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('active');
            return;
        }
        const matches = DATABASE.clients.filter(client =>
            client.name.toLowerCase().includes(searchTerm) ||
            client.phone.toLowerCase().includes(searchTerm)
        );
        displayAutocompleteResults(matches);
    });

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.autocomplete-container')) {
            resultsContainer.classList.remove('active');
        }
    });
}

function displayAutocompleteResults(clients) {
    const resultsContainer = document.getElementById('client-autocomplete-results');
    if (clients.length === 0) {
        resultsContainer.innerHTML = '<div class="autocomplete-empty">No se encontraron clientes</div>';
        resultsContainer.classList.add('active');
        return;
    }
    resultsContainer.innerHTML = '';
    clients.forEach(client => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `
            <div class="name">${client.name}</div>
            <div class="details">Tel: ${client.phone}${client.address ? ' | ' + client.address : ''}</div>
        `;
        item.addEventListener('click', function () { selectClientFromAutocomplete(client); });
        resultsContainer.appendChild(item);
    });
    resultsContainer.classList.add('active');
}

function selectClientFromAutocomplete(client) {
    tempSelectedClientId = client.id;
    document.getElementById('client-search').value = client.name;
    document.getElementById('display-client-name').textContent = client.name;
    document.getElementById('display-client-phone').textContent = client.phone;
    document.getElementById('display-client-address').textContent = client.address || 'No especificada';
    document.getElementById('client-data-display').style.display = 'block';
    document.getElementById('edit-client-btn').style.display = 'inline-block';
    document.getElementById('client-autocomplete-results').classList.remove('active');
}

// ==========================================
// MODAL CLIENTE
// ==========================================
function openClientModal() {
    document.getElementById('client-modal').classList.add('active');
    if (currentSelection.clientId) {
        const client = DATABASE.clients.find(c => c.id === currentSelection.clientId);
        if (client) {
            tempSelectedClientId = client.id;
            document.getElementById('client-search').value = client.name;
            selectClientFromAutocomplete(client);
        }
    }
}

function closeClientModal() {
    document.getElementById('client-modal').classList.remove('active');
    hideAllClientForms();
    document.getElementById('client-search').value = '';
    document.getElementById('client-autocomplete-results').classList.remove('active');
    tempSelectedClientId = null;
}

// NUEVO: Mostrar tabla de todos los clientes
function showAllClientsTable() {
    hideAllClientForms();
    renderAllClientsTable();
    document.getElementById('all-clients-table-section').classList.add('active');
}

function hideAllClientsTable() {
    document.getElementById('all-clients-table-section').classList.remove('active');
    document.getElementById('clients-table-search').value = '';
}

function renderAllClientsTable(filterTerm = '') {
    const container = document.getElementById('clients-table-container');
    
    let clientsToShow = DATABASE.clients;
    if (filterTerm.trim()) {
        const term = filterTerm.trim().toLowerCase();
        clientsToShow = DATABASE.clients.filter(c => 
            c.name.toLowerCase().includes(term) || 
            c.phone.toLowerCase().includes(term) ||
            (c.address && c.address.toLowerCase().includes(term))
        );
    }

    if (clientsToShow.length === 0) {
        container.innerHTML = '<p class="info-text" style="text-align:center;padding:20px;">No hay clientes para mostrar</p>';
        return;
    }

    container.innerHTML = `
        <table class="clients-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Dirección</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${clientsToShow.map(client => `
                    <tr>
                        <td>${client.name}</td>
                        <td>${client.phone}</td>
                        <td>${client.address || '---'}</td>
                        <td>
                            <button class="btn btn-primary btn-small" onclick="selectClientFromTable('${client.id}')">Seleccionar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function filterClientsTable(term) {
    renderAllClientsTable(term);
}

function selectClientFromTable(clientId) {
    const client = DATABASE.clients.find(c => c.id === clientId);
    if (client) {
        selectClientFromAutocomplete(client);
        hideAllClientsTable();
    }
}

function showNewClientForm() { hideAllClientForms(); document.getElementById('new-client-form').classList.add('active'); }
function hideNewClientForm() {
    document.getElementById('new-client-form').classList.remove('active');
    document.getElementById('new-client-name').value = '';
    document.getElementById('new-client-phone').value = '';
    document.getElementById('new-client-address').value = '';
}

function saveNewClient() {
    const name = document.getElementById('new-client-name').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim();
    const address = document.getElementById('new-client-address').value.trim();
    if (!name || !phone) { alert('Complete nombre y teléfono'); return; }
    const newClient = { id: generateId(), name, phone, address };
    DATABASE.clients.push(newClient);
    saveToLocalStorage('factura_database', DATABASE);
    alert('Cliente creado');
    hideNewClientForm();
    tempSelectedClientId = newClient.id;
    document.getElementById('client-search').value = newClient.name;
    selectClientFromAutocomplete(newClient);
}

function showEditClientForm() {
    if (!tempSelectedClientId) return;
    const client = DATABASE.clients.find(c => c.id === tempSelectedClientId);
    if (!client) return;
    hideAllClientForms();
    document.getElementById('edit-client-name').value = client.name;
    document.getElementById('edit-client-phone').value = client.phone;
    document.getElementById('edit-client-address').value = client.address || '';
    document.getElementById('edit-client-form').classList.add('active');
}

function hideEditClientForm() { document.getElementById('edit-client-form').classList.remove('active'); }

function updateClient() {
    if (!tempSelectedClientId) return;
    const name = document.getElementById('edit-client-name').value.trim();
    const phone = document.getElementById('edit-client-phone').value.trim();
    const address = document.getElementById('edit-client-address').value.trim();
    if (!name || !phone) { alert('Complete nombre y teléfono'); return; }
    const client = DATABASE.clients.find(c => c.id === tempSelectedClientId);
    if (!client) return;
    client.name = name; client.phone = phone; client.address = address;
    saveToLocalStorage('factura_database', DATABASE);
    alert('Cliente actualizado');
    hideEditClientForm();
    document.getElementById('client-search').value = client.name;
    selectClientFromAutocomplete(client);
}

function deleteClient() {
    if (!tempSelectedClientId) return;
    if (!confirm('¿Eliminar este cliente?')) return;
    const index = DATABASE.clients.findIndex(c => c.id === tempSelectedClientId);
    if (index !== -1) {
        DATABASE.clients.splice(index, 1);
        saveToLocalStorage('factura_database', DATABASE);
        if (currentSelection.clientId === tempSelectedClientId) currentSelection.clientId = null;
        alert('Cliente eliminado');
        hideEditClientForm();
        document.getElementById('client-search').value = '';
        document.getElementById('client-data-display').style.display = 'none';
        document.getElementById('edit-client-btn').style.display = 'none';
        tempSelectedClientId = null;
    }
}

function hideAllClientForms() {
    document.getElementById('new-client-form').classList.remove('active');
    document.getElementById('edit-client-form').classList.remove('active');
    document.getElementById('all-clients-table-section').classList.remove('active');
}

function applyClientSelection() {
    if (!tempSelectedClientId) { alert('Seleccione un cliente'); return; }
    currentSelection.clientId = tempSelectedClientId;
    updateInvoiceDisplays();
    closeClientModal();
}

// ==========================================
// MODAL VENDEDOR/TIENDA
// ==========================================
function openSellerStoreModal() {
    loadSellerSelect();
    loadStoreSelects();
    document.getElementById('seller-store-modal').classList.add('active');
}

function closeSellerStoreModal() {
    document.getElementById('seller-store-modal').classList.remove('active');
    hideAllSellerStoreForms();
}

function loadSellerSelect() {
    const select = document.getElementById('seller-select');
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    DATABASE.sellers.forEach(seller => {
        const store = DATABASE.stores.find(s => s.id === seller.storeId);
        const option = document.createElement('option');
        option.value = seller.id;
        option.textContent = `${seller.name} - ${store ? store.name : 'Sin tienda'}`;
        select.appendChild(option);
    });
    if (currentSelection.sellerId) { select.value = currentSelection.sellerId; loadSellerData(); }
}

function loadSellerData() {
    const sellerId = document.getElementById('seller-select').value;
    const display = document.getElementById('seller-data-display');
    const editBtn = document.getElementById('edit-seller-btn');
    if (!sellerId) {
        display.style.display = 'none'; editBtn.style.display = 'none';
        document.getElementById('store-data-display').style.display = 'none';
        document.getElementById('edit-store-btn').style.display = 'none';
        return;
    }
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const store = DATABASE.stores.find(s => s.id === seller.storeId);
    document.getElementById('display-seller-name').textContent = seller.name;
    document.getElementById('display-seller-phone').textContent = seller.phone;
    document.getElementById('display-seller-store').textContent = store ? store.name : 'Sin tienda';
    display.style.display = 'block'; editBtn.style.display = 'inline-block';
    if (store) loadStoreDataFromSeller(store);
}

function loadStoreDataFromSeller(store) {
    document.getElementById('display-store-name').textContent = store.name;
    document.getElementById('display-store-phone').textContent = store.phone;
    document.getElementById('display-store-address').textContent = store.address;
    document.getElementById('display-store-email').textContent = store.email || 'No especificado';
    document.getElementById('store-data-display').style.display = 'block';
    document.getElementById('edit-store-btn').style.display = 'inline-block';
}

function loadStoreSelects() {
    [document.getElementById('new-seller-store'), document.getElementById('edit-seller-store')].forEach(select => {
        select.innerHTML = '<option value="">-- Seleccionar --</option>';
        DATABASE.stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id; option.textContent = store.name;
            select.appendChild(option);
        });
    });
}

function showNewSellerForm()  { hideAllSellerStoreForms(); loadStoreSelects(); document.getElementById('new-seller-form').classList.add('active'); }
function hideNewSellerForm()  {
    document.getElementById('new-seller-form').classList.remove('active');
    document.getElementById('new-seller-name').value = '';
    document.getElementById('new-seller-phone').value = '';
    document.getElementById('new-seller-store').value = '';
}

function saveNewSeller() {
    const name = document.getElementById('new-seller-name').value.trim();
    const phone = document.getElementById('new-seller-phone').value.trim();
    const storeId = document.getElementById('new-seller-store').value;
    if (!name || !phone || !storeId) { alert('Complete todos los campos'); return; }
    const newSeller = { id: generateId(), name, phone, storeId };
    DATABASE.sellers.push(newSeller);
    saveToLocalStorage('factura_database', DATABASE);
    alert('Vendedor creado');
    hideNewSellerForm(); loadSellerSelect();
    document.getElementById('seller-select').value = newSeller.id; loadSellerData();
}

function showEditSellerForm() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId) return;
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    hideAllSellerStoreForms(); loadStoreSelects();
    document.getElementById('edit-seller-name').value = seller.name;
    document.getElementById('edit-seller-phone').value = seller.phone;
    document.getElementById('edit-seller-store').value = seller.storeId;
    document.getElementById('edit-seller-form').classList.add('active');
}

function hideEditSellerForm() { document.getElementById('edit-seller-form').classList.remove('active'); }

function updateSeller() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId) return;
    const name = document.getElementById('edit-seller-name').value.trim();
    const phone = document.getElementById('edit-seller-phone').value.trim();
    const storeId = document.getElementById('edit-seller-store').value;
    if (!name || !phone || !storeId) { alert('Complete todos los campos'); return; }
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    seller.name = name; seller.phone = phone; seller.storeId = storeId;
    saveToLocalStorage('factura_database', DATABASE);
    alert('Vendedor actualizado');
    hideEditSellerForm(); loadSellerSelect();
    document.getElementById('seller-select').value = sellerId; loadSellerData();
}

function deleteSeller() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId || !confirm('¿Eliminar vendedor?')) return;
    const index = DATABASE.sellers.findIndex(s => s.id === sellerId);
    if (index !== -1) {
        DATABASE.sellers.splice(index, 1);
        saveToLocalStorage('factura_database', DATABASE);
        if (currentSelection.sellerId === sellerId) { currentSelection.sellerId = null; currentSelection.storeId = null; }
        alert('Vendedor eliminado');
        hideEditSellerForm(); loadSellerSelect();
        document.getElementById('seller-data-display').style.display = 'none';
        document.getElementById('store-data-display').style.display = 'none';
    }
}

function showNewStoreForm()  { hideAllSellerStoreForms(); document.getElementById('new-store-form').classList.add('active'); }
function hideNewStoreForm()  {
    document.getElementById('new-store-form').classList.remove('active');
    document.getElementById('new-store-name').value = '';
    document.getElementById('new-store-phone').value = '';
    document.getElementById('new-store-address').value = '';
    document.getElementById('new-store-email').value = '';
}

function saveNewStore() {
    const name = document.getElementById('new-store-name').value.trim();
    const phone = document.getElementById('new-store-phone').value.trim();
    const address = document.getElementById('new-store-address').value.trim();
    const email = document.getElementById('new-store-email').value.trim();
    if (!name || !phone || !address) { alert('Complete nombre, teléfono y dirección'); return; }
    const newStore = { id: generateId(), name, phone, address, email };
    DATABASE.stores.push(newStore);
    saveToLocalStorage('factura_database', DATABASE);
    alert('Tienda creada');
    hideNewStoreForm(); loadStoreSelects();
}

function showEditStoreForm() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId) return;
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const store = DATABASE.stores.find(s => s.id === seller.storeId);
    if (!store) return;
    hideAllSellerStoreForms();
    document.getElementById('edit-store-name').value = store.name;
    document.getElementById('edit-store-phone').value = store.phone;
    document.getElementById('edit-store-address').value = store.address;
    document.getElementById('edit-store-email').value = store.email || '';
    document.getElementById('edit-store-form').classList.add('active');
}

function hideEditStoreForm() { document.getElementById('edit-store-form').classList.remove('active'); }

function updateStore() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId) return;
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const name = document.getElementById('edit-store-name').value.trim();
    const phone = document.getElementById('edit-store-phone').value.trim();
    const address = document.getElementById('edit-store-address').value.trim();
    const email = document.getElementById('edit-store-email').value.trim();
    if (!name || !phone || !address) { alert('Complete nombre, teléfono y dirección'); return; }
    const store = DATABASE.stores.find(s => s.id === seller.storeId);
    if (!store) return;
    store.name = name; store.phone = phone; store.address = address; store.email = email;
    saveToLocalStorage('factura_database', DATABASE);
    alert('Tienda actualizada');
    hideEditStoreForm(); loadSellerSelect(); loadSellerData();
}

function deleteStore() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId) return;
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const storeId = seller.storeId;
    const sellersUsingStore = DATABASE.sellers.filter(s => s.storeId === storeId);
    if (sellersUsingStore.length > 1) { alert('No se puede eliminar. Hay otros vendedores usando esta tienda.'); return; }
    if (!confirm('¿Eliminar tienda y vendedor asociado?')) return;
    const storeIndex = DATABASE.stores.findIndex(s => s.id === storeId);
    if (storeIndex !== -1) DATABASE.stores.splice(storeIndex, 1);
    const sellerIndex = DATABASE.sellers.findIndex(s => s.id === sellerId);
    if (sellerIndex !== -1) DATABASE.sellers.splice(sellerIndex, 1);
    saveToLocalStorage('factura_database', DATABASE);
    if (currentSelection.storeId === storeId) { currentSelection.storeId = null; currentSelection.sellerId = null; }
    alert('Tienda y vendedor eliminados');
    hideEditStoreForm(); loadSellerSelect();
    document.getElementById('seller-data-display').style.display = 'none';
    document.getElementById('store-data-display').style.display = 'none';
}

function hideAllSellerStoreForms() {
    ['new-seller-form', 'edit-seller-form', 'new-store-form', 'edit-store-form'].forEach(id =>
        document.getElementById(id).classList.remove('active')
    );
}

function applySellerStoreSelection() {
    const sellerId = document.getElementById('seller-select').value;
    if (!sellerId) { alert('Seleccione un vendedor'); return; }
    const seller = DATABASE.sellers.find(s => s.id === sellerId);
    if (!seller) return;
    currentSelection.sellerId = sellerId;
    currentSelection.storeId = seller.storeId;
    updateInvoiceDisplays();
    closeSellerStoreModal();
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getDateStamp() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function updateInvoiceDisplays() {
    const client = DATABASE.clients.find(c => c.id === currentSelection.clientId);
    const seller = DATABASE.sellers.find(s => s.id === currentSelection.sellerId);
    const store  = DATABASE.stores.find(s => s.id === currentSelection.storeId);

    if (client) {
        document.getElementById('client-name-display').textContent  = client.name;
        document.getElementById('client-phone-display').textContent = client.phone;
    }
    if (seller) document.getElementById('seller-name-display').textContent = seller.name;
    if (store) {
        document.getElementById('store-name-display').textContent    = store.name;
        document.getElementById('store-phone-display').textContent   = store.phone;
        document.getElementById('store-address-display').textContent = store.address;
        const emailDisplay = document.getElementById('store-email-display');
        if (store.email) { emailDisplay.textContent = `Email: ${store.email}`; emailDisplay.style.display = 'block'; }
        else emailDisplay.style.display = 'none';
    } else {
        // v2.6.0: usar config local si no hay tienda de BD seleccionada
        applyStoreConfigToInvoice();
    }

    const selectionDiv  = document.getElementById('current-selection');
    const selectionInfo = document.getElementById('selection-info');
    if (client || seller || store) {
        selectionDiv.style.display = 'block';
        selectionInfo.innerHTML = `
            <strong>Tienda:</strong> ${store   ? store.name   : 'No seleccionada'}<br>
            <strong>Vendedor:</strong> ${seller ? seller.name : 'No seleccionado'}<br>
            <strong>Cliente:</strong> ${client  ? client.name : 'No seleccionado'}
        `;
    }
}


// v2.4.0: Actualizar display de fecha de pago
function updatePaymentDateDisplay() {
    const paymentRow = document.getElementById('payment-date-row');
    const paymentDateEl = document.getElementById('invoice-payment-date');
    
    if (paymentRow && paymentDateEl) {
        if (currentPaymentStatus === 'paid' && currentPaymentDate) {
            paymentRow.style.display = 'flex';
            paymentDateEl.textContent = currentPaymentDate;
        } else {
            paymentRow.style.display = 'none';
        }
    }
}

function formatCurrency(amount) { return "$" + amount.toFixed(2); }

// ==========================================
// FUNCIONES DE LOADING
// ==========================================
function showLoading(message = 'Procesando...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('.loading-text');
    if (text) text.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
}


function setInvoiceMeta() {
    const d = new Date();
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = String(d.getFullYear()).slice(-2);

    // Generar código de factura alfanumérico garantizado: 2 letras + 4 dígitos
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const code = letters[Math.floor(Math.random() * letters.length)] +
                 letters[Math.floor(Math.random() * letters.length)] +
                 String(Math.floor(Math.random() * 9000) + 1000);
    document.getElementById("invoice-number").textContent = code;

    // Fecha de emisión
    const issueEl = document.getElementById("invoice-issue-date");
    if (issueEl) issueEl.textContent = `${day}/${month}/${year}`;
}

function loadProductList() {
    // Actualizar el datalist del modal (nuevo en v2.5.0)
    const dlModal = document.getElementById("modal-product-list");
    if (dlModal) {
        dlModal.innerHTML = "";
        PRODUCT_CATALOG.forEach(p => {
            const o = document.createElement("option");
            o.value = p.name;
            dlModal.appendChild(o);
        });
    }
    const badge = document.getElementById('products-badge');
    if (badge) badge.textContent = PRODUCT_CATALOG.length;
}

function updateTotals() {
    let s = 0, iv = 0, t = 0;
    document.querySelectorAll("#invoice-items-body tr").forEach(r => {
        s += +r.dataset.subtotal; iv += +r.dataset.iva; t += +r.dataset.total;
    });
    document.getElementById('total-subtotal').textContent = formatCurrency(s);
    document.getElementById('total-iva').textContent      = formatCurrency(iv);
    document.getElementById('total-grand').textContent    = formatCurrency(t);
}

function removeRow(btn) { btn.closest('tr').remove(); updateTotals(); }

function setPaymentStatus(status) {
    currentPaymentStatus = status;
    const watermark  = document.getElementById("table-watermark");
    const statusText = document.getElementById("invoice-status-text");
    const config = {
        paid:    { text: 'PAGADO',    wClass: 'table-watermark paid',    sClass: 'invoice-status paid'    },
        credit:  { text: 'CRÉDITO',   wClass: 'table-watermark credit',  sClass: 'invoice-status credit'  },
        pending: { text: 'PENDIENTE', wClass: 'table-watermark pending', sClass: 'invoice-status pending' }
    };
    const c = config[status] || config.pending;
    watermark.textContent  = c.text;
    watermark.className    = c.wClass;
    statusText.textContent = c.text;
    statusText.className   = c.sClass;
}

// ==========================================
// HELPERS PARA GENERACIÓN DE DOCUMENTOS
// ==========================================
function getInvoiceData() {
    const rows = [];
    document.querySelectorAll("#invoice-items-body tr").forEach(row => {
        const cells = row.querySelectorAll('td');
        const qty   = parseInt(cells[0].textContent);
        const priceTypeEl = cells[1].querySelector('.price-type-label');
        const priceType   = priceTypeEl ? priceTypeEl.textContent : '';
        const desc  = cells[1].textContent.replace(priceType, '').trim();
        const price = parseFloat(row.dataset.subtotal) / qty;
        rows.push({
            qty, desc, priceType, price,
            subtotal: parseFloat(row.dataset.subtotal),
            iva:      parseFloat(row.dataset.iva),
            total:    parseFloat(row.dataset.total)
        });
    });

    const store  = DATABASE.stores.find(s => s.id === currentSelection.storeId);
    const seller = DATABASE.sellers.find(s => s.id === currentSelection.sellerId);
    const client = DATABASE.clients.find(c => c.id === currentSelection.clientId);

    return {
        storeName:    store  ? store.name    : document.getElementById('store-name-display').textContent,
        storeAddress: store  ? store.address : document.getElementById('store-address-display').textContent,
        storePhone:   store  ? store.phone   : document.getElementById('store-phone-display').textContent,
        storeEmail:   store  ? store.email   : '',
        storeLogoUrl: loadStoreConfig().logoUrl || null, // v2.6.0
        sellerName:   seller ? seller.name   : document.getElementById('seller-name-display').textContent,
        clientName:   client ? client.name   : document.getElementById('client-name-display').textContent,
        clientPhone:  client ? client.phone  : document.getElementById('client-phone-display').textContent,
        invoiceNum:   document.getElementById('invoice-number').textContent,
        invoiceDate:  document.getElementById('invoice-issue-date').textContent,
        status: currentPaymentStatus,
        paymentDate: currentPaymentDate,
        rows,
        subtotal: parseFloat(document.getElementById('total-subtotal').textContent.replace('$','')),
        iva:      parseFloat(document.getElementById('total-iva').textContent.replace('$','')),
        total:    parseFloat(document.getElementById('total-grand').textContent.replace('$',''))
    };
}

function getFileName(ext) {
    const d = new Date();
    const day   = String(d.getDate()).padStart(2,'0');
    const month = String(d.getMonth()+1).padStart(2,'0');
    const year  = String(d.getFullYear()).slice(-2);
    const clientName = document.getElementById('client-name-display').textContent;
    const clean  = clientName.replace(/[^a-zA-Z0-9]/g,'') || 'Cliente';
    const num    = document.getElementById('invoice-number').textContent;
    return `${day}-${month}-${year}_${clean}_${num}.${ext}`;
}

// ==========================================
// DIBUJAR FACTURA EN CANVAS (A4 nativo)
// ==========================================
function getLogoSVGDataURL() {
    // v2.6.0: primero intentar logo desde config (URL)
    const config = loadStoreConfig();
    if (config.logoUrl) return config.logoUrl;

    // Fallback: SVG inline en el DOM
    const svgEl = document.querySelector('.company-logo svg');
    if (!svgEl) return null;
    const serializer = new XMLSerializer();
    let svgStr = serializer.serializeToString(svgEl);
    if (!svgStr.includes('xmlns=')) {
        svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error('Error cargando imagen: ' + src.substring(0, 60)));
        img.src = src;
    });
}

async function drawInvoiceOnCanvas(canvas, inv, scale) {
    const px  = v => Math.round(v * scale);
    const PAD = px(40);
    const W   = px(794);

    const rowH  = px(28);
    const nRows = inv.rows.length;
    const dynH  = px(40) + px(90) + px(16) + px(60) + px(12) + px(28) + rowH * nRows + px(100) + px(60);
    const H = Math.max(dynH, px(1123));

    canvas.width  = W;
    canvas.height = H;

    const ctx   = canvas.getContext('2d');
    const RIGHT = W - PAD;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle    = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const isPaid   = inv.status === 'paid';
    const isCredit = inv.status === 'credit';
    const accentColor = '#005a9c';
    let y = PAD;

    // CABECERA CON LOGO SVG
    ctx.textBaseline = 'alphabetic';
    const logoWidth  = px(164);
    const logoHeight = px(150);

    try {
        const svgDataURL = getLogoSVGDataURL();
        if (svgDataURL) {
            const logoImg = await loadImage(svgDataURL);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(PAD, y, logoWidth, logoHeight);
            ctx.drawImage(logoImg, PAD, y, logoWidth, logoHeight);
        } else {
            throw new Error('SVG no encontrado');
        }
    } catch (e) {
        ctx.fillStyle = accentColor;
        ctx.fillRect(PAD, y, logoWidth, logoHeight);
        ctx.fillStyle    = '#ffffff';
        ctx.font         = `bold ${px(18)}px Arial, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(inv.storeName || 'MI TIENDA', PAD + logoWidth / 2, y + logoHeight / 2);
    }

    const textStartX = PAD + logoWidth + px(12);
    ctx.fillStyle    = '#000000';
    ctx.font         = `bold ${px(18)}px Arial, sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(inv.storeName, textStartX, y + px(18));

    ctx.font      = `${px(11)}px Arial, sans-serif`;
    ctx.fillStyle = '#444444';
    ctx.fillText(inv.storeAddress, textStartX, y + px(34));
    ctx.fillText('Tel: ' + inv.storePhone, textStartX, y + px(48));
    if (inv.storeEmail) ctx.fillText('Email: ' + inv.storeEmail, textStartX, y + px(62));

    const boxW = px(165), boxH = px(82);
    const boxX = RIGHT - boxW, boxY = y;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth   = px(2);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle    = '#dc3545';
    ctx.font         = `bold ${px(11)}px Arial, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('FACTURA Nº', boxX + boxW / 2, boxY + px(17));

    ctx.fillStyle = '#000000';
    ctx.font      = `bold ${px(17)}px Arial, sans-serif`;
    ctx.fillText(inv.invoiceNum, boxX + boxW / 2, boxY + px(38));

    // v2.4.0: Fecha de emisión
    ctx.font = `${px(9)}px Arial, sans-serif`;
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'left';
    ctx.fillText('Emisión:', boxX + px(10), boxY + px(55));
    ctx.textAlign = 'right';
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${px(10)}px Arial, sans-serif`;
    ctx.fillText(inv.invoiceDate, boxX + boxW - px(10), boxY + px(55));
    
    // v2.4.0: Fecha de pago (solo si está PAGADO)
    let statusYOffset = 0;
    if (inv.status === 'paid' && inv.paymentDate) {
        ctx.font = `${px(9)}px Arial, sans-serif`;
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'left';
        ctx.fillText('Pagado:', boxX + px(10), boxY + px(68));
        ctx.textAlign = 'right';
        ctx.fillStyle = '#28a745';
        ctx.font = `bold ${px(10)}px Arial, sans-serif`;
        ctx.fillText(inv.paymentDate, boxX + boxW - px(10), boxY + px(68));
        statusYOffset = px(13); // Espacio extra para línea divisoria después
    }

    ctx.fillStyle = isPaid ? '#28a745' : isCredit ? '#6f42c1' : '#dc3545';
    ctx.font      = `bold ${px(10)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isPaid ? 'PAGADO' : isCredit ? 'CRÉDITO' : 'PENDIENTE', boxX + boxW / 2, boxY + px(78)); // Posición fija

    // Línea separadora AZUL (ajustada si hay fecha de pago)
    y += statusYOffset > 0 ? px(155 + 13) : px(155);
    ctx.strokeStyle = '#005a9c';
    ctx.lineWidth   = px(2);
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(RIGHT, y); ctx.stroke();
    y += px(22);

    // Vendedor / Cliente (TEXTO MÁS GRANDE)
    ctx.textBaseline = 'alphabetic';
    const labelX = PAD;
    const valueX = PAD + px(70);

    [['Vendedor:', inv.sellerName], ['Cliente:', inv.clientName], ['Tel:', inv.clientPhone]].forEach(([lbl, val]) => {
        ctx.font      = `${px(12)}px Arial, sans-serif`;
        ctx.fillStyle = '#555555';
        ctx.textAlign = 'left';
        ctx.fillText(lbl, labelX, y);
        ctx.font      = `bold ${px(12)}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.fillText(val, valueX, y);
        y += px(20);
    });
    y += px(8);

    // Tabla productos
    const colCant  = PAD;
    const colDesc  = PAD + px(38);
    const colPrice = RIGHT - px(148);
    const colIva   = RIGHT - px(84);
    const colTotal = RIGHT;
    const tableW   = RIGHT - PAD;
    const theadH   = px(28);

    ctx.fillStyle   = '#e8ecf0';
    ctx.fillRect(PAD, y, tableW, theadH);
    ctx.strokeStyle = '#005a9c';
    ctx.lineWidth   = px(1);
    ctx.strokeRect(PAD, y, tableW, theadH);

    ctx.fillStyle    = '#005a9c';
    ctx.font         = `bold ${px(11)}px Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'center'; ctx.fillText('Cant', colCant + px(17), y + theadH / 2);
    ctx.textAlign = 'left';   ctx.fillText('Descripción', colDesc, y + theadH / 2);
    ctx.textAlign = 'right';  ctx.fillText('Precio', colPrice, y + theadH / 2);
    ctx.fillText('IVA', colIva, y + theadH / 2);
    ctx.fillText('Total', colTotal, y + theadH / 2);
    y += theadH;

    inv.rows.forEach((row, i) => {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f7f9fc';
        ctx.fillRect(PAD, y, tableW, rowH);
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth   = px(0.5);
        ctx.strokeRect(PAD, y, tableW, rowH);

        ctx.fillStyle    = '#000000';
        ctx.font         = `${px(11)}px Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign    = 'center';
        ctx.fillText(String(row.qty), colCant + px(17), y + rowH / 2);

        ctx.textAlign = 'left';
        const maxDescW = colPrice - colDesc - px(12);
        let descText = row.desc;
        while (ctx.measureText(descText).width > maxDescW && descText.length > 2) {
            descText = descText.slice(0, -1);
        }
        if (descText !== row.desc) descText += '…';

        if (row.priceType) {
            ctx.font      = `${px(11)}px Arial, sans-serif`;
            ctx.fillText(descText, colDesc, y + rowH / 2 - px(4));
            ctx.font      = `italic ${px(8)}px Arial, sans-serif`;
            ctx.fillStyle = '#888888';
            ctx.fillText(row.priceType, colDesc, y + rowH / 2 + px(6));
        } else {
            ctx.fillText(descText, colDesc, y + rowH / 2);
        }

        ctx.font      = `${px(11)}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText('$' + row.price.toFixed(2), colPrice, y + rowH / 2);
        ctx.fillText('$' + row.iva.toFixed(2),   colIva,   y + rowH / 2);
        ctx.fillText('$' + row.total.toFixed(2), colTotal, y + rowH / 2);
        y += rowH;
    });

    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth   = px(1.5);
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(RIGHT, y); ctx.stroke();

    // Totales
    y += px(14);
    const totW = px(220);
    const totX = RIGHT - totW;

    const drawTotalRow = (label, value, isBig) => {
        const rH = isBig ? px(28) : px(22);
        if (isBig) {
            ctx.fillStyle = '#e8f0fb';
            ctx.fillRect(totX - px(4), y - px(4), totW + px(4), rH);
        }
        ctx.textBaseline = 'alphabetic';
        ctx.font      = isBig ? `bold ${px(13)}px Arial, sans-serif` : `${px(11)}px Arial, sans-serif`;
        ctx.fillStyle = isBig ? accentColor : '#333333';
        ctx.textAlign = 'left';
        ctx.fillText(label, totX + px(6), y + (isBig ? px(17) : px(14)));
        ctx.textAlign = 'right';
        ctx.fillText(value, RIGHT, y + (isBig ? px(17) : px(14)));
        y += rH;
    };

    drawTotalRow('Subtotal', '$' + inv.subtotal.toFixed(2), false);
    drawTotalRow('IVA',      '$' + inv.iva.toFixed(2),      false);
    y += px(4);
    drawTotalRow('TOTAL',    '$' + inv.total.toFixed(2),    true);

    // Marca de agua
    ctx.save();
    ctx.globalAlpha  = 0.055;
    ctx.font         = `bold ${px(88)}px Arial, sans-serif`;
    ctx.fillStyle    = isPaid ? '#28a745' : isCredit ? '#6f42c1' : '#6c757d';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(isPaid ? 'PAGADO' : isCredit ? 'CRÉDITO' : 'PENDIENTE', 0, 0);
    ctx.restore();

    // Pie de página
    const footerY = H - px(22);
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth   = px(1);
    ctx.beginPath();
    ctx.moveTo(PAD, footerY - px(12));
    ctx.lineTo(RIGHT, footerY - px(12));
    ctx.stroke();

    ctx.font         = `italic ${px(9)}px Arial, sans-serif`;
    ctx.fillStyle    = '#aaaaaa';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Documento sin validez fiscal. Comprobante comercial interno.', W / 2, footerY);
}

// ==========================================
// GENERAR PDF
// ==========================================
async function generatePDF() {
    if (document.getElementById('invoice-items-body').children.length === 0) {
        alert("No hay productos en la factura");
        return;
    }

    document.getElementById("loading-overlay").classList.add("active");
    document.getElementById("loading-overlay").querySelector('.loading-text').textContent = "Generando PDF (alta calidad)...";

    document.querySelectorAll(".btn-danger").forEach(btn => btn.style.display = "none");
    const invoice = document.getElementById("invoice");
    invoice.classList.add("hide-watermark");

    try {
        await new Promise(resolve => setTimeout(resolve, 120));

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = 210, pageHeight = 297, padding = 15;

        const canvas = await html2canvas(invoice, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            windowWidth: 900,
            height: invoice.scrollHeight + 60,
            windowHeight: invoice.scrollHeight + 60
        });

        const contentWidth  = pageWidth - (padding * 2);
        const contentHeight = (canvas.height * contentWidth) / canvas.width;
        const availableH    = pageHeight - (padding * 2);
        const totalPages    = Math.ceil(contentHeight / availableH);

        const watermarkText  = currentPaymentStatus === 'paid' ? 'PAGADO' : currentPaymentStatus === 'credit' ? 'CRÉDITO' : 'PENDIENTE';
        const watermarkColor = currentPaymentStatus === 'paid'
            ? 'rgba(40,167,69,0.13)'
            : currentPaymentStatus === 'credit'
                ? 'rgba(111,66,193,0.13)'
                : 'rgba(108,117,125,0.13)';

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
                pdf.addPage();
                pdf.setFontSize(9); pdf.setFont(undefined, 'bold');
                pdf.text(`FACTURA #${document.getElementById("invoice-number").textContent} — Pág ${page + 1}/${totalPages}`, pageWidth / 2, padding - 4, { align: 'center' });
            }

            const yPos     = page > 0 ? padding + 6 : padding;
            const sourceY  = page * availableH * (canvas.width / contentWidth);
            const srcHeight = Math.min(availableH * (canvas.width / contentWidth), canvas.height - sourceY);

            const pageCanvas = document.createElement('canvas');
            pageCanvas.width  = canvas.width;
            pageCanvas.height = srcHeight;
            const pCtx = pageCanvas.getContext('2d');

            pCtx.fillStyle = '#ffffff';
            pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pCtx.drawImage(canvas, 0, sourceY, canvas.width, srcHeight, 0, 0, canvas.width, srcHeight);

            pCtx.save();
            pCtx.font         = `bold 120px Arial`;
            pCtx.fillStyle    = watermarkColor;
            pCtx.textAlign    = 'center';
            pCtx.textBaseline = 'middle';
            pCtx.translate(pageCanvas.width / 2, pageCanvas.height / 2);
            pCtx.rotate(-Math.PI / 4);
            pCtx.fillText(watermarkText, 0, 0);
            pCtx.restore();

            const imgData  = pageCanvas.toDataURL('image/jpeg', 0.92);
            const imgHeight = (srcHeight * contentWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', padding, yPos, contentWidth, imgHeight);
        }

        pdf.save(getFileName('pdf'));
        saveCurrentInvoiceToHistory();
        document.getElementById("loading-overlay").classList.remove("active");
        alert(`✅ PDF generado (${totalPages} página${totalPages > 1 ? 's' : ''})\n⚠️ Archivo pesado por alta resolución.`);

    } catch (err) {
        console.error(err);
        alert("Error al generar PDF: " + err.message);
        document.getElementById("loading-overlay").classList.remove("active");
    } finally {
        document.querySelectorAll(".btn-danger").forEach(btn => btn.style.display = "");
        invoice.classList.remove("hide-watermark");
    }
}

// ==========================================
// GENERAR IMAGEN PNG
// ==========================================
async function generateImage() {
    if (document.getElementById('invoice-items-body').children.length === 0) {
        alert("No hay productos en la factura");
        return;
    }

    document.getElementById("loading-overlay").classList.add("active");
    document.getElementById("loading-overlay").querySelector('.loading-text').textContent = "Generando imagen...";

    await new Promise(resolve => setTimeout(resolve, 80));

    try {
        const inv    = getInvoiceData();
        const canvas = document.createElement('canvas');
        await drawInvoiceOnCanvas(canvas, inv, 2);

        await new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) { reject(new Error('No se pudo generar el blob')); return; }
                const url = URL.createObjectURL(blob);
                const a   = document.createElement('a');
                a.href     = url;
                a.download = getFileName('png');
                a.click();
                URL.revokeObjectURL(url);
                resolve();
            }, 'image/png');
        });

        saveCurrentInvoiceToHistory();
        document.getElementById("loading-overlay").classList.remove("active");
        alert("✅ Imagen generada");

    } catch (err) {
        console.error(err);
        alert("Error al generar imagen: " + err.message);
        document.getElementById("loading-overlay").classList.remove("active");
    }
}

function saveCurrentInvoiceToHistory() {
    const items = [];
    document.querySelectorAll("#invoice-items-body tr").forEach(row => {
        const cells = row.querySelectorAll('td');
        const qty   = parseInt(cells[0].textContent);
        const priceTypeLabel = cells[1].querySelector('.price-type-label');
        const priceType  = priceTypeLabel ? priceTypeLabel.textContent : "";
        const description = cells[1].textContent.replace(priceType, '').trim();
        const price = parseFloat(row.dataset.subtotal) / qty;
        items.push({ quantity: qty, description, price, priceType,
            subtotal: parseFloat(row.dataset.subtotal),
            iva:      parseFloat(row.dataset.iva),
            total:    parseFloat(row.dataset.total)
        });
    });

    const invoiceData = {
        version: "2.5.0",
        invoiceNumber: document.getElementById("invoice-number").textContent,
        invoiceDate:   document.getElementById("invoice-issue-date").textContent,
        clientId:  currentSelection.clientId,
        sellerId:  currentSelection.sellerId,
        storeId:   currentSelection.storeId,
        paymentStatus: currentPaymentStatus,
        paymentDate: currentPaymentDate,
        items,
        totals: {
            subtotal: parseFloat(document.getElementById('total-subtotal').textContent.replace('$','')),
            iva:      parseFloat(document.getElementById('total-iva').textContent.replace('$','')),
            total:    parseFloat(document.getElementById('total-grand').textContent.replace('$',''))
        },
        savedAt: new Date().toISOString()
    };
    saveInvoiceToHistory(invoiceData);
}

function loadInvoice(jsonData) {
    try {
        document.getElementById('invoice-items-body').innerHTML = "";
        currentSelection = { clientId: jsonData.clientId, sellerId: jsonData.sellerId, storeId: jsonData.storeId };
        updateInvoiceDisplays();
        document.getElementById("invoice-number").textContent = jsonData.invoiceNumber;
        // v2.4.0: Establecer fecha de emisión
        const issueEl = document.getElementById("invoice-issue-date");
        if (issueEl && jsonData.invoiceDate) issueEl.textContent = jsonData.invoiceDate;
        setPaymentStatus(jsonData.paymentStatus || "pending");
        currentPaymentDate = jsonData.paymentDate || null;
        updatePaymentDateDisplay();
        jsonData.items.forEach(item => {
            const tr = document.getElementById('invoice-items-body').insertRow();
            tr.dataset.subtotal = item.subtotal;
            tr.dataset.iva      = item.iva;
            tr.dataset.total    = item.total;
            tr.innerHTML = `
                <td>${item.quantity}</td>
                <td>${item.description}<span class="price-type-label">${item.priceType}</span></td>
                <td style="text-align:right">${formatCurrency(item.price)}</td>
                <td style="text-align:right">${formatCurrency(item.iva)}</td>
                <td style="text-align:right">${formatCurrency(item.total)}</td>
                <td><button class="btn btn-danger" onclick="removeRow(this)">×</button></td>
            `;
        });
        updateTotals();
        alert("Factura cargada");
    } catch (error) { alert("Error al cargar la factura: " + error.message); }
}

function newInvoice() {
    if (document.getElementById('invoice-items-body').children.length > 0) {
        if (!confirm("¿Crear nueva factura? Se perderán los datos actuales.")) return;
    }
    document.getElementById('invoice-items-body').innerHTML = "";
    setInvoiceMeta();
    setPaymentStatus("pending");
    currentPaymentDate = null;
    updatePaymentDateDisplay();
    updateTotals();
}

// ==========================================
// EVENT LISTENERS
// ==========================================
// ==========================================
// EVENT LISTENERS
// ==========================================

document.getElementById("new-invoice-btn").addEventListener("click", newInvoice);

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
    setInvoiceMeta();
    setPaymentStatus("pending");
    initClientAutocomplete();
    loadModalProductList();
});

// ==========================================
// v2.4.1: SELECCIÓN MÚLTIPLE DE FACTURAS
// ==========================================

function toggleInvoiceSelection(invoiceNumber, isChecked) {
    if (isChecked) {
        selectedInvoices.add(invoiceNumber);
    } else {
        selectedInvoices.delete(invoiceNumber);
    }
    updateSelectionCount();
    
    // Actualizar visualmente el item
    const item = document.querySelector(`[data-invoice-number="${invoiceNumber}"]`);
    if (item) {
        if (isChecked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
    
    // Actualizar checkbox "seleccionar todas"
    updateSelectAllCheckbox();
}

function toggleSelectAll(checked) {
    selectedInvoices.clear();
    
    if (checked) {
        _historyCache.forEach(inv => {
            selectedInvoices.add(inv.invoiceNumber);
        });
    }
    
    // Re-renderizar para actualizar checkboxes
    renderHistoryItems(_historyCache);
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-invoices');
    if (selectAllCheckbox) {
        const visibleInvoices = _historyCache.length;
        const selectedCount = selectedInvoices.size;
        selectAllCheckbox.checked = visibleInvoices > 0 && selectedCount === visibleInvoices;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < visibleInvoices;
    }
}

function updateSelectionCount() {
    const countEl = document.getElementById('selected-count');
    const actionsEl = document.getElementById('multi-actions');
    const count = selectedInvoices.size;
    
    if (countEl) {
        countEl.textContent = `${count} seleccionada${count !== 1 ? 's' : ''}`;
    }
    
    if (actionsEl) {
        actionsEl.style.display = count > 0 ? 'flex' : 'none';
    }
}

// ==========================================
// v2.4.1: DESCARGA MÚLTIPLE
// ==========================================

async function downloadMultiplePDF() {
    const count = selectedInvoices.size;
    
    if (count === 0) {
        alert('No hay facturas seleccionadas');
        return;
    }
    
    if (count > 50) {
        if (!confirm(`⚠️ Has seleccionado ${count} facturas.\n\nEsto puede tardar varios minutos y generar un PDF muy pesado.\n\n¿Deseas continuar?`)) {
            return;
        }
    }
    
    showLoading('Generando PDF con ' + count + ' factura' + (count > 1 ? 's' : '') + '...');
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        let isFirstPage = true;
        
        // Obtener facturas seleccionadas
        const selectedInvoicesList = _historyCache.filter(inv => 
            selectedInvoices.has(inv.invoiceNumber)
        );
        
        for (const historyItem of selectedInvoicesList) {
            if (!isFirstPage) {
                pdf.addPage();
            }
            
            // Convertir datos del historial al formato esperado
            const invoiceData = convertHistoryToInvoiceData(historyItem);
            const canvas = document.createElement('canvas');
            await drawInvoiceOnCanvas(canvas, invoiceData, 2);
            const imgData = canvas.toDataURL('image/png');
            
            const pdfWidth = 210;
            const pdfHeight = 297;
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const scaledW = imgWidth * ratio;
            const scaledH = imgHeight * ratio;
            const x = (pdfWidth - scaledW) / 2;
            const y = (pdfHeight - scaledH) / 2;
            
            pdf.addImage(imgData, 'PNG', x, y, scaledW, scaledH);
            isFirstPage = false;
        }
        
        const date = getDateStamp();
        pdf.save(`facturas_multiples_${date}.pdf`);
        
        hideLoading();
        alert(`✅ PDF generado con ${count} factura${count > 1 ? 's' : ''}`);
        
    } catch (error) {
        hideLoading();
        alert('❌ Error al generar PDF: ' + error.message);
        console.error(error);
    }
}

async function downloadMultipleImages() {
    const count = selectedInvoices.size;
    
    if (count === 0) {
        alert('No hay facturas seleccionadas');
        return;
    }
    
    if (count > 50) {
        if (!confirm(`⚠️ Has seleccionado ${count} facturas.\n\nEsto puede tardar varios minutos.\n\n¿Deseas continuar?`)) {
            return;
        }
    }
    
    showLoading('Generando imágenes ' + count + '/' + count + '...');
    
    try {
        const zip = new JSZip();
        const imgFolder = zip.folder('facturas');
        
        // Obtener facturas seleccionadas
        const selectedInvoicesList = _historyCache.filter(inv => 
            selectedInvoices.has(inv.invoiceNumber)
        );
        
        let processed = 0;
        
        for (const historyItem of selectedInvoicesList) {
            processed++;
            showLoading(`Generando imágenes ${processed}/${count}...`);
            
            // Convertir datos del historial al formato esperado
            const invoiceData = convertHistoryToInvoiceData(historyItem);
            const canvas = document.createElement('canvas');
            await drawInvoiceOnCanvas(canvas, invoiceData, 2);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            
            const client = DATABASE.clients.find(c => c.id === historyItem.clientId);
            const clientName = client ? client.name.replace(/[^a-zA-Z0-9]/g, '') : 'Cliente';
            const fileName = `${historyItem.invoiceDate.replace(/\//g, '-')}_${clientName}_${historyItem.invoiceNumber}.png`;
            
            imgFolder.file(fileName, blob);
        }
        
        showLoading('Comprimiendo ZIP...');
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        const date = getDateStamp();
        a.href = url;
        a.download = `facturas_${date}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        
        hideLoading();
        alert(`✅ ZIP generado con ${count} factura${count > 1 ? 's' : ''}`);
        
    } catch (error) {
        hideLoading();
        alert('❌ Error al generar imágenes: ' + error.message);
        console.error(error);
    }
}

// ==========================================
// v2.4.1: CONVERTIR DATOS DE HISTORIAL
// ==========================================
function convertHistoryToInvoiceData(historyItem) {
    // Convertir items a rows
    const rows = historyItem.items.map(item => ({
        qty: item.quantity,
        desc: item.description,
        priceType: item.priceType || '',
        price: item.price,
        subtotal: item.subtotal,
        iva: item.iva,
        total: item.total
    }));
    
    // Obtener datos de cliente, vendedor y tienda
    const store = DATABASE.stores.find(s => s.id === historyItem.storeId);
    const seller = DATABASE.sellers.find(s => s.id === historyItem.sellerId);
    const client = DATABASE.clients.find(c => c.id === historyItem.clientId);
    
    return {
        storeName: store ? store.name : (loadStoreConfig().name || 'Tienda'),
        storeAddress: store ? store.address : (loadStoreConfig().address || '---'),
        storePhone: store ? store.phone : (loadStoreConfig().phone || '---'),
        storeEmail: store ? store.email : (loadStoreConfig().email || ''),
        storeLogoUrl: loadStoreConfig().logoUrl || null,
        sellerName: seller ? seller.name : '---',
        clientName: client ? client.name : 'Cliente desconocido',
        clientPhone: client ? client.phone : '---',
        invoiceNum: historyItem.invoiceNumber,
        invoiceDate: historyItem.invoiceDate,
        status: historyItem.paymentStatus,
        paymentDate: historyItem.paymentDate,
        rows: rows,
        subtotal: historyItem.totals.subtotal,
        iva: historyItem.totals.iva,
        total: historyItem.totals.total
    };
}

// ==========================================
// v2.5.0: MODAL AGREGAR PRODUCTOS A FACTURA
// ==========================================

let _modalScannerStream = null;
let _modalScannerInterval = null;
let _currentScanTargetId = null; // ID del input destino para el escáner de catálogo
let _dedicatedScannerStream = null;
let _dedicatedScannerInterval = null;

function loadModalProductList() {
    loadProductList();
}

function openAddItemsModal() {
    loadModalProductList();
    renderModalAddedItems();
    document.getElementById('add-items-modal').classList.add('active');
    // Resetear campos
    document.getElementById('modal-p-desc').value = '';
    document.getElementById('modal-p-price').value = '';
    document.getElementById('modal-p-qty').value = '1';
    document.getElementById('modal-p-iva').checked = false;
    document.getElementById('modal-p-mayoreo').checked = false;
    switchAddTab('manual');
}

function closeAddItemsModal() {
    stopModalBarcodeScanner();
    document.getElementById('add-items-modal').classList.remove('active');
}

function switchAddTab(tab) {
    document.querySelectorAll('.add-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.add-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('add-panel-' + tab).classList.add('active');

    if (tab !== 'barcode') {
        stopModalBarcodeScanner();
    }
}

function onModalProductInput() {
    const name = document.getElementById('modal-p-desc').value;
    const product = PRODUCT_CATALOG.find(p => p.name === name);
    if (!product) return;
    const mayoreo = document.getElementById('modal-p-mayoreo').checked;
    document.getElementById('modal-p-price').value = (
        mayoreo && product.wholesale ? product.wholesale : product.price
    ).toFixed(2);
}

function onModalMayoreoChange() {
    const name = document.getElementById('modal-p-desc').value;
    const product = PRODUCT_CATALOG.find(p => p.name === name);
    if (!product) return;
    const mayoreo = document.getElementById('modal-p-mayoreo').checked;
    document.getElementById('modal-p-price').value = (
        mayoreo && product.wholesale ? product.wholesale : product.price
    ).toFixed(2);
}

function addProductFromModal() {
    const activeTab = document.querySelector('.add-tab.active').id;
    const isBarcode = activeTab === 'tab-barcode';

    let desc, priceInput;

    if (isBarcode) {
        desc = document.getElementById('modal-bc-desc').value.trim();
        priceInput = document.getElementById('modal-bc-price').value;
    } else {
        desc = document.getElementById('modal-p-desc').value.trim();
        priceInput = document.getElementById('modal-p-price').value;
    }

    const qty   = +document.getElementById('modal-p-qty').value;
    const price = parseFloat(priceInput);
    const ivaChecked    = document.getElementById('modal-p-iva').checked;
    const mayoreoChecked = document.getElementById('modal-p-mayoreo').checked;

    if (!desc || qty <= 0 || isNaN(price) || price <= 0) {
        alert('Complete todos los campos correctamente');
        return;
    }

    const subtotal = qty * price;
    const iva      = ivaChecked ? subtotal * IVA_RATE : 0;
    const total    = subtotal + iva;
    const priceType = mayoreoChecked ? 'Mayoreo' : 'Unitario';

    // Añadir fila a la factura
    const tr = document.getElementById('invoice-items-body').insertRow();
    tr.dataset.subtotal = subtotal;
    tr.dataset.iva      = iva;
    tr.dataset.total    = total;
    tr.innerHTML = `
        <td>${qty}</td>
        <td>${desc}<span class="price-type-label">${priceType}</span></td>
        <td style="text-align:right">${formatCurrency(price)}</td>
        <td style="text-align:right">${formatCurrency(iva)}</td>
        <td style="text-align:right">${formatCurrency(total)}</td>
        <td><button class="btn btn-danger" onclick="removeRow(this)">×</button></td>
    `;
    updateTotals();

    // Actualizar lista de productos añadidos en el modal
    renderModalAddedItems();

    // Limpiar campos para siguiente producto
    if (isBarcode) {
        document.getElementById('modal-bc-desc').value = '';
        document.getElementById('modal-bc-price').value = '';
        document.getElementById('modal-barcode-fields').style.display = 'none';
        document.getElementById('modal-scan-result').style.display = 'none';
    } else {
        document.getElementById('modal-p-desc').value = '';
        document.getElementById('modal-p-price').value = '';
    }
    document.getElementById('modal-p-qty').value = '1';
    document.getElementById('modal-p-iva').checked = false;
    document.getElementById('modal-p-mayoreo').checked = false;
}

function renderModalAddedItems() {
    const list    = document.getElementById('modal-added-items-list');
    const countEl = document.getElementById('modal-items-count');
    const rows    = document.querySelectorAll('#invoice-items-body tr');

    countEl.textContent = rows.length;

    if (rows.length === 0) {
        list.innerHTML = '<p class="empty-msg">Aún no has añadido productos</p>';
        return;
    }

    list.innerHTML = Array.from(rows).reverse().map((row, i) => {
        const cells = row.querySelectorAll('td');
        const qty   = cells[0].textContent;
        const label = cells[1].querySelector('.price-type-label');
        const pt    = label ? label.textContent : '';
        const desc  = cells[1].textContent.replace(pt, '').trim();
        const total = parseFloat(row.dataset.total);
        return `
        <div class="modal-added-item">
            <div class="item-desc">${qty}× ${desc}</div>
            <div class="item-details">${pt || 'Unitario'}</div>
            <div class="item-total">${formatCurrency(total)}</div>
        </div>`;
    }).join('');
}

// ==========================================
// v2.5.0: ESCÁNER DE CÓDIGO DE BARRAS - MODAL INLINE (factura)
// ==========================================

async function startModalBarcodeScanner() {
    const statusDiv = document.getElementById('modal-scan-status');
    const video     = document.getElementById('modal-barcode-video');
    const overlay   = document.getElementById('modal-scanner-overlay');
    const scanBtn   = document.getElementById('modal-scan-btn');
    const stopBtn   = document.getElementById('modal-scan-stop-btn');

    statusDiv.style.display = 'none';
    document.getElementById('modal-scan-result').style.display = 'none';
    document.getElementById('modal-barcode-fields').style.display = 'none';

    try {
        _modalScannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = _modalScannerStream;
        video.style.display = 'block';
        overlay.style.display = 'flex';
        scanBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';

        _startZxingDecoder(
            video,
            document.getElementById('modal-barcode-canvas'),
            (code) => _onModalBarcodeDetected(code)
        );

    } catch (err) {
        statusDiv.style.display = 'flex';
        document.getElementById('modal-scan-status').querySelector('p').textContent = '❌ Sin acceso a la cámara: ' + err.message;
    }
}

function stopModalBarcodeScanner() {
    if (_modalScannerInterval) {
        clearInterval(_modalScannerInterval);
        _modalScannerInterval = null;
    }
    if (_modalScannerStream) {
        _modalScannerStream.getTracks().forEach(t => t.stop());
        _modalScannerStream = null;
    }
    const video   = document.getElementById('modal-barcode-video');
    const overlay = document.getElementById('modal-scanner-overlay');
    const scanBtn = document.getElementById('modal-scan-btn');
    const stopBtn = document.getElementById('modal-scan-stop-btn');
    if (video)   { video.style.display = 'none'; video.srcObject = null; }
    if (overlay) overlay.style.display = 'none';
    if (scanBtn) scanBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
    const status = document.getElementById('modal-scan-status');
    if (status)  status.style.display = 'flex';
}

function _onModalBarcodeDetected(code) {
    stopModalBarcodeScanner();

    const resultDiv  = document.getElementById('modal-scan-result');
    const codeEl     = document.getElementById('modal-scan-code');
    const foundEl    = document.getElementById('modal-scan-product-found');
    const notFoundEl = document.getElementById('modal-scan-product-notfound');
    const fieldsDiv  = document.getElementById('modal-barcode-fields');

    codeEl.textContent = code;
    resultDiv.style.display = 'block';

    // Buscar producto por código de barras
    const product = PRODUCT_CATALOG.find(p => p.code && p.code === code);
    if (product) {
        foundEl.textContent = '✅ Producto: ' + product.name;
        foundEl.style.display = 'block';
        notFoundEl.style.display = 'none';

        fieldsDiv.style.display = 'block';
        document.getElementById('modal-bc-desc').value  = product.name;
        const mayoreo = document.getElementById('modal-p-mayoreo').checked;
        document.getElementById('modal-bc-price').value = (
            mayoreo && product.wholesale ? product.wholesale : product.price
        ).toFixed(2);
    } else {
        foundEl.style.display = 'none';
        notFoundEl.style.display = 'block';
        notFoundEl.textContent = '⚠️ No se encontró ningún producto con este código. Puedes registrarlo en el catálogo.';
        fieldsDiv.style.display = 'block';
        document.getElementById('modal-bc-desc').value  = '';
        document.getElementById('modal-bc-price').value = '';
    }
}

// ==========================================
// v2.5.0: ESCÁNER DE CÓDIGO DE BARRAS - MODAL DEDICADO (para guardar en catálogo)
// ==========================================

function openBarcodeScanner(targetInputId, callback) {
    _currentScanTargetId = targetInputId;
    _barcodeCallback = callback;
    document.getElementById('barcode-scanner-modal').classList.add('active');
    const statusText = document.getElementById('scanner-status-text');
    statusText.textContent = 'Iniciando cámara...';
    document.getElementById('scanner-status').style.display = 'flex';
    document.getElementById('barcode-video').style.display = 'none';
    document.getElementById('scanner-overlay').style.display = 'none';
    document.getElementById('scanner-result').style.display = 'none';

    setTimeout(() => _startDedicatedScanner(), 300);
}

let _barcodeCallback = null;

async function _startDedicatedScanner() {
    const video   = document.getElementById('barcode-video');
    const statusDiv = document.getElementById('scanner-status');
    const overlay   = document.getElementById('scanner-overlay');

    try {
        _dedicatedScannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = _dedicatedScannerStream;
        video.style.display = 'block';
        statusDiv.style.display = 'none';
        overlay.style.display = 'flex';

        _startZxingDecoder(
            video,
            document.getElementById('barcode-canvas'),
            (code) => _onDedicatedBarcodeDetected(code)
        );

    } catch (err) {
        document.getElementById('scanner-status-text').textContent = '❌ Sin acceso a cámara: ' + err.message;
    }
}

function _onDedicatedBarcodeDetected(code) {
    _stopDedicatedScanner();

    const resultDiv = document.getElementById('scanner-result');
    const codeEl    = document.getElementById('scanner-result-code');
    resultDiv.style.display = 'block';
    codeEl.textContent = code;

    // Poner el código en el input objetivo
    if (_currentScanTargetId) {
        const targetEl = document.getElementById(_currentScanTargetId);
        if (targetEl) targetEl.value = code;
    }
    if (_barcodeCallback) {
        _barcodeCallback(code);
    }

    // Cerrar modal después de un momento
    setTimeout(() => {
        closeBarcodeScanner();
    }, 1200);
}

function _stopDedicatedScanner() {
    if (_dedicatedScannerInterval) {
        clearInterval(_dedicatedScannerInterval);
        _dedicatedScannerInterval = null;
    }
    if (_dedicatedScannerStream) {
        _dedicatedScannerStream.getTracks().forEach(t => t.stop());
        _dedicatedScannerStream = null;
    }
}

function closeBarcodeScanner() {
    _stopDedicatedScanner();
    document.getElementById('barcode-scanner-modal').classList.remove('active');
    _currentScanTargetId = null;
    _barcodeCallback = null;
}

// ==========================================
// v2.5.0: MOTOR ZXING PARA DECODIFICACIÓN
// ==========================================

function _startZxingDecoder(videoEl, canvasEl, onDetected) {
    const canvas = canvasEl;
    const ctx    = canvas.getContext('2d');

    // Usar ZXing si está disponible, fallback a BarcodeDetector nativo
    if (typeof ZXing !== 'undefined') {
        try {
            const hints = new ZXing.Map();
            const formats = [
                ZXing.BarcodeFormat.EAN_13,
                ZXing.BarcodeFormat.EAN_8,
                ZXing.BarcodeFormat.CODE_128,
                ZXing.BarcodeFormat.CODE_39,
                ZXing.BarcodeFormat.QR_CODE,
                ZXing.BarcodeFormat.UPC_A,
                ZXing.BarcodeFormat.UPC_E,
            ];
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
            const reader = new ZXing.MultiFormatReader();
            reader.setHints(hints);

            const interval = setInterval(() => {
                if (!videoEl.srcObject || videoEl.paused || videoEl.ended) return;
                if (videoEl.videoWidth === 0) return;
                canvas.width  = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const luminance = new ZXing.RGBLuminanceSource(imageData.data, canvas.width, canvas.height);
                    const bitmap    = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminance));
                    const result    = reader.decode(bitmap);
                    if (result) {
                        clearInterval(interval);
                        onDetected(result.getText());
                    }
                } catch (e) { /* sin código aún */ }
            }, 200);

            // Guardar referencia al interval según el video
            if (videoEl.id === 'modal-barcode-video') {
                _modalScannerInterval = interval;
            } else {
                _dedicatedScannerInterval = interval;
            }
            return;
        } catch(e) {
            console.warn('ZXing no disponible, intentando BarcodeDetector nativo');
        }
    }

    // Fallback: BarcodeDetector nativo (Chrome/Edge/Android)
    if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
        });

        const interval = setInterval(async () => {
            if (!videoEl.srcObject || videoEl.paused || videoEl.videoWidth === 0) return;
            try {
                const barcodes = await detector.detect(videoEl);
                if (barcodes.length > 0) {
                    clearInterval(interval);
                    onDetected(barcodes[0].rawValue);
                }
            } catch (e) { /* sin código */ }
        }, 250);

        if (videoEl.id === 'modal-barcode-video') {
            _modalScannerInterval = interval;
        } else {
            _dedicatedScannerInterval = interval;
        }
        return;
    }

    // Sin soporte
    const statusText = videoEl.id === 'modal-barcode-video'
        ? document.getElementById('modal-scan-status').querySelector('p')
        : document.getElementById('scanner-status-text');
    if (statusText) statusText.textContent = '❌ Tu navegador no soporta lectura de códigos de barras. Usa Chrome o Edge en Android.';
}
