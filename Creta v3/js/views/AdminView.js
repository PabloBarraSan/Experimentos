// Admin View Component using Mithril and DView

import { FlexCol, FlexRow, Grid, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Card, Label, Segment } from '../../../DView/elements.js';
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
                }
            }, 100);
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
                m(Text, { style: { color: '#64748b' } }, 'Cargando datos de administración...')
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
    return m(Segment, {
        type: 'primary',
        style: { padding: '1.5rem', marginBottom: '1.5rem' }
    }, [
        m(FlexCol, {
            gap: '1rem',
            style: {
                '@media (min-width: 768px)': {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }
            }
        }, [
            m(FlexCol, { gap: '0.5rem' }, [
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }, [
                    m(H1, {
                        style: {
                            fontSize: '1.875rem',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            margin: 0
                        }
                    }, resource.title || resource.name),
                    resource.subtitle && m(Label, {
                        type: 'secondary',
                        size: 'default',
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px'
                        }
                    }, resource.subtitle)
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
        ])
    ]);
}

function renderContent(resource, stats, appointmentsData) {
    return m(Segment, {
        type: 'primary',
        style: { padding: '1.5rem' }
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
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        aspectRatio: '16/9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8fafc',
                        marginBottom: '1rem'
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
                        lineHeight: '1.5'
                    }
                }, m.trust(resource.description?.und || '<p>Sin descripción</p>'))
            ]),
            
            // Right Column: Stats, Chart, Buttons
            m(FlexCol, {
                style: {
                    gridColumn: 'span 1',
                    '@media (min-width: 1024px)': { gridColumn: 'span 2' }
                },
                gap: '1.5rem'
            }, [
                // Stats Cards
                m(Grid, {
                    columns: 3,
                    style: { gap: '1rem' }
                }, [
                    m(Card, {
                        style: {
                            backgroundColor: '#f8fafc',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                        }
                    }, [
                        m(Text, {
                            style: {
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                marginBottom: '0.25rem'
                            }
                        }, stats.totalSlots),
                        m(SmallText, {
                            style: {
                                fontSize: '0.75rem',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }
                        }, 'Slots')
                    ]),
                    m(Card, {
                        style: {
                            backgroundColor: '#f8fafc',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                        }
                    }, [
                        m(Text, {
                            style: {
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                marginBottom: '0.25rem'
                            }
                        }, stats.confirmedAppointments),
                        m(SmallText, {
                            style: {
                                fontSize: '0.75rem',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }
                        }, 'Reservas')
                    ]),
                    m(Card, {
                        style: {
                            backgroundColor: '#f8fafc',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                        }
                    }, [
                        m(Text, {
                            style: {
                                fontSize: '1.5rem',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                marginBottom: '0.25rem'
                            }
                        }, stats.availableSeats),
                        m(SmallText, {
                            style: {
                                fontSize: '0.75rem',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }
                        }, 'Disponibles')
                    ])
                ]),
                
                // Chart & Actions Row
                m(Grid, {
                    columns: {
                        mobile: 1,
                        tablet: 1,
                        computer: 3
                    },
                    style: { gap: '1.5rem' }
                }, [
                    // Chart
                    m(Div, {
                        style: {
                            gridColumn: 'span 1',
                            '@media (min-width: 768px)': { gridColumn: 'span 2' }
                        }
                    }, [
                        m(Segment, {
                            type: 'primary',
                            style: {
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #e2e8f0'
                            }
                        }, [
                            m('div', { id: 'chart-container' })
                        ])
                    ]),
                    
                    // Action Buttons
                    m(FlexCol, {
                        gap: '0.5rem',
                        style: {
                            gridColumn: 'span 1'
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
                                padding: '0.75rem 1rem'
                            }
                        }, [
                            m(Icon, { icon: 'event', size: 'small', style: { marginRight: '0.75rem' } }),
                            m(Text, { style: { fontSize: '0.875rem' } }, 'Calendari cites')
                        ]),
                        m(Button, {
                            type: 'default',
                            fluid: true,
                            onclick: () => {},
                            style: {
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                borderColor: '#7c3aed',
                                justifyContent: 'flex-start',
                                padding: '0.75rem 1rem'
                            },
                            hover: {
                                backgroundColor: '#6d28d9'
                            }
                        }, [
                            m(Icon, { icon: 'schedule', size: 'small', style: { marginRight: '0.75rem' } }),
                            m(Text, { style: { fontSize: '0.875rem' } }, 'Gestionar Horaris')
                        ]),
                        m(Button, {
                            type: 'default',
                            fluid: true,
                            onclick: () => {},
                            style: {
                                backgroundColor: '#b45309',
                                color: 'white',
                                borderColor: '#b45309',
                                justifyContent: 'flex-start',
                                padding: '0.75rem 1rem'
                            },
                            hover: {
                                backgroundColor: '#92400e'
                            }
                        }, [
                            m(Icon, { icon: 'print', size: 'small', style: { marginRight: '0.75rem' } }),
                            m(Text, { style: { fontSize: '0.875rem' } }, 'Imprimir reserves')
                        ]),
                        m(Button, {
                            type: 'positive',
                            fluid: true,
                            onclick: () => {},
                            style: {
                                justifyContent: 'flex-start',
                                padding: '0.75rem 1rem'
                            }
                        }, [
                            m(Icon, { icon: 'settings', size: 'small', style: { marginRight: '0.75rem' } }),
                            m(Text, { style: { fontSize: '0.875rem' } }, 'Ajustos del recurs')
                        ]),
                        m(Button, {
                            type: 'default',
                            fluid: true,
                            onclick: () => {},
                            style: {
                                backgroundColor: '#0d9488',
                                color: 'white',
                                borderColor: '#0d9488',
                                justifyContent: 'flex-start',
                                padding: '0.75rem 1rem'
                            },
                            hover: {
                                backgroundColor: '#0f766e'
                            }
                        }, [
                            m(Icon, { icon: 'admin_panel_settings', size: 'small', style: { marginRight: '0.75rem' } }),
                            m(Text, { style: { fontSize: '0.875rem' } }, 'Admin Torns')
                        ])
                    ])
                ])
            ])
        ])
    ]);
}

