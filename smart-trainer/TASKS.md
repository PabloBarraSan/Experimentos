# 📋 Tareas de Desarrollo - Smart Trainer Controller

## Convenciones
- `[ ]` - Pendiente
- `[x]` - Completado
- `[~]` - En progreso
- `[-]` - Cancelado/Bloqueado

---

## 🏗️ FASE 1: MVP - Conexión y Control Básico

### 1.1 Setup Inicial del Proyecto
- [x] **T1.1.1** Crear estructura de carpetas según PRD
- [x] **T1.1.2** Crear `index.html` con estructura base
- [x] **T1.1.3** Crear `src/app.js` - punto de entrada principal
- [x] **T1.1.4** Implementar sistema de estilos (objeto JS) → `src/utils/theme.js`
- [x] **T1.1.5** Crear componente base/utilidades de renderizado → `src/utils/dom.js`

### 1.2 Módulo Bluetooth - Scanner
- [x] **T1.2.1** Crear `src/bluetooth/scanner.js`
  - Función `checkBluetoothSupport()` - verificar compatibilidad
  - Función `scanForDevices()` - escanear dispositivos FTMS
  - Función `connectToDevice(device)` - establecer conexión GATT
  - Manejo de errores de conexión
- [x] **T1.2.2** Implementar reconexión automática
- [x] **T1.2.3** Gestionar estado de conexión (conectado/desconectado/conectando)
- [x] **T1.2.4** Evento de desconexión con opción de reconectar

### 1.3 Módulo Bluetooth - Parser FTMS
- [x] **T1.3.1** Crear `src/bluetooth/ftms.js`
  - Constantes UUID de servicios y características
  - Función `parseIndoorBikeData(dataView)` - parsear datos
  - Función `parseFitnessMachineFeature(dataView)` - capacidades
  - Función `parseFitnessMachineStatus(dataView)` - estado
- [x] **T1.3.2** Manejar todos los campos opcionales según flags
- [x] **T1.3.3** Normalizar unidades (km/h, rpm, watts, etc.)
- [ ] **T1.3.4** Tests unitarios del parser (datos simulados)

### 1.4 Módulo Bluetooth - Comandos
- [x] **T1.4.1** Crear `src/bluetooth/commands.js`
  - Función `requestControl()` - solicitar control
  - Función `setTargetResistance(level)` - 0-100%
  - Función `setTargetPower(watts)` - modo ERG
  - Función `startTraining()` / `stopTraining()`
  - Función `reset()` - reiniciar métricas
- [x] **T1.4.2** Implementar cola de comandos (evitar colisiones)
- [x] **T1.4.3** Verificar respuesta del Control Point
- [x] **T1.4.4** Timeout y reintentos en comandos fallidos

### 1.5 Componentes UI - Dashboard
- [x] **T1.5.1** Crear `src/components/MetricCard.js`
  - Props: label, value, unit, icon, color
  - Animación suave de cambio de valor
  - Tamaño responsivo
- [x] **T1.5.2** Crear `src/components/PowerGauge.js`
  - Indicador circular o barra de potencia
  - Colores por zona (configurable)
  - Valor numérico central
- [x] **T1.5.3** Crear `src/components/ResistanceSlider.js`
  - Slider 0-100%
  - Feedback táctil/visual
  - Debounce para evitar spam de comandos
- [x] **T1.5.4** Crear `src/components/ConnectionStatus.js` (integrado en header de app.js)
  - Estados: desconectado, buscando, conectando, conectado
  - Nombre del dispositivo cuando conectado
  - Botón conectar/desconectar

### 1.6 Vista Principal
- [x] **T1.6.1** Crear `src/views/HomeView.js`
  - Botón grande "Conectar Rodillo"
  - Instrucciones de uso
  - Mensaje de navegador no compatible
- [x] **T1.6.2** Crear `src/views/TrainingView.js`
  - Layout con métricas principales (potencia, cadencia, velocidad)
  - Control de resistencia
  - Métricas secundarias (tiempo, distancia, calorías)
  - Botones de control (pausar, finalizar)
