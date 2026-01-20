const TOOLBAR_COMMANDS = [
    { id: 'bold', label: 'Negrita', command: 'bold', icon: 'B' },
    { id: 'italic', label: 'Cursiva', command: 'italic', icon: 'I' },
    { id: 'underline', label: 'Subrayado', command: 'underline', icon: 'U' },
    { id: 'unordered', label: 'Lista', command: 'insertUnorderedList', icon: 'UL' },
    { id: 'ordered', label: 'Lista num', command: 'insertOrderedList', icon: 'OL' }
];

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

function updateActiveState(state) {
    if (!state.editorEl) {
        return;
    }

    TOOLBAR_COMMANDS.forEach((item) => {
        try {
            state.active[item.id] = document.queryCommandState(item.command);
        } catch (error) {
            state.active[item.id] = false;
        }
    });
}

function emitChange(vnode) {
    const { editorEl } = vnode.state;
    if (!editorEl) {
        return;
    }

    const cleaned = normalizeHtml(editorEl.innerHTML);
    if (cleaned === '' && editorEl.innerHTML !== '') {
        editorEl.innerHTML = '';
    }
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

export const NativeRichEditor = {
    oninit: (vnode) => {
        const initialValue = getExternalValue(vnode);
        vnode.state.lastExternalValue = initialValue;
        vnode.state.lastEmittedValue = initialValue;
        vnode.state.isFocused = false;
        vnode.state.editorEl = null;
        vnode.state.savedSelection = null;
        vnode.state.active = {
            bold: false,
            italic: false,
            underline: false,
            unordered: false,
            ordered: false
        };
    },

    onupdate: (vnode) => {
        const externalValue = getExternalValue(vnode);
        const { editorEl, isFocused } = vnode.state;

        if (externalValue === vnode.state.lastExternalValue) {
            return;
        }

        vnode.state.lastExternalValue = externalValue;

        if (!editorEl) {
            return;
        }

        const normalizedExternal = normalizeHtml(externalValue);
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

        return m('div', { class: 'native-rich-editor' }, [
            m('div', {
                class: 'native-rich-editor__toolbar',
                role: 'toolbar',
                'aria-label': `${toolbarLabel} toolbar`
            }, TOOLBAR_COMMANDS.map((item) => {
                const isActive = !!vnode.state.active[item.id];
                return m('button', {
                    key: item.id,
                    type: 'button',
                    class: `native-rich-editor__button${isActive ? ' is-active' : ''}`,
                    'aria-pressed': isActive ? 'true' : 'false',
                    title: item.label,
                    onmousedown: (event) => {
                        event.preventDefault();
                        saveSelection(vnode.state);
                    },
                    onclick: () => applyCommand(vnode, item.command)
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
                        const externalValue = normalizeHtml(getExternalValue(vnode));
                        if (externalValue && externalValue !== normalizeHtml(contentVnode.dom.innerHTML)) {
                            contentVnode.dom.innerHTML = externalValue;
                        }
                    },
                    onfocus: () => {
                        vnode.state.isFocused = true;
                        configureExecCommandDefaults();
                        saveSelection(vnode.state);
                        updateActiveState(vnode.state);
                    },
                    onblur: () => {
                        vnode.state.isFocused = false;
                        saveSelection(vnode.state);
                        updateActiveState(vnode.state);
                        emitChange(vnode);
                    },
                    oninput: () => {
                        saveSelection(vnode.state);
                        updateActiveState(vnode.state);
                        emitChange(vnode);
                    },
                    onkeyup: () => {
                        saveSelection(vnode.state);
                        updateActiveState(vnode.state);
                    },
                    onmouseup: () => {
                        saveSelection(vnode.state);
                        updateActiveState(vnode.state);
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
                })
            ])
        ]);
    }
};
