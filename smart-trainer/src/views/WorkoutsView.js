/**
 * WorkoutsView - Biblioteca de entrenamientos
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { getAllPresets, getPresetsByCategory, CATEGORIES, DIFFICULTIES } from '../workouts/presets.js';

/**
 * Vista de biblioteca de entrenamientos
 */
export function WorkoutsView({ state, onSelectWorkout }) {
    const containerStyles = {
        padding: spacing.lg,
        maxWidth: '1200px',
        margin: '0 auto',
    };
    
    const headerStyles = {
        marginBottom: spacing.xl,
    };
    
    const titleStyles = {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.sm,
    };
    
    const subtitleStyles = {
        color: colors.textMuted,
        fontSize: typography.sizes.md,
    };
    
    // Estado local del filtro
    let selectedCategory = 'all';
    
    const container = div({ styles: containerStyles });
    
    // Header
    const header = div({
        styles: headerStyles,
        children: [
            createElement('h1', { text: '📚 Biblioteca de Entrenamientos', styles: titleStyles }),
            createElement('p', { 
                text: 'Selecciona un entrenamiento o crea uno personalizado', 
                styles: subtitleStyles 
            }),
        ],
    });
    container.appendChild(header);
    
    // Filtros por categoría
    const filtersStyles = {
        display: 'flex',
        gap: spacing.sm,
        marginBottom: spacing.xl,
        flexWrap: 'wrap',
    };
    
    const filterButtonStyles = (isActive) => ({
        ...baseStyles.button,
        padding: `${spacing.sm} ${spacing.md}`,
        fontSize: typography.sizes.sm,
        backgroundColor: isActive ? colors.primary : colors.surface,
        color: isActive ? colors.background : colors.text,
        border: `1px solid ${isActive ? colors.primary : colors.border}`,
    });
    
    const filters = div({ styles: filtersStyles });
    
    // Botón "Todos"
    const allBtn = button({
        styles: filterButtonStyles(selectedCategory === 'all'),
        text: '🏠 Todos',
        events: {
            click: () => renderWorkouts('all'),
        },
    });
    filters.appendChild(allBtn);
    
    // Botones de categoría
    CATEGORIES.forEach(cat => {
        const btn = button({
            styles: filterButtonStyles(selectedCategory === cat.id),
            text: `${cat.icon} ${cat.name}`,
            events: {
                click: () => renderWorkouts(cat.id),
            },
        });
        filters.appendChild(btn);
    });
    
    container.appendChild(filters);
    
    // Grid de entrenamientos
    const gridStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: spacing.lg,
    };
    
    const workoutsGrid = div({ styles: gridStyles, attrs: { id: 'workouts-grid' } });
    
    function renderWorkouts(category) {
        selectedCategory = category;
        workoutsGrid.innerHTML = '';
        
        const workouts = category === 'all' 
            ? getAllPresets()
            : getPresetsByCategory(category);
        
        workouts.forEach(workout => {
            const card = createWorkoutCard(workout, () => {
                if (onSelectWorkout) {
                    onSelectWorkout(workout);
                }
            });
            workoutsGrid.appendChild(card);
        });
        
        if (workouts.length === 0) {
            const empty = div({
                styles: {
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: spacing.xxl,
                    color: colors.textMuted,
                },
                text: 'No hay entrenamientos en esta categoría',
            });
            workoutsGrid.appendChild(empty);
        }
    }
    
    // Renderizar entrenamientos iniciales
    renderWorkouts('all');
    
    container.appendChild(workoutsGrid);
    
    return container;
}

/**
 * Tarjeta de entrenamiento
 */
function createWorkoutCard(workout, onClick) {
    const cardStyles = {
        ...baseStyles.card,
        padding: '0',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: transitions.normal,
    };
    
    const headerStyles = {
        padding: spacing.md,
        backgroundColor: colors.surfaceLight,
        borderBottom: `1px solid ${colors.border}`,
    };
    
    const titleRowStyles = {
        ...baseStyles.flexBetween,
        marginBottom: spacing.xs,
    };
    
    const titleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
    };
    
    const difficultyStyles = (difficulty) => {
        const diff = DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[1];
        return {
            padding: `2px ${spacing.sm}`,
            borderRadius: borderRadius.sm,
            backgroundColor: diff.color,
            color: colors.background,
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.semibold,
        };
    };
    
    const descStyles = {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.sm,
        display: '-webkit-box',
        WebkitLineClamp: '2',
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    };
    
    const bodyStyles = {
        padding: spacing.md,
    };
    
    const statsRowStyles = {
        display: 'flex',
        gap: spacing.lg,
        marginBottom: spacing.md,
    };
    
    const statStyles = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    };
    
    const statValueStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.text,
    };
    
    const statLabelStyles = {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
    };
    
    // Timeline mini
    const timelineStyles = {
        display: 'flex',
        height: '24px',
        gap: '1px',
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    };
    
    const card = div({ styles: cardStyles });
    
    // Header
    const header = div({
        styles: headerStyles,
        children: [
            div({
                styles: titleRowStyles,
                children: [
                    createElement('h3', { text: workout.name, styles: titleStyles }),
                    createElement('span', { 
                        text: DIFFICULTIES.find(d => d.id === workout.difficulty)?.name || 'Medio',
                        styles: difficultyStyles(workout.difficulty),
                    }),
                ],
            }),
            createElement('p', { text: workout.description, styles: descStyles }),
        ],
    });
    card.appendChild(header);
    
    // Body
    const body = div({ styles: bodyStyles });
    
    // Stats
    const statsRow = div({
        styles: statsRowStyles,
        children: [
            div({
                styles: statStyles,
                children: [
                    createElement('span', { text: workout.stats.totalDurationFormatted, styles: statValueStyles }),
                    createElement('span', { text: 'Duración', styles: statLabelStyles }),
                ],
            }),
            div({
                styles: statStyles,
                children: [
                    createElement('span', { text: String(workout.stats.tss), styles: statValueStyles }),
                    createElement('span', { text: 'TSS', styles: statLabelStyles }),
                ],
            }),
            div({
                styles: statStyles,
                children: [
                    createElement('span', { text: String(workout.stats.intensityFactor), styles: statValueStyles }),
                    createElement('span', { text: 'IF', styles: statLabelStyles }),
                ],
            }),
            div({
                styles: statStyles,
                children: [
                    createElement('span', { text: `${workout.stats.totalWork}kJ`, styles: statValueStyles }),
                    createElement('span', { text: 'Trabajo', styles: statLabelStyles }),
                ],
            }),
        ],
    });
    body.appendChild(statsRow);
    
    // Timeline mini
    const totalDuration = workout.stats.totalDuration;
    const timeline = div({ styles: timelineStyles });
    
    workout.blocks.forEach(block => {
        const widthPercent = (block.duration * block.repeat / totalDuration) * 100;
        const blockEl = div({
            styles: {
                flex: `${widthPercent} 0 0`,
                minWidth: '2px',
                backgroundColor: block.color || colors.primary,
            },
        });
        timeline.appendChild(blockEl);
    });
    body.appendChild(timeline);
    
    // Tags
    if (workout.tags && workout.tags.length > 0) {
        const tagsStyles = {
            display: 'flex',
            gap: spacing.xs,
            marginTop: spacing.md,
            flexWrap: 'wrap',
        };
        
        const tagStyles = {
            padding: `2px ${spacing.sm}`,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surfaceLight,
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
        };
        
        const tags = div({
            styles: tagsStyles,
            children: workout.tags.slice(0, 4).map(tag => 
                createElement('span', { text: `#${tag}`, styles: tagStyles })
            ),
        });
        body.appendChild(tags);
    }
    
    card.appendChild(body);
    
    // Eventos
    card.addEventListener('click', onClick);
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = `0 8px 24px rgba(0, 212, 170, 0.2)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
    });
    
    return card;
}