- [x] **T1.6.3** Implementar navegación entre vistas
- [ ] **T1.6.4** Transiciones suaves entre vistas

### 1.7 Tema y Estilos
- [x] **T1.7.1** Crear `src/utils/theme.js` con paleta de colores
- [x] **T1.7.2** Estilos base (reset, tipografía, spacing)
- [x] **T1.7.3** Implementar tema oscuro completo
- [x] **T1.7.4** Diseño responsive (mobile-first)
- [x] **T1.7.5** Estados hover/active/focus accesibles

---

## 📊 FASE 2: Entrenamientos Estructurados

### 2.1 Zonas de Entrenamiento
- [x] **T2.1.1** Crear `src/storage/settings.js`
  - Guardar/cargar FTP del usuario
  - Guardar preferencias (unidades, zonas personalizadas)
- [x] **T2.1.2** Implementar cálculo automático de zonas
  - Z1: Recuperación (< 55% FTP)
  - Z2: Resistencia (56-75% FTP)
  - Z3: Tempo (76-90% FTP)
  - Z4: Umbral (91-105% FTP)
  - Z5: VO2max (106-120% FTP)
  - Z6: Anaeróbico (121-150% FTP)
  - Z7: Neuromuscular (> 150% FTP)
- [x] **T2.1.3** Componente visual de zona actual (integrado en TrainingView y theme.js)
- [x] **T2.1.4** Vista de configuración de FTP y zonas → `src/views/SettingsView.js`

### 2.2 Modelo de Entrenamientos
- [x] **T2.2.1** Crear `src/workouts/model.js`
  - Estructura de datos para entrenamientos
  - Tipos de bloques (warmup, interval, cooldown, rest, ramp, steady, free)
  - Targets: potencia absoluta, % FTP, cadencia, resistencia
- [x] **T2.2.2** Crear `src/workouts/presets.js`
  - "FTP Test 20min", "Ramp Test"
  - "Sweet Spot 2x20", "Threshold 4x8"
  - "VO2max Intervals 5x5", "Tabata"
  - "Endurance 60/90min", "Pyramid"
  - "Recovery Spin"
- [x] **T2.2.3** Validación de estructura de entrenamientos

### 2.3 Parser de Archivos
- [ ] **T2.3.1** Crear `src/workouts/parser.js` (pendiente)
  - Parsear archivos .zwo (Zwift XML)
  - Parsear archivos .erg (texto plano)
  - Parsear archivos .mrc (texto plano)
- [ ] **T2.3.2** Convertir a formato interno unificado
- [ ] **T2.3.3** Manejo de errores de parsing
- [ ] **T2.3.4** UI para importar archivos (drag & drop)

### 2.4 Reproductor de Entrenamientos
- [x] **T2.4.1** Crear `src/components/WorkoutPlayer.js`
  - Visualización de bloques (timeline)
  - Indicador de posición actual
  - Tiempo restante del bloque / total
- [x] **T2.4.2** Lógica de ejecución del entrenamiento
  - Timer preciso (requestAnimationFrame)
  - Cambio automático de bloques
  - Envío de comandos de resistencia/potencia
- [x] **T2.4.3** Modo ERG vs Modo Resistencia
  - ERG: mantener potencia constante
  - Resistencia: ajustar nivel fijo
- [ ] **T2.4.4** Alertas de cambio de bloque (pendiente mejoras)
  - Countdown 3-2-1
  - Sonido opcional
  - Cambio de color en pantalla

### 2.5 Vista de Biblioteca
- [x] **T2.5.1** Crear `src/views/WorkoutsView.js`
  - Lista de entrenamientos disponibles
  - Filtros por categoría
  - Preview del entrenamiento seleccionado (timeline, stats)
- [ ] **T2.5.2** Crear `src/workouts/builder.js` (pendiente)
  - Interfaz para crear entrenamientos personalizados
  - Añadir/editar/eliminar bloques
  - Guardar en localStorage/IndexedDB

---

## 💾 FASE 3: Análisis y Persistencia

