# Avatar del ciclista

La expedición usa un **avatar 3D con esqueleto** (GLB) sobre una bici procedural. El código mueve
los huesos del avatar hacia los pedales, el manillar y la curva de la espalda
(`src/expedition/AvatarRider.js`), así que cualquier avatar con el esqueleto estándar de Mixamo sirve.

**Mientras no exista el archivo, la app usa el ciclista procedural** (`src/expedition/Cyclist.js`).
Para activar el avatar real, crea uno y guárdalo como **`public/models/rider.glb`**: se detecta solo al
recargar, respeta sus materiales y texturas, y debe traer su propio casco y gafas.

## Cómo crear el avatar

1. **Imágenes de entrada** (ya generadas): `docs/avatar-inputs/front.png` y `back.png`, el mismo
   ciclista en T-pose de frente y de espaldas. Se pueden regenerar con
   `node --env-file=.env.local scripts/generate-avatar-inputs.mjs`.
2. **Imagen a 3D con rig.** En Meshy o Tripo: sube las dos imágenes (si el servicio admite varias vistas,
   mejor), pide un humanoide en T-pose con texturas PBR y rig automático, y descarga un **GLB**.
   Si el servicio no pone el esqueleto, súbelo a Mixamo (auto-rigger), baja el resultado con la pose
   T y conviértelo a GLB (Blender, o `fbx2gltf`).
3. Guarda el archivo como `public/models/rider.glb` y recarga **Más → Visor del ciclista**.

## Requisitos del archivo

- **Esqueleto de Mixamo**: huesos llamados `mixamorig:Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`,
  `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase`
  y los equivalentes de la derecha. `HeadTop_End` es opcional.
- Mira hacia **+Z**, de pie, en **T-pose**.
- Una o varias mallas con skin sobre ese mismo esqueleto, con las texturas incluidas (GLB).
- **Menos de unos 6 MB**: se clona para cada ciclista de la carrera.
- Para teñir el maillot por ciclista, el material de la camiseta debe llevar `jersey`, `shirt` o `top`
  en el nombre. Si no, todos llevarán los colores del modelo.

## Ajustes si la postura no encaja

Constantes al principio de `src/expedition/AvatarRider.js`:

- `LEG_REACH`: alcance de la pierna; escala el avatar para llegar a los pedales.
- `PELVIS`: dónde se sienta sobre el sillín.
- `SPINE_LEAN`: cuánto se inclina cada tramo de la espalda hacia el manillar.
- `HAND_TARGET`: dónde apoya las manos.

El visor tiene un botón **Avatar 3D** (activo solo si existe `rider.glb`) para comparar con el ciclista
procedural, que sigue siendo el respaldo si el modelo no carga.
