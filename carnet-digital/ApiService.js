import Store from './Store.js';

const ApiService = {
    fetchData: async () => {
        // Simulate API delay
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (navigator.onLine) {
                    const cached = localStorage.getItem('ciudadano360_data');
                    if (cached) {
                        const data = JSON.parse(cached);
                        Store.familyGroup = data.familyGroup;
                        Store.currentUserIndex = data.currentUserIndex;
                    }
                    resolve(Store.familyGroup);
                } else {
                    const cached = localStorage.getItem('ciudadano360_data');
                    if (cached) {
                        const data = JSON.parse(cached);
                        Store.familyGroup = data.familyGroup;
                        console.log("Loading from LocalStorage (Offline Mode)");
                        resolve(Store.familyGroup);
                    } else {
                        reject(new Error("No connection and no cached data"));
                    }
                }
            }, 800);
        });
    },

    saveToLocal: () => {
        const data = {
            familyGroup: Store.familyGroup,
            currentUserIndex: Store.currentUserIndex
        };
        localStorage.setItem('ciudadano360_data', JSON.stringify(data));
    }
};

export default ApiService;
