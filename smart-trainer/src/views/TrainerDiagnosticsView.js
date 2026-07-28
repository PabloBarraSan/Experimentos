import { colors, spacing, typography, baseStyles } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';
import {
    createTrainerSimulator,
    getDiagnosticTargets,
    TrainerDiagnosticSession,
} from '../diagnostics/TrainerDiagnosticSession.js';

export function TrainerDiagnosticsView({ state, subscribeToState, onBack }) {
    const simulated = state.connectionState !== 'connected';
    const manager = simulated ? createTrainerSimulator() : state.bluetoothManager;
    const capabilities = simulated ? manager.capabilities : state.deviceCapabilities;
    const session = new TrainerDiagnosticSession({
        manager,
        capabilities,
        deviceName: simulated ? 'D100 simulado' : state.deviceName,
        simulated,
    });
    session.addEvent('diagnostic_opened', { connectionState: state.connectionState });

    const container = div({
        attrs: { 'data-view': 'trainer-diagnostics' },
        styles: {
            width: '100%',
            maxWidth: '920px',
            margin: '0 auto',
            padding: spacing.lg,
            boxSizing: 'border-box',
            color: colors.text,
        },
    });
    const header = div({
        styles: { display: 'flex', gap: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
        children: [
            button({
                text: '← Volver',
                styles: secondaryButtonStyles(),
                events: { click: onBack },
            }),
            div({
                children: [
                    createElement('h1', {
                        text: 'Diagnóstico del rodillo',
                        styles: { margin: 0, fontSize: typography.sizes.xxl },
                    }),
                    createElement('p', {
                        text: simulated
                            ? 'Modo simulador: puedes recorrer todo el protocolo sin tener el D100 delante.'
                            : `Rodillo conectado: ${state.deviceName}. Pedalea suave y mantén libre el acceso al freno.`,
                        styles: { margin: `${spacing.xs} 0 0`, color: colors.textMuted },
                    }),
                ],
            }),
        ],
    });
    container.appendChild(header);

    const safety = div({
        styles: {
            ...baseStyles.card,
            marginBottom: spacing.lg,
            border: `1px solid ${simulated ? colors.primary : colors.warning}`,
        },
        children: [
            createElement('strong', {
                text: simulated ? 'SIMULADOR ACTIVO' : 'PROTOCOLO DE BAJA INTENSIDAD',
                styles: { color: simulated ? colors.primary : colors.warning },
            }),
            createElement('p', {
                text: simulated
                    ? 'No se enviará ningún comando Bluetooth. Los resultados estarán marcados como simulados.'
                    : 'Los únicos objetivos permitidos son 80, 120 y 160 W. El botón rojo pausa el rodillo inmediatamente.',
                styles: { color: colors.textMuted, marginBottom: 0 },
            }),
        ],
    });
    container.appendChild(safety);

    const livePower = metric('Potencia', '0 W');
    const liveCadence = metric('Cadencia', '0 rpm');
    const sampleCount = metric('Muestras', '0');
    const commandStatus = metric('Último comando', 'Sin ejecutar');
    container.appendChild(div({
        styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        children: [livePower.element, liveCadence.element, sampleCount.element, commandStatus.element],
    }));

    const commandLog = div({
        attrs: { role: 'status', 'aria-live': 'polite' },
        styles: {
            ...baseStyles.card,
            minHeight: '80px',
            marginTop: spacing.md,
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
        },
        text: 'Empieza observando unos segundos de telemetría.',
    });

    const targets = getDiagnosticTargets();
    const ergButtons = targets.erg.map((watts) => commandButton(
        `${watts} W`,
        () => execute(`ERG ${watts} W`, () => session.setErg(watts)),
    ));
    const resistanceButtons = [20, 35].map((percent) => commandButton(
        `${percent}%`,
        () => execute(`Resistencia ${percent}%`, () => session.setResistance(percent)),
    ));

    container.append(
        diagnosticSection(
            '1. Telemetría',
            'Comprueba que potencia y cadencia cambian de forma continua y vuelven a cero al dejar de pedalear.',
            [createElement('span', {
                text: simulated ? 'El simulador genera datos cada segundo.' : 'La captura se inicia automáticamente al conectar.',
                styles: { color: colors.textMuted },
            })],
        ),
        diagnosticSection(
            '2. Control ERG',
            'Cada botón envía un único objetivo permitido y mide cuánto tarda el rodillo en aceptarlo.',
            ergButtons,
        ),
        diagnosticSection(
            '3. Resistencia manual',
            'Prueba niveles moderados. No se utilizarán valores altos en este diagnóstico.',
            resistanceButtons,
        ),
    );

    const releaseButton = button({
        text: 'Parar y liberar resistencia',
        styles: {
            ...secondaryButtonStyles(),
            width: '100%',
            minHeight: '54px',
            color: '#fff',
            backgroundColor: colors.error,
            borderColor: colors.error,
            marginTop: spacing.lg,
        },
        events: {
            click: () => execute('Pausa de seguridad', () => session.pauseAndRelease()),
        },
    });
    const resumeButton = button({
        text: 'Reanudar prueba',
        styles: { ...secondaryButtonStyles(), width: '100%', marginTop: spacing.sm },
        events: {
            click: () => execute('Reanudación', () => session.resume()),
        },
    });
    const exportButton = button({
        text: 'Descargar informe de diagnóstico',
        styles: { ...primaryButtonStyles(), width: '100%', marginTop: spacing.sm },
        events: { click: exportReport },
    });
    container.append(releaseButton, resumeButton, commandLog, exportButton);

    let unsubscribe = null;
    let simulatorTimer = null;
    const ingest = (data) => {
        const sample = session.recordTelemetry(data);
        livePower.set(`${Math.round(sample.power)} W`);
        liveCadence.set(`${Math.round(sample.cadence)} rpm`);
        sampleCount.set(String(session.samples.length));
    };
    if (simulated) {
        ingest(manager.sample());
        simulatorTimer = setInterval(() => ingest(manager.sample()), 1000);
    } else {
        ingest(state.liveData);
        unsubscribe = subscribeToState?.((nextState) => ingest(nextState.liveData));
    }

    async function execute(label, action) {
        commandStatus.set(`${label}…`);
        commandLog.textContent = `Ejecutando ${label}.`;
        try {
            const result = await action();
            commandStatus.set('Correcto');
            commandLog.textContent = `${label}: aceptado en ${result.latencyMs} ms${simulated ? ' · resultado simulado' : ''}.`;
        } catch (error) {
            commandStatus.set('Error');
            commandLog.textContent = `${label}: ${error.message}`;
        }
    }

    function exportReport() {
        session.addEvent('report_exported');
        const report = JSON.stringify(session.getReport(), null, 2);
        const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `smart-trainer-diagnostico-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        commandLog.textContent = 'Informe descargado. No contiene identificadores Bluetooth ni credenciales.';
    }

    container.cleanup = () => {
        if (unsubscribe) unsubscribe();
        if (simulatorTimer) clearInterval(simulatorTimer);
        if (!simulated) session.pauseAndRelease().catch(() => {});
    };
    return container;
}

function metric(label, initialValue) {
    const value = createElement('strong', {
        text: initialValue,
        styles: { fontSize: typography.sizes.xl, color: colors.text },
    });
    return {
        element: div({
            styles: { ...baseStyles.card, padding: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.xs },
            children: [
                createElement('span', { text: label, styles: { color: colors.textMuted, fontSize: typography.sizes.sm } }),
                value,
            ],
        }),
        set: (text) => {
            value.textContent = text;
        },
    };
}

function diagnosticSection(title, description, controls) {
    return div({
        styles: { ...baseStyles.card, marginBottom: spacing.md },
        children: [
            createElement('h2', { text: title, styles: { marginTop: 0, fontSize: typography.sizes.lg } }),
            createElement('p', { text: description, styles: { color: colors.textMuted } }),
            div({
                styles: { display: 'flex', gap: spacing.sm, flexWrap: 'wrap' },
                children: controls,
            }),
        ],
    });
}

function commandButton(text, onClick) {
    return button({
        text,
        styles: { ...secondaryButtonStyles(), minWidth: '92px' },
        events: { click: onClick },
    });
}

function primaryButtonStyles() {
    return {
        ...baseStyles.button,
        ...baseStyles.buttonPrimary,
        minHeight: '46px',
        padding: `${spacing.sm} ${spacing.lg}`,
    };
}

function secondaryButtonStyles() {
    return {
        ...baseStyles.button,
        ...baseStyles.buttonSecondary,
        minHeight: '44px',
        padding: `${spacing.sm} ${spacing.md}`,
    };
}
