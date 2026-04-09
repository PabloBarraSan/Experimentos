// Schedule Management Modal Component
// Adaptado para Ayuntamientos: horarios día a día, vigencias indefinidas

import { FlexCol, FlexRow, Div } from '../../../DView/layout.js';
import { H2, Text } from '../../../DView/texts.js';
import { Button, Icon } from '../../../DView/elements.js';
import { Input, Switch } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter, showSnackbar } from '../../../DView/dialogs.js';

// Days of week with full labels
const DAYS_OF_WEEK = [
    { value: 1, label: 'L', fullLabel: 'Lunes' },
    { value: 2, label: 'M', fullLabel: 'Martes' },
    { value: 3, label: 'X', fullLabel: 'Miércoles' },
    { value: 4, label: 'J', fullLabel: 'Jueves' },
    { value: 5, label: 'V', fullLabel: 'Viernes' },
    { value: 6, label: 'S', fullLabel: 'Sábado' },
    { value: 0, label: 'D', fullLabel: 'Domingo' }
];

export const ScheduleModal = {
    oninit: (vnode) => {
        const { schedules = [] } = vnode.attrs;

        // Crear horario de ejemplo si no hay ninguno
        if (schedules.length === 0) {
            schedules.push({
                id: 1,
                name: 'Atención al Público',
                isIndefinite: true,
                daysConfig: {
                    1: { active: true, startHour: '09:00', endHour: '14:00' },
                    2: { active: true, startHour: '09:00', endHour: '14:00' },
                    3: { active: true, startHour: '09:00', endHour: '14:00' },
                    4: { active: true, startHour: '09:00', endHour: '14:00' },
                    5: { active: true, startHour: '09:00', endHour: '14:00' },
                    6: { active: false, startHour: '09:00', endHour: '14:00' },
                    0: { active: false, startHour: '09:00', endHour: '14:00' }
                },
                seats: 5,
                appDuration: 20,
                supplement: 0,
                exceptions: [
                    { id: 1, name: 'Festivo Nacional', type: 'block', startDate: '2026-12-25', description: 'Navidad' }
                ],
                extra: { published: true }
            });
        }

        vnode.state.schedules = schedules;
        vnode.state.activeTab = 'basico';
        vnode.state.panelOpen = false;
        vnode.state.exceptionType = 'block';
        vnode.state.exceptionScope = 'all';
        vnode.state.selectedSchedule = null;
        vnode.state.exceptionToEdit = null;
        vnode.state.formData = getDefaultFormData();
        vnode.state.modalElement = null;
        vnode.state.currentScreen = 'list'; // 'list' | 'edit'
    },

    oncreate: (vnode) => {
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

        if (!vnode.state.modalElement) {
            vnode.state.modalElement = vnode.dom.closest('[style*="position:fixed"]') ||
                vnode.dom.closest('[style*="z-index"]') ||
                vnode.dom.parentElement?.parentElement;
        }
    },

    view: (vnode) => {
        const state = vnode.state;
        const { onClose, onCancel } = vnode.attrs;

        // ============================================
        // TIMESELECTOR - Con ID único por slot
        // ============================================
        const TimeSelector = (id, value, onchange, placeholder) => {
            const stateKey = '_ts_' + id;
            const isOpen = state[stateKey + '_open'] || false;
            const search = state[stateKey + '_search'] || '';

            const presets = [
                '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
                '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
                '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
                '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
            ];

            const filtered = search ? presets.filter(p => p.includes(search)) : presets;

            const toggle = (e) => {
                e.stopPropagation();
                state[stateKey + '_open'] = !state[stateKey + '_open'];
                state[stateKey + '_search'] = '';
                m.redraw();
            };

            const select = (preset) => {
                onchange(preset);
                state[stateKey + '_open'] = false;
                m.redraw();
            };

            const closeDropdown = () => {
                state[stateKey + '_open'] = false;
                m.redraw();
            };

            return m('div', { style: { position: 'relative', display: 'inline-block', fontFamily: 'inherit' } }, [
                // Input principal
                m('div', {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        border: isOpen ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: '4px',
                        background: 'white',
                        cursor: 'pointer',
                        minWidth: '65px',
                        transition: 'all 0.15s'
                    },
                    onclick: toggle
                }, [
                    m('span', {
                        style: {
                            fontSize: '0.8rem',
                            color: value ? '#1f2937' : '#9ca3af',
                            fontWeight: value ? 500 : 400
                        }
                    }, value || placeholder || '--:--'),
                    m('svg', {
                        width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none',
                        stroke: '#9ca3af', 'stroke-width': '2',
                        style: { flexShrink: 0 }
                    }, [
                        m('polyline', { points: '6 9 12 15 18 9' })
                    ])
                ]),

                // Dropdown
                isOpen && m('div', {
                    style: {
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        width: '120px',
                        maxHeight: '180px',
                        overflowY: 'auto'
                    }
                }, [
                    // Search
                    m('input', {
                        type: 'text',
                        value: search,
                        placeholder: 'Buscar...',
                        oninput: (e) => { state[stateKey + '_search'] = e.target.value; m.redraw(); },
                        onclick: (e) => e.stopPropagation(),
                        style: {
                            width: '100%',
                            padding: '5px 8px',
                            border: 'none',
                            borderBottom: '1px solid #f3f4f6',
                            borderRadius: '6px 6px 0 0',
                            fontSize: '0.75rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }
                    }),
                    // Presets
                    filtered.map(preset =>
                        m('div', {
                            style: {
                                padding: '5px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: preset === value ? '#eff6ff' : 'transparent',
                                color: preset === value ? '#3b82f6' : '#374151',
                                fontWeight: preset === value ? 600 : 400
                            },
                            onmouseover: (e) => { if (preset !== value) e.currentTarget.style.background = '#f5f6f8'; },
                            onmouseout: (e) => { if (preset !== value) e.currentTarget.style.background = 'transparent'; },
                            onclick: (e) => { e.stopPropagation(); select(preset); }
                        }, preset)
                    )
                ]),

                // Cerrar al click fuera
                isOpen && m('div', {
                    style: { position: 'fixed', inset: 0, zIndex: 999 },
                    onclick: closeDropdown
                })
            ]);
        };

        // ============================================
        // ============================================
        // HELPER: Día con soporte para turno partido
        // ============================================
        const renderDayConfigRow = (day, index) => {
            const config = state.formData.daysConfig[day.value];
            const isLast = index === DAYS_OF_WEEK.length - 1;
            const isActive = config.active;

            return m('div', {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                    background: isActive ? 'white' : '#fafafa',
                    transition: 'background 0.2s'
                }
            }, [
                // Toggle
                m('div', {
                    style: {
                        width: '36px', height: '20px', borderRadius: '10px',
                        background: isActive ? '#22c55e' : '#e5e7eb',
                        cursor: 'pointer', position: 'relative', transition: 'all 0.2s', marginRight: '16px'
                    },
                    onclick: () => { config.active = !config.active; m.redraw(); }
                }, [
                    m('div', {
                        style: {
                            position: 'absolute', top: '2px', left: isActive ? '18px' : '2px',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s'
                        }
                    })
                ]),

                // Día
                m('span', {
                    style: {
                        width: '80px', fontSize: '0.85rem',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#1e293b' : '#9ca3af'
                    }
                }, day.fullLabel),

                // Horario o cerrado
                isActive ? m('div', { style: { display: 'flex', alignItems: 'center', flex: 1, gap: '8px' } }, [
                    TimeSelector(day.value + '_start', config.startHour, (val) => { config.startHour = val; }),
                    m('span', { style: { color: '#94a3b8', fontSize: '0.8rem' } }, 'a'),
                    TimeSelector(day.value + '_end', config.endHour, (val) => { config.endHour = val; }),

                    // Botón para añadir turno de tarde (Mockup visual)
                    m('button', {
                        title: 'Añadir turno de tarde',
                        style: {
                            background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b',
                            width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginLeft: '8px', transition: 'all 0.2s', fontSize: '16px', fontWeight: 600
                        },
                        onmouseover: (e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; },
                        onmouseout: (e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#f8fafc'; }
                    }, '+')
                ]) : m('span', { style: { flex: 1, color: '#9ca3af', fontSize: '0.85rem', fontStyle: 'italic' } }, 'Cerrado')
            ]);
        };

        // ============================================
        // RENDER BASIC TAB - Compact for Modal
        // ============================================
        const renderBasicTab = () => {
            return m('div', {
                style: {
                    padding: '0',
                    fontSize: '0.85rem',
                    maxWidth: '750px',
                    margin: '0 auto'
                }
            }, [

                // SECCIÓN: Nombre
                m('div', { style: { marginBottom: '12px' } }, [
                    m('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' } }, [
                        m('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', 'stroke-width': '2' }, [
                            m('path', { d: 'M12 2L2 7l10 5 10-5-10-5z' }),
                            m('path', { d: 'M2 17l10 5 10-5' }),
                            m('path', { d: 'M2 12l10 5 10-5' })
                        ]),
                        m('span', { style: { fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Identificación')
                    ]),
                    m('input', {
                        value: state.formData.name,
                        oninput: (e) => { state.formData.name = e.target.value; },
                        placeholder: 'Nombre del horario',
                        style: {
                            width: '100%', padding: '8px 10px',
                            border: '1px solid #e5e7eb', borderRadius: '6px',
                            fontSize: '0.85rem', outline: 'none', background: 'white',
                            boxSizing: 'border-box'
                        },
                        onfocus: (e) => { e.target.style.borderColor = '#3b82f6'; },
                        onblur: (e) => { e.target.style.borderColor = '#e5e7eb'; }
                    })
                ]),

                // SECCIÓN: Vigencia
                m('div', {
                    style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px',
                        marginBottom: '12px'
                    }
                }, [
                    m('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                        m('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', 'stroke-width': '2' }, [
                            m('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
                            m('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
                            m('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
                            m('line', { x1: '3', y1: '10', x2: '21', y2: '10' })
                        ]),
                        m('span', { style: { fontSize: '0.8rem', color: '#374151', fontWeight: 500 } }, 'Vigencia indefinida')
                    ]),
                    // Toggle
                    m('div', {
                        style: {
                            width: '40px', height: '22px', borderRadius: '11px',
                            background: state.formData.isIndefinite ? '#22c55e' : '#d1d5db',
                            cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
                        },
                        onclick: () => {
                            state.formData.isIndefinite = !state.formData.isIndefinite;
                            if (state.formData.isIndefinite) {
                                state.formData.startDate = '';
                                state.formData.endDate = '';
                            }
                            m.redraw();
                        }
                    }, [
                        m('div', {
                            style: {
                                position: 'absolute', top: '2px',
                                left: state.formData.isIndefinite ? '20px' : '2px',
                                width: '18px', height: '18px', borderRadius: '50%',
                                background: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                transition: 'left 0.2s'
                            }
                        })
                    ])
                ]),

                // SECCIÓN: Capacidad
                m('div', {
                    style: {
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '10px', marginBottom: '12px'
                    }
                }, [
                    // Puestos
                    m('div', {
                        style: {
                            padding: '10px 12px',
                            background: '#f8fafc',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }
                    }, [
                        m('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' } }, [
                            m('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', 'stroke-width': '2' }, [
                                m('path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
                                m('circle', { cx: '9', cy: '7', r: '4' }),
                                m('path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' }),
                                m('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' })
                            ]),
                            m('span', { style: { fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Puestos')
                        ]),
                        m('input', {
                            type: 'number', value: state.formData.seats,
                            oninput: (e) => { state.formData.seats = parseInt(e.target.value) || 1; },
                            min: 1,
                            style: { width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }
                        })
                    ]),
                    // Duración
                    m('div', {
                        style: {
                            padding: '10px 12px',
                            background: '#f8fafc',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }
                    }, [
                        m('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' } }, [
                            m('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', 'stroke-width': '2' }, [
                                m('circle', { cx: '12', cy: '12', r: '10' }),
                                m('path', { d: 'M12 6v6l4 2' })
                            ]),
                            m('span', { style: { fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Duración')
                        ]),
                        m('input', {
                            type: 'number', value: state.formData.appDuration,
                            oninput: (e) => { state.formData.appDuration = parseInt(e.target.value) || 1; },
                            min: 1,
                            style: { width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }
                        })
                    ]),
                    // Suplemento
                    m('div', {
                        style: {
                            padding: '10px 12px',
                            background: '#f8fafc',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }
                    }, [
                        m('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' } }, [
                            m('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', 'stroke-width': '2' }, [
                                m('line', { x1: '12', y1: '1', x2: '12', y2: '23' }),
                                m('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })
                            ]),
                            m('span', { style: { fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Tasa')
                        ]),
                        m('input', {
                            type: 'number', value: (state.formData.supplement / 100).toFixed(2),
                            oninput: (e) => { state.formData.supplement = Math.round(parseFloat(e.target.value || 0) * 100); },
                            step: 0.5, min: 0,
                            style: { width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }
                        })
                    ])
                ]),

                // SECCIÓN: Horario Semanal
                m('div', { style: { marginBottom: '8px' } }, [
                    m('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' } }, [
                        m('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: '#6b7280', 'stroke-width': '2' }, [
                            m('circle', { cx: '12', cy: '12', r: '10' }),
                            m('path', { d: 'M12 6v6l4 2' })
                        ]),
                        m('span', { style: { fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Horario Semanal')
                    ]),
                    m('div', {
                        style: {
                            background: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }
                    }, DAYS_OF_WEEK.map((day, index) => renderDayConfigRow(day, index)))
                ])
            ]);
        };

        // Resto de funciones...

        const closeModal = () => {
            if (onCancel) {
                try { onCancel(); } catch (e) {}
                return;
            }
            if (onClose) {
                try { onClose(); } catch (e) {}
                return;
            }
            if (state.modalElement) {
                try {
                    m.mount(state.modalElement, null);
                    setTimeout(() => {
                        if (state.modalElement && state.modalElement.parentNode) {
                            state.modalElement.remove();
                        }
                    }, 0);
                } catch (e) {
                    if (state.modalElement && state.modalElement.parentNode) {
                        state.modalElement.remove();
                    }
                }
            }
        };

        const handleChange = (field) => (e) => {
            state.formData[field] = e.target.value;
            m.redraw();
        };

        const handleNumberChange = (field) => (e) => {
            state.formData[field] = parseInt(e.target.value) || 0;
            m.redraw();
        };

        const getExceptions = () => state.formData.exceptions || [];

        // Cargar horario existente
        const loadSchedule = (schedule) => {
            console.log('[DEBUG loadSchedule] Called with:', schedule.name);
            console.log('[DEBUG loadSchedule] current state:', { currentScreen: state.currentScreen, selectedSchedule: state.selectedSchedule });
            state.selectedSchedule = schedule;
            console.log('[DEBUG loadSchedule] After assigning selectedSchedule');
            state.formData = mapScheduleToFormData(schedule);
            console.log('[DEBUG loadSchedule] After mapScheduleToFormData');
            state.activeTab = 'basico';
            state.currentScreen = 'edit';
            console.log('[DEBUG loadSchedule] State updated, currentScreen:', state.currentScreen);
            m.redraw();
            console.log('[DEBUG loadSchedule] After redraw');
        };

        const resetForm = () => {
            state.formData = getDefaultFormData();
            state.selectedSchedule = null;
            state.activeTab = 'basico';
            state.currentScreen = 'edit'; // Ir al editor para crear nuevo
            m.redraw();
        };

        const formatScheduleTime = (schedule) => {
            // Para formato antiguo
            if (schedule.startHour && schedule.endHour) {
                return `${schedule.startHour} - ${schedule.endHour}`;
            }
            // Para formato nuevo daysConfig
            const activeDays = Object.entries(schedule.daysConfig || {})
                .filter(([_, config]) => config.active)
                .map(([day, config]) => `${config.startHour}-${config.endHour}`);
            return activeDays.length > 0 ? `${activeDays.length} días` : '';
        };

        const getExceptionsCount = (schedule) => {
            return Array.isArray(schedule.exceptions) ? schedule.exceptions.length : 0;
        };

        const validateForm = () => {
            const errors = [];
            if (!state.formData.name.trim()) errors.push('El nombre es requerido');

            if (!state.formData.isIndefinite) {
                if (!state.formData.startDate) errors.push('Selecciona una fecha de inicio');
                if (!state.formData.endDate) errors.push('Selecciona una fecha de fin');
            }

            const activeDays = Object.values(state.formData.daysConfig).filter(d => d.active);
            if (activeDays.length === 0) {
                errors.push('Debes activar al menos un día de la semana');
            }

            activeDays.forEach(day => {
                if (!day.startHour || !day.endHour) {
                    errors.push('Los días activos deben tener hora de inicio y fin');
                }
            });

            if (errors.length > 0) {
                showSnackbar({ message: errors[0], background: '#ef4444' });
                return false;
            }
            return true;
        };

        // Render helpers
        const renderSidebarItem = (schedule, index) => {
            const isActive = state.selectedSchedule?.id === schedule.id;
            return m(Div, {
                key: schedule.id || index,
                class: `schedule-item ${isActive ? 'active' : ''}`,
                onclick: () => {
                    if (state.selectedSchedule?.id === schedule.id) return;
                    loadSchedule(schedule);
                },
                style: getScheduleItemStyle(isActive)
            }, [
                m(Text, {
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    color: '#1e293b',
                    display: 'block',
                    marginBottom: '4px'
                }, schedule.name || `Horario ${index + 1}`),
                m(Div, {
                    style: { display: 'flex', fontSize: '0.75rem', color: '#64748b', justifyContent: 'space-between', gap: '12px' }
                }, [
                    m(Text, { fontSize: '0.75rem', color: '#64748b', margin: 0 }, formatScheduleTime(schedule)),
                    m(Text, { fontSize: '0.75rem', color: '#64748b', margin: 0 }, `${schedule.seats || 0} puestos`)
                ])
            ]);
        };

        const getScheduleItemStyle = (isActive) => ({
            padding: '12px',
            marginBottom: '8px',
            background: isActive ? '#eff6ff' : 'white',
            border: `1px solid ${isActive ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: isActive ? '0 0 0 1px #3b82f6' : 'none'
        });

        const renderExceptionsTab = () => {
            const formatExceptionDate = (dateStr) => {
                if (!dateStr) return { day: '', month: '' };
                const date = new Date(dateStr);
                const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                return { day: date.getDate(), month: monthNames[date.getMonth()] };
            };

            return m(Div, {
                style: { position: 'relative', height: '100%', overflow: 'hidden' }
            }, [
                m(Div, { style: getPanelOverlayStyle() }, [
                    renderExceptionsToolbar(),
                    renderExceptionsList(formatExceptionDate)
                ]),
                renderExceptionPanel(formatExceptionDate)
            ]);
        };

        const renderExtraTab = () => {
            return m(Div, { style: { maxWidth: '800px' } }, [
                m(Div, { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' } }, [
                    renderPublishedSwitch(),
                    renderSlotSeparation()
                ]),

                m(Div, { style: { border: '0', borderTop: '1px solid #e2e8f0', margin: '20px 0' } }),

                m(Div, { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' } }, [
                    renderTextFields(),
                    renderImageUploader()
                ])
            ]);
        };

        // Helper render functions
        const renderSectionHeader = (text) => {
            return m(Text, {
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#64748b',
                margin: '24px 0 16px 0',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '8px',
                fontWeight: 700
            }, text);
        };

        const getInputStyle = () => ({
            padding: '10px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.95rem',
            width: '100%',
            boxSizing: 'border-box'
        });

        const renderDateField = (label, field) => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, label),
                m(Input, {
                    type: 'date',
                    value: state.formData[field],
                    onchange: handleChange(field),
                    style: getInputStyle(),
                    class: 'schedule-modal-input'
                })
            ]);
        };

        const renderNumberField = (label, field, min) => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, label),
                m(Input, {
                    type: 'number',
                    value: state.formData[field],
                    onchange: handleNumberChange(field),
                    min,
                    style: getInputStyle(),
                    class: 'schedule-modal-input'
                })
            ]);
        };

        const renderSupplementField = () => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, [
                    'Suplemento ',
                    m('span', { style: { fontWeight: 400, color: '#64748b', fontSize: '0.8rem' } }, '(€)')
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
                    style: getInputStyle(),
                    class: 'schedule-modal-input'
                })
            ]);
        };

        const getPanelOverlayStyle = () => ({
            opacity: state.panelOpen ? 0.4 : 1,
            pointerEvents: state.panelOpen ? 'none' : 'auto',
            filter: state.panelOpen ? 'grayscale(0.5)' : 'none',
            transition: 'all 0.3s'
        });

        const renderExceptionsToolbar = () => {
            return m(Div, {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }
            }, [
                m(Div, {}, [
                    m(Text, { margin: '0 0 4px 0', fontSize: '1rem', color: '#1e293b', fontWeight: 600 }, 'Días Especiales y Bloqueos'),
                    m(Text, { margin: 0, fontSize: '0.85rem', color: '#64748b' }, 'Gestión de festivos y modificaciones de servicio.')
                ]),
                m(Button, {
                    type: 'default',
                    onclick: () => {
                        state.panelOpen = true;
                        state.exceptionType = 'block';
                        state.exceptionScope = 'single';
                        state.exceptionToEdit = {
                            id: Date.now(),
                            name: '',
                            type: 'block',
                            startDate: '',
                            endDate: '',
                            seats: 0,
                            supplement: 0,
                            description: ''
                        };
                        m.redraw();
                    },
                    style: { background: 'white', border: '1px dashed #3b82f6', color: '#3b82f6', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }
                }, [m(Icon, { icon: 'add', size: 'small' }), m(Text, { fontSize: '0.9rem' }, 'Añadir Regla')])
            ]);
        };

        const renderExceptionsList = (formatExceptionDate) => {
            const exceptions = getExceptions();
            return m(Div, {}, [
                ...exceptions.map((exception, index) => {
                    const isClosed = exception.type === 'block';
                    const dateInfo = formatExceptionDate(exception.startDate);
                    return m(Div, {
                        class: 'exception-item',
                        onclick: () => {
                            state.exceptionToEdit = JSON.parse(JSON.stringify(exception));
                            state.exceptionType = exception.type || 'block';
                            state.exceptionScope = exception.endDate ? 'range' : 'single';
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
                        }
                    }, [
                        m(Div, {
                            style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '70px', paddingRight: '16px', borderRight: '1px solid #e2e8f0', marginRight: '16px' }
                        }, [
                            m(Text, { fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', lineHeight: 1 }, dateInfo.day),
                            m(Text, { fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginTop: '4px' }, dateInfo.month)
                        ]),
                        m(Div, { style: { flex: 1 } }, [
                            m(FlexRow, { style: { alignItems: 'center', gap: '10px', marginBottom: '4px' } }, [
                                m(Text, { fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }, exception.name || 'Sin nombre'),
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
                            m(Text, { fontSize: '0.85rem', color: '#64748b' },
                                exception.description || (isClosed ? 'Cierre total de la instalación.' : 'Modificación de servicio.'))
                        ])
                    ]);
                }),
                exceptions.length === 0 && m(Div, { style: { textAlign: 'center', padding: '40px 20px', color: '#64748b' } }, [
                    m(Text, { fontSize: '0.9rem' }, 'No hay excepciones configuradas.'),
                    m(Text, { fontSize: '0.85rem', marginTop: '8px', display: 'block' }, 'Haz clic en "Añadir Regla" para crear una nueva.')
                ])
            ]);
        };

        const renderExceptionPanel = () => {
            return m(Div, {
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
                renderExceptionPanelHeader(),
                m(Div, { style: { padding: '24px', overflowY: 'auto', flex: 1 } }, [
                    renderExceptionTypeSelector(),
                    renderExceptionForm()
                ]),
                renderExceptionPanelFooter()
            ]);
        };

        const renderExceptionPanelHeader = () => {
            return m(Div, {
                style: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }
            }, [
                m(Text, { fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 },
                    state.exceptionToEdit ? 'Editar Regla' : 'Nueva Regla'),
                m('button', {
                    onclick: () => { state.panelOpen = false; m.redraw(); },
                    style: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#64748b', padding: 0, lineHeight: 1 }
                }, '×')
            ]);
        };

        const renderExceptionTypeSelector = () => {
            return [
                m(Text, { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }, 'Tipo de Excepción'),
                m(Div, {
                    style: { display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '20px' }
                }, [
                    m('div', {
                        onclick: () => { state.exceptionType = 'block'; m.redraw(); },
                        style: getToggleStyle(state.exceptionType === 'block')
                    }, 'Bloquear Día'),
                    m('div', {
                        onclick: () => { state.exceptionType = 'custom'; m.redraw(); },
                        style: getToggleStyle(state.exceptionType === 'custom')
                    }, 'Personalizar')
                ]),
                m(Div, {
                    style: { fontSize: '0.8rem', color: '#64748b', marginTop: '-10px', marginBottom: '20px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }
                }, state.exceptionType === 'block'
                    ? m(Text, {}, ['El servicio aparecerá como ', m(Text, { color: '#ef4444', fontWeight: 600 }, 'CERRADO'), '. No se permitirán reservas.'])
                    : m(Text, {}, 'El servicio sigue activo, pero puedes modificar el aforo o el precio original.'))
            ];
        };

        const getToggleStyle = (isActive) => ({
            flex: 1,
            textAlign: 'center',
            padding: '8px',
            fontSize: '0.85rem',
            fontWeight: isActive ? 600 : 500,
            cursor: 'pointer',
            borderRadius: '6px',
            color: isActive ? '#1e293b' : '#64748b',
            background: isActive ? 'white' : 'transparent',
            boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.2s'
        });

        const renderExceptionForm = () => {
            // Estado visual simulado para el mockup
            const isSingleDay = state.exceptionScope !== 'range';

            return [
                // 1. MOTIVO CON CHIPS RÁPIDOS
                m(Text, { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }, 'Motivo de la excepción'),
                m(Input, {
                    placeholder: 'Ej. Festivo local, Obras...',
                    value: state.exceptionToEdit?.name || '',
                    onchange: (e) => { if (state.exceptionToEdit) state.exceptionToEdit.name = e.target.value; m.redraw(); },
                    style: { width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', marginBottom: '8px', transition: 'all 0.2s' },
                    class: 'schedule-modal-input'
                }),
                // Chips de sugerencia
                m(Div, { style: { display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' } }, [
                    ['🎉 Festivo Nacional', '🏘️ Festivo Local', '🚧 Obras / Mantenimiento'].map(tag =>
                        m('span', {
                            onclick: () => { if (state.exceptionToEdit) { state.exceptionToEdit.name = tag.split(' ')[1] || tag; m.redraw(); } },
                            style: { padding: '4px 10px', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s' },
                            onmouseover: (e) => e.target.style.background = '#e2e8f0',
                            onmouseout: (e) => e.target.style.background = '#f1f5f9'
                        }, tag)
                    )
                ]),

                // 2. FECHAS INTELIGENTES
                m(Div, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } }, [
                    m(Text, { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, '¿Cuándo ocurre?'),
                    // Toggle Día único / Varios días
                    m(Div, { style: { display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px' } }, [
                        m('div', {
                            onclick: () => { state.exceptionScope = 'single'; m.redraw(); },
                            style: { padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, background: state.exceptionScope === 'single' ? 'white' : 'transparent', color: state.exceptionScope === 'single' ? '#1e293b' : '#64748b', boxShadow: state.exceptionScope === 'single' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }
                        }, 'Un día'),
                        m('div', {
                            onclick: () => { state.exceptionScope = 'range'; m.redraw(); },
                            style: { padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, background: state.exceptionScope === 'range' ? 'white' : 'transparent', color: state.exceptionScope === 'range' ? '#1e293b' : '#64748b', boxShadow: state.exceptionScope === 'range' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }
                        }, 'Varios días')
                    ])
                ]),

                m(FlexRow, { style: { gap: '12px', marginBottom: '24px', alignItems: 'center' } }, [
                    m(Input, {
                        type: 'date',
                        value: state.exceptionToEdit?.startDate || '',
                        onchange: (e) => { if (state.exceptionToEdit) state.exceptionToEdit.startDate = e.target.value; m.redraw(); },
                        style: { flex: 1, padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' },
                        class: 'schedule-modal-input'
                    }),
                    state.exceptionScope === 'range' && m(Icon, { icon: 'arrow_forward', size: 'small', style: { color: '#94a3b8' } }),
                    state.exceptionScope === 'range' && m(Input, {
                        type: 'date',
                        value: state.exceptionToEdit?.endDate || '',
                        onchange: (e) => { if (state.exceptionToEdit) state.exceptionToEdit.endDate = e.target.value; m.redraw(); },
                        style: { flex: 1, padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' },
                        class: 'schedule-modal-input'
                    })
                ]),

                // 3. CAMPOS PERSONALIZADOS (Si no es bloqueo total)
                state.exceptionType === 'custom' && m(Div, {
                    style: { background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #e2e8f0' }
                }, [
                    m(Text, { color: '#1e293b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', display: 'block' }, 'Ajustes para este día'),
                    m(FlexRow, { style: { gap: '16px' } }, [
                        m(FlexCol, { flex: 1 }, [
                            m(Text, { fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 500 }, 'Puestos disponibles'),
                            m(Input, {
                                type: 'number',
                                value: state.exceptionToEdit?.seats || 0,
                                onchange: (e) => { if (state.exceptionToEdit) state.exceptionToEdit.seats = parseInt(e.target.value) || 0; m.redraw(); },
                                placeholder: 'Ej. 1',
                                style: { width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }
                            })
                        ]),
                        m(FlexCol, { flex: 1 }, [
                            m(Text, { fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 500 }, 'Precio / Tasa (€)'),
                            m(Input, {
                                type: 'number',
                                value: state.exceptionToEdit?.supplement || 0,
                                onchange: (e) => { if (state.exceptionToEdit) state.exceptionToEdit.supplement = parseFloat(e.target.value) || 0; m.redraw(); },
                                placeholder: '0.00',
                                style: { width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }
                            })
                        ])
                    ])
                ]),

                // 4. ALCANCE (Horas)
                m(Text, { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }, '¿Afecta a todo el día?'),
                m(Div, { style: { display: 'flex', gap: '12px', marginBottom: '16px' } }, [
                    m('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' } }, [
                        m('input', { type: 'radio', name: 'scope', checked: true, style: { accentColor: '#3b82f6' } }), 'Cierre total'
                    ]),
                    m('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#1e293b' } }, [
                        m('input', { type: 'radio', name: 'scope', style: { accentColor: '#3b82f6' } }), 'Solo ciertas horas'
                    ])
                ]),

                // 5. SLOTS VISUALES (Llamada al nuevo helper)
                renderSlotSelector(),

                // 6. REPETICIÓN (UI Premium)
                m(Div, {
                    style: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '24px' }
                }, [
                    m(Div, { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                        m(Icon, { icon: 'event_repeat', size: 'medium', style: { color: '#3b82f6' } }),
                        m(Div, {}, [
                            m(Text, { fontWeight: 600, color: '#1e3a8a', fontSize: '0.9rem', margin: 0 }, 'Repetir todos los años'),
                            m(Text, { color: '#60a5fa', fontSize: '0.75rem', margin: 0 }, 'Se aplicará automáticamente')
                        ])
                    ]),
                    m(Switch, { isActive: true, activeColor: '#3b82f6', onchange: () => {} })
                ])
            ];
        };

        const renderSlotSelector = () => {
            // Simulamos para el mockup que ha elegido "Solo ciertas horas"
            const slots = ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '13:00 - 14:00'];

            return m(Div, {
                style: { background: 'white', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '16px', marginTop: '8px', marginBottom: '20px' }
            }, [
                m(Text, { fontSize: '0.75rem', color: '#64748b', marginBottom: '12px', fontWeight: 600, display: 'block' }, 'Toca los bloques para cancelarlos/modificarlos:'),
                m(Div, { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
                    slots.map((slot, index) => {
                        // Hacemos que el primero parezca "bloqueado/seleccionado" por defecto para el efecto visual
                        const isSelected = index === 0 || index === 1;
                        const slotBorder = isSelected ? (state.exceptionType === 'block' ? '#fca5a5' : '#93c5fd') : '#e2e8f0';
                        const slotBg = isSelected ? (state.exceptionType === 'block' ? '#fef2f2' : '#eff6ff') : 'white';
                        const slotColor = isSelected ? (state.exceptionType === 'block' ? '#ef4444' : '#3b82f6') : '#64748b';
                        const slotTextDec = isSelected && state.exceptionType === 'block' ? 'line-through' : 'none';
                        return m('div', {
                            style: {
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: `1px solid ${slotBorder}`,
                                background: slotBg,
                                color: slotColor,
                                textDecoration: slotTextDec
                            }
                        }, slot);
                    })
                )
            ]);
        };

        const renderExceptionPanelFooter = () => {
            return m(Div, {
                style: { padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }
            }, [
                m(Button, {
                    type: 'default',
                    onclick: () => { state.panelOpen = false; m.redraw(); },
                    style: { padding: '10px 20px', borderRadius: '8px', fontWeight: 500, fontSize: '0.95rem', background: 'white', borderColor: '#e2e8f0', color: '#1e293b' }
                }, 'Cancelar'),
                m(Button, {
                    type: 'positive',
                    onclick: () => {
                        // Validación básica
                        if (!state.exceptionToEdit || !state.exceptionToEdit.name || !state.exceptionToEdit.startDate) {
                            showSnackbar({ message: 'Rellena el nombre y la fecha', background: '#ef4444' });
                            return;
                        }

                        // Asegurar que el tipo está actualizado
                        state.exceptionToEdit.type = state.exceptionType;

                        // Buscar si estamos editando una existente o creando nueva
                        const index = state.formData.exceptions.findIndex(ex => ex.id === state.exceptionToEdit.id);

                        if (index >= 0) {
                            // Actualizar existente
                            state.formData.exceptions[index] = state.exceptionToEdit;
                        } else {
                            // Añadir nueva
                            state.formData.exceptions.push(state.exceptionToEdit);
                        }

                        showSnackbar({ message: 'Regla guardada correctamente', background: '#3b82f6' });
                        state.panelOpen = false;
                        m.redraw();
                    },
                    style: { padding: '10px 20px', borderRadius: '8px', fontWeight: 500, fontSize: '0.95rem', background: '#3b82f6', color: 'white', border: 'none' }
                }, 'Guardar Regla')
            ]);
        };

        const renderPublishedSwitch = () => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, 'Estado del Horario'),
                m(Switch, {
                    data: state.formData.extra,
                    name: 'published',
                    isActive: state.formData.extra.published !== false,
                    activeColor: '#3b82f6',
                    activeBg: '#dbeafe',
                    onchange: () => { state.formData.extra.published = !state.formData.extra.published; m.redraw(); },
                    label: m(Text, { fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }, 'Despublicado (Oculto)')
                }),
                m(Text, { color: '#64748b', marginTop: '5px', fontSize: '0.8rem' }, 'Si actives esto, los ciudadanos no podrán ver ni reservar este horario.')
            ]);
        };

        const renderSlotSeparation = () => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, [
                    'Separar slots cada ',
                    m('span', { style: { fontWeight: 400, color: '#64748b', fontSize: '0.8rem' } }, '(puestos)')
                ]),
                m(Input, {
                    type: 'number',
                    value: state.formData.extra.slotSeparation || '',
                    onchange: (e) => { state.formData.extra.slotSeparation = e.target.value ? parseInt(e.target.value) : null; m.redraw(); },
                    placeholder: 'Ej. 3',
                    style: getInputStyle(),
                    class: 'schedule-modal-input'
                }),
                m(Text, { color: '#64748b', marginTop: '5px', fontSize: '0.8rem' }, 'Divide la disponibilidad total en bloques más pequeños.')
            ]);
        };

        const renderTextFields = () => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, [
                m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                    m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, 'Título Público del Slot'),
                    m(Div, { style: { position: 'relative', display: 'flex', alignItems: 'center' } }, [
                        m(Input, {
                            value: state.formData.extra.publicTitle || '',
                            onchange: handleChange('publicTitle'),
                            placeholder: 'Ej. TURNO DE MAÑANA',
                            style: { padding: '10px 12px', paddingRight: '100px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' },
                            class: 'schedule-modal-input'
                        }),
                        m(Button, {
                            type: 'default',
                            onclick: () => {},
                            style: { position: 'absolute', right: '8px', background: '#f1f5f9', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: '#64748b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 'auto' }
                        }, [m(Icon, { icon: 'language', size: 'small' }), m(Text, { fontSize: '0.8rem' }, 'Traducir')])
                    ])
                ]),

                m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                    m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, 'Descripción'),
                    m('textarea', {
                        value: state.formData.extra.description || '',
                        onchange: handleChange('description'),
                        placeholder: 'Información visible para el ciudadano...',
                        style: { padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical', minHeight: '80px', outline: 'none', transition: 'border 0.2s' },
                        onfocus: (e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; },
                        onblur: (e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }
                    })
                ]),

                m(Div, { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: 0 } }, [
                    m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                        m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, 'Índice (Orden)'),
                        m(Input, {
                            type: 'number',
                            value: state.formData.extra.index || 0,
                            onchange: handleNumberChange('index'),
                            style: getInputStyle(),
                            class: 'schedule-modal-input'
                        })
                    ]),
                    m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                        m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, 'Etiqueta'),
                        m(Input, {
                            value: state.formData.extra.tag || '',
                            onchange: handleChange('tag'),
                            placeholder: 'Ej. PRIORIDAD',
                            style: getInputStyle(),
                            class: 'schedule-modal-input'
                        })
                    ])
                ])
            ]);
        };

        const renderImageUploader = () => {
            return m(Div, { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                m(Text, { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }, 'Imagen Destacada'),
                m(Div, {
                    class: 'image-uploader',
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
                    }
                }, state.formData.extra.featuredImage
                    ? renderImagePreview()
                    : renderImageUploadPlaceholder())
            ]);
        };

        const renderImagePreview = () => {
            return [
                m('img', {
                    src: state.formData.extra.featuredImage,
                    style: { width: '100%', height: '160px', objectFit: 'cover', borderRadius: '6px', display: 'block' }
                }),
                m(Button, {
                    type: 'negative',
                    onclick: () => { state.formData.extra.featuredImage = null; m.redraw(); },
                    style: { position: 'absolute', top: '8px', right: '8px', background: 'white', color: '#ef4444', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: 'none', padding: 0, minWidth: 'auto' }
                }, '×'),
                m(Div, {
                    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s', borderRadius: '6px' },
                    onmouseenter: (e) => { e.currentTarget.style.opacity = 1; },
                    onmouseleave: (e) => { e.currentTarget.style.opacity = 0; }
                }, [
                    m(Text, { style: { color: 'white', fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' } }, 'Cambiar Imagen'),
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
                                    reader.onload = (event) => { state.formData.extra.featuredImage = event.target.result; m.redraw(); };
                                    reader.readAsDataURL(file);
                                }
                            };
                            input.click();
                        },
                        style: { background: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: 'none' }
                    }, 'Subir nueva')
                ])
            ];
        };

        const renderImageUploadPlaceholder = () => {
            return m(Div, { style: { padding: '40px 20px', width: '100%' } }, [
                m(Icon, { icon: 'image', size: 'large', style: { color: '#64748b', marginBottom: '12px' } }),
                m(Text, { style: { color: '#64748b', fontSize: '0.9rem', marginBottom: '12px', display: 'block' } }, 'Haz clic para subir una imagen'),
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
                                reader.onload = (event) => { state.formData.extra.featuredImage = event.target.result; m.redraw(); };
                                reader.readAsDataURL(file);
                            }
                        };
                        input.click();
                    },
                    style: { background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', border: 'none' }
                }, 'Subir Imagen')
            ]);
        };

        const renderTabBar = () => {
            const tabs = [
                ['basico', () => 'Configuración Básica'],
                ['excepciones', () => `Excepciones${state.selectedSchedule ? ` (${getExceptionsCount(state.selectedSchedule)})` : ''}`],
                ['extra', () => 'Avanzado']
            ];

            return m(Div, {
                style: { display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 24px', background: 'white', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }
            }, tabs.map(([tab, label]) =>
                m('div', {
                    onclick: (e) => { e.preventDefault(); e.stopPropagation(); state.activeTab = tab; m.redraw(); },
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
                }, typeof label === 'function' ? label() : label)
            ));
        };

        // Dashboard: Grid de tarjetas premium
        const renderSchedulesDashboard = () => {
            console.log('[DEBUG renderSchedulesDashboard] START, schedules:', state.schedules.length);
            const getScheduleSummary = (schedule) => {
                const days = [];
                const daysConfig = schedule.daysConfig;
                if (daysConfig) {
                    Object.entries(daysConfig).forEach(([day, config]) => {
                        if (config.active) {
                            const dayLabel = DAYS_OF_WEEK.find(d => d.value === parseInt(day))?.label || day;
                            if (config.startHour && config.endHour) {
                                days.push(`${dayLabel} ${config.startHour}-${config.endHour}`);
                            } else {
                                days.push(dayLabel);
                            }
                        }
                    });
                }
                return days.length > 0 ? days.slice(0, 4).join(', ') + (days.length > 4 ? '...' : '') : 'Sin días configurados';
            };

            const isPublished = schedule => schedule.extra?.published !== false;

            return m(Div, {
                style: { padding: '24px', maxWidth: '100%' }
            }, [
                // Título y stats
                m(Div, {
                    style: { marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }
                }, [
                    m(Div, {}, [
                        m(Text, { fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }, 'Tus Horarios'),
                        m(Text, { fontSize: '0.9rem', color: '#64748b', margin: 0 }, `${state.schedules.length} horario${state.schedules.length !== 1 ? 's' : ''} configurado${state.schedules.length !== 1 ? 's' : ''}`)
                    ])
                ]),

                // Grid de tarjetas
                m(Div, {
                    style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }
                }, [
                    // Tarjeta especial: Crear nuevo
                    m('div', {
                        onclick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('[DEBUG] Crear nuevo clicked!');
                            resetForm();
                        },
                        style: {
                            border: '2px dashed #cbd5e1',
                            borderRadius: '12px',
                            padding: '24px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '160px',
                            background: '#fafafa'
                        },
                        onmouseover: (e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.background = '#eff6ff';
                        },
                        onmouseout: (e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.background = '#fafafa';
                        }
                    }, [
                        m(Icon, { icon: 'add', size: 'large', style: { color: '#94a3b8', marginBottom: '12px' } }),
                        m(Text, { fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }, 'Crear nuevo horario')
                    ]),

                    // Tarjetas de horarios existentes
                    state.schedules.map((schedule, index) => {
                        const published = isPublished(schedule);
                        const exceptionsCount = getExceptionsCount(schedule);
                        const summary = getScheduleSummary(schedule);

                        return m('div', {
                            onclick: (e) => { e.preventDefault(); e.stopPropagation(); console.log('[DEBUG onclick] Card clicked:', schedule.name); loadSchedule(schedule); },
                            class: 'schedule-card',
                            style: {
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '20px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: 'white',
                                position: 'relative',
                                overflow: 'hidden'
                            },
                            onmouseover: (e) => {
                                e.currentTarget.style.borderColor = '#3b82f6';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            },
                            onmouseout: (e) => {
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }, [
                            // Badge de estado
                            m(Div, {
                                style: {
                                    position: 'absolute',
                                    top: '12px',
                                    right: '12px',
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: published ? '#22c55e' : '#94a3b8',
                                    boxShadow: published ? '0 0 0 3px rgba(34, 197, 94, 0.2)' : 'none'
                                }
                            }),

                            // Nombre
                            m(Text, {
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: '#1e293b',
                                margin: '0 0 12px 0',
                                display: 'block'
                            }, schedule.name || `Horario ${index + 1}`),

                            // Resumen de días
                            m(Div, { style: { marginBottom: '12px' } }, [
                                m(Text, { fontSize: '0.8rem', color: '#64748b', margin: 0 }, summary)
                            ]),

                            // Footer con stats
                            m(Div, {
                                style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    paddingTop: '12px',
                                    borderTop: '1px solid #f1f5f9'
                                }
                            }, [
                                m(Text, { fontSize: '0.75rem', color: '#94a3b8', margin: 0 },
                                    published ? '🟢 Publicado' : '⚪ Oculto'),

                                exceptionsCount > 0 && m(Text, {
                                    fontSize: '0.75rem',
                                    color: '#f59e0b',
                                    margin: 0,
                                    style: { fontWeight: 600 }
                                }, `⚠ ${exceptionsCount} excepción${exceptionsCount !== 1 ? 'es' : ''}`) || m('span', {}, '')
                            ])
                        ]);
                    })
                ]),

                // Estado vacío
                state.schedules.length === 0 && m(Div, {
                    style: {
                        textAlign: 'center',
                        padding: '48px 24px',
                        color: '#64748b'
                    }
                }, [
                    m(Icon, { icon: 'calendar', size: 'large', style: { color: '#cbd5e1', marginBottom: '16px' } }),
                    m(Text, { fontSize: '1rem', fontWeight: 600, color: '#94a3b8', margin: '0 0 8px 0' }, 'No hay horarios todavía'),
                    m(Text, { fontSize: '0.85rem', color: '#94a3b8', margin: 0 }, 'Crea tu primer horario para empezar')
                ])
            ]);
        };

        const renderContent = () => {
            console.log('[DEBUG renderContent] currentScreen:', state.currentScreen);
            console.log('[DEBUG renderContent] schedules.length:', state.schedules.length);
            // Vista Dashboard: Grid de tarjetas de horarios
            if (state.currentScreen === 'list') {
                console.log('[DEBUG renderContent] calling renderSchedulesDashboard');
                return renderSchedulesDashboard();
            }

            // Vista Editor: Pestañas de configuración
            if (state.currentScreen === 'edit') {
                if (state.activeTab === 'basico') return renderBasicTab();
                if (state.activeTab === 'excepciones') return renderExceptionsTab();
                if (state.activeTab === 'extra') return renderExtraTab();
            }
            return null;
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
                .visually-hidden {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }
                .schedule-item:hover {
                    border-color: #3b82f6 !important;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .exception-item:hover {
                    border-color: #cbd5e1 !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    transform: translateY(-1px);
                }
                .image-uploader:hover {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }
            `),
            m(Modal, {
                size: 'big',
                close: closeModal,
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'schedule-modal-title',
                style: { width: '95vw', maxWidth: '1000px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
            }, [
                m(ModalHeader, {
                    style: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', flexShrink: 0 }
                }, [
                    m(Div, {
                        style: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }
                    }, [
                        // Botón volver (solo en modo edit)
                        state.currentScreen === 'edit' && m('button', {
                            onclick: () => { state.currentScreen = 'list'; m.redraw(); },
                            style: {
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#64748b',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                transition: 'all 0.2s'
                            },
                            onmouseover: (e) => { e.currentTarget.style.background = '#f1f5f9'; },
                            onmouseout: (e) => { e.currentTarget.style.background = 'none'; }
                        }, [
                            m(Icon, { icon: 'arrow_back', size: 'small', style: { color: '#64748b' } }),
                            m(Text, { fontSize: '0.85rem', color: '#64748b', margin: 0 }, 'Horarios')
                        ]),

                        // Título
                        m(H2, {
                            id: 'schedule-modal-title',
                            marginTop: 0, marginBottom: 0,
                            style: {
                                fontSize: state.currentScreen === 'edit' ? '1rem' : '1.125rem',
                                fontWeight: 600,
                                color: '#1e293b',
                                margin: 0,
                                flex: state.currentScreen === 'edit' ? 'none' : 1,
                                textAlign: 'left'
                            }
                        }, state.currentScreen === 'edit'
                            ? (state.formData.name || 'Nuevo Horario')
                            : 'Gestión de Horarios')
                    ]),

                    m('button', {
                        'aria-label': 'Cerrar modal',
                        onclick: (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); },
                        style: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.5rem', lineHeight: 1, padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }
                    }, '×')
                ]),

                m(Div, { style: { display: 'flex', flex: 1, overflow: 'hidden' } }, [
                    // Dashboard view (full width)
                    state.currentScreen === 'list' && m(Div, {
                        style: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white', overflow: 'hidden' }
                    }, [
                        m(Div, { style: { flex: 1, overflowY: 'auto' } }, renderContent())
                    ]),

                    // Editor view (full width with tabs)
                    state.currentScreen === 'edit' && m(Div, {
                        style: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white', overflow: 'hidden' }
                    }, [
                        renderTabBar(),
                        m(Div, { style: { flex: 1, overflowY: 'auto', padding: '24px' } }, renderContent())
                    ])
                ]),

                m(ModalFooter, {
                    style: {
                        padding: '16px 24px',
                        borderTop: '1px solid #e2e8f0',
                        display: state.currentScreen === 'edit' ? 'flex' : 'none',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        background: '#f8fafc',
                        flexShrink: 0
                    }
                }, state.currentScreen === 'edit' ? [
                    m(Div, { style: { marginRight: 'auto', display: 'flex', gap: '12px' } }, [
                        state.selectedSchedule && m(Button, {
                            type: 'negative',
                            onclick: () => {
                                showSnackbar({ message: 'Horario eliminado', background: '#ef4444' });
                                const index = state.schedules.findIndex(s => s.id === state.selectedSchedule.id);
                                if (index > -1) state.schedules.splice(index, 1);
                                state.currentScreen = 'list';
                                m.redraw();
                            },
                            style: { padding: '10px 20px', borderRadius: '8px', fontWeight: 500, fontSize: '0.95rem', background: 'transparent', color: '#ef4444', border: '1px solid transparent' }
                        }, 'Eliminar Horario'),
                        state.selectedSchedule && m(Button, {
                            type: 'default',
                            onclick: () => {
                                const cloned = JSON.parse(JSON.stringify(state.selectedSchedule));
                                cloned.id = Date.now();
                                cloned.name = `${cloned.name} (Copia)`;
                                state.schedules.push(cloned);
                                loadSchedule(cloned);
                                showSnackbar({ message: 'Horario duplicado correctamente', background: '#22c55e' });
                            },
                            style: { padding: '10px 20px', borderRadius: '8px', fontWeight: 500, fontSize: '0.95rem', background: 'white', borderColor: '#e2e8f0', color: '#3b82f6' }
                        }, 'Clonar')
                    ]),
                    m(Button, {
                        type: 'negative',
                        onclick: () => { state.currentScreen = 'list'; m.redraw(); },
                        style: { padding: '10px 20px', borderRadius: '8px', fontWeight: 500, fontSize: '0.95rem', background: 'white', borderColor: '#e2e8f0', color: '#1e293b' }
                    }, 'Cancelar'),
                    m(Div, { style: { width: '16px' } }),
                    m(Button, {
                        type: 'positive',
                        onclick: () => {
                            if (validateForm()) {
                                showSnackbar({ message: 'Horario guardado correctamente', background: '#22c55e' });
                                state.currentScreen = 'list';
                                m.redraw();
                            }
                        },
                        style: { padding: '10px 20px', borderRadius: '8px', fontWeight: 500, fontSize: '0.95rem', background: '#3b82f6', color: 'white', border: 'none' }
                    }, 'Guardar Cambios')
                ] : []),
            ])
        ];
    }
};

