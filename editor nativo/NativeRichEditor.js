const ICONS = {
    bold: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>',
    italic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>',
    underline: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>',
    h1: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 12l-5-5"/><path d="M16 12v6"/></svg>',
    h2: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>',
    quote: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>',
    list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    ordered: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>',
    link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
    image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    code: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    alignLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>',
    alignCenter: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line></svg>',
    alignRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="17" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="17" y2="18"></line></svg>',
    table: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="3"></line></svg>',
    rowInsertAbove: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="3" y1="3" x2="21" y2="3"></line></svg>',
    rowInsertBelow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="3" y1="21" x2="21" y2="21"></line></svg>',
    colInsertLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="3" y1="3" x2="3" y2="21"></line></svg>',
    colInsertRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line><line x1="21" y1="3" x2="21" y2="21"></line></svg>',
    rowDelete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    colDelete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"></line><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    tableDelete: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>'
};

const TOOLBAR_COMMANDS = [
    { id: 'h1', label: 'H1', type: 'formatBlock', value: 'h1', iconKey: 'h1', group: 'blocks', shortcut: 'Ctrl+Alt+1' },
    { id: 'h2', label: 'H2', type: 'formatBlock', value: 'h2', iconKey: 'h2', group: 'blocks', shortcut: 'Ctrl+Alt+2' },
    { id: 'blockquote', label: 'Cita', type: 'formatBlock', value: 'blockquote', iconKey: 'quote', group: 'blocks', shortcut: 'Ctrl+Shift+>' },
    { id: 'bold', label: 'Negrita', type: 'command', command: 'bold', iconKey: 'bold', group: 'inline', shortcut: 'Ctrl+B' },
    { id: 'italic', label: 'Cursiva', type: 'command', command: 'italic', iconKey: 'italic', group: 'inline', shortcut: 'Ctrl+I' },
    { id: 'underline', label: 'Subrayado', type: 'command', command: 'underline', iconKey: 'underline', group: 'inline', shortcut: 'Ctrl+U' },
    { id: 'unordered', label: 'Lista', type: 'command', command: 'insertUnorderedList', iconKey: 'list', group: 'lists', shortcut: 'Ctrl+Shift+8' },
    { id: 'ordered', label: 'Lista num', type: 'command', command: 'insertOrderedList', iconKey: 'ordered', group: 'lists', shortcut: 'Ctrl+Shift+7' },
    { id: 'link', label: 'Enlace', type: 'action', action: 'link', iconKey: 'link', group: 'actions', shortcut: 'Ctrl+K' },
    { id: 'image', label: 'Imagen', type: 'action', action: 'image', iconKey: 'image', group: 'actions', shortcut: 'Ctrl+Shift+I' },
    { id: 'table', label: 'Tabla', type: 'action', action: 'table', iconKey: 'table', group: 'actions', shortcut: 'Ctrl+Shift+T' },
    { id: 'source', label: 'HTML', type: 'toggle', action: 'source', iconKey: 'code', group: 'actions', shortcut: 'Ctrl+Shift+S' }
];

// Slash Commands (F4.1)
const SLASH_COMMANDS = [
    { 
        id: 'h1', 
        label: 'Encabezado 1', 
        keywords: ['h1', 'heading1', 'heading', 'encabezado1', 'titulo1', 'titulo'],
        type: 'formatBlock',
        value: 'h1',
        iconKey: 'h1'
    },
    { 
        id: 'h2', 
        label: 'Encabezado 2', 
        keywords: ['h2', 'heading2', 'encabezado2', 'titulo2', 'subtitulo'],
        type: 'formatBlock',
        value: 'h2',
        iconKey: 'h2'
    },
    { 
        id: 'blockquote', 
        label: 'Cita', 
        keywords: ['quote', 'cita', 'blockquote', 'citar'],
        type: 'formatBlock',
        value: 'blockquote',
        iconKey: 'quote'
    },
    { 
        id: 'unordered', 
        label: 'Lista', 
        keywords: ['list', 'lista', 'ul', 'unordered', 'bullet', 'viñeta'],
        type: 'command',
        command: 'insertUnorderedList',
        iconKey: 'list'
    },
    { 
        id: 'ordered', 
        label: 'Lista numerada', 
        keywords: ['ordered', 'numbered', 'ol', 'numerada', 'ordenada'],
        type: 'command',
        command: 'insertOrderedList',
        iconKey: 'ordered'
    },
    { 
        id: 'image', 
        label: 'Imagen', 
        keywords: ['image', 'imagen', 'img', 'picture', 'foto'],
        type: 'action',
        action: 'image',
        iconKey: 'image'
    },
    { 
        id: 'table', 
        label: 'Tabla', 
        keywords: ['table', 'tabla', 'grid', 'rejilla', '2x2'],
        type: 'action',
        action: 'table',
        iconKey: 'table'
    }
];

// Tooltip management
let tooltipElement = null;
let tooltipTimeout = null;

function createTooltip() {
    if (tooltipElement) {
        return tooltipElement;
    }
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'native-rich-editor__tooltip';
    tooltipElement.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipElement);
    return tooltipElement;
}

function showTooltip(buttonElement, text) {
    if (!buttonElement || !text) {
        return;
    }

    const tooltip = createTooltip();
    tooltip.textContent = text;
    tooltip.style.display = 'block';

    // Calcular posición
    const rect = buttonElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    // Posicionar arriba del botón, centrado
    const top = rect.top + scrollY - tooltipRect.height - 8;
    const left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Ajustar si se sale por la izquierda o derecha
    const viewportWidth = window.innerWidth;
    if (left < 8) {
        tooltip.style.left = `${rect.left + scrollX + 8}px`;
    } else if (left + tooltipRect.width > viewportWidth - 8) {
        tooltip.style.left = `${rect.right + scrollX - tooltipRect.width - 8}px`;
    }

    // Ajustar si se sale por arriba
    if (top < scrollY + 8) {
        tooltip.style.top = `${rect.bottom + scrollY + 8}px`;
    }
}

function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.style.display = 'none';
    }
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
}

function setupTooltip(buttonElement, label, shortcut) {
    if (!buttonElement) {
        return;
    }

    const tooltipText = shortcut ? `${label} (${shortcut})` : label;
    let showTimeout = null;

    const clearShowTimeout = () => {
        if (showTimeout) {
            clearTimeout(showTimeout);
            showTimeout = null;
        }
    };

    buttonElement.addEventListener('mouseenter', () => {
        clearShowTimeout();
        showTimeout = setTimeout(() => {
            showTooltip(buttonElement, tooltipText);
        }, 300); // Delay de 300ms antes de mostrar
    });

    buttonElement.addEventListener('mouseleave', () => {
        clearShowTimeout();
        hideTooltip();
    });

    buttonElement.addEventListener('mousedown', () => {
        clearShowTimeout();
        hideTooltip();
    });

    buttonElement.addEventListener('focus', () => {
        clearShowTimeout();
        showTimeout = setTimeout(() => {
            showTooltip(buttonElement, tooltipText);
        }, 300);
    });

    buttonElement.addEventListener('blur', () => {
        clearShowTimeout();
        hideTooltip();
    });

    buttonElement.addEventListener('click', () => {
        clearShowTimeout();
        hideTooltip();
    });
}

const STYLE_ELEMENT_ID = 'native-rich-editor-styles';
const NATIVE_RICH_EDITOR_STYLES = `
/* NativeRichEditor */
.native-rich-editor {
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    background-color: #ffffff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    overflow: hidden;
}

.native-rich-editor__toolbar {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    overflow-x: auto;
}

.native-rich-editor__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0.4rem;
    min-width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    border: 1px solid transparent;
    background: transparent;
    color: #475569;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    flex-shrink: 0;
}

.native-rich-editor__button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
}

.native-rich-editor__button:hover {
    background: #ffffff;
    border-color: #e2e8f0;
    color: #1d4ed8;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.native-rich-editor__button.is-active {
    background: #dbeafe;
    border-color: #93c5fd;
    color: #1d4ed8;
}

.native-rich-editor__button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
}

.native-rich-editor__button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 0.25rem;
    background: #e2e8f0;
    color: #1f2937;
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.02em;
}

.native-rich-editor__button-icon svg {
    width: 18px;
    height: 18px;
    display: block;
    stroke-width: 2;
}

.native-rich-editor__button-label {
    display: none;
}

.native-rich-editor__button--source {
    margin-left: auto;
}

.native-rich-editor__separator {
    width: 1px;
    height: 1.5rem;
    background: #cbd5e1;
    margin: 0 0.25rem;
    flex-shrink: 0;
}

.native-rich-editor__button-label {
    font-weight: 500;
}

.native-rich-editor__button.is-active .native-rich-editor__button-icon {
    background: #bfdbfe;
    color: #1d4ed8;
}

.native-rich-editor__surface {
    background: #ffffff;
}

.native-rich-editor__content {
    min-height: 180px;
    padding: 1rem 1.25rem;
    font-size: 0.95rem;
    line-height: 1.65;
    color: #1f2937;
    outline: none;
    background: #ffffff;
}

.native-rich-editor__content h1 {
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.3;
    margin: 1.5rem 0 0.75rem 0;
    color: #1e293b;
}

.native-rich-editor__content h1:first-child {
    margin-top: 0;
}

.native-rich-editor__content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.35;
    margin: 1.25rem 0 0.75rem 0;
    color: #1e293b;
}

.native-rich-editor__content h2:first-child {
    margin-top: 0;
}

.native-rich-editor__content:empty:before {
    content: attr(data-placeholder);
    color: #94a3b8;
    pointer-events: none;
}

.native-rich-editor__content p {
    margin: 0 0 0.75rem;
}

.native-rich-editor__content p:last-child {
    margin-bottom: 0;
}

.native-rich-editor__content ul,
.native-rich-editor__content ol {
    margin: 0.5rem 0 0.75rem;
    padding-left: 1.5rem;
}

.native-rich-editor__content blockquote {
    margin: 1rem 0 0.75rem 0;
    padding: 0.75rem 1rem;
    padding-left: 1rem;
    border-left: 3px solid #cbd5e1;
    background-color: #f8fafc;
    color: #475569;
    font-style: italic;
    border-radius: 0 0.375rem 0.375rem 0;
}

.native-rich-editor__content img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.5rem 0 0.75rem;
    cursor: pointer;
}

/* Overlay de selección de imagen (F3.3) */
.native-rich-editor__image-overlay {
    position: absolute;
    border: 2px solid #3b82f6;
    pointer-events: none;
    z-index: 1000;
    box-sizing: border-box;
}

.native-rich-editor__image-resize-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border: 2px solid #ffffff;
    border-radius: 50%;
    pointer-events: all;
    cursor: nwse-resize;
    z-index: 1001;
}

.native-rich-editor__image-resize-handle[data-position="ne"] {
    cursor: nesw-resize;
}

.native-rich-editor__image-resize-handle[data-position="sw"] {
    cursor: nesw-resize;
}

.native-rich-editor__image-resize-handle[data-position="se"] {
    cursor: nwse-resize;
}

.native-rich-editor__image-resize-handle[data-position="nw"] {
    cursor: nwse-resize;
}

/* Toolbar de alineación de imagen (F4.2) */
.native-rich-editor__image-toolbar {
    position: absolute;
    display: none;
    z-index: 1002;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 0.25rem;
    display: inline-flex;
    gap: 0.25rem;
    pointer-events: all;
}

.native-rich-editor__image-toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid transparent;
    background: transparent;
    color: #475569;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.native-rich-editor__image-toolbar-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1d4ed8;
}

.native-rich-editor__image-toolbar-button.is-active {
    background: #dbeafe;
    border-color: #93c5fd;
    color: #1d4ed8;
}

.native-rich-editor__image-toolbar-button svg {
    width: 16px;
    height: 16px;
    display: block;
    stroke-width: 2;
}

.native-rich-editor__image-toolbar-button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
}

.native-rich-editor__content--dragging {
    background-color: #eff6ff !important;
    border: 2px dashed #3b82f6 !important;
    border-radius: 0.5rem;
}

.native-rich-editor__source {
    display: none;
    width: 100%;
    min-height: 180px;
    padding: 1rem 1.25rem;
    border: none;
    outline: none;
    resize: vertical;
    font-size: 0.9rem;
    line-height: 1.6;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    background: #0f172a;
    color: #e2e8f0;
}

.native-rich-editor--source .native-rich-editor__content {
    display: none;
}

.native-rich-editor--source .native-rich-editor__source {
    display: block;
}

.native-rich-editor__inline-input {
    flex: 1;
    min-width: 200px;
    padding: 0.35rem 0.6rem;
    border-radius: 0.5rem;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #1f2937;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s ease;
}

.native-rich-editor__inline-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.native-rich-editor__button--confirm {
    background: #10b981 !important;
    color: #ffffff !important;
    border-color: #10b981 !important;
}

.native-rich-editor__button--confirm:hover {
    background: #059669 !important;
    border-color: #059669 !important;
}

.native-rich-editor__button--confirm .native-rich-editor__button-icon {
    background: transparent;
    color: inherit;
}

.native-rich-editor__button--cancel {
    background: #ef4444 !important;
    color: #ffffff !important;
    border-color: #ef4444 !important;
}

.native-rich-editor__button--cancel:hover {
    background: #dc2626 !important;
    border-color: #dc2626 !important;
}

.native-rich-editor__button--cancel .native-rich-editor__button-icon {
    background: transparent;
    color: inherit;
}

@media (max-width: 640px) {
    .native-rich-editor__inline-input {
        min-width: 150px;
    }
    
    .native-rich-editor__toolbar {
        gap: 0.2rem;
        padding: 0.4rem 0.5rem;
    }
    
    .native-rich-editor__button {
        min-width: 1.75rem;
        height: 1.75rem;
        padding: 0.3rem;
    }
}

/* Tooltips profesionales */
.native-rich-editor__tooltip {
    position: absolute;
    display: none;
    padding: 0.4rem 0.6rem;
    background: #1f2937;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    pointer-events: none;
    z-index: 10000;
    white-space: nowrap;
    line-height: 1.4;
    max-width: 300px;
    word-wrap: break-word;
    white-space: normal;
}

.native-rich-editor__tooltip::before {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid #1f2937;
}

.native-rich-editor__tooltip[data-position="bottom"]::before {
    bottom: auto;
    top: -4px;
    border-top: none;
    border-bottom: 4px solid #1f2937;
}

/* Popover flotante para enlaces */
.native-rich-editor__popover {
    position: absolute;
    display: none;
    z-index: 10001;
    min-width: 280px;
    max-width: 400px;
}

.native-rich-editor__popover-content {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.native-rich-editor__popover-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    background: #ffffff;
    color: #1f2937;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.native-rich-editor__popover-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.native-rich-editor__popover-url-display {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    background: #f8fafc;
    color: #1f2937;
    font-size: 0.875rem;
    word-break: break-all;
    max-height: 4rem;
    overflow-y: auto;
}

.native-rich-editor__popover-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
}

.native-rich-editor__popover-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
    min-width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    border: 1px solid transparent;
    background: transparent;
    color: #475569;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.native-rich-editor__popover-button svg {
    width: 18px;
    height: 18px;
    display: block;
    stroke-width: 2;
}

.native-rich-editor__popover-button--confirm {
    background: #10b981 !important;
    color: #ffffff !important;
    border-color: #10b981 !important;
}

.native-rich-editor__popover-button--confirm:hover {
    background: #059669 !important;
    border-color: #059669 !important;
}

.native-rich-editor__popover-button--cancel {
    background: #ef4444 !important;
    color: #ffffff !important;
    border-color: #ef4444 !important;
}

.native-rich-editor__popover-button--cancel:hover {
    background: #dc2626 !important;
    border-color: #dc2626 !important;
}

.native-rich-editor__popover-button--edit {
    background: #3b82f6 !important;
    color: #ffffff !important;
    border-color: #3b82f6 !important;
}

.native-rich-editor__popover-button--edit:hover {
    background: #2563eb !important;
    border-color: #2563eb !important;
}

.native-rich-editor__popover-button--delete {
    background: #ef4444 !important;
    color: #ffffff !important;
    border-color: #ef4444 !important;
}

.native-rich-editor__popover-button--delete:hover {
    background: #dc2626 !important;
    border-color: #dc2626 !important;
}

.native-rich-editor__popover-button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
}

/* Slash Commands Dropdown (F4.1) */
.native-rich-editor__slash-menu {
    position: absolute;
    display: none;
    z-index: 10002;
    min-width: 240px;
    max-width: 320px;
    max-height: 300px;
    overflow-y: auto;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    padding: 0.25rem;
}

.native-rich-editor__slash-menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
    user-select: none;
}

.native-rich-editor__slash-menu-item:hover,
.native-rich-editor__slash-menu-item.is-selected {
    background: #f1f5f9;
}

.native-rich-editor__slash-menu-item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    background: #e2e8f0;
    color: #1f2937;
    flex-shrink: 0;
}

.native-rich-editor__slash-menu-item-icon svg {
    width: 16px;
    height: 16px;
    display: block;
}

.native-rich-editor__slash-menu-item.is-selected .native-rich-editor__slash-menu-item-icon {
    background: #bfdbfe;
    color: #1d4ed8;
}

.native-rich-editor__slash-menu-item-label {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
}

.native-rich-editor__slash-menu-item-description {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.125rem;
}

.native-rich-editor__slash-menu-item-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

/* Estilos de tablas */
.native-rich-editor__content table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75rem 0;
    border: 1px solid #cbd5e1;
}

.native-rich-editor__content table td,
.native-rich-editor__content table th {
    border: 1px solid #cbd5e1;
    padding: 0.5rem;
    min-width: 100px;
    min-height: 30px;
    vertical-align: top;
    position: relative;
    box-sizing: border-box;
}

.native-rich-editor__content table th {
    background-color: #f8fafc;
    font-weight: 600;
    text-align: left;
}

.native-rich-editor__content table td:focus,
.native-rich-editor__content table th:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
    background-color: #eff6ff;
}

/* Table toolbar (F4.3A) */
.native-rich-editor__table-toolbar {
    position: absolute;
    display: none;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
    z-index: 10000;
    pointer-events: auto;
}

.native-rich-editor__table-toolbar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid transparent;
    background: transparent;
    color: #475569;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.native-rich-editor__table-toolbar-button:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
}

.native-rich-editor__table-toolbar-button:active {
    background: #e2e8f0;
}

.native-rich-editor__table-toolbar-button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
}

.native-rich-editor__table-toolbar-button svg {
    width: 16px;
    height: 16px;
}

@media (max-width: 640px) {
    .native-rich-editor__button-label {
        display: none;
    }
}
`;

