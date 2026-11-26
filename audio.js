/**
 * Urban Dash 4D - Metro soundtrack and sound effects
 * Built with Web Audio API for zero-latency, high-energy mobile runner audio.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('urban_dash_muted') === 'true';
    this.sfxVolume = 0.75;
    this.masterGain = null;
    this.sfxGain = null;
    this.pickupPitchStep = 0;

    this.soundtrack = new Audio('assets/metro-five-devotional-cues.mp3');
    this.soundtrack.preload = 'auto';
    this.soundtrack.loop = true;
    this.soundtrack.volume = 0.43;
    this.soundtrack.muted = this.isMuted;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);
  }

  resumeContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('urban_dash_muted', this.isMuted);
    this.soundtrack.muted = this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  startMusic() {
    this.resumeContext();
    this.soundtrack.play().catch(() => {});
  }

  pauseMusic() {
    this.soundtrack.pause();
  }

  stopMusic() {
    this.pauseMusic();
    this.soundtrack.currentTime = 0;
  }

  // --- CRISP ARCADE SOUND EFFECTS (SFX) ---

  // Sparkling Musical Crystal / Coin Chime (Ascending harmonic bells)
  playCoinSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    const scale = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    const pitch = scale[this.pickupPitchStep % scale.length];
    this.pickupPitchStep = (this.pickupPitchStep + 1) % scale.length;

    // Fundamental Bell
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(pitch, now);
    osc1.frequency.exponentialRampToValueAtTime(pitch * 1.05, now + 0.12);
    gain1.gain.setValueAtTime(0.32, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Harmonic Sparkle Over-tone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(pitch * 2, now + 0.02);
    gain2.gain.setValueAtTime(0.18, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now + 0.02);
    osc2.stop(now + 0.17);
  }

  // Buoyant Wind Whoosh Jump
  playJumpSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.16);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Streetwear Sneakers Slide Skid
  playSlideSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.22;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.07));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.value = 2.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  // Jetpack Rocket Blast-off & Flight Roar
  playJetpackSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    // Low rumble + wind rush
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.4);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  // Chumbak Magnetic Vacuum Ping
  playMagnetSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Triumphant Power-up Fanfare Arpeggio
  playPowerupSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880, 1108.73];

    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.24, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.22);
    });
  }

  // Comic Arcade Crash
  playCrashSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // Super Bounce Sneakers Spring Sound
  playSneakersSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    [0, 0.08].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 320 : 480, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 740 : 1120, now + offset + 0.16);
      gain.gain.setValueAtTime(0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  }

  // 2X Coin Doubler Sparkling Chime
  playDoublerSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.3, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.3);
    });
  }

  // Chrono Time Warp Dilation Sound
  playTimeWarpSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.6);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // Sonic EMP Shockwave Blast
  playEMPBlastSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // Quantum Ghost Phase Sound
  playGhostPhaseSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    [660, 880, 1320].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.25, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  // Rainbow Singularity Vortex Sound
  playVortexSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.5);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Clean UI Button Click
  playClickSFX() {
    if (this.isMuted || !this.ctx) return;
    this.resumeContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.04);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

window.soundEngine = new SoundEngine();
