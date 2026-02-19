// ─── STORE ────────────────────────────────────────────────────────────────────
const Store = {
    currentUserIndex: 0,
    isRevealed: false,
    offlineMode: !navigator.onLine,

    familyGroup: [
        {
            id: "u1",
            name: "Laura García",
            role: "TITULAR",
            photo: "https://i.pravatar.cc/300?u=laura_c360",
            activeReservations: [
                {
                    type: "PÁDEL",
                    resource: "Pista 4",
                    startTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
                    qrCode: "C360-LAURA-PADEL-2026"
                }
            ],
            wallets: [
                { type: "Piscina", usesLeft: 4, total: 10 },
                { type: "Transporte", usesLeft: 12, total: 20 }
            ],
            phone: "+34 611 222 333",
            email: "laura.garcia@email.com",
            dni: "12345678A"
        },
        {
            id: "u2",
            name: "Pablo García",
            role: "HIJO",
            photo: "https://i.pravatar.cc/300?u=pablo_c360",
            activeReservations: [],
            wallets: [
                { type: "Piscina", usesLeft: 2, total: 10 }
            ],
            phone: "+34 611 222 444",
            email: "pablo.garcia@email.com",
            dni: "87654321B"
        },
        {
            id: "u3",
            name: "Lucía García",
            role: "HIJA",
            photo: "https://i.pravatar.cc/300?u=lucia_c360",
            activeReservations: [
                {
                    type: "BIBLIOTECA",
                    resource: "Sala Estudio 2",
                    startTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
                    qrCode: "C360-LUCIA-LIB-2026"
                }
            ],
            wallets: [
                { type: "Biblioteca", usesLeft: 0, total: 1 }
            ],
            phone: "+34 611 222 555",
            email: "lucia.garcia@email.com",
            dni: "11223344C"
        }
    ],

    getUser() { return this.familyGroup[this.currentUserIndex]; },

    setUser(i) {
        this.currentUserIndex = i;
        this.saveLocal();
        m.redraw();
    },

    saveLocal() {
        localStorage.setItem('c360', JSON.stringify({
            currentUserIndex: this.currentUserIndex,
            familyGroup: this.familyGroup
        }));
    },

    loadLocal() {
        try {
            const d = JSON.parse(localStorage.getItem('c360'));
            if (d) {
                this.familyGroup = d.familyGroup;
                this.currentUserIndex = d.currentUserIndex;
            }
        } catch (e) { }
    }
};

