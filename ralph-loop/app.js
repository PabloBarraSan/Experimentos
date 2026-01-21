/**
 * Punto de entrada - Ralph Loop
 * Monta el componente principal en el DOM
 * Booking Calendar - Vista Mensual
 */

import { MonthCalendar } from './src/components/MonthCalendar.js';
import { Tokens } from './src/tokens.js';
import { 
  getWeekRange, 
  getCurrentWeekendRange, 
  getDateRange, 
  isDateBooked, 
  isDayBlocked,
  startOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
} from './src/core/dates.js';

const translations = {
  'es-ES': {
    badge: 'Ralph Loop',
    title: 'Selecciona tus fechas',
    subtitle: 'Haz clic en una fecha de inicio, mueve el ratón y selecciona la fecha de fin. Usa las flechas para navegar y Enter para seleccionar.',
    selectionEmpty: 'Selecciona tu fecha de inicio y fin para ver el rango.',
    selectionPrefix: 'Seleccionado:',
    localeLabel: 'Idioma',
    navPrevious: 'Anterior',
    navNext: 'Siguiente',
    today: 'Hoy',
    presetWeek: 'Semana completa',
    presetWeekend: 'Este fin de semana',
    presetMonth: 'Mes completo',
    presetNext7: 'Próximos 7 días',
    clearSelection: 'Limpiar selección',
    minStayLabel: (nights) => `Estancia mínima: ${nights} ${nights === 1 ? 'noche' : 'noches'}`,
    maxStayLabel: (nights) => `Estancia máxima: ${nights} ${nights === 1 ? 'noche' : 'noches'}`,
    legend: {
      available: 'Disponible',
      selected: 'Seleccionado',
      inRange: 'En rango',
      booked: 'Ocupado',
      blocked: 'Bloqueado',
    },
    summaryRangeLabel: 'Rango:',
    summaryCta: 'Continuar',
    nights: { one: 'noche', many: 'noches' },
    alertConfirm: (rangeLabel, nightsText) => `¡Reserva confirmada!\nRango: ${rangeLabel}\n${nightsText}`,
    calendarLabel: 'Calendario de reserva',
    status: {
      available: 'Disponible',
      booked: 'Ocupado',
      blocked: 'Bloqueado',
      selected: 'Seleccionado',
      inRange: 'En rango',
      outOfMonth: 'Fuera de mes',
    },
  },
  'en-US': {
    badge: 'Ralph Loop',
    title: 'Select your dates',
    subtitle: 'Click a start date, move the mouse, and select the end date. Use arrow keys to navigate and Enter to select.',
    selectionEmpty: 'Select your start and end dates to see the range.',
    selectionPrefix: 'Selected:',
    localeLabel: 'Language',
    navPrevious: 'Previous',
    navNext: 'Next',
    today: 'Today',
    presetWeek: 'Full week',
    presetWeekend: 'This weekend',
    presetMonth: 'Full month',
    presetNext7: 'Next 7 days',
    clearSelection: 'Clear selection',
    minStayLabel: (nights) => `Minimum stay: ${nights} ${nights === 1 ? 'night' : 'nights'}`,
    maxStayLabel: (nights) => `Maximum stay: ${nights} ${nights === 1 ? 'night' : 'nights'}`,
    legend: {
      available: 'Available',
      selected: 'Selected',
      inRange: 'In range',
      booked: 'Booked',
      blocked: 'Blocked',
    },
    summaryRangeLabel: 'Range:',
    summaryCta: 'Continue',
    nights: { one: 'night', many: 'nights' },
    alertConfirm: (rangeLabel, nightsText) => `Booking confirmed!\nRange: ${rangeLabel}\n${nightsText}`,
    calendarLabel: 'Booking calendar',
    status: {
      available: 'Available',
      booked: 'Booked',
      blocked: 'Blocked',
      selected: 'Selected',
      inRange: 'In range',
      outOfMonth: 'Out of month',
    },
  },
};

const localeOptions = [
  { value: 'es-ES', label: 'ES' },
  { value: 'en-US', label: 'EN' },
];

/**
 * Componente raíz de la aplicación
 */
export const app = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.currentMonth = new Date();
    state.selectedRange = { start: null, end: null };
    state.isDesktop = window.innerWidth >= 1024; // Detectar desktop
    state.locale = state.locale || 'es-ES';
    document.documentElement.lang = state.locale.split('-')[0];
    
    // Listener para cambios de tamaño de ventana
    state.handleResize = () => {
      state.isDesktop = window.innerWidth >= 1024;
      m.redraw();
    };
    window.addEventListener('resize', state.handleResize);
  },
  
  onremove: (vnode) => {
    // Limpiar listener
    if (vnode.state.handleResize) {
      window.removeEventListener('resize', vnode.state.handleResize);
    }
  },

  view: (vnode) => {
    const state = vnode.state;

    const locale = state.locale || 'es-ES';
    const strings = translations[locale] || translations['es-ES'];
    const hasSelection = Boolean(state.selectedRange.start && state.selectedRange.end);
    const formatShortDate = (date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const formatRangeLabel = (start, end) => {
      if (!start || !end) return '';
      return start.getTime() === end.getTime()
        ? formatShortDate(start)
        : `${formatShortDate(start)} - ${formatShortDate(end)}`;
    };
    const rangeNights = hasSelection ? getDateRange(state.selectedRange.start, state.selectedRange.end).length : 0;
    const nightsLabel = rangeNights === 1 ? strings.nights.one : strings.nights.many;
    const rangeLabel = hasSelection ? formatRangeLabel(state.selectedRange.start, state.selectedRange.end) : '';
    const selectionText = hasSelection
      ? `${strings.selectionPrefix} ${rangeLabel} (${rangeNights} ${nightsLabel})`
      : strings.selectionEmpty;
    
    // Estilos inline para el contenedor principal
    const containerStyles = {
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
      padding: `${Tokens.layout.spacing.xl} ${Tokens.layout.spacing.xl} ${hasSelection ? '110px' : Tokens.layout.spacing.xl} ${Tokens.layout.spacing.xl}`, // Espacio para barra fija
    };

    const cardStyles = {
      width: '100%',
      maxWidth: state.isDesktop ? '1200px' : '900px',
      backgroundColor: Tokens.colors.surface,
      borderRadius: Tokens.layout.borderRadius.xl,
      padding: Tokens.layout.spacing['2xl'],
      boxShadow: '0 30px 60px rgba(15, 23, 42, 0.08)',
      border: `1px solid ${Tokens.colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: Tokens.layout.spacing.lg,
    };

    const headerStyles = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: Tokens.layout.spacing.sm,
    };

    const badgeStyles = {
      alignSelf: 'center',
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: '999px',
      backgroundColor: Tokens.colors.primaryLight,
      color: Tokens.colors.primary,
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.semibold,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
    };

    const titleStyles = {
      fontSize: Tokens.typography.fontSize['3xl'],
      fontWeight: Tokens.typography.fontWeight.bold,
      color: Tokens.colors.textPrimary,
    };

    const subtitleStyles = {
      fontSize: Tokens.typography.fontSize.base,
      color: Tokens.colors.textSecondary,
      maxWidth: '720px',
    };

    const selectionStyles = {
      fontSize: Tokens.typography.fontSize.sm,
      color: Tokens.colors.textPrimary,
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: Tokens.layout.borderRadius.lg,
    };

    const headerTopStyles = {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Tokens.layout.spacing.md,
      flexWrap: 'wrap',
    };

    const localeToggleStyles = {
      display: 'flex',
      alignItems: 'center',
      gap: Tokens.layout.spacing.xs,
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
      borderRadius: '999px',
      padding: '4px',
    };

    const localeButtonStyles = {
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: '999px',
      border: 'none',
      backgroundColor: 'transparent',
      color: Tokens.colors.textSecondary,
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.semibold,
      cursor: 'pointer',
      transition: Tokens.transitions.fast,
    };

    const localeButtonActiveStyles = {
      backgroundColor: Tokens.colors.surface,
      color: Tokens.colors.textPrimary,
      boxShadow: Tokens.layout.shadow.sm,
    };

    const rulesStyles = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: Tokens.layout.spacing.sm,
      justifyContent: 'center',
    };

    const rulePillStyles = {
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
      borderRadius: '999px',
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      fontSize: Tokens.typography.fontSize.sm,
      color: Tokens.colors.textSecondary,
      fontWeight: Tokens.typography.fontWeight.medium,
    };

    const legendStyles = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: Tokens.layout.spacing.sm,
      justifyContent: 'center',
    };

    const legendItemStyles = {
      display: 'flex',
      alignItems: 'center',
      gap: Tokens.layout.spacing.xs,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: '999px',
      border: `1px solid ${Tokens.colors.border}`,
      backgroundColor: Tokens.colors.surfaceSecondary,
      fontSize: Tokens.typography.fontSize.sm,
      color: Tokens.colors.textSecondary,
    };

    const getLegendSwatchStyles = (color, borderColor = null) => ({
      width: '12px',
      height: '12px',
      borderRadius: '4px',
      backgroundColor: color,
      border: borderColor ? `1px solid ${borderColor}` : 'none',
    });

    const controlsStyles = {
      display: 'flex',
      flexDirection: 'column',
      gap: Tokens.layout.spacing.md,
      padding: Tokens.layout.spacing.md,
      borderRadius: Tokens.layout.borderRadius.lg,
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
    };

    const controlsRowStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: Tokens.layout.spacing.sm,
    };

    // Datos de ejemplo para el calendario de booking
    const bookingData = {
      bookedDates: [
        // Algunas fechas ocupadas de ejemplo
        '2024-01-15',
        '2024-01-16',
        '2024-01-20',
        '2024-01-25',
      ],
      blockedDays: [0, 6], // Domingos y Sábados bloqueados
      minStay: 1,
      maxStay: 30,
    };

    // Navegación de meses
    const navigatePrevious = () => {
      const newDate = new Date(state.currentMonth);
      newDate.setMonth(newDate.getMonth() - 1);
      state.currentMonth = newDate;
      m.redraw();
    };

    const navigateNext = () => {
      const newDate = new Date(state.currentMonth);
      newDate.setMonth(newDate.getMonth() + 1);
      state.currentMonth = newDate;
      m.redraw();
    };

    const navigateToday = () => {
      state.currentMonth = new Date();
      m.redraw();
    };

    const handleLocaleChange = (nextLocale) => {
      state.locale = nextLocale;
      document.documentElement.lang = nextLocale.split('-')[0];
      m.redraw();
    };

    const isUnavailableDate = (date) => {
      return isDateBooked(date, bookingData.bookedDates) || isDayBlocked(date, bookingData.blockedDays);
    };

    const normalizeRange = (start, end) => {
      const normalizedStart = startOfDay(start);
      const normalizedEnd = startOfDay(end);
      return normalizedStart <= normalizedEnd
        ? { start: normalizedStart, end: normalizedEnd }
        : { start: normalizedEnd, end: normalizedStart };
    };

    const validatePresetRange = (range) => {
      const normalized = normalizeRange(range.start, range.end);
      if (isUnavailableDate(normalized.start)) {
        console.warn('El preset no puede iniciar en un día no disponible');
        return null;
      }

      const allDates = getDateRange(normalized.start, normalized.end);
      const firstUnavailable = allDates.find((date, index) => index > 0 && isUnavailableDate(date));
      let finalEnd = normalized.end;
      if (firstUnavailable) {
        const clamped = new Date(firstUnavailable);
        clamped.setDate(clamped.getDate() - 1);
        finalEnd = startOfDay(clamped);
      }

      const rangeDates = getDateRange(normalized.start, finalEnd);
      const nights = rangeDates.length;
      if (nights < bookingData.minStay) {
        console.warn(`La estancia mínima es de ${bookingData.minStay} días`);
        return null;
      }
      if (nights > bookingData.maxStay) {
        console.warn(`La estancia máxima es de ${bookingData.maxStay} días`);
        return null;
      }

      return { start: normalized.start, end: finalEnd };
    };

    const applyPresetRange = (range) => {
      const validatedRange = validatePresetRange(range);
      if (!validatedRange) return;
      if (validatedRange.start.getMonth() !== state.currentMonth.getMonth() ||
          validatedRange.start.getFullYear() !== state.currentMonth.getFullYear()) {
        state.currentMonth = new Date(validatedRange.start);
      }
      handleRangeSelect(validatedRange.start, validatedRange.end);
    };

    // Estilos para los botones de navegación
    const buttonStyles = {
      padding: `${Tokens.layout.spacing.sm} ${Tokens.layout.spacing.md}`,
      backgroundColor: Tokens.colors.primary,
      color: Tokens.colors.textInverse,
      border: 'none',
      borderRadius: Tokens.layout.borderRadius.md,
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: Tokens.transitions.fast,
      boxShadow: Tokens.layout.shadow.md,
    };

    const buttonHoverStyles = {
      ...buttonStyles,
      backgroundColor: Tokens.colors.primaryHover,
    };

    // Callback para cuando se selecciona un rango
    const handleRangeSelect = (start, end) => {
      state.selectedRange = { start, end };
      console.log('Rango seleccionado:', {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      });
      m.redraw();
    };

    const clearSelection = () => {
      state.selectedRange = { start: null, end: null };
      m.redraw();
    };

    // Handlers para presets
    const selectWeekRange = () => {
      const today = new Date();
      const weekRange = getWeekRange(today);
      applyPresetRange(weekRange);
    };

    const selectWeekendRange = () => {
      const today = new Date();
      const weekendRange = getCurrentWeekendRange(today);
      applyPresetRange(weekendRange);
    };

    const selectMonthRange = () => {
      const monthStart = startOfMonth(state.currentMonth);
      const monthEnd = endOfMonth(state.currentMonth);
      applyPresetRange({ start: monthStart, end: monthEnd });
    };

    const selectNext7Range = () => {
      const today = startOfDay(new Date());
      const nextEnd = addDays(today, 6);
      applyPresetRange({ start: today, end: nextEnd });
    };

    // Estilos para botones de preset
    const presetButtonStyles = {
      ...buttonStyles,
      backgroundColor: Tokens.colors.surface,
      color: Tokens.colors.textPrimary,
      border: `1px solid ${Tokens.colors.border}`,
      boxShadow: 'none',
    };

    const presetButtonHoverStyles = {
      ...presetButtonStyles,
      backgroundColor: Tokens.colors.primaryLight,
      borderColor: Tokens.colors.primary,
    };

    const clearButtonStyles = {
      ...presetButtonStyles,
      color: Tokens.colors.primary,
      borderColor: Tokens.colors.primary,
      backgroundColor: Tokens.colors.primaryLight,
    };

    const clearButtonHoverStyles = {
      ...clearButtonStyles,
      backgroundColor: Tokens.colors.surface,
    };

    const legendItems = [
      { key: 'available', label: strings.legend.available, color: Tokens.colors.cell.default, border: Tokens.colors.border },
      { key: 'selected', label: strings.legend.selected, color: Tokens.colors.cell.selected },
      { key: 'range', label: strings.legend.inRange, color: Tokens.colors.cell.inRange },
      { key: 'booked', label: strings.legend.booked, color: Tokens.colors.cell.booked },
      { key: 'blocked', label: strings.legend.blocked, color: Tokens.colors.cell.disabled },
    ];

    // Construir array de children sin null
    const children = [
      m('div', { key: 'main-card', style: cardStyles }, [
        m('div', { key: 'header', style: headerStyles }, [
          m('div', { style: headerTopStyles }, [
            m('div', { style: badgeStyles }, strings.badge),
            m('div', { style: localeToggleStyles, role: 'group', 'aria-label': strings.localeLabel }, [
              ...localeOptions.map((option) => {
                const isActive = locale === option.value;
                return m('button', {
                  key: option.value,
                  style: isActive ? { ...localeButtonStyles, ...localeButtonActiveStyles } : localeButtonStyles,
                  'aria-pressed': isActive ? 'true' : 'false',
                  onclick: () => handleLocaleChange(option.value),
                }, option.label);
              }),
            ]),
          ]),
          m('h1', { style: titleStyles }, strings.title),
          m('p', { style: subtitleStyles }, strings.subtitle),
          m('div', { style: selectionStyles, 'aria-live': 'polite' }, selectionText),
        ]),
        m('div', { key: 'rules', style: rulesStyles }, [
          m('div', { style: rulePillStyles }, strings.minStayLabel(bookingData.minStay)),
          m('div', { style: rulePillStyles }, strings.maxStayLabel(bookingData.maxStay)),
        ]),
        m('div', { key: 'legend', style: legendStyles }, [
          ...legendItems.map((item) => m('div', { key: item.key, style: legendItemStyles }, [
            m('span', { style: getLegendSwatchStyles(item.color, item.border) }),
            item.label,
          ])),
        ]),
        m('div', { key: 'controls', style: controlsStyles }, [
          m('div', { style: controlsRowStyles }, [
            m('button', {
              style: buttonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, buttonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, buttonStyles),
              onclick: navigatePrevious,
              'aria-label': strings.navPrevious,
            }, `◀ ${strings.navPrevious}`),
            m('button', {
              style: buttonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, buttonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, buttonStyles),
              onclick: navigateToday,
              'aria-label': strings.today,
            }, strings.today),
            m('button', {
              style: buttonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, buttonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, buttonStyles),
              onclick: navigateNext,
              'aria-label': strings.navNext,
            }, `${strings.navNext} ▶`),
          ]),
          m('div', { style: controlsRowStyles }, [
            m('button', {
              style: presetButtonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, presetButtonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, presetButtonStyles),
              onclick: selectWeekRange,
              'aria-label': strings.presetWeek,
            }, `📅 ${strings.presetWeek}`),
            m('button', {
              style: presetButtonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, presetButtonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, presetButtonStyles),
              onclick: selectWeekendRange,
              'aria-label': strings.presetWeekend,
            }, `🏖️ ${strings.presetWeekend}`),
            m('button', {
              style: presetButtonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, presetButtonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, presetButtonStyles),
              onclick: selectMonthRange,
              'aria-label': strings.presetMonth,
            }, `🗓️ ${strings.presetMonth}`),
            m('button', {
              style: presetButtonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, presetButtonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, presetButtonStyles),
              onclick: selectNext7Range,
              'aria-label': strings.presetNext7,
            }, `✨ ${strings.presetNext7}`),
            ...(hasSelection ? [m('button', {
              style: clearButtonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, clearButtonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, clearButtonStyles),
              onclick: clearSelection,
              'aria-label': strings.clearSelection,
            }, strings.clearSelection)] : []),
          ]),
        ]),
        m(MonthCalendar, {
          key: 'calendar',
          currentMonth: state.currentMonth,
          numberOfMonths: state.isDesktop ? 2 : 1,
          locale: locale,
          labels: {
            status: strings.status,
            nights: strings.nights,
            calendarLabel: strings.calendarLabel,
          },
          data: bookingData,
          state: {
            selectedRange: state.selectedRange,
            currentMonth: state.currentMonth,
          },
          callbacks: {
            onRangeSelect: handleRangeSelect,
            onMonthChange: (nextDate) => {
              state.currentMonth = new Date(nextDate);
              m.redraw();
            },
          },
        }),
      ]),
    ];

    // Agregar barra de resumen si hay rango seleccionado
    if (hasSelection) {
      const rangeText = `${rangeNights} ${nightsLabel}`;
      
      children.push(m('div', {
        key: 'summary-bar',
        style: {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Tokens.colors.surface,
          borderTop: `1px solid ${Tokens.colors.border}`,
          padding: `${Tokens.layout.spacing.md} ${Tokens.layout.spacing.xl}`,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
          zIndex: Tokens.layout.zIndex.modal - 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: Tokens.layout.spacing.md,
        }
      }, [
        m('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: Tokens.layout.spacing.md,
            flexWrap: 'wrap',
          }
        }, [
          m('div', {
            style: {
              fontSize: Tokens.typography.fontSize.base,
              color: Tokens.colors.textPrimary,
              fontWeight: Tokens.typography.fontWeight.medium,
            }
          }, [
            m('span', {
              style: {
                color: Tokens.colors.textSecondary,
                marginRight: Tokens.layout.spacing.xs,
              }
            }, `${strings.summaryRangeLabel} `),
            rangeLabel,
          ]),
          m('div', {
            style: {
              fontSize: Tokens.typography.fontSize.base,
              color: Tokens.colors.textPrimary,
              fontWeight: Tokens.typography.fontWeight.semibold,
            }
          }, rangeText),
        ]),
        m('button', {
          style: {
            padding: `${Tokens.layout.spacing.sm} ${Tokens.layout.spacing.xl}`,
            backgroundColor: Tokens.colors.primary,
            color: Tokens.colors.textInverse,
            border: 'none',
            borderRadius: Tokens.layout.borderRadius.md,
            fontSize: Tokens.typography.fontSize.base,
            fontWeight: Tokens.typography.fontWeight.semibold,
            cursor: 'pointer',
            transition: Tokens.transitions.fast,
            boxShadow: Tokens.layout.shadow.md,
          },
          onmouseenter: (e) => {
            e.target.style.backgroundColor = Tokens.colors.primaryHover;
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = Tokens.layout.shadow.lg;
          },
          onmouseleave: (e) => {
            e.target.style.backgroundColor = Tokens.colors.primary;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = Tokens.layout.shadow.md;
          },
          onclick: () => {
            const nightsText = `${rangeNights} ${nightsLabel}`;
            alert(strings.alertConfirm(rangeLabel, nightsText));
          },
          'aria-label': strings.summaryCta,
        }, strings.summaryCta),
      ]));
    }

    return m('div', { style: containerStyles }, children);
  },
};
