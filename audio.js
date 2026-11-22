/**
 * Urban Dash 3D - Catchy Dynamic Audio & Arcade Sound Synthesizer
 * Built with Web Audio API for zero-latency, high-energy mobile runner audio.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('urban_dash_muted') === 'true';
    this.musicVolume = 0.52;
    this.sfxVolume = 0.75;
    this.isPlayingMusic = false;
    this.currentStep = 0;
    this.tempo = 132; // Energetic, bouncy subway runner tempo
    this.stepInterval = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    // Musical Frequencies for Bouncy Melodies
    this.notes = {
      C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
      C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
      C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00, C6: 1046.50
    };

    // Catchy, Funky, Bouncy Bassline (Subway Surfers groove inspired)
    this.bassPattern = [
      'C2', null, 'C3', 'C2',  'G2', null, 'C2', 'E2',
      'F2', null, 'F3', 'F2',  'A2', null, 'F2', 'G2',
      'A2', null, 'A3', 'A2',  'E2', null, 'A2', 'C3',
      'G2', null, 'G3', 'G2',  'B2', null, 'D3', 'G2'
    ];

    // Catchy, Joyful Arcade Runner Lead Melody
    this.melodyPattern = [
      'C4', 'E4', 'G4', 'C5',  null, 'G4', 'E4', 'G4',
      'A4', null, 'G4', 'E4',  'D4', 'E4', 'G4', null,
      'C5', null, 'B4', 'A4',  'G4', null, 'E4', 'D4',
      'C4', 'D4', 'E4', 'G4',  'C5', null, 'C5', null
    ];

    this.pickupPitchStep = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

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
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  startMusic() {
    if (this.isPlayingMusic) return;
    this.resumeContext();
    this.isPlayingMusic = true;
    this.currentStep = 0;

    const stepDuration = (60 / this.tempo) / 4;
    this.stepInterval = setInterval(() => {
      if (!this.isPlayingMusic || !this.ctx) return;
      this.playStep(this.currentStep);
      this.currentStep = (this.currentStep + 1) % 32;
    }, stepDuration * 1000);
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
  }

  playStep(step) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Kick on beats 0, 4, 8, 12, 16, 20, 24, 28 (Punchy arcade 4-on-the-floor)
    if (step % 4 === 0) {
      this.playKick(now);
    }

    // 2. Snare / Clap on beats 4, 12, 20, 28
    if (step % 8 === 4) {
      this.playSnare(now);
    }

    // 3. Shaker / Hi-Hat on offbeats
    if (step % 2 === 0) {
      this.playHiHat(now, step % 4 === 2 ? 0.08 : 0.04);
    }

    // 4. Funky Bouncy Bass
    const bNote = this.bassPattern[step % this.bassPattern.length];
    if (bNote && this.notes[bNote]) {
      this.playBass(this.notes[bNote], now);
    }

    // 5. Catchy Marimba-style Melodic Lead
    const mNote = this.melodyPattern[step % this.melodyPattern.length];
    if (mNote && this.notes[mNote]) {
      this.playMarimbaLead(this.notes[mNote], now);
    }
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.11);
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  playSnare(time) {
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
  }

  playHiHat(time, vol = 0.05) {
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
  }

  playBass(freq, time) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + 0.15);

    gain.gain.setValueAtTime(0.42, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  playMarimbaLead(freq, time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    // Bouncy arcade mallet attack
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.16);
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
