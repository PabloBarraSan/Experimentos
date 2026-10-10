# Diagnóstico de cadencia y potencia

Conecta el rodillo desde la app y abre Más → Prueba del rodillo. Pulsa **Empezar
mini entreno** y sigue el metrónomo: una vuelta completa de la misma pierna por
pulso. La pantalla te indica la cadencia y el tiempo restante en cada bloque.

En cuatro minutos pasarás por 60, 80 y 100 rpm, dos paradas y un cambio de marcha.
No tienes que marcar ni escribir referencias. La prueba guarda cada paquete y
un resumen por bloque automáticamente. Mantén la app visible: si queda en
segundo plano o deja de recibir datos, termina guardando el informe parcial.

Al acabar pulsa **Descargar informe para este chat** y adjunta el JSON al chat.
También puedes recuperar la última prueba desde el mismo navegador. Esta prueba
no modifica la resistencia del rodillo; los controles manuales están en las
opciones avanzadas.

El metrónomo indica un objetivo, no una cadencia medida independientemente.
El informe conserva esta distinción. Sirve para investigar errores y comparar
hipótesis; no certifica la exactitud física de la potencia.

## Comparación manual opcional (opciones avanzadas)

1. Mantén aproximadamente 60 rpm durante 20 segundos y marca la cadencia medida.
2. Repite a 80 y 100 rpm, manteniendo la misma resistencia y marcha cuando sea posible.
3. Deja de pedalear, observa qué bytes cambian y marca 0 cuando las bielas estén paradas.
4. Repite una cadencia estable con otra marcha. Esto ayuda a distinguir una medida
   de las bielas de otra vinculada a la rueda o al volante del rodillo.
5. Descarga el informe JSON después de cada recorrido.

Para medir cadencia sin sensor, cuenta vueltas completas de una misma biela
durante 15 segundos y multiplica por cuatro. Un sensor independiente mejora
la precisión. Introduce la medida real, aunque no sea exactamente 60, 80 o 100.

Para potencia, compara con un potenciómetro independiente y marca sus vatios
durante un esfuerzo estable. Si usas otra app que se conecta al mismo rodillo,
solo estarás comparando la interpretación de su señal, no su exactitud física.
El objetivo ERG tampoco constituye una referencia de potencia medida.

## Qué conserva el informe

- Cada muestra procede de una notificación original, antes del debounce y de
  la mezcla con pulso u otros datos de la app.
- Los bytes originales, flags, timestamp de recepción y campos interpretados.
- Un desglose FTMS independiente con offsets, campos truncados y bytes adicionales.
- Para flags 0x0040, candidatos de cadencia: byte 6 dividido por dos y
  61440 dividido por uint16 little-endian de bytes 6–7. Son hipótesis, no medidas
  verificadas. FTMS no anuncia cadencia en ese paquete.
- Valores del parser actual y de un pipeline diagnóstico suavizado. Este último
  sirve para estudiar el efecto del filtrado; no representa necesariamente todos
  los indicadores de cada pantalla de entrenamiento.
- Marcas con medias de los últimos cinco segundos, diferencias respecto a la
  referencia y sus paquetes originales. Un valor ausente se distingue de cero.
- Total de muestras recibidas, muestras descartadas por el límite de 600,
  comandos y resultados. Las marcas conservan sus paquetes aunque el buffer rote.

El informe usa schemaVersion 3. La captura manual es temporal. El mini entreno
conserva hasta 12 000 paquetes originales y guarda el informe en IndexedDB al
terminar o interrumpirse, incluidos sus bloques y motivos de interrupción. Si
se supera el límite, el informe indica cuántas muestras se descartaron. Las
órdenes de ERG son opcionales y separadas de la captura pasiva.

## Criterios para corregir el parser

La hipótesis de cadencia debe concordar en varios puntos, durante las transiciones
y al cambiar de marcha. No ajustar un factor con una sola muestra ni deducir
cadencia cero únicamente de potencia cero. Primero identificar la semántica de
los bytes. Si la lectura FTMS de potencia concuerda con la app pero difiere de
un potenciómetro independiente, investigar el dispositivo y su calibración.
Si cambia el resultado entre bytes, parser y pantalla, investigar el software.

Las pruebas automáticas cubren offsets FTMS, potencia con signo, paquetes
truncados, captura antes de debounce y referencias temporales. No sustituyen
la prueba física del rodillo.
