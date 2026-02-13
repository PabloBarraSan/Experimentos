// ResourceViewHeader - Header compacto alineado con diseño de referencia

import { FlexCol, FlexRow, Tappable, Div } from '../../../DView/layout.js';
import { H1, SmallText } from '../../../DView/texts.js';
import { Icon } from '../../../DView/elements.js';

function getResourceTitle(resource) {
    if (!resource) return 'Recurso';
    const v = resource.title || resource.name;
    return typeof v === 'string' ? v : (v?.und || v?.es || v?.ca || 'Recurso');
}

function getResourceSubtitle(resource) {
    const s = resource?.subtitle;
    return typeof s === 'string' ? s : (s?.und || s?.es || s?.ca || '');
}

const calendarActions = [
    { label: 'Buscar citas', icon: 'search', color: '#ea580c', hoverBg: '#fff7ed', hoverBorder: '#fed7aa', onclick: () => window.handleSearchAppointments?.() },
    { label: 'Gestionar horarios', icon: 'schedule', color: '#7c3aed', hoverBg: '#faf5ff', hoverBorder: '#e9d5ff', onclick: () => window.handleManageSchedules?.() },
    { label: 'Clonar Semana', icon: 'content_copy', color: '#14b8a6', hoverBg: '#f0fdfa', hoverBorder: '#99f6e4', onclick: () => window.handleCloneWeek?.() },
    { label: 'Eliminar Semana', icon: 'delete', color: '#ef4444', hoverBg: '#fef2f2', hoverBorder: '#fecaca', onclick: () => window.handleDeleteWeek?.() }
];

const quickActions = [
    { title: "Sala d'espera", icon: "person" },
    { title: "Administrador de torns", icon: "vpn_key" },
    { title: "Sol·licitud de torns", icon: "confirmation_number" },
    { title: "Panell de comandaments", icon: "view_column" },
    { title: "Lector de QR", icon: "qr_code" },
    { title: "Citaprevia web", icon: "language" },
    { title: "App mòbil", icon: "phone_iphone" }
];

function getInitials(resource) {
    const title = getResourceTitle(resource);
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase().slice(0, 2);
    }
    return title.slice(0, 2).toUpperCase();
}

