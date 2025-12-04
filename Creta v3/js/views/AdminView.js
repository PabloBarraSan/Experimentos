// Admin View Component using Mithril and DView

import { FlexCol, FlexRow, Grid, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Card, Label, Segment } from '../../../DView/elements.js';
import { Input } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../DView/dialogs.js';
import { fetchAppointments, calculateStats, getDateRange } from '../api.js';

export const AdminView = {
    oninit: async (vnode) => {
        vnode.state.loading = true;
        vnode.state.stats = null;
        vnode.state.appointmentsData = null;
        vnode.state.error = null;

        try {
            const dateRange = getDateRange();
            const appointmentsData = await fetchAppointments(
                vnode.attrs.resource._id,
                vnode.attrs.resource.groupId,
                dateRange.start,
                dateRange.end
            );

            const stats = calculateStats(appointmentsData);
            vnode.state.stats = stats;
            vnode.state.appointmentsData = appointmentsData;
            vnode.state.loading = false;
            
            // Trigger redraw after state update
            m.redraw();
            
            // Initialize chart after a short delay to ensure DOM is ready
            setTimeout(() => {
                const chartContainer = document.querySelector('#chart-container');
                if (chartContainer) {
                    initializeChart(stats, chartContainer);
                } else {
                    console.warn('Chart container not found in DOM');
                }
            }, 300);
        } catch (error) {
            console.error('Error loading admin data:', error);
            vnode.state.error = error.message;
            vnode.state.loading = false;
            m.redraw();
        }
    },

    view: (vnode) => {
        const { resource } = vnode.attrs;
        const state = vnode.state;

        if (state.loading) {
            return m(FlexCol, {
                alignItems: 'center',
                justifyContent: 'center',
                style: { padding: '3rem' }
            }, [
                m('i', {
                    class: 'fa-solid fa-circle-notch fa-spin',
                    style: { fontSize: '2.5rem', color: '#2563eb', marginBottom: '1rem' }
                }),
                m(Text, { color: '#64748b' }, 'Cargando datos de administración...')
            ]);
        }

        if (state.error) {
            return m(Segment, { type: 'negative' }, [
                m(Text, `Error: ${state.error}`)
            ]);
        }

        return m(FlexCol, { gap: '1.5rem' }, [
            // Header
            renderHeader(resource),
            
            // Main Content
            renderContent(resource, state.stats, state.appointmentsData),
            
            // Schedule Grid
            renderScheduleGrid(resource, state.appointmentsData)
        ]);
    }
};