const FALLBACK_ALLOWED_TAGS = new Set([
    'p',
    'br',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'ul',
    'ol',
    'li',
    'div',
    'span',
    'h1',
    'h2',
    'blockquote',
    'a',
    'img',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td'
]);

const FALLBACK_BLOCKED_TAGS = new Set([
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'link',
    'meta'
]);

const FALLBACK_ALLOWED_ATTRIBUTES = {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    '*': []
};

const SAFE_LINK_PATTERN = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;
const SAFE_IMAGE_PATTERN = /^(https?:|data:image\/|\/|\.\/|\.\.\/)/i;

function ensureInlineStyles() {
    if (typeof document === 'undefined') {
        return;
    }

    if (document.getElementById(STYLE_ELEMENT_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = NATIVE_RICH_EDITOR_STYLES;
    document.head.appendChild(style);
}

function createActiveState() {
    return TOOLBAR_COMMANDS.reduce((acc, item) => {
        acc[item.id] = false;
        return acc;
    }, {});
}

function sanitizeUrl(rawValue, type) {
    if (!rawValue) {
        return null;
    }

    const value = String(rawValue).trim();
    const lowerValue = value.toLowerCase();
    if (lowerValue.startsWith('javascript:')) {
        return null;
    }
    const pattern = type === 'image' ? SAFE_IMAGE_PATTERN : SAFE_LINK_PATTERN;
    if (!pattern.test(value)) {
        return null;
    }

    return value;
}

function basicSanitize(html) {
    if (!html) {
        return '';
    }

    if (typeof document === 'undefined') {
        return String(html).replace(/<[^>]*>/g, '');
    }

    const template = document.createElement('template');
    template.innerHTML = html;

    const walker = document.createTreeWalker(
        template.content,
        NodeFilter.SHOW_ELEMENT,
        null
    );

    const nodesToRemove = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const tagName = node.tagName.toLowerCase();

        if (FALLBACK_BLOCKED_TAGS.has(tagName)) {
            nodesToRemove.push({ node, unwrap: false });
            continue;
        }

        if (!FALLBACK_ALLOWED_TAGS.has(tagName)) {
            nodesToRemove.push({ node, unwrap: true });
            continue;
        }

        const allowedAttributes = FALLBACK_ALLOWED_ATTRIBUTES[tagName] || FALLBACK_ALLOWED_ATTRIBUTES['*'];
        Array.from(node.attributes).forEach((attr) => {
            const attrName = attr.name.toLowerCase();
            if (!allowedAttributes.includes(attrName)) {
                node.removeAttribute(attr.name);
                return;
            }

            if (attrName === 'href') {
                const safeUrl = sanitizeUrl(attr.value, 'link');
                if (!safeUrl) {
                    node.removeAttribute(attr.name);
                    return;
                }
                node.setAttribute(attr.name, safeUrl);
                return;
            }

            if (attrName === 'src') {
                const safeUrl = sanitizeUrl(attr.value, 'image');
                if (!safeUrl) {
                    node.removeAttribute(attr.name);
                    return;
                }
                node.setAttribute(attr.name, safeUrl);
                return;
            }

            if (attrName === 'target') {
                if (attr.value !== '_blank') {
                    node.removeAttribute(attr.name);
                }
                return;
            }

            if (attrName === 'rel') {
                const allowedTokens = new Set(['noopener', 'noreferrer', 'nofollow', 'ugc']);
                const tokens = attr.value
                    .split(' ')
                    .map((token) => token.trim().toLowerCase())
                    .filter((token) => token && allowedTokens.has(token));
                if (tokens.length === 0) {
                    node.removeAttribute(attr.name);
                } else {
                    node.setAttribute(attr.name, tokens.join(' '));
                }
                return;
            }
        });

        if (tagName === 'a' && node.getAttribute('target') === '_blank' && !node.getAttribute('rel')) {
            node.setAttribute('rel', 'noopener noreferrer');
        }
    }

    nodesToRemove.forEach(({ node, unwrap }) => {
        const parent = node.parentNode;
        if (!parent) {
            return;
        }

        if (unwrap) {
            const fragment = document.createDocumentFragment();
            while (node.firstChild) {
                fragment.appendChild(node.firstChild);
            }
            parent.replaceChild(fragment, node);
        } else {
            parent.removeChild(node);
        }
    });

    return template.innerHTML;
}

function sanitizeHtml(vnode, html) {
    if (!html) {
        return '';
    }

    if (typeof vnode.attrs.sanitize === 'function') {
        return vnode.attrs.sanitize(html);
    }

    if (typeof window !== 'undefined' && window.DOMPurify) {
        return window.DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            ADD_TAGS: ['h1', 'h2', 'blockquote'],
            ADD_ATTR: ['target', 'rel']
        });
    }

    return basicSanitize(html);
}

function getExternalValue(vnode) {
    return typeof vnode.attrs.value === 'string' ? vnode.attrs.value : '';
}

function normalizeHtml(html) {
    const raw = (html || '').replace(/\u200B/g, '').trim();
    if (!raw) {
        return '';
    }

    const lower = raw.toLowerCase();
    if (
        lower === '<br>' ||
        lower === '<br/>' ||
        lower === '<br />' ||
        lower === '<div><br></div>' ||
        lower === '<p><br></p>'
    ) {
        return '';
    }

    return raw;
}

function formatHTML(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') {
        return '';
    }

    let formatted = '';
    let indent = 0;
    const indentSize = 2;
    const stack = [];
    let i = 0;
    const len = htmlString.length;

    while (i < len) {
        const char = htmlString[i];

        if (char === '<') {
            const tagEnd = htmlString.indexOf('>', i);
            if (tagEnd === -1) {
                formatted += htmlString.substring(i);
                break;
            }

            const tagContent = htmlString.substring(i, tagEnd + 1);
            const tagNameMatch = tagContent.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/);
            const isClosing = tagContent.startsWith('</');
            const isSelfClosing = tagContent.endsWith('/>') || /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i.test(tagContent);

            if (isClosing && stack.length > 0) {
                indent--;
                formatted += '\n' + ' '.repeat(indent * indentSize) + tagContent;
                stack.pop();
            } else if (!isSelfClosing && tagNameMatch) {
                formatted += '\n' + ' '.repeat(indent * indentSize) + tagContent;
                stack.push(tagNameMatch[1].toLowerCase());
                indent++;
            } else {
                formatted += '\n' + ' '.repeat(indent * indentSize) + tagContent;
            }

            i = tagEnd + 1;
        } else {
            let textEnd = htmlString.indexOf('<', i);
            if (textEnd === -1) {
                textEnd = len;
            }

            const text = htmlString.substring(i, textEnd).trim();
            if (text) {
                formatted += '\n' + ' '.repeat(indent * indentSize) + text;
            }
            i = textEnd;
        }
    }

    return formatted.trim();
}

function saveSelection(state) {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        state.savedSelection = null;
        return;
    }

    const range = selection.getRangeAt(0);
    if (state.editorEl && state.editorEl.contains(range.commonAncestorContainer)) {
        state.savedSelection = range.cloneRange();
    }
}

function restoreSelection(state) {
    const selection = document.getSelection();
    if (!selection || !state.savedSelection) {
        return;
    }

    selection.removeAllRanges();
    selection.addRange(state.savedSelection);
}

function configureExecCommandDefaults() {
    try {
        document.execCommand('styleWithCSS', false, false);
    } catch (error) {
        // Ignore unsupported commands
    }

    try {
        document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch (error) {
        // Ignore unsupported commands
    }

    // Deshabilitar redimensionamiento nativo de imágenes (F3.3)
    try {
        document.execCommand('enableObjectResizing', false, false);
    } catch (error) {
        // Ignore unsupported commands
    }
}

function getNormalizedFormatBlockValue() {
    try {
        const value = document.queryCommandValue('formatBlock') || '';
        return value.replace(/[<>]/g, '').toLowerCase();
    } catch (error) {
        return '';
    }
}

function isSelectionInsideTag(tagName) {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }

    let node = selection.anchorNode;
    if (!node) {
        return false;
    }

    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
    }

    while (node && node !== document) {
        if (node.nodeName && node.nodeName.toLowerCase() === tagName.toLowerCase()) {
            return true;
        }
        node = node.parentNode;
    }

    return false;
}

function isCommandExplicitlyApplied(command) {
    try {
        const currentFormat = getNormalizedFormatBlockValue();
        const blockElementsWithBold = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        
        // Si estamos en un heading y el comando es bold, verificar si hay un <b> o <strong> explícito
        if (command === 'bold' && blockElementsWithBold.includes(currentFormat)) {
            return isSelectionInsideTag('b') || isSelectionInsideTag('strong');
        }
        
        // Para otros comandos o cuando no estamos en un heading, usar queryCommandState
        return document.queryCommandState(command);
    } catch (error) {
        return false;
    }
}

function updateActiveState(state) {
    if (!state.editorEl) {
        return;
    }

    if (state.isSourceView) {
        Object.keys(state.active).forEach((key) => {
            state.active[key] = key === 'source';
        });
        return;
    }

    const formatBlockValue = getNormalizedFormatBlockValue();
    TOOLBAR_COMMANDS.forEach((item) => {
        if (item.type === 'formatBlock') {
            state.active[item.id] = formatBlockValue === item.value;
            return;
        }

        if (item.action === 'link') {
            state.active[item.id] = isSelectionInsideTag('a');
            return;
        }

        if (item.type === 'toggle') {
            state.active[item.id] = state.isSourceView;
            return;
        }

        if (item.type === 'command') {
            try {
                // Usar verificación mejorada para comandos inline
                state.active[item.id] = isCommandExplicitlyApplied(item.command);
            } catch (error) {
                state.active[item.id] = false;
            }
            return;
        }

        state.active[item.id] = false;
    });
}

function getCleanOutput(vnode) {
    const { editorEl } = vnode.state;
    if (!editorEl) {
        return '';
    }

    const sanitized = sanitizeHtml(vnode, editorEl.innerHTML);
    const cleaned = normalizeHtml(sanitized);
    
    if (!cleaned) {
        return '';
    }

    // Crear un documento temporal para limpiar los atributos internos (F5.2)
    if (typeof document !== 'undefined') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleaned;

        // Lista de atributos internos a eliminar
        const internalAttributes = [
            'contenteditable',
            'data-blob-url', // URL blob interna (F5.1)
            'data-position', // Posición de manijas de resize (F3.3)
        ];

        // Lista de clases internas a eliminar
        const internalClasses = [
            'native-rich-editor__image-overlay',
            'native-rich-editor__image-resize-handle',
            'native-rich-editor__image-toolbar',
            'native-rich-editor__image-toolbar-button',
            'native-rich-editor__popover',
            'native-rich-editor__popover-content',
            'native-rich-editor__popover-input',
            'native-rich-editor__popover-button',
            'native-rich-editor__slash-menu',
            'native-rich-editor__slash-menu-item',
        ];

        // Función recursiva para limpiar todos los elementos
        const cleanElement = (element) => {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return;
            }

            // Eliminar atributos internos
            internalAttributes.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    element.removeAttribute(attr);
                }
            });

            // Limpiar clases internas
            if (element.className) {
                const classList = element.className.split(/\s+/).filter(cls => {
                    // Eliminar clases que empiezan con native-rich-editor__
                    return !cls.startsWith('native-rich-editor__') && 
                           !internalClasses.includes(cls);
                });
                
                if (classList.length > 0) {
                    element.className = classList.join(' ');
                } else {
                    element.removeAttribute('class');
                }
            }

            // Limpiar estilos inline que puedan ser temporales
            if (element.hasAttribute('style')) {
                const style = element.style;
                // Eliminar estilos relacionados con overlays y toolbars
                const tempStyles = ['position', 'z-index', 'pointer-events'];
                tempStyles.forEach(prop => {
                    if (style.getPropertyValue(prop)) {
                        style.removeProperty(prop);
                    }
                });
                
                // Si no quedan estilos, eliminar el atributo style
                if (!style.cssText || style.cssText.trim() === '') {
                    element.removeAttribute('style');
                }
            }

            // Procesar hijos recursivamente
            Array.from(element.children).forEach(child => {
                cleanElement(child);
            });
        };

        // Limpiar todos los elementos
        Array.from(tempDiv.children).forEach(child => {
            cleanElement(child);
        });

        return tempDiv.innerHTML;
    }

    return cleaned;
}

