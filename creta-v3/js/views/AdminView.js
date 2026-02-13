// Admin View Component using Mithril and DView

import { FlexCol, FlexRow, Grid, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Card, Label, Segment } from '../../../DView/elements.js';
import { Input, Switch } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../DView/dialogs.js';
import { ResourceViewHeader } from '../components/ResourceViewHeader.js';
import { fetchAppointments, calculateStats, getDateRange } from '../api.js';
import { ensureSidebarHTML } from '../components/SlotSidebar.js';
import { formatDate } from '../utils/dateUtils.js';
import { extractReservations } from '../utils/reservationUtils.js';
import { initializeChart } from '../utils/chartUtils.js';

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

        return m(FlexCol, { gap: 0, style: { flex: 1 } }, [
            m(ResourceViewHeader, { resource }),
            m('div', {
                class: 'admin-resource-layout',
                style: {
                    display: 'grid',
                    gap: '1.5rem',
                    flex: 1,
                    minWidth: 0,
                    width: '100%'
                }
            }, [
                renderSidebar(resource, state.stats, state.appointmentsData),
                renderScheduleGrid(resource, state.appointmentsData)
            ])
        ]);
    }
};

const sidebarActions = [
    { label: 'Calendari cites', icon: 'event', color: '#2563eb', route: 'calendar' },
    { label: 'Gestionar Horaris', icon: 'schedule', color: '#7c3aed', route: null },
    { label: 'Imprimir reserves', icon: 'print', color: '#b45309', route: null },
    { label: 'Ajustos del recurs', icon: 'settings', color: '#059669', route: 'settings' },
    { label: 'Admin Torns', icon: 'people', color: '#0d9488', route: null }
];

function renderSidebar(resource, stats, appointmentsData) {
    return m(FlexCol, {
        style: { minWidth: 0, gap: '2rem' }
    }, [
        // Tarjeta: Imagen + KPIs + Chart
        m(Div, {
            style: {
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
            }
        }, [
            m(Div, {
                style: {
                    height: '128px',
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }
            }, [
                m('img', {
                    src: resource.photo || 'https://via.placeholder.com/400x300',
                    alt: resource.name,
                    style: {
                        maxHeight: '100%',
                        width: 'auto',
                        objectFit: 'contain'
                    },
                    onerror: (e) => {
                        e.target.style.display = 'none';
                    }
                })
            ]),
            m(Div, {
                style: {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    borderTop: '1px solid #f3f4f6',
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: 'rgba(249, 250, 251, 0.5)'
                }
            }, [
                m(Div, {
                    style: {
                        padding: '0.75rem',
                        textAlign: 'center',
                        borderRight: '1px solid #f3f4f6'
                    }
                }, [
                    m(Text, { fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }, stats.totalSlots),
                    m(SmallText, { fontSize: '0.625rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, margin: 0 }, 'Slots')
                ]),
                m(Div, {
                    style: {
                        padding: '0.75rem',
                        textAlign: 'center',
                        borderRight: '1px solid #f3f4f6'
                    }
                }, [
                    m(Text, { fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }, stats.confirmedAppointments),
                    m(SmallText, { fontSize: '0.625rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, margin: 0 }, 'Reservas')
                ]),
                m(Div, {
                    style: {
                        padding: '0.75rem',
                        textAlign: 'center'
                    }
                }, [
                    m(Text, { fontSize: '1.125rem', fontWeight: 'bold', color: '#059669', margin: 0 }, stats.availableSeats),
                    m(SmallText, { fontSize: '0.625rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, margin: 0 }, 'Libres')
                ])
            ]),
            m(Div, {
                style: {
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    alignItems: 'center'
                }
            }, [
                m('div', {
                    id: 'chart-container',
                    style: {
                        minHeight: '60px'
                    }
                }),
                m(FlexCol, {
                    style: { gap: '0.25rem', minWidth: 0 }
                }, [
                    m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
                        m(Div, { style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' } }),
                        m(SmallText, { fontSize: '0.75rem', color: '#4b5563', margin: 0 }, 'Confirmades')
                    ]),
                    m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
                        m(Div, { style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' } }),
                        m(SmallText, { fontSize: '0.75rem', color: '#4b5563', margin: 0 }, 'Pendents')
                    ]),
                    m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
                        m(Div, { style: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' } }),
                        m(SmallText, { fontSize: '0.75rem', color: '#4b5563', margin: 0 }, 'Cancel·lades')
                    ])
                ])
            ])
        ]),

        // Configuración (flags)
        m(Div, {
            style: {
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                padding: '1rem'
            }
        }, [
            m(SmallText, {
                style: {
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.75rem',
                    display: 'block'
                }
            }, 'Configuració'),
            m(FlexRow, {
                gap: '0.5rem',
                flexWrap: 'wrap'
            }, [
                m(Div, {
                    style: {
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        fontSize: '0.75rem',
                        color: '#4b5563',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }
                }, [
                    m(Icon, { icon: 'check_circle', size: 'small', style: { fontSize: '12px' } }),
                    'Autoconfirmat'
                ]),
                m(Div, {
                    style: {
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        fontSize: '0.75rem',
                        color: '#4b5563',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    }
                }, [
                    m(Icon, { icon: 'event_seat', size: 'small', style: { fontSize: '12px' } }),
                    `${resource.seats?.total ?? 0} Seient`
                ])
            ])
        ]),

        // Botonera de acciones (vertical)
        m(Div, {
            style: {
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
            }
        }, [
            m(Div, { style: { padding: '0.25rem' } }, sidebarActions.map(action =>
                m(Tappable, {
                    onclick: () => {
                        if (action.route === 'calendar' && resource?._id) {
                            m.route.set(`/resource/${resource._id}/calendar`);
                        } else if (action.route === 'settings' && resource?._id) {
                            m.route.set(`/resource/${resource._id}/settings`);
                        }
                    },
                    style: {
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        color: '#374151',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left'
                    },
                    hover: {
                        backgroundColor: '#f9fafb',
                        color: action.color
                    }
                }, [
                    m(Div, {
                        style: {
                            width: '32px',
                            height: '32px',
                            borderRadius: '0.5rem',
                            backgroundColor: `${action.color}20`,
                            color: action.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }
                    }, m(Icon, { icon: action.icon, size: 'small', style: { fontSize: '16px' } })),
                    m(Text, { fontSize: '0.875rem', margin: 0 }, action.label)
                ])
            ))
        ])
    ]);
}

function renderScheduleGrid(resource, appointmentsData) {
    // Reservas agrupadas por slot para todos los tipos de recurso
    window.currentAppointmentsData = appointmentsData;
    ensureSidebarHTML();

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
        vnode.state.filterStatus = 'confirmed'; // 'all', 'confirmed', 'pending', 'canceled' - default to confirmed
        vnode.state.showPast = false; // Show only future reservations by default
        vnode.state.allReservations = extractReservations(vnode.attrs.appointmentsData);
        vnode.state.currentPage = 1;
        vnode.state.itemsPerPage = 10; // Grupos de slots por página
        vnode.state.selectedReservation = null;
        vnode.state.viewMode = 'list'; // 'list' | 'cards'
    },
    
    view: (vnode) => {
        const { resource, appointmentsData } = vnode.attrs;
        const state = vnode.state;
        
        // Filter reservations
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today
        
        let filteredReservations = state.allReservations.filter(reservation => {
            // Date filter (future/past)
            if (!state.showPast && reservation.date) {
                const reservationDate = new Date(reservation.date);
                reservationDate.setHours(0, 0, 0, 0);
                if (reservationDate < now) {
                    return false; // Hide past reservations if showPast is false
                }
            }
            
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

        // Agrupar reservas por slot
        const reservationsBySlot = {};
        filteredReservations.forEach(reservation => {
            const slot = reservation.slot;
            const slotKey = slot?._id || (slot?.start ? `${slot.start}-${slot?.title || ''}` : 'no-slot');
            if (!reservationsBySlot[slotKey]) {
                reservationsBySlot[slotKey] = { slot, reservations: [] };
            }
            reservationsBySlot[slotKey].reservations.push(reservation);
        });

        // Ordenar grupos por fecha del slot (más cercano primero)
        const slotGroups = Object.values(reservationsBySlot).sort((a, b) => {
            const dateA = a.slot?.start ? new Date(a.slot.start) : new Date(0);
            const dateB = b.slot?.start ? new Date(b.slot.start) : new Date(0);
            return dateA - dateB;
        });

        const paginatedGroups = slotGroups.slice(
            (state.currentPage - 1) * state.itemsPerPage,
            state.currentPage * state.itemsPerPage
        );

        // Vista tarjetas: slots filtrados y agrupados por fecha
        const filteredSlots = (appointmentsData?.slots || []).filter(slot => {
            if (!state.showPast && slot.start) {
                const slotDate = new Date(slot.start);
                slotDate.setHours(0, 0, 0, 0);
                if (slotDate < now) return false;
            }
            if (state.searchTerm) {
                const searchLower = state.searchTerm.toLowerCase();
                const slotTitle = (slot.title || '').toLowerCase();
                const slotDateStr = slot.start ? formatDate(new Date(slot.start)) : '';
                if (!slotTitle.includes(searchLower) && !slotDateStr.toLowerCase().includes(searchLower)) return false;
            }
            return true;
        });
        filteredSlots.sort((a, b) => {
            const dA = a.start ? new Date(a.start) : new Date(0);
            const dB = b.start ? new Date(b.start) : new Date(0);
            return dA - dB;
        });
        const slotsByDate = {};
        filteredSlots.forEach(slot => {
            const isoMatch = slot.start?.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const dateKey = isoMatch ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : 'no-date';
            if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
            slotsByDate[dateKey].push(slot);
        });
        const slotDateGroups = Object.keys(slotsByDate).sort((a, b) => {
            if (a === 'no-date') return 1;
            if (b === 'no-date') return -1;
            return a.localeCompare(b);
        });
        const paginatedSlotGroups = slotDateGroups.slice(
            (state.currentPage - 1) * state.itemsPerPage,
            state.currentPage * state.itemsPerPage
        );

        return m(FlexCol, {
            gap: '1.5rem'
        }, [
            // Reservation Sidebar (o fragmento vacío para evitar hole)
            state.selectedReservation
                ? m(ReservationSidebar, {
                    key: 'sidebar',
                    reservation: state.selectedReservation,
                    onClose: () => {
                        state.selectedReservation = null;
                        m.redraw();
                    }
                })
                : m.fragment({ key: 'sidebar' }),
            // Header
            m(FlexRow, {
                key: 'header',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }, [
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap'
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
                    }, state.viewMode === 'list'
                        ? `${filteredReservations.length} reserva${filteredReservations.length !== 1 ? 's' : ''}`
                        : `${filteredSlots.length} slot${filteredSlots.length !== 1 ? 's' : ''}`)
                ]),
                m(Button, {
                    type: 'default',
                    title: 'Imprimir reservas',
                    onclick: () => {
                        // TODO: Implementar impresión de reservas filtradas
                        console.log('Imprimir reservas:', filteredReservations);
                    },
                    style: {
                        backgroundColor: '#b45309',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem',
                        borderRadius: '0.5rem',
                        boxShadow: '0 2px 4px 0 rgba(180, 83, 9, 0.2)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    },
                    hover: {
                        backgroundColor: '#92400e',
                        boxShadow: '0 4px 12px 0 rgba(180, 83, 9, 0.3)',
                        transform: 'translateY(-1px)'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '18px',
                            color: 'white',
                            userSelect: 'none',
                            opacity: 1
                        },
                        oncreate: (vnode) => {
                            vnode.dom.style.setProperty('color', 'white', 'important');
                        }
                    }, 'print')
                ])
            ]),
            // Search and Filters
            m(FlexRow, {
                key: 'filters',
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
                
                // Show Past Toggle
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem',
                    style: {
                        backgroundColor: '#f1f5f9',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0'
                    }
                }, [
                    m(Switch, {
                        isActive: state.showPast,
                        onchange: () => {
                            state.showPast = !state.showPast;
                            state.currentPage = 1; // Reset to first page
                            m.redraw();
                        }
                    }),
                    m(SmallText, {
                        fontSize: '0.875rem',
                        margin: 0,
                        cursor: 'pointer',
                        onclick: () => {
                            state.showPast = !state.showPast;
                            state.currentPage = 1;
                            m.redraw();
                        }
                    }, 'Mostrar pasadas')
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
                ]),

                // Vista: Listado / Tarjetas
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.25rem',
                    style: {
                        backgroundColor: '#f1f5f9',
                        padding: '0.25rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0'
                    }
                }, [
                    m(Tappable, {
                        title: 'Vista listado (reservas por slot)',
                        onclick: () => {
                            state.viewMode = 'list';
                            state.currentPage = 1;
                            m.redraw();
                        },
                        style: {
                            padding: '0.375rem 0.5rem',
                            borderRadius: '0.375rem',
                            backgroundColor: state.viewMode === 'list' ? '#e2e8f0' : 'transparent',
                            color: state.viewMode === 'list' ? '#1e293b' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }
                    }, m(Icon, { icon: 'list', size: 'small', style: { fontSize: '18px' } })),
                    m(Tappable, {
                        title: 'Vista tarjetas (slots)',
                        onclick: () => {
                            state.viewMode = 'cards';
                            state.currentPage = 1;
                            m.redraw();
                        },
                        style: {
                            padding: '0.375rem 0.5rem',
                            borderRadius: '0.375rem',
                            backgroundColor: state.viewMode === 'cards' ? '#e2e8f0' : 'transparent',
                            color: state.viewMode === 'cards' ? '#1e293b' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }
                    }, m(Icon, { icon: 'view_module', size: 'small', style: { fontSize: '18px' } }))
                ])
            ]),
            
            // Reservations List (agrupadas por slot) o Tarjetas de slots
            (state.viewMode === 'list' ? slotGroups.length > 0 : filteredSlots.length > 0)
                ? m(FlexCol, {
                key: `content-${state.viewMode}`,
                gap: '0',
                style: {
                    marginTop: '1rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    overflow: 'hidden'
                }
            }, state.viewMode === 'list'
                ? paginatedGroups.map((group, groupIndex) => {
                    const { slot, reservations } = group;
                    const slotKey = slot?._id || (slot?.start ? `${slot.start}-${slot?.title || ''}` : 'no-slot');
                    const startDate = slot?.start ? new Date(slot.start) : null;
                    const endDate = slot?.end ? new Date(slot.end) : null;
                    const isLastGroup = groupIndex === paginatedGroups.length - 1;

                    return m(FlexCol, {
                        key: slotKey,
                        gap: 0
                    }, [
                        m(Div, {
                            key: `header-${slotKey}`,
                            onclick: () => {
                                if (slot?._id && window.openSlotDetails) {
                                    window.openSlotDetails(slot._id);
                                }
                            },
                            style: {
                                padding: '0.75rem 1rem',
                                backgroundColor: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                borderTop: groupIndex > 0 ? '1px solid #e2e8f0' : 'none',
                                cursor: slot?._id ? 'pointer' : 'default'
                            },
                            onmouseenter: (e) => {
                                if (slot?._id) e.currentTarget.style.backgroundColor = '#f1f5f9';
                            },
                            onmouseleave: (e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                            }
                        }, [
                            m(Text, {
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#475569',
                                margin: 0,
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap'
                                }
                            }, [
                                m('span', {
                                    class: 'material-icons',
                                    style: { fontSize: '18px', color: '#64748b' }
                                }, 'calendar_today'),
                                startDate ? formatDate(startDate) : 'Sin fecha',
                                startDate && endDate && m(Text, {
                                    fontSize: '0.875rem',
                                    padding: '0 0.5rem',
                                    color: '#64748b',
                                    margin: 0
                                }, '·'),
                                startDate && endDate && m(Text, {
                                    fontSize: '0.875rem',
                                    color: '#64748b',
                                    margin: 0
                                }, `${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`),
                                slot?.title && m(Text, {
                                    fontSize: '0.875rem',
                                    color: '#64748b',
                                    margin: 0
                                }, `· ${slot.title}`)
                            ])
                        ]),
                        ...reservations.map((reservation, resIndex) =>
                            m(ReservationCard, {
                                key: reservation.id || `${slotKey}-${resIndex}`,
                                reservation,
                                isLast: isLastGroup && resIndex === reservations.length - 1,
                                onclick: () => {
                                    state.selectedReservation = reservation;
                                    m.redraw();
                                }
                            })
                        )
                    ]);
                })
                : paginatedSlotGroups.map((dateKey, groupIndex) => {
                    const dateSlots = slotsByDate[dateKey];
                    const [y, mo, d] = dateKey === 'no-date' ? [null, null, null] : dateKey.split('-').map(Number);
                    const dateObj = dateKey !== 'no-date' ? new Date(y, mo - 1, d) : null;
                    const isLastGroup = groupIndex === paginatedSlotGroups.length - 1;

                    return m(FlexCol, {
                        key: dateKey,
                        gap: 0
                    }, [
                        m(Div, {
                            key: `date-${dateKey}`,
                            style: {
                                padding: '0.75rem 1rem',
                                backgroundColor: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                borderTop: groupIndex > 0 ? '1px solid #e2e8f0' : 'none'
                            }
                        }, [
                            m(Text, {
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#475569',
                                margin: 0,
                                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
                            }, [
                                m('span', { class: 'material-icons', style: { fontSize: '18px', color: '#64748b' } }, 'calendar_today'),
                                dateObj ? formatDate(dateObj) : 'Sin fecha'
                            ])
                        ]),
                        ...dateSlots.map((slot, slotIndex) =>
                            m(SlotCard, {
                                key: slot._id || `slot-${dateKey}-${slotIndex}`,
                                slot,
                                resource,
                                isLast: isLastGroup && slotIndex === dateSlots.length - 1
                            })
                        )
                    ]);
                })
            ) : m(Div, {
                key: 'content-empty',
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
                }, state.viewMode === 'list' ? 'No se encontraron reservas' : 'No se encontraron slots')
            ]),
            
            // Pagination Info (o fragmento vacío para evitar hole)
            ((state.viewMode === 'list' && slotGroups.length > 0) || (state.viewMode === 'cards' && filteredSlots.length > 0))
                ? m(FlexRow, {
                key: 'pagination',
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
                }, state.viewMode === 'list'
                    ? `${filteredReservations.length} reserva${filteredReservations.length !== 1 ? 's' : ''} en ${slotGroups.length} slot${slotGroups.length !== 1 ? 's' : ''} · Página ${state.currentPage} de ${Math.ceil(slotGroups.length / state.itemsPerPage)}`
                    : `${filteredSlots.length} slot${filteredSlots.length !== 1 ? 's' : ''} en ${slotDateGroups.length} fecha${slotDateGroups.length !== 1 ? 's' : ''} · Página ${state.currentPage} de ${Math.ceil(slotDateGroups.length / state.itemsPerPage)}`),
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
                    m(Button, {
                        type: 'default',
                        size: 'small',
                        onclick: () => {
                            const totalGroups = state.viewMode === 'list' ? slotGroups.length : slotDateGroups.length;
                            const maxPage = Math.ceil(totalGroups / state.itemsPerPage);
                            if (state.currentPage < maxPage) {
                                state.currentPage++;
                                m.redraw();
                            }
                        },
                        disabled: state.currentPage >= Math.ceil((state.viewMode === 'list' ? slotGroups.length : slotDateGroups.length) / state.itemsPerPage),
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            opacity: state.currentPage >= Math.ceil((state.viewMode === 'list' ? slotGroups.length : slotDateGroups.length) / state.itemsPerPage) ? 0.5 : 1,
                            cursor: state.currentPage >= Math.ceil((state.viewMode === 'list' ? slotGroups.length : slotDateGroups.length) / state.itemsPerPage) ? 'not-allowed' : 'pointer'
                        }
                    }, 'Siguiente')
                ])
            ])
                : m.fragment({ key: 'pagination' })
        ]);
    }
};

