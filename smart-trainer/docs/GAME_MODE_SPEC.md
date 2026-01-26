# 🎮 Modo Videojuego - Smart Trainer

## Concepto

**"Power Rush"** - Un juego minimalista de carrera infinita donde tu potencia y cadencia controlan la velocidad y acciones del ciclista.

### Filosofía de Diseño
- **Minimalista**: Gráficos vectoriales simples, colores planos
- **Motivador**: Feedback visual inmediato del esfuerzo
- **Adaptativo**: Dificultad basada en tu FTP
- **Inmersivo**: Sincronizado con datos reales del rodillo

---

## 🎯 Mecánicas de Juego

### Control Principal
| Acción | Control del Jugador |
|--------|-------------------|
| **Velocidad** | Potencia actual (más watts = más rápido) |
| **Saltar** | Sprint > 120% FTP durante 2 segundos |
| **Agacharse** | Cadencia < 60 rpm |
| **Turbo** | Mantener > 100% FTP por 10 segundos |

### Elementos del Juego

#### 1. El Ciclista (Avatar)
```
    O      ← Cabeza (círculo)
   /|\     ← Cuerpo (líneas)
   / \     ← Bicicleta simplificada
  ○   ○    ← Ruedas (círculos con rotación)
```
- Animación de pedaleo sincronizada con cadencia real
- Inclinación según esfuerzo (más inclinado = más potencia)
- Efecto de "estela" cuando va rápido

#### 2. El Camino
- Línea horizontal infinita con perspectiva simple
- Fondo degradado que cambia según la zona de potencia
- Marcadores de distancia cada 100m virtuales

#### 3. Obstáculos
| Obstáculo | Acción Requerida | Puntos |
|-----------|------------------|--------|
| 🔺 Rampa | Sprint (saltar) | +50 |
| 🔻 Túnel bajo | Agacharse (cadencia baja) | +30 |
| ⚡ Zona de potencia | Mantener watts específicos | +100 |
| 🌀 Viento en contra | Aumentar potencia 20% | +75 |
| 💨 Zona turbo | Sprint máximo | +150 |

#### 4. Coleccionables
| Item | Efecto | Visual |
|------|--------|--------|
| ⭐ Estrella | +10 puntos | Estrella amarilla |
| 💎 Diamante | x2 puntos (15s) | Rombo azul |
| ❤️ Corazón | +1 vida | Corazón rojo |
| ⚡ Rayo | Velocidad x1.5 (10s) | Rayo dorado |

#### 5. Sistema de Vidas
- 3 vidas iniciales
- Perder vida al chocar obstáculo
- Recuperar vida con coleccionables o cada 1000 puntos

---

## 🎨 Diseño Visual Minimalista

### Paleta de Colores
```javascript
const gameColors = {
    // Fondo (cambia según zona)
    bgZ1: '#1a1a2e',    // Recuperación - Azul muy oscuro
    bgZ2: '#16213e',    // Resistencia - Azul noche
    bgZ3: '#1a1a1a',    // Tempo - Negro
    bgZ4: '#2d132c',    // Umbral - Púrpura oscuro
    bgZ5: '#3d0000',    // VO2max - Rojo muy oscuro
    bgZ6: '#4a0000',    // Anaeróbico - Rojo intenso
    
    // Elementos
    road: '#333333',
    roadLine: '#555555',
    cyclist: '#00d4aa',
    obstacle: '#ff6b35',
    collectible: '#ffd700',
    ui: '#ffffff',
};
```

### Layout de Pantalla
```
┌─────────────────────────────────────────────────┐
│ ❤️❤️❤️    SCORE: 12,450    ⚡ COMBO x3         │  ← HUD Superior
├─────────────────────────────────────────────────┤
│                                                 │
│     ═══════════════════════════════════════     │  ← Horizonte
│                                                 │
│              ⭐                                 │
│         ____🔺____      💎                      │  ← Obstáculos/Items
│        /          \                             │
│   ════════════════════════════════════════      │  ← Carretera
│              🚴                                 │  ← Ciclista
│   ════════════════════════════════════════      │
│                                                 │
├─────────────────────────────────────────────────┤
│  245W │ ████████░░ │ 85rpm │ 32.5 km/h         │  ← Métricas reales
└─────────────────────────────────────────────────┘
```

---

## 🔧 Arquitectura Técnica

### Estructura de Archivos
```
src/
└── game/
    ├── GameEngine.js       # Motor principal del juego
    ├── GameRenderer.js     # Renderizado Canvas
    ├── GameState.js        # Estado del juego
    ├── entities/
    │   ├── Cyclist.js      # Avatar del jugador
    │   ├── Obstacle.js     # Obstáculos
    │   └── Collectible.js  # Items coleccionables
    ├── systems/
    │   ├── PhysicsSystem.js    # Movimiento y colisiones
    │   ├── SpawnSystem.js      # Generación de elementos
    │   └── ScoreSystem.js      # Puntuación y combos
    └── ui/
        ├── GameHUD.js      # Interfaz durante juego
        └── GameOverScreen.js # Pantalla de fin
```

### Flujo de Datos
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Rodillo   │ ──► │  GameEngine  │ ──► │  Renderer   │
│   (BLE)     │     │              │     │  (Canvas)   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
   power, rpm         game state            visuals
   speed, hr          score, lives          animations
