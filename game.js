/**
 * Subway City Runner 3D - High Quality Kinetic Character & Subway Trains Engine
 * Built in the vibrant, colorful aesthetic of Subway Surfers (Jake style runner, trains, tracks, coins)
 */

(function () {
  'use strict';

  // --- CONFIGURATION ---
  const FOV = 320;
  const CAMERA_HEIGHT = 195;
  const ROAD_WIDTH = 960;
  const LANES = [-260, 0, 260]; // 3 Railway Tracks: Left, Center, Right

  // Subway Environment Themes (Vibrant & Bright)
  const THEMES = [
    {
      name: "CENTRAL METRO YARD",
      skyTop: "#3a88e9",
      skyBottom: "#87ceeb",
      groundColor: "#424754",
      railColor: "#b0b8c6",
      tieColor: "#5c4033",
      accentColor: "#e52b2b"
    },
    {
      name: "GOLDEN HOUR TUNNEL",
      skyTop: "#f97316",
      skyBottom: "#fed7aa",
      groundColor: "#403939",
      railColor: "#cbd5e1",
      tieColor: "#453227",
      accentColor: "#fbbf24"
    },
    {
      name: "NEON CITY STATION",
      skyTop: "#1e1b4b",
      skyBottom: "#4338ca",
      groundColor: "#1e2430",
      railColor: "#38bdf8",
      tieColor: "#262338",
      accentColor: "#ec4899"
    }
  ];

  // Character Skins
  const CHARACTERS = [
    {
      id: "jake",
      name: "JAKE (SKATER BOY)",
      capColor: "#e52b2b",
      hairColor: "#6b4226",
      vestColor: "#1d4ed8",
      shirtColor: "#ffffff",
      jeansColor: "#2563eb",
      shoesColor: "#dc2626",
      backpackColor: "#16a34a",
      price: 0
    },
    {
      id: "tricky",
      name: "TRICKY (BEANIE)",
      capColor: "#ec4899",
      hairColor: "#f59e0b",
      vestColor: "#7c3aed",
      shirtColor: "#f3f4f6",
      jeansColor: "#475569",
      shoesColor: "#f43f5e",
      backpackColor: "#0ea5e9",
      price: 350
    },
    {
      id: "fresh",
      name: "FRESH (BOOMBOX)",
      capColor: "#eab308",
      hairColor: "#18181b",
      vestColor: "#10b981",
      shirtColor: "#0284c7",
      jeansColor: "#1e293b",
      shoesColor: "#f59e0b",
      backpackColor: "#8b5cf6",
      price: 800
    }
  ];

  // Storage
  function loadPlayerData() {
    const defaults = {
      credits: 0,
      highScore: 0,
      totalRuns: 0,
      selectedChar: "jake",
      unlockedChars: ["jake"],
      upgrades: {
        magnet: 1,
        hoverboard: 1,
        boost: 1,
        multiplier: 1
      }
    };
    try {
      const saved = localStorage.getItem("subway_runner_player");
      return saved ? Object.assign(defaults, JSON.parse(saved)) : defaults;
    } catch (e) {
      return defaults;
    }
  }

  function savePlayerData() {
    try {
      localStorage.setItem("subway_runner_player", JSON.stringify(playerData));
    } catch (e) {
      console.warn(e);
    }
  }

  const playerData = loadPlayerData();

  // --- GAME ENGINE ---
  class SubwayGame {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");

      this.isRunning = false;
      this.isPaused = false;
      this.gameOver = false;

      this.width = 800;
      this.height = 1200;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.horizonY = this.height * 0.42;

      // Camera
      this.cameraTilt = 0;
      this.shakeIntensity = 0;
      this.shakeDuration = 0;

      // Character Physics
      this.currentLane = 1; // 0: Left, 1: Center, 2: Right
      this.playerX = 0;
      this.targetPlayerX = 0;
      this.playerY = 0; // Vertical height (Jump)
      this.playerZ = 85;
      this.verticalVelocity = 0;
      this.gravity = 2500;
      this.isJumping = false;
      this.isSliding = false;
      this.slideTimer = 0;
      this.slideDuration = 0.72;

      // Running animation
      this.runCycle = 0;
      this.speed = 0;
      this.baseSpeed = 750;
      this.maxSpeed = 1600;
      this.bankAngle = 0;

      // Gameplay Stats
      this.score = 0;
      this.displayScore = 0;
      this.distance = 0;
      this.coinsThisRun = 0;
      this.multiplier = 1;
      this.multiplierTimer = 0;
      this.shields = 1;
      this.maxShields = 1;

      // Hoverboard / Boost mode
      this.overdriveEnergy = 0;
      this.maxOverdriveEnergy = 100;
      this.isOverdrive = false;
      this.overdriveTimer = 0;

      // World Objects
      this.obstacles = [];
      this.coins = [];
      this.particles = [];
      this.floatingTexts = [];
      this.trackZOffset = 0;

      // Theme
      this.currentThemeIndex = 0;
      this.themeDistance = 0;
      this.themeLength = 3500;

      // Timers
      this.lastTime = 0;
      this.spawnTimer = 0;
      this.coinSpawnTimer = 0;

      // Input State
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchStartTime = 0;

      this.initDisplay();
      this.initEvents();
      this.updateUI();
    }

    initDisplay() {
      const resize = () => {
        const container = document.getElementById("game-container");
        const rect = container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
        this.horizonY = this.height * 0.42;
      };
      window.addEventListener("resize", resize);
      resize();
    }

    initEvents() {
      // Keyboard Controls
      window.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.changeLane(-1);
        if (["ArrowRight", "KeyD"].includes(e.code)) this.changeLane(1);
        if (["ArrowUp", "KeyW"].includes(e.code)) this.jump();
        if (["ArrowDown", "KeyS"].includes(e.code)) this.slide();
        if (["Space"].includes(e.code)) this.activateHoverboard();
        if (["KeyP", "Escape"].includes(e.code)) this.togglePause();
      });

      // Mobile Touch Gesture Engine (Instant, Crisp Swipes like Subway Surfers)
      const touchArea = document.getElementById("touch-overlay") || this.canvas;

      touchArea.addEventListener("touchstart", (e) => {
        if (!this.isRunning || this.gameOver || this.isPaused) return;
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
      }, { passive: false });

      touchArea.addEventListener("touchend", (e) => {
        if (!this.isRunning || this.gameOver || this.isPaused) return;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        const deltaTime = performance.now() - this.touchStartTime;

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Fast swipe threshold
        if (Math.max(absX, absY) > 20 && deltaTime < 450) {
          if (absX > absY) {
            // Horizontal Swipe
            if (deltaX > 0) this.changeLane(1);
            else this.changeLane(-1);
          } else {
            // Vertical Swipe
            if (deltaY < 0) this.jump();
            else this.slide();
          }
        }
      }, { passive: true });

      // Virtual Buttons for Accessibility
      const btnLeft = document.getElementById("btn-left");
      const btnRight = document.getElementById("btn-right");
      const btnJump = document.getElementById("btn-jump");
      const btnSlide = document.getElementById("btn-slide");
      const btnBoost = document.getElementById("btn-boost");

      if (btnLeft) btnLeft.addEventListener("click", () => this.changeLane(-1));
      if (btnRight) btnRight.addEventListener("click", () => this.changeLane(1));
      if (btnJump) btnJump.addEventListener("click", () => this.jump());
      if (btnSlide) btnSlide.addEventListener("click", () => this.slide());
      if (btnBoost) btnBoost.addEventListener("click", () => this.activateHoverboard());

      // UI
      document.getElementById("btn-start").addEventListener("click", () => this.startGame());
      document.getElementById("btn-restart").addEventListener("click", () => this.startGame());
      document.getElementById("btn-pause").addEventListener("click", () => this.togglePause());
      document.getElementById("btn-resume").addEventListener("click", () => this.togglePause());
      document.getElementById("btn-garage").addEventListener("click", () => this.openGarage());
      document.getElementById("btn-close-garage").addEventListener("click", () => this.closeGarage());
      document.getElementById("btn-audio").addEventListener("click", () => this.toggleAudio());
      document.getElementById("btn-fullscreen").addEventListener("click", () => this.toggleFullscreen());

      const btnShare = document.getElementById("btn-share");
      if (btnShare) btnShare.addEventListener("click", () => this.shareScore());
    }

    changeLane(dir) {
      if (!this.isRunning || this.gameOver || this.isPaused) return;
      window.soundEngine.resumeContext();
      this.currentLane = Math.max(0, Math.min(2, this.currentLane + dir));
      this.targetPlayerX = LANES[this.currentLane];
    }

    jump() {
      if (!this.isRunning || this.gameOver || this.isPaused) return;
      if (this.isJumping) return;

      this.isJumping = true;
      this.isSliding = false;
      this.verticalVelocity = 960; // Parabolic jump arc

      window.soundEngine.playJumpSFX();
      this.addDustPuff(this.playerX, 0, 8);
    }

    slide() {
      if (!this.isRunning || this.gameOver || this.isPaused) return;

      if (this.isJumping) {
        // Fast drop straight down into a roll
        this.verticalVelocity = -1400;
      }

      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      window.soundEngine.playSlideSFX();

      for (let i = 0; i < 12; i++) {
        this.particles.push({
          x: this.playerX + (Math.random() - 0.5) * 25,
          y: -5,
          z: this.playerZ + Math.random() * 20,
          vx: (Math.random() - 0.5) * 120,
          vy: Math.random() * -50,
          vz: 350 + Math.random() * 150,
          life: 0.3,
          maxLife: 0.3,
          color: "#e5e7eb",
          size: 4
        });
      }
    }

    activateHoverboard() {
      if (this.overdriveEnergy < this.maxOverdriveEnergy || this.isOverdrive || this.gameOver) return;
      this.isOverdrive = true;
      this.overdriveTimer = 6.5;
      this.overdriveEnergy = 0;

      window.soundEngine.playCoinSFX(4);
      this.triggerScreenShake(10, 0.3);
      this.addFloatingText("HOVERBOARD BOOST!", 0, -80, "#ffe600", 2.0);
    }

    getChar() {
      return CHARACTERS.find(c => c.id === playerData.selectedChar) || CHARACTERS[0];
    }

    startGame() {
      window.soundEngine.resumeContext();
      window.soundEngine.startMusic();
      window.soundEngine.playClickSFX();

      this.isRunning = true;
      this.isPaused = false;
      this.gameOver = false;

      this.currentLane = 1;
      this.playerX = 0;
      this.targetPlayerX = 0;
      this.playerY = 0;
      this.verticalVelocity = 0;
      this.isJumping = false;
      this.isSliding = false;
      this.slideTimer = 0;
      this.runCycle = 0;

      this.speed = this.baseSpeed;
      this.score = 0;
      this.displayScore = 0;
      this.distance = 0;
      this.coinsThisRun = 0;
      this.multiplier = 1;
      this.multiplierTimer = 0;

      const shieldUpgrade = playerData.upgrades.hoverboard || 1;
      this.maxShields = 1 + Math.floor((shieldUpgrade - 1) / 2);
      this.shields = this.maxShields;

      this.overdriveEnergy = 0;
      this.isOverdrive = false;
      this.overdriveTimer = 0;

      this.obstacles = [];
      this.coins = [];
      this.particles = [];
      this.floatingTexts = [];
      this.currentThemeIndex = 0;
      this.themeDistance = 0;

      document.getElementById("start-screen").classList.add("hidden");
      document.getElementById("game-over-screen").classList.add("hidden");
      document.getElementById("pause-screen").classList.add("hidden");
      document.getElementById("garage-screen").classList.add("hidden");
      document.getElementById("hud").classList.remove("hidden");

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    togglePause() {
      if (!this.isRunning || this.gameOver) return;
      this.isPaused = !this.isPaused;
      window.soundEngine.playClickSFX();

      const pauseScreen = document.getElementById("pause-screen");
      if (this.isPaused) {
        pauseScreen.classList.remove("hidden");
        window.soundEngine.stopMusic();
      } else {
        pauseScreen.classList.add("hidden");
        window.soundEngine.startMusic();
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
      }
    }

    toggleAudio() {
      const isMuted = window.soundEngine.toggleMute();
      const btn = document.getElementById("btn-audio");
      btn.innerHTML = isMuted ? "🔇 AUDIO: OFF" : "🔊 AUDIO: ON";
    }

    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    triggerScreenShake(intensity, duration) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
    }

    addFloatingText(text, x, y, color = "#ffe600", scale = 1.0) {
      this.floatingTexts.push({ text, x, y, color, scale, alpha: 1.0, life: 1.1 });
    }

    addDustPuff(x, y, count = 6) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 18,
          y: y,
          z: this.playerZ + Math.random() * 10,
          vx: (Math.random() - 0.5) * 35,
          vy: -Math.random() * 20,
          vz: 250 + Math.random() * 80,
          life: 0.3,
          maxLife: 0.3,
          color: "rgba(255, 255, 255, 0.45)",
          size: 4
        });
      }
    }

    // --- GAME LOOP ---
    loop(currentTime) {
      if (!this.isRunning || this.isPaused) return;
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(dt);
      this.render();

      if (!this.gameOver) {
        requestAnimationFrame((t) => this.loop(t));
      }
    }

    // --- UPDATE ---
    update(dt) {
      // 1. Snappy Lane Change Lerp
      const lerpSpeed = 18 * dt;
      const prevX = this.playerX;
      this.playerX += (this.targetPlayerX - this.playerX) * lerpSpeed;
      this.bankAngle = Math.max(-0.2, Math.min(0.2, (this.playerX - prevX) / 30));

      // 2. Jumping Arc Physics
      if (this.isJumping) {
        this.playerY += this.verticalVelocity * dt;
        this.verticalVelocity -= this.gravity * dt;

        if (this.playerY <= 0) {
          this.playerY = 0;
          this.isJumping = false;
          this.verticalVelocity = 0;
          this.addDustPuff(this.playerX, 0, 8);
          window.soundEngine.playFootstep();
        }
      }

      // 3. Sliding
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) {
          this.isSliding = false;
        }
      }

      // 4. Running Cycle
      if (!this.isJumping && !this.isSliding) {
        const runFreq = (this.speed / 750) * 15;
        const prevCycle = this.runCycle;
        this.runCycle += runFreq * dt;

        if (Math.sin(prevCycle) < 0 && Math.sin(this.runCycle) >= 0) {
          window.soundEngine.playFootstep();
          this.addDustPuff(this.playerX + 12, 0, 3);
        } else if (Math.sin(prevCycle) >= 0 && Math.sin(this.runCycle) < 0) {
          window.soundEngine.playFootstep();
          this.addDustPuff(this.playerX - 12, 0, 3);
        }
      }

      // 5. Speed & Distance
      const targetSpeed = this.isOverdrive ? 1800 : Math.min(this.maxSpeed, this.baseSpeed + this.distance * 0.09);
      this.speed += (targetSpeed - this.speed) * 3 * dt;
      this.distance += this.speed * dt * 0.1;
      this.themeDistance += this.speed * dt * 0.1;

      if (this.themeDistance >= this.themeLength) {
        this.themeDistance = 0;
        this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
        this.addFloatingText(THEMES[this.currentThemeIndex].name, 0, -80, "#ffffff", 1.8);
      }

      // Score
      this.score += (this.speed * 0.12) * this.multiplier * dt;
      this.displayScore += (this.score - this.displayScore) * 10 * dt;

      // Railway Ties Scroll
      this.trackZOffset = (this.trackZOffset + this.speed * dt) % 90;

      // Decay screen shake
      if (this.shakeDuration > 0) this.shakeDuration -= dt;
      else this.shakeIntensity = 0;

      // Overdrive decay
      if (this.isOverdrive) {
        this.overdriveTimer -= dt;
        if (this.overdriveTimer <= 0) this.isOverdrive = false;
      }

      // Multiplier decay
      if (this.multiplier > 1) {
        this.multiplierTimer -= dt;
        if (this.multiplierTimer <= 0) this.multiplier = 1;
      }

      // Spawning
      this.updateSpawners(dt);

      // Entities
      this.updateObstacles(dt);
      this.updateCoins(dt);
      this.updateParticles(dt);
      this.updateFloatingTexts(dt);
      this.updateHUD();
    }

    updateSpawners(dt) {
      this.spawnTimer -= dt;
      const interval = Math.max(0.7, 1.4 - (this.distance * 0.00008));
      if (this.spawnTimer <= 0) {
        this.spawnTimer = interval + Math.random() * 0.35;
        this.spawnSubwayObstacle();
      }

      this.coinSpawnTimer -= dt;
      if (this.coinSpawnTimer <= 0) {
        this.coinSpawnTimer = 0.6 + Math.random() * 0.4;
        this.spawnSubwayCoins();
      }
    }

    spawnSubwayObstacle() {
      // SUBWAY SURFERS OBSTACLES:
      // 1. "train": Full 3D Red Subway Train Carriage (Dodge left/right)
      // 2. "hurdle": Track barrier hurdle (JUMP OVER)
      // 3. "overhead_barrier": Low-clearance track gantry with yellow stripes (SLIDE UNDER)
      // 4. "track_sign": Railway signal post with flashing lights (Dodge)
      const types = ["train", "hurdle", "overhead_barrier", "train", "track_sign"];
      const type = types[Math.floor(Math.random() * types.length)];
      const lane = LANES[Math.floor(Math.random() * LANES.length)];
      const spawnZ = 1350;

      if (type === "train") {
        this.obstacles.push({
          type: "train",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 220,
          height: 180,
          length: 380,
          hitRadius: 95,
          color: "#e52b2b",
          passed: false
        });
      } else if (type === "hurdle") {
        this.obstacles.push({
          type: "hurdle",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 200,
          height: 55,
          hitRadius: 85,
          passed: false
        });
      } else if (type === "overhead_barrier") {
        this.obstacles.push({
          type: "overhead_barrier",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 220,
          height: 160,
          hitRadius: 90,
          passed: false
        });
      } else if (type === "track_sign") {
        this.obstacles.push({
          type: "track_sign",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 140,
          height: 140,
          hitRadius: 75,
          passed: false
        });
      }
    }

    spawnSubwayCoins() {
      const lane = LANES[Math.floor(Math.random() * LANES.length)];
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.coins.push({
          x: lane,
          y: -35,
          z: 1350 + (i * 85),
          radius: 26,
          rotation: 0
        });
      }
    }

    updateObstacles(dt) {
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.z -= this.speed * dt;

        const zDist = obs.z - this.playerZ;
        const xDist = Math.abs(obs.x - this.playerX);

        if (!obs.passed && zDist <= 30 && zDist >= -40) {
          if (xDist < obs.hitRadius) {
            let avoided = false;

            if (obs.type === "hurdle" && this.playerY > 40) {
              avoided = true; // Clean parkour jump!
              this.score += 250 * this.multiplier;
              this.addFloatingText("VAULT! +250", this.playerX, -80, "#22c55e", 1.4);
            } else if (obs.type === "overhead_barrier" && this.isSliding) {
              avoided = true; // Clean slide under bar!
              this.score += 350 * this.multiplier;
              this.addFloatingText("SLIDE! +350", this.playerX, -50, "#ffe600", 1.5);
            }

            if (!avoided) {
              obs.passed = true;
              this.handleCollision(obs);
            }
          } else if (xDist < obs.hitRadius + 90) {
            obs.passed = true;
            this.handleNearMiss(obs);
          }
        }

        if (obs.z < -100) this.obstacles.splice(i, 1);
      }
    }

    updateCoins(dt) {
      const magnetLevel = playerData.upgrades.magnet || 1;
      const magnetRadius = 220 + (magnetLevel * 50);

      for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        c.z -= this.speed * dt;
        c.rotation += 4 * dt;

        // Magnet attraction
        const dx = this.playerX - c.x;
        const dz = this.playerZ - c.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < magnetRadius && c.z > this.playerZ) {
          const pull = (1 - dist / magnetRadius) * 2600 * dt;
          c.x += (dx / dist) * pull;
        }

        // Collection
        if (Math.abs(c.z - this.playerZ) < 55 && Math.abs(c.x - this.playerX) < 65) {
          this.coinsThisRun++;
          playerData.credits++;
          savePlayerData();

          this.score += 100 * this.multiplier;
          this.overdriveEnergy = Math.min(this.maxOverdriveEnergy, this.overdriveEnergy + 6);

          window.soundEngine.playCoinSFX(this.multiplier);
          this.addFloatingText("+1 COIN", c.x, -50, "#ffe600", 1.1);

          this.coins.splice(i, 1);
          continue;
        }

        if (c.z < -60) this.coins.splice(i, 1);
      }
    }

    handleNearMiss(obs) {
      this.score += 200 * this.multiplier;
      this.overdriveEnergy = Math.min(this.maxOverdriveEnergy, this.overdriveEnergy + 8);
      if (this.multiplier < 8) {
        this.multiplier++;
        this.multiplierTimer = 4.0;
      }
      this.addFloatingText(`DODGE! x${this.multiplier}`, this.playerX, -80, "#38bdf8", 1.4);
      this.triggerScreenShake(4, 0.12);
    }

    handleCollision(obs) {
      if (this.isOverdrive) {
        this.score += 500 * this.multiplier;
        this.addFloatingText("TRAIN SMASH! +500", obs.x, -70, "#ffe600", 1.8);
        window.soundEngine.playCrashSFX();
        this.triggerScreenShake(14, 0.3);

        for (let i = 0; i < 25; i++) {
          this.particles.push({
            x: obs.x,
            y: 0,
            z: obs.z,
            vx: (Math.random() - 0.5) * 600,
            vy: -Math.random() * 400,
            vz: (Math.random() - 0.5) * 600,
            life: 0.6,
            maxLife: 0.6,
            color: "#e52b2b",
            size: 6
          });
        }
        return;
      }

      this.shields--;
      this.multiplier = 1;

      if (this.shields > 0) {
        this.triggerScreenShake(12, 0.3);
        window.soundEngine.playCrashSFX();
        this.addFloatingText("BOARD BROKEN!", this.playerX, -80, "#ef4444", 1.6);
      } else {
        this.triggerGameOver();
      }
    }

    triggerGameOver() {
      this.gameOver = true;
      this.isRunning = false;

      window.soundEngine.stopMusic();
      window.soundEngine.playCrashSFX();
      this.triggerScreenShake(24, 0.7);

      const finalScore = Math.floor(this.score);
      const isNew = finalScore > playerData.highScore;
      if (isNew) playerData.highScore = finalScore;
      playerData.totalRuns = (playerData.totalRuns || 0) + 1;
      savePlayerData();

      setTimeout(() => {
        document.getElementById("hud").classList.add("hidden");
        document.getElementById("game-over-screen").classList.remove("hidden");
        document.getElementById("final-score").textContent = finalScore.toLocaleString();
        document.getElementById("final-distance").textContent = `${Math.floor(this.distance)} m`;
        document.getElementById("final-credits").textContent = `+${this.coinsThisRun}`;
        document.getElementById("final-nearmiss").textContent = `${this.coinsThisRun} Coins`;

        const badge = document.getElementById("new-record-badge");
        if (badge) badge.style.display = isNew ? "inline-block" : "none";
      }, 600);
    }

    shareScore() {
      const text = `🏃 I scored ${Math.floor(this.score).toLocaleString()} in Subway Runner! Can you beat Jake's record? Play live now:`;
      if (navigator.share) {
        navigator.share({ title: "Subway Runner", text, url: window.location.href }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`${text} ${window.location.href}`);
        alert("Score copied to clipboard! Share it with friends.");
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
    }

    updateFloatingTexts(dt) {
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.life -= dt;
        if (ft.life <= 0) {
          this.floatingTexts.splice(i, 1);
          continue;
        }
        ft.y -= 40 * dt;
        ft.alpha = ft.life / 1.1;
      }
    }

    updateHUD() {
      document.getElementById("hud-score").textContent = Math.floor(this.displayScore).toLocaleString();
      document.getElementById("hud-speed").textContent = `${Math.floor(this.speed)} KM/H`;
      document.getElementById("hud-credits").textContent = `${playerData.credits}`;

      const pct = Math.min(100, (this.overdriveEnergy / this.maxOverdriveEnergy) * 100);
      const gauge = document.getElementById("hud-overdrive-fill");
      if (gauge) {
        gauge.style.width = `${pct}%`;
        gauge.classList.toggle("ready", pct >= 100);
      }

      const btnBoost = document.getElementById("btn-boost");
      if (btnBoost) {
        btnBoost.classList.toggle("glow", pct >= 100 || this.isOverdrive);
        btnBoost.textContent = this.isOverdrive ? "FLYING!" : "BOARD";
      }

      const multTag = document.getElementById("hud-multiplier");
      if (multTag) {
        multTag.textContent = `x${this.multiplier}`;
        multTag.style.display = this.multiplier > 1 ? "inline-block" : "none";
      }

      const shieldsContainer = document.getElementById("hud-shields");
      if (shieldsContainer) {
        shieldsContainer.innerHTML = "";
        for (let s = 0; s < this.maxShields; s++) {
          const dot = document.createElement("span");
          dot.className = `shield-dot ${s < this.shields ? "active" : "depleted"}`;
          shieldsContainer.appendChild(dot);
        }
      }
    }

    // --- 3D PERSPECTIVE RENDERING ---
    project(worldX, worldY, worldZ) {
      const z = Math.max(worldZ, 1);
      const scale = FOV / (FOV + z);
      const screenX = (this.width * 0.5) + (worldX - this.playerX) * scale;
      const screenY = this.horizonY + (CAMERA_HEIGHT + worldY) * scale;
      return { x: screenX, y: screenY, scale };
    }

    render() {
      const ctx = this.ctx;
      const theme = THEMES[this.currentThemeIndex];

      let shakeX = 0, shakeY = 0;
      if (this.shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 1. Vibrant Sky & Clouds
      this.renderSky(theme);

      // 2. City Station Backdrop & Buildings
      this.renderStationCity(theme);

      // 3. 3D Subway Railway Tracks & Wooden Ties
      this.renderSubwayTracks(theme);

      // 4. World Objects (3D Red Trains, Hurdles, Coins)
      this.renderEntities(theme);

      // 5. Stylized Subway Surfers Boy Runner (Jake with backwards cap, hoodie, jeans, sneakers & backpack)
      this.renderJakeRunner();

      // 6. Floating UI Texts
      this.renderFloatingTexts();

      // 7. Overdrive Hoverboard FX
      if (this.isOverdrive) {
        this.renderHoverboardVFX();
      }

      ctx.restore();
    }

    renderSky(theme) {
      const ctx = this.ctx;
      const grad = ctx.createLinearGradient(0, 0, 0, this.horizonY);
      grad.addColorStop(0, theme.skyTop);
      grad.addColorStop(1, theme.skyBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.horizonY);

      // Fluffy Cartoon Clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      const clouds = [
        { x: this.width * 0.2, y: this.horizonY * 0.35, r: 35 },
        { x: this.width * 0.75, y: this.horizonY * 0.25, r: 45 }
      ];
      for (const c of clouds) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.7, c.y - c.r * 0.2, c.r * 0.8, 0, Math.PI * 2);
        ctx.arc(c.x - c.r * 0.6, c.y, c.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderStationCity(theme) {
      const ctx = this.ctx;
      ctx.save();
      const horizon = this.horizonY;
      const parallax = -this.playerX * 0.03;

      // Colorful Subway Station Skyline & Overpasses
      const bWidth = 48;
      const count = Math.ceil(this.width / bWidth) + 4;
      const colors = ["#cbd5e1", "#94a3b8", "#64748b", "#cbd5e1", "#e2e8f0"];

      for (let i = -2; i < count; i++) {
        const bx = i * bWidth + (parallax % bWidth);
        const seed = Math.sin(i * 1234.56);
        const bh = 50 + Math.abs(seed) * 110;
        const color = colors[Math.abs(Math.floor(seed * 10)) % colors.length];

        ctx.fillStyle = color;
        ctx.fillRect(bx, horizon - bh, bWidth - 3, bh);

        // Windows
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.7;
        for (let wy = horizon - bh + 14; wy < horizon - 8; wy += 16) {
          ctx.fillRect(bx + 8, wy, 8, 9);
          ctx.fillRect(bx + 24, wy, 8, 9);
        }
        ctx.globalAlpha = 1.0;
      }

      ctx.restore();
    }

    renderSubwayTracks(theme) {
      const ctx = this.ctx;
      ctx.save();

      // Gravel Ballast Ground Bed
      const groundGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.height);
      groundGrad.addColorStop(0, "#333842");
      groundGrad.addColorStop(1, theme.groundColor);
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, this.horizonY, this.width, this.height - this.horizonY);

      const maxZ = 1350;

      // Wooden Cross-Ties (Railway Sleepers across tracks)
      const tieStep = 45;
      for (let z = (this.trackZOffset % tieStep); z < maxZ; z += tieStep) {
        const pL = this.project(-ROAD_WIDTH * 0.48, 0, z);
        const pR = this.project(ROAD_WIDTH * 0.48, 0, z);
        const alpha = Math.max(0, 1 - (z / maxZ));

        ctx.strokeStyle = theme.tieColor;
        ctx.lineWidth = Math.max(2, 6 * pL.scale);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(pR.x, pR.y);
        ctx.stroke();
      }

      // 3 Pairs of Metallic Steel Rails (One pair for each lane)
      const railGauges = [
        // Left Lane Dual Rails
        [-310, -210],
        // Center Lane Dual Rails
        [-50, 50],
        // Right Lane Dual Rails
        [210, 310]
      ];

      for (const pair of railGauges) {
        for (const railX of pair) {
          const pNear = this.project(railX, 0, 20);
          const pFar = this.project(railX, 0, maxZ);

          // Rail Shadow
          ctx.strokeStyle = "rgba(0,0,0,0.4)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(pNear.x + 2, pNear.y + 1);
          ctx.lineTo(pFar.x + 1, pFar.y);
          ctx.stroke();

          // Steel Rail Top
          ctx.strokeStyle = theme.railColor;
          ctx.lineWidth = 3.5;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(pNear.x, pNear.y);
          ctx.lineTo(pFar.x, pFar.y);
          ctx.stroke();

          // Shiny highlight
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.moveTo(pNear.x, pNear.y - 1);
          ctx.lineTo(pFar.x, pFar.y);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    renderEntities(theme) {
      const entities = [];
      for (const obs of this.obstacles) entities.push({ type: "obs", data: obs, z: obs.z });
      for (const coin of this.coins) entities.push({ type: "coin", data: coin, z: coin.z });
      for (const p of this.particles) entities.push({ type: "p", data: p, z: p.z });

      entities.sort((a, b) => b.z - a.z);

      for (const ent of entities) {
        if (ent.type === "obs") this.renderObstacle(ent.data);
        else if (ent.type === "coin") this.renderCoin(ent.data);
        else if (ent.type === "p") this.renderParticle(ent.data);
      }
    }

    renderObstacle(obs) {
      const proj = this.project(obs.x, obs.y, obs.z);
      if (proj.scale <= 0) return;
      const ctx = this.ctx;
      ctx.save();

      const w = obs.width * proj.scale;
      const h = obs.height * proj.scale;

      if (obs.type === "train") {
        // 3D RED SUBWAY TRAIN CARRIAGE (Subway Surfers iconic red/silver train)
        // Body Drop Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fillRect(proj.x - w * 0.5, proj.y - 4, w, 10 * proj.scale);

        // Train Front Cab
        ctx.fillStyle = "#e52b2b"; // Vibrant Train Red
        ctx.strokeStyle = "#991b1b";
        ctx.lineWidth = Math.max(2, 3 * proj.scale);

        // Rounded Front Nose
        ctx.beginPath();
        ctx.roundRect(proj.x - w * 0.48, proj.y - h, w * 0.96, h, [12 * proj.scale, 12 * proj.scale, 4, 4]);
        ctx.fill();
        ctx.stroke();

        // Train Roof Corrugated Ribs
        ctx.fillStyle = "#991b1b";
        ctx.fillRect(proj.x - w * 0.44, proj.y - h, w * 0.88, 14 * proj.scale);

        // Silver / White Accent Stripe
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(proj.x - w * 0.48, proj.y - h * 0.55, w * 0.96, 20 * proj.scale);

        // Windshield Glass with Reflection
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(proj.x - w * 0.38, proj.y - h * 0.88, w * 0.76, 38 * proj.scale);

        // Windshield Glint
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = Math.max(1, 2 * proj.scale);
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.32, proj.y - h * 0.84);
        ctx.lineTo(proj.x - w * 0.1, proj.y - h * 0.52);
        ctx.stroke();

        // Dual Glowing Headlights
        ctx.fillStyle = "#fef08a";
        ctx.shadowColor = "#fef08a";
        ctx.shadowBlur = 14 * proj.scale;
        ctx.beginPath();
        ctx.arc(proj.x - w * 0.32, proj.y - h * 0.28, 9 * proj.scale, 0, Math.PI * 2);
        ctx.arc(proj.x + w * 0.32, proj.y - h * 0.28, 9 * proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Front Cowcatcher Grille
        ctx.fillStyle = "#334155";
        ctx.fillRect(proj.x - w * 0.4, proj.y - 12 * proj.scale, w * 0.8, 10 * proj.scale);

      } else if (obs.type === "hurdle") {
        // Red and White Striped Track Hurdle (JUMP OVER)
        ctx.fillStyle = "#e52b2b";
        ctx.strokeStyle = "#7f1d1d";
        ctx.lineWidth = Math.max(1.5, 2.5 * proj.scale);

        // Barrier Board
        ctx.fillRect(proj.x - w * 0.46, proj.y - h, w * 0.92, h * 0.55);
        ctx.strokeRect(proj.x - w * 0.46, proj.y - h, w * 0.92, h * 0.55);

        // Alternating White Stripes
        ctx.fillStyle = "#ffffff";
        const sw = w * 0.16;
        ctx.fillRect(proj.x - w * 0.3, proj.y - h, sw, h * 0.55);
        ctx.fillRect(proj.x + w * 0.1, proj.y - h, sw, h * 0.55);

        // Steel Support Legs
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = Math.max(2, 3.5 * proj.scale);
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.38, proj.y - h * 0.4);
        ctx.lineTo(proj.x - w * 0.44, proj.y);
        ctx.moveTo(proj.x + w * 0.38, proj.y - h * 0.4);
        ctx.lineTo(proj.x + w * 0.44, proj.y);
        ctx.stroke();

      } else if (obs.type === "overhead_barrier") {
        // Overhead Yellow/Black Signal Arch (SLIDE UNDER)
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = Math.max(2, 4 * proj.scale);

        // Posts
        ctx.strokeRect(proj.x - w * 0.48, proj.y - h, 14 * proj.scale, h);
        ctx.strokeRect(proj.x + w * 0.48 - 14 * proj.scale, proj.y - h, 14 * proj.scale, h);

        // Overhead Signboard
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(proj.x - w * 0.48, proj.y - h, w * 0.96, 26 * proj.scale);

        // "SLIDE" Text
        ctx.fillStyle = "#facc15";
        ctx.font = `900 ${Math.max(9, Math.floor(13 * proj.scale))}px 'Orbitron', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("▼ SLIDE ▼", proj.x, proj.y - h + 18 * proj.scale);

        // Yellow/Black Hazard Striped Clearance Bar
        const barY = proj.y - h * 0.46;
        ctx.fillStyle = "#facc15";
        ctx.fillRect(proj.x - w * 0.48, barY, w * 0.96, 14 * proj.scale);

        ctx.fillStyle = "#000000";
        for (let bx = proj.x - w * 0.48; bx < proj.x + w * 0.48; bx += 18 * proj.scale) {
          ctx.beginPath();
          ctx.moveTo(bx, barY);
          ctx.lineTo(bx + 8 * proj.scale, barY);
          ctx.lineTo(bx + 14 * proj.scale, barY + 14 * proj.scale);
          ctx.lineTo(bx + 6 * proj.scale, barY + 14 * proj.scale);
          ctx.closePath();
          ctx.fill();
        }

      } else if (obs.type === "track_sign") {
        // Railway Signal Light Post
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = Math.max(2, 4 * proj.scale);
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x, proj.y - h);
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(proj.x - 14 * proj.scale, proj.y - h - 35 * proj.scale, 28 * proj.scale, 42 * proj.scale);

        // Blinking Red Signal
        ctx.fillStyle = "#ef4444";
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12 * proj.scale;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - h - 14 * proj.scale, 7 * proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    renderCoin(coin) {
      const proj = this.project(coin.x, coin.y, coin.z);
      if (proj.scale <= 0) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(proj.x, proj.y);

      const r = coin.radius * proj.scale;
      const spin = Math.cos(coin.rotation);

      // Gold Coin Glow
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 12 * proj.scale;

      // Outer Rim
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, Math.abs(r * spin)), r, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner Star Emblem
      if (Math.abs(spin) > 0.4) {
        ctx.fillStyle = "#ca8a04";
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(1, Math.abs(r * 0.7 * spin)), r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(6, Math.floor(10 * proj.scale))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", 0, 0);
      }

      ctx.restore();
    }

    renderParticle(p) {
      const proj = this.project(p.x, p.y, p.z);
      if (proj.scale <= 0) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(1, p.size * proj.scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- STYLIZED SUBWAY SURFERS CHARACTER (JAKE WITH BACKWARDS CAP & HOODIE) ---
    renderJakeRunner() {
      const skin = this.getChar();
      const proj = this.project(this.playerX, -this.playerY, this.playerZ);
      const groundProj = this.project(this.playerX, 0, this.playerZ);
      const ctx = this.ctx;

      ctx.save();

      // 1. Drop Shadow on Ground
      const shadowScale = Math.max(0.35, 1 - (this.playerY / 320));
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.ellipse(groundProj.x, groundProj.y - 2, 28 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(proj.x, proj.y);
      ctx.rotate(this.bankAngle);

      const s = 1.45; // Hero scale
      const cycle = this.runCycle;

      // Kinematic running angles
      let legAngleL = Math.sin(cycle) * 0.75;
      let legAngleR = -legAngleL;
      let armAngleL = -legAngleL * 0.9;
      let armAngleR = -armAngleL;
      let torsoBob = Math.sin(cycle * 2) * 3.5;
      let torsoAngle = 0.08;

      // JUMP POSE
      if (this.isJumping) {
        legAngleL = 0.65;
        legAngleR = 0.85;
        armAngleL = -0.8;
        armAngleR = -0.8;
        torsoBob = -6;
      }

      // SLIDE POSE
      if (this.isSliding) {
        legAngleL = 1.25;
        legAngleR = 1.15;
        armAngleL = 0.85;
        armAngleR = 0.85;
        torsoBob = 36;
        torsoAngle = -0.45;
      }

      // --- LEGS (JEANS & SNEAKERS) ---
      const hipY = -40 * s + torsoBob;

      // Left Leg
      ctx.save();
      ctx.translate(-8 * s, hipY);
      ctx.rotate(legAngleL);
      // Denim Thigh
      ctx.fillStyle = skin.jeansColor;
      ctx.fillRect(-5 * s, 0, 10 * s, 21 * s);
      // Shin & Cuffed Hem
      ctx.translate(0, 19 * s);
      const kneeL = this.isJumping ? -1.1 : Math.max(0, -legAngleL * 0.85);
      ctx.rotate(kneeL);
      ctx.fillStyle = skin.jeansColor;
      ctx.fillRect(-4.5 * s, 0, 9 * s, 20 * s);
      // Rolled Jean Cuff
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(-5 * s, 16 * s, 10 * s, 4 * s);
      // Chunky Skate Sneaker
      ctx.fillStyle = skin.shoesColor; // Red body
      ctx.fillRect(-5 * s, 19 * s, 12 * s, 8 * s);
      // White Toe Cap & Rubber Sole
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-5 * s, 24 * s, 12 * s, 4 * s);
      ctx.fillRect(4 * s, 19 * s, 4 * s, 7 * s);
      ctx.restore();

      // Right Leg
      ctx.save();
      ctx.translate(8 * s, hipY);
      ctx.rotate(legAngleR);
      // Denim Thigh
      ctx.fillStyle = skin.jeansColor;
      ctx.fillRect(-5 * s, 0, 10 * s, 21 * s);
      // Shin & Cuffed Hem
      ctx.translate(0, 19 * s);
      const kneeR = this.isJumping ? -1.3 : Math.max(0, -legAngleR * 0.85);
      ctx.rotate(kneeR);
      ctx.fillStyle = skin.jeansColor;
      ctx.fillRect(-4.5 * s, 0, 9 * s, 20 * s);
      // Rolled Jean Cuff
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(-5 * s, 16 * s, 10 * s, 4 * s);
      // Chunky Skate Sneaker
      ctx.fillStyle = skin.shoesColor;
      ctx.fillRect(-5 * s, 19 * s, 12 * s, 8 * s);
      // White Toe Cap & Rubber Sole
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-5 * s, 24 * s, 12 * s, 4 * s);
      ctx.fillRect(4 * s, 19 * s, 4 * s, 7 * s);
      ctx.restore();

      // --- TORSO, BACKPACK & ARMS ---
      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(torsoAngle);

      // Green Subway Backpack (Jake's spray can bag)
      ctx.fillStyle = skin.backpackColor;
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-14 * s, -28 * s, 28 * s, 24 * s, 6 * s);
      ctx.fill();
      ctx.stroke();

      // Spray Paint Can Top poking out
      ctx.fillStyle = "#e52b2b";
      ctx.fillRect(-8 * s, -33 * s, 6 * s, 6 * s);
      ctx.fillStyle = "#facc15";
      ctx.fillRect(2 * s, -33 * s, 6 * s, 6 * s);

      // Blue Denim Hoodie / Vest
      ctx.fillStyle = skin.vestColor;
      ctx.beginPath();
      ctx.moveTo(-14 * s, 0);
      ctx.lineTo(-17 * s, -31 * s);
      ctx.lineTo(17 * s, -31 * s);
      ctx.lineTo(14 * s, 0);
      ctx.closePath();
      ctx.fill();

      // White Tee Undershirt
      ctx.fillStyle = skin.shirtColor;
      ctx.fillRect(-6 * s, -28 * s, 12 * s, 24 * s);

      // --- ARMS ---
      // Left Arm
      ctx.save();
      ctx.translate(-16 * s, -29 * s);
      ctx.rotate(armAngleL);
      // White sleeve
      ctx.fillStyle = skin.shirtColor;
      ctx.fillRect(-4 * s, 0, 8 * s, 14 * s);
      // Forearm (Skin tone)
      ctx.translate(0, 13 * s);
      ctx.rotate(Math.max(0.2, armAngleL * 0.5));
      ctx.fillStyle = "#fbcfe8"; // Skin tone
      ctx.fillRect(-3.5 * s, 0, 7 * s, 14 * s);
      // Red Wristband & Hand
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(-4 * s, 8 * s, 8 * s, 4 * s);
      ctx.restore();

      // Right Arm
      ctx.save();
      ctx.translate(16 * s, -29 * s);
      ctx.rotate(armAngleR);
      ctx.fillStyle = skin.shirtColor;
      ctx.fillRect(-4 * s, 0, 8 * s, 14 * s);
      ctx.translate(0, 13 * s);
      ctx.rotate(Math.max(0.2, armAngleR * 0.5));
      ctx.fillStyle = "#fbcfe8";
      ctx.fillRect(-3.5 * s, 0, 7 * s, 14 * s);
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(-4 * s, 8 * s, 8 * s, 4 * s);
      ctx.restore();

      // --- HEAD WITH BACKWARDS CAP (JAKE'S TRADEMARK) ---
      ctx.translate(0, -32 * s);

      // Neck
      ctx.fillStyle = "#fbcfe8";
      ctx.fillRect(-4 * s, -5 * s, 8 * s, 6 * s);

      // Brown Hair visible around neck & temples
      ctx.fillStyle = skin.hairColor;
      ctx.beginPath();
      ctx.arc(0, -11 * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = "#fbcfe8";
      ctx.beginPath();
      ctx.arc(-11 * s, -11 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc(11 * s, -11 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // Backwards Baseball Cap (Red Cap Dome)
      ctx.fillStyle = skin.capColor;
      ctx.beginPath();
      ctx.arc(0, -13 * s, 11 * s, Math.PI, 0); // Upper dome
      ctx.closePath();
      ctx.fill();

      // Backwards Cap Visor extending backwards
      ctx.fillStyle = "#991b1b";
      ctx.beginPath();
      ctx.roundRect(-8 * s, -12 * s, 16 * s, 5 * s, 2 * s);
      ctx.fill();

      // White Cap Button on Top
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, -24 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // End torso

      // Hoverboard under feet (when boost is active)
      if (this.isOverdrive) {
        ctx.fillStyle = "#facc15";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-18 * s, 20 * s + torsoBob, 36 * s, 8 * s, 4 * s);
        ctx.fill();
        ctx.stroke();

        // Rainbow thruster jets
        for (let i = 0; i < 4; i++) {
          this.particles.push({
            x: this.playerX + (Math.random() - 0.5) * 20,
            y: 0,
            z: this.playerZ + 15,
            vx: (Math.random() - 0.5) * 50,
            vy: 30,
            vz: 400 + Math.random() * 200,
            life: 0.3,
            maxLife: 0.3,
            color: Math.random() > 0.5 ? "#f43f5e" : "#38bdf8",
            size: 5
          });
        }
      }

      ctx.restore();
    }

    renderFloatingTexts() {
      const ctx = this.ctx;
      for (const ft of this.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.font = `bold ${Math.floor(18 * ft.scale)}px 'Orbitron', sans-serif`;
        ctx.textAlign = "center";
        const proj = this.project(ft.x, 0, this.playerZ);
        ctx.fillText(ft.text, proj.x, proj.y + ft.y);
        ctx.restore();
      }
    }

    renderHoverboardVFX() {
      const ctx = this.ctx;
      ctx.save();
      const grad = ctx.createRadialGradient(
        this.width * 0.5, this.height * 0.5, this.width * 0.3,
        this.width * 0.5, this.height * 0.5, this.width * 0.7
      );
      grad.addColorStop(0, "transparent");
      grad.addColorStop(1, "rgba(250, 204, 21, 0.25)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // --- GARAGE / CHARACTERS MENU ---
    openGarage() {
      window.soundEngine.playClickSFX();
      document.getElementById("start-screen").classList.add("hidden");
      document.getElementById("garage-screen").classList.remove("hidden");
      this.renderGarageContent();
    }

    closeGarage() {
      window.soundEngine.playClickSFX();
      document.getElementById("garage-screen").classList.add("hidden");
      document.getElementById("start-screen").classList.remove("hidden");
      this.updateUI();
    }

    renderGarageContent() {
      document.getElementById("garage-credits").textContent = playerData.credits;

      // Characters
      const list = document.getElementById("garage-ships-list");
      list.innerHTML = "";
      CHARACTERS.forEach(char => {
        const isUnlocked = playerData.unlockedChars.includes(char.id);
        const isSelected = playerData.selectedChar === char.id;

        const card = document.createElement("div");
        card.className = `cyber-card ${isSelected ? "selected" : ""}`;
        card.innerHTML = `
          <div class="card-header">
            <span class="ship-name" style="color: ${char.capColor}">${char.name}</span>
            <span class="ship-badge">${isSelected ? "EQUIPPED" : isUnlocked ? "OWNED" : `${char.price} COINS`}</span>
          </div>
          <button class="cyber-btn sm ${isSelected ? "active" : ""}">
            ${isSelected ? "CURRENT" : isUnlocked ? "SELECT" : "UNLOCK"}
          </button>
        `;

        card.querySelector("button").addEventListener("click", () => {
          window.soundEngine.playClickSFX();
          if (isUnlocked) {
            playerData.selectedChar = char.id;
            savePlayerData();
            this.renderGarageContent();
          } else {
            if (playerData.credits >= char.price) {
              playerData.credits -= char.price;
              playerData.unlockedChars.push(char.id);
              playerData.selectedChar = char.id;
              savePlayerData();
              this.renderGarageContent();
            } else {
              alert("Collect more gold coins on the subway tracks!");
            }
          }
        });

        list.appendChild(card);
      });

      // Upgrades
      const upList = document.getElementById("garage-upgrades-list");
      upList.innerHTML = "";
      const upgrades = [
        { key: "magnet", name: "COIN MAGNET", desc: "Attracts all gold coins across railway tracks" },
        { key: "hoverboard", name: "HOVERBOARD ARMOR", desc: "Saves you from a crash without game over" },
        { key: "boost", name: "SUPER SNEAKERS", desc: "Increases jump height and slide speed" },
        { key: "multiplier", name: "2X MULTIPLIER", desc: "Doubles score rate on runs" }
      ];

      upgrades.forEach(u => {
        const lvl = playerData.upgrades[u.key] || 1;
        const maxLvl = 5;
        const cost = lvl * 150;
        const isMax = lvl >= maxLvl;

        const card = document.createElement("div");
        card.className = "upgrade-card";
        card.innerHTML = `
          <div class="upgrade-info">
            <span class="upgrade-title">${u.name} (LVL ${lvl}/${maxLvl})</span>
            <span class="upgrade-desc">${u.desc}</span>
            <div class="level-bars">
              ${Array.from({ length: maxLvl }).map((_, i) => `<span class="bar ${i < lvl ? "filled" : ""}"></span>`).join("")}
            </div>
          </div>
          <button class="cyber-btn sm ${isMax ? "disabled" : ""}" ${isMax ? "disabled" : ""}>
            ${isMax ? "MAX" : `UPGRADE (${cost} COINS)`}
          </button>
        `;

        if (!isMax) {
          card.querySelector("button").addEventListener("click", () => {
            window.soundEngine.playClickSFX();
            if (playerData.credits >= cost) {
              playerData.credits -= cost;
              playerData.upgrades[u.key] = lvl + 1;
              savePlayerData();
              this.renderGarageContent();
            } else {
              alert("Collect more coins to upgrade!");
            }
          });
        }

        upList.appendChild(card);
      });
    }

    updateUI() {
      const topScore = document.getElementById("menu-high-score");
      if (topScore) topScore.textContent = playerData.highScore.toLocaleString();
      const menuCredits = document.getElementById("menu-credits");
      if (menuCredits) menuCredits.textContent = playerData.credits;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.game = new SubwayGame();
  });
})();
