import { useState } from 'react'
import { SearchBar } from './components/SearchBar'
import { LicitacionCard } from './components/LicitacionCard'
import { LicitacionModal } from './components/LicitacionModal'
import { useLicitaciones } from './hooks/useLicitaciones'
import { getPotenciales } from './services/api'

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

function App() {
  const { licitaciones, loading, error, filtros, actualizarFiltro, recargar, page, total, limit, cambiarPagina } = useLicitaciones()
  const [mostrarPotenciales, setMostrarPotenciales] = useState(false)
  const [potenciales, setPotenciales] = useState([])
  const [loadingPotenciales, setLoadingPotenciales] = useState(false)
  const [selectedLicitacion, setSelectedLicitacion] = useState(null)
  const [pagePotenciales, setPagePotenciales] = useState(1)

  const handlePotenciales = async () => {
    if (mostrarPotenciales) {
      setMostrarPotenciales(false)
      return
    }
    if (potenciales.length > 0) {
      setMostrarPotenciales(true)
      return
    }
    setLoadingPotenciales(true)
    setMostrarPotenciales(true)
    try {
      const data = await getPotenciales()
      setPotenciales(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPotenciales(false)
    }
  }

  const handleCardClick = (licitacion) => {
    setSelectedLicitacion(licitacion)
  }

  const handleCloseModal = () => {
    setSelectedLicitacion(null)
  }

  const handleLimpiar = () => {
    const filtrosVacios = {
      query: '',
      winningparty: '',
      cpv: '',
      status: '',
      typecode: '',
      datefrom: '',
      dateto: '',
    }
    Object.entries(filtrosVacios).forEach(([clave, valor]) => {
      actualizarFiltro(clave, valor)
    })
  }

  const totalPages = Math.ceil(total / limit)
  const totalPagesPotenciales = Math.ceil(potenciales.length / POTENCIALES_LIMIT)
  const startPotenciales = (pagePotenciales - 1) * POTENCIALES_LIMIT
  const endPotenciales = startPotenciales + POTENCIALES_LIMIT

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div>
              <h1 className="header-title">Buscador de Licitaciones</h1>
              <p className="header-subtitle">Contratación del Sector Público Español</p>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={handlePotenciales} className="btn btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M2 12h20" />
              </svg>
              Potenciales ({potenciales.length || '...'})
            </button>
            <span className="header-badge">Datos públicos</span>
          </div>
        </div>
      </header>

      <main className="main">
        <SearchBar filtros={filtros} onFiltroChange={actualizarFiltro} onBuscar={recargar} onLimpiar={handleLimpiar} />

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!mostrarPotenciales && (
          <>
            {loading ? (
              <div className="loading">
                <div className="loading-spinner" />
                <span>Cargando licitaciones...</span>
              </div>
            ) : (
              <>
                <div className="results-header">
                  <p className="results-count">
                    <strong>{licitaciones.length}</strong> resultados (página {page} de {totalPages || 1})
                  </p>
                </div>

                <div className="licitaciones-grid">
                  {licitaciones.map((l, i) => (
                    <LicitacionCard
                      key={`${l.id}-${l.cid}-${i}`}
                      licitacion={l}
                      onClick={() => handleCardClick(l)}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="btn btn-secondary"
                      onClick={() => cambiarPagina(page - 1)}
                      disabled={page <= 1}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      Anterior
                    </button>
                    <div className="pagination-pages">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (page <= 3) {
                          pageNum = i + 1
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = page - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            className={`pagination-page ${page === pageNum ? 'active' : ''}`}
                            onClick={() => cambiarPagina(pageNum)}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => cambiarPagina(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Siguiente
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                )}

                {licitaciones.length === 0 && !error && (
                  <p className="no-results">No se encontraron licitaciones con los filtros seleccionados</p>
                )}
              </>
            )}
          </>
        )}

        {mostrarPotenciales && (
          <section className="potenciales-section">
            <div className="potenciales-header">
              <h2 className="potenciales-title">Contratos Potenciales</h2>
              <span className="potenciales-badge">{potenciales.length}</span>
            </div>

            {loadingPotenciales ? (
              <div className="loading">
                <div className="loading-spinner" />
                <span>Cargando potenciales...</span>
              </div>
            ) : (
              <>
                <div className="potenciales-grid">
                  {potenciales.slice(startPotenciales, endPotenciales).map((p, i) => (
                    <div
                      key={i}
                      className="potencial-card"
                      onClick={() => handleCardClick(p)}
                    >
                      <div className="potencial-card-header">
                        <span className="potencial-organismo">{p.contractingparty}</span>
                        <span className="potencial-cpv">{p.cpv}</span>
                      </div>
                      <p className="potencial-title">{p.title?.substring(0, 120)}...</p>
                      <div className="potencial-details">
                        <span className="potencial-budget">{formatCurrency(p.budgetamount)}</span>
                        <span className="potencial-deadline">Fecha: {formatDate(p.tendersubmissiondeadline)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPagesPotenciales > 1 && (
                  <div className="pagination">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setPagePotenciales(pagePotenciales - 1)}
                      disabled={pagePotenciales <= 1}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      Anterior
                    </button>
                    <div className="pagination-pages">
                      {Array.from({ length: Math.min(5, totalPagesPotenciales) }, (_, i) => {
                        let pageNum
                        if (totalPagesPotenciales <= 5) {
                          pageNum = i + 1
                        } else if (pagePotenciales <= 3) {
                          pageNum = i + 1
                        } else if (pagePotenciales >= totalPagesPotenciales - 2) {
                          pageNum = totalPagesPotenciales - 4 + i
                        } else {
                          pageNum = pagePotenciales - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            className={`pagination-page ${pagePotenciales === pageNum ? 'active' : ''}`}
                            onClick={() => setPagePotenciales(pageNum)}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setPagePotenciales(pagePotenciales + 1)}
                      disabled={pagePotenciales >= totalPagesPotenciales}
                    >
                      Siguiente
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      {selectedLicitacion && (
        <LicitacionModal licitacion={selectedLicitacion} onClose={handleCloseModal} />
      )}
    </div>
  )
}

export default App
