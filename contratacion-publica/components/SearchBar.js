// SearchBar component - Mithril
import m from 'mithril'
import { getState, getCpvState, loadCpvArbol, actualizarFiltro, limpiarFiltros, buscar } from '../hooks/licitaciones.js'

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

function buildCpvOptions() {
  const cpvArbol = getCpvState().tree
  const options = []
  if (cpvArbol && typeof cpvArbol === 'object') {
    Object.entries(cpvArbol).forEach(([codigo, datos]) => {
      options.push({ value: codigo, label: `${codigo} ${datos.name}` })
      if (datos.children) {
        Object.entries(datos.children).forEach(([subCodigo, subDatos]) => {
          options.push({ value: subCodigo, label: `  ${subCodigo} ${subDatos.name}` })
        })
      }
    })
  }
  return options
}

export function SearchBar() {
  loadCpvArbol()

  return {
    view() {
      const state = getState()
      const cpvOptions = buildCpvOptions()

      return m('div.search-bar', [
        m('div.filter-group', [
          m('div.filter-field', [
            m('label.filter-label', 'Organismo'),
            m('input.filter-input', {
              type: 'search',
              placeholder: 'Ayuntamiento, Generalitat...',
              value: state.filtros.contractingparty,
              oninput: (e) => actualizarFiltro('contractingparty', e.target.value),
            }),
          ]),
          m('div.filter-field', [
            m('label.filter-label', 'Empresa'),
            m('input.filter-input', {
              type: 'text',
              placeholder: 'Nombre empresa...',
              value: state.filtros.winningparty,
              oninput: (e) => actualizarFiltro('winningparty', e.target.value),
            }),
          ]),
          m('div.filter-field', [
            m('label.filter-label', 'Desde'),
            m('input.filter-input', {
              type: 'date',
              value: state.filtros.datefrom,
              oninput: (e) => actualizarFiltro('datefrom', e.target.value),
            }),
          ]),
          m('div.filter-field', [
            m('label.filter-label', 'Hasta'),
            m('input.filter-input', {
              type: 'date',
              value: state.filtros.dateto,
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
            }, [
              m('option', { value: '' }, 'Todas'),
              ...cpvOptions.map(opt => m('option', { value: opt.value }, opt.label)),
            ]),
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
            m('button.btn.btn-secondary', {
              onclick: limpiarFiltros,
            }, [
              m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
                m('path', { d: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z' })),
              'Limpiar',
            ]),
            m('button.btn.btn-primary', {
              onclick: buscar,
            }, [
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
}
