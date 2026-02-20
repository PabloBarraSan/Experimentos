import { Div, FlexCol, FlexRow } from '../../../DView/layout.js';
import { Text, SmallText } from '../../../DView/texts.js';
import { Button } from '../../../DView/elements.js';
import { Switch } from '../../../DView/forms.js';

const FILTER_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'booking', label: 'Reservas' },
    { value: 'bon', label: 'Bonos' },
    { value: 'appointment', label: 'Citas' }
];

const CHANNELS = [
    { href: '#/kiosko', icon: 'confirmation_number', label: 'Kiosko', external: false },
    { href: './citaprevia_web.html', icon: 'language', label: 'Web', external: true },
    { href: '#/tv', icon: 'tv', label: 'TV', external: false }
];

const styles = {
    bar: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0.75rem 0'
    },
    container: {
        maxWidth: 'var(--content-max-width, 1800px)',
        margin: '0 auto',
        padding: '0 var(--content-padding-x, 1.5rem)'
    },
    row1: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '0.75rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #f3f4f6'
    },
    row2: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap'
    },
    filtersGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    },
    title: {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#111827',
        margin: 0,
        letterSpacing: '-0.02em',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    },
    searchWrap: {
        position: 'relative',
        width: '220px'
    },
    searchIcon: {
        position: 'absolute',
        left: '0.75rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#9ca3af',
        fontSize: '1.125rem',
        pointerEvents: 'none'
    },
    searchInput: {
        width: '100%',
        height: '40px',
        padding: '0 1rem 0 2.5rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        color: '#111827',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'all 0.2s ease'
    },
    select: {
        height: '40px',
        minWidth: '120px',
        padding: '0 2rem 0 0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        color: '#374151',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center'
    },
    toggleWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        backgroundColor: '#f9fafb',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background-color 0.2s ease'
    },
    toggleLabel: {
        margin: 0,
        color: '#6b7280',
        fontSize: '0.8125rem',
        fontWeight: 500,
        whiteSpace: 'nowrap'
    },
    rightGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem'
    },
    channelLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.5rem 0.75rem',
        textDecoration: 'none',
        color: '#6b7280',
        fontSize: '0.8125rem',
        fontWeight: 500,
        borderRadius: '0.375rem',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
    },
    divider: {
        width: '1px',
        height: '20px',
        backgroundColor: '#e5e7eb',
        margin: '0 0.25rem'
    },
    iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '0.375rem',
        border: 'none',
        backgroundColor: 'transparent',
        color: '#6b7280',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    addButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        height: '36px',
        padding: '0 1rem',
        borderRadius: '0.5rem',
        fontWeight: 600,
        fontSize: '0.8125rem'
    }
};

export const DashboardFiltersBar = {
    view: (vnode) => {
        const { state } = vnode.attrs;

        return m(Div, { class: 'dashboard-filters-bar', style: styles.bar }, [
            m(Div, { class: 'dashboard-filters-container', style: styles.container }, [
                // ===== FILA 1: Título + Navegación =====
                m('div', { style: styles.row1 }, [
                    // Título
                    m('div', { style: styles.title }, [
                        m('span', { class: 'material-icons', style: { fontSize: '24px', color: '#3b82f6' } }, 'dashboard'),
                        'Panel de Recursos'
                    ]),

                    // Canales + Acciones
                    m('div', { style: styles.rightGroup }, [
                        CHANNELS.map((ch) =>
                            m('a', {
                                href: ch.href,
                                target: ch.external ? '_blank' : undefined,
                                rel: ch.external ? 'noopener noreferrer' : undefined,
                                style: styles.channelLink,
                                onclick: ch.external ? undefined : (e) => {
                                    e.preventDefault();
                                    m.route.set(ch.href.replace(/^#/, ''));
                                },
                                onmouseenter: (e) => {
                                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                                    e.currentTarget.style.color = '#111827';
                                },
                                onmouseleave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }, [
                                m('span', { class: 'material-icons', style: { fontSize: '16px' } }, ch.icon),
                                ch.label
                            ])
                        ),
                        m('div', { style: styles.divider }),
                        m('button', {
                            type: 'button',
                            style: styles.iconButton,
                            title: 'Estadísticas',
                            onclick: () => m.route.set('/stats'),
                            onmouseenter: (e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#111827';
                            },
                            onmouseleave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                            }
                        }, m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'bar_chart')),
                        m('button', {
                            type: 'button',
                            style: styles.iconButton,
                            title: 'Configuración',
                            onclick: () => {},
                            onmouseenter: (e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#111827';
                            },
                            onmouseleave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                            }
                        }, m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'settings')),
                        m('a', {
                            href: '#/usuarios',
                            style: styles.channelLink,
                            onclick: (e) => {
                                e.preventDefault();
                                m.route.set('/usuarios');
                            },
                            onmouseenter: (e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#111827';
                            },
                            onmouseleave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                            }
                        }, [
                            m('span', { class: 'material-icons', style: { fontSize: '16px' } }, 'people'),
                            'Usuarios'
                        ])
                    ])
                ]),

                // ===== FILA 2: Filtros =====
                m('div', { style: styles.row2 }, [
                    // Grupo de filtros pegados
                    m('div', { style: styles.filtersGroup }, [
                        // Buscador
                        m('div', { style: styles.searchWrap }, [
                            m('span', { class: 'material-icons', style: styles.searchIcon }, 'search'),
                            m('input', {
                                type: 'text',
                                style: styles.searchInput,
                                placeholder: 'Buscar...',
                                value: state.searchTerm,
                                oninput: (e) => {
                                    state.searchTerm = e.target.value;
                                    m.redraw();
                                },
                                onfocus: (e) => {
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.backgroundColor = '#ffffff';
                                },
                                onblur: (e) => {
                                    e.target.style.borderColor = '#e5e7eb';
                                    e.target.style.backgroundColor = '#f9fafb';
                                }
                            })
                        ]),

                        // Select tipo
                        m('select', {
                            style: styles.select,
                            value: state.filterType,
                            onchange: (e) => {
                                state.filterType = e.target.value;
                                m.redraw();
                            },
                            onfocus: (e) => e.target.style.borderColor = '#3b82f6',
                            onblur: (e) => e.target.style.borderColor = '#e5e7eb'
                        }, FILTER_OPTIONS.map((opt) => m('option', { value: opt.value }, opt.label))),

                        // Toggle no publicados
                        m('div', {
                            style: styles.toggleWrap,
                            onclick: () => {
                                state.showUnpublished = !state.showUnpublished;
                                m.redraw();
                            },
                            onmouseenter: (e) => e.currentTarget.style.backgroundColor = '#f3f4f6',
                            onmouseleave: (e) => e.currentTarget.style.backgroundColor = '#f9fafb'
                        }, [
                            m(Switch, { isActive: state.showUnpublished }),
                            m(SmallText, { style: styles.toggleLabel }, 'No publicados')
                        ])
                    ]),

                    // Botón añadir (a la derecha)
                    m(Button, {
                        type: 'positive',
                        onclick: () => {},
                        style: styles.addButton
                    }, [
                        m('span', { class: 'material-icons', style: { fontSize: '16px' } }, 'add'),
                        'Añadir recurso'
                    ])
                ])
            ])
        ]);
    }
};