function emitChange(vnode) {
    const { editorEl } = vnode.state;
    if (!editorEl) {
        return;
    }

    // Usar getCleanOutput para obtener HTML limpio (F5.2)
    const cleaned = getCleanOutput(vnode);
    
    if (cleaned === '' && editorEl.innerHTML !== '') {
        editorEl.innerHTML = '';
    }
    vnode.state.lastEmittedValue = cleaned;

    // Limpiar URLs blob no utilizadas (F5.1)
    cleanupUnusedBlobUrls(vnode);

    if (typeof vnode.attrs.onchange === 'function') {
        vnode.attrs.onchange(cleaned);
    }
}

function emitSourceChange(vnode) {
    const raw = vnode.state.sourceValue || '';
    const sanitized = sanitizeHtml(vnode, raw);
    const cleaned = normalizeHtml(sanitized);
    vnode.state.lastEmittedValue = cleaned;

    if (typeof vnode.attrs.onchange === 'function') {
        vnode.attrs.onchange(cleaned);
    }
}

function isCursorAtEndOfInlineFormat() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }

    const range = selection.getRangeAt(0);
    
    // Si hay selección (no solo cursor), no aplicar
    if (!range.collapsed) {
        return false;
    }

    const container = range.startContainer;
    const offset = range.startOffset;

    // Verificar si estamos dentro de un elemento con formato inline
    const inlineFormatTags = ['b', 'strong', 'i', 'em', 'u', 'a'];
    let formatNode = null;
    let node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
    
    // Buscar el nodo con formato inline más cercano
    while (node && node !== document.body) {
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        if (inlineFormatTags.includes(tagName)) {
            formatNode = node;
            break;
        }
        node = node.parentNode;
    }

    if (!formatNode) {
        return false;
    }

    // Verificar si el cursor está al final del contenido del nodo formateado
    if (container.nodeType === Node.TEXT_NODE) {
        // Si el cursor está al final del nodo de texto
        if (offset === container.textContent.length) {
            // Verificar si este es el último nodo de texto dentro del formato
            const formatText = formatNode.textContent || '';
            const textBeforeCursor = container.textContent.substring(0, offset);
            
            // Si el texto antes del cursor es igual al texto completo del nodo formateado,
            // estamos al final del formato
            if (textBeforeCursor === formatText) {
                return true;
            }
        }
    } else if (container.nodeType === Node.ELEMENT_NODE) {
        // Si el cursor está en un elemento, verificar si está después del último hijo
        if (offset === container.childNodes.length) {
            // Verificar si este contenedor es el nodo formateado o está dentro de él
            if (container === formatNode || formatNode.contains(container)) {
                // Verificar si no hay más contenido después
                const rangeClone = range.cloneRange();
                rangeClone.setStart(range.endContainer, range.endOffset);
                rangeClone.setEndAfter(formatNode);
                const textAfter = rangeClone.toString();
                if (!textAfter || textAfter.trim() === '') {
                    return true;
                }
            }
        }
    }

    return false;
}

function handleCursorAtFormatEdge(event) {
    if (event.key !== 'ArrowRight') {
        return false;
    }

    if (!isCursorAtEndOfInlineFormat()) {
        return false;
    }

    // Prevenir el comportamiento por defecto
    event.preventDefault();

    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return true;
    }

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const offset = range.startOffset;
    
    // Buscar el nodo con formato inline
    const inlineFormatTags = ['b', 'strong', 'i', 'em', 'u', 'a'];
    let formatNode = null;
    let node = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
    
    while (node && node !== document.body) {
        const tagName = node.tagName ? node.tagName.toLowerCase() : '';
        if (inlineFormatTags.includes(tagName)) {
            formatNode = node;
            break;
        }
        node = node.parentNode;
    }

    if (!formatNode) {
        return true;
    }

    // Intentar mover el cursor fuera del nodo formateado
    try {
        const newRange = document.createRange();
        
        // Si hay un nodo hermano después del formato, colocar el cursor ahí
        if (formatNode.nextSibling) {
            if (formatNode.nextSibling.nodeType === Node.TEXT_NODE) {
                newRange.setStart(formatNode.nextSibling, 0);
            } else {
                newRange.setStartBefore(formatNode.nextSibling);
            }
            newRange.collapse(true);
        } else if (formatNode.parentNode) {
            // Si no hay hermano, colocar el cursor después del nodo formateado
            newRange.setStartAfter(formatNode);
            newRange.collapse(true);
        } else {
            // Fallback: insertar un espacio invisible
            const zeroWidthSpace = '\u200B';
            const textNode = document.createTextNode(zeroWidthSpace);
            range.insertNode(textNode);
            newRange.setStartAfter(textNode);
            newRange.collapse(true);
        }
        
        selection.removeAllRanges();
        selection.addRange(newRange);
    } catch (error) {
        // Si todo falla, intentar insertar un espacio invisible
        try {
            const zeroWidthSpace = '\u200B';
            const textNode = document.createTextNode(zeroWidthSpace);
            range.insertNode(textNode);
            const newRange = document.createRange();
            newRange.setStartAfter(textNode);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } catch (e) {
            // Si incluso esto falla, no hacer nada
            console.warn('NativeRichEditor: Failed to handle cursor at format edge', e);
        }
    }

    return true;
}

function applyCommand(vnode, command) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    // Usar document.execCommand directamente como toggle nativo
    // Esto hace que el comportamiento sea idéntico al atajo de teclado (Ctrl+B, Ctrl+I, etc.)
    try {
        document.execCommand(command, false, null);
    } catch (error) {
        console.warn('NativeRichEditor: execCommand failed', error);
    }

    saveSelection(state);
    // Forzar actualización del estado activo después de un pequeño delay
    setTimeout(() => {
        updateActiveState(state);
        m.redraw();
    }, 0);
    emitChange(vnode);
}

function applyFormatBlock(vnode, tagName) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    // Verificar si ya estamos en el formato seleccionado
    const currentFormat = getNormalizedFormatBlockValue();
    const isAlreadyActive = currentFormat === tagName;

    try {
        if (isAlreadyActive) {
            // Si ya está activo, volver a párrafo normal
            document.execCommand('formatBlock', false, '<p>');
        } else {
            // Aplicar el nuevo formato
            document.execCommand('formatBlock', false, `<${tagName}>`);
        }
    } catch (error) {
        console.warn('NativeRichEditor: formatBlock failed', error);
    }

    saveSelection(state);
    // Forzar actualización del estado activo después de un pequeño delay
    // para asegurar que el DOM se haya actualizado
    setTimeout(() => {
        updateActiveState(state);
        m.redraw();
    }, 0);
    emitChange(vnode);
}

function activateInlineInput(vnode, mode) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }
    saveSelection(state);
    state.inlineInputMode = mode;
    state.inlineInputValue = '';
    m.redraw();
    
    // Focus en el input después del redraw
    setTimeout(() => {
        const inputEl = document.querySelector('.native-rich-editor__inline-input');
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
        }
    }, 0);
}

function confirmInlineInput(vnode) {
    const { state } = vnode;
    if (!state.editorEl || !state.inlineInputMode) {
        return;
    }

    const rawUrl = state.inlineInputValue.trim();
    if (!rawUrl) {
        cancelInlineInput(vnode);
        return;
    }

    const type = state.inlineInputMode === 'link' ? 'link' : 'image';
    const safeUrl = sanitizeUrl(rawUrl, type);
    if (!safeUrl) {
        cancelInlineInput(vnode);
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    try {
        if (state.inlineInputMode === 'link') {
            document.execCommand('createLink', false, safeUrl);
        } else {
            document.execCommand('insertImage', false, safeUrl);
        }
    } catch (error) {
        console.warn(`NativeRichEditor: ${state.inlineInputMode} failed`, error);
    }

    cancelInlineInput(vnode);
    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
}

function cancelInlineInput(vnode) {
    const { state } = vnode;
    state.inlineInputMode = null;
    state.inlineInputValue = '';
    m.redraw();
}

// Popover management
let popoverElement = null;
let popoverInputElement = null;
let popoverUrlDisplayElement = null;
let popoverEditButton = null;
let popoverDeleteButton = null;
let popoverCloseHandler = null;
let popoverMode = 'edit'; // 'edit' | 'view'
let popoverLinkNode = null; // El nodo <a> que se está editando

function createPopover() {
    if (popoverElement) {
        return popoverElement;
    }
    
    popoverElement = document.createElement('div');
    popoverElement.className = 'native-rich-editor__popover';
    popoverElement.setAttribute('role', 'dialog');
    popoverElement.setAttribute('aria-label', 'Insertar enlace');
    
    const popoverContent = document.createElement('div');
    popoverContent.className = 'native-rich-editor__popover-content';
    
    // Input para modo edición
    const input = document.createElement('input');
    input.className = 'native-rich-editor__popover-input';
    input.type = 'text';
    input.placeholder = 'URL del enlace';
    input.setAttribute('aria-label', 'URL del enlace');
    popoverInputElement = input;
    
    // Display para modo visualización
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'native-rich-editor__popover-url-display';
    popoverUrlDisplayElement = urlDisplay;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'native-rich-editor__popover-actions';
    
    // Botones para modo edición
    const confirmButton = document.createElement('button');
    confirmButton.className = 'native-rich-editor__popover-button native-rich-editor__popover-button--confirm';
    confirmButton.type = 'button';
    confirmButton.innerHTML = ICONS.check;
    confirmButton.setAttribute('aria-label', 'Confirmar');
    
    const cancelButton = document.createElement('button');
    cancelButton.className = 'native-rich-editor__popover-button native-rich-editor__popover-button--cancel';
    cancelButton.type = 'button';
    cancelButton.innerHTML = ICONS.close;
    cancelButton.setAttribute('aria-label', 'Cancelar');
    
    // Botones para modo visualización
    const editButton = document.createElement('button');
    editButton.className = 'native-rich-editor__popover-button native-rich-editor__popover-button--edit';
    editButton.type = 'button';
    editButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
    editButton.setAttribute('aria-label', 'Editar enlace');
    popoverEditButton = editButton;
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'native-rich-editor__popover-button native-rich-editor__popover-button--delete';
    deleteButton.type = 'button';
    deleteButton.innerHTML = ICONS.close;
    deleteButton.setAttribute('aria-label', 'Eliminar enlace');
    popoverDeleteButton = deleteButton;
    
    buttonContainer.appendChild(confirmButton);
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(editButton);
    buttonContainer.appendChild(deleteButton);
    
    popoverContent.appendChild(input);
    popoverContent.appendChild(urlDisplay);
    popoverContent.appendChild(buttonContainer);
    popoverElement.appendChild(popoverContent);
    
    document.body.appendChild(popoverElement);
    
    return popoverElement;
}

function showPopover(x, y, initialValue = '', mode = 'edit', linkNode = null) {
    const popover = createPopover();
    popoverMode = mode;
    popoverLinkNode = linkNode;
    
    if (mode === 'view') {
        // Modo visualización: mostrar URL y botones Editar/Borrar
        popoverInputElement.style.display = 'none';
        popoverUrlDisplayElement.style.display = 'block';
        popoverUrlDisplayElement.textContent = initialValue || '';
        
        // Mostrar solo botones de editar/borrar
        const confirmButton = popover.querySelector('.native-rich-editor__popover-button--confirm');
        const cancelButton = popover.querySelector('.native-rich-editor__popover-button--cancel');
        if (confirmButton) confirmButton.style.display = 'none';
        if (cancelButton) cancelButton.style.display = 'none';
        if (popoverEditButton) popoverEditButton.style.display = 'inline-flex';
        if (popoverDeleteButton) popoverDeleteButton.style.display = 'inline-flex';
    } else {
        // Modo edición: mostrar input y botones Confirmar/Cancelar
        popoverInputElement.style.display = 'block';
        popoverUrlDisplayElement.style.display = 'none';
        popoverInputElement.value = initialValue;
        
        // Mostrar solo botones de confirmar/cancelar
        const confirmButton = popover.querySelector('.native-rich-editor__popover-button--confirm');
        const cancelButton = popover.querySelector('.native-rich-editor__popover-button--cancel');
        if (confirmButton) confirmButton.style.display = 'inline-flex';
        if (cancelButton) cancelButton.style.display = 'inline-flex';
        if (popoverEditButton) popoverEditButton.style.display = 'none';
        if (popoverDeleteButton) popoverDeleteButton.style.display = 'none';
    }
    
    popover.style.display = 'block';
    
    // Calcular posición
    const popoverRect = popover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Posicionar debajo de la selección, centrado horizontalmente
    let left = x + scrollX - (popoverRect.width / 2);
    let top = y + scrollY + 8; // 8px de espacio debajo
    
    // Ajustar si se sale por la izquierda
    if (left < 8) {
        left = 8;
    }
    
    // Ajustar si se sale por la derecha
    if (left + popoverRect.width > viewportWidth - 8) {
        left = viewportWidth - popoverRect.width - 8;
    }
    
    // Ajustar si se sale por abajo (mostrar arriba)
    if (top + popoverRect.height > scrollY + viewportHeight - 8) {
        top = y + scrollY - popoverRect.height - 8;
    }
    
    // Asegurar que no se salga por arriba
    if (top < scrollY + 8) {
        top = scrollY + 8;
    }
    
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    
    // Focus trap: focus en el input solo en modo edición
    if (mode === 'edit') {
        setTimeout(() => {
            popoverInputElement.focus();
            popoverInputElement.select();
        }, 0);
    }
}

function hidePopover() {
    if (popoverElement) {
        popoverElement.style.display = 'none';
        if (popoverInputElement) {
            popoverInputElement.value = '';
        }
        if (popoverUrlDisplayElement) {
            popoverUrlDisplayElement.textContent = '';
        }
        popoverLinkNode = null;
        popoverMode = 'edit';
    }
    if (popoverCloseHandler) {
        document.removeEventListener('click', popoverCloseHandler);
        popoverCloseHandler = null;
    }
}

function handleLinkClick(vnode, event, linkElement) {
    // Si se presiona Ctrl/Cmd, permitir la navegación normal
    if (event.ctrlKey || event.metaKey) {
        return true; // Permitir navegación
    }
    
    // Prevenir la navegación por defecto
    event.preventDefault();
    event.stopPropagation();
    
    const { state } = vnode;
    if (!state.editorEl) {
        return false;
    }
    
    // Guardar el nodo del enlace
    popoverLinkNode = linkElement;
    
    // Obtener la URL del enlace
    const url = linkElement.getAttribute('href') || '';
    
    // Obtener las coordenadas del enlace
    const rect = linkElement.getBoundingClientRect();
    const x = rect.left + (rect.width / 2);
    const y = rect.bottom;
    
    // Mostrar el popover en modo visualización
    showPopover(x, y, url, 'view', linkElement);
    
    // Configurar handlers para modo visualización
    setupPopoverViewHandlers(vnode);
    
    // Cerrar al hacer clic fuera del popover
    popoverCloseHandler = (clickEvent) => {
        if (popoverElement && !popoverElement.contains(clickEvent.target)) {
            // Verificar que el clic no sea en el editor ni en el enlace
            if (state.editorEl && !state.editorEl.contains(clickEvent.target) && clickEvent.target !== linkElement) {
                hidePopover();
            }
        }
    };
    
    // Usar setTimeout para evitar que el clic que abrió el popover lo cierre inmediatamente
    setTimeout(() => {
        document.addEventListener('click', popoverCloseHandler);
    }, 0);
    
    return false;
}

function setupPopoverViewHandlers(vnode) {
    // Remover listeners anteriores
    if (popoverEditButton && popoverEditButton.onclick) {
        popoverEditButton.removeEventListener('click', popoverEditButton.onclick);
    }
    if (popoverDeleteButton && popoverDeleteButton.onclick) {
        popoverDeleteButton.removeEventListener('click', popoverDeleteButton.onclick);
    }
    
    // Handler para editar enlace
    const editHandler = () => {
        if (!popoverLinkNode) return;
        
        const currentUrl = popoverLinkNode.getAttribute('href') || '';
        
        // Cambiar a modo edición
        const rect = popoverLinkNode.getBoundingClientRect();
        const x = rect.left + (rect.width / 2);
        const y = rect.bottom;
        showPopover(x, y, currentUrl, 'edit', popoverLinkNode);
        
        // Configurar handlers para modo edición
        setupPopoverEditHandlers(vnode, true); // true = estamos editando un enlace existente
    };
    
    // Handler para borrar enlace
    const deleteHandler = () => {
        if (!popoverLinkNode) return;
        
        const { state } = vnode;
        if (!state.editorEl) {
            hidePopover();
            return;
        }
        
        // Seleccionar el enlace
        const range = document.createRange();
        range.selectNodeContents(popoverLinkNode);
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Eliminar el enlace manteniendo el texto
        try {
            document.execCommand('unlink', false, null);
        } catch (error) {
            // Fallback: desenvolver el enlace manualmente
            const text = popoverLinkNode.textContent;
            const textNode = document.createTextNode(text);
            popoverLinkNode.parentNode.replaceChild(textNode, popoverLinkNode);
        }
        
        hidePopover();
        saveSelection(state);
        updateActiveState(state);
        emitChange(vnode);
    };
    
    popoverEditButton.onclick = editHandler;
    popoverDeleteButton.onclick = deleteHandler;
}

function setupPopoverEditHandlers(vnode, isEditingExisting = false) {
    const { state } = vnode;
    
    const confirmHandler = () => {
        const url = popoverInputElement.value.trim();
        if (!url) {
            hidePopover();
            return;
        }
        
        const safeUrl = sanitizeUrl(url, 'link');
        if (!safeUrl) {
            hidePopover();
            return;
        }
        
        state.editorEl.focus();
        
        if (isEditingExisting && popoverLinkNode) {
            // Editar enlace existente: actualizar el atributo href
            popoverLinkNode.setAttribute('href', safeUrl);
            // Seleccionar el enlace para que el usuario vea el cambio
            const range = document.createRange();
            range.selectNodeContents(popoverLinkNode);
            const selection = document.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Crear nuevo enlace
            restoreSelection(state);
            try {
                document.execCommand('createLink', false, safeUrl);
            } catch (error) {
                console.warn('NativeRichEditor: createLink failed', error);
            }
        }
        
        hidePopover();
        saveSelection(state);
        updateActiveState(state);
        emitChange(vnode);
    };
    
    const cancelHandler = () => {
        hidePopover();
    };
    
    const inputKeyHandler = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmHandler();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelHandler();
        }
    };
    
    const confirmButton = popoverElement.querySelector('.native-rich-editor__popover-button--confirm');
    const cancelButton = popoverElement.querySelector('.native-rich-editor__popover-button--cancel');
    
    // Remover listeners anteriores si existen
    if (popoverInputElement.onkeydown) {
        popoverInputElement.removeEventListener('keydown', popoverInputElement.onkeydown);
    }
    if (confirmButton && confirmButton.onclick) {
        confirmButton.removeEventListener('click', confirmButton.onclick);
    }
    if (cancelButton && cancelButton.onclick) {
        cancelButton.removeEventListener('click', cancelButton.onclick);
    }
    
    // Agregar nuevos listeners
    popoverInputElement.onkeydown = inputKeyHandler;
    if (confirmButton) confirmButton.onclick = confirmHandler;
    if (cancelButton) cancelButton.onclick = cancelHandler;
}

function applyLink(vnode) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }
    
    // Guardar la selección
    saveSelection(state);
    
    // Obtener las coordenadas de la selección
    const selection = document.getSelection();
    let x = 0;
    let y = 0;
    
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        x = rect.left + (rect.width / 2);
        y = rect.bottom;
        
        // Si no hay selección visible, usar la posición del cursor
        if (rect.width === 0 && rect.height === 0) {
            const rangeClone = range.cloneRange();
            rangeClone.collapse(false);
            // Crear un elemento span invisible en lugar de un nodo de texto
            const marker = document.createElement('span');
            marker.style.position = 'absolute';
            marker.style.visibility = 'hidden';
            marker.style.width = '1px';
            marker.style.height = '1px';
            marker.appendChild(document.createTextNode('\u200B'));
            rangeClone.insertNode(marker);
            const markerRect = marker.getBoundingClientRect();
            x = markerRect.left;
            y = markerRect.bottom;
            marker.remove();
        }
    } else {
        // Fallback: usar posición del cursor en el editor
        const editorRect = state.editorEl.getBoundingClientRect();
        x = editorRect.left + (editorRect.width / 2);
        y = editorRect.top + 50;
    }
    
    // Verificar si ya hay un enlace seleccionado
    let existingUrl = '';
    let linkNode = null;
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        linkNode = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentElement
            : range.commonAncestorContainer;
        
        if (linkNode && linkNode.tagName && linkNode.tagName.toLowerCase() === 'a') {
            existingUrl = linkNode.getAttribute('href') || '';
            // Si hay un enlace seleccionado, mostrar en modo visualización
            showPopover(x, y, existingUrl, 'view', linkNode);
            setupPopoverViewHandlers(vnode);
            
            // Cerrar al hacer clic fuera del popover
            popoverCloseHandler = (event) => {
                if (popoverElement && !popoverElement.contains(event.target)) {
                    if (state.editorEl && !state.editorEl.contains(event.target)) {
                        hidePopover();
                    }
                }
            };
            
            setTimeout(() => {
                document.addEventListener('click', popoverCloseHandler);
            }, 0);
            return;
        }
    }
    
    // Mostrar el popover en modo edición para nuevo enlace
    showPopover(x, y, existingUrl, 'edit', null);
    setupPopoverEditHandlers(vnode, false);
    
    // Cerrar al hacer clic fuera del popover
    popoverCloseHandler = (event) => {
        if (popoverElement && !popoverElement.contains(event.target)) {
            // Verificar que el clic no sea en el editor (para permitir selección)
            if (state.editorEl && !state.editorEl.contains(event.target)) {
                hidePopover();
            }
        }
    };
    
    // Usar setTimeout para evitar que el clic que abrió el popover lo cierre inmediatamente
    setTimeout(() => {
        document.addEventListener('click', popoverCloseHandler);
    }, 0);
}

// Image selection and resizing (F3.3)
let imageOverlayElement = null;
let selectedImageElement = null;
let resizeData = null;
let imageToolbarElement = null;

function createImageOverlay() {
    if (imageOverlayElement) {
        return imageOverlayElement;
    }
    
    imageOverlayElement = document.createElement('div');
    imageOverlayElement.className = 'native-rich-editor__image-overlay';
    imageOverlayElement.style.display = 'none';
    
    // Crear 4 manijas (esquinas)
    const positions = ['nw', 'ne', 'sw', 'se'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'native-rich-editor__image-resize-handle';
        handle.setAttribute('data-position', pos);
        imageOverlayElement.appendChild(handle);
    });
    
    document.body.appendChild(imageOverlayElement);
    return imageOverlayElement;
}

function createImageToolbar() {
    if (imageToolbarElement) {
        return imageToolbarElement;
    }
    
    imageToolbarElement = document.createElement('div');
    imageToolbarElement.className = 'native-rich-editor__image-toolbar';
    imageToolbarElement.setAttribute('role', 'toolbar');
    imageToolbarElement.setAttribute('aria-label', 'Alineación de imagen');
    
    // Botones de alineación
    const alignments = [
        { id: 'left', iconKey: 'alignLeft', label: 'Izquierda', value: 'left' },
        { id: 'center', iconKey: 'alignCenter', label: 'Centro', value: 'center' },
        { id: 'right', iconKey: 'alignRight', label: 'Derecha', value: 'right' }
    ];
    
    alignments.forEach(align => {
        const button = document.createElement('button');
        button.className = 'native-rich-editor__image-toolbar-button';
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', align.label);
        button.setAttribute('data-alignment', align.value);
        button.innerHTML = ICONS[align.iconKey];
        imageToolbarElement.appendChild(button);
    });
    
    document.body.appendChild(imageToolbarElement);
    return imageToolbarElement;
}

function showImageToolbar(vnode) {
    if (!selectedImageElement) {
        return;
    }
    
    const toolbar = createImageToolbar();
    const rect = selectedImageElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Posicionar la toolbar encima de la imagen, centrada
    const toolbarRect = toolbar.getBoundingClientRect();
    const left = rect.left + scrollX + (rect.width / 2) - (toolbarRect.width / 2);
    const top = rect.top + scrollY - toolbarRect.height - 8; // 8px de espacio arriba
    
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.style.display = 'inline-flex';
    
    // Actualizar estado activo según la alineación actual
    updateImageToolbarActiveState();
    
    // Configurar handlers de clic
    setupImageToolbarHandlers(vnode);
}

function hideImageToolbar() {
    if (imageToolbarElement) {
        imageToolbarElement.style.display = 'none';
    }
}

function updateImageToolbarActiveState() {
    if (!imageToolbarElement || !selectedImageElement) {
        return;
    }
    
    const buttons = imageToolbarElement.querySelectorAll('.native-rich-editor__image-toolbar-button');
    const imgStyle = window.getComputedStyle(selectedImageElement);
    const parentStyle = selectedImageElement.parentElement 
        ? window.getComputedStyle(selectedImageElement.parentElement) 
        : null;
    
    // Detectar alineación actual
    let currentAlignment = null;
    
    // Verificar float
    const float = imgStyle.float;
    if (float === 'left') {
        currentAlignment = 'left';
    } else if (float === 'right') {
        currentAlignment = 'right';
    } else {
        // Verificar si está centrada (margin auto)
        const marginLeft = imgStyle.marginLeft;
        const marginRight = imgStyle.marginRight;
        const textAlign = parentStyle ? parentStyle.textAlign : null;
        
        if ((marginLeft === 'auto' && marginRight === 'auto') || 
            textAlign === 'center' ||
            (selectedImageElement.style.marginLeft === 'auto' && selectedImageElement.style.marginRight === 'auto')) {
            currentAlignment = 'center';
        } else {
            currentAlignment = 'left'; // Por defecto
        }
    }
    
    // Actualizar estado activo de los botones
    buttons.forEach(button => {
        const alignment = button.getAttribute('data-alignment');
        if (alignment === currentAlignment) {
            button.classList.add('is-active');
        } else {
            button.classList.remove('is-active');
        }
    });
}

function applyImageAlignment(vnode, alignment) {
    if (!selectedImageElement) {
        return;
    }
    
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }
    
    // Limpiar estilos anteriores
    selectedImageElement.style.float = '';
    selectedImageElement.style.marginLeft = '';
    selectedImageElement.style.marginRight = '';
    selectedImageElement.style.display = '';
    
    if (alignment === 'left') {
        selectedImageElement.style.float = 'left';
        selectedImageElement.style.marginRight = '1rem';
        selectedImageElement.style.marginBottom = '0.5rem';
    } else if (alignment === 'right') {
        selectedImageElement.style.float = 'right';
        selectedImageElement.style.marginLeft = '1rem';
        selectedImageElement.style.marginBottom = '0.5rem';
    } else if (alignment === 'center') {
        selectedImageElement.style.display = 'block';
        selectedImageElement.style.marginLeft = 'auto';
        selectedImageElement.style.marginRight = 'auto';
        selectedImageElement.style.marginBottom = '0.5rem';
    }
    
    // Actualizar estado activo de la toolbar
    updateImageToolbarActiveState();
    
    // Actualizar posición del overlay
    updateImageOverlayPosition();
    
    // Emitir cambio
    emitChange(vnode);
    m.redraw();
}

function setupImageToolbarHandlers(vnode) {
    if (!imageToolbarElement) {
        return;
    }
    
    const buttons = imageToolbarElement.querySelectorAll('.native-rich-editor__image-toolbar-button');
    
    buttons.forEach(button => {
        // Remover listeners anteriores si existen
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Agregar nuevo listener
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const alignment = newButton.getAttribute('data-alignment');
            applyImageAlignment(vnode, alignment);
        });
    });
}

function selectImage(vnode, imgElement) {
    const { state } = vnode;
    if (!state.editorEl || !imgElement) {
        return;
    }
    
    // Deseleccionar imagen anterior si existe
    deselectImage();
    
    selectedImageElement = imgElement;
    const overlay = createImageOverlay();
    
    // Calcular posición del overlay
    updateImageOverlayPosition();
    
    overlay.style.display = 'block';
    
    // Mostrar toolbar de alineación (F4.2)
    showImageToolbar(vnode);
    
    // Configurar eventos de redimensionamiento
    setupImageResizeHandlers(vnode);
    
    // Prevenir selección del texto cuando se arrastra
    overlay.addEventListener('mousedown', (e) => e.preventDefault());
}

function deselectImage() {
    if (imageOverlayElement) {
        imageOverlayElement.style.display = 'none';
    }
    
    // Ocultar toolbar de alineación (F4.2)
    hideImageToolbar();
    
    selectedImageElement = null;
    resizeData = null;
    
    // Remover listeners de resize
    if (window.imageResizeMouseMove) {
        document.removeEventListener('mousemove', window.imageResizeMouseMove);
        window.imageResizeMouseMove = null;
    }
    if (window.imageResizeMouseUp) {
        document.removeEventListener('mouseup', window.imageResizeMouseUp);
        window.imageResizeMouseUp = null;
    }
}

function updateImageOverlayPosition() {
    if (!selectedImageElement || !imageOverlayElement) {
        return;
    }
    
    const rect = selectedImageElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    imageOverlayElement.style.left = `${rect.left + scrollX}px`;
    imageOverlayElement.style.top = `${rect.top + scrollY}px`;
    imageOverlayElement.style.width = `${rect.width}px`;
    imageOverlayElement.style.height = `${rect.height}px`;
    
    // Actualizar posición de la toolbar de alineación (F4.2)
    if (imageToolbarElement && imageToolbarElement.style.display !== 'none') {
        const toolbarRect = imageToolbarElement.getBoundingClientRect();
        const left = rect.left + scrollX + (rect.width / 2) - (toolbarRect.width / 2);
        const top = rect.top + scrollY - toolbarRect.height - 8;
        imageToolbarElement.style.left = `${left}px`;
        imageToolbarElement.style.top = `${top}px`;
    }
    
    // Posicionar las manijas en las esquinas
    const handles = imageOverlayElement.querySelectorAll('.native-rich-editor__image-resize-handle');
    handles.forEach(handle => {
        const pos = handle.getAttribute('data-position');
        const handleSize = 12;
        const offset = handleSize / 2;
        
        switch(pos) {
            case 'nw':
                handle.style.left = `${-offset}px`;
                handle.style.top = `${-offset}px`;
                break;
            case 'ne':
                handle.style.left = `${rect.width - offset}px`;
                handle.style.top = `${-offset}px`;
                break;
            case 'sw':
                handle.style.left = `${-offset}px`;
                handle.style.top = `${rect.height - offset}px`;
                break;
            case 'se':
                handle.style.left = `${rect.width - offset}px`;
                handle.style.top = `${rect.height - offset}px`;
                break;
        }
    });
}

function setupImageResizeHandlers(vnode) {
    if (!imageOverlayElement || !selectedImageElement) {
        return;
    }
    
    const handles = imageOverlayElement.querySelectorAll('.native-rich-editor__image-resize-handle');
    const { state } = vnode;
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const pos = handle.getAttribute('data-position');
            const imgRect = selectedImageElement.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = imgRect.width;
            const startHeight = imgRect.height;
            const startAspectRatio = startWidth / startHeight;
            
            resizeData = {
                position: pos,
                startX,
                startY,
                startWidth,
                startHeight,
                startAspectRatio
            };
            
            // Crear handlers globales para mousemove y mouseup
            window.imageResizeMouseMove = (moveEvent) => {
                if (!resizeData || !selectedImageElement) {
                    return;
                }
                
                const deltaX = moveEvent.clientX - resizeData.startX;
                const deltaY = moveEvent.clientY - resizeData.startY;
                
                let newWidth = resizeData.startWidth;
                let newHeight = resizeData.startHeight;
                
                // Calcular nuevo tamaño según la esquina arrastrada
                switch(resizeData.position) {
                    case 'se': // Esquina inferior derecha
                        newWidth = resizeData.startWidth + deltaX;
                        newHeight = resizeData.startHeight + deltaY;
                        break;
                    case 'sw': // Esquina inferior izquierda
                        newWidth = resizeData.startWidth - deltaX;
                        newHeight = resizeData.startHeight + deltaY;
                        break;
                    case 'ne': // Esquina superior derecha
                        newWidth = resizeData.startWidth + deltaX;
                        newHeight = resizeData.startHeight - deltaY;
                        break;
                    case 'nw': // Esquina superior izquierda
                        newWidth = resizeData.startWidth - deltaX;
                        newHeight = resizeData.startHeight - deltaY;
                        break;
                }
                
                // Mantener aspecto si se presiona Shift
                if (moveEvent.shiftKey) {
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        newHeight = newWidth / resizeData.startAspectRatio;
                    } else {
                        newWidth = newHeight * resizeData.startAspectRatio;
                    }
                }
                
                // Aplicar límites mínimos
                newWidth = Math.max(50, newWidth);
                newHeight = Math.max(50, newHeight);
                
                // Aplicar cambios visualmente mientras se arrastra
                selectedImageElement.style.width = `${newWidth}px`;
                selectedImageElement.style.height = `${newHeight}px`;
                selectedImageElement.style.maxWidth = 'none';
                
                // Actualizar posición del overlay
                updateImageOverlayPosition();
            };
            
            window.imageResizeMouseUp = (upEvent) => {
                // Confirmar el cambio y actualizar el editor
                if (resizeData && selectedImageElement && state.editorEl) {
                    const finalWidthStr = selectedImageElement.style.width;
                    const finalHeightStr = selectedImageElement.style.height;
                    
                    // Extraer valores numéricos (puede tener "px" o ser un número)
                    const finalWidth = parseInt(finalWidthStr) || selectedImageElement.offsetWidth;
                    const finalHeight = parseInt(finalHeightStr) || selectedImageElement.offsetHeight;
                    
                    // Guardar el tamaño final
                    selectedImageElement.setAttribute('width', finalWidth);
                    selectedImageElement.setAttribute('height', finalHeight);
                    
                    // Actualizar overlay
                    updateImageOverlayPosition();
                    
                    // Emitir cambio
                    emitChange(vnode);
                }
                
                // Limpiar
                resizeData = null;
                document.removeEventListener('mousemove', window.imageResizeMouseMove);
                document.removeEventListener('mouseup', window.imageResizeMouseUp);
                window.imageResizeMouseMove = null;
                window.imageResizeMouseUp = null;
            };
            
            document.addEventListener('mousemove', window.imageResizeMouseMove);
            document.addEventListener('mouseup', window.imageResizeMouseUp);
        });
    });
}

function handleImageClick(vnode, event, imgElement) {
    event.preventDefault();
    event.stopPropagation();
    
    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return;
    }
    
    selectImage(vnode, imgElement);
}

// File input para seleccionar imágenes (oculto)
let imageFileInput = null;

// Gestión de Blob URLs para limpieza de memoria (F5.1)
// Mapa de URLs blob a elementos img que las usan
const blobUrlRegistry = new Map(); // blobUrl -> Set<imgElement>
// Registro de todas las URLs blob activas por editor
const editorBlobUrls = new Map(); // vnode -> Set<blobUrl>

function registerBlobUrl(vnode, blobUrl, imgElement) {
    if (!blobUrl || !blobUrl.startsWith('blob:')) {
        return;
    }
    
    // Registrar en el mapa global
    if (!blobUrlRegistry.has(blobUrl)) {
        blobUrlRegistry.set(blobUrl, new Set());
    }
    blobUrlRegistry.get(blobUrl).add(imgElement);
    
    // Registrar por editor
    if (!editorBlobUrls.has(vnode)) {
        editorBlobUrls.set(vnode, new Set());
    }
    editorBlobUrls.get(vnode).add(blobUrl);
    
    // Almacenar la URL blob como atributo data para referencia
    if (imgElement) {
        imgElement.setAttribute('data-blob-url', blobUrl);
    }
}

function revokeBlobUrl(blobUrl) {
    if (!blobUrl || !blobUrl.startsWith('blob:')) {
        return;
    }
    
    try {
        URL.revokeObjectURL(blobUrl);
        blobUrlRegistry.delete(blobUrl);
    } catch (error) {
        console.warn('NativeRichEditor: Error al revocar URL blob', error);
    }
}

function cleanupUnusedBlobUrls(vnode) {
    if (!vnode || !vnode.state || !vnode.state.editorEl) {
        return;
    }
    
    const editorEl = vnode.state.editorEl;
    const blobUrls = editorBlobUrls.get(vnode);
    
    if (!blobUrls) {
        return;
    }
    
    // Encontrar todas las imágenes en el editor que usan blob URLs
    const allImages = editorEl.querySelectorAll('img[data-blob-url]');
    const activeBlobUrls = new Set();
    
    allImages.forEach(img => {
        const blobUrl = img.getAttribute('data-blob-url');
        if (blobUrl && blobUrl.startsWith('blob:')) {
            activeBlobUrls.add(blobUrl);
        }
    });
    
    // Revocar URLs que ya no están en uso
    blobUrls.forEach(blobUrl => {
        if (!activeBlobUrls.has(blobUrl)) {
            revokeBlobUrl(blobUrl);
            blobUrls.delete(blobUrl);
        }
    });
}

function cleanupAllBlobUrls(vnode) {
    const blobUrls = editorBlobUrls.get(vnode);
    
    if (blobUrls) {
        blobUrls.forEach(blobUrl => {
            revokeBlobUrl(blobUrl);
        });
        editorBlobUrls.delete(vnode);
    }
}

function createImageFileInput() {
    if (imageFileInput) {
        return imageFileInput;
    }
    
    imageFileInput = document.createElement('input');
    imageFileInput.type = 'file';
    imageFileInput.accept = 'image/*';
    imageFileInput.style.display = 'none';
    imageFileInput.setAttribute('aria-label', 'Seleccionar imagen');
    
    document.body.appendChild(imageFileInput);
    return imageFileInput;
}

function applyImage(vnode) {
    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return;
    }
    
    // Guardar la selección antes de abrir el selector
    saveSelection(state);
    
    const fileInput = createImageFileInput();
    
    // Limpiar el valor anterior para permitir seleccionar el mismo archivo otra vez
    fileInput.value = '';
    
    // Configurar el handler para cuando se seleccione un archivo
    const handleFileSelect = (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }
        
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            console.warn('NativeRichEditor: El archivo seleccionado no es una imagen');
            return;
        }
        
        // Crear URL blob
        try {
            const blobUrl = URL.createObjectURL(file);
            
            if (!blobUrl || !blobUrl.startsWith('blob:')) {
                console.warn('NativeRichEditor: Error al crear URL blob');
                return;
            }
            
            // Restaurar la selección
            state.editorEl.focus();
            restoreSelection(state);
            
            // Insertar la imagen en el editor
            document.execCommand('insertImage', false, blobUrl);
            
            // Registrar la URL blob para limpieza de memoria (F5.1)
            setTimeout(() => {
                const imgElements = state.editorEl.querySelectorAll(`img[src="${blobUrl}"]`);
                imgElements.forEach(img => {
                    registerBlobUrl(vnode, blobUrl, img);
                });
            }, 0);
            
            // Actualizar estados y emitir cambio
            saveSelection(state);
            updateActiveState(state);
            emitChange(vnode);
        } catch (error) {
            console.warn('NativeRichEditor: Error al insertar imagen', error);
        }
        
        // Remover el handler después de usarlo
        fileInput.removeEventListener('change', handleFileSelect);
    };
    
    // Agregar el handler
    fileInput.addEventListener('change', handleFileSelect);
    
    // Abrir el selector de archivos
    fileInput.click();
}

function applyTable(vnode) {
    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return;
    }
    
    state.editorEl.focus();
    restoreSelection(state);
    
    try {
        // Crear una tabla 2x2 robusta
        // Usamos un espacio no separado (&nbsp;) en cada celda para evitar que se colapsen al borrar
        const table = document.createElement('table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.margin = '0.75rem 0';
        
        // Crear 2 filas
        for (let i = 0; i < 2; i++) {
            const row = document.createElement('tr');
            
            // Crear 2 celdas por fila
            for (let j = 0; j < 2; j++) {
                const cell = document.createElement('td');
                cell.style.border = '1px solid #cbd5e1';
                cell.style.padding = '0.5rem';
                cell.style.minWidth = '100px';
                cell.style.minHeight = '30px';
                
                // Insertar un espacio no separado para mantener la celda estable
                // Esto evita que la celda se colapse cuando el usuario borra todo su contenido
                cell.appendChild(document.createTextNode('\u00A0')); // &nbsp;
                
                row.appendChild(cell);
            }
            
            table.appendChild(row);
        }
        
        // Insertar la tabla en el editor
        const selection = document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // Si hay contenido seleccionado, eliminarlo
            if (!range.collapsed) {
                range.deleteContents();
            }
            
            // Insertar la tabla
            range.insertNode(table);
            
            // Colocar el cursor en la primera celda
            const firstCell = table.rows[0].cells[0];
            const newRange = document.createRange();
            newRange.setStart(firstCell, 0);
            newRange.setEnd(firstCell, 0);
            
            // Eliminar el espacio no separado que pusimos para mantener la estructura
            // y dejar el cursor listo para escribir
            if (firstCell.firstChild && firstCell.firstChild.nodeType === Node.TEXT_NODE) {
                const textNode = firstCell.firstChild;
                if (textNode.textContent === '\u00A0') {
                    firstCell.removeChild(textNode);
                    firstCell.appendChild(document.createTextNode(''));
                    newRange.setStart(firstCell, 0);
                    newRange.setEnd(firstCell, 0);
                }
            }
            
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            // Fallback: usar execCommand si no hay selección
            state.editorEl.appendChild(table);
            
            // Colocar cursor en la primera celda
            const firstCell = table.rows[0].cells[0];
            const range = document.createRange();
            range.setStart(firstCell, 0);
            range.setEnd(firstCell, 0);
            
            if (firstCell.firstChild && firstCell.firstChild.nodeType === Node.TEXT_NODE) {
                const textNode = firstCell.firstChild;
                if (textNode.textContent === '\u00A0') {
                    firstCell.removeChild(textNode);
                    firstCell.appendChild(document.createTextNode(''));
                    range.setStart(firstCell, 0);
                    range.setEnd(firstCell, 0);
                }
            }
            
            const sel = document.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
        
        // Hacer las celdas editables y asegurar que siempre tengan contenido mínimo
        // Esto previene que las celdas se colapsen completamente al borrar
        const allCells = table.querySelectorAll('td');
        allCells.forEach((cell, index) => {
            // Solo dejar vacía la primera celda (donde está el cursor)
            // Las demás deben tener un espacio no separado
            if (index > 0) {
                // Asegurar que las demás celdas tengan al menos un espacio no separado
                if (cell.textContent.trim() === '' || cell.textContent === '') {
                    cell.textContent = '\u00A0';
                }
            }
        });
        
    } catch (error) {
        console.warn('NativeRichEditor: Error al insertar tabla', error);
    }
    
    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
    m.redraw();
}

// Table toolbar management (F4.3A)
let tableToolbarElement = null;
let selectedTableCell = null;
let selectedTableElement = null;

function createTableToolbar() {
    if (tableToolbarElement) {
        return tableToolbarElement;
    }
    
    tableToolbarElement = document.createElement('div');
    tableToolbarElement.className = 'native-rich-editor__table-toolbar';
    tableToolbarElement.setAttribute('role', 'toolbar');
    tableToolbarElement.setAttribute('aria-label', 'Herramientas de tabla');
    
    // Botones de la toolbar
    const buttons = [
        { id: 'row-insert-above', iconKey: 'rowInsertAbove', label: 'Insertar fila arriba', action: 'insertRowAbove' },
        { id: 'row-insert-below', iconKey: 'rowInsertBelow', label: 'Insertar fila abajo', action: 'insertRowBelow' },
        { id: 'col-insert-left', iconKey: 'colInsertLeft', label: 'Insertar columna izquierda', action: 'insertColLeft' },
        { id: 'col-insert-right', iconKey: 'colInsertRight', label: 'Insertar columna derecha', action: 'insertColRight' },
        { id: 'row-delete', iconKey: 'rowDelete', label: 'Eliminar fila', action: 'deleteRow' },
        { id: 'col-delete', iconKey: 'colDelete', label: 'Eliminar columna', action: 'deleteCol' },
        { id: 'table-delete', iconKey: 'tableDelete', label: 'Eliminar tabla', action: 'deleteTable' }
    ];
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'native-rich-editor__table-toolbar-button';
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', btn.label);
        button.setAttribute('data-action', btn.action);
        button.innerHTML = ICONS[btn.iconKey];
        tableToolbarElement.appendChild(button);
    });
    
    document.body.appendChild(tableToolbarElement);
    return tableToolbarElement;
}

