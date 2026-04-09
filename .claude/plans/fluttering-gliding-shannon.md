# Plan: Migración de React a MithrilJS (CDN-only)

## Contexto

El proyecto `contratacion-publica` es una aplicación React de ~960 líneas que consulta una API de contratación pública española. Se quiere migrar a **MithrilJS** para eliminar la dependencia de React (~40KB) y usar un framework más ligero (~3KB). Se usará **CDN-only** (sin build) para máxima simplicidad.

---

## Arquitectura propuesta

### Estructura final

```
contratacion-publica/
├── index.html          # Entry point con Mithril CDN
├── favicon.svg
└── src/
    ├── app.js          # Componente raíz + estado global
    ├── api.js          # Sin cambios
    ├── hooks/
    │   └── licitaciones.js  # Estado singleton (era useLicitaciones.js)
    ├── components/
    │   ├── SearchBar.js
    │   ├── LicitacionCard.js
    │   ├── LicitacionModal.js
    │   └── Pagination.js
    └── index.css       # Sin cambios
```

**Se eliminan:** `package.json`, `vite.config.js`, `node_modules/`, `src/main.jsx`, `src/App.jsx`, `src/hooks/useLicitaciones.js`, `src/components/*.jsx`

---

## Paso a paso

### 1. Reescribir `index.html`

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Buscador de Licitaciones - Contratación Pública</title>
    <link rel="stylesheet" href="./src/index.css">
  </head>
  <body>
    <div id="root"></div>
    <script src="https://unpkg.com/mithril@2.2.2/mithril.js"></script>
    <script type="module" src="./src/app.js"></script>
  </body>
</html>
```

### 2. Reescribir `src/hooks/licitaciones.js`

Estado como módulo singleton (sin hooks React):

```javascript
import { buscarLicitaciones } from '../api.js'
import m from 'mithril'

const LIMIT = 20

const state = {
  allResults: [],
  loading: false,
  error: null,
  page: 1,
  filtros: {
    query: '',
    winningparty: '',
    contractingparty: '',
    cpv: '300',
    status: '',
    typecode: '',
    datefrom: '',
    dateto: '',
  },
}

export async function buscar() {
  state.loading = true
  state.error = null
  m.redraw()
  try {
    const data = await buscarLicitaciones(state.filtros)
    state.allResults = Array.isArray(data) ? data : []
    state.page = 1
  } catch (err) {
    if (err.message.includes('DEBE INDICAR')) {
      state.error = 'Indica al menos un filtro para buscar'
      state.allResults = []
    } else {
      state.error = err.message
    }
  } finally {
    state.loading = false
    m.redraw()
  }
}

export function actualizarFiltro(clave, valor) {
  state.filtros[clave] = valor
  state.page = 1
  buscar()
}

export function cambiarPagina(nuevaPage) {
  state.page = nuevaPage
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export function getState() { return state }
export function getLimit() { return LIMIT }
```

### 3. Reescribir `src/app.js` - Componente raíz

Contiene todo el layout y orchestration. Usa `m.mount()`.

### 4. Reescribir componentes en `src/components/`

| Archivo | Descripción |
|---------|-------------|
| `SearchBar.js` | Filtros: query, winningparty, contractingparty, cpv, status, typecode, datefrom, dateto |
| `LicitacionCard.js` | Tarjeta de licitacion (presentacional) |
| `LicitacionModal.js` | Modal de detalle con backdrop click |
| `Pagination.js` | Navegación de páginas reutilizable |

### 5. Migrar lógica de App.jsx

El estado `mostrarPotenciales`, `potenciales`, `loadingPotenciales`, `selectedLicitacion`, `pagePotenciales` pasa a `state` en `app.js`.

---

## Patrones de migración JSX → Mithril

| JSX React | Mithril |
|-----------|---------|
| `<div className="foo">` | `m('div.foo', ...)` |
| `<Component prop={x} />` | `m(Component, { prop: x })` |
| `{condition && <Comp />}` | `condition ? m(Comp, props) : null` |
| `{list.map((item, i) => <Item key={i} />)}` | `list.map((item, i) => m(Item, { key: i, ...item }))` |
| `onClick={handler}` | `onclick: handler` |
| `onChange={e => fn(e.target.value)}` | `oninput: (e) => fn(e.target.value)` |
| `<input value={x} onChange={...} />` | `m('input', { value: x, oninput: ... })` |
| `<select value={x} onChange={...}>` | `m('select', { value: x, onchange: ... }, options)` |

---

## Archivos a modificar

| Acción | Archivo |
|--------|---------|
| Reescribir | `index.html` |
| Crear | `src/app.js` |
| Crear | `src/hooks/licitaciones.js` |
| Crear | `src/components/SearchBar.js` |
| Crear | `src/components/LicitacionCard.js` |
| Crear | `src/components/LicitacionModal.js` |
| Crear | `src/components/Pagination.js` |
| Eliminar | `src/main.jsx`, `src/App.jsx`, `src/hooks/useLicitaciones.js` |
| Eliminar | `src/components/SearchBar.jsx`, `src/components/LicitacionCard.jsx`, `src/components/LicitacionModal.jsx` |
| Eliminar | `vite.config.js`, `package.json`, `package-lock.json` |
| Sin cambios | `src/api.js`, `src/index.css` |

---

## Verificación

1. Abrir `index.html` directamente en navegador (no hay server necesario)
2. Buscar licitaciones
3. Filtrar por CPV, estado, tipo, fechas
4. Navegar paginación
5. Abrir modal de detalle
6. Ver sección "Potenciales"
7. Verificar que `contractingparty` se envía correctamente

---

## Alternativas descartadas

- **Vanilla JS puro**: Boilerplate excesivo de DOM
- **Mantener React**: Objetivo era eliminar la dependencia
- **Vite + Mithril npm**: Se quiso simplicidad máxima con CDN