### 3.1 Grabación de Sesiones
- [x] **T3.1.1** Crear `src/storage/sessions.js`
  - Estructura de datos para sesiones
  - Array de puntos: {timestamp, power, cadence, speed, hr, resistance}
  - Metadata: fecha, duración, workout usado
- [x] **T3.1.2** Implementar grabación en tiempo real
  - Intervalo de 1 segundo
  - Buffer en memoria durante sesión
- [x] **T3.1.3** Guardar sesión al finalizar (IndexedDB)
- [x] **T3.1.4** Opción de descartar sesión

### 3.2 Cálculos de Métricas Avanzadas
- [x] **T3.2.1** Crear `src/utils/calculations.js`
  - `calculateNP(powerArray)` - Potencia Normalizada
  - `calculateTSS(np, duration, ftp)` - Training Stress Score
  - `calculateIF(np, ftp)` - Intensity Factor
  - `calculateVI(np, avgPower)` - Variability Index
  - `calculateKilojoules(powerArray)` - Trabajo total
  - `calculatePowerCurve()` - Curva de potencia
  - `calculateTimeInZones()` - Tiempo en zonas
- [x] **T3.2.2** Mostrar métricas al finalizar sesión
- [ ] **T3.2.3** Recalcular al cambiar FTP

### 3.3 Exportación
- [x] **T3.3.1** Exportadores en `src/storage/sessions.js`
  - Exportar a .fit (formato JSON compatible)
  - Exportar a .tcx (XML completo)
  - Exportar a .csv (simple)
- [x] **T3.3.2** Botón de descarga en detalle de sesión
- [ ] **T3.3.3** Exportar múltiples sesiones como zip

### 3.4 Historial de Sesiones
- [x] **T3.4.1** Crear `src/views/HistoryView.js`
  - Lista de sesiones pasadas
  - Ordenar por fecha (más reciente primero)
  - Resumen: fecha, duración, potencia media, TSS
- [x] **T3.4.2** Vista de detalle de sesión (en tarjeta)
  - Métricas principales
  - Exportación
  - Opción de eliminar
- [x] **T3.4.3** Estadísticas acumuladas
  - Total de sesiones
  - Tiempo total de entrenamiento
  - TSS total, calorías, distancia

### 3.5 Gráficos
- [ ] **T3.5.1** Crear `src/utils/charts.js`
  - Gráfico de líneas (potencia en tiempo real)
  - Gráfico de áreas (zonas de potencia)
  - Implementar con Canvas API nativo
- [ ] **T3.5.2** Gráfico en tiempo real durante entrenamiento
  - Ventana deslizante (últimos 5 minutos)
  - Actualización eficiente (60fps)
- [ ] **T3.5.3** Gráfico completo post-sesión
  - Zoom/pan interactivo
  - Overlay de zonas

---

## 🚀 FASE 4: Características Avanzadas

### 4.1 Sensores Adicionales
- [ ] **T4.1.1** Soporte para sensor HR (Heart Rate)
  - Escanear servicios `0x180D`
  - Parsear Heart Rate Measurement `0x2A37`
  - Mostrar BPM en dashboard
- [ ] **T4.1.2** Soporte para sensor de cadencia externo
  - CSC Service `0x1816`
  - Parsear datos de cadencia
  - Priorizar sobre cadencia del rodillo
- [ ] **T4.1.3** Gestión de múltiples dispositivos conectados
- [ ] **T4.1.4** Configuración de prioridad de sensores

### 4.2 PWA Completa
- [x] **T4.2.1** Crear `manifest.json`
  - Nombre, iconos, colores
  - Display: standalone
  - Shortcuts a funciones principales
- [x] **T4.2.2** Crear `sw.js` (Service Worker)
  - Cachear assets estáticos
  - Estrategia cache-first con stale-while-revalidate
  - Soporte offline
- [x] **T4.2.3** Prompt de instalación (detectado en index.html)
- [x] **T4.2.4** Icono para home screen (SVG inline)
- [ ] **T4.2.5** Splash screen

### 4.3 Simulación de Rutas GPX
- [ ] **T4.3.1** Crear `src/workouts/gpxParser.js`
  - Parsear archivos GPX
  - Extraer puntos con elevación
  - Calcular pendientes por segmento
