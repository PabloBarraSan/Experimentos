function formatCurrency(amount) {
  if (!amount) return '-'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(parseFloat(amount))
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function getStatusLabel(status) {
  const labels = {
    'PUB': 'Publicada',
    'PRE': 'Anuncio Previo',
    'EV': 'Pendiente de Adjudicación',
    'ADJ': 'Adjudicada',
    'RES': 'Resuelta',
    'ANUL': 'Anulada',
    'EN PLAZO': 'En Plazo',
  }
  return labels[status] || status || '-'
}

function getTypeLabel(typecode) {
  const labels = {
    '1': 'Suministros',
    '2': 'Servicios',
    '3': 'Obras',
    '21': 'Gestión de Servicios Públicos',
    '22': 'Concesión de servicios',
    '31': 'Concesión de Obras Públicas',
    '32': 'Concesión de obras',
    '40': 'Colaboración sector público-privado',
    '7': 'Administrativo especial',
    '8': 'Privado',
    '50': 'Patrimonial',
    '999': 'Otros',
  }
  return labels[typecode] || typecode || '-'
}

function getProcedureLabel(code) {
  const labels = {
    '1': 'Urgente',
    '2': 'Urgente',
    '3': 'No urgencia',
    '4': 'No urgencia',
    '5': 'Civil',
    '6': 'Menor',
    '7': 'No abierto',
    '8': 'Abierto',
    '9': 'Negociado',
    '10': 'Diálogo competitivo',
  }
  return labels[code] || code || '-'
}

export function LicitacionModal({ licitacion, onClose }) {
  if (!licitacion) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Detalle de Licitación</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-status-row">
              <span className="modal-status">{getStatusLabel(licitacion.status)}</span>
              <span className="modal-cpv">{licitacion.cpv}</span>
            </div>
            <h3 className="modal-main-title">{licitacion.title || licitacion.summary?.split(';')[0]}</h3>
            <p className="modal-organismo">{licitacion.contractingparty}</p>
          </div>

          {licitacion.summary && (
            <div className="modal-section">
              <h4 className="modal-section-title">Resumen</h4>
              <p className="modal-text">{licitacion.summary}</p>
            </div>
          )}

          <div className="modal-section">
            <h4 className="modal-section-title">Datos Económicos</h4>
            <div className="modal-grid">
              <div className="modal-field">
                <span className="modal-field-label">Presupuesto</span>
                <span className="modal-field-value modal-budget">{formatCurrency(licitacion.budgetamount)}</span>
              </div>
              {licitacion.awardedamount && (
                <div className="modal-field">
                  <span className="modal-field-label">Importe Adjudicación</span>
                  <span className="modal-field-value modal-awarded">{formatCurrency(licitacion.awardedamount)}</span>
                </div>
              )}
              {licitacion.durationmeasure && (
                <div className="modal-field">
                  <span className="modal-field-label">Duración</span>
                  <span className="modal-field-value">
                    {licitacion.durationmeasure} {licitacion.durationmeasureunit === 'MON' ? 'meses' : licitacion.durationmeasureunit === 'ANN' ? 'años' : 'días'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="modal-section">
            <h4 className="modal-section-title">Fechas</h4>
            <div className="modal-grid">
              <div className="modal-field">
                <span className="modal-field-label">Fecha Límite</span>
                <span className="modal-field-value">{formatDate(licitacion.tendersubmissiondeadline)}</span>
              </div>
              {licitacion.issuedate && (
                <div className="modal-field">
                  <span className="modal-field-label">Fecha Publicación</span>
                  <span className="modal-field-value">{formatDate(licitacion.issuedate)}</span>
                </div>
              )}
              {licitacion.awarddate && (
                <div className="modal-field">
                  <span className="modal-field-label">Fecha Adjudicación</span>
                  <span className="modal-field-value">{formatDate(licitacion.awarddate)}</span>
                </div>
              )}
              {licitacion.enddate && (
                <div className="modal-field">
                  <span className="modal-field-label">Fecha Fin</span>
                  <span className="modal-field-value">{formatDate(licitacion.enddate)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="modal-section">
            <h4 className="modal-section-title">Clasificación</h4>
            <div className="modal-grid">
              <div className="modal-field">
                <span className="modal-field-label">Tipo</span>
                <span className="modal-field-value">{getTypeLabel(licitacion.typecode)}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Procedimiento</span>
                <span className="modal-field-value">{getProcedureLabel(licitacion.procedurecode)}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Urgencia</span>
                <span className="modal-field-value">{licitacion.urgencycode === '1' ? 'Urgente' : 'No urgente'}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Financiación</span>
                <span className="modal-field-value">{licitacion.fundingprogram || '-'}</span>
              </div>
            </div>
          </div>

          {licitacion.winningparty && (
            <div className="modal-section">
              <h4 className="modal-section-title">Adjudicatario</h4>
              <p className="modal-adjudicatario">{licitacion.winningparty}</p>
            </div>
          )}

          <div className="modal-section">
            <h4 className="modal-section-title">Identificadores</h4>
            <div className="modal-grid">
              <div className="modal-field">
                <span className="modal-field-label">ID</span>
                <span className="modal-field-value modal-id">{licitacion.id}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">CID</span>
                <span className="modal-field-value modal-id">{licitacion.cid}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">ID Organismo</span>
                <span className="modal-field-value modal-id">{licitacion.contractingpartyid}</span>
              </div>
              <div className="modal-field">
                <span className="modal-field-label">Fuente</span>
                <span className="modal-field-value">{licitacion.sindicacion}</span>
              </div>
            </div>
          </div>

          {licitacion.href && (
            <div className="modal-actions">
              <a
                href={licitacion.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-large"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Ver en Contratación del Estado
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