function showTableToolbar(vnode, cellElement) {
    if (!cellElement) {
        return;
    }
    
    const table = cellElement.closest('table');
    if (!table) {
        return;
    }
    
    selectedTableCell = cellElement;
    selectedTableElement = table;
    
    const toolbar = createTableToolbar();
    const rect = cellElement.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Posicionar la toolbar encima de la celda, centrada
    const toolbarRect = toolbar.getBoundingClientRect();
    const left = rect.left + scrollX + (rect.width / 2) - (toolbarRect.width / 2);
    const top = rect.top + scrollY - toolbarRect.height - 8; // 8px de espacio arriba
    
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.style.display = 'inline-flex';
    
    // Configurar handlers de clic
    setupTableToolbarHandlers(vnode);
    
    // Actualizar posición al hacer scroll o redimensionar
    const updatePosition = () => {
        if (selectedTableCell && toolbar.style.display !== 'none') {
            const newRect = selectedTableCell.getBoundingClientRect();
            const newLeft = newRect.left + scrollX + (newRect.width / 2) - (toolbarRect.width / 2);
            const newTop = newRect.top + scrollY - toolbarRect.height - 8;
            toolbar.style.left = `${newLeft}px`;
            toolbar.style.top = `${newTop}px`;
        }
    };
    
    // Limpiar listeners anteriores
    if (vnode.state._tableToolbarUpdateHandler) {
        window.removeEventListener('scroll', vnode.state._tableToolbarUpdateHandler, true);
        window.removeEventListener('resize', vnode.state._tableToolbarUpdateHandler);
    }
    
    vnode.state._tableToolbarUpdateHandler = updatePosition;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
}

function hideTableToolbar(vnode) {
    if (tableToolbarElement) {
        tableToolbarElement.style.display = 'none';
    }
    selectedTableCell = null;
    selectedTableElement = null;
    
    // Limpiar listeners
    if (vnode && vnode.state && vnode.state._tableToolbarUpdateHandler) {
        window.removeEventListener('scroll', vnode.state._tableToolbarUpdateHandler, true);
        window.removeEventListener('resize', vnode.state._tableToolbarUpdateHandler);
        vnode.state._tableToolbarUpdateHandler = null;
    }
}

function getCellPosition(cell) {
    const table = cell.closest('table');
    if (!table) return null;
    
    const row = cell.parentElement;
    const rowIndex = Array.from(table.rows).indexOf(row);
    const cellIndex = Array.from(row.cells).indexOf(cell);
    
    return { table, row, rowIndex, cellIndex };
}

function setSelectionToCell(cell) {
    if (!cell || !cell.ownerDocument || !cell.ownerDocument.contains(cell)) {
        return false;
    }
    
    try {
        const range = document.createRange();
        // Verificar que la celda tiene contenido o crear un nodo de texto vacío
        if (cell.firstChild && cell.firstChild.nodeType === Node.TEXT_NODE) {
            const textNode = cell.firstChild;
            if (textNode.textContent === '\u00A0') {
                cell.removeChild(textNode);
                cell.appendChild(document.createTextNode(''));
            }
        } else if (!cell.firstChild) {
            cell.appendChild(document.createTextNode(''));
        }
        
        range.setStart(cell, 0);
        range.setEnd(cell, 0);
        
        const selection = document.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        }
    } catch (error) {
        console.warn('NativeRichEditor: Error al establecer selección en celda', error);
        return false;
    }
    
    return false;
}

function insertRowAbove(vnode) {
    if (!selectedTableCell) return;
    
    const pos = getCellPosition(selectedTableCell);
    if (!pos) return;
    
    const { table, rowIndex } = pos;
    const newRow = table.insertRow(rowIndex);
    
    // Copiar estructura de celdas de la fila actual
    const currentRow = table.rows[rowIndex + 1];
    const cellCount = currentRow.cells.length;
    
    for (let i = 0; i < cellCount; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '0.5rem';
        newCell.style.minWidth = '100px';
        newCell.style.minHeight = '30px';
        newCell.appendChild(document.createTextNode('\u00A0'));
    }
    
    // Mover cursor a la primera celda de la nueva fila
    const firstCell = newRow.cells[0];
    if (firstCell && setSelectionToCell(firstCell)) {
        selectedTableCell = firstCell;
        showTableToolbar(vnode, firstCell);
    } else {
        // Si falla, intentar obtener la celda de nuevo después de un breve delay
        setTimeout(() => {
            const cell = newRow.cells[0];
            if (cell) {
                setSelectionToCell(cell);
                selectedTableCell = cell;
                showTableToolbar(vnode, cell);
            }
        }, 0);
    }
    emitChange(vnode);
    m.redraw();
}

function insertRowBelow(vnode) {
    if (!selectedTableCell) return;
    
    const pos = getCellPosition(selectedTableCell);
    if (!pos) return;
    
    const { table, rowIndex } = pos;
    const newRow = table.insertRow(rowIndex + 1);
    
    // Copiar estructura de celdas de la fila actual
    const currentRow = table.rows[rowIndex];
    const cellCount = currentRow.cells.length;
    
    for (let i = 0; i < cellCount; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '0.5rem';
        newCell.style.minWidth = '100px';
        newCell.style.minHeight = '30px';
        newCell.appendChild(document.createTextNode('\u00A0'));
    }
    
    // Mover cursor a la primera celda de la nueva fila
    const firstCell = newRow.cells[0];
    if (firstCell && setSelectionToCell(firstCell)) {
        selectedTableCell = firstCell;
        showTableToolbar(vnode, firstCell);
    } else {
        // Si falla, intentar obtener la celda de nuevo después de un breve delay
        setTimeout(() => {
            const cell = newRow.cells[0];
            if (cell) {
                setSelectionToCell(cell);
                selectedTableCell = cell;
                showTableToolbar(vnode, cell);
            }
        }, 0);
    }
    emitChange(vnode);
    m.redraw();
}

function insertColLeft(vnode) {
    if (!selectedTableCell) return;
    
    const pos = getCellPosition(selectedTableCell);
    if (!pos) return;
    
    const { table, cellIndex } = pos;
    
    // Insertar celda en todas las filas
    Array.from(table.rows).forEach(row => {
        const newCell = row.insertCell(cellIndex);
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '0.5rem';
        newCell.style.minWidth = '100px';
        newCell.style.minHeight = '30px';
        newCell.appendChild(document.createTextNode('\u00A0'));
    });
    
    // Mover cursor a la nueva celda
    const newCell = table.rows[pos.rowIndex].cells[cellIndex];
    if (newCell && setSelectionToCell(newCell)) {
        selectedTableCell = newCell;
        showTableToolbar(vnode, newCell);
    } else {
        // Si falla, intentar obtener la celda de nuevo después de un breve delay
        setTimeout(() => {
            const cell = table.rows[pos.rowIndex]?.cells[cellIndex];
            if (cell) {
                setSelectionToCell(cell);
                selectedTableCell = cell;
                showTableToolbar(vnode, cell);
            }
        }, 0);
    }
    emitChange(vnode);
    m.redraw();
}

function insertColRight(vnode) {
    if (!selectedTableCell) return;
    
    const pos = getCellPosition(selectedTableCell);
    if (!pos) return;
    
    const { table, cellIndex } = pos;
    
    // Insertar celda en todas las filas
    Array.from(table.rows).forEach(row => {
        const newCell = row.insertCell(cellIndex + 1);
        newCell.style.border = '1px solid #cbd5e1';
        newCell.style.padding = '0.5rem';
        newCell.style.minWidth = '100px';
        newCell.style.minHeight = '30px';
        newCell.appendChild(document.createTextNode('\u00A0'));
    });
    
    // Mover cursor a la nueva celda
    const newCell = table.rows[pos.rowIndex].cells[cellIndex + 1];
    if (newCell && setSelectionToCell(newCell)) {
        selectedTableCell = newCell;
        showTableToolbar(vnode, newCell);
    } else {
        // Si falla, intentar obtener la celda de nuevo después de un breve delay
        setTimeout(() => {
            const cell = table.rows[pos.rowIndex]?.cells[cellIndex + 1];
            if (cell) {
                setSelectionToCell(cell);
                selectedTableCell = cell;
                showTableToolbar(vnode, cell);
            }
        }, 0);
    }
    emitChange(vnode);
    m.redraw();
}

function deleteRow(vnode) {
    if (!selectedTableCell) return;
    
    const pos = getCellPosition(selectedTableCell);
    if (!pos) return;
    
    const { table, row, rowIndex } = pos;
    
    // No permitir eliminar si solo hay una fila
    if (table.rows.length <= 1) {
        return;
    }
    
    // Determinar la fila destino (arriba o abajo)
    let targetRow = null;
    let targetCellIndex = pos.cellIndex;
    
    if (rowIndex > 0) {
        targetRow = table.rows[rowIndex - 1];
    } else {
        targetRow = table.rows[1];
    }
    
    // Eliminar la fila
    table.deleteRow(rowIndex);
    
    // Mover cursor a la celda correspondiente de la fila destino
    if (targetRow && targetRow.cells[targetCellIndex]) {
        const targetCell = targetRow.cells[targetCellIndex];
        if (setSelectionToCell(targetCell)) {
            selectedTableCell = targetCell;
            showTableToolbar(vnode, targetCell);
        } else {
            hideTableToolbar(vnode);
        }
    } else {
        hideTableToolbar(vnode);
    }
    
    emitChange(vnode);
    m.redraw();
}

function deleteCol(vnode) {
    if (!selectedTableCell) return;
    
    const pos = getCellPosition(selectedTableCell);
    if (!pos) return;
    
    const { table, cellIndex } = pos;
    
    // No permitir eliminar si solo hay una columna
    if (table.rows[0] && table.rows[0].cells.length <= 1) {
        return;
    }
    
    // Determinar la celda destino (izquierda o derecha)
    let targetCellIndex = cellIndex;
    if (cellIndex > 0) {
        targetCellIndex = cellIndex - 1;
    } else if (table.rows[0] && table.rows[0].cells.length > 1) {
        targetCellIndex = 1;
    }
    
    // Eliminar celda en todas las filas
    Array.from(table.rows).forEach(row => {
        if (row.cells[cellIndex]) {
            row.deleteCell(cellIndex);
        }
    });
    
    // Mover cursor a la celda correspondiente
    if (table.rows[pos.rowIndex] && table.rows[pos.rowIndex].cells[targetCellIndex]) {
        const targetCell = table.rows[pos.rowIndex].cells[targetCellIndex];
        if (setSelectionToCell(targetCell)) {
            selectedTableCell = targetCell;
            showTableToolbar(vnode, targetCell);
        } else {
            hideTableToolbar(vnode);
        }
    } else {
        hideTableToolbar(vnode);
    }
    
    emitChange(vnode);
    m.redraw();
}

function deleteTable(vnode) {
    if (!selectedTableElement) return;
    
    const { state } = vnode;
    if (!state.editorEl) return;
    
    // Crear un párrafo vacío para reemplazar la tabla
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(''));
    
    // Reemplazar la tabla con el párrafo
    selectedTableElement.parentNode.replaceChild(p, selectedTableElement);
    
    // Mover cursor al párrafo
    const range = document.createRange();
    range.setStart(p, 0);
    range.setEnd(p, 0);
    const selection = document.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    hideTableToolbar(vnode);
    emitChange(vnode);
    m.redraw();
}

function setupTableToolbarHandlers(vnode) {
    if (!tableToolbarElement) {
        return;
    }
    
    const buttons = tableToolbarElement.querySelectorAll('.native-rich-editor__table-toolbar-button');
    
    buttons.forEach(button => {
        // Remover listeners anteriores si existen
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Agregar nuevo listener
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = newButton.getAttribute('data-action');
            
            switch (action) {
                case 'insertRowAbove':
                    insertRowAbove(vnode);
                    break;
                case 'insertRowBelow':
                    insertRowBelow(vnode);
                    break;
                case 'insertColLeft':
                    insertColLeft(vnode);
                    break;
                case 'insertColRight':
                    insertColRight(vnode);
                    break;
                case 'deleteRow':
                    deleteRow(vnode);
                    break;
                case 'deleteCol':
                    deleteCol(vnode);
                    break;
                case 'deleteTable':
                    deleteTable(vnode);
                    break;
            }
        });
    });
}

function handleTableCellClick(vnode, event, cellElement) {
    event.preventDefault();
    event.stopPropagation();
    
    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return;
    }
    
    // Colocar el foco en la celda usando la función segura
    if (setSelectionToCell(cellElement)) {
        // Mostrar toolbar
        showTableToolbar(vnode, cellElement);
        m.redraw();
    }
}

// Table keyboard navigation (F4.3B)
function handleTableKeyboardNavigation(vnode, event) {
    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return false;
    }
    
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }
    
    const range = selection.getRangeAt(0);
    const cell = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    
    // Verificar si estamos en una celda de tabla
    if (!cell || (cell.tagName !== 'TD' && cell.tagName !== 'TH')) {
        return false;
    }
    
    const table = cell.closest('table');
    if (!table) {
        return false;
    }
    
    // Manejar Tab y Shift+Tab
    if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        
        const pos = getCellPosition(cell);
        if (!pos) return false;
        
        const { table, rowIndex, cellIndex } = pos;
        const totalRows = table.rows.length;
        const totalCells = table.rows[rowIndex].cells.length;
        
        let nextCell = null;
        
        if (event.shiftKey) {
            // Shift+Tab: mover a la celda anterior
            if (cellIndex > 0) {
                nextCell = table.rows[rowIndex].cells[cellIndex - 1];
            } else if (rowIndex > 0) {
                // Mover a la última celda de la fila anterior
                const prevRow = table.rows[rowIndex - 1];
                nextCell = prevRow.cells[prevRow.cells.length - 1];
            }
        } else {
            // Tab: mover a la siguiente celda
            if (cellIndex < totalCells - 1) {
                nextCell = table.rows[rowIndex].cells[cellIndex + 1];
            } else if (rowIndex < totalRows - 1) {
                // Mover a la primera celda de la siguiente fila
                nextCell = table.rows[rowIndex + 1].cells[0];
            } else {
                // Estamos en la última celda: crear nueva fila
                const newRow = table.insertRow();
                const cellCount = table.rows[0].cells.length;
                
                for (let i = 0; i < cellCount; i++) {
                    const newCell = newRow.insertCell(i);
                    newCell.style.border = '1px solid #cbd5e1';
                    newCell.style.padding = '0.5rem';
                    newCell.style.minWidth = '100px';
                    newCell.style.minHeight = '30px';
                    newCell.appendChild(document.createTextNode('\u00A0'));
                }
                
                nextCell = newRow.cells[0];
                emitChange(vnode);
            }
        }
        
        if (nextCell) {
            // Mover cursor a la siguiente celda usando la función segura
            if (setSelectionToCell(nextCell)) {
                // Actualizar toolbar si está visible
                if (selectedTableCell) {
                    showTableToolbar(vnode, nextCell);
                }
                m.redraw();
            }
        }
        
        return true;
    }
    
    return false;
}