function renderHeader(resource) {
    // Definir acciones rápidas (botones de DetailView)
    const quickActions = [
        {
            title: "Sala d'espera",
            icon: "person",
            onclick: () => {}
        },
        {
            title: "Administrador de torns",
            icon: "vpn_key",
            onclick: () => {}
        },
        {
            title: "Sol·licitud de torns",
            icon: "confirmation_number",
            onclick: () => {}
        },
        {
            title: "Solicitud de turnos 2",
            icon: "confirmation_number",
            onclick: () => {}
        },
        {
            title: "Panell de comandaments",
            icon: "view_column",
            onclick: () => {}
        },
        {
            title: "Lector de QR",
            icon: "qr_code",
            onclick: () => {}
        },
        {
            title: "Citaprevia web",
            icon: "language",
            onclick: () => {}
        },
        {
            title: "App mòbil",
            icon: "phone_iphone",
            onclick: () => {}
        }
    ];

    return m(Segment, {
        type: 'primary',
        style: { 
            padding: '1.5rem', 
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }
    }, [
        // Primera fila: Título y botón volver
        m(FlexRow, {
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            style: { marginBottom: '1rem' }
        }, [
            m(FlexRow, {
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap'
            }, [
                m(Button, {
                    type: 'default',
                    onclick: () => m.route.set('/'),
                    style: {
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f1f5f9',
                        color: '#64748b',
                        flexShrink: 0
                    },
                    hover: {
                        backgroundColor: '#e2e8f0',
                        color: '#475569'
                    }
                }, [
                    m(Icon, { icon: 'arrow_back', size: 'small' })
                ]),
                m(FlexCol, { gap: '0.25rem' }, [
                    resource.subtitle && m(SmallText, {
                        style: {
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: '#2563eb',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            margin: 0
                        }
                    }, resource.subtitle),
                    m(H1, {
                        fontSize: '1.875rem',
                        fontWeight: 'bold',
                        color: '#1e293b',
                        margin: 0
                    }, resource.title || resource.name)
                ])
            ]),
            m(FlexRow, {
                gap: '0.5rem',
                flexWrap: 'wrap',
                justifyContent: 'flex-end'
            }, [
                m(Label, {
                    type: 'tertiary',
                    size: 'small',
                    style: { fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px' }
                }, `Tipus: ${resource.type}`),
                m(Label, {
                    type: resource.published ? 'positive' : 'tertiary',
                    size: 'small',
                    style: { fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px' }
                }, resource.published ? 'Publicat' : 'No Publicat'),
                m(Label, {
                    type: 'tertiary',
                    size: 'small',
                    style: { fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px' }
                }, [
                    m(Icon, { icon: 'check_circle', size: 'small', style: { color: '#22c55e', marginRight: '0.25rem' } }),
                    'Autoconfirmat'
                ]),
                m(Label, {
                    type: 'tertiary',
                    size: 'small',
                    style: { fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px' }
                }, [
                    m(Icon, { icon: 'people', size: 'small', style: { marginRight: '0.25rem' } }),
                    resource.seats?.total || 0
                ]),
                m(Label, {
                    type: 'tertiary',
                    size: 'small',
                    style: { fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px' }
                }, [
                    m(Icon, { icon: 'credit_card', size: 'small', style: { color: '#22c55e', marginRight: '0.25rem' } }),
                    'Pago'
                ])
            ])
        ]),
        
        // Segunda fila: Barra de herramientas compacta con acciones rápidas
        m(Div, {
            style: {
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0'
            }
        }, [
            m(FlexRow, {
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }, [
                m(SmallText, {
                    style: {
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: 500,
                        marginRight: '0.5rem',
                        margin: 0
                    }
                }, 'Acciones rápidas:'),
                ...quickActions.map(action => 
                    m(Tappable, {
                        onclick: action.onclick,
                        style: {
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease',
                            fontSize: '0.875rem',
                            color: '#475569',
                            whiteSpace: 'nowrap',
                            outline: 'none',
                            boxSizing: 'border-box'
                        },
                        hover: {
                            backgroundColor: '#e0f2fe',
                            border: '1px solid #93c5fd',
                            color: '#2563eb',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                            outline: 'none'
                        },
                        title: action.title
                    }, [
                        m(Icon, { 
                            icon: action.icon, 
                            size: 'small',
                            style: { fontSize: '16px', flexShrink: 0 }
                        }),
                        m(Text, {
                            fontSize: '0.875rem',
                            margin: 0,
                            style: {
                                display: 'inline'
                            }
                        }, action.title)
                    ])
                )
            ])
        ])
    ]);
}

function renderContent(resource, stats, appointmentsData) {
    return m(Segment, {
        type: 'primary',
        style: { 
            padding: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }
    }, [
        m(Grid, {
            columns: {
                mobile: 1,
                tablet: 1,
                computer: 3
            },
            style: { gap: '2rem' }
        }, [
            // Left Column: Image & Description
            m(FlexCol, {
                style: {
                    gridColumn: 'span 1',
                    '@media (min-width: 1024px)': { gridColumn: 'span 1' }
                }
            }, [
                m(Div, {
                    style: {
                        borderRadius: '0.75rem',
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        aspectRatio: '16/9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8fafc',
                        marginBottom: '1.5rem',
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }
                }, [
                    m('img', {
                        src: resource.photo || 'https://via.placeholder.com/400x300',
                        alt: resource.name,
                        style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        },
                        onerror: (e) => {
                            e.target.style.display = 'none';
                        }
                    })
                ]),
                m(Div, {
                    style: {
                        color: '#475569',
                        fontSize: '0.875rem',
                        lineHeight: '1.6'
                    }
                }, m.trust(resource.description?.und || '<p style="color: #94a3b8;">Sin descripción</p>'))
            ]),
            
            // Middle Column: Stats & Chart
            m(FlexCol, {
                style: {
                    gridColumn: 'span 1',
                    '@media (min-width: 1024px)': { gridColumn: 'span 1' },
                    display: 'flex',
                    flexDirection: 'column'
                },
                gap: '1.5rem'
            }, [
                // Stats Cards
                m(Grid, {
                    columns: 3,
                    style: { gap: '1.5rem' }
                }, [
                    m(Div, {
                        style: {
                            textAlign: 'center',
                            padding: '1rem'
                        }
                    }, [
                        m(Text, {
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            marginBottom: '0.5rem',
                            margin: 0
                        }, stats.totalSlots),
                        m(SmallText, {
                            fontSize: '0.75rem',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 500,
                            margin: 0
                        }, 'Slots')
                    ]),
                    m(Div, {
                        style: {
                            textAlign: 'center',
                            padding: '1rem'
                        }
                    }, [
                        m(Text, {
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            marginBottom: '0.5rem',
                            margin: 0
                        }, stats.confirmedAppointments),
                        m(SmallText, {
                            fontSize: '0.75rem',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 500,
                            margin: 0
                        }, 'Reservas')
                    ]),
                    m(Div, {
                        style: {
                            textAlign: 'center',
                            padding: '1rem'
                        }
                    }, [
                        m(Text, {
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            marginBottom: '0.5rem',
                            margin: 0
                        }, stats.availableSeats),
                        m(SmallText, {
                            fontSize: '0.75rem',
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 500,
                            margin: 0
                        }, 'Disponibles')
                    ])
                ]),
                
                // Chart
                m(Div, {
                    style: {
                        paddingTop: '1.5rem',
                        borderTop: '1px solid #f1f5f9',
                        marginTop: '1rem'
                    }
                }, [
                    m('div', { 
                        id: 'chart-container',
                        style: { 
                            width: '100%',
                            minHeight: '220px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        } 
                    })
                ])
            ]),
            
            // Right Column: Action Buttons
            m(Div, {
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem',
                        gridColumn: 'span 1',
                        width: '100%'
                    }
            }, [
                m(Button, {
                    type: 'blue',
                    fluid: true,
                    onclick: () => {
                        const resource = window.app.currentResource;
                        if (resource && resource._id) {
                            m.route.set(`/resource/${resource._id}/calendar`);
                        }
                    },
                    style: {
                        justifyContent: 'flex-start',
                        padding: '1rem 1.25rem',
                        borderRadius: '0.75rem',
                        boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.08)',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        marginBottom: 0
                    },
                    hover: {
                        boxShadow: '0 4px 12px 0 rgba(37, 99, 235, 0.25)',
                        transform: 'translateY(-2px)'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '18px',
                            marginRight: '0.875rem',
                            color: 'white',
                            userSelect: 'none',
                            opacity: 1
                        },
                        oncreate: (vnode) => {
                            vnode.dom.style.setProperty('color', 'white', 'important');
                        }
                    }, 'event'),
                    m(Text, { fontSize: '0.9375rem', fontWeight: 500, margin: 0 }, 'Calendari cites')
                ]),
                m(Button, {
                    type: 'default',
                    fluid: true,
                    onclick: () => {},
                    style: {
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        justifyContent: 'flex-start',
                        padding: '1rem 1.25rem',
                        borderRadius: '0.75rem',
                        boxShadow: '0 2px 4px 0 rgba(124, 58, 237, 0.2)',
                        transition: 'all 0.2s ease',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        marginBottom: 0
                    },
                    hover: {
                        backgroundColor: '#6d28d9',
                        boxShadow: '0 4px 12px 0 rgba(124, 58, 237, 0.3)',
                        transform: 'translateY(-2px)'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '18px',
                            marginRight: '0.875rem',
                            color: 'white',
                            userSelect: 'none',
                            opacity: 1
                        },
                        oncreate: (vnode) => {
                            vnode.dom.style.setProperty('color', 'white', 'important');
                        }
                    }, 'schedule'),
                    m(Text, { fontSize: '0.9375rem', fontWeight: 500, margin: 0 }, 'Gestionar Horaris')
                ]),
                m(Button, {
                    type: 'default',
                    fluid: true,
                    onclick: () => {},
                    style: {
                        backgroundColor: '#b45309',
                        color: 'white',
                        border: 'none',
                        justifyContent: 'flex-start',
                        padding: '1rem 1.25rem',
                        borderRadius: '0.75rem',
                        boxShadow: '0 2px 4px 0 rgba(180, 83, 9, 0.2)',
                        transition: 'all 0.2s ease',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        marginBottom: 0
                    },
                    hover: {
                        backgroundColor: '#92400e',
                        boxShadow: '0 4px 12px 0 rgba(180, 83, 9, 0.3)',
                        transform: 'translateY(-2px)'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '18px',
                            marginRight: '0.875rem',
                            color: 'white',
                            userSelect: 'none',
                            opacity: 1
                        },
                        oncreate: (vnode) => {
                            vnode.dom.style.setProperty('color', 'white', 'important');
                        }
                    }, 'print'),
                    m(Text, { fontSize: '0.9375rem', fontWeight: 500, margin: 0 }, 'Imprimir reserves')
                ]),
                m(Button, {
                    type: 'positive',
                    fluid: true,
                    onclick: () => {},
                    style: {
                        justifyContent: 'flex-start',
                        padding: '1rem 1.25rem',
                        borderRadius: '0.75rem',
                        boxShadow: '0 2px 4px 0 rgba(34, 197, 94, 0.2)',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        fontWeight: 500,
                        fontSize: '0.9375rem',
                        marginBottom: 0
                    },
                    hover: {
                        boxShadow: '0 4px 12px 0 rgba(34, 197, 94, 0.3)',
                        transform: 'translateY(-2px)'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '18px',
                            marginRight: '0.875rem',
                            color: 'white',
                            userSelect: 'none',
                            opacity: 1
                        },
                        oncreate: (vnode) => {
                            vnode.dom.style.setProperty('color', 'white', 'important');
                        }
                    }, 'settings'),
                    m(Text, { fontSize: '0.9375rem', fontWeight: 500, margin: 0 }, 'Ajustos del recurs')
                ])
            ])
        ])
    ]);
}

