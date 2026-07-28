export class TrainerAdapter {
    constructor(bluetoothManager = null, capabilities = null) {
        this.manager = bluetoothManager;
        this.capabilities = capabilities || {};
        this.controlMode = 'manual';
    }

    async applyTarget(target) {
        if (!this.manager || !target) return { mode: 'manual', applied: false };

        if (Number.isFinite(target.power) && this.capabilities.powerTargetSupported !== false) {
            try {
                await this.manager.setTargetPower(target.power);
                this.controlMode = 'erg';
                return { mode: 'erg', applied: true, value: target.power };
            } catch {
                this.controlMode = 'manual';
            }
        }

        if (Number.isFinite(target.resistance)) {
            try {
                await this.manager.setResistance(target.resistance);
                this.controlMode = 'resistance';
                return { mode: 'resistance', applied: true, value: target.resistance };
            } catch {
                this.controlMode = 'manual';
            }
        }

        return { mode: 'manual', applied: false };
    }

    async pause() {
        try {
            await this.manager?.stopTraining?.(true);
        } catch {
            // La sesión local se pausa aunque el rodillo no responda.
        }
    }

    async resume() {
        try {
            await this.manager?.startTraining?.();
        } catch {
            // Se conserva el modo manual como fallback.
        }
    }
}