- [ ] **T4.3.2** Modo simulación
  - Ajustar resistencia según pendiente
  - Fórmula: resistencia = f(pendiente, peso, potencia)
- [ ] **T4.3.3** Visualización del perfil de ruta
  - Gráfico de elevación
  - Posición actual en la ruta
  - Distancia restante

### 4.4 Mejoras de UX
- [ ] **T4.4.1** Modo pantalla completa (F11 / fullscreen API)
- [ ] **T4.4.2** Atajos de teclado
  - Espacio: pausar/reanudar
  - +/-: ajustar resistencia
  - R: reset
- [ ] **T4.4.3** Vibración en alertas (móvil)
- [ ] **T4.4.4** Sonidos opcionales
- [ ] **T4.4.5** "Keep screen awake" (Wake Lock API)

---

## 🎮 FASE 5: Modo Videojuego "Power Rush"

> Documentación completa en: `docs/GAME_MODE_SPEC.md`

### 5.1 Motor del Juego (Game Engine)
- [x] **T5.1.1** Crear `src/game/GameEngine.js`
  - Game loop con requestAnimationFrame
  - Integración con datos del rodillo
  - Sistema de estados (menu, playing, paused, gameover)
- [x] **T5.1.2** Crear `src/game/GameState.js`
  - Estado global del juego
  - Puntuación, vidas, combos
  - Posición y velocidad del mundo
- [x] **T5.1.3** Crear `src/game/GameRenderer.js`
  - Renderizado Canvas 2D
  - Capas: fondo, carretera, entidades, HUD
  - Menú, pausa, game over screens

### 5.2 Entidades del Juego
- [x] **T5.2.1** Crear `src/game/entities/Cyclist.js`
  - Avatar del jugador (gráfico vectorial)
  - Animación de pedaleo sincronizada con cadencia
  - Estados: normal, saltando, agachado, turbo
  - Efecto de inclinación según potencia
- [x] **T5.2.2** Crear `src/game/entities/Obstacle.js`
  - Tipos: rampa, túnel, zona de potencia, viento
  - Hitbox para colisiones
  - Renderizado personalizado por tipo
- [x] **T5.2.3** Crear `src/game/entities/Collectible.js`
  - Tipos: estrella, diamante, corazón, rayo
  - Efecto de rotación/brillo
  - Sistema de partículas al recoger

### 5.3 Sistemas del Juego
- [x] **T5.3.1** Crear `src/game/systems/PhysicsSystem.js`
  - Velocidad basada en potencia real
  - Detección de colisiones AABB
  - Salto: detectar sprint > 120% FTP por 2s
  - Agacharse: detectar cadencia < 60 rpm
- [x] **T5.3.2** Crear `src/game/systems/SpawnSystem.js`
  - Generación procedural de obstáculos
  - Dificultad progresiva (más frecuente con el tiempo)
  - Patrones de obstáculos evitables
  - Balance de coleccionables
- [x] **T5.3.3** Crear `src/game/systems/ScoreSystem.js`
  - Puntos por distancia, obstáculos, items
  - Sistema de combos
  - Multiplicadores por potencia alta
  - Achievements

### 5.4 Interfaz del Juego
- [x] **T5.4.1** HUD integrado en GameRenderer
  - Puntuación con animación
  - Indicador de vidas (corazones)
  - Barra de combo/multiplicador
  - Métricas reales del rodillo (abajo)
- [x] **T5.4.2** GameOver screen en GameRenderer
  - Puntuación final
  - Estadísticas de la partida
  - Nuevo récord highlight
  - Sprint para reintentar
- [x] **T5.4.3** Menu screen en GameRenderer
  - High score
  - Controles explicados
  - Auto-start al pedalear

### 5.5 Gráficos Minimalistas
- [x] **T5.5.1** Diseñar sprite del ciclista (vectorial Canvas)
  - Cuerpo con líneas simples
  - Ruedas con radios animados
  - Efecto de estela en modo turbo