```

### Game Loop
```javascript
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTimestamp;
    
    // 1. Leer datos del rodillo
    const bikeData = getBikeData();
    
    // 2. Actualizar física
    updateCyclistSpeed(bikeData.power);
    updateCyclistAnimation(bikeData.cadence);
    
    // 3. Generar obstáculos
    spawnSystem.update(deltaTime);
    
    // 4. Detectar colisiones
    checkCollisions();
    
    // 5. Actualizar puntuación
    scoreSystem.update(deltaTime);
    
    // 6. Renderizar
    renderer.clear();
    renderer.drawBackground(currentZone);
    renderer.drawRoad();
    renderer.drawObstacles();
    renderer.drawCollectibles();
    renderer.drawCyclist();
    renderer.drawHUD();
    
    requestAnimationFrame(gameLoop);
}
```

---

## 📊 Sistema de Puntuación

### Puntos Base
- **Distancia**: 1 punto por metro virtual
- **Tiempo**: 10 puntos por segundo en zona correcta
- **Obstáculos superados**: 30-150 puntos según tipo

### Multiplicadores
| Condición | Multiplicador |
|-----------|---------------|
| Combo 5+ obstáculos | x2 |
| Combo 10+ obstáculos | x3 |
| Combo 20+ obstáculos | x5 |
| Potencia > 100% FTP | x1.5 |
| Sin errores 1 minuto | x2 |

### Achievements
- 🏆 **Primer vuelo**: Primer salto exitoso
- 🏆 **Velocista**: Alcanzar 50 km/h virtuales
- 🏆 **Resistencia**: 10 minutos sin perder vida
- 🏆 **Power Up**: 5 minutos sobre FTP
- 🏆 **Combo Master**: Combo de 50
- 🏆 **Diamante**: 100,000 puntos en una sesión

---

## 🎮 Modos de Juego

### 1. Modo Infinito (Principal)
- Carrera sin fin
- Dificultad progresiva
- Objetivo: máxima puntuación

### 2. Modo Entrenamiento
- Obstáculos predefinidos según workout
- Sprint cuando aparece zona alta
- Recuperación en zonas bajas

### 3. Modo Desafío Diario
- Seed fija para el día
- Leaderboard local
- Misma secuencia para todos

---

## 📱 Integración con la App

### Vista del Juego
```javascript
// src/views/GameView.js
export function GameView({ state }) {
    // Integrar con datos del rodillo
    const { liveData, settings } = state;
    
    // Iniciar motor del juego
    const engine = new GameEngine({
        ftp: settings.ftp,
        onScoreUpdate: (score) => { ... },
        onGameOver: (finalScore) => { ... },
    });
    
    // Alimentar datos del rodillo al juego
    subscribe(() => {
        engine.updateBikeData(liveData);
    });
}
```

### Navegación
- Nuevo botón "🎮 Modo Juego" en TrainingView
- Alternar entre dashboard y juego
- Métricas siempre visibles en parte inferior

---

## 🚀 Fases de Desarrollo

### Fase G1: Motor Básico
- [ ] Crear GameEngine.js con loop básico
- [ ] Renderizar fondo y carretera
- [ ] Dibujar ciclista estático
- [ ] Conectar velocidad con potencia

### Fase G2: Movimiento y Animación
- [ ] Animación de pedaleo según cadencia
- [ ] Scroll infinito de carretera
- [ ] Efecto parallax en fondo
- [ ] Partículas de velocidad

### Fase G3: Obstáculos
- [ ] Sistema de generación procedural
- [ ] Colisiones básicas
- [ ] Salto (sprint detection)
- [ ] Agacharse (low cadence detection)

### Fase G4: Items y Puntuación
- [ ] Coleccionables
- [ ] Sistema de puntos
- [ ] Combos
- [ ] HUD completo

### Fase G5: Polish
- [ ] Efectos visuales (glow, shake)
- [ ] Sonidos opcionales
- [ ] Achievements
- [ ] Game Over y restart

---

## 🎨 Assets Visuales (SVG/Canvas)

### Ciclista (Vectorial)
```javascript
function drawCyclist(ctx, x, y, pedalAngle, lean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean * 0.1);
    
    // Ruedas
    ctx.strokeStyle = '#00d4aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-15, 10, 12, 0, Math.PI * 2);  // Rueda trasera
    ctx.arc(15, 10, 12, 0, Math.PI * 2);   // Rueda delantera
    ctx.stroke();
    
    // Cuadro
    ctx.beginPath();
    ctx.moveTo(-15, 10);
    ctx.lineTo(0, -5);
    ctx.lineTo(15, 10);
    ctx.lineTo(-15, 10);
    ctx.stroke();
    
    // Cuerpo
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-5, -20);  // Torso
    ctx.stroke();
    
    // Cabeza
    ctx.beginPath();
    ctx.arc(-5, -25, 5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Piernas (animadas)
    const legOffset = Math.sin(pedalAngle) * 8;
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.lineTo(-15 + legOffset, 10);
    ctx.moveTo(-5, -10);
    ctx.lineTo(-15 - legOffset, 10);
    ctx.stroke();
    
    ctx.restore();
}
```

---

*Documento creado: 26 Enero 2026*
