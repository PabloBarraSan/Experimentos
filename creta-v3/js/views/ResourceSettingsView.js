// Resource Settings View Component using Mithril and DView

import { FlexCol, FlexRow, Grid, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Card, Label, Segment } from '../../../DView/elements.js';
import { Input, Switch } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../DView/dialogs.js';
import { fetchGroups, updateResource } from '../api.js';

export const ResourceSettingsView = {
    oninit: async (vnode) => {
        const { resource } = vnode.attrs;
        
        // Initialize state with resource data
        vnode.state.activeTab = 'basic';
        vnode.state.loading = false;
        vnode.state.saving = false;
        vnode.state.error = null;
        vnode.state.success = false;
        
        // Form data - initialize with resource values
        // Handle title/subtitle/description as objects or strings
        const getTitleValue = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            return val.und || val.es || val.ca || '';
        };
        
        const getTitleObject = (val) => {
            if (!val) return { und: '' };
            if (typeof val === 'string') return { und: val };
            return val;
        };
        
        vnode.state.formData = {
            name: resource.name || '',
            title: getTitleObject(resource.title),
            subtitle: getTitleObject(resource.subtitle),
            description: getTitleObject(resource.description),
            published: resource.published || false,
            autoconfirmed: resource.autoconfirmed || false,
            concurrentSlots: resource.concurrentSlots || false,
            maskedTurn: resource.maskedTurn || false,
            type: resource.type || 'appointment',
            groupId: resource.groupId || '',
            maxActiveReservations: resource.maxActiveReservations || '',
            totalReservableSeats: resource.totalReservableSeats || 0,
            defaultSeats: resource.defaultSeats || 1,
            maxSeats: resource.maxSeats || 1
        };
        
        // Load groups for dropdown
        try {
            const groups = await fetchGroups();
            vnode.state.groups = groups || [];
        } catch (error) {
            console.error('Error loading groups:', error);
            vnode.state.groups = [];
        }
        
        // Resource types
        vnode.state.resourceTypes = [
            { value: 'appointment', label: 'Cita' },
            { value: 'reservation', label: 'Reserva' },
            { value: 'ticket', label: 'Turno' },
            { value: 'authorization', label: 'Autorización' },
            { value: 'enrollment', label: 'Inscripción' },
            { value: 'entry', label: 'Entrada' },
            { value: 'voucher', label: 'Bono' }
        ];
        
        // Tabs configuration
        vnode.state.tabs = [
            { id: 'basic', label: 'Básico', icon: 'info' },
            { id: 'forms', label: 'Formularios', icon: 'description' },
            { id: 'kiosk', label: 'Kiosco y Sala de Espera', icon: 'tv' },
            { id: 'reservation', label: 'Ajustes Reserva y Web', icon: 'web' },
            { id: 'messages', label: 'Mensajes y textos', icon: 'message' },
            { id: 'advanced', label: 'Avanzado', icon: 'settings' },
            { id: 'payment', label: 'Pago', icon: 'credit_card' },
            { id: 'data', label: 'Datos', icon: 'database' }
        ];
    },
    
    view: (vnode) => {
        const { resource } = vnode.attrs;
        const state = vnode.state;
        
        // Ensure state is initialized
        if (!state.tabs) {
            state.tabs = [
                { id: 'basic', label: 'Básico', icon: 'info' },
                { id: 'forms', label: 'Formularios', icon: 'description' },
                { id: 'kiosk', label: 'Kiosco y Sala de Espera', icon: 'tv' },
                { id: 'reservation', label: 'Ajustes Reserva y Web', icon: 'web' },
                { id: 'messages', label: 'Mensajes y textos', icon: 'message' },
                { id: 'advanced', label: 'Avanzado', icon: 'settings' },
                { id: 'payment', label: 'Pago', icon: 'credit_card' },
                { id: 'data', label: 'Datos', icon: 'database' }
            ];
        }
        
        if (!state.activeTab) {
            state.activeTab = 'basic';
        }
        
        if (!state.formData) {
            state.formData = {
                name: resource?.name || '',
                title: resource?.title || { und: '' },
                subtitle: resource?.subtitle || { und: '' },
                description: resource?.description || { und: '' },
                published: resource?.published || false,
                autoconfirmed: resource?.autoconfirmed || false,
                concurrentSlots: resource?.concurrentSlots || false,
                maskedTurn: resource?.maskedTurn || false,
                type: resource?.type || 'appointment',
                groupId: resource?.groupId || '',
                maxActiveReservations: resource?.maxActiveReservations || '',
                totalReservableSeats: resource?.totalReservableSeats || 0,
                defaultSeats: resource?.defaultSeats || 1,
                maxSeats: resource?.maxSeats || 1
            };
        }
        
        if (!state.groups) {
            state.groups = [];
        }
        
        if (!state.resourceTypes) {
            state.resourceTypes = [
                { value: 'appointment', label: 'Cita' },
                { value: 'reservation', label: 'Reserva' },
                { value: 'ticket', label: 'Turno' },
                { value: 'authorization', label: 'Autorización' },
                { value: 'enrollment', label: 'Inscripción' },
                { value: 'entry', label: 'Entrada' },
                { value: 'voucher', label: 'Bono' }
            ];
        }
        
        return m(FlexCol, {
            gap: '0',
            style: { backgroundColor: '#f8fafc' }
        }, [
            // Header
            renderHeader(resource, state),
            
            // Main Content
            m(FlexRow, {
                gap: '2rem',
                style: {
                    flex: 1,
                    alignItems: 'flex-start',
                    maxWidth: '1400px',
                    margin: '0 auto',
                    width: '100%',
                    padding: '1.5rem',
                    marginTop: '1.5rem'
                }
            }, [
                // Sidebar with tabs
                renderSidebar(state),
                
                // Content area
                renderContent(resource, state)
            ]),
            
            // Footer with action buttons
            renderFooter(resource, state)
        ]);
    }
};

