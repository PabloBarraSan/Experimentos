// Pagination component - Mithril
import m from 'mithril'

export function Pagination() {
  return {
    view({ attrs }) {
      const { page, totalPages, onPrev, onNext, onPage } = attrs

      if (totalPages <= 1) return null

      const pages = []
      for (let i = 0; i < Math.min(5, totalPages); i++) {
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
        pages.push(pageNum)
      }

      return m('div.pagination', [
        m('button.btn.btn-secondary', {
          onclick: onPrev,
          disabled: page <= 1,
        }, [
          m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
            m('path', { d: 'M15 18l-6-6 6-6' })),
          'Anterior',
        ]),

        m('div.pagination-pages',
          pages.map(p => m('button', {
            class: `pagination-page ${page === p ? 'active' : ''}`,
            onclick: () => onPage(p),
          }, p))
        ),

        m('button.btn.btn-secondary', {
          onclick: onNext,
          disabled: page >= totalPages,
        }, [
          'Siguiente',
          m('svg[width=16][height=16][viewBox="0 0 24 24"][fill=none][stroke=currentColor][stroke-width=2]',
            m('path', { d: 'M9 18l6-6-6-6' })),
        ]),
      ])
    },
  }
}
