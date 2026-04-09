import { useCpvArbol } from '../hooks/useLicitaciones'

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'PRE', label: 'Anuncio Previo' },
  { value: 'PUB', label: 'En plazo' },
  { value: 'EV', label: 'Pendiente Adjudicación' },
  { value: 'ADJ', label: 'Adjudicada' },
  { value: 'RES', label: 'Resuelta' },
  { value: 'ANUL', label: 'Anulada' },
]

const TIPOS = [
  { value: '', label: 'Todos' },
  { value: '1', label: 'Suministros' },
  { value: '2', label: 'Servicios' },
  { value: '3', label: 'Obras' },
  { value: '21', label: 'Gestión Servicios' },
  { value: '22', label: 'Concesión Servicios' },
  { value: '31', label: 'Concesión Obras' },
  { value: '32', label: 'Conces. Obras Públ.' },
  { value: '40', label: 'Colaboración' },
  { value: '7', label: 'Administrativo' },
  { value: '8', label: 'Privado' },
  { value: '50', label: 'Patrimonial' },
  { value: '999', label: 'Otros' },
]

export function SearchBar({ filtros, onFiltroChange, onBuscar, onLimpiar }) {
  const { cpvArbol } = useCpvArbol()

  // Genera opciones planas del árbol CPV
  const cpvOptions = []
  if (cpvArbol && typeof cpvArbol === 'object') {
    Object.entries(cpvArbol).forEach(([codigo, datos]) => {
      cpvOptions.push({ value: codigo, label: `${codigo} ${datos.name}` })
      if (datos.children) {
        Object.entries(datos.children).forEach(([subCodigo, subDatos]) => {
          cpvOptions.push({ value: subCodigo, label: `  ${subCodigo} ${subDatos.name}` })
        })
      }
    })
  }

  return (
    <div className="search-bar">
      <div className="filter-group">
        <div className="filter-field">
          <label className="filter-label">Organismo</label>
          <input
            type="search"
            placeholder="Ayuntamiento, Generalitat..."
            value={filtros.query}
            onChange={e => onFiltroChange('query', e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-field">
          <label className="filter-label">Empresa</label>
          <input
            type="text"
            placeholder="Nombre empresa..."
            value={filtros.winningparty}
            onChange={e => onFiltroChange('winningparty', e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-field">
          <label className="filter-label">Desde</label>
          <input
            type="date"
            value={filtros.datefrom}
            onChange={e => onFiltroChange('datefrom', e.target.value)}
            className="filter-input"
          />
        </div>
        <div className="filter-field">
          <label className="filter-label">Hasta</label>
          <input
            type="date"
            value={filtros.dateto}
            onChange={e => onFiltroChange('dateto', e.target.value)}
            className="filter-input"
          />
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-field">
          <label className="filter-label">Categoría CPV</label>
          <select
            value={filtros.cpv}
            onChange={e => onFiltroChange('cpv', e.target.value)}
            className="filter-select"
          >
            <option value="">Todas</option>
            {cpvOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label className="filter-label">Estado</label>
          <select
            value={filtros.status}
            onChange={e => onFiltroChange('status', e.target.value)}
            className="filter-select"
          >
            {ESTADOS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label className="filter-label">Tipo</label>
          <select
            value={filtros.typecode}
            onChange={e => onFiltroChange('typecode', e.target.value)}
            className="filter-select"
          >
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="btn-group">
          <button onClick={onLimpiar} className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
            </svg>
            Limpiar
          </button>
          <button onClick={onBuscar} className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Buscar
          </button>
        </div>
      </div>
    </div>
  )
}