function renderHeader(resource, state) {
    return m(Segment, {
        type: 'primary',
        style: {
            padding: '1rem 1.5rem',
            marginBottom: 0,
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: 'white',
            marginTop: 0
        }
    }, [
        m(FlexRow, {
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
        }, [
            m(FlexRow, {
                alignItems: 'center',
                gap: '1rem'
            }, [
                m(Button, {
                    type: 'default',
                    onclick: () => {
                        const resourceId = resource._id;
                        m.route.set(`/resource/${resourceId}/admin`);
                    },
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem'
                    }
                }, [
                    m(Icon, { icon: 'arrow_back', size: 'small' }),
                    m(Text, { fontSize: '0.875rem', margin: 0 }, 'Volver')
                ]),
                m(H1, {
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    margin: 0
                }, resource.title || resource.name || 'Sin título')
            ])
        ])
    ]);
}

function renderSidebar(state) {
    return m(FlexCol, {
        style: {
            width: '250px',
            flexShrink: 0
        }
    }, [
        // Resource image placeholder
        m(Div, {
            style: {
                marginBottom: '1.5rem',
                textAlign: 'center'
            }
        }, [
            m(Div, {
                style: {
                    width: '100%',
                    aspectRatio: '16/9',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.5rem'
                },
                onclick: () => {
                    // TODO: Implementar cambio de imagen
                    console.log('Cambiar imagen');
                }
            }, [
                m('img', {
                    src: window.app?.currentResource?.photo || 'https://via.placeholder.com/400x300',
                    alt: 'Resource photo',
                    style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    },
                    onerror: (e) => {
                        e.target.style.display = 'none';
                    }
                }),
                !window.app?.currentResource?.photo && m(Icon, {
                    icon: 'image',
                    size: 'large',
                    style: { color: '#cbd5e1' }
                })
            ]),
            m(SmallText, {
                fontSize: '0.75rem',
                color: '#64748b',
                margin: 0,
                style: { cursor: 'pointer' }
            }, 'Pulsa en la imagen para cambiarla')
        ]),
        
        // Tabs menu
        m(FlexCol, {
            gap: '0',
            style: {
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                backgroundColor: 'white'
            }
        }, (state.tabs || []).map((tab, index, tabs) => 
            m(Tappable, {
                key: tab.id,
                onclick: () => {
                    state.activeTab = tab.id;
                    m.redraw();
                },
                style: {
                    padding: '0.875rem 1rem',
                    borderBottom: index < tabs.length - 1 ? '1px solid #f1f5f9' : 'none',
                    backgroundColor: state.activeTab === tab.id ? '#eff6ff' : 'white',
                    borderLeft: state.activeTab === tab.id ? '3px solid #2563eb' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                },
                hover: {
                    backgroundColor: state.activeTab === tab.id ? '#eff6ff' : '#f8fafc'
                }
            }, [
                m(Icon, {
                    icon: tab.icon,
                    size: 'small',
                    style: {
                        color: state.activeTab === tab.id ? '#2563eb' : '#64748b',
                        flexShrink: 0
                    }
                }),
                m(Text, {
                    fontSize: '0.875rem',
                    fontWeight: state.activeTab === tab.id ? 600 : 400,
                    color: state.activeTab === tab.id ? '#2563eb' : '#475569',
                    margin: 0
                }, tab.label)
            ])
        ))
    ]);
}