function renderScheduleGrid(resource, appointmentsData) {
    return m(Segment, {
        type: 'primary',
        style: { 
            padding: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }
    }, [
        m(ReservationsView, { resource, appointmentsData })
    ]);
}

// Reservations View Component
const ReservationsView = {
    oninit: (vnode) => {
        vnode.state.searchTerm = '';
        vnode.state.filterStatus = 'all'; // 'all', 'confirmed', 'pending', 'canceled'
        vnode.state.allReservations = extractReservations(vnode.attrs.appointmentsData);
        vnode.state.currentPage = 1;
        vnode.state.itemsPerPage = 20;
        vnode.state.selectedReservation = null;
    },
    
    view: (vnode) => {
        const { resource, appointmentsData } = vnode.attrs;
        const state = vnode.state;
        
        // Filter reservations
        let filteredReservations = state.allReservations.filter(reservation => {
            // Search filter
            const searchLower = state.searchTerm.toLowerCase();
            const matchesSearch = !state.searchTerm || 
                reservation.userName.toLowerCase().includes(searchLower) ||
                reservation.email?.toLowerCase().includes(searchLower) ||
                reservation.telephone?.includes(searchLower) ||
                reservation.turn?.toString().includes(searchLower) ||
                reservation.maskedTurn?.toLowerCase().includes(searchLower);
            
            // Status filter
            const matchesStatus = state.filterStatus === 'all' || 
                reservation.status === state.filterStatus;
            
            return matchesSearch && matchesStatus;
        });
        
        return m(FlexCol, {
            gap: '1.5rem'
        }, [
            // Reservation Sidebar
            state.selectedReservation && m(ReservationSidebar, {
                reservation: state.selectedReservation,
                onClose: () => {
                    state.selectedReservation = null;
                    m.redraw();
                }
            }),
            
            // Header
            m(FlexRow, {
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }, [
                m(H2, {
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    margin: 0
                }, [
                    m(Icon, { icon: 'list', size: 'small', style: { marginRight: '0.5rem' } }),
                    'Reservas'
                ]),
                m(SmallText, {
                    fontSize: '0.875rem',
                    color: '#64748b',
                    margin: 0
                }, `${filteredReservations.length} reserva${filteredReservations.length !== 1 ? 's' : ''}`)
            ]),
            
            // Search and Filters
            m(FlexRow, {
                gap: '1rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }, [
                // Search Input
                m(Div, {
                    style: {
                        flex: 1,
                        minWidth: '250px',
                        position: 'relative'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '18px',
                            color: '#94a3b8',
                            pointerEvents: 'none'
                        }
                    }, 'search'),
                    m(Input, {
                        placeholder: 'Buscar por nombre, email, teléfono o turno...',
                        value: state.searchTerm,
                        oninput: (e) => {
                            state.searchTerm = e.target.value;
                            state.currentPage = 1; // Reset to first page on search
                            m.redraw();
                        },
                        style: {
                            width: '100%',
                            paddingLeft: '2.5rem',
                            fontSize: '0.875rem'
                        }
                    })
                ]),
                
                // Status Filters
                m(FlexRow, {
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                }, [
                    m(Button, {
                        type: state.filterStatus === 'all' ? 'blue' : 'default',
                        size: 'small',
                        onclick: () => {
                            state.filterStatus = 'all';
                            state.currentPage = 1; // Reset to first page on filter change
                            m.redraw();
                        },
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem'
                        }
                    }, 'Todas'),
                    m(Button, {
                        type: state.filterStatus === 'confirmed' ? 'blue' : 'default',
                        size: 'small',
                        onclick: () => {
                            state.filterStatus = 'confirmed';
                            state.currentPage = 1; // Reset to first page on filter change
                            m.redraw();
                        },
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem'
                        }
                    }, 'Confirmadas'),
                    m(Button, {
                        type: state.filterStatus === 'pending' ? 'blue' : 'default',
                        size: 'small',
                        onclick: () => {
                            state.filterStatus = 'pending';
                            state.currentPage = 1; // Reset to first page on filter change
                            m.redraw();
                        },
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem'
                        }
                    }, 'Pendientes'),
                    m(Button, {
                        type: state.filterStatus === 'canceled' ? 'blue' : 'default',
                        size: 'small',
                        onclick: () => {
                            state.filterStatus = 'canceled';
                            state.currentPage = 1; // Reset to first page on filter change
                            m.redraw();
                        },
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem'
                        }
                    }, 'Canceladas')
                ])
            ]),
            
            // Reservations List
            filteredReservations.length > 0 ? m(FlexCol, {
                gap: '0',
                style: {
                    marginTop: '1rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    overflow: 'hidden'
                }
            }, filteredReservations
                .slice((state.currentPage - 1) * state.itemsPerPage, state.currentPage * state.itemsPerPage)
                .map((reservation, index) => 
                    m(ReservationCard, { 
                        key: reservation.id || index, 
                        reservation,
                        isLast: index === Math.min(state.itemsPerPage - 1, filteredReservations.length - (state.currentPage - 1) * state.itemsPerPage - 1),
                        onclick: () => {
                            state.selectedReservation = reservation;
                            m.redraw();
                        }
                    })
                )
            ) : m(Div, {
                style: {
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#94a3b8'
                }
            }, [
                m('span', {
                    class: 'material-icons',
                    style: {
                        fontSize: '3rem',
                        marginBottom: '1rem',
                        display: 'block',
                        color: '#cbd5e1'
                    }
                }, 'search_off'),
                m(Text, {
                    fontSize: '0.875rem',
                    margin: 0
                }, 'No se encontraron reservas')
            ]),
            
            // Pagination Info (moved to bottom)
            filteredReservations.length > 0 && m(FlexRow, {
                justifyContent: 'space-between',
                alignItems: 'center',
                style: {
                    padding: '1rem 0',
                    marginTop: '1rem'
                }
            }, [
                m(SmallText, {
                    fontSize: '0.875rem',
                    color: '#64748b',
                    margin: 0
                }, `Mostrando ${((state.currentPage - 1) * state.itemsPerPage) + 1}-${Math.min(state.currentPage * state.itemsPerPage, filteredReservations.length)} de ${filteredReservations.length}`),
                m(FlexRow, {
                    gap: '0.5rem',
                    alignItems: 'center'
                }, [
                    m(Button, {
                        type: 'default',
                        size: 'small',
                        onclick: () => {
                            if (state.currentPage > 1) {
                                state.currentPage--;
                                m.redraw();
                            }
                        },
                        disabled: state.currentPage === 1,
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            opacity: state.currentPage === 1 ? 0.5 : 1,
                            cursor: state.currentPage === 1 ? 'not-allowed' : 'pointer'
                        }
                    }, 'Anterior'),
                    m(Text, {
                        fontSize: '0.875rem',
                        color: '#64748b',
                        margin: 0
                    }, `Página ${state.currentPage} de ${Math.ceil(filteredReservations.length / state.itemsPerPage)}`),
                    m(Button, {
                        type: 'default',
                        size: 'small',
                        onclick: () => {
                            const maxPage = Math.ceil(filteredReservations.length / state.itemsPerPage);
                            if (state.currentPage < maxPage) {
                                state.currentPage++;
                                m.redraw();
                            }
                        },
                        disabled: state.currentPage >= Math.ceil(filteredReservations.length / state.itemsPerPage),
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            opacity: state.currentPage >= Math.ceil(filteredReservations.length / state.itemsPerPage) ? 0.5 : 1,
                            cursor: state.currentPage >= Math.ceil(filteredReservations.length / state.itemsPerPage) ? 'not-allowed' : 'pointer'
                        }
                    }, 'Siguiente')
                ])
            ])
        ]);
    }
};