Store.loadLocal();
window.addEventListener('online', () => { Store.offlineMode = false; m.redraw(); });
window.addEventListener('offline', () => { Store.offlineMode = true; m.redraw(); });

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate() {
    return new Date().toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function fmtTime() {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtResTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── TOP BAR ──────────────────────────────────────────────────────────────────
const TopBar = {
    view: () => m('.top-bar', [
        m('h2.top-bar-title', 'Ciudadano 360 · Portal Municipal'),
        m('img.top-bar-logo', {
            src: 'https://cdn.digitalvalue.es/requena/assets/60dd87a6189598976f6e3fe0',
            alt: 'Ayuntamiento de Requena'
        }),
        m('.top-bar-date', [
            fmtDate() + '   ',
            m('strong', fmtTime())
        ])
    ])
};

// ─── NAV BAR ──────────────────────────────────────────────────────────────────
const NavBar = {
    view: (vnode) => m('.nav-bar', [
        m('.nav-bar-inner', [
            m('button.nav-home-btn', {
                onclick: () => m.route.set('/'),
                'aria-label': 'Inicio'
            }, '🏠'),
            m('.nav-actions', [
                m('.status-badge', { class: Store.offlineMode ? 'offline' : 'online' }, [
                    m('span.dot'),
                    Store.offlineMode ? 'Sin conexión' : 'Conectado'
                ]),
                m('button.nav-btn.nav-btn-white', {
                    onclick: () => m.route.set('/qr'),
                    'aria-label': 'Ver mi código QR'
                }, ['📱 ', 'Mi QR'])
            ])
        ])
    ])
};

// ─── FOOTER ───────────────────────────────────────────────────────────────────
const Footer = {
    view: () => m('footer.site-footer', [
        m('.footer-inner', [
            m('img.footer-logo', {
                src: 'https://cdn.digitalvalue.es/requena/assets/60dd87a6189598976f6e3fe0',
                alt: 'Logo'
            }),
            m('div', [
                m('.footer-name', 'Ayuntamiento de Requena'),
                m('.footer-address', 'Plaza Consistorial, 2 · 46340 Requena · 96 230 14 00')
            ])
        ])
    ])
};

// ─── FAMILY SELECTOR ──────────────────────────────────────────────────────────
const FamilySelector = {
    view: () => m('.family-section', [
        m('.section-label', 'Grupo familiar'),
        m('.family-list',
            Store.familyGroup.map((u, i) =>
                m('.family-member', {
                    class: Store.currentUserIndex === i ? 'active' : '',
                    role: 'button',
                    tabIndex: 0,
                    onclick: () => Store.setUser(i),
                    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') Store.setUser(i); },
                    'aria-label': `Seleccionar perfil de ${u.name}`
                }, [
                    m('img.member-avatar', { src: u.photo, alt: `Foto de ${u.name}` }),
                    m('div', [
                        m('.member-name', u.name.split(' ')[0]),
                        m('.member-role', u.role)
                    ])
                ])
            )
        )
    ])
};

// ─── HERO ALERT (upcoming reservation) ────────────────────────────────────────
const HeroAlert = {
    view: () => {
        const user = Store.getUser();
        const now = new Date();
        const soon = new Date(now.getTime() + 60 * 60 * 1000);

        const urgent = user.activeReservations.find(r => {
            const t = new Date(r.startTime);
            return t > now && t <= soon;
        });

        const next = user.activeReservations.find(r => new Date(r.startTime) > now);

        if (urgent) {
            return m('.hero-alert.urgent', [
                m('.hero-alert-left', [
                    m('.hero-alert-icon', '⚡'),
                    m('div', [
                        m('.hero-alert-label', '¡Acceso en menos de 1 hora!'),
                        m('.hero-alert-title', urgent.type),
                        m('.hero-alert-sub', urgent.resource + ' · ' + fmtResTime(urgent.startTime))
                    ])
                ]),
                m('button.btn-red', { onclick: () => m.route.set('/qr') }, '📱 Mostrar QR de acceso')
            ]);
        }

        if (next) {
            return m('.hero-alert.upcoming', [
                m('.hero-alert-left', [
                    m('.hero-alert-icon', '📅'),
                    m('div', [
                        m('.hero-alert-label', 'Próxima reserva'),
                        m('.hero-alert-title', next.type),
                        m('.hero-alert-sub', next.resource + ' · ' + fmtResTime(next.startTime))
                    ])
                ]),
                m('button.btn-blue', { onclick: () => m.route.set('/qr') }, '📱 Ver QR')
            ]);
        }

        return null;
    }
};

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
const ProfileView = {
    _tick: null,
    oninit() { ProfileView._tick = setInterval(m.redraw, 30000); },
    onremove() { clearInterval(ProfileView._tick); },

    view: () => {
        const user = Store.getUser();
        return m('div', [
            m(TopBar),
            m(NavBar),

            m('.page-shell', [
                m(FamilySelector),
                m(HeroAlert),

                // Mi usuario card
                m('.card', [
                    m('.card-header', [
                        m('h3.card-title', [m('span.card-title-icon', '👤'), 'Mi usuario']),
                        m('button.btn-red', { onclick: () => m.route.set('/qr') }, '📱 Carnet digital')
                    ]),
                    m('.profile-block', [
                        m('img.profile-photo', { src: user.photo, alt: user.name }),
                        m('.profile-fields', [
                            m('.profile-col', [
                                m('p.profile-field', [m('strong', 'Nombre: '), user.name.split(' ')[0]]),
                                m('p.profile-field', [m('strong', 'Apellidos: '), user.name.split(' ').slice(1).join(' ')]),
                                m('p.profile-field', [m('strong', 'DNI: '), user.dni])
                            ]),
                            m('.profile-col', [
                                m('p.profile-field', [m('strong', 'Teléfono: '), user.phone]),
                                m('p.profile-field', [m('strong', 'Correo: '), user.email])
                            ])
                        ])
                    ])
                ]),

                // Mis reservas card
                m('.card', [
                    m('.card-header', [
                        m('h3.card-title', [m('span.card-title-icon', '🎟️'), 'Mis reservas'])
                    ]),
                    m('.reservations-list',
                        user.activeReservations.length === 0
                            ? m('p.empty-state', 'No tiene ninguna reserva activa.')
                            : user.activeReservations.map(r =>
                                m('.reservation-item', [
                                    m('.res-info', [
                                        m('.res-icon', r.type === 'PÁDEL' ? '🎾' : r.type === 'BIBLIOTECA' ? '📚' : '📋'),
                                        m('div', [
                                            m('.res-type', r.type),
                                            m('.res-sub', r.resource + ' · ' + fmtResTime(r.startTime))
                                        ])
                                    ]),
                                    m('.res-badge', 'Confirmada')
                                ])
                            )
                    )
                ]),

                // Mis bonos card
                m('.card', [
                    m('.card-header', [
                        m('h3.card-title', [m('span.card-title-icon', '💳'), 'Mis bonos'])
                    ]),
                    m('.wallet-grid',
                        user.wallets.map(w => {
                            const r = 20;
                            const circ = 2 * Math.PI * r;
                            const dash = (w.usesLeft / w.total) * circ;
                            return m('.wallet-item', [
                                m('svg.ring-svg', { viewBox: '0 0 48 48' }, [
                                    m('circle.ring-bg', { cx: 24, cy: 24, r, 'stroke-width': 4, fill: 'none' }),
                                    m('circle.ring-fg', {
                                        cx: 24, cy: 24, r,
                                        'stroke-width': 4, fill: 'none',
                                        'stroke-dasharray': `${dash} ${circ}`,
                                        'stroke-linecap': 'round',
                                        transform: 'rotate(-90 24 24)'
                                    }),
                                    m('text.ring-text', { x: 24, y: 29, 'text-anchor': 'middle' }, w.usesLeft)
                                ]),
                                m('div', [
                                    m('.wallet-label', w.type),
                                    m('.wallet-sub', `${w.usesLeft} de ${w.total} usos restantes`),
                                    w.usesLeft < 3 ? m('.wallet-alert', '¡Recarga pronto!') : null
                                ])
                            ]);
                        })
                    )
                ])
            ]),

            m(Footer)
        ]);
    }
};

// ─── SECURE QR VIEW ───────────────────────────────────────────────────────────
const SecureQRView = {
    _lastUserId: null,
    _tick: null,

    oninit() {
        Store.isRevealed = false;
        SecureQRView._lastUserId = null;
        SecureQRView._tick = setInterval(m.redraw, 1000);
    },

    onremove() {
        clearInterval(SecureQRView._tick);
        SecureQRView._lastUserId = null;
    },

    oncreate() { SecureQRView._renderQR(); },

    onupdate() {
        const user = Store.getUser();
        if (SecureQRView._lastUserId !== user.id) {
            SecureQRView._renderQR();
        }
    },

    _renderQR() {
        const user = Store.getUser();
        const res = user.activeReservations[0] || { qrCode: 'C360-GENERIC-' + user.id };
        const el = document.getElementById('qr-render');
        if (!el) return;

        el.innerHTML = '';
        SecureQRView._lastUserId = user.id;

        new QRCode(el, {
            text: res.qrCode,
            width: 240,
            height: 240,
            colorDark: '#1a1a1a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        setTimeout(() => {
            const canvas = el.querySelector('canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = user.photo;
            img.onload = () => {
                const s = canvas.width * 0.22;
                const x = (canvas.width - s) / 2;
                const y = (canvas.height - s) / 2;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, s / 2 + 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.save();
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, s / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, x, y, s, s);
                ctx.restore();
            };
        }, 150);
    },

    view() {
        const user = Store.getUser();
        const res = user.activeReservations[0] || { type: 'ACCESO GENERAL', resource: 'Control de acceso' };
        const time = new Date().toLocaleTimeString('es-ES', { hour12: false });

        return m('div', [
            m(TopBar),
            m(NavBar),

            m('.qr-page-shell', [
                m('.qr-card', [
                    m('.qr-identity', [
                        m('img.qr-avatar', { src: user.photo }),
                        m('.qr-name', user.name),
                        m('.qr-meta', res.type + ' · ' + res.resource)
                    ]),

                    m('.qr-wrap', [
                        m('.qr-inner', { class: Store.isRevealed ? 'revealed' : 'hidden' }, [
                            m('div', { id: 'qr-render' }),
                            m('.scan-line')
                        ]),
                        !Store.isRevealed ? m('.qr-overlay', [
                            m('.lock-icon', '🔒'),
                            m('.lock-hint', 'Mantén pulsado para revelar')
                        ]) : null
                    ]),

                    m('.qr-clock-wrap', [
                        m('.qr-clock-label', 'TIMESTAMP DINÁMICO'),
                        m('.qr-clock', time)
                    ]),

                    m('button.hold-btn', {
                        class: Store.isRevealed ? 'active' : '',
                        onmousedown: () => { Store.isRevealed = true; m.redraw(); },
                        onmouseup: () => { Store.isRevealed = false; m.redraw(); },
                        ontouchstart: (e) => { e.preventDefault(); Store.isRevealed = true; m.redraw(); },
                        ontouchend: (e) => { e.preventDefault(); Store.isRevealed = false; m.redraw(); },
                        onkeydown: (e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !Store.isRevealed) {
                                Store.isRevealed = true; m.redraw();
                            }
                        },
                        onkeyup: (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                Store.isRevealed = false; m.redraw();
                            }
                        },
                        'aria-label': Store.isRevealed ? 'Soltar para ocultar código QR' : 'Mantener pulsado para mostrar código QR'
                    }, [
                        Store.isRevealed ? '👁 SUELTA PARA OCULTAR' : '👆 MANTÉN PARA ENTRAR'
                    ]),

                    m('.qr-footer-note', 'Validación dinámica · Anti-captura · Cifrado E2E')
                ])
            ]),

            m(Footer)
        ]);
    }
};

// ─── ROUTING ──────────────────────────────────────────────────────────────────
m.route(document.getElementById('app'), '/', {
    '/': { render: () => m(ProfileView) },
    '/qr': { render: () => m(SecureQRView) }
});

document.addEventListener('contextmenu', e => e.preventDefault());