function renderContent(resource, state) {
    return m(FlexCol, {
        style: {
            flex: 1,
            minWidth: 0
        },
        gap: '0'
    }, [
        // Tab content
        m(Segment, {
            type: 'primary',
            style: {
                padding: '1.5rem',
                flex: 1,
                marginLeft: '0'
            }
        }, [
            renderTabContent(resource, state)
        ])
    ]);
}

function renderTabContent(resource, state) {
    switch (state.activeTab) {
        case 'basic':
            return renderBasicTab(resource, state);
        case 'forms':
            return renderFormsTab(resource, state);
        case 'kiosk':
            return renderKioskTab(resource, state);
        case 'reservation':
            return renderReservationTab(resource, state);
        case 'messages':
            return renderMessagesTab(resource, state);
        case 'advanced':
            return renderAdvancedTab(resource, state);
        case 'payment':
            return renderPaymentTab(resource, state);
        case 'data':
            return renderDataTab(resource, state);
        default:
            return renderBasicTab(resource, state);
    }
}

function renderBasicTab(resource, state) {
    // Ensure state is initialized
    if (!state.resourceTypes) {
        state.resourceTypes = [
            { value: 'appointment', label: 'Cita' },
            { value: 'reservation', label: 'Reserva' },
            { value: 'ticket', label: 'Turno' },
            { value: 'authorization', label: 'Autorización' },
            { value: 'enrollment', label: 'Inscripción' },
            { value: 'entry', label: 'Entrada' },
            { value: 'voucher', label: 'Bono' }
        ];
    }
    
    if (!state.groups) {
        state.groups = [];
    }
    
    if (!state.formData) {
        state.formData = {
            name: resource?.name || '',
            title: resource?.title || { und: '' },
            subtitle: resource?.subtitle || { und: '' },
            description: resource?.description || { und: '' },
            published: resource?.published || false,
            autoconfirmed: resource?.autoconfirmed || false,
            concurrentSlots: resource?.concurrentSlots || false,
            maskedTurn: resource?.maskedTurn || false,
            type: resource?.type || 'appointment',
            groupId: resource?.groupId || '',
            maxActiveReservations: resource?.maxActiveReservations || '',
            totalReservableSeats: resource?.totalReservableSeats || 0,
            defaultSeats: resource?.defaultSeats || 1,
            maxSeats: resource?.maxSeats || 1
        };
    }
    
    return m(FlexCol, {
        gap: '1.5rem'
    }, [
        m(Segment, {
            type: 'info',
            style: {
                padding: '1rem',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe'
            }
        }, [
            m(H2, {
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
                marginTop: 0
            }, 'Información básica de la reserva'),
            m(Text, {
                fontSize: '0.875rem',
                color: '#475569',
                margin: 0
            }, 'Introduce información necesaria para crear el recurso')
        ]),
        
        m(FlexCol, {
            gap: '1.5rem'
        }, [
            // Name, Title, Subtitle row
            m(Grid, {
                columns: 3,
                style: { gap: '1rem' }
            }, [
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, [
                        'Nombre',
                        m('span', { style: { color: '#ef4444', marginLeft: '0.25rem' } }, '*')
                    ]),
                    m(Input, {
                        value: state.formData.name,
                        oninput: (e) => {
                            state.formData.name = e.target.value;
                            m.redraw();
                        },
                        placeholder: 'Nombre del recurso',
                        style: { width: '100%' }
                    })
                ]),
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, 'Título'),
                    m(FlexRow, {
                        gap: '0',
                        style: { width: '100%' }
                    }, [
                    m(Input, {
                        value: typeof state.formData.title === 'string' 
                            ? state.formData.title 
                            : (state.formData.title?.und || state.formData.title?.es || state.formData.title?.ca || ''),
                        oninput: (e) => {
                            if (typeof state.formData.title !== 'object' || !state.formData.title) {
                                state.formData.title = {};
                            }
                            state.formData.title.und = e.target.value;
                            m.redraw();
                        },
                        placeholder: 'Título',
                        style: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                    }),
                        m(Button, {
                            type: 'default',
                            onclick: () => {
                                // TODO: Implementar traducción
                                console.log('Traducir título');
                            },
                            style: {
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                padding: '0.5rem',
                                borderLeft: 'none'
                            }
                        }, [
                            m(Icon, { icon: 'language', size: 'small' })
                        ])
                    ])
                ]),
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, 'Subtítulo'),
                    m(FlexRow, {
                        gap: '0',
                        style: { width: '100%' }
                    }, [
                        m(Input, {
                            value: typeof state.formData.subtitle === 'string' 
                                ? state.formData.subtitle 
                                : (state.formData.subtitle?.und || state.formData.subtitle?.es || state.formData.subtitle?.ca || ''),
                            oninput: (e) => {
                                if (typeof state.formData.subtitle !== 'object' || !state.formData.subtitle) {
                                    state.formData.subtitle = {};
                                }
                                state.formData.subtitle.und = e.target.value;
                                m.redraw();
                            },
                            placeholder: 'Subtítulo',
                            style: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                        }),
                        m(Button, {
                            type: 'default',
                            onclick: () => {
                                // TODO: Implementar traducción
                                console.log('Traducir subtítulo');
                            },
                            style: {
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                padding: '0.5rem',
                                borderLeft: 'none'
                            }
                        }, [
                            m(Icon, { icon: 'language', size: 'small' })
                        ])
                    ])
                ])
            ]),
            
            // Description
            m(FlexCol, {
                gap: '0.5rem'
            }, [
                m('label', {
                    style: {
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#1e293b',
                        display: 'block',
                        marginBottom: '0.25rem'
                    }
                }, 'Descripción'),
                m('textarea', {
                    value: typeof state.formData.description === 'string' 
                        ? state.formData.description 
                        : (state.formData.description?.und || state.formData.description?.es || state.formData.description?.ca || ''),
                    oninput: (e) => {
                        if (typeof state.formData.description !== 'object' || !state.formData.description) {
                            state.formData.description = {};
                        }
                        state.formData.description.und = e.target.value;
                        m.redraw();
                    },
                    placeholder: 'Descripción del recurso',
                    style: {
                        width: '100%',
                        minHeight: '120px',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                    }
                })
            ]),
            
            // Checkboxes row
            m(Grid, {
                columns: 4,
                style: { gap: '1rem' }
            }, [
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem'
                }, [
                    m(Switch, {
                        isActive: state.formData.published,
                        onchange: () => {
                            state.formData.published = !state.formData.published;
                            m.redraw();
                        }
                    }),
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            margin: 0,
                            color: '#1e293b',
                            userSelect: 'none'
                        },
                        onclick: () => {
                            state.formData.published = !state.formData.published;
                            m.redraw();
                        }
                    }, 'Publicado')
                ]),
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem'
                }, [
                    m(Switch, {
                        isActive: state.formData.autoconfirmed,
                        onchange: () => {
                            state.formData.autoconfirmed = !state.formData.autoconfirmed;
                            m.redraw();
                        }
                    }),
                    m(FlexRow, {
                        alignItems: 'center',
                        gap: '0.25rem'
                    }, [
                        m('label', {
                            style: {
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                margin: 0,
                                color: '#1e293b',
                                userSelect: 'none'
                            },
                            onclick: () => {
                                state.formData.autoconfirmed = !state.formData.autoconfirmed;
                                m.redraw();
                            }
                        }, 'Autoconfirmado'),
                        m(Icon, {
                            icon: 'help',
                            size: 'small',
                            style: {
                                color: '#3b82f6',
                                cursor: 'help'
                            },
                            title: 'Si se selecciona, las citas se confirmarán automáticamente, sin necesidad de confirmación por parte del administrador.'
                        })
                    ])
                ]),
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem'
                }, [
                    m(Switch, {
                        isActive: state.formData.concurrentSlots,
                        onchange: () => {
                            state.formData.concurrentSlots = !state.formData.concurrentSlots;
                            m.redraw();
                        }
                    }),
                    m(FlexRow, {
                        alignItems: 'center',
                        gap: '0.25rem'
                    }, [
                        m('label', {
                            style: {
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                margin: 0,
                                color: '#1e293b',
                                userSelect: 'none'
                            },
                            onclick: () => {
                                state.formData.concurrentSlots = !state.formData.concurrentSlots;
                                m.redraw();
                            }
                        }, 'Slots concurrentes'),
                        m(Icon, {
                            icon: 'help',
                            size: 'small',
                            style: {
                                color: '#3b82f6',
                                cursor: 'help'
                            },
                            title: 'Activo permite la creación de varios slots en el mismo intervalo de tiempo. Desactivado no permitirá que se creen slots solapados.'
                        })
                    ])
                ]),
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem'
                }, [
                    m(Switch, {
                        isActive: state.formData.maskedTurn,
                        onchange: () => {
                            state.formData.maskedTurn = !state.formData.maskedTurn;
                            m.redraw();
                        }
                    }),
                    m(FlexRow, {
                        alignItems: 'center',
                        gap: '0.25rem'
                    }, [
                        m('label', {
                            style: {
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                margin: 0,
                                color: '#1e293b',
                                userSelect: 'none'
                            },
                            onclick: () => {
                                state.formData.maskedTurn = !state.formData.maskedTurn;
                                m.redraw();
                            }
                        }, 'Usar turno enmascarado'),
                        m(Icon, {
                            icon: 'help',
                            size: 'small',
                            style: {
                                color: '#3b82f6',
                                cursor: 'help'
                            },
                            title: 'Cuando esté activo el turno se enmascarará con una cadena de texto anónima que ocultará el número secuencial del turno.'
                        })
                    ])
                ])
            ]),
            
            // Type and Group row
            m(Grid, {
                columns: 2,
                style: { gap: '1rem' }
            }, [
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, [
                        'Tipo',
                        m('span', { style: { color: '#ef4444', marginLeft: '0.25rem' } }, '*')
                    ]),
                    m('select', {
                        value: state.formData.type,
                        onchange: (e) => {
                            state.formData.type = e.target.value;
                            m.redraw();
                        },
                        style: {
                            width: '100%',
                            padding: '0.625rem 0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                        }
                    }, (state.resourceTypes || []).map(type =>
                        m('option', {
                            key: type.value,
                            value: type.value
                        }, type.label)
                    ))
                ]),
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, 'Grupo'),
                    m('select', {
                        value: state.formData.groupId,
                        onchange: (e) => {
                            state.formData.groupId = e.target.value;
                            m.redraw();
                        },
                        style: {
                            width: '100%',
                            padding: '0.625rem 0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                        }
                    }, [
                        m('option', { key: 'no-group', value: '' }, 'Sin Grupo'),
                        ...(state.groups || []).map(group =>
                            m('option', {
                                key: group._id,
                                value: group._id
                            }, group.name || group.title || 'Sin nombre')
                        )
                    ])
                ])
            ]),
            
            // Max reservations and total seats row
            m(Grid, {
                columns: 2,
                style: { gap: '1rem' }
            }, [
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m(FlexRow, {
                        alignItems: 'center',
                        gap: '0.25rem'
                    }, [
                        m('label', {
                            style: {
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#1e293b',
                                display: 'block',
                                margin: 0
                            }
                        }, 'Número máximo de reservas activas por usuario'),
                        m(Icon, {
                            icon: 'help',
                            size: 'small',
                            style: {
                                color: '#3b82f6',
                                cursor: 'help'
                            },
                            title: 'El número máximo de reservas activas que puede tener un usuario a la vez en este recurso.'
                        })
                    ]),
                    m(Input, {
                        type: 'number',
                        min: 1,
                        value: state.formData.maxActiveReservations,
                        oninput: (e) => {
                            state.formData.maxActiveReservations = e.target.value ? parseInt(e.target.value) : '';
                            m.redraw();
                        },
                        placeholder: 'Sin límite',
                        style: { width: '100%' }
                    })
                ]),
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m(FlexRow, {
                        alignItems: 'center',
                        gap: '0.25rem'
                    }, [
                        m('label', {
                            style: {
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#1e293b',
                                display: 'block',
                                margin: 0
                            }
                        }, 'Suma total de asientos reservables'),
                        m(Icon, {
                            icon: 'help',
                            size: 'small',
                            style: {
                                color: '#3b82f6',
                                cursor: 'help'
                            },
                            title: 'El total de asientos que puede reservar una misma persona, en diferentes reservas. En caso de 0 podrá reservar los asientos que quiera'
                        })
                    ]),
                    m(Input, {
                        type: 'number',
                        min: 0,
                        value: state.formData.totalReservableSeats,
                        oninput: (e) => {
                            state.formData.totalReservableSeats = e.target.value ? parseInt(e.target.value) : 0;
                            m.redraw();
                        },
                        placeholder: '0 = sin límite',
                        style: { width: '100%' }
                    })
                ])
            ]),
            
            // Default seats and max seats row
            m(Grid, {
                columns: 2,
                style: { gap: '1rem' }
            }, [
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, [
                        'Número de asientos por defecto al crear citas',
                        m('span', { style: { color: '#ef4444', marginLeft: '0.25rem' } }, '*')
                    ]),
                    m(Input, {
                        type: 'number',
                        min: 1,
                        value: state.formData.defaultSeats,
                        oninput: (e) => {
                            state.formData.defaultSeats = e.target.value ? parseInt(e.target.value) : 1;
                            m.redraw();
                        },
                        style: { width: '100%' }
                    })
                ]),
                m(FlexCol, {
                    gap: '0.5rem'
                }, [
                    m('label', {
                        style: {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#1e293b',
                            display: 'block',
                            marginBottom: '0.25rem'
                        }
                    }, [
                        'Número máximo de asientos al reservar',
                        m('span', { style: { color: '#ef4444', marginLeft: '0.25rem' } }, '*')
                    ]),
                    m(Input, {
                        type: 'number',
                        min: 1,
                        value: state.formData.maxSeats,
                        oninput: (e) => {
                            state.formData.maxSeats = e.target.value ? parseInt(e.target.value) : 1;
                            m.redraw();
                        },
                        style: { width: '100%' }
                    })
                ])
            ])
        ])
    ]);
}

function renderFormsTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'description',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista de formularios en desarrollo')
    ]);
}

function renderKioskTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'tv',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista de kiosco y sala de espera en desarrollo')
    ]);
}

function renderReservationTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'web',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista de ajustes de reserva y web en desarrollo')
    ]);
}

function renderMessagesTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'message',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista de mensajes y textos en desarrollo')
    ]);
}

function renderAdvancedTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'settings',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista avanzada en desarrollo')
    ]);
}

function renderPaymentTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'credit_card',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista de pago en desarrollo')
    ]);
}

function renderDataTab(resource, state) {
    return m(FlexCol, {
        gap: '1rem',
        style: { padding: '2rem', textAlign: 'center' }
    }, [
        m(Icon, {
            icon: 'database',
            size: 'large',
            style: { color: '#cbd5e1', fontSize: '4rem' }
        }),
        m(Text, {
            fontSize: '1rem',
            color: '#64748b',
            margin: 0
        }, 'Vista de datos en desarrollo')
    ]);
}

function renderFooter(resource, state) {
    return m(Segment, {
        type: 'primary',
        style: {
            padding: '1rem 1.5rem',
            marginTop: '2rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: 'white'
        }
    }, [
        m(FlexRow, {
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
        }, [
            m(FlexRow, {
                gap: '1rem'
            }, [
                m(Button, {
                    type: 'negative',
                    onclick: async () => {
                        if (confirm('¿Estás seguro de que quieres eliminar este recurso? Esta acción no se puede deshacer.')) {
                            // TODO: Implementar eliminación
                            console.log('Eliminar recurso:', resource._id);
                        }
                    },
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }
                }, [
                    m(Icon, { icon: 'delete', size: 'small' }),
                    m(Text, { fontSize: '0.875rem', margin: 0 }, 'Eliminar Recurso')
                ])
            ]),
            m(FlexRow, {
                gap: '1rem'
            }, [
                m(Button, {
                    type: 'default',
                    onclick: () => {
                        // TODO: Implementar clonación
                        console.log('Clonar recurso:', resource._id);
                    },
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#14b8a6',
                        color: 'white',
                        border: 'none'
                    },
                    hover: {
                        backgroundColor: '#0d9488'
                    }
                }, [
                    m(Icon, { icon: 'content_copy', size: 'small' }),
                    m(Text, { fontSize: '0.875rem', margin: 0 }, 'Clonar Recurso')
                ]),
                m(Button, {
                    type: 'positive',
                    onclick: async () => {
                        state.saving = true;
                        state.error = null;
                        state.success = false;
                        m.redraw();
                        
                        try {
                            await updateResource(resource._id, state.formData);
                            state.success = true;
                            // Refresh resource data
                            const updatedResource = window.app.data.find(r => r._id === resource._id);
                            if (updatedResource) {
                                Object.assign(updatedResource, state.formData);
                                window.app.currentResource = updatedResource;
                            }
                            
                            // Show success message
                            setTimeout(() => {
                                state.success = false;
                                m.redraw();
                            }, 3000);
                        } catch (error) {
                            console.error('Error saving resource:', error);
                            state.error = error.message || 'Error al guardar el recurso';
                        } finally {
                            state.saving = false;
                            m.redraw();
                        }
                    },
                    disabled: state.saving,
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        minWidth: '120px'
                    }
                }, [
                    state.saving ? m(Icon, {
                        icon: 'hourglass_empty',
                        size: 'small',
                        style: { animation: 'spin 1s linear infinite' }
                    }) : m(Icon, { icon: 'save', size: 'small' }),
                    m(Text, { fontSize: '0.875rem', margin: 0 }, state.saving ? 'Guardando...' : 'Guardar')
                ])
            ])
        ]),
        
        // Success/Error messages
        state.success && m(Segment, {
            type: 'positive',
            style: {
                marginTop: '1rem',
                padding: '0.75rem 1rem'
            }
        }, [
            m(Text, {
                fontSize: '0.875rem',
                margin: 0,
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
            }, [
                m(Icon, { icon: 'check_circle', size: 'small' }),
                'Recurso guardado correctamente'
            ])
        ]),
        state.error && m(Segment, {
            type: 'negative',
            style: {
                marginTop: '1rem',
                padding: '0.75rem 1rem'
            }
        }, [
            m(Text, {
                fontSize: '0.875rem',
                margin: 0,
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
            }, [
                m(Icon, { icon: 'error', size: 'small' }),
                state.error
            ])
        ])
    ]);
}

