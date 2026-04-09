// App principal - Mithril
import m from 'mithril'

// ============================================================================
// API
// ============================================================================

const BASE_URL = 'https://public.digitalvalue.es/contratacionestado/api.php'

async function getPotenciales() {
  const res = await fetch(`${BASE_URL}/potenciales`)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function buscarLicitaciones(params = {}) {
  const queryParts = []
  if (params.query) queryParts.push(`query=${encodeURIComponent(params.query)}`)
  if (params.winningparty) queryParts.push(`winningparty=${encodeURIComponent(params.winningparty)}`)
  if (params.contractingparty) queryParts.push(`contractingparty=${encodeURIComponent(params.contractingparty)}`)
  if (params.cpv) queryParts.push(`cpv=${params.cpv}`)
  if (params.status) queryParts.push(`status=${params.status}`)
  if (params.typecode) queryParts.push(`typecode=${params.typecode}`)
  if (params.datefrom) queryParts.push(`datefrom=${params.datefrom}`)
  if (params.dateto) queryParts.push(`dateto=${params.dateto}`)

  const queryString = queryParts.join('&')
  const url = `${BASE_URL}/buscar${queryString ? '?' + queryString : ''}`
  const res = await fetch(url)
  const text = await res.text()

  try {
    return JSON.parse(text)
  } catch {
    if (text.includes('DEBE INDICAR') || text.includes('error')) {
      throw new Error(text.substring(0, 200))
    }
    if (text.startsWith('[')) return JSON.parse(text)
    return []
  }
}

// ============================================================================
// Estado
// ============================================================================

const LIMIT = 20

const state = {
  allResults: [],
  loading: false,
  error: null,
  page: 1,
  filtros: {
    query: '',
    winningparty: '',
    contractingparty: '',
    cpv: '',
    status: '',
    typecode: '',
    datefrom: '',
    dateto: '',
  },
  mostrarPotenciales: false,
  potenciales: [],
  loadingPotenciales: false,
  selectedLicitacion: null,
  pagePotenciales: 1,
}

const cpvState = { tree: {}, loaded: false }

// ============================================================================
// Acciones
// ============================================================================

async function buscar() {
  state.loading = true
  state.error = null
  m.redraw()
  try {
    const data = await buscarLicitaciones(state.filtros)
    state.allResults = Array.isArray(data) ? data : []
    state.page = 1
  } catch (err) {
    if (err.message.includes('DEBE INDICAR')) {
      state.error = 'Indica al menos un filtro para buscar'
      state.allResults = []
    } else {
      state.error = err.message
    }
  } finally {
    state.loading = false
    m.redraw()
  }
}

function actualizarFiltro(clave, valor) {
  state.filtros[clave] = valor
  state.page = 1
  buscar()
}

function cambiarPagina(nuevaPage) {
  state.page = nuevaPage
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getLicitaciones() {
  const startIndex = (state.page - 1) * LIMIT
  return state.allResults.slice(startIndex, startIndex + LIMIT)
}

function getTotalPages() {
  return Math.ceil(state.allResults.length / LIMIT)
}

async function togglePotenciales() {
  if (state.mostrarPotenciales) {
    state.mostrarPotenciales = false
    return
  }
  if (state.potenciales.length > 0) {
    state.mostrarPotenciales = true
    return
  }
  state.loadingPotenciales = true
  state.mostrarPotenciales = true
  m.redraw()
  try {
    const data = await getPotenciales()
    state.potenciales = Array.isArray(data) ? data : []
  } catch (err) {
    console.error(err)
  } finally {
    state.loadingPotenciales = false
    m.redraw()
  }
}

function openModal(licitacion) {
  state.selectedLicitacion = licitacion
}

function closeModal() {
  state.selectedLicitacion = null
}

function limpiarFiltros() {
  Object.assign(state.filtros, {
    query: '',
    winningparty: '',
    contractingparty: '',
    cpv: '',
    status: '',
    typecode: '',
    datefrom: '',
    dateto: '',
  })
  state.page = 1
  buscar()
}

async function loadCpvArbol() {
  if (cpvState.loaded) return
  try {
    const res = await fetch(`${BASE_URL}/cpv/arbol`)
    cpvState.tree = await res.json()
    cpvState.loaded = true
  } catch (err) {
    console.error('Error cargando CPV:', err)
  }
}

// ============================================================================
// Constantes
// ============================================================================

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'PRE', label: 'Anuncio Previo' },
  { value: 'PUB', label: 'En plazo' },
  { value: 'EV', label: 'Pendiente Adjudicación' },
  { value: 'ADJ', label: 'Adjudicada' },
  { value: 'RES', label: 'Resuelta' },
  { value: 'ANUL', label: 'Anulada' },
]

