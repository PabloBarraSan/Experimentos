// Schedule Management Modal Component

import { FlexCol, FlexRow, Div } from '../../../DView/layout.js';
import { H2, Text } from '../../../DView/texts.js';
import { Button, Icon, Segment } from '../../../DView/elements.js';
import { Input } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../DView/dialogs.js';

export const ScheduleModal = {
    oninit: (vnode) => {
        const { resource, schedules = [] } = vnode.attrs;
        
        // Initialize state properly for Mithril (assign properties individually)
        vnode.state.schedules = schedules; // Lista de horarios existentes (array de virtualSettings)
        vnode.state.activeTab = 'basico'; // 'basico', 'excepciones', 'extra'
        vnode.state.selectedSchedule = null; // Horario seleccionado para editar
        vnode.state.formData = {
            name: '',
            startDate: '',
            endDate: '',
            startHour: '',
            endHour: '',
            days: [], // [0,1,2,3,4,5,6] - domingo a sábado
            seats: 25,
            appDuration: 0, // minutos
            supplement: 0, // céntimos
            exceptions: [],
            extra: {}
        };
        vnode.state.dropdownOpen = null; // ID del dropdown abierto
    },
    
    view: (vnode) => {
        const state = vnode.state;
        const { onClose, resource } = vnode.attrs;
        
        const daysOfWeek = [
            { value: 0, label: 'Domingo' },
            { value: 1, label: 'Lunes' },
            { value: 2, label: 'Martes' },
            { value: 3, label: 'Miércoles' },
            { value: 4, label: 'Jueves' },
            { value: 5, label: 'Viernes' },
            { value: 6, label: 'Sábado' }
        ];
        
        const toggleDay = (dayValue) => {
            const index = state.formData.days.indexOf(dayValue);
            if (index > -1) {
                state.formData.days.splice(index, 1);
            } else {
                state.formData.days.push(dayValue);
            }
            m.redraw();
        };
        
        const selectAllDays = () => {
            state.formData.days = [0, 1, 2, 3, 4, 5, 6];
            m.redraw();
        };
        
        const incrementValue = (field, min = 0, max = 999) => {
            if (state.formData[field] < max) {
                state.formData[field]++;
                m.redraw();
            }
        };
        
        const decrementValue = (field, min = 0) => {
            if (state.formData[field] > min) {
                state.formData[field]--;
                m.redraw();
            }
        };
        
        const toggleDropdown = (scheduleId) => {
            state.dropdownOpen = state.dropdownOpen === scheduleId ? null : scheduleId;
            m.redraw();
        };
        
        const formatSupplement = (cents) => {
            return `${cents} (${(cents / 100).toFixed(2)}€)`;
        };
        
        return m(Modal, {
            size: 'big',
            close: onClose
        }, [
            m(ModalHeader, [
                m(H2, { marginTop: 0 }, 'Horarios')
            ]),
            
            m(ModalContent, {
                style: { 
                    maxHeight: '50vh', 
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '1rem'
                }
            }, [
                // Botón Añadir nuevo y lista de horarios
                m(FlexCol, { gap: '0.75rem', style: { marginBottom: '1.5rem' } }, [
                    m(Button, {
                        type: 'blue',
                        onclick: () => {
                            // Reset form for new schedule
                            state.formData = {
                                name: '',
                                startDate: '',
                                endDate: '',
                                startHour: '',
                                endHour: '',
                                days: [],
                                seats: 25,
                                appDuration: 0,
                                supplement: 0,
                                exceptions: [],
                                extra: {}
                            };
                            state.selectedSchedule = null;
                            state.activeTab = 'basico';
                            m.redraw();
                        },
                        style: {
                            alignSelf: 'flex-start',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }
                    }, [
                        m(Icon, { icon: 'add', style: { color: 'white' } }),
                        m(Text, { fontSize: '0.875rem', fontWeight: 500, color: 'white' }, 'Añadir nuevo')
                    ]),
                    
                    // Lista de horarios existentes
                    ...state.schedules.map((schedule, index) => {
                        const isOpen = state.dropdownOpen === schedule.id;
                        return m(Div, {
                            style: {
                                position: 'relative',
                                marginTop: index > 0 ? '0.5rem' : '0'
                            }
                        }, [
                            m(Button, {
                                type: 'default',
                                onclick: () => {
                                    // Load schedule data when clicking the button
                                    state.selectedSchedule = schedule;
                                    state.formData = {
                                        name: schedule.name || '',
                                        startDate: schedule.from || '',
                                        endDate: schedule.until || '',
                                        startHour: schedule.startHour || '',
                                        endHour: schedule.endHour || '',
                                        days: Array.isArray(schedule.days) ? [...schedule.days] : [],
                                        seats: schedule.seats || 25,
                                        appDuration: schedule.appDuration || 0,
                                        supplement: schedule.supplement || 0,
                                        exceptions: Array.isArray(schedule.exceptions) ? [...schedule.exceptions] : [],
                                        extra: schedule.extra || {}
                                    };
                                    state.activeTab = 'basico';
                                    m.redraw();
                                },
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: 'fit-content',
                                    minWidth: '40px',
                                    paddingLeft: '1.5rem',
                                    paddingRight: '1.5rem',
                                    textAlign: 'left',
                                    alignSelf: 'flex-start',
                                    gap: '0.5rem'
                                }
                            }, [
                                m(Text, { fontSize: '0.875rem', fontWeight: 500 }, schedule.name || `Horario ${index + 1}`),
                                m(Div, {
                                    style: { 
                                        cursor: 'pointer', 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        padding: '0.25rem'
                                    },
                                    onclick: (e) => {
                                        e.stopPropagation();
                                        toggleDropdown(schedule.id);
                                        if (!isOpen) {
                                            // Load schedule data
                                            state.selectedSchedule = schedule;
                                            state.formData = {
                                                name: schedule.name || '',
                                                startDate: schedule.from || '',
                                                endDate: schedule.until || '',
                                                startHour: schedule.startHour || '',
                                                endHour: schedule.endHour || '',
                                                days: Array.isArray(schedule.days) ? [...schedule.days] : [],
                                                seats: schedule.seats || 25,
                                                appDuration: schedule.appDuration || 0,
                                                supplement: schedule.supplement || 0,
                                                exceptions: Array.isArray(schedule.exceptions) ? [...schedule.exceptions] : [],
                                                extra: schedule.extra || {}
                                            };
                                            state.activeTab = 'basico';
                                        }
                                    }
                                }, [
                                    m(Icon, {
                                        icon: 'settings',
                                        size: 'small'
                                    })
                                ])
                            ]),
                            
                            // Dropdown menu
                            isOpen && m(Div, {
                                style: {
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    marginTop: '0.5rem',
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '0.5rem',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                    padding: '0.75rem',
                                    zIndex: 10000,
                                    minWidth: '200px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }
                            }, [
                                m(Input, {
                                    value: state.formData.name,
                                    onchange: (val) => {
                                        state.formData.name = val;
                                        m.redraw();
                                    },
                                    placeholder: 'Nombre del horario',
                                    style: { marginBottom: '0.5rem' }
                                }),
                                m(Button, {
                                    type: 'negative',
                                    onclick: () => {
                                        if (confirm('¿Estás seguro de que quieres eliminar este horario?')) {
                                            // TODO: Implementar eliminación
                                            const index = state.schedules.findIndex(s => s.id === schedule.id);
                                            if (index > -1) {
                                                state.schedules.splice(index, 1);
                                            }
                                            state.dropdownOpen = null;
                                            m.redraw();
                                        }
                                    },
                                    style: { marginBottom: '0.5rem' }
                                }, 'Eliminar horario'),
                                m(Button, {
                                    type: 'default',
                                    onclick: () => {
                                        // TODO: Implementar clonación
                                        console.log('Clonar horario:', schedule);
                                    }
                                }, 'Clonar horario')
                            ])
                        ]);
                    })
                ]),
                
                // Tabs
                m(FlexRow, {
                    gap: '0',
                    style: {
                        borderBottom: '1px solid #e2e8f0',
                        marginBottom: '1rem'
                    }
                }, [
                    ['basico', 'Básico'],
                    ['excepciones', 'Excepciones'],
                    ['extra', 'Extra']
                ].map(([tab, label]) => 
                    m(Button, {
                        type: 'default',
                        onclick: () => {
                            state.activeTab = tab;
                            m.redraw();
                        },
                        style: {
                            borderRadius: state.activeTab === tab ? '1rem 1rem 0 0' : '0',
                            backgroundColor: state.activeTab === tab ? 'white' : 'transparent',
                            boxShadow: state.activeTab === tab ? '0 2px 4px 0 rgba(34, 36, 38, 0.12), 0 2px 10px 0 rgba(34, 36, 38, 0.15)' : 'none',
                            fontWeight: state.activeTab === tab ? 'bold' : 'normal',
                            color: state.activeTab === tab ? 'black' : 'inherit',
                            border: state.activeTab === tab ? 'none' : '1px solid white',
                            padding: '1rem'
                        }
                    }, label)
                )),
                
                // Tab Content
                m(Segment, {
                    type: 'primary',
                    style: {
                        borderRadius: '1rem',
                        borderTop: '0',
                        paddingTop: '1rem',
                        marginTop: '0',
                        border: '1px solid #e2e8f0'
                    }
                }, [
                    state.activeTab === 'basico' && m(FlexCol, { gap: '1rem' }, [
                        // Info message
                        m(Div, {
                            style: {
                                backgroundColor: '#e0f2fe',
                                border: '1px solid #bae6fd',
                                borderRadius: '1rem',
                                padding: '1rem',
                                marginBottom: '1rem',
                                color: '#0c4a6e'
                            }
                        }, 'Introduce la información necesaria para crear un horario.'),
                        
                        // Form fields
                        m(FlexRow, {
                            gap: '1rem',
                            style: { 
                                flexWrap: 'wrap',
                                width: '100%',
                                boxSizing: 'border-box'
                            }
                        }, [
                            m(FlexCol, { 
                                flex: 1, 
                                minWidth: '200px',
                                style: { 
                                    flexBasis: 'calc(25% - 0.75rem)',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box'
                                } 
                            }, [
                                m(Text, { fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }, 'Día de inicio'),
                                m(Input, {
                                    type: 'date',
                                    value: state.formData.startDate,
                                    onchange: (val) => {
                                        state.formData.startDate = val;
                                        m.redraw();
                                    },
                                    style: { width: '100%', boxSizing: 'border-box' }
                                })
                            ]),
                            m(FlexCol, { 
                                flex: 1, 
                                minWidth: '200px',
                                style: { 
                                    flexBasis: 'calc(25% - 0.75rem)',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box'
                                } 
                            }, [
                                m(Text, { fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }, 'Día de fin'),
                                m(Input, {
                                    type: 'date',
                                    value: state.formData.endDate,
                                    onchange: (val) => {
                                        state.formData.endDate = val;
                                        m.redraw();
                                    },
                                    style: { width: '100%', boxSizing: 'border-box' }
                                })
                            ]),
                            m(FlexCol, { 
                                flex: 1, 
                                minWidth: '200px',
                                style: { 
                                    flexBasis: 'calc(25% - 0.75rem)',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box'
                                } 
                            }, [
                                m(FlexRow, { alignItems: 'center', gap: '0.25rem' }, [
                                    m(Text, { fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }, 'Hora de inicio'),
                                    m(Text, { color: 'red', fontSize: '1rem' }, '*')
                                ]),
                                m(Input, {
                                    type: 'time',
                                    value: state.formData.startHour,
                                    onchange: (val) => {
                                        state.formData.startHour = val;
                                        m.redraw();
                                    },
                                    required: true,
                                    style: { width: '100%', boxSizing: 'border-box' }
                                })
                            ]),
                            m(FlexCol, { 
                                flex: 1, 
                                minWidth: '200px',
                                style: { 
                                    flexBasis: 'calc(25% - 0.75rem)',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box'
                                } 
                            }, [
                                m(FlexRow, { alignItems: 'center', gap: '0.25rem' }, [
                                    m(Text, { fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }, 'Hora de fin'),
                                    m(Text, { color: 'red', fontSize: '1rem' }, '*')
                                ]),
                                m(Input, {
                                    type: 'time',
                                    value: state.formData.endHour,
                                    onchange: (val) => {
                                        state.formData.endHour = val;
                                        m.redraw();
                                    },
                                    required: true,
                                    style: { width: '100%', boxSizing: 'border-box' }
                                })
                            ])
                        ]),
                        
                        // Días disponibles
                        m(FlexCol, { gap: '0.5rem' }, [
                            m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
                                m(Text, { fontSize: '0.875rem', fontWeight: 500 }, 'Días disponibles'),
                                m(Icon, {
                                    icon: 'help_outline',
                                    size: 'small',
                                    style: { color: '#2563eb', cursor: 'help' },
                                    title: 'En caso de no configurar los días disponibles, se considerarán todos los días de la semana.'
                                })
                            ]),
                            m(FlexRow, { gap: '0.5rem', flexWrap: 'wrap' }, [
                                m(Button, {
                                    type: 'default',
                                    onclick: selectAllDays,
                                    style: {
                                        backgroundColor: state.formData.days.length === 7 ? '#2563eb' : 'transparent',
                                        color: state.formData.days.length === 7 ? 'white' : 'inherit'
                                    }
                                }, 'Todos'),
                                ...daysOfWeek.map(day => 
                                    m(Button, {
                                        type: 'default',
                                        onclick: () => toggleDay(day.value),
                                        style: {
                                            backgroundColor: state.formData.days.includes(day.value) ? '#2563eb' : 'transparent',
                                            color: state.formData.days.includes(day.value) ? 'white' : 'inherit'
                                        }
                                    }, day.label)
                                )
                            ])
                        ]),
                        
                        // Asientos, Duración, Suplemento
                        m(FlexRow, {
                            gap: '1rem',
                            style: { flexWrap: 'wrap' }
                        }, [
                            m(FlexCol, { flex: 1, minWidth: '200px' }, [
                                m(Text, { fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }, [
                                    'Asientos',
                                    m(Text, { color: 'red', marginLeft: '0.25rem' }, '*')
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.678571em 1em',
                                        border: '1px solid rgba(34, 36, 38, 0.15)',
                                        borderRadius: '0.285714rem',
                                        backgroundColor: 'white'
                                    }
                                }, [
                                    m(Text, { fontSize: '1rem' }, state.formData.seats),
                                    m(FlexRow, { gap: '0.5rem' }, [
                                        m(Icon, {
                                            icon: 'remove',
                                            size: 'small',
                                            style: { color: '#dc2626', cursor: 'pointer' },
                                            onclick: () => decrementValue('seats', 1)
                                        }),
                                        m(Icon, {
                                            icon: 'add',
                                            size: 'small',
                                            style: { color: '#21ba45', cursor: 'pointer' },
                                            onclick: () => incrementValue('seats', 1, 999)
                                        })
                                    ])
                                ])
                            ]),
                            m(FlexCol, { flex: 1, minWidth: '200px' }, [
                                m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
                                    m(Text, { fontSize: '0.875rem', fontWeight: 500 }, 'Duración de la cita'),
                                    m(Icon, {
                                        icon: 'help_outline',
                                        size: 'small',
                                        style: { color: '#2563eb', cursor: 'help' },
                                        title: 'En caso de no introducir ninguna duración, se considerará la diferencia entre la hora de inicio y la hora de fin.'
                                    })
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.678571em 1em',
                                        border: '1px solid rgba(34, 36, 38, 0.15)',
                                        borderRadius: '0.285714rem',
                                        backgroundColor: 'white',
                                        marginTop: '0.5rem'
                                    }
                                }, [
                                    m(Text, { fontSize: '1rem' }, [
                                        m(Text, {}, state.formData.appDuration),
                                        m(Text, { marginLeft: '0.5rem', color: '#64748b' }, 'minutos')
                                    ]),
                                    m(FlexRow, { gap: '0.5rem' }, [
                                        m(Icon, {
                                            icon: 'remove',
                                            size: 'small',
                                            style: { color: '#94a3b8', cursor: 'pointer' },
                                            onclick: () => decrementValue('appDuration', 0)
                                        }),
                                        m(Icon, {
                                            icon: 'add',
                                            size: 'small',
                                            style: { color: '#21ba45', cursor: 'pointer' },
                                            onclick: () => incrementValue('appDuration', 0, 999)
                                        })
                                    ])
                                ])
                            ]),
                            m(FlexCol, { 
                                flex: 1, 
                                minWidth: '200px',
                                style: { 
                                    flexBasis: 'calc(33.333% - 0.667rem)',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box'
                                } 
                            }, [
                                m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
                                    m(Text, { fontSize: '0.875rem', fontWeight: 500 }, 'Suplemento'),
                                    m(Icon, {
                                        icon: 'help_outline',
                                        size: 'small',
                                        style: { color: '#2563eb', cursor: 'help' },
                                        title: 'Suplemento a añadir al precio base de la cita. El precio se guarda en céntimos, 100 = 1€'
                                    })
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.678571em 1em',
                                        border: '1px solid rgba(34, 36, 38, 0.15)',
                                        borderRadius: '0.285714rem',
                                        backgroundColor: 'white',
                                        marginTop: '0.5rem'
                                    }
                                }, [
                                    m(Text, { fontSize: '1rem' }, [
                                        m(Text, {}, state.formData.supplement),
                                        m(Text, { marginLeft: '0.5rem', color: '#64748b' }, `(${(state.formData.supplement / 100).toFixed(2)}€)`)
                                    ]),
                                    m(FlexRow, { gap: '0.5rem' }, [
                                        m(Icon, {
                                            icon: 'remove',
                                            size: 'small',
                                            style: { color: '#94a3b8', cursor: 'pointer' },
                                            onclick: () => decrementValue('supplement', 0)
                                        }),
                                        m(Icon, {
                                            icon: 'add',
                                            size: 'small',
                                            style: { color: '#21ba45', cursor: 'pointer' },
                                            onclick: () => incrementValue('supplement', 0, 99999)
                                        })
                                    ])
                                ])
                            ])
                        ])
                    ]),
                    
                    state.activeTab === 'excepciones' && m(Div, {}, [
                        m(Text, { fontSize: '0.875rem', color: '#64748b' }, 'Gestión de excepciones (próximamente)')
                    ]),
                    
                    state.activeTab === 'extra' && m(Div, {}, [
                        m(Text, { fontSize: '0.875rem', color: '#64748b' }, 'Configuración extra (próximamente)')
                    ])
                ])
            ]),
            
            m(ModalFooter, [
                m(Button, {
                    type: 'positive',
                    onclick: () => {
                        // TODO: Implementar guardado
                        console.log('Guardar horarios:', state.formData);
                        if (onClose) onClose();
                    }
                }, 'Guardar horarios'),
                m(Button, {
                    type: 'negative',
                    onclick: () => {
                        if (onClose) onClose();
                    }
                }, 'Cerrar')
            ])
        ]);
    }
};