// Helper functions
function getDefaultFormData() {
    return {
        name: '',
        isIndefinite: true,
        startDate: '',
        endDate: '',
        daysConfig: {
            1: { active: false, startHour: '09:00', endHour: '14:00' },
            2: { active: false, startHour: '09:00', endHour: '14:00' },
            3: { active: false, startHour: '09:00', endHour: '14:00' },
            4: { active: false, startHour: '09:00', endHour: '14:00' },
            5: { active: false, startHour: '09:00', endHour: '14:00' },
            6: { active: false, startHour: '09:00', endHour: '14:00' },
            0: { active: false, startHour: '09:00', endHour: '14:00' }
        },
        seats: 1,
        appDuration: 15,
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
}

// Map legacy schedule format to new daysConfig format
function mapScheduleToFormData(schedule) {
    // Check if it's the new format with daysConfig
    if (schedule.daysConfig) {
        return {
            name: schedule.name || '',
            isIndefinite: schedule.isIndefinite !== false,
            startDate: schedule.startDate || '',
            endDate: schedule.endDate || '',
            daysConfig: { ...schedule.daysConfig },
            seats: schedule.seats || 1,
            appDuration: schedule.appDuration || 15,
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
    }

    // Legacy format: convert old days array + startHour/endHour to new format
    const daysConfig = {
        1: { active: false, startHour: '09:00', endHour: '14:00' },
        2: { active: false, startHour: '09:00', endHour: '14:00' },
        3: { active: false, startHour: '09:00', endHour: '14:00' },
        4: { active: false, startHour: '09:00', endHour: '14:00' },
        5: { active: false, startHour: '09:00', endHour: '14:00' },
        6: { active: false, startHour: '09:00', endHour: '14:00' },
        0: { active: false, startHour: '09:00', endHour: '14:00' }
    };

    // Activate days that were in the old days array
    if (Array.isArray(schedule.days)) {
        schedule.days.forEach(dayValue => {
            if (daysConfig[dayValue]) {
                daysConfig[dayValue].active = true;
                daysConfig[dayValue].startHour = schedule.startHour || '09:00';
                daysConfig[dayValue].endHour = schedule.endHour || '14:00';
            }
        });
    }

    return {
        name: schedule.name || '',
        isIndefinite: !schedule.from && !schedule.until,
        startDate: schedule.from || '',
        endDate: schedule.until || '',
        daysConfig,
        seats: schedule.seats || 1,
        appDuration: schedule.appDuration || 15,
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
}
