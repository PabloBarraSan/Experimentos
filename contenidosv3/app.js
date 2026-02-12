/**
 * Gestor de Contenidos - Búsqueda Visible
 * Integrado con API: https://public.digitalvalue.es:8865/alcantir/collections/articulos
 */

const API_BASE = 'https://public.digitalvalue.es:8865/alcantir/collections/articulos';
const API_VOCABULARIOS = 'https://public.digitalvalue.es:8865/alcantir/collections/vocabularios';
const DEFAULT_LIMIT = 20;
const DEFAULT_FIELDS = 'title,name,nombre,collectionName,isPublished,isPromoted,web,nodeTypes,createdAt,categories';

const COLUMN_FIELDS = ['address', 'audios', 'body', 'categories', 'created', 'data', 'date', 'images', 'headerImage', 'lead', 'nodeTypes', 'owners', 'tags', 'title', 'updated'];

let data = [];
let nodeTypes = [];
let categories = [];
let selectedIds = [];
let listContainer;

// Estado de la API
let state = {
    loading: false,
    error: null,
    offset: 0,
    limit: DEFAULT_LIMIT,
    totalCount: 0,
    filterType: '',
    filterCategory: '',
    searchQuery: '',
    filterField: '',
    filterValue: '',
    visibleColumns: new Set(COLUMN_FIELDS),
    viewMode: 'tabla' // 'tabla' | 'calendario'
};

/**
 * Abre el panel lateral para editar el artículo.
 * Lee el artículo completo de la API y lo pasa al callback.
 * Sobrescribe esta función para integrar tu panel de edición.
 * @param {string} articleId - ID del artículo
 * @param {object} articlePreview - Datos básicos del artículo (lista)
 */
async function openEditPanel(articleId, articlePreview) {
    try {
        const article = await fetchArticle(articleId);
        console.log('Abrir panel de edición:', articleId, article);
        window.dispatchEvent(new CustomEvent('edit-article', { detail: { id: articleId, article } }));
    } catch (err) {
        console.error('Error al cargar artículo:', err);
    }
}

/**
 * Obtiene un artículo completo por ID
 */
