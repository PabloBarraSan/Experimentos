const TOOLBAR_COMMANDS = [
    { id: 'h1', label: 'H1', type: 'formatBlock', value: 'h1', icon: 'H1' },
    { id: 'h2', label: 'H2', type: 'formatBlock', value: 'h2', icon: 'H2' },
    { id: 'blockquote', label: 'Cita', type: 'formatBlock', value: 'blockquote', icon: '""' },
    { id: 'bold', label: 'Negrita', type: 'command', command: 'bold', icon: 'B' },
    { id: 'italic', label: 'Cursiva', type: 'command', command: 'italic', icon: 'I' },
    { id: 'underline', label: 'Subrayado', type: 'command', command: 'underline', icon: 'U' },
    { id: 'unordered', label: 'Lista', type: 'command', command: 'insertUnorderedList', icon: 'UL' },
    { id: 'ordered', label: 'Lista num', type: 'command', command: 'insertOrderedList', icon: 'OL' },
    { id: 'link', label: 'Enlace', type: 'action', action: 'link', icon: 'Link' },
    { id: 'image', label: 'Imagen', type: 'action', action: 'image', icon: 'Img' },
    { id: 'source', label: 'HTML', type: 'toggle', action: 'source', icon: '<>' }
];

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
    'img'
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
                state.active[item.id] = document.queryCommandState(item.command);
            } catch (error) {
                state.active[item.id] = false;
            }
            return;
        }

        state.active[item.id] = false;
    });
}

function emitChange(vnode) {
    const { editorEl } = vnode.state;
    if (!editorEl) {
        return;
    }

    const sanitized = sanitizeHtml(vnode, editorEl.innerHTML);
    const cleaned = normalizeHtml(sanitized);
    if (cleaned === '' && editorEl.innerHTML !== '') {
        editorEl.innerHTML = '';
    }
    vnode.state.lastEmittedValue = cleaned;

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

function applyCommand(vnode, command) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    try {
        document.execCommand(command, false, null);
    } catch (error) {
        console.warn('NativeRichEditor: execCommand failed', error);
    }

    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
}

function applyFormatBlock(vnode, tagName) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    try {
        document.execCommand('formatBlock', false, `<${tagName}>`);
    } catch (error) {
        console.warn('NativeRichEditor: formatBlock failed', error);
    }

    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
}

function applyLink(vnode) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }

    const rawUrl = window.prompt('URL del enlace');
    if (!rawUrl) {
        return;
    }

    const safeUrl = sanitizeUrl(rawUrl, 'link');
    if (!safeUrl) {
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    try {
        document.execCommand('createLink', false, safeUrl);
    } catch (error) {
        console.warn('NativeRichEditor: createLink failed', error);
    }

    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
}

function applyImage(vnode) {
    const { state } = vnode;
    if (!state.editorEl) {
        return;
    }

    const rawUrl = window.prompt('URL de la imagen');
    if (!rawUrl) {
        return;
    }

    const safeUrl = sanitizeUrl(rawUrl, 'image');
    if (!safeUrl) {
        return;
    }

    state.editorEl.focus();
    restoreSelection(state);

    try {
        document.execCommand('insertImage', false, safeUrl);
    } catch (error) {
        console.warn('NativeRichEditor: insertImage failed', error);
    }

    saveSelection(state);
    updateActiveState(state);
    emitChange(vnode);
}

function toggleSourceView(vnode) {
    const { state } = vnode;
    state.isSourceView = !state.isSourceView;

    if (state.isSourceView) {
        const html = state.editorEl ? state.editorEl.innerHTML : state.lastEmittedValue;
        const sanitized = sanitizeHtml(vnode, html);
        const normalized = normalizeHtml(sanitized);
        state.sourceValue = normalized;
        if (state.sourceEl) {
            state.sourceEl.value = normalized;
        }
        updateActiveState(state);
        return;
    }

    const sanitized = sanitizeHtml(vnode, state.sourceValue || '');
    const normalized = normalizeHtml(sanitized);
    if (state.editorEl && normalized !== normalizeHtml(state.editorEl.innerHTML)) {
        state.editorEl.innerHTML = normalized;
    }

    updateActiveState(state);
    emitChange(vnode);
}

export const NativeRichEditor = {
    oninit: (vnode) => {
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

        return m('div', {
            class: `native-rich-editor${isSourceView ? ' native-rich-editor--source' : ''}`
        }, [
            m('div', {
                class: 'native-rich-editor__toolbar',
                role: 'toolbar',
                'aria-label': `${toolbarLabel} toolbar`
            }, TOOLBAR_COMMANDS.map((item) => {
                const isActive = !!vnode.state.active[item.id];
                const isDisabled = isSourceView && item.type !== 'toggle';
                const isSourceButton = item.id === 'source';
                return m('button', {
                    key: item.id,
                    type: 'button',
                    class: `native-rich-editor__button${isActive ? ' is-active' : ''}${isSourceButton ? ' native-rich-editor__button--source' : ''}`,
                    'aria-pressed': isActive ? 'true' : 'false',
                    disabled: isDisabled,
                    title: item.label,
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

                        if (item.action === 'source') {
                            toggleSourceView(vnode);
                        }
                    }
                }, [
                    m('span', { class: 'native-rich-editor__button-icon' }, item.icon),
                    m('span', { class: 'native-rich-editor__button-label' }, item.label)
                ]);
            })),
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
                    },
                    onfocus: () => {
                        vnode.state.isFocused = true;
                        configureExecCommandDefaults();
                        syncSelectionState();
                    },
                    onblur: () => {
                        vnode.state.isFocused = false;
                        handleInput();
                    },
                    oninput: () => {
                        handleInput();
                    },
                    onkeyup: () => {
                        syncSelectionState();
                    },
                    onmouseup: () => {
                        syncSelectionState();
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
                    }
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
