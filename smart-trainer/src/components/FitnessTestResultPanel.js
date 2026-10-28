/**
 * FitnessTestResultPanel - Resultado de un test (FTP / CP) con botón para aplicarlo a los ajustes.
 */
import { colors, spacing } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';
import { analyzeTestSession } from '../workouts/fitnessTests.js';
import { updateSettings } from '../storage/settings.js';

const TEST_TITLES = {
    ftp20: 'RESULTADO DEL TEST DE 20 MIN',
    ftp8: 'RESULTADO DEL TEST 2×8',
    ramp: 'RESULTADO DEL RAMP TEST',
    cp: 'RESULTADO DE POTENCIA CRÍTICA',
};

/** Devuelve el panel, o null si la sesión no era un test. */
export function createFitnessTestResultPanel({ workout, session, settings }) {
    const result = analyzeTestSession(workout, session.dataPoints);
    if (!result) return null;

    const panelStyles = {
        width: '100%', padding: '14px', marginBottom: spacing.lg, borderRadius: '14px',
        background: 'rgba(255,255,255,.05)', textAlign: 'left',
    };
    const title = createElement('div', {
        text: TEST_TITLES[result.kind],
        styles: { color: '#75ebc1', fontSize: '11px', fontWeight: 800, letterSpacing: '1.4px', marginBottom: '10px' },
    });

    if (!result.valid || !result.ftp) {
        return div({
            styles: panelStyles,
            children: [
                title,
                createElement('p', {
                    text: 'No hay datos suficientes para calcular el resultado. Completa el esfuerzo principal del test para obtenerlo.',
                    styles: { margin: 0, color: 'rgba(255,255,255,.65)', fontSize: '13px', lineHeight: 1.45 },
                }),
            ],
        });
    }

    const change = settings.ftp ? Math.round(((result.ftp - settings.ftp) / settings.ftp) * 100) : 0;
    const bigChange = Math.abs(change) > 25;
    const sign = change > 0 ? '+' : '';

    const status = createElement('p', {
        styles: { margin: '10px 0 0', color: 'rgba(255,255,255,.65)', fontSize: '12px', lineHeight: 1.45 },
        text: bigChange
            ? `Cambio del ${sign}${change} % respecto a tu FTP actual (${settings.ftp} W): es mucho. Revisa que el esfuerzo fuera máximo y constante antes de aplicarlo.`
            : `Tu FTP actual es ${settings.ftp} W (${sign}${change} %).`,
    });

    const applyButton = button({
        text: `Aplicar FTP ${result.ftp} W`,
        styles: {
            width: '100%', minHeight: '48px', marginTop: '12px', border: 'none', borderRadius: '12px',
            background: colors.success, color: colors.background, fontWeight: 800, cursor: 'pointer',
        },
        events: {
            click: () => {
                const lastTest = {
                    kind: result.kind,
                    date: new Date().toISOString(),
                    ftp: result.ftp,
                    cp: result.cp ?? null,
                    wPrime: result.wPrime ?? null,
                };
                updateSettings({ ftp: result.ftp, fitness: { lastTest } });
                settings.ftp = result.ftp;
                settings.fitness = { ...settings.fitness, lastTest };
                applyButton.disabled = true;
                applyButton.textContent = `FTP actualizado a ${result.ftp} W`;
                applyButton.style.opacity = '0.6';
            },
        },
    });

    return div({
        styles: panelStyles,
        children: [
            title,
            div({
                styles: { display: 'flex', alignItems: 'baseline', gap: '8px' },
                children: [
                    createElement('strong', { text: `${result.ftp} W`, styles: { fontSize: '36px' } }),
                    createElement('span', {
                        text: result.kind === 'cp' ? `FTP estimado · CP ${result.cp} W` : 'FTP estimado',
                        styles: { color: 'rgba(255,255,255,.55)', fontSize: '12px' },
                    }),
                ],
            }),
            ...result.lines.map((line) => createElement('p', {
                text: line,
                styles: { margin: '4px 0 0', color: 'rgba(255,255,255,.65)', fontSize: '12px' },
            })),
            status,
            applyButton,
        ],
    });
}
