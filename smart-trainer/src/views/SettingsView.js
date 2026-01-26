/**
 * SettingsView - Vista de configuración
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { loadSettings, saveSettings, calculatePowerZones } from '../storage/settings.js';

/**
 * Vista de configuración del usuario
 */
export function SettingsView({ state, onSave }) {
    const settings = loadSettings();
    
    const containerStyles = {
        padding: spacing.lg,
        maxWidth: '800px',
        margin: '0 auto',
    };
    
    const titleStyles = {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.xl,
    };
    
    const sectionStyles = {
        ...baseStyles.card,
        marginBottom: spacing.lg,
    };
    
    const sectionTitleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
        marginBottom: spacing.md,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
    };
    
    const fieldGroupStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing.md,
    };
    
    const fieldStyles = {
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
    };
    
    const labelStyles = {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: typography.weights.medium,
    };
    
    const inputStyles = {
        ...baseStyles.input,
        width: '100%',
        padding: spacing.sm,
    };
    
    const container = div({ styles: containerStyles });
    
    // Título
    container.appendChild(createElement('h1', { text: '⚙️ Configuración', styles: titleStyles }));
    
    // === Sección: Datos del usuario ===
    const userSection = div({ styles: sectionStyles });
    userSection.appendChild(div({
        styles: sectionTitleStyles,
        children: [
            icon('bike', 24, colors.primary),
            createElement('span', { text: 'Datos del Ciclista' }),
        ],
    }));
    
    const userFields = div({ styles: fieldGroupStyles });
    
    // FTP
    const ftpField = createNumberField({
        id: 'ftp',
        label: 'FTP (Functional Threshold Power)',
        value: settings.ftp,
        unit: 'watts',
        min: 50,
        max: 500,
        step: 5,
    });
    userFields.appendChild(ftpField);
    
    // Peso
    const weightField = createNumberField({
        id: 'weight',
        label: 'Peso',
        value: settings.weight,
        unit: 'kg',
        min: 30,
        max: 200,
        step: 0.5,
    });
    userFields.appendChild(weightField);
    
    // FC Máxima
    const maxHRField = createNumberField({
        id: 'maxHR',
        label: 'FC Máxima',
        value: settings.maxHR,
        unit: 'bpm',
        min: 120,
        max: 220,
        step: 1,
    });
    userFields.appendChild(maxHRField);
    
    // FC Reposo
    const restHRField = createNumberField({
        id: 'restingHR',
        label: 'FC en Reposo',
        value: settings.restingHR,
        unit: 'bpm',
        min: 30,
        max: 100,
        step: 1,
    });
    userFields.appendChild(restHRField);
    
    userSection.appendChild(userFields);
    container.appendChild(userSection);
    
    // === Sección: Zonas de Potencia ===
    const zonesSection = div({ styles: sectionStyles });
    zonesSection.appendChild(div({
        styles: sectionTitleStyles,
        children: [
            icon('zap', 24, colors.warning),
            createElement('span', { text: 'Zonas de Potencia' }),
        ],
    }));
    
    const zones = calculatePowerZones(settings.ftp);
    const zonesTable = createZonesTable(zones);
    zonesSection.appendChild(zonesTable);
    
    container.appendChild(zonesSection);
    
    // === Sección: Preferencias ===
    const prefsSection = div({ styles: sectionStyles });
    prefsSection.appendChild(div({
        styles: sectionTitleStyles,
        children: [
            icon('settings', 24, colors.secondary),
            createElement('span', { text: 'Preferencias' }),
        ],
    }));
    
    const prefsFields = div({ styles: fieldGroupStyles });
    
    // Unidades
    const unitsField = createSelectField({
        id: 'units',
        label: 'Sistema de unidades',
        value: settings.units,
        options: [
            { value: 'metric', label: 'Métrico (km, kg)' },
            { value: 'imperial', label: 'Imperial (mi, lb)' },
        ],
    });
    prefsFields.appendChild(unitsField);
    
    // Sonido
    const soundField = createCheckboxField({
        id: 'soundEnabled',
        label: 'Alertas de sonido',
        checked: settings.soundEnabled,
    });
    prefsFields.appendChild(soundField);
    
    // Vibración
    const vibrationField = createCheckboxField({
        id: 'vibrationEnabled',
        label: 'Vibración (móvil)',
        checked: settings.vibrationEnabled,
    });
    prefsFields.appendChild(vibrationField);
    
    prefsSection.appendChild(prefsFields);
    container.appendChild(prefsSection);
    
    // === Sección: Rodillo ===
    const trainerSection = div({ styles: sectionStyles });
    trainerSection.appendChild(div({
        styles: sectionTitleStyles,
        children: [
            icon('gauge', 24, colors.accent),
            createElement('span', { text: 'Configuración del Rodillo' }),
        ],
    }));
    
    const trainerFields = div({ styles: fieldGroupStyles });
    
    // Circunferencia de rueda
    const wheelField = createNumberField({
        id: 'wheelCircumference',
        label: 'Circunferencia de rueda',
        value: settings.trainer.wheelCircumference,
        unit: 'mm',
        min: 1800,
        max: 2300,
        step: 1,
    });
    trainerFields.appendChild(wheelField);
    
    // Última calibración
    const calibrationInfo = div({
        styles: fieldStyles,
        children: [
            createElement('label', { text: 'Última calibración', styles: labelStyles }),
            createElement('span', {
                text: settings.trainer.lastCalibration 
                    ? new Date(settings.trainer.lastCalibration).toLocaleDateString()
                    : 'Nunca',
                styles: { color: colors.text, fontSize: typography.sizes.md },
            }),
        ],
    });
    trainerFields.appendChild(calibrationInfo);
    
    trainerSection.appendChild(trainerFields);
    container.appendChild(trainerSection);
    
    // === Botones de acción ===
    const actionsStyles = {
        display: 'flex',
        gap: spacing.md,
        justifyContent: 'flex-end',
        marginTop: spacing.xl,
    };
    
    const actions = div({
        styles: actionsStyles,
        children: [
            button({
                styles: {
                    ...baseStyles.button,
                    ...baseStyles.buttonSecondary,
                    padding: `${spacing.md} ${spacing.xl}`,
                },
                text: 'Restablecer',
                events: {
                    click: () => {
                        if (confirm('¿Restablecer toda la configuración a valores por defecto?')) {
                            const { resetSettings } = require('../storage/settings.js');
                            resetSettings();
                            window.location.reload();
                        }
                    },
                },
            }),
            button({
                styles: {
                    ...baseStyles.button,
                    ...baseStyles.buttonPrimary,
                    padding: `${spacing.md} ${spacing.xl}`,
                },
                text: 'Guardar Cambios',
                events: {
                    click: () => {
                        const newSettings = collectFormData(container);
                        saveSettings(newSettings);
                        if (onSave) onSave(newSettings);
                        alert('Configuración guardada');
                    },
                },
            }),
        ],
    });
    container.appendChild(actions);
    
    return container;
}

