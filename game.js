/**
 * Cyberpunk Human Parkour Runner - 60FPS 3D Kinetic Character & Obstacle Engine
 */

(function () {
  'use strict';

  // --- CONFIGURATION ---
  const FOV = 320;
  const CAMERA_HEIGHT = 180;
  const ROAD_WIDTH = 1000;
  const LANES = [-280, 0, 280]; // Left, Center, Right

  // Sector Themes
  const SECTORS = [
    {
      name: "DOWNTOWN METROPOLIS",
      skyTop: "#08011a",
      skyBottom: "#1f0938",
      roadColor: "#14151b",
      gridColor: "#00f3ff",
      accentColor: "#ff007f",
      sunTop: "#ffe600",
      sunBottom: "#ff007f",
      fogColor: "#140529"
    },
    {
      name: "NEON INDUSTRIAL DOCKS",
      skyTop: "#02120e",
      skyBottom: "#062b23",
      roadColor: "#111716",
      gridColor: "#00ff88",
      accentColor: "#00f3ff",
      sunTop: "#aaff00",
      sunBottom: "#00ff88",
      fogColor: "#041c16"
    },
    {
      name: "SUNSET HIGHWAY",
      skyTop: "#17021b",
      skyBottom: "#3b092b",
      roadColor: "#1c141d",
      gridColor: "#ff5500",
      accentColor: "#ffe600",
      sunTop: "#ffea00",
      sunBottom: "#ff0055",
      fogColor: "#29041a"
    }
  ];

  // Runner Outfits
  const RUNNER_SKINS = [
    {
      id: "cybersuit",
      name: "NEON SPRINTER",
      jacketColor: "#00f3ff",
      pantsColor: "#121420",
      shoesColor: "#00f3ff",
      glowColor: "#00f3ff",
      price: 0
    },
    {
      id: "crimson",
      name: "CRIMSON PHANTOM",
      jacketColor: "#ff0055",
      pantsColor: "#1a0814",
      shoesColor: "#ff0055",
      glowColor: "#ff0055",
      price: 300
    },
    {
      id: "matrix",
      name: "MATRIX GHOST",
      jacketColor: "#00ff66",
      pantsColor: "#081a0e",
      shoesColor: "#00ff66",
      glowColor: "#00ff66",
      price: 700
    },
    {
      id: "overlord",
      name: "TITAN RUNNER",
      jacketColor: "#ffaa00",
      pantsColor: "#221a08",
      shoesColor: "#ffe600",
      glowColor: "#ffe600",
      price: 1200
    }
  ];

  // Storage
  function loadPlayerData() {
    const defaults = {
      credits: 0,
      highScore: 0,
      totalRuns: 0,
      selectedSkin: "cybersuit",
      unlockedSkins: ["cybersuit"],
      upgrades: {
        magnet: 1,
        shield: 1,
        overdrive: 1,
        multiplier: 1
      }
    };
    try {
      const saved = localStorage.getItem("neon_parkour_player");
      return saved ? Object.assign(defaults, JSON.parse(saved)) : defaults;
    } catch (e) {
      return defaults;
    }
  }

  function savePlayerData() {
    try {
      localStorage.setItem("neon_parkour_player", JSON.stringify(playerData));
    } catch (e) {
      console.warn(e);
    }
  }

  const playerData = loadPlayerData();

  // --- GAME ENGINE ---
  class Game {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");

      this.isRunning = false;
      this.isPaused = false;
      this.gameOver = false;

      this.width = 800;
      this.height = 1200;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.horizonY = this.height * 0.45;

      // Camera
      this.cameraTilt = 0;
      this.shakeIntensity = 0;
      this.shakeDuration = 0;

      // Human Runner State
      this.playerX = 0;
      this.targetPlayerX = 0;
      this.playerY = 0; // Vertical height above road (jumping)
      this.playerZ = 90;
      this.verticalVelocity = 0;
      this.gravity = 2400;
      this.isJumping = false;
      this.isSliding = false;
      this.slideTimer = 0;
      this.slideDuration = 0.75;
      
      // Biomechanical Animation Cycles
      this.runCycle = 0;
      this.stepCycle = 0;
      this.speed = 0;
      this.baseSpeed = 700;
      this.maxSpeed = 1500;
      this.bankAngle = 0;

      // Gameplay Stats
      this.score = 0;
      this.displayScore = 0;
      this.distance = 0;
      this.creditsThisRun = 0;
      this.nearMisses = 0;
      this.multiplier = 1;
      this.multiplierTimer = 0;
      this.shields = 1;
      this.maxShields = 1;

      // Overdrive (Hyper Sprint)
      this.overdriveEnergy = 0;
      this.maxOverdriveEnergy = 100;
      this.isOverdrive = false;
      this.overdriveTimer = 0;

      // World Objects
      this.obstacles = [];
      this.pickups = [];
      this.particles = [];
      this.floatingTexts = [];
      this.streetLamps = [];
      this.roadZOffset = 0;

      // Sector / City Theme
      this.currentSectorIndex = 0;
      this.sectorDistance = 0;
      this.sectorLength = 3500;

      // Timers & Spawning
      this.lastTime = 0;
      this.spawnTimer = 0;
      this.coinSpawnTimer = 0;

      // Input State
      this.keys = { left: false, right: false, up: false, down: false, boost: false };
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchStartTime = 0;

      this.initDisplay();
      this.initEvents();
      this.initStreetLamps();
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
        this.horizonY = this.height * 0.44;
      };
      window.addEventListener("resize", resize);
      resize();
    }

    initStreetLamps() {
      this.streetLamps = [];
      for (let z = 100; z < 1400; z += 200) {
        this.streetLamps.push({ z });
      }
    }

    initEvents() {
      // Keyboard Controls
      window.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.steerLane(-1);
        if (["ArrowRight", "KeyD"].includes(e.code)) this.steerLane(1);
        if (["ArrowUp", "KeyW"].includes(e.code)) this.triggerJump();
        if (["ArrowDown", "KeyS"].includes(e.code)) this.triggerSlide();
        if (["Space"].includes(e.code)) this.activateOverdrive();
        if (["KeyP", "Escape"].includes(e.code)) this.togglePause();
      });

      // Touch & Swipe Controls (High precision mobile gesture recognition)
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

        // Swipe Gesture Detection
        if (Math.max(absX, absY) > 25 && deltaTime < 400) {
          if (absX > absY) {
            // Horizontal swipe (Left / Right lane change)
            if (deltaX > 0) this.steerLane(1);
            else this.steerLane(-1);
          } else {
            // Vertical swipe (Jump / Slide)
            if (deltaY < 0) this.triggerJump();
            else this.triggerSlide();
          }
        }
      }, { passive: true });

      // Virtual Mobile Buttons
      const btnLeft = document.getElementById("btn-left");
      const btnRight = document.getElementById("btn-right");
      const btnJump = document.getElementById("btn-jump");
      const btnSlide = document.getElementById("btn-slide");
      const btnBoost = document.getElementById("btn-boost");

      if (btnLeft) btnLeft.addEventListener("click", () => this.steerLane(-1));
      if (btnRight) btnRight.addEventListener("click", () => this.steerLane(1));
      if (btnJump) btnJump.addEventListener("click", () => this.triggerJump());
      if (btnSlide) btnSlide.addEventListener("click", () => this.triggerSlide());
      if (btnBoost) btnBoost.addEventListener("click", () => this.activateOverdrive());

      // Screen Buttons
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

    steerLane(dir) {
      if (!this.isRunning || this.gameOver || this.isPaused) return;
      window.soundEngine.resumeContext();

      // Find closest lane and shift
      const currentTarget = this.targetPlayerX;
      let targetIndex = 1; // Center default
      if (currentTarget < -140) targetIndex = 0;
      else if (currentTarget > 140) targetIndex = 2;

      targetIndex = Math.max(0, Math.min(2, targetIndex + dir));
      this.targetPlayerX = LANES[targetIndex];
    }

    triggerJump() {
      if (!this.isRunning || this.gameOver || this.isPaused) return;
      if (this.isJumping) return;

      this.isJumping = true;
      this.isSliding = false; // Cancel slide on jump
      this.verticalVelocity = 920; // Upward jump velocity

      window.soundEngine.playJumpSFX();
      this.addFootstepPuff(this.playerX, 0, 8);
    }

    triggerSlide() {
      if (!this.isRunning || this.gameOver || this.isPaused) return;

      if (this.isJumping) {
        // Fast drop if in mid-air
        this.verticalVelocity = -1200;
      }

      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      window.soundEngine.playSlideSFX();

      // Ground friction sparks
      for (let i = 0; i < 15; i++) {
        this.particles.push({
          x: this.playerX + (Math.random() - 0.5) * 30,
          y: -5,
          z: this.playerZ + Math.random() * 20,
          vx: (Math.random() - 0.5) * 150,
          vy: Math.random() * -60,
          vz: 300 + Math.random() * 200,
          life: 0.35,
          maxLife: 0.35,
          color: "#ffe600",
          size: 4
        });
      }
    }

    activateOverdrive() {
      if (this.overdriveEnergy < this.maxOverdriveEnergy || this.isOverdrive || this.gameOver) return;
      this.isOverdrive = true;
      this.overdriveTimer = 6.0;
      this.overdriveEnergy = 0;

      window.soundEngine.playCoinSFX(3);
      this.triggerScreenShake(12, 0.4);
      this.addFloatingText("HYPER SPEED!", 0, -80, "#ffe600", 2.2);
    }

    getSkin() {
      return RUNNER_SKINS.find(s => s.id === playerData.selectedSkin) || RUNNER_SKINS[0];
    }

    startGame() {
      window.soundEngine.resumeContext();
      window.soundEngine.startMusic();
      window.soundEngine.playClickSFX();

      this.isRunning = true;
      this.isPaused = false;
      this.gameOver = false;

      this.playerX = 0;
      this.targetPlayerX = 0;
      this.playerY = 0;
      this.verticalVelocity = 0;
      this.isJumping = false;
      this.isSliding = false;
      this.slideTimer = 0;
      this.runCycle = 0;
      this.stepCycle = 0;

      this.speed = this.baseSpeed;
      this.score = 0;
      this.displayScore = 0;
      this.distance = 0;
      this.creditsThisRun = 0;
      this.nearMisses = 0;
      this.multiplier = 1;
      this.multiplierTimer = 0;

      const shieldUpgrade = playerData.upgrades.shield || 1;
      this.maxShields = 1 + Math.floor((shieldUpgrade - 1) / 2);
      this.shields = this.maxShields;

      this.overdriveEnergy = 0;
      this.isOverdrive = false;
      this.overdriveTimer = 0;

      this.obstacles = [];
      this.pickups = [];
      this.particles = [];
      this.floatingTexts = [];
      this.currentSectorIndex = 0;
      this.sectorDistance = 0;

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

    addFloatingText(text, x, y, color = "#00f3ff", scale = 1.0) {
      this.floatingTexts.push({ text, x, y, color, scale, alpha: 1.0, life: 1.2 });
    }

    addFootstepPuff(x, y, count = 5) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y,
          z: this.playerZ + Math.random() * 10,
          vx: (Math.random() - 0.5) * 40,
          vy: -Math.random() * 25,
          vz: 250 + Math.random() * 100,
          life: 0.3,
          maxLife: 0.3,
          color: "rgba(255, 255, 255, 0.4)",
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
      // 1. Horizontal Smooth Steering
      const lerpSpeed = 16 * dt;
      const prevX = this.playerX;
      this.playerX += (this.targetPlayerX - this.playerX) * lerpSpeed;
      this.bankAngle = Math.max(-0.25, Math.min(0.25, (this.playerX - prevX) / 40));

      // 2. Jumping Physics
      if (this.isJumping) {
        this.playerY += this.verticalVelocity * dt;
        this.verticalVelocity -= this.gravity * dt;

        if (this.playerY <= 0) {
          this.playerY = 0;
          this.isJumping = false;
          this.verticalVelocity = 0;
          this.addFootstepPuff(this.playerX, 0, 8);
          window.soundEngine.playFootstep();
        }
      }

      // 3. Sliding Timer
      if (this.isSliding) {
        this.slideTimer -= dt;
        if (this.slideTimer <= 0) {
          this.isSliding = false;
        }
      }

      // 4. Running Kinematics & Footstep Audio Sync
      if (!this.isJumping && !this.isSliding) {
        const runFreq = (this.speed / 700) * 14;
        const prevCycle = this.runCycle;
        this.runCycle += runFreq * dt;

        // Detect foot strike on ground
        if (Math.sin(prevCycle) < 0 && Math.sin(this.runCycle) >= 0) {
          window.soundEngine.playFootstep();
          this.addFootstepPuff(this.playerX + 10, 0, 3);
        } else if (Math.sin(prevCycle) >= 0 && Math.sin(this.runCycle) < 0) {
          window.soundEngine.playFootstep();
          this.addFootstepPuff(this.playerX - 10, 0, 3);
        }
      }

      // 5. Speed & Distance
      const targetSpeed = this.isOverdrive ? 1800 : Math.min(this.maxSpeed, this.baseSpeed + this.distance * 0.08);
      this.speed += (targetSpeed - this.speed) * 3 * dt;
      this.distance += this.speed * dt * 0.1;
      this.sectorDistance += this.speed * dt * 0.1;

      if (this.sectorDistance >= this.sectorLength) {
        this.sectorDistance = 0;
        this.currentSectorIndex = (this.currentSectorIndex + 1) % SECTORS.length;
        this.addFloatingText(SECTORS[this.currentSectorIndex].name, 0, -80, SECTORS[this.currentSectorIndex].accentColor, 1.8);
      }

      // Score
      this.score += (this.speed * 0.1) * this.multiplier * dt;
      this.displayScore += (this.score - this.displayScore) * 10 * dt;

      // Road Scroll
      this.roadZOffset = (this.roadZOffset + this.speed * dt) % 120;

      // Street Lamps
      for (const lamp of this.streetLamps) {
        lamp.z -= this.speed * dt;
        if (lamp.z < 20) lamp.z += 1200;
      }

      // Decay screen shake
      if (this.shakeDuration > 0) this.shakeDuration -= dt;
      else this.shakeIntensity = 0;

      // Overdrive decay
      if (this.isOverdrive) {
        this.overdriveTimer -= dt;
        if (this.overdriveTimer <= 0) {
          this.isOverdrive = false;
        }
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
      this.updatePickups(dt);
      this.updateParticles(dt);
      this.updateFloatingTexts(dt);
      this.updateHUD();
    }

    updateSpawners(dt) {
      this.spawnTimer -= dt;
      const interval = Math.max(0.65, 1.35 - (this.distance * 0.00008));
      if (this.spawnTimer <= 0) {
        this.spawnTimer = interval + Math.random() * 0.3;
        this.spawnObstacle();
      }

      this.coinSpawnTimer -= dt;
      if (this.coinSpawnTimer <= 0) {
        this.coinSpawnTimer = 0.5 + Math.random() * 0.4;
        this.spawnCoins();
      }
    }

    spawnObstacle() {
      // 4 Realistic Blockers:
      // 1. "concrete": Heavy concrete road barrier (Dodge left/right)
      // 2. "laser_gantry": High overhead laser gantry (SLIDE UNDER)
      // 3. "hurdle": Low road construction barricade (JUMP OVER)
      // 4. "crates": Stacked hazard crates (Dodge)
      const types = ["concrete", "laser_gantry", "hurdle", "crates"];
      const type = types[Math.floor(Math.random() * types.length)];
      const lane = LANES[Math.floor(Math.random() * LANES.length)];
      const spawnZ = 1300;

      if (type === "concrete") {
        this.obstacles.push({
          type: "concrete",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 170,
          height: 90,
          hitRadius: 80,
          passed: false
        });
      } else if (type === "laser_gantry") {
        this.obstacles.push({
          type: "laser_gantry",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 220,
          height: 160,
          hitRadius: 95,
          passed: false
        });
      } else if (type === "hurdle") {
        this.obstacles.push({
          type: "hurdle",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 180,
          height: 50,
          hitRadius: 75,
          passed: false
        });
      } else if (type === "crates") {
        this.obstacles.push({
          type: "crates",
          x: lane,
          y: 0,
          z: spawnZ,
          width: 160,
          height: 120,
          hitRadius: 80,
          passed: false
        });
      }
    }

    spawnCoins() {
      const lane = LANES[Math.floor(Math.random() * LANES.length)];
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.pickups.push({
          type: "coin",
          x: lane,
          y: -30,
          z: 1300 + (i * 90),
          radius: 26,
          color: "#ffe600",
          rotation: 0
        });
      }
    }

    updateObstacles(dt) {
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.z -= this.speed * dt;

        // Collision Check
        const zDist = obs.z - this.playerZ;
        const xDist = Math.abs(obs.x - this.playerX);

        if (!obs.passed && zDist <= 25 && zDist >= -40) {
          if (xDist < obs.hitRadius) {
            // Check Action Avoidance (Jump / Slide)
            let avoided = false;

            if (obs.type === "hurdle" && this.playerY > 40) {
              avoided = true; // Clean jump!
              this.score += 200 * this.multiplier;
              this.addFloatingText("VAULTED! +200", this.playerX, -80, "#00ff88", 1.4);
            } else if (obs.type === "laser_gantry" && this.isSliding) {
              avoided = true; // Clean slide!
              this.score += 300 * this.multiplier;
              this.addFloatingText("POWER SLIDE! +300", this.playerX, -50, "#ffe600", 1.5);
            }

            if (!avoided) {
              obs.passed = true;
              this.handleCollision(obs);
            }
          } else if (xDist < obs.hitRadius + 95) {
            // Near Miss
            obs.passed = true;
            this.handleNearMiss(obs);
          }
        }

        if (obs.z < -100) this.obstacles.splice(i, 1);
      }
    }

    updatePickups(dt) {
      const magnetLevel = playerData.upgrades.magnet || 1;
      const magnetRadius = 200 + (magnetLevel * 50);

      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        p.z -= this.speed * dt;
        p.rotation += 4 * dt;

        // Magnet attraction
        const dx = this.playerX - p.x;
        const dz = this.playerZ - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < magnetRadius && p.z > this.playerZ) {
          const pull = (1 - dist / magnetRadius) * 2400 * dt;
          p.x += (dx / dist) * pull;
        }

        // Collection
        if (Math.abs(p.z - this.playerZ) < 50 && Math.abs(p.x - this.playerX) < 65) {
          this.creditsThisRun++;
          playerData.credits++;
          savePlayerData();

          this.score += 100 * this.multiplier;
          this.overdriveEnergy = Math.min(this.maxOverdriveEnergy, this.overdriveEnergy + 5);

          window.soundEngine.playCoinSFX(this.multiplier);
          this.addFloatingText("+1 CR", p.x, -50, "#ffe600", 1.1);

          this.pickups.splice(i, 1);
          continue;
        }

        if (p.z < -60) this.pickups.splice(i, 1);
      }
    }

    handleNearMiss(obs) {
      this.nearMisses++;
      this.score += 250 * this.multiplier;
      this.overdriveEnergy = Math.min(this.maxOverdriveEnergy, this.overdriveEnergy + 10);

      if (this.multiplier < 8) {
        this.multiplier++;
        this.multiplierTimer = 4.0;
      }

      this.addFloatingText(`CLOSE CALL! x${this.multiplier}`, this.playerX, -80, "#ff007f", 1.5);
      this.triggerScreenShake(5, 0.15);
    }

    handleCollision(obs) {
      if (this.isOverdrive) {
        // Smash through in hyper speed!
        this.score += 500 * this.multiplier;
        this.addFloatingText("SMASH! +500", obs.x, -70, "#ffe600", 1.8);
        window.soundEngine.playCrashSFX();
        this.triggerScreenShake(14, 0.3);

        for (let i = 0; i < 20; i++) {
          this.particles.push({
            x: obs.x,
            y: 0,
            z: obs.z,
            vx: (Math.random() - 0.5) * 600,
            vy: -Math.random() * 400,
            vz: (Math.random() - 0.5) * 600,
            life: 0.6,
            maxLife: 0.6,
            color: "#ffaa00",
            size: 6
          });
        }
        return;
      }

      // Normal hit
      this.shields--;
      this.multiplier = 1;

      if (this.shields > 0) {
        this.triggerScreenShake(12, 0.3);
        window.soundEngine.playCrashSFX();
        this.addFloatingText("SHIELD DAMAGED!", this.playerX, -80, "#ff0055", 1.6);
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
        document.getElementById("final-credits").textContent = `+${this.creditsThisRun}`;
        document.getElementById("final-nearmiss").textContent = `${this.nearMisses}`;

        const badge = document.getElementById("new-record-badge");
        if (badge) badge.style.display = isNew ? "inline-block" : "none";
      }, 600);
    }

    shareScore() {
      const text = `🏃 I ran ${Math.floor(this.distance)}m in Neon Velocity with a score of ${Math.floor(this.score).toLocaleString()}! Can you beat my record? Play now:`;
      if (navigator.share) {
        navigator.share({ title: "Neon Velocity", text, url: window.location.href }).catch(() => {});
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
        ft.alpha = ft.life / 1.2;
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
        btnBoost.textContent = this.isOverdrive ? "HYPER!" : "BOOST";
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
      const sector = SECTORS[this.currentSectorIndex];

      let shakeX = 0, shakeY = 0;
      if (this.shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 1. Sky & Glowing Retrosun
      this.renderSky(sector);

      // 2. City Skyline with Lit Windows & Billboards
      this.renderCitySkyline(sector);

      // 3. Realistic Asphalt Highway & Lane Markings
      this.renderHighway(sector);

      // 4. Flanking Street Lamp Cones
      this.renderStreetLamps(sector);

      // 5. World Objects (Obstacles, Coins, Particles)
      this.renderWorldEntities(sector);

      // 6. Real Kinematic Human Runner
      this.renderHumanRunner();

      // 7. Floating UI Texts
      this.renderFloatingTexts();

      // 8. Overdrive Speed Warp FX
      if (this.isOverdrive) {
        this.renderOverdriveVFX();
      }

      ctx.restore();
    }

    renderSky(sector) {
      const ctx = this.ctx;
      const grad = ctx.createLinearGradient(0, 0, 0, this.horizonY);
      grad.addColorStop(0, sector.skyTop);
      grad.addColorStop(1, sector.skyBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.horizonY);

      // Glowing Cyber Sun
      const sunR = Math.min(this.width * 0.18, 80);
      const sunX = this.width * 0.5;
      const sunY = this.horizonY - sunR * 0.45;

      const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      sunGrad.addColorStop(0, sector.sunTop);
      sunGrad.addColorStop(0.7, sector.sunBottom);
      sunGrad.addColorStop(1, "transparent");

      ctx.save();
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();

      // Synthwave horizontal slats
      ctx.fillStyle = sector.skyBottom;
      for (let i = 0; i < 5; i++) {
        const sy = sunY + (i / 5) * sunR;
        ctx.fillRect(sunX - sunR - 5, sy, (sunR + 5) * 2, (i + 1) * 2.5);
      }
      ctx.restore();
    }

    renderCitySkyline(sector) {
      const ctx = this.ctx;
      ctx.save();
      const horizon = this.horizonY;
      const parallax = -this.playerX * 0.04;

      const buildingW = 40;
      const total = Math.ceil(this.width / buildingW) + 4;

      ctx.fillStyle = "#090414";
      for (let i = -2; i < total; i++) {
        const bx = i * buildingW + (parallax % buildingW);
        const seed = Math.sin(i * 43758.5453);
        const bh = 40 + Math.abs(seed) * 120;

        ctx.fillRect(bx, horizon - bh, buildingW - 2, bh);

        // Lit Windows
        if (Math.abs(seed) > 0.3) {
          ctx.fillStyle = sector.gridColor;
          ctx.globalAlpha = 0.6;
          for (let wy = horizon - bh + 15; wy < horizon - 10; wy += 14) {
            ctx.fillRect(bx + 6, wy, 4, 6);
            ctx.fillRect(bx + 18, wy, 4, 6);
          }
          ctx.fillStyle = "#090414";
          ctx.globalAlpha = 1.0;
        }

        // Antenna with flashing beacon
        if (i % 3 === 0) {
          ctx.strokeStyle = "#ff0055";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + buildingW * 0.5, horizon - bh);
          ctx.lineTo(bx + buildingW * 0.5, horizon - bh - 20);
          ctx.stroke();

          ctx.fillStyle = "#ff0055";
          ctx.beginPath();
          ctx.arc(bx + buildingW * 0.5, horizon - bh - 20, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    renderHighway(sector) {
      const ctx = this.ctx;
      ctx.save();

      // Dark asphalt surface
      const roadGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.height);
      roadGrad.addColorStop(0, "#08090d");
      roadGrad.addColorStop(1, sector.roadColor);
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, this.horizonY, this.width, this.height - this.horizonY);

      // Curbs & Highway Guardrails
      const maxZ = 1200;
      const pLeftNear = this.project(-ROAD_WIDTH * 0.5, 0, 20);
      const pLeftFar = this.project(-ROAD_WIDTH * 0.5, 0, maxZ);
      const pRightNear = this.project(ROAD_WIDTH * 0.5, 0, 20);
      const pRightFar = this.project(ROAD_WIDTH * 0.5, 0, maxZ);

      // Neon Guardrail glow
      ctx.strokeStyle = sector.accentColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = sector.accentColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(pLeftNear.x, pLeftNear.y);
      ctx.lineTo(pLeftFar.x, pLeftFar.y);
      ctx.moveTo(pRightNear.x, pRightNear.y);
      ctx.lineTo(pRightFar.x, pRightFar.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dashed Lane Dividers (Realistic 3 lanes)
      const dividers = [-ROAD_WIDTH * 0.17, ROAD_WIDTH * 0.17];
      ctx.lineWidth = 2.5;

      for (const divX of dividers) {
        for (let z = (this.roadZOffset % 80); z < maxZ; z += 80) {
          const p1 = this.project(divX, 0, z);
          const p2 = this.project(divX, 0, z + 35);
          const alpha = Math.max(0, 1 - (z / maxZ));

          ctx.strokeStyle = "#ffffff";
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    renderStreetLamps(sector) {
      const ctx = this.ctx;
      ctx.save();

      for (const lamp of this.streetLamps) {
        const sides = [-ROAD_WIDTH * 0.55, ROAD_WIDTH * 0.55];
        for (const sideX of sides) {
          const base = this.project(sideX, 0, lamp.z);
          const top = this.project(sideX, -160, lamp.z);
          if (base.scale <= 0) continue;

          // Lamp Post
          ctx.strokeStyle = "#444a59";
          ctx.lineWidth = Math.max(2, 3 * base.scale);
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();

          // Glowing Lamp Head
          ctx.fillStyle = sector.gridColor;
          ctx.shadowColor = sector.gridColor;
          ctx.shadowBlur = 12 * base.scale;
          ctx.beginPath();
          ctx.arc(top.x, top.y, 4 * base.scale, 0, Math.PI * 2);
          ctx.fill();

          // Volumetric Light Cone on Road
          ctx.fillStyle = "rgba(0, 243, 255, 0.05)";
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(base.x - 40 * base.scale, base.y);
          ctx.lineTo(base.x + 40 * base.scale, base.y);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.restore();
    }

    renderWorldEntities(sector) {
      const entities = [];
      for (const obs of this.obstacles) entities.push({ type: "obs", data: obs, z: obs.z });
      for (const coin of this.pickups) entities.push({ type: "coin", data: coin, z: coin.z });
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

      if (obs.type === "concrete") {
        // 3D Concrete Jersey Barrier with Hazard Stripes
        ctx.fillStyle = "#2c2d36"; // Concrete grey
        ctx.strokeStyle = "#15161c";
        ctx.lineWidth = Math.max(1.5, 2 * proj.scale);

        // Trapezoidal 3D barrier
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.45, proj.y);
        ctx.lineTo(proj.x - w * 0.35, proj.y - h);
        ctx.lineTo(proj.x + w * 0.35, proj.y - h);
        ctx.lineTo(proj.x + w * 0.45, proj.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Diagonal Yellow/Black Hazard Stripes
        ctx.save();
        ctx.clip();
        ctx.fillStyle = "#ffe600";
        const stripeW = 18 * proj.scale;
        for (let sx = proj.x - w; sx < proj.x + w; sx += stripeW * 2) {
          ctx.beginPath();
          ctx.moveTo(sx, proj.y);
          ctx.lineTo(sx + stripeW, proj.y);
          ctx.lineTo(sx + stripeW + 15 * proj.scale, proj.y - h);
          ctx.lineTo(sx + 15 * proj.scale, proj.y - h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Amber Hazard Strobe on Top
        ctx.fillStyle = "#ff9900";
        ctx.shadowColor = "#ff9900";
        ctx.shadowBlur = 10 * proj.scale;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - h - 6 * proj.scale, 5 * proj.scale, 0, Math.PI * 2);
        ctx.fill();

      } else if (obs.type === "laser_gantry") {
        // High Overhead Laser Gantry (Must SLIDE under)
        ctx.strokeStyle = "#5a6275";
        ctx.lineWidth = Math.max(2, 4 * proj.scale);

        // Left & Right steel pillars
        ctx.strokeRect(proj.x - w * 0.5, proj.y - h, 14 * proj.scale, h);
        ctx.strokeRect(proj.x + w * 0.5 - 14 * proj.scale, proj.y - h, 14 * proj.scale, h);

        // Overhead truss
        ctx.fillStyle = "#1e222d";
        ctx.fillRect(proj.x - w * 0.5, proj.y - h, w, 22 * proj.scale);
        ctx.strokeRect(proj.x - w * 0.5, proj.y - h, w, 22 * proj.scale);

        // "SLIDE" Warning Sign
        ctx.fillStyle = "#ff0055";
        ctx.font = `bold ${Math.max(8, Math.floor(11 * proj.scale))}px 'Orbitron', sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("▼ SLIDE ▼", proj.x, proj.y - h + 15 * proj.scale);

        // High Electric Hazard Laser Beam (at runner chest height)
        const beamY = proj.y - h * 0.42;
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = Math.max(3, 5 * proj.scale);
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 15 * proj.scale;
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.48, beamY);
        ctx.lineTo(proj.x + w * 0.48, beamY);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, 2 * proj.scale);
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.48, beamY);
        ctx.lineTo(proj.x + w * 0.48, beamY);
        ctx.stroke();

      } else if (obs.type === "hurdle") {
        // Low Construction Sawhorse Hurdle (Must JUMP over)
        ctx.fillStyle = "#ff5500";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1.5, 2 * proj.scale);

        // Horizontal hurdle board
        ctx.fillRect(proj.x - w * 0.45, proj.y - h, w * 0.9, h * 0.55);
        ctx.strokeRect(proj.x - w * 0.45, proj.y - h, w * 0.9, h * 0.55);

        // White alternating stripes
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(proj.x - w * 0.25, proj.y - h, w * 0.15, h * 0.55);
        ctx.fillRect(proj.x + w * 0.1, proj.y - h, w * 0.15, h * 0.55);

        // Legs
        ctx.strokeStyle = "#222";
        ctx.lineWidth = Math.max(2, 3 * proj.scale);
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.4, proj.y - h * 0.4);
        ctx.lineTo(proj.x - w * 0.48, proj.y);
        ctx.moveTo(proj.x + w * 0.4, proj.y - h * 0.4);
        ctx.lineTo(proj.x + w * 0.48, proj.y);
        ctx.stroke();

      } else if (obs.type === "crates") {
        // Heavy Industrial Cargo Box
        ctx.fillStyle = "#1e283b";
        ctx.strokeStyle = "#00f3ff";
        ctx.lineWidth = Math.max(1.5, 2.5 * proj.scale);

        ctx.fillRect(proj.x - w * 0.4, proj.y - h, w * 0.8, h);
        ctx.strokeRect(proj.x - w * 0.4, proj.y - h, w * 0.8, h);

        // Inner bracing
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.4, proj.y - h);
        ctx.lineTo(proj.x + w * 0.4, proj.y);
        ctx.moveTo(proj.x + w * 0.4, proj.y - h);
        ctx.lineTo(proj.x - w * 0.4, proj.y);
        ctx.stroke();
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
      const spinScale = Math.cos(coin.rotation); // 3D rotating coin effect

      ctx.shadowColor = coin.color;
      ctx.shadowBlur = 10 * proj.scale;

      ctx.fillStyle = "#ffe600";
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, Math.abs(r * spinScale)), r, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, 2 * proj.scale);
      ctx.stroke();

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

    // --- REAL-TYPE KINEMATIC HUMAN RUNNER RENDERING ---
    renderHumanRunner() {
      const skin = this.getSkin();
      const proj = this.project(this.playerX, -this.playerY, this.playerZ);
      const groundProj = this.project(this.playerX, 0, this.playerZ);
      const ctx = this.ctx;

      ctx.save();

      // 1. Soft Dynamic Drop Shadow on Road
      const shadowScale = Math.max(0.3, 1 - (this.playerY / 300));
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.ellipse(groundProj.x, groundProj.y - 2, 28 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(proj.x, proj.y);
      ctx.rotate(this.bankAngle); // Lean into turns

      const s = 1.35; // Character scale
      const cycle = this.runCycle;

      // Kinematic Body Part Angles based on running cycle
      let legAngleL = Math.sin(cycle) * 0.7;
      let legAngleR = -legAngleL;
      let armAngleL = -legAngleL * 0.85; // Arms swing opposite to legs
      let armAngleR = -armAngleL;
      let torsoBob = Math.sin(cycle * 2) * 3; // Natural vertical bounce
      let torsoAngle = 0.08; // Slight forward athletic lean

      // JUMPING POSE
      if (this.isJumping) {
        legAngleL = 0.6; // Legs tucked up
        legAngleR = 0.8;
        armAngleL = -0.7; // Arms up
        armAngleR = -0.7;
        torsoBob = -5;
      }

      // SLIDING POSE
      if (this.isSliding) {
        legAngleL = 1.2; // Legs extended forward
        legAngleR = 1.1;
        armAngleL = 0.9;
        armAngleR = 0.9;
        torsoBob = 35; // Dropped low to ground
        torsoAngle = -0.5; // Leaning back on slide
      }

      const mainGlow = this.isOverdrive ? "#ffe600" : skin.glowColor;
      ctx.shadowColor = mainGlow;
      ctx.shadowBlur = this.isOverdrive ? 25 : 12;

      // --- LEGS (Drawn behind torso) ---
      const hipY = -38 * s + torsoBob;

      // Left Leg
      ctx.save();
      ctx.translate(-7 * s, hipY);
      ctx.rotate(legAngleL);
      // Thigh
      ctx.fillStyle = skin.pantsColor;
      ctx.fillRect(-4 * s, 0, 8 * s, 20 * s);
      // Shin & Foot
      ctx.translate(0, 18 * s);
      const kneeBendL = this.isJumping ? -1.0 : Math.max(0, -legAngleL * 0.8);
      ctx.rotate(kneeBendL);
      ctx.fillRect(-3.5 * s, 0, 7 * s, 20 * s);
      // Sneaker
      ctx.fillStyle = skin.shoesColor;
      ctx.fillRect(-4 * s, 17 * s, 10 * s, 7 * s);
      // Glowing Sole
      ctx.fillStyle = mainGlow;
      ctx.fillRect(-4 * s, 22 * s, 10 * s, 3 * s);
      ctx.restore();

      // Right Leg
      ctx.save();
      ctx.translate(7 * s, hipY);
      ctx.rotate(legAngleR);
      // Thigh
      ctx.fillStyle = skin.pantsColor;
      ctx.fillRect(-4 * s, 0, 8 * s, 20 * s);
      // Shin & Foot
      ctx.translate(0, 18 * s);
      const kneeBendR = this.isJumping ? -1.2 : Math.max(0, -legAngleR * 0.8);
      ctx.rotate(kneeBendR);
      ctx.fillRect(-3.5 * s, 0, 7 * s, 20 * s);
      // Sneaker
      ctx.fillStyle = skin.shoesColor;
      ctx.fillRect(-4 * s, 17 * s, 10 * s, 7 * s);
      // Glowing Sole
      ctx.fillStyle = mainGlow;
      ctx.fillRect(-4 * s, 22 * s, 10 * s, 3 * s);
      ctx.restore();

      // --- TORSO & SPINE ---
      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(torsoAngle);

      // Athletic Cyber Jacket / Vest
      ctx.fillStyle = skin.jacketColor;
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-13 * s, 0);
      ctx.lineTo(-16 * s, -30 * s); // Left shoulder
      ctx.lineTo(16 * s, -30 * s);  // Right shoulder
      ctx.lineTo(13 * s, 0);        // Right waist
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cyber Spine Neon Stripe
      ctx.fillStyle = mainGlow;
      ctx.fillRect(-2 * s, -28 * s, 4 * s, 26 * s);

      // --- ARMS ---
      // Left Arm
      ctx.save();
      ctx.translate(-15 * s, -28 * s);
      ctx.rotate(armAngleL);
      ctx.fillStyle = skin.jacketColor;
      ctx.fillRect(-3.5 * s, 0, 7 * s, 18 * s);
      // Forearm & Hand
      ctx.translate(0, 16 * s);
      ctx.rotate(Math.max(0.2, armAngleL * 0.5));
      ctx.fillStyle = "#ffcc99"; // Skin tone hands
      ctx.fillRect(-3 * s, 0, 6 * s, 14 * s);
      ctx.restore();

      // Right Arm
      ctx.save();
      ctx.translate(15 * s, -28 * s);
      ctx.rotate(armAngleR);
      ctx.fillStyle = skin.jacketColor;
      ctx.fillRect(-3.5 * s, 0, 7 * s, 18 * s);
      // Forearm & Hand
      ctx.translate(0, 16 * s);
      ctx.rotate(Math.max(0.2, armAngleR * 0.5));
      ctx.fillStyle = "#ffcc99";
      ctx.fillRect(-3 * s, 0, 6 * s, 14 * s);
      ctx.restore();

      // --- HEAD & VISOR ---
      ctx.translate(0, -32 * s);
      // Head base / Hair
      ctx.fillStyle = "#1e1b29";
      ctx.beginPath();
      ctx.arc(0, -9 * s, 10 * s, 0, Math.PI * 2);
      ctx.fill();

      // Cyber Visor / Headband
      ctx.fillStyle = mainGlow;
      ctx.fillRect(-8 * s, -11 * s, 16 * s, 5 * s);

      ctx.restore(); // End torso

      // Energy Shield Dome (if active)
      if (this.shields > 0) {
        ctx.strokeStyle = this.shields > 1 ? "rgba(0, 243, 255, 0.7)" : "rgba(255, 0, 127, 0.7)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -40 * s + torsoBob, 28 * s, 46 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
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

    renderOverdriveVFX() {
      const ctx = this.ctx;
      ctx.save();
      const grad = ctx.createRadialGradient(
        this.width * 0.5, this.height * 0.5, this.width * 0.3,
        this.width * 0.5, this.height * 0.5, this.width * 0.7
      );
      grad.addColorStop(0, "transparent");
      grad.addColorStop(1, "rgba(255, 230, 0, 0.28)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // --- GARAGE / WARDROBE ---
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

      // Skins
      const list = document.getElementById("garage-ships-list");
      list.innerHTML = "";
      RUNNER_SKINS.forEach(skin => {
        const isUnlocked = playerData.unlockedSkins.includes(skin.id);
        const isSelected = playerData.selectedSkin === skin.id;

        const card = document.createElement("div");
        card.className = `cyber-card ${isSelected ? "selected" : ""}`;
        card.innerHTML = `
          <div class="card-header">
            <span class="ship-name" style="color: ${skin.glowColor}">${skin.name}</span>
            <span class="ship-badge">${isSelected ? "EQUIPPED" : isUnlocked ? "OWNED" : `${skin.price} CR`}</span>
          </div>
          <button class="cyber-btn sm ${isSelected ? "active" : ""}">
            ${isSelected ? "CURRENT" : isUnlocked ? "SELECT" : "UNLOCK"}
          </button>
        `;

        card.querySelector("button").addEventListener("click", () => {
          window.soundEngine.playClickSFX();
          if (isUnlocked) {
            playerData.selectedSkin = skin.id;
            savePlayerData();
            this.renderGarageContent();
          } else {
            if (playerData.credits >= skin.price) {
              playerData.credits -= skin.price;
              playerData.unlockedSkins.push(skin.id);
              playerData.selectedSkin = skin.id;
              savePlayerData();
              this.renderGarageContent();
            } else {
              alert("Collect more Cyber Credits during your runs!");
            }
          }
        });

        list.appendChild(card);
      });

      // Upgrades
      const upList = document.getElementById("garage-upgrades-list");
      upList.innerHTML = "";
      const upgrades = [
        { key: "magnet", name: "MAGNET SNEAKERS", desc: "Sucks in nearby gold coins automatically" },
        { key: "shield", name: "SHIELD ARMOR", desc: "Absorbs crash damage without failing" },
        { key: "overdrive", name: "HYPER SPRINT BOOSTER", desc: "Longer invincibility overdrive duration" },
        { key: "multiplier", name: "SCORE MULTIPLIER", desc: "Increases credit gain rate" }
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
            ${isMax ? "MAX" : `UPGRADE (${cost} CR)`}
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
              alert("Collect more credits to upgrade!");
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
    window.game = new Game();
  });
})();
