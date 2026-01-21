♾️ Ralph Loop Controller: Titan Editor (PRD & Roadmap)

Este documento es la Fuente de Verdad del proyecto. Define los estándares de calidad "World Class" y guía al agente autónomo.

🧠 Instrucciones para el Agente (Ralph Loop)

LEER: Analiza el "Backlog de Ejecución" buscando la primera tarea pendiente ([ ]).

ESTÁNDAR: Antes de dar una tarea por hecha, verifica que cumple con los Principios de UX definidos abajo.

EJECUTAR: Modifica el código para cumplir el requisito.

ACTUALIZAR: Marca con [x] y añade nota a la bitácora.

💎 Principios de UX "Industry Standard" (Reglas de Oro)

Para que la app se sienta profesional, debe cumplir estrictamente estas reglas de comportamiento:

Comportamiento de Bloque (Block-Level):

Elementos: H1, H2, Blockquote, Listas (UL/OL).

Regla: Al aplicar estos estilos, se deben aplicar a todo el párrafo contenedor donde está el cursor, independientemente de si hay texto seleccionado o no. No se permite H1 dentro de un párrafo (inline).

Comportamiento de Línea (Inline-Level):

Elementos: Negrita, Cursiva, Subrayado, Enlace.

Regla: Se aplican exclusivamente a la selección de texto. Si no hay selección, se activa el modo "pendiente" (lo siguiente que escriba tendrá ese estilo).

Feedback Visual (Active States):

La barra de herramientas debe iluminar los botones correspondientes a los estilos activos en la posición actual del cursor (ej: si clic en un H1, el botón H1 debe estar azul).

📋 Backlog de Ejecución (Roadmap)

Fase 1: Estandarización y Polish (Prioridad: UX Perfecta)

Esta fase asegura que lo que ya tenemos funcione exactamente como los usuarios esperan.

[x] F1.0: Auditoría de Estilos de Bloque (H1/H2/Quote)

Requisito: Verificar que formatBlock funciona a nivel de línea completa.

Tarea Técnica: Revisar NativeRichEditor.js. Actualmente usamos formatBlock nativo, que suele cumplir esto, pero debemos asegurar que el botón se ilumine correctamente (active state) cuando el cursor está dentro de un H1.

Criterio de Aceptación: Si estoy en un H1 y pulso el botón H1 otra vez, debería volver a párrafo normal (p o div). (Toggle behavior).

[x] F1.1: Auditoría de Estilos Inline (Bold/Italic)

Requisito: Negrita/Cursiva solo en selección.

Tarea Técnica: Verificar que document.queryCommandState('bold') actualiza correctamente el estado visual del botón is-active en la toolbar al mover el cursor con las flechas o ratón.

[x] F1.2: Mejora de Tipografía y Espaciado (Visuals)

Requisito: Los H1 y H2 deben sentirse distintos visualmente (margin-top mayor, line-height ajustado).

Tarea Técnica: Ajustar native-rich-editor.css para que los encabezados no estén pegados al texto anterior.

Fase 2: Experiencia de Edición (Power Features)

[ ] F2.1: Markdown Shortcuts (Completado en Ciclo anterior)

Nota: Soporte para # , * , >  al inicio de línea.

[x] F2.2: Manejo de Cursor en Bordes (Edge Cases)

Problema: En editores nativos, a veces es difícil "salir" de un enlace o una negrita al final de la línea.

Solución: Si el usuario pulsa flecha derecha al final de un formato, el editor debe insertar un caracter invisible o mover el cursor fuera del nodo de estilo.

[x] F2.3: Tooltips Profesionales

Requisito: Al pasar el mouse por un icono, mostrar un pequeño tooltip flotante (no el nativo del navegador que tarda en salir) con "Nombre + Atajo". Ej: "Negrita (Ctrl+B)".

Fase 3: Multimedia y Contenido Rico

Fase 3: Multimedia y Contenido Rico (REDEFINIDA PARA "TOP TIER")

[x] F3.1: Link Popover (Flotante)

Objetivo: Reemplazar el input de la toolbar con un popover flotante tipo Notion/Medium.

Estrategia Técnica:

Crear componente Popover que acepte coordenadas X/Y.

Al pulsar Link, obtener selection.getRangeAt(0).getBoundingClientRect().

Posicionar el Popover justo debajo de la selección.

Focus trap en el input del popover.

[x] F3.2: Gestión de Enlaces (Click-to-Edit)

Objetivo: Poder editar enlaces existentes.

Estrategia Técnica:

Listener click en el editor. Si el target es <a>, mostrar el Popover en modo "Visualización" (URL + botones Editar/Borrar).

Prevenir la navegación por defecto al hacer clic.

Ctrl+Click para abrir el enlace.