- [x] **T5.5.2** Diseñar carretera infinita
  - Scroll horizontal continuo
  - Líneas discontinuas animadas
  - Marcadores de distancia en km
- [x] **T5.5.3** Diseñar obstáculos y coleccionables
  - Rampa (triángulo), túnel, zonas de potencia, viento
  - Estrella, diamante, corazón, rayo
  - Efectos glow y rotación

### 5.6 Integración y Vista
- [x] **T5.6.1** Crear `src/views/GameView.js`
  - Canvas a pantalla completa
  - Integración con liveData del rodillo
  - Botón para salir
- [x] **T5.6.2** Componente GameModeButton
  - Botón estilizado "🎮 Modo Juego"
  - Listo para integrar en TrainingView
- [x] **T5.6.3** Guardar mejores puntuaciones
  - localStorage para high scores
  - Achievements persistentes

### 5.7 Polish y Efectos
- [x] **T5.7.1** Efectos visuales
  - Screen shake al chocar
  - Flash al recoger items / colisiones
  - Glow en zona turbo y coleccionables
  - Partículas al recoger items
- [ ] **T5.7.2** Feedback háptico (pendiente)
  - Vibración al chocar (móvil)
  - Vibración al saltar
- [ ] **T5.7.3** Sonidos (pendiente)
  - Efecto de recoger item
  - Efecto de salto
  - Efecto de colisión

---

## 🧪 Testing y QA

### Tests Unitarios
- [ ] **TQ.1** Tests del parser FTMS
- [ ] **TQ.2** Tests de cálculos (NP, TSS, etc.)
- [ ] **TQ.3** Tests de parsers de workout (.zwo, .erg)

### Tests de Integración
- [ ] **TQ.4** Simular dispositivo BLE con nRF Connect
- [ ] **TQ.5** Test de conexión/reconexión
- [ ] **TQ.6** Test de grabación de sesión completa

### Tests en Dispositivo Real
- [ ] **TQ.7** Probar con Decathlon D100 real
- [ ] **TQ.8** Documentar quirks/particularidades
- [ ] **TQ.9** Probar en Android Chrome
- [ ] **TQ.10** Probar en Windows Chrome

---

## 📚 Documentación

- [ ] **DOC.1** README.md con instrucciones de uso
- [ ] **DOC.2** Documentar API de comandos FTMS descubiertos
- [ ] **DOC.3** Guía de contribución
- [ ] **DOC.4** Troubleshooting común

---

## 🐛 Bugs Conocidos / Por Investigar

*(Sección para documentar issues durante el desarrollo)*

---

## 📝 Notas de Desarrollo

### Prioridades MVP
1. Conexión Bluetooth funcional
2. Lectura de datos en tiempo real
3. Control de resistencia
4. UI básica pero usable

### Decisiones Técnicas
- **Sin frameworks JS** - Vanilla JS para máximo rendimiento
- **Sin CSS frameworks** - Estilos como objetos JS
- **IndexedDB** para persistencia - No localStorage para datos grandes
- **Canvas** para gráficos - No librerías externas

---

*Última actualización: 26 Enero 2026*

---

## ✅ Resumen de Progreso

### Fase 1: MVP - ✅ COMPLETADA
- Setup inicial, Bluetooth (scanner, FTMS, comandos), UI completa

### Fase 2: Entrenamientos - ✅ MAYORMENTE COMPLETADA  
- Settings, modelo de workouts, presets, reproductor, biblioteca
- Pendiente: parser de archivos externos, builder

### Fase 3: Análisis - ✅ MAYORMENTE COMPLETADA
- Sessions storage (IndexedDB), cálculos avanzados, exportación, historial
- Pendiente: gráficos post-sesión mejorados

### Fase 4: Avanzado - 🔄 EN PROGRESO
- PWA completada (manifest, service worker)
- Pendiente: sensores adicionales, GPX, mejoras UX

### Fase 5: Modo Videojuego - ✅ IMPLEMENTADO
- Juego "Power Rush" con gráficos minimalistas
- Control mediante potencia y cadencia real
- Motor completo: entidades, sistemas, renderizado
- Documentación: `docs/GAME_MODE_SPEC.md`
