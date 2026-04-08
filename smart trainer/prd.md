# PRD: Smart Trainer D100 Controller

## 1. Visión General del Proyecto
Desarrollar una aplicación web sencilla y eficiente para controlar el rodillo de entrenamiento inteligente Decathlon D100. La aplicación permitirá a los usuarios conectar su rodillo vía Bluetooth, visualizar métricas en tiempo real y controlar la resistencia del entrenamiento.

## 2. Especificaciones Técnicas
*   **Plataforma**: Web (PWA compatible).
*   **Lenguaje**: JavaScript (Vanilla ES6+ o Mithril.js según estándares del repo).
*   **Protocolo de Comunicación**: Web Bluetooth API.
    *   **Servicio**: Fitness Machine Service (FTMS) `0x1826`.
    *   **Características Clave**:
        *   Indoor Bike Data `0x2AD2` (Lectura).
        *   Fitness Machine Control Point `0x2AD9` (Escritura/Control).
        *   Fitness Machine Status `0x2ADA` (Notificaciones).
*   **Dependencias**: Ninguna (Zero dependencies goal).
*   **Estilo**: CSS in JS (según reglas del repositorio).

## 3. Funcionalidades Principales

### 3.1 Conexión y Estado
*   Botón para escanear y conectar con el dispositivo D100.
*   Indicador de estado de conexión (Desconectado, Conectando, Conectado).
*   Reconexión automática si es posible/seguro.

### 3.2 Visualización de Datos (Dashboard)
*   **Potencia (Watts)**: Valor instantáneo, media 3s.
*   **Cadencia (RPM)**: Revoluciones por minuto.
*   **Velocidad (Km/h)**: Velocidad virtual.
*   **Distancia**: Distancia acumulada en la sesión.

### 3.3 Control del Rodillo
*   **Modo ERG (Objetivo de Potencia)**:
    *   El usuario establece un objetivo de vatios (ej. 200W).
    *   La app ajusta la resistencia automáticamente para mantener la potencia independientemente de la cadencia/velocidad.
    *   Botones +/- para ajustar el objetivo rápidamente.
*   **Modo Resistencia/Pendiente (Simulación)**:
    *   El usuario establece un nivel de resistencia (0-100%) o pendiente.
    *   Control manual básico.

## 4. Arquitectura Propuesta (Módulo JS)

```javascript
// Estructura de archivos sugerida
/smart trainer/
  - index.html
  - css/
  - js/
    - bluetooth.js   // Manejo de Web Bluetooth API
    - trainer.js     // Lógica específica del D100 / FTMS
    - app.js         // Controlador principal
    - ui.js          // Componentes de interfaz
```

## 5. Plan de Tareas (Roadmap)

### Fase 1: Infraestructura y Conexión
- [ ] Configurar estructura del proyecto (HTML, JS folders).
- [ ] Implementar `bluetooth.js` para escanear y conectar al servicio FTMS.
- [ ] Crear interfaz básica de conexión.

### Fase 2: Lectura de Datos
- [ ] Suscribirse a notificaciones de `Indoor Bike Data`.
- [ ] Decodificar paquetes de datos (Potencia, Cadencia, Velocidad).
- [ ] Mostrar datos en el Dashboard en tiempo real.

### Fase 3: Control del Rodillo (ERG)
- [ ] Implementar escritura en `Fitness Machine Control Point`.
- [ ] Crear lógica para solicitar control (Request Control).
- [ ] Implementar comando para establecer Target Power (Modo ERG).
- [ ] UI para ajustar potencia objetivo.

### Fase 4: Refinamiento y UX
- [ ] Manejo de errores y desconexiones.
- [ ] Estilizado final (Dark mode, responsive).
- [ ] Guardado de sesión local (opcional).

## 6. Referencias Web Bluetooth (FTMS)
*   **Service UUID**: `00001826-0000-1000-8000-00805f9b34fb`
*   **Indoor Bike Data**: `00002ad2-0000-1000-8000-00805f9b34fb`
*   **Control Point**: `00002ad9-0000-1000-8000-00805f9b34fb`