async function fetchArticle(id) {
    const res = await fetch(`${API_BASE}/${id}?expand=false`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/**
 * Extrae el título de un ítem (puede ser string u objeto multiidioma)
 */
function extractTitle(item) {
    const t = item.title;
    if (!t) return 'Sin título';
    if (typeof t === 'string') return t;
    return t.und || t.es || t.va || Object.values(t)[0] || 'Sin título';
}

/**
 * Extrae la fecha de creación del ObjectId de MongoDB (primeros 4 bytes = timestamp)
 */
function dateFromObjectId(id) {
    if (!id || typeof id !== 'string' || id.length !== 24) return null;
    try {
        const timestamp = parseInt(id.substring(0, 8), 16);
        return new Date(timestamp * 1000);
    } catch {
        return null;
    }
}

/**
 * Construye la URL de la API con parámetros
 */
function buildApiUrl() {
    const params = new URLSearchParams({
        offset: state.offset,
        limit: state.limit,
        expand: 'false',
        fields: DEFAULT_FIELDS
    });
    return `${API_BASE}?${params}`;
}

/**
 * Obtiene los artículos de la API
 */
async function fetchArticles() {
    state.loading = true;
    state.error = null;
    renderList();

    try {
        const res = await fetch(buildApiUrl());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const items = json.items || [];
        state.totalCount = json.itemsCount ?? items.length;

        data = items.map(item => ({
            id: item._id,
            title: extractTitle(item),
            type: (item.nodeTypes && item.nodeTypes[0]) || 'Sin tipo',
            categories: Array.isArray(item.categories) ? item.categories : [],
            date: formatDate(item.created || item.createdAt || dateFromObjectId(item._id)?.toISOString?.()),
            published: item.isPublished === true,
            promoted: item.isPromoted === true
        }));

        state.error = null;
    } catch (err) {
        state.error = err.message;
        data = [];
    } finally {
        state.loading = false;
        renderList();
        updateFooter();
        updateBadgeCount();
    }
}

function formatDate(str) {
    if (!str) return '—';
    try {
        const d = new Date(str);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return str;
    }
}

async function init() {
    listContainer = document.getElementById('list-container');

    await Promise.all([fetchVocabularios(), fetchCategories()]);
    bindFilterChips();
    bindPagination();
    bindHeaderActions();
    bindSearch();
    bindColumnConfig();
    bindBulkActions();
    fetchArticles();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function bindFilterChips() {
    const chipTipo = document.getElementById('filter-chip-tipo');
    const chipCategory = document.getElementById('filter-chip-category');
    const menuTipo = document.getElementById('filter-tipo-menu');
    const menuCategory = document.getElementById('filter-category-menu');
    const filterClear = document.getElementById('filter-clear');

    function renderTipoMenu() {
        if (!menuTipo) return;
        menuTipo.innerHTML = '<button class="filter-chip-item active" data-value="">Todos</button>' +
            nodeTypes.map(t => `<button class="filter-chip-item" data-value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</button>`).join('');
        menuTipo.querySelectorAll('.filter-chip-item').forEach(btn => {
            btn.addEventListener('click', () => {
                state.filterType = btn.dataset.value || '';
                document.getElementById('filter-chip-tipo-label').textContent = btn.dataset.value ? btn.textContent : 'Tipo';
                chipTipo?.classList.toggle('active', !!state.filterType);
                menuTipo.querySelectorAll('.filter-chip-item').forEach(b => b.classList.toggle('active', b === btn));
                updateFilterClear();
                renderList();
            });
        });
    }

    function renderCategoryMenu() {
        if (!menuCategory) return;
        menuCategory.innerHTML = '<button class="filter-chip-item active" data-value="">Todas</button>' +
            categories.map(c => `<button class="filter-chip-item" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
        menuCategory.querySelectorAll('.filter-chip-item').forEach(btn => {
            btn.addEventListener('click', () => {
                state.filterCategory = btn.dataset.value || '';
                document.getElementById('filter-chip-category-label').textContent = btn.dataset.value ? btn.textContent : 'Categoría';
                chipCategory?.classList.toggle('active', !!state.filterCategory);
                menuCategory.querySelectorAll('.filter-chip-item').forEach(b => b.classList.toggle('active', b === btn));
                updateFilterClear();
                renderList();
            });
        });
    }

    function updateFilterClear() {
        filterClear?.classList.toggle('hidden', !hasActiveFilters());
    }

    chipTipo?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuCategory?.classList.add('hidden');
        menuTipo?.classList.toggle('hidden');
    });
    chipCategory?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuTipo?.classList.add('hidden');
        menuCategory?.classList.toggle('hidden');
    });
    filterClear?.addEventListener('click', () => {
        clearFilters();
        menuTipo?.classList.add('hidden');
        menuCategory?.classList.add('hidden');
    });

    document.addEventListener('click', () => {
        menuTipo?.classList.add('hidden');
        menuCategory?.classList.add('hidden');
    });

    renderTipoMenu();
    renderCategoryMenu();
    updateFilterClear();
}

function bindHeaderActions() {
    document.getElementById('btn-nuevo')?.addEventListener('click', () => console.log('Nuevo artículo'));

    const btnMas = document.getElementById('btn-mas');
    const masMenu = document.getElementById('mas-menu');
    if (btnMas && masMenu) {
        btnMas.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('exportar-menu')?.classList.add('hidden');
            masMenu.classList.toggle('hidden');
        });
        ['btn-importar-csv', 'btn-mezclar-csv', 'btn-grafico', 'btn-ayuda'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => {
                console.log(id);
                masMenu.classList.add('hidden');
            });
        });
        document.getElementById('btn-col-config-trigger')?.addEventListener('click', () => {
            masMenu.classList.add('hidden');
            document.getElementById('col-config-menu')?.classList.toggle('hidden');
        });
    }

    const btnExport = document.getElementById('btn-exportar');
    const menuExport = document.getElementById('exportar-menu');
    if (btnExport && menuExport) {
        btnExport.addEventListener('click', (e) => { e.stopPropagation(); menuExport.classList.toggle('hidden'); });
        menuExport.querySelectorAll('[data-export]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const format = e.target.closest('[data-export]')?.dataset.export;
                exportData(format);
                menuExport.classList.add('hidden');
            });
        });
    }
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-exportar') && !e.target.closest('#exportar-menu')) {
            document.getElementById('exportar-menu')?.classList.add('hidden');
        }
        if (!e.target.closest('#btn-mas') && !e.target.closest('#mas-menu')) {
            document.getElementById('mas-menu')?.classList.add('hidden');
        }
    });

    const btnTabla = document.getElementById('btn-vista-tabla');
    const btnCal = document.getElementById('btn-vista-calendario');
    if (btnTabla) btnTabla.addEventListener('click', () => setViewMode('tabla'));
    if (btnCal) btnCal.addEventListener('click', () => setViewMode('calendario'));
}

function setViewMode(mode) {
    state.viewMode = mode;
    document.getElementById('btn-vista-tabla')?.classList.toggle('active', mode === 'tabla');
    document.getElementById('btn-vista-calendario')?.classList.toggle('active', mode === 'calendario');
    if (mode === 'calendario') console.log('Vista calendario (pendiente implementar)');
    else renderList();
}

function exportData(format) {
    const items = getFilteredItems();
    if (format === 'json') {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'articulos.json');
    } else if (format === 'csv') {
        const header = ['id', 'title', 'type', 'categories', 'date'];
        const rows = items.map(i => [i.id, i.title, i.type, (i.categories || []).join(';'), i.date]);
        const csv = [header.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, 'articulos.csv');
    }
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function bindSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                state.searchQuery = e.target.value.trim();
                document.getElementById('filter-clear')?.classList.toggle('hidden', !hasActiveFilters());
                applyFilters();
            }, 300);
        });
    }
}

function hasActiveFilters() {
    return !!(state.filterType || state.filterCategory || state.searchQuery);
}

function bindColumnConfig() {
    const btn = document.getElementById('btn-col-config');
    const menu = document.getElementById('col-config-menu');
    if (!btn || !menu) return;
    menu.innerHTML = COLUMN_FIELDS.map(f => `
        <label class="col-config-item">
            <input type="checkbox" ${state.visibleColumns.has(f) ? 'checked' : ''} data-field="${f}">
            <span>${f}</span>
        </label>
    `).join('');
    menu.querySelectorAll('input').forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) state.visibleColumns.add(e.target.dataset.field);
            else state.visibleColumns.delete(e.target.dataset.field);
        });
    });
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
    });
}

function bindBulkActions() {
    const checkboxAllHeader = document.getElementById('checkbox-all-header');
    const btnProcesos = document.getElementById('btn-procesos-masivos');
    const bulkDropdown = document.getElementById('bulk-dropdown');
    const bulkHint = document.getElementById('bulk-dropdown-hint');

    const toggleAll = () => {
        const items = listContainer.querySelectorAll('[data-item-id]');
        const ids = Array.from(items).map(el => el.dataset.itemId);
        if (selectedIds.length === ids.length && ids.length > 0) {
            selectedIds = [];
        } else {
            selectedIds = [...ids];
        }
        renderList();
    };

    if (checkboxAllHeader) checkboxAllHeader.addEventListener('click', toggleAll);

    if (btnProcesos && bulkDropdown) {
        btnProcesos.addEventListener('click', (e) => {
            e.stopPropagation();
            const hasSelection = selectedIds.length > 0;
            bulkHint?.classList.toggle('hidden', hasSelection);
            bulkDropdown.querySelectorAll('.bulk-action').forEach(b => b.classList.toggle('hidden', !hasSelection));
            bulkDropdown.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-procesos-masivos') && !e.target.closest('#bulk-dropdown')) {
            bulkDropdown?.classList.add('hidden');
        }
    });

    bulkDropdown?.querySelectorAll('.bulk-action').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Bulk action:', btn.textContent.trim());
            bulkDropdown.classList.add('hidden');
        });
    });
}

/**
 * Carga los tipos de nodo desde vocabularios (NodeTypes)
 */
async function fetchVocabularios() {
    try {
        const url = `${API_VOCABULARIOS}?or=name=NodeTypes|name.und=NodeTypes&fields=name,terms`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const vocab = json.items?.[0];
        if (!vocab?.terms) return;
        nodeTypes = vocab.terms.map(t => ({
            id: t._id,
            label: typeof t.term === 'string' ? t.term : (t.term?.und || t.term?.es || t.term?.ca || t._id)
        }));
    } catch (err) {
        nodeTypes = [{ id: 'Noticia', label: 'Noticia' }, { id: 'Evento', label: 'Evento' }];
    }
}

/**
 * Carga las categorías distintas
 */
async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE}/distinct/categories`);
        if (!res.ok) return;
        const arr = await res.json();
        categories = Array.isArray(arr) ? arr.filter(Boolean).sort() : [];
    } catch (err) {
        categories = [];
    }
}

function getFilteredItems() {
    let items = data;
    if (state.filterType) items = items.filter(i => i.type === state.filterType);
    if (state.filterCategory) items = items.filter(i => (i.categories || []).includes(state.filterCategory));
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        items = items.filter(i =>
            (i.title || '').toLowerCase().includes(q) ||
            (i.id || '').toLowerCase().includes(q)
        );
    }
    if (state.filterField && state.filterValue) {
        const fv = state.filterValue.toLowerCase();
        items = items.filter(i => {
            const val = i[state.filterField];
            if (val === undefined) return false;
            return String(val).toLowerCase().includes(fv);
        });
    }
    return items;
}

function clearFilters() {
    state.filterType = '';
    state.filterCategory = '';
    state.searchQuery = '';
    state.filterField = '';
    state.filterValue = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    document.getElementById('filter-chip-tipo-label').textContent = 'Tipo';
    document.getElementById('filter-chip-category-label').textContent = 'Categoría';
    document.getElementById('filter-chip-tipo')?.classList.remove('active');
    document.getElementById('filter-chip-category')?.classList.remove('active');
    document.getElementById('filter-clear')?.classList.add('hidden');
    const menuTipo = document.getElementById('filter-tipo-menu');
    const menuCategory = document.getElementById('filter-category-menu');
    menuTipo?.querySelectorAll('.filter-chip-item').forEach(b => { b.classList.toggle('active', b.dataset.value === ''); });
    menuCategory?.querySelectorAll('.filter-chip-item').forEach(b => { b.classList.toggle('active', b.dataset.value === ''); });
    state.offset = 0;
    renderList();
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    state.searchQuery = searchInput?.value?.trim() || '';
    state.offset = 0;
    renderList();
}

function bindPagination() {
    const selectLimit = document.getElementById('footer-select-limit');
    const btnPrev = document.getElementById('pagination-prev');
    const btnNext = document.getElementById('pagination-next');

    if (selectLimit) selectLimit.addEventListener('change', (e) => {
        state.limit = Number(e.target.value);
        state.offset = 0;
        fetchArticles();
    });
    if (btnPrev) btnPrev.addEventListener('click', () => goToPage(-1));
    if (btnNext) btnNext.addEventListener('click', () => goToPage(1));
}

function goToPage(delta) {
    const newOffset = state.offset + (delta * state.limit);
    if (newOffset < 0) return;
    if (newOffset >= state.totalCount) return;
    state.offset = newOffset;
    fetchArticles();
}

function updateFooter() {
    const text = document.getElementById('footer-text');
    const paginationContainer = document.getElementById('pagination-pages');
    const btnPrev = document.getElementById('pagination-prev');
    const btnNext = document.getElementById('pagination-next');

    if (text) {
        const from = state.totalCount === 0 ? 0 : state.offset + 1;
        const to = Math.min(state.offset + state.limit, state.totalCount);
        text.textContent = `Mostrando ${from}-${to} de ${state.totalCount}`;
    }

    if (btnPrev) btnPrev.disabled = state.offset === 0;
    if (btnNext) btnNext.disabled = state.offset + state.limit >= state.totalCount;

    if (paginationContainer) {
        const currentPage = Math.floor(state.offset / state.limit) + 1;
        const totalPages = Math.ceil(state.totalCount / state.limit) || 1;
        paginationContainer.innerHTML = '';

        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

        if (start > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.style.padding = '0 0.25rem';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }

        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                state.offset = (i - 1) * state.limit;
                fetchArticles();
            });
            paginationContainer.appendChild(btn);
        }

        if (totalPages > 0 && end < totalPages) {
            const ellipsis = document.createElement('span');
            ellipsis.style.padding = '0 0.25rem';
            ellipsis.textContent = '...';
            paginationContainer.appendChild(ellipsis);
        }
    }
}

