// Dashboard View Component using Mithril and DView

import { FlexCol, FlexRow, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Label, Segment } from '../../../DView/elements.js';
import { Input, Switch, Checkbox, TranslationInput } from '../../../DView/forms.js';
import { Modal, ModalHeader, ModalContent, ModalFooter, openDialog } from '../../../DView/dialogs.js';

export const DashboardView = {
    oninit: (vnode) => {
        vnode.state.searchTerm = '';
        vnode.state.showUnpublished = false;
        vnode.state.filterType = 'all';
        vnode.state.bentoGridId = `bento-grid-${Math.random().toString(36).substring(2, 9)}`;
        vnode.state.editingGroup = null;
    },
    
    view: (vnode) => {
        const { app } = vnode.attrs;
        const state = vnode.state;
        
        // Filter resources
        const sortedGroups = Object.keys(app.groupedData || {}).sort();
        const filteredGroups = {};
        
        sortedGroups.forEach(groupName => {
            let resources = app.groupedData[groupName] || [];
            
            // Verificar si el grupo está publicado (todos los recursos están publicados)
            const groupPublished = resources.every(r => r.published);
            
            // Filtrar grupos no publicados a menos que showUnpublished esté activo
            if (!state.showUnpublished && !groupPublished) {
                return; // Saltar este grupo
            }
            
            resources = resources.filter(r => {
                const name = r.name || r.title || "";
                const matchesSearch = name.toLowerCase().includes(state.searchTerm.toLowerCase()) || 
                                    groupName.toLowerCase().includes(state.searchTerm.toLowerCase());
                const matchesPub = state.showUnpublished ? true : r.published;
                let matchesType = true;
                if (state.filterType !== 'all') {
                    matchesType = r.type === state.filterType;
                }
                return matchesSearch && matchesPub && matchesType;
            });
            
            if (resources.length > 0) {
                filteredGroups[groupName] = resources;
            }
        });
        
        return m(FlexCol, { gap: '2rem' }, [
            // Page Header
            m(FlexCol, { gap: '0.5rem' }, [
                m(H1, { fontSize: '1.875rem', fontWeight: 'bold', color: '#0f172a' }, 
                    'Cita previa y Reservas'),
                m(Text, { fontSize: '1.125rem', color: '#64748b', maxWidth: '48rem' },
                    'Gestiona las reservas y citas con el personal del ayuntamiento.')
            ]),
            
            // Toolbar / Filters
            m(Segment, { type: 'primary', style: { padding: '1rem', } }, [
                m('div', {
                    class: 'toolbar-container',
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }
                }, [
                    // Search and Filters
                    m('div', {
                        class: 'search-filters-container',
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            flex: 1
                        }
                    }, [
                        // Search Input
                        m('div', {
                            class: 'search-input-wrapper',
                            style: {
                                width: '100%'
                            }
                        }, [
                            m('span', {
                                class: 'material-icons'
                            }, 'search'),
                            m(Input, {
                                placeholder: 'Busca grupos o recursos...',
                                value: state.searchTerm,
                                oninput: (e) => {
                                    state.searchTerm = e.target.value;
                                    m.redraw();
                                },
                                style: {
                                    width: '100%'
                                }
                            })
                        ]),
                        
                        // Type Filters
                        m(FlexRow, {
                            gap: '0.5rem',
                            alignItems: 'center',
                            style: {
                                overflowX: 'auto',
                                paddingBottom: '0.25rem',
                                '@media (min-width: 640px)': { paddingBottom: 0 }
                            }
                        }, [
                            m(Button, {
                                type: state.filterType === 'all' ? 'blue' : 'default',
                                size: 'small',
                                onclick: () => {
                                    state.filterType = 'all';
                                    m.redraw();
                                },
                                style: {
                                    fontSize: '0.75rem',
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '9999px',
                                    whiteSpace: 'nowrap'
                                }
                            }, 'Todos'),
                            m(Button, {
                                type: state.filterType === 'booking' ? 'blue' : 'default',
                                size: 'small',
                                onclick: () => {
                                    state.filterType = 'booking';
                                    m.redraw();
                                },
                                style: {
                                    fontSize: '0.75rem',
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '9999px',
                                    whiteSpace: 'nowrap'
                                }
                            }, 'Reservas'),
                            m(Button, {
                                type: state.filterType === 'bon' ? 'blue' : 'default',
                                size: 'small',
                                onclick: () => {
                                    state.filterType = 'bon';
                                    m.redraw();
                                },
                                style: {
                                    fontSize: '0.75rem',
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '9999px',
                                    whiteSpace: 'nowrap'
                                }
                            }, 'Bonos'),
                            m(Button, {
                                type: state.filterType === 'appointment' ? 'blue' : 'default',
                                size: 'small',
                                onclick: () => {
                                    state.filterType = 'appointment';
                                    m.redraw();
                                },
                                style: {
                                    fontSize: '0.75rem',
                                    padding: '0.375rem 0.75rem',
                                    borderRadius: '9999px',
                                    whiteSpace: 'nowrap'
                                }
                            }, 'Citas')
                        ])
                    ]),
                    
                    // Actions Toolbar
                    m('div', {
                        class: 'actions-toolbar',
                        style: {
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                        }
                    }, [
                        // Navigation Links
                        m(Segment, {
                            type: 'secondary',
                            style: {
                                padding: '0.25rem',
                                display: 'flex',
                                gap: '0.25rem',
                                alignItems: 'center'
                            }
                        }, [
                            m('a', {
                                href: '#/kiosko',
                                onclick: (e) => {
                                    e.preventDefault();
                                    m.route.set('/kiosko');
                                },
                                class: 'toolbar-button'
                            }, [
                                m('span', { class: 'material-icons' }, 'confirmation_number'),
                                m(Text, { fontSize: '0.875rem', margin: 0 }, 'Kiosko')
                            ]),
                            m('a', {
                                href: './citaprevia_web.html',
                                target: '_blank',
                                class: 'toolbar-button'
                            }, [
                                m('span', { class: 'material-icons' }, 'language'),
                                m(Text, { fontSize: '0.875rem', margin: 0 }, 'Web')
                            ]),
                            m('a', {
                                href: '#/tv',
                                onclick: (e) => {
                                    e.preventDefault();
                                    m.route.set('/tv');
                                },
                                class: 'toolbar-button'
                            }, [
                                m('span', { class: 'material-icons' }, 'tv'),
                                m(Text, { fontSize: '0.875rem', margin: 0 }, 'TV')
                            ]),
                            m('a', {
                                href: '#/stats',
                                onclick: (e) => {
                                    e.preventDefault();
                                    m.route.set('/stats');
                                },
                                class: 'toolbar-button'
                            }, [
                                m('span', { class: 'material-icons' }, 'bar_chart'),
                                m(Text, { fontSize: '0.875rem', margin: 0 }, 'Stats')
                            ])
                        ]),
                        
                        m(Div, {
                            style: {
                                height: '32px',
                                width: '1px',
                                backgroundColor: '#e2e8f0',
                                margin: '0 0.25rem'
                            }
                        }),
                        
                        // Toggle Unpublished
                        m(FlexRow, {
                            alignItems: 'center',
                            gap: '0.5rem',
                            style: {
                                backgroundColor: '#f1f5f9',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #e2e8f0'
                            }
                        }, [
                            m(Switch, {
                                isActive: state.showUnpublished,
                                onchange: () => {
                                    state.showUnpublished = !state.showUnpublished;
                                    m.redraw();
                                }
                            }),
                            m(SmallText, { 
                                fontSize: '0.875rem',
                                margin: 0,
                                cursor: 'pointer',
                                onclick: () => {
                                    state.showUnpublished = !state.showUnpublished;
                                    m.redraw();
                                }
                            }, 'Mostrar No Publicados')
                        ]),
                        
                        // Settings Button
                        m(Button, {
                            type: 'default',
                            onclick: () => {},
                            style: {
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.5rem',
                                minWidth: 'auto'
                            }
                        }, [
                            m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'settings')
                        ]),
                        
                        // Add Button
                        m(Button, {
                            type: 'positive',
                            onclick: () => {},
                            style: {
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }
                        }, [
                            m(Text, { fontSize: '0.875rem', fontWeight: 500, margin: 0 }, 'Añadir'),
                            m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'add')
                        ])
                    ])
                ])
            ]),
            
            // Resources Grid - Masonry Style
            m('style', `
                #${vnode.state.bentoGridId} {
                    column-count: 1;
                    column-gap: 1.5rem;
                    padding-bottom: 3rem;
                }
                
                @media (min-width: 640px) {
                    #${vnode.state.bentoGridId} {
                        column-count: 2;
                    }
                }
                
                @media (min-width: 1024px) {
                    #${vnode.state.bentoGridId} {
                        column-count: 3;
                    }
                }
                
                @media (min-width: 1400px) {
                    #${vnode.state.bentoGridId} {
                        column-count: 4;
                    }
                }
                
                @media (min-width: 1800px) {
                    #${vnode.state.bentoGridId} {
                        column-count: 4;
                    }
                }
                
                #${vnode.state.bentoGridId} .masonry-card {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    margin-bottom: 1.5rem !important;
                    display: inline-block;
                    width: 100%;
                    vertical-align: top;
                }
                
                #${vnode.state.bentoGridId} > .masonry-card {
                    margin-bottom: 1.5rem !important;
                }
                
                #${vnode.state.bentoGridId} .masonry-card:hover > div {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
            `),
            m(Div, {
                id: vnode.state.bentoGridId,
                class: 'masonry-grid'
            }, Object.keys(filteredGroups).map(groupName => {
                const resources = filteredGroups[groupName];
                
                return m(Div, {
                    key: groupName,
                    class: 'masonry-card',
                    style: {
                        marginBottom: '1.5rem'
                    }
                }, [
                    m(Div, {
                        style: {
                            backgroundColor: 'white',
                            borderRadius: '0.75rem',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'box-shadow 0.3s ease'
                        },
                        onmouseenter: (e) => {
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                        }
                    }, [
                    // Group Header
                    m(Div, {
                        style: {
                            padding: '1.25rem 1.25rem',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: 'rgba(248, 250, 252, 0.5)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }
                    }, [
                        m(FlexCol, { gap: '0.25rem' }, [
                            m(H2, {
                                fontSize: '18px',
                                fontWeight: 'bold',
                                color: '#1e293b',
                                textTransform: 'uppercase',
                                lineHeight: '1.25',
                                margin: 0
                            }, groupName.toUpperCase())
                        ]),
                        m(FlexRow, { gap: '0.25rem' }, [
                            m(Tappable, {
                                onclick: () => {},
                                style: {
                                    padding: '0.375rem',
                                    borderRadius: '0.375rem',
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                },
                                hover: {
                                    color: '#2563eb',
                                    backgroundColor: '#dbeafe'
                                }
                            }, [
                                m('i', { class: 'fa-solid fa-users', style: { fontSize: '14px' } })
                            ]),
                            m(Tappable, {
                                onclick: () => {
                                    state.editingGroup = groupName;
                                    m.redraw();
                                },
                                style: {
                                    padding: '0.375rem',
                                    borderRadius: '0.375rem',
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease'
                                },
                                hover: {
                                    color: '#16a34a',
                                    backgroundColor: '#dcfce7'
                                }
                            }, [
                                m('i', { class: 'fa-solid fa-pen', style: { fontSize: '14px' } })
                            ])
                        ])
                    ]),
                    
                    // Resources List
                    m(Div, {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0'
                        }
                    }, resources.map((res, index) => {
                        const imgUrl = res.photo ? `${res.photo}?w=210&h=140&thumbnail=true` : 
                                      'https://via.placeholder.com/210x140?text=No+Image';
                        const resName = res.name || res.title || "Sin nombre";
                        const isLast = index === resources.length - 1;
                        
                        return m(Tappable, {
                            key: res._id,
                            onclick: () => m.route.set(`/resource/${res._id}/admin`),
                            style: {
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                            },
                            hover: {
                                backgroundColor: '#f8fafc'
                            }
                        }, [
                            m('img', {
                                src: imgUrl,
                                alt: resName,
                                style: {
                                    width: '64px',
                                    height: '48px',
                                    objectFit: 'cover',
                                    borderRadius: '0.5rem',
                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                    transition: 'transform 0.3s ease'
                                },
                                onerror: (e) => {
                                    e.target.src = 'https://via.placeholder.com/210x140?text=Error';
                                },
                                onmouseenter: (e) => {
                                    e.target.style.transform = 'scale(1.05)';
                                },
                                onmouseleave: (e) => {
                                    e.target.style.transform = 'scale(1)';
                                }
                            }),
                            m(FlexCol, {
                                flex: 1,
                                gap: '0.25rem'
                            }, [
                                m(Text, {
                                    fontSize: '14px',
                                    color: '#334155',
                                    margin: 0,
                                    transition: 'color 0.2s ease',
                                    onmouseenter: (e) => {
                                        e.target.style.color = '#2563eb';
                                    },
                                    onmouseleave: (e) => {
                                        e.target.style.color = '#334155';
                                    }
                                }, resName),
                                !res.published && m(Label, {
                                    type: 'negative',
                                    size: 'small',
                                    style: {
                                        fontSize: '0.75rem',
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: '9999px',
                                        border: '1px solid #fee2e2',
                                        backgroundColor: '#fef2f2'
                                    }
                                }, 'No Publicado')
                            ]),
                            m('i', {
                                class: 'fa-solid fa-chevron-right',
                                style: {
                                    fontSize: '0.75rem',
                                    color: '#cbd5e1',
                                    transition: 'color 0.2s ease'
                                },
                                onmouseenter: (e) => {
                                    e.target.style.color = '#2563eb';
                                },
                                onmouseleave: (e) => {
                                    e.target.style.color = '#cbd5e1';
                                }
                            })
                        ]);
                    }))
                    ])
                ]);
            })),
            
            // Edit Group Modal
            state.editingGroup && m(EditGroupModal, {
                groupName: state.editingGroup,
                resources: filteredGroups[state.editingGroup] || [],
                onClose: () => {
                    state.editingGroup = null;
                    m.redraw();
                }
            })
        ]);
    }
};