/**
 * Crear campo numérico
 */
function createNumberField({ id, label, value, unit, min, max, step }) {
    const fieldStyles = {
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
    };
    
    const inputContainerStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
    };
    
    const inputStyles = {
        ...baseStyles.input,
        flex: '1',
        padding: spacing.sm,
    };
    
    const unitStyles = {
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
        minWidth: '50px',
    };
    
    return div({
        styles: fieldStyles,
        children: [
            createElement('label', { 
                text: label, 
                styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                attrs: { for: id },
            }),
            div({
                styles: inputContainerStyles,
                children: [
                    createElement('input', {
                        attrs: {
                            type: 'number',
                            id: id,
                            name: id,
                            value: String(value),
                            min: String(min),
                            max: String(max),
                            step: String(step),
                        },
                        styles: inputStyles,
                    }),
                    createElement('span', { text: unit, styles: unitStyles }),
                ],
            }),
        ],
    });
}

/**
 * Crear campo select
 */
function createSelectField({ id, label, value, options }) {
    const fieldStyles = {
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
    };
    
    const selectStyles = {
        ...baseStyles.input,
        padding: spacing.sm,
        cursor: 'pointer',
    };
    
    const select = createElement('select', {
        attrs: { id, name: id },
        styles: selectStyles,
    });
    
    options.forEach(opt => {
        const option = createElement('option', {
            attrs: { value: opt.value },
            text: opt.label,
        });
        if (opt.value === value) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    return div({
        styles: fieldStyles,
        children: [
            createElement('label', { 
                text: label, 
                styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                attrs: { for: id },
            }),
            select,
        ],
    });
}

/**
 * Crear campo checkbox
 */
function createCheckboxField({ id, label, checked }) {
    const fieldStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        cursor: 'pointer',
    };
    
    const checkboxStyles = {
        width: '20px',
        height: '20px',
        cursor: 'pointer',
    };
    
    return div({
        styles: fieldStyles,
        children: [
            createElement('input', {
                attrs: {
                    type: 'checkbox',
                    id: id,
                    name: id,
                    checked: checked ? 'checked' : undefined,
                },
                styles: checkboxStyles,
            }),
            createElement('label', { 
                text: label, 
                styles: { color: colors.text, cursor: 'pointer' },
                attrs: { for: id },
            }),
        ],
    });
}

/**
 * Crear tabla de zonas
 */
function createZonesTable(zones) {
    const tableStyles = {
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: spacing.sm,
    };
    
    const table = createElement('table', { styles: tableStyles });
    
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Zona', 'Nombre', 'Rango', 'Watts'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        th.style.cssText = `
            padding: ${spacing.sm};
            text-align: left;
            color: ${colors.textMuted};
            font-size: ${typography.sizes.sm};
            border-bottom: 1px solid ${colors.border};
        `;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    zones.forEach(zone => {
        const row = document.createElement('tr');
        
        // Zona con color
        const zoneCell = document.createElement('td');
        zoneCell.innerHTML = `
            <span style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
            ">
                <span style="
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background-color: ${zone.color};
                "></span>
                ${zone.key.toUpperCase()}
            </span>
        `;
        zoneCell.style.padding = spacing.sm;
        row.appendChild(zoneCell);
        
        // Nombre
        const nameCell = document.createElement('td');
        nameCell.textContent = zone.name;
        nameCell.style.cssText = `padding: ${spacing.sm}; color: ${colors.text};`;
        row.appendChild(nameCell);
        
        // Rango %
        const rangeCell = document.createElement('td');
        rangeCell.textContent = zone.maxPercent === 999 
            ? `${zone.minPercent}%+` 
            : `${zone.minPercent}-${zone.maxPercent}%`;
        rangeCell.style.cssText = `padding: ${spacing.sm}; color: ${colors.textMuted};`;
        row.appendChild(rangeCell);
        
        // Watts
        const wattsCell = document.createElement('td');
        wattsCell.textContent = zone.maxWatts === Infinity 
            ? `${zone.minWatts}W+` 
            : `${zone.minWatts}-${zone.maxWatts}W`;
        wattsCell.style.cssText = `
            padding: ${spacing.sm}; 
            color: ${zone.color}; 
            font-weight: ${typography.weights.semibold};
        `;
        row.appendChild(wattsCell);
        
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    return table;
}

/**
 * Recoger datos del formulario
 */
function collectFormData(container) {
    const settings = loadSettings();
    
    // Recoger valores de inputs
    const ftp = container.querySelector('#ftp')?.value;
    const weight = container.querySelector('#weight')?.value;
    const maxHR = container.querySelector('#maxHR')?.value;
    const restingHR = container.querySelector('#restingHR')?.value;
    const units = container.querySelector('#units')?.value;
    const soundEnabled = container.querySelector('#soundEnabled')?.checked;
    const vibrationEnabled = container.querySelector('#vibrationEnabled')?.checked;
    const wheelCircumference = container.querySelector('#wheelCircumference')?.value;
    
    return {
        ...settings,
        ftp: ftp ? parseInt(ftp, 10) : settings.ftp,
        weight: weight ? parseFloat(weight) : settings.weight,
        maxHR: maxHR ? parseInt(maxHR, 10) : settings.maxHR,
        restingHR: restingHR ? parseInt(restingHR, 10) : settings.restingHR,
        units: units || settings.units,
        soundEnabled: soundEnabled ?? settings.soundEnabled,
        vibrationEnabled: vibrationEnabled ?? settings.vibrationEnabled,
        trainer: {
            ...settings.trainer,
            wheelCircumference: wheelCircumference ? parseInt(wheelCircumference, 10) : settings.trainer.wheelCircumference,
        },
    };
}
