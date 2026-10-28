# Avatar del ciclista

La expedición usa un **avatar 3D con esqueleto** (`public/models/rider.glb`) sobre una bici procedural. El código
mueve los huesos hacia los pedales, el manillar y la curva de la espalda (`src/expedition/AvatarRider.js`).
Si el archivo no existe o no carga, la app usa el ciclista procedural (`src/expedition/Cyclist.js`).

## Cómo se genera

El modelo sale de un script de Blender, sin pasos a mano:

```bash
~/.local/opt/blender-smart-trainer/blender-4.5.15-linux-x64/blender -b \
  --python 3d/scripts/build_rider.py -- 3d/ciclista.blend public/models/rider.glb
```

Requisitos: Blender 4.5 con la extensión **MPFB2** (extensions.blender.org) instalada.

El script (`3d/scripts/build_rider.py`):

1. Crea el cuerpo base de **MakeHuman** con MPFB2 (CC0) con medidas de ciclista (`MACRO`) y el rig `mixamo`.
2. Corta la malla por los bordes de cada prenda (planos de `LIMB_CUTS` y `kit_planes`) y copia esas caras como
   maillot, culotte, calcetines, guantes y pelo corto, separadas unos milímetros de la piel. Al compartir topología y
   pesos con el cuerpo, deforman igual que él. La piel tapada se borra.
3. Las zapatillas se hacen aparte: envolvente lisa de cada pie, remallada, con suela plana y los pesos del pie.
4. Casco de carretera (envolvente de la cabeza con cola, respiraderos pasantes y correas) y gafas envolventes, unidos
   al hueso `Head`.
5. Deja los dedos flexionados en reposo (agarre), añade `HeadTop_End` y exporta el GLB (~1,2 MB, ~32k triángulos).

`3d/ciclista.blend` es el resultado, para inspeccionarlo en Blender; la fuente es el script.

## Licencias

- Cuerpo base y morphs de MakeHuman: **CC0**. El GLB y el `.blend` generados se pueden publicar sin atribución.
- MPFB2 es GPL-3.0, pero solo es la herramienta: la licencia no se transmite a los modelos que genera.
- No se usa nada de `3d/referencias/` (Sumonity, CC BY 4.0): es solo material de consulta, que no se sube.

## Contrato con la app

- **Esqueleto de Mixamo**: `mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, `HeadTop_End`,
  `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftHand{Index,Middle,Ring,Pinky,Thumb}1-3`, `LeftUpLeg`,
  `LeftLeg`, `LeftFoot`, `LeftToeBase` y los equivalentes de la derecha. Sin animaciones: la postura la pone la app.
- Mira hacia **+Z**, de pie, en pose A.
- **Un material por pieza.** La app solo recolorea `TopMain` (color del maillot) y `TopTrim` (cuello y puños, en el
  tono de contraste) y `HelmetShell` (casco, a juego con el maillot); el resto conserva el material del GLB. Si el GLB no
  trae casco, la app pone el procedural de `Cyclist.js`.

## Ajustes

En `src/expedition/AvatarRider.js`:

- `LEG_REACH`: alcance de la pierna; escala el avatar para llegar a los pedales.
- `PELVIS`: dónde se sienta sobre el sillín.
- `AVATAR_POSES`: inclinación de la espalda, cabeza, muñecas y giro de la mano (`knuckles`) por posición.
- `GEAR_CENTER` y `GEAR_SCALE`: tamaño y colocación del casco sobre la cabeza.

En `3d/scripts/build_rider.py`: complexión (`MACRO`), separación de cada prenda (`OFFSETS`), colores (`COLORS`),
largo de mangas y perneras (`LIMB_CUTS`) y flexión de los dedos (`GRIP_CURL`).

El visor (**Más → Visor del ciclista**) tiene un botón **Avatar 3D** para compararlo con el ciclista procedural.

## Bici

La bici también sale de un script (`3d/scripts/build_bike.py`, solo geometría propia):

```bash
~/.local/opt/blender-smart-trainer/blender-4.5.15-linux-x64/blender -b \
  --python 3d/scripts/build_bike.py -- 3d/bici.blend public/models/bike.glb
```

- Cuadro aero de carbono (tubos elípticos unidos por remallado), vainas bajas, tubo horizontal inclinado, cockpit
  integrado, ruedas de perfil alto con radios planos, platos 52/36, cadena, cambios, frenos de disco, sillín y pedales.
- Usa las medidas de `BIKE` (`src/expedition/Cyclist.js`), copiadas al principio del script: si cambian allí, hay que
  cambiarlas también aquí.
- `src/expedition/BikeModel.js` carga el GLB. Nodos: `BikeFrame`, `WheelFront`, `WheelRear` (origen en el buje),
  `Crankset` (origen en el pedalier, biela izquierda hacia delante con ángulo 0) y `Pedal`. Los materiales se llaman
  como los huecos de material de `createCyclist` (paint, accent, rubber, tape, tire, rim, metal, bottle) y la app los
  sustituye por los suyos, así que el color de pintura, el acento, el ghost y el estilo toon siguen funcionando.
- Si `bike.glb` no existe o no carga, se usa la bici procedural.

## Materiales y movimiento

- **Reflejos:** `src/expedition/environmentMap.js` crea un mapa de entorno procedural (cielo, horizonte y suelo) que usan los
  materiales del ciclista y la bici en estilo suave. La pintura lleva barniz (clearcoat), igual que el casco.
- **Acabados del GLB:** tabla `FINISH` de `AvatarRider.js` (rugosidad, reflejos, punto de lycra en maillot, culotte y
  calcetines). El punto de lycra es un mapa de normales generado en código (`FABRIC_REPEAT`, `FABRIC_STRENGTH`).
- **Diseño del maillot:** banda diagonal cortada en la malla (`SASH` en `build_rider.py`) con el tono de contraste.
- **Transiciones:** al cambiar de posición, el avatar se acerca poco a poco a la nueva (`POSE_BLEND`).
- **Rueda libre:** sin pedalear, las bielas se quedan niveladas (`animateCyclist`).
- **De pie:** `updateRiderStance` (en `Cyclist.js`) decide cuándo ponerse de pie: pendiente de 7 % o más con cadencia baja,
  o 550 W o más, sostenido. La postura de pie (`STAND_POSE`) y el vaivén de cadera y hombros (`SWAY`) están en
  `AvatarRider.js`; la bici se balancea con la pedalada. En el visor, el botón **De pie** lo fuerza.
