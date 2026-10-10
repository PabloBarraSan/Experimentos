// Genera las imágenes de entrada (T-pose, de frente y de espaldas) para crear el avatar con un servicio de imagen a 3D.
// Uso: node --env-file=.env.local scripts/generate-avatar-inputs.mjs
import { writeFile } from 'node:fs/promises';

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('Falta OPENAI_API_KEY en .env.local');

const BASE = 'Full-body character reference for a 3D game avatar: an adult road cyclist standing in a neutral T-pose, '
  + 'arms straight out to the sides with open hands, legs slightly apart, feet pointing forward. Stylized realistic proportions, '
  + 'smooth skin, soft even studio lighting, plain light gray background, the whole body visible from head to shoes, no bicycle, '
  + 'no text, no watermark. Outfit: mint green short-sleeve cycling jersey, black bib shorts, white aero road helmet, '
  + 'dark sunglasses, white ankle socks, black cycling shoes, short dark hair. ';
const VIEWS = {
  front: 'Seen exactly from the front, centered, symmetrical.',
  back: 'Seen exactly from behind, centered, symmetrical, same character and outfit.',
};

for (const [name, view] of Object.entries(VIEWS)) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: BASE + view, size: '1024x1024', n: 1 }),
  });
  const json = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!response.ok || !b64) {
    console.log(`${name}: error ${response.status} ${json.error?.message || ''}`.slice(0, 200));
    continue;
  }
  await writeFile(new URL(`../docs/avatar-inputs/${name}.png`, import.meta.url), Buffer.from(b64, 'base64'));
  console.log(`${name}: ok`);
}
