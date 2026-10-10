import { colors, spacing, typography, baseStyles } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';
import { GuidedTrainerTestView } from './GuidedTrainerTestView.js';
import { checkBluetoothSupport } from '../bluetooth/scanner.js';
import {
    getDiagnosticTargets,
    TrainerDiagnosticSession,
} from '../diagnostics/TrainerDiagnosticSession.js';

export function TrainerDiagnosticsView({ state, subscribeToState, onBack }) {
    const simulated = false;
    const manager = state.bluetoothManager;
    const capabilities = state.deviceCapabilities || manager.capabilities || {};
    const session = new TrainerDiagnosticSession({
        manager,
        capabilities,
        deviceName: simulated ? 'D100 simulado' : state.deviceName,
        simulated,
    });
    session.addEvent('diagnostic_opened', { connectionState: state.connectionState });

    const container = div({
        attrs: { 'data-view': 'trainer-diagnostics', class: 'trainer-test-page' },
    });
    const header = div({
        attrs: { class: 'trainer-test-backrow' },
        children: [button({ text: '← Volver', attrs: { class: 'trainer-test-back' }, events: { click: onBack } })],
    });
    container.appendChild(header);

    const advanced = createElement('details', {
        children: [createElement('summary', { text: 'Opciones avanzadas y datos Bluetooth', styles: { cursor: 'pointer', padding: spacing.md, color: colors.textMuted } })],
    });
    const guided = GuidedTrainerTestView({
        session, simulated,
        connectionState: state.connectionState,
        deviceName: state.deviceName,
        bluetoothSupported: checkBluetoothSupport().supported && Boolean(manager),
        subscribeToState,
        canStart: () => !autoTestRunning,
        onConnect: () => {
            state.bluetoothError = null;
            return manager?.scan().catch(() => {});
        },
        onRunningChange: (running) => {
            if (running) advanced.open = false;
            advanced.querySelectorAll('button, input').forEach((control) => { control.disabled = running; });
        },
    });
    container.appendChild(guided);
    container.appendChild(advanced);

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
    advanced.appendChild(safety);

    const livePower = metric('Potencia', '0 W');
    const liveCadence = metric('Cadencia', '0 rpm');
    const sampleCount = metric('Muestras', '0');
    const commandStatus = metric('Último comando', 'Sin ejecutar');
    const liveFlags = metric('Flags FTMS', '—');
    advanced.appendChild(div({
        styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        children: [livePower.element, liveCadence.element, sampleCount.element, liveFlags.element, commandStatus.element],
    }));

    const rawPacket = createElement('code', {
        attrs: { 'data-testid': 'ftms-raw-packet' },
        text: 'Esperando paquete FTMS…',
        styles: {
            display: 'block',
            overflowWrap: 'anywhere',
            color: colors.textMuted,
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
            fontSize: typography.sizes.sm,
        },
    });
    const packetDetails = createElement('pre', {
        attrs: { 'data-testid': 'ftms-packet-details' },
        text: 'Esperando desglose de bytes…',
        styles: { width: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: typography.sizes.sm, color: colors.textMuted },
    });
    const telemetryWarning = createElement('strong', {
        attrs: { 'data-testid': 'telemetry-warning' },
        text: 'Telemetría pendiente',
        styles: { display: 'block', marginTop: spacing.sm, color: colors.textMuted },
    });

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
    let autoTestCancelled = false;
    let autoTestRunning = false;
    const autoTestButton = commandButton(
        'Ejecutar prueba automática de 80 W',
        runAutomaticErgTest,
    );

    const referenceInput = (placeholder, label) => createElement('input', {
        attrs: { type: 'number', min: '0', max: '2000', inputmode: 'numeric', placeholder, 'aria-label': label },
        styles: {
            width: '150px',
            minHeight: '44px',
            padding: `0 ${spacing.sm}`,
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,.18)',
            background: 'rgba(255,255,255,.06)',
            color: colors.text,
            fontSize: typography.sizes.md,
        },
    });
    const referenceCadence = referenceInput('Cadencia real (rpm)', 'Cadencia real en rpm');
    const referencePower = referenceInput('Potencia real (W)', 'Potencia real en vatios');
    const referenceResult = createElement('p', {
        attrs: { role: 'status', 'aria-live': 'polite', 'data-testid': 'reference-result' },
        text: '',
        styles: { flexBasis: '100%', margin: 0, color: colors.textMuted, fontSize: typography.sizes.sm },
    });
    const markReference = () => {
        try {
            const read = (input) => input.value.trim() === '' ? null : Number(input.value);
            const { details } = session.markReference({ cadence: read(referenceCadence), power: read(referencePower) });
            referenceResult.textContent = `Guardado (${details.sampleCount} paquetes / 5 s) · referencia: ${details.cadence ?? '—'} rpm / ${details.power ?? '—'} W · app: ${details.appCadence?.toFixed(1) ?? '—'} rpm / ${details.appPower?.toFixed(1) ?? '—'} W · error: ${details.cadenceError?.toFixed(1) ?? '—'} rpm / ${details.powerError?.toFixed(1) ?? '—'} W`;
        } catch (error) {
            referenceResult.textContent = error.message;
        }
    };

    advanced.append(
        diagnosticSection(
            '0. Comparar con una referencia',
            'Mantén cada cadencia 20 segundos y marca 60, 80 y 100 rpm; después deja de pedalear y marca 0. Puedes contar vueltas de una misma biela durante 15 segundos y multiplicar por 4. Para los vatios usa un potenciómetro independiente: el objetivo ERG no es una medida real. Cada marca conserva los últimos 5 segundos de paquetes.',
            [referenceCadence, referencePower, commandButton('Marcar ahora', markReference), referenceResult],
        ),
        diagnosticSection(
            '1. Telemetría',
            'Comprueba que potencia y cadencia cambian de forma continua y vuelven a cero al dejar de pedalear.',
            [
                createElement('span', {
                    text: simulated ? 'El simulador genera datos cada segundo.' : 'Captura directa de cada notificación. El informe conserva los últimos 600 paquetes y todas las marcas de referencia. Descárgalo al terminar cada prueba.',
                    styles: { color: colors.textMuted },
                }),
                rawPacket,
                packetDetails,
                telemetryWarning,
            ],
        ),
        diagnosticSection(
            '2. Prueba automática segura',
            'Reanuda, aplica 80 W durante ocho segundos, analiza la respuesta y libera la resistencia al terminar.',
            [autoTestButton],
        ),
        diagnosticSection(
            '3. Control ERG manual',
            'Cada botón envía un único objetivo permitido y mide cuánto tarda el rodillo en aceptarlo.',
            ergButtons,
        ),
        diagnosticSection(
            '4. Resistencia manual',
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
            click: () => {
                autoTestCancelled = true;
                guided.cancel('Terminada con el botón de parada');
                execute('Pausa de seguridad', () => session.pauseAndRelease());
            },
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
    advanced.append(releaseButton, resumeButton, commandLog, exportButton);

    let unsubscribe = null;
    let simulatorTimer = null;
    const ingest = (data) => {
        const sample = session.recordTelemetry(data);
        if (!sample) return;
        guided.record(sample);
        livePower.set(`${sample.power === null ? '—' : Math.round(sample.power)} W`);
        liveCadence.set(`${sample.cadence === null ? '—' : Math.round(sample.cadence)} rpm`);
        const recentSamples = session.samples.slice(-10);
        const spanSeconds = recentSamples.length > 1
            ? (recentSamples.at(-1).timestamp - recentSamples[0].timestamp) / 1000
            : 0;
        const rate = spanSeconds > 0 ? ((recentSamples.length - 1) / spanSeconds).toFixed(1) : '—';
        sampleCount.set(`${session.totalSamples} · ${rate} Hz`);
        if (sample.rawFtms) {
            liveFlags.set(sample.rawFtms.flagsHex || `0x${Number(sample.rawFtms.flags || 0).toString(16)}`);
            rawPacket.textContent = `${sample.rawFtms.byteLength} bytes · ${sample.rawFtms.hex}`;
        }
        const inspection = sample.packetInspection;
        if (inspection) {
            const format = (value) => Number.isFinite(value) ? value.toFixed(1) : '—';
            packetDetails.textContent = [
                'Lectura FTMS estricta (posición → campo = valor):',
                ...inspection.fields.map((field) => `bytes ${field.offset}–${field.offset + field.size - 1} → ${field.name} = ${field.value} (crudo ${field.raw})`),
                `Cadencia FTMS: ${format(inspection.standard.cadence)} rpm · potencia FTMS: ${format(inspection.standard.power)} W`,
                `Hipótesis periodo D100: ${format(inspection.vendorHypotheses.periodCadence)} rpm · byte / 2: ${format(inspection.vendorHypotheses.legacyCadence)} rpm`,
                `Pipeline diagnóstico suavizado: ${format(sample.processed.display.cadence)} rpm / ${format(sample.processed.display.power)} W`,
                ...inspection.warnings,
            ].join('\n');
        }
        telemetryWarning.textContent = sample.cadenceEncoding === 'd100-rpm-x16'
            ? `Cadencia estimada, sin validar · valor ${sample.cadencePeriodTicks} (1/16 rpm)`
            : sample.power > 0 || sample.cadence > 0
                ? 'Telemetría activa'
                : 'Esperando pedaleo';
        telemetryWarning.style.color = colors.textMuted;
    };
    if (simulated) {
        ingest(manager.sample());
        simulatorTimer = setInterval(() => ingest(manager.sample()), 1000);
    } else {
        if (manager.subscribeTelemetry) {
            unsubscribe = manager.subscribeTelemetry(ingest);
        } else {
            let lastFrame = null;
            unsubscribe = subscribeToState?.((nextState) => {
                const frame = nextState.liveData?.rawFtms;
                if (!frame || frame === lastFrame) return;
                lastFrame = frame;
                ingest(nextState.liveData);
            });
        }
    }

    async function execute(label, action) {
        commandStatus.set(`${label}…`);
        commandLog.textContent = `Ejecutando ${label}.`;
        try {
            const result = await action();
            commandStatus.set('Correcto');
            commandLog.textContent = `${label}: aceptado en ${result.latencyMs} ms${simulated ? ' · resultado simulado' : ''}.`;
            return result;
        } catch (error) {
            commandStatus.set('Error');
            commandLog.textContent = `${label}: ${error.message}`;
            return null;
        }
    }

    async function runAutomaticErgTest() {
        if (autoTestRunning) return;
        autoTestRunning = true;
        autoTestCancelled = false;
        autoTestButton.disabled = true;
        autoTestButton.textContent = 'Preparando prueba…';
        session.addEvent('automatic_erg_test_started', { targetPower: 80, durationSeconds: 8 });
        try {
            const resumed = await execute('Reanudación automática', () => session.resume());
            if (!resumed || autoTestCancelled) return;
            await wait(750);
            if (autoTestCancelled) return;

            const ergResult = await execute('ERG automático 80 W', () => session.setErg(80));
            if (!ergResult || autoTestCancelled) return;

            for (let remaining = 8; remaining > 0 && !autoTestCancelled; remaining -= 1) {
                autoTestButton.textContent = `ERG 80 W · ${remaining} s`;
                await wait(1000);
            }
        } finally {
            await execute('Liberación automática', () => session.pauseAndRelease());
            const ergWindow = session.getErgWindows().at(-1);
            session.addEvent('automatic_erg_test_finished', ergWindow || {});
            commandLog.textContent = ergWindow?.averagePower === null || !ergWindow
                ? 'Prueba terminada sin suficientes muestras. El informe conserva los paquetes crudos.'
                : `Prueba terminada: media ${ergWindow.averagePower} W, cadencia ${ergWindow.averageCadence ?? '—'} rpm, error medio ${ergWindow.averageAbsoluteError} W.`;
            autoTestRunning = false;
            autoTestButton.disabled = false;
            autoTestButton.textContent = 'Repetir prueba automática de 80 W';
        }
    }

    function exportReport() {
        session.addEvent('report_exported');
        const report = JSON.stringify({ ...session.getReport(), guidedTest: guided.getReport() }, null, 2);
        const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `smart-trainer-diagnostico-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        commandLog.textContent = 'Informe descargado. No contiene identificadores Bluetooth ni credenciales.';
    }

    container.cleanup = () => {
        guided.cleanup();
        autoTestCancelled = true;
        if (unsubscribe) unsubscribe();
        if (simulatorTimer) clearInterval(simulatorTimer);
        if (!simulated && session.commandResults.some((command) => command.success && ['resume', 'set_erg', 'set_resistance'].includes(command.type))) {
            session.pauseAndRelease().catch(() => {});
        }
    };
    return container;
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