// Reservation Card Component
const ReservationCard = {
    view: (vnode) => {
        const { reservation, isLast } = vnode.attrs;
        const statusColors = {
            confirmed: { bg: '#dcfce7', text: '#166534', label: 'Confirmada' },
            pending: { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
            canceled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelada' }
        };
        const status = statusColors[reservation.status] || statusColors.confirmed;
        
        return m(Div, {
            onclick: vnode.attrs.onclick,
            style: {
                padding: '0.875rem 1rem',
                backgroundColor: 'white',
                borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                transition: 'background-color 0.15s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
            },
            onmouseenter: (e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
            },
            onmouseleave: (e) => {
                e.currentTarget.style.backgroundColor = 'white';
            }
        }, [
            m(FlexRow, {
                alignItems: 'center',
                gap: '1rem',
                flex: 1,
                style: { minWidth: 0 }
            }, [
                m(Label, {
                    type: reservation.status === 'confirmed' ? 'positive' : 
                          reservation.status === 'pending' ? 'warning' : 'negative',
                    size: 'small',
                    style: {
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        flexShrink: 0
                    }
                }, status.label),
                m(FlexCol, {
                    flex: 1,
                    gap: '0.25rem',
                    style: { minWidth: 0 }
                }, [
                    m(Text, {
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#1e293b',
                        margin: 0,
                        style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }
                    }, reservation.userName || 'Sin nombre'),
                    m(FlexRow, {
                        gap: '1rem',
                        flexWrap: 'wrap',
                        style: { fontSize: '0.75rem', color: '#64748b' }
                    }, [
                        reservation.email && m(Text, {
                            fontSize: '0.75rem',
                            margin: 0,
                            style: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }
                        }, reservation.email),
                        reservation.telephone && m(Text, {
                            fontSize: '0.75rem',
                            margin: 0
                        }, reservation.telephone)
                    ])
                ])
            ]),
            m(FlexRow, {
                alignItems: 'center',
                gap: '1rem',
                flexShrink: 0,
                style: { textAlign: 'right' }
            }, [
                m(FlexCol, {
                    alignItems: 'flex-end',
                    gap: '0.25rem'
                }, [
                    m(Text, {
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#1e293b',
                        margin: 0
                    }, formatDate(reservation.date)),
                    reservation.time && m(Text, {
                        fontSize: '0.75rem',
                        color: '#64748b',
                        margin: 0
                    }, reservation.time)
                ]),
                m(FlexRow, {
                    gap: '0.5rem',
                    alignItems: 'center',
                    flexShrink: 0
                }, [
                    reservation.turn && m(Label, {
                        type: 'tertiary',
                        size: 'small',
                        style: {
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px'
                        }
                    }, reservation.maskedTurn || reservation.turn),
                    m(Label, {
                        type: 'tertiary',
                        size: 'small',
                        style: {
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px'
                        }
                    }, `${reservation.seats}p`)
                ]),
                m('span', {
                    class: 'material-icons',
                    style: {
                        fontSize: '18px',
                        color: '#cbd5e1',
                        flexShrink: 0
                    }
                }, 'chevron_right')
            ])
        ]);
    }
};

