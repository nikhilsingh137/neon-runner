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
    speed: 48,
    maxSpeed: 82,
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
    // Power-ups
    magnetTimer: 0,
    jetpackTimer: 0,
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
      // Dark cyber night
      document.body.classList.remove('theme-bright');
      document.body.classList.add('theme-dark');
      if (optDark) optDark.classList.add('active');
      if (optBright) optBright.classList.remove('active');
      if (scene) {
        scene.background = new THREE.Color(0x060913);
        if (scene.fog) scene.fog.color.setHex(0x060913);
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
    if (scene) buildCityBuildings();
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
    setupControls();
    applyControlMode(state.controlMode);

    window.addEventListener('resize', onWindowResize);
  }

  // --- BUILD HERO RUNNER (KAI - SUBWAY SURFERS AUTHENTIC 3D RUNNER HERO) ---
  function buildHeroKai() {
    playerGroup = new THREE.Group();

    // High Quality Stylized PBR Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd8b8, roughness: 0.5, metalness: 0.02 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.65 }); // Caramel dirty-blonde skater hair
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.45 }); // Royal denim blue cap crown
    const capWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // White backwards visor & button
    const hoodieMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }); // Clean crisp white hoodie
    const denimMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 }); // Classic indigo denim vest & jeans
    const denimDarkMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.6 }); // Deep denim panels
    const denimStitchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 }); // Tan/gold denim stitching & cuffs
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 }); // Buttons & buckles
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.55 }); // Leather belt
    const goldPatchMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3, metalness: 0.4 }); // Gold street graffiti back patch
    const redPatchMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 }); // Red patch star / emblem
    const slingBagMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 }); // Urban canvas hip pack
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }); // Cross-body strap
    const sprayCanMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.3 }); // Red spray paint can
    const sneakerSoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }); // White rubber sole & toe bumper
    const sneakerTreadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }); // Black sole grip
    const sneakerRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }); // Jake vibrant red skater canvas
    const sneakerWhiteTrim = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); // Racing stripe & laces
    const wristbandMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }); // Skater sweatband
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.85 });

    kaiModel = new THREE.Group();

    // 1. TORSO (Crisp White Streetwear Hoodie with Denim Runner Vest & Back Graffiti Patch)
    // Inner White Hoodie
    const hoodieBody = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.15, 0.56), hoodieMat);
    hoodieBody.position.y = 1.6;
    hoodieBody.castShadow = true;
    kaiModel.add(hoodieBody);

    // Front Kangaroo Pouch Pocket
    const hoodiePocket = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.32, 0.10), hoodieMat);
    hoodiePocket.position.set(0, 1.34, -0.28);
    kaiModel.add(hoodiePocket);

    // Hoodie Drawstrings (Hanging down chest)
    [-0.10, 0.10].forEach((strX) => {
      const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), hoodieMat);
      stringMesh.position.set(strX, 1.82, -0.31);
      kaiModel.add(stringMesh);
      const agletMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), metalMat);
      agletMesh.position.set(strX, 1.64, -0.31);
      kaiModel.add(agletMesh);
    });

    // Folded Hoodie Collar / Hood around neck
    const hoodCollar = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 16), hoodieMat);
    hoodCollar.rotation.x = Math.PI / 2;
    hoodCollar.position.set(0, 2.18, 0.08);
    kaiModel.add(hoodCollar);

    // Denim Runner Vest (Back panel visible to player camera!)
    const vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.08, 0.14), denimMat);
    vestBack.position.set(0, 1.62, 0.26);
    vestBack.castShadow = true;
    kaiModel.add(vestBack);

    // Trademark Subway Surfers Graffiti Street Emblem on Back of Vest!
    const backPatch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20), goldPatchMat);
    backPatch.rotation.x = Math.PI / 2;
    backPatch.position.set(0, 1.68, 0.34);
    kaiModel.add(backPatch);

    // Inner Star / Lightning Icon on Back Patch
    const patchIcon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), redPatchMat);
    patchIcon.rotation.z = Math.PI / 4;
    patchIcon.position.set(0, 1.68, 0.355);
    kaiModel.add(patchIcon);

    // Vest Left & Right Front Panels (Open jacket showing white hoodie down center)
    const vestFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.08, 0.14), denimMat);
    vestFrontL.position.set(-0.33, 1.62, -0.24);
    kaiModel.add(vestFrontL);

    const vestFrontR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.08, 0.14), denimMat);
    vestFrontR.position.set(0.33, 1.62, -0.24);
    kaiModel.add(vestFrontR);

    // Denim Vest Lapels
    const lapelGeom = new THREE.BoxGeometry(0.13, 0.30, 0.05);
    const lapelL = new THREE.Mesh(lapelGeom, denimDarkMat);
    lapelL.position.set(-0.24, 2.02, -0.32);
    lapelL.rotation.z = -0.22;
    kaiModel.add(lapelL);

    const lapelR = new THREE.Mesh(lapelGeom, denimDarkMat);
    lapelR.position.set(0.24, 2.02, -0.32);
    lapelR.rotation.z = 0.22;
    kaiModel.add(lapelR);

    // Vest Chest Pockets with Silver Snaps
    [-0.31, 0.31].forEach((px) => {
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), denimDarkMat);
      pocket.position.set(px, 1.78, -0.32);
      kaiModel.add(pocket);

      const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 8), metalMat);
      snap.rotation.x = Math.PI / 2;
      snap.position.set(px, 1.84, -0.34);
      kaiModel.add(snap);
    });

    // Leather Belt & Metal Buckle at Waist
    const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.09, 0.58), beltMat);
    beltMesh.position.set(0, 1.05, 0);
    kaiModel.add(beltMesh);

    const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.04), metalMat);
    buckleMesh.position.set(0, 1.05, -0.30);
    kaiModel.add(buckleMesh);

    // 2. URBAN CROSS-BODY SLING HIP PACK & SIGNATURE GRAFFITI SPRAY CAN
    const hipPack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.16), slingBagMat);
    hipPack.position.set(0.24, 1.25, 0.28);
    hipPack.rotation.z = -0.18;
    hipPack.castShadow = true;
    kaiModel.add(hipPack);

    // Cross-body strap running from left shoulder across back to right hip
    const crossStrap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.95, 0.03), strapMat);
    crossStrap.position.set(0.10, 1.62, 0.30);
    crossStrap.rotation.z = 0.42;
    kaiModel.add(crossStrap);

    // Subway Surfers Graffiti Spray Paint Can tucked in hip pack!
    const sprayCan = new THREE.Group();
    sprayCan.position.set(0.38, 1.34, 0.31);
    sprayCan.rotation.z = -0.22;
    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 10), sprayCanMat);
    const canCap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.08, 10), sneakerSoleMat);
    canCap.position.y = 0.18;
    const canNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), strapMat);
    canNozzle.position.set(0, 0.24, -0.02);
    sprayCan.add(canBody);
    sprayCan.add(canCap);
    sprayCan.add(canNozzle);
    kaiModel.add(sprayCan);

    // 3. HEAD, FACE & BACKWARDS SNAPBACK CAP
    // Neck
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.24, 12), skinMat);
    neckMesh.position.set(0, 2.22, 0);
    kaiModel.add(neckMesh);

    headMesh = new THREE.Group();
    headMesh.position.set(0, 2.56, 0.02);

    // Sculpted Head Base
    const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 16), skinMat);
    headBase.scale.set(0.92, 1.04, 0.96);
    headBase.castShadow = true;
    headMesh.add(headBase);

    // 3D Cartoon Ears
    [-0.37, 0.37].forEach((ex) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(ex, 0, 0);
      const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 10), skinMat);
      earOuter.scale.set(0.5, 1.1, 0.85);
      const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), hairMat);
      earInner.scale.set(0.4, 0.8, 0.6);
      earInner.position.z = -0.02;
      earGroup.add(earOuter);
      earGroup.add(earInner);
      headMesh.add(earGroup);
    });

    // Expressive Cartoon Eyes (Facing -Z down the tracks)
    const eyeGeom = new THREE.SphereGeometry(0.085, 14, 14);
    const irisGeom = new THREE.SphereGeometry(0.052, 12, 12);
    const pupilGeom = new THREE.SphereGeometry(0.032, 10, 10);
    const shineGeom = new THREE.SphereGeometry(0.015, 8, 8);

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 }); // Bright Subway Blue eyes
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

      const shine = new THREE.Mesh(shineGeom, eyeShineMat);
      shine.position.set(eyeX - 0.016, 0.06, -0.425);
      headMesh.add(shine);
    });

    // Expressive Skater Eyebrows
    [-0.14, 0.14].forEach((bx, idx) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.032, 0.05), hairMat);
      brow.position.set(bx, 0.15, -0.36);
      brow.rotation.z = idx === 0 ? 0.14 : -0.14;
      headMesh.add(brow);
    });

    // 3D Nose Tip
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
    nose.position.set(0, -0.04, -0.39);
    headMesh.add(nose);

    // Cheerful Runner Smirk / Smile
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 12, Math.PI * 0.75), hairMat);
    smile.rotation.x = Math.PI * 0.45;
    smile.position.set(0.02, -0.15, -0.36);
    headMesh.add(smile);

    // Skater Blonde/Caramel Hair Tufts
    // Front bangs
    const bang1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.10), hairMat);
    bang1.position.set(-0.09, 0.20, -0.32);
    bang1.rotation.set(-0.2, 0.15, -0.1);
    headMesh.add(bang1);

    const bang2 = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.11, 0.10), hairMat);
    bang2.position.set(0.11, 0.19, -0.32);
    bang2.rotation.set(-0.15, -0.1, 0.1);
    headMesh.add(bang2);

    // Sideburns
    [-0.35, 0.35].forEach((sx) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.20, 0.14), hairMat);
      lock.position.set(sx, -0.02, -0.10);
      headMesh.add(lock);
    });

    // Backwards Baseball Cap (Visor points towards player camera +Z, crown smoothly covers head)
    capGroup = new THREE.Group();
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 18, 0, Math.PI * 2, 0, Math.PI * 0.68),
      capMat
    );
    capDome.position.y = 0.06;
    capDome.castShadow = true;
    capGroup.add(capDome);

    // Center Top Button
    const capButton = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 10), capWhiteMat);
    capButton.position.set(0, 0.48, 0);
    capGroup.add(capButton);

    // Signature Backwards Visor Brim (facing camera +Z with stylish upward skate tilt)
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.045, 0.38), capMat);
    capBrim.position.set(0, 0.02, 0.42);
    capBrim.rotation.x = 0.12; // Upward tilt
    capBrim.castShadow = true;
    capGroup.add(capBrim);

    // White sandwich trim on backwards visor edge (Iconic Subway Surfers skater cap style)
    const brimTrim = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.02, 0.06), capWhiteMat);
    brimTrim.position.set(0, 0.04, 0.60);
    brimTrim.rotation.x = 0.12;
    capGroup.add(brimTrim);

    // Snapback Strap Opening at Back
    const strapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.03), strapMat);
    strapMesh.position.set(0, -0.04, 0.38);
    capGroup.add(strapMesh);

    // Soft hair tufts peeking out naturally above neck
    [-0.14, 0.14].forEach((hx) => {
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.08), hairMat);
      lock.position.set(hx, -0.16, 0.28);
      headMesh.add(lock);
    });

    headMesh.add(capGroup);
    kaiModel.add(headMesh);

    // 4. JETPACK POWERUP THRUSTERS (Mounted onto back during Jetpack powerup)
    jetpackMesh = new THREE.Group();
    const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.72, 12), chromeMat);
    thrusterL.position.set(-0.42, 1.62, 0.40);
    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.42;
    jetpackMesh.add(thrusterL);
    jetpackMesh.add(thrusterR);

    // Dual Rocket Thruster Flame Cones
    const flameGeom = new THREE.ConeGeometry(0.14, 0.85, 10);
    flameGeom.rotateX(Math.PI);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    flameMeshL = new THREE.Mesh(flameGeom, flameMat);
    flameMeshL.position.set(-0.42, 1.05, 0.40);
    flameMeshR = new THREE.Mesh(flameGeom, flameMat);
    flameMeshR.position.set(0.42, 1.05, 0.40);
    jetpackMesh.add(flameMeshL);
    jetpackMesh.add(flameMeshR);

    jetpackMesh.visible = false;
    kaiModel.add(jetpackMesh);

    // 5. ARTICULATED ARMS (Shoulder -> Upper Arm -> Forearm -> Hand)
    // Left Arm
    leftArm = new THREE.Group();
    leftArm.position.set(-0.52, 2.02, 0);

    const vestSleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.16, 10), denimMat);
    vestSleeveL.position.y = -0.05;
    leftArm.add(vestSleeveL);

    const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.36, 10), hoodieMat);
    upperArmL.position.y = -0.26;
    upperArmL.castShadow = true;
    leftArm.add(upperArmL);

    // Forearm Group (Joint at elbow y = -0.44)
    leftForearm = new THREE.Group();
    leftForearm.position.set(0, -0.44, 0);

    const forearmMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.38, 10), skinMat);
    forearmMeshL.position.y = -0.17;
    forearmMeshL.castShadow = true;
    leftForearm.add(forearmMeshL);

    // Skater Red Wristband
    const wristbandL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), wristbandMat);
    wristbandL.position.y = -0.32;
    leftForearm.add(wristbandL);

    // Natural Sculpted Runner Hand
    const handGroupL = new THREE.Group();
    handGroupL.position.set(0, -0.42, 0);
    const palmL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.09), skinMat);
    const thumbL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), skinMat);
    thumbL.position.set(0.05, 0.02, -0.035);
    handGroupL.add(palmL);
    handGroupL.add(thumbL);
    leftForearm.add(handGroupL);

    leftForearm.rotation.x = 0.85;
    leftArm.add(leftForearm);
    kaiModel.add(leftArm);

    // Right Arm
    rightArm = new THREE.Group();
    rightArm.position.set(0.52, 2.02, 0);

    const vestSleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.16, 10), denimMat);
    vestSleeveR.position.y = -0.05;
    rightArm.add(vestSleeveR);

    const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.10, 0.36, 10), hoodieMat);
    upperArmR.position.y = -0.26;
    upperArmR.castShadow = true;
    rightArm.add(upperArmR);

    rightForearm = new THREE.Group();
    rightForearm.position.set(0, -0.44, 0);

    const forearmMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.38, 10), skinMat);
    forearmMeshR.position.y = -0.17;
    forearmMeshR.castShadow = true;
    rightForearm.add(forearmMeshR);

    const handGroupR = new THREE.Group();
    handGroupR.position.set(0, -0.42, 0);
    const palmR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.09), skinMat);
    const thumbR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), skinMat);
    thumbR.position.set(-0.05, 0.02, -0.035);
    handGroupR.add(palmR);
    handGroupR.add(thumbR);
    rightForearm.add(handGroupR);

    rightForearm.rotation.x = 0.85;
    rightArm.add(rightForearm);
    kaiModel.add(rightArm);

    // 6. ARTICULATED LEGS & SUBWAY RETRO RUNNER SNEAKERS
    function buildSubwaySneaker() {
      const sneakerGroup = new THREE.Group();

      // Black Traction Sole Bottom
      const soleBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.68), sneakerTreadMat);
      soleBase.position.set(0, -0.08, -0.06);
      sneakerGroup.add(soleBase);

      // Sculpted Thick White Rubber Midsole
      const soleWhite = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.70), sneakerSoleMat);
      soleWhite.position.set(0, 0, -0.06);
      soleWhite.castShadow = true;
      sneakerGroup.add(soleWhite);

      // Signature White Rubber Skater Toe Cap Bumper
      const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.20), sneakerSoleMat);
      toeCap.position.set(0, 0.05, -0.28);
      sneakerGroup.add(toeCap);

      // White Heel Counter & Pull Tab (Visible to player camera from behind!)
      const heelTab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.20, 0.06), sneakerWhiteTrim);
      heelTab.position.set(0, 0.14, 0.27);
      sneakerGroup.add(heelTab);

      // Vibrant Red Skater Canvas Upper
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.22, 0.48), sneakerRedMat);
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

    // Thigh (Baggy Blue Denim Jeans)
    const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.46, 0.32), denimMat);
    thighL.position.y = -0.23;
    thighL.castShadow = true;
    leftLeg.add(thighL);

    // Knee Joint & Lower Leg Group
    leftLowerLeg = new THREE.Group();
    leftLowerLeg.position.set(0, -0.46, 0);

    // Calf / Shin
    const calfL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.29), denimMat);
    calfL.position.y = -0.21;
    calfL.castShadow = true;
    leftLowerLeg.add(calfL);

    // Rolled Denim Cuff / Hem at bottom of jeans
    const cuffL = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.09, 0.31), denimStitchMat);
    cuffL.position.y = -0.41;
    leftLowerLeg.add(cuffL);

    // White Sport Ankle Sock
    const sockL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.09, 0.26), sneakerSoleMat);
    sockL.position.y = -0.48;
    leftLowerLeg.add(sockL);

    // Left Sneaker
    const leftSneaker = buildSubwaySneaker();
    leftSneaker.position.set(0, -0.50, 0);
    leftLowerLeg.add(leftSneaker);

    leftLeg.add(leftLowerLeg);
    kaiModel.add(leftLeg);

    // Right Leg Group (Hip pivot at y = 1.05)
    rightLeg = new THREE.Group();
    rightLeg.position.set(0.24, 1.05, 0);

    const thighR = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.46, 0.32), denimMat);
    thighR.position.y = -0.23;
    thighR.castShadow = true;
    rightLeg.add(thighR);

    rightLowerLeg = new THREE.Group();
    rightLowerLeg.position.set(0, -0.46, 0);

    const calfR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.29), denimMat);
    calfR.position.y = -0.21;
    calfR.castShadow = true;
    rightLowerLeg.add(calfR);

    const cuffR = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.09, 0.31), denimStitchMat);
    cuffR.position.y = -0.41;
    rightLowerLeg.add(cuffR);

    const sockR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.09, 0.26), sneakerSoleMat);
    sockR.position.y = -0.48;
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

    // Normal Character Scale (Exact same comfortable size as before!)
    kaiModel.scale.set(1.0, 1.0, 1.0);
    kaiModel.rotation.y = 0; // Faces forward down tracks (-Z)
    playerGroup.add(kaiModel);
    scene.add(playerGroup);
  }

  // --- BUILD METRO ENVIRONMENT & MAGNETIC RAILS ---
  function buildMetroEnvironment() {
    tracksGroup = new THREE.Group();

    // 1. High-Tech Ground Bed
    const groundGeom = new THREE.PlaneGeometry(36, 600);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -150);
    ground.receiveShadow = true;
    tracksGroup.add(ground);

    // 2. Neon-edged Concrete Side Retaining Walls with City Murals
    const wallGeom = new THREE.BoxGeometry(1.6, 6, 600);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    const leftWall = new THREE.Mesh(wallGeom, wallMat);
    leftWall.position.set(-8.2, 3, -150);
    tracksGroup.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeom, wallMat);
    rightWall.position.set(8.2, 3, -150);
    tracksGroup.add(rightWall);

    // Luminous cyan edge rails along the walls
    const trimGeom = new THREE.BoxGeometry(0.12, 0.2, 600);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const trimL = new THREE.Mesh(trimGeom, trimMat);
    trimL.position.set(-7.3, 5.8, -150);
    tracksGroup.add(trimL);
    const trimR = new THREE.Mesh(trimGeom, trimMat);
    trimR.position.set(7.3, 5.8, -150);
    tracksGroup.add(trimR);

    // 3. Track Dividers (Safety Curbs between lanes)
    const dividerGeom = new THREE.BoxGeometry(0.3, 0.25, 600);
    const dividerMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    [-TRACK_SPACING / 2, TRACK_SPACING / 2].forEach((dx) => {
      const divider = new THREE.Mesh(dividerGeom, dividerMat);
      divider.position.set(dx, 0.12, -150);
      tracksGroup.add(divider);
    });

    // 4. Magnetic Rail Tracks for the 3 Lanes
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2
    });
    const tieMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    LANES.forEach((laneX) => {
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railL.position.set(laneX - 0.85, 0.1, -150);
      tracksGroup.add(railL);

      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railR.position.set(laneX + 0.85, 0.1, -150);
      tracksGroup.add(railR);
    });

    // Sleepers along the tracks
    const tieGeom = new THREE.BoxGeometry(2.1, 0.15, 0.45);
    for (let z = 20; z > -320; z -= 2.4) {
      LANES.forEach((laneX) => {
        const tie = new THREE.Mesh(tieGeom, tieMat);
        tie.position.set(laneX, 0.02, z);
        tie.receiveShadow = true;
        tracksGroup.add(tie);
      });
    }

    // Overhead High-Voltage Arch Gantries
    const archMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
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
    }

    scene.add(tracksGroup);
  }

  // --- 3D CITY BUILDINGS SKYLINE (SUBWAY SURFERS CITY PERSPECTIVE) ---
  function buildCityBuildings() {
    if (cityBuildingsGroup) scene.remove(cityBuildingsGroup);
    cityBuildingsGroup = new THREE.Group();

    const buildingColorsDark = [0x0f172a, 0x1e1b4b, 0x1e293b, 0x090e17, 0x172554];
    const buildingColorsBright = [0xf8fafc, 0xe2e8f0, 0xbae6fd, 0xfef08a, 0xfde047, 0xfbcfe8];
    const windowColorsDark = [0x38bdf8, 0x00f5d4, 0xf59e0b, 0xec4899];
    const windowColorsBright = [0x0284c7, 0x0369a1, 0x0f172a, 0x2563eb];

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
    magnetGroup.position.set(LANES[laneIndex], 1.3, zPos);

    // Red Horseshoe Arc
    const arcMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.12, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    arcMesh.rotation.z = Math.PI;
    magnetGroup.add(arcMesh);

    // Silver Poles
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.8 });
    const poleL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), poleMat);
    poleL.position.set(-0.38, -0.15, 0);
    const poleR = poleL.clone();
    poleR.position.x = 0.38;
    magnetGroup.add(poleL);
    magnetGroup.add(poleR);

    magnetGroup.userData = { type: 'magnet', lane: laneIndex, collected: false };
    scene.add(magnetGroup);
    powerups.push(magnetGroup);
  }

  function createJetpackPowerup(laneIndex, zPos) {
    const jetpackGroup = new THREE.Group();
    jetpackGroup.position.set(LANES[laneIndex], 1.3, zPos);

    // Dual Rocket Turbines with Glowing Thruster
    const cylMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.5 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    const cL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 12), cylMat);
    cL.position.set(-0.25, 0, 0);
    const fL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8), flameMat);
    fL.rotation.x = Math.PI;
    fL.position.set(-0.25, -0.45, 0);

    const cR = cL.clone();
    cR.position.x = 0.25;
    const fR = fL.clone();
    fR.position.x = 0.25;

    jetpackGroup.add(cL);
    jetpackGroup.add(fL);
    jetpackGroup.add(cR);
    jetpackGroup.add(fR);

    jetpackGroup.userData = { type: 'jetpack', lane: laneIndex, collected: false };
    scene.add(jetpackGroup);
    powerups.push(jetpackGroup);
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

      // Spawn Power-Ups periodically (18% chance for Chumbak Magnet or Jetpack in open lane!)
      if (Math.random() < 0.20) {
        if (Math.random() < 0.5) {
          createMagnetPowerup(openLane, nextSpawnZ + 8);
        } else {
          createJetpackPowerup(openLane, nextSpawnZ + 8);
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

    // Settings Modal
    bindBtn('btn-open-settings', () => {
      updateCareerStatsUI();
      settingsModal.classList.remove('hidden');
    });

    bindBtn('btn-close-settings', () => {
      settingsModal.classList.add('hidden');
    });

    bindBtn('btn-save-settings', () => {
      settingsModal.classList.add('hidden');
    });

    // Theme Option Toggles
    bindBtn('opt-theme-dark', () => applyTheme('dark'));
    bindBtn('opt-theme-bright', () => applyTheme('bright'));

    // Control Option Toggles
    bindBtn('opt-ctrl-swipe', () => applyControlMode('swipe'));
    bindBtn('opt-ctrl-buttons', () => applyControlMode('buttons'));

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
    if (!state.isJumping && state.jetpackTimer <= 0) {
      state.isJumping = true;
      state.isSliding = false;
      state.vy = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
      if (window.soundEngine) window.soundEngine.playJumpSFX();
    }
  }

  function doSlide() {
    if (state.jetpackTimer > 0) return;
    state.isSliding = true;
    state.slideTimer = state.slideDuration;
    if (state.isJumping) {
      state.vy = -22;
    }
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
    state.score = 0;
    state.coins = 0;
    state.distance = 0;
    state.speed = 48;
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
    state.magnetTimer = 0;
    state.jetpackTimer = 0;
    state.hasShield = false;
    state.storedMagnets = 0;
    state.storedJetpacks = 0;
    updatePowerupSlotsUI();

    obstacles.forEach((obs) => scene.remove(obs));
    obstacles = [];
    coins.forEach((c) => scene.remove(c));
    coins = [];
    powerups.forEach((p) => scene.remove(p));
    powerups = [];

    nextSpawnZ = -85;
    // Welcoming opening runway of crystals in center lane
    for (let cz = -12; cz >= -68; cz -= 4) {
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
    if (badgeShield) badgeShield.style.display = 'none';

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

  // --- UPDATE LOOP ---
  function update(delta) {
    if (!state.running || state.paused) return;

    // 1. Magnet (Chumbak) Timer & HUD
    if (state.magnetTimer > 0) {
      state.magnetTimer -= delta;
      if (badgeMagnet) badgeMagnet.style.display = 'flex';
      if (timerMagnet) timerMagnet.textContent = Math.ceil(state.magnetTimer) + 's';
      if (state.magnetTimer <= 0) {
        if (badgeMagnet) badgeMagnet.style.display = 'none';
      }
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
    }

    // 3. Boost & Speed
    if (state.isBoosted) {
      state.boostTimer -= delta;
      state.speed = 76;
      if (state.boostTimer <= 0) {
        state.isBoosted = false;
        state.hasShield = false;
        state.speed = 48;
        if (hoverboardMesh) hoverboardMesh.visible = false;
        if (badgeShield) badgeShield.style.display = 'none';
      }
    } else {
      state.speed = Math.min(state.maxSpeed, state.speed + delta * 0.35);
    }

    const distDelta = state.speed * delta;
    state.distance += distDelta;
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
      camera.position.y += ((JETPACK_FLIGHT_Y + 3.2) - camera.position.y) * 8 * delta;
      camera.position.z += (8.4 - camera.position.z) * 8 * delta;
      camera.lookAt(state.playerX * 0.5, JETPACK_FLIGHT_Y - 0.5, -20);
    } else {
      // Classic Ground Track 3rd-Person Framing (Exact same size as before)
      const targetCamY = state.isSliding ? 3.8 : 4.6;
      camera.position.y += (targetCamY - camera.position.y) * 14 * delta;
      camera.position.z += (8.2 - camera.position.z) * 14 * delta;
      camera.lookAt(state.playerX * 0.4, 1.7, -18);
    }

    // Scroll & Drift 3D Sky Clouds
    skyClouds.forEach((c) => {
      c.position.z += distDelta * 0.45;
      if (c.position.z > 25) {
        c.position.z = -300 - Math.random() * 40;
        c.position.x = (Math.random() - 0.5) * 85;
      }
    });

    // --- ATHLETIC RUNNER BOY ANIMATION SYSTEM ---
    runAnimTime += delta * (state.speed * 0.38);

    if (state.jetpackTimer > 0) {
      // 🚀 REAL SUPERHERO FLIGHT POSTURE (Missile / Rocket Flight through the sky!)
      kaiModel.scale.set(1, 1, 1);
      kaiModel.rotation.x = -Math.PI / 2.7; // ~ -66 degrees forward pitch!
      kaiModel.rotation.y = 0;
      kaiModel.position.y = Math.sin(runAnimTime * 3) * 0.08;
      kaiModel.rotation.z = (state.targetX - state.playerX) * -0.32; // Aerodynamic banking into lane turns!

      leftLeg.rotation.x = -0.15;
      rightLeg.rotation.x = -0.15;
      if (leftLowerLeg) leftLowerLeg.rotation.x = 0.25;
      if (rightLowerLeg) rightLowerLeg.rotation.x = 0.25;

      leftArm.rotation.x = -1.35;
      rightArm.rotation.x = -1.35;
      leftArm.rotation.z = -0.28;
      rightArm.rotation.z = 0.28;

      // Flickering Rocket Thruster Flame Cones
      if (flameMeshL && flameMeshR) {
        const fScale = 1.0 + Math.sin(runAnimTime * 32) * 0.35 + (Math.random() * 0.25);
        flameMeshL.scale.set(1.0 + Math.random() * 0.2, fScale, 1.0 + Math.random() * 0.2);
        flameMeshR.scale.copy(flameMeshL.scale);
      }
    } else if (state.isSliding) {
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

    // Move obstacles towards player (+Z)
    const moveZ = distDelta;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.position.z += moveZ;

      if (Math.abs(obs.position.z) < 18) {
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

    // Move & collect powerups (Magnet & Jetpack)
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.position.z += moveZ;
      p.rotation.y += delta * 3.0;

      const dist = p.position.distanceTo(playerGroup.position);
      if (dist < 1.8 && !p.userData.collected) {
        p.userData.collected = true;
        if (p.userData.type === 'magnet') {
          state.storedMagnets++;
          careerStats.totalMagnets = (careerStats.totalMagnets || 0) + 1;
          saveCareerStats();
          updateCareerStatsUI();
          updatePowerupSlotsUI();
          showToast('+1 🧲 CHUMBAK STORED! TAP HUD TO USE');
        } else if (p.userData.type === 'jetpack') {
          state.storedJetpacks++;
          careerStats.totalJetpacks = (careerStats.totalJetpacks || 0) + 1;
          saveCareerStats();
          updateCareerStatsUI();
          updatePowerupSlotsUI();
          showToast('+1 🚀 JETPACK STORED! TAP HUD TO FLY');
        }
        if (window.soundEngine) window.soundEngine.playCoinSFX();
        scene.remove(p);
        powerups.splice(i, 1);
        continue;
      }

      if (p.position.z > 20) {
        scene.remove(p);
        powerups.splice(i, 1);
      }
    }

    // Move & collect crystals (Supports Chumbak / Magnet pull!)
    for (let i = coins.length - 1; i >= 0; i--) {
      const crystal = coins[i];
      crystal.position.z += moveZ;
      crystal.rotation.y += delta * 4.5;
      crystal.rotation.x += delta * 2.0;

      const dist = crystal.position.distanceTo(playerGroup.position);

      // 🧲 MAGNET (CHUMBAK) & JETPACK 3D VACUUM PULL: Pulls crystals across all lanes!
      const isMagnet = state.magnetTimer > 0;
      const isFlying = state.jetpackTimer > 0;

      if ((isMagnet || isFlying) && dist < 42) {
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
        state.coins++;
        careerStats.totalCoins = (careerStats.totalCoins || 0) + 1;
        saveCareerStats();
        updateCareerStatsUI();
        state.score += 80;
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
    // If flying in Jetpack: 100% immune from all obstacles!
    if (state.jetpackTimer > 0) return false;

    const laneX = LANES[obs.userData.lane];
    // Check if player is horizontally in the obstacle's lane
    if (Math.abs(state.playerX - laneX) > 1.05) return false;

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
      // Low plasma barrier: player must jump over!
      if (Math.abs(zPos) < 0.85) {
        if (state.isJumping && state.playerY >= 0.75) {
          return false; // Cleared hurdle!
        }
        return true; // CRASH! Hit hurdle barrier!
      }
    } else if (obs.userData.type === 'overhead') {
      // Overhead beam: player MUST slide/duck ("jhukna padhta hai")!
      if (Math.abs(zPos) < 0.85) {
        if (state.isSliding && state.playerY < 0.35) {
          return false; // Ducked safely under beam!
        }
        return true; // CRASH! Did not slide/duck, hit head on overhead beam!
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
  window.applyTheme = applyTheme;
  window.useStoredJetpack = useStoredJetpack;
  window.useStoredMagnet = useStoredMagnet;
})();