// Slot Card Component (vista tarjetas)
const SlotCard = {
    view: (vnode) => {
        const { slot, resource, isLast } = vnode.attrs;
        const startDate = slot.start ? new Date(slot.start) : null;
        const endDate = slot.end ? new Date(slot.end) : null;
        const totalSeats = slot.seats?.total || 0;
        const remainingSeats = slot.seats?.remaining || 0;
        const bookedSeats = totalSeats - remainingSeats;
        let statusLabel = 'Disponible';
        if (remainingSeats === 0) statusLabel = 'Completo';
        else if (totalSeats > 0 && remainingSeats <= totalSeats * 0.2) statusLabel = 'Casi completo';

        return m(Div, {
            onclick: () => {
                if (slot._id && window.openSlotDetails) window.openSlotDetails(slot._id);
            },
            style: {
                padding: '1rem',
                backgroundColor: 'white',
                borderBottom: isLast ? 'none' : '1px solid #e2e8f0',
                borderLeft: '3px solid transparent',
                transition: 'all 0.2s ease',
                cursor: slot._id ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
            },
            onmouseenter: (e) => {
                if (slot._id) {
                    e.currentTarget.style.backgroundColor = '#f0f9ff';
                    e.currentTarget.style.borderLeftColor = '#2563eb';
                }
            },
            onmouseleave: (e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderLeftColor = 'transparent';
            }
        }, [
            m(FlexRow, {
                alignItems: 'center',
                gap: '1rem',
                flex: 1,
                style: { minWidth: 0 }
            }, [
                m(FlexCol, {
                    gap: '0.25rem',
                    style: { minWidth: 0, flex: 1 }
                }, [
                    m(Text, {
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        margin: 0,
                        style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }, slot.title || 'Sin título'),
                    startDate && endDate && m(Text, {
                        fontSize: '0.75rem',
                        margin: 0,
                        color: '#64748b'
                    }, [
                        m('span', { class: 'material-icons', style: { fontSize: '14px', verticalAlign: 'middle', marginRight: '0.25rem' } }, 'schedule'),
                        `${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                    ])
                ])
            ]),
            m(FlexRow, {
                alignItems: 'center',
                gap: '1rem',
                flexShrink: 0
            }, [
                m(FlexCol, {
                    alignItems: 'flex-end',
                    gap: '0.25rem'
                }, [
                    m(Label, {
                        type: remainingSeats === 0 ? 'negative' : remainingSeats <= totalSeats * 0.2 ? 'warning' : 'positive',
                        size: 'small',
                        style: { fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '9999px' }
                    }, statusLabel),
                    m(Text, {
                        fontSize: '0.75rem',
                        color: '#64748b',
                        margin: 0
                    }, `${bookedSeats}/${totalSeats} plazas`)
                ]),
                m('span', {
                    class: 'material-icons',
                    style: { fontSize: '18px', color: '#cbd5e1', flexShrink: 0 }
                }, 'chevron_right')
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

// Helper functions moved to shared modules:
// - extractReservations -> utils/reservationUtils.js
// - formatDate -> utils/dateUtils.js

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


// initializeChart moved to utils/chartUtils.js

