💎 Plan Estratégico: Ralph Loop (Top-Tier Booking Calendar)

Nueva Visión: Crear el selector de fechas más fluido y estético del mercado. Enfocado 100% en la experiencia de reserva de días (Vista Mensual), permitiendo selecciones intuitivas de rangos (1 día, fin de semana, mes completo) con feedback visual instantáneo.

📊 Estado del Proyecto (AI Tracker)

Fase Actual: Fase 4: Reglas de Negocio (✅ COMPLETADO)

Progreso General: 85%

Última Actualización: Validación de rangos en tiempo real y ajustes de fechas locales

0. Fase 0: Inicialización y Entorno (✅ COMPLETADO)

[x] Setup Inicial: Estructura /ralph-loop creada.

[x] Playground: index.html y app.js configurados para pruebas.

[x] Dependencias: Mithril.js y estructura de Tokens base definidos.

1. Principios de Ingeniería "Booking Edition"

Selección Líquida: Seleccionar un rango (Click Inicio -> Hover -> Click Fin) debe sentirse como pintar sobre el calendario. Sin retrasos.

Claridad Visual: Diferenciación obvia entre: Disponible, Ocupado, Bloqueado y Seleccionado.

Estética "Top Tier": Uso de bordes redondeados continuos para rangos seleccionados (efecto "pastilla" que conecta los días).

2. Especificaciones Funcionales (Must Have)

A. Vista Mensual Única

Navegación: Desplazamiento suave entre meses.

Grid: Matriz de 7 columnas (Lunes-Domingo) x 5/6 filas.

Días Clicables: Toda la celda del día es una zona interactiva (Hit area grande).

B. Lógica de Selección Inteligente

Rango Dinámico:

1 Clic: Selecciona día único.

Clic + Arrastrar (o Clic + Hover + Clic): Selecciona rango.

Validación en Tiempo Real: Si el usuario intenta seleccionar un rango que incluye un día ocupado, la selección se corta o muestra error visual inmediato.

Presets: Botones rápidos para "Semana completa" o "Este fin de semana" (Opcional, pero Top).

3. Arquitectura Técnica Actualizada

Estructura RalphLoopProps (Adaptada)

const RalphLoopProps = {
  data: { 
    bookedDates: ['2023-10-15', '2023-10-16'], // Array de strings ISO
    blockedDays: [0, 6], // Domingos y Sábados (ejemplo)
    minStay: 1,
    maxStay: 30
  },
  state: {
    selectedRange: { start: null, end: null }, // Estado efímero
    currentMonth: new Date()
  },
  callbacks: { 
    onRangeSelect: (start, end) => console.log('Reserva:', start, end) 
  }
};


Sistema de Diseño (Tokens para Booking)

Necesitamos tokens específicos para los estados de la celda:

export const Tokens = {
  colors: {
    cell: {
      default: '#FFFFFF',
      hover: '#F3F4F6',
      selected: '#2563EB', // Azul primario
      selectedText: '#FFFFFF',
      inRange: '#DBEAFE', // Azul muy claro para los días entre inicio y fin
      disabled: '#E5E7EB',
      booked: '#EF4444' // Rojo o tachado
    }
  },
  radius: {
    selection: '50%' // Círculos perfectos para inicio/fin
  }
};


4. Roadmap de Implementación (Actualizado)

📆 Fase 1: El Grid Mensual (✅ COMPLETADO)

[x] Lógica de Mes: Algoritmo que dado un (Año, Mes) devuelva un array de 42 celdas (incluyendo días padding del mes anterior/siguiente).

[x] Renderizado de Celdas: Dibujar el grid 7x6 usando CSS Inline (Flex/Grid).

[x] Headers: Pintar días de la semana (L, M, X...) alineados perfectamente.

[x] Navegación: Botones funcionales para cambiar currentMonth.

🖱️ Fase 2: Interacción y Selección (✅ COMPLETADO)

[x] Hit Testing: Detectar clics en días válidos.

[x] Lógica "Start-End":

Primer clic define startDate.

Segundo clic define endDate.

Lógica para invertir si el segundo clic es anterior al primero.

[x] Hover Feedback: Mientras se mueve el ratón tras el primer clic, iluminar el rango potencial ("in-range").

🎨 Fase 3: Estética "Top Tier" (✅ COMPLETADO)

[x] Estilo de Rango Continuo: CSS lógico para que:

El día de inicio tenga bordes redondeados a la izquierda.

El día de fin tenga bordes redondeados a la derecha.

Los días intermedios sean rectángulos planos.

Resultado: Una barra visual continua y elegante.

[x] Animaciones: Pequeña escala (scale 1.05) al seleccionar un día.

🛡️ Fase 4: Reglas de Negocio (✅ COMPLETADO)

[x] Bloqueo de Fechas: Renderizar días ocupados (tachados o grisáceos) y hacerlos no clicables.

[x] Prevención de Cruce: Impedir seleccionar un rango que atraviese una reserva existente.

[x] Validación de minStay y maxStay: Verificar que el rango cumpla con las restricciones de estancia mínima y máxima.

5. Definición de Éxito

[x] Selección de rango se siente instantánea (0 lag).

[x] Visualmente indistinguible de Airbnb/Booking nativo.

[x] Código 100% encapsulado y sin dependencias CSS.

6. Implementación Realizada

✅ **Componente MonthCalendar** (`src/components/MonthCalendar.js`)
- Grid mensual 7x6 con días de la semana
- Selección de rangos con feedback visual instantáneo
- Estilos inline con bordes redondeados continuos
- Validación de fechas ocupadas y bloqueadas
- Corte automático del rango cuando encuentra días no disponibles

✅ **Funciones de Utilidad** (`src/core/dates.js`)
- `generateMonthGrid()`: Genera 42 celdas del mes
- `isDateBooked()`: Verifica fechas ocupadas
- `isDayBlocked()`: Verifica días bloqueados
- `isDateInRange()`: Verifica si una fecha está en un rango
- `toISODateString()`: Normaliza fechas locales a YYYY-MM-DD

✅ **Tokens de Diseño** (`src/tokens.js`)
- Colores para estados de celdas (default, hover, selected, inRange, disabled, booked)
- Radios para bordes redondeados de rangos

✅ **App Principal** (`app.js`)
- Integración del calendario mensual
- Navegación entre meses
- Callbacks para selección de rangos

7. Funcionalidades Adicionales Implementadas

✅ **Presets de Selección Rápida**
- Botón "Semana Completa": Selecciona automáticamente de lunes a domingo de la semana actual
- Botón "Este Fin de Semana": Selecciona automáticamente sábado y domingo de la semana actual
- Navegación automática al mes correspondiente cuando el rango está en otro mes
- Validación de presets contra bloqueos, reservas y min/max stay

✅ **Pricing y Feedback**
- Precios diarios con color relativo al promedio
- Tooltip de rango (noches y total) durante hover
- Barra de resumen fija con total y CTA de reserva

✅ **Vista Responsiva**
- Doble mes en desktop, un mes en móvil

8. Próximos Pasos (Opcional)

[x] Mejoras de UX: Tooltips con noches y total durante hover

[ ] Internacionalización: Soporte para múltiples idiomas

[ ] Accesibilidad: Navegación por teclado y ARIA labels

[ ] Más presets: "Mes completo", "Próximos 7 días", etc.