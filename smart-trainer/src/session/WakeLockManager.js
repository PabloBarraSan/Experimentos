export class WakeLockManager {
    constructor() {
        this.sentinel = null;
    }

    async acquire() {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return false;
        try {
            this.sentinel = await navigator.wakeLock.request('screen');
            this.sentinel.addEventListener('release', () => {
                this.sentinel = null;
            }, { once: true });
            return true;
        } catch {
            return false;
        }
    }

    async release() {
        if (!this.sentinel) return;
        const sentinel = this.sentinel;
        this.sentinel = null;
        await sentinel.release().catch(() => {});
    }
}