[x] F3.3: Imágenes "Smart" (Resizing & Selection)

Objetivo: Seleccionar imágenes y cambiar su tamaño.

Estrategia Técnica:

Al hacer clic en <img>, dibujar un borde azul y "manijas" de redimensionamiento (overlay div).

Deshabilitar el redimensionamiento nativo de Firefox/Chrome (document.execCommand('enableObjectResizing', false, false)).

Implementar lógica de Drag en las esquinas para calcular nuevo width/height.

[x] F3.4: Drag & Drop Optimizado (Blobs)

Objetivo: Evitar Base64 gigante.

Estrategia Técnica:

Al soltar imagen, crear URL.createObjectURL(file) (URL temporal ligera).

Insertar imagen con esa URL blob.

Nota: Esto prepara el terreno para subidas reales al servidor en el futuro.

Fase 4: The "Wow" Factor (Funcionalidades Killer)

Para superar a CKEditor y competir con Notion, necesitamos:

[x] F4.1: Slash Commands (/)

Concepto: Al escribir / al principio de una línea, debe aparecer un menú flotante (dropdown) para elegir bloque (H1, Imagen, Lista, Cita).

Reto Técnico: Calcular coordenadas del cursor (getClientRects) y filtrar lista de comandos al escribir.

[x] F4.2: Alineación de Imágenes

Concepto: Al seleccionar una imagen (cuando sale el borde azul), mostrar una pequeña toolbar flotante encima con iconos de alineación: [Izquierda] [Centro] [Derecha].

Técnica: Aplicar margin: 0 auto y display: block para centro, o float (aunque moderno sería usar Flexbox en el contenedor, pero float es más compatible con emails/HTML simple).

[x] F4.3: Soporte de Tablas (Básico)

Concepto: Insertar una rejilla de 2x2.

Reto: Las tablas son difíciles en contenteditable. Se necesita una estructura robusta para no romper las celdas al borrar.

Fase 5: Estabilidad y Exportación

[x] F5.1: Limpieza de Recursos (Memory Leaks)

Tarea: Asegurar que URL.revokeObjectURL() se llame cuando se borra una imagen o se desmonta el editor, para no saturar la memoria del navegador.

[x] F5.2: Output Limpio (HTML vs JSON)

Tarea: Crear una función getCleanOutput() que elimine los atributos internos de edición (contenteditable, clases de overlay, manijas de resize) antes de enviar el HTML al servidor.

[x] F4.3A: Toolbar Contextual de Tablas

Objetivo: Permitir la edición estructural de la tabla (filas/columnas) mediante una interfaz visual flotante.

Detalles Técnicos:

Detectar clic en elementos td o th.

Mostrar un menú flotante (native-rich-editor__table-toolbar) cerca de la celda seleccionada.

Incluir botones con iconos para:

Insertar Fila Arriba / Abajo.

Insertar Columna Izquierda / Derecha.

Eliminar Fila / Columna / Tabla completa.

Implementar la lógica DOM para manipular HTMLTableElement (ej: insertRow, insertCell) sin romper la estructura.

[x] F4.3B: Navegación por Teclado en Tablas

Objetivo: Mejorar la usabilidad permitiendo moverse entre celdas sin usar el ratón.

Detalles Técnicos:

Interceptar el evento keydown (tecla Tab).

Si el foco está en una celda:

Tab: Mover el foco a la siguiente celda. Si es la última celda de la última fila, crear una nueva fila automáticamente y mover el foco allí.

Shift+Tab: Mover el foco a la celda anterior.

Prevenir el comportamiento por defecto (insertar tabulación o salir del editor) cuando se está dentro de una tabla.

[x] F4.3C: Estilos Robustos para Celdas

Objetivo: Evitar que las celdas vacías colapsen y mejorar el feedback visual.

Detalles Técnicos:

Actualizar CSS para garantizar min-width (ej: 30px) y min-height en td/th.

Añadir estilos para resaltar la celda que tiene el foco actual (borde azul o sombreado outline).

Asegurar que table-layout: fixed o similar se comporte bien en móviles.


📝 Bitácora de Progreso (Log)

[x] Inicialización: Proyecto creado con NativeRichEditor.js y CSS base.

[x] Refactor UI: Iconos SVG implementados.

[x] Modo Fuente: Visualización HTML limpia implementada.

