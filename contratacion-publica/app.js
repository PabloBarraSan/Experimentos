// App principal - Mithril
import m from 'mithril'
import { SearchBar } from './components/SearchBar.js'
import { LicitacionCard } from './components/LicitacionCard.js'
import { LicitacionModal } from './components/LicitacionModal.js'
import { Pagination } from './components/Pagination.js'
import {
  getState,
  getLicitaciones,
  getTotalPages,
  getLimit,
  cambiarPagina,
  togglePotenciales,
  openModal,
  closeModal,
  buscar,
} from './hooks/licitaciones.js'

const POTENCIALES_LIMIT = 20

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

// App root component
const App = {
  view() {
    const state = getState()
    const licitaciones = getLicitaciones()
    const totalPages = getTotalPages()
    const limit = getLimit()

    const totalPagesPotenciales = Math.ceil(state.potenciales.length / POTENCIALES_LIMIT)
    const startPotenciales = (state.pagePotenciales - 1) * POTENCIALES_LIMIT
    const endPotenciales = startPotenciales + POTENCIALES_LIMIT

    return m('div.app', [
      // Header
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

      // Main content
      m('main.main', [
        m(SearchBar),

        state.error
          ? m('div.error-message', state.error)
          : null,

        !state.mostrarPotenciales
          ? [
              state.loading
                ? m('div.loading', [
                    m('div.loading-spinner'),
                    m('span', 'Cargando licitaciones...'),
                  ])
                : [
                    m('div.results-header', [
                      m('p.results-count', [
                        m('strong', licitaciones.length),
                        ` resultados (página ${state.page} de ${totalPages || 1})`,
                      ]),
                    ]),

                    m('div.licitaciones-grid',
                      licitaciones.map((l, i) =>
                        m(LicitacionCard, {
                          key: `${l.id}-${l.cid}-${i}`,
                          licitacion: l,
                          onclick: () => openModal(l),
                        })
                      )
                    ),

                    totalPages > 1
                      ? m(Pagination, {
                          page: state.page,
                          totalPages,
                          onPrev: () => cambiarPagina(state.page - 1),
                          onNext: () => cambiarPagina(state.page + 1),
                          onPage: cambiarPagina,
                        })
                      : null,

                    licitaciones.length === 0 && !state.error
                      ? m('p.no-results', 'No se encontraron licitaciones con los filtros seleccionados')
                      : null,
                  ],
            ]
          : null,

        state.mostrarPotenciales
          ? m('section.potenciales-section', [
              m('div.potenciales-header', [
                m('h2.potenciales-title', 'Contratos Potenciales'),
                m('span.potenciales-badge', state.potenciales.length),
              ]),

              state.loadingPotenciales
                ? m('div.loading', [
                    m('div.loading-spinner'),
                    m('span', 'Cargando potenciales...'),
                  ])
                : [
                    m('div.potenciales-grid',
                      state.potenciales.slice(startPotenciales, endPotenciales).map((p, i) =>
                        m('div.potencial-card', {
                          key: i,
                          onclick: () => openModal(p),
                        }, [
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

                    totalPagesPotenciales > 1
                      ? m(Pagination, {
                          page: state.pagePotenciales,
                          totalPages: totalPagesPotenciales,
                          onPrev: () => { state.pagePotenciales-- },
                          onNext: () => { state.pagePotenciales++ },
                          onPage: (p) => { state.pagePotenciales = p },
                        })
                      : null,
                  ],
            ])
          : null,
      ]),

      // Modal
      state.selectedLicitacion
        ? m(LicitacionModal, {
            licitacion: state.selectedLicitacion,
            onclose: closeModal,
          })
        : null,
    ])
  },
}

// Mount the app
m.mount(document.getElementById('root'), App)