function hasImageFiles(dataTransfer) {
    if (!dataTransfer || !dataTransfer.items || dataTransfer.items.length === 0) {
        return false;
    }
    return Array.from(dataTransfer.items).some(item => 
        item.kind === 'file' && item.type.startsWith('image/')
    );
}

function handleDragOver(event) {
    // Solo permitir drop si hay archivos de imagen
    if (hasImageFiles(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
    }
}

function handleDragEnter(event) {
    // Solo mostrar feedback si hay archivos de imagen
    if (hasImageFiles(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        const editorEl = event.currentTarget;
        if (editorEl) {
            editorEl.classList.add('native-rich-editor__content--dragging');
        }
    }
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    const editorEl = event.currentTarget;
    // Solo remover la clase si realmente salimos del editor (no de un hijo)
    if (editorEl && !editorEl.contains(event.relatedTarget)) {
        editorEl.classList.remove('native-rich-editor__content--dragging');
    }
}

// Slash Commands Management (F4.1)
let slashMenuElement = null;
let slashMenuSelectedIndex = 0;
let slashMenuFilter = '';
let slashMenuQuery = '';
let slashMenuRange = null;
let slashMenuCloseHandler = null;

function createSlashMenu() {
    if (slashMenuElement) {
        return slashMenuElement;
    }
    slashMenuElement = document.createElement('div');
    slashMenuElement.className = 'native-rich-editor__slash-menu';
    slashMenuElement.setAttribute('role', 'listbox');
    document.body.appendChild(slashMenuElement);
    return slashMenuElement;
}

function getFilteredSlashCommands(query) {
    if (!query || query.trim() === '') {
        return SLASH_COMMANDS;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    return SLASH_COMMANDS.filter(cmd => {
        // Buscar en el label o en los keywords
        const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
        const keywordMatch = cmd.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery));
        return labelMatch || keywordMatch;
    });
}

function renderSlashMenu(commands, selectedIndex, vnode) {
    const menu = createSlashMenu();
    
    // Limpiar contenido anterior
    menu.innerHTML = '';
    
    if (commands.length === 0) {
        menu.style.display = 'none';
        return;
    }
    
    commands.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = `native-rich-editor__slash-menu-item${index === selectedIndex ? ' is-selected' : ''}`;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', index === selectedIndex);
        
        // Icono
        const iconHtml = ICONS[cmd.iconKey] || '';
        const iconDiv = document.createElement('div');
        iconDiv.className = 'native-rich-editor__slash-menu-item-icon';
        iconDiv.innerHTML = iconHtml;
        
        // Contenido
        const contentDiv = document.createElement('div');
        contentDiv.className = 'native-rich-editor__slash-menu-item-content';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'native-rich-editor__slash-menu-item-label';
        labelDiv.textContent = cmd.label;
        
        contentDiv.appendChild(labelDiv);
        
        item.appendChild(iconDiv);
        item.appendChild(contentDiv);
        
        // Click handler
        item.addEventListener('click', () => {
            if (vnode || currentEditorVnode) {
                applySlashCommand(vnode || currentEditorVnode, cmd);
            }
        });
        
        menu.appendChild(item);
    });
}

// Variable global para mantener referencia al vnode actual del editor
let currentEditorVnode = null;

function showSlashMenu(vnode, x, y, query = '') {
    currentEditorVnode = vnode; // Guardar referencia al vnode
    const menu = createSlashMenu();
    slashMenuFilter = query;
    slashMenuQuery = query;
    slashMenuSelectedIndex = 0;
    
    const filteredCommands = getFilteredSlashCommands(query);
    renderSlashMenu(filteredCommands, slashMenuSelectedIndex, vnode);
    
    if (filteredCommands.length === 0) {
        hideSlashMenu();
        return;
    }
    
    menu.style.display = 'block';
    
    // Calcular posición
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Posicionar debajo del cursor, alineado a la izquierda
    let left = x + scrollX;
    let top = y + scrollY + 8; // 8px de espacio debajo
    
    // Ajustar si se sale por la izquierda
    if (left < 8) {
        left = 8;
    }
    
    // Ajustar si se sale por la derecha
    if (left + menuRect.width > viewportWidth - 8) {
        left = viewportWidth - menuRect.width - 8;
    }
    
    // Ajustar si se sale por abajo (mostrar arriba)
    if (top + menuRect.height > scrollY + viewportHeight - 8) {
        top = y + scrollY - menuRect.height - 8;
    }
    
    // Asegurar que no se salga por arriba
    if (top < scrollY + 8) {
        top = scrollY + 8;
    }
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    
    // Cerrar al hacer clic fuera
    slashMenuCloseHandler = (clickEvent) => {
        if (menu && !menu.contains(clickEvent.target)) {
            const { state } = vnode;
            if (state.editorEl && !state.editorEl.contains(clickEvent.target)) {
                hideSlashMenu();
            }
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', slashMenuCloseHandler);
    }, 0);
}

function hideSlashMenu() {
    if (slashMenuElement) {
        slashMenuElement.style.display = 'none';
    }
    slashMenuFilter = '';
    slashMenuQuery = '';
    slashMenuSelectedIndex = 0;
    slashMenuRange = null;
    if (slashMenuCloseHandler) {
        document.removeEventListener('click', slashMenuCloseHandler);
        slashMenuCloseHandler = null;
    }
}

function applySlashCommand(vnode, command) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }
    
    // Ocultar el menú
    hideSlashMenu();
    
    // Restaurar la selección donde estaba el "/"
    if (slashMenuRange) {
        const selection = document.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(slashMenuRange);
        }
    }
    
    state.editorEl.focus();
    
    // Eliminar el texto "/" y lo que haya después
    if (slashMenuRange) {
        try {
            const range = slashMenuRange.cloneRange();
            // Expandir para incluir cualquier texto después del "/"
            const container = range.startContainer;
            const offset = range.startOffset;
            
            if (container.nodeType === Node.TEXT_NODE) {
                const textBefore = container.textContent.substring(0, offset);
                const slashIndex = textBefore.lastIndexOf('/');
                if (slashIndex >= 0) {
                    range.setStart(container, slashIndex);
                    range.setEnd(container, offset);
                }
            } else {
                // Si no es un nodo de texto, buscar hacia atrás
                const walker = document.createTreeWalker(
                    container,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                let textNode = null;
                while (walker.nextNode()) {
                    textNode = walker.currentNode;
                    if (container.contains(textNode) || container === textNode) {
                        break;
                    }
                }
                if (textNode) {
                    const text = textNode.textContent;
                    const slashIndex = text.lastIndexOf('/');
                    if (slashIndex >= 0) {
                        range.setStart(textNode, slashIndex);
                        range.setEnd(textNode, text.length);
                    }
                }
            }
            
            // Eliminar el rango que contiene "/query"
            range.deleteContents();
            
            // Colocar el cursor donde estaba el "/"
            range.collapse(true);
            const newSelection = document.getSelection();
            if (newSelection) {
                newSelection.removeAllRanges();
                newSelection.addRange(range);
            }
        } catch (error) {
            console.warn('NativeRichEditor: Error eliminando slash command', error);
        }
    }
    
    // Aplicar el comando
    try {
        if (command.type === 'formatBlock') {
            document.execCommand('formatBlock', false, `<${command.value}>`);
        } else if (command.type === 'command') {
            document.execCommand(command.command, false, null);
        } else if (command.type === 'action' && command.action === 'image') {
            // Abrir selector de archivos para imagen
            if (imageFileInput) {
                imageFileInput.click();
            }
        } else if (command.type === 'action' && command.action === 'table') {
            // Insertar tabla
            applyTable(vnode);
        }
    } catch (error) {
        console.warn('NativeRichEditor: Error aplicando slash command', error);
    }
    
    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
    m.redraw();
}

function isCursorAtStartOfLine() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }
    
    const range = selection.getRangeAt(0);
    if (!range.collapsed) {
        return false;
    }
    
    const container = range.startContainer;
    const offset = range.startOffset;
    
    // Función auxiliar para obtener el texto desde el inicio de la línea hasta el cursor
    const getLineTextBeforeCursor = () => {
        if (container.nodeType === Node.TEXT_NODE) {
            const textBefore = container.textContent.substring(0, offset);
            const lines = textBefore.split(/\r?\n/);
            return lines[lines.length - 1];
        } else if (container.nodeType === Node.ELEMENT_NODE) {
            // Buscar el nodo de texto más cercano hacia atrás
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                null
            );
            
            let textNode = null;
            let found = false;
            
            // Buscar hacia atrás desde el offset
            const nodesBefore = [];
            const allTextNodes = [];
            
            while (walker.nextNode()) {
                allTextNodes.push(walker.currentNode);
            }
            
            // Encontrar el nodo de texto que contiene o está antes del cursor
            for (let i = allTextNodes.length - 1; i >= 0; i--) {
                const node = allTextNodes[i];
                if (container.contains(node) || container === node) {
                    if (i === allTextNodes.length - 1 || node.nextSibling === null) {
                        textNode = node;
                        found = true;
                        break;
                    }
                }
            }
            
            if (textNode) {
                const text = textNode.textContent;
                return text;
            }
            
            // Si no hay nodo de texto, verificar si hay un primer hijo de texto
            const firstChild = container.firstChild;
            if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                return firstChild.textContent.substring(0, offset === 0 ? firstChild.textContent.length : Math.min(offset, firstChild.textContent.length));
            }
        }
        
        return '';
    };
    
    const lineText = getLineTextBeforeCursor();
    // Verificar si la línea empieza con "/" seguido opcionalmente de texto (pero sin espacios antes del "/" o solo espacios antes)
    const match = lineText.match(/^\s*\/[^\s]*$/);
    return match !== null;
}

function getSlashCommandQuery() {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return '';
    }
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const offset = range.startOffset;
    
    if (container.nodeType === Node.TEXT_NODE) {
        const textBefore = container.textContent.substring(0, offset);
        const lines = textBefore.split(/\r?\n/);
        const currentLine = lines[lines.length - 1];
        const match = currentLine.match(/^\s*\/([^\s]*)/);
        if (match) {
            return match[1] || '';
        }
    }
    
    return '';
}

function handleSlashCommandKeydown(vnode, event) {
    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return false;
    }
    
    // Si el menú está visible, manejar navegación
    if (slashMenuElement && slashMenuElement.style.display === 'block') {
        const filteredCommands = getFilteredSlashCommands(slashMenuQuery);
        
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            slashMenuSelectedIndex = (slashMenuSelectedIndex + 1) % filteredCommands.length;
            renderSlashMenu(filteredCommands, slashMenuSelectedIndex, vnode);
            // Scroll al item seleccionado
            const items = slashMenuElement.querySelectorAll('.native-rich-editor__slash-menu-item');
            if (items[slashMenuSelectedIndex]) {
                items[slashMenuSelectedIndex].scrollIntoView({ block: 'nearest' });
            }
            return true;
        }
        
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            slashMenuSelectedIndex = slashMenuSelectedIndex <= 0 
                ? filteredCommands.length - 1 
                : slashMenuSelectedIndex - 1;
            renderSlashMenu(filteredCommands, slashMenuSelectedIndex, vnode);
            // Scroll al item seleccionado
            const items = slashMenuElement.querySelectorAll('.native-rich-editor__slash-menu-item');
            if (items[slashMenuSelectedIndex]) {
                items[slashMenuSelectedIndex].scrollIntoView({ block: 'nearest' });
            }
            return true;
        }
        
        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            if (filteredCommands.length > 0 && filteredCommands[slashMenuSelectedIndex]) {
                applySlashCommand(vnode, filteredCommands[slashMenuSelectedIndex]);
            }
            return true;
        }
        
        if (event.key === 'Escape') {
            event.preventDefault();
            hideSlashMenu();
            return true;
        }
    }
    
    // Detectar si el usuario escribe "/" al inicio de línea
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Esperar un poco para que el "/" se inserte
        setTimeout(() => {
            if (isCursorAtStartOfLine()) {
                const selection = document.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    slashMenuRange = range.cloneRange();
                    
                    // Obtener posición del cursor
                    const rect = range.getBoundingClientRect();
                    const x = rect.left;
                    const y = rect.top;
                    
                    showSlashMenu(vnode, x, y, '');
                }
            }
        }, 0);
        return false;
    }
    
    // Si el menú está visible y el usuario escribe texto, actualizar el filtro
    if (slashMenuElement && slashMenuElement.style.display === 'block') {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            // El texto se insertará automáticamente, luego actualizamos el filtro
            setTimeout(() => {
                const query = getSlashCommandQuery();
                slashMenuQuery = query;
                const filteredCommands = getFilteredSlashCommands(query);
                slashMenuSelectedIndex = 0;
                renderSlashMenu(filteredCommands, slashMenuSelectedIndex, vnode);
            }, 0);
        }
        
        // Si presiona Backspace, actualizar el filtro también
        if (event.key === 'Backspace') {
            setTimeout(() => {
                const query = getSlashCommandQuery();
                if (query === '' || query === '/') {
                    hideSlashMenu();
                } else {
                    slashMenuQuery = query;
                    const filteredCommands = getFilteredSlashCommands(query);
                    slashMenuSelectedIndex = 0;
                    renderSlashMenu(filteredCommands, slashMenuSelectedIndex, vnode);
                }
            }, 0);
        }
    }
    
    return false;
}

function handleDrop(vnode, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const editorEl = event.currentTarget;
    if (editorEl) {
        editorEl.classList.remove('native-rich-editor__content--dragging');
    }

    const { state } = vnode;
    if (!state.editorEl || state.isSourceView) {
        return;
    }

    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
        return;
    }

    const files = Array.from(dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        return;
    }

    // Guardar la posición del cursor antes de procesar las imágenes
    saveSelection(state);
    state.editorEl.focus();
    restoreSelection(state);

    // Procesar cada imagen usando Blobs (F3.4)
    imageFiles.forEach((file, index) => {
        try {
            // Crear URL blob temporal (mucho más ligera que Base64)
            const blobUrl = URL.createObjectURL(file);
            
            // Verificar que la URL blob sea segura (blob: URLs son seguras)
            if (!blobUrl || !blobUrl.startsWith('blob:')) {
                console.warn('NativeRichEditor: Error al crear URL blob');
                return;
            }

            // Insertar la imagen en el editor usando la URL blob
            document.execCommand('insertImage', false, blobUrl);
            
            // Si es la última imagen, actualizar estados y emitir cambio
            if (index === imageFiles.length - 1) {
                saveSelection(state);
                updateActiveState(state);
                emitChange(vnode);
            }
        } catch (error) {
            console.warn('NativeRichEditor: Error al insertar imagen', error);
        }
    });
}

