/**
 * HistoryView - Vista del historial de sesiones
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { getAllSessions, getTotalStats } from '../storage/sessions.js';
import { SessionDetailBottomSheet } from '../components/SessionDetailBottomSheet.js';

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Vista del historial de entrenamientos.
 * @param {{ state: object, onBack: () => void }} opts
 */
export async function HistoryView({ state, onBack }) {
    let sessions = (await getAllSessions()).filter((s) => s.status === 'completed' && s.metrics);
    let totalStats = await getTotalStats();

    const containerStyles = {
        padding: spacing.lg,
        maxWidth: '600px',
        margin: '0 auto',
        flex: 1,
    };

    const container = div({ styles: containerStyles, attrs: { 'data-view': 'history' } });

    const backRow = div({
        styles: {
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xl,
        },
        children: [
            button({
                styles: {
                    ...baseStyles.button,
                    padding: `${spacing.sm} ${spacing.md}`,
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    fontSize: typography.sizes.sm,
                },
                children: [icon('chevronLeft', 20, colors.textMuted), createElement('span', { text: 'Inicio' })],
                events: { click: onBack },
            }),
        ],
    });
    container.appendChild(backRow);

    const contentWrapper = div({ styles: { flex: 1 } });
    container.appendChild(contentWrapper);

    function buildStatsStrip(stats) {
        const strip = div({
            styles: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: spacing.md,
                marginBottom: spacing.xl,
                padding: spacing.md,
                backgroundColor: colors.surfaceLight,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.border}`,
            },
        });
        const items = [
            { value: stats.totalSessions, label: 'Sesiones', icon: 'activity' },
            { value: stats.totalDurationFormatted || '0h', label: 'Tiempo', icon: 'clock' },
            { value: stats.totalTSS, label: 'TSS', icon: 'zap' },
            { value: `${stats.avgPower}W`, label: 'Pot. media', icon: 'gauge' },
            { value: stats.totalCalories.toLocaleString(), label: 'Cal', icon: 'flame' },
        ];
        items.forEach((item) => {
            const el = div({
                styles: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                },
                children: [
                    icon(item.icon, 18, colors.primary),
                    div({
                        styles: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
                        children: [
                            createElement('span', {
                                text: String(item.value),
                                styles: {
                                    fontSize: typography.sizes.md,
                                    fontWeight: typography.weights.bold,
                                    color: colors.text,
                                    fontFamily: typography.fontMono,
                                },
                            }),
                            createElement('span', {
                                text: item.label,
                                styles: { fontSize: typography.sizes.xs, color: colors.textMuted },
                            }),
                        ],
                    }),
                ],
            });
            strip.appendChild(el);
        });
        return strip;
    }

    function buildSessionCard(session, onView) {
        const date = new Date(session.date);
        const day = date.getDate();
        const month = date.toLocaleString('es', { month: 'short' });
        const time = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        const card = div({
            styles: {
                ...baseStyles.card,
                padding: spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                cursor: 'pointer',
                transition: transitions.fast,
            },
        });
        const dateBloc = div({
            styles: {
                minWidth: '72px',
                textAlign: 'center',
                padding: spacing.sm,
                backgroundColor: colors.surfaceLight,
                borderRadius: borderRadius.md,
            },
            children: [
                createElement('div', {
                    text: String(day),
                    styles: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text },
                }),
                createElement('div', {
                    text: month,
                    styles: { fontSize: typography.sizes.xs, color: colors.textMuted, textTransform: 'uppercase' },
                }),
            ],
        });
        const info = div({
            styles: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs },
            children: [
                createElement('div', {
                    text: session.workoutName || 'Entrenamiento Libre',
                    styles: {
                        fontSize: typography.sizes.md,
                        fontWeight: typography.weights.semibold,
                        color: colors.text,
                    },
                }),
                createElement('div', {
                    text: [
                        formatDuration(session.duration),
                        session.metrics?.power?.avg != null && `${session.metrics.power.avg}W`,
                        session.metrics?.intensity?.tss != null && `TSS ${session.metrics.intensity.tss}`,
                    ]
                        .filter(Boolean)
                        .join(' · '),
                    styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                }),
                createElement('span', {
                    text: `${time}`,
                    styles: { fontSize: typography.sizes.xs, color: colors.textDark },
                }),
            ],
        });
        const chev = div({
            styles: { flexShrink: 0 },
            children: [icon('chevronRight', 20, colors.textMuted)],
        });
        card.appendChild(dateBloc);
        card.appendChild(info);
        card.appendChild(chev);
        card.addEventListener('mouseenter', () => { card.style.backgroundColor = colors.surfaceHover; });
        card.addEventListener('mouseleave', () => { card.style.backgroundColor = colors.surface; });
        card.addEventListener('click', () => onView(session));
        return card;
    }

    function buildContent() {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(buildStatsStrip(totalStats));
        const sectionTitle = createElement('h2', {
            text: 'Sesiones',
            styles: {
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.semibold,
                color: colors.text,
                marginBottom: spacing.md,
            },
        });
        fragment.appendChild(sectionTitle);

        if (sessions.length === 0) {
            const empty = div({
                styles: {
                    ...baseStyles.card,
                    padding: spacing.xxl,
                    textAlign: 'center',
                    color: colors.textMuted,
                },
                children: [
                    icon('activity', 48, colors.border),
                    createElement('p', {
                        text: 'No hay entrenamientos guardados',
                        styles: { marginTop: spacing.md, fontSize: typography.sizes.md },
                    }),
                    createElement('p', {
                        text: 'Completa un entrenamiento y guárdalo para verlo aquí',
                        styles: { marginTop: spacing.sm, fontSize: typography.sizes.sm },
                    }),
                ],
            });
            fragment.appendChild(empty);
        } else {
            const list = div({
                styles: { display: 'flex', flexDirection: 'column', gap: spacing.md },
            });
            sessions.forEach((s) => {
                list.appendChild(
                    buildSessionCard(s, (session) => {
                        const sheet = SessionDetailBottomSheet({
                            session,
                            onClose: () => {},
                            onDeleted: () => {
                                refresh();
                            },
                        });
                        document.body.appendChild(sheet);
                    })
                );
            });
            fragment.appendChild(list);
        }
        return fragment;
    }

    async function refresh() {
        sessions = (await getAllSessions()).filter((s) => s.status === 'completed' && s.metrics);
        totalStats = await getTotalStats();
        const frag = buildContent();
        contentWrapper.replaceChildren();
        contentWrapper.appendChild(frag);
    }

    contentWrapper.appendChild(buildContent());
    return container;
}
