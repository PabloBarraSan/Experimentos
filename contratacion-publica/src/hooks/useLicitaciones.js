import { useState, useEffect, useCallback, useRef } from 'react'
import { buscarLicitaciones, getCpvArbol } from '../services/api'

const LIMIT = 20

/**
 * Hook para gestionar la búsqueda y estado de licitaciones
 */
export function useLicitaciones() {
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const filtrosRef = useRef({
    query: '',
    winningparty: '',
    cpv: '300',
    status: '',
    typecode: '',
    datefrom: '',
    dateto: '',
  })
  const [filtros, setFiltrosState] = useState(filtrosRef.current)

  const buscar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await buscarLicitaciones(filtrosRef.current)
      setAllResults(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err.message.includes('DEBE INDICAR')) {
        setError('Indica al menos un filtro para buscar')
        setAllResults([])
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Paginación en cliente
  const total = allResults.length
  const startIndex = (page - 1) * LIMIT
  const licitaciones = allResults.slice(startIndex, startIndex + LIMIT)

  useEffect(() => {
    buscar()
  }, [buscar])

  const actualizarFiltro = useCallback((clave, valor) => {
    filtrosRef.current = { ...filtrosRef.current, [clave]: valor }
    setFiltrosState({ ...filtrosRef.current })
    setPage(1) // Reset a página 1 al cambiar filtros
  }, [])

  const cambiarPagina = useCallback((nuevaPage) => {
    setPage(nuevaPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    licitaciones,
    loading,
    error,
    filtros,
    actualizarFiltro,
    recargar: buscar,
    page,
    total,
    limit: LIMIT,
    cambiarPagina,
  }
}

/**
 * Hook para cargar el árbol CPV (solo una vez)
 */
export function useCpvArbol() {
  const [cpvArbol, setCpvArbol] = useState({})
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    getCpvArbol().then(setCpvArbol)
  }, [])

  return { cpvArbol }
}
