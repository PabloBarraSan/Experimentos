# PRD - Smart Trainer D100 (Decathlon)

Fecha: 2026-01-26  
Propietario: Equipo de producto  
Version: 0.1

## 1. Resumen
Crear una aplicacion para controlar el rodillo de entrenamiento Decathlon D100. La app debe permitir conectar el dispositivo, leer metricas en tiempo real y controlar el modo de resistencia o potencia objetivo. El MVP prioriza una experiencia estable, simple y sin dependencias pesadas.

## 2. Objetivo y vision
Dar a los ciclistas una forma sencilla de usar el D100 con sesiones estructuradas y control preciso del entrenamiento, desde un navegador o app ligera.

## 3. Alcance (MVP)
- Conexion al D100 via Bluetooth LE (BLE).
- Pantalla de conexion con estado claro (escaneo, emparejado, conectado).
- Lectura de metricas en tiempo real: velocidad, cadencia, potencia, resistencia actual.
- Control de resistencia/objetivo de potencia (si el dispositivo lo soporta).
- Sesiones basicas: rodaje libre y intervalos simples.
- Guardado local de sesiones (historial basico).

## 4. Fuera de alcance (por ahora)
- Integracion con servicios externos (Strava, TrainingPeaks, etc.).
- Planes de entrenamiento avanzados o IA.
- Multiusuario con cuentas en la nube.
- Soporte para otros rodillos no compatibles.

## 5. Usuarios y casos de uso
### Usuarios
- Ciclista recreativo que quiere entrenar en casa.
- Usuario que busca controlar potencia o resistencia de forma simple.

### Casos de uso
1. Conectar el D100 y ver metricas en vivo.
2. Ajustar resistencia manualmente durante el rodaje.
3. Ejecutar una sesion de intervalos con objetivos de potencia/resistencia.
4. Consultar el historial de entrenos recientes.

## 6. Requisitos funcionales
1. Escaneo BLE y conexion con el D100.
2. Gestion de estados: desconectado, conectando, conectado, error.
3. Lectura de caracteristicas BLE para metricas (segun protocolo).
4. Comando para cambiar resistencia o potencia objetivo (si aplica).
5. Temporizador de sesion con pause/resume/stop.
6. Registro local de sesion con datos basicos (duracion, promedio, maxima).

## 7. Requisitos no funcionales
- Latencia de actualizacion de metricas: <= 1s.
- Reconexion automatica al perder señal.
- UI responsiva para movil y desktop.
- Sin dependencias pesadas; codigo modular y mantenible.
- Manejo de errores claro y recuperable.

## 8. Experiencia de usuario (UX)
### Pantallas MVP
1. **Conexion**
   - Boton "Buscar D100"
   - Lista de dispositivos encontrados
   - Estado y mensajes de error
2. **Entrenamiento**
   - Panel de metricas en vivo
   - Control de resistencia/potencia
   - Controles de sesion (start/pause/stop)
3. **Historial**
   - Lista de sesiones recientes
   - Detalle simple por sesion

## 9. Integraciones y dispositivo
### Supuestos
- El D100 expone BLE y soporte de un perfil estandar (idealmente FTMS).
- Es posible leer metricas y enviar comandos de control.

### Validaciones requeridas
- Confirmar servicios y caracteristicas BLE disponibles.
- Verificar limites de control (rango de resistencia o potencia).
- Determinar si el emparejamiento requiere PIN o pasos especiales.

## 10. Datos y almacenamiento
- Guardado local (localStorage o IndexedDB).
- Estructura de sesion:
  - id, fecha, duracion, distancia estimada, potencia promedio, potencia maxima.

## 11. Seguridad y privacidad
- No se enviaran datos a servidores externos en el MVP.
- Los datos quedan en el dispositivo del usuario.

## 12. Metricas de exito
- Tasa de conexion exitosa > 90%.
- Sesiones completadas sin desconexion > 95%.
- Tiempo de conexion promedio < 10s.

## 13. Riesgos y mitigaciones
- **Riesgo:** el D100 no soporta control remoto completo.  
  **Mitigacion:** degradar a modo lectura y mostrar limitaciones.
- **Riesgo:** compatibilidad limitada del navegador con BLE.  
  **Mitigacion:** documentar navegadores compatibles (Chrome/Edge).
- **Riesgo:** desconexiones frecuentes.  
  **Mitigacion:** reconexion automatica y manejo de estado robusto.

## 14. Plan de tareas (backlog inicial)
### Descubrimiento y validacion
- [ ] Investigar protocolo BLE del D100 (servicios y caracteristicas).
- [ ] Probar conectividad BLE con prototipo minimo.
- [ ] Definir compatibilidad de navegadores y dispositivos.

### Arquitectura y base
- [ ] Definir estructura de proyecto y modulos.
- [ ] Crear mock de datos para UI sin hardware.
- [ ] Implementar gestion de estado de conexion.

### Funcionalidad core
- [ ] Implementar escaneo y conexion BLE.
- [ ] Implementar lectura de metricas en vivo.
- [ ] Implementar comandos de control (resistencia/potencia).
- [ ] Implementar temporizador de sesion.

### UI/UX
- [ ] Diseñar vista de conexion.
- [ ] Diseñar vista de entrenamiento.
- [ ] Diseñar vista de historial.

### Datos
- [ ] Guardado local de sesiones.
- [ ] Vista de historial con detalle basico.

### Calidad
- [ ] Pruebas manuales con D100 real.
- [ ] Manejo de errores y reconexion.

## 15. Criterios de aceptacion (MVP)
- El usuario puede conectar el D100 y ver metricas en vivo.
- El usuario puede iniciar y detener una sesion de entrenamiento.
- El usuario puede ajustar resistencia o potencia si el D100 lo permite.
- El usuario puede ver el historial basico de sesiones.

## 16. Preguntas abiertas
- El D100 soporta FTMS o un protocolo propietario?
- Requiere actualizacion de firmware para control remoto?
- Se necesita calibracion previa a cada sesion?
