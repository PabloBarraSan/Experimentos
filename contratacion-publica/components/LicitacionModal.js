// LicitacionModal component - Mithril
import m from 'mithril'

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

export function LicitacionModal() {
  return {
    view({ attrs }) {
      const { licitacion, onclose } = attrs

      if (!licitacion) return null

      const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
          onclose()
        }
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
                m('span.modal-status', getStatusLabel(licitacion.status)),
                m('span.modal-cpv', licitacion.cpv),
              ]),
              m('h3.modal-main-title', licitacion.title || licitacion.summary?.split(';')[0]),
              m('p.modal-organismo', licitacion.contractingparty),
            ]),

            licitacion.summary
              ? m('div.modal-section', [
                  m('h4.modal-section-title', 'Resumen'),
                  m('p.modal-text', licitacion.summary),
                ])
              : null,

            m('div.modal-section', [
              m('h4.modal-section-title', 'Datos Económicos'),
              m('div.modal-grid', [
                m('div.modal-field', [
                  m('span.modal-field-label', 'Presupuesto'),
                  m('span.modal-field-value.modal-budget', formatCurrency(licitacion.budgetamount)),
                ]),
                licitacion.awardedamount
                  ? m('div.modal-field', [
                      m('span.modal-field-label', 'Importe Adjudicación'),
                      m('span.modal-field-value.modal-awarded', formatCurrency(licitacion.awardedamount)),
                    ])
                  : null,
                licitacion.durationmeasure
                  ? m('div.modal-field', [
                      m('span.modal-field-label', 'Duración'),
                      m('span.modal-field-value', `${licitacion.durationmeasure} ${licitacion.durationmeasureunit === 'MON' ? 'meses' : licitacion.durationmeasureunit === 'ANN' ? 'años' : 'días'}`),
                    ])
                  : null,
              ]),
            ]),

            m('div.modal-section', [
              m('h4.modal-section-title', 'Fechas'),
              m('div.modal-grid', [
                m('div.modal-field', [
                  m('span.modal-field-label', 'Fecha Límite'),
                  m('span.modal-field-value', formatDate(licitacion.tendersubmissiondeadline)),
                ]),
                licitacion.issuedate
                  ? m('div.modal-field', [
                      m('span.modal-field-label', 'Fecha Publicación'),
                      m('span.modal-field-value', formatDate(licitacion.issuedate)),
                    ])
                  : null,
                licitacion.awarddate
                  ? m('div.modal-field', [
                      m('span.modal-field-label', 'Fecha Adjudicación'),
                      m('span.modal-field-value', formatDate(licitacion.awarddate)),
                    ])
                  : null,
                licitacion.enddate
                  ? m('div.modal-field', [
                      m('span.modal-field-label', 'Fecha Fin'),
                      m('span.modal-field-value', formatDate(licitacion.enddate)),
                    ])
                  : null,
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

            licitacion.winningparty
              ? m('div.modal-section', [
                  m('h4.modal-section-title', 'Adjudicatario'),
                  m('p.modal-adjudicatario', licitacion.winningparty),
                ])
              : null,

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

            licitacion.href
              ? m('div.modal-actions', [
                  m('a.btn.btn-primary.btn-large', {
                    href: licitacion.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }, [
                    m('svg[width=18][height=18][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
                      m('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
                      m('polyline', { points: '15 3 21 3 21 9' }),
                      m('line', { x1: 10, y1: 14, x2: 21, y2: 3 })),
                    'Ver en Contratación del Estado',
                  ]),
                ])
              : null,
          ]),
        ]),
      ])
    },
  }
}