function updateBadgeCount() {
    const badge = document.querySelector('.badge-count');
    if (badge) badge.textContent = `${state.totalCount} registros`;
}

function renderList() {
    listContainer.innerHTML = '';

    if (state.loading) {
        listContainer.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Cargando artículos...</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    if (state.error) {
        listContainer.innerHTML = `
            <div class="error-state">
                <i data-lucide="alert-circle" style="width:3rem;height:3rem;color:#dc2626"></i>
                <p><strong>Error al cargar:</strong> ${state.error}</p>
                <button class="btn-retry" id="btn-retry">Reintentar</button>
            </div>
        `;
        document.getElementById('btn-retry')?.addEventListener('click', fetchArticles);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    let itemsToShow = getFilteredItems();

    itemsToShow.forEach(item => {
        const isSelected = selectedIds.includes(item.id);
        const typeIcon = item.type === 'Evento' ? 'calendar' : 'file-text';
        const typeIconClass = item.type === 'Evento' ? 'row-type-icon--evento' : 'row-type-icon--noticia';

        const categoriesHtml = (item.categories || []).map(cat =>
            `<span class="category-pill">${escapeHtml(cat)}</span>`
        ).join('');
        const promotedTag = item.promoted ? '<span class="promo-pill">Promocionado</span>' : '';

        const html = `
            <div data-item-id="${item.id}" class="row-item ${isSelected ? 'selected' : ''}">
                <div class="row-cell-center" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} class="checkbox-cell row-checkbox" data-item-id="${item.id}">
                </div>
                <div style="padding-right:0.5rem">
                    <div class="row-title line-clamp-1" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                    <div class="row-meta">${escapeHtml(item.date)}</div>
                </div>

                <div class="row-type-block">
                    <div class="row-type-label">
                        <i data-lucide="${typeIcon}" class="row-type-icon ${typeIconClass}"></i> ${escapeHtml(item.type)}
                        ${promotedTag}
                    </div>
                    <div class="row-categories">${categoriesHtml}</div>
                </div>

                <div class="row-date">${escapeHtml(item.date)}</div>

                <div class="row-cell-right">
                    <button class="row-edit-btn" title="Editar"><i data-lucide="pencil"></i></button>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', html);
    });

    listContainer.querySelectorAll('[data-item-id]').forEach(el => {
        const id = el.dataset.itemId;
        const item = itemsToShow.find(i => i.id === id);
        el.addEventListener('click', (e) => {
            if (e.target.closest('.row-edit-btn, .row-checkbox, .row-cell-center')) return;
            openEditPanel(id, item);
        });
        el.querySelector('.row-checkbox')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedIds.includes(id)) selectedIds = selectedIds.filter(x => x !== id);
            else selectedIds.push(id);
            renderList();
        });
        el.querySelector('.row-edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditPanel(id, item);
        });
    });

    updateBulkUI(itemsToShow);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateBulkUI(itemsToShow) {
    const ids = itemsToShow.map(i => i.id);
    const checkboxAllHeader = document.getElementById('checkbox-all-header');
    const selectionBadge = document.getElementById('selection-badge');

    if (checkboxAllHeader) {
        checkboxAllHeader.checked = ids.length > 0 && selectedIds.length === ids.length;
        checkboxAllHeader.indeterminate = selectedIds.length > 0 && selectedIds.length < ids.length;
    }
    if (selectionBadge) {
        selectionBadge.textContent = selectedIds.length;
        selectionBadge.classList.toggle('hidden', selectedIds.length === 0);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