const TIPOS = [
  { value: '', label: 'Todos' },
  { value: '1', label: 'Suministros' },
  { value: '2', label: 'Servicios' },
  { value: '3', label: 'Obras' },
  { value: '21', label: 'Gestión Servicios' },
  { value: '22', label: 'Concesión Servicios' },
  { value: '31', label: 'Concesión Obras' },
  { value: '32', label: 'Conces. Obras Públ.' },
  { value: '40', label: 'Colaboración' },
  { value: '7', label: 'Administrativo' },
  { value: '8', label: 'Privado' },
  { value: '50', label: 'Patrimonial' },
  { value: '999', label: 'Otros' },
]

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount) {
  if (!amount) return '-'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount))
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

function formatDateFull(dateStr) {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function getStatusClass(status) {
  switch (status) {
    case 'PUB': return 'card-status--pub'
    case 'RES': return 'card-status--res'
    case 'PRE': return 'card-status--pre'
    case 'ADJ': return 'card-status--adj'
    case 'EV': return 'card-status--ev'
    case 'ANUL': return 'card-status--anul'
    default: return ''
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'PUB': return 'En plazo'
    case 'RES': return 'Resuelta'
    case 'PRE': return 'Anuncio Previo'
    case 'ADJ': return 'Adjudicada'
    case 'EV': return 'Pendiente'
    case 'ANUL': return 'Anulada'
    case 'EN PLAZO': return 'En Plazo'
    default: return status
  }
}

function getStatusLabelFull(status) {
  const labels = {
    'PUB': 'Publicada', 'PRE': 'Anuncio Previo', 'EV': 'Pendiente de Adjudicación',
    'ADJ': 'Adjudicada', 'RES': 'Resuelta', 'ANUL': 'Anulada', 'EN PLAZO': 'En Plazo',
  }
  return labels[status] || status || '-'
}

function getTypeLabel(typecode) {
  const labels = {
    '1': 'Suministros', '2': 'Servicios', '3': 'Obras',
    '21': 'Gestión de Servicios Públicos', '22': 'Concesión de servicios',
    '31': 'Concesión de Obras Públicas', '32': 'Concesión de obras',
    '40': 'Colaboración sector público-privado', '7': 'Administrativo especial',
    '8': 'Privado', '50': 'Patrimonial', '999': 'Otros',
  }
  return labels[typecode] || typecode || '-'
}

function getProcedureLabel(code) {
  const labels = {
    '1': 'Urgente', '2': 'Urgente', '3': 'No urgencia', '4': 'No urgencia',
    '5': 'Civil', '6': 'Menor', '7': 'No abierto', '8': 'Abierto',
    '9': 'Negociado', '10': 'Diálogo competitivo',
  }
  return labels[code] || code || '-'
}

// ============================================================================
// Componentes
// ============================================================================

// SearchBar
const SearchBar = {
  oninit() {
    loadCpvArbol()
  },
  view() {
    const cpvOptions = []
    if (cpvState.tree && typeof cpvState.tree === 'object') {
      Object.entries(cpvState.tree).forEach(([codigo, datos]) => {
        cpvOptions.push({ value: codigo, label: `${codigo} ${datos.name}` })
        if (datos.children) {
          Object.entries(datos.children).forEach(([subCodigo, subDatos]) => {
            cpvOptions.push({ value: subCodigo, label: `  ${subCodigo} ${subDatos.name}` })
          })
        }
      })
    }

    return m('div.search-bar', [
      m('div.filter-group', [
        m('div.filter-field', [
          m('label.filter-label', 'Organismo'),
          m('input.filter-input', {
            type: 'search', placeholder: 'Ayuntamiento, Generalitat...',
            value: state.filtros.contractingparty,
            oninput: (e) => actualizarFiltro('contractingparty', e.target.value),
          }),
        ]),
        m('div.filter-field', [
          m('label.filter-label', 'Empresa'),
          m('input.filter-input', {
            type: 'text', placeholder: 'Nombre empresa...',
            value: state.filtros.winningparty,
            oninput: (e) => actualizarFiltro('winningparty', e.target.value),
          }),
        ]),
        m('div.filter-field', [
          m('label.filter-label', 'Desde'),
          m('input.filter-input', {
            type: 'date', value: state.filtros.datefrom,
            oninput: (e) => actualizarFiltro('datefrom', e.target.value),
          }),
        ]),
        m('div.filter-field', [
          m('label.filter-label', 'Hasta'),
          m('input.filter-input', {
            type: 'date', value: state.filtros.dateto,
            oninput: (e) => actualizarFiltro('dateto', e.target.value),
          }),
        ]),
      ]),
      m('div.filter-group', [
        m('div.filter-field', [
          m('label.filter-label', 'Categoría CPV'),
          m('select.filter-select', {
            value: state.filtros.cpv,
            onchange: (e) => actualizarFiltro('cpv', e.target.value),
          }, [m('option', { value: '' }, 'Todas'),
            ...cpvOptions.map(opt => m('option', { value: opt.value }, opt.label))]),
        ]),
        m('div.filter-field', [
          m('label.filter-label', 'Estado'),
          m('select.filter-select', {
            value: state.filtros.status,
            onchange: (e) => actualizarFiltro('status', e.target.value),
          }, ESTADOS.map(s => m('option', { value: s.value }, s.label))),
        ]),
        m('div.filter-field', [
          m('label.filter-label', 'Tipo'),
          m('select.filter-select', {
            value: state.filtros.typecode,
            onchange: (e) => actualizarFiltro('typecode', e.target.value),
          }, TIPOS.map(t => m('option', { value: t.value }, t.label))),
        ]),
        m('div.btn-group', [
          m('button.btn.btn-secondary', { onclick: limpiarFiltros }, [
            m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
              m('path', { d: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z' })),
            'Limpiar',
          ]),
          m('button.btn.btn-primary', { onclick: buscar }, [
            m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
              m('circle', { cx: 11, cy: 11, r: 8 }),
              m('path', { d: 'm21 21-4.35-4.35' })),
            'Buscar',
          ]),
        ]),
      ]),
    ])
  },
}

// LicitacionCard
const LicitacionCard = {
  view({ attrs }) {
    const { licitacion, onclick } = attrs
    return m('article.licitacion-card', { onclick, style: { cursor: 'pointer' } }, [
      m('div.card-header', [
        m('span', { class: `card-status ${getStatusClass(licitacion.status)}` }, [
          m('span.card-status-dot'),
          getStatusLabel(licitacion.status),
        ]),
        m('span.card-cpv', licitacion.cpv),
      ]),
      m('h3.card-title', licitacion.title || licitacion.summary?.split(';')[0] || 'Sin título'),
      m('p.card-organismo', licitacion.contractingparty || 'Organismo no especificado'),
      m('div.card-details', [
        m('div.card-detail', [
          m('span.card-detail-label', 'Presupuesto'),
          m('span.card-detail-value', formatCurrency(licitacion.budgetamount)),
        ]),
        licitacion.awardedamount ? m('div.card-detail', [
          m('span.card-detail-label', 'Adjudicación'),
          m('span.card-detail-value.card-detail-value--accent', formatCurrency(licitacion.awardedamount)),
        ]) : null,
        m('div.card-detail', [
          m('span.card-detail-label', 'Fecha límite'),
          m('span.card-detail-value', formatDate(licitacion.tendersubmissiondeadline || licitacion.enddate)),
        ]),
        licitacion.typecode ? m('div.card-detail', [
          m('span.card-detail-label', 'Tipo'),
          m('span.card-detail-value', licitacion.typecode === '1' ? 'Suministro' : licitacion.typecode === '2' ? 'Servicios' : licitacion.typecode === '3' ? 'Obras' : 'Otro'),
        ]) : null,
      ]),
      licitacion.winningparty ? m('p.card-adjudicatario', ['Adjudicatario: ', m('strong', licitacion.winningparty)]) : null,
    ])
  },
}

// LicitacionModal
const LicitacionModal = {
  view({ attrs }) {
    const { licitacion, onclose } = attrs
    if (!licitacion) return null

    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) onclose()
    }

    return m('div.modal-backdrop', { onclick: handleBackdropClick }, [
      m('div.modal-panel', { onclick: (e) => e.stopPropagation() }, [
        m('div.modal-header', [
          m('h2.modal-title', 'Detalle de Licitación'),
          m('button.modal-close', { onclick: onclose }, [
            m('svg[width=24][height=24][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
              m('path', { d: 'M18 6L6 18M6 6l12 12' })),
          ]),
        ]),
        m('div.modal-body', [
          m('div.modal-section', [
            m('div.modal-status-row', [
              m('span.modal-status', getStatusLabelFull(licitacion.status)),
              m('span.modal-cpv', licitacion.cpv),
            ]),
            m('h3.modal-main-title', licitacion.title || licitacion.summary?.split(';')[0]),
            m('p.modal-organismo', licitacion.contractingparty),
          ]),
          licitacion.summary ? m('div.modal-section', [
            m('h4.modal-section-title', 'Resumen'),
            m('p.modal-text', licitacion.summary),
          ]) : null,
          m('div.modal-section', [
            m('h4.modal-section-title', 'Datos Económicos'),
            m('div.modal-grid', [
              m('div.modal-field', [
                m('span.modal-field-label', 'Presupuesto'),
                m('span.modal-field-value.modal-budget', formatCurrency(licitacion.budgetamount)),
              ]),
              licitacion.awardedamount ? m('div.modal-field', [
                m('span.modal-field-label', 'Importe Adjudicación'),
                m('span.modal-field-value.modal-awarded', formatCurrency(licitacion.awardedamount)),
              ]) : null,
              licitacion.durationmeasure ? m('div.modal-field', [
                m('span.modal-field-label', 'Duración'),
                m('span.modal-field-value', `${licitacion.durationmeasure} ${licitacion.durationmeasureunit === 'MON' ? 'meses' : licitacion.durationmeasureunit === 'ANN' ? 'años' : 'días'}`),
              ]) : null,
            ]),
          ]),
          m('div.modal-section', [
            m('h4.modal-section-title', 'Fechas'),
            m('div.modal-grid', [
              m('div.modal-field', [
                m('span.modal-field-label', 'Fecha Límite'),
                m('span.modal-field-value', formatDateFull(licitacion.tendersubmissiondeadline)),
              ]),
              licitacion.issuedate ? m('div.modal-field', [
                m('span.modal-field-label', 'Fecha Publicación'),
                m('span.modal-field-value', formatDateFull(licitacion.issuedate)),
              ]) : null,
              licitacion.awarddate ? m('div.modal-field', [
                m('span.modal-field-label', 'Fecha Adjudicación'),
                m('span.modal-field-value', formatDateFull(licitacion.awarddate)),
              ]) : null,
              licitacion.enddate ? m('div.modal-field', [
                m('span.modal-field-label', 'Fecha Fin'),
                m('span.modal-field-value', formatDateFull(licitacion.enddate)),
              ]) : null,
            ]),
          ]),
          m('div.modal-section', [
            m('h4.modal-section-title', 'Clasificación'),
            m('div.modal-grid', [
              m('div.modal-field', [
                m('span.modal-field-label', 'Tipo'),
                m('span.modal-field-value', getTypeLabel(licitacion.typecode)),
              ]),
              m('div.modal-field', [
                m('span.modal-field-label', 'Procedimiento'),
                m('span.modal-field-value', getProcedureLabel(licitacion.procedurecode)),
              ]),
              m('div.modal-field', [
                m('span.modal-field-label', 'Urgencia'),
                m('span.modal-field-value', licitacion.urgencycode === '1' ? 'Urgente' : 'No urgente'),
              ]),
              m('div.modal-field', [
                m('span.modal-field-label', 'Financiación'),
                m('span.modal-field-value', licitacion.fundingprogram || '-'),
              ]),
            ]),
          ]),
          licitacion.winningparty ? m('div.modal-section', [
            m('h4.modal-section-title', 'Adjudicatario'),
            m('p.modal-adjudicatario', licitacion.winningparty),
          ]) : null,
          m('div.modal-section', [
            m('h4.modal-section-title', 'Identificadores'),
            m('div.modal-grid', [
              m('div.modal-field', [
                m('span.modal-field-label', 'ID'),
                m('span.modal-field-value.modal-id', licitacion.id),
              ]),
              m('div.modal-field', [
                m('span.modal-field-label', 'CID'),
                m('span.modal-field-value.modal-id', licitacion.cid),
              ]),
              m('div.modal-field', [
                m('span.modal-field-label', 'ID Organismo'),
                m('span.modal-field-value.modal-id', licitacion.contractingpartyid),
              ]),
              m('div.modal-field', [
                m('span.modal-field-label', 'Fuente'),
                m('span.modal-field-value', licitacion.sindicacion),
              ]),
            ]),
          ]),
          licitacion.href ? m('div.modal-actions', [
            m('a.btn.btn-primary.btn-large', {
              href: licitacion.href, target: '_blank', rel: 'noopener noreferrer',
            }, [
              m('svg[width=18][height=18][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
                m('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
                m('polyline', { points: '15 3 21 3 21 9' }),
                m('line', { x1: 10, y1: 14, x2: 21, y2: 3 })),
              'Ver en Contratación del Estado',
            ]),
          ]) : null,
        ]),
      ]),
    ])
  },
}

// Pagination
const Pagination = {
  view({ attrs }) {
    const { page, totalPages, onPrev, onNext, onPage } = attrs
    if (totalPages <= 1) return null

    const pages = []
    for (let i = 0; i < Math.min(5, totalPages); i++) {
      let pageNum
      if (totalPages <= 5) pageNum = i + 1
      else if (page <= 3) pageNum = i + 1
      else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
      else pageNum = page - 2 + i
      pages.push(pageNum)
    }

    return m('div.pagination', [
      m('button.btn.btn-secondary', { onclick: onPrev, disabled: page <= 1 }, [
        m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
          m('path', { d: 'M15 18l-6-6 6-6' })),
        'Anterior',
      ]),
      m('div.pagination-pages',
        pages.map(p => m('button', {
          class: `pagination-page ${page === p ? 'active' : ''}`,
          onclick: () => onPage(p),
        }, p))
      ),
      m('button.btn.btn-secondary', { onclick: onNext, disabled: page >= totalPages }, [
        'Siguiente',
        m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
          m('path', { d: 'M9 18l6-6-6-6' })),
      ]),
    ])
  },
}

