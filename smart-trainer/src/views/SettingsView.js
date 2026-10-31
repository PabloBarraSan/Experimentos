/**
 * SettingsView - Vista de configuración
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { loadSettings, saveSettings, resetSettings, calculatePowerZones } from '../storage/settings.js';
import { ZWIFT_PLAY_STATE } from '../bluetooth/zwiftPlay.js';
import { navigateTo } from '../app.js';
import { downloadBackup, restoreBackupFromFile } from '../storage/backup.js';
import { downloadDebugLog } from '../diagnostics/SessionDebugLogger.js';
import {
    connectTrainingApp,
    disconnectTrainingApp,
    getSyncConfig,
    isSyncConnected,
    syncPendingSessions,
    countPendingSessions,
    pullSessions,
    buildLinkUrl,
} from '../sync/TrainingAppSync.js';

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
    container.appendChild(button({
        text: '← Volver',
        attrs: { type: 'button', class: 'prep-back', 'aria-label': 'Volver al inicio' },
        styles: { marginBottom: spacing.md },
        events: { click: () => navigateTo('home') },
    }));
    container.appendChild(createElement('h1', { text: 'Configuración', className: 'settings-title', styles: { ...titleStyles, fontFamily: typography.fontDisplay, letterSpacing: '-1px' } }));
    
    // === Sección: Datos del usuario ===
    const userSection = div({ className: 'settings-card', styles: sectionStyles });
    userSection.appendChild(div({
        className: 'settings-card__title',
        styles: sectionTitleStyles,
        children: [
            icon('bike', 22, '#70e6c6'),
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
    const zonesSection = div({ className: 'settings-card', styles: sectionStyles });
    zonesSection.appendChild(div({
        className: 'settings-card__title',
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
    const prefsSection = div({ className: 'settings-card', styles: sectionStyles });
    prefsSection.appendChild(div({
        className: 'settings-card__title',
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

    // Cómo se cumplen los objetivos de potencia (ERG)
    prefsFields.appendChild(createSelectField({
        id: 'ergMode',
        label: 'Control de potencia (ERG)',
        value: settings.trainer?.ergMode || 'auto',
        options: [
            { value: 'auto', label: 'Automático (ERG nativo)' },
            { value: 'resistance', label: 'Por resistencia (lazo cerrado)' },
            { value: 'native', label: 'ERG nativo del rodillo' },
        ],
    }));
    
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

    const syncSection = div({ className: 'settings-card', styles: sectionStyles });
    syncSection.appendChild(div({
        className: 'settings-card__title',
        styles: sectionTitleStyles,
        children: [
            createElement('span', { text: '🔗' }),
            createElement('span', { text: 'Sincronizar con training-app' }),
        ],
    }));
    const syncContent = div({
        styles: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
    });
    syncSection.appendChild(syncContent);
    container.appendChild(syncSection);
    renderTrainingAppSync(syncContent);

    // === Sección: Registro de depuración (fase alfa) ===
    const debugSection = div({ className: 'settings-card', styles: sectionStyles });
    debugSection.appendChild(div({
        className: 'settings-card__title',
        styles: sectionTitleStyles,
        children: [
            createElement('span', { text: '🧪' }),
            createElement('span', { text: 'Registro de depuración (alfa)' }),
        ],
    }));
    const debugStatus = createElement('p', {
        text: 'Guarda cómo va cada sesión: objetivos enviados al rodillo, potencia real, guardado y sincronización. Descárgalo si algo no cuadra.',
        styles: { color: colors.textMuted, margin: 0 },
    });
    debugSection.append(debugStatus, button({
        text: 'Descargar registro',
        styles: { ...baseStyles.button, ...baseStyles.buttonSecondary, alignSelf: 'flex-start' },
        events: {
            click: () => {
                const count = downloadDebugLog();
                debugStatus.textContent = `Registro descargado (${count} eventos).`;
            },
        },
    }));
    container.appendChild(debugSection);

    // === Sección: Copia de seguridad local ===
    const backupSection = div({ className: 'settings-card', styles: sectionStyles });
    backupSection.appendChild(div({
        className: 'settings-card__title',
        styles: sectionTitleStyles,
        children: [
            icon('download', 24, colors.accent),
            createElement('span', { text: 'Copia de seguridad' }),
        ],
    }));
    const backupStatus = createElement('p', {
        text: 'Guarda todas tus sesiones, rutinas y progreso en un archivo JSON. Funciona sin cuenta ni conexión.',
        styles: { color: colors.textMuted, margin: 0 },
    });
    const restoreInput = createElement('input', {
        attrs: { type: 'file', accept: 'application/json,.json' },
        styles: { display: 'none' },
        events: {
            change: async () => {
                const file = restoreInput.files?.[0];
                if (!file) return;
                try {
                    const result = await restoreBackupFromFile(file);
                    backupStatus.textContent = `Restauradas ${result.sessions} sesiones y ${result.workouts} rutinas.`;
                } catch (error) {
                    backupStatus.textContent = error.message;
                }
                restoreInput.value = '';
            },
        },
    });
    const backupButtonStyles = {
        ...baseStyles.button,
        ...baseStyles.buttonSecondary,
        padding: `${spacing.md} ${spacing.lg}`,
    };
    backupSection.appendChild(div({
        styles: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
        children: [
            backupStatus,
            div({
                styles: { display: 'flex', gap: spacing.sm, flexWrap: 'wrap' },
                children: [
                    button({
                        styles: backupButtonStyles,
                        children: [createElement('span', { text: 'Exportar todo' })],
                        events: {
                            click: async () => {
                                try {
                                    const counts = await downloadBackup();
                                    backupStatus.textContent = `Exportadas ${counts.sessions} sesiones y ${counts.workouts} rutinas.`;
                                } catch (error) {
                                    backupStatus.textContent = `No se pudo exportar: ${error.message}`;
                                }
                            },
                        },
                    }),
                    button({
                        styles: backupButtonStyles,
                        children: [createElement('span', { text: 'Restaurar copia' })],
                        events: { click: () => restoreInput.click() },
                    }),
                    restoreInput,
                ],
            }),
        ],
    }));
    container.appendChild(backupSection);

    // === Sección: Rodillo ===
    const trainerSection = div({ className: 'settings-card', styles: sectionStyles });
    trainerSection.appendChild(div({
        className: 'settings-card__title',
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

    // Factor de cadencia (se calibra en Más → Prueba de resistencia)
    trainerFields.appendChild(createNumberField({
        id: 'cadenceScale',
        label: 'Factor de cadencia (1 = sin corregir)',
        value: settings.trainer.cadenceScale ?? 1,
        unit: '×',
        min: 0.2,
        max: 3,
        step: 0.01,
    }));
    
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
        const zwiftSection = div({ className: 'settings-card', styles: sectionStyles });
        zwiftSection.appendChild(div({
            className: 'settings-card__title',
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

function renderTrainingAppSync(container) {
    container.replaceChildren();
    const config = getSyncConfig();
    const status = createElement('p', { styles: { color: colors.textMuted, margin: 0 } });

    if (isSyncConnected()) {
        status.textContent = `Conectado como ${config.email} · ${config.baseUrl}. Las sesiones nuevas se envían solas al terminar.`;
        // Sesiones terminadas aquí que training-app aún no ha confirmado (p. ej. si falló la red al terminar).
        const syncButton = button({
            text: 'Enviar sesiones pendientes',
            styles: { ...baseStyles.button, ...baseStyles.buttonPrimary, alignSelf: 'flex-start' },
            events: {
                click: async () => {
                    syncButton.disabled = true;
                    status.textContent = 'Enviando…';
                    try {
                        const result = await syncPendingSessions();
                        status.textContent = result.total
                            ? `Enviadas ${result.synced} de ${result.total} sesiones pendientes${result.failed ? ` (${result.failed} con error: se reintentará)` : ''}.`
                            : 'No hay sesiones pendientes: training-app ya tiene todas las de este dispositivo.';
                    } catch (error) {
                        status.textContent = error.message;
                        if (error.code === 'AUTH_EXPIRED') renderTrainingAppSync(container);
                    }
                    syncButton.disabled = false;
                    refreshPendingCount();
                },
            },
        });
        const refreshPendingCount = () => countPendingSessions()
            .then((count) => { syncButton.textContent = count ? `Enviar sesiones pendientes (${count})` : 'Enviar sesiones pendientes'; })
            .catch(() => {});
        refreshPendingCount();
        const pullButton = button({
            text: 'Descargar historial',
            styles: { ...baseStyles.button, ...baseStyles.buttonSecondary, alignSelf: 'flex-start' },
            events: {
                click: async () => {
                    pullButton.disabled = true;
                    status.textContent = 'Descargando…';
                    try {
                        const result = await pullSessions();
                        status.textContent = result.pulled
                            ? `Descargadas ${result.pulled} sesiones nuevas${result.failed ? ` (${result.failed} con error)` : ''}.`
                            : 'Ya tienes todas las sesiones de training-app en este dispositivo.';
                    } catch (error) {
                        status.textContent = error.message;
                        if (error.code === 'AUTH_EXPIRED') renderTrainingAppSync(container);
                    }
                    pullButton.disabled = false;
                },
            },
        });
        const disconnect = button({
            text: 'Desconectar',
            styles: { ...baseStyles.button, ...baseStyles.buttonSecondary, alignSelf: 'flex-start' },
            events: {
                click: () => {
                    disconnectTrainingApp();
                    renderTrainingAppSync(container);
                },
            },
        });
        container.append(status, div({
            styles: { display: 'flex', gap: spacing.sm, flexWrap: 'wrap' },
            children: [syncButton, pullButton, disconnect],
        }));
        return;
    }

    status.textContent = 'Opcional: conecta con tu cuenta de training-app para guardar ahí una copia de tus sesiones. La app funciona igual sin conexión.';
    const field = (attrs) => createElement('input', {
        attrs,
        styles: { ...baseStyles.input, maxWidth: '360px' },
    });
    const baseUrl = field({ type: 'url', placeholder: 'https://app.kitraining.app', 'aria-label': 'URL de training-app', value: config.baseUrl || 'https://app.kitraining.app' });
    const email = field({ type: 'email', autocomplete: 'email', placeholder: 'tu@email.com', 'aria-label': 'Correo de training-app', value: config.email || '' });
    const password = field({ type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña', 'aria-label': 'Contraseña de training-app' });
    const connect = button({
        text: 'Conectar',
        styles: { ...baseStyles.button, ...baseStyles.buttonPrimary, alignSelf: 'flex-start' },
        events: {
            click: async () => {
                if (!email.value || !password.value) {
                    status.textContent = 'Introduce correo y contraseña.';
                    return;
                }
                connect.disabled = true;
                status.textContent = 'Conectando…';
                try {
                    await connectTrainingApp({ baseUrl: baseUrl.value, email: email.value.trim(), password: password.value });
                    // Dispositivo nuevo (p. ej. otro navegador): trae el historial que ya está en training-app.
                    status.textContent = 'Conectado. Descargando historial…';
                    await pullSessions().catch(() => null);
                    renderTrainingAppSync(container);
                } catch (error) {
                    status.textContent = error.message;
                    connect.disabled = false;
                }
            },
        },
    });
    const link = button({
        text: 'Conectar con mi cuenta de training-app',
        styles: { ...baseStyles.button, ...baseStyles.buttonPrimary, alignSelf: 'flex-start' },
        events: {
            click: () => {
                try {
                    window.location.href = buildLinkUrl(baseUrl.value);
                } catch (error) {
                    status.textContent = error.message;
                }
            },
        },
    });
    const orPassword = createElement('p', {
        text: 'Entras con la sesión que ya tienes abierta en training-app (Google incluido); no hace falta contraseña. Si prefieres usar correo y contraseña:',
        styles: { color: colors.textMuted, margin: 0, fontSize: '0.85rem' },
    });
    container.append(status, link, orPassword, baseUrl, email, password, connect);
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
    const ergMode = container.querySelector('#ergMode')?.value;
    const cadenceScale = parseFloat(container.querySelector('#cadenceScale')?.value);
    
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
            ergMode: ergMode || settings.trainer.ergMode || 'auto',
            cadenceScale: cadenceScale > 0.2 && cadenceScale < 3 ? cadenceScale : (settings.trainer.cadenceScale ?? 1),
        },
    };
}
