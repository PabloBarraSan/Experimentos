// Main App Component - Layout wrapper with header and footer

import { FlexCol, FlexRow, Tappable, Div } from '../../../DView/layout.js';
import { Text, SmallText, H2 } from '../../../DView/texts.js';
import { Icon } from '../../../DView/elements.js';

export const App = {
    view: (vnode) => {
        return m(FlexCol, {
            style: {
                minHeight: '100vh',
                fontFamily: "'Inter', sans-serif",
                color: '#475569',
                display: 'flex',
                flexDirection: 'column'
            }
        }, [
            // Header
            m(Header),
            
            // Main Content
            m(FlexCol, {
                style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: '1800px',
                    width: '100%',
                    margin: '0 auto',
                    padding: '2rem 1rem'
                }
            }, [
                m(FlexCol, { gap: '1.5rem', style: { flex: 1 } }, vnode.children)
            ]),
            
            // Footer
            m(Footer)
        ])
    }
};

// Header Component
const Header = {
    view: () => {
        return m(Div, {
            style: {
                backgroundColor: 'rgb(28, 25, 23)',
                borderBottom: '8px solid #ef4444',
                padding: '0.5rem 1rem'
            }
        }, [
            m(FlexRow, {
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }, [
                // Logo section
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '1rem'
                }, [
                    m('a', {
                        href: 'https://public.digitalvalue.es/github/zity-components-m/src/apps/',
                        style: { textDecoration: 'none' }
                    }, [
                        m('img', {
                            src: 'https://cdn.digitalvalue.es/alcantir/assets/5cc03ffd1d8c420100aa90fe?w=300',
                            alt: 'Logo',
                            style: {
                                height: '20px',
                                width: 'auto',
                                opacity: 0.7
                            }
                        })
                    ]),
                    m('a', {
                        href: 'https://public.digitalvalue.es/github/zity-components-m/src/apps/',
                        style: {
                            color: 'white',
                            fontSize: '0.875rem',
                            opacity: 0.7,
                            textDecoration: 'none',
                            display: window.innerWidth >= 640 ? 'block' : 'none'
                        }
                    }, 'Panell de Serveis'),
                    m('a', {
                        href: '#/',
                        oncreate: (vnode) => {
                            vnode.dom.onclick = (e) => {
                                e.preventDefault();
                                m.route.set('/');
                            };
                        },
                        style: {
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            textDecoration: 'none'
                        }
                    }, 'CRETA. Citas, Reservas, Entradas, Turnos y Autorizaciones')
                ]),
                
                // Right menu
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                }, [
                    m(Text, {
                        style: { color: 'white', fontSize: '0.875rem', padding: '0.5rem 0.75rem' }
                    }, 'admin.pinto'),
                    m(Text, {
                        style: { color: 'white', fontSize: '0.875rem', padding: '0.5rem 0.75rem' }
                    }, 'pinto'),
                    m(Tappable, {
                        style: {
                            background: 'transparent',
                            border: '1px solid white',
                            color: 'white',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.25rem',
                            cursor: 'pointer'
                        },
                        hover: {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }, [
                        m('i', {
                            class: 'fa-solid fa-user',
                            style: { color: '#22c55e' }
                        })
                    ]),
                    m(LanguageDropdown)
                ])
            ])
        ])
    }
};

// Language Dropdown Component
const LanguageDropdown = {
    view: () => {
        return m(Div, {
            style: { position: 'relative' }
        }, [
            m(Tappable, {
                style: {
                    background: 'transparent',
                    border: '1px solid white',
                    color: 'white',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                },
                hover: {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
            }, [
                m(Text, { fontSize: '0.875rem' }, 'VA'),
                m('i', { class: 'fa-solid fa-globe' })
            ])
        ])
    }
};

// Footer Component
const Footer = {
    view: () => {
        return m(Div, {
            style: {
                backgroundColor: '#111827',
                color: 'white',
                padding: '0.75rem 1rem',
                marginTop: 'auto'
            }
        }, [
            m(FlexRow, {
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap'
            }, [
                m('a', {
                    href: 'https://digitalvalue.es',
                    target: '_blank',
                    style: { textDecoration: 'none' }
                }, [
                    m('img', {
                        src: 'https://cdn.digitalvalue.es/digital/assets2/5ee2496c3686490100adeaca',
                        alt: 'Digital Value',
                        style: { maxHeight: '32px' }
                    })
                ]),
                m('a', {
                    href: 'http://ayuntamientoentumovil.es/',
                    target: '_blank',
                    style: { textDecoration: 'none' }
                }, [
                    m('img', {
                        src: 'https://cdn.digitalvalue.es/digital/assets2/5ee2496caa0c5401004cef54',
                        alt: 'Ayuntamiento en tu móvil',
                        style: { maxHeight: '32px' }
                    })
                ]),
                m(Div, {
                    style: {
                        marginLeft: 'auto',
                        fontSize: '0.875rem',
                        color: '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                    }
                }, [
                    m(Text, { style: { color: '#d1d5db' } }, 'Gràcies per confiar en'),
                    m('a', {
                        href: 'http://digitalvalue.es/zity.html',
                        target: '_blank',
                        rel: 'nofollow noopener noreferrer',
                        style: {
                            color: 'white',
                            textDecoration: 'none'
                        }
                    }, 'DIGITAL ZITY'),
                    m('a', {
                        href: 'mailto:info@ayuntamientoentumovil.es',
                        rel: 'nofollow noopener noreferrer',
                        style: {
                            color: 'white',
                            textDecoration: 'none'
                        }
                    }, 'info@ayuntamientoentumovil.es'),
                    m(SmallText, { style: { color: '#9ca3af' } }, 'v3.0')
                ])
            ])
        ])
    }
};

