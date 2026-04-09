# Plan: Migración de React a MithrilJS

## Contexto

El proyecto `contratacion-publica` es una aplicación React de ~960 líneas que consulta una API de contratación pública española. Se quiere migrar a **MithrilJS** para eliminar la dependencia de React (~40KB) y usar un framework más ligero (~3KB).

---

## Arquitectura propuesta

### Estructura de archivos (nueva)

```
contratacion-publica/
├── index.html              # Entry point (modificado)
├── src/
│   ├── api.js              # Sin cambios (ya era vanilla JS)
│   ├── app.js              # Componente principal (era App.jsx)
│   ├── components/
│   │   ├── SearchBar.js    # (era SearchBar.jsx)
│   │   ├── LicitacionCard.js
│   │   ├── LicitacionModal.js
│   │   └── Pagination.js   # Extraer paginación como componente
│   ├── hooks/
│   │   └── licitaciones.js # Hook migrado a Mithril (era useLicitaciones.js)
│   └── styles/
│       └── index.css       # Sin cambios
├── package.json            # Simplificado (sin React)
└── vite.config.js          # Eliminado (no necesitamos Vite si usamos CDN)
```

**Alternativa sin Vite:** Si solo necesitamos HTML + JS vanilla/Mithril CDN, podemos eliminar `vite.config.js` y `package.json` casi por completo.

---

## Paso a paso

### 1. Crear `index.html` con Mithril CDN

```html
<script src="https://unpkg.com/mithril@2.2.2/mithril.js"></script>
<script type="module" src="src/app.js"></script>
```

El `<div id="root">` permanece igual.

### 2. Migrar `useLicitaciones.js` → `src/hooks/licitaciones.js`

**React (actual):**
```javascript
export function useLicitaciones() {
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const filtrosRef = useRef({...})
  const [filtros, setFiltrosState] = useState(filtrosRef.current)

  const buscar = useCallback(async () => {
    setLoading(true)
    // ...
  }, [])

  // ...
  return { licitaciones, loading, error, filtros, ... }
}
```

**Mithril (nuevo):**
```javascript
// Mithril no tiene hooks, usamos un módulo de estado singleton
const state = {
  licitaciones: [],
  loading: false,
  error: null,
  page: 1,
  filtros: { query: '', winningparty: '', contractingparty: '', cpv: '300', ... },
}

export async function buscar() {
  state.loading = true
  m.redraw()
  try {
    const data = await buscarLicitaciones(state.filtros)
    state.licitaciones = Array.isArray(data) ? data : []
  } catch (err) {
    state.error = err.message
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
```

### 3. Migrar componentes JSX → Mithril hyperscript

| Archivo | Cambio |
|---------|--------|
| `App.jsx` → `app.js` | `m.mount(document.getElementById('root'), { view: () => ... })` |
| `SearchBar.jsx` → `SearchBar.js` | Función que retorna `m('div.search-bar', ...)` |
| `LicitacionCard.jsx` → `LicitacionCard.js` | Función que retorna `m('article.licitacion-card', ...)` |
| `LicitacionModal.jsx` → `LicitacionModal.js` | Modal con `onclick` en backdrop |

**Patrones clave de migración:**

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

### 4. Simplificar `package.json`

Eliminar React y Vite plugin-react:
```json
{
  "name": "contratacion-publica",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^6.0.5"
  }
}
```

Opcional: eliminar Vite también y usar solo HTML + CDN de Mithril.

### 5. CSS

`index.css` **no cambia**.

---

## Archivos a modificar

| Acción | Archivo |
|--------|---------|
| Reescribir | `index.html` - agregar CDN de Mithril |
| Reescribir | `src/main.jsx` → `src/app.js` (componente raíz) |
| Reescribir | `src/App.jsx` → `src/app.js` |
| Reescribir | `src/hooks/useLicitaciones.js` → `src/hooks/licitaciones.js` |
| Reescribir | `src/components/SearchBar.jsx` → `src/components/SearchBar.js` |
| Reescribir | `src/components/LicitacionCard.jsx` → `src/components/LitacionCard.js` |
| Reescribir | `src/components/LicitacionModal.jsx` → `src/components/LicitacionModal.js` |
| Reescribir | `src/components/Pagination.js` (nuevo, extraído de App) |
| Modificar | `package.json` - eliminar React |
| Modificar | `vite.config.js` - eliminar plugin-react |
| Eliminar | `src/main.jsx` |

---

## Verificación

1. `npm run dev` - debe servir sin errores
2. `npm run build` - debe generar `dist/` funcional
3. Probar flujo completo:
   - Buscar licitaciones
   - Filtrar por CPV, estado, tipo, fechas
   - Navegar paginación
   - Abrir modal de detalle
   - Ver sección "Potenciales"
4. Verificar que el campo `contractingparty` se envía correctamente en la API

---

## Alternatives considered

1. **Vanilla JS puro**: Descartado por el boilerplate excesivo de DOM manipulation
2. **React vanilla (sin JSX)**: Mantiene dependencia de React
3. **CDN-only (sin build)**: Viable pero pierde optimizations de Vite
