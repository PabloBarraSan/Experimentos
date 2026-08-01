import { colors, spacing, typography, baseStyles } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';
import { WORKOUT_PRESETS } from '../workouts/presets.js';
import { acceptConnection, createChallenge, joinChallengeByCode, listChallenges, listConnections, requestConnection } from '../cloud/CommunityService.js';
import { getCloudUser } from '../cloud/supabase.js';

export function ChallengesView({ onBack }) {
    const container = div({
        attrs: { 'data-view': 'challenges' },
        styles: { width: 'min(980px, 100%)', margin: '0 auto', padding: spacing.lg },
    });
    const status = createElement('p', { text: 'Cargando retos…', styles: { color: colors.textMuted } });
    const userIdLabel = createElement('p', { text: '', styles: { color: colors.textMuted, fontFamily: typography.fontMono, fontSize: '11px', overflowWrap: 'anywhere' } });
    const list = div({ styles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' } });
    const codeInput = createElement('input', {
        attrs: { placeholder: 'Código de invitación', 'aria-label': 'Código de reto' },
        styles: { ...baseStyles.input, maxWidth: '280px' },
    });
    const friendInput = createElement('input', {
        attrs: { placeholder: 'ID de ciclista', 'aria-label': 'ID de ciclista' },
        styles: { ...baseStyles.input, maxWidth: '280px' },
    });
    const connectionsList = div({ styles: { display: 'grid', gap: '8px', margin: `${spacing.lg} 0` } });
    container.append(
        button({ text: '← Volver', styles: { ...baseStyles.button, ...baseStyles.buttonSecondary }, events: { click: onBack } }),
        createElement('h1', { text: 'Retos y ghosts', styles: { fontFamily: typography.fontDisplay, fontSize: 'clamp(32px, 6vw, 54px)', marginBottom: '8px' } }),
        createElement('p', { text: 'Compite por precisión con el mismo entrenamiento. Los vatios absolutos no dan ventaja.', styles: { color: colors.textMuted, marginBottom: spacing.lg } }),
        div({
            styles: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: spacing.lg },
            children: [
                ...[WORKOUT_PRESETS.AURORA_EXPEDITION, WORKOUT_PRESETS.MIST_FOREST_EXPEDITION, WORKOUT_PRESETS.NORTHERN_PEAKS_EXPEDITION].map((workout) => button({
                    text: `Crear · ${workout.mission.title}`,
                    styles: { ...baseStyles.button, ...baseStyles.buttonPrimary },
                    events: { click: async () => run(() => createChallenge({ mission: workout.mission })) },
                })),
                codeInput,
                button({ text: 'Unirme', styles: { ...baseStyles.button, ...baseStyles.buttonSecondary }, events: { click: () => run(() => joinChallengeByCode(codeInput.value)) } }),
            ],
        }),
        status,
        userIdLabel,
        list,
        createElement('h2', { text: 'Conexiones', styles: { marginTop: spacing.xl } }),
        createElement('p', { text: 'Comparte tu ID de Supabase con una persona conocida y añádela aquí. Sólo las conexiones aceptadas pueden ver ghosts para amigos.', styles: { color: colors.textMuted } }),
        div({
            styles: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
            children: [
                friendInput,
                button({ text: 'Añadir ciclista', styles: { ...baseStyles.button, ...baseStyles.buttonSecondary }, events: { click: () => run(() => requestConnection(friendInput.value.trim())) } }),
            ],
        }),
        connectionsList,
    );

    async function run(action) {
        status.textContent = 'Guardando…';
        try {
            await action();
            await refresh();
        } catch (error) {
            status.textContent = error.message;
        }
    }

    async function refresh() {
        const user = await getCloudUser().catch(() => null);
        if (!user) {
            status.textContent = 'Inicia sesión desde Configuración para crear o aceptar retos.';
            list.replaceChildren();
            return;
        }
        userIdLabel.textContent = `Tu ID: ${user.id}`;
        try {
            const [challenges, connections] = await Promise.all([listChallenges(), listConnections()]);
            status.textContent = challenges.length ? `${challenges.length} retos activos` : 'Aún no tienes retos activos.';
            list.replaceChildren(...challenges.map((challenge) => challengeCard(challenge)));
            connectionsList.replaceChildren(...connections.map((connection) => div({
                styles: { ...baseStyles.card, padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' },
                children: [
                    createElement('span', { text: `${connection.status === 'accepted' ? '✓' : '…'} ${connection.requester_id.slice(0, 8)} ↔ ${connection.addressee_id.slice(0, 8)}` }),
                    ...(connection.status === 'pending' && connection.addressee_id === user.id ? [button({
                        text: 'Aceptar', styles: { ...baseStyles.button, ...baseStyles.buttonPrimary }, events: { click: () => run(() => acceptConnection(connection.requester_id)) },
                    })] : []),
                ],
            })));
        } catch (error) {
            status.textContent = error.message;
        }
    }

    refresh();
    return container;
}

function challengeCard(challenge) {
    const entries = [...(challenge.challenge_entries || [])].sort((a, b) => (b.score || 0) - (a.score || 0) || (b.max_combo || 0) - (a.max_combo || 0));
    return div({
        styles: { ...baseStyles.card, padding: '18px', border: '1px solid rgba(99,224,181,.22)' },
        children: [
            createElement('span', { text: `${challenge.visibility.toUpperCase()} · ${challenge.invite_code}`, styles: { color: colors.primary, fontSize: '10px', fontWeight: 800, letterSpacing: '1px' } }),
            createElement('h3', { text: challenge.title, styles: { margin: '8px 0' } }),
            createElement('p', { text: `${entries.length} participantes · termina ${new Date(challenge.ends_at).toLocaleDateString()}`, styles: { color: colors.textMuted, fontSize: '13px' } }),
            ...entries.slice(0, 3).map((entry, index) => createElement('p', { text: `${index + 1}. ${entry.score ?? 'Sin resultado'} pts`, styles: { margin: '5px 0', fontFamily: typography.fontMono } })),
        ],
    });
}
