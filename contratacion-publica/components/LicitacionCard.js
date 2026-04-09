// LicitacionCard component - Mithril
import m from 'mithril'

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

export function LicitacionCard() {
  return {
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
          licitacion.awardedamount
            ? m('div.card-detail', [
                m('span.card-detail-label', 'Adjudicación'),
                m('span.card-detail-value.card-detail-value--accent', formatCurrency(licitacion.awardedamount)),
              ])
            : null,
          m('div.card-detail', [
            m('span.card-detail-label', 'Fecha límite'),
            m('span.card-detail-value', formatDate(licitacion.tendersubmissiondeadline || licitacion.enddate)),
          ]),
          licitacion.typecode
            ? m('div.card-detail', [
                m('span.card-detail-label', 'Tipo'),
                m('span.card-detail-value', licitacion.typecode === '1' ? 'Suministro' : licitacion.typecode === '2' ? 'Servicios' : licitacion.typecode === '3' ? 'Obras' : 'Otro'),
              ])
            : null,
        ]),

        licitacion.winningparty
          ? m('p.card-adjudicatario', ['Adjudicatario: ', m('strong', licitacion.winningparty)])
          : null,
      ])
    },
  }
}
