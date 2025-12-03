// Dashboard View Component using Mithril and DView

import { FlexCol, FlexRow, Grid, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Card, Label, Segment } from '../../../DView/elements.js';
import { Input, Switch } from '../../../DView/forms.js';

export const DashboardView = {
    oninit: (vnode) => {
        vnode.state.searchTerm = '';
        vnode.state.showUnpublished = false;
        vnode.state.filterType = 'all';
    },
    
    view: (vnode) => {
        const { app } = vnode.attrs;
        const state = vnode.state;
        
        // Filter resources
        const sortedGroups = Object.keys(app.groupedData || {}).sort();
        const filteredGroups = {};
        
        sortedGroups.forEach(groupName => {
            let resources = app.groupedData[groupName] || [];
            
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
                m(H1, { style: { fontSize: '1.875rem', fontWeight: 'bold', color: '#0f172a' } }, 
                    'Cita previa y Reservas'),
                m(Text, { style: { fontSize: '1.125rem', color: '#64748b', maxWidth: '48rem' } },
                    'Gestiona las reservas y citas con el personal del ayuntamiento.')
            ]),
            
            // Toolbar / Filters
            m(Segment, { type: 'primary', style: { padding: '1rem', marginBottom: '2rem' } }, [
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
                                m(Text, { style: { fontSize: '0.875rem', margin: 0 } }, 'Kiosko')
                            ]),
                            m('a', {
                                href: './citaprevia_web.html',
                                target: '_blank',
                                class: 'toolbar-button'
                            }, [
                                m('span', { class: 'material-icons' }, 'language'),
                                m(Text, { style: { fontSize: '0.875rem', margin: 0 } }, 'Web')
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
                                m(Text, { style: { fontSize: '0.875rem', margin: 0 } }, 'TV')
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
                                m(Text, { style: { fontSize: '0.875rem', margin: 0 } }, 'Stats')
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
                                style: { 
                                    fontSize: '0.875rem',
                                    margin: 0,
                                    cursor: 'pointer'
                                },
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
                            m(Text, { style: { fontSize: '0.875rem', fontWeight: 500, margin: 0 } }, 'Añadir'),
                            m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'add')
                        ])
                    ])
                ])
            ]),
            
            // Resources Grid
            m(Grid, {
                columns: {
                    mobile: 1,
                    tablet: 2,
                    computer: 3
                },
                style: {
                    gap: '1.5rem',
                    paddingBottom: '3rem'
                }
            }, Object.keys(filteredGroups).map(groupName => {
                const resources = filteredGroups[groupName];
                
                return m(Card, {
                    key: groupName,
                    style: {
                        breakInside: 'avoid',
                        marginBottom: '1.5rem'
                    }
                }, [
                    // Group Header
                    m(Div, {
                        style: {
                            padding: '1.25rem',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        }
                    }, [
                        m(FlexCol, { gap: '0.25rem' }, [
                            m(H2, {
                                style: {
                                    fontSize: '1.125rem',
                                    fontWeight: 'bold',
                                    color: '#1e293b',
                                    textTransform: 'uppercase'
                                }
                            }, groupName),
                            m(SmallText, {
                                style: {
                                    fontSize: '0.75rem',
                                    color: '#94a3b8',
                                    fontWeight: 500
                                }
                            }, `${resources.length} Recursos`)
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
                                    justifyContent: 'center'
                                },
                                hover: {
                                    color: '#2563eb',
                                    backgroundColor: '#dbeafe'
                                }
                            }, [
                                m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'people')
                            ]),
                            m(Tappable, {
                                onclick: () => {},
                                style: {
                                    padding: '0.375rem',
                                    borderRadius: '0.375rem',
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                },
                                hover: {
                                    color: '#16a34a',
                                    backgroundColor: '#dcfce7'
                                }
                            }, [
                                m('span', { class: 'material-icons', style: { fontSize: '18px' } }, 'edit')
                            ])
                        ])
                    ]),
                    
                    // Resources List
                    m(Div, {
                        style: {
                            display: 'flex',
                            flexDirection: 'column'
                        }
                    }, resources.map(res => {
                        const imgUrl = res.photo ? `${res.photo}?w=210&h=140&thumbnail=true` : 
                                      'https://via.placeholder.com/210x140?text=No+Image';
                        const resName = res.name || res.title || "Sin nombre";
                        
                        return m(Tappable, {
                            key: res._id,
                            onclick: () => m.route.set(`/resource/${res._id}`),
                            style: {
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer'
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
                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                },
                                onerror: (e) => {
                                    e.target.src = 'https://via.placeholder.com/210x140?text=Error';
                                }
                            }),
                            m(FlexCol, {
                                flex: 1,
                                gap: '0.25rem'
                            }, [
                                m(Text, {
                                    style: {
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: '#334155'
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
                            m('span', {
                                class: 'material-icons',
                                style: {
                                    fontSize: '0.75rem',
                                    color: '#cbd5e1'
                                }
                            }, 'chevron_right')
                        ]);
                    }))
                ]);
            }))
        ]);
    }
};