function renderScheduleGrid(resource, appointmentsData) {
    const gridRows = generateGridRows(resource, appointmentsData);

    return m(Segment, {
        type: 'primary',
        style: { padding: '1.5rem' }
    }, [
        m(FlexCol, {
            gap: '1.5rem'
        }, [
            m(FlexRow, {
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }, [
                m(H2, {
                    style: {
                        fontSize: '1.125rem',
                        fontWeight: 'bold',
                        color: '#1e293b',
                        margin: 0
                    }
                }, [
                    m(Icon, { icon: 'event', size: 'small', style: { marginRight: '0.5rem' } }),
                    'Horarios y Disponibilidad'
                ]),
                m(Segment, {
                    type: 'secondary',
                    style: {
                        padding: '0.25rem',
                        display: 'flex',
                        gap: '0.25rem',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '0.5rem'
                    }
                }, [
                    m(Button, {
                        type: 'default',
                        size: 'small',
                        onclick: () => {},
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '0.375rem'
                        }
                    }, 'Día'),
                    m(Button, {
                        type: 'default',
                        size: 'small',
                        onclick: () => {},
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '0.375rem'
                        }
                    }, 'Semana'),
                    m(Button, {
                        type: 'blue',
                        size: 'small',
                        onclick: () => {},
                        style: {
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '0.375rem',
                            backgroundColor: 'white',
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }
                    }, 'Mes')
                ])
            ]),
            
            // Grid Visualization
            m(Div, {
                style: {
                    overflowX: 'auto'
                }
            }, [
                m(Div, {
                    style: {
                        minWidth: '800px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem'
                    }
                }, m.trust(gridRows))
            ])
        ])
    ]);
}

function generateGridRows(resource, appointmentsData) {
    if (!resource.virtualSettings) {
        return '<div style="padding: 1rem; text-align: center; color: #64748b;">No hay configuración de horarios disponible</div>';
    }

    const virtualSettings = Object.values(resource.virtualSettings);
    const numCols = virtualSettings.length + 1;

    // Create header row
    let html = `<div style="display: grid; grid-template-columns: repeat(${numCols}, minmax(0, 1fr)); background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 500; color: #64748b;">
        <div style="padding: 0.75rem; border-right: 1px solid #e2e8f0;">Hora</div>`;

    virtualSettings.forEach(vs => {
        html += `<div style="padding: 0.75rem; border-right: 1px solid #e2e8f0; text-align: center; last-child: border-right: none;">${vs.name || vs.title}</div>`;
    });

    html += '</div>';

    // Generate time slots
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

    hours.forEach(hour => {
        html += `<div style="display: grid; grid-template-columns: repeat(${numCols}, minmax(0, 1fr)); border-bottom: 1px solid #f1f5f9;">
            <div style="padding: 0.75rem; font-size: 0.875rem; color: #64748b; border-right: 1px solid #e2e8f0; font-family: monospace;">${hour}</div>`;

        virtualSettings.forEach(() => {
            const isAvailable = Math.random() > 0.3;
            html += `<div style="padding: 0.5rem; border-right: 1px solid #e2e8f0;">
                <div style="${isAvailable ? 'background-color: #dcfce7; color: #166534;' : 'background-color: #dbeafe; color: #1e40af;'} font-size: 0.75rem; padding: 0.5rem; border-radius: 0.25rem; text-align: center; cursor: pointer;">
                    ${isAvailable ? 'Libre' : 'Reserva'}
                </div>
            </div>`;
        });

        html += '</div>';
    });

    return html;
}

function initializeChart(stats, container) {
    const chartContainer = container.querySelector('#chart-container');
    if (!chartContainer) return;

    const confirmed = stats.confirmedAppointments || 0;
    const pending = stats.pendingAppointments || 0;
    const canceled = stats.canceledAppointments || 0;

    const hasData = confirmed > 0 || pending > 0 || canceled > 0;

    if (!hasData) {
        chartContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 12rem; color: #94a3b8;">
                <div style="text-align: center;">
                    <i class="fa-solid fa-chart-pie" style="font-size: 2.5rem; margin-bottom: 0.5rem;"></i>
                    <p style="font-size: 0.875rem;">No hay datos de citas disponibles</p>
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

