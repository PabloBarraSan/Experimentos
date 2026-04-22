import React, { useState } from 'react';
import { 
  X, Save, FileText, Image as ImageIcon, MapPin, 
  Tags, Settings, Plus, Globe, HelpCircle, 
  ChevronRight, Type, Calendar, Link as LinkIcon,
  MoreVertical
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('contenido');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Definición de las pestañas
  const tabs = [
    { id: 'contenido', label: 'Contenido' },
    { id: 'multimedia', label: 'Multimedia' },
    { id: 'ubicacion', label: 'Ubicación' },
    { id: 'relaciones', label: 'Relaciones' },
    { id: 'avanzado', label: 'Avanzado' },
  ];

  return (
    <>
      {/* ESTILOS CSS PREMIUM (Custom SaaS Design) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap');

        :root {
          --brand-primary: #2563eb;
          --brand-primary-hover: #1d4ed8;
          --text-main: #1e293b;
          --text-muted: #64748b;
          --border-color: #e2e8f0;
          --bg-panel: #ffffff;
          --bg-body: #f8fafc;
          --bg-hover: #f1f5f9;
          --radius: 6px;
          --font-family: 'Lato', sans-serif;
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          --shadow-panel: -4px 0 24px rgba(0, 0, 0, 0.06);
          --focus-ring: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        /* Reset básico y Layout */
        body { margin: 0; background-color: #e5e5e5; font-family: var(--font-family); color: var(--text-main); }
        .app-container { display: flex; height: 100vh; overflow: hidden; }
        .fake-dashboard { flex: 1; padding: 30px; opacity: 0.4; pointer-events: none; }
        
        /* Panel Lateral CMS */
        .cms-panel {
          width: 600px;
          background: var(--bg-body);
          border-left: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-panel);
          transform: translateX(0);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cms-panel.closed { transform: translateX(100%); }

        /* --- CABECERA SUPERIOR (TOP) --- */
        .cms-header {
          padding: 16px 24px;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }
        .header-title-group { display: flex; flex-direction: column; gap: 4px; }
        .cms-header-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main); letter-spacing: -0.2px; }
        .cms-header-meta { font-size: 12px; color: var(--text-muted); }
        
        .header-actions { display: flex; align-items: center; gap: 8px; }
        
        /* Botones Top */
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer;
          border-radius: var(--radius); font-family: var(--font-family);
          transition: all 0.2s; border: 1px solid transparent;
        }
        .btn-primary {
          background: var(--brand-primary); color: #fff; box-shadow: var(--shadow-sm);
        }
        .btn-primary:hover { background: var(--brand-primary-hover); }
        .btn-icon {
          padding: 6px; background: transparent; border: 1px solid transparent;
          color: var(--text-muted); border-radius: var(--radius); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .btn-icon:hover { background: var(--bg-hover); color: var(--text-main); }
        .btn-secondary {
          background: #fff; color: var(--text-main); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);
        }
        .btn-secondary:hover { background: var(--bg-hover); }

        .divider-vertical { width: 1px; height: 24px; background: var(--border-color); margin: 0 4px; }

        /* --- PESTAÑAS (TABS) --- */
        .cms-tabs {
          display: flex;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border-color);
          padding: 0 16px;
        }
        .cms-tab {
          background: transparent; border: none; padding: 14px 16px;
          font-size: 13px; font-weight: 700; color: var(--text-muted);
          cursor: pointer; position: relative; font-family: var(--font-family);
          transition: color 0.2s;
        }
        .cms-tab:hover { color: var(--text-main); }
        .cms-tab.active { color: var(--brand-primary); }
        .cms-tab.active::after {
          content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
          height: 2px; background: var(--brand-primary); border-radius: 2px 2px 0 0;
        }

        /* --- ÁREA DE CONTENIDO --- */
        .cms-body {
          flex: 1; overflow-y: auto; padding: 32px 40px;
        }

        /* Elementos de Formulario Premium */
        .form-section { display: flex; flex-direction: column; gap: 24px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        
        .form-label-wrapper { display: flex; align-items: center; gap: 6px; }
        .form-label { 
          font-size: 11px; font-weight: 700; color: var(--text-muted); 
          text-transform: uppercase; letter-spacing: 0.5px; margin: 0; 
        }
        .required { color: #ef4444; }
        
        .help-icon { color: #cbd5e1; cursor: help; display: inline-flex; transition: color 0.2s; }
        .help-icon:hover { color: var(--brand-primary); }

        /* Inputs */
        .form-control {
          width: 100%; padding: 10px 12px; font-size: 14px;
          border: 1px solid var(--border-color); border-radius: var(--radius);
          box-sizing: border-box; font-family: var(--font-family); color: var(--text-main);
          background: #fff; transition: all 0.2s; box-shadow: var(--shadow-sm);
        }
        .form-control:focus { 
          outline: none; border-color: var(--brand-primary); 
          box-shadow: var(--focus-ring);
        }
        .form-control::placeholder { color: #94a3b8; }
        textarea.form-control { resize: vertical; min-height: 48px; }

        /* Layout Grid */
        .row { display: flex; gap: 16px; }
        .col { flex: 1; min-width: 0; }

        /* Input con botón (ej. Idioma) */
        .input-group { display: flex; box-shadow: var(--shadow-sm); border-radius: var(--radius); }
        .input-group .form-control { border-right: none; border-radius: var(--radius) 0 0 var(--radius); box-shadow: none; }
        .input-group-addon {
          background: #f8fafc; border: 1px solid var(--border-color);
          padding: 0 14px; font-size: 12px; font-weight: 700; color: var(--text-muted);
          border-radius: 0 var(--radius) var(--radius) 0; display: flex; align-items: center;
        }

        /* Editor de Texto Simulado */
        .editor-box { border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-sm); }
        .editor-toolbar {
          background: var(--bg-panel); border-bottom: 1px solid var(--border-color);
          padding: 8px; display: flex; gap: 4px; align-items: center;
        }
        .toolbar-btn {
          background: transparent; border: none; cursor: pointer;
          padding: 6px; border-radius: 4px; font-size: 13px; color: var(--text-muted);
          display: flex; align-items: center; justify-content: center; min-width: 28px;
        }
        .toolbar-btn:hover { background: var(--bg-hover); color: var(--text-main); }
        .editor-content { padding: 16px; min-height: 200px; font-size: 15px; line-height: 1.5; color: var(--text-main); background: #fff; }
        .editor-content:focus { outline: none; }

        /* Listas y Relaciones */
        .section-title {
          font-size: 15px; font-weight: 700; color: var(--text-main);
          border-bottom: 2px solid var(--border-color); padding-bottom: 8px; margin: 32px 0 16px 0;
          display: flex; justify-content: space-between; align-items: center;
        }
        
        .list-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; background: #fff; border: 1px solid var(--border-color);
          border-radius: var(--radius); margin-bottom: 8px; box-shadow: var(--shadow-sm);
        }
        .list-item-title { font-size: 13px; font-weight: 700; color: var(--text-main); }

        .empty-state {
          padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;
          background: transparent; border: 1px dashed #cbd5e1; border-radius: var(--radius);
        }

        /* Mapa / Coordenadas */
        .map-placeholder {
          height: 160px; background: #e2e8f0; border: 1px solid var(--border-color);
          display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b;
          border-radius: var(--radius); gap: 8px; font-size: 13px; font-weight: 700;
        }

        /* Etiquetas (Tags) */
        .tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .tag {
          background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8;
          padding: 4px 10px; font-size: 12px; font-weight: 700; border-radius: 100px; display: flex; align-items: center; gap: 6px;
        }
        .tag-remove { cursor: pointer; color: #3b82f6; display: flex; align-items: center; }
        .tag-remove:hover { color: #dc2626; }
        
        /* Alert/Info box */
        .info-box {
          background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px;
          border-radius: var(--radius); font-size: 13px; color: #166534; display: flex; gap: 12px; align-items: flex-start;
        }
      `}</style>

      {/* Fondo Falso para contexto */}
      <div className="app-container">
        <div className="fake-dashboard">
          <h1 style={{ fontFamily: "'Lato', sans-serif", fontWeight: 900 }}>Gestor de Contenidos</h1>
          <p style={{ fontFamily: "'Lato', sans-serif" }}>El panel lateral ahora tiene un diseño limpio, profesional y tipografía Lato.</p>
        </div>

        {/* PANEL CMS REDISEÑADO */}
        <div className={`cms-panel ${isSidebarOpen ? '' : 'closed'}`}>
          
          {/* --- CABECERA TOP --- */}
          <div className="cms-header">
            <div className="header-title-group">
              <h2 className="cms-header-title">Editando: Nueva infraestructura</h2>
              <span className="cms-header-meta">ID: 45091 • Modificado hace 5 min</span>
            </div>
            
            <div className="header-actions">
              <div className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'default' }} title="Idioma actual">
                <Globe size={14} color="#2563eb" /> ES
              </div>
              
              <div className="divider-vertical"></div>

              {/* ACCIONES DE GUARDADO MOVIDAS AQUÍ ARRIBA */}
              <button className="btn btn-primary"><Save size={16} /> Guardar</button>
              <button className="btn-icon" title="Más opciones"><MoreVertical size={18} /></button>
              
              <div className="divider-vertical"></div>

              <button className="btn-icon" onClick={() => setIsSidebarOpen(false)} title="Cerrar panel">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navegación por Pestañas */}
          <div className="cms-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`cms-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Área Principal de Formulario */}
          <div className="cms-body">
            
            {/* PESTAÑA: CONTENIDO */}
            {activeTab === 'contenido' && (
              <div className="form-section">
                
                <div className="form-group">
                  <div className="form-label-wrapper">
                    <label className="form-label">Título <span className="required">*</span></label>
                    <span className="help-icon" title="Título principal del nodo"><HelpCircle size={14} /></span>
                  </div>
                  <div className="input-group">
                    <input type="text" className="form-control" defaultValue="Nueva infraestructura en Almassora" />
                    <div className="input-group-addon">ES</div>
                  </div>
                </div>

                <div className="row">
                  <div className="form-group col">
                    <div className="form-label-wrapper">
                      <label className="form-label">Subtítulo</label>
                      <span className="help-icon" title="Subtítulo opcional"><HelpCircle size={14} /></span>
                    </div>
                    <input type="text" className="form-control" />
                  </div>
                  <div className="form-group col">
                    <div className="form-label-wrapper">
                      <label className="form-label">Entradilla</label>
                      <span className="help-icon" title="Resumen para listados"><HelpCircle size={14} /></span>
                    </div>
                    <input type="text" className="form-control" />
                  </div>
                </div>

                <div className="form-group">
                  <div className="form-label-wrapper">
                    <label className="form-label">Cuerpo principal <span className="required">*</span></label>
                    <span className="help-icon" title="Editor de texto enriquecido"><HelpCircle size={14} /></span>
                  </div>
                  <div className="editor-box">
                    <div className="editor-toolbar">
                      <button className="toolbar-btn" style={{fontWeight: '900'}}>B</button>
                      <button className="toolbar-btn" style={{fontStyle: 'italic'}}>I</button>
                      <button className="toolbar-btn" style={{textDecoration: 'underline'}}>U</button>
                      <span style={{borderLeft: '1px solid var(--border-color)', margin: '0 4px', height: '16px'}}></span>
                      <select style={{fontSize: '13px', padding: '4px', border: 'none', background: 'transparent', fontFamily: 'inherit', color: 'var(--text-main)', cursor: 'pointer', outline: 'none'}}>
                        <option>Párrafo</option>
                        <option>Encabezado H2</option>
                        <option>Encabezado H3</option>
                      </select>
                    </div>
                    <div className="editor-content" contentEditable suppressContentEditableWarning={true}>
                      Escribe el contenido de la noticia aquí...
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ width: '50%' }}>
                  <div className="form-label-wrapper">
                    <label className="form-label">Fecha de publicación</label>
                  </div>
                  <input type="datetime-local" className="form-control" />
                </div>

                {/* --- NUEVA SECCIÓN DE CLASIFICACIÓN (MOVIDA AQUÍ) --- */}
                <div className="section-title">Clasificación del Contenido</div>
                
                <div className="row">
                  <div className="form-group col">
                    <div className="form-label-wrapper">
                      <label className="form-label">Tipo del Nodo</label>
                    </div>
                    <div className="tag-list">
                      <span className="tag">Noticia <span className="tag-remove"><X size={14} /></span></span>
                    </div>
                    <input type="text" className="form-control" placeholder="Añadir tipo..." style={{ marginTop: '12px' }} />
                  </div>

                  <div className="form-group col">
                    <div className="form-label-wrapper">
                      <label className="form-label">Categorías</label>
                    </div>
                    <input type="text" className="form-control" placeholder="Buscar o añadir categoría..." />
                    <div className="empty-state" style={{ marginTop: '12px', padding: '12px' }}>No hay categorías asignadas.</div>
                  </div>
                </div>

                <div className="form-group">
                  <div className="form-label-wrapper">
                    <label className="form-label">Etiquetas (Tags)</label>
                  </div>
                  <input type="text" className="form-control" placeholder="Escribe y pulsa Enter para añadir..." />
                </div>

              </div>
            )}

            {/* PESTAÑA: MULTIMEDIA */}
            {activeTab === 'multimedia' && (
              <div className="form-section">
                
                <div className="form-group">
                  <div className="form-label-wrapper">
                    <label className="form-label">Imagen Principal</label>
                    <span className="help-icon" title="Imagen de cabecera del nodo"><HelpCircle size={14} /></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="btn btn-secondary"><ImageIcon size={16} /> Seleccionar Imagen</button>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Ninguna imagen seleccionada</span>
                  </div>
                </div>

                <div className="section-title">
                  Galería de Imágenes
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>
                <div className="empty-state">No hay imágenes en la galería.</div>

                <div className="section-title">
                  Vídeos
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>
                <div className="empty-state">No hay vídeos asignados.</div>

                <div className="section-title">
                  Ficheros y Documentos
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>
                <div className="empty-state">No hay ficheros adjuntos.</div>

              </div>
            )}

            {/* PESTAÑA: UBICACIÓN Y CONTACTO */}
            {activeTab === 'ubicacion' && (
              <div className="form-section">
                
                <div className="section-title" style={{ marginTop: 0 }}>Dirección Postal</div>
                
                <div className="row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Calle / Vía <span className="required">*</span></label>
                    <input type="text" className="form-control" />
                  </div>
                  <div className="form-group col">
                    <label className="form-label">C.P.</label>
                    <input type="text" className="form-control" />
                  </div>
                </div>

                <div className="row">
                  <div className="form-group col">
                    <label className="form-label">Población <span className="required">*</span></label>
                    <input type="text" className="form-control" />
                  </div>
                  <div className="form-group col">
                    <label className="form-label">Provincia</label>
                    <input type="text" className="form-control" />
                  </div>
                </div>

                <div className="row">
                  <div className="form-group col">
                    <label className="form-label">País</label>
                    <input type="text" className="form-control" defaultValue="España" />
                  </div>
                  <div className="form-group col">
                    <label className="form-label">Datos adicionales</label>
                    <input type="text" className="form-control" placeholder="Piso, puerta, etc."/>
                  </div>
                </div>

                <div className="section-title">
                  Coordenadas GPS
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><MapPin size={14}/> Calcular</button>
                </div>
                
                <div className="row">
                  <div className="form-group col">
                    <label className="form-label">Latitud</label>
                    <input type="text" className="form-control" />
                  </div>
                  <div className="form-group col">
                    <label className="form-label">Longitud</label>
                    <input type="text" className="form-control" />
                  </div>
                </div>
                <div className="map-placeholder">
                  <MapPin size={32} color="#94a3b8" />
                  Mapa de previsualización
                </div>

                <div className="section-title">Contacto</div>
                
                <div className="list-item">
                  <span className="list-item-title">Teléfonos</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>
                
                <div className="list-item">
                  <span className="list-item-title">Correos Electrónicos</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>

              </div>
            )}

            {/* PESTAÑA: RELACIONES (Antes Avanzado) */}
            {activeTab === 'relaciones' && (
              <div className="form-section">

                <div className="section-title" style={{ marginTop: 0 }}>Elementos Anexos</div>

                <div className="list-item">
                  <span className="list-item-title">Fechas de evento</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>
                <div className="list-item">
                  <span className="list-item-title">Enlaces externos</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>
                <div className="list-item">
                  <span className="list-item-title">Redes Sociales</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14} /> Añadir</button>
                </div>

                <div className="section-title">Grupos Estructurales</div>

                <div className="list-item">
                  <span className="list-item-title">Grupo de tablas</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14}/> Configurar</button>
                </div>
                <div className="list-item">
                  <span className="list-item-title">Grupo de entidades</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14}/> Configurar</button>
                </div>
                <div className="list-item">
                  <span className="list-item-title">Grupo de artículos</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14}/> Configurar</button>
                </div>
                <div className="list-item">
                  <span className="list-item-title">Grupo de ficheros</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px' }}><Plus size={14}/> Configurar</button>
                </div>

              </div>
            )}

            {/* PESTAÑA: NUEVO AVANZADO */}
            {activeTab === 'avanzado' && (
              <div className="form-section">
                
                <div className="info-box">
                  <Settings size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Ajustes del Sistema</strong>
                    Opciones de visibilidad, optimización para buscadores (SEO) y metadatos técnicos.
                  </div>
                </div>

                <div className="section-title" style={{ marginTop: 0 }}>Visibilidad y Estado</div>
                
                <div className="row">
                  <div className="form-group col">
                    <label className="form-label">Estado de Publicación</label>
                    <select className="form-control" defaultValue="Publicado">
                      <option value="Publicado">Publicado</option>
                      <option value="Borrador">Borrador</option>
                      <option value="Archivado">Archivado</option>
                    </select>
                  </div>
                  <div className="form-group col">
                    <label className="form-label">Visibilidad</label>
                    <select className="form-control" defaultValue="Público">
                      <option value="Público">Público</option>
                      <option value="Privado">Privado (Solo usuarios logueados)</option>
                    </select>
                  </div>
                </div>

                <div className="section-title">SEO y Enlaces</div>
                
                <div className="form-group">
                  <div className="form-label-wrapper">
                    <label className="form-label">URL Amigable (Slug)</label>
                    <span className="help-icon" title="Parte final de la dirección web"><HelpCircle size={14} /></span>
                  </div>
                  <div className="input-group">
                    <div className="input-group-addon" style={{ background: '#f8fafc', fontWeight: 'normal', color: '#94a3b8' }}>/noticias/</div>
                    <input type="text" className="form-control" defaultValue="nueva-infraestructura-almassora" />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Meta Título (SEO)</label>
                  <input type="text" className="form-control" placeholder="Dejar en blanco para usar el título principal" />
                </div>
                <div className="form-group">
                  <label className="form-label">Meta Descripción (SEO)</label>
                  <textarea className="form-control" placeholder="Breve resumen para que aparezca en los resultados de Google..."></textarea>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}