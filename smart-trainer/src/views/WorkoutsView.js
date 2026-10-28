/**
 * WorkoutsView - Biblioteca de entrenamientos
 * Smart Trainer Controller
 */

import './home.css';
import './workouts.css';
import { createElement, div, button, icon, formatTime } from '../utils/dom.js';
import { getAllPresets, getPresetsByCategory, CATEGORIES, DIFFICULTIES } from '../workouts/presets.js';
import { createWorkoutProfile } from '../components/WorkoutProfile.js';
import { loadSettings } from '../storage/settings.js';

const sortMissionsFirst = (workouts) => workouts
    .sort((a, b) => Number(Boolean(b.mission)) - Number(Boolean(a.mission)));

export function WorkoutsView({ onBack, onSelectWorkout }) {
    let selectedCategory = 'all';

    const wrapper = div({ attrs: { class: 'hp', 'data-view': 'workouts-library' } });
    const shell = div({ attrs: { class: 'hp-shell' } });
    wrapper.appendChild(shell);

    shell.appendChild(div({
        attrs: { class: 'wk-head' },
        children: [
            div({ children: [button({
                attrs: { type: 'button', class: 'hp-btn hp-back', 'aria-label': 'Volver' },
                children: [icon('chevronLeft', 16, 'rgba(238,243,239,.8)'), createElement('span', { text: 'Volver' })],
                events: { click: onBack },
            })] }),
            createElement('h1', { text: 'Rutas', attrs: { class: 'wk-title' } }),
            createElement('p', {
                text: 'Elige un plan estructurado. La expedición visual y el tiempo de sesión se configuran por separado.',
                attrs: { class: 'wk-sub' },
            }),
        ],
    }));

    // --- Filtros con recuento ---
    const options = [{ id: 'all', name: 'Todos', count: getAllPresets().length }]
        .concat(CATEGORIES.map((cat) => ({ id: cat.id, name: cat.name, count: getPresetsByCategory(cat.id).length })))
        .filter((option) => option.id === 'all' || option.count > 0);
    const filters = div({ attrs: { class: 'wk-filters', role: 'group', 'aria-label': 'Filtrar por tipo' } });
    const chips = options.map((option) => button({
        attrs: { type: 'button', class: 'wk-chip', 'aria-pressed': 'false', 'data-category': option.id },
        children: [createElement('span', { text: option.name }), createElement('small', { text: String(option.count) })],
        events: { click: () => renderWorkouts(option.id) },
    }));
    chips.forEach((chip) => filters.appendChild(chip));
    shell.appendChild(filters);

    const workoutsGrid = div({ attrs: { class: 'wk-grid', id: 'workouts-grid' } });

    function renderWorkouts(category) {
        selectedCategory = category;
        chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.category === selectedCategory)));
        workoutsGrid.replaceChildren();

        const workouts = sortMissionsFirst([...(category === 'all' ? getAllPresets() : getPresetsByCategory(category))]);
        workouts.forEach((workout) => {
            workoutsGrid.appendChild(createWorkoutCard(workout, () => onSelectWorkout?.(workout)));
        });
        if (!workouts.length) {
            workoutsGrid.appendChild(createElement('p', { text: 'No hay entrenamientos en esta categoría.', attrs: { class: 'wk-empty' } }));
        }
    }

    renderWorkouts('all');
    shell.appendChild(workoutsGrid);
    return wrapper;
}

function createWorkoutCard(workout, onClick) {
    const isMission = Boolean(workout.mission);
    const difficulty = DIFFICULTIES.find((item) => item.id === workout.difficulty) || DIFFICULTIES[1];
    const stat = (value, label) => div({ children: [createElement('strong', { text: value }), createElement('span', { text: label })] });

    const level = createElement('span', {
        attrs: { class: 'wk-level' },
        children: [createElement('i'), createElement('span', { text: difficulty.name })],
    });
    level.firstChild.style.setProperty('--level', difficulty.color);

    const card = div({
        attrs: {
            class: `wk-card${isMission ? ' is-mission' : ''}`,
            role: 'button',
            tabindex: '0',
            'aria-label': `Iniciar ${workout.name}`,
        },
        children: [
            div({
                attrs: { class: 'wk-card-top' },
                children: [
                    div({ children: [
                        // La duración ya se muestra abajo: no se repite en el título.
                        createElement('h3', { text: workout.name.replace(/\s·\s\d+\s?min$/, '') }),
                        isMission ? createElement('span', { text: `${workout.mission.title} · versión ${workout.mission.version}`, attrs: { class: 'wk-kind' } }) : null,
                    ] }),
                    level,
                ],
            }),
            createElement('p', { text: workout.description, attrs: { class: 'wk-desc' } }),
            div({
                attrs: { class: 'wk-stats' },
                children: [
                    stat(formatTime(workout.stats.totalDuration), 'Duración'),
                    stat(String(workout.stats.tss), 'Carga'),
                    stat(String(workout.stats.intensityFactor), 'Intensidad'),
                ],
            }),
            createWorkoutProfile(workout, { height: 72, ftp: loadSettings().ftp }),
            workout.tags?.length
                ? createElement('p', { text: workout.tags.slice(0, 4).map((tag) => `#${tag}`).join('  '), attrs: { class: 'wk-tags' } })
                : null,
        ],
    });

    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    });
    return card;
}
