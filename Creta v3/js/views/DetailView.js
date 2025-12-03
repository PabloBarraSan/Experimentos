// Detail View Component using Mithril and DView

import { FlexCol, FlexRow, Grid, Tappable, Div } from '../../../DView/layout.js';
import { H1, H2, Text, SmallText } from '../../../DView/texts.js';
import { Button, Icon, Card, Segment } from '../../../DView/elements.js';

export const DetailView = {
    view: (vnode) => {
        const { resource } = vnode.attrs;
        const resourceName = resource.name || resource.title || "Recurso";
        const groupName = resource.subtitle || "Grupo";
        
        const actionCards = [
            {
                title: "Sala d'espera",
                description: "Pantalla d'espera on es mostren els torns atenent-se o per atendre",
                icon: "person",
                href: "#"
            },
            {
                title: "Administrador de torns",
                description: "Pantalla per al funcionari, gestiona les reserves i aten les cites",
                icon: "vpn_key",
                href: "#"
            },
            {
                title: "Sol·licitud de torns",
                description: "Pantalla per al kiosk, torna sempre la cita més próxima",
                icon: "confirmation_number",
                href: "#"
            },
            {
                title: "Solicitud de turnos 2",
                description: "Pantalla per al kiosk, es possible seleccionar el dia",
                icon: "confirmation_number",
                href: "#"
            },
            {
                title: "Calendari",
                description: "Calendari on es mostren les cites o es gestionen els horaris",
                icon: "event",
                href: "#"
            },
            {
                title: "Panell de comandaments",
                description: "Mostra totes les cites i el seu estat",
                icon: "view_column",
                href: "#"
            },
            {
                title: "Administració",
                description: "Administra els ajustos, imprimeix reserves, cerca cites...",
                icon: "edit",
                href: `/resource/${resource._id}/admin`,
                onclick: () => m.route.set(`/resource/${resource._id}/admin`)
            },
            {
                title: "Selecció",
                description: "Torna al menú on es mostren tots els recursos",
                icon: "arrow_back",
                href: "/",
                onclick: () => m.route.set('/')
            },
            {
                title: "Lector de QR",
                description: "Lector de QR, para confirmar la llegada de la persona al centro o comprobar saldo del bono",
                icon: "qr_code",
                href: "#"
            },
            {
                title: "Citaprevia web",
                description: "Pàgina web oberta al públic de la cita prèvia",
                icon: "language",
                href: "#"
            },
            {
                title: "App mòbil",
                description: "Aplicació mòbil de la cita prèvia",
                icon: "phone_iphone",
                href: "#"
            }
        ];
        
        return m(FlexCol, { gap: '2rem' }, [
            // Action Header
            m(Segment, {
                type: 'primary',
                style: {
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                },
                class: 'detail-header'
            }, [
                m(FlexRow, {
                    alignItems: 'center',
                    gap: '1rem'
                }, [
                    m(Button, {
                        type: 'default',
                        onclick: () => m.route.set('/'),
                        style: {
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b'
                        },
                        hover: {
                            backgroundColor: '#e2e8f0',
                            color: '#475569'
                        }
                    }, [
                        m(Icon, { icon: 'arrow_back', size: 'small' })
                    ]),
                    m(FlexCol, { gap: '0.25rem' }, [
                        m(SmallText, {
                            style: {
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                color: '#2563eb',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }
                        }, groupName),
                        m(H1, {
                            style: {
                                fontSize: '1.875rem',
                                fontWeight: 'bold',
                                color: '#0f172a',
                                lineHeight: 1
                            }
                        }, resourceName)
                    ])
                ]),
                m(Button, {
                    type: 'default',
                    onclick: () => {},
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem'
                    }
                }, [
                    m(Icon, { icon: 'help', size: 'small', style: { color: '#2563eb' } }),
                    m(Text, { style: { fontSize: '0.875rem', fontWeight: 500 } }, 'Ayuda')
                ])
            ]),
            
            // Action Cards Grid
            m(Grid, {
                columns: {
                    mobile: 1,
                    tablet: 2,
                    computer: 3,
                    largeComputer: 4
                },
                style: {
                    gap: '1.5rem'
                }
            }, actionCards.map((card, index) => {
                return m(Card, {
                    key: index,
                    onclick: card.onclick || (() => {
                        if (card.href && card.href !== '#') {
                            if (card.href.startsWith('/')) {
                                m.route.set(card.href);
                            } else {
                                window.location.href = card.href;
                            }
                        }
                    }),
                    style: {
                        padding: '1.5rem',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    },
                    hover: {
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        borderColor: '#93c5fd',
                        transform: 'translateY(-4px)'
                    }
                }, [
                    m(Div, {
                        style: {
                            height: '56px',
                            width: '56px',
                            borderRadius: '0.75rem',
                            backgroundColor: '#dbeafe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563eb',
                            marginBottom: '1rem',
                            transition: 'all 0.3s'
                        },
                        onmouseenter: (e) => {
                            e.currentTarget.style.backgroundColor = '#2563eb';
                            e.currentTarget.style.color = 'white';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.backgroundColor = '#dbeafe';
                            e.currentTarget.style.color = '#2563eb';
                        }
                    }, [
                        m(Icon, { icon: card.icon, size: 'large' })
                    ]),
                    m(H2, {
                        style: {
                            fontSize: '1.125rem',
                            fontWeight: 'bold',
                            color: '#1e293b',
                            marginBottom: '0.5rem',
                            transition: 'color 0.3s'
                        },
                        onmouseenter: (e) => {
                            e.currentTarget.style.color = '#2563eb';
                        },
                        onmouseleave: (e) => {
                            e.currentTarget.style.color = '#1e293b';
                        }
                    }, card.title),
                    m(Text, {
                        style: {
                            fontSize: '0.875rem',
                            color: '#64748b',
                            lineHeight: '1.5'
                        }
                    }, card.description)
                ]);
            }))
        ]);
    }
};

