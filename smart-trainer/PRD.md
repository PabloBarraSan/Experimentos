# PRD: Smart Trainer Controller - Decathlon D100

## 📋 Resumen Ejecutivo

**Producto:** Aplicación web para controlar el rodillo de entrenamiento Decathlon D100
**Stack:** Vanilla JS + Web Bluetooth API
**Objetivo:** Proporcionar una interfaz completa para entrenamientos ciclistas con control de resistencia, métricas en tiempo real y programas de entrenamiento personalizados.

---

## 🎯 Visión del Producto

Crear una aplicación web progresiva (PWA) que permita a los ciclistas:
- Conectar y controlar su rodillo Decathlon D100 vía Bluetooth
- Visualizar métricas de entrenamiento en tiempo real
- Ejecutar programas de entrenamiento estructurados
- Guardar y analizar el historial de sesiones

---

## 🔧 Especificaciones Técnicas del Rodillo D100

### Conectividad
| Protocolo | UUID | Descripción |
|-----------|------|-------------|
| **FTMS (Fitness Machine Service)** | `0x1826` | Protocolo estándar BLE para equipos fitness |
| **Indoor Bike Data** | `0x2AD2` | Característica para datos del rodillo |
| **Fitness Machine Control Point** | `0x2AD9` | Característica para enviar comandos |
| **Fitness Machine Status** | `0x2ADA` | Estado del dispositivo |
| **Training Status** | `0x2AD3` | Estado del entrenamiento |

### Datos Disponibles (Indoor Bike Data - 0x2AD2)
- **Velocidad instantánea** (km/h)
- **Cadencia** (rpm)
- **Potencia instantánea** (watts)
- **Potencia media** (watts)
- **Distancia total** (metros)
- **Resistencia actual** (nivel)
- **Tiempo transcurrido** (segundos)
- **Energía total** (kJ/kcal)
- **Frecuencia cardíaca** (si hay sensor conectado)

### Comandos de Control (0x2AD9)
| OpCode | Comando | Descripción |
|--------|---------|-------------|
| `0x00` | Request Control | Solicitar control del dispositivo |
| `0x01` | Reset | Reiniciar métricas |
| `0x04` | Set Target Resistance | Establecer resistencia (0-100%) |
| `0x05` | Set Target Power | Modo ERG - potencia objetivo |
| `0x06` | Set Target Heart Rate | Control por frecuencia cardíaca |
| `0x07` | Start/Resume | Iniciar/reanudar entrenamiento |
| `0x08` | Stop/Pause | Detener/pausar entrenamiento |
| `0x11` | Set Indoor Bike Simulation | Modo simulación (pendiente, viento, etc.) |

---

## 🏗️ Arquitectura de la Aplicación

```
smart-trainer/
├── index.html              # Punto de entrada
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── PRD.md                  # Este documento
├── TASKS.md                # Tareas de desarrollo
│
├── src/
│   ├── app.js              # Inicialización principal
│   │
│   ├── bluetooth/
│   │   ├── scanner.js      # Escaneo y conexión BLE
│   │   ├── ftms.js         # Parser protocolo FTMS
│   │   └── commands.js     # Comandos de control
│   │
│   ├── components/
│   │   ├── Dashboard.js    # Panel principal
│   │   ├── MetricCard.js   # Tarjeta de métrica
│   │   ├── PowerGauge.js   # Indicador de potencia
│   │   ├── ResistanceSlider.js  # Control de resistencia
│   │   ├── WorkoutPlayer.js     # Reproductor de entrenamientos
│   │   └── ConnectionStatus.js  # Estado de conexión
│   │
│   ├── views/
│   │   ├── HomeView.js     # Pantalla inicial/conexión
│   │   ├── TrainingView.js # Vista de entrenamiento activo
│   │   ├── WorkoutsView.js # Biblioteca de entrenamientos
│   │   ├── HistoryView.js  # Historial de sesiones
│   │   └── SettingsView.js # Configuración
│   │
│   ├── workouts/
│   │   ├── parser.js       # Parser de archivos workout
│   │   ├── presets.js      # Entrenamientos predefinidos
│   │   └── builder.js      # Constructor de entrenamientos
│   │
│   ├── storage/
│   │   ├── sessions.js     # Gestión de sesiones
│   │   └── settings.js     # Preferencias usuario
│   │
│   └── utils/
│       ├── formatters.js   # Formateo de datos
│       ├── calculations.js # Cálculos (TSS, NP, etc.)
│       └── charts.js       # Utilidades gráficas
│
└── assets/
    └── icons/              # Iconos PWA
```

---

## 📱 Funcionalidades

### Fase 1: MVP - Conexión y Control Básico

#### F1.1 - Conexión Bluetooth
- [ ] Escanear dispositivos BLE compatibles
- [ ] Conectar al rodillo D100
- [ ] Reconexión automática
- [ ] Indicador de estado de conexión
- [ ] Gestión de desconexiones

