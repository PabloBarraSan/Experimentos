import { colors, spacing, typography, baseStyles } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';
import { CONNECTION_STATE, checkBluetoothSupport } from '../bluetooth/scanner.js';
import { PROBE_CONFIG, ResistanceProbeRunner } from '../diagnostics/ResistanceProbe.js';
import { WakeLockManager } from '../session/WakeLockManager.js';
import { loadSettings, updateSettings } from '../storage/settings.js';

const PHASE_LABELS = {
    resistance: (value) => `Resistencia manual al ${value} %`,
    erg: (value) => `ERG del rodillo a ${value} W`,
    rest: () => 'Descanso: pedalea suave',
};

export function ResistanceProbeView({ state, subscribeToState, onBack }) {
    const manager = state.bluetoothManager;
    const wakeLock = new WakeLockManager();
    let runner = null;
    let report = null;

    const container = div({ attrs: { 'data-view': 'resistance-probe' }, styles: { padding: spacing.lg, maxWidth: '760px', margin: '0 auto', display: 'grid', gap: spacing.md } });
    container.appendChild(button({ text: '← Volver', styles: { ...secondary(), alignSelf: 'start' }, events: { click: () => { stop(); onBack(); } } }));
    container.appendChild(createElement('h1', { text: 'Prueba de resistencia del rodillo', styles: { margin: 0, fontFamily: typography.fontDisplay } }));
    container.appendChild(createElement('p', {
        text: 'Pedalea sin parar a unas 85 rpm. La app irá subiendo la resistencia manual (20 → 100 %) y después pedirá potencias al ERG del rodillo (150 → 350 W), midiendo qué potencia sale en cada paso. Dura unos 5 minutos. Al terminar dice si el límite es el ERG, el rodillo o ninguno.',
        styles: { margin: 0, color: colors.textMuted, lineHeight: 1.5 },
    }));

    const isConnected = () => state.connectionState === CONNECTION_STATE.CONNECTED;
    const isBusy = () => [CONNECTION_STATE.SCANNING, CONNECTION_STATE.CONNECTING, CONNECTION_STATE.CONNECTING_GATT, CONNECTION_STATE.RECONNECTING].includes(state.connectionState);
    const bluetoothSupported = checkBluetoothSupport().supported && Boolean(manager);
    const livePower = metric('Potencia', '0 W');
    const liveCadence = metric('Cadencia', '0 rpm');
    const stepLabel = createElement('strong', { text: '', styles: { fontSize: typography.sizes.lg } });
    const stepDetail = createElement('span', { text: '', styles: { color: colors.textMuted } });
    const results = div({ styles: { display: 'grid', gap: spacing.sm } });
    const verdict = div({});

    const startButton = button({ text: 'Empezar prueba', styles: { ...primary(), width: '100%', minHeight: '54px' }, events: { click: start } });
    const connectButton = button({
        text: 'Conectar rodillo',
        styles: { ...primary(), width: '100%', minHeight: '54px' },
        events: {
            click: () => {
                state.bluetoothError = null;
                manager?.scan().catch(() => {});
            },
        },
    });
    const stopButton = button({ text: 'Parar y liberar resistencia', styles: { ...secondary(), width: '100%', color: '#fff', backgroundColor: colors.error, borderColor: colors.error, display: 'none' }, events: { click: stop } });
    const downloadButton = button({ text: 'Descargar informe', styles: { ...secondary(), width: '100%', display: 'none' }, events: { click: download } });

    container.append(
        div({ styles: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }, children: [livePower.element, liveCadence.element] }),
        div({ styles: { ...baseStyles.card, display: 'grid', gap: spacing.xs }, children: [stepLabel, stepDetail] }),
        connectButton, startButton, stopButton, results, verdict, downloadButton,
    );

    // Refleja el estado de conexión: el rodillo se conecta desde aquí mismo.
    function syncConnection() {
        if (runner) return;
        const connected = isConnected();
        connectButton.style.display = connected ? 'none' : '';
        connectButton.disabled = !bluetoothSupported || isBusy();
        connectButton.textContent = isBusy() ? 'Conectando…' : 'Conectar rodillo';
        startButton.style.display = connected ? '' : 'none';
        stepLabel.textContent = connected
            ? `Listo para empezar${state.deviceName ? ` · ${state.deviceName}` : ''}`
            : bluetoothSupported ? 'Conecta el rodillo para empezar' : 'Este navegador no admite Bluetooth (usa Chrome)';
        if (connected) stepDetail.textContent = '';
    }
    syncConnection();
    const unsubscribeState = subscribeToState?.(syncConnection);

    // Calibración de cadencia: el D100 la deduce del volante, así que se compara con las vueltas contadas.
    const recentRaw = [];
    const calibrationInput = createElement('input', {
        attrs: { type: 'number', min: '20', max: '200', inputmode: 'numeric', placeholder: 'Cadencia real (rpm)', 'aria-label': 'Cadencia real en rpm' },
        styles: { width: '170px', minHeight: '44px', padding: '0 12px', borderRadius: '10px', border: `1px solid ${colors.border}`, background: 'rgba(255,255,255,.06)', color: colors.text, fontSize: typography.sizes.md },
    });
    const calibrationResult = createElement('p', { text: '', styles: { margin: 0, color: colors.textMuted, fontSize: typography.sizes.sm } });
    const currentScale = () => Number(loadSettings().trainer?.cadenceScale) || 1;
    const calibrationCard = div({
        styles: { ...baseStyles.card, display: 'grid', gap: spacing.sm },
        children: [
            createElement('strong', { text: 'Calibrar cadencia' }),
            createElement('p', {
                text: 'El D100 no mide la cadencia en la biela: la calcula desde el volante y cambia al cambiar de marcha. Pedalea constante, cuenta las vueltas de una pierna durante 15 s (×4) y escribe el resultado.',
                styles: { margin: 0, color: colors.textMuted, lineHeight: 1.5, fontSize: typography.sizes.sm },
            }),
            div({
                styles: { display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
                children: [calibrationInput, button({ text: 'Calibrar ahora', styles: secondary(), events: { click: calibrate } }), createElement('span', { text: `Factor actual: ${currentScale().toFixed(2)}`, attrs: { 'data-testid': 'cadence-scale' }, styles: { color: colors.textMuted, fontSize: typography.sizes.sm } })],
            }),
            calibrationResult,
        ],
    });
    container.insertBefore(calibrationCard, results);

    function calibrate() {
        const real = Number(calibrationInput.value);
        const now = Date.now();
        const samples = recentRaw.filter((s) => now - s.at <= 6000 && s.value > 0).map((s) => s.value);
        if (!(real >= 20 && real <= 200)) { calibrationResult.textContent = 'Escribe la cadencia real (entre 20 y 200 rpm).'; return; }
        if (samples.length < 5) { calibrationResult.textContent = 'Pedalea sin parar unos segundos antes de calibrar.'; return; }
        const raw = samples.reduce((sum, v) => sum + v, 0) / samples.length;
        const scale = Math.round((real / raw) * 100) / 100;
        updateSettings({ trainer: { cadenceScale: scale } });
        calibrationResult.textContent = `Calibrado: el rodillo marcaba ${Math.round(raw)} rpm y pedaleabas a ${Math.round(real)}. Factor ${scale.toFixed(2)} guardado. Vuélvelo a hacer si cambias de plato o de piñón.`;
        calibrationCard.querySelector('[data-testid="cadence-scale"]').textContent = `Factor actual: ${scale.toFixed(2)}`;
    }

    const unsubscribeLive = manager?.subscribeTelemetry?.((data) => {
        if (Number.isFinite(data.cadenceRaw)) {
            recentRaw.push({ at: Date.now(), value: data.cadenceRaw });
            if (recentRaw.length > 60) recentRaw.shift();
        }
        livePower.set(`${Math.round(Number(data.power) || 0)} W`);
        liveCadence.set(`${Math.round(Number(data.cadence) || 0)} rpm`);
    });

    async function start() {
        if (runner) return;
        report = null;
        results.replaceChildren();
        verdict.replaceChildren();
        downloadButton.style.display = 'none';
        startButton.style.display = 'none';
        stopButton.style.display = '';
        await wakeLock.acquire();
        let countdown = null;
        runner = new ResistanceProbeRunner({
            manager,
            subscribeTelemetry: (observer) => manager.subscribeTelemetry(observer),
            onProgress: ({ phase, value, stage, seconds }) => {
                clearInterval(countdown);
                const label = PHASE_LABELS[phase](value);
                const text = stage === 'measure' ? 'Midiendo: mantén la cadencia' : stage === 'settle' ? 'Estabilizando: mantén unas 85 rpm' : 'Descanso';
                stepLabel.textContent = label;
                let left = seconds;
                stepDetail.textContent = `${text} · ${left} s`;
                countdown = setInterval(() => { left = Math.max(0, left - 1); stepDetail.textContent = `${text} · ${left} s`; }, 1000);
                runner.countdown = countdown;
            },
        });
        try {
            const outcome = await runner.run();
            clearInterval(countdown);
            report = { date: new Date().toISOString(), device: state.deviceName || null, config: PROBE_CONFIG, ...outcome };
            renderOutcome(outcome);
        } catch (error) {
            clearInterval(countdown);
            stepLabel.textContent = 'La prueba falló';
            stepDetail.textContent = error.message;
        } finally {
            await wakeLock.release();
            runner = null;
            stopButton.style.display = 'none';
            startButton.textContent = 'Repetir prueba';
            syncConnection();
        }
    }

    function stop() {
        if (!runner) return;
        clearInterval(runner.countdown);
        runner.cancel();
        stepLabel.textContent = 'Parando…';
        stepDetail.textContent = 'Se libera la resistencia del rodillo.';
    }

    function renderOutcome({ cancelled, analysis }) {
        stepLabel.textContent = cancelled ? 'Prueba cancelada' : 'Prueba terminada';
        stepDetail.textContent = 'Resultados a continuación.';
        const row = (cells, header = false) => div({
            styles: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: spacing.sm, padding: '6px 0', color: header ? colors.textMuted : colors.text, fontWeight: header ? 600 : 400, fontSize: typography.sizes.sm },
            children: cells.map((text) => createElement('span', { text: String(text) })),
        });
        const table = div({ styles: { ...baseStyles.card } });
        table.append(row(['Paso', 'Potencia', 'Cadencia', `A ${analysis.referenceCadence} rpm`], true));
        analysis.resistance.forEach((r) => table.append(row([`Resistencia ${r.level} %`, `${r.power} W`, `${r.cadence} rpm`, `${r.normalized} W`])));
        analysis.erg.forEach((r) => table.append(row([`ERG ${r.target} W`, `${r.power} W`, `${r.cadence} rpm`, `${r.normalized} W`])));
        results.replaceChildren(table);
        verdict.replaceChildren(div({
            styles: { ...baseStyles.card, border: `1px solid ${analysis.verdict === 'erg_limited' ? colors.warning : colors.border}` },
            children: [createElement('p', { text: analysis.message, styles: { margin: 0, lineHeight: 1.5 } })],
        }));
        downloadButton.style.display = '';
    }

    function download() {
        if (!report) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `smart-trainer-prueba-resistencia-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    container.cleanup = () => {
        unsubscribeLive?.();
        unsubscribeState?.();
        stop();
    };
    return container;
}

function metric(label, initial) {
    const value = createElement('strong', { text: initial, styles: { fontSize: typography.sizes.xl, color: colors.text } });
    return {
        element: div({
            styles: { ...baseStyles.card, display: 'flex', flexDirection: 'column', gap: spacing.xs },
            children: [createElement('span', { text: label, styles: { color: colors.textMuted, fontSize: typography.sizes.sm } }), value],
        }),
        set: (text) => { value.textContent = text; },
    };
}

function primary() {
    return { ...baseStyles.button, backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' };
}

function secondary() {
    return { ...baseStyles.button, backgroundColor: 'transparent', color: colors.text, border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '10px 14px', cursor: 'pointer' };
}