function toggleSourceView(vnode) {
    const { state } = vnode;
    state.isSourceView = !state.isSourceView;
    
    // Ocultar popover al cambiar de vista
    hidePopover();
    
    // Deseleccionar imagen al cambiar de vista (F3.3)
    deselectImage();
    
    // Ocultar toolbar de tabla al cambiar de vista (F4.3A)
    hideTableToolbar(vnode);

    if (state.isSourceView) {
        const html = state.editorEl ? state.editorEl.innerHTML : state.lastEmittedValue;
        const sanitized = sanitizeHtml(vnode, html);
        const normalized = normalizeHtml(sanitized);
        const formatted = formatHTML(normalized);
        state.sourceValue = formatted;
        if (state.sourceEl) {
            state.sourceEl.value = formatted;
        }
        updateActiveState(state);
        return;
    }

    const rawSource = state.sourceValue || '';
    const unformatted = rawSource.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const sanitized = sanitizeHtml(vnode, unformatted);
    const normalized = normalizeHtml(sanitized);
    if (state.editorEl && normalized !== normalizeHtml(state.editorEl.innerHTML)) {
        state.editorEl.innerHTML = normalized;
    }

    updateActiveState(state);
    emitChange(vnode);
}

export const NativeRichEditor = {
    oninit: (vnode) => {
        ensureInlineStyles();
        const initialValue = getExternalValue(vnode);
        vnode.state.lastExternalValue = initialValue;
        vnode.state.lastEmittedValue = initialValue;
        vnode.state.isFocused = false;
        vnode.state.isSourceFocused = false;
        vnode.state.isSourceView = false;
        vnode.state.editorEl = null;
        vnode.state.sourceEl = null;
        vnode.state.sourceValue = '';
        vnode.state.savedSelection = null;
        vnode.state.active = createActiveState();
        vnode.state.inlineInputMode = null; // 'image' | null (links ahora usan popover)
        vnode.state.inlineInputValue = '';
    },
    
    onremove: (vnode) => {
        // Ocultar popover al desmontar el componente
        hidePopover();
        
        // Ocultar slash menu al desmontar (F4.1)
        hideSlashMenu();
        if (slashMenuElement && slashMenuElement.parentNode) {
            slashMenuElement.parentNode.removeChild(slashMenuElement);
            slashMenuElement = null;
        }
        
        // Limpiar overlay de imagen (F3.3)
        if (vnode.state._cleanupOverlay) {
            vnode.state._cleanupOverlay();
        }
        deselectImage();
        if (imageOverlayElement && imageOverlayElement.parentNode) {
            imageOverlayElement.parentNode.removeChild(imageOverlayElement);
            imageOverlayElement = null;
        }
        
        // Limpiar toolbar de alineación (F4.2)
        if (imageToolbarElement && imageToolbarElement.parentNode) {
            imageToolbarElement.parentNode.removeChild(imageToolbarElement);
            imageToolbarElement = null;
        }
        
        // Limpiar toolbar de tabla (F4.3A)
        hideTableToolbar(vnode);
        if (tableToolbarElement && tableToolbarElement.parentNode) {
            tableToolbarElement.parentNode.removeChild(tableToolbarElement);
            tableToolbarElement = null;
        }
        
        // Limpiar todas las URLs blob del editor (F5.1)
        cleanupAllBlobUrls(vnode);
        
        // Limpiar input file de imágenes
        if (imageFileInput && imageFileInput.parentNode) {
            imageFileInput.parentNode.removeChild(imageFileInput);
            imageFileInput = null;
        }
    },

    onupdate: (vnode) => {
        const externalValue = getExternalValue(vnode);
        const { editorEl, isFocused } = vnode.state;

        if (externalValue === vnode.state.lastExternalValue) {
            return;
        }

        vnode.state.lastExternalValue = externalValue;

        const sanitizedExternal = sanitizeHtml(vnode, externalValue);
        const normalizedExternal = normalizeHtml(sanitizedExternal);

        if (vnode.state.isSourceView) {
            const sourceEl = vnode.state.sourceEl;
            const currentSource = sourceEl ? sourceEl.value : vnode.state.sourceValue || '';
            const normalizedSource = normalizeHtml(sanitizeHtml(vnode, currentSource));
            const sizeDiff = Math.abs(normalizedExternal.length - normalizedSource.length);
            const isDrastic = !vnode.state.isSourceFocused || sizeDiff > 80;

            if (isDrastic && normalizedExternal !== normalizedSource) {
                vnode.state.sourceValue = normalizedExternal;
                if (sourceEl) {
                    sourceEl.value = normalizedExternal;
                }
            }
            return;
        }

        if (!editorEl) {
            return;
        }

        const normalizedDom = normalizeHtml(editorEl.innerHTML);
        const sizeDiff = Math.abs(normalizedExternal.length - normalizedDom.length);
        const isDrastic = !isFocused || sizeDiff > 80;

        if (isDrastic && normalizedExternal !== normalizedDom) {
            editorEl.innerHTML = normalizedExternal;
        }
    },

    view: (vnode) => {
        const placeholder = vnode.attrs.placeholder || 'Escribe aqui...';
        const toolbarLabel = vnode.attrs.toolbarLabel || 'Editor';
        const isSourceView = vnode.state.isSourceView;
        const syncSelectionState = () => {
            saveSelection(vnode.state);
            updateActiveState(vnode.state);
        };
        const handleInput = () => {
            syncSelectionState();
            emitChange(vnode);
        };
        const handleSourceInput = () => {
            emitSourceChange(vnode);
        };

        const { inlineInputMode, inlineInputValue } = vnode.state;
        const showInlineInput = false; // Ya no usamos input inline para imágenes, ahora usamos selector de archivos

        return m('div', {
            class: `native-rich-editor${isSourceView ? ' native-rich-editor--source' : ''}`
        }, [
            m('div', {
                class: 'native-rich-editor__toolbar',
                role: 'toolbar',
                'aria-label': `${toolbarLabel} toolbar`
            }, showInlineInput ? [
                m('input', {
                    class: 'native-rich-editor__inline-input',
                    type: 'text',
                    placeholder: inlineInputMode === 'link' ? 'URL del enlace' : 'URL de la imagen',
                    value: inlineInputValue,
                    oncreate: (inputVnode) => {
                        inputVnode.dom.focus();
                        inputVnode.dom.select();
                    },
                    oninput: (event) => {
                        vnode.state.inlineInputValue = event.target.value;
                    },
                    onkeydown: (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            confirmInlineInput(vnode);
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelInlineInput(vnode);
                        }
                    }
                }),
                m('button', {
                    type: 'button',
                    class: 'native-rich-editor__button native-rich-editor__button--confirm',
                    title: 'Confirmar',
                    onclick: () => confirmInlineInput(vnode)
                }, m.trust(ICONS.check)),
                m('button', {
                    type: 'button',
                    class: 'native-rich-editor__button native-rich-editor__button--cancel',
                    title: 'Cancelar',
                    onclick: () => cancelInlineInput(vnode)
                }, m.trust(ICONS.close))
            ] : (() => {
                const buttons = [];
                let lastGroup = null;
                
                TOOLBAR_COMMANDS.forEach((item, index) => {
                    // Agregar separador si cambia el grupo
                    if (lastGroup !== null && lastGroup !== item.group) {
                        buttons.push(m('div', {
                            key: `separator-${index}`,
                            class: 'native-rich-editor__separator'
                        }));
                    }
                    lastGroup = item.group;
                    
                    const isActive = !!vnode.state.active[item.id];
                    const isDisabled = isSourceView && item.type !== 'toggle';
                    const isSourceButton = item.id === 'source';
                    const iconHtml = ICONS[item.iconKey] || '';
                    
                    buttons.push(m('button', {
                        key: item.id,
                        type: 'button',
                        class: `native-rich-editor__button${isActive ? ' is-active' : ''}${isSourceButton ? ' native-rich-editor__button--source' : ''}`,
                        'aria-pressed': isActive ? 'true' : 'false',
                        disabled: isDisabled,
                        oncreate: (buttonVnode) => {
                            // Configurar tooltip después de que el botón se cree
                            if (!isDisabled && item.shortcut) {
                                setTimeout(() => {
                                    setupTooltip(buttonVnode.dom, item.label, item.shortcut);
                                }, 0);
                            }
                        },
                        onmousedown: (event) => {
                            if (isDisabled) {
                                return;
                            }
                            event.preventDefault();
                            saveSelection(vnode.state);
                        },
                        onclick: () => {
                            if (isDisabled) {
                                return;
                            }

                            if (item.type === 'formatBlock') {
                                applyFormatBlock(vnode, item.value);
                                return;
                            }

                            if (item.type === 'command') {
                                applyCommand(vnode, item.command);
                                return;
                            }

                            if (item.action === 'link') {
                                applyLink(vnode);
                                return;
                            }

                            if (item.action === 'image') {
                                applyImage(vnode);
                                return;
                            }

                            if (item.action === 'table') {
                                applyTable(vnode);
                                return;
                            }

                            if (item.action === 'source') {
                                toggleSourceView(vnode);
                            }
                        }
                    }, m('span', { class: 'native-rich-editor__button-icon' }, iconHtml ? m.trust(iconHtml) : item.label)));
                });
                
                return buttons;
            })()),
            m('div', { class: 'native-rich-editor__surface' }, [
                m('div', {
                    class: 'native-rich-editor__content',
                    contenteditable: 'true',
                    spellcheck: true,
                    'data-placeholder': placeholder,
                    'aria-label': toolbarLabel,
                    oncreate: (contentVnode) => {
                        vnode.state.editorEl = contentVnode.dom;
                        configureExecCommandDefaults();
                        const externalValue = sanitizeHtml(vnode, getExternalValue(vnode));
                        const normalizedExternal = normalizeHtml(externalValue);
                        if (normalizedExternal && normalizedExternal !== normalizeHtml(contentVnode.dom.innerHTML)) {
                            contentVnode.dom.innerHTML = normalizedExternal;
                        }
                        
                        // Actualizar posición del overlay al hacer scroll o redimensionar (F3.3)
                        const updateOverlayPosition = () => {
                            if (selectedImageElement) {
                                updateImageOverlayPosition();
                            }
                        };
                        
                        window.addEventListener('scroll', updateOverlayPosition, true);
                        window.addEventListener('resize', updateOverlayPosition);
                        
                        // Guardar función de limpieza en el estado del vnode principal
                        vnode.state._cleanupOverlay = () => {
                            window.removeEventListener('scroll', updateOverlayPosition, true);
                            window.removeEventListener('resize', updateOverlayPosition);
                            deselectImage();
                        };
                    },
                    onfocus: () => {
                        vnode.state.isFocused = true;
                        configureExecCommandDefaults();
                        syncSelectionState();
                    },
                    onblur: () => {
                        vnode.state.isFocused = false;
                        handleInput();
                        // Ocultar slash menu al perder el foco (F4.1)
                        hideSlashMenu();
                    },
                    oninput: () => {
                        handleInput();
                    },
                    onkeyup: () => {
                        syncSelectionState();
                    },
                    onkeydown: (event) => {
                        // Manejar navegación por teclado en tablas (F4.3B)
                        if (handleTableKeyboardNavigation(vnode, event)) {
                            return;
                        }
                        
                        // Manejar Slash Commands (F4.1)
                        if (handleSlashCommandKeydown(vnode, event)) {
                            return;
                        }
                        
                        // Manejar cursor en bordes de formatos inline (F2.2)
                        if (handleCursorAtFormatEdge(event)) {
                            // Si se manejó el evento, actualizar estados y emitir cambio
                            setTimeout(() => {
                                syncSelectionState();
                                emitChange(vnode);
                            }, 0);
                            return;
                        }
                        
                        // Detectar movimiento del cursor con flechas para actualizar estados activos
                        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                        if (arrowKeys.includes(event.key)) {
                            // Usar setTimeout para que el cursor se mueva primero
                            setTimeout(() => {
                                syncSelectionState();
                            }, 0);
                        }
                    },
                    onmouseup: () => {
                        syncSelectionState();
                    },
                    onclick: (event) => {
                        // Detectar clic en enlaces para mostrar popover de edición (F3.2)
                        const target = event.target;
                        if (target && target.tagName && target.tagName.toLowerCase() === 'a') {
                            handleLinkClick(vnode, event, target);
                            return;
                        }
                        
                        // Detectar clic en imágenes para selección y redimensionamiento (F3.3)
                        if (target && target.tagName && target.tagName.toLowerCase() === 'img') {
                            handleImageClick(vnode, event, target);
                            return;
                        }
                        
                        // Detectar clic en celdas de tabla para mostrar toolbar (F4.3A)
                        if (target && (target.tagName === 'TD' || target.tagName === 'TH')) {
                            handleTableCellClick(vnode, event, target);
                            return;
                        }
                        
                        // Deseleccionar imagen si se hace clic fuera de ella (F4.2)
                        if (selectedImageElement && 
                            target !== selectedImageElement && 
                            !imageOverlayElement?.contains(target) &&
                            !imageToolbarElement?.contains(target)) {
                            deselectImage();
                            m.redraw();
                        }
                        
                        // Deseleccionar tabla si se hace clic fuera de ella (F4.3A)
                        if (selectedTableCell && 
                            target !== selectedTableCell && 
                            !tableToolbarElement?.contains(target) &&
                            !target.closest('table')) {
                            hideTableToolbar(vnode);
                            m.redraw();
                        }
                    },
                    onpaste: (event) => {
                        if (vnode.attrs.plainPaste === false) {
                            return;
                        }

                        const clipboard = event.clipboardData;
                        if (!clipboard) {
                            return;
                        }

                        const text = clipboard.getData('text/plain');
                        event.preventDefault();

                        if (!vnode.state.editorEl) {
                            return;
                        }

                        vnode.state.editorEl.focus();
                        restoreSelection(vnode.state);
                        document.execCommand('insertText', false, text);
                        saveSelection(vnode.state);
                        emitChange(vnode);
                    },
                    ondragover: handleDragOver,
                    ondragenter: handleDragEnter,
                    ondragleave: handleDragLeave,
                    ondrop: (event) => handleDrop(vnode, event)
                }),
                m('textarea', {
                    class: 'native-rich-editor__source',
                    oncreate: (sourceVnode) => {
                        vnode.state.sourceEl = sourceVnode.dom;
                        sourceVnode.dom.value = vnode.state.sourceValue || '';
                    },
                    onfocus: () => {
                        vnode.state.isSourceFocused = true;
                    },
                    onblur: () => {
                        vnode.state.isSourceFocused = false;
                        handleSourceInput();
                    },
                    oninput: (event) => {
                        vnode.state.sourceValue = event.target.value;
                        handleSourceInput();
                    },
                    spellcheck: false
                })
            ])
        ]);
    }
};
