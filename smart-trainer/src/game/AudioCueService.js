export class AudioCueService {
    constructor({ enabled = true, vibrationEnabled = true, volume = 0.55 } = {}) {
        this.enabled = enabled;
        this.vibrationEnabled = vibrationEnabled;
        this.volume = Math.max(0, Math.min(1, volume));
        this.context = null;
    }

    unlock() {
        if (!this.enabled || this.context) return;
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (Context) this.context = new Context();
    }

    cue(type) {
        if (this.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(type === 'finish' ? [80, 40, 120] : type === 'lost' ? [45, 35, 45] : 35);
        }
        if (!this.enabled) return;
        this.unlock();
        if (!this.context) return;
        const profiles = {
            countdown: [660, 0.06],
            block: [880, 0.10],
            good: [1040, 0.06],
            checkpoint: [740, 0.14],
            lost: [260, 0.10],
            finish: [990, 0.22],
        };
        const [frequency, duration] = profiles[type] || profiles.block;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = type === 'lost' ? 'triangle' : 'sine';
        gain.gain.setValueAtTime(this.volume * 0.12, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start();
        oscillator.stop(this.context.currentTime + duration);
    }

    destroy() {
        this.context?.close?.();
        this.context = null;
    }
}

