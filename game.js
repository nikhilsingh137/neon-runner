/**
 * Urban Dash 3D - Metro Rush
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

  // --- GAME STATE ---
  const state = {
    running: false,
    paused: false,
    score: 0,
    coins: 0, // Energy Crystals
    distance: 0,
    speed: 11, // Super relaxed beginner-friendly gentle start (13 KM/H)
    baseSpeed: 11,
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
  let leftLeg, rightLeg, leftLowerLeg, rightLowerLeg, leftArm, rightArm, leftForearm, rightForearm, headMesh, capGroup;
  let tracksGroup, obstacles = [], coins = [], powerups = [];
  let trackTies = [], sideScenery = [], speedLines = [], flightSmokeParticles = [];
  let skyClouds = [], cityBuildingsGroup;
  let clock = new THREE.Clock();
  let runAnimTime = 0;
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

  function useStoredJetpack() {
    if (!state.running || state.paused || state.storedJetpacks <= 0) return;
    state.storedJetpacks--;
    state.jetpackTimer = 11.0;
    updatePowerupSlotsUI();
    showToast('🚀 JETPACK BLAST OFF!');
    if (window.soundEngine) {
      window.soundEngine.playJetpackSFX();
      window.soundEngine.playPowerupSFX();
    }
    // Launch runway of sky crystals immediately ahead!
    for (let l = 0; l < 3; l++) {
      for (let z = 0; z < 6; z++) {
        createCrystal(l, -18 - z * 4.2, JETPACK_FLIGHT_Y);
      }
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
        scene.background = new THREE.Color(0x38bdf8);
        if (scene.fog) scene.fog.color.setHex(0x38bdf8);
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
        scene.background = new THREE.Color(0x0f172a);
        if (scene.fog) scene.fog.color.setHex(0x0f172a);
      }
      if (hemiLight) {
        hemiLight.color.setHex(0xe0f2fe);
        hemiLight.groundColor.setHex(0x1e293b);
        hemiLight.intensity = 1.0;
      }
      if (sunLight) {
        sunLight.color.setHex(0xfff8ee); // Warm, clean white directional light so skin, red kicks, white hoodie and blue denim pop!
        sunLight.intensity = 1.35;
      }
    }
    if (scene) {
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

    // Build World, City Skyline & 3D Sky Clouds
    buildMetroEnvironment();
    buildCityBuildings();
    buildSkyClouds();
    buildHeroKai();

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

    // High Quality Stylized PBR Materials (Organic soft matte fabrics, authentic Subway Surfers palette - zero machine look!)
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbd0b0, roughness: 0.65, metalness: 0.0 }); // Warm healthy cartoon teen skin
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x935116, roughness: 0.70, metalness: 0.0 }); // Caramel dirty-blonde skater hair
    const capMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55, metalness: 0.0 }); // Signature Jake Red backwards cap
    const capWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.40, metalness: 0.0 }); // Crisp white visor trim & button
    const hoodieMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85, metalness: 0.0 }); // Crisp white fleece hoodie
    const denimMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.75, metalness: 0.0 }); // Classic blue denim vest & jeans
    const denimDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.80, metalness: 0.0 }); // Deep indigo denim accents
    const denimStitchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55, metalness: 0.0 }); // Gold denim stitching & rolled cuffs
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.85 }); // Buttons, buckles & aglets
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65, metalness: 0.0 }); // Leather belt
    const goldPatchMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35, metalness: 0.25 }); // Gold graffiti street patch
    const redPatchMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.40, metalness: 0.0 }); // Red emblem star
    const slingBagMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.70, metalness: 0.0 }); // Urban canvas hip pack
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.80, metalness: 0.0 }); // Nylon strap
    const sprayCanMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.25 }); // Red spray paint can
    const sneakerSoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.30, metalness: 0.0 }); // White rubber sole & bumper
    const sneakerTreadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.0 }); // Black rubber grip
    const sneakerRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.60, metalness: 0.0 }); // Vibrant red skater canvas
    const sneakerWhiteTrim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.0 }); // Racing stripe & laces
    const wristbandMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.55, metalness: 0.0 }); // Red skater sweatband
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.20, metalness: 0.80 }); // Jetpack thrusters

    kaiModel = new THREE.Group();

    // 1. ORGANIC CONTOURED TORSO (Crisp White Streetwear Fleece Hoodie with Open Blue Denim Vest)
    // Upper Chest & Torso (White Hoodie Fleece)
    const chestGeom = new THREE.CylinderGeometry(0.40, 0.44, 0.74, 18);
    const hoodieChest = new THREE.Mesh(chestGeom, hoodieMat);
    hoodieChest.position.y = 1.74;
    hoodieChest.castShadow = true;
    kaiModel.add(hoodieChest);

    // Lower Waist & Abdomen (White Hoodie Fleece)
    const waistGeom = new THREE.CylinderGeometry(0.44, 0.40, 0.44, 18);
    const hoodieWaist = new THREE.Mesh(waistGeom, hoodieMat);
    hoodieWaist.position.y = 1.28;
    hoodieWaist.castShadow = true;
    kaiModel.add(hoodieWaist);

    // Soft Rounded Hoodie Bottom Ribbed Hem
    const hoodieHem = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.055, 8, 20), hoodieMat);
    hoodieHem.rotation.x = Math.PI / 2;
    hoodieHem.position.y = 1.08;
    kaiModel.add(hoodieHem);

    // Front Kangaroo Pouch Pocket (Smooth curved white fleece pocket)
    const pouchGeom = new THREE.CylinderGeometry(0.28, 0.33, 0.28, 14, 1, false, -Math.PI * 0.45, Math.PI * 0.90);
    const hoodiePocket = new THREE.Mesh(pouchGeom, hoodieMat);
    hoodiePocket.rotation.y = Math.PI;
    hoodiePocket.position.set(0, 1.34, -0.16);
    kaiModel.add(hoodiePocket);

    // Hanging White Drawstrings with Silver Metal Aglet Tips
    [-0.10, 0.10].forEach((strX) => {
      const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 8), hoodieMat);
      stringMesh.position.set(strX, 1.84, -0.38);
      kaiModel.add(stringMesh);
      const agletMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), metalMat);
      agletMesh.position.set(strX, 1.63, -0.38);
      kaiModel.add(agletMesh);
    });

    // Folded White Hoodie Cowl / Neck Collar
    const hoodCollar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 10, 20), hoodieMat);
    hoodCollar.rotation.x = Math.PI / 2;
    hoodCollar.position.set(0, 2.16, 0.06);
    kaiModel.add(hoodCollar);

    // Open Blue Denim Runner Vest over White Hoodie (Visible on back and sides, leaving white hoodie shoulders showing!)
    const vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.86, 0.08), denimMat);
    vestBack.position.set(0, 1.58, 0.35);
    vestBack.castShadow = true;
    kaiModel.add(vestBack);

    // Subway Surfers Street Graffiti Gold Star Back Emblem (Full view from behind!)
    const backPatch = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.02, 20), goldPatchMat);
    backPatch.rotation.x = Math.PI / 2;
    backPatch.position.set(0, 1.62, 0.40);
    kaiModel.add(backPatch);

    // Inner Red Star on Back Emblem
    const patchIcon = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.025), redPatchMat);
    patchIcon.rotation.z = Math.PI / 4;
    patchIcon.position.set(0, 1.62, 0.415);
    kaiModel.add(patchIcon);

    // Denim Vest Front Left & Right Open Panels
    [-0.30, 0.30].forEach((vx, idx) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.86, 0.08), denimMat);
      panel.position.set(vx, 1.58, -0.34);
      kaiModel.add(panel);

      const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8), metalMat);
      snap.rotation.x = Math.PI / 2;
      snap.position.set(vx, 1.76, -0.39);
      kaiModel.add(snap);
    });

    // Leather Belt & Silver Buckle at Waist
    const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18), beltMat);
    beltMesh.position.set(0, 1.05, 0);
    kaiModel.add(beltMesh);

    const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.05), metalMat);
    buckleMesh.position.set(0, 1.05, -0.41);
    kaiModel.add(buckleMesh);

    // 2. URBAN HIP PACK & SIGNATURE GRAFFITI SPRAY CAN
    const hipPack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.16), slingBagMat);
    hipPack.position.set(0.24, 1.25, 0.28);
    hipPack.rotation.z = -0.16;
    hipPack.castShadow = true;
    kaiModel.add(hipPack);

    // Cross-body nylon strap
    const crossStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.98, 0.03), strapMat);
    crossStrap.position.set(0.10, 1.64, 0.33);
    crossStrap.rotation.z = 0.42;
    kaiModel.add(crossStrap);

    // Subway Surfers Graffiti Spray Paint Can tucked in hip pack
    const sprayCan = new THREE.Group();
    sprayCan.position.set(0.36, 1.34, 0.31);
    sprayCan.rotation.z = -0.22;
    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 12), sprayCanMat);
    const canCap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.08, 12), sneakerSoleMat);
    canCap.position.y = 0.18;
    const canNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), strapMat);
    canNozzle.position.set(0, 0.24, -0.02);
    sprayCan.add(canBody);
    sprayCan.add(canCap);
    sprayCan.add(canNozzle);
    kaiModel.add(sprayCan);

    // 3. ORGANIC HANDSOME HEAD, FACE & BACKWARDS SNAPBACK CAP
    // Smooth Neck
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.26, 14), skinMat);
    neckMesh.position.set(0, 2.22, 0);
    kaiModel.add(neckMesh);

    headMesh = new THREE.Group();
    headMesh.position.set(0, 2.56, 0.02);

    // Sculpted Stylized Head Base (Organic round cartoon teen head)
    const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.37, 24, 20), skinMat);
    headBase.scale.set(0.92, 1.04, 0.98);
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

    // Expressive Cartoon Eyes (Facing -Z down the tracks)
    const eyeGeom = new THREE.SphereGeometry(0.085, 16, 16);
    const irisGeom = new THREE.SphereGeometry(0.052, 14, 14);
    const pupilGeom = new THREE.SphereGeometry(0.032, 12, 12);
    const shineGeom = new THREE.SphereGeometry(0.016, 8, 8);

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 }); // Bright blue anime eyes
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x090e17 });
    const eyeShineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [-0.14, 0.14].forEach((eyeX) => {
      const eyeW = new THREE.Mesh(eyeGeom, eyeWhiteMat);
      eyeW.position.set(eyeX, 0.04, -0.34);
      headMesh.add(eyeW);

      const iris = new THREE.Mesh(irisGeom, eyeIrisMat);
      iris.position.set(eyeX, 0.04, -0.39);
      headMesh.add(iris);

      const pupil = new THREE.Mesh(pupilGeom, eyePupilMat);
      pupil.position.set(eyeX, 0.04, -0.415);
      headMesh.add(pupil);

      // Dual highlight sparkle dots for lively cartoon eyes
      const shine1 = new THREE.Mesh(shineGeom, eyeShineMat);
      shine1.position.set(eyeX - 0.018, 0.062, -0.425);
      headMesh.add(shine1);

      const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), eyeShineMat);
      shine2.position.set(eyeX + 0.016, 0.022, -0.425);
      headMesh.add(shine2);
    });

    // Expressive Stylized Eyebrows
    [-0.14, 0.14].forEach((bx, idx) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.06), hairMat);
      brow.position.set(bx, 0.155, -0.36);
      brow.rotation.z = idx === 0 ? 0.14 : -0.14;
      headMesh.add(brow);
    });

    // Sculpted 3D Button Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), skinMat);
    nose.position.set(0, -0.04, -0.39);
    headMesh.add(nose);

    // Cheerful Runner Smile / Smirk
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 14, Math.PI * 0.75), hairMat);
    smile.rotation.x = Math.PI * 0.45;
    smile.position.set(0.02, -0.15, -0.36);
    headMesh.add(smile);

    // Flowing Caramel Skater Hair Bangs & Sideburns
    const bang1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.22, 10), hairMat);
    bang1.position.set(-0.11, 0.20, -0.32);
    bang1.rotation.set(-0.25, 0.18, -0.15);
    headMesh.add(bang1);

    const bang2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.20, 10), hairMat);
    bang2.position.set(0.11, 0.19, -0.32);
    bang2.rotation.set(-0.20, -0.15, 0.15);
    headMesh.add(bang2);

    [-0.35, 0.35].forEach((sx) => {
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 8), hairMat);
      lock.position.set(sx, -0.02, -0.10);
      headMesh.add(lock);
    });

    // Backwards Baseball Cap (Vibrant Jake Red backwards cap, flat visor facing camera +Z)
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
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.32), capMat);
    capBrim.position.set(0, 0.04, 0.38);
    capBrim.rotation.x = 0.14;
    capBrim.castShadow = true;
    capGroup.add(capBrim);

    // Crisp White Trim on Visor Edge
    const capTrim = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.025, 0.05), capWhiteMat);
    capTrim.position.set(0, 0.06, 0.53);
    capTrim.rotation.x = 0.14;
    capGroup.add(capTrim);

    // Flowing skater hair tufts peeking out under backwards cap
    const hairUnderCap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.18), hairMat);
    hairUnderCap.position.set(0, -0.08, 0.25);
    capGroup.add(hairUnderCap);

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
  function buildMetroEnvironment() {
    if (tracksGroup) scene.remove(tracksGroup);
    tracksGroup = new THREE.Group();
    trackTies = [];
    sideScenery = [];
    speedLines = [];

    const isBright = state.theme === 'bright';
    const groundColor = isBright ? 0xdbeafe : 0x090d16; // Crisp light ballast in Day vs Deep midnight in Night
    const wallColor = isBright ? 0x94a3b8 : 0x1e293b;
    const trimColor = isBright ? 0x0284c7 : 0x00f5d4; // Subway Blue trim in Day vs Electric Cyan neon in Night
    const dividerColor = isBright ? 0x94a3b8 : 0x334155;
    const tieWoodColor = isBright ? 0x451a03 : 0x0284c7; // High contrast: Rich dark timber in Day, glowing electric cyan composite in Night!
    const railColor = isBright ? 0x1e293b : 0xe2e8f0;

    // 1. High-Tech Ground Bed
    const groundGeom = new THREE.PlaneGeometry(36, 600);
    const groundMat = new THREE.MeshLambertMaterial({ color: groundColor });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -150);
    ground.receiveShadow = true;
    tracksGroup.add(ground);

    // 2. Concrete Side Retaining Walls
    const wallGeom = new THREE.BoxGeometry(1.6, 6, 600);
    const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });

    const leftWall = new THREE.Mesh(wallGeom, wallMat);
    leftWall.position.set(-8.2, 3, -150);
    tracksGroup.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeom, wallMat);
    rightWall.position.set(8.2, 3, -150);
    tracksGroup.add(rightWall);

    // Luminous edge rails along the walls
    const trimGeom = new THREE.BoxGeometry(0.12, 0.2, 600);
    const trimMat = new THREE.MeshBasicMaterial({ color: trimColor });
    const trimL = new THREE.Mesh(trimGeom, trimMat);
    trimL.position.set(-7.3, 5.8, -150);
    tracksGroup.add(trimL);
    const trimR = new THREE.Mesh(trimGeom, trimMat);
    trimR.position.set(7.3, 5.8, -150);
    tracksGroup.add(trimR);

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
      metalness: 0.9,
      roughness: 0.2
    });

    LANES.forEach((laneX) => {
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railL.position.set(laneX - 0.85, 0.1, -150);
      tracksGroup.add(railL);

      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railR.position.set(laneX + 0.85, 0.1, -150);
      tracksGroup.add(railR);
    });

    // 5. DYNAMIC TRACK SLEEPERS (Continuously scrolled backward in animate() so boy never feels running in one place!)
    const tieGeom = new THREE.BoxGeometry(2.15, 0.14, 0.46);
    const tieMat = new THREE.MeshStandardMaterial({
      color: tieWoodColor,
      roughness: isBright ? 0.7 : 0.3,
      metalness: isBright ? 0.1 : 0.4,
      emissive: isBright ? 0x000000 : 0x0369a1,
      emissiveIntensity: isBright ? 0 : 0.35
    });

    const clipGeom = new THREE.BoxGeometry(0.28, 0.16, 0.48);
    const clipMat = new THREE.MeshBasicMaterial({ color: isBright ? 0x94a3b8 : 0x38bdf8 });

    for (let z = 25; z > -320; z -= 2.5) {
      LANES.forEach((laneX) => {
        const tieGroup = new THREE.Group();
        tieGroup.position.set(laneX, 0.02, z);

        const tie = new THREE.Mesh(tieGeom, tieMat);
        tie.receiveShadow = true;
        tieGroup.add(tie);

        const clipL = new THREE.Mesh(clipGeom, clipMat);
        clipL.position.set(-0.85, 0.02, 0);
        tieGroup.add(clipL);

        const clipR = clipL.clone();
        clipR.position.x = 0.85;
        tieGroup.add(clipR);

        tracksGroup.add(tieGroup);
        trackTies.push(tieGroup);
      });
    }

    // 6. SIDE SCENERY: Subway Graffiti Murals & Street Art Panels along walls
    const muralColors = isBright
      ? [0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xec4899]
      : [0x00f5d4, 0x38bdf8, 0xf43f5e, 0xa855f7, 0xfbbf24];

    for (let z = 20; z > -320; z -= 16) {
      [-7.35, 7.35].forEach((wx, sideIdx) => {
        const mural = new THREE.Group();
        mural.position.set(wx, 3.2, z);

        const mColor = muralColors[Math.floor(Math.random() * muralColors.length)];
        const posterBg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 1.8, 3.6),
          new THREE.MeshLambertMaterial({ color: mColor })
        );
        mural.add(posterBg);

        // Graffiti tag / stripe accent
        const tag = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.45, 2.6),
          new THREE.MeshBasicMaterial({ color: isBright ? 0xffffff : 0x090e17 })
        );
        tag.position.y = (Math.random() - 0.5) * 0.4;
        tag.rotation.x = (Math.random() - 0.5) * 0.2;
        mural.add(tag);

        // Trackside glow lantern
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 8),
          new THREE.MeshBasicMaterial({ color: isBright ? 0xf59e0b : 0x00f5d4 })
        );
        lantern.position.set(sideIdx === 0 ? 0.35 : -0.35, 1.3, 0);
        mural.add(lantern);

        tracksGroup.add(mural);
        sideScenery.push(mural);
      });
    }

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

    // Overhead High-Voltage Arch Gantries
    const archMat = new THREE.MeshLambertMaterial({ color: isBright ? 0x64748b : 0x475569 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });

    for (let z = 0; z > -320; z -= 48) {
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(0, 0, z);

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8.5, 8), archMat);
      pL.position.set(-7.5, 4.25, 0);
      const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8.5, 8), archMat);
      pR.position.set(7.5, 4.25, 0);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.45, 0.45), archMat);
      beam.position.set(0, 8.2, 0);

      LANES.forEach((lx) => {
        const signal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), greenLightMat);
        signal.position.set(lx, 7.8, 0.25);
        gantryGroup.add(signal);
      });

      gantryGroup.add(pL);
      gantryGroup.add(pR);
      gantryGroup.add(beam);
      tracksGroup.add(gantryGroup);
      sideScenery.push(gantryGroup);
    }

    scene.add(tracksGroup);
  }

  // --- 3D CITY BUILDINGS SKYLINE (SUBWAY SURFERS REALISTIC CITY PALETTE) ---
  function buildCityBuildings() {
    if (cityBuildingsGroup) scene.remove(cityBuildingsGroup);
    cityBuildingsGroup = new THREE.Group();

    // Authentic architectural city colors (warm brick, limestone, slate, glass - no blinding yellow blocks!)
    const buildingColorsDark = [0x0f172a, 0x1e293b, 0x1e1b4b, 0x111827, 0x18181b];
    const buildingColorsBright = [0xc2410c, 0xb45309, 0x78716c, 0x64748b, 0x0284c7, 0x0f766e, 0x475569, 0xd97706];
    const windowColorsDark = [0x38bdf8, 0xf59e0b, 0x10b981, 0xa855f7];
    const windowColorsBright = [0xbae6fd, 0x93c5fd, 0xe0f2fe, 0x38bdf8];

    const isBright = state.theme === 'bright';
    const bColors = isBright ? buildingColorsBright : buildingColorsDark;
    const wColors = isBright ? windowColorsBright : windowColorsDark;

    // Both sides beyond track walls
    [-1, 1].forEach((side) => {
      for (let z = 20; z > -340; z -= 14) {
        const height = 20 + Math.random() * 34;
        const width = 8 + Math.random() * 5;
        const depth = 10 + Math.random() * 5;
        const posX = side * (16.5 + Math.random() * 10);

        const bColor = bColors[Math.floor(Math.random() * bColors.length)];
        const bMat = new THREE.MeshLambertMaterial({ color: bColor });
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bMat);
        building.position.set(posX, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        cityBuildingsGroup.add(building);

        // Windows illuminated pattern
        const winMat = new THREE.MeshBasicMaterial({
          color: wColors[Math.floor(Math.random() * wColors.length)]
        });
        const winGeom = new THREE.BoxGeometry(width * 0.88, 0.45, depth + 0.1);
        for (let wy = 4; wy < height - 2; wy += 3.2) {
          if (Math.random() < 0.7) {
            const winStripe = new THREE.Mesh(winGeom, winMat);
            winStripe.position.set(posX, wy, z);
            cityBuildingsGroup.add(winStripe);
          }
        }
      }
    });

    scene.add(cityBuildingsGroup);
  }

  // --- 3D SKY CLOUDS (SUBWAY SURFERS SKY HIGH ELEVATION) ---
  function buildSkyClouds() {
    skyClouds.forEach((c) => scene.remove(c));
    skyClouds = [];

    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92
    });

    for (let i = 0; i < 26; i++) {
      const cloud = new THREE.Group();
      const r = 2.4 + Math.random() * 2.2;
      const p1 = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), cloudMat);
      const p2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 7, 7), cloudMat);
      p2.position.set(r * 0.75, -r * 0.15, 0);
      const p3 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 7, 7), cloudMat);
      p3.position.set(-r * 0.75, -r * 0.15, 0);
      const p4 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 7, 7), cloudMat);
      p4.position.set(0, r * 0.45, r * 0.2);

      cloud.add(p1);
      cloud.add(p2);
      cloud.add(p3);
      cloud.add(p4);

      cloud.position.set(
        (Math.random() - 0.5) * 85,
        12.0 + Math.random() * 14.0,
        -Math.random() * 320
      );
      scene.add(cloud);
      skyClouds.push(cloud);
    }
  }

  // --- SLEEK HIGH-SPEED METRO MONORAIL TRAINS ---
  function createMonorailObstacle(laneIndex, zPos, hasRamp = false) {
    const trainGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    trainGroup.position.set(laneX, 0, zPos);

    const trainDepth = 26;

    // Aerodynamic Monorail Express Carriage Body (Electric Blue & Silver)
    const bodyGeom = new THREE.BoxGeometry(2.35, TRAIN_HEIGHT, trainDepth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.4
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = TRAIN_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    trainGroup.add(body);

    // Neon Speed Stripe along sides
    const stripeGeom = new THREE.BoxGeometry(2.38, 0.25, trainDepth);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.y = TRAIN_HEIGHT * 0.65;
    trainGroup.add(stripe);

    // Runnable Roof
    const roofGeom = new THREE.BoxGeometry(2.45, 0.32, trainDepth + 0.2);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.3
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = TRAIN_HEIGHT + 0.15;
    roof.receiveShadow = true;
    trainGroup.add(roof);

    // Aerodynamic Bullet Nose Windshield (+Z)
    const frontWindshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8 })
    );
    frontWindshield.position.set(0, 2.4, trainDepth / 2 + 0.05);
    trainGroup.add(frontWindshield);

    // Glowing Dual Xenon Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const lightL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 10), lightMat);
    lightL.rotation.x = Math.PI / 2;
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
      const rampMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
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

    // Crystals on top of the train roof
    for (let rz = -8; rz <= 8; rz += 3.5) {
      createCrystal(laneIndex, zPos + rz, TRAIN_HEIGHT + 1.2);
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

  function createOverheadSlideObstacle(laneIndex, zPos) {
    const beamGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    beamGroup.position.set(laneX, 0, zPos);

    // Cyber Overhead Laser Gantry (Must Duck / Slide Under - "jhukna padhta hai")
    const gantryGeom = new THREE.BoxGeometry(2.55, 1.5, 0.38);
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.7
    });
    const gantry = new THREE.Mesh(gantryGeom, gantryMat);
    gantry.position.y = 2.45;
    gantry.castShadow = true;
    beamGroup.add(gantry);

    // Amber Laser Security Warning Plate
    const plateGeom = new THREE.BoxGeometry(2.2, 0.5, 0.42);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5
    });
    const plate = new THREE.Mesh(plateGeom, plateMat);
    plate.position.set(0, 2.55, 0);
    beamGroup.add(plate);

    // Holographic Down Arrow Indicating "SLIDE UNDER / DUCK"
    const arrowGeom = new THREE.ConeGeometry(0.22, 0.35, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.6, 0, 0.6].forEach((ax) => {
      const arrow = new THREE.Mesh(arrowGeom, arrowMat);
      arrow.position.set(ax, 2.55, 0.23);
      arrow.rotation.z = Math.PI; // pointing down
      beamGroup.add(arrow);
    });

    // Intense Red Clearance Laser Beam along the bottom
    const laserBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    laserBeam.rotation.z = Math.PI / 2;
    laserBeam.position.set(0, 1.7, 0);
    beamGroup.add(laserBeam);

    // Carbon Reinforced Vertical Stanchions
    const postGeom = new THREE.CylinderGeometry(0.12, 0.14, 3.4, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const postL = new THREE.Mesh(postGeom, postMat);
    postL.position.set(-1.28, 1.7, 0);
    const postR = postL.clone();
    postR.position.x = 1.28;
    beamGroup.add(postL);
    beamGroup.add(postR);

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

  function createCrystal(laneIndex, zPos, yPos = 1.2) {
    const crystal = new THREE.Mesh(crystalGeom, crystalMat);
    crystal.position.set(LANES[laneIndex], yPos, zPos);
    crystal.castShadow = true;
    crystal.userData = { lane: laneIndex, collected: false };
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

    // Cyan Flight Beacon Ring
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 8, 24), ringMat);
    beacon.rotation.x = Math.PI / 2;

    jetpackGroup.add(cL);
    jetpackGroup.add(fL);
    jetpackGroup.add(cR);
    jetpackGroup.add(fR);
    jetpackGroup.add(brace);
    jetpackGroup.add(core);
    jetpackGroup.add(beacon);

    jetpackGroup.userData = { type: 'jetpack', lane: laneIndex, collected: false };
    scene.add(jetpackGroup);
    powerups.push(jetpackGroup);
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

  // --- ORIGINAL DYNAMIC TRACK SPAWNER ---
  let nextSpawnZ = -45;

  function spawnWorldPattern() {
    while (nextSpawnZ > -280) {
      // 🚀 Sky Flight Mode: Continuous Runway of Sky Crystals (Subway Surfers Style!)
      if (state.jetpackTimer > 0) {
        const flyLane = Math.floor(Math.random() * 3);
        const secondLane = (flyLane + 1) % 3;
        for (let cz = -3; cz <= 3; cz++) {
          createCrystal(flyLane, nextSpawnZ + cz * 3.4, JETPACK_FLIGHT_Y);
        }
        for (let cz = -2; cz <= 2; cz++) {
          createCrystal(secondLane, nextSpawnZ + cz * 3.4, JETPACK_FLIGHT_Y);
        }
        nextSpawnZ -= 36;
        continue;
      }

      const roll = Math.random();
      const openLane = Math.floor(Math.random() * 3);
      const obstacleLane = (openLane + 1 + Math.floor(Math.random() * 2)) % 3;
      const otherLane = 3 - openLane - obstacleLane;

      // Spawn Power-Ups periodically (38% chance for one of 8 Epic Boosts in open lane!)
      if (Math.random() < 0.38) {
        const pChoice = Math.random();
        const pZ = nextSpawnZ + 8;
        if (pChoice < 0.16) {
          createMagnetPowerup(openLane, pZ);
        } else if (pChoice < 0.29) {
          createJetpackPowerup(openLane, pZ);
        } else if (pChoice < 0.43) {
          createSneakersPowerup(openLane, pZ);
        } else if (pChoice < 0.57) {
          createDoublerPowerup(openLane, pZ);
        } else if (pChoice < 0.71) {
          createWarpPowerup(openLane, pZ);
        } else if (pChoice < 0.82) {
          createEMPPowerup(openLane, pZ);
        } else if (pChoice < 0.91) {
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
        createCrystal(obstacleLane, nextSpawnZ + 3.8, 1.4);
        createCrystal(obstacleLane, nextSpawnZ, 3.4);
        createCrystal(obstacleLane, nextSpawnZ - 3.8, 1.4);
        nextSpawnZ -= 52;
      } else {
        // Pattern 4: Parkour Rhythm Agility Combo (Jump ➔ Slide / Duck!)
        createHurdleObstacle(obstacleLane, nextSpawnZ);
        createCrystal(obstacleLane, nextSpawnZ, 3.4);

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
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') doJump();
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') doSlide();
      else if (e.key === 'Shift') triggerBoost();
      else if (e.key === 'e' || e.key === 'E') useStoredMagnet();
      else if (e.key === 'q' || e.key === 'Q') useStoredJetpack();
    });

    // Mobile Swipe Gesture (Smooth, Responsive & No Pull-To-Refresh Jitter)
    const overlay = document.getElementById('touch-overlay');
    let touchStartX = 0;
    let touchStartY = 0;
    let hasSwipedInCurrentTouch = false;

    const handleTouchStart = (e) => {
      if (state.controlMode !== 'swipe') return; // If Touch Buttons active, do not track swipe
      if (!state.running || state.paused) return;
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
    // Responsive Jump & Hop Buffer: Triggers when grounded OR near ground landing
    if (!state.isJumping || state.playerY < 1.4 || state.vy < 0) {
      state.isJumping = true;
      state.isSliding = false;
      state.lastJumpTime = Date.now();
      const jumpHeight = (state.sneakersTimer > 0) ? 7.6 : JUMP_HEIGHT;
      state.vy = Math.sqrt(2 * GRAVITY * jumpHeight);

      // 🦘 Hurdle Breaker Guarantee: Immediately mark ALL approaching hurdles as safely cleared!
      // Even if player lands slightly early or jumped early, jump clearance is 100% granted!
      obstacles.forEach((obs) => {
        if (obs.userData && obs.userData.type === 'hurdle') {
          if (obs.position.z >= -35 && obs.position.z <= 4.0) {
            obs.userData.cleared = true;
          }
        }
      });

      if (state.sneakersTimer > 0 && window.soundEngine && window.soundEngine.playSneakersSFX) {
        window.soundEngine.playSneakersSFX();
      } else if (window.soundEngine) {
        window.soundEngine.playJumpSFX();
      }
    }
  }

  function doSlide() {
    if (state.jetpackTimer > 0) return;
    state.isSliding = true;
    state.slideTimer = state.slideDuration;
    state.lastSlideTime = Date.now();
    if (state.isJumping) {
      state.vy = -22;
    }
    // Mark approaching overhead beams as cleared!
    obstacles.forEach((obs) => {
      if (obs.userData && obs.userData.type === 'overhead') {
        if (obs.position.z >= -35 && obs.position.z <= 4.0) {
          obs.userData.cleared = true;
        }
      }
    });
    if (window.soundEngine) window.soundEngine.playSlideSFX();
  }

  function triggerBoost() {
    if (state.overdriveCharge >= 25 || state.isBoosted) {
      state.isBoosted = true;
      state.hasShield = true;
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
    } else {
      pauseScreen.classList.add('hidden');
    }
  }

  // --- START GAME ---
  function startGame() {
    state.running = true;
    state.paused = false;
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
    state.baseSpeed = 11;
    state.currentLane = 0;
    state.playerX = 0;
    state.targetX = 0;
    state.playerY = 0;
    state.groundY = 0;
    state.vy = 0;
    state.isJumping = false;
    state.isSliding = false;
    state.slideTimer = 0;
    state.lastJumpTime = 0;
    state.lastSlideTime = 0;
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
    if (badgeShield) badgeShield.style.display = 'none';

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

  // --- UPDATE LOOP ---
  function update(delta) {
    if (!state.running) {
      // 3D Menu Idle Animation: Showcase 3D Runner Kai in dynamic hero stance!
      menuIdleTime += delta;
      if (playerGroup) {
        playerGroup.position.set(0, 0, 0);
        // Face camera slightly at a confident hero angle
        playerGroup.rotation.y = Math.PI + Math.sin(menuIdleTime * 1.4) * 0.12;
      }
      if (kaiModel) {
        const breathe = Math.sin(menuIdleTime * 2.5) * 0.025;
        kaiModel.position.y = breathe;
        if (leftArm) leftArm.rotation.x = 0.2 + Math.sin(menuIdleTime * 1.6) * 0.06;
        if (rightArm) rightArm.rotation.x = -0.15 + Math.sin(menuIdleTime * 1.6 + 1.2) * 0.06;
        if (leftLeg) leftLeg.rotation.x = 0;
        if (rightLeg) rightLeg.rotation.x = 0;
      }
      if (camera) {
        // Framed hero view showcasing runner boy and skyline behind transparent menu!
        const orbitX = Math.sin(menuIdleTime * 0.4) * 0.35;
        camera.position.set(orbitX, 1.85, 4.3);
        camera.lookAt(0, 1.25, 0);
      }
      return;
    }
    if (state.paused) return;

    // 1. Magnet (Chumbak) Timer & HUD
    if (state.magnetTimer > 0) {
      state.magnetTimer -= delta;
      if (badgeMagnet) badgeMagnet.style.display = 'flex';
      if (timerMagnet) timerMagnet.textContent = Math.ceil(state.magnetTimer) + 's';
      if (state.magnetTimer <= 0 && badgeMagnet) badgeMagnet.style.display = 'none';
    }

    // 2. Jetpack (Fly Thing) Timer & HUD
    if (state.jetpackTimer > 0) {
      state.jetpackTimer -= delta;
      if (badgeJetpack) badgeJetpack.style.display = 'flex';
      if (timerJetpack) timerJetpack.textContent = Math.ceil(state.jetpackTimer) + 's';
      if (jetpackMesh) jetpackMesh.visible = true;

      // Fly high in the sky!
      state.targetY = JETPACK_FLIGHT_Y;
      state.playerY += (JETPACK_FLIGHT_Y - state.playerY) * 6 * delta;

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

    // Progressive Speed: Starts super calm & slow at 13 KM/H (speed 11), gentle gradual acceleration like big games!
    const distFactor = Math.max(0, state.distance - 40) * 0.016;
    const scoreFactor = Math.sqrt(Math.max(0, state.score - 50)) * 0.14;
    const naturalSpeed = Math.min(65, 11 + distFactor + scoreFactor);

    if (state.isBoosted) {
      state.boostTimer -= delta;
      state.speed = 60;
      if (state.boostTimer <= 0) {
        state.isBoosted = false;
        state.hasShield = false;
        state.speed = naturalSpeed;
        if (hoverboardMesh) hoverboardMesh.visible = false;
        if (badgeShield) badgeShield.style.display = 'none';
      }
    } else {
      state.speed = naturalSpeed;
    }

    // Time Dilation when Time Warp is active (Slow-mo world & obstacles by 55%)
    const timeScale = (state.warpTimer > 0) ? 0.45 : 1.0;
    const distDelta = state.speed * delta * timeScale;
    state.distance += state.speed * delta;
    state.score += distDelta * state.multiplier * 1.5;

    // Overdrive gauge
    state.overdriveCharge = Math.min(100, state.overdriveCharge + delta * 7);
    if (hudOverdriveFill) hudOverdriveFill.style.width = state.overdriveCharge + '%';

    // Snappy Lane Transition
    state.playerX += (state.targetX - state.playerX) * 28 * delta;

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

    // Dynamic Camera follow (Classic Subway Surfers perspective - exact comfortable size as before)
    const targetCamX = state.playerX * 0.72;
    camera.position.x += (targetCamX - camera.position.x) * 16 * delta;

    if (state.jetpackTimer > 0) {
      // High Sky View during Jetpack Flight (Subway Surfers High Elevation)
      camera.position.y += ((JETPACK_FLIGHT_Y + 3.8) - camera.position.y) * 8 * delta;
      camera.position.z += (8.6 - camera.position.z) * 8 * delta;
      camera.lookAt(state.playerX * 0.45, JETPACK_FLIGHT_Y - 0.8, -25);
    } else {
      // Classic Ground Track 3rd-Person Framing with Footstep Bounce
      const runBounce = (!state.isJumping && !state.isSliding) ? Math.sin(runAnimTime * 2.2) * 0.05 : 0;
      const targetCamY = (state.isSliding ? 3.8 : 4.6) + runBounce;
      camera.position.y += (targetCamY - camera.position.y) * 14 * delta;
      camera.position.z += (8.2 - camera.position.z) * 14 * delta;
      camera.lookAt(state.playerX * 0.4, 1.7 + runBounce * 0.5, -18);
    }

    // Continuously scroll track ties backward at run speed (Fixes boy running in one place!)
    for (let i = 0; i < trackTies.length; i++) {
      trackTies[i].position.z += distDelta;
      if (trackTies[i].position.z > 25) {
        trackTies[i].position.z -= 345;
      }
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

    // Scroll & Drift 3D Sky Clouds
    skyClouds.forEach((c) => {
      c.position.z += distDelta * 0.45;
      if (c.position.z > 25) {
        c.position.z = -300 - Math.random() * 40;
        c.position.x = (Math.random() - 0.5) * 85;
      }
    });

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
          sp.position.z += (sp.userData.vz + distDelta) * delta;
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
      obs.position.z += moveZ;

      if (obs.position.z > -30 && obs.position.z < 18) {
        if (checkCollision(obs)) {
          // If shielded by hoverboard, absorb hit!
          if (state.hasShield) {
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
          state.jetpackTimer = 12.0;
          careerStats.totalJetpacks = (careerStats.totalJetpacks || 0) + 1;
          saveCareerStats();
          updateCareerStatsUI();
          updatePowerupSlotsUI();
          showToast('🚀 JETPACK BLAST OFF!');
          if (window.soundEngine) {
            window.soundEngine.playJetpackSFX();
            window.soundEngine.playPowerupSFX();
          }
          // Launch a sparkling runway of sky crystals ahead
          for (let l = 0; l < 3; l++) {
            for (let z = 0; z < 8; z++) {
              createCrystal(l, -18 - z * 4.2, JETPACK_FLIGHT_Y);
            }
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
    for (let i = coins.length - 1; i >= 0; i--) {
      const crystal = coins[i];
      crystal.position.z += moveZ;
      crystal.rotation.y += delta * 4.5;
      crystal.rotation.x += delta * 2.0;

      const dist = crystal.position.distanceTo(playerGroup.position);

      const isMagnet = state.magnetTimer > 0;
      const isFlying = state.jetpackTimer > 0;
      const isVortex = state.vortexTimer > 0;

      if (isVortex && dist < 85) {
        // Ultra-strong Rainbow Singularity Vortex pulls across all lanes & roofs
        crystal.position.x += (state.playerX - crystal.position.x) * 24 * delta;
        crystal.position.y += (state.playerY + 1.2 - crystal.position.y) * 24 * delta;
        crystal.position.z += (playerGroup.position.z - crystal.position.z) * 20 * delta;
      } else if ((isMagnet || isFlying) && dist < 42) {
        // Strong 3D vacuum pull towards player in X, Y, and Z!
        crystal.position.x += (state.playerX - crystal.position.x) * 18 * delta;
        crystal.position.y += (state.playerY + 1.2 - crystal.position.y) * 18 * delta;
        crystal.position.z += (playerGroup.position.z - crystal.position.z) * 15 * delta;
      } else if (state.isBoosted && dist < 18) {
        crystal.position.x += (state.playerX - crystal.position.x) * 14 * delta;
        crystal.position.y += (state.playerY + 1.2 - crystal.position.y) * 14 * delta;
        crystal.position.z += (playerGroup.position.z - crystal.position.z) * 12 * delta;
      }

      if (dist < 2.4 && !crystal.userData.collected) {
        crystal.userData.collected = true;
        const crystalGain = (state.doublerTimer > 0) ? 2 : 1;
        state.coins += crystalGain;
        careerStats.totalCoins = (careerStats.totalCoins || 0) + crystalGain;
        saveCareerStats();
        updateCareerStatsUI();
        state.score += 80 * crystalGain;
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
  function checkCollision(obs) {
    if (state.godMode) return false;
    // Jetpack or Quantum Ghost Phase: 100% immune from all obstacles!
    if (state.jetpackTimer > 0 || state.ghostTimer > 0) return false;

    const laneX = LANES[obs.userData.lane];
    // Check if player is horizontally in the obstacle's lane
    if (Math.abs(state.playerX - laneX) > 1.05) return false;

    // If previously cleared during jump/slide approach, never crash!
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
    } else if (obs.userData.type === 'hurdle') {
      // 🦘 High Hurdle Jump Clearance:
      // If player jumped, is currently jumping, feet are airborne, recently jumped (1.8s buffer), or already cleared: NEVER CRASH!
      const recentlyJumped = state.lastJumpTime && (Date.now() - state.lastJumpTime < 1800);
      if (state.isJumping || state.playerY > 0.05 || recentlyJumped || obs.userData.cleared) {
        obs.userData.cleared = true;
        return false;
      }

      // If within 30m approaching hurdle, check airborne/jump state
      if (zPos >= -30.0 && zPos <= 4.0) {
        if (state.isJumping || state.playerY > 0.05 || recentlyJumped || obs.userData.cleared) {
          obs.userData.cleared = true;
          return false;
        }
      }

      // Physical hurdle contact window (Depth is 0.28m)
      if (zPos >= -0.32 && zPos <= 0.32) {
        if (state.isJumping || state.playerY > 0.05 || recentlyJumped || obs.userData.cleared) {
          obs.userData.cleared = true;
          return false;
        }
        return true; // CRASH! Ran straight into low hurdle while standing/running on the ground without jumping!
      }
    } else if (obs.userData.type === 'overhead') {
      // 🛹 Overhead Laser Gantry Clearance:
      const recentlySlid = state.lastSlideTime && (Date.now() - state.lastSlideTime < 1600);
      if (state.isSliding || state.slideTimer > 0 || recentlySlid || obs.userData.cleared) {
        obs.userData.cleared = true;
        return false;
      }
      if (zPos >= -30.0 && zPos <= 4.0) {
        if (state.isSliding || state.slideTimer > 0 || recentlySlid || obs.userData.cleared) {
          obs.userData.cleared = true;
          return false;
        }
      }
      // Tight physical overhead gantry contact window ONLY
      if (zPos >= -0.38 && zPos <= 0.38) {
        if (state.isSliding || state.slideTimer > 0 || recentlySlid || obs.userData.cleared) {
          obs.userData.cleared = true;
          return false;
        }
        return true; // CRASH! Ran upright into overhead laser gantry!
      }
    }

    return false;
  }

  // --- RENDER LOOP ---
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.08);
    update(delta);
    if (renderer && scene && camera) {
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
  }

  window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    animate();
  });

  window.gameState = state;
  window.gameObstacles = obstacles;
  window.doJump = doJump;
  window.doSlide = doSlide;
  window.createHurdleObstacle = createHurdleObstacle;
  window.applyTheme = applyTheme;
  window.useStoredJetpack = useStoredJetpack;
  window.useStoredMagnet = useStoredMagnet;
})();
