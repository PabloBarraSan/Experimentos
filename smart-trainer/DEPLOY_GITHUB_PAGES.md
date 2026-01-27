# 🚀 Deploy en GitHub Pages - Smart Trainer

## ✅ Configuración Completada

Las rutas ya están ajustadas para GitHub Pages:
- ✅ `manifest.json` - Rutas actualizadas a `/Experimentos/smart-trainer/`
- ✅ `sw.js` - Service Worker con rutas correctas
- ✅ `index.html` - Usa rutas relativas (correcto)

## 📋 Pasos para Activar GitHub Pages

### 1. Verificar que los archivos estén en el repositorio

```bash
cd /home/admin01/Documentos/experimentos
git status
```

### 2. Hacer commit de los cambios (si hay cambios pendientes)

```bash
git add smart-trainer/
git commit -m "Ajustar rutas para GitHub Pages"
git push origin main
```

### 3. Activar GitHub Pages en el repositorio

1. Ve a: https://github.com/PabloBarraSan/Experimentos/settings/pages
2. En **Source**, selecciona:
   - **Branch:** `main` (o la rama que uses)
   - **Folder:** `/ (root)` (porque la carpeta smart-trainer está en la raíz)
3. Click en **Save**

### 4. Esperar el deploy

- GitHub Pages tarda 1-2 minutos en hacer el deploy
- Verás un mensaje verde cuando esté listo
- La URL será: `https://PabloBarraSan.github.io/Experimentos/smart-trainer/`

## 🔗 URL de la App

Una vez activado, la app estará disponible en:

**🌐 URL Principal:**
```
https://PabloBarraSan.github.io/Experimentos/smart-trainer/
```

## 📱 Usar desde el Móvil

### Paso 1: Abrir en Chrome (Android)

1. Abre Chrome en tu móvil Android
2. Navega a: `https://PabloBarraSan.github.io/Experimentos/smart-trainer/`
3. Verifica que cargue correctamente

### Paso 2: Instalar como PWA

1. Chrome mostrará un banner "Agregar a pantalla de inicio"
   - O ve al menú (⋮) → "Agregar a pantalla de inicio"
2. Confirma la instalación
3. La app aparecerá como un icono en tu pantalla de inicio

### Paso 3: Conectar el Rodillo

1. Abre la app desde el icono
2. Asegúrate de que Bluetooth esté activado
3. Concede permisos de ubicación (requerido para Bluetooth en Android)
4. Toca "Conectar" y selecciona tu rodillo Decathlon D100

## ✅ Verificación

### Checklist Pre-Deploy

- [x] Rutas en `manifest.json` actualizadas a `/Experimentos/smart-trainer/`
- [x] Rutas en `sw.js` actualizadas
- [x] `index.html` usa rutas relativas
- [ ] Cambios commiteados y pusheados a GitHub
- [ ] GitHub Pages activado en Settings

### Checklist Post-Deploy

- [ ] La app carga en: `https://PabloBarraSan.github.io/Experimentos/smart-trainer/`
- [ ] El Service Worker se registra (ver consola del navegador)
- [ ] El manifest.json se carga (DevTools → Application → Manifest)
- [ ] La app se puede instalar como PWA
- [ ] Funciona en Chrome Android
- [ ] Bluetooth se puede activar

## 🐛 Solución de Problemas

### La app no carga

1. **Verifica la URL:** Debe ser exactamente `/Experimentos/smart-trainer/` (con mayúscula E)
2. **Espera unos minutos:** GitHub Pages puede tardar en propagar cambios
3. **Limpia la caché:** Ctrl+Shift+R (o Cmd+Shift+R en Mac)

### El Service Worker no se registra

1. Abre DevTools (F12)
2. Ve a Application → Service Workers
3. Verifica que no haya errores
4. Si hay errores, revisa la consola

### Web Bluetooth no funciona

- ✅ Verifica que estés en HTTPS (GitHub Pages lo proporciona automáticamente)
- ✅ Usa Chrome o Edge en Android (no Safari iOS)
- ✅ Concede permisos de ubicación (requerido para Bluetooth)

### La app no se instala como PWA

1. Verifica que el manifest.json sea válido:
   - DevTools → Application → Manifest
   - No debe haber errores
2. Verifica que tengas un icono válido (ya está configurado)
3. La app debe cumplir los criterios de instalabilidad

## 🔄 Actualizar la App

Cada vez que hagas cambios:

```bash
cd /home/admin01/Documentos/experimentos
git add smart-trainer/
git commit -m "Descripción de los cambios"
git push origin main
```

GitHub Pages actualizará automáticamente en 1-2 minutos.

## 📝 Notas Importantes

- **HTTPS:** GitHub Pages proporciona HTTPS automáticamente ✅
- **iOS:** No funciona en Safari iOS (Web Bluetooth no soportado)
- **Offline:** Una vez instalada, la app puede funcionar offline gracias al Service Worker
- **Actualizaciones:** Para forzar actualización, desinstala y reinstala la PWA

## 🎯 Próximos Pasos

1. Activa GitHub Pages siguiendo los pasos arriba
2. Prueba la app desde tu móvil
3. Conecta tu rodillo Decathlon D100
4. ¡Disfruta entrenando! 🚴

---

*Última actualización: Enero 2026*
