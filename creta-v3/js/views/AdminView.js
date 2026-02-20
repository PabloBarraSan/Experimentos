// Admin View Component using Mithril and DView

import { FlexCol, FlexRow, Tappable, Div } from '../../../DView/layout.js';
import { H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Label, Segment } from '../../../DView/elements.js';
import { Input, Switch } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter, openDialog } from '../../../DView/dialogs.js';
import { ScheduleModal } from '../components/ScheduleModal.js';
import { ResourceViewHeader } from '../components/ResourceViewHeader.js';
import { fetchAppointments, calculateStats, getDateRange } from '../api.js';
import { ensureSidebarHTML } from '../components/SlotSidebar.js';
import { formatDate } from '../utils/dateUtils.js';
import { extractReservations } from '../utils/reservationUtils.js';
import { initializeChart } from '../utils/chartUtils.js';

// ============================================================================
// CONSTANTS - Configuración centralizada
// ============================================================================

const CONFIG = {
    CHART_INIT_DELAY: 300,
    ITEMS_PER_PAGE: 10,
    DEFAULT_FILTER_STATUS: 'confirmed',
    DATE_FORMAT: 'es-ES'
};

const COLORS = {
    primary: '#2563eb',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    amber: {
        DEFAULT: '#b45309',
        hover: '#92400e'
    },
    slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#111827'
    }
};

const STATUS_COLORS = {
    confirmed: { bg: '#dcfce7', text: '#166534', label: 'Confirmada' },
    pending: { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
    canceled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelada' }
};

const CARD_STYLES = {
    base: {
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    },
    shadow: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
    },
    elevated: {
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)'
    }
};

const I18N = {
    LOADING: 'Cargando datos de administración...',
    ERROR: 'Error',
    SLOTS: 'Slots',
    RESERVAS: 'Reservas',
    LIBRES: 'Libres',
    CONFIGURACION: 'Configuración',
    AUTOCONFIRMADO: 'Autoconfirmado',
    SEATS: 'Seient',
    RESERVAS_FILTERS: {
        ALL: 'Todas',
        CONFIRMED: 'Confirmadas',
        PENDING: 'Pendientes',
        CANCELED: 'Canceladas'
    },
    VIEW_MODES: {
        LIST: 'list',
        CARDS: 'cards'
    },
    SHOW_PAST: 'Mostrar pasadas',
    SEARCH_PLACEHOLDER: 'Buscar por nombre, email, teléfono o turno...',
    NO_RESERVAS: 'No se encontraron reservas',
    NO_SLOTS: 'No se encontraron slots',
    PAGE: 'Página',
    RESERVA: 'reserva',
    RESERVAS: 'reservas',
    SLOT: 'slot',
    SLOTS: 'slots',
    FECHA: 'fecha',
    FECHAS: 'fechas',
    PREV: 'Anterior',
    NEXT: 'Siguiente',
    IMPRIMIR: 'Imprimir reservas',
    RESERVATION_DETAILS: 'Detalles de la Reserva',
    USER_INFO: 'Información del Usuario',
    RESERVATION_DETAILS_TITLE: 'Detalles de la Reserva',
    SIN_NOMBRE: 'Sin nombre',
    SIN_FECHA: 'Sin fecha',
    PLAZA: 'plaza',
    PLAZAS: 'plazas',
    PAGADO: 'Pagado',
    NO_PAGADO: 'No pagado',
    EDITAR: 'Editar',
    CANCELAR: 'Cancelar Reserva',
    CERRAR: 'Cerrar',
    CONFIRM_CANCEL: '¿Estás seguro de que quieres cancelar esta reserva?'
};

const sidebarActions = [
    { label: 'Calendario de citas', icon: 'event', color: COLORS.primary, route: 'calendar' },
    { label: 'Gestionar Horarios', icon: 'schedule', color: '#7c3aed', route: null },
    { label: 'Imprimir reservas', icon: 'print', color: COLORS.amber.DEFAULT, route: null },
    { label: 'Ajustes del recurso', icon: 'settings', color: '#059669', route: 'settings' },
    { label: 'Admin Turnos', icon: 'people', color: '#0d9488', route: null }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * @typedef {Object} StatusColor
 * @property {string} bg
 * @property {string} text
 * @property {string} label
 */

/**
 * Obtiene los colores de estado para una reserva
 * @param {string} status - Estado de la reserva
 * @returns {StatusColor}
 */
function getStatusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.confirmed;
}

/**
 * Crea un estilo base para tarjeta
 * @param {Object} overrides - Estilos adicionales
 * @returns {Object}
 */
function createCardStyle(overrides = {}) {
    return { ...CARD_STYLES.base, ...overrides };
}

/**
 * Obtiene la etiqueta de estado del slot
 * @param {number} remainingSeats
 * @param {number} totalSeats
 * @returns {string}
 */
function getSlotStatusLabel(remainingSeats, totalSeats) {
    if (remainingSeats === 0) return 'Completo';
    if (totalSeats > 0 && remainingSeats <= totalSeats * 0.2) return 'Casi completo';
    return 'Disponible';
}

/**
 * Formatea el plural de una palabra según la cantidad
 * @param {number} count
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
}

/**
 * Genera la clave única para un slot
 * @param {Object} slot
 * @returns {string}
 */
function getSlotKey(slot) {
    return slot?._id || (slot?.start ? `${slot.start}-${slot?.title || ''}` : 'no-slot');
}

/**
 * Obtiene la fecha actual a medianoche
 * @returns {Date}
 */
function getTodayStart() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

/**
 * Filtra reservas según criterios
 * @param {Array} reservations
 * @param {Object} filters - { searchTerm, filterStatus, showPast }
 * @returns {Array}
 */
function filterReservations(reservations, filters) {
    const now = getTodayStart();

    return reservations.filter(reservation => {
        // Filtro de fecha (pasadas/futuras)
        if (!filters.showPast && reservation.date) {
            const reservationDate = new Date(reservation.date);
            reservationDate.setHours(0, 0, 0, 0);
            if (reservationDate < now) return false;
        }

        // Filtro de búsqueda
        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            const matchesSearch =
                reservation.userName.toLowerCase().includes(searchLower) ||
                reservation.email?.toLowerCase().includes(searchLower) ||
                reservation.telephone?.includes(searchLower) ||
                reservation.turn?.toString().includes(searchLower) ||
                reservation.maskedTurn?.toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
        }

        // Filtro de estado
        if (filters.filterStatus !== 'all' && reservation.status !== filters.filterStatus) {
            return false;
        }

        return true;
    });
}

/**
 * Agrupa reservas por slot
 * @param {Array} reservations
 * @returns {Object}
 */
function groupReservationsBySlot(reservations) {
    const reservationsBySlot = {};

    reservations.forEach(reservation => {
        const slot = reservation.slot;
        const slotKey = getSlotKey(slot);
        if (!reservationsBySlot[slotKey]) {
            reservationsBySlot[slotKey] = { slot, reservations: [] };
        }
        reservationsBySlot[slotKey].reservations.push(reservation);
    });

    return reservationsBySlot;
}

/**
 * Ordena grupos de slots por fecha
 * @param {Array} groups
 * @returns {Array}
 */
function sortSlotGroups(groups) {
    return Object.values(groups).sort((a, b) => {
        const dateA = a.slot?.start ? new Date(a.slot.start) : new Date(0);
        const dateB = b.slot?.start ? new Date(b.slot.start) : new Date(0);
        return dateA - dateB;
    });
}

/**
 * Filtra slots según criterios
 * @param {Array} slots
 * @param {Object} filters - { searchTerm, showPast }
 * @returns {Array}
 */
function filterSlots(slots, filters) {
    const now = getTodayStart();

    return slots.filter(slot => {
        if (!filters.showPast && slot.start) {
            const slotDate = new Date(slot.start);
            slotDate.setHours(0, 0, 0, 0);
            if (slotDate < now) return false;
        }

        if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            const slotTitle = (slot.title || '').toLowerCase();
            const slotDateStr = slot.start ? formatDate(new Date(slot.start)) : '';
            if (!slotTitle.includes(searchLower) && !slotDateStr.toLowerCase().includes(searchLower)) {
                return false;
            }
        }

        return true;
    }).sort((a, b) => {
        const dA = a.start ? new Date(a.start) : new Date(0);
        const dB = b.start ? new Date(b.start) : new Date(0);
        return dA - dB;
    });
}

/**
 * Genera slots desde virtualSettings para mostrar también los vacíos
 * @param {Object} resource - Resource con virtualSettings
 * @param {Array} existingSlots - Slots existentes de la API
 * @param {number} startTimestamp - Inicio del rango
 * @param {number} endTimestamp - Fin del rango
 * @returns {Array} Slots combinados (existentes + generados)
 */
function generateAllSlots(resource, existingSlots, startTimestamp, endTimestamp) {
    const virtualSettings = resource.virtualSettings ? Object.values(resource.virtualSettings) : [];

    // Si no hay virtualSettings, devolver slots existentes
    if (virtualSettings.length === 0) {
        return existingSlots || [];
    }

    // Si no hay slots existentes, generar todos desde virtualSettings
    if (!existingSlots || existingSlots.length === 0) {
        return generateSlotsFromVirtualSettings(resource, virtualSettings, startTimestamp, endTimestamp);
    }

    // Crear set de claves de slots existentes
    const existingKeys = new Set();
    existingSlots.forEach(slot => {
        const key = `${slot.start?.split('T')[0]}-${slot.title}`;
        existingKeys.add(key);
    });

    // Iniciar con todos los slots existentes (preserva los appointments)
    const allSlots = [...existingSlots];

    // Agregar slots generados que no existen
    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);

    virtualSettings.forEach(setting => {
        const days = setting.days || [];
        const startHour = setting.startHour || '00:00';
        const endHour = setting.endHour || '23:59';
        const from = setting.from ? new Date(setting.from) : startDate;
        const until = setting.until ? new Date(setting.until) : endDate;

        const currentDate = new Date(from);
        currentDate.setHours(0, 0, 0, 0);

        while (currentDate <= until && currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();

            if (days.includes(dayOfWeek) && currentDate >= startDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const slotKey = `${dateStr}-${setting.title}`;

                // Solo agregar si no existe
                if (!existingKeys.has(slotKey)) {
                    const totalSeats = setting.seats || resource.seats?.total || 0;
                    allSlots.push({
                        _id: null,
                        start: `${dateStr}T${startHour}:00.000Z`,
                        end: `${dateStr}T${endHour}:00.000Z`,
                        title: setting.title,
                        seats: {
                            total: totalSeats,
                            remaining: totalSeats
                        },
                        resourceId: resource._id,
                        isGenerated: true,
                        settingId: setting.id,
                        photo: setting.photo
                    });
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }
    });

    // Ordenar por fecha
    allSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

    return allSlots;
}

function generateSlotsFromVirtualSettings(resource, virtualSettings, startTimestamp, endTimestamp) {
    const allSlots = [];
    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);

    virtualSettings.forEach(setting => {
        const days = setting.days || [];
        const startHour = setting.startHour || '00:00';
        const endHour = setting.endHour || '23:59';
        const from = setting.from ? new Date(setting.from) : startDate;
        const until = setting.until ? new Date(setting.until) : endDate;

        const currentDate = new Date(from);
        currentDate.setHours(0, 0, 0, 0);

        while (currentDate <= until && currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();

            if (days.includes(dayOfWeek) && currentDate >= startDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const totalSeats = setting.seats || resource.seats?.total || 0;
                allSlots.push({
                    _id: null,
                    start: `${dateStr}T${startHour}:00.000Z`,
                    end: `${dateStr}T${endHour}:00.000Z`,
                    title: setting.title,
                    seats: {
                        total: totalSeats,
                        remaining: totalSeats
                    },
                    resourceId: resource._id,
                    isGenerated: true,
                    settingId: setting.id,
                    photo: setting.photo
                });
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }
    });

    allSlots.sort((a, b) => new Date(a.start) - new Date(b.start));
    return allSlots;
}

/**
 * Agrupa slots por fecha
 * @param {Array} slots
 * @returns {Object}
 */
function groupSlotsByDate(slots) {
    const slotsByDate = {};

    slots.forEach(slot => {
        const isoMatch = slot.start?.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const dateKey = isoMatch ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : 'no-date';
        if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
        slotsByDate[dateKey].push(slot);
    });

    return slotsByDate;
}

/**
 * Ordena claves de fechas
 * @param {Array} dateKeys
 * @returns {Array}
 */
function sortDateKeys(dateKeys) {
    return [...dateKeys].sort((a, b) => {
        if (a === 'no-date') return 1;
        if (b === 'no-date') return -1;
        return a.localeCompare(b);
    });
}

/**
 * Obtiene la página actual de grupos
 * @param {Array} groups
 * @param {number} currentPage
 * @param {number} itemsPerPage
 * @returns {Array}
 */
function getPaginatedGroups(groups, currentPage, itemsPerPage) {
    const start = (currentPage - 1) * itemsPerPage;
    return groups.slice(start, start + itemsPerPage);
}

/**
 * Calcula el número total de páginas
 * @param {number} totalItems
 * @param {number} itemsPerPage
 * @returns {number}
 */
function getTotalPages(totalItems, itemsPerPage) {
    return Math.ceil(totalItems / itemsPerPage);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AdminView - Componente principal de administración
 * @typedef {Object} AdminViewState
 * @property {boolean} loading
 * @property {Object|null} stats
 * @property {Object|null} appointmentsData
 * @property {string|null} error
 * @property {number|null} chartTimeout
 */

/** @type {import('mithril').Component<{resource: Object}, AdminViewState>} */
export const AdminView = {
    /** @type {AdminViewState} */
    state: {
        loading: true,
        stats: null,
        appointmentsData: null,
        error: null,
        chartTimeout: null
    },

    /**
     * @param {import('mithril').Vnode} vnode
     */
    oninit: async (vnode) => {
        vnode.state.loading = true;
        vnode.state.stats = null;
        vnode.state.appointmentsData = null;
        vnode.state.error = null;
        vnode.state.dateRange = null;

        try {
            const dateRange = getDateRange();
            vnode.state.dateRange = dateRange;

            const appointmentsData = await fetchAppointments(
                vnode.attrs.resource._id,
                vnode.attrs.resource.groupId,
                dateRange.start,
                dateRange.end
            );

            // DEBUG: Verificar datos recibidos
            console.log('[AdminView] Resource ID:', vnode.attrs.resource._id);
            console.log('[AdminView] Group ID:', vnode.attrs.resource.groupId);
            console.log('[AdminView] Date range:', dateRange);
            console.log('[AdminView] slots recibidos:', appointmentsData?.slots?.length);
            if (appointmentsData?.slots) {
                const slotsWithAppointments = appointmentsData.slots.filter(s => s.appointments?.length > 0).length;
                const slotsWithoutAppointments = appointmentsData.slots.filter(s => !s.appointments?.length || s.appointments.length === 0).length;
                console.log(`[AdminView] Slots con reservas: ${slotsWithAppointments}, sin reservas: ${slotsWithoutAppointments}`);
                // Mostrar estructura del primer slot con appointments
                const slotWithApps = appointmentsData.slots.find(s => s.appointments?.length > 0);
                if (slotWithApps) {
                    console.log('[AdminView] Slot con appointments:', JSON.stringify(slotWithApps, null, 2));
                } else {
                    // Buscar en otros campos
                    console.log('[AdminView] Estructura del slot 1:', JSON.stringify(appointmentsData.slots[0], null, 2));
                }
            }

            const stats = calculateStats(appointmentsData);
            vnode.state.stats = stats;
            vnode.state.appointmentsData = appointmentsData;
            vnode.state.loading = false;

            m.redraw();

            // Inicializar gráfico con cleanup
            vnode.state.chartTimeout = setTimeout(() => {
                const chartContainer = document.querySelector('#chart-container');
                if (chartContainer) {
                    initializeChart(stats, chartContainer);
                } else {
                    console.warn('Chart container not found in DOM');
                }
            }, CONFIG.CHART_INIT_DELAY);
        } catch (error) {
            console.error('Error loading admin data:', error);
            vnode.state.error = error.message;
            vnode.state.loading = false;
            m.redraw();
        }
    },

    /**
     * Cleanup al desmontar componente
     * @param {import('mithril').Vnode} vnode
     */
    onremove: (vnode) => {
        if (vnode.state.chartTimeout) {
            clearTimeout(vnode.state.chartTimeout);
            vnode.state.chartTimeout = null;
        }
    },

    /**
     * @param {import('mithril').Vnode} vnode
     */
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
                    style: { fontSize: '2.5rem', color: COLORS.primary, marginBottom: '1rem' }
                }),
                m(Text, { color: COLORS.slate[500] }, I18N.LOADING)
            ]);
        }

        if (state.error) {
            return m(Segment, { type: 'negative' }, [
                m(Text, `${I18N.ERROR}: ${state.error}`)
            ]);
        }

        return m(FlexCol, { gap: 0, style: { flex: 1 } }, [
            m(ResourceViewHeader, { resource }),
            m('div', {
                class: 'admin-resource-layout',
                style: {
                    display: 'grid',
                    gridTemplateColumns: '320px 1fr',
                    gap: '1.5rem',
                    flex: 1,
                    minWidth: 0,
                    width: '100%'
                }
            }, [
                renderSidebar(resource, state.stats),
                renderScheduleGrid(resource, state.appointmentsData, state.dateRange)
            ]),
            // Media query inline para móvil
            m('style', `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @media (max-width: 900px) {
                    .admin-resource-layout {
                        grid-template-columns: 1fr !important;
                    }
                }
            `)
        ]);
    }
};

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

/**
 * @param {Object} resource
 * @param {Object} stats
 */
function renderSidebar(resource, stats) {
    return m(FlexCol, {
        style: { minWidth: 0, maxWidth: '320px', gap: '2rem' }
    }, [
        // Tarjeta: Imagen + KPIs + Chart
        m(Div, { style: createCardStyle({ overflow: 'hidden' }) }, [
            // Imagen
            m(Div, {
                style: {
                    height: '128px',
                    backgroundColor: COLORS.slate[100],
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
            // KPIs
            m(Div, {
                style: {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    borderTop: `1px solid ${COLORS.slate[100]}`,
                    borderBottom: `1px solid ${COLORS.slate[100]}`,
                    backgroundColor: 'rgba(249, 250, 251, 0.5)',
                    '@media (max-width: 480px)': {
                        gridTemplateColumns: '1fr'
                    }
                }
            }, [
                createKPICell(stats.totalSlots, I18N.SLOTS),
                createKPICell(stats.confirmedAppointments, I18N.RESERVAS),
                createKPICell(stats.availableSeats, I18N.LIBRES, COLORS.success)
            ]),
            // Chart + Legend
            m(Div, {
                style: {
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    alignItems: 'center',
                    '@media (max-width: 640px)': {
                        gridTemplateColumns: '1fr'
                    }
                }
            }, [
                m('div', {
                    id: 'chart-container',
                    style: { minHeight: '60px' }
                }),
                renderLegend()
            ])
        ]),

        // Configuración (flags)
        m(Div, { style: createCardStyle({ padding: '1rem' }) }, [
            m(SmallText, {
                style: {
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: COLORS.slate[400],
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.75rem',
                    display: 'block'
                }
            }, I18N.CONFIGURACION),
            m(FlexRow, {
                gap: '0.5rem',
                flexWrap: 'wrap'
            }, [
                createFlagBadge('check_circle', I18N.AUTOCONFIRMADO),
                createFlagBadge('event_seat', `${resource.seats?.total ?? 0} ${I18N.SEATS}`)
            ])
        ]),

        // Botonera de acciones
        m(Div, { style: createCardStyle({ overflow: 'hidden' }) }, [
            m(Div, { style: { padding: '0.25rem' } }, sidebarActions.map(action =>
                m(Tappable, {
                    onclick: () => handleSidebarAction(resource, action.route, action.label),
                    style: {
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                        color: COLORS.slate[700],
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left'
                    },
                    hover: {
                        backgroundColor: COLORS.slate[100],
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

/**
 * @param {number} value
 * @param {string} label
 * @param {string} color
 */
function createKPICell(value, label, color = COLORS.slate[900]) {
    return m(Div, {
        style: {
            padding: '0.75rem',
            textAlign: 'center',
            borderRight: `1px solid ${COLORS.slate[100]}`
        }
    }, [
        m(Text, { fontSize: '1.125rem', fontWeight: 'bold', color, margin: 0 }, value),
        m(SmallText, {
            fontSize: '0.625rem',
            color: COLORS.slate[500],
            textTransform: 'uppercase',
            fontWeight: 600,
            margin: 0
        }, label)
    ]);
}

/**
 * Renderiza la leyenda del gráfico
 */
function renderLegend() {
    return m(FlexCol, {
        style: { gap: '0.25rem', minWidth: 0 }
    }, [
        createLegendItem(COLORS.success, 'Confirmades'),
        createLegendItem(COLORS.warning, 'Pendents'),
        createLegendItem(COLORS.danger, 'Cancel·lades')
    ]);
}

/**
 * @param {string} color
 * @param {string} label
 */
function createLegendItem(color, label) {
    return m(FlexRow, { alignItems: 'center', gap: '0.5rem' }, [
        m(Div, {
            style: {
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: color
            }
        }),
        m(SmallText, { fontSize: '0.75rem', color: COLORS.slate[600], margin: 0 }, label)
    ]);
}

/**
 * @param {string} icon
 * @param {string} label
 */
function createFlagBadge(icon, label) {
    return m(Div, {
        style: {
            padding: '0.25rem 0.5rem',
            borderRadius: '0.375rem',
            backgroundColor: COLORS.slate[100],
            border: `1px solid ${COLORS.slate[200]}`,
            fontSize: '0.75rem',
            color: COLORS.slate[600],
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
        }
    }, [
        m(Icon, { icon, size: 'small', style: { fontSize: '12px' } }),
        label
    ]);
}

/**
 * @param {Object} resource
 * @param {string|null} route
 */
function handleSidebarAction(resource, route, actionLabel) {
    if (route === 'calendar' && resource?._id) {
        m.route.set(`/resource/${resource._id}/calendar`);
    } else if (route === 'settings' && resource?._id) {
        m.route.set(`/resource/${resource._id}/settings`);
    } else if (actionLabel === 'Gestionar Horarios') {
        openDialog(ScheduleModal, { resource });
    }
}

/**
 * @param {Object} resource
 * @param {Object} appointmentsData
 * @param {Object} dateRange
 */
function renderScheduleGrid(resource, appointmentsData, dateRange) {
    ensureSidebarHTML();

    // Generar todos los slots (existentes + vacíos desde virtualSettings)
    const allSlots = generateAllSlots(
        resource,
        appointmentsData?.slots || [],
        dateRange?.start || Date.now(),
        dateRange?.end || Date.now() + 365 * 24 * 60 * 60 * 1000
    );

    // Crear objeto appointmentsData con todos los slots
    const fullAppointmentsData = {
        ...appointmentsData,
        slots: allSlots
    };

    // Exponer datos globalmente para SlotSidebar (compatibilidad)
    window.__adminAppointmentsData = fullAppointmentsData;

    return m(Segment, {
        type: 'primary',
        style: {
            padding: '1.5rem',
            ...CARD_STYLES.shadow
        }
    }, [
        m(ReservationsView, { resource, appointmentsData: fullAppointmentsData })
    ]);
}

// ============================================================================
// RESERVATIONS VIEW COMPONENT
// ============================================================================

/**
 * @typedef {Object} ReservationsViewState
 * @property {string} searchTerm
 * @property {string} filterStatus
 * @property {boolean} showPast
 * @property {Array} allReservations
 * @property {number} currentPage
 * @property {number} itemsPerPage
 * @property {Object|null} selectedReservation
 * @property {string} viewMode
 */

/** @type {import('mithril').Component<{resource: Object, appointmentsData: Object}, ReservationsViewState>} */
const ReservationsView = {
    /**
     * @param {import('mithril').Vnode} vnode
     */
    oninit: (vnode) => {
        vnode.state.searchTerm = '';
        vnode.state.filterStatus = CONFIG.DEFAULT_FILTER_STATUS;
        vnode.state.showPast = false;

        // Debug: log input data
        console.log('[ReservationsView] Input appointmentsData:', vnode.attrs.appointmentsData ? `slots: ${vnode.attrs.appointmentsData.slots?.length}` : 'null');
        console.log('[ReservationsView] Sample slot:', vnode.attrs.appointmentsData?.slots?.[0]);

        vnode.state.allReservations = extractReservations(vnode.attrs.appointmentsData);

        // Debug: log extracted reservations
        const totalReservations = vnode.state.allReservations.length;
        const confirmed = vnode.state.allReservations.filter(r => r.status === 'confirmed').length;
        const pending = vnode.state.allReservations.filter(r => r.status === 'pending').length;
        const canceled = vnode.state.allReservations.filter(r => r.status === 'canceled').length;
        console.log(`[ReservationsView] Reservas extraídas: ${totalReservations} (confirmed: ${confirmed}, pending: ${pending}, canceled: ${canceled})`);
        vnode.state.currentPage = 1;
        vnode.state.itemsPerPage = CONFIG.ITEMS_PER_PAGE;
        vnode.state.selectedReservation = null;
        vnode.state.viewMode = I18N.VIEW_MODES.LIST;
        vnode.state.statusDropdownOpen = false;
    },

    /**
     * @param {import('mithril').Vnode} vnode
     */
    view: (vnode) => {
        const { resource, appointmentsData } = vnode.attrs;
        const state = vnode.state;

        const filters = {
            searchTerm: state.searchTerm,
            filterStatus: state.filterStatus,
            showPast: state.showPast
        };

        const filteredReservations = filterReservations(state.allReservations, filters);
        const reservationsBySlot = groupReservationsBySlot(filteredReservations);
        const slotGroups = sortSlotGroups(reservationsBySlot);

        const filteredSlots = filterSlots(appointmentsData?.slots || [], filters);
        const slotsByDate = groupSlotsByDate(filteredSlots);
        const slotDateGroups = sortDateKeys(Object.keys(slotsByDate));

        const viewMode = state.viewMode;
        const isListMode = viewMode === I18N.VIEW_MODES.LIST;

        return m(FlexCol, {
            key: 'reservations-container',
            gap: '1rem',
            style: { position: 'relative' }
        }, [
            // Header
            m('div', { key: 'header' }, renderReservationsHeader(
                isListMode ? filteredReservations.length : filteredSlots.length,
                isListMode ? slotGroups.length : slotDateGroups.length,
                state,
                filteredReservations
            )),

            // Search and Filters
            m('div', { key: 'filters' }, renderFilters(state)),

            // Content
            m('div', { key: 'content' }, (isListMode ? slotGroups.length > 0 : filteredSlots.length > 0)
                ? renderContent(isListMode, state, resource, slotGroups, slotDateGroups, slotsByDate, reservationsBySlot)
                : renderEmptyState(isListMode)),

            // Pagination
            m('div', { key: 'pagination' }, renderPagination(state, isListMode, slotGroups, slotDateGroups))
        ]);
    }
};

/**
 * @param {number} itemCount
 * @param {number} groupCount
 * @param {Object} state
 * @param {Array} filteredReservations
 */
function renderReservationsHeader(itemCount, groupCount, state, filteredReservations) {
    const isListMode = state.viewMode === I18N.VIEW_MODES.LIST;
    const itemLabel = isListMode
        ? `${itemCount} ${pluralize(itemCount, I18N.RESERVA, I18N.RESERVAS)}`
        : `${itemCount} ${pluralize(itemCount, I18N.SLOT, I18N.SLOTS)}`;
    const groupLabel = isListMode
        ? `en ${groupCount} ${pluralize(groupCount, I18N.SLOT, I18N.SLOTS)}`
        : `en ${groupCount} ${pluralize(groupCount, I18N.FECHA, I18N.FECHAS)}`;

    return m(FlexRow, {
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
                color: COLORS.slate[800],
                margin: 0
            }, [
                m(Icon, { icon: 'list', size: 'small', style: { marginRight: '0.5rem' } }),
                I18N.RESERVAS
            ]),
            m(SmallText, {
                fontSize: '0.875rem',
                color: COLORS.slate[500],
                margin: 0
            }, `${itemLabel} ${groupLabel}`)
        ]),
        m(Button, {
            type: 'default',
            title: I18N.IMPRIMIR,
            onclick: () => {
                console.log(I18N.IMPRIMIR, filteredReservations);
            },
            style: {
                backgroundColor: COLORS.amber.DEFAULT,
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
                backgroundColor: COLORS.amber.hover,
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
    ]);
}

/**
 * @param {Object} state
 */
function renderFilters(state) {
    return m(FlexRow, {
        key: 'filters',
        gap: '0.75rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        style: {
            '@media (max-width: 768px)': {
                flexDirection: 'column',
                alignItems: 'stretch'
            }
        }
    }, [
        // View Mode Toggle (left side)
        renderViewModeToggle(state),

        // Search Input (center, grows)
        m(Div, {
            style: {
                flex: 1,
                minWidth: '200px',
                position: 'relative',
                '@media (max-width: 768px)': {
                    minWidth: '100%'
                }
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
                    color: COLORS.slate[400],
                    pointerEvents: 'none'
                }
            }, 'search'),
            m(Input, {
                placeholder: I18N.SEARCH_PLACEHOLDER,
                value: state.searchTerm,
                oninput: (e) => {
                    state.searchTerm = e.target.value;
                    state.currentPage = 1;
                    m.redraw();
                },
                style: {
                    width: '100%',
                    paddingLeft: '2.5rem',
                    fontSize: '0.875rem'
                }
            })
        ]),

        // Status Filter Dropdown
        renderStatusDropdown(state),

        // Show Past Toggle
        m(FlexRow, {
            alignItems: 'center',
            gap: '0.5rem',
            style: {
                backgroundColor: COLORS.slate[100],
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.slate[200]}`
            }
        }, [
            m(Switch, {
                isActive: state.showPast,
                onchange: () => {
                    state.showPast = !state.showPast;
                    state.currentPage = 1;
                    m.redraw();
                }
            }),
            m('label', {
                for: 'show-past-switch',
                style: {
                    fontSize: '0.875rem',
                    color: COLORS.slate[600],
                    cursor: 'pointer',
                    userSelect: 'none'
                }
            }, I18N.SHOW_PAST)
        ])
    ]);
}

/**
 * @param {Object} state
 */
function renderStatusDropdown(state) {
    const filters = [
        { key: 'all', label: I18N.RESERVAS_FILTERS.ALL },
        { key: 'confirmed', label: I18N.RESERVAS_FILTERS.CONFIRMED },
        { key: 'pending', label: I18N.RESERVAS_FILTERS.PENDING },
        { key: 'canceled', label: I18N.RESERVAS_FILTERS.CANCELED }
    ];

    const currentFilter = filters.find(f => f.key === state.filterStatus) || filters[0];
    const isDropdownOpen = state.statusDropdownOpen || false;

    return m(Div, {
        style: { position: 'relative' },
        oncreate: (vnode) => {
            // Agregar event listener para cerrar dropdown al hacer click fuera
            if (isDropdownOpen) {
                const handleClickOutside = (e) => {
                    if (!vnode.dom.contains(e.target)) {
                        state.statusDropdownOpen = false;
                        m.redraw();
                        document.removeEventListener('click', handleClickOutside);
                    }
                };
                setTimeout(() => {
                    document.addEventListener('click', handleClickOutside);
                }, 0);
            }
        }
    }, [
        // Botón del dropdown
        m(Button, {
            type: 'default',
            size: 'small',
            onclick: (e) => {
                e.stopPropagation();
                state.statusDropdownOpen = !state.statusDropdownOpen;
                m.redraw();
            },
            style: {
                fontSize: '0.875rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: '120px',
                justifyContent: 'space-between'
            }
        }, [
            currentFilter.label,
            m('span', {
                class: 'material-icons',
                style: {
                    fontSize: '16px',
                    transition: 'transform 0.2s',
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                }
            }, 'arrow_drop_down')
        ]),
        // Dropdown menu
        isDropdownOpen && m(Div, {
            style: {
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '0.25rem',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                border: `1px solid ${COLORS.slate[200]}`,
                zIndex: 100,
                minWidth: '140px',
                overflow: 'hidden'
            },
            onclick: (e) => e.stopPropagation()
        }, filters.map(filter =>
            m(Div, {
                onclick: (e) => {
                    e.stopPropagation();
                    state.filterStatus = filter.key;
                    state.currentPage = 1;
                    state.statusDropdownOpen = false;
                    m.redraw();
                },
                style: {
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    backgroundColor: state.filterStatus === filter.key ? COLORS.slate[100] : 'transparent',
                    fontSize: '0.875rem',
                    color: state.filterStatus === filter.key ? COLORS.primary : COLORS.slate[700],
                    fontWeight: state.filterStatus === filter.key ? 500 : 400,
                    transition: 'background-color 0.15s'
                },
                onmouseenter: (e) => {
                    if (state.filterStatus !== filter.key) {
                        e.currentTarget.style.backgroundColor = COLORS.slate[50];
                    }
                },
                onmouseleave: (e) => {
                    e.currentTarget.style.backgroundColor = state.filterStatus === filter.key ? COLORS.slate[100] : 'transparent';
                }
            }, filter.label)
        ))
    ]);
}

/**
 * @param {Object} state
 */
function renderViewModeToggle(state) {
    return m(FlexRow, {
        alignItems: 'center',
        gap: '0.25rem',
        style: {
            backgroundColor: COLORS.slate[100],
            padding: '0.25rem',
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.slate[200]}`
        }
    }, [
        m(Tappable, {
            title: 'Vista listado (reservas por slot)',
            onclick: () => {
                state.viewMode = I18N.VIEW_MODES.LIST;
                state.currentPage = 1;
                m.redraw();
            },
            style: {
                padding: '0.375rem 0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: state.viewMode === I18N.VIEW_MODES.LIST ? COLORS.slate[200] : 'transparent',
                color: state.viewMode === I18N.VIEW_MODES.LIST ? COLORS.slate[800] : COLORS.slate[500],
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
            }
        }, m(Icon, { icon: 'list', size: 'small', style: { fontSize: '18px' } })),
        m(Tappable, {
            title: 'Vista tarjetas (slots)',
            onclick: () => {
                state.viewMode = I18N.VIEW_MODES.CARDS;
                state.currentPage = 1;
                m.redraw();
            },
            style: {
                padding: '0.375rem 0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: state.viewMode === I18N.VIEW_MODES.CARDS ? COLORS.slate[200] : 'transparent',
                color: state.viewMode === I18N.VIEW_MODES.CARDS ? COLORS.slate[800] : COLORS.slate[500],
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
            }
        }, m(Icon, { icon: 'view_module', size: 'small', style: { fontSize: '18px' } }))
    ]);
}

/**
 * @param {boolean} isListMode
 * @param {Object} state
 * @param {Object} resource
 * @param {Array} slotGroups
 * @param {Array} slotDateGroups
 * @param {Object} slotsByDate
 * @param {Object} reservationsBySlot
 */
function renderContent(isListMode, state, resource, slotGroups, slotDateGroups, slotsByDate, reservationsBySlot) {
    // If list mode, render flat grouped by date (no nested boxes)
    if (isListMode) {
        return renderFlatDateList(state, reservationsBySlot);
    }

    const paginatedGroups = getPaginatedGroups(slotDateGroups, state.currentPage, state.itemsPerPage);

    return m(FlexCol, {
        key: `content-${state.viewMode}`,
        gap: '0.75rem',
        style: { marginTop: '1.5rem' }
    }, paginatedGroups.map((dateKey, groupIndex) =>
        renderDateGroup(dateKey, groupIndex, paginatedGroups.length, slotsByDate, resource)
    ));
}

/**
 * Render a flat list grouped by date (no nested slot boxes)
 * @param {Object} state
 * @param {Object} reservationsBySlot
 */
function renderFlatDateList(state, reservationsBySlot) {
    // Group reservations by date (using date string YYYY-MM-DD as key)
    const reservationsByDate = {};
    Object.values(reservationsBySlot).forEach(group => {
        group.reservations.forEach(res => {
            // Convert Date to YYYY-MM-DD string for grouping
            let dateKey = 'sin-fecha';
            if (res.date) {
                const d = new Date(res.date);
                if (!isNaN(d.getTime())) {
                    dateKey = d.toISOString().split('T')[0];
                }
            }
            if (!reservationsByDate[dateKey]) {
                reservationsByDate[dateKey] = [];
            }
            reservationsByDate[dateKey].push({ ...res, slot: group.slot });
        });
    });

    // Sort dates (string sort works for YYYY-MM-DD)
    const sortedDates = Object.keys(reservationsByDate).sort();

    // Paginate
    const pageSize = state.itemsPerPage || 10;
    const currentPage = state.currentPage || 1;
    const paginatedDates = sortedDates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    if (paginatedDates.length === 0) {
        return renderEmptyState(true);
    }

    return m(FlexCol, {
        gap: '0',
        style: { marginTop: '1rem' }
    }, paginatedDates.map(dateKey => {
        const reservations = reservationsByDate[dateKey];
        const dateObj = dateKey !== 'sin-fecha' ? new Date(dateKey) : null;

        return [
            // Date header (sticky-like)
            m(Div, {
                key: `date-header-${dateKey}`,
                style: {
                    position: 'sticky',
                    top: '0',
                    backgroundColor: COLORS.slate[50],
                    padding: '0.5rem 1rem',
                    borderBottom: `1px solid ${COLORS.slate[200]}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    zIndex: 10
                }
            }, [
                m('span', {
                    class: 'material-icons',
                    style: { fontSize: '16px', color: COLORS.slate[500] }
                }, 'calendar_today'),
                m(Text, {
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: COLORS.slate[600],
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }, dateObj ? formatDate(dateObj) : 'Sin fecha'),
                m(Div, {
                    style: {
                        marginLeft: 'auto',
                        backgroundColor: COLORS.slate[200],
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: COLORS.slate[600]
                    }
                }, `${reservations.length}`)
            ]),
            // Reservations for this date (flat list, no boxes)
            ...reservations.map((reservation, resIndex) => {
                const isSelected = state.selectedReservation?.id === reservation.id;
                const cardKey = reservation.id || `${dateKey}-${resIndex}`;
                const card = m(ReservationCard, {
                    key: cardKey,
                    reservation,
                    isLast: resIndex === reservations.length - 1,
                    isSelected: isSelected,
                    onclick: (e) => {
                        e.stopPropagation();
                        state.selectedReservation = state.selectedReservation?.id === reservation.id ? null : reservation;
                        m.redraw();
                    }
                });
                if (isSelected) {
                    return m(Div, { key: `card-wrap-${cardKey}`, style: { position: 'relative', backgroundColor: 'white' } }, [
                        card,
                        m(ReservationActionsDropdown, {
                            key: `dropdown-${reservation.id}`,
                            reservation: reservation,
                            onClose: () => {
                                state.selectedReservation = null;
                                m.redraw();
                            },
                            onAction: (actionId, res) => {
                                console.log('Action:', actionId, res);
                                switch (actionId) {
                                    case 'edit': break;
                                    case 'info': break;
                                    case 'print': window.print(); break;
                                    case 'notes': break;
                                    case 'message': break;
                                    case 'delete':
                                        if (confirm(I18N.CONFIRM_CANCEL)) {
                                            console.log('Delete reservation:', res.id);
                                        }
                                        break;
                                }
                            }
                        })
                    ]);
                }
                return card;
            })
        ];
    }));
}

/**
 * @param {Object} group
 * @param {number} groupIndex
 * @param {number} totalGroups
 * @param {Object} state
 * @param {Object} reservationsBySlot
 */
function renderSlotGroup(group, groupIndex, totalGroups, state, reservationsBySlot) {
    const { slot, reservations } = group;
    const slotKey = getSlotKey(slot);
    const startDate = slot?.start ? new Date(slot.start) : null;
    const endDate = slot?.end ? new Date(slot.end) : null;

    return m(Div, {
        key: slotKey,
        style: {
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.slate[200]}`,
            overflow: 'visible'
        }
    }, [
        // Header del slot
        m(Div, {
            key: `header-${slotKey}`,
            onclick: () => {
                if (slot?._id && window.openSlotDetails) {
                    window.openSlotDetails(slot._id);
                }
            },
            style: {
                padding: '0.625rem 1rem',
                backgroundColor: COLORS.slate[50],
                borderBottom: `1px solid ${COLORS.slate[100]}`,
                cursor: slot?._id ? 'pointer' : 'not-allowed'
            },
            onmouseenter: (e) => {
                if (slot?._id) e.currentTarget.style.backgroundColor = COLORS.slate[100];
            },
            onmouseleave: (e) => {
                e.currentTarget.style.backgroundColor = COLORS.slate[50];
            }
        }, [
            m(Text, {
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: COLORS.slate[600],
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
                    style: { fontSize: '16px', color: COLORS.slate[500] }
                }, 'calendar_today'),
                startDate ? formatDate(startDate) : I18N.SIN_FECHA,
                startDate && endDate && m(Text, {
                    fontSize: '0.8125rem',
                    padding: '0 0.375rem',
                    color: COLORS.slate[400],
                    margin: 0
                }, '·'),
                startDate && endDate && m(Text, {
                    fontSize: '0.8125rem',
                    color: COLORS.slate[500],
                    margin: 0
                }, `${startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
            ])
        ]),
        // Lista de reservas
        ...reservations.map((reservation, resIndex) => {
            const isSelected = state.selectedReservation?.id === reservation.id;
            const cardKey = reservation.id || `${slotKey}-${resIndex}`;
            const card = m(ReservationCard, {
                key: cardKey,
                reservation,
                isLast: resIndex === reservations.length - 1,
                isSelected: isSelected,
                onclick: (e) => {
                    e.stopPropagation();
                    console.log('Click on reservation:', reservation.id, reservation.userName);
                    state.selectedReservation = state.selectedReservation?.id === reservation.id ? null : reservation;
                    m.redraw();
                }
            });
            if (isSelected) {
                return m(Div, { key: `card-wrap-${cardKey}`, style: { position: 'relative' } }, [
                    card,
                    m(ReservationActionsDropdown, {
                        key: `dropdown-${reservation.id}`,
                        reservation: reservation,
                        onClose: () => {
                            state.selectedReservation = null;
                            m.redraw();
                        },
                        onAction: (actionId, res) => {
                            console.log('Action:', actionId, res);
                            switch (actionId) {
                                case 'edit':
                                    break;
                                case 'info':
                                    break;
                                case 'print':
                                    window.print();
                                    break;
                                case 'notes':
                                    break;
                                case 'message':
                                    break;
                                case 'delete':
                                    if (confirm(I18N.CONFIRM_CANCEL)) {
                                        console.log('Delete reservation:', res.id);
                                    }
                                    break;
                            }
                        }
                    })
                ]);
            }
            return card;
        })
    ]);
}

/**
 * @param {string} dateKey
 * @param {number} groupIndex
 * @param {number} totalGroups
 * @param {Object} slotsByDate
 * @param {Object} resource
 */
function renderDateGroup(dateKey, groupIndex, totalGroups, slotsByDate, resource) {
    const dateSlots = slotsByDate[dateKey];
    const [y, mo, d] = dateKey === 'no-date' ? [null, null, null] : dateKey.split('-').map(Number);
    const dateObj = dateKey !== 'no-date' ? new Date(y, mo - 1, d) : null;

    return m(Div, {
        key: dateKey,
        style: {
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            border: `1px solid ${COLORS.slate[200]}`,
            overflow: 'visible'
        }
    }, [
        m(Div, {
            key: `date-${dateKey}`,
            style: {
                padding: '0.625rem 1rem',
                backgroundColor: COLORS.slate[50],
                borderBottom: `1px solid ${COLORS.slate[100]}`
            }
        }, [
            m(Text, {
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: COLORS.slate[600],
                margin: 0,
                style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }
            }, [
                m('span', { class: 'material-icons', style: { fontSize: '16px', color: COLORS.slate[500] } }, 'calendar_today'),
                dateObj ? formatDate(dateObj) : I18N.SIN_FECHA
            ])
        ]),
        ...dateSlots.map((slot, slotIndex) =>
            m(SlotCard, {
                key: slot._id || `slot-${dateKey}-${slotIndex}`,
                slot,
                resource,
                isLast: slotIndex === dateSlots.length - 1
            })
        )
    ]);
}

/**
 * @param {boolean} isListMode
 */
function renderEmptyState(isListMode) {
    return m(Div, {
        key: 'content-empty',
        style: {
            padding: '3rem',
            textAlign: 'center',
            color: COLORS.slate[400]
        }
    }, [
        m('span', {
            class: 'material-icons',
            style: {
                fontSize: '3rem',
                marginBottom: '1rem',
                display: 'block',
                color: COLORS.slate[300]
            }
        }, 'search_off'),
        m(Text, {
            fontSize: '0.875rem',
            margin: 0
        }, isListMode ? I18N.NO_RESERVAS : I18N.NO_SLOTS)
    ]);
}

/**
 * @param {Object} state
 * @param {boolean} isListMode
 * @param {Array} slotGroups
 * @param {Array} slotDateGroups
 */
function renderPagination(state, isListMode, slotGroups, slotDateGroups) {
    // In list mode, count unique dates from reservations
    let totalItems, hasContent;
    if (isListMode) {
        const uniqueDates = new Set();
        slotGroups.forEach(group => {
            group.reservations.forEach(res => {
                if (res.date) uniqueDates.add(res.date);
            });
        });
        totalItems = uniqueDates.size;
        hasContent = totalItems > 0;
    } else {
        totalItems = slotDateGroups.length;
        hasContent = slotDateGroups.length > 0;
    }
    const totalPages = getTotalPages(totalItems, state.itemsPerPage);

    if (!hasContent) {
        return m.fragment({ key: 'pagination' });
    }

    return m(FlexRow, {
        key: 'pagination',
        justifyContent: 'space-between',
        alignItems: 'center',
        style: {
            padding: '1rem 0',
            marginTop: '1.5rem'
        }
    }, [
        m(SmallText, {
            fontSize: '0.875rem',
            color: COLORS.slate[500],
            margin: 0
        }, formatPaginationInfo(state, isListMode, totalItems)),
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
            }, I18N.PREV),
            m(Button, {
                type: 'default',
                size: 'small',
                onclick: () => {
                    if (state.currentPage < totalPages) {
                        state.currentPage++;
                        m.redraw();
                    }
                },
                disabled: state.currentPage >= totalPages,
                style: {
                    fontSize: '0.875rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    opacity: state.currentPage >= totalPages ? 0.5 : 1,
                    cursor: state.currentPage >= totalPages ? 'not-allowed' : 'pointer'
                }
            }, I18N.NEXT)
        ])
    ]);
}

/**
 * @param {Object} state
 * @param {boolean} isListMode
 * @param {number} totalItems
 * @returns {string}
 */
function formatPaginationInfo(state, isListMode, totalItems) {
    const isList = state.viewMode === I18N.VIEW_MODES.LIST;
    const totalPages = getTotalPages(totalItems, state.itemsPerPage);

    if (isList) {
        const itemCount = state.allReservations.length;
        const groupLabel = pluralize(totalItems, I18N.SLOT, I18N.SLOTS);
        return `${itemCount} ${pluralize(itemCount, I18N.RESERVA, I18N.RESERVAS)} en ${totalItems} ${groupLabel} · ${I18N.PAGE} ${state.currentPage} de ${totalPages}`;
    } else {
        const groupLabel = pluralize(totalItems, I18N.FECHA, I18N.FECHAS);
        return `${totalItems} ${pluralize(totalItems, I18N.SLOT, I18N.SLOTS)} en ${totalItems} ${groupLabel} · ${I18N.PAGE} ${state.currentPage} de ${totalPages}`;
    }
}

// ============================================================================
// SLOT CARD COMPONENT
// ============================================================================

/** @type {import('mithril').Component<{slot: Object, resource: Object, isLast: boolean}>} */
const SlotCard = {
    /**
     * @param {import('mithril').Vnode} vnode
     */
    view: (vnode) => {
        const { slot, resource, isLast } = vnode.attrs;
        const startDate = slot.start ? new Date(slot.start) : null;
        const endDate = slot.end ? new Date(slot.end) : null;
        const totalSeats = slot.seats?.total || 0;
        const remainingSeats = slot.seats?.remaining || 0;
        const bookedSeats = totalSeats - remainingSeats;
        const statusLabel = getSlotStatusLabel(remainingSeats, totalSeats);

        const slotImage = slot.photo || slot.image || resource?.photo || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YxZjVmOSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5NGEzYjgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiI+PC90ZXh0Pjwvc3ZnPg==';

        return m(Div, {
            onclick: () => {
                if (slot._id && window.openSlotDetails) window.openSlotDetails(slot._id);
            },
            style: {
                padding: '0.75rem',
                backgroundColor: 'white',
                borderBottom: isLast ? 'none' : `1px solid ${COLORS.slate[200]}`,
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
                    e.currentTarget.style.borderLeftColor = COLORS.primary;
                }
            },
            onmouseleave: (e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderLeftColor = 'transparent';
            }
        }, [
            m('img', {
                src: slotImage,
                style: {
                    width: '48px',
                    height: '48px',
                    borderRadius: '0.375rem',
                    objectFit: 'cover',
                    flexShrink: 0
                }
            }),
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
                        color: COLORS.slate[800],
                        margin: 0,
                        style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }, slot.title || 'Sin título'),
                    startDate && endDate && m(Text, {
                        fontSize: '0.75rem',
                        margin: 0,
                        color: COLORS.slate[500]
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
                        color: COLORS.slate[500],
                        margin: 0
                    }, `${bookedSeats}/${totalSeats} ${pluralize(bookedSeats, I18N.PLAZA, I18N.PLAZAS)}`)
                ]),
                m('span', {
                    class: 'material-icons',
                    style: { fontSize: '18px', color: COLORS.slate[300], flexShrink: 0 }
                }, 'chevron_right')
            ])
        ]);
    }
};

// ============================================================================
// RESERVATION CARD COMPONENT
// ============================================================================

/** @type {import('mithril').Component<{reservation: Object, isLast: boolean, onclick: Function, isSelected?: boolean}>} */
const ReservationCard = {
    /**
     * @param {import('mithril').Vnode} vnode
     */
    view: (vnode) => {
        const { reservation, isSelected, onclick } = vnode.attrs;
        const status = getStatusColor(reservation.status);
        const isActive = isSelected;

        return m('button', {
            type: 'button',
            onclick: onclick,
            style: {
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: isActive ? '#eff6ff' : 'white',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                borderLeft: isActive ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                borderRight: 'none',
                borderTop: 'none',
                borderBottom: `1px solid ${COLORS.slate[100]}`,
                textAlign: 'left',
                fontFamily: 'inherit'
            },
            onmouseenter: (e) => {
                if (!isActive) {
                    e.currentTarget.style.backgroundColor = COLORS.slate[50];
                }
            },
            onmouseleave: (e) => {
                if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'white';
                }
            }
        }, [
            // === LADO IZQUIERDO: Status + Info ===
            m(FlexRow, {
                alignItems: 'center',
                gap: '0.5rem',
                flex: 1,
                style: { minWidth: 0 }
            }, [
                // Status badge
                m('div', {
                    style: {
                        padding: '0.125rem 0.375rem',
                        borderRadius: '9999px',
                        backgroundColor: status.bg,
                        color: status.text,
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.025em'
                    }
                }, status.label),
                // Nombre - más prominente
                m(Text, {
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: COLORS.slate[800],
                    margin: 0,
                    style: {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }
                }, reservation.userName || I18N.SIN_NOMBRE),
                // Email con icono
                reservation.email && m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.25rem',
                    style: { flexShrink: 0 }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '12px',
                            color: COLORS.slate[400]
                        }
                    }, 'email'),
                    m(Text, {
                        fontSize: '0.6875rem',
                        color: COLORS.slate[500],
                        margin: 0
                    }, reservation.email)
                ]),
                // Teléfono con icono
                reservation.telephone && m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.25rem',
                    style: { flexShrink: 0 }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: {
                            fontSize: '12px',
                            color: COLORS.slate[400]
                        }
                    }, 'phone'),
                    m(Text, {
                        fontSize: '0.6875rem',
                        color: COLORS.slate[500],
                        margin: 0
                    }, reservation.telephone)
                ])
            ]),
            // === LADO DERECHO: Fecha + Turno + Asientos ===
            m(FlexRow, {
                alignItems: 'center',
                gap: '0.375rem',
                flexShrink: 0
            }, [
                // Turno (solo mostrar hora del slot)
                m(Text, {
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: COLORS.slate[600],
                    margin: 0
                }, reservation.slot?.start ? new Date(reservation.slot.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''),
                // Turno
                reservation.turn && m('div', {
                    style: {
                        padding: '0.125rem 0.375rem',
                        borderRadius: '9999px',
                        backgroundColor: COLORS.slate[100],
                        color: COLORS.slate[600],
                        fontSize: '0.625rem',
                        fontWeight: 500
                    }
                }, reservation.maskedTurn || reservation.turn),
                // Asientos
                m('div', {
                    style: {
                        padding: '0.125rem 0.375rem',
                        borderRadius: '9999px',
                        backgroundColor: COLORS.slate[100],
                        color: COLORS.slate[600],
                        fontSize: '0.625rem',
                        fontWeight: 500
                    }
                }, `${reservation.seats}p`),
                // Chevron
                m('span', {
                    class: 'material-icons',
                    style: {
                        fontSize: '14px',
                        color: COLORS.slate[300]
                    }
                }, 'chevron_right')
            ])
        ]);
    }
};

// ============================================================================
// RESERVATION ACTIONS DROPDOWN (INLINE)
// ============================================================================

const RESERVATION_ACTIONS = [
    { id: 'edit', icon: 'edit', label: 'Editar', color: COLORS.slate[700], bg: 'transparent', hoverBg: COLORS.slate[100] },
    { id: 'info', icon: 'info', label: 'Info', color: COLORS.primary, bg: 'transparent', hoverBg: '#dbeafe' },
    { id: 'print', icon: 'print', label: 'Imprimir', color: COLORS.slate[700], bg: 'transparent', hoverBg: COLORS.slate[100] },
    { id: 'notes', icon: 'sticky_note_2', label: 'Notas', color: '#b45309', bg: 'transparent', hoverBg: '#fef3c7' },
    { id: 'message', icon: 'send', label: 'Enviar mensaje', color: '#059669', bg: 'transparent', hoverBg: '#d1fae5' },
    { id: 'delete', icon: 'delete', label: 'Eliminar', color: COLORS.danger, bg: 'transparent', hoverBg: '#fee2e2' }
];

/** @type {import('mithril').Component<{reservation: Object, onClose: Function, onAction: Function}>} */
const ReservationActionsDropdown = {
    view: (vnode) => {
        const { reservation, onClose, onAction } = vnode.attrs;
        const status = getStatusColor(reservation.status);

        return m(Div, {
            style: {
                position: 'absolute',
                right: '0.5rem',
                top: '100%',
                zIndex: 1000,
                minWidth: '180px',
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                border: `1px solid ${COLORS.slate[200]}`,
                boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.15)',
                animation: 'fadeIn 0.15s ease',
                marginTop: '0.25rem'
            },
            onclick: (e) => e.stopPropagation()
        }, [
            // Header
            m(Div, {
                style: {
                    padding: '0.5rem 0.75rem',
                    borderBottom: `1px solid ${COLORS.slate[100]}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }
            }, [
                m('div', {
                    style: {
                        padding: '0.125rem 0.375rem',
                        borderRadius: '9999px',
                        backgroundColor: status.bg,
                        color: status.text,
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        letterSpacing: '0.025em'
                    }
                }, status.label),
                m(Text, {
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: COLORS.slate[800],
                    margin: 0,
                    style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                }, reservation.userName || I18N.SIN_NOMBRE),
                m('button', {
                    type: 'button',
                    onclick: onClose,
                    style: {
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center'
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: { fontSize: '14px', color: COLORS.slate[400] }
                    }, 'close')
                ])
            ]),
            // Actions list
            m(Div, {
                style: { padding: '0.25rem' }
            }, RESERVATION_ACTIONS.map(action =>
                m('button', {
                    type: 'button',
                    onclick: () => {
                        onAction(action.id, reservation);
                        onClose();
                    },
                    style: {
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: action.bg,
                        color: action.color,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.1s ease'
                    },
                    onmouseenter: (e) => {
                        e.currentTarget.style.backgroundColor = action.hoverBg;
                    },
                    onmouseleave: (e) => {
                        e.currentTarget.style.backgroundColor = action.bg;
                    }
                }, [
                    m('span', {
                        class: 'material-icons',
                        style: { fontSize: '16px' }
                    }, action.icon),
                    action.label
                ])
            ))
        ]);
    }
};

// ============================================================================
// RESERVATION SIDEBAR COMPONENT
// ============================================================================

/** @type {import('mithril').Component<{reservation: Object, onClose: Function}>} */
const ReservationSidebar = {
    /**
     * @param {import('mithril').Vnode} vnode
     */
    view: (vnode) => {
        const { reservation, onClose } = vnode.attrs;
        const status = getStatusColor(reservation.status);

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
                    m(H2, { marginTop: 0, marginBottom: 0 }, I18N.RESERVATION_DETAILS),
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
                            backgroundColor: COLORS.slate[50]
                        }
                    }, [
                        m(H2, {
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '1rem',
                            marginTop: 0
                        }, I18N.USER_INFO),
                        m(FlexCol, {
                            gap: '0.75rem'
                        }, [
                            renderInfoRow('person', reservation.userName || I18N.SIN_NOMBRE),
                            reservation.email && renderInfoRow('email', reservation.email),
                            reservation.telephone && renderInfoRow('phone', reservation.telephone)
                        ])
                    ]),

                    // Reservation Details
                    m(Segment, {
                        type: 'primary',
                        style: {
                            padding: '1rem',
                            backgroundColor: COLORS.slate[50]
                        }
                    }, [
                        m(H2, {
                            fontSize: '1rem',
                            fontWeight: 600,
                            marginBottom: '1rem',
                            marginTop: 0
                        }, I18N.RESERVATION_DETAILS_TITLE),
                        m(FlexCol, {
                            gap: '0.75rem'
                        }, [
                            renderInfoRow('event', formatDate(reservation.date)),
                            reservation.time && renderInfoRow('schedule', reservation.time),
                            reservation.turn && renderInfoRow('confirmation_number', `Turno: ${reservation.maskedTurn || reservation.turn}`),
                            renderInfoRow('event_seat', `${reservation.seats} ${pluralize(reservation.seats, I18N.PLAZA, I18N.PLAZAS)}`),
                            reservation.isPaid !== undefined && renderInfoRow(
                                'credit_card',
                                reservation.isPaid ? I18N.PAGADO : I18N.NO_PAGADO,
                                reservation.isPaid ? COLORS.success : COLORS.danger
                            )
                        ])
                    ])
                ])
            ]),
            m(ModalFooter, [
                m(Button, {
                    type: 'default',
                    onclick: () => {
                        console.log(I18N.EDITAR, reservation.id);
                    }
                }, I18N.EDITAR),
                m(Button, {
                    type: 'negative',
                    onclick: () => {
                        if (confirm(I18N.CONFIRM_CANCEL)) {
                            console.log(I18N.CANCELAR, reservation.id);
                        }
                    }
                }, I18N.CANCELAR),
                m(Button, {
                    type: 'default',
                    onclick: onClose
                }, I18N.CERRAR)
            ])
        ]);
    }
};

/**
 * @param {string} icon
 * @param {string} text
 * @param {string} color
 */
function renderInfoRow(icon, text, color = undefined) {
    return m(FlexRow, {
        gap: '0.5rem',
        alignItems: 'center'
    }, [
        m('span', {
            class: 'material-icons',
            style: { fontSize: '18px', color: color || COLORS.slate[500] }
        }, icon),
        m(Text, {
            fontSize: '0.875rem',
            margin: 0,
            style: color ? { color } : {}
        }, text)
    ]);
}