// Edit Group Modal Component
const EditGroupModal = {
    oninit: (vnode) => {
        const { resources } = vnode.attrs;
        const firstResource = resources[0] || {};
        
        vnode.state.formData = {
            name: vnode.attrs.groupName,
            type: firstResource.type || '',
            title: firstResource.title || '',
            available: firstResource.available !== false,
            combineResources: firstResource.combineResources || false,
            disableWeb: firstResource.disableWeb || false,
            disableApp: firstResource.disableApp || false,
            disableKiosko: firstResource.disableKiosko || false,
            description: firstResource.description || '',
            photo: firstResource.photo || ''
        };
        vnode.state.activeTab = 'description';
    },
    
    view: (vnode) => {
        const { groupName, resources, onClose } = vnode.attrs;
        const state = vnode.state;
        const firstResource = resources[0] || {};
        
        return m(Modal, {
            size: 'big',
            close: onClose,
            header: 'Actualizar Grupo'
        }, [
            m(ModalContent, {
                style: { maxHeight: '70vh', overflowY: 'auto' }
            }, [
                // ID and Database button
                m(FlexRow, {
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    style: { marginBottom: '1rem' }
                }, [
                    m(Text, { fontSize: '0.8rem', color: '#64748b' }, firstResource._id || ''),
                    m(Button, {
                        type: 'default',
                        size: 'small',
                        onclick: () => {}
                    }, [
                        m(Icon, { icon: 'database', size: 'small' })
                    ])
                ]),
                
                // Form Fields
                m(FlexRow, { gap: '1rem', style: { marginBottom: '1rem' } }, [
                    m(FlexCol, { flex: 1 }, [
                        m(Input, {
                            label: 'Nombre',
                            data: state.formData,
                            name: 'name',
                            value: state.formData.name
                        }),
                        m(Input, {
                            label: 'Tipo',
                            data: state.formData,
                            name: 'type',
                            value: state.formData.type
                        })
                    ]),
                    m(FlexCol, { flex: 1 }, [
                        m(TranslationInput, {
                            label: 'Título',
                            data: state.formData,
                            name: 'title'
                        })
                    ]),
                    m(FlexCol, { flex: 1, alignItems: 'center' }, [
                        m(Tappable, {
                            style: {
                                cursor: 'pointer',
                                borderRadius: '1rem',
                                margin: '0 auto',
                                textAlign: 'center',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0'
                            },
                            onclick: () => {}
                        }, [
                            state.formData.photo ? m('img', {
                                src: `${state.formData.photo}?w=300`,
                                style: {
                                    width: '100%',
                                    height: 'auto',
                                    borderRadius: '1rem',
                                    marginBottom: '5px'
                                }
                            }) : null,
                            m(Text, { fontSize: '0.875rem', color: '#64748b' }, 'Pulsa en la imagen para cambiarla')
                        ])
                    ])
                ]),
                
                // Checkboxes Row 1
                m(FlexRow, { gap: '1rem', style: { marginBottom: '1rem' } }, [
                    m(Checkbox, {
                        data: state.formData,
                        name: 'available',
                        label: 'Disponible',
                        checked: state.formData.available
                    }),
                    m(Checkbox, {
                        data: state.formData,
                        name: 'combineResources',
                        label: 'Combinar recursos',
                        checked: state.formData.combineResources
                    })
                ]),
                
                // Checkboxes Row 2
                m(FlexRow, { gap: '1rem', style: { marginBottom: '1rem' } }, [
                    m(Checkbox, {
                        data: state.formData,
                        name: 'disableWeb',
                        label: 'Desactivar en la web',
                        checked: state.formData.disableWeb
                    }),
                    m(Checkbox, {
                        data: state.formData,
                        name: 'disableApp',
                        label: 'Desactivar en la app',
                        checked: state.formData.disableApp
                    }),
                    m(Checkbox, {
                        data: state.formData,
                        name: 'disableKiosko',
                        label: 'Desactivar en el kiosko',
                        checked: state.formData.disableKiosko
                    })
                ]),
                
                // Tabs
                m(FlexRow, {
                    style: {
                        borderBottom: '1px solid #e2e8f0',
                        marginBottom: '1rem'
                    }
                }, [
                    m(Tappable, {
                        onclick: () => {
                            state.activeTab = 'description';
                            m.redraw();
                        },
                        style: {
                            padding: '0.75rem 1rem',
                            borderBottom: state.activeTab === 'description' ? '2px solid #2563eb' : 'none',
                            color: state.activeTab === 'description' ? '#2563eb' : '#64748b',
                            cursor: 'pointer'
                        }
                    }, 'Descripción'),
                    m(Tappable, {
                        onclick: () => {
                            state.activeTab = 'extra';
                            m.redraw();
                        },
                        style: {
                            padding: '0.75rem 1rem',
                            borderBottom: state.activeTab === 'extra' ? '2px solid #2563eb' : 'none',
                            color: state.activeTab === 'extra' ? '#2563eb' : '#64748b',
                            cursor: 'pointer'
                        }
                    }, 'Extra')
                ]),
                
                // Tab Content
                m(Div, {
                    style: {
                        minHeight: '200px',
                        border: '1px solid #ddd',
                        borderRadius: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: '#fff'
                    }
                }, [
                    state.activeTab === 'description' ? m(Input, {
                        type: 'textarea',
                        rows: 10,
                        data: state.formData,
                        name: 'description',
                        placeholder: 'Descripción del grupo...',
                        value: state.formData.description
                    }) : m(Text, { color: '#64748b' }, 'Contenido extra')
                ])
            ]),
            
            m(ModalFooter, [
                m(Button, {
                    type: 'negative',
                    onclick: () => {
                        if (confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
                            // TODO: Implementar eliminación
                            onClose();
                        }
                    },
                    style: { marginRight: 'auto' }
                }, [
                    m(Icon, { icon: 'delete', size: 'small' }),
                    m(Text, { marginLeft: '0.5rem' }, 'Eliminar grupo')
                ]),
                m(Button, {
                    type: 'positive',
                    onclick: () => {
                        // TODO: Implementar actualización
                        console.log('Actualizar grupo:', state.formData);
                        onClose();
                    }
                }, 'Actualizar'),
                m(Button, {
                    type: 'negative',
                    onclick: onClose
                }, 'Cerrar')
            ])
        ]);
    }
};