export const ResourceViewHeader = {
    view: (vnode) => {
        const { resource, variant = 'default' } = vnode.attrs;
        const title = getResourceTitle(resource);
        const subtitle = getResourceSubtitle(resource);
        const isCalendar = variant === 'calendar';

        const baseStyle = {
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            width: '100vw',
            marginLeft: 'calc(-50vw + 50%)',
            marginTop: '-2rem',
            marginBottom: '1.5rem',
            paddingLeft: 'calc(50vw - 50% + var(--content-padding-x, 1.5rem))',
            paddingRight: 'calc(50vw - 50% + var(--content-padding-x, 1.5rem))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            minHeight: '64px'
        };

        return m(Div, { style: baseStyle }, [
            // Izquierda: Volver | Divider | Avatar/Photo + Título + (Stats si calendar)
            m(FlexRow, {
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                style: { flex: 1, minWidth: 0 }
            }, [
                m(Tappable, {
                    onclick: () => m.route.set(isCalendar && resource?._id ? `/resource/${resource._id}/admin` : '/'),
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    },
                    hover: { color: '#111827' }
                }, [
                    m(Icon, { icon: 'arrow_back', size: 'small', style: { fontSize: '16px' } }),
                    m('span', 'Volver')
                ]),
                m(Div, {
                    style: {
                        width: '1px',
                        height: '24px',
                        backgroundColor: '#e5e7eb',
                        flexShrink: 0
                    }
                }),
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                }, [
                    m(Div, {
                            style: {
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                backgroundColor: '#e0e7ff',
                                color: '#4338ca',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                flexShrink: 0
                            }
                        }, resource ? getInitials(resource) : '??'),
                    m(FlexCol, { gap: 0, style: { flex: 1, minWidth: 0 } }, [
                        m(FlexRow, {
                            alignItems: 'center',
                            gap: '0.75rem',
                            flexWrap: 'wrap'
                        }, [
                            m(H1, {
                                fontSize: isCalendar ? '1.25rem' : '1rem',
                                fontWeight: 'bold',
                                color: '#111827',
                                margin: 0,
                                lineHeight: 1.2
                            }, title),
                            isCalendar && resource && m(FlexRow, {
                                gap: '0.5rem',
                                flexWrap: 'wrap',
                                alignItems: 'center'
                            }, [
                                m(Div, {
                                    style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe'
                                    }
                                }, [
                                    m(Icon, { icon: 'people', size: 'small', style: { fontSize: '12px' } }),
                                    `Capacidad: ${resource.seats?.total || 0}`
                                ]),
                                resource.maxAppointmentsPerUser && m(Div, {
                                    style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        backgroundColor: '#faf5ff',
                                        color: '#7c3aed',
                                        border: '1px solid #e9d5ff'
                                    }
                                }, [
                                    m(Icon, { icon: 'schedule', size: 'small', style: { fontSize: '12px' } }),
                                    `Máx. usuario: ${resource.maxAppointmentsPerUser}`
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        backgroundColor: resource.published ? '#f0fdf4' : '#f8fafc',
                                        color: resource.published ? '#15803d' : '#475569',
                                        border: `1px solid ${resource.published ? '#bbf7d0' : '#e2e8f0'}`
                                    }
                                }, [
                                    m(Icon, {
                                        icon: resource.published ? 'check_circle' : 'pause_circle',
                                        size: 'small',
                                        style: { fontSize: '12px' }
                                    }),
                                    resource.published ? 'Activo' : 'Pausado'
                                ])
                            ])
                        ]),
                        subtitle && m(SmallText, {
                            style: {
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                margin: 0,
                                marginTop: '0.25rem'
                            }
                        }, subtitle)
                    ])
                ])
            ]),

            // Derecha: Acciones (calendar: botones con texto | default: iconos)
            isCalendar
                ? m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    flexShrink: 0
                }, calendarActions.map(action =>
                    m(Tappable, {
                        onclick: action.onclick,
                        style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.875rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            backgroundColor: 'white',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                            cursor: 'pointer'
                        },
                        hover: {
                            backgroundColor: action.hoverBg,
                            color: action.color,
                            borderColor: action.hoverBorder
                        }
                    }, [
                        m(Icon, { icon: action.icon, size: 'small', style: { fontSize: '0.875rem', color: action.color } }),
                        m('span', action.label)
                    ])
                ))
                : m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.25rem',
                    flexShrink: 0
                }, [
                    ...quickActions.map(action =>
                        m(Tappable, {
                            onclick: () => {},
                            style: {
                                padding: '0.5rem',
                                color: '#9ca3af',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            },
                            hover: {
                                color: '#2563eb',
                                backgroundColor: 'rgba(37, 99, 235, 0.08)'
                            },
                            title: action.title
                        }, [m(Icon, { icon: action.icon, size: 'small', style: { fontSize: '18px' } })])
                    ),
                    m(Div, {
                        style: {
                            width: '1px',
                            height: '20px',
                            backgroundColor: '#e5e7eb',
                            margin: '0 0.25rem'
                        }
                    }),
                    m(Tappable, {
                        onclick: () => {},
                        style: {
                            padding: '0.5rem',
                            color: '#9ca3af',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        },
                        hover: {
                            color: '#4f46e5',
                            backgroundColor: '#f3f4f6'
                        }
                    }, [m(Icon, { icon: 'settings', size: 'small', style: { fontSize: '20px' } })]),
                    m(Tappable, {
                        onclick: () => {},
                        style: {
                            padding: '0.5rem',
                            color: '#9ca3af',
                            borderRadius: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        },
                        hover: {
                            color: '#2563eb',
                            backgroundColor: '#eff6ff'
                        }
                    }, [m(Icon, { icon: 'help_outline', size: 'small', style: { fontSize: '20px' } })])
                ])
        ]);
    }
};
