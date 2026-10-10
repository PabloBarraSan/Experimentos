import { button, createElement, div } from '../utils/dom.js';
import { GuidedTrainerTest } from '../diagnostics/GuidedTrainerTest.js';
import { loadTrainerDiagnostic, saveTrainerDiagnostic } from '../storage/trainerDiagnostic.js';
import { WakeLockManager } from '../session/WakeLockManager.js';
import './trainer-diagnostics.css';

export function GuidedTrainerTestView({ session, simulated, connectionState, deviceName, bluetoothSupported, onConnect, subscribeToState, onRunningChange, canStart = () => true }) {
    const test = new GuidedTrainerTest();
    const wakeLock = new WakeLockManager();
    let timer = null;
    let previewTimer = null;
    let prepTimer = null;
    const PREP_SECONDS = 5;
    let lastPacketAt = null;
    let lastBeat = -1;
    let lastStep = -1;
    let finalReport = null;
    let disposed = false;
    const previewStartedAt = Date.now();
    const root = div({ attrs: { class: 'trainer-test' } });
    const header = div({ attrs: { class: 'trainer-test__header' }, children: [
        div({ children: [
            createElement('span', { attrs: { class: 'trainer-test__eyebrow' }, text: 'ANÁLISIS DEL RODILLO · 4 MIN' }),
            createElement('h1', { attrs: { class: 'trainer-test__title' }, text: 'Prueba de cadencia' }),
            createElement('p', { attrs: { class: 'trainer-test__subtitle' }, text: 'La aguja da una vuelta por pedalada. Sigue el punto y marca una vuelta con la misma pierna al pasar por arriba.' }),
        ] }),
        createElement('span', { attrs: { class: `trainer-test__connection${connectionState === 'connected' ? ' is-on' : ''}` }, text: connectionState === 'connected' ? `● ${deviceName || 'Rodillo conectado'}` : '○ Sin conectar' }),
    ] });
    const target = createElement('strong', { attrs: { class: 'trainer-test__rpm' }, text: '60' });
    const phase = createElement('span', { attrs: { class: 'trainer-test__phase' }, text: 'rpm · OBJETIVO' });
    const beat = div({ attrs: { class: 'trainer-test__beat', role: 'img', 'aria-label': 'Metrónomo visual: la aguja da una vuelta por cada pedalada objetivo' }, children: [
        div({ attrs: { class: 'trainer-test__beat-ticks' } }),
        div({ attrs: { class: 'trainer-test__beat-hand' } }),
        div({ attrs: { class: 'trainer-test__beat-pin' } }),
        div({ attrs: { class: 'trainer-test__beat-marker' } }),
    ] });
    const name = createElement('h2', { attrs: { class: 'trainer-test__step' }, text: 'Conecta tu rodillo para empezar' });
    const instruction = createElement('p', { attrs: { class: 'trainer-test__instruction' }, text: 'Pulsa Conectar rodillo y elige tu D100 en la ventana de Bluetooth.' });
    const stageClock = createElement('strong', { attrs: { class: 'trainer-test__stage-clock' }, text: '—' });
    const totalClock = createElement('span', { attrs: { class: 'trainer-test__total-clock' }, text: 'La prueba dura 4 minutos' });
    const measured = createElement('div', { attrs: { class: 'trainer-test__reading' }, text: 'CADENCIA DEL RODILLO  — rpm      POTENCIA  — W' });
    const status = createElement('p', { attrs: { class: 'trainer-test__status', role: 'status', 'aria-live': 'polite' }, text: simulated ? 'Simulador activo: esta sesión no es una medición real.' : '' });
    const connect = button({ text: connectionState === 'connected' ? 'Rodillo conectado' : 'Conectar rodillo', attrs: { class: 'trainer-test__connect', disabled: !bluetoothSupported || connectionState === 'connected' || connectionState !== 'disconnected' }, events: { click: onConnect } });
    const start = button({ text: 'Empezar prueba', attrs: { class: 'trainer-test__start', disabled: connectionState !== 'connected' }, events: { click: begin } });
    const stop = button({ text: 'Terminar', attrs: { class: 'trainer-test__stop', disabled: true }, events: { click: () => (prepTimer ? cancelPrep() : finish('Terminada por el usuario')) } });
    const download = button({ text: 'Descargar informe de la prueba anterior', attrs: { class: 'trainer-test__download', disabled: true, hidden: true }, events: { click: () => downloadReport(finalReport) } });
    const summary = div({ attrs: { class: 'trainer-test__summary' } });
    const progress = div({ attrs: { class: 'trainer-test__progress' } });
    test.steps.forEach(() => progress.appendChild(div({ attrs: { class: 'trainer-test__segment' } })));
    const controls = div({ attrs: { class: 'trainer-test__controls' }, children: [connect, start, stop, download] });
    const main = div({ attrs: { class: 'trainer-test__main' }, children: [
        div({ attrs: { class: 'trainer-test__meter' }, children: [beat, phase, target, createElement('span', { attrs: { class: 'trainer-test__unit' }, text: 'vueltas de la aguja = pedaladas por minuto' })] }),
        div({ attrs: { class: 'trainer-test__details' }, children: [name, instruction, div({ attrs: { class: 'trainer-test__clocks' }, children: [div({ children: [createElement('span', { attrs: { class: 'trainer-test__label' }, text: 'ESTE BLOQUE' }), stageClock] }), totalClock] }), measured] }),
    ] });
    root.append(header, main, progress, controls, status, summary);
    previewTimer = setInterval(() => animateDial(Date.now(), 60, previewStartedAt), 40);

    if (!bluetoothSupported) status.textContent = 'Bluetooth no está disponible aquí. Abre la app en Chrome o Edge y vuelve a esta pantalla.';

    const unsubscribe = subscribeToState?.((state) => {
        const connected = state.connectionState === 'connected';
        connect.disabled = !bluetoothSupported || connected || state.connectionState !== 'disconnected' || test.status === 'running';
        connect.textContent = connected ? `✓ ${state.deviceName || 'Rodillo conectado'}` : state.connectionState === 'disconnected' ? 'Conectar rodillo' : 'Conectando…';
        start.disabled = !connected || test.status === 'running';
        header.querySelector('.trainer-test__connection').className = `trainer-test__connection${connected ? ' is-on' : ''}`;
        header.querySelector('.trainer-test__connection').textContent = connected ? `● ${state.deviceName || 'Rodillo conectado'}` : '○ Sin conectar';
        if (!bluetoothSupported) status.textContent = 'Este navegador no ofrece Bluetooth. Abre la app en Chrome o Edge para conectar el rodillo.';
        else if (!connected && test.status !== 'running' && !state.bluetoothError) status.textContent = 'Conecta tu rodillo y empieza cuando lleguen los datos.';
        if (state.bluetoothError) status.textContent = state.bluetoothError;
    });

    loadTrainerDiagnostic(simulated).then((report) => {
        if (disposed || !report || test.status !== 'idle') return;
        finalReport = report;
        download.disabled = false;
        download.hidden = false;
        status.textContent = 'Hay un informe anterior guardado; puedes recuperarlo aquí.';
    }).catch(() => {});

    async function begin() {
        if (test.status === 'running' || disposed) return;
        if (!canStart()) {
            status.textContent = 'Termina primero la prueba manual avanzada antes de iniciar la captura guiada.';
            return;
        }
        if (!root.querySelector('.trainer-test__connection').classList.contains('is-on')) {
            status.textContent = 'Conecta el rodillo antes de empezar.';
            return;
        }
        if (!simulated && (!lastPacketAt || Date.now() - lastPacketAt > 5000)) {
            status.textContent = 'Aún no llegan datos. Pedalea suave unos segundos y vuelve a empezar.';
            return;
        }
        if (prepTimer) return;
        const endsAt = Date.now() + PREP_SECONDS * 1000;
        start.disabled = true;
        connect.disabled = true;
        stop.disabled = false;
        onRunningChange(true);
        name.textContent = 'Prepárate';
        instruction.textContent = 'Colócate en la bici y empieza a pedalear suave. La prueba arranca en unos segundos.';
        phase.textContent = 'EMPIEZA EN';
        stageClock.textContent = '—';
        status.textContent = '';
        target.textContent = String(PREP_SECONDS);
        prepTimer = setInterval(() => {
            const left = Math.ceil((endsAt - Date.now()) / 1000);
            if (left > 0) { target.textContent = String(left); return; }
            clearInterval(prepTimer);
            prepTimer = null;
            phase.textContent = 'rpm · OBJETIVO';
            startTest();
        }, 100);
    }

    function cancelPrep() {
        if (!prepTimer) return;
        clearInterval(prepTimer);
        prepTimer = null;
        phase.textContent = 'rpm · OBJETIVO';
        target.textContent = '60';
        name.textContent = 'Prueba cancelada';
        instruction.textContent = 'Pulsa Empezar prueba cuando estés listo.';
        stageClock.textContent = '—';
        stop.disabled = true;
        start.disabled = connectionState !== 'connected';
        connect.disabled = false;
        onRunningChange(false);
    }

    function startTest() {
        test.start();
        wakeLock.acquire().then(() => { if (disposed || test.status !== 'running') wakeLock.release(); });
        clearInterval(previewTimer);
        previewTimer = null;
        finalReport = null;
        download.disabled = true;
        download.hidden = true;
        summary.replaceChildren();
        lastBeat = -1;
        lastStep = -1;
        start.disabled = true;
        stop.disabled = false;
        connect.disabled = true;
        onRunningChange(true);
        session.addEvent('guided_test_started', { steps: test.steps });
        status.textContent = 'Sigue cada destello con una vuelta completa de la misma pierna.';
        tick();
        timer = setInterval(tick, 40);
    }

    function tick() {
        if (test.status !== 'running') return;
        if (!simulated && Date.now() - lastPacketAt > 5000) { finish('Se dejó de recibir la señal del rodillo. Informe parcial guardado.'); return; }
        const frame = test.snapshot();
        if (!frame.step) { finish(); return; }
        if (frame.index !== lastStep) {
            lastStep = frame.index;
            lastBeat = -1;
            name.textContent = `${String(frame.index + 1).padStart(2, '0')} / ${test.steps.length}  ·  ${frame.step.title}`;
            target.textContent = String(frame.step.cadence);
            instruction.textContent = frame.step.instruction;
            session.addEvent('guided_step_started', { ...frame.step, plannedAt: frame.stepStartedAt });
            progress.querySelectorAll('.trainer-test__segment').forEach((segment, index) => {
                segment.classList.toggle('is-done', index < frame.index);
                segment.classList.toggle('is-current', index === frame.index);
            });
        }
        stageClock.textContent = `00:${String(frame.remaining).padStart(2, '0')}`;
        totalClock.textContent = `${formatTime(frame.totalRemaining)} restantes`;
        animateDial(Date.now(), frame.step.cadence, frame.stepStartedAt);
    }

    async function finish(reason = null) {
        if (test.status !== 'running') return;
        test.finish(reason);
        wakeLock.release();
        clearInterval(timer);
        timer = null;
        beat.classList.remove('is-lit');
        stop.disabled = true;
        start.disabled = false;
        connect.disabled = false;
        previewTimer = setInterval(() => animateDial(Date.now(), 60, previewStartedAt), 40);
        onRunningChange(false);
        name.textContent = reason ? 'Prueba interrumpida' : 'Prueba terminada';
        target.textContent = '✓';
        phase.textContent = 'DATOS CAPTURADOS';
        instruction.textContent = 'Descarga el informe y adjúntalo aquí para que pueda revisar los paquetes del rodillo.';
        stageClock.textContent = 'FIN';
        totalClock.textContent = reason || 'Informe listo';
        session.addEvent('guided_test_finished', { status: test.status, reason });
        finalReport = { ...session.getReport(), guidedTest: test.getReport() };
        download.disabled = false;
        download.hidden = false;
        download.textContent = 'Descargar datos para el chat';
        renderSummary(finalReport.guidedTest);
        status.textContent = 'Guardando el informe…';
        try {
            await saveTrainerDiagnostic(finalReport);
            if (!disposed && test.status !== 'running') status.textContent = 'Informe guardado en este navegador. Descárgalo y adjúntalo al chat.';
        } catch {
            if (!disposed && test.status !== 'running') status.textContent = 'No se pudo guardar el informe. Descárgalo antes de salir.';
        }
    }

    function renderSummary(report) {
        summary.replaceChildren(createElement('h3', { attrs: { class: 'trainer-test__summary-title' }, text: 'Resultados por bloque' }));
        const table = createElement('table', { attrs: { class: 'trainer-test__table' } });
        table.appendChild(createElement('thead', { children: [createElement('tr', { children: ['Bloque', 'Objetivo', 'Rodillo', 'Vatios'].map((text) => createElement('th', { text })) })] }));
        const body = createElement('tbody');
        for (const stage of report.stages) body.appendChild(createElement('tr', { children: [stage.title, `${stage.cadence} rpm`, `${stage.measuredCadence ?? '—'} rpm`, `${stage.measuredPower ?? '—'} W`].map((text) => createElement('td', { text })) }));
        table.appendChild(body);
        summary.appendChild(table);
    }

    function animateDial(now, cadence, origin) {
        if (!cadence) {
            beat.classList.remove('is-lit');
            return;
        }
        const turns = (now - origin) * cadence / 60000;
        const fraction = turns % 1;
        beat.querySelector('.trainer-test__beat-hand').style.transform = `rotate(${fraction * 360}deg)`;
        const currentBeat = Math.floor(turns);
        if ((fraction > .96 || fraction < .025) && currentBeat !== lastBeat) {
            lastBeat = currentBeat;
            beat.classList.add('is-lit');
            setTimeout(() => beat.classList.remove('is-lit'), 130);
        }
    }

    root.record = (sample) => {
        lastPacketAt = Date.now();
        test.record(sample);
        measured.textContent = `CADENCIA DEL RODILLO   ${sample.cadence ?? '—'} rpm          POTENCIA   ${sample.power ?? '—'} W`;
    };
    root.cancel = (reason) => finish(reason);
    root.getReport = () => test.getReport();
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') cancelPrep();
        if (document.visibilityState === 'hidden') finish('La app pasó a segundo plano. Informe parcial guardado.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    root.cleanup = () => {
        disposed = true;
        cancelPrep();
        finish('Se salió de la prueba. Informe parcial guardado.');
        clearInterval(timer);
        clearInterval(previewTimer);
        unsubscribe?.();
        document.removeEventListener('visibilitychange', onVisibility);
        wakeLock.release();
    };
    return root;
}

function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function downloadReport(report) {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rodillo-mini-entreno-${report.guidedTest.startedAt}${report.simulated ? '-simulado' : ''}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
