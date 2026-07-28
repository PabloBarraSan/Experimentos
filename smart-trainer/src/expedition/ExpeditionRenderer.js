const THEMES = {
    warmup: { sky: ['#ff9a62', '#39245f'], land: '#182f35', accent: '#ffbd59' },
    cooldown: { sky: ['#664f9f', '#101832'], land: '#14272b', accent: '#8ad8ff' },
    rest: { sky: ['#59b7c8', '#16334f'], land: '#173f35', accent: '#72e6c1' },
    interval: { sky: ['#ff7043', '#34122b'], land: '#321e2a', accent: '#ffcc33' },
    ramp: { sky: ['#5f77b7', '#171c3b'], land: '#26334a', accent: '#ef9a4f' },
    steady: { sky: ['#48a9a6', '#142f4c'], land: '#173e35', accent: '#7ce2a1' },
};

export function createExpeditionRenderer(canvas) {
    const context = canvas.getContext('2d');
    let frameId = null;
    let lastTime = performance.now();
    let distance = 0;
    let state = {
        flow: 0,
        power: 0,
        targetPower: 0,
        blockType: 'steady',
        ghostProgress: 0.72,
        paused: true,
    };

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(rect.width * ratio));
        canvas.height = Math.max(1, Math.floor(rect.height * ratio));
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawMountain(x, baseY, width, height, color) {
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(x - width / 2, baseY);
        context.lineTo(x, baseY - height);
        context.lineTo(x + width / 2, baseY);
        context.closePath();
        context.fill();
    }

    function drawRider(x, y, scale, color, glow = 0) {
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        if (glow > 0) {
            context.shadowColor = color;
            context.shadowBlur = 18 * glow;
        }
        context.strokeStyle = color;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(-9, 8, 8, 0, Math.PI * 2);
        context.arc(9, 8, 8, 0, Math.PI * 2);
        context.moveTo(-9, 8);
        context.lineTo(0, -2);
        context.lineTo(9, 8);
        context.moveTo(0, -2);
        context.lineTo(5, -15);
        context.lineTo(13, -9);
        context.moveTo(5, -15);
        context.lineTo(-4, -10);
        context.stroke();
        context.fillStyle = color;
        context.beginPath();
        context.arc(6, -21, 5, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    function draw(timestamp) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const delta = Math.min(0.05, (timestamp - lastTime) / 1000);
        lastTime = timestamp;
        if (!state.paused) distance += delta * (24 + state.flow * 18);

        const theme = THEMES[state.blockType] || THEMES.steady;
        const horizon = height * 0.47;
        const gradient = context.createLinearGradient(0, 0, 0, horizon);
        gradient.addColorStop(0, theme.sky[1]);
        gradient.addColorStop(1, theme.sky[0]);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, horizon);

        const sunX = width * 0.76;
        const sunY = horizon * 0.36;
        const sunGlow = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
        sunGlow.addColorStop(0, `${theme.accent}ee`);
        sunGlow.addColorStop(1, `${theme.accent}00`);
        context.fillStyle = sunGlow;
        context.fillRect(sunX - 80, sunY - 80, 160, 160);

        drawMountain(width * 0.18, horizon + 8, width * 0.55, height * 0.28, '#273956');
        drawMountain(width * 0.58, horizon + 8, width * 0.68, height * 0.34, '#1c3047');
        drawMountain(width * 0.92, horizon + 8, width * 0.52, height * 0.22, '#294054');
        context.fillStyle = theme.land;
        context.fillRect(0, horizon, width, height - horizon);

        // Carretera con perspectiva.
        context.fillStyle = '#15171d';
        context.beginPath();
        context.moveTo(width * 0.46, horizon);
        context.lineTo(width * 0.54, horizon);
        context.lineTo(width * 0.92, height);
        context.lineTo(width * 0.08, height);
        context.closePath();
        context.fill();

        context.strokeStyle = `${theme.accent}55`;
        context.lineWidth = 2;
        for (let i = 0; i < 18; i++) {
            const phase = (i / 18 + (distance % 1)) % 1;
            const y = horizon + Math.pow(phase, 2) * (height - horizon);
            const spread = Math.pow(phase, 1.7) * width * 0.38;
            context.beginPath();
            context.moveTo(width / 2 - spread, y);
            context.lineTo(width / 2 + spread, y);
            context.stroke();
        }

        // Partículas de flow que se intensifican al cumplir el objetivo.
        context.fillStyle = `${theme.accent}${Math.round(40 + state.flow * 120).toString(16).padStart(2, '0')}`;
        for (let i = 0; i < Math.round(4 + state.flow * 16); i++) {
            const seed = (i * 97.3 + distance * 52) % 1000;
            const x = (seed * 1.73) % width;
            const y = horizon + ((seed * 3.17) % Math.max(1, height - horizon));
            context.fillRect(x, y, 2 + state.flow * 2, 2 + state.flow * 2);
        }

        const ghostY = horizon + (height - horizon) * (0.28 + (1 - state.ghostProgress) * 0.18);
        drawRider(width / 2 + 24, ghostY, 0.62, '#9bd7ff', 0.5);
        drawRider(width / 2, height * 0.80, 1.08, theme.accent, state.flow);

        if (state.paused) {
            context.fillStyle = 'rgba(7, 9, 14, 0.52)';
            context.fillRect(0, 0, width, height);
        }
        frameId = requestAnimationFrame(draw);
    }

    function update(next) {
        state = { ...state, ...next };
    }

    resize();
    window.addEventListener('resize', resize);
    frameId = requestAnimationFrame(draw);

    return {
        update,
        resize,
        destroy() {
            if (frameId) cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        },
    };
}
