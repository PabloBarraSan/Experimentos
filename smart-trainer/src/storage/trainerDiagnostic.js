export async function saveTrainerDiagnostic(report) {
    return access('readwrite', (store) => store.put(report, report.simulated ? 'simulated' : 'real'));
}

export async function loadTrainerDiagnostic(simulated = false) {
    return access('readonly', (store) => store.get(simulated ? 'simulated' : 'real'));
}

function access(mode, action) {
    return new Promise((resolve, reject) => {
        const opening = indexedDB.open('smart-trainer-diagnostic', 1);
        opening.onupgradeneeded = () => opening.result.createObjectStore('reports');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
            const db = opening.result;
            const transaction = db.transaction('reports', mode);
            const request = action(transaction.objectStore('reports'));
            transaction.oncomplete = () => { db.close(); resolve(request.result); };
            transaction.onabort = () => { db.close(); reject(transaction.error); };
            transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
    });
}