[x] Markdown Shortcuts: Implementados shortcuts básicos (#, *, >).

[x] F1.0-F1.2: Fase 1 completada - Toggle behavior mejorado con actualización de estados activos, detección de movimiento de cursor con flechas, y tipografía mejorada para H1/H2/Blockquote con mejor espaciado y line-height.

[x] F2.2: Implementado manejo de cursor en bordes - Al presionar flecha derecha al final de un formato inline (bold, italic, underline, link), el cursor se mueve automáticamente fuera del nodo formateado, mejorando la experiencia de edición y permitiendo "salir" fácilmente de los formatos.

[x] F2.3: Implementados tooltips profesionales - Tooltips flotantes personalizados que aparecen al pasar el mouse sobre los iconos de la toolbar (delay de 300ms). Muestran "Nombre + Atajo" (ej: "Negrita (Ctrl+B)"). Los tooltips se posicionan automáticamente arriba del botón, ajustándose si se salen de la ventana. Incluyen soporte para focus/blur para accesibilidad. Atajos implementados: Ctrl+B (Negrita), Ctrl+I (Cursiva), Ctrl+U (Subrayado), Ctrl+K (Enlace), Ctrl+Alt+1/2 (H1/H2), Ctrl+Shift+> (Cita), Ctrl+Shift+7/8 (Listas), Ctrl+Shift+I (Imagen), Ctrl+Shift+S (HTML).

[x] F3.1: Implementado Link Popover flotante - Reemplazado el input inline de la toolbar con un popover flotante tipo Notion/Medium. El popover se posiciona dinámicamente debajo de la selección de texto (o en la posición del cursor si no hay selección), ajustándose automáticamente si se sale de los límites de la ventana. Incluye focus trap automático en el input, soporte para Enter/Escape, y detección de enlaces existentes para edición. El popover se cierra automáticamente al hacer clic fuera o al cambiar a vista de código fuente.

[x] F3.2: Implementado gestión de enlaces (Click-to-Edit) - Al hacer clic en un enlace existente en el editor, se muestra un popover en modo "visualización" que muestra la URL del enlace con botones para Editar y Borrar. La navegación por defecto al hacer clic en enlaces está prevenida, pero se permite con Ctrl+Click (o Cmd+Click en Mac). El modo edición permite modificar la URL del enlace existente, y el botón Borrar elimina el enlace manteniendo el texto. El popover se posiciona dinámicamente debajo del enlace y se cierra automáticamente al hacer clic fuera o al presionar Escape.

[x] F3.3: Implementado imágenes "Smart" (Resizing & Selection) - Al hacer clic en una imagen, se muestra un overlay con borde azul y 4 manijas de redimensionamiento en las esquinas. El redimensionamiento nativo del navegador está deshabilitado. Al arrastrar cualquier esquina, la imagen se redimensiona manteniendo proporciones si se presiona Shift. El overlay se actualiza automáticamente al hacer scroll o redimensionar la ventana. La imagen se deselecciona al hacer clic fuera, al cambiar a vista de código fuente, o al desmontar el componente. Los cambios se guardan en los atributos width y height del elemento img.

[x] F3.4: Optimizado Drag & Drop para usar Blobs - Reemplazado el uso de FileReader con readAsDataURL (Base64) por URL.createObjectURL para crear URLs blob temporales mucho más ligeras. Esto evita datos Base64 gigantes que pueden hacer que el HTML sea muy pesado. Las imágenes ahora usan URLs blob: que son temporales y se mantienen en memoria, preparando el terreno para futuras subidas al servidor donde se podrán convertir a URLs permanentes.

[x] F4.1: Implementado Slash Commands (/) - Al escribir "/" al principio de una línea, aparece un menú flotante tipo dropdown con comandos disponibles (H1, H2, Cita, Lista, Lista numerada, Imagen). El menú se filtra en tiempo real mientras el usuario escribe después del "/". Navegación con flechas arriba/abajo, selección con Enter/Tab, y cierre con Escape. El menú se posiciona dinámicamente debajo del cursor y se ajusta si se sale de los límites de la ventana. Soporta búsqueda por alias en español e inglés (ej: "h1", "heading1", "encabezado1" para H1). Al seleccionar un comando, se elimina el texto "/query" y se aplica el formato correspondiente.

[x] F4.2: Implementado Alineación de Imágenes - Al seleccionar una imagen (cuando aparece el borde azul), se muestra una toolbar flotante encima de la imagen con tres botones de alineación: Izquierda, Centro, Derecha. La toolbar se posiciona dinámicamente encima de la imagen, centrada horizontalmente. Al hacer clic en cada botón, se aplica la alineación correspondiente: Izquierda usa `float: left`, Derecha usa `float: right`, y Centro usa `display: block` con `margin: 0 auto`. El botón activo se resalta visualmente según la alineación actual de la imagen. La toolbar se actualiza automáticamente cuando la imagen se mueve (scroll o redimensionamiento) y se oculta cuando se deselecciona la imagen.

[x] F4.3: Implementado Soporte de Tablas (Básico) - Se agregó un botón de Tabla a la toolbar que inserta una tabla 2x2 cuando se hace clic. La tabla se crea con una estructura robusta: cada celda contiene inicialmente un espacio no separado (&nbsp;) para evitar que se colapsen al borrar contenido. Al insertar la tabla, el cursor se coloca automáticamente en la primera celda, lista para escribir. Las tablas incluyen estilos CSS apropiados (bordes, padding, ancho completo) y son totalmente editables dentro del editor. La tabla se inserta en la posición del cursor y reemplaza cualquier texto seleccionado. Soporta navegación entre celdas con Tab y Shift+Tab. Las tablas están incluidas en las etiquetas permitidas del sanitizador HTML y también están disponibles como comando en los Slash Commands (/tabla).

[x] F5.1: Implementado Limpieza de Recursos (Memory Leaks) - Sistema completo de gestión de blob URLs para prevenir memory leaks. Todas las URLs blob creadas se registran automáticamente cuando se insertan imágenes (tanto por selector de archivos como por drag & drop). Las URLs se rastrean por editor usando un Map que asocia cada vnode con un Set de URLs blob activas. El sistema detecta automáticamente cuando las imágenes se eliminan del contenido y revoca las URLs blob no utilizadas. Al desmontar el editor, se revocan todas las URLs blob asociadas, liberando completamente la memoria. Las imágenes con blob URLs se marcan con un atributo `data-blob-url` para facilitar el rastreo. Esto previene la saturación de memoria del navegador cuando se trabajan con muchas imágenes o se desmontan múltiples instancias del editor.

[x] F5.2: Implementado Output Limpio (HTML vs JSON) - Función `getCleanOutput()` que elimina todos los atributos y clases internas de edición antes de enviar el HTML al servidor. Elimina atributos internos como `contenteditable`, `data-blob-url`, `data-position` y otros atributos temporales. Elimina clases CSS internas relacionadas con overlays (image-overlay, image-resize-handle, image-toolbar), popovers, slash menus y otras herramientas de edición. Limpia estilos inline temporales relacionados con posicionamiento y z-index de elementos de edición. La función `emitChange()` ahora usa `getCleanOutput()` internamente, asegurando que el HTML emitido siempre esté limpio. Esto garantiza que el HTML enviado al servidor no contenga metadatos ni atributos internos del editor, solo el contenido real del usuario.

[x] F4.3A: Implementado Toolbar Contextual de Tablas - Al hacer clic en una celda de tabla (td o th), se muestra un toolbar flotante posicionado dinámicamente encima de la celda seleccionada. El toolbar incluye 7 botones con iconos SVG: Insertar Fila Arriba, Insertar Fila Abajo, Insertar Columna Izquierda, Insertar Columna Derecha, Eliminar Fila, Eliminar Columna, y Eliminar Tabla completa. La implementación usa las APIs nativas del DOM (insertRow, insertCell, deleteRow, deleteCell) para manipular la estructura de la tabla sin romperla. El toolbar se actualiza automáticamente al hacer scroll o redimensionar la ventana, y se oculta al hacer clic fuera de la tabla o al cambiar a vista de código fuente. Al insertar filas/columnas, el cursor se mueve automáticamente a la nueva celda creada. Las nuevas celdas se crean con estilos consistentes y un espacio no separado para evitar colapso.

[x] F4.3B: Implementado Navegación por Teclado en Tablas - Interceptado el evento keydown para detectar cuando el usuario presiona Tab o Shift+Tab dentro de una celda de tabla. Tab mueve el foco a la siguiente celda (derecha), y si es la última celda de la fila, mueve a la primera celda de la siguiente fila. Si es la última celda de la última fila, crea automáticamente una nueva fila y mueve el foco allí. Shift+Tab mueve el foco a la celda anterior (izquierda), y si es la primera celda de la fila, mueve a la última celda de la fila anterior. El comportamiento por defecto de Tab (insertar tabulación o salir del editor) está prevenido cuando se está dentro de una tabla. La navegación actualiza automáticamente el toolbar contextual si está visible, y limpia espacios no separados de las celdas destino para una mejor experiencia de edición.

[x] F4.3C: Implementado Estilos Robustos para Celdas - Actualizado el CSS para garantizar que las celdas tengan min-width de 100px y min-height de 30px, evitando que se colapsen cuando están vacías. Añadido feedback visual mejorado para celdas con foco: outline azul de 2px con offset negativo y fondo azul claro (#eff6ff) para resaltar la celda activa. Las celdas ahora tienen position: relative y box-sizing: border-box para mejor control del layout. Agregados estilos completos para el toolbar de tablas (native-rich-editor__table-toolbar) con diseño flotante, sombras y transiciones suaves. Los botones del toolbar tienen estados hover y active bien definidos, y soporte para focus-visible para accesibilidad. Los estilos son responsivos y funcionan bien en diferentes tamaños de pantalla.

