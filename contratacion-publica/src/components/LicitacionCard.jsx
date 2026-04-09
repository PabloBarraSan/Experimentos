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

export function LicitacionCard({ licitacion, onClick }) {
  return (
    <article className="licitacion-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <span className={`card-status ${getStatusClass(licitacion.status)}`}>
          <span className="card-status-dot" />
          {getStatusLabel(licitacion.status)}
        </span>
        <span className="card-cpv">{licitacion.cpv}</span>
      </div>

      <h3 className="card-title">
        {licitacion.title || licitacion.summary?.split(';')[0] || 'Sin título'}
      </h3>

      <p className="card-organismo">
        {licitacion.contractingparty || 'Organismo no especificado'}
      </p>

      <div className="card-details">
        <div className="card-detail">
          <span className="card-detail-label">Presupuesto</span>
          <span className="card-detail-value">
            {formatCurrency(licitacion.budgetamount)}
          </span>
        </div>
        {licitacion.awardedamount && (
          <div className="card-detail">
            <span className="card-detail-label">Adjudicación</span>
            <span className="card-detail-value card-detail-value--accent">
              {formatCurrency(licitacion.awardedamount)}
            </span>
          </div>
        )}
        <div className="card-detail">
          <span className="card-detail-label">Fecha límite</span>
          <span className="card-detail-value">
            {formatDate(licitacion.tendersubmissiondeadline)}
          </span>
        </div>
        {licitacion.typecode && (
          <div className="card-detail">
            <span className="card-detail-label">Tipo</span>
            <span className="card-detail-value">
              {licitacion.typecode === '1' ? 'Suministro' :
               licitacion.typecode === '2' ? 'Servicios' :
               licitacion.typecode === '3' ? 'Obras' : 'Otro'}
            </span>
          </div>
        )}
      </div>

      {licitacion.winningparty && (
        <p className="card-adjudicatario">
          Adjudicatario: <strong>{licitacion.winningparty}</strong>
        </p>
      )}
    </article>
  )
}
