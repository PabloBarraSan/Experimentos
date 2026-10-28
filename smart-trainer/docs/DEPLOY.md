# Despliegue de smart-trainer

Producción: https://rodillo.kitraining.app (sitio estático en el Plesk de kitraining.app).

## Flujo

1. Push a `main` que toque `smart-trainer/**`.
2. GitHub Action `.github/workflows/deploy-rodillo.yml`: `npm ci`, `npm test`, `npm run build`, y publica solo el sitio
   (sin `server/` ni `.map`, con `.htaccess` y `version.txt`) en la rama `deploy-rodillo`.
3. El webhook de GitHub avisa a Plesk (Git del subdominio, rama `deploy-rodillo`, ruta `/rodillo.kitraining.app`), que hace pull y despliega.

Si fallan los tests, no se publica nada. `https://rodillo.kitraining.app/version.txt` contiene el SHA desplegado.

## Conexión con training-app

La app habla con `https://app.kitraining.app` (login y `/api/smart-trainer/*`). El origen `https://rodillo.kitraining.app`
está permitido en `backend/config.js` de training-app (CORS).

## Cosas a tener en cuenta

- Al crear el repo en Plesk la rama por defecto es `main`: hay que cambiarla a `deploy-rodillo` o se despliega todo el repositorio.
- El certificado es Let's Encrypt gestionado por el hosting; caduca el 26/01/2027 y se renueva desde Plesk.