// Helper function to extract reservations from appointments data
function extractReservations(appointmentsData) {
    if (!appointmentsData || !appointmentsData.slots) {
        return [];
    }
    
    const reservations = [];
    
    appointmentsData.slots.forEach(slot => {
        // Parse date properly - slot.date can be a timestamp or ISO date string
        let slotDate = null;
        try {
            if (slot.date) {
                if (typeof slot.date === 'number') {
                    slotDate = new Date(slot.date);
                } else if (typeof slot.date === 'string') {
                    // Handle ISO string format like "2025-10-29T09:48:09.827Z"
                    slotDate = new Date(slot.date);
                } else {
                    slotDate = new Date(slot.date);
                }
                // Validate date
                if (isNaN(slotDate.getTime())) {
                    console.warn('Invalid slot date:', slot.date);
                    slotDate = null;
                }
            }
        } catch (e) {
            console.warn('Error parsing slot date:', slot.date, e);
            slotDate = null;
        }
        
        // Confirmed appointments
        if (slot.appointments && slot.appointments.length > 0) {
            slot.appointments.forEach(app => {
                // Extract user name with better fallback
                let userName = '';
                if (app.user) {
                    const firstName = (app.user.firstName || '').trim();
                    const lastName = (app.user.lastName || '').trim();
                    userName = `${firstName} ${lastName}`.trim();
                }
                // Fallback if still empty
                if (!userName && app.user?.username) {
                    userName = app.user.username.trim();
                }
                if (!userName && app.user?.email) {
                    userName = app.user.email.split('@')[0].trim();
                }
                if (!userName) {
                    // Debug: log if user object exists but name is missing
                    if (app.user) {
                        console.warn('User object exists but no name found:', app.user);
                    }
                    userName = 'Sin nombre';
                }
                
                reservations.push({
                    id: app._id,
                    userName: userName,
                    email: app.user?.email,
                    telephone: app.user?.telephone,
                    date: slotDate,
                    time: slot.title || '',
                    seats: app.seats || 1,
                    turn: app.turn,
                    maskedTurn: app.maskedTurn,
                    status: app.confirmed !== false ? 'confirmed' : 'pending', // Default to confirmed if not explicitly false
                    isPaid: app.isPaid,
                    timestamp: app.timestamp,
                    slot: slot,
                    appointment: app
                });
            });
        }
        
        // Pending appointments
        if (slot.pendingAppointments && slot.pendingAppointments.length > 0) {
            slot.pendingAppointments.forEach(app => {
                // Extract user name with better fallback
                let userName = '';
                if (app.user) {
                    const firstName = app.user.firstName || '';
                    const lastName = app.user.lastName || '';
                    userName = `${firstName} ${lastName}`.trim();
                }
                if (!userName && app.user?.username) {
                    userName = app.user.username;
                }
                if (!userName && app.user?.email) {
                    userName = app.user.email.split('@')[0];
                }
                if (!userName) {
                    userName = 'Sin nombre';
                }
                
                reservations.push({
                    id: app._id,
                    userName: userName,
                    email: app.user?.email,
                    telephone: app.user?.telephone,
                    date: slotDate,
                    time: slot.title || '',
                    seats: app.seats || 1,
                    turn: app.turn,
                    maskedTurn: app.maskedTurn,
                    status: 'pending',
                    isPaid: app.isPaid,
                    timestamp: app.timestamp,
                    slot: slot,
                    appointment: app
                });
            });
        }
        
        // Canceled appointments
        if (slot.canceledAppointments && slot.canceledAppointments.length > 0) {
            slot.canceledAppointments.forEach(app => {
                // Extract user name with better fallback
                let userName = '';
                if (app.user) {
                    const firstName = app.user.firstName || '';
                    const lastName = app.user.lastName || '';
                    userName = `${firstName} ${lastName}`.trim();
                }
                if (!userName && app.user?.username) {
                    userName = app.user.username;
                }
                if (!userName && app.user?.email) {
                    userName = app.user.email.split('@')[0];
                }
                if (!userName) {
                    userName = 'Sin nombre';
                }
                
                reservations.push({
                    id: app._id,
                    userName: userName,
                    email: app.user?.email,
                    telephone: app.user?.telephone,
                    date: slotDate,
                    time: slot.title || '',
                    seats: app.seats || 1,
                    turn: app.turn,
                    maskedTurn: app.maskedTurn,
                    status: 'canceled',
                    isPaid: app.isPaid,
                    timestamp: app.timestamp,
                    slot: slot,
                    appointment: app
                });
            });
        }
    });
    
    // Sort by date (most recent first)
    reservations.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : (a.date || new Date(0));
        const dateB = b.timestamp ? new Date(b.timestamp) : (b.date || new Date(0));
        return dateB - dateA;
    });
    
    return reservations;
}

