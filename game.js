/**
 * Cyberpunk Neon Velocity - 60FPS Mobile-First 3D Perspective Arcade Runner
 */

(function () {
  'use strict';

  // --- GAME CONFIG & STATE ---
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 1200; // High resolution base, will scale dynamically
  const FOV = 300;
  const CAMERA_HEIGHT = 160;
  const ROAD_WIDTH = 1200;

  // Sectors / Biomes
  const SECTORS = [
    {
      name: "NEO TOKYO SECTOR 01",
      horizonColor: "#ff007f",
      skyTop: "#08011a",
      skyBottom: "#20083b",
      gridColor: "#00f3ff",
      accentColor: "#ff007f",
      sunColor1: "#ff007f",
      sunColor2: "#ffe600"
    },
    {
      name: "OUTRUN HIGHWAY SECTOR 02",
      horizonColor: "#ff5500",
      skyTop: "#120024",
      skyBottom: "#3d0b28",
      gridColor: "#ff0055",
      accentColor: "#ffaa00",
      sunColor1: "#ff0055",
      sunColor2: "#ff9900"
    },
    {
      name: "CYBER MATRIX SECTOR 03",
      horizonColor: "#00ff66",
      skyTop: "#011208",
      skyBottom: "#042918",
      gridColor: "#00ff88",
      accentColor: "#00ffcc",
      sunColor1: "#00ff88",
      sunColor2: "#aaff00"
    },
    {
      name: "HYPER NEXUS SECTOR 04",
      horizonColor: "#a200ff",
      skyTop: "#0b001a",
      skyBottom: "#28004f",
      gridColor: "#bf00ff",
      accentColor: "#00d9ff",
      sunColor1: "#d000ff",
      sunColor2: "#00ffff"
    }
  ];

  // Ship Models
  const SHIPS = [
    {
      id: "specter",
      name: "SPECTER-01",
      desc: "Balanced tactical fighter with agile turning response.",
      price: 0,
      speedBonus: 1.0,
      agility: 1.0,
      shields: 1,
      magnetBonus: 1.0,
      color: "#00f3ff"
    },
    {
      id: "phantom",
      name: "APEX PHANTOM",
      desc: "Lightweight aerodynamic chassis with hyper-speed thrusters.",
      price: 250,
      speedBonus: 1.25,
      agility: 1.15,
      shields: 1,
      magnetBonus: 1.1,
      color: "#ff007f"
    },
    {
      id: "viper",
      name: "VIPER X",
      desc: "Twin-turbine interceptor with wide cyber-magnet array.",
      price: 600,
      speedBonus: 1.15,
      agility: 1.35,
      shields: 2,
      magnetBonus: 1.6,
      color: "#00ff66"
    },
    {
      id: "titan",
      name: "TITAN DREADNOUGHT",
      desc: "Heavy armored cruiser built to smash through energy barriers.",
      price: 1200,
      speedBonus: 1.1,
      agility: 0.9,
      shields: 3,
      magnetBonus: 1.4,
      color: "#ffaa00"
    }
  ];

  // Local Storage Data Management
  function loadPlayerData() {
    const defaultData = {
      credits: 0,
      highScore: 0,
      totalRuns: 0,
      selectedShip: "specter",
      unlockedShips: ["specter"],
      upgrades: {
        magnet: 1,
        shield: 1,
        overdrive: 1,
        multiplier: 1
      },
      trailColor: "#00f3ff"
    };

    try {
      const saved = localStorage.getItem("neon_velocity_player");
      return saved ? Object.assign(defaultData, JSON.parse(saved)) : defaultData;
    } catch (e) {
      return defaultData;
    }
  }

  function savePlayerData() {
    try {
      localStorage.setItem("neon_velocity_player", JSON.stringify(playerData));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  const playerData = loadPlayerData();

  // --- GAME ENGINE CLASS ---
  class Game {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");
      
      this.isRunning = false;
      this.isPaused = false;
      this.gameOver = false;
      
      this.width = CANVAS_WIDTH;
      this.height = CANVAS_HEIGHT;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      // Camera & Horizon
      this.horizonY = this.height * 0.44;
      this.cameraTilt = 0;
      this.shakeIntensity = 0;
      this.shakeDuration = 0;

      // Player State
      this.playerX = 0;
      this.targetPlayerX = 0;
      this.playerY = 0;
      this.playerZ = 80;
      this.speed = 0;
      this.baseSpeed = 750;
      this.maxSpeed = 1600;
      this.steeringForce = 0;
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

      // Overdrive System
      this.overdriveEnergy = 0;
      this.maxOverdriveEnergy = 100;
      this.isOverdrive = false;
      this.overdriveTimer = 0;

      // World Objects
      this.obstacles = [];
      this.pickups = [];
      this.particles = [];
      this.floatingTexts = [];
      this.speedLines = [];

      // Sector / Theme
      this.currentSectorIndex = 0;
      this.sectorDistance = 0;
      this.sectorLength = 4000;

      // Time & Spawning
      this.lastTime = 0;
      this.spawnTimer = 0;
      this.pickupSpawnTimer = 0;
      this.roadZOffset = 0;

      // Input State
      this.keys = { left: false, right: false, boost: false };
      this.touchX = null;
      this.touchStartX = null;
      this.touchActive = false;

      this.initDisplay();
      this.initEvents();
      this.initSpeedLines();
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

    initEvents() {
      // Keyboard Controls
      window.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.keys.left = true;
        if (["ArrowRight", "KeyD"].includes(e.code)) this.keys.right = true;
        if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
          this.activateOverdrive();
        }
        if (e.code === "KeyP" || e.code === "Escape") {
          this.togglePause();
        }
      });

      window.addEventListener("keyup", (e) => {
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.keys.left = false;
        if (["ArrowRight", "KeyD"].includes(e.code)) this.keys.right = false;
      });

      // Touch Controls (Smooth Drag on Screen)
      const touchArea = document.getElementById("touch-overlay") || this.canvas;

      const handleTouchStart = (e) => {
        if (!this.isRunning || this.gameOver || this.isPaused) return;
        const touch = e.touches[0];
        this.touchActive = true;
        this.touchStartX = touch.clientX;
        this.touchX = touch.clientX;
      };

      const handleTouchMove = (e) => {
        if (!this.touchActive) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchX;
        this.touchX = touch.clientX;

        // Sensitively map swipe motion to target X
        const sensitivity = 2.4;
        this.targetPlayerX += deltaX * sensitivity;
        this.targetPlayerX = Math.max(-ROAD_WIDTH * 0.46, Math.min(ROAD_WIDTH * 0.46, this.targetPlayerX));
        
        e.preventDefault();
      };

      const handleTouchEnd = () => {
        this.touchActive = false;
      };

      touchArea.addEventListener("touchstart", handleTouchStart, { passive: false });
      touchArea.addEventListener("touchmove", handleTouchMove, { passive: false });
      touchArea.addEventListener("touchend", handleTouchEnd, { passive: true });
      touchArea.addEventListener("touchcancel", handleTouchEnd, { passive: true });

      // On-screen Virtual Buttons (for players who prefer tapping buttons)
      const btnLeft = document.getElementById("btn-left");
      const btnRight = document.getElementById("btn-right");
      const btnBoost = document.getElementById("btn-boost");

      if (btnLeft && btnRight) {
        const bindButton = (el, key) => {
          el.addEventListener("touchstart", (e) => { e.preventDefault(); this.keys[key] = true; });
          el.addEventListener("touchend", () => { this.keys[key] = false; });
          el.addEventListener("mousedown", () => { this.keys[key] = true; });
          el.addEventListener("mouseup", () => { this.keys[key] = false; });
        };
        bindButton(btnLeft, "left");
        bindButton(btnRight, "right");
      }

      if (btnBoost) {
        btnBoost.addEventListener("touchstart", (e) => {
          e.preventDefault();
          this.activateOverdrive();
        });
        btnBoost.addEventListener("click", () => {
          this.activateOverdrive();
        });
      }

      // UI Buttons
      document.getElementById("btn-start").addEventListener("click", () => this.startGame());
      document.getElementById("btn-restart").addEventListener("click", () => this.startGame());
      document.getElementById("btn-pause").addEventListener("click", () => this.togglePause());
      document.getElementById("btn-resume").addEventListener("click", () => this.togglePause());
      document.getElementById("btn-garage").addEventListener("click", () => this.openGarage());
      document.getElementById("btn-close-garage").addEventListener("click", () => this.closeGarage());
      document.getElementById("btn-audio").addEventListener("click", () => this.toggleAudio());
      document.getElementById("btn-fullscreen").addEventListener("click", () => this.toggleFullscreen());
      
      // Share button using native Web Share API
      const btnShare = document.getElementById("btn-share");
      if (btnShare) {
        btnShare.addEventListener("click", () => this.shareScore());
      }
    }

    initSpeedLines() {
      this.speedLines = [];
      for (let i = 0; i < 40; i++) {
        this.speedLines.push({
          x: (Math.random() - 0.5) * ROAD_WIDTH * 1.5,
          y: Math.random() * -200,
          z: Math.random() * 1200,
          length: 50 + Math.random() * 150,
          speed: 1 + Math.random() * 0.5
        });
      }
    }

    getShipData() {
      return SHIPS.find(s => s.id === playerData.selectedShip) || SHIPS[0];
    }

    startGame() {
      window.soundEngine.resumeContext();
      window.soundEngine.startMusic();
      window.soundEngine.playClickSFX();

      const ship = this.getShipData();
      
      this.isRunning = true;
      this.isPaused = false;
      this.gameOver = false;
      
      this.playerX = 0;
      this.targetPlayerX = 0;
      this.steeringForce = 0;
      this.bankAngle = 0;
      
      this.speed = this.baseSpeed * ship.speedBonus;
      this.score = 0;
      this.displayScore = 0;
      this.distance = 0;
      this.creditsThisRun = 0;
      this.nearMisses = 0;
      this.multiplier = 1;
      this.multiplierTimer = 0;

      // Shield levels based on ship and upgrade
      const shieldUpgrade = playerData.upgrades.shield || 1;
      this.maxShields = ship.shields + Math.floor((shieldUpgrade - 1) / 2);
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

      // Hide menus, show HUD
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
      btn.classList.toggle("muted", isMuted);
    }

    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }

    activateOverdrive() {
      if (this.overdriveEnergy < this.maxOverdriveEnergy || this.isOverdrive || this.gameOver) return;
      
      this.isOverdrive = true;
      const overdriveLevel = playerData.upgrades.overdrive || 1;
      this.overdriveTimer = 5.0 + (overdriveLevel * 0.7); // Duration up to ~8.5 seconds
      this.overdriveEnergy = 0;

      window.soundEngine.playOverdriveSFX();
      this.triggerScreenShake(14, 0.4);
      this.addFloatingText("HYPER OVERDRIVE!", 0, -60, "#ffe600", 2.2);

      // Burst of particles
      for (let i = 0; i < 40; i++) {
        this.particles.push({
          x: this.playerX,
          y: 0,
          z: this.playerZ,
          vx: (Math.random() - 0.5) * 800,
          vy: (Math.random() - 0.5) * 400,
          vz: (Math.random() - 0.5) * 600,
          life: 0.8,
          maxLife: 0.8,
          color: "#ffe600",
          size: 6
        });
      }
    }

    triggerScreenShake(intensity, duration) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
    }

    addFloatingText(text, x, y, color = "#00f3ff", scale = 1.0) {
      this.floatingTexts.push({
        text,
        x,
        y,
        color,
        scale,
        alpha: 1.0,
        life: 1.2
      });
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

    // --- UPDATE STATE ---
    update(dt) {
      const ship = this.getShipData();

      // Steering Input Processing
      const steerSpeed = 1600 * ship.agility;
      if (this.keys.left) {
        this.targetPlayerX -= steerSpeed * dt;
      }
      if (this.keys.right) {
        this.targetPlayerX += steerSpeed * dt;
      }

      // Constrain within road boundary
      const roadLimit = ROAD_WIDTH * 0.44;
      this.targetPlayerX = Math.max(-roadLimit, Math.min(roadLimit, this.targetPlayerX));

      // Smooth lerp to target position
      const lerpFactor = 14 * dt;
      const prevX = this.playerX;
      this.playerX += (this.targetPlayerX - this.playerX) * lerpFactor;
      
      // Calculate bank tilt based on lateral velocity
      const lateralVelocity = (this.playerX - prevX) / dt;
      this.bankAngle = Math.max(-0.45, Math.min(0.45, (lateralVelocity / 1500)));
      this.cameraTilt = this.bankAngle * 0.5;

      // Speed progression
      const targetSpeed = (this.isOverdrive ? this.maxSpeed * 1.5 : Math.min(this.maxSpeed, this.baseSpeed + (this.distance * 0.08))) * ship.speedBonus;
      this.speed += (targetSpeed - this.speed) * 4 * dt;

      // Update distance and score
      this.distance += this.speed * dt * 0.1;
      this.sectorDistance += this.speed * dt * 0.1;
      
      if (this.sectorDistance >= this.sectorLength) {
        this.sectorDistance = 0;
        this.currentSectorIndex = (this.currentSectorIndex + 1) % SECTORS.length;
        this.addFloatingText(SECTORS[this.currentSectorIndex].name, 0, -80, SECTORS[this.currentSectorIndex].accentColor, 1.8);
      }

      // Score accumulation based on speed and multiplier
      const scoreGain = (this.speed * 0.1) * this.multiplier * dt;
      this.score += scoreGain;
      this.displayScore += (this.score - this.displayScore) * 10 * dt;

      // Road texture scroll
      this.roadZOffset = (this.roadZOffset + this.speed * dt) % 160;

      // Screen shake decay
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
      } else {
        this.shakeIntensity = 0;
      }

      // Overdrive timer decay
      if (this.isOverdrive) {
        this.overdriveTimer -= dt;
        if (this.overdriveTimer <= 0) {
          this.isOverdrive = false;
          this.overdriveTimer = 0;
        }
      }

      // Multiplier timer
      if (this.multiplier > 1) {
        this.multiplierTimer -= dt;
        if (this.multiplierTimer <= 0) {
          this.multiplier = 1;
        }
      }

      // Update Thruster Exhaust Particles
      this.updateThrusterParticles(dt);

      // Spawn Obstacles & Pickups
      this.updateSpawners(dt);

      // Update Obstacles
      this.updateObstacles(dt);

      // Update Pickups
      this.updatePickups(dt);

      // Update Particles
      this.updateParticles(dt);

      // Update Floating Texts
      this.updateFloatingTexts(dt);

      // Update HUD elements
      this.updateHUD();
    }

    updateThrusterParticles(dt) {
      const trailColor = playerData.trailColor || "#00f3ff";
      const count = this.isOverdrive ? 4 : 2;

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: this.playerX + (Math.random() - 0.5) * 30,
          y: -10 + (Math.random() - 0.5) * 8,
          z: this.playerZ + 20,
          vx: (Math.random() - 0.5) * 80,
          vy: 20 + Math.random() * 40,
          vz: 400 + Math.random() * 300,
          life: 0.35,
          maxLife: 0.35,
          color: this.isOverdrive ? "#ffe600" : trailColor,
          size: 7 + Math.random() * 5
        });
      }
    }

    updateSpawners(dt) {
      // Obstacle Spawning
      this.spawnTimer -= dt;
      const minInterval = 0.45;
      const maxInterval = 1.25;
      const currentInterval = Math.max(minInterval, maxInterval - (this.distance * 0.00008));

      if (this.spawnTimer <= 0) {
        this.spawnTimer = currentInterval + Math.random() * 0.3;
        this.spawnObstacleGroup();
      }

      // Pickup Spawning
      this.pickupSpawnTimer -= dt;
      if (this.pickupSpawnTimer <= 0) {
        this.pickupSpawnTimer = 0.8 + Math.random() * 0.6;
        this.spawnPickup();
      }
    }

    spawnObstacleGroup() {
      const types = ["barrier", "pillar", "mine", "drone"];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      const spawnZ = 1200;

      const lanes = [-380, -190, 0, 190, 380];
      const laneIndex = Math.floor(Math.random() * lanes.length);
      const laneX = lanes[laneIndex];

      if (chosenType === "barrier") {
        // Horizontal laser barrier spanning 1 or 2 lanes
        const width = 280;
        this.obstacles.push({
          type: "barrier",
          x: laneX,
          y: 0,
          z: spawnZ,
          width,
          height: 60,
          hitRadius: width * 0.45,
          color: "#ff0055",
          passed: false
        });
      } else if (chosenType === "pillar") {
        // Tall cyber data spire
        this.obstacles.push({
          type: "pillar",
          x: laneX,
          y: 0,
          z: spawnZ,
          width: 90,
          height: 180,
          hitRadius: 55,
          color: "#00ffff",
          passed: false
        });
      } else if (chosenType === "mine") {
        // Floating spinning EMP mine
        this.obstacles.push({
          type: "mine",
          x: laneX,
          y: -40,
          z: spawnZ,
          width: 70,
          height: 70,
          hitRadius: 45,
          color: "#ffaa00",
          rotation: 0,
          passed: false
        });
      } else if (chosenType === "drone") {
        // Moving patrol drone shifting left and right
        this.obstacles.push({
          type: "drone",
          x: laneX,
          baseX: laneX,
          y: -20,
          z: spawnZ,
          width: 100,
          height: 50,
          hitRadius: 55,
          color: "#ff00aa",
          movePhase: Math.random() * Math.PI * 2,
          moveSpeed: 3 + Math.random() * 2,
          passed: false
        });
      }
    }

    spawnPickup() {
      const rand = Math.random();
      let type = "credit";
      let color = "#00f3ff";

      if (rand < 0.65) {
        type = "credit"; // Cyber coins
        color = "#00f3ff";
      } else if (rand < 0.90) {
        type = "overdrive"; // Boost energy
        color = "#ffe600";
      } else {
        type = "shield"; // Rare shield repair
        color = "#00ff88";
      }

      const lanes = [-350, -180, 0, 180, 350];
      const laneX = lanes[Math.floor(Math.random() * lanes.length)];

      this.pickups.push({
        type,
        x: laneX,
        y: -30,
        z: 1250,
        radius: 35,
        color,
        rotation: 0
      });
    }

    updateObstacles(dt) {
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.z -= this.speed * dt;

        if (obs.type === "drone") {
          obs.movePhase += obs.moveSpeed * dt;
          obs.x = obs.baseX + Math.sin(obs.movePhase) * 160;
        } else if (obs.type === "mine") {
          obs.rotation += 4 * dt;
        }

        // Collision & Near-Miss Detection
        const zDist = obs.z - this.playerZ;
        const xDist = Math.abs(obs.x - this.playerX);

        if (!obs.passed && zDist <= 20 && zDist >= -40) {
          if (xDist < obs.hitRadius) {
            // DIRECT HIT
            obs.passed = true;
            this.handlePlayerCollision(obs);
          } else if (xDist < obs.hitRadius + 110) {
            // NEAR MISS! Reward risk-taking
            obs.passed = true;
            this.handleNearMiss(obs);
          }
        }

        // Remove obstacles that moved far behind camera
        if (obs.z < -100) {
          this.obstacles.splice(i, 1);
        }
      }
    }

    updatePickups(dt) {
      const ship = this.getShipData();
      const magnetLevel = playerData.upgrades.magnet || 1;
      const magnetRadius = (220 + (magnetLevel * 45)) * ship.magnetBonus;

      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const item = this.pickups[i];
        item.z -= this.speed * dt;
        item.rotation += 3 * dt;

        // Magnet attraction
        const dx = this.playerX - item.x;
        const dz = this.playerZ - item.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < magnetRadius && item.z > this.playerZ) {
          const pullForce = (1 - dist / magnetRadius) * 2200 * dt;
          item.x += (dx / dist) * pullForce;
        }

        // Collection detection
        if (Math.abs(item.z - this.playerZ) < 45 && Math.abs(item.x - this.playerX) < item.radius + 40) {
          this.collectPickup(item);
          this.pickups.splice(i, 1);
          continue;
        }

        // Remove if behind camera
        if (item.z < -80) {
          this.pickups.splice(i, 1);
        }
      }
    }

    collectPickup(item) {
      if (item.type === "credit") {
        const multUpgrade = playerData.upgrades.multiplier || 1;
        const creditGain = Math.round(1 * (1 + (multUpgrade - 1) * 0.25));
        
        this.creditsThisRun += creditGain;
        playerData.credits += creditGain;
        savePlayerData();

        this.score += 150 * this.multiplier;
        this.addFloatingText(`+${creditGain} CR`, item.x, -50, "#00f3ff", 1.2);
        window.soundEngine.playCollectSFX(this.multiplier);

      } else if (item.type === "overdrive") {
        this.overdriveEnergy = Math.min(this.maxOverdriveEnergy, this.overdriveEnergy + 25);
        this.score += 200 * this.multiplier;
        this.addFloatingText("+25% OVERDRIVE", item.x, -60, "#ffe600", 1.3);
        window.soundEngine.playCollectSFX(1.5);

      } else if (item.type === "shield") {
        if (this.shields < this.maxShields) {
          this.shields++;
          this.addFloatingText("SHIELD RESTORED!", item.x, -60, "#00ff88", 1.4);
        } else {
          this.score += 500 * this.multiplier;
          this.addFloatingText("+500 PTS (MAX SHIELD)", item.x, -60, "#00ff88", 1.2);
        }
        window.soundEngine.playCollectSFX(2.0);
      }

      // Sparkles at collection point
      for (let i = 0; i < 12; i++) {
        this.particles.push({
          x: item.x,
          y: item.y,
          z: item.z,
          vx: (Math.random() - 0.5) * 300,
          vy: (Math.random() - 0.5) * 300,
          vz: (Math.random() - 0.5) * 300,
          life: 0.4,
          maxLife: 0.4,
          color: item.color,
          size: 5
        });
      }
    }

    handleNearMiss(obs) {
      this.nearMisses++;
      const bonus = 250 * this.multiplier;
      this.score += bonus;
      
      // Boost overdrive on close calls
      this.overdriveEnergy = Math.min(this.maxOverdriveEnergy, this.overdriveEnergy + 8);

      // Increase multiplier (up to 8x)
      if (this.multiplier < 8) {
        this.multiplier = Math.min(8, this.multiplier + 1);
        this.multiplierTimer = 4.0; // 4 seconds to chain another near miss
      }

      this.addFloatingText(`NEAR MISS! x${this.multiplier}`, this.playerX, -70, "#ff00ff", 1.5);
      window.soundEngine.playNearMissSFX();
      this.triggerScreenShake(6, 0.15);
    }

    handlePlayerCollision(obs) {
      if (this.isOverdrive) {
        // SMASH THROUGH OBSTACLES IN OVERDRIVE!
        this.score += 500 * this.multiplier;
        this.addFloatingText("BARRIER SMASH! +500", obs.x, -60, "#ffe600", 1.6);
        window.soundEngine.playCrashSFX();
        this.triggerScreenShake(12, 0.25);

        // Debris explosion
        for (let i = 0; i < 25; i++) {
          this.particles.push({
            x: obs.x,
            y: obs.y,
            z: obs.z,
            vx: (Math.random() - 0.5) * 700,
            vy: (Math.random() - 0.5) * 500,
            vz: (Math.random() - 0.5) * 700,
            life: 0.7,
            maxLife: 0.7,
            color: obs.color,
            size: 6
          });
        }
        return;
      }

      // NORMAL COLLISION
      this.shields--;
      this.multiplier = 1; // Reset multiplier streak

      if (this.shields > 0) {
        // Shield absorbed the impact
        this.triggerScreenShake(14, 0.35);
        window.soundEngine.playShieldBreakSFX();
        this.addFloatingText("SHIELD DAMAGED!", this.playerX, -80, "#ff0055", 1.8);

        // Shield shatter particles
        for (let i = 0; i < 30; i++) {
          this.particles.push({
            x: this.playerX,
            y: 0,
            z: this.playerZ,
            vx: (Math.random() - 0.5) * 600,
            vy: (Math.random() - 0.5) * 400,
            vz: (Math.random() - 0.5) * 600,
            life: 0.6,
            maxLife: 0.6,
            color: "#00ffff",
            size: 6
          });
        }
      } else {
        // CRASH - GAME OVER
        this.triggerGameOver();
      }
    }

    triggerGameOver() {
      this.gameOver = true;
      this.isRunning = false;

      window.soundEngine.stopMusic();
      window.soundEngine.playCrashSFX();
      this.triggerScreenShake(25, 0.8);

      // Huge explosion
      for (let i = 0; i < 70; i++) {
        this.particles.push({
          x: this.playerX,
          y: 0,
          z: this.playerZ,
          vx: (Math.random() - 0.5) * 900,
          vy: -Math.random() * 600,
          vz: (Math.random() - 0.5) * 900,
          life: 1.2,
          maxLife: 1.2,
          color: Math.random() > 0.5 ? "#ff0055" : "#ffe600",
          size: 8
        });
      }

      // High Score update
      const finalScore = Math.floor(this.score);
      const isNewHighScore = finalScore > playerData.highScore;
      if (isNewHighScore) {
        playerData.highScore = finalScore;
      }
      playerData.totalRuns = (playerData.totalRuns || 0) + 1;
      savePlayerData();

      // Show Game Over Modal
      setTimeout(() => {
        document.getElementById("hud").classList.add("hidden");
        const gameOverScreen = document.getElementById("game-over-screen");
        gameOverScreen.classList.remove("hidden");

        document.getElementById("final-score").textContent = finalScore.toLocaleString();
        document.getElementById("final-distance").textContent = `${Math.floor(this.distance)} m`;
        document.getElementById("final-credits").textContent = `+${this.creditsThisRun}`;
        document.getElementById("final-nearmiss").textContent = `${this.nearMisses}`;
        
        const badge = document.getElementById("new-record-badge");
        if (badge) {
          badge.style.display = isNewHighScore ? "inline-block" : "none";
        }
      }, 700);
    }

    shareScore() {
      const finalScore = Math.floor(this.score);
      const shareData = {
        title: "Neon Velocity: Cyberpunk Runner",
        text: `⚡ I scored ${finalScore.toLocaleString()} pts in Neon Velocity! Can you beat my high score? Play it live on your phone:`,
        url: window.location.href
      };

      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
          alert("Score and link copied to clipboard! Share it with your friends.");
        }).catch(() => {});
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

        ft.y -= 45 * dt; // Float upwards
        ft.alpha = ft.life / 1.2;
      }
    }

    updateHUD() {
      document.getElementById("hud-score").textContent = Math.floor(this.displayScore).toLocaleString();
      document.getElementById("hud-speed").textContent = `${Math.floor(this.speed)} KM/H`;
      document.getElementById("hud-credits").textContent = `${playerData.credits}`;

      // Overdrive Gauge
      const pct = Math.min(100, (this.overdriveEnergy / this.maxOverdriveEnergy) * 100);
      const gauge = document.getElementById("hud-overdrive-fill");
      if (gauge) {
        gauge.style.width = `${pct}%`;
        gauge.classList.toggle("ready", pct >= 100);
      }

      // Boost Button State
      const btnBoost = document.getElementById("btn-boost");
      if (btnBoost) {
        btnBoost.classList.toggle("glow", pct >= 100 || this.isOverdrive);
        btnBoost.textContent = this.isOverdrive ? "HYPER!!" : "BOOST";
      }

      // Multiplier Tag
      const multTag = document.getElementById("hud-multiplier");
      if (multTag) {
        multTag.textContent = `x${this.multiplier}`;
        multTag.style.display = this.multiplier > 1 ? "inline-block" : "none";
      }

      // Shield Dots
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

    // --- 3D PERSPECTIVE RENDERING ENGINE ---
    render() {
      const ctx = this.ctx;
      const sector = SECTORS[this.currentSectorIndex];

      // Screen Shake offset
      let shakeX = 0;
      let shakeY = 0;
      if (this.shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 1. Draw Cyberpunk Gradient Sky & Sunset Sun
      this.renderSky(sector);

      // 2. Draw Skyline Horizon & Neon Mountains
      this.renderSkyline(sector);

      // 3. Draw 3D Perspective Road & Neon Grid
      this.renderRoad(sector);

      // 4. Draw Speed Streaks
      this.renderSpeedLines();

      // 5. Sort and Draw 3D World Entities (Pickups, Obstacles, Particles, Player)
      this.renderEntities(sector);

      // 6. Draw Player Cyber-Craft
      this.renderPlayerShip();

      // 7. Draw Floating UI Texts
      this.renderFloatingTexts();

      // 8. Overdrive Screen Glow / Chromatic Warp
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

      // Synthwave Retrosun
      const sunRadius = Math.min(this.width * 0.16, 75);
      const sunX = this.width * 0.5 + this.cameraTilt * 60;
      const sunY = this.horizonY - sunRadius * 0.45;

      const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
      sunGrad.addColorStop(0, sector.sunColor2);
      sunGrad.addColorStop(0.7, sector.sunColor1);
      sunGrad.addColorStop(1, "transparent");

      ctx.save();
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sun horizontal slice blinders (classic 80s synthwave style)
      ctx.fillStyle = sector.skyBottom;
      const slices = 6;
      for (let i = 0; i < slices; i++) {
        const sliceY = sunY + (i / slices) * sunRadius;
        const sliceH = (i + 1) * 2;
        ctx.fillRect(sunX - sunRadius - 5, sliceY, (sunRadius + 5) * 2, sliceH);
      }
      ctx.restore();
    }

    renderSkyline(sector) {
      const ctx = this.ctx;
      ctx.save();
      
      const horizon = this.horizonY;
      const parallaxX = -this.playerX * 0.05;

      ctx.fillStyle = "#0c051a";
      // Procedural silhouette buildings
      const buildingWidth = 35;
      const numBuildings = Math.ceil(this.width / buildingWidth) + 4;
      
      for (let i = -2; i < numBuildings; i++) {
        const bx = i * buildingWidth + (parallaxX % buildingWidth);
        const seed = Math.sin(i * 999);
        const bh = 25 + Math.abs(seed) * 90;
        
        ctx.fillRect(bx, horizon - bh, buildingWidth - 2, bh);

        // Cyber window dots
        if (Math.abs(seed) > 0.4) {
          ctx.fillStyle = sector.gridColor;
          ctx.fillRect(bx + 6, horizon - bh + 15, 3, 3);
          ctx.fillRect(bx + 16, horizon - bh + 30, 3, 3);
          ctx.fillStyle = "#0c051a";
        }
      }

      // Horizon glowing border line
      ctx.strokeStyle = sector.horizonColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = sector.horizonColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(this.width, horizon);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // Projects 3D world coordinates (x, y, z) into 2D canvas screen space
    project(worldX, worldY, worldZ) {
      const z = Math.max(worldZ, 1);
      const scale = FOV / (FOV + z);
      const screenX = (this.width * 0.5) + (worldX - this.playerX) * scale;
      const screenY = this.horizonY + (CAMERA_HEIGHT + worldY) * scale;
      return { x: screenX, y: screenY, scale };
    }

    renderRoad(sector) {
      const ctx = this.ctx;
      ctx.save();

      // Dark futuristic highway base
      const roadGrad = ctx.createLinearGradient(0, this.horizonY, 0, this.height);
      roadGrad.addColorStop(0, "#080214");
      roadGrad.addColorStop(1, "#020008");
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, this.horizonY, this.width, this.height - this.horizonY);

      // Moving Grid Horizontal Lines
      const zStep = 40;
      const maxZ = 1200;
      ctx.lineWidth = 1.5;

      for (let z = (this.roadZOffset % zStep); z < maxZ; z += zStep) {
        const p1 = this.project(-ROAD_WIDTH * 0.55, 0, z);
        const p2 = this.project(ROAD_WIDTH * 0.55, 0, z);

        const alpha = Math.max(0, 1 - (z / maxZ));
        ctx.strokeStyle = sector.gridColor;
        ctx.globalAlpha = alpha * (this.isOverdrive ? 0.9 : 0.6);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Longitudinal Highway Lanes (Perspective rays towards horizon)
      const lanes = [-0.5, -0.25, 0, 0.25, 0.5];
      ctx.globalAlpha = 0.7;

      for (const lane of lanes) {
        const pNear = this.project(ROAD_WIDTH * lane, 0, 20);
        const pFar = this.project(ROAD_WIDTH * lane, 0, maxZ);

        ctx.strokeStyle = (lane === -0.5 || lane === 0.5) ? sector.accentColor : sector.gridColor;
        ctx.lineWidth = (lane === -0.5 || lane === 0.5) ? 3 : 1.5;
        
        ctx.beginPath();
        ctx.moveTo(pNear.x, pNear.y);
        ctx.lineTo(pFar.x, pFar.y);
        ctx.stroke();
      }

      ctx.restore();
    }

    renderSpeedLines() {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = this.isOverdrive ? "#ffe600" : "#00f3ff";
      ctx.lineWidth = 2;

      for (const line of this.speedLines) {
        line.z -= this.speed * 0.016 * line.speed;
        if (line.z < 20) line.z += 1200;

        const p1 = this.project(line.x, line.y, line.z);
        const p2 = this.project(line.x, line.y, line.z + line.length);

        const alpha = Math.min(1, Math.max(0, 1 - line.z / 1200)) * (this.isOverdrive ? 0.8 : 0.3);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    renderEntities(sector) {
      // Collect all 3D objects to sort by depth (Z-buffer painters algorithm)
      const entities = [];

      // Obstacles
      for (const obs of this.obstacles) {
        entities.push({ type: "obstacle", data: obs, z: obs.z });
      }

      // Pickups
      for (const item of this.pickups) {
        entities.push({ type: "pickup", data: item, z: item.z });
      }

      // Particles
      for (const p of this.particles) {
        entities.push({ type: "particle", data: p, z: p.z });
      }

      // Sort furthest to nearest
      entities.sort((a, b) => b.z - a.z);

      for (const ent of entities) {
        if (ent.type === "obstacle") {
          this.renderSingleObstacle(ent.data);
        } else if (ent.type === "pickup") {
          this.renderSinglePickup(ent.data);
        } else if (ent.type === "particle") {
          this.renderSingleParticle(ent.data);
        }
      }
    }

    renderSingleObstacle(obs) {
      const proj = this.project(obs.x, obs.y, obs.z);
      if (proj.scale <= 0) return;

      const ctx = this.ctx;
      ctx.save();

      const w = obs.width * proj.scale;
      const h = obs.height * proj.scale;

      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 15 * proj.scale;

      if (obs.type === "barrier") {
        // Glowing Laser Gate
        ctx.fillStyle = "rgba(255, 0, 85, 0.25)";
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = Math.max(2, 4 * proj.scale);

        // Frame posts
        ctx.strokeRect(proj.x - w * 0.5, proj.y - h, w, h);
        ctx.fillRect(proj.x - w * 0.5, proj.y - h, w, h);

        // Pulsing electric laser core
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, 2 * proj.scale);
        ctx.beginPath();
        ctx.moveTo(proj.x - w * 0.5, proj.y - h * 0.5);
        ctx.lineTo(proj.x + w * 0.5, proj.y - h * 0.5);
        ctx.stroke();

      } else if (obs.type === "pillar") {
        // 3D Cyber Spire
        ctx.fillStyle = "#0c051a";
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = Math.max(2, 3 * proj.scale);

        ctx.fillRect(proj.x - w * 0.5, proj.y - h, w, h);
        ctx.strokeRect(proj.x - w * 0.5, proj.y - h, w, h);

        // Glowing center chevron
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y - h * 0.8);
        ctx.lineTo(proj.x + w * 0.3, proj.y - h * 0.5);
        ctx.lineTo(proj.x - w * 0.3, proj.y - h * 0.5);
        ctx.closePath();
        ctx.fill();

      } else if (obs.type === "mine") {
        // Rotating Diamond EMP Mine
        ctx.translate(proj.x, proj.y);
        ctx.rotate(obs.rotation);

        ctx.fillStyle = "rgba(255, 170, 0, 0.4)";
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = Math.max(2, 3 * proj.scale);

        const r = (w * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (obs.type === "drone") {
        // Futuristic Cyber Drone
        ctx.fillStyle = "#120224";
        ctx.strokeStyle = obs.color;
        ctx.lineWidth = Math.max(2, 3 * proj.scale);

        // Swept wings
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y - h);
        ctx.lineTo(proj.x + w * 0.5, proj.y);
        ctx.lineTo(proj.x + w * 0.2, proj.y - h * 0.4);
        ctx.lineTo(proj.x - w * 0.2, proj.y - h * 0.4);
        ctx.lineTo(proj.x - w * 0.5, proj.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Engine glow
        ctx.fillStyle = "#ff00ff";
        ctx.beginPath();
        ctx.arc(proj.x, proj.y - h * 0.3, 4 * proj.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    renderSinglePickup(item) {
      const proj = this.project(item.x, item.y, item.z);
      if (proj.scale <= 0) return;

      const ctx = this.ctx;
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(item.rotation);

      const r = item.radius * proj.scale;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 12 * proj.scale;

      if (item.type === "credit") {
        // Blue Diamond Crystal
        ctx.fillStyle = item.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1.5, 2 * proj.scale);

        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.7, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (item.type === "overdrive") {
        // Glowing Energy Orb with Orbiting Ring
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 * proj.scale;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.4, item.rotation * 2, 0, Math.PI * 2);
        ctx.stroke();

      } else if (item.type === "shield") {
        // Shield Battery Cube
        ctx.fillStyle = "rgba(0, 255, 136, 0.4)";
        ctx.strokeStyle = item.color;
        ctx.lineWidth = Math.max(2, 3 * proj.scale);
        ctx.strokeRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
        ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
      }

      ctx.restore();
    }

    renderSingleParticle(p) {
      const proj = this.project(p.x, p.y, p.z);
      if (proj.scale <= 0) return;

      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 * proj.scale;

      const size = Math.max(1, p.size * proj.scale);
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    renderPlayerShip() {
      const ship = this.getShipData();
      const proj = this.project(this.playerX, 0, this.playerZ);
      const ctx = this.ctx;

      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(this.bankAngle); // Dynamic 3D roll on turn

      const s = 1.35; // Ship scale
      const mainColor = this.isOverdrive ? "#ffe600" : (playerData.trailColor || ship.color);

      ctx.shadowColor = mainColor;
      ctx.shadowBlur = this.isOverdrive ? 30 : 18;

      // 1. Sleek Cyber Fuselage Body
      ctx.fillStyle = "#0c051a";
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(0, -42 * s); // Cockpit nose point
      ctx.lineTo(24 * s, 14 * s); // Right wing tip
      ctx.lineTo(10 * s, 18 * s); // Right thruster notch
      ctx.lineTo(0, 10 * s);      // Center engine base
      ctx.lineTo(-10 * s, 18 * s); // Left thruster notch
      ctx.lineTo(-24 * s, 14 * s); // Left wing tip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Cockpit Canopy Glass
      ctx.fillStyle = this.isOverdrive ? "#ffffff" : "#00f3ff";
      ctx.beginPath();
      ctx.moveTo(0, -28 * s);
      ctx.lineTo(5 * s, -4 * s);
      ctx.lineTo(0, -1 * s);
      ctx.lineTo(-5 * s, -4 * s);
      ctx.closePath();
      ctx.fill();

      // 3. Wingtip Laser Accents
      ctx.fillStyle = mainColor;
      ctx.fillRect(21 * s, 8 * s, 3 * s, 7 * s);
      ctx.fillRect(-24 * s, 8 * s, 3 * s, 7 * s);

      // 4. Energy Shield Dome (when shields active)
      if (this.shields > 0) {
        ctx.strokeStyle = this.shields > 1 ? "rgba(0, 243, 255, 0.7)" : "rgba(255, 0, 127, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -10 * s, 38 * s, 0, Math.PI * 2);
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
        ctx.font = `bold ${Math.floor(18 * ft.scale)}px 'Orbitron', 'Rajdhani', sans-serif`;
        ctx.textAlign = "center";
        
        const proj = this.project(ft.x, 0, this.playerZ);
        ctx.fillText(ft.text, proj.x, proj.y + ft.y);
        ctx.restore();
      }
    }

    renderOverdriveVFX() {
      const ctx = this.ctx;
      ctx.save();
      
      // Electric Gold Border Vignette
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

    // --- GARAGE & UPGRADES UI ---
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

      // 1. Ships List
      const shipsList = document.getElementById("garage-ships-list");
      shipsList.innerHTML = "";

      SHIPS.forEach(ship => {
        const isUnlocked = playerData.unlockedShips.includes(ship.id);
        const isSelected = playerData.selectedShip === ship.id;

        const card = document.createElement("div");
        card.className = `cyber-card ${isSelected ? "selected" : ""} ${!isUnlocked ? "locked" : ""}`;
        card.innerHTML = `
          <div class="card-header">
            <span class="ship-name" style="color: ${ship.color}">${ship.name}</span>
            <span class="ship-badge">${isSelected ? "EQUIPPED" : isUnlocked ? "OWNED" : `${ship.price} CR`}</span>
          </div>
          <p class="ship-desc">${ship.desc}</p>
          <div class="ship-stats">
            <div>SPD: ${Math.round(ship.speedBonus * 100)}%</div>
            <div>AGI: ${Math.round(ship.agility * 100)}%</div>
            <div>SHD: ${ship.shields}</div>
            <div>MAG: ${Math.round(ship.magnetBonus * 100)}%</div>
          </div>
          <button class="cyber-btn sm ${isSelected ? "active" : ""}" data-ship="${ship.id}">
            ${isSelected ? "CURRENT" : isUnlocked ? "SELECT" : "UNLOCK"}
          </button>
        `;

        const btn = card.querySelector("button");
        btn.addEventListener("click", () => {
          window.soundEngine.playClickSFX();
          if (isUnlocked) {
            playerData.selectedShip = ship.id;
            savePlayerData();
            this.renderGarageContent();
          } else {
            if (playerData.credits >= ship.price) {
              playerData.credits -= ship.price;
              playerData.unlockedShips.push(ship.id);
              playerData.selectedShip = ship.id;
              savePlayerData();
              this.renderGarageContent();
            } else {
              alert("Not enough Cyber Credits! Complete more runs or dodge obstacles to earn credits.");
            }
          }
        });

        shipsList.appendChild(card);
      });

      // 2. Upgrades List
      const upgradesList = document.getElementById("garage-upgrades-list");
      upgradesList.innerHTML = "";

      const upgrades = [
        { key: "magnet", name: "MAGNET ENGINE", desc: "Increases credit collection suction radius" },
        { key: "shield", name: "SHIELD CAPACITOR", desc: "Increases max protective shield armor" },
        { key: "overdrive", name: "OVERDRIVE BOOSTER", desc: "Extends hyper-speed invincibility duration" },
        { key: "multiplier", name: "CREDIT MULTIPLIER", desc: "Multiplies credits earned per run" }
      ];

      upgrades.forEach(u => {
        const level = playerData.upgrades[u.key] || 1;
        const maxLevel = 5;
        const cost = level * 150;
        const isMax = level >= maxLevel;

        const card = document.createElement("div");
        card.className = "upgrade-card";
        card.innerHTML = `
          <div class="upgrade-info">
            <span class="upgrade-title">${u.name} (LVL ${level}/${maxLevel})</span>
            <span class="upgrade-desc">${u.desc}</span>
            <div class="level-bars">
              ${Array.from({ length: maxLevel }).map((_, i) => `<span class="bar ${i < level ? "filled" : ""}"></span>`).join("")}
            </div>
          </div>
          <button class="cyber-btn sm ${isMax ? "disabled" : ""}" ${isMax ? "disabled" : ""}>
            ${isMax ? "MAX" : `UPGRADE (${cost} CR)`}
          </button>
        `;

        const btn = card.querySelector("button");
        if (!isMax) {
          btn.addEventListener("click", () => {
            window.soundEngine.playClickSFX();
            if (playerData.credits >= cost) {
              playerData.credits -= cost;
              playerData.upgrades[u.key] = level + 1;
              savePlayerData();
              this.renderGarageContent();
            } else {
              alert("Not enough Cyber Credits!");
            }
          });
        }

        upgradesList.appendChild(card);
      });

      // 3. Trail Color Picker
      const colorOptions = [
        { name: "Cyan", hex: "#00f3ff" },
        { name: "Magenta", hex: "#ff007f" },
        { name: "Lime", hex: "#00ff66" },
        { name: "Gold", hex: "#ffaa00" },
        { name: "Violet", hex: "#a200ff" }
      ];

      const colorsContainer = document.getElementById("garage-colors-list");
      colorsContainer.innerHTML = "";
      colorOptions.forEach(c => {
        const swatch = document.createElement("button");
        swatch.className = `color-swatch ${playerData.trailColor === c.hex ? "active" : ""}`;
        swatch.style.backgroundColor = c.hex;
        swatch.title = c.name;
        swatch.addEventListener("click", () => {
          window.soundEngine.playClickSFX();
          playerData.trailColor = c.hex;
          savePlayerData();
          this.renderGarageContent();
        });
        colorsContainer.appendChild(swatch);
      });
    }

    updateUI() {
      const topScore = document.getElementById("menu-high-score");
      if (topScore) topScore.textContent = playerData.highScore.toLocaleString();

      const menuCredits = document.getElementById("menu-credits");
      if (menuCredits) menuCredits.textContent = playerData.credits;
    }
  }

  // Launch once DOM is ready
  window.addEventListener("DOMContentLoaded", () => {
    window.game = new Game();
  });
})();
