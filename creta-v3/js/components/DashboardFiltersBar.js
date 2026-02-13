import { Div, FlexCol, FlexRow } from '../../../DView/layout.js';
import { Text, SmallText } from '../../../DView/texts.js';
import { Button } from '../../../DView/elements.js';
import { Switch } from '../../../DView/forms.js';

const FILTER_OPTIONS = [
    { value: 'all', label: 'Todos los tipos' },
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
        padding: '1rem 0'
    },
    container: {
        maxWidth: 'var(--content-max-width, 1800px)',
        margin: '0 auto',
        padding: '0 var(--content-padding-x, 1.5rem)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        flexWrap: 'wrap'
    },
    title: {
        fontSize: '1.125rem',
        fontWeight: 600,
        color: '#111827',
        margin: 0,
        letterSpacing: '-0.02em'
    },
    leftGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flex: '1 1 auto'
    },
    searchWrap: {
        position: 'relative',
        width: '280px'
    },
    searchIcon: {
        position: 'absolute',
        left: '0.875rem',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#9ca3af',
        fontSize: '1.125rem',
        pointerEvents: 'none'
    },
    searchInput: {
        width: '100%',
        height: '38px',
        padding: '0 0.875rem 0 2.5rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'border-color 0.2s ease'
    },
    select: {
        height: '38px',
        minWidth: '140px',
        padding: '0 2rem 0 0.875rem',
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
        backgroundPosition: 'right 0.7rem center',
        transition: 'border-color 0.2s ease'
    },
    toggleWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0 0.5rem',
        borderRadius: '0.375rem',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background-color 0.2s ease'
    },
    toggleLabel: {
        margin: 0,
        color: '#6b7280',
        fontSize: '0.875rem',
        fontWeight: 400,
        whiteSpace: 'nowrap'
    },
    rightGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    },
    channelLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        height: '38px',
        padding: '0 0.75rem',
        textDecoration: 'none',
        color: '#6b7280',
        fontSize: '0.875rem',
        fontWeight: 500,
        borderRadius: '0.5rem',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
    },
    divider: {
        width: '1px',
        height: '24px',
        backgroundColor: '#e5e7eb'
    },
    iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '38px',
        height: '38px',
        borderRadius: '0.5rem',
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
        height: '38px',
        padding: '0 1rem',
        borderRadius: '0.5rem',
        fontWeight: 600,
        fontSize: '0.875rem'
    },
    usersButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        height: '38px',
        padding: '0 0.875rem',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        color: '#374151',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textDecoration: 'none',
        whiteSpace: 'nowrap'
    }
};

export const DashboardFiltersBar = {
    view: (vnode) => {
        const { state } = vnode.attrs;

        return m(Div, { class: 'dashboard-filters-bar', style: styles.bar }, [
            m(Div, { class: 'dashboard-filters-container', style: styles.container }, [
                // Título
                m(Text, { class: 'dashboard-filters-title', style: styles.title }, 'Panel de Recursos'),
                
                // Grupo Izquierdo: Filtros
                m('div', { class: 'dashboard-filters-left', style: styles.leftGroup }, [
                    m('div', { class: 'dashboard-filters-search', style: styles.searchWrap }, [
                        m('span', { class: 'material-icons', style: styles.searchIcon }, 'search'),
                        m('input', {
                            type: 'text',
                            style: styles.searchInput,
                            placeholder: 'Buscar recursos...',
                            value: state.searchTerm,
                            oninput: (e) => {
                                state.searchTerm = e.target.value;
                                m.redraw();
                            },
                            onfocus: (e) => {
                                e.target.style.borderColor = '#3b82f6';
                            },
                            onblur: (e) => {
                                e.target.style.borderColor = '#e5e7eb';
                            }
                        })
                    ]),
                    m('select', {
                        style: styles.select,
                        value: state.filterType,
                        onchange: (e) => {
                            state.filterType = e.target.value;
                            m.redraw();
                        },
                        onfocus: (e) => {
                            e.target.style.borderColor = '#3b82f6';
                        },
                        onblur: (e) => {
                            e.target.style.borderColor = '#e5e7eb';
                        }
                    }, FILTER_OPTIONS.map((opt) => m('option', { value: opt.value }, opt.label))),
                    m('div', {
                        style: styles.toggleWrap,
                        onclick: () => {
                            state.showUnpublished = !state.showUnpublished;
                            m.redraw();
                        },
                        onmouseenter: (e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }
                    }, [
                        m(Switch, {
                            isActive: state.showUnpublished
                        }),
                        m(SmallText, { class: 'dashboard-filters-toggle-label', style: styles.toggleLabel }, 'No publicados')
                    ])
                ]),
                
                // Grupo Derecho: Navegación y Acciones
                m('div', { class: 'dashboard-filters-right', style: styles.rightGroup }, [
                    CHANNELS.map((ch) =>
                        m('a', {
                            href: ch.href,
                            target: ch.external ? '_blank' : undefined,
                            rel: ch.external ? 'noopener noreferrer' : undefined,
                            class: 'dashboard-filters-channel-link',
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
                            m('span', { class: 'material-icons', style: { fontSize: '18px' } }, ch.icon),
                            m('span', { class: 'dashboard-filters-channel-label' }, ch.label)
                        ])
                    ),
                    m('div', { style: styles.divider }),
                    m('button', {
                        type: 'button',
                        style: styles.iconButton,
                        onclick: () => {
                            m.route.set('/stats');
                        },
                        onmouseenter: (e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.color = '#111827';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#6b7280';
                        }
                    }, m('span', { class: 'material-icons', style: { fontSize: '20px' } }, 'bar_chart')),
                    m('button', {
                        type: 'button',
                        style: styles.iconButton,
                        onclick: () => {},
                        onmouseenter: (e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.color = '#111827';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#6b7280';
                        }
                    }, m('span', { class: 'material-icons', style: { fontSize: '20px' } }, 'settings')),
                    m('a', {
                        href: '#/usuarios',
                        class: 'dashboard-filters-users-btn',
                        style: styles.usersButton,
                        onclick: (e) => {
                            e.preventDefault();
                            m.route.set('/usuarios');
                        },
                        onmouseenter: (e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.color = '#3b82f6';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.color = '#374151';
                        }
                    }, [
                        m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'people'),
                        m('span', { class: 'dashboard-filters-users-text' }, 'Usuarios')
                    ]),
                    m(Button, {
                        type: 'positive',
                        onclick: () => {},
                        style: styles.addButton
                    }, [
                        m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'add'),
                        'Añadir'
                    ])
                ])
            ])
        ]);
    }
};
