const Store = {
    currentUserIndex: 0,
    familyGroup: [
        {
            id: "u1",
            name: "Laura",
            role: "TITULAR",
            photo: "https://i.pravatar.cc/300?u=u1",
            activeReservations: [
                {
                    id: "r1",
                    type: "PADEL",
                    resource: "Pista 4",
                    startTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins from now
                    qrCode: "TOKEN_LAURA_PADEL_123"
                }
            ],
            wallets: [
                { type: "PISCINA", usesLeft: 4, total: 10 },
                { type: "TRANSPORTE", usesLeft: 12, total: 20 }
            ],
            phone: "+34 611 222 333",
            dni: "12345678A"
        },
        {
            id: "u2",
            name: "Pablo",
            role: "HIJO",
            photo: "https://i.pravatar.cc/300?u=u2",
            activeReservations: [],
            wallets: [
                { type: "PISCINA", usesLeft: 2, total: 10 }
            ],
            phone: "+34 611 222 444",
            dni: "87654321B"
        },
        {
            id: "u3",
            name: "Lucía",
            role: "HIJA",
            photo: "https://i.pravatar.cc/300?u=u3",
            activeReservations: [
                {
                    id: "r2",
                    type: "BIBLIOTECA",
                    resource: "Sala Estudio 2",
                    startTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(), // 2h from now
                    qrCode: "TOKEN_LUCIA_LIB_456"
                }
            ],
            wallets: [
                { type: "BIBLIOTECA", usesLeft: 0, total: 1 }
            ],
            phone: "+34 611 222 555",
            dni: "11223344C"
        }
    ],

    getCurrentUser: () => Store.familyGroup[Store.currentUserIndex],

    setCurrentUser: (index) => {
        Store.currentUserIndex = index;
        ApiService.saveToLocal(); // Save transition
        m.redraw();
    },

    isRevealed: false,
    offlineMode: !navigator.onLine
};

// Listen for connection changes
window.addEventListener('online', () => { Store.offlineMode = false; m.redraw(); });
window.addEventListener('offline', () => { Store.offlineMode = true; m.redraw(); });

export default Store;
