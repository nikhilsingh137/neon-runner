/**
 * Urban Dash 4D - Metro soundtrack and sound effects
 * Built with Web Audio API for zero-latency, high-energy mobile runner audio.
 */

const METRO_BEATS_PER_MINUTE = 96;
const METRO_STEPS_PER_SECTION = 64;

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('urban_dash_muted') === 'true';
    this.musicVolume = 0.43;
    this.sfxVolume = 0.75;
    this.isPlayingMusic = false;
    this.currentStep = 0;
    this.nextNoteTime = 0;
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

    this.sections = [
      {
        chords: [[50, 57, 60, 65], [55, 59, 65, 69], [48, 55, 59, 64], [45, 52, 55, 60]],
        bass: [0, 5, 8, 11, 14],
        melody: [[0, 3], [3, 5], [6, 4], [9, 6], [12, 3], [14, 2]],
        kicks: [0, 7, 10],
        chordsOn: [2, 8, 14],
        voice: 'pluck'
      },
      {
        chords: [[48, 55, 59, 64], [52, 59, 62, 67], [45, 52, 55, 60], [53, 60, 64, 69]],
        bass: [0, 4, 6, 8, 12, 14],
        melody: [[2, 5], [4, 7], [7, 6], [10, 4], [12, 6], [15, 5]],
        kicks: [0, 4, 8, 12],
        chordsOn: [2, 6, 10, 14],
        voice: 'keys'
      },
      {
        chords: [[45, 52, 55, 60], [53, 60, 64, 69], [48, 55, 59, 67], [55, 59, 62, 69]],
        bass: [0, 3, 7, 10, 13],
        melody: [[1, 4], [5, 6], [7, 7], [10, 5], [13, 4], [15, 3]],
        kicks: [0, 5, 10, 14],
        chordsOn: [0, 9],
        voice: 'bell'
      },
      {
        chords: [[53, 60, 64, 67], [50, 57, 60, 65], [45, 52, 55, 64], [55, 59, 62, 65]],
        bass: [0, 6, 8, 13],
        melody: [[0, 6], [4, 4], [8, 5], [11, 7], [14, 6]],
        kicks: [0, 8, 11],
        chordsOn: [0, 7, 12],
        voice: 'pluck'
      }
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
    if (!this.ctx) return;

    this.isPlayingMusic = true;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(this.musicVolume, now, 0.018);
    this.nextNoteTime = now + 0.045;
    this.stepInterval = setInterval(() => this.scheduleMusic(), 25);
    this.scheduleMusic();
  }

  pauseMusic() {
    this.isPlayingMusic = false;
    if (this.stepInterval !== null) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0, now, 0.018);
    }
  }

  stopMusic() {
    this.pauseMusic();
    this.currentStep = 0;
  }

  scheduleMusic() {
    if (!this.isPlayingMusic || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextNoteTime < now) this.nextNoteTime = now + 0.015;

    const stepDuration = 15 / METRO_BEATS_PER_MINUTE;
    while (this.nextNoteTime < now + 0.1) {
      const section = this.sections[Math.floor(this.currentStep / METRO_STEPS_PER_SECTION) % this.sections.length];
      this.playStep(this.currentStep, section, this.nextNoteTime, stepDuration);
      this.currentStep += 1;
      this.nextNoteTime += stepDuration;
    }
  }

  playStep(step, section, time, stepDuration) {
    if (this.isMuted) return;

    const beat = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chord = section.chords[bar];
    if (section.kicks.includes(beat)) this.playKick(time);
    if (beat === 4 || beat === 12) this.playSnare(time);
    if (beat % 2 === 0 || (bar === 3 && beat >= 13)) {
      this.playHiHat(time, beat % 4 === 2 ? 0.078 : 0.038);
    }

    if (section.bass.includes(beat)) {
      const degree = beat === 6 || beat === 14 ? 1 : 0;
      this.playBass(chord[degree] - 12, time, stepDuration * 1.65);
    }

    if (section.chordsOn.includes(beat)) {
      for (let i = 1; i < chord.length; i++) {
        this.playMusicVoice(chord[i], time + i * 0.009, stepDuration * 3.4, 0.046, 'keys', (i - 2) * 0.23);
      }
    }

    const melody = section.melody.find(([position]) => position === beat);
    if (!melody) return;

    const degree = melody[1] + (bar === 3 && beat >= 12 ? 1 : 0);
    const note = chord[degree % chord.length] + Math.floor(degree / chord.length) * 12;
    const pan = beat % 2 === 0 ? -0.15 : 0.15;
    this.playMusicVoice(note, time, stepDuration * 2.15, 0.15, section.voice, pan);
    if (beat < 13) {
      this.playMusicVoice(note, time + stepDuration * 3, stepDuration * 1.5, 0.043, section.voice, -pan);
    }
  }

  midiFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  playMusicVoice(note, time, duration, volume, voice, pan) {
    const frequency = this.midiFrequency(note);
    const audio = this.ctx;
    const partials = voice === 'bell' ? [[1, 0.76, 'sine'], [2.01, 0.16, 'sine'], [3.93, 0.08, 'sine']]
      : voice === 'keys' ? [[1, 0.69, 'triangle'], [2.003, 0.19, 'sine'], [3, 0.12, 'sine']]
      : [[1, 0.64, 'triangle'], [2.006, 0.24, 'sine'], [3, 0.12, 'sine']];
    const stereo = audio.createStereoPanner?.();
    const target = stereo || this.musicGain;
    if (stereo) {
      stereo.pan.setValueAtTime(pan, time);
      stereo.connect(this.musicGain);
    }
    for (const [multiple, weight, shape] of partials) {
      const osc = audio.createOscillator();
      const envelope = audio.createGain();
      const decay = multiple === 1 ? duration : duration * 0.52;
      osc.type = shape;
      osc.frequency.setValueAtTime(frequency * multiple, time);
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(volume * weight, time + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      osc.connect(envelope);
      envelope.connect(target);
      if (stereo && multiple === 1) osc.onended = () => stereo.disconnect();
      osc.start(time);
      osc.stop(time + decay + 0.01);
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

  playBass(note, time, duration) {
    const frequency = this.midiFrequency(note);
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(685, time);
    filter.frequency.exponentialRampToValueAtTime(222, time + duration);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.40, time + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
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
