// CarnetDigital.js - Componente Mithril.js para Carnet Digital Municipal
// Requiere: QRious disponible globalmente

var CarnetDigital = {
  // Estado del componente
  state: {
    isLoading: true,
    error: null,
    carnetData: null
  },

  // Ciclo de vida: cargar datos de la API
  oninit: function() {
    var self = this;

    m.request({
      method: 'GET',
      url: 'https://api.digitalvalue.es/alcantir/collections/carnets/69b463169760b2323a271682'
    })
    .then(function(data) {
      self.state.carnetData = data;
      self.state.isLoading = false;
      m.redraw();
    })
    .catch(function(err) {
      self.state.error = 'Error al cargar el carnet. Inténtalo de nuevo más tarde.';
      self.state.isLoading = false;
      m.redraw();
    });
  },

  view: function() {
    var state = this.state;

    // Pantalla de carga
    if (state.isLoading) {
      return m('div', {
        style: {
          'min-height': '100vh',
          'background': 'linear-gradient(145deg, #e8ecef 0%, #cfd4d8 100%)',
          'display': 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'padding': '20px',
          'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      }, m('div', {
        style: {
          'color': '#2c3e50',
          'font-size': '18px',
          'font-weight': '500'
        }
      }, 'Cargando tu carnet...'));
    }

    // Pantalla de error
    if (state.error) {
      return m('div', {
        style: {
          'min-height': '100vh',
          'background': 'linear-gradient(145deg, #e8ecef 0%, #cfd4d8 100%)',
          'display': 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'padding': '20px',
          'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      }, m('div', {
        style: {
          'color': '#dc2626',
          'font-size': '16px',
          'text-align': 'center'
        }
      }, state.error));
    }

    // Datos del carnet
    var carnet = state.carnetData;
    var badges = carnet.badges || [];

    // Render principal
    return m('div', {
      style: {
        'min-height': '100vh',
        'background': 'linear-gradient(145deg, #e8ecef 0%, #cfd4d8 100%)',
        'display': 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
        'padding': '20px',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }
    }, [
      // Título
      m('h1', {
        style: {
          'color': '#2c3e50',
          'font-size': '18px',
          'margin-bottom': '24px',
          'font-weight': '600'
        }
      }, 'Mi Carnet Digital'),

      // Tarjeta
      m('div', {
        style: {
          'width': '100%',
          'max-width': '340px',
          'background': 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #1e3c72 100%)',
          'border-radius': '16px',
          'padding': '24px 20px 28px',
          'box-shadow': '0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 20px rgba(0, 0, 0, 0.2)',
          'color': '#fff'
        }
      }, [
        // Cabecera
        m('div', {
          style: { 'text-align': 'center', 'margin-bottom': '20px' }
        }, [
          m('div', {
            style: {
              'font-size': '14px',
              'opacity': '0.9',
              'text-transform': 'uppercase',
              'font-weight': '500'
            }
          }, 'Ayuntamiento de Ejemplo'),
          m('div', {
            style: { 'font-size': '12px', 'opacity': '0.7', 'margin-top': '4px' }
          }, 'Acceso Polideportivo Municipal')
        ]),

        // QR Canvas
        m('div', {
          style: {
            'background': '#ffffff',
            'border-radius': '12px',
            'padding': '16px',
            'text-align': 'center',
            'margin-bottom': '16px'
          }
        }, [
          m('canvas', {
            style: {
              'width': '140px',
              'height': '140px',
              'display': 'block',
              'margin': '0 auto'
            },
            oncreate: function(vnode) {
              if (carnet && carnet._id) {
                new QRious({
                  element: vnode.dom,
                  value: carnet._id,
                  size: 140,
                  background: '#ffffff',
                  foreground: '#000000',
                  level: 'H'
                });
              }
            }
          }),
          m('div', {
            style: { 'color': '#666', 'font-size': '10px', 'margin-top': '10px' }
          }, 'Escanee en el acceso')
        ]),

        // Foto de perfil
        m('div', {
          style: { 'display': 'flex', 'justify-content': 'center', 'margin-bottom': '14px' }
        }, m('img', {
          src: 'https://i.pravatar.cc/150?img=47',
          alt: 'Foto de perfil',
          style: {
            'width': '72px',
            'height': '72px',
            'border-radius': '50%',
            'border': '3px solid #fff',
            'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.25)'
          }
        })),

        // Datos del usuario
        m('div', {
          style: { 'text-align': 'center', 'margin-bottom': '14px' }
        }, [
          m('div', {
            style: { 'font-size': '20px', 'font-weight': '700', 'margin-bottom': '6px' }
          }, 'María García López'),
          m('div', {
            style: { 'font-size': '13px', 'opacity': '0.8', 'font-family': 'monospace' }
          }, 'DNI: 12345678A')
        ]),

        // Badges dinámicos
        m('div', {
          style: {
            'display': 'flex',
            'flex-wrap': 'wrap',
            'justify-content': 'center',
            'gap': '8px',
            'margin-bottom': '16px'
          }
        }, badges.map(function(badge) {
          return m('div', {
            style: {
              'background': badge.color,
              'color': '#fff',
              'padding': '6px 14px',
              'border-radius': '20px',
              'font-size': '11px',
              'font-weight': '600',
              'text-transform': 'uppercase',
              'box-shadow': '0 2px 8px ' + badge.color + '66'
            }
          }, (badge.icon || '') + ' ' + badge.label);
        })),

        // Número de carnet
        m('div', {
          style: { 'text-align': 'center', 'font-size': '10px', 'opacity': '0.6', 'font-family': 'monospace' }
        }, 'Nº CARNET: ' + carnet.carnetNumber)
      ]),

      // Botones Wallet
      m('div', {
        style: {
          'display': 'flex',
          'flex-direction': 'column',
          'gap': '12px',
          'margin-top': '28px',
          'width': '100%',
          'max-width': '340px'
        }
      }, [
        // Botón Apple Wallet
        m('button', {
          onclick: function() {
            if (carnet.walletLinks && carnet.walletLinks.apple) {
              window.location.href = carnet.walletLinks.apple;
            } else {
              alert("La integración con Apple Wallet estará disponible próximamente.");
            }
          },
          style: {
            'background': '#000',
            'color': '#fff',
            'border': 'none',
            'border-radius': '12px',
            'padding': '14px 20px',
            'font-size': '15px',
            'font-weight': '600',
            'cursor': 'pointer',
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'gap': '10px'
          }
        }, [m('span', { style: { 'font-size': '18px' } }, ''), 'Añadir a Apple Wallet']),

        // Botón Google Wallet
        m('button', {
          onclick: function() {
            if (carnet.walletLinks && carnet.walletLinks.google) {
              window.open(carnet.walletLinks.google, '_blank');
            } else {
              alert("La integración con Google Wallet estará disponible próximamente.");
            }
          },
          style: {
            'background': '#fff',
            'color': '#333',
            'border': '1px solid #ddd',
            'border-radius': '12px',
            'padding': '14px 20px',
            'font-size': '15px',
            'font-weight': '600',
            'cursor': 'pointer',
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'gap': '10px'
          }
        }, [m('span', { style: { 'font-size': '18px' } }, '🔵'), 'Añadir a Google Wallet'])
      ]),

      // Footer
      m('div', {
        style: { 'margin-top': '32px', 'text-align': 'center', 'font-size': '11px', 'color': '#888' }
      }, 'Válido hasta 31/12/2026')
    ]);
  }
};

// Montar cuando Mithril esté listo
function mountComponent() {
  if (typeof m !== 'undefined') {
    m.mount(document.body, CarnetDigital);
  } else {
    setTimeout(mountComponent, 50);
  }
}

mountComponent();
