// Compara modelos de imagen con el mismo prompt (solo uso local).
// Uso: node --env-file=.env.local scripts/compare-image-models.mjs
import { writeFile } from 'node:fs/promises';

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('Falta OPENAI_API_KEY en .env.local');

const MODELS = ['gpt-image-1', 'gpt-image-1.5', 'gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'chatgpt-image-latest'];
const PROMPT = 'Game character design reference for an indoor cycling game like Zwift: a road cyclist on a road bike '
  + 'seen from a three-quarter rear view, riding on tarmac. Stylized but realistic 3D game avatar, natural adult proportions, '
  + 'smooth soft shading with subtle realistic lighting, no outlines, no cartoon look. Mint green short-sleeve cycling jersey, '
  + 'black bib shorts, white aero helmet, white socks, black cycling shoes, sunglasses. Clean studio background in muted teal, '
  + 'full body and bike visible, no text, no watermark.';

for (const model of MODELS) {
  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt: PROMPT, size: '1024x1024', n: 1 }),
  });
  const json = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  if (!response.ok || !b64) {
    console.log(`${model}: error ${response.status} ${json.error?.message || ''}`.slice(0, 200));
    continue;
  }
  await writeFile(new URL(`../docs/cyclist-models/${model}.png`, import.meta.url), Buffer.from(b64, 'base64'));
  console.log(`${model}: ok (${seconds}s)`);
}
