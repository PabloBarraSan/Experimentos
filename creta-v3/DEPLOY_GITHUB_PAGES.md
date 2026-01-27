# 🚀 Deploy en GitHub Pages - Creta v3

## 📍 Ruta de la Aplicación

### ✅ Carpeta Renombrada

La carpeta ha sido renombrada de **"Creta v3"** a **"creta-v3"** para una URL más limpia.

### URL en GitHub Pages

Una vez activado GitHub Pages, la aplicación estará disponible en:

```
https://PabloBarraSan.github.io/Experimentos/creta-v3/
```

**✅ URL limpia sin espacios ni caracteres especiales.**

## ✅ Verificación de Rutas

El proyecto **ya está listo** para GitHub Pages porque:

- ✅ `index.html` usa rutas relativas (`css/styles.css`, `js/app.js`)
- ✅ Los imports en JavaScript son relativos (`./api.js`, `../DView/...`)
- ✅ No hay rutas absolutas problemáticas
- ✅ No es una PWA (no necesita manifest.json ni service worker)

## 📋 Pasos para Activar GitHub Pages

1. **Hacer commit y push del cambio de nombre:**
   ```bash
   cd /home/admin01/Documentos/experimentos
   git add creta-v3/
   git commit -m "Renombrar carpeta Creta v3 a creta-v3 para GitHub Pages"
   git push origin main
   ```

2. **Activar GitHub Pages:**
   - Ve a: https://github.com/PabloBarraSan/Experimentos/settings/pages
   - En **Source**, selecciona:
     - **Branch:** `main`
     - **Folder:** `/ (root)`
   - Click en **Save**

3. **Acceder a la app:**
   ```
   https://PabloBarraSan.github.io/Experimentos/creta-v3/
   ```

## 🔗 URL Final

La carpeta ha sido renombrada a `creta-v3`, por lo que la URL es:

| Nombre de Carpeta | URL |
|-------------------|-----|
| `creta-v3` ✅ (actual) | `https://PabloBarraSan.github.io/Experimentos/creta-v3/` |

## ✅ Verificación Post-Deploy

Una vez activado GitHub Pages:

1. **Verifica que la app carga:**
   - Abre la URL en el navegador
   - Debe cargar sin errores en la consola

2. **Verifica los recursos:**
   - CSS debe cargar correctamente
   - JavaScript debe ejecutarse
   - Las imágenes/iconos deben mostrarse

3. **Verifica la API:**
   - La app hace llamadas a: `https://public.digitalvalue.es:8867/v2/pinto`
   - Verifica que las peticiones se realicen correctamente

## 🐛 Solución de Problemas

### La app no carga

1. **Verifica la URL:** Debe ser exactamente `https://PabloBarraSan.github.io/Experimentos/creta-v3/`
2. **Espera unos minutos:** GitHub Pages puede tardar en propagar cambios
3. **Limpia la caché:** Ctrl+Shift+R (o Cmd+Shift+R en Mac)

### Los recursos no cargan (CSS/JS)

1. Abre DevTools (F12) → Network
2. Verifica que los archivos CSS y JS se carguen correctamente
3. Si hay errores 404, verifica que las rutas sean relativas (no absolutas)

### Errores de CORS con la API

- La API está en: `https://public.digitalvalue.es:8867/v2/pinto`
- Si hay errores de CORS, el servidor de la API debe permitir requests desde GitHub Pages
- Verifica los headers CORS en el servidor de la API

## 📝 Notas Importantes

- **No es una PWA:** Esta app no tiene manifest.json ni service worker, por lo que no se puede instalar como app
- **HTTPS:** GitHub Pages proporciona HTTPS automáticamente ✅
- **Rutas relativas:** Todo está configurado con rutas relativas, así que funcionará en cualquier subdirectorio
- **API Externa:** La app depende de una API externa, asegúrate de que esté accesible

## 🔄 Actualizar la App

Cada vez que hagas cambios:

```bash
cd /home/admin01/Documentos/experimentos
git add creta-v3/
git commit -m "Descripción de los cambios"
git push origin main
```

GitHub Pages actualizará automáticamente en 1-2 minutos.

---

*Última actualización: Enero 2026*
