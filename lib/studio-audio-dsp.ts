import type { AmbientSoundPreset, AudioEffectPreset } from './video-export';

/**
 * Lightweight browser-side Web Audio API DSP graph for live Studio preview,
 * mirroring the server-side FFmpeg audio presets & procedural natural ambience.
 */
export class StudioAudioDsp {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  private hpFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentAmbient: AmbientSoundPreset = 'none';
  private isPlaying = false;

  private ensureContext(audioEl: HTMLAudioElement): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    if (!this.ctx) {
      this.ctx = new Ctor();
      this.source = this.ctx.createMediaElementSource(audioEl);
      this.hpFilter = this.ctx.createBiquadFilter();
      this.hpFilter.type = 'highpass';
      this.hpFilter.frequency.value = 20;

      this.eqLow = this.ctx.createBiquadFilter();
      this.eqLow.type = 'lowshelf';
      this.eqLow.frequency.value = 180;
      this.eqLow.gain.value = 0;

      this.eqHigh = this.ctx.createBiquadFilter();
      this.eqHigh.type = 'highshelf';
      this.eqHigh.frequency.value = 3400;
      this.eqHigh.gain.value = 0;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.ratio.value = 1;

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1;

      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.value = 0;

      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.buildImpulseBuffer(this.ctx, 1.8, 2.5);

      // Signal graph: source -> hp -> eqLow -> eqHigh -> compressor -> dry/wet -> destination
      this.source.connect(this.hpFilter);
      this.hpFilter.connect(this.eqLow);
      this.eqLow.connect(this.eqHigh);
      this.eqHigh.connect(this.compressor);
      this.compressor.connect(this.dryGain);
      this.compressor.connect(this.convolver);
      this.convolver.connect(this.wetGain);
      this.dryGain.connect(this.ctx.destination);
      this.wetGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private buildImpulseBuffer(
    ctx: AudioContext,
    durationSec: number,
    decay: number
  ): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buffer;
  }

  private buildNoiseBuffer(ctx: AudioContext, color: 'pink' | 'brown'): AudioBuffer {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (color === 'brown') {
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
    } else {
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.018) * 1.4;
      }
    }
    return buffer;
  }

  public applyPreset(audioEl: HTMLAudioElement, preset: AudioEffectPreset): void {
    const ctx = this.ensureContext(audioEl);
    if (
      !ctx ||
      !this.hpFilter ||
      !this.eqLow ||
      !this.eqHigh ||
      !this.compressor ||
      !this.dryGain ||
      !this.wetGain ||
      !this.convolver
    ) {
      return;
    }

    const now = ctx.currentTime;
    // Defaults
    let hp = 20;
    let lowGain = 0;
    let highGain = 0;
    let ratio = 1;
    let wet = 0;
    let dry = 1;

    switch (preset) {
      case 'haram':
        hp = 70;
        lowGain = 1.5;
        highGain = 1.5;
        wet = 0.42;
        dry = 0.88;
        this.convolver.buffer = this.buildImpulseBuffer(ctx, 2.4, 2.1);
        break;
      case 'mosque':
        hp = 75;
        lowGain = 2.5;
        highGain = 0.5;
        wet = 0.28;
        dry = 0.92;
        this.convolver.buffer = this.buildImpulseBuffer(ctx, 1.5, 2.6);
        break;
      case 'studio':
        hp = 80;
        lowGain = 2;
        highGain = 3.2;
        ratio = 3.2;
        wet = 0.06;
        dry = 1;
        break;
      case 'warm':
        hp = 40;
        lowGain = 3.2;
        highGain = -2.8;
        wet = 0.2;
        dry = 0.95;
        this.convolver.buffer = this.buildImpulseBuffer(ctx, 1.3, 3.0);
        break;
      case 'deep':
        hp = 30;
        lowGain = 6;
        highGain = -0.5;
        ratio = 2.2;
        wet = 0.08;
        dry = 1;
        break;
      case 'clean':
        hp = 95;
        lowGain = -1;
        highGain = 1.5;
        ratio = 2.6;
        wet = 0;
        dry = 1;
        break;
      case 'natural':
      default:
        break;
    }

    this.hpFilter.frequency.setTargetAtTime(hp, now, 0.05);
    this.eqLow.gain.setTargetAtTime(lowGain, now, 0.05);
    this.eqHigh.gain.setTargetAtTime(highGain, now, 0.05);
    this.compressor.ratio.setTargetAtTime(ratio, now, 0.05);
    this.dryGain.gain.setTargetAtTime(dry, now, 0.05);
    this.wetGain.gain.setTargetAtTime(wet, now, 0.05);
  }

  public syncAmbient(
    audioEl: HTMLAudioElement,
    ambient: AmbientSoundPreset,
    volume: number,
    playing: boolean
  ): void {
    this.isPlaying = playing;
    if (!playing || ambient === 'none') {
      this.stopAmbient();
      this.currentAmbient = ambient;
      return;
    }

    const ctx = this.ensureContext(audioEl);
    if (!ctx) return;

    if (this.ambientSource && this.currentAmbient === ambient && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(
        Math.max(0.01, Math.min(0.45, volume * 0.45)),
        ctx.currentTime,
        0.08
      );
      return;
    }

    this.stopAmbient();
    this.currentAmbient = ambient;

    const color = ambient === 'night' || ambient === 'ocean' ? 'brown' : 'pink';
    const src = ctx.createBufferSource();
    src.buffer = this.buildNoiseBuffer(ctx, color);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    if (ambient === 'rain') {
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.6;
    } else if (ambient === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.value = 820;
    } else if (ambient === 'night') {
      filter.type = 'lowpass';
      filter.frequency.value = 460;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.9;
    }

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0.01, Math.min(0.45, volume * 0.45));

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.ambientSource = src;
    this.ambientFilter = filter;
    this.ambientGain = gain;
  }

  public stopAmbient(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch {
        // already stopped
      }
      this.ambientSource = null;
    }
    this.ambientFilter?.disconnect();
    this.ambientFilter = null;
    this.ambientGain?.disconnect();
    this.ambientGain = null;
  }

  public dispose(): void {
    this.stopAmbient();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.source = null;
  }
}