// Helper function to format date
function formatDate(date) {
    if (!date) return 'Sin fecha';
    try {
        let d;
        if (date instanceof Date) {
            d = date;
        } else if (typeof date === 'number') {
            d = new Date(date);
        } else if (typeof date === 'string') {
            d = new Date(date);
        } else {
            return 'Sin fecha';
        }
        
        if (isNaN(d.getTime())) {
            return 'Sin fecha';
        }
        
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return d.toLocaleDateString('es-ES', options);
    } catch (e) {
        return 'Sin fecha';
    }
}

// Reservation Sidebar Component
const ReservationSidebar = {
    view: (vnode) => {
        const { reservation, onClose } = vnode.attrs;
        const statusColors = {
            confirmed: { bg: '#dcfce7', text: '#166534', label: 'Confirmada' },
            pending: { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
            canceled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelada' }
        };
        const status = statusColors[reservation.status] || statusColors.confirmed;
        
        return m(Modal, {
            size: 'medium',
            close: onClose
        }, [
            m(ModalHeader, [
                m(FlexRow, {
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                }, [
                    m(H2, { marginTop: 0, marginBottom: 0 }, 'Detalles de la Reserva'),
                    m(Button, {
                        type: 'default',
                        onclick: onClose,
                        style: {
                            padding: '0.5rem',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }
                    }, [
                        m(Icon, { icon: 'close', size: 'small' })
                    ])
                ])
            ]),
            m(ModalContent, {
                style: {
                    maxHeight: '70vh',
                    overflowY: 'auto'
                }
            }, [
                m(FlexCol, {
                    gap: '1.5rem'
                }, [
                    // Status Badge
                    m(FlexRow, {
                        alignItems: 'center',
                        gap: '0.75rem'
                    }, [
                        m(Label, {
                            type: reservation.status === 'confirmed' ? 'positive' : 
                                  reservation.status === 'pending' ? 'warning' : 'negative',
                            size: 'default',
                            style: {
                                fontSize: '0.875rem',
                                padding: '0.5rem 1rem',
                                borderRadius: '9999px'
                            }
                        }, status.label)
                    ]),
                    
                    // User Information
                    m(Segment, {
                        type: 'primary',
                        style: {
                            padding: '1rem',
                            backgroundColor: '#f8fafc'
                        }
                    }, [
                        m(H2, {
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '1rem',
                            marginTop: 0
                        }, 'Información del Usuario'),
                        m(FlexCol, {
                            gap: '0.75rem'
                        }, [
                            m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'person'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, reservation.userName || 'Sin nombre')
                            ]),
                            reservation.email && m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'email'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, reservation.email)
                            ]),
                            reservation.telephone && m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'phone'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, reservation.telephone)
                            ])
                        ])
                    ]),
                    
                    // Reservation Details
                    m(Segment, {
                        type: 'primary',
                        style: {
                            padding: '1rem',
                            backgroundColor: '#f8fafc'
                        }
                    }, [
                        m(H2, {
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '1rem',
                            marginTop: 0
                        }, 'Detalles de la Reserva'),
                        m(FlexCol, {
                            gap: '0.75rem'
                        }, [
                            m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'event'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, formatDate(reservation.date))
                            ]),
                            reservation.time && m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'schedule'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, reservation.time)
                            ]),
                            reservation.turn && m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'confirmation_number'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, `Turno: ${reservation.maskedTurn || reservation.turn}`)
                            ]),
                            m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'event_seat'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0
                                }, `${reservation.seats} plaza${reservation.seats !== 1 ? 's' : ''}`)
                            ]),
                            reservation.isPaid !== undefined && m(FlexRow, {
                                gap: '0.5rem',
                                alignItems: 'center'
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: reservation.isPaid ? '#22c55e' : '#ef4444' }
                                }, 'credit_card'),
                                m(Text, {
                                    fontSize: '0.875rem',
                                    margin: 0,
                                    color: reservation.isPaid ? '#22c55e' : '#ef4444'
                                }, reservation.isPaid ? 'Pagado' : 'No pagado')
                            ])
                        ])
                    ])
                ])
            ]),
            m(ModalFooter, [
                m(Button, {
                    type: 'default',
                    onclick: () => {
                        // TODO: Implementar acciones
                        console.log('Editar reserva:', reservation.id);
                    }
                }, 'Editar'),
                m(Button, {
                    type: 'negative',
                    onclick: () => {
                        if (confirm('¿Estás seguro de que quieres cancelar esta reserva?')) {
                            // TODO: Implementar cancelación
                            console.log('Cancelar reserva:', reservation.id);
                        }
                    }
                }, 'Cancelar Reserva'),
                m(Button, {
                    type: 'default',
                    onclick: onClose
                }, 'Cerrar')
            ])
        ]);
    }
};


