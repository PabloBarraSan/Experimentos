/**
 * SettingsView - Vista de configuración
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { loadSettings, saveSettings, resetSettings, calculatePowerZones } from '../storage/settings.js';
import { ZWIFT_PLAY_STATE } from '../bluetooth/zwiftPlay.js';
import {
    getCloudUser,
    getAuthProviders,
    isCloudConfigured,
    sendMagicLink,
    signInWithGoogle,
    signOut,
} from '../cloud/supabase.js';

/**
 * Vista de configuración del usuario
 */
export function SettingsView({ state, onSave }) {
    const settings = loadSettings();
    
    const containerStyles = {
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        padding: spacing.lg,
        boxSizing: 'border-box',
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
    
    const container = div({ className: 'settings-view', styles: containerStyles });
    
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
    
    const userFields = div({ className: 'settings-field-group', styles: fieldGroupStyles });
    
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
    const zonesWrap = div({ className: 'settings-zones-wrap', children: [zonesTable] });
    zonesSection.appendChild(zonesWrap);
    
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
    
    const prefsFields = div({ className: 'settings-field-group', styles: fieldGroupStyles });
    
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
    prefsFields.appendChild(createNumberField({
        id: 'soundVolume', label: 'Volumen de avisos', value: Math.round((settings.soundVolume ?? 0.55) * 100), unit: '%', min: 0, max: 100, step: 5,
    }));
    
    // Vibración
    const vibrationField = createCheckboxField({
        id: 'vibrationEnabled',
        label: 'Vibración (móvil)',
        checked: settings.vibrationEnabled,
    });
    prefsFields.appendChild(vibrationField);
    
    prefsSection.appendChild(prefsFields);
    container.appendChild(prefsSection);

    const cloudSection = div({ styles: sectionStyles });
    cloudSection.appendChild(div({
        styles: sectionTitleStyles,
        children: [
            createElement('span', { text: '☁️' }),
            createElement('span', { text: 'Cuenta y copia en la nube' }),
        ],
    }));
    const cloudContent = div({
        styles: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
        children: [
            createElement('p', {
                text: isCloudConfigured()
                    ? 'Opcional: entra con Google para sincronizar sesiones, progreso, ghosts y retos. El modo invitado siempre sigue disponible.'
                    : 'La app funciona completamente como invitado. Añade las variables de Supabase para activar la sincronización opcional.',
                styles: { color: colors.textMuted, margin: 0 },
            }),
        ],
    });
    cloudSection.appendChild(cloudContent);
    container.appendChild(cloudSection);
    if (isCloudConfigured()) {
        renderCloudAccount(cloudContent);
    }
    
    // === Sección: Rodillo ===
    const trainerSection = div({ styles: sectionStyles });
    trainerSection.appendChild(div({
        styles: sectionTitleStyles,
        children: [
            icon('gauge', 24, colors.accent),
            createElement('span', { text: 'Configuración del Rodillo' }),
        ],
    }));
    
    const trainerFields = div({ className: 'settings-field-group', styles: fieldGroupStyles });
    
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

    // === Sección: Mando Zwift Play (para modo juego) ===
    if (state.zwiftPlayManager) {
        const zwiftSection = div({ styles: sectionStyles });
        zwiftSection.appendChild(div({
            styles: sectionTitleStyles,
            children: [
                createElement('span', { text: '🎮 Mando Zwift Play / Zwift Click' }),
            ],
        }));
        const zwiftRow = div({ className: 'settings-zwift-row', styles: { display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' } });
        const isZwiftConnected = state.zwiftPlayState === ZWIFT_PLAY_STATE.CONNECTED;
        if (isZwiftConnected) {
            const count = state.zwiftPlayManager.sessions ? state.zwiftPlayManager.sessions.length : 1;
            zwiftRow.appendChild(createElement('span', {
                text: `Conectado (${count} mando${count > 1 ? 's' : ''})`,
                styles: { color: colors.primary, fontWeight: typography.weights.medium },
            }));
            if (count === 1) {
                zwiftRow.appendChild(createElement('span', {
                    text: '— Vincula el otro mando (flechas o botones) para usar ambos en el juego.',
                    styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                }));
            }
            zwiftRow.appendChild(button({
                className: 'settings-zwift-btn',
                styles: { ...baseStyles.button, ...baseStyles.buttonSecondary, padding: `${spacing.sm} ${spacing.md}` },
                text: count === 1 ? 'Conectar segundo mando' : 'Añadir otro',
                events: {
                    click: () => {
                        state.zwiftPlayManager.connectSecond().catch((err) => {
                            if (err.name !== 'NotFoundError') alert(err.message || 'Error al conectar');
                        });
                    },
                },
            }));
            zwiftRow.appendChild(button({
                className: 'settings-zwift-btn',
                styles: { ...baseStyles.button, padding: `${spacing.sm} ${spacing.md}` },
                text: 'Desconectar',
                events: {
                    click: () => state.zwiftPlayManager.disconnect(),
                },
            }));
        } else {
            const doConnect = (useAcceptAll = false) => {
                if (!navigator.bluetooth) {
                    alert(
                        'Bluetooth no disponible en esta página.\n\n' +
                        '• Usa Chrome o Edge (en PC o Android).\n' +
                        '• La página debe ser HTTPS o localhost.\n' +
                        '• En móvil, activa la ubicación si te lo pide.'
                    );
                    return;
                }
                const connectFn = useAcceptAll ? state.zwiftPlayManager.connectAcceptAll.bind(state.zwiftPlayManager) : state.zwiftPlayManager.connect.bind(state.zwiftPlayManager);
                connectFn().catch((err) => {
                    if (err.name === 'NotFoundError') {
                        alert(
                            'No se seleccionó ningún mando.\n\n' +
                            '• En el cuadro del navegador, elige tu Zwift Play o Zwift Click y pulsa «Parear» o «Conectar».\n' +
                            '• Si la lista está vacía: enciende el mando (modo emparejable) y prueba «No aparece? Buscar todos los dispositivos BLE».'
                        );
                    } else {
                        const msg = err.message || err.toString?.() || 'Error al conectar';
                        alert('Error al vincular: ' + msg);
                    }
                });
            };
            zwiftRow.appendChild(button({
                className: 'settings-zwift-btn settings-zwift-connect',
                styles: {
                    ...baseStyles.button,
                    ...baseStyles.buttonPrimary,
                    padding: `${spacing.md} ${spacing.lg}`,
                    minHeight: '44px',
                },
                text: state.zwiftPlayState === ZWIFT_PLAY_STATE.CONNECTING ? 'Buscando mandos…' : 'Vincular Zwift Play / Click',
                attrs: state.zwiftPlayState === ZWIFT_PLAY_STATE.CONNECTING ? { disabled: true } : {},
                events: {
                    click: () => doConnect(false),
                },
            }));
            const helpRow = div({
                styles: { marginTop: spacing.sm, display: 'flex', flexDirection: 'column', gap: spacing.xs },
                children: [
                    createElement('span', {
                        text: 'Puedes usar los dos mandos (uno con flechas, otro con botones): vincula primero uno, luego el otro con «Conectar segundo mando». En el juego ambos funcionan igual.',
                        styles: { fontSize: typography.sizes.xs, color: colors.textMuted },
                    }),
                    createElement('span', {
                        text: 'Al pulsar «Vincular» se abrirá un cuadro del navegador para elegir el mando: míralo junto a la barra de direcciones o en una ventana emergente. Elige tu Zwift Play/Click y pulsa Parear.',
                        styles: { fontSize: typography.sizes.xs, color: colors.primary, fontWeight: typography.weights.medium },
                    }),
                    createElement('span', {
                        text: 'Enciende cada mando y ponlo en modo emparejable (mantén pulsado el botón). No debe estar conectado a Zwift u otra app.',
                        styles: { fontSize: typography.sizes.xs, color: colors.textMuted },
                    }),
                    createElement('button', {
                        text: 'No aparece? Buscar todos los dispositivos BLE',
                        className: 'settings-zwift-link',
                        styles: {
                            background: 'none',
                            border: 'none',
                            color: colors.primary,
                            fontSize: typography.sizes.sm,
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                            textDecoration: 'underline',
                        },
                        attrs: {
                            type: 'button',
                            ...(state.zwiftPlayState === ZWIFT_PLAY_STATE.CONNECTING ? { disabled: true } : {}),
                        },
                        events: {
                            click: (e) => {
                                e.preventDefault();
                                doConnect(true);
                            },
                        },
                    }),
                ],
            });
            zwiftRow.appendChild(helpRow);
        }
        zwiftSection.appendChild(zwiftRow);
        container.appendChild(zwiftSection);
    }

    // === Botones de acción ===
    const actionsStyles = {
        display: 'flex',
        gap: spacing.md,
        justifyContent: 'flex-end',
        marginTop: spacing.xl,
        flexWrap: 'wrap',
    };
    
    const actions = div({
        className: 'settings-actions',
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

async function renderCloudAccount(container) {
    const user = await getCloudUser().catch(() => null);
    if (user) {
        container.append(
            createElement('span', {
                text: `Sincronizando como ${user.email}`,
                styles: { color: colors.primary, fontWeight: typography.weights.medium },
            }),
            button({
                text: 'Cerrar sesión',
                styles: { ...baseStyles.button, ...baseStyles.buttonSecondary, alignSelf: 'flex-start' },
                events: {
                    click: async () => {
                        await signOut();
                        window.location.reload();
                    },
                },
            }),
        );
        return;
    }

    const providers = await getAuthProviders();

    const email = createElement('input', {
        attrs: {
            type: 'email',
            inputmode: 'email',
            autocomplete: 'email',
            placeholder: 'tu@email.com',
            'aria-label': 'Correo para iniciar sesión',
        },
        styles: { ...baseStyles.input, maxWidth: '360px' },
    });
    const status = createElement('span', { styles: { color: colors.textMuted, fontSize: typography.sizes.sm } });
    const googleLogin = button({
        text: 'Continuar con Google',
        styles: { ...baseStyles.button, ...baseStyles.buttonPrimary, alignSelf: 'flex-start' },
        events: {
            click: async () => {
                googleLogin.disabled = true;
                const { error } = await signInWithGoogle();
                if (error) {
                    status.textContent = `No se pudo abrir Google: ${error.message}`;
                    googleLogin.disabled = false;
                }
            },
        },
    });
    const login = button({
        text: 'Enviar enlace mágico',
        styles: { ...baseStyles.button, ...baseStyles.buttonPrimary, alignSelf: 'flex-start' },
        events: {
            click: async () => {
                if (!email.value || !email.checkValidity()) {
                    status.textContent = 'Introduce un correo válido.';
                    return;
                }
                login.disabled = true;
                const { error } = await sendMagicLink(email.value.trim());
                status.textContent = error
                    ? `No se pudo enviar: ${error.message}`
                    : 'Revisa tu correo para completar el acceso.';
                login.disabled = false;
            },
        },
    });
    if (providers.google) {
        container.append(googleLogin, createElement('span', { text: 'o usa un enlace por correo', styles: { color: colors.textMuted, fontSize: typography.sizes.xs } }));
    } else {
        container.appendChild(createElement('span', {
            text: 'Google está preparado en la app y pendiente de activar en Supabase. Mientras tanto puedes usar el enlace por correo.',
            styles: { color: colors.warning, fontSize: typography.sizes.sm },
        }));
    }
    container.append(email, login, status);
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
    const soundVolume = Math.max(0, Math.min(1, (parseFloat(container.querySelector('#soundVolume')?.value) || 0) / 100));
    const wheelCircumference = container.querySelector('#wheelCircumference')?.value;
    
    return {
        ...settings,
        ftp: ftp ? parseInt(ftp, 10) : settings.ftp,
        weight: weight ? parseFloat(weight) : settings.weight,
        maxHR: maxHR ? parseInt(maxHR, 10) : settings.maxHR,
        restingHR: restingHR ? parseInt(restingHR, 10) : settings.restingHR,
        units: units || settings.units,
        soundEnabled: soundEnabled ?? settings.soundEnabled,
        soundVolume,
        vibrationEnabled: vibrationEnabled ?? settings.vibrationEnabled,
        trainer: {
            ...settings.trainer,
            wheelCircumference: wheelCircumference ? parseInt(wheelCircumference, 10) : settings.trainer.wheelCircumference,
        },
    };
}
