// Web Audio API 5-Band Equalizer & Bass Booster Service
// Connects to HTMLAudioElement and persists settings in localStorage

export interface EqualizerBand {
  frequency: number;
  label: string;
  gain: number; // -12dB to +12dB
}

export interface EqualizerSettings {
  enabled: boolean;
  bassBoost: number; // 0dB to +12dB
  preset: string;
  bands: EqualizerBand[];
}

export const EQUALIZER_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0],
  'Bass Boost': [6, 4, 1, 0, -1],
  Rock: [4, 2, -1, 3, 5],
  Pop: [2, 3, 0, 2, 4],
  Electronic: [5, 3, 0, 3, 5],
  'Hip-Hop': [5, 4, 0, 1, 2],
  Acoustic: [3, 1, 0, 2, 3],
  Classical: [4, 2, 0, 2, 4],
  Vocal: [-2, 0, 4, 3, 0],
};

const DEFAULT_FREQUENCIES = [60, 230, 910, 3600, 14000];
const DEFAULT_LABELS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

const STORAGE_KEY = 'mymusic_equalizer_v1';

class EqualizerService {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private bassBoostNode: BiquadFilterNode | null = null;
  private connectedElement: HTMLAudioElement | null = null;
  private listeners: Set<() => void> = new Set();

  private settings: EqualizerSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): EqualizerSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}

    return {
      enabled: true,
      bassBoost: 0,
      preset: 'Flat',
      bands: DEFAULT_FREQUENCIES.map((freq, i) => ({
        frequency: freq,
        label: DEFAULT_LABELS[i],
        gain: 0,
      })),
    };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
    this.notifyListeners();
  }

  public getSettings(): EqualizerSettings {
    return { ...this.settings, bands: this.settings.bands.map((b) => ({ ...b })) };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {}
    });
  }

  /**
   * Connect an HTMLAudioElement to the Web Audio Equalizer pipeline.
   * Browsers only permit createMediaElementSource once per element.
   */
  public connectAudio(audioElement: HTMLAudioElement): void {
    if (!audioElement || this.connectedElement === audioElement) {
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        const resumeCtx = () => {
          this.audioCtx?.resume();
          window.removeEventListener('click', resumeCtx);
          window.removeEventListener('touchstart', resumeCtx);
        };
        window.addEventListener('click', resumeCtx, { once: true });
        window.addEventListener('touchstart', resumeCtx, { once: true });
      }

      this.connectedElement = audioElement;
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);

      // Create Bass Booster (lowshelf at 80Hz)
      this.bassBoostNode = this.audioCtx.createBiquadFilter();
      this.bassBoostNode.type = 'lowshelf';
      this.bassBoostNode.frequency.value = 80;
      this.bassBoostNode.gain.value = this.settings.enabled ? this.settings.bassBoost : 0;

      // Create 5 BiquadFilter bands
      this.filterNodes = this.settings.bands.map((band, idx) => {
        const filter = this.audioCtx!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === this.settings.bands.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.0;
        }
        filter.frequency.value = band.frequency;
        filter.gain.value = this.settings.enabled ? band.gain : 0;
        return filter;
      });

      // Chain: source -> bassBoost -> filter0 -> filter1 -> ... -> filterN -> destination
      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.bassBoostNode);
      lastNode = this.bassBoostNode;

      for (const filter of this.filterNodes) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.audioCtx.destination);
    } catch (err) {
      console.warn('Could not initialize equalizer audio context:', err);
    }
  }

  public ensureContextRunning(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.applyCurrentGains();
    this.saveSettings();
  }

  public setBandGain(index: number, gain: number): void {
    if (index < 0 || index >= this.settings.bands.length) return;
    const clampedGain = Math.max(-12, Math.min(12, gain));
    this.settings.bands[index].gain = clampedGain;
    this.settings.preset = 'Custom';

    if (this.settings.enabled && this.filterNodes[index]) {
      this.filterNodes[index].gain.setTargetAtTime(
        clampedGain,
        this.audioCtx?.currentTime || 0,
        0.015
      );
    }
    this.saveSettings();
  }

  public setBassBoost(boostDb: number): void {
    const clamped = Math.max(0, Math.min(12, boostDb));
    this.settings.bassBoost = clamped;

    if (this.settings.enabled && this.bassBoostNode) {
      this.bassBoostNode.gain.setTargetAtTime(clamped, this.audioCtx?.currentTime || 0, 0.015);
    }
    this.saveSettings();
  }

  public applyPreset(presetName: string): void {
    const gains = EQUALIZER_PRESETS[presetName];
    if (!gains) return;

    this.settings.preset = presetName;
    gains.forEach((g, i) => {
      if (this.settings.bands[i]) {
        this.settings.bands[i].gain = g;
      }
    });

    this.applyCurrentGains();
    this.saveSettings();
  }

  public resetFlat(): void {
    this.applyPreset('Flat');
    this.setBassBoost(0);
  }

  private applyCurrentGains(): void {
    const now = this.audioCtx?.currentTime || 0;

    if (this.bassBoostNode) {
      this.bassBoostNode.gain.setTargetAtTime(
        this.settings.enabled ? this.settings.bassBoost : 0,
        now,
        0.015
      );
    }

    this.filterNodes.forEach((node, idx) => {
      const targetGain = this.settings.enabled ? this.settings.bands[idx]?.gain || 0 : 0;
      node.gain.setTargetAtTime(targetGain, now, 0.015);
    });
  }
}

export const equalizerService = new EqualizerService();