function initializeChart(stats, container) {
    // Si container es el elemento directamente, usarlo; si no, buscar el contenedor
    let chartContainer = container;
    if (container.id !== 'chart-container') {
        chartContainer = container.querySelector('#chart-container');
    }
    
    if (!chartContainer) {
        console.warn('Chart container not found');
        return;
    }
    
    // Limpiar cualquier contenido previo
    chartContainer.innerHTML = '';

    const confirmed = stats.confirmedAppointments || 0;
    const pending = stats.pendingAppointments || 0;
    const canceled = stats.canceledAppointments || 0;

    const hasData = confirmed > 0 || pending > 0 || canceled > 0;

    if (!hasData) {
        chartContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 200px; color: #94a3b8;">
                <div style="text-align: center;">
                    <i class="fa-solid fa-chart-pie" style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
                    <p style="font-size: 0.875rem; color: #94a3b8;">No hay datos de citas disponibles</p>
                </div>
            </div>
        `;
        return;
    }

    const data = {
        labels: ["Confirmades", "Pendents", "Cancel·lades"],
        datasets: [
            { values: [confirmed, pending, canceled] }
        ]
    };

    if (window.frappe && window.frappe.Chart) {
        new frappe.Chart(chartContainer, {
            data: data,
            type: 'pie',
            height: 200,
            colors: ['#22c55e', '#f59e0b', '#ef4444']
        });
    }
}

