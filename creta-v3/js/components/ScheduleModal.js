// Schedule Management Modal Component

import { FlexCol, FlexRow, Div } from '../../../DView/layout.js';
import { H2, Text } from '../../../DView/texts.js';
import { Button, Icon } from '../../../DView/elements.js';
import { Input, Switch } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../DView/dialogs.js';

export const ScheduleModal = {
    oninit: (vnode) => {
        const { resource, schedules = [] } = vnode.attrs;
        
        // Initialize state properly for Mithril (assign properties individually)
        vnode.state.schedules = schedules; // Lista de horarios existentes (array de virtualSettings)
        vnode.state.activeTab = 'basico'; // 'basico', 'excepciones', 'extra'
        vnode.state.panelOpen = false; // Panel lateral de excepciones
        vnode.state.exceptionType = 'block'; // 'block' o 'custom'
        vnode.state.exceptionScope = 'all'; // 'all' o 'specific'
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
            extra: {
                published: true, // Estado del horario (publicado/despublicado)
                slotSeparation: null, // Separar slots cada X asientos
                publicTitle: '', // Título público del slot
                description: '', // Descripción visible para el cliente
                index: 0, // Índice (orden)
                tag: '', // Tag/Etiqueta
                featuredImage: null // URL de la imagen destacada
            }
        };
        
        // Guardar referencia al elemento del modal para poder cerrarlo
        vnode.state.modalElement = null;
    },
    
    oncreate: (vnode) => {
        // Encontrar el elemento del modal (el div padre creado por openDialog)
        // openDialog crea un div con position:fixed e inset:0px
        let current = vnode.dom;
        let depth = 0;
        while (current && current.parentElement && depth < 15) {
            current = current.parentElement;
            depth++;
            const style = current.getAttribute('style') || '';
            if (style.includes('position:fixed') && style.includes('inset:0px')) {
                vnode.state.modalElement = current;
                break;
            }
        }
        
        // Si no se encontró, intentar otra búsqueda
        if (!vnode.state.modalElement) {
            vnode.state.modalElement = vnode.dom.closest('[style*="position:fixed"]') || 
                                        vnode.dom.closest('[style*="z-index"]') ||
                                        vnode.dom.parentElement?.parentElement;
        }
    },
    
    view: (vnode) => {
        const state = vnode.state;
        const { onClose, onCancel, resource } = vnode.attrs;
        
        // Función para cerrar el modal
        // openDialog siempre pasa onCancel, así que lo usamos directamente
        const closeModal = () => {
            // openDialog siempre pasa onCancel, así que tiene prioridad
            if (onCancel) {
                try {
                    onCancel();
                } catch (e) {
                    // Error silencioso
                }
                return;
            }
            
            // Fallback a onClose si existe
            if (onClose) {
                try {
                    onClose();
                } catch (e) {
                    // Error silencioso
                }
                return;
            }
            
            // Último recurso: buscar y cerrar manualmente
            let elementToClose = state.modalElement;
            
            if (!elementToClose && vnode.dom) {
                let current = vnode.dom;
                let depth = 0;
                while (current && current.parentElement && depth < 10) {
                    current = current.parentElement;
                    depth++;
                    const style = current.getAttribute('style') || '';
                    if (style.includes('position:fixed') && style.includes('z-index')) {
                        elementToClose = current;
                        break;
                    }
                }
            }
            
            if (elementToClose) {
                try {
                    m.mount(elementToClose, null);
                    setTimeout(() => {
                        if (elementToClose && elementToClose.parentNode) {
                            elementToClose.remove();
                        }
                    }, 0);
                } catch (e) {
                    if (elementToClose && elementToClose.parentNode) {
                        elementToClose.remove();
                    }
                }
            }
        };
        
        const daysOfWeek = [
            { value: 1, label: 'L', fullLabel: 'Lunes' },
            { value: 2, label: 'M', fullLabel: 'Martes' },
            { value: 3, label: 'X', fullLabel: 'Miércoles' },
            { value: 4, label: 'J', fullLabel: 'Jueves' },
            { value: 5, label: 'V', fullLabel: 'Viernes' },
            { value: 6, label: 'S', fullLabel: 'Sábado' },
            { value: 0, label: 'D', fullLabel: 'Domingo' }
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
        
        const loadSchedule = (schedule) => {
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
                extra: {
                    published: schedule.extra?.published !== false,
                    slotSeparation: schedule.extra?.slotSeparation || null,
                    publicTitle: schedule.extra?.publicTitle || '',
                    description: schedule.extra?.description || '',
                    index: schedule.extra?.index || 0,
                    tag: schedule.extra?.tag || '',
                    featuredImage: schedule.extra?.featuredImage || null
                }
            };
            state.activeTab = 'basico';
                m.redraw();
        };
        
        const resetForm = () => {
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
                extra: {
                    published: true,
                    slotSeparation: null,
                    publicTitle: '',
                    description: '',
                    index: 0,
                    tag: '',
                    featuredImage: null
                }
                            };
                            state.selectedSchedule = null;
                            state.activeTab = 'basico';
                            m.redraw();
        };
        
        const formatTime = (time) => {
            if (!time) return '';
            return time;
        };
        
        const formatScheduleTime = (schedule) => {
            const start = schedule.startHour || '';
            const end = schedule.endHour || '';
            if (start && end) {
                return `${start} - ${end}`;
            }
            return '';
        };
        
        const getExceptionsCount = (schedule) => {
            return Array.isArray(schedule.exceptions) ? schedule.exceptions.length : 0;
        };
        
        return [
            m('style', `
                .schedule-modal-input:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
                    outline: none;
                }
                .day-checkbox-label:hover {
                    border-color: #3b82f6 !important;
                }
            `),
            m(Modal, {
                size: 'big',
                close: closeModal,
                        style: {
                    width: '1000px',
                    maxWidth: '100%',
                    height: '85vh',
                            display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }
            }, [
            // Header
            m(ModalHeader, {
                style: {
                    padding: '16px 24px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                            alignItems: 'center',
                    background: 'white',
                    flexShrink: 0
                }
            }, [
                m(H2, { 
                    marginTop: 0, 
                    marginBottom: 0,
                    style: {
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        margin: 0,
                        flex: 1,
                        textAlign: 'left'
                    }
                }, 'Gestión de Horarios'),
                m('button', {
                    onclick: (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeModal();
                    },
                    style: {
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontSize: '1.5rem',
                        lineHeight: 1,
                        padding: '0',
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px'
                    }
                }, '×')
            ]),
            
            // Body: Sidebar + Main Content
            m(Div, {
                            style: {
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden'
                }
            }, [
                // Sidebar (Izquierda)
                m(Div, {
                                style: {
                        width: '280px',
                        background: '#f8fafc',
                        borderRight: '1px solid #e2e8f0',
                                    display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }
                }, [
                    // Botón Añadir
                                m(Div, {
                                    style: { 
                            padding: '16px',
                            borderBottom: '1px solid #e2e8f0'
                        }
                    }, [
                        m(Button, {
                            type: 'blue',
                            onclick: resetForm,
                            style: {
                                width: '100%',
                                padding: '10px',
                                        display: 'flex', 
                                        alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                borderRadius: '8px',
                                fontWeight: 500
                            }
                        }, [
                            m(Text, { color: 'white', fontSize: '0.95rem' }, '+ Añadir Nuevo Horario')
                                ])
                            ]),
                            
                    // Lista de horarios
                    m(Div, {
                                style: {
                            flex: 1,
                            overflowY: 'auto',
                            padding: '12px',
                            listStyle: 'none',
                            margin: 0
                        }
                    }, [
                        ...state.schedules.map((schedule, index) => {
                            const isActive = state.selectedSchedule?.id === schedule.id;
                            return m(Div, {
                                key: schedule.id || index,
                                onclick: () => loadSchedule(schedule),
                                style: {
                                    padding: '12px',
                                    marginBottom: '8px',
                                    background: isActive ? '#eff6ff' : 'white',
                                    border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: isActive ? '0 0 0 1px #3b82f6' : 'none'
                                },
                                onmouseenter: (e) => {
                                    if (!isActive) {
                                        e.target.style.borderColor = '#3b82f6';
                                        e.target.style.transform = 'translateY(-1px)';
                                        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                    }
                                },
                                onmouseleave: (e) => {
                                    if (!isActive) {
                                        e.target.style.borderColor = '#e2e8f0';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = 'none';
                                    }
                                }
                            }, [
                                m(Text, {
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    color: '#1e293b',
                                    display: 'block',
                                    marginBottom: '4px'
                                }, schedule.name || `Horario ${index + 1}`),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        fontSize: '0.75rem',
                                        color: '#64748b',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }
                                }, [
                                    m(Text, { 
                                        fontSize: '0.75rem', 
                                        color: '#64748b',
                                        margin: 0
                                    }, formatScheduleTime(schedule)),
                                    m(Text, { 
                                        fontSize: '0.75rem', 
                                        color: '#64748b',
                                        margin: 0
                                    }, `${schedule.seats || 0} plazas`)
                            ])
                        ]);
                    })
                    ])
                ]),
                
                // Main Content (Derecha)
                m(Div, {
                    style: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'white',
                        overflow: 'hidden'
                    }
                }, [
                // Tabs
                    m(Div, {
                    style: {
                            display: 'flex',
                        borderBottom: '1px solid #e2e8f0',
                            padding: '0 24px',
                            background: 'white',
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            flexShrink: 0
                        }
                    }, [
                        ['basico', 'Configuración Básica'],
                        ['excepciones', `Excepciones${state.selectedSchedule ? ` (${getExceptionsCount(state.selectedSchedule)})` : ''}`],
                        ['extra', 'Avanzado']
                    ].map(([tab, label]) => 
                        m('div', {
                            onclick: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                state.activeTab = tab;
                                m.redraw();
                            },
                            style: {
                                padding: '16px 4px',
                                marginRight: '24px',
                                cursor: 'pointer',
                                color: state.activeTab === tab ? '#3b82f6' : '#64748b',
                                fontWeight: 500,
                                borderBottom: `2px solid ${state.activeTab === tab ? '#3b82f6' : 'transparent'}`,
                                fontSize: '0.95rem',
                                transition: 'all 0.2s'
                            }
                        }, label)
                    )),
                
                    // Form Container
                    m(Div, {
                        style: {
                            flex: 1,
                            overflowY: 'auto',
                            padding: '24px'
                        }
                    }, [
                        (() => {
                            if (state.activeTab === 'basico') {
                                return m(Div, {
                                    style: {
                                        maxWidth: '800px'
                                    }
                                }, [
                                    // Nombre del Horario
                                    m(Div, {
                                        style: {
                                            display: 'grid',
                                            gridTemplateColumns: '1fr',
                                            gap: '20px',
                                            marginBottom: '24px'
                                        }
                                    }, [
                                        m(Div, {
                                            style: {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px'
                                            }
                                        }, [
                                            m(Text, {
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b'
                                            }, 'Nombre del Horario'),
                                            m(Input, {
                                                value: state.formData.name,
                                                onchange: (e) => {
                                                    state.formData.name = e.target.value;
                                                    m.redraw();
                                                },
                                                placeholder: 'Ej. Turno de Mañana',
                                                style: {
                                                    padding: '10px 12px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.95rem',
                                                    width: '100%',
                                                    boxSizing: 'border-box'
                                                },
                                                class: 'schedule-modal-input'
                                            })
                                        ])
                                    ]),
                            
                            // Sección: Vigencia y Hora
                            m(Text, {
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#64748b',
                                margin: '24px 0 16px 0',
                                borderBottom: '1px solid #e2e8f0',
                                paddingBottom: '8px',
                                fontWeight: 700
                            }, 'Vigencia y Hora'),
                            
                            // Fechas
                            m(Div, {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '24px'
                                }
                            }, [
                                m(Div, {
                                style: { 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#1e293b'
                                    }, 'Fecha Inicio'),
                                m(Input, {
                                    type: 'date',
                                    value: state.formData.startDate,
                                    onchange: (e) => {
                                        state.formData.startDate = e.target.value;
                                        m.redraw();
                                    },
                                    style: {
                                        padding: '10px 12px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    },
                                    class: 'schedule-modal-input'
                                })
                            ]),
                                m(Div, {
                                style: { 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#1e293b'
                                    }, 'Fecha Fin'),
                                m(Input, {
                                    type: 'date',
                                    value: state.formData.endDate,
                                    onchange: (e) => {
                                        state.formData.endDate = e.target.value;
                                        m.redraw();
                                    },
                                    style: {
                                        padding: '10px 12px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    },
                                    class: 'schedule-modal-input'
                                })
                                ])
                            ]),
                            
                            // Horas
                            m(Div, {
                                style: { 
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '24px'
                                }
                            }, [
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                } 
                            }, [
                                m(Text, {
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#1e293b'
                                }, 'Hora Inicio'),
                                m(Input, {
                                    type: 'time',
                                    value: state.formData.startHour,
                                    onchange: (e) => {
                                        state.formData.startHour = e.target.value;
                                        m.redraw();
                                    },
                                    required: true,
                                    style: {
                                        padding: '10px 12px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    },
                                    class: 'schedule-modal-input'
                                })
                            ]),
                                m(Div, {
                                style: { 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                } 
                            }, [
                                m(Text, {
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#1e293b'
                                }, 'Hora Fin'),
                                m(Input, {
                                    type: 'time',
                                    value: state.formData.endHour,
                                    onchange: (e) => {
                                        state.formData.endHour = e.target.value;
                                        m.redraw();
                                    },
                                    required: true,
                                    style: {
                                        padding: '10px 12px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        fontSize: '0.95rem',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    },
                                    class: 'schedule-modal-input'
                                })
                            ])
                        ]),
                            
                            // Sección: Recurrencia Semanal
                            m(Text, {
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#64748b',
                                margin: '24px 0 16px 0',
                                borderBottom: '1px solid #e2e8f0',
                                paddingBottom: '8px',
                                fontWeight: 700
                            }, 'Recurrencia Semanal'),
                        
                        // Días disponibles
                            m(Div, {
                                style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    marginBottom: '24px'
                                }
                            }, [
                                m(Text, {
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#1e293b'
                                }, 'Días disponibles'),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        gap: '8px',
                                        marginTop: '4px'
                                    }
                                }, [
                                    ...daysOfWeek.map(day => {
                                        const isChecked = state.formData.days.includes(day.value);
                                        return m('label', {
                                            style: {
                                                cursor: 'pointer',
                                                position: 'relative'
                                            }
                                        }, [
                                            m('input', {
                                                type: 'checkbox',
                                                class: 'day-checkbox',
                                                checked: isChecked,
                                                onchange: () => toggleDay(day.value),
                                                style: {
                                                    display: 'none'
                                                }
                                            }),
                                            m('span', {
                                                class: 'day-checkbox-label',
                                                style: {
                                                    width: '40px',
                                                    height: '40px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '50%',
                                                    border: `1px solid ${isChecked ? '#3b82f6' : '#e2e8f0'}`,
                                                    background: isChecked ? '#3b82f6' : 'white',
                                                    color: isChecked ? 'white' : '#64748b',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s',
                                                    userSelect: 'none',
                                                    boxShadow: isChecked ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
                                                },
                                                onmouseenter: (e) => {
                                                    if (!isChecked) {
                                                        e.currentTarget.style.borderColor = '#3b82f6';
                                                        e.currentTarget.style.color = '#3b82f6';
                                                    }
                                                },
                                                onmouseleave: (e) => {
                                                    if (!isChecked) {
                                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                                        e.currentTarget.style.color = '#64748b';
                                                    }
                                                }
                                            }, day.label)
                                        ]);
                                })
                            ]),
                                m('small', {
                                    style: {
                                        color: '#64748b',
                                        marginTop: '8px',
                                        fontSize: '0.8rem',
                                        display: 'block',
                                        lineHeight: '1.4'
                                    }
                                }, 'El horario se generará automáticamente para los días marcados dentro del rango de fechas.')
                            ]),
                            
                            // Sección: Capacidad y Precio
                            m(Text, {
                                fontSize: '0.85rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#64748b',
                                margin: '24px 0 16px 0',
                                borderBottom: '1px solid #e2e8f0',
                                paddingBottom: '8px',
                                fontWeight: 700
                            }, 'Capacidad y Precio'),
                            
                            // Plazas, Duración, Suplemento
                            m(Div, {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: '20px',
                                    marginBottom: '24px'
                                }
                            }, [
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#1e293b'
                                    }, 'Plazas Totales'),
                                    m(Input, {
                                        type: 'number',
                                        value: state.formData.seats,
                                        onchange: (e) => {
                                            state.formData.seats = parseInt(e.target.value) || 0;
                                            m.redraw();
                                        },
                                        min: 0,
                                        style: {
                                            padding: '10px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        },
                                        class: 'schedule-modal-input'
                                    })
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#1e293b'
                                    }, [
                                        'Duración ',
                                        m('span', {
                                            style: {
                                                fontWeight: 400,
                                                color: '#64748b',
                                                fontSize: '0.8rem'
                                            }
                                        }, '(min)')
                                    ]),
                                    m(Input, {
                                        type: 'number',
                                        value: state.formData.appDuration,
                                        onchange: (e) => {
                                            state.formData.appDuration = parseInt(e.target.value) || 0;
                                            m.redraw();
                                        },
                                        placeholder: 'Auto',
                                        min: 0,
                                        style: {
                                            padding: '10px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        },
                                        class: 'schedule-modal-input'
                                    })
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#1e293b'
                                    }, [
                                        'Suplemento ',
                                        m('span', {
                                            style: {
                                                fontWeight: 400,
                                                color: '#64748b',
                                                fontSize: '0.8rem'
                                            }
                                        }, '(€)')
                                    ]),
                                    m(Input, {
                                        type: 'number',
                                        value: (state.formData.supplement / 100).toFixed(2),
                                        onchange: (e) => {
                                            state.formData.supplement = Math.round(parseFloat(e.target.value || 0) * 100);
                                            m.redraw();
                                        },
                                        step: 0.50,
                                        min: 0,
                                        style: {
                                            padding: '10px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        },
                                        class: 'schedule-modal-input'
                                    })
                                ])
                            ])
                                ]);
                            } else if (state.activeTab === 'excepciones') {
                                const formatExceptionDate = (dateStr) => {
                                    if (!dateStr) return { day: '', month: '' };
                                    const date = new Date(dateStr);
                                    const day = date.getDate();
                                    const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                                    const month = monthNames[date.getMonth()];
                                    return { day, month };
                                };
                                
                                return m(Div, {
                                    style: {
                                        position: 'relative',
                                        height: '100%',
                                        overflow: 'hidden'
                                    }
                                }, [
                                    // Contenido principal (lista de reglas)
                                    m(Div, {
                                        style: {
                                            opacity: state.panelOpen ? 0.4 : 1,
                                            pointerEvents: state.panelOpen ? 'none' : 'auto',
                                            filter: state.panelOpen ? 'grayscale(0.5)' : 'none',
                                            transition: 'all 0.3s'
                                        }
                                    }, [
                                        // Toolbar
                                        m(Div, {
                                            style: {
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '20px'
                                            }
                                        }, [
                                            m(Div, {}, [
                                                m(Text, {
                                                    margin: '0 0 4px 0',
                                                    fontSize: '1rem',
                                                    color: '#1e293b',
                                                    fontWeight: 600
                                                }, 'Días Especiales y Bloqueos'),
                                                m(Text, {
                                                    margin: 0,
                                                    fontSize: '0.85rem',
                                                    color: '#64748b'
                                                }, 'Gestión de festivos y modificaciones de servicio.')
                                            ]),
                                            m(Button, {
                                                type: 'default',
                                                onclick: () => {
                                                    state.panelOpen = true;
                                                    state.exceptionType = 'block';
                                                    state.exceptionScope = 'all';
                                                    m.redraw();
                                                },
                                                style: {
                                                    background: 'white',
                                                    border: '1px dashed #3b82f6',
                                                    color: '#3b82f6',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    fontWeight: 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }
                                            }, [
                                                m(Icon, { icon: 'add', size: 'small' }),
                                                m(Text, { fontSize: '0.9rem' }, 'Añadir Regla')
                                            ])
                                        ]),
                                        
                                        // Lista de reglas
                                        m(Div, {}, [
                                            ...(state.formData.exceptions || []).map((exception, index) => {
                                                const isClosed = exception.type === 'block';
                                                const dateInfo = formatExceptionDate(exception.startDate);
                                                
                                                return m(Div, {
                                                    onclick: () => {
                                                        // TODO: Cargar excepción para editar
                                                        state.panelOpen = true;
                                                        m.redraw();
                                                    },
                                                    style: {
                                                        background: 'white',
                                                        border: `1px solid ${isClosed ? '#ef4444' : '#f59e0b'}`,
                                                        borderLeft: `4px solid ${isClosed ? '#ef4444' : '#f59e0b'}`,
                                                        borderRadius: '8px',
                                                        padding: '16px',
                                                        marginBottom: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    },
                                                    onmouseenter: (e) => {
                                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                    },
                                                    onmouseleave: (e) => {
                                                        e.currentTarget.style.borderColor = isClosed ? '#ef4444' : '#f59e0b';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }
                                                }, [
                                                    // Fecha
                                                    m(Div, {
                                                        style: {
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            minWidth: '70px',
                                                            paddingRight: '16px',
                                                            borderRight: '1px solid #e2e8f0',
                                                            marginRight: '16px'
                                                        }
                                                    }, [
                                                        m(Text, {
                                                            fontSize: '1.2rem',
                                                            fontWeight: 700,
                                                            color: '#1e293b',
                                                            lineHeight: 1
                                                        }, dateInfo.day),
                                                        m(Text, {
                                                            fontSize: '0.75rem',
                                                            textTransform: 'uppercase',
                                                            color: '#64748b',
                                                            fontWeight: 600,
                                                            marginTop: '4px'
                                                        }, dateInfo.month)
                                                    ]),
                                                    // Contenido
                                                    m(Div, {
                                                        style: {
                                                            flex: 1
                                                        }
                                                    }, [
                                                        m(FlexRow, {
                                                            style: {
                                                                alignItems: 'center',
                                                                gap: '10px',
                                                                marginBottom: '4px'
                                                            }
                                                        }, [
                                                            m(Text, {
                                                                fontWeight: 600,
                                                                color: '#1e293b',
                                                                fontSize: '0.95rem'
                                                            }, exception.name || 'Sin nombre'),
                                                            m(Div, {
                                                                style: {
                                                                    padding: '4px 10px',
                                                                    borderRadius: '20px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 600,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    background: isClosed ? '#fef2f2' : '#fffbeb',
                                                                    color: isClosed ? '#ef4444' : '#b45309'
                                                                }
                                                            }, isClosed ? 'Cerrado' : `${exception.seats || 0} Plazas`)
                                                        ]),
                                                        m(Text, {
                                                            fontSize: '0.85rem',
                                                            color: '#64748b'
                                                        }, exception.description || (isClosed ? 'Cierre total de la instalación.' : 'Modificación de servicio.'))
                                                    ])
                                                ]);
                                            }),
                                            (state.formData.exceptions || []).length === 0 && m(Div, {
                                                style: {
                                                    textAlign: 'center',
                                                    padding: '40px 20px',
                                                    color: '#64748b'
                                                }
                                            }, [
                                                m(Text, { fontSize: '0.9rem' }, 'No hay excepciones configuradas.'),
                                                m(Text, {
                                                    fontSize: '0.85rem',
                                                    marginTop: '8px',
                                                    display: 'block'
                                                }, 'Haz clic en "Añadir Regla" para crear una nueva.')
                                            ])
                                        ])
                                    ]),
                                    
                                    // Panel lateral deslizante
                                    m(Div, {
                                        style: {
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            bottom: 0,
                                            width: '420px',
                                            background: 'white',
                                            borderLeft: '1px solid #e2e8f0',
                                            boxShadow: '-10px 0 25px rgba(0,0,0,0.05)',
                                            zIndex: 100,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transform: state.panelOpen ? 'translateX(0%)' : 'translateX(100%)',
                                            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }
                                    }, [
                                        // Header del panel
                                        m(Div, {
                                            style: {
                                                padding: '16px 24px',
                                                borderBottom: '1px solid #e2e8f0',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                background: '#fff'
                                            }
                                        }, [
                                            m(Text, {
                                                fontSize: '1rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                margin: 0
                                            }, 'Nueva Regla'),
                                            m('button', {
                                                onclick: () => {
                                                    state.panelOpen = false;
                                                    m.redraw();
                                                },
                                                style: {
                                                    border: 'none',
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '1.5rem',
                                                    color: '#64748b',
                                                    padding: 0,
                                                    lineHeight: 1
                                                }
                                            }, '×')
                                        ]),
                                        
                                        // Body del panel
                                        m(Div, {
                                            style: {
                                                padding: '24px',
                                                overflowY: 'auto',
                                                flex: 1
                                            }
                                        }, [
                                            // Tipo de excepción
                                            m(Text, {
                                                display: 'block',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                marginBottom: '8px'
                                            }, 'Tipo de Excepción'),
                                            m(Div, {
                                                style: {
                                                    display: 'flex',
                                                    background: '#f1f5f9',
                                                    padding: '4px',
                                                    borderRadius: '8px',
                                                    marginBottom: '20px'
                                                }
                                            }, [
                                                m('div', {
                                                    onclick: () => {
                                                        state.exceptionType = 'block';
                                                        m.redraw();
                                                    },
                                                    style: {
                                                        flex: 1,
                                                        textAlign: 'center',
                                                        padding: '8px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: state.exceptionType === 'block' ? 600 : 500,
                                                        cursor: 'pointer',
                                                        borderRadius: '6px',
                                                        color: state.exceptionType === 'block' ? '#1e293b' : '#64748b',
                                                        background: state.exceptionType === 'block' ? 'white' : 'transparent',
                                                        boxShadow: state.exceptionType === 'block' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                                        transition: 'all 0.2s'
                                                    }
                                                }, 'Bloquear Día'),
                                                m('div', {
                                                    onclick: () => {
                                                        state.exceptionType = 'custom';
                                                        m.redraw();
                                                    },
                                                    style: {
                                                        flex: 1,
                                                        textAlign: 'center',
                                                        padding: '8px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: state.exceptionType === 'custom' ? 600 : 500,
                                                        cursor: 'pointer',
                                                        borderRadius: '6px',
                                                        color: state.exceptionType === 'custom' ? '#1e293b' : '#64748b',
                                                        background: state.exceptionType === 'custom' ? 'white' : 'transparent',
                                                        boxShadow: state.exceptionType === 'custom' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                                        transition: 'all 0.2s'
                                                    }
                                                }, 'Personalizar')
                                            ]),
                                            m(Div, {
                                                style: {
                                                    fontSize: '0.8rem',
                                                    color: '#64748b',
                                                    marginTop: '-10px',
                                                    marginBottom: '20px',
                                                    background: '#f8fafc',
                                                    padding: '10px',
                                                    borderRadius: '8px'
                                                }
                                            }, state.exceptionType === 'block' 
                                                ? m(Text, {}, [
                                                    'El servicio aparecerá como ',
                                                    m(Text, { color: '#ef4444', fontWeight: 600 }, 'CERRADO'),
                                                    '. No se permitirán reservas.'
                                                ])
                                                : m(Text, {}, 'El servicio sigue activo, pero puedes modificar el aforo o el precio original.')
                                            ),
                                            
                                            // Nombre/Motivo
                                            m(Text, {
                                                display: 'block',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                marginBottom: '8px'
                                            }, 'Nombre / Motivo'),
                                            m(Input, {
                                                placeholder: 'Ej. Festivo, Obras...',
                                                style: {
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '10px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.9rem',
                                                    marginBottom: '20px'
                                                },
                                                class: 'schedule-modal-input'
                                            }),
                                            
                                            // Rango de fechas
                                            m(Text, {
                                                display: 'block',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                marginBottom: '8px'
                                            }, 'Rango de fechas'),
                                            m(FlexRow, {
                                                style: {
                                                    gap: '16px',
                                                    marginBottom: '20px'
                                                }
                                            }, [
                                                m(FlexCol, { flex: 1 }, [
                                                    m(Text, {
                                                        fontSize: '0.75rem',
                                                        color: '#64748b',
                                                        marginBottom: '4px'
                                                    }, 'Desde'),
                                                    m(Input, {
                                                        type: 'date',
                                                        style: {
                                                            width: '100%',
                                                            boxSizing: 'border-box',
                                                            padding: '10px',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem'
                                                        },
                                                        class: 'schedule-modal-input'
                                                    })
                                                ]),
                                                m(FlexCol, { flex: 1 }, [
                                                    m(Text, {
                                                        fontSize: '0.75rem',
                                                        color: '#64748b',
                                                        marginBottom: '4px'
                                                    }, 'Hasta'),
                                                    m(Input, {
                                                        type: 'date',
                                                        style: {
                                                            width: '100%',
                                                            boxSizing: 'border-box',
                                                            padding: '10px',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            fontSize: '0.9rem'
                                                        },
                                                        class: 'schedule-modal-input'
                                                    })
                                                ])
                                            ]),
                                            
                                            // Campos de personalización (solo si es tipo 'custom')
                                            state.exceptionType === 'custom' && m(Div, {
                                                style: {
                                                    background: '#eff6ff',
                                                    padding: '16px',
                                                    borderRadius: '8px',
                                                    marginBottom: '20px',
                                                    border: '1px solid #dbeafe'
                                                }
                                            }, [
                                                m(Text, {
                                                    color: '#1e40af',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    marginBottom: '8px',
                                                    display: 'block'
                                                }, 'Valores de sobreescritura'),
                                                m(FlexRow, {
                                                    style: {
                                                        gap: '16px'
                                                    }
                                                }, [
                                                    m(FlexCol, { flex: 1 }, [
                                                        m(Text, {
                                                            fontSize: '0.75rem',
                                                            color: '#60a5fa',
                                                            marginBottom: '4px'
                                                        }, 'Nuevo Aforo'),
                                                        m(Input, {
                                                            type: 'number',
                                                            placeholder: 'Original: 25',
                                                            style: {
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                padding: '10px',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '8px',
                                                                fontSize: '0.9rem'
                                                            },
                                                            class: 'schedule-modal-input'
                                                        })
                                                    ]),
                                                    m(FlexCol, { flex: 1 }, [
                                                        m(Text, {
                                                            fontSize: '0.75rem',
                                                            color: '#60a5fa',
                                                            marginBottom: '4px'
                                                        }, 'Nuevo Precio (€)'),
                                                        m(Input, {
                                                            type: 'number',
                                                            placeholder: 'Original: 10€',
                                                            style: {
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                padding: '10px',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '8px',
                                                                fontSize: '0.9rem'
                                                            },
                                                            class: 'schedule-modal-input'
                                                        })
                                                    ])
                                                ])
                                            ]),
                                            
                                            // Alcance
                                            m(Text, {
                                                display: 'block',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                marginBottom: '8px'
                                            }, '¿Afecta a todo el servicio?'),
                                            m('select', {
                                                value: state.exceptionScope,
                                                onchange: (e) => {
                                                    state.exceptionScope = e.target.value;
                                                    m.redraw();
                                                },
                                                style: {
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                    padding: '10px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.9rem',
                                                    marginBottom: '20px',
                                                    outline: 'none',
                                                    background: 'white'
                                                }
                                            }, [
                                                m('option', { value: 'all' }, 'Todo el día (Todas las horas)'),
                                                m('option', { value: 'specific' }, 'Solo horas específicas...')
                                            ]),
                                            
                                            // Selector de slots (solo si es 'specific')
                                            state.exceptionScope === 'specific' && m(Div, {
                                                style: {
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    padding: '12px',
                                                    marginTop: '-10px',
                                                    marginBottom: '20px',
                                                    maxHeight: '150px',
                                                    overflowY: 'auto'
                                                }
                                            }, [
                                                m(Text, {
                                                    fontSize: '0.75rem',
                                                    color: '#64748b',
                                                    marginBottom: '8px',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 600,
                                                    display: 'block'
                                                }, 'Selecciona los pases afectados:'),
                                                // TODO: Generar slots dinámicamente basados en el horario
                                                m(Div, {
                                                    style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '8px',
                                                        borderBottom: '1px solid #e2e8f0'
                                                    }
                                                }, [
                                                    m('input', {
                                                        type: 'checkbox',
                                                        id: 'slot1'
                                                    }),
                                                    m('label', {
                                                        htmlFor: 'slot1',
                                                        style: {
                                                            fontSize: '0.9rem',
                                                            color: '#1e293b',
                                                            cursor: 'pointer'
                                                        }
                                                    }, '10:00 - 11:30')
                                                ]),
                                                m(Div, {
                                                    style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '8px',
                                                        borderBottom: '1px solid #e2e8f0'
                                                    }
                                                }, [
                                                    m('input', {
                                                        type: 'checkbox',
                                                        id: 'slot2'
                                                    }),
                                                    m('label', {
                                                        htmlFor: 'slot2',
                                                        style: {
                                                            fontSize: '0.9rem',
                                                            color: '#1e293b',
                                                            cursor: 'pointer'
                                                        }
                                                    }, '12:00 - 13:30')
                                                ])
                                            ]),
                                            
                                            // Repetir anualmente
                                            m(FlexRow, {
                                                style: {
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '20px',
                                                    cursor: 'pointer'
                                                }
                                            }, [
                                                m('input', {
                                                    type: 'checkbox',
                                                    id: 'repeat-annually',
                                                    style: {
                                                        width: '16px',
                                                        height: '16px',
                                                        cursor: 'pointer'
                                                    }
                                                }),
                                                m('label', {
                                                    htmlFor: 'repeat-annually',
                                                    style: {
                                                        fontSize: '0.9rem',
                                                        color: '#1e293b',
                                                        cursor: 'pointer'
                                                    }
                                                }, 'Repetir anualmente')
                                            ])
                                        ]),
                                        
                                        // Footer del panel
                                        m(Div, {
                                            style: {
                                                padding: '16px 24px',
                                                borderTop: '1px solid #e2e8f0',
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                gap: '12px',
                                                background: '#f8fafc'
                                            }
                                        }, [
                                            m(Button, {
                                                type: 'default',
                                                onclick: () => {
                                                    state.panelOpen = false;
                                                    m.redraw();
                                                },
                                                style: {
                                                    padding: '10px 20px',
                                                    borderRadius: '8px',
                                                    fontWeight: 500,
                                                    fontSize: '0.95rem',
                                                    background: 'white',
                                                    borderColor: '#e2e8f0',
                                                    color: '#1e293b'
                                                }
                                            }, 'Cancelar'),
                                            m(Button, {
                                                type: 'positive',
                                                onclick: () => {
                                                    // TODO: Guardar excepción
                                                    state.panelOpen = false;
                                                    m.redraw();
                                                },
                                                style: {
                                                    padding: '10px 20px',
                                                    borderRadius: '8px',
                                                    fontWeight: 500,
                                                    fontSize: '0.95rem',
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none'
                                                }
                                            }, 'Guardar Regla')
                                        ])
                                    ])
                                ]);
                            } else if (state.activeTab === 'extra') {
                                return m(Div, {
                            style: {
                                maxWidth: '800px'
                            }
                        }, [
                            // Bloque 1: Control
                            m(Div, {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '24px'
                                }
                            }, [
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#1e293b'
                                    }, 'Estado del Horario'),
                                    m(Switch, {
                                        data: state.formData.extra,
                                        name: 'published',
                                        isActive: state.formData.extra.published !== false,
                                        activeColor: '#3b82f6',
                                        activeBg: '#dbeafe',
                                        onchange: () => {
                                            state.formData.extra.published = !state.formData.extra.published;
                                            m.redraw();
                                        },
                                        label: m(Text, {
                                            fontSize: '0.9rem',
                                            color: '#1e293b',
                                            fontWeight: 500
                                        }, 'Despublicado (Oculto)')
                                    }),
                                    m(Text, {
                                        color: '#64748b',
                                        marginTop: '5px',
                                        fontSize: '0.8rem'
                                    }, 'Si activas esto, los clientes no podrán ver ni reservar este horario.')
                                ]),
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        style: {
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            color: '#1e293b'
                                        }
                                    }, [
                                        'Separar slots cada ',
                                        m(Text, {
                                            style: {
                                                fontWeight: 400,
                                                color: '#64748b',
                                                fontSize: '0.8rem'
                                            }
                                        }, '(Asientos)')
                                    ]),
                                    m(Input, {
                                        type: 'number',
                                        value: state.formData.extra.slotSeparation || '',
                                        onchange: (e) => {
                                            state.formData.extra.slotSeparation = e.target.value ? parseInt(e.target.value) : null;
                                            m.redraw();
                                        },
                                        placeholder: 'Ej. 25',
                                        style: {
                                            padding: '10px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem'
                                        },
                                        class: 'schedule-modal-input'
                                    }),
                                    m(Text, {
                                        color: '#64748b',
                                        marginTop: '5px',
                                        fontSize: '0.8rem'
                                    }, 'Divide la disponibilidad total en bloques más pequeños.')
                                ])
                            ]),
                            
                            // Separador
                            m(Div, {
                                style: {
                                    border: '0',
                                    borderTop: '1px solid #e2e8f0',
                                    margin: '20px 0'
                                }
                            }),
                            
                            // Bloque 2: Info Pública y Multimedia
                            m(Div, {
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr',
                                    gap: '20px',
                                    marginBottom: '24px'
                                }
                            }, [
                                // Columna Izquierda: Textos
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '20px'
                                    }
                                }, [
                                    // Título Público
                                    m(Div, {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }
                                    }, [
                                        m(Text, {
                                            style: {
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b'
                                            }
                                        }, 'Título Público del Slot'),
                                        m(Div, {
                                            style: {
                                                position: 'relative',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }
                                        }, [
                                            m(Input, {
                                                value: state.formData.extra.publicTitle || '',
                                                onchange: (e) => {
                                                    state.formData.extra.publicTitle = e.target.value;
                                                    m.redraw();
                                                },
                                                placeholder: 'Ej. PRIMER PASE',
                                                style: {
                                                    padding: '10px 12px',
                                                    paddingRight: '100px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.95rem',
                                                    width: '100%',
                                                    boxSizing: 'border-box'
                                                },
                                                class: 'schedule-modal-input'
                                            }),
                                            m(Button, {
                                                type: 'default',
                                                onclick: () => {
                                                    // TODO: Implementar traducción
                                                },
                                                style: {
                                                    position: 'absolute',
                                                    right: '8px',
                                                    background: '#f1f5f9',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    color: '#64748b',
                                                    fontSize: '0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    minWidth: 'auto'
                                                }
                                            }, [
                                                m(Icon, { icon: 'language', size: 'small' }),
                                                m(Text, { fontSize: '0.8rem' }, 'Traducir')
                                    ])
                                ])
                            ]),
                                    
                                    // Descripción
                                    m(Div, {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }
                                    }, [
                                        m(Text, {
                                            style: {
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                color: '#1e293b'
                                            }
                                        }, 'Descripción'),
                                        m('textarea', {
                                            value: state.formData.extra.description || '',
                                            onchange: (e) => {
                                                state.formData.extra.description = e.target.value;
                                                m.redraw();
                                            },
                                            placeholder: 'Información visible para el cliente...',
                                            style: {
                                                padding: '10px 12px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '0.95rem',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                                minHeight: '80px',
                                                outline: 'none',
                                                transition: 'border 0.2s'
                                            },
                                            onfocus: (e) => {
                                                e.target.style.borderColor = '#3b82f6';
                                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                            },
                                            onblur: (e) => {
                                                e.target.style.borderColor = '#e2e8f0';
                                                e.target.style.boxShadow = 'none';
                                            }
                                    })
                                ]),
                                    
                                    // Índice y Tag
                                    m(Div, {
                                        style: {
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '20px',
                                            marginBottom: 0
                                        }
                                    }, [
                                m(Div, {
                                    style: {
                                        display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px'
                                            }
                                        }, [
                                            m(Text, {
                                                style: {
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: '#1e293b'
                                                }
                                            }, 'Índice (Orden)'),
                                            m(Input, {
                                                type: 'number',
                                                value: state.formData.extra.index || 0,
                                                onchange: (e) => {
                                                    state.formData.extra.index = parseInt(e.target.value) || 0;
                                                    m.redraw();
                                                },
                                                style: {
                                                    padding: '10px 12px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.95rem'
                                                },
                                                class: 'schedule-modal-input'
                                            })
                                        ]),
                                        m(Div, {
                                            style: {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px'
                                            }
                                        }, [
                                            m(Text, {
                                                style: {
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: '#1e293b'
                                                }
                                            }, 'Tag / Etiqueta'),
                                            m(Input, {
                                                value: state.formData.extra.tag || '',
                                                onchange: (e) => {
                                                    state.formData.extra.tag = e.target.value;
                                                    m.redraw();
                                                },
                                                placeholder: 'Ej. VIP',
                                                style: {
                                                    padding: '10px 12px',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    fontSize: '0.95rem'
                                                },
                                                class: 'schedule-modal-input'
                                        })
                                    ])
                                ])
                            ]),
                                
                                // Columna Derecha: Imagen
                                m(Div, {
                                style: { 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }
                                }, [
                                    m(Text, {
                                        style: {
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            color: '#1e293b'
                                        }
                                    }, 'Imagen Destacada'),
                                m(Div, {
                                    style: {
                                            border: '2px dashed #e2e8f0',
                                            borderRadius: '8px',
                                            padding: '4px',
                                            textAlign: 'center',
                                            position: 'relative',
                                            background: '#f8fafc',
                                            transition: 'all 0.2s',
                                            minHeight: '160px',
                                        display: 'flex',
                                        alignItems: 'center',
                                            justifyContent: 'center'
                                        },
                                        onmouseenter: (e) => {
                                            e.currentTarget.style.borderColor = '#3b82f6';
                                            e.currentTarget.style.background = '#eff6ff';
                                        },
                                        onmouseleave: (e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.background = '#f8fafc';
                                        }
                                    }, [
                                        state.formData.extra.featuredImage ? [
                                            m('img', {
                                                src: state.formData.extra.featuredImage,
                                                style: {
                                                    width: '100%',
                                                    height: '160px',
                                                    objectFit: 'cover',
                                                    borderRadius: '6px',
                                                    display: 'block'
                                                }
                                            }),
                                            m(Button, {
                                                type: 'negative',
                                                onclick: () => {
                                                    state.formData.extra.featuredImage = null;
                                                    m.redraw();
                                                },
                                                style: {
                                                    position: 'absolute',
                                                    top: '8px',
                                                    right: '8px',
                                                    background: 'white',
                                                    color: '#ef4444',
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                    border: 'none',
                                                    padding: 0,
                                                    minWidth: 'auto'
                                                }
                                            }, '×'),
                                            m(Div, {
                                                style: {
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: 'rgba(0,0,0,0.4)',
                                                    opacity: 0,
                                                    transition: 'opacity 0.2s',
                                                    borderRadius: '6px'
                                                },
                                                onmouseenter: (e) => {
                                                    e.currentTarget.style.opacity = 1;
                                                },
                                                onmouseleave: (e) => {
                                                    e.currentTarget.style.opacity = 0;
                                                }
                                            }, [
                                                m(Text, {
                                                    style: {
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        marginBottom: '8px',
                                                        fontSize: '0.9rem'
                                                    }
                                                }, 'Cambiar Imagen'),
                                                m(Button, {
                                                    type: 'default',
                                                    onclick: () => {
                                                        const input = document.createElement('input');
                                                        input.type = 'file';
                                                        input.accept = 'image/*';
                                                        input.onchange = (e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (event) => {
                                                                    state.formData.extra.featuredImage = event.target.result;
                                                                    m.redraw();
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        };
                                                        input.click();
                                                    },
                                                    style: {
                                                        background: 'white',
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        border: 'none'
                                                    }
                                                }, 'Subir nueva')
                                            ])
                                        ] : [
                                            m(Div, {
                                                style: {
                                                    padding: '40px 20px',
                                                    width: '100%'
                                                }
                                            }, [
                                        m(Icon, {
                                                    icon: 'image',
                                                    size: 'large',
                                                    style: {
                                                        color: '#64748b',
                                                        marginBottom: '12px'
                                                    }
                                                }),
                                                m(Text, {
                                                    style: {
                                                        color: '#64748b',
                                                        fontSize: '0.9rem',
                                                        marginBottom: '12px',
                                                        display: 'block'
                                                    }
                                                }, 'Haz clic para subir una imagen'),
                                                m(Button, {
                                                    type: 'default',
                                                    onclick: () => {
                                                        const input = document.createElement('input');
                                                        input.type = 'file';
                                                        input.accept = 'image/*';
                                                        input.onchange = (e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (event) => {
                                                                    state.formData.extra.featuredImage = event.target.result;
                                                                    m.redraw();
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        };
                                                        input.click();
                                                    },
                                                    style: {
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        padding: '8px 16px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        border: 'none'
                                                    }
                                                }, 'Subir Imagen')
                                            ])
                                        ]
                                    ])
                                ])
                            ])
                        ]);
                            }
                            return null;
                        })()
                    ])
                ])
            ]),
            
            // Footer
            m(ModalFooter, {
                style: {
                    padding: '16px 24px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px',
                    background: '#f8fafc',
                    flexShrink: 0
                }
            }, [
                m(Div, {
                    style: {
                        marginRight: 'auto',
                        display: 'flex',
                        gap: '12px'
                    }
                }, [
                    state.selectedSchedule && m(Button, {
                        type: 'negative',
                    onclick: () => {
                            if (confirm('¿Estás seguro de que quieres eliminar este horario?')) {
                                const index = state.schedules.findIndex(s => s.id === state.selectedSchedule.id);
                                if (index > -1) {
                                    state.schedules.splice(index, 1);
                                }
                                resetForm();
                            }
                        },
                        style: {
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontWeight: 500,
                            fontSize: '0.95rem',
                            background: 'transparent',
                            color: '#ef4444',
                            border: '1px solid transparent'
                        }
                    }, 'Eliminar Horario'),
                    state.selectedSchedule && m(Button, {
                        type: 'default',
                        onclick: () => {
                            // TODO: Implementar clonación
                            const cloned = { ...state.selectedSchedule };
                            cloned.id = Date.now();
                            cloned.name = `${cloned.name} (Copia)`;
                            state.schedules.push(cloned);
                            loadSchedule(cloned);
                        },
                        style: {
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontWeight: 500,
                            fontSize: '0.95rem',
                            background: 'white',
                            borderColor: '#e2e8f0',
                            color: '#3b82f6'
                        }
                    }, 'Clonar')
                ]),
                m(Button, {
                    type: 'negative',
                    onclick: () => {
                        closeModal();
                    },
                    style: {
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: 500,
                        fontSize: '0.95rem',
                        background: 'white',
                        borderColor: '#e2e8f0',
                        color: '#1e293b'
                    }
                }, 'Cancelar'),
                m(Div, { style: { width: '16px' } }), // Espacio entre botones
                m(Button, {
                    type: 'positive',
                    onclick: () => {
                        // TODO: Implementar guardado
                        closeModal();
                    },
                    style: {
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: 500,
                        fontSize: '0.95rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none'
                    }
                }, 'Guardar Cambios')
            ])
        ])
        ];
    }
};
