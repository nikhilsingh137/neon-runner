/**
 * Urban Dash 4D - Metro Rush
 * Original High-Performance 3D Franchise Runner built with Three.js
 */

(function () {
  'use strict';

  // --- GAME CONFIGURATION ---
  const TRACK_SPACING = 2.8; // Calibrated for edge-to-edge mobile screens
  const LANES = [-TRACK_SPACING, 0, TRACK_SPACING]; // -1: Left, 0: Center, 1: Right
  const VISIBLE_DISTANCE = 260;
  const JUMP_HEIGHT = 4.6;
  const GRAVITY = 32.0;
  const TRAIN_HEIGHT = 3.5;
  const JETPACK_FLIGHT_Y = 8.5;
  const GROUND_CRYSTAL_Y = 1.2;
  let nextFlightCrystalZ = -16;

  // --- GAME STATE ---
  const state = {
    running: false,
    paused: false,
    score: 0,
    coins: 0, // Energy Crystals
    distance: 0,
    speed: 11, // Super relaxed beginner-friendly gentle start (13 KM/H)
    maxSpeed: 65, // Scales up smoothly as score & distance grow!
    currentLane: 0, // -1, 0, 1
    playerX: 0,
    targetX: 0,
    playerY: 0,
    groundY: 0,
    vy: 0,
    isJumping: false,
    isSliding: false,
    slideTimer: 0,
    slideDuration: 0.65,
    isBoosted: false,
    boostTimer: 0,
    overdriveCharge: 0,
    multiplier: 1,
    // 8 Epic Power-ups
    magnetTimer: 0,
    jetpackTimer: 0,
    sneakersTimer: 0,
    doublerTimer: 0,
    warpTimer: 0,
    ghostTimer: 0,
    vortexTimer: 0,
    skatesTimer: 0,
    hasShield: false,
    storedMagnets: 0,
    storedJetpacks: 0,
    // Settings
    controlMode: localStorage.getItem('urban_dash_control_mode') || 'swipe',
    theme: localStorage.getItem('urban_dash_theme') || 'dark'
  };

  // Career Records & High Scores (HS)
  let careerStats = {
    highScore: 0,
    totalCoins: 0,
    maxDistance: 0,
    totalRuns: 0,
    totalMagnets: 0,
    totalJetpacks: 0
  };

  try {
    const raw = localStorage.getItem('urban_dash_career_stats');
    if (raw) careerStats = Object.assign(careerStats, JSON.parse(raw));
  } catch (e) {}

  function saveCareerStats() {
    try {
      localStorage.setItem('urban_dash_career_stats', JSON.stringify(careerStats));
    } catch (e) {}
  }
  const savedData = careerStats;

  // --- THREE.JS GLOBALS ---
  let scene, camera, renderer;
  let playerGroup, kaiModel, hoverboardMesh, jetpackMesh, flameMeshL, flameMeshR;
  let skateFrameL, skateFrameR, skateWheelsL = [], skateWheelsR = [];
  let leftLeg, rightLeg, leftLowerLeg, rightLowerLeg, leftArm, rightArm, leftForearm, rightForearm, headMesh, capGroup;
  let tracksGroup, obstacles = [], coins = [], powerups = [];
  let trackTies = [], sideScenery = [], speedLines = [], flightSmokeParticles = [];
  let cityBuildingsGroup;
  let clock = new THREE.Clock();
  let runAnimTime = 0;
  let runnerSprite, runnerSpriteShadow;
  let runnerSpritePhase = 0;
  const RUNNER_ATLAS_COLUMNS = 4;
  const RUNNER_ATLAS_ROWS = 2;
  const metroSkies = new Map();
  const metroSkyArtwork = {};
  const platformTiles = new Map();
  const TRACK_SLEEPER_SPACING = 2.5;
  const trailLength = 24;
  const trailPoints = [];
  let trailRibbons = [];
  let trailDistance = 0;
  let hemiLight, sunLight;

  // DOM Elements
  const container = document.getElementById('game-container');
  const canvas = document.getElementById('gameCanvas');
  const hud = document.getElementById('hud');
  const hudScore = document.getElementById('hud-score');
  const hudCoins = document.getElementById('hud-credits');
  const hudSpeed = document.getElementById('hud-speed');
  const hudOverdriveFill = document.getElementById('hud-overdrive-fill');
  const virtualButtons = document.getElementById('virtual-buttons');
  const badgeMagnet = document.getElementById('badge-magnet');
  const timerMagnet = document.getElementById('timer-magnet');
  const badgeJetpack = document.getElementById('badge-jetpack');
  const timerJetpack = document.getElementById('timer-jetpack');
  const badgeSneakers = document.getElementById('badge-sneakers');
  const timerSneakers = document.getElementById('timer-sneakers');
  const badgeDoubler = document.getElementById('badge-doubler');
  const timerDoubler = document.getElementById('timer-doubler');
  const badgeWarp = document.getElementById('badge-warp');
  const timerWarp = document.getElementById('timer-warp');
  const badgeGhost = document.getElementById('badge-ghost');
  const timerGhost = document.getElementById('timer-ghost');
  const badgeVortex = document.getElementById('badge-vortex');
  const timerVortex = document.getElementById('timer-vortex');
  const badgeShield = document.getElementById('badge-shield');
  const badgeSkates = document.getElementById('badge-skates');
  const timerSkates = document.getElementById('timer-skates');

  // Quick-Use Power-Up Tray Elements
  const slotMagnet = document.getElementById('slot-magnet');
  const slotJetpack = document.getElementById('slot-jetpack');
  const slotMagnetCount = document.getElementById('slot-magnet-count');
  const slotJetpackCount = document.getElementById('slot-jetpack-count');
  const slotMagnetStatus = document.getElementById('slot-magnet-status');
  const slotJetpackStatus = document.getElementById('slot-jetpack-status');
  const hudToast = document.getElementById('hud-toast-msg');
  let toastTimer = null;

  function showToast(msg) {
    if (!hudToast) return;
    hudToast.textContent = msg;
    hudToast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hudToast.classList.add('hidden');
    }, 2200);
  }

  // --- DYNAMIC COMBO STREAK SYSTEM ---
  let comboStreak = 0;
  let comboResetTimer = 0;

  function addComboPoint(pts = 1) {
    if (!state.running || state.paused) return;
    comboStreak += pts;
    comboResetTimer = 3.8;
    const badge = document.getElementById('hud-combo-badge');
    const text = document.getElementById('hud-combo-text');
    if (!badge || !text) return;

    if (comboStreak >= 5) {
      badge.classList.remove('hidden');
      if (comboStreak >= 30) {
        text.textContent = `👑 ${comboStreak}x UNSTOPPABLE RUN!`;
        badge.className = 'hud-combo-badge legendary';
      } else if (comboStreak >= 15) {
        text.textContent = `⚡ ${comboStreak}x SICK MOVES!`;
        badge.className = 'hud-combo-badge epic';
      } else {
        text.textContent = `🔥 ${comboStreak}x COMBO RUSH!`;
        badge.className = 'hud-combo-badge active';
      }
      state.score += 25 * comboStreak;
    }
  }

  function updatePowerupSlotsUI() {
    if (slotMagnet && slotMagnetCount && slotMagnetStatus) {
      slotMagnetCount.textContent = state.storedMagnets;
      if (state.storedMagnets > 0) {
        slotMagnet.disabled = false;
        slotMagnetStatus.textContent = 'READY! TAP';
      } else {
        slotMagnet.disabled = true;
        slotMagnetStatus.textContent = 'STORED: 0';
      }
    }
    if (slotJetpack && slotJetpackCount && slotJetpackStatus) {
      slotJetpackCount.textContent = state.storedJetpacks;
      if (state.storedJetpacks > 0) {
        slotJetpack.disabled = false;
        slotJetpackStatus.textContent = 'READY! FLY';
      } else {
        slotJetpack.disabled = true;
        slotJetpackStatus.textContent = 'STORED: 0';
      }
    }
  }

  function useStoredMagnet() {
    if (!state.running || state.paused || state.storedMagnets <= 0) return;
    state.storedMagnets--;
    state.magnetTimer = 14.0;
    updatePowerupSlotsUI();
    showToast('🧲 CHUMBAK MAGNET ACTIVATED!');
    if (window.soundEngine) {
      window.soundEngine.playMagnetSFX();
      window.soundEngine.playPowerupSFX();
    }
  }

  function startJetpack(duration) {
    if (state.jetpackTimer <= 0) nextFlightCrystalZ = -16;
    state.jetpackTimer = Math.max(state.jetpackTimer, duration);
    state.vy = 0;
    state.isJumping = false;
    state.isSliding = false;
    state.slideTimer = 0;
    state.jumpBuffered = false;
  }

  function fillFlightCrystalTrail(distance) {
    nextFlightCrystalZ += distance;
    while (nextFlightCrystalZ > -84) {
      for (let lane = 0; lane < LANES.length; lane++) {
        createCrystal(lane, nextFlightCrystalZ, Math.max(GROUND_CRYSTAL_Y, state.playerY + 0.7), true);
      }
      nextFlightCrystalZ -= 4.5;
    }
  }

  function updateFlightCrystal(crystal, delta) {
    if (!crystal.userData.flightTrail) return;
    if (state.jetpackTimer > 0) {
      const targetY = Math.max(GROUND_CRYSTAL_Y, state.playerY + 0.7);
      crystal.position.y += (targetY - crystal.position.y) * (1 - Math.exp(-12 * delta));
    } else if (state.playerY <= state.groundY + 0.05) {
      crystal.position.y = GROUND_CRYSTAL_Y;
      crystal.userData.flightTrail = false;
    } else {
      crystal.position.y = Math.min(crystal.position.y, Math.max(GROUND_CRYSTAL_Y, state.playerY + 0.7));
    }
  }

  function useStoredJetpack() {
    if (!state.running || state.paused || state.storedJetpacks <= 0) return;
    state.storedJetpacks--;
    startJetpack(11);
    updatePowerupSlotsUI();
    showToast('🚀 JETPACK BLAST OFF!');
    if (window.soundEngine) {
      window.soundEngine.playJetpackSFX();
      window.soundEngine.playPowerupSFX();
    }
  }

  // Career Stats & High Score UI Updater
  function updateCareerStatsUI() {
    const elHs = document.getElementById('stats-high-score');
    const elCoins = document.getElementById('stats-total-crystals');
    const elDist = document.getElementById('stats-max-distance');
    const elRuns = document.getElementById('stats-total-runs');
    const elMags = document.getElementById('stats-total-magnets');
    const elJets = document.getElementById('stats-total-jetpacks');

    if (elHs) elHs.textContent = careerStats.highScore;
    if (elCoins) elCoins.textContent = careerStats.totalCoins;
    if (elDist) elDist.textContent = careerStats.maxDistance + ' m';
    if (elRuns) elRuns.textContent = careerStats.totalRuns;
    if (elMags) elMags.textContent = careerStats.totalMagnets;
    if (elJets) elJets.textContent = careerStats.totalJetpacks;

    const menuHighScore = document.getElementById('menu-high-score');
    const menuCredits = document.getElementById('menu-credits');
    if (menuHighScore) menuHighScore.textContent = careerStats.highScore;
    if (menuCredits) menuCredits.textContent = careerStats.totalCoins;
  }

  // Visual Theme Engine (Dark Cyber Night vs Bright Solar Day)
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem('urban_dash_theme', theme);

    const optDark = document.getElementById('opt-theme-dark');
    const optBright = document.getElementById('opt-theme-bright');

    if (theme === 'bright') {
      document.body.classList.add('theme-bright');
      document.body.classList.remove('theme-dark');
      if (optBright) optBright.classList.add('active');
      if (optDark) optDark.classList.remove('active');
      if (scene) {
        scene.background = getMetroSky('bright');
        if (scene.fog) scene.fog.color.setHex(0xe4a4a2);
      }
      if (hemiLight) {
        hemiLight.color.setHex(0xffffff);
        hemiLight.groundColor.setHex(0x94a3b8);
      }
      if (sunLight) {
        sunLight.color.setHex(0xfffbeb);
        sunLight.intensity = 1.4;
      }
    } else {
      // Midnight Cyber Metro (Rich cosmic indigo, stars & neon glow)
      document.body.classList.remove('theme-bright');
      document.body.classList.add('theme-dark');
      if (optDark) optDark.classList.add('active');
      if (optBright) optBright.classList.remove('active');
      if (scene) {
        scene.background = getMetroSky('dark');
        if (scene.fog) scene.fog.color.setHex(0xd091a0);
      }
      if (hemiLight) {
        hemiLight.color.setHex(0xffe1c2);
        hemiLight.groundColor.setHex(0xbb7887);
        hemiLight.intensity = 1.0;
      }
      if (sunLight) {
        sunLight.color.setHex(0xffcda2); // Warm, clean white directional light so skin, red kicks, white hoodie and blue denim pop!
        sunLight.intensity = 1.35;
      }
    }
    if (scene) {
      fitMetroSky();
      buildCityBuildings();
      if (tracksGroup) buildMetroEnvironment();
    }
  }

  // Screens & Modals
  const startScreen = document.getElementById('start-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const settingsModal = document.getElementById('settings-modal');
  const finalScoreEl = document.getElementById('final-score');
  const finalDistanceEl = document.getElementById('final-distance');
  const finalCreditsEl = document.getElementById('final-credits');
  const menuHighScore = document.getElementById('menu-high-score');
  const menuCredits = document.getElementById('menu-credits');
  const newRecordBadge = document.getElementById('new-record-badge');

  if (menuHighScore) menuHighScore.textContent = careerStats.highScore;
  if (menuCredits) menuCredits.textContent = careerStats.totalCoins;

  // Apply Control Mode UI (Swipe vs Touch Buttons)
  function applyControlMode(mode) {
    state.controlMode = mode;
    localStorage.setItem('urban_dash_control_mode', mode);

    const optSwipe = document.getElementById('opt-ctrl-swipe');
    const optButtons = document.getElementById('opt-ctrl-buttons');
    const touchOverlay = document.getElementById('touch-overlay');

    if (mode === 'buttons') {
      if (virtualButtons) virtualButtons.classList.remove('hidden');
      if (optButtons) optButtons.classList.add('active');
      if (optSwipe) optSwipe.classList.remove('active');
      if (touchOverlay) touchOverlay.style.pointerEvents = 'none'; // Disable swipe interception
    } else {
      // Clean fullscreen swipe mode
      if (virtualButtons) virtualButtons.classList.add('hidden');
      if (optSwipe) optSwipe.classList.add('active');
      if (optButtons) optButtons.classList.remove('active');
      if (touchOverlay) touchOverlay.style.pointerEvents = 'auto'; // Enable swipe interception
    }
  }

  // --- INITIALIZE 3D ENGINE ---
  function initEngine() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / height;

    // Scene with energetic cyan/sky blue
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0284c7);
    scene.fog = new THREE.Fog(0x0284c7, 100, VISIBLE_DISTANCE);

    // Dynamic Camera Framing (Classic Subway Surfers perspective - exact comfortable size as before)
    const fov = aspect < 0.65 ? 68 : 58;
    const camZ = aspect < 0.65 ? 8.8 : 7.8;
    const camY = aspect < 0.65 ? 4.8 : 4.2;

    camera = new THREE.PerspectiveCamera(fov, aspect, 0.5, 360);
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, 1.7, -18);

    // WebGL Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Sunlight & Ambience
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.95);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
    sunLight.position.set(20, 50, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 22;
    sunLight.shadow.camera.bottom = -22;
    scene.add(sunLight);

    // Rim Back-Light (Creates hero edge glow)
    const rimLight = new THREE.DirectionalLight(0x00f5d4, 0.85);
    rimLight.position.set(-15, 25, -35);
    scene.add(rimLight);

    // Apply Active Visual Theme & Controls
    applyTheme(state.theme);
    updateCareerStatsUI();
    updatePowerupSlotsUI();

    buildMetroEnvironment();
    loadMetroSkyArtwork();
    buildHeroKai();
    buildRunnerTrail();
    loadRunnerSprite();

    // Initialize Jetpack Billowing Flight Smoke Particle Pool
    flightSmokeParticles = [];
    const smokeGeom = new THREE.SphereGeometry(0.26, 8, 8);
    for (let i = 0; i < 28; i++) {
      const smMat = new THREE.MeshBasicMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sm = new THREE.Mesh(smokeGeom, smMat);
      sm.visible = false;
      sm.userData = { life: 0, maxLife: 0.6, vx: 0, vy: 0, vz: 0 };
      scene.add(sm);
      flightSmokeParticles.push(sm);
    }

    setupControls();
    applyControlMode(state.controlMode);

    window.addEventListener('resize', onWindowResize);
  }

  // --- BUILD HERO RUNNER (KAI - SUBWAY SURFERS AUTHENTIC 3D RUNNER HERO) ---
  function buildHeroKai() {
    playerGroup = new THREE.Group();

    // Kai wears matte cotton, denim, and canvas.
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd49164, roughness: 0.65, metalness: 0.0 }); // Warm skin tone
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x40261f, roughness: 0.70, metalness: 0.0 }); // Dark brown hair
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe95f39, roughness: 0.83, metalness: 0.0 }); // Terracotta canvas cap
    const capWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.40, metalness: 0.0 }); // Crisp white visor trim & button
    const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x70cfac, roughness: 0.95, metalness: 0.0 }); // Mint cotton fleece
    const denimMat = new THREE.MeshStandardMaterial({ color: 0x264f75, roughness: 0.96, metalness: 0.0 }); // Classic blue denim vest & jeans
    const denimDarkMat = new THREE.MeshStandardMaterial({ color: 0x213950, roughness: 0.96, metalness: 0.0 }); // Deep indigo denim accents
    const denimStitchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55, metalness: 0.0 }); // Gold denim stitching & rolled cuffs
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.80, metalness: 0.0 }); // Nylon strap
    const sneakerSoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.30, metalness: 0.0 }); // White rubber sole & bumper
    const sneakerTreadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.0 }); // Black rubber grip
    const sneakerRedMat = new THREE.MeshStandardMaterial({ color: 0xea6949, roughness: 0.60, metalness: 0.0 }); // Vibrant red skater canvas
    const sneakerWhiteTrim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.0 }); // Racing stripe & laces
    const wristbandMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, metalness: 0.0 }); // Red skater sweatband
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.20, metalness: 0.80 }); // Jetpack thrusters

    kaiModel = new THREE.Group();

    // Continuous fabric silhouette with rounded shoulders and a folded hem.
    const profile = [
      [0, 1.07], [0.33, 1.07], [0.409, 1.10], [0.427, 1.16],
      [0.445, 1.27], [0.465, 1.44], [0.452, 1.67], [0.432, 1.90],
      [0.375, 2.03], [0.288, 2.12], [0.19, 2.15], [0, 2.15]
    ].map(([radius, y]) => new THREE.Vector2(radius, y));
    const hoodie = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), hoodieMat);
    hoodie.scale.z = 0.81;
    hoodie.castShadow = true;
    kaiModel.add(hoodie);

    const hoodiePocket = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), hoodieMat);
    hoodiePocket.scale.set(0.309, 0.153, 0.075);
    hoodiePocket.position.set(0, 1.34, -0.345);
    kaiModel.add(hoodiePocket);

    const drawstring = new THREE.MeshLambertMaterial({ color: 0xffead1 });
    for (const side of [-1, 1]) {
      const path = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * 0.11, 2.04, -0.24),
        new THREE.Vector3(side * 0.04, 1.88, -0.40),
        new THREE.Vector3(side * 0.095, 1.67 + side * 0.025, -0.383)
      );
      kaiModel.add(new THREE.Mesh(new THREE.TubeGeometry(path, 12, 0.016, 6, false), drawstring));
    }

    // Folded White Hoodie Cowl / Neck Collar
    const hoodCollar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 10, 20), hoodieMat);
    hoodCollar.rotation.x = Math.PI / 2;
    hoodCollar.position.set(0, 2.16, 0.06);
    kaiModel.add(hoodCollar);

    // Folded hood and a soft canvas daypack, visible from the chase camera.
    const fabricShape = new THREE.SphereGeometry(1, 20, 14);
    const hood = new THREE.Mesh(fabricShape, hoodieMat);
    hood.scale.set(0.33, 0.27, 0.17);
    hood.position.set(0, 2.04, 0.30);
    hood.castShadow = true;
    kaiModel.add(hood);

    const packFabric = new THREE.MeshStandardMaterial({ color: 0xa64939, roughness: 0.95 });
    const packPocket = new THREE.MeshStandardMaterial({ color: 0xe17852, roughness: 0.9 });
    const pack = new THREE.Mesh(fabricShape, packFabric);
    pack.scale.set(0.31, 0.40, 0.19);
    pack.position.set(0, 1.57, 0.36);
    pack.castShadow = true;
    const pocket = new THREE.Mesh(fabricShape, packPocket);
    pocket.scale.set(0.237, 0.18, 0.08);
    pocket.position.set(0, 1.45, 0.51);
    kaiModel.add(pack, pocket);

    for (const side of [-1, 1]) {
      const strapPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.25, 1.36, -0.28),
        new THREE.Vector3(side * 0.29, 1.83, -0.30),
        new THREE.Vector3(side * 0.25, 2.07, 0),
        new THREE.Vector3(side * 0.24, 1.87, 0.40)
      ]);
      const strap = new THREE.Mesh(new THREE.TubeGeometry(strapPath, 12, 0.041, 6, false), packFabric);
      kaiModel.add(strap);
    }

    // 3. ORGANIC HANDSOME HEAD, FACE & BACKWARDS SNAPBACK CAP
    // Smooth Neck
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.26, 14), skinMat);
    neckMesh.position.set(0, 2.22, 0);
    kaiModel.add(neckMesh);

    headMesh = new THREE.Group();
    headMesh.position.set(0, 2.56, 0.02);

    // Sculpted Stylized Head Base (Organic round cartoon teen head)
    const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 20), skinMat);
    headBase.scale.set(0.95, 1.04, 0.98);
    headBase.castShadow = true;
    headMesh.add(headBase);

    // 3D Cartoon Cupped Ears
    [-0.37, 0.37].forEach((ex) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(ex, 0, 0);
      const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 12), skinMat);
      earOuter.scale.set(0.45, 1.1, 0.85);
      const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), hairMat);
      earInner.scale.set(0.4, 0.8, 0.6);
      earInner.position.z = -0.02;
      earGroup.add(earOuter);
      earGroup.add(earInner);
      headMesh.add(earGroup);
    });

    // Shallow eye shapes sit against the face and turn with its curve.
    const eyeShape = new THREE.SphereGeometry(1, 16, 12);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfff5e9, roughness: 0.7 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x694025, roughness: 0.65 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x21151a });
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xfffaff });
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.125, 0.046, -0.331);
      eye.rotation.y = -side * 0.36;
      const white = new THREE.Mesh(eyeShape, eyeWhiteMat);
      white.scale.set(0.077, 0.049, 0.025);
      eye.add(white);

      const iris = new THREE.Mesh(eyeShape, irisMat);
      iris.scale.set(0.034, 0.035, 0.009);
      iris.position.set(-side * 0.008, -0.005, -0.024);
      eye.add(iris);

      const pupil = new THREE.Mesh(eyeShape, pupilMat);
      pupil.scale.set(0.018, 0.022, 0.006);
      pupil.position.set(iris.position.x, iris.position.y, -0.032);
      eye.add(pupil);

      const catchlight = new THREE.Mesh(eyeShape, catchlightMat);
      catchlight.scale.setScalar(0.008);
      catchlight.position.set(pupil.position.x - 0.008, 0.007, -0.037);
      eye.add(catchlight);
      headMesh.add(eye);

      const brow = new THREE.Mesh(eyeShape, hairMat);
      brow.scale.set(0.07, 0.016, 0.022);
      brow.position.set(side * 0.132, 0.126, -0.313);
      brow.rotation.set(0, -side * 0.37, side * -0.16);
      headMesh.add(brow);
    }

    // Sculpted 3D Button Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), skinMat);
    nose.position.set(0, -0.04, -0.39);
    headMesh.add(nose);

    const smileCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.074, -0.128, -0.329),
      new THREE.Vector3(0.008, -0.197, -0.357),
      new THREE.Vector3(0.082, -0.119, -0.333)
    );
    const smileMat = new THREE.MeshStandardMaterial({ color: 0x7f3d35, roughness: 0.85 });
    headMesh.add(new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 14, 0.009, 6, false), smileMat));

    // Rounded, overlapping locks give Kai a soft hairline.
    const hairLock = new THREE.SphereGeometry(1, 14, 10);
    for (const [x, y, z, length, tilt] of [
      [-0.19, 0.18, -0.254, 0.13, -0.40],
      [-0.10, 0.21, -0.292, 0.15, -0.66],
      [0.012, 0.226, -0.302, 0.14, -0.86],
      [0.13, 0.213, -0.278, 0.11, -0.90],
      [-0.294, 0.015, -0.137, 0.10, -0.14],
      [0.294, 0.015, -0.137, 0.10, 0.14]
    ]) {
      const lock = new THREE.Mesh(hairLock, hairMat);
      lock.scale.set(0.077, length, 0.069);
      lock.position.set(x, y, z);
      lock.rotation.z = tilt;
      headMesh.add(lock);
    }

    // Backwards cap with a curved brim
    capGroup = new THREE.Group();
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.40, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.60),
      capMat
    );
    capDome.position.y = 0.06;
    capDome.castShadow = true;
    capGroup.add(capDome);

    // Center Top White Button
    const capButton = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), capWhiteMat);
    capButton.position.set(0, 0.46, 0);
    capGroup.add(capButton);

    // Flat Backwards Visor Brim (facing camera +Z with authentic skate tilt)
    const capBrim = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), capMat);
    capBrim.position.set(0, 0.04, 0.37);
    capBrim.scale.set(0.24, 0.024, 0.18);
    capBrim.rotation.x = 0.14;
    capBrim.castShadow = true;
    capGroup.add(capBrim);

    // Crisp White Trim on Visor Edge
    const capTrim = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), capWhiteMat);
    capTrim.position.set(0, 0.024, 0.373);
    capTrim.scale.set(0.23, 0.012, 0.18);
    capTrim.rotation.x = 0.14;
    capGroup.add(capTrim);

    // Flowing skater hair tufts peeking out under backwards cap
    const hairUnderCap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), hairMat);
    hairUnderCap.position.set(0, -0.08, 0.25);
    hairUnderCap.scale.set(0.22, 0.13, 0.105);
    capGroup.add(hairUnderCap);

    // Curls below the cap keep the boy's silhouette recognizable from behind.
    for (const [x, y, z, radius] of [
      [-0.24, -0.07, 0.25, 0.10], [-0.12, -0.15, 0.29, 0.10],
      [0.00, -0.16, 0.31, 0.10], [0.13, -0.14, 0.29, 0.11],
      [0.25, -0.07, 0.25, 0.10]
    ]) {
      const curl = new THREE.Mesh(hairLock, hairMat);
      curl.position.set(x, y, z);
      curl.scale.set(radius, radius * 0.95, radius * 0.83);
      headMesh.add(curl);
    }

    // Snapback Strap Opening at Back
    const strapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.03), strapMat);
    strapMesh.position.set(0, -0.02, 0.38);
    capGroup.add(strapMesh);

    headMesh.add(capGroup);
    kaiModel.add(headMesh);

    // 4. SLEEK JETPACK POWERUP (Mounted onto back during Jetpack flight)
    jetpackMesh = new THREE.Group();
    const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.72, 16), chromeMat);
    thrusterL.position.set(-0.42, 1.62, 0.42);
    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.42;
    jetpackMesh.add(thrusterL);
    jetpackMesh.add(thrusterR);

    // Dual Rocket Thruster Flame Cones
    const flameGeom = new THREE.ConeGeometry(0.14, 0.85, 12);
    flameGeom.rotateX(Math.PI);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    flameMeshL = new THREE.Mesh(flameGeom, flameMat);
    flameMeshL.position.set(-0.42, 1.05, 0.42);
    flameMeshR = new THREE.Mesh(flameGeom, flameMat);
    flameMeshR.position.set(0.42, 1.05, 0.42);
    jetpackMesh.add(flameMeshL);
    jetpackMesh.add(flameMeshR);

    // Inner bright yellow flame cores
    const innerFlameGeom = new THREE.ConeGeometry(0.08, 0.60, 10);
    innerFlameGeom.rotateX(Math.PI);
    const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const innerFL = new THREE.Mesh(innerFlameGeom, innerFlameMat);
    innerFL.position.set(-0.42, 1.15, 0.42);
    const innerFR = innerFL.clone();
    innerFR.position.x = 0.42;
    jetpackMesh.add(innerFL);
    jetpackMesh.add(innerFR);

    jetpackMesh.visible = false;
    kaiModel.add(jetpackMesh);

    // 5. ORGANIC ARTICULATED ARMS (White Hoodie Sleeves -> Elbows -> Forearms -> Natural Hands)
    // Left Arm
    leftArm = new THREE.Group();
    leftArm.position.set(-0.48, 2.02, 0);

    // Denim vest armhole cutout ring
    const vestRingL = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), denimMat);
    vestRingL.rotation.y = Math.PI / 2;
    vestRingL.position.set(0.04, 0, 0);
    leftArm.add(vestRingL);

    // Shoulder (White hoodie fabric)
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), hoodieMat);
    leftArm.add(shoulderL);

    // Upper Arm (White hoodie sleeve)
    const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.36, 14), hoodieMat);
    upperArmL.position.y = -0.24;
    upperArmL.castShadow = true;
    leftArm.add(upperArmL);

    // Elbow Pivot Sphere (White hoodie)
    const elbowL = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 12), hoodieMat);
    elbowL.position.y = -0.44;
    leftArm.add(elbowL);

    // Forearm Group (Joint pivot at elbow, natural human skin tone)
    leftForearm = new THREE.Group();
    leftForearm.position.set(0, -0.44, 0);

    const forearmMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.078, 0.36, 14), skinMat);
    forearmMeshL.position.y = -0.17;
    forearmMeshL.castShadow = true;
    leftForearm.add(forearmMeshL);

    // Skater Red Wrist Sweatband
    const wristbandL = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.024, 8, 16), wristbandMat);
    wristbandL.rotation.x = Math.PI / 2;
    wristbandL.position.y = -0.32;
    leftForearm.add(wristbandL);

    // Naturally Sculpted Cartoon Runner Hand (Curled fingers & thumb, NOT a square box!)
    const handGroupL = new THREE.Group();
    handGroupL.position.set(0, -0.40, 0);
    const palmL = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 12), skinMat);
    palmL.scale.set(0.9, 1.1, 0.75);
    const thumbL = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.08, 8), skinMat);
    thumbL.position.set(0.05, 0.01, -0.035);
    thumbL.rotation.z = -0.45;
    const fingersL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.10, 8), skinMat);
    fingersL.position.set(-0.02, -0.06, -0.02);
    handGroupL.add(palmL);
    handGroupL.add(thumbL);
    handGroupL.add(fingersL);
    leftForearm.add(handGroupL);

    leftForearm.rotation.x = 0.85;
    leftArm.add(leftForearm);
    kaiModel.add(leftArm);

    // Right Arm
    rightArm = new THREE.Group();
    rightArm.position.set(0.48, 2.02, 0);

    const vestRingR = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), denimMat);
    vestRingR.rotation.y = Math.PI / 2;
    vestRingR.position.set(-0.04, 0, 0);
    rightArm.add(vestRingR);

    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), hoodieMat);
    rightArm.add(shoulderR);

    const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.36, 14), hoodieMat);
    upperArmR.position.y = -0.24;
    upperArmR.castShadow = true;
    rightArm.add(upperArmR);

    const elbowR = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 12), hoodieMat);
    elbowR.position.y = -0.44;
    rightArm.add(elbowR);

    rightForearm = new THREE.Group();
    rightForearm.position.set(0, -0.44, 0);

    const forearmMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.078, 0.36, 14), skinMat);
    forearmMeshR.position.y = -0.17;
    forearmMeshR.castShadow = true;
    rightForearm.add(forearmMeshR);

    const wristbandR = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.024, 8, 16), wristbandMat);
    wristbandR.rotation.x = Math.PI / 2;
    wristbandR.position.y = -0.32;
    rightForearm.add(wristbandR);

    const handGroupR = new THREE.Group();
    handGroupR.position.set(0, -0.40, 0);
    const palmR = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 12), skinMat);
    palmR.scale.set(0.9, 1.1, 0.75);
    const thumbR = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.08, 8), skinMat);
    thumbR.position.set(-0.05, 0.01, -0.035);
    thumbR.rotation.z = 0.45;
    const fingersR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.10, 8), skinMat);
    fingersR.position.set(0.02, -0.06, -0.02);
    handGroupR.add(palmR);
    handGroupR.add(thumbR);
    handGroupR.add(fingersR);
    rightForearm.add(handGroupR);

    rightForearm.rotation.x = 0.85;
    rightArm.add(rightForearm);
    kaiModel.add(rightArm);

    // 6. ORGANIC ARTICULATED LEGS & SUBWAY RETRO RUNNER SNEAKERS
    function buildSubwaySneaker() {
      const sneakerGroup = new THREE.Group();

      // Black Traction Sole Grip
      const soleBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.68), sneakerTreadMat);
      soleBase.position.set(0, -0.08, -0.06);
      sneakerGroup.add(soleBase);

      // Sculpted Thick White Rubber Midsole (Rounded bevelled profile)
      const soleWhite = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.70), sneakerSoleMat);
      soleWhite.position.set(0, 0, -0.06);
      soleWhite.castShadow = true;
      sneakerGroup.add(soleWhite);

      // Signature White Rubber Skater Curved Toe Bumper Cap
      const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 14), sneakerSoleMat);
      toeCap.scale.set(0.98, 0.65, 0.95);
      toeCap.position.set(0, 0.03, -0.28);
      sneakerGroup.add(toeCap);

      // White Heel Counter & Pull Tab (Visible to player camera from behind!)
      const heelTab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.20, 0.06), sneakerWhiteTrim);
      heelTab.position.set(0, 0.14, 0.27);
      sneakerGroup.add(heelTab);

      // Vibrant Red Skater Canvas Upper (Rounded contoured upper)
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.165, 0.22, 14), sneakerRedMat);
      upper.scale.set(0.95, 1.0, 1.45);
      upper.position.set(0, 0.11, -0.03);
      sneakerGroup.add(upper);

      // White Side Racing Stripe
      [-0.155, 0.155].forEach((sideX) => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.36), sneakerWhiteTrim);
        stripe.position.set(sideX, 0.11, -0.03);
        sneakerGroup.add(stripe);
      });

      // Padded Tongue & Criss-Cross White Shoe Laces
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, 0.26), sneakerSoleMat);
      tongue.position.set(0, 0.16, -0.14);
      tongue.rotation.x = -0.20;
      sneakerGroup.add(tongue);

      // 3 Criss-Cross White Laces
      [-0.20, -0.14, -0.08].forEach((laceZ) => {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.035), sneakerWhiteTrim);
        lace.position.set(0, 0.22, laceZ);
        sneakerGroup.add(lace);
      });

      // 3D Inline Roller Skate Chassis & Glowing Wheels ("foot me wheel")
      const skateFrame = new THREE.Group();
      const frameBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.08, 0.64),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.2 })
      );
      frameBlade.position.set(0, -0.13, -0.06);
      skateFrame.add(frameBlade);

      const wheelGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.07, 14);
      wheelGeom.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.85,
        roughness: 0.2
      });
      const wheelCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const skateWheels = [];
      [-0.24, -0.06, 0.12].forEach((wZ) => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(0, -0.21, wZ);
        const wMesh = new THREE.Mesh(wheelGeom, wheelMat);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.08, 10), wheelCoreMat);
        core.rotation.z = Math.PI / 2;
        wheelGroup.add(wMesh);
        wheelGroup.add(core);
        skateFrame.add(wheelGroup);
        skateWheels.push(wheelGroup);
      });

      skateFrame.visible = false;
      sneakerGroup.add(skateFrame);
      sneakerGroup.userData = { skateFrame, skateWheels };

      return sneakerGroup;
    }

    // Left Leg Group (Hip pivot at y = 1.05)
    leftLeg = new THREE.Group();
    leftLeg.position.set(-0.24, 1.05, 0);

    // Thigh (Smooth Denim Jeans Cylinder)
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.145, 0.46, 16), denimMat);
    thighL.position.y = -0.23;
    thighL.castShadow = true;
    leftLeg.add(thighL);

    // Knee Pivot Sphere (Smooth anatomical joint)
    const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), denimMat);
    kneeL.position.y = -0.46;
    leftLeg.add(kneeL);

    // Knee Joint & Lower Leg Group
    leftLowerLeg = new THREE.Group();
    leftLowerLeg.position.set(0, -0.46, 0);

    // Calf / Shin (Smooth tapered cylinder)
    const calfL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.128, 0.44, 16), denimMat);
    calfL.position.y = -0.21;
    calfL.castShadow = true;
    leftLowerLeg.add(calfL);

    // Rolled Denim Donut Cuff at bottom of jeans
    const cuffL = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.042, 8, 18), denimStitchMat);
    cuffL.rotation.x = Math.PI / 2;
    cuffL.position.y = -0.41;
    leftLowerLeg.add(cuffL);

    // White Sport Ankle Sock
    const sockL = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.08, 14), sneakerSoleMat);
    sockL.position.y = -0.47;
    leftLowerLeg.add(sockL);

    // Left Retro Red Sneaker
    const leftSneaker = buildSubwaySneaker();
    leftSneaker.position.set(0, -0.50, 0);
    skateFrameL = leftSneaker.userData.skateFrame;
    skateWheelsL = leftSneaker.userData.skateWheels;
    leftLowerLeg.add(leftSneaker);

    leftLeg.add(leftLowerLeg);
    kaiModel.add(leftLeg);

    // Right Leg Group (Hip pivot at y = 1.05)
    rightLeg = new THREE.Group();
    rightLeg.position.set(0.24, 1.05, 0);

    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.145, 0.46, 16), denimMat);
    thighR.position.y = -0.23;
    thighR.castShadow = true;
    rightLeg.add(thighR);

    const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), denimMat);
    kneeR.position.y = -0.46;
    rightLeg.add(kneeR);

    rightLowerLeg = new THREE.Group();
    rightLowerLeg.position.set(0, -0.46, 0);

    const calfR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.128, 0.44, 16), denimMat);
    calfR.position.y = -0.21;
    calfR.castShadow = true;
    rightLowerLeg.add(calfR);

    const cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.042, 8, 18), denimStitchMat);
    cuffR.rotation.x = Math.PI / 2;
    cuffR.position.y = -0.41;
    rightLowerLeg.add(cuffR);

    const sockR = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.08, 14), sneakerSoleMat);
    sockR.position.y = -0.47;
    rightLowerLeg.add(sockR);

    const rightSneaker = buildSubwaySneaker();
    rightSneaker.position.set(0, -0.50, 0);
    skateFrameR = rightSneaker.userData.skateFrame;
    skateWheelsR = rightSneaker.userData.skateWheels;
    rightLowerLeg.add(rightSneaker);

    rightLeg.add(rightLowerLeg);
    kaiModel.add(rightLeg);

    // 7. HOVERBOARD (Visible during Boost / Shield)
    const boardGeom = new THREE.BoxGeometry(1.2, 0.10, 2.8);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.6
    });
    hoverboardMesh = new THREE.Mesh(boardGeom, boardMat);
    hoverboardMesh.position.set(0, -0.05, 0);
    hoverboardMesh.visible = false;
    kaiModel.add(hoverboardMesh);

    // Character Scale (Exact same comfortable size as before!)
    kaiModel.scale.set(1.0, 1.0, 1.0);
    kaiModel.rotation.y = 0; // Faces forward down tracks (-Z)
    playerGroup.add(kaiModel);
    scene.add(playerGroup);
  }

  // --- BUILD METRO ENVIRONMENT & MAGNETIC RAILS ---
  function loadRunnerSprite() {
    new THREE.TextureLoader().load('assets/kai-run-frames.png', (atlas) => {
      atlas.encoding = renderer.outputEncoding;
      atlas.minFilter = THREE.LinearFilter;
      atlas.generateMipmaps = false;
      atlas.repeat.set(1 / RUNNER_ATLAS_COLUMNS, 1 / RUNNER_ATLAS_ROWS);
      runnerSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: atlas,
        transparent: true,
        alphaTest: 0.48,
        toneMapped: false
      }));
      const height = 3.25;
      const cellAspect = (atlas.image.width / RUNNER_ATLAS_COLUMNS) / (atlas.image.height / RUNNER_ATLAS_ROWS);
      runnerSprite.scale.set(height * cellAspect, height, 1);
      runnerSprite.center.set(0.5, 0.045);
      runnerSprite.visible = false;

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
      gradient.addColorStop(0, '#ffffffb0');
      gradient.addColorStop(0.52, '#ffffff62');
      gradient.addColorStop(1, '#ffffff00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      runnerSpriteShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.67, 1.10), new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        color: 0x291a2c,
        transparent: true,
        depthWrite: false,
        opacity: 0.66
      }));
      runnerSpriteShadow.rotation.x = -Math.PI / 2;
      runnerSpriteShadow.position.y = 0.035;
      runnerSpriteShadow.visible = false;
      playerGroup.add(runnerSpriteShadow, runnerSprite);
    });
  }

  function updateRunnerSprite(delta) {
    if (!runnerSprite) return;

    const showRunner = state.running && !state.isJumping && !state.isSliding &&
      !state.isBoosted && state.jetpackTimer <= 0 && state.skatesTimer <= 0 &&
      state.playerY <= state.groundY + 0.06;
    runnerSprite.visible = showRunner;
    runnerSpriteShadow.visible = showRunner;
    kaiModel.visible = !showRunner;
    if (!showRunner) return;

    const count = RUNNER_ATLAS_COLUMNS * RUNNER_ATLAS_ROWS;
    if (!state.paused) {
      runnerSpritePhase = (runnerSpritePhase + delta * (10 + Math.min(8, state.speed * 0.25))) % count;
    }
    const frame = Math.floor(runnerSpritePhase);
    const atlas = runnerSprite.material.map;
    atlas.offset.set(
      (frame % RUNNER_ATLAS_COLUMNS) / RUNNER_ATLAS_COLUMNS,
      1 - (Math.floor(frame / RUNNER_ATLAS_COLUMNS) + 1) / RUNNER_ATLAS_ROWS
    );
    runnerSprite.position.y = 0.04 + Math.abs(Math.sin(runnerSpritePhase * Math.PI / 4)) * 0.065;
    runnerSprite.material.rotation = THREE.MathUtils.clamp((state.targetX - state.playerX) * -0.09, -0.22, 0.22);
    runnerSprite.material.opacity = state.ghostTimer > 0 ? 0.52 : 1;
  }

  function buildRunnerTrail() {
    const indices = [];
    for (let i = 0; i < trailLength - 1; i++) {
      const edge = i * 2;
      indices.push(edge, edge + 1, edge + 2, edge + 1, edge + 3, edge + 2);
    }

    trailRibbons = [0x61f4df, 0xffb681].map((color) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setIndex(indices);
      const edges = Float32Array.from({ length: trailLength * 2 }, (_, i) => i % 2 === 0 ? -1 : 1);
      geometry.setAttribute('edge', new THREE.BufferAttribute(edges, 1));
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailLength * 6), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(trailLength * 2), 1).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.ShaderMaterial({
        uniforms: { tint: { value: new THREE.Color(color) } },
        vertexShader: `
          attribute float glow;
          attribute float edge;
          varying float opacity;
          varying float across;
          void main() {
            opacity = glow;
            across = edge;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 tint;
          varying float opacity;
          varying float across;
          void main() {
            float feather = 1.0 - smoothstep(0.08, 1.0, abs(across));
            gl_FragColor = vec4(tint, opacity * feather);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const ribbon = new THREE.Mesh(geometry, material);
      ribbon.frustumCulled = false;
      ribbon.visible = false;
      scene.add(ribbon);
      return ribbon;
    });
  }

  function updateRunnerTrail(distance) {
    trailDistance += distance;
    const trailY = 0.075 + state.playerY * 0.65;
    const last = trailPoints[0];
    const gap = last ? trailDistance - last.distance : 0;
    if (!last || gap >= 0.24) {
      const point = trailPoints.length === trailLength ? trailPoints.pop() : {};
      point.x = state.playerX;
      point.y = trailY;
      point.distance = trailDistance;
      trailPoints.unshift(point);
    }

    const strength = state.isBoosted ? 0.86 : Math.min(0.62, 0.36 + state.speed * 0.005);
    const reach = state.isBoosted ? 10 : 5.4;
    for (let lane = 0; lane < trailRibbons.length; lane++) {
      const geometry = trailRibbons[lane].geometry;
      const vertices = geometry.getAttribute('position');
      const glow = geometry.getAttribute('glow');
      geometry.setDrawRange(0, trailPoints.length * 6 - 6);

      for (let i = 0; i < trailPoints.length; i++) {
        const point = trailPoints[i];
        const depth = trailDistance - point.distance;
        const taper = Math.max(0, 1 - depth / reach);
        const width = (state.isBoosted ? 0.19 : 0.115) * taper;
        const offset = (lane === 0 ? -1 : 1) * (0.21 + depth * 0.03);
        const x = point.x + offset;
        const y = point.y + lane * 0.014;
        const opacity = strength * taper * taper * Math.min(1, (trailPoints.length - 1 - i) / 3);
        vertices.setXYZ(i * 2, x - width, y, depth + 0.18);
        vertices.setXYZ(i * 2 + 1, x + width, y, depth + 0.18);
        glow.setX(i * 2, opacity);
        glow.setX(i * 2 + 1, opacity);
      }
      vertices.needsUpdate = true;
      glow.needsUpdate = true;
    }
  }

  function buildMetroEnvironment() {
    if (tracksGroup) scene.remove(tracksGroup);
    tracksGroup = new THREE.Group();
    trackTies = [];
    sideScenery = [];
    speedLines = [];

    const isBright = state.theme === 'bright';
    const groundColor = isBright ? 0xae786d : 0x805662; // Crisp light ballast in Day vs Deep midnight in Night
    const trimColor = isBright ? 0xffd875 : 0xfbb06b;
    const dividerColor = isBright ? 0xd0a897 : 0xa47d84;
    const tieWoodColor = isBright ? 0x905b42 : 0x744555;
    const railColor = isBright ? 0xc9b4ab : 0xb99ba2;

    // 1. High-Tech Ground Bed
    const groundGeom = new THREE.PlaneGeometry(36, 600);
    const groundMat = new THREE.MeshLambertMaterial({ color: groundColor });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -150);
    ground.receiveShadow = true;
    tracksGroup.add(ground);

    // Raised platforms leave the skyline open on both sides of the tracks.
    const platformGeom = new THREE.BoxGeometry(5, 0.75, 600);
    const platformMat = new THREE.MeshLambertMaterial({ color: isBright ? 0xd69e88 : 0xa16c75 });
    const platformTop = new THREE.MeshLambertMaterial({ map: getPlatformTiles(isBright) });
    const platformMaterials = [platformMat, platformMat, platformTop, platformMat, platformMat, platformMat];
    const edgeGeom = new THREE.BoxGeometry(0.32, 0.07, 600);
    const edgeMat = new THREE.MeshLambertMaterial({ color: trimColor });
    for (const side of [-1, 1]) {
      const platform = new THREE.Mesh(platformGeom, platformMaterials);
      platform.position.set(side * 9.8, 0.29, -150);
      platform.receiveShadow = true;
      tracksGroup.add(platform);

      const edge = new THREE.Mesh(edgeGeom, edgeMat);
      edge.position.set(side * 7.49, 0.70, -150);
      tracksGroup.add(edge);
    }

    // 3. Track Dividers (Safety Curbs between lanes)
    const dividerGeom = new THREE.BoxGeometry(0.3, 0.25, 600);
    const dividerMat = new THREE.MeshLambertMaterial({ color: dividerColor });
    [-TRACK_SPACING / 2, TRACK_SPACING / 2].forEach((dx) => {
      const divider = new THREE.Mesh(dividerGeom, dividerMat);
      divider.position.set(dx, 0.12, -150);
      tracksGroup.add(divider);
    });

    // 4. Steel Rail Tracks for the 3 Lanes
    const railMat = new THREE.MeshStandardMaterial({
      color: railColor,
      metalness: 0.37,
      roughness: 0.42
    });

    LANES.forEach((laneX) => {
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railL.position.set(laneX - 0.85, 0.1, -150);
      tracksGroup.add(railL);

      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railR.position.set(laneX + 0.85, 0.1, -150);
      tracksGroup.add(railR);
    });

    const rowCount = 138;
    const sleeperCount = rowCount * LANES.length;
    const sleeperMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.15, 0.14, 0.46),
      new THREE.MeshStandardMaterial({ color: tieWoodColor, roughness: 0.85 }),
      sleeperCount
    );
    sleeperMesh.receiveShadow = true;
    const fasteners = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.48),
      new THREE.MeshLambertMaterial({ color: isBright ? 0x9c7776 : 0x775967 }),
      sleeperCount * 2
    );
    const sleeperMatrix = new THREE.Matrix4();
    let index = 0;
    for (let row = 0; row < rowCount; row++) {
      const z = 25 - row * TRACK_SLEEPER_SPACING;
      for (const laneX of LANES) {
        sleeperMesh.setMatrixAt(index, sleeperMatrix.makeTranslation(laneX, 0.02, z));
        fasteners.setMatrixAt(index * 2, sleeperMatrix.makeTranslation(laneX - 0.85, 0.04, z));
        fasteners.setMatrixAt(index * 2 + 1, sleeperMatrix.makeTranslation(laneX + 0.85, 0.04, z));
        index++;
      }
    }
    sleeperMesh.frustumCulled = false;
    fasteners.frustumCulled = false;
    tracksGroup.add(sleeperMesh, fasteners);
    trackTies.push(sleeperMesh, fasteners);

    addStationCanopies(isBright);

    // 7. HIGH-SPEED AERODYNAMIC WIND STREAKS (Visual speed sensation)
    const lineMat = new THREE.MeshBasicMaterial({
      color: isBright ? 0xffffff : 0x38bdf8,
      transparent: true,
      opacity: isBright ? 0.35 : 0.55
    });
    for (let i = 0; i < 20; i++) {
      const sLine = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4.5, 6), lineMat);
      sLine.rotation.x = Math.PI / 2;
      sLine.position.set(
        (Math.random() - 0.5) * 12.0,
        1.2 + Math.random() * 3.5,
        -Math.random() * 260
      );
      tracksGroup.add(sLine);
      speedLines.push(sLine);
    }

    scene.add(tracksGroup);
  }

  // The metro skyline sits behind the open platforms.
  function getPlatformTiles(isBright) {
    if (platformTiles.has(isBright)) return platformTiles.get(isBright);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const palette = isBright
      ? ['#d89c8b', '#e3ad95', '#cd9088', '#de9d86']
      : ['#b67d86', '#c68a88', '#d4948b', '#a87381'];

    ctx.fillStyle = isBright ? '#af766e' : '#895b6e';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < palette.length; i++) {
      const x = (i % 2) * 64;
      const y = Math.floor(i / 2) * 64;
      ctx.fillStyle = palette[i];
      ctx.fillRect(x + 1, y + 1, 62, 62);
      ctx.fillStyle = '#ffdfbc3b';
      ctx.fillRect(x + 2, y + 2, 60, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 150);
    platformTiles.set(isBright, texture);
    return texture;
  }

  function addStationCanopies(isBright) {
    const coral = new THREE.MeshLambertMaterial({ color: isBright ? 0xef806b : 0xd66b76 });
    const trim = new THREE.MeshLambertMaterial({ color: 0xfcad76 });
    const gold = new THREE.MeshBasicMaterial({ color: 0xffd69b });
    const planter = new THREE.MeshLambertMaterial({ color: 0xb96267 });
    const foliage = new THREE.MeshLambertMaterial({ color: 0x398757 });
    const blooms = new THREE.MeshLambertMaterial({ color: 0xea598b });

    const column = new THREE.CylinderGeometry(0.24, 0.30, 4, 12);
    const roof = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const soffit = new THREE.CylinderGeometry(1, 1, 0.11, 22);
    const lamp = new THREE.SphereGeometry(1, 8, 6);
    const potShape = new THREE.CylinderGeometry(0.70, 0.52, 0.75, 12);
    const leaf = new THREE.SphereGeometry(1, 8, 5);
    const cluster = new THREE.IcosahedronGeometry(0.22, 0);
    const palmStem = new THREE.CylinderGeometry(0.11, 0.19, 4.8, 8);
    const palmBark = new THREE.MeshLambertMaterial({ color: 0x8c5b4a });

    for (let z = 18; z > -327; z -= 23) {
      for (const side of [-1, 1]) {
        const station = new THREE.Group();
        station.position.set(side * 9.65, 0.68, z + (side > 0 ? -9 : 0));

        const support = new THREE.Mesh(column, coral);
        support.position.set(side * 0.65, 2, 0);
        const canopy = new THREE.Mesh(roof, coral);
        canopy.position.set(0, 4.02, 0);
        canopy.scale.set(2.22, 0.55, 4.1);
        const rim = new THREE.Mesh(soffit, trim);
        rim.position.copy(canopy.position);
        rim.scale.set(2.22, 1, 4.1);
        const light = new THREE.Mesh(lamp, gold);
        light.position.set(-side * 1.15, 3.92, 0);
        light.scale.set(0.16, 0.075, 2.35);
        station.add(support, canopy, rim, light);

        const pot = new THREE.Mesh(potShape, planter);
        pot.position.set(-side * 1.13, 0.37, 5.4);
        const bush = new THREE.Mesh(leaf, foliage);
        bush.position.set(pot.position.x, 0.91, 5.4);
        bush.scale.set(0.7, 0.48, 0.65);
        station.add(pot, bush);
        for (let i = 0; i < 3; i++) {
          const flower = new THREE.Mesh(cluster, blooms);
          flower.position.set(pot.position.x + (i - 1) * 0.36, 1.16 + (i % 2) * 0.13, 5.45);
          station.add(flower);
        }

        if (side > 0) {
          const palm = new THREE.Group();
          palm.position.set(1.45, 0, -6);
          const trunk = new THREE.Mesh(palmStem, palmBark);
          trunk.position.y = 2.35;
          palm.add(trunk);
          for (let i = 0; i < 5; i++) {
            const branch = new THREE.Group();
            branch.position.y = 4.74;
            branch.rotation.y = i * Math.PI * 0.4;
            const frond = new THREE.Mesh(leaf, foliage);
            frond.position.set(0, -0.06, 0.77);
            frond.scale.set(0.31, 0.12, 1.06);
            frond.rotation.x = 0.20;
            branch.add(frond);
            palm.add(branch);
          }
          station.add(palm);
        }

        tracksGroup.add(station);
        sideScenery.push(station);
      }
    }
  }

  function buildCityBuildings() {
    if (cityBuildingsGroup) scene.remove(cityBuildingsGroup);
    cityBuildingsGroup = new THREE.Group();
    const bright = state.theme === 'bright';
    const stone = new THREE.MeshLambertMaterial({ color: bright ? 0xc5a2d5 : 0xb382b3 });
    const ledges = new THREE.MeshLambertMaterial({ color: bright ? 0xebc4d4 : 0xd5a0b9 });
    const panes = new THREE.MeshBasicMaterial({ color: bright ? 0xffdcad : 0xebb389 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const crownGeometry = new THREE.CylinderGeometry(0.42, 0.5, 1, 12);

    const addStone = (tower, geometry, material, width, height, depth, x, y, z) => {
      const piece = new THREE.Mesh(geometry, material);
      piece.scale.set(width, height, depth);
      piece.position.set(x, y, z);
      tower.add(piece);
    };

    for (const side of [-1, 1]) {
      for (let row = 0; row < 8; row++) {
        const tower = new THREE.Group();
        const height = 11 + (row * 7 + (side > 0 ? 5 : 0)) % 12;
        const width = 6.2 + row % 3;
        tower.position.set(side * (26 + (row % 3) * 4), 0, -20 - row * 37 - (side < 0 ? 9 : 0));

        addStone(tower, box, stone, width, height, 8, 0, height / 2, 0);
        addStone(tower, box, ledges, width + 0.36, 0.29, 8.36, 0, height, 0);
        addStone(tower, box, stone, width * 0.73, 3.5, 5.5, 0, height + 1.75, 0);
        addStone(tower, crownGeometry, ledges, width * 0.57, 2.9, 4.3, 0, height + 4.8, 0);
        addStone(tower, crownGeometry, ledges, 0.34, 1.5, 0.34, 0, height + 6.9, 0);

        const windowRows = Math.floor(height / 2.6);
        const windows = new THREE.InstancedMesh(box, panes, windowRows * 6);
        const marker = new THREE.Matrix4();
        let index = 0;
        for (let floor = 0; floor < windowRows; floor++) {
          const y = 2 + floor * 2.6;
          for (const spacing of [-1, 0, 1]) {
            marker.makeScale(0.66, 1.28, 0.08).setPosition(spacing * width * 0.28, y, 4.02);
            windows.setMatrixAt(index++, marker);
            marker.makeScale(0.08, 1.28, 0.65).setPosition(-side * (width / 2 + 0.02), y, spacing * 2.3);
            windows.setMatrixAt(index++, marker);
          }
        }
        windows.frustumCulled = false;
        tower.add(windows);
        cityBuildingsGroup.add(tower);
      }
    }
    scene.add(cityBuildingsGroup);
  }

  function loadMetroSkyArtwork() {
    const loader = new THREE.TextureLoader();
    loader.load('assets/metro-sunset-wide.jpg', (texture) => setMetroSkyArtwork('wide', texture));
    loader.load('assets/metro-sunset-portrait.jpg', (texture) => setMetroSkyArtwork('portrait', texture));
  }

  function setMetroSkyArtwork(layout, texture) {
    texture.encoding = THREE.sRGBEncoding;
    metroSkyArtwork[layout] = texture;
    fitMetroSky();
  }

  function getMetroSky(theme) {
    if (metroSkies.has(theme)) return metroSkies.get(theme);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const bright = theme === 'bright';
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, bright ? '#945fbb' : '#70508a');
    sky.addColorStop(0.27, bright ? '#f38fbc' : '#b3649d');
    sky.addColorStop(0.52, bright ? '#ffd097' : '#f4ab8d');
    sky.addColorStop(1, bright ? '#e7a4c7' : '#9d6381');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(710, 172, 12, 710, 172, 180);
    glow.addColorStop(0, bright ? '#fff1abdd' : '#ffae9aa0');
    glow.addColorStop(0.4, bright ? '#ffcc7880' : '#ff9a9d52');
    glow.addColorStop(1, '#ffb38f00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bright ? '#fff5c4' : '#ffd2b3';
    ctx.beginPath();
    ctx.arc(710, 172, bright ? 33 : 22, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    metroSkies.set(theme, texture);
    return texture;
  }

  function fitMetroSky() {
    if (!scene || !camera) return;
    const aspect = camera.aspect;
    const layout = aspect <= 1 ? 'portrait' : 'wide';
    const sky = metroSkyArtwork[layout] || getMetroSky(state.theme);
    const imageAspect = sky.image.width / sky.image.height;
    sky.repeat.set(Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
    sky.offset.set((1 - sky.repeat.x) / 2, (1 - sky.repeat.y) / 2);
    scene.background = sky;
  }

  function createMonorailObstacle(laneIndex, zPos, hasRamp = false) {
    const trainGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    trainGroup.position.set(laneX, 0, zPos);

    const trainDepth = 26;

    // Rounded teal carriage shell
    const shell = new THREE.Shape();
    shell.moveTo(-1.05, -TRAIN_HEIGHT / 2 + 0.12);
    shell.lineTo(1.05, -TRAIN_HEIGHT / 2 + 0.12);
    shell.lineTo(1.05, TRAIN_HEIGHT / 2 - 0.43);
    shell.quadraticCurveTo(1.05, TRAIN_HEIGHT / 2 - 0.12, 0.72, TRAIN_HEIGHT / 2 - 0.12);
    shell.lineTo(-0.72, TRAIN_HEIGHT / 2 - 0.12);
    shell.quadraticCurveTo(-1.05, TRAIN_HEIGHT / 2 - 0.12, -1.05, TRAIN_HEIGHT / 2 - 0.43);
    shell.closePath();
    const bodyGeom = new THREE.ExtrudeGeometry(shell, {
      depth: trainDepth - 0.24,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 3,
      curveSegments: 5
    });
    bodyGeom.translate(0, 0, -trainDepth / 2 + 0.12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x27aaa1,
      roughness: 0.42,
      metalness: 0.15
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = TRAIN_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    trainGroup.add(body);

    // Gold carriage beltline
    const stripeGeom = new THREE.BoxGeometry(2.36, 0.19, trainDepth);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffc764 });
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.y = TRAIN_HEIGHT * 0.48;
    trainGroup.add(stripe);

    // Runnable Roof
    const roofGeom = new THREE.BoxGeometry(1.82, 0.15, trainDepth - 0.4);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xedbb9d,
      roughness: 0.35,
      metalness: 0.3
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = TRAIN_HEIGHT + 0.06;
    roof.receiveShadow = true;
    trainGroup.add(roof);

    // Aerodynamic Bullet Nose Windshield (+Z)
    const frontWindshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.88, 1.23, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3a344d, roughness: 0.24, metalness: 0.23 })
    );
    frontWindshield.position.set(0, 2.4, trainDepth / 2 + 0.05);
    trainGroup.add(frontWindshield);

    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x865066, roughness: 0.32, metalness: 0.17,
      emissive: 0xd17f4b, emissiveIntensity: 0.26
    });
    const sideWindows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.88, 1.86), windowMaterial, 16);
    const windowMatrix = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) {
      const z = -10.5 + i * 3;
      sideWindows.setMatrixAt(i * 2, windowMatrix.makeTranslation(-1.18, 2.34, z));
      sideWindows.setMatrixAt(i * 2 + 1, windowMatrix.makeTranslation(1.18, 2.34, z));
    }
    sideWindows.frustumCulled = false;
    trainGroup.add(sideWindows);

    const underframe = new THREE.Mesh(
      new THREE.BoxGeometry(1.99, 0.28, trainDepth - 0.82),
      new THREE.MeshStandardMaterial({ color: 0x37323d, roughness: 0.82 })
    );
    underframe.position.y = 0.21;
    trainGroup.add(underframe);

    const wheels = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0x302934, roughness: 0.76 }),
      8
    );
    const wheelMatrix = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
    let wheelIndex = 0;
    for (const x of [-1.14, 1.14]) {
      for (const z of [-9.4, -7.6, 7.6, 9.4]) {
        wheels.setMatrixAt(wheelIndex++, wheelMatrix.setPosition(x, 0.36, z));
      }
    }
    wheels.frustumCulled = false;
    trainGroup.add(wheels);

    const doorMat = new THREE.MeshLambertMaterial({ color: 0x186e73 });
    const seamGeometry = new THREE.BoxGeometry(0.035, 2.78, 0.042);
    for (const x of [-1.188, 1.188]) {
      for (const z of [-6, 6]) {
        for (const offset of [-0.83, 0, 0.83]) {
          const seam = new THREE.Mesh(seamGeometry, doorMat);
          seam.position.set(x, 1.65, z + offset);
          trainGroup.add(seam);
        }
      }
    }

    // Warm carriage headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffdfa0 });
    const lightL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 10), lightMat);
    lightL.rotation.x = Math.PI / 2;
    lightL.scale.x = 1.45;
    lightL.position.set(-0.75, 1.1, trainDepth / 2 + 0.05);
    const lightR = lightL.clone();
    lightR.position.x = 0.75;
    trainGroup.add(lightL);
    trainGroup.add(lightR);

    // Front Bumper Cowcatcher
    const grill = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.6, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1e293b })
    );
    grill.position.set(0, 0.45, trainDepth / 2);
    trainGroup.add(grill);

    // Optional Sloped Ramp at front
    if (hasRamp) {
      const rampLength = 5.5;
      const rampGeom = new THREE.BoxGeometry(2.3, 0.3, rampLength);
      const rampMat = new THREE.MeshLambertMaterial({ color: 0x358b88 });
      const ramp = new THREE.Mesh(rampGeom, rampMat);
      ramp.position.set(0, TRAIN_HEIGHT / 2, trainDepth / 2 + rampLength / 2);
      ramp.rotation.x = -Math.atan2(TRAIN_HEIGHT, rampLength);
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      trainGroup.add(ramp);
    }

    trainGroup.userData = {
      type: 'train',
      lane: laneIndex,
      width: 2.35,
      height: TRAIN_HEIGHT,
      depth: trainDepth,
      hasRamp: hasRamp,
      frontZ: trainDepth / 2 + (hasRamp ? 5.5 : 0),
      backZ: -trainDepth / 2
    };

    scene.add(trainGroup);
    obstacles.push(trainGroup);

    // Ground-level rewards resume just past the train.
    for (let gap = 3; gap <= 9; gap += 3) {
      createCrystal(laneIndex, zPos - trainDepth / 2 - gap);
    }
  }

  // --- SCI-FI BARRIERS: ELECTRIC PLASMA GATE & OVERHEAD LASER GANTRY ---
  function createHurdleObstacle(laneIndex, zPos) {
    const hurdleGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    hurdleGroup.position.set(laneX, 0, zPos);

    // High-tech Electric Plasma Barricade (Jump Over!)
    const barGeom = new THREE.BoxGeometry(2.35, 0.38, 0.28);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff3366,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8
    });
    const bar = new THREE.Mesh(barGeom, barMat);
    bar.position.y = 0.95;
    bar.castShadow = true;
    hurdleGroup.add(bar);

    // Hazard Stripes & Laser Core
    [-0.7, 0, 0.7].forEach((sx) => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      stripe.position.set(sx, 0.95, 0);
      hurdleGroup.add(stripe);
    });

    const plasmaCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    plasmaCore.rotation.z = Math.PI / 2;
    plasmaCore.position.set(0, 0.95, 0.16);
    hurdleGroup.add(plasmaCore);

    // Heavy Titanium Magnetic Pylons
    const legGeom = new THREE.CylinderGeometry(0.12, 0.16, 1.15, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
    const legL = new THREE.Mesh(legGeom, legMat);
    legL.position.set(-1.12, 0.58, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 1.12;
    hurdleGroup.add(legL);
    hurdleGroup.add(legR);

    // Floating Glowing Hologram "▲ JUMP"
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 160;
    signCanvas.height = 64;
    const sctx = signCanvas.getContext('2d');
    sctx.fillStyle = '#10b981';
    sctx.font = 'bold 30px Fredoka One, sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.shadowColor = '#059669';
    sctx.shadowBlur = 10;
    sctx.fillText('▲ JUMP ▲', 80, 32);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true, opacity: 0.95 }));
    signSprite.scale.set(1.5, 0.6, 1);
    signSprite.position.set(0, 1.85, 0);
    hurdleGroup.add(signSprite);

    hurdleGroup.userData = {
      type: 'hurdle',
      lane: laneIndex,
      width: 2.35,
      height: 1.15,
      depth: 0.4
    };

    scene.add(hurdleGroup);
    obstacles.push(hurdleGroup);
  }

  let slideGateSign;

  function getSlideGateSign() {
    if (slideGateSign) return slideGateSign;

    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#401f29';
    ctx.fillRect(0, 0, 384, 192);
    ctx.fillStyle = '#ef9a54';
    ctx.fillRect(0, 0, 384, 24);
    ctx.fillRect(0, 170, 384, 22);
    ctx.fillStyle = '#45262c';
    for (let x = -28; x < 384; x += 46) {
      for (const y of [0, 170]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 16, y);
        ctx.lineTo(x + 38, y + 22);
        ctx.lineTo(x + 22, y + 22);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#fff3d8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SLIDE', 192, 68);

    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffc36d';
    for (const x of [112, 192, 272]) {
      ctx.beginPath();
      ctx.moveTo(x - 24, 115);
      ctx.lineTo(x, 139);
      ctx.lineTo(x + 24, 115);
      ctx.stroke();
    }

    slideGateSign = new THREE.CanvasTexture(canvas);
    return slideGateSign;
  }

  function createOverheadSlideObstacle(laneIndex, zPos) {
    const beamGroup = new THREE.Group();
    beamGroup.position.set(LANES[laneIndex], 0, zPos);

    const frame = new THREE.MeshStandardMaterial({ color: 0xaa4436, roughness: 0.72 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xffb777, roughness: 0.52 });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffd28a });
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(2.55, 1.12, 0.38), frame);
    gantry.position.y = 2.25;
    gantry.castShadow = true;

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.27, 1.04),
      new THREE.MeshBasicMaterial({ map: getSlideGateSign(), toneMapped: false })
    );
    sign.position.set(0, 2.25, 0.199);

    const clearance = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.10, 0.38), lamp);
    clearance.position.y = 1.69;
    beamGroup.add(gantry, sign, clearance);

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.85, 0.34), frame);
      post.position.set(side * 1.27, 1.43, 0);
      const footing = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.24, 0.59), trim);
      footing.position.set(side * 1.27, 0.12, 0);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.096, 10, 8), lamp);
      light.position.set(side * 1.19, 2.89, 0.08);
      beamGroup.add(post, footing, light);
    }

    const approach = new THREE.Mesh(
      new THREE.PlaneGeometry(1.36, 2.25),
      new THREE.MeshBasicMaterial({ color: 0xf9a152, transparent: true, opacity: 0.26, depthWrite: false })
    );
    approach.rotation.x = -Math.PI / 2;
    approach.position.set(0, 0.055, 2.7);
    beamGroup.add(approach);

    beamGroup.userData = {
      type: 'overhead',
      lane: laneIndex,
      width: 2.55,
      height: 3.4,
      slideClearance: 1.65,
      depth: 0.4
    };

    scene.add(beamGroup);
    obstacles.push(beamGroup);
  }

  // --- GLOWING ENERGY CRYSTALS (COLLECTIBLES) ---
  const crystalGeom = new THREE.OctahedronGeometry(0.44, 0);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x00f5d4,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.15,
    metalness: 0.85
  });

  function createCrystal(laneIndex, zPos, yPos = GROUND_CRYSTAL_Y, flightTrail = false) {
    const crystal = new THREE.Mesh(crystalGeom, crystalMat);
    crystal.position.set(LANES[laneIndex], yPos, zPos);
    crystal.castShadow = true;
    crystal.userData = { lane: laneIndex, collected: false };
    crystal.userData.flightTrail = flightTrail;
    scene.add(crystal);
    coins.push(crystal);
  }

  // --- POWER-UPS: MAGNET (CHUMBAK) & JETPACK (FLY THING) ---
  function createMagnetPowerup(laneIndex, zPos) {
    const magnetGroup = new THREE.Group();
    magnetGroup.position.set(LANES[laneIndex], 1.45, zPos);

    // Big Vibrant Red Horseshoe Arc (2.2x size)
    const arcMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.22, 12, 24, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.2,
        metalness: 0.4,
        emissive: 0x991b1b,
        emissiveIntensity: 0.3
      })
    );
    arcMesh.rotation.z = Math.PI;
    magnetGroup.add(arcMesh);

    // Large Silver Magnetic Pole Tips
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xffffff,
      emissiveIntensity: 0.2
    });
    const poleL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.44), poleMat);
    poleL.position.set(-0.72, -0.25, 0);
    const poleR = poleL.clone();
    poleR.position.x = 0.72;
    magnetGroup.add(poleL);
    magnetGroup.add(poleR);

    // Glowing Golden Aura Ring
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 24), haloMat);
    halo.rotation.x = Math.PI / 2;
    magnetGroup.add(halo);

    magnetGroup.userData = { type: 'magnet', lane: laneIndex, collected: false };
    scene.add(magnetGroup);
    powerups.push(magnetGroup);
  }

  function createJetpackPowerup(laneIndex, zPos) {
    const jetpackGroup = new THREE.Group();
    jetpackGroup.position.set(LANES[laneIndex], 1.45, zPos);

    // Big Dual Jetpack Thrusters (2.2x size)
    const cylMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35
    });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

    const cL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 14), cylMat);
    cL.position.set(-0.48, 0, 0);
    const fL = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.65, 10), flameMat);
    fL.rotation.x = Math.PI;
    fL.position.set(-0.48, -0.85, 0);

    const cR = cL.clone();
    cR.position.x = 0.48;
    const fR = fL.clone();
    fR.position.x = 0.48;

    // Center Cross-Brace & Reactor Core
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 })
    );
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), coreMat);

    const pulse = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.06, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffde8f, transparent: true, opacity: 0.9 })
    );
    pulse.rotation.x = Math.PI / 2;
    pulse.position.y = -1.12;

    const arrowGeometry = new THREE.ConeGeometry(0.27, 0.36, 4);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xffbd57, transparent: true });
    const arrows = [0, 1, 2].map(() => new THREE.Mesh(arrowGeometry, arrowMaterial.clone()));
    jetpackGroup.add(cL, fL, cR, fR, brace, core, pulse, ...arrows);
    jetpackGroup.userData = { type: 'jetpack', lane: laneIndex, collected: false, pulse, arrows, flames: [fL, fR], glowTime: 0 };
    scene.add(jetpackGroup);
    powerups.push(jetpackGroup);
  }

  function animateJetpackPickup(pickup, delta) {
    const { pulse, arrows, flames } = pickup.userData;
    const time = pickup.userData.glowTime += delta;
    pickup.position.y = 1.45 + Math.sin(time * 4) * 0.13;
    pulse.position.y = 0.28 - pickup.position.y;
    const ripple = (time * 1.2) % 1;
    pulse.scale.setScalar(0.65 + ripple * 1.4);
    pulse.material.opacity = 0.95 * (1 - ripple);

    for (let i = 0; i < arrows.length; i++) {
      const phase = (time * 1.5 + i / arrows.length) % 1;
      arrows[i].position.y = 0.72 + phase * 1.5;
      arrows[i].scale.setScalar(1 - phase * 0.36);
      arrows[i].material.opacity = Math.sin(phase * Math.PI);
    }
    for (const flame of flames) flame.scale.y = 0.8 + Math.sin(time * 22) * 0.2;
  }

  // 3. Super Jump Sneakers (Red High-Tops with Golden Spring Coils)
  function createSneakersPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.4, zPos);

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.3
    });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const springMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 });

    [-0.32, 0.32].forEach((xOff) => {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.72), shoeMat);
      shoe.position.set(xOff, 0.16, 0);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.76), soleMat);
      sole.position.set(xOff, -0.05, 0);
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10), springMat);
      coil.position.set(xOff, -0.25, 0);

      group.add(shoe);
      group.add(sole);
      group.add(coil);
    });

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    group.userData = { type: 'sneakers', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 4. 2X Energy Doubler Cube (Amethyst Crystal with Gold Frame)
  function createDoublerPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.45, zPos);

    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      roughness: 0.1,
      metalness: 0.7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.55
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), cubeMat);
    group.add(cube);

    const frameMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true });
    const frame = new THREE.Mesh(new THREE.OctahedronGeometry(0.98, 0), frameMat);
    group.add(frame);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xc084fc })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    group.userData = { type: 'doubler', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 5. Chrono Time Warp (Cyan Chronosphere with Gyro Rings)
  function createWarpPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.45, zPos);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x0891b2,
      emissiveIntensity: 0.5
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), coreMat);
    group.add(core);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.04, 8, 24), ringMat);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.04, 8, 24), ringMat);
    r2.rotation.y = Math.PI / 2;
    group.add(r1);
    group.add(r2);

    group.userData = { type: 'warp', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 6. Sonic EMP Shockwave Cannon (Impulse Blast Device)
  function createEMPPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.45, zPos);

    const empMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0xd97706,
      emissiveIntensity: 0.55
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 14), empMat);
    group.add(sphere);

    const wingMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 });
    for (let w = 0; w < 4; w++) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.25), wingMat);
      const angle = (w * Math.PI) / 2;
      wing.position.set(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0);
      group.add(wing);
    }

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xf87171 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    group.userData = { type: 'emp', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 7. Quantum Ghost Phase Cloak (Translucent Holographic Diamond)
  function createGhostPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.45, zPos);

    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.1,
      metalness: 0.4,
      transparent: true,
      opacity: 0.8,
      emissive: 0xdb2777,
      emissiveIntensity: 0.55
    });
    const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), ghostMat);
    group.add(prism);

    const wireMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, wireframe: true });
    const wirePrism = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), wireMat);
    group.add(wirePrism);

    group.userData = { type: 'ghost', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 8. Rainbow Singularity Vortex (Multi-Orbit Accretion Star)
  function createVortexPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.45, zPos);

    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65
    });
    const star = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), starMat);
    group.add(star);

    const rGold = new THREE.Mesh(
      new THREE.TorusGeometry(0.88, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    rGold.rotation.x = 0.6;
    const rPink = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xec4899 })
    );
    rPink.rotation.y = 0.8;
    group.add(rGold);
    group.add(rPink);

    group.userData = { type: 'vortex', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 9. Collectible 3D Hoverboard Surfboard on Track (Track Pickup with Shield!)
  function createHoverboardPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.35, zPos);

    const deckGeom = new THREE.BoxGeometry(0.85, 0.08, 1.9);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7
    });
    const deck = new THREE.Mesh(deckGeom, deckMat);
    group.add(deck);

    [-0.55, 0.55].forEach((zOff) => {
      const emitter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.09, 14),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      emitter.position.set(0, -0.06, zOff);
      group.add(emitter);
    });

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    group.userData = { type: 'hoverboard', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 10. 3D Turbo Roller Skates / Wheels on Feet Boost ("foot me wheel")
  function createRollerSkatesPowerup(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.35, zPos);

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.25,
      metalness: 0.5,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.85
    });

    [-0.32, 0.32].forEach((xOff) => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.70), bootMat);
      boot.position.set(xOff, 0.18, 0);
      group.add(boot);

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.08, 0.64),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      blade.position.set(xOff, -0.06, 0);
      group.add(blade);

      [-0.22, 0, 0.22].forEach((wZ) => {
        const wGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
        wGeom.rotateZ(Math.PI / 2);
        const wheel = new THREE.Mesh(wGeom, wheelMat);
        wheel.position.set(xOff, -0.16, wZ);
        group.add(wheel);
      });
    });

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    group.userData = { type: 'skates', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // 9. Golden Mystery Surprise Box (Lucky Crate with Holographic ?)
  function createMysteryBox(laneIndex, zPos) {
    const group = new THREE.Group();
    group.position.set(LANES[laneIndex], 1.5, zPos);

    // Glowing Golden Chest Box
    const boxGeom = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.6
    });
    const box = new THREE.Mesh(boxGeom, boxMat);
    group.add(box);

    // Cyan Ribbon Bands
    const bandH = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.16, 0.88),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    const bandV = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.88, 0.88),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
    );
    group.add(bandH);
    group.add(bandV);

    // Floating Question Mark '?' Sprite on top
    const qCanvas = document.createElement('canvas');
    qCanvas.width = 128;
    qCanvas.height = 128;
    const qctx = qCanvas.getContext('2d');
    qctx.fillStyle = '#ffffff';
    qctx.font = 'bold 74px Fredoka One, sans-serif';
    qctx.textAlign = 'center';
    qctx.textBaseline = 'middle';
    qctx.shadowColor = '#fbbf24';
    qctx.shadowBlur = 12;
    qctx.fillText('?', 64, 64);
    const qTex = new THREE.CanvasTexture(qCanvas);
    const qSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex, transparent: true, opacity: 0.95 }));
    qSprite.scale.set(0.9, 0.9, 1);
    qSprite.position.set(0, 0.95, 0);
    group.add(qSprite);

    group.userData = { type: 'mystery', lane: laneIndex, collected: false };
    scene.add(group);
    powerups.push(group);
  }

  // --- ORIGINAL DYNAMIC TRACK SPAWNER ---
  let nextSpawnZ = -45;

  function spawnWorldPattern() {
    while (nextSpawnZ > -280) {
      const roll = Math.random();
      const openLane = Math.floor(Math.random() * 3);
      const obstacleLane = (openLane + 1 + Math.floor(Math.random() * 2)) % 3;
      const otherLane = 3 - openLane - obstacleLane;

      // Spawn Power-Ups & Mystery Boxes periodically (45% chance in open lane!)
      if (Math.random() < 0.45) {
        const pChoice = Math.random();
        const pZ = nextSpawnZ + 8;
        if (pChoice < 0.12) {
          createHoverboardPowerup(openLane, pZ); // 🛹 Surfboard on track!
        } else if (pChoice < 0.24) {
          createRollerSkatesPowerup(openLane, pZ); // 🛼 Roller Skates on track!
        } else if (pChoice < 0.35) {
          createMysteryBox(openLane, pZ);
        } else if (pChoice < 0.46) {
          createMagnetPowerup(openLane, pZ);
        } else if (pChoice < 0.56) {
          createJetpackPowerup(openLane, pZ);
        } else if (pChoice < 0.66) {
          createSneakersPowerup(openLane, pZ);
        } else if (pChoice < 0.76) {
          createDoublerPowerup(openLane, pZ);
        } else if (pChoice < 0.84) {
          createWarpPowerup(openLane, pZ);
        } else if (pChoice < 0.92) {
          createGhostPowerup(openLane, pZ);
        } else {
          createVortexPowerup(openLane, pZ);
        }
      }

      if (roll < 0.38) {
        // Pattern 1: Sleek Maglev Bullet Transit (50% chance ramp)
        const hasRamp = Math.random() < 0.55;
        createMonorailObstacle(obstacleLane, nextSpawnZ, hasRamp);

        // Ground crystals in open lane
        for (let cz = -2; cz <= 3; cz++) {
          createCrystal(openLane, nextSpawnZ + cz * 3.5, 1.2);
        }
        nextSpawnZ -= 64;
      } else if (roll < 0.60) {
        // Pattern 2: Cyber Overhead Laser Gantry (Must Duck / Slide Under - "jhukna padhta hai")
        createOverheadSlideObstacle(obstacleLane, nextSpawnZ);

        // Low crystals encouraging ducking/sliding
        for (let cz = -2; cz <= 2; cz++) {
          createCrystal(obstacleLane, nextSpawnZ + cz * 2.8, 0.55);
        }
        // Also crystals in open lane
        for (let cz = -1; cz <= 2; cz++) {
          createCrystal(openLane, nextSpawnZ + cz * 3.2, 1.2);
        }
        nextSpawnZ -= 52;
      } else if (roll < 0.82) {
        // Pattern 3: High-Tech Electric Plasma Barricade (Jump Over!)
        createHurdleObstacle(obstacleLane, nextSpawnZ);

        // High crystal jump arc rewarding player
        createCrystal(obstacleLane, nextSpawnZ + 3.8);
        createCrystal(openLane, nextSpawnZ);
        createCrystal(obstacleLane, nextSpawnZ - 3.8);
        nextSpawnZ -= 52;
      } else {
        // Pattern 4: Parkour Rhythm Agility Combo (Jump ➔ Slide / Duck!)
        createHurdleObstacle(obstacleLane, nextSpawnZ);
        createCrystal(openLane, nextSpawnZ);

        // Followed 18m later by an overhead laser gantry
        createOverheadSlideObstacle(obstacleLane, nextSpawnZ - 18);
        createCrystal(obstacleLane, nextSpawnZ - 18, 0.55);

        // Open lane clear path
        for (let cz = -3; cz <= 3; cz++) {
          createCrystal(openLane, nextSpawnZ - 9 + cz * 3.2, 1.2);
        }
        nextSpawnZ -= 72;
      }
    }
  }

  // --- CONTROLS SETUP ---
  function setupControls() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (!state.running || state.paused) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLane(-1);
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveLane(1);
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') doJump();
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') doSlide();
      else if (e.key === ' ' || e.key === 'b' || e.key === 'B' || e.key === 'h' || e.key === 'H') activateHoverboardSurf();
      else if (e.key === 'Shift') triggerBoost();
      else if (e.key === 'e' || e.key === 'E') useStoredMagnet();
      else if (e.key === 'q' || e.key === 'Q') useStoredJetpack();
    });

    // Mobile Swipe Gesture (Smooth, Responsive & No Pull-To-Refresh Jitter)
    const overlay = document.getElementById('touch-overlay');
    let touchStartX = 0;
    let touchStartY = 0;
    let hasSwipedInCurrentTouch = false;
    let lastTapTime = 0;

    const handleTouchStart = (e) => {
      if (state.controlMode !== 'swipe') return; // If Touch Buttons active, do not track swipe
      if (!state.running || state.paused) return;

      const now = Date.now();
      if (now - lastTapTime < 280) {
        // DOUBLE TAP DETECTED: Instant Hoverboard Surf!
        activateHoverboardSurf();
      }
      lastTapTime = now;

      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        hasSwipedInCurrentTouch = false;
      }
    };

    const handleTouchMove = (e) => {
      // STRICT CONTROL MODE: If user chose Touch Buttons in Settings, disable swipe completely!
      if (state.controlMode !== 'swipe') return;
      if (hasSwipedInCurrentTouch || !state.running || state.paused) return;
      if (e.touches && e.touches.length > 0) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        // Optimal swipe threshold: 24px
        if (absX > 24 || absY > 24) {
          hasSwipedInCurrentTouch = true;
          if (e.cancelable) e.preventDefault(); // Stop mobile browser pull-to-refresh & scroll
          if (absX > absY) {
            if (dx > 0) moveLane(1);
            else moveLane(-1);
          } else {
            if (dy < 0) doJump();
            else doSlide();
          }
        }
      }
    };

    const handleTouchEnd = () => {
      hasSwipedInCurrentTouch = false;
    };

    if (overlay) {
      overlay.addEventListener('touchstart', handleTouchStart, { passive: true });
      overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      overlay.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    // Button Binder with Double-Tap Protection for Mobile
    const bindBtn = (id, action) => {
      const btn = document.getElementById(id);
      if (btn) {
        let lastTriggerTime = 0;
        const trigger = (e) => {
          if (e) {
            e.stopPropagation();
            if (e.cancelable && e.type === 'touchstart') e.preventDefault();
          }
          const now = Date.now();
          if (now - lastTriggerTime < 320) return; // Prevent double trigger
          lastTriggerTime = now;
          action();
        };
        btn.addEventListener('click', trigger);
        btn.addEventListener('touchstart', trigger, { passive: false });
      }
    };

    bindBtn('btn-left', () => moveLane(-1));
    bindBtn('btn-right', () => moveLane(1));
    bindBtn('btn-jump', () => doJump());
    bindBtn('btn-slide', () => doSlide());
    bindBtn('btn-boost', () => triggerBoost());
    bindBtn('btn-hoverboard-surf', activateHoverboardSurf);

    // Navigation Buttons (Instant Mobile Touch & Click)
    bindBtn('btn-start', startGame);
    bindBtn('btn-restart', startGame);
    bindBtn('btn-pause', togglePause);
    bindBtn('btn-resume', togglePause);

    // Home Buttons
    const goHome = () => {
      state.running = false;
      state.paused = false;
      if (window.soundEngine) window.soundEngine.stopMusic();
      hud.classList.add('hidden');
      pauseScreen.classList.add('hidden');
      gameOverScreen.classList.add('hidden');
      settingsModal.classList.add('hidden');
      startScreen.classList.remove('hidden');
      if (menuHighScore) menuHighScore.textContent = careerStats.highScore;
      if (menuCredits) menuCredits.textContent = careerStats.totalCoins;
    };

    bindBtn('btn-hud-home', goHome);
    bindBtn('btn-pause-home', goHome);
    bindBtn('btn-gameover-home', goHome);
    bindBtn('btn-settings-home', goHome);

    // Settings Modal (Debounced to completely eliminate mobile touch ghost-close!)
    let settingsOpenedAt = 0;
    bindBtn('btn-open-settings', () => {
      updateCareerStatsUI();
      settingsOpenedAt = Date.now();
      settingsModal.classList.remove('hidden');
    });

    const safeCloseSettings = () => {
      if (Date.now() - settingsOpenedAt < 380) return; // Prevent ghost touch click bleed-through on mobile
      settingsModal.classList.add('hidden');
    };

    bindBtn('btn-close-settings', safeCloseSettings);
    bindBtn('btn-save-settings', safeCloseSettings);

    const bindClickOnly = (id, action) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          action();
        });
      }
    };

    // Theme Option Toggles (Click only: prevents swipe/scroll from accidentally changing themes!)
    bindClickOnly('opt-theme-dark', () => applyTheme('dark'));
    bindClickOnly('opt-theme-bright', () => applyTheme('bright'));

    // Control Option Toggles (Click only!)
    bindClickOnly('opt-ctrl-swipe', () => applyControlMode('swipe'));
    bindClickOnly('opt-ctrl-buttons', () => applyControlMode('buttons'));

    // Power-Up Inventory Slot Buttons
    bindBtn('slot-magnet', useStoredMagnet);
    bindBtn('slot-jetpack', useStoredJetpack);

    // Audio Buttons
    const toggleSound = () => {
      if (window.soundEngine) {
        const muted = window.soundEngine.toggleMute();
        const text = muted ? 'SOUND: OFF' : 'SOUND: ON';
        const a1 = document.getElementById('btn-audio');
        const a2 = document.getElementById('btn-toggle-sound');
        if (a1) {
          a1.innerHTML = muted 
            ? '<span class="pill-icon">🔇</span><span class="pill-text">AUDIO: OFF</span>'
            : '<span class="pill-icon">🔊</span><span class="pill-text">AUDIO: ON</span>';
        }
        if (a2) a2.textContent = text;
      }
    };
    bindBtn('btn-audio', toggleSound);
    bindBtn('btn-toggle-sound', toggleSound);
  }

  function moveLane(dir) {
    const target = Math.max(-1, Math.min(1, state.currentLane + dir));
    if (target !== state.currentLane) {
      state.currentLane = target;
      state.targetX = LANES[state.currentLane + 1];
      if (window.soundEngine) window.soundEngine.playFootstep();
    }
  }

  function doJump() {
    if (state.jetpackTimer > 0) return;
    // Strict Grounded Check: can only jump if grounded on floor or train roof!
    // Prevents infinite mid-air floating so player ALWAYS comes down fast!
    const isGrounded = (!state.isJumping && state.playerY <= state.groundY + 0.15) || (state.playerY <= state.groundY + 0.05);

    if (isGrounded) {
      state.isJumping = true;
      state.isSliding = false;
      state.jumpBuffered = false;
      const jumpHeight = (state.sneakersTimer > 0) ? 7.6 : JUMP_HEIGHT;
      state.vy = Math.sqrt(2 * GRAVITY * jumpHeight);

      if (state.sneakersTimer > 0 && window.soundEngine && window.soundEngine.playSneakersSFX) {
        window.soundEngine.playSneakersSFX();
      } else if (window.soundEngine) {
        window.soundEngine.playJumpSFX();
      }
    } else if (state.isJumping && state.playerY < state.groundY + 0.9 && state.vy < 0) {
      // Buffer a jump if player swipes up right as they are about to touch ground (< 0.9m away)
      state.jumpBuffered = true;
    }
  }

  function doSlide() {
    if (state.jetpackTimer > 0) return;
    state.isSliding = true;
    state.slideTimer = state.slideDuration;
    state.jumpBuffered = false;
    if (state.isJumping) {
      state.vy = -26; // Fast downward stomp if sliding while in mid-air (Subway Surfers feel!)
    }
    if (window.soundEngine) window.soundEngine.playSlideSFX();
  }

  function pulseBoostHaptics() {
    if (!reducedMotion.matches) navigator.vibrate?.(45);
  }

  function activateHoverboardSurf() {
    if (!state.running || state.paused) return;
    if (state.hasShield && state.isBoosted) return; // already active

    state.hasShield = true;
    state.isBoosted = true;
    pulseBoostHaptics();
    state.boostTimer = 16.0; // 16 seconds of surfboard fun
    if (hoverboardMesh) hoverboardMesh.visible = true;
    if (badgeShield) {
      badgeShield.style.display = 'flex';
      badgeShield.innerHTML = '<span>🛹 HOVERBOARD ON</span>';
    }
    showToast('🛹 CYBER HOVERBOARD ACTIVE! 1-HIT SHIELD READY!');
    if (typeof addComboPoint === 'function') addComboPoint(2);
    if (window.soundEngine) {
      window.soundEngine.playPowerupSFX();
    }
  }

  function triggerBoost() {
    if (state.overdriveCharge >= 25 || state.isBoosted) {
      state.isBoosted = true;
      state.hasShield = true;
      pulseBoostHaptics();
      state.boostTimer = 6.0;
      state.overdriveCharge = 0;
      if (hoverboardMesh) hoverboardMesh.visible = true;
      if (badgeShield) badgeShield.style.display = 'flex';
      if (window.soundEngine) window.soundEngine.playPowerupSFX();
    }
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    if (state.paused) {
      pauseScreen.classList.remove('hidden');
      window.soundEngine?.pauseMusic();
    } else {
      pauseScreen.classList.add('hidden');
      window.soundEngine?.startMusic();
    }
  }

  // --- START GAME ---
  function startGame() {
    state.running = true;
    state.paused = false;
    trailPoints.length = 0;
    trailDistance = 0;
    runnerSpritePhase = 0;
    if (headMesh) headMesh.rotation.set(0, 0, 0);
    if (playerGroup) {
      playerGroup.rotation.set(0, 0, 0);
    }
    if (camera) {
      camera.position.set(0, 4.6, 8.2);
      camera.lookAt(0, 1.7, -18);
    }
    state.score = 0;
    state.coins = 0;
    state.distance = 0;
    state.speed = 11; // 13 KM/H ultra-relaxed gentle beginner start
    state.currentLane = 0;
    state.playerX = 0;
    state.targetX = 0;
    state.playerY = 0;
    state.groundY = 0;
    state.vy = 0;
    state.isJumping = false;
    state.isSliding = false;
    state.slideTimer = 0;
    state.isBoosted = false;
    state.boostTimer = 0;
    state.overdriveCharge = 0;
    state.multiplier = 1;
    // Reset all 8 boost timers
    state.magnetTimer = 0;
    state.jetpackTimer = 0;
    state.sneakersTimer = 0;
    state.doublerTimer = 0;
    state.warpTimer = 0;
    state.ghostTimer = 0;
    state.vortexTimer = 0;
    state.skatesTimer = 0;
    state.hasShield = false;
    state.storedMagnets = 0;
    state.storedJetpacks = 0;
    updatePowerupSlotsUI();

    obstacles.forEach((obs) => scene.remove(obs));
    obstacles.length = 0;
    coins.forEach((c) => scene.remove(c));
    coins.length = 0;
    powerups.forEach((p) => scene.remove(p));
    powerups.length = 0;

    nextSpawnZ = -95;
    // Pure, clean opening runway of crystals in center lane (No boots at starting strip, just like Subway Surfers & big games!)
    for (let cz = -10; cz >= -80; cz -= 4) {
      createCrystal(1, cz, 1.2);
    }

    spawnWorldPattern();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    settingsModal.classList.add('hidden');
    hud.classList.remove('hidden');

    if (hoverboardMesh) hoverboardMesh.visible = false;
    if (jetpackMesh) jetpackMesh.visible = false;
    if (badgeMagnet) badgeMagnet.style.display = 'none';
    if (badgeJetpack) badgeJetpack.style.display = 'none';
    if (badgeSneakers) badgeSneakers.style.display = 'none';
    if (badgeDoubler) badgeDoubler.style.display = 'none';
    if (badgeWarp) badgeWarp.style.display = 'none';
    if (badgeGhost) badgeGhost.style.display = 'none';
    if (badgeVortex) badgeVortex.style.display = 'none';
    if (badgeSkates) badgeSkates.style.display = 'none';
    if (badgeShield) badgeShield.style.display = 'none';
    if (skateFrameL) skateFrameL.visible = false;
    if (skateFrameR) skateFrameR.visible = false;

    if (kaiModel) {
      kaiModel.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
        }
      });
    }

    if (window.soundEngine) {
      window.soundEngine.resumeContext();
      window.soundEngine.startMusic();
    }
  }

  function gameOver() {
    state.running = false;
    if (window.soundEngine) {
      window.soundEngine.stopMusic();
      window.soundEngine.playCrashSFX();
    }

    // Update Career Stats & High Score
    careerStats.totalRuns = (careerStats.totalRuns || 0) + 1;
    careerStats.totalCoins = (careerStats.totalCoins || 0) + state.coins;
    careerStats.maxDistance = Math.max(careerStats.maxDistance || 0, Math.floor(state.distance));
    const isNewRecord = state.score > (careerStats.highScore || 0);
    if (isNewRecord) {
      careerStats.highScore = Math.floor(state.score);
    }
    saveCareerStats();
    updateCareerStatsUI();

    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    if (finalScoreEl) finalScoreEl.textContent = Math.floor(state.score);
    if (finalDistanceEl) finalDistanceEl.textContent = Math.floor(state.distance) + ' m';
    if (finalCreditsEl) finalCreditsEl.textContent = '+' + state.coins;
    if (newRecordBadge) newRecordBadge.style.display = isNewRecord ? 'inline-block' : 'none';
  }

  let menuIdleTime = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function getNextRunSpeed(run, delta) {
    const distanceSpeed = Math.min(42, 11 + run.distance * 0.014);
    const boost = Math.max(run.isBoosted ? 7 : 0, run.jetpackTimer > 0 ? 5 : 0, run.skatesTimer > 0 ? 4 : 0);
    const targetSpeed = (distanceSpeed + boost) * (run.warpTimer > 0 ? 0.45 : 1);
    const change = Math.max(-7 * delta, Math.min(4.5 * delta, targetSpeed - run.speed));
    return run.speed + change;
  }

  // --- UPDATE LOOP ---
  function update(delta) {
    if (!state.running) {
      // 3D Menu Idle Animation: Showcase 3D Runner Kai in dynamic hero stance!
      if (!reducedMotion.matches) menuIdleTime += delta;
      if (playerGroup) {
        playerGroup.position.set(0, 0, 0);
        // Face camera slightly at a confident hero angle
        playerGroup.rotation.y = Math.PI + Math.sin(menuIdleTime * 1.4) * 0.12;
      }
      if (kaiModel) {
        const breathe = Math.sin(menuIdleTime * 2.5) * 0.025;
        kaiModel.position.y = breathe;
        kaiModel.scale.setScalar(1);
        kaiModel.rotation.set(0, 0, 0);
        headMesh.rotation.y = Math.sin(menuIdleTime * 0.65) * 0.09;
        if (leftArm) leftArm.rotation.x = 0.2 + Math.sin(menuIdleTime * 1.6) * 0.06;
        if (rightArm) rightArm.rotation.x = -0.15 + Math.sin(menuIdleTime * 1.6 + 1.2) * 0.06;
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
      }
      if (camera) {
        // Framed hero view showcasing runner boy and skyline behind transparent menu!
        const orbitX = Math.sin(menuIdleTime * 0.4) * 0.35;
        const wideMenu = camera.aspect >= 1.35;
        camera.position.set(orbitX, 1.94, wideMenu ? 3.9 : 4.65);
        camera.lookAt(wideMenu ? -1.50 : 0, 1.43, 0);
      }
      return;
    }
    if (state.paused) return;

    // Combo Streak Timer Countdown
    if (comboResetTimer > 0) {
      comboResetTimer -= delta;
      if (comboResetTimer <= 0) {
        comboStreak = 0;
        const badge = document.getElementById('hud-combo-badge');
        if (badge) badge.classList.add('hidden');
      }
    }

    // Dynamic Camera Action Lean on Lane Weave
    if (camera) {
      const targetRoll = (state.targetX - state.playerX) * -0.018;
      camera.rotation.z += (targetRoll - camera.rotation.z) * 8.0 * delta;
    }

    // 1. Magnet (Chumbak) Timer & HUD
    if (state.magnetTimer > 0) {
      state.magnetTimer -= delta;
      if (badgeMagnet) badgeMagnet.style.display = 'flex';
      if (timerMagnet) timerMagnet.textContent = Math.ceil(state.magnetTimer) + 's';
      if (state.magnetTimer <= 0 && badgeMagnet) badgeMagnet.style.display = 'none';
    }

    // 2. Jetpack (Fly Thing) Timer & HUD
    if (state.jetpackTimer > 0) {
      state.jetpackTimer = Math.max(0, state.jetpackTimer - delta);
      if (badgeJetpack) badgeJetpack.style.display = 'flex';
      if (timerJetpack) timerJetpack.textContent = Math.ceil(state.jetpackTimer) + 's';
      if (jetpackMesh) jetpackMesh.visible = true;

      // Fly high in the sky!
      if (state.jetpackTimer > 0) {
        state.playerY += (JETPACK_FLIGHT_Y - state.playerY) * (1 - Math.exp(-3.6 * delta));
      }

      if (state.jetpackTimer <= 0) {
        if (badgeJetpack) badgeJetpack.style.display = 'none';
        if (jetpackMesh) jetpackMesh.visible = false;
      }
    } else {
      if (badgeJetpack) badgeJetpack.style.display = 'none';
      if (jetpackMesh) jetpackMesh.visible = false;
    }

    // 3. Super Jump Sneakers Timer & HUD
    if (state.sneakersTimer > 0) {
      state.sneakersTimer -= delta;
      if (badgeSneakers) badgeSneakers.style.display = 'flex';
      if (timerSneakers) timerSneakers.textContent = Math.ceil(state.sneakersTimer) + 's';
      if (state.sneakersTimer <= 0 && badgeSneakers) badgeSneakers.style.display = 'none';
    }

    // 4. 2X Energy Doubler Cube Timer & HUD
    if (state.doublerTimer > 0) {
      state.doublerTimer -= delta;
      if (badgeDoubler) badgeDoubler.style.display = 'flex';
      if (timerDoubler) timerDoubler.textContent = Math.ceil(state.doublerTimer) + 's';
      if (state.doublerTimer <= 0 && badgeDoubler) badgeDoubler.style.display = 'none';
    }

    // 5. Chrono Time Warp Timer & HUD
    if (state.warpTimer > 0) {
      state.warpTimer -= delta;
      if (badgeWarp) badgeWarp.style.display = 'flex';
      if (timerWarp) timerWarp.textContent = Math.ceil(state.warpTimer) + 's';
      if (state.warpTimer <= 0 && badgeWarp) badgeWarp.style.display = 'none';
    }

    // 6. Quantum Ghost Phase Cloak Timer & HUD
    if (state.ghostTimer > 0) {
      state.ghostTimer -= delta;
      if (badgeGhost) badgeGhost.style.display = 'flex';
      if (timerGhost) timerGhost.textContent = Math.ceil(state.ghostTimer) + 's';
      if (kaiModel) {
        kaiModel.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.52;
          }
        });
      }
      if (state.ghostTimer <= 0) {
        if (badgeGhost) badgeGhost.style.display = 'none';
        if (kaiModel) {
          kaiModel.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.transparent = false;
              child.material.opacity = 1.0;
            }
          });
        }
      }
    }

    // 7. Rainbow Singularity Vortex Timer & HUD
    if (state.vortexTimer > 0) {
      state.vortexTimer -= delta;
      if (badgeVortex) badgeVortex.style.display = 'flex';
      if (timerVortex) timerVortex.textContent = Math.ceil(state.vortexTimer) + 's';
      if (state.vortexTimer <= 0 && badgeVortex) badgeVortex.style.display = 'none';
    }

    // 8. Turbo Roller Skates / Foot Wheels Timer & Animation ("foot me wheel")
    if (state.skatesTimer > 0) {
      state.skatesTimer -= delta;
      if (badgeSkates) badgeSkates.style.display = 'flex';
      if (timerSkates) timerSkates.textContent = Math.ceil(state.skatesTimer) + 's';

      if (skateFrameL) skateFrameL.visible = true;
      if (skateFrameR) skateFrameR.visible = true;

      const wheelSpin = delta * (state.speed * 1.8 + 14);
      if (skateWheelsL) skateWheelsL.forEach((w) => { w.rotation.x += wheelSpin; });
      if (skateWheelsR) skateWheelsR.forEach((w) => { w.rotation.x += wheelSpin; });

      if (state.skatesTimer <= 0) {
        if (badgeSkates) badgeSkates.style.display = 'none';
        if (skateFrameL) skateFrameL.visible = false;
        if (skateFrameR) skateFrameR.visible = false;
      }
    } else {
      if (skateFrameL && skateFrameL.visible) skateFrameL.visible = false;
      if (skateFrameR && skateFrameR.visible) skateFrameR.visible = false;
    }

    if (state.isBoosted) {
      state.boostTimer -= delta;
      if (state.boostTimer <= 0) {
        state.isBoosted = false;
        state.hasShield = false;
        if (hoverboardMesh) hoverboardMesh.visible = false;
        if (badgeShield) badgeShield.style.display = 'none';
      }
    }

    state.speed = getNextRunSpeed(state, delta);
    const distDelta = state.speed * delta;
    state.distance += distDelta;
    if (state.jetpackTimer > 0) fillFlightCrystalTrail(distDelta);
    state.score += distDelta * state.multiplier * 1.5;

    // Overdrive gauge
    state.overdriveCharge = Math.min(100, state.overdriveCharge + delta * 7);
    if (hudOverdriveFill) hudOverdriveFill.style.width = state.overdriveCharge + '%';

    // Snappy Lane Transition
    state.playerX += (state.targetX - state.playerX) * (1 - Math.exp(-28 * delta));

    // Check train roof ground support
    let activeRoofGround = 0;
    for (let obs of obstacles) {
      if (obs.userData.type === 'train') {
        const laneX = LANES[obs.userData.lane];
        if (Math.abs(state.playerX - laneX) < 1.15) {
          const zPos = obs.position.z;
          // Ramp approach:
          if (obs.userData.hasRamp && zPos >= -18.5 && zPos < -13.0) {
            const rampProgress = (zPos + 18.5) / 5.5;
            activeRoofGround = Math.max(activeRoofGround, rampProgress * TRAIN_HEIGHT);
          } else if (zPos >= -13.0 && zPos <= 13.0) {
            activeRoofGround = Math.max(activeRoofGround, TRAIN_HEIGHT);
          }
        }
      }
    }

    if (state.playerY >= activeRoofGround - 0.4) {
      state.groundY = activeRoofGround;
    } else if (activeRoofGround === 0) {
      state.groundY = 0;
    }

    // Gravity (when not flying in Jetpack)
    if (state.jetpackTimer <= 0) {
      if (state.isJumping || state.playerY > state.groundY) {
        state.vy -= GRAVITY * delta;
        state.playerY += state.vy * delta;

        if (state.playerY <= state.groundY) {
          state.playerY = state.groundY;
          state.vy = 0;
          state.isJumping = false;
          if (state.jumpBuffered) {
            state.jumpBuffered = false;
            doJump();
          }
        }
      } else {
        state.playerY = state.groundY;
      }
    }

    // Slide timer
    if (state.isSliding) {
      state.slideTimer -= delta;
      if (state.slideTimer <= 0) {
        state.isSliding = false;
      }
    }

    // Position player group
    playerGroup.position.set(state.playerX, state.playerY, 0);
    updateRunnerTrail(distDelta);

    // Dynamic Camera follow (Classic Subway Surfers perspective - exact comfortable size as before)
    const targetCamX = state.playerX * 0.72;
    camera.position.x += (targetCamX - camera.position.x) * 16 * delta;

    if (state.jetpackTimer > 0) {
      // High Sky View during Jetpack Flight (Subway Surfers High Elevation)
      camera.position.y += ((state.playerY + 3.8) - camera.position.y) * (1 - Math.exp(-8 * delta));
      camera.position.z += (8.6 - camera.position.z) * 8 * delta;
      camera.lookAt(state.playerX * 0.45, camera.position.y - 4.6, -25);
    } else {
      // Classic Ground Track 3rd-Person Framing with Footstep Bounce
      const runBounce = (!state.isJumping && !state.isSliding) ? Math.sin(runAnimTime * 2.2) * 0.05 : 0;
      const targetCamY = (state.isSliding ? 3.8 : 4.6) + runBounce;
      camera.position.y += (targetCamY - camera.position.y) * 14 * delta;
      camera.position.z += (8.2 - camera.position.z) * 14 * delta;
      camera.lookAt(state.playerX * 0.4, 1.7 + runBounce * 0.5, -18);
    }

    // Continuously scroll track ties backward at run speed (Fixes boy running in one place!)
    for (const sleepers of trackTies) {
      sleepers.position.z = (sleepers.position.z + distDelta) % TRACK_SLEEPER_SPACING;
    }

    // Scroll side murals, lanterns & scenery
    for (let i = 0; i < sideScenery.length; i++) {
      sideScenery[i].position.z += distDelta;
      if (sideScenery[i].position.z > 25) {
        sideScenery[i].position.z -= 345;
      }
    }

    // Scroll speed wind lines
    for (let i = 0; i < speedLines.length; i++) {
      speedLines[i].position.z += distDelta * 1.5;
      if (speedLines[i].position.z > 20) {
        speedLines[i].position.z = -240 - Math.random() * 40;
        speedLines[i].position.x = (Math.random() - 0.5) * 12.0;
      }
    }

    // Update active jetpack flight smoke particles
    for (let i = 0; i < flightSmokeParticles.length; i++) {
      const sp = flightSmokeParticles[i];
      if (sp.visible) {
        sp.userData.life += delta;
        if (sp.userData.life >= sp.userData.maxLife) {
          sp.visible = false;
        } else {
          const progress = sp.userData.life / sp.userData.maxLife;
          sp.position.x += sp.userData.vx * delta;
          sp.position.y += sp.userData.vy * delta;
          sp.position.z += sp.userData.vz * delta + distDelta;
          const sc = 0.4 + progress * 2.2;
          sp.scale.set(sc, sc, sc);
          sp.material.opacity = Math.max(0, 0.75 * (1 - progress));
        }
      }
    }

    // --- ATHLETIC RUNNER BOY ANIMATION SYSTEM ---
    runAnimTime += delta * (state.speed * 0.38);

    if (state.jetpackTimer > 0) {
      // 🚀 REAL AUTHENTIC SUPERHERO FLIGHT POSTURE (Realistic pitch angle, head looking forward, smoke particles)
      kaiModel.scale.set(1, 1, 1);
      kaiModel.rotation.x = -Math.PI / 4.4; // -41 degrees athletic superhero angle
      kaiModel.rotation.y = 0;
      kaiModel.position.y = Math.sin(runAnimTime * 3) * 0.08;
      kaiModel.rotation.z = (state.targetX - state.playerX) * -0.35; // Aerodynamic roll into lane changes!

      // Head looks UP and forward down track!
      if (headMesh) headMesh.rotation.x = 0.55;

      // Legs trailing behind naturally with bent knees
      leftLeg.rotation.x = -0.32;
      rightLeg.rotation.x = -0.28;
      if (leftLowerLeg) leftLowerLeg.rotation.x = 0.48;
      if (rightLowerLeg) rightLowerLeg.rotation.x = 0.52;

      // Arms reaching forward holding flight throttle grips
      leftArm.rotation.x = -1.15;
      rightArm.rotation.x = -1.15;
      leftArm.rotation.z = -0.22;
      rightArm.rotation.z = 0.22;
      if (leftForearm) leftForearm.rotation.x = 0.5;
      if (rightForearm) rightForearm.rotation.x = 0.5;

      // Flickering Rocket Thruster Flame Cones
      if (flameMeshL && flameMeshR) {
        const fScale = 1.0 + Math.sin(runAnimTime * 32) * 0.35 + (Math.random() * 0.25);
        flameMeshL.scale.set(1.0 + Math.random() * 0.2, fScale, 1.0 + Math.random() * 0.2);
        flameMeshR.scale.copy(flameMeshL.scale);
      }

      // Emit billowing flight smoke clouds from dual rocket exhausts
      if (Math.random() < 0.65) {
        const deadParticle = flightSmokeParticles.find((p) => !p.visible);
        if (deadParticle) {
          const side = Math.random() < 0.5 ? -0.42 : 0.42;
          deadParticle.position.set(
            state.playerX + side,
            state.playerY + 0.95,
            0.55
          );
          deadParticle.scale.set(0.4, 0.4, 0.4);
          deadParticle.material.opacity = 0.75;
          deadParticle.material.color.setHex(Math.random() < 0.35 ? 0xfbbf24 : 0xe2e8f0);
          deadParticle.visible = true;
          deadParticle.userData.life = 0;
          deadParticle.userData.maxLife = 0.55 + Math.random() * 0.3;
          deadParticle.userData.vx = (Math.random() - 0.5) * 0.8;
          deadParticle.userData.vy = -0.5 - Math.random() * 0.8;
          deadParticle.userData.vz = 8 + Math.random() * 6;
        }
      }
    } else {
      if (headMesh) headMesh.rotation.x = 0; // Reset head angle when running

      if (state.isSliding) {
        // 🛹 Athletic Low Skater Slide Under Laser Beams ("jhukna padhta hai")
        kaiModel.scale.set(1.0, 0.45, 1.05);
        kaiModel.rotation.x = 1.05; // Lean back flat
        kaiModel.rotation.y = 0;
        kaiModel.position.y = -0.42;
        kaiModel.rotation.z = (state.targetX - state.playerX) * -0.12;

        leftLeg.rotation.x = -1.35;
        rightLeg.rotation.x = 0.35;
        if (leftLowerLeg) leftLowerLeg.rotation.x = 0.95;
        if (rightLowerLeg) rightLowerLeg.rotation.x = 0.25;

        leftArm.rotation.x = 0.85;
        rightArm.rotation.x = 0.85;
      } else if (state.isJumping) {
        // 🦘 High Hurdle Jump Tuck (Knees bend into dynamic jump)
        kaiModel.scale.set(1, 1, 1);
        kaiModel.rotation.x = -0.22;
        kaiModel.rotation.y = 0;
        kaiModel.position.y = 0;
        kaiModel.rotation.z = (state.targetX - state.playerX) * -0.15;

        leftLeg.rotation.x = 0.75;
        rightLeg.rotation.x = 0.45;
        if (leftLowerLeg) leftLowerLeg.rotation.x = 1.15;
        if (rightLowerLeg) rightLowerLeg.rotation.x = 1.15;

        leftArm.rotation.x = -1.1;
        rightArm.rotation.x = -1.1;
      } else {
        // 🏃 Energetic Authentic Subway Surfers Running Cycle with Dynamic Knee Flexion
        kaiModel.scale.set(1, 1, 1);
        kaiModel.rotation.x = -0.14; // Athletic sprint forward lean
        kaiModel.position.y = Math.abs(Math.sin(runAnimTime * 2)) * 0.12; // Footfall bob
        kaiModel.position.x = Math.sin(runAnimTime) * 0.03;
        kaiModel.rotation.y = Math.sin(runAnimTime) * 0.08; // Shoulder twist
        kaiModel.rotation.z = Math.sin(runAnimTime) * -0.04 + ((state.targetX - state.playerX) * -0.16); // Sway + lane change banking

        const stride = Math.sin(runAnimTime);
        leftLeg.rotation.x = stride * 0.82;
        rightLeg.rotation.x = -stride * 0.82;

        // Realistic Human Running Kinematics: Knee bends backward on backswing!
        if (leftLowerLeg) {
          leftLowerLeg.rotation.x = Math.max(0, -stride * 0.92);
        }
        if (rightLowerLeg) {
          rightLowerLeg.rotation.x = Math.max(0, stride * 0.92);
        }

        // Arm pumping with bent elbows
        leftArm.rotation.x = -stride * 0.85;
        leftArm.rotation.z = -0.18;
        rightArm.rotation.x = stride * 0.85;
        rightArm.rotation.z = 0.18;

        if (leftForearm) leftForearm.rotation.x = 0.82 + Math.sin(runAnimTime) * 0.14;
        if (rightForearm) rightForearm.rotation.x = 0.82 - Math.sin(runAnimTime) * 0.14;
      }
    }

    // Move obstacles towards player (+Z)
    const moveZ = distDelta;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      const previousZ = obs.position.z;
      obs.position.z += moveZ;

      if (checkCollision(obs, previousZ)) {
        if (state.hasShield) {
          obs.userData.cleared = true;
          state.hasShield = false;
          state.isBoosted = false;
          if (hoverboardMesh) hoverboardMesh.visible = false;
          if (badgeShield) badgeShield.style.display = 'none';
          if (window.soundEngine) window.soundEngine.playPowerupSFX();
        } else {
          gameOver();
          return;
        }
      }

      if (obs.position.z > 25) {
        scene.remove(obs);
        obstacles.splice(i, 1);
      }
    }

    // Move & collect powerups (All 8 Epic Boosts found on track!)
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.position.z += moveZ;
      p.rotation.y += delta * 3.0;
      if (p.userData.type === 'jetpack') animateJetpackPickup(p, delta);

      const dist = p.position.distanceTo(playerGroup.position);
      if (dist < 2.2 && !p.userData.collected) {
        p.userData.collected = true;
        const pType = p.userData.type;

        if (pType === 'magnet') {
          state.magnetTimer = 14.0;
          careerStats.totalMagnets = (careerStats.totalMagnets || 0) + 1;
          saveCareerStats();
          updateCareerStatsUI();
          updatePowerupSlotsUI();
          showToast('🧲 CHUMBAK MAGNET ACTIVATED!');
          if (window.soundEngine) {
            window.soundEngine.playMagnetSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'jetpack') {
          startJetpack(12);
          careerStats.totalJetpacks = (careerStats.totalJetpacks || 0) + 1;
          saveCareerStats();
          updateCareerStatsUI();
          updatePowerupSlotsUI();
          showToast('🚀 JETPACK BLAST OFF!');
          if (window.soundEngine) {
            window.soundEngine.playJetpackSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'sneakers') {
          state.sneakersTimer = 14.0;
          showToast('👟 SUPER BOUNCE SNEAKERS!');
          if (window.soundEngine && window.soundEngine.playSneakersSFX) {
            window.soundEngine.playSneakersSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'doubler') {
          state.doublerTimer = 15.0;
          showToast('✖️2 DOUBLE ENERGY CRYSTALS!');
          if (window.soundEngine && window.soundEngine.playDoublerSFX) {
            window.soundEngine.playDoublerSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'warp') {
          state.warpTimer = 12.0;
          showToast('⏱️ CHRONO TIME WARP SLOW-MO!');
          if (window.soundEngine && window.soundEngine.playTimeWarpSFX) {
            window.soundEngine.playTimeWarpSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'emp') {
          showToast('💥 SONIC EMP SHOCKWAVE BLAST!');
          if (window.soundEngine && window.soundEngine.playEMPBlastSFX) {
            window.soundEngine.playEMPBlastSFX();
            window.soundEngine.playPowerupSFX();
          }
          // Vaporize obstacles ahead for 130 meters into crystals!
          for (let oi = obstacles.length - 1; oi >= 0; oi--) {
            const obs = obstacles[oi];
            if (obs.position.z >= -130 && obs.position.z <= 15) {
              const oLane = obs.userData.lane;
              const oZ = obs.position.z;
              scene.remove(obs);
              obstacles.splice(oi, 1);
              createCrystal(oLane, oZ, 1.2);
              createCrystal(oLane, oZ - 3, 1.2);
            }
          }
        } else if (pType === 'ghost') {
          state.ghostTimer = 12.0;
          showToast('👻 QUANTUM GHOST PHASE CLOAK!');
          if (window.soundEngine && window.soundEngine.playGhostPhaseSFX) {
            window.soundEngine.playGhostPhaseSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'vortex') {
          state.vortexTimer = 12.0;
          showToast('🌈 RAINBOW SINGULARITY VORTEX!');
          if (window.soundEngine && window.soundEngine.playVortexSFX) {
            window.soundEngine.playVortexSFX();
            window.soundEngine.playPowerupSFX();
          }
        } else if (pType === 'hoverboard') {
          activateHoverboardSurf();
          showToast('🛹 HOVERBOARD ON TRACK! SHIELD ACTIVE!');
          if (window.soundEngine) {
            window.soundEngine.playPowerupSFX();
            if (window.soundEngine.playBoostSFX) window.soundEngine.playBoostSFX();
          }
        } else if (pType === 'skates') {
          state.skatesTimer = 16.0;
          showToast('🛼 TURBO ROLLER SKATES! WHEEL SPEED RUSH!');
          if (window.soundEngine) {
            window.soundEngine.playPowerupSFX();
            if (window.soundEngine.playSneakersSFX) window.soundEngine.playSneakersSFX();
          }
        } else if (pType === 'mystery') {
          const rolls = Math.random();
          if (rolls < 0.40) {
            const bonus = 150;
            state.coins += bonus;
            careerStats.totalCoins = (careerStats.totalCoins || 0) + bonus;
            saveCareerStats();
            updateCareerStatsUI();
            state.score += 1500;
            showToast(`🎁 MYSTERY CRATE JACKPOT! +${bonus} CRYSTALS! 💎`);
            if (typeof addComboPoint === 'function') addComboPoint(4);
          } else if (rolls < 0.65) {
            activateHoverboardSurf();
            showToast('🎁 MYSTERY BOX: 🛹 CYBER HOVERBOARD SURF!');
          } else if (rolls < 0.85) {
            startJetpack(14);
            showToast('🎁 MYSTERY BOX: 🚀 MEGA SKY FLIGHT!');
          } else {
            showToast('🎁 MYSTERY BOX: 💥 SONIC EMP BLAST!');
            for (let oi = obstacles.length - 1; oi >= 0; oi--) {
              const obs = obstacles[oi];
              if (obs.position.z >= -140 && obs.position.z <= 15) {
                const oLane = obs.userData.lane;
                const oZ = obs.position.z;
                scene.remove(obs);
                obstacles.splice(oi, 1);
                createCrystal(oLane, oZ, 1.2);
              }
            }
          }
          if (window.soundEngine) {
            window.soundEngine.playPowerupSFX();
            window.soundEngine.playCoinSFX();
          }
        }

        scene.remove(p);
        powerups.splice(i, 1);
        continue;
      }

      if (p.position.z > 20) {
        scene.remove(p);
        powerups.splice(i, 1);
      }
    }

    // Move & collect crystals (Supports Chumbak / Magnet / Jetpack / Vortex pulls!)
    const isMagnet = state.magnetTimer > 0;
    const isFlying = state.jetpackTimer > 0;
    const isVortex = state.vortexTimer > 0;
    const pullHeight = isFlying ? state.playerY + 0.7 : GROUND_CRYSTAL_Y;
    for (let i = coins.length - 1; i >= 0; i--) {
      const crystal = coins[i];
      crystal.position.z += moveZ;
      crystal.rotation.y += delta * 4.5;
      crystal.rotation.x += delta * 2.0;
      updateFlightCrystal(crystal, delta);

      const dist = crystal.position.distanceTo(playerGroup.position);

      const canPull = isFlying === Boolean(crystal.userData.flightTrail);

      if (canPull && isVortex && dist < 85) {
        // Ultra-strong Rainbow Singularity Vortex pulls across all lanes & roofs
        crystal.position.x += (state.playerX - crystal.position.x) * 24 * delta;
        crystal.position.y += (pullHeight - crystal.position.y) * 24 * delta;
        crystal.position.z += (playerGroup.position.z - crystal.position.z) * 20 * delta;
      } else if (canPull && (isMagnet || isFlying) && dist < 42) {
        // Strong 3D vacuum pull towards player in X, Y, and Z!
        crystal.position.x += (state.playerX - crystal.position.x) * 18 * delta;
        crystal.position.y += (pullHeight - crystal.position.y) * 18 * delta;
        crystal.position.z += (playerGroup.position.z - crystal.position.z) * 15 * delta;
      } else if (canPull && (state.isBoosted || state.skatesTimer > 0) && dist < 22) {
        crystal.position.x += (state.playerX - crystal.position.x) * 16 * delta;
        crystal.position.y += (pullHeight - crystal.position.y) * 16 * delta;
        crystal.position.z += (playerGroup.position.z - crystal.position.z) * 14 * delta;
      }

      if (dist < 2.4 && !crystal.userData.collected) {
        crystal.userData.collected = true;
        const crystalGain = (state.doublerTimer > 0) ? 2 : 1;
        state.coins += crystalGain;
        careerStats.totalCoins = (careerStats.totalCoins || 0) + crystalGain;
        saveCareerStats();
        updateCareerStatsUI();
        state.score += 80 * crystalGain;
        if (typeof addComboPoint === 'function') addComboPoint(1);
        if (window.soundEngine) window.soundEngine.playCoinSFX();
        scene.remove(crystal);
        coins.splice(i, 1);
        continue;
      }

      if (crystal.position.z > 20) {
        scene.remove(crystal);
        coins.splice(i, 1);
      }
    }

    // Procedural Spawner
    nextSpawnZ += moveZ;
    spawnWorldPattern();

    // HUD Update
    if (hudScore) hudScore.textContent = Math.floor(state.score);
    if (hudCoins) hudCoins.textContent = state.coins;
    if (hudSpeed) hudSpeed.textContent = Math.floor(state.speed * 1.2) + ' KM/H';
  }

  // --- COLLISION LOGIC ---
  function checkCollision(obs, previousZ) {
    if (state.godMode) return false;
    // Jetpack or Quantum Ghost Phase: 100% immune from all obstacles!
    if (state.jetpackTimer > 0 || state.ghostTimer > 0) return false;

    const laneX = LANES[obs.userData.lane];
    // Check if player is horizontally in the obstacle's lane
    if (Math.abs(state.playerX - laneX) > 1.05) return false;

    // A hoverboard shield absorbs one hit from this obstacle.
    if (obs.userData.cleared) return false;

    const zPos = obs.position.z;

    if (obs.userData.type === 'train') {
      // If train has front ramp, player climbs up smoothly without crash
      if (obs.userData.hasRamp && zPos >= -19.0 && zPos <= -12.5) {
        return false;
      }

      // Check if player is on the roof
      if (state.playerY >= TRAIN_HEIGHT - 0.35) {
        return false; // Safely running on the roof
      }

      // If player is below roof level and inside the train longitudinally:
      if (zPos >= -12.5 && zPos <= 12.0) {
        return true; // CRASH! Hit the train (head-on or side impact)!
      }
    } else {
      // Check the entire distance the obstacle traveled during this frame.
      const contactDepth = obs.userData.depth / 2 + 0.18;
      if (previousZ > contactDepth || zPos < -contactDepth) return false;

      if (obs.userData.type === 'hurdle') {
        return state.playerY < obs.userData.height;
      }
      if (obs.userData.type === 'overhead') {
        const runnerHeight = state.isSliding ? 1.35 : 2.95;
        const underBeam = state.playerY + runnerHeight < obs.userData.slideClearance;
        const overBeam = state.playerY >= 2.8;
        return !underBeam && !overBeam;
      }
    }

    return false;
  }

  // --- RENDER LOOP ---
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.08);
    update(delta);
    updateRunnerSprite(delta);
    const rushing = state.running && !state.paused && state.isBoosted;
    const flying = state.running && !state.paused && state.jetpackTimer > 0;
    container.classList.toggle('is-rushing', rushing);
    container.classList.toggle('is-flying', flying);
    for (const ribbon of trailRibbons) {
      ribbon.visible = state.running && trailPoints.length > 1;
    }
    if (renderer && scene && camera) {
      const baseFov = camera.aspect < 0.65 ? 68 : 58;
      const targetFov = baseFov + (reducedMotion.matches ? 0 : rushing ? 7 : flying ? 4 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov += (targetFov - camera.fov) * Math.min(delta * 8, 1);
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    }
  }

  function onWindowResize() {
    if (!renderer || !camera || !container) return;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < 0.65 ? 68 : 58;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    fitMetroSky();
  }

  window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    animate();
  });

  window.gameState = state;
  window.gameObstacles = obstacles;
  window.doJump = doJump;
  window.doSlide = doSlide;
  window.activateHoverboardSurf = activateHoverboardSurf;
  window.createHurdleObstacle = createHurdleObstacle;
  window.applyTheme = applyTheme;
  window.useStoredJetpack = useStoredJetpack;
  window.useStoredMagnet = useStoredMagnet;
})();
