// Servicio API - Contratación Pública
// Base: https://public.digitalvalue.es/contratacionestado/api.php

const BASE_URL = 'https://public.digitalvalue.es/contratacionestado/api.php'

/**
 * Obtiene las fuentes de datos disponibles
 * @returns {Promise<Array>} Lista de fuentes con cuenta y sindicaction
 */
export async function getFuentes() {
  const res = await fetch(`${BASE_URL}/potenciales`)
  return res.json()
}

/**
 * Obtiene contratos potenciales para la empresa
 * @returns {Promise<Array>} Lista de licitaciones potenciales
 */
export async function getPotenciales() {
  const res = await fetch(`${BASE_URL}/potenciales`)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return []
  }
}

/**
 * Obtiene el árbol de categorías CPV
 * @returns {Promise<Object>} Árbol de códigos CPV
 */
export async function getCpvArbol() {
  const res = await fetch(`${BASE_URL}/cpv/arbol`)
  return res.json()
}

/**
 * Cuenta licitaciones por fuente
 * @returns {Promise<Array>} Contador por sindicaction
 */
export async function getContar() {
  const res = await fetch(`${BASE_URL}/contar`)
  return res.json()
}

/**
 * Busca licitaciones con filtros
 * @param {Object} params - Parámetros de búsqueda
 * @param {string} [params.query] - Término de búsqueda libre
 * @param {string} [params.winningparty] - Empresa adjudicataria
 * @param {string} [params.cpv] - Código CPV
 * @param {string} [params.status] - Estado de la licencia
 * @param {string} [params.typecode] - Tipo de contrato
 * @param {string} [params.datefrom] - Fecha desde (yyyy-mm-dd)
 * @param {string} [params.dateto] - Fecha hasta (yyyy-mm-dd)
 * @returns {Promise<Array>} Lista de licitaciones
 */
export async function buscarLicitaciones(params = {}) {
  const searchParams = new URLSearchParams()

  if (params.query) searchParams.set('query', params.query)
  if (params.winningparty) searchParams.set('winningparty', params.winningparty)
  if (params.cpv) searchParams.set('cpv', params.cpv)
  if (params.status) searchParams.set('status', params.status)
  if (params.typecode) searchParams.set('typecode', params.typecode)
  if (params.datefrom) searchParams.set('datefrom', params.datefrom)
  if (params.dateto) searchParams.set('dateto', params.dateto)

  const url = `${BASE_URL}/buscar${searchParams.toString() ? '?' + searchParams.toString() : ''}`
  const res = await fetch(url)
  const text = await res.text()

  // La API devuelve texto de error en lugar de JSON a veces
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