#### F1.2 - Lectura de Datos
- [ ] Parsear datos FTMS en tiempo real
- [ ] Mostrar velocidad instantánea
- [ ] Mostrar cadencia
- [ ] Mostrar potencia instantánea
- [ ] Mostrar distancia acumulada
- [ ] Mostrar tiempo de entrenamiento

#### F1.3 - Control Manual
- [ ] Ajustar resistencia (slider 0-100%)
- [ ] Iniciar/pausar entrenamiento
- [ ] Reiniciar métricas

#### F1.4 - Interfaz Básica
- [ ] Dashboard con métricas principales
- [ ] Diseño responsive (móvil + escritorio)
- [ ] Tema oscuro (ideal para entrenamientos)

### Fase 2: Entrenamientos Estructurados

#### F2.1 - Biblioteca de Entrenamientos
- [ ] Entrenamientos predefinidos (intervalos, tempo, etc.)
- [ ] Importar archivos .zwo (Zwift)
- [ ] Importar archivos .erg/.mrc
- [ ] Crear entrenamientos personalizados

#### F2.2 - Reproductor de Entrenamientos
- [ ] Visualización de bloques de entrenamiento
- [ ] Control automático de resistencia/potencia
- [ ] Modo ERG (potencia constante)
- [ ] Modo SIM (simulación de pendiente)
- [ ] Indicadores de progreso
- [ ] Alertas de cambio de fase

#### F2.3 - Zonas de Entrenamiento
- [ ] Configurar FTP del usuario
- [ ] Calcular zonas automáticamente
- [ ] Mostrar zona actual durante entrenamiento
- [ ] Colores por zona (Z1-Z7)

### Fase 3: Análisis y Persistencia

#### F3.1 - Grabación de Sesiones
- [ ] Guardar sesión completa en IndexedDB
- [ ] Exportar a formato .fit
- [ ] Exportar a formato .tcx

#### F3.2 - Historial
- [ ] Lista de sesiones anteriores
- [ ] Resumen por sesión (duración, TSS, potencia media)
- [ ] Gráfico de potencia de la sesión
- [ ] Estadísticas acumuladas

#### F3.3 - Métricas Avanzadas
- [ ] Potencia normalizada (NP)
- [ ] Training Stress Score (TSS)
- [ ] Intensity Factor (IF)
- [ ] Variability Index (VI)

### Fase 4: Características Avanzadas

#### F4.1 - Sensores Adicionales
- [ ] Conexión con sensor de frecuencia cardíaca
- [ ] Conexión con sensor de cadencia externo
- [ ] Conexión con medidor de potencia externo

#### F4.2 - PWA Completa
- [ ] Service Worker para offline
- [ ] Instalable en dispositivos
- [ ] Notificaciones de entrenamiento

#### F4.3 - Simulación de Rutas
- [ ] Importar archivos GPX
- [ ] Ajuste automático de resistencia por pendiente
- [ ] Visualización del perfil de ruta

---

## 🎨 Diseño de Interfaz

### Paleta de Colores (Tema Oscuro)
```javascript
const colors = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceHover: '#2a2a2a',
  primary: '#00d4aa',      // Verde turquesa (Decathlon)
  secondary: '#0066cc',    // Azul
  accent: '#ff6b35',       // Naranja (alertas)
  text: '#ffffff',
  textMuted: '#888888',
  
  // Zonas de potencia
  zone1: '#808080',  // Recuperación (gris)
  zone2: '#0066ff',  // Resistencia (azul)
  zone3: '#00cc00',  // Tempo (verde)
  zone4: '#ffcc00',  // Umbral (amarillo)
  zone5: '#ff6600',  // VO2max (naranja)
  zone6: '#ff0000',  // Anaeróbico (rojo)
  zone7: '#cc00cc',  // Neuromuscular (púrpura)
};
```

### Layout Principal (Training View)
```
┌─────────────────────────────────────────────────┐
│  [🔗 Conectado] [⚙️]              Smart Trainer │
├─────────────────────────────────────────────────┤
│                                                 │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│    │  POWER  │  │ CADENCE │  │  SPEED  │       │
│    │  245w   │  │  85rpm  │  │ 32km/h  │       │
│    └─────────┘  └─────────┘  └─────────┘       │
│                                                 │
│    ┌───────────────────────────────────┐       │
│    │     [===========|----] 65%        │       │
│    │        Resistencia                │       │
│    └───────────────────────────────────┘       │
│                                                 │
│    ┌───────────────────────────────────┐       │
│    │  📊 Gráfico de potencia en vivo   │       │
│    │  ▃▅▇▅▃▁▃▅▇█▇▅▃▅▇▅▃▁             │       │
│    └───────────────────────────────────┘       │
│                                                 │
│    ⏱️ 00:45:32    📏 18.5 km    🔥 520 kcal    │
│                                                 │
│         [⏸️ PAUSAR]    [⏹️ FINALIZAR]          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔌 Integración Web Bluetooth

### Ejemplo de Conexión
```javascript
// Solicitar dispositivo FTMS
const device = await navigator.bluetooth.requestDevice({
  filters: [
    { services: ['fitness_machine'] },  // 0x1826
    { namePrefix: 'DECATHLON' }
  ],
  optionalServices: ['battery_service']
});

