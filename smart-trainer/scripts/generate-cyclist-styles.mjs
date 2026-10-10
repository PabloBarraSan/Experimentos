// Genera imágenes de referencia del ciclista en varios estilos (solo uso local).
// Uso: node --env-file=.env.local scripts/generate-cyclist-styles.mjs [estilo ...]
import { mkdir, writeFile } from 'node:fs/promises';

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('Falta OPENAI_API_KEY en .env.local');

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const SHARED = 'A cyclist riding a road bike seen from a three-quarter rear view, mint green jersey, white helmet, '
  + 'on a plain dark teal background, full body and bike visible, game character design sheet, no text, no watermark. Style: ';

const STYLES = {
  cartoon: 'chunky cartoon mascot, oversized round helmet and head, simple capsule limbs, flat colors with 2-step cel shading and a thick dark outline, friendly, stylized proportions',
  lowpoly: 'low-poly 3D, faceted flat-shaded triangles, clean geometric shapes, limited palette, no textures',
  voxel: 'voxel art, built from cubes like a retro block game, chunky pixel-like detail',
  flat: 'flat vector poster illustration, minimal shapes, solid colors, no gradients, bold simple silhouette',
};

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(STYLES);
await mkdir(new URL('../docs/cyclist-styles/', import.meta.url), { recursive: true });

for (const name of names) {
  if (!STYLES[name]) throw new Error(`Estilo desconocido: ${name}`);
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, prompt: SHARED + STYLES[name], size: '1024x1024', quality: 'medium', n: 1 }),
  });
  const json = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!response.ok || !b64) {
    console.error(`${name}: error ${response.status} ${json.error?.message || ''}`);
    continue;
  }
  await writeFile(new URL(`../docs/cyclist-styles/${name}.png`, import.meta.url), Buffer.from(b64, 'base64'));
  console.log(`${name}: ok`);
}