// ============================================================================
// App principal
// ============================================================================

const App = {
  view() {
    const licitaciones = getLicitaciones()
    const totalPages = getTotalPages()
    const totalPagesPotenciales = Math.ceil(state.potenciales.length / 20)
    const startPotenciales = (state.pagePotenciales - 1) * 20
    const endPotenciales = startPotenciales + 20

    return m('div.app', [
      m('header.header', [
        m('div.header-inner', [
          m('div.header-brand', [
            m('div.header-icon', [
              m('svg[width=24][height=24][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
                m('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
                m('path', { d: 'M14 2v6h6' }),
                m('path', { d: 'M16 13H8M16 17H8M10 9H8' })),
            ]),
            m('div', [
              m('h1.header-title', 'Buscador de Licitaciones'),
              m('p.header-subtitle', 'Contratación del Sector Público Español'),
            ]),
          ]),
          m('div.header-actions', [
            m('button.btn.btn-secondary', { onclick: togglePotenciales }, [
              m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
                m('path', { d: 'M12 2v20M2 12h20' })),
              `Potenciales (${state.potenciales.length || '...'})`,
            ]),
            m('span.header-badge', 'Datos públicos'),
          ]),
        ]),
      ]),

      m('main.main', [
        m(SearchBar),

        state.error ? m('div.error-message', state.error) : null,

        !state.mostrarPotenciales ? [
          state.loading ? m('div.loading', [
            m('div.loading-spinner'),
            m('span', 'Cargando licitaciones...'),
          ]) : [
            m('div.results-header', [
              m('p.results-count', [
                m('strong', licitaciones.length),
                ` resultados (página ${state.page} de ${totalPages || 1})`,
              ]),
            ]),
            m('div.licitaciones-grid',
              licitaciones.map((l, i) =>
                m(LicitacionCard, { key: `${l.id}-${l.cid}-${i}`, licitacion: l, onclick: () => openModal(l) })
              )
            ),
            totalPages > 1 ? m(Pagination, {
              page: state.page, totalPages,
              onPrev: () => cambiarPagina(state.page - 1),
              onNext: () => cambiarPagina(state.page + 1),
              onPage: cambiarPagina,
            }) : null,
            licitaciones.length === 0 && !state.error
              ? m('p.no-results', 'No se encontraron licitaciones con los filtros seleccionados')
              : null,
          ],
        ] : null,

        state.mostrarPotenciales ? m('section.potenciales-section', [
          m('div.potenciales-header', [
            m('h2.potenciales-title', 'Contratos Potenciales'),
            m('span.potenciales-badge', state.potenciales.length),
          ]),
          state.loadingPotenciales ? m('div.loading', [
            m('div.loading-spinner'),
            m('span', 'Cargando potenciales...'),
          ]) : [
            m('div.potenciales-grid',
              state.potenciales.slice(startPotenciales, endPotenciales).map((p, i) =>
                m('div.potencial-card', { key: i, onclick: () => openModal(p) }, [
                  m('div.potencial-card-header', [
                    m('span.potencial-organismo', p.contractingparty),
                    m('span.potencial-cpv', p.cpv),
                  ]),
                  m('p.potencial-title', (p.title || '').substring(0, 120) + '...'),
                  m('div.potencial-details', [
                    m('span.potencial-budget', formatCurrency(p.budgetamount)),
                    m('span.potencial-deadline', `Fecha: ${formatDate(p.tendersubmissiondeadline)}`),
                  ]),
                ])
              )
            ),
            totalPagesPotenciales > 1 ? m(Pagination, {
              page: state.pagePotenciales, totalPages: totalPagesPotenciales,
              onPrev: () => { state.pagePotenciales-- },
              onNext: () => { state.pagePotenciales++ },
              onPage: (p) => { state.pagePotenciales = p },
            }) : null,
          ],
        ]) : null,
      ]),

      state.selectedLicitacion
        ? m(LicitacionModal, { licitacion: state.selectedLicitacion, onclose: closeModal })
        : null,
    ])
  },
}

m.mount(document.getElementById('root'), App)
