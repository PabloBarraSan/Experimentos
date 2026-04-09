// Estado singleton para gestión de licitaciones
// Reemplaza el hook useLicitaciones de React
import { buscarLicitaciones, getPotenciales } from '../services/api.js'
import m from 'mithril'

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
  // Potenciales
  mostrarPotenciales: false,
  potenciales: [],
  loadingPotenciales: false,
  // Modal
  selectedLicitacion: null,
  pagePotenciales: 1,
}

// CPV tree state
const cpvState = {
  tree: {},
  loaded: false,
}

export async function buscar() {
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

export function actualizarFiltro(clave, valor) {
  state.filtros[clave] = valor
  state.page = 1
  buscar()
}

export function cambiarPagina(nuevaPage) {
  state.page = nuevaPage
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function getLicitaciones() {
  const startIndex = (state.page - 1) * LIMIT
  return state.allResults.slice(startIndex, startIndex + LIMIT)
}

export function getTotalPages() {
  return Math.ceil(state.allResults.length / LIMIT)
}

// Potenciales
export async function togglePotenciales() {
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

// Modal
export function openModal(licitacion) {
  state.selectedLicitacion = licitacion
}

export function closeModal() {
  state.selectedLicitacion = null
}

// Limpiar filtros
export function limpiarFiltros() {
  const filtrosVacios = {
    query: '',
    winningparty: '',
    contractingparty: '',
    cpv: '',
    status: '',
    typecode: '',
    datefrom: '',
    dateto: '',
  }
  Object.assign(state.filtros, filtrosVacios)
  state.page = 1
  buscar()
}

// CPV tree
export async function loadCpvArbol() {
  if (cpvState.loaded) return
  try {
    const res = await fetch('https://public.digitalvalue.es/contratacionestado/api.php/cpv/arbol')
    cpvState.tree = await res.json()
    cpvState.loaded = true
  } catch (err) {
    console.error('Error cargando CPV:', err)
  }
}

export function getCpvState() {
  return cpvState
}

export function getState() {
  return state
}

export function getLimit() {
  return LIMIT
}