// Conectar
const server = await device.gatt.connect();
const service = await server.getPrimaryService('fitness_machine');

// Obtener características
const bikeData = await service.getCharacteristic(0x2AD2);
const controlPoint = await service.getCharacteristic(0x2AD9);

// Suscribirse a notificaciones
await bikeData.startNotifications();
bikeData.addEventListener('characteristicvaluechanged', handleData);
```

### Parseo de Indoor Bike Data
```javascript
function parseIndoorBikeData(dataView) {
  const flags = dataView.getUint16(0, true);
  let offset = 2;
  const result = {};
  
  // Velocidad (siempre presente si bit 0 = 0)
  if (!(flags & 0x01)) {
    result.speed = dataView.getUint16(offset, true) / 100; // km/h
    offset += 2;
  }
  
  // Cadencia (si bit 2 = 1)
  if (flags & 0x04) {
    result.cadence = dataView.getUint16(offset, true) / 2; // rpm
    offset += 2;
  }
  
  // Potencia (si bit 6 = 1)
  if (flags & 0x40) {
    result.power = dataView.getInt16(offset, true); // watts
    offset += 2;
  }
  
  return result;
}
```

---

## 📊 Cálculos de Métricas

### Potencia Normalizada (NP)
```javascript
function calculateNP(powerData, sampleRate = 1) {
  // 1. Calcular media móvil de 30 segundos
  const windowSize = 30 * sampleRate;
  const rollingAvg = [];
  
  for (let i = windowSize; i < powerData.length; i++) {
    const window = powerData.slice(i - windowSize, i);
    const avg = window.reduce((a, b) => a + b, 0) / windowSize;
    rollingAvg.push(avg);
  }
  
  // 2. Elevar a la 4ª potencia
  const fourthPower = rollingAvg.map(p => Math.pow(p, 4));
  
  // 3. Calcular media
  const avgFourth = fourthPower.reduce((a, b) => a + b, 0) / fourthPower.length;
  
  // 4. Raíz cuarta
  return Math.pow(avgFourth, 0.25);
}
```

### Training Stress Score (TSS)
```javascript
function calculateTSS(normalizedPower, durationSeconds, ftp) {
  const intensityFactor = normalizedPower / ftp;
  return (durationSeconds * normalizedPower * intensityFactor) / (ftp * 3600) * 100;
}
```

---

## 📦 Dependencias

| Paquete | Uso | Necesario |
|---------|-----|-----------|
| **Ninguno** | - | La app será 100% Vanilla JS |

### APIs del Navegador Utilizadas
- **Web Bluetooth API** - Conexión con dispositivos BLE
- **IndexedDB** - Almacenamiento local de sesiones
- **Canvas API** - Gráficos en tiempo real
- **Service Worker** - Funcionalidad offline
- **Web Notifications** - Alertas de entrenamiento

---

## 🔒 Requisitos del Navegador

| Navegador | Soporte Web Bluetooth |
|-----------|----------------------|
| Chrome (Desktop) | ✅ Completo |
| Chrome (Android) | ✅ Completo |
| Edge | ✅ Completo |
| Opera | ✅ Completo |
| Safari | ❌ No soportado |
| Firefox | ❌ No soportado |

**Nota:** La app debe mostrar un mensaje informativo en navegadores no compatibles.

---

## 📈 Métricas de Éxito

1. **Conexión estable** - < 5% de desconexiones durante uso
2. **Latencia** - < 100ms entre dato real y visualización
3. **Precisión** - 100% de datos parseados correctamente
4. **Rendimiento** - 60fps en visualizaciones, sin jank

---

## 🚀 Roadmap Sugerido

| Fase | Duración Estimada | Entregables |
|------|-------------------|-------------|
| **Fase 1 - MVP** | - | Conexión + Dashboard básico |
| **Fase 2 - Workouts** | - | Entrenamientos estructurados |
| **Fase 3 - Análisis** | - | Historial + métricas avanzadas |
| **Fase 4 - Avanzado** | - | Sensores + PWA + GPX |

---

## 📝 Notas Adicionales

### Compatibilidad con otros rodillos
El protocolo FTMS es estándar, por lo que la app debería funcionar con:
- Decathlon D100/D500
- Tacx (modelos con Bluetooth)
- Wahoo KICKR
- Elite trainers
- Cualquier rodillo compatible FTMS

### Testing
- Usar la extensión "nRF Connect" para simular dispositivo BLE
- Probar en móvil Android con rodillo real
- Documentar quirks específicos del D100

---

*Documento creado: Enero 2026*
*Última actualización: --*
