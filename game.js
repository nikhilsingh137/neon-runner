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
  let playerGroup, kaiModel, hoverboardMesh, jetpackMesh;
  let leftLeg, rightLeg, leftArm, rightArm, headMesh, capGroup;
  let tracksGroup, obstacles = [], coins = [], powerups = [];
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
    state.magnetTimer = 12.0;
    updatePowerupSlotsUI();
    showToast('🧲 CHUMBAK MAGNET ACTIVATED!');
    if (window.soundEngine) window.soundEngine.playPowerupSFX();
  }

  function useStoredJetpack() {
    if (!state.running || state.paused || state.storedJetpacks <= 0) return;
    state.storedJetpacks--;
    state.jetpackTimer = 10.0;
    updatePowerupSlotsUI();
    showToast('🚀 JETPACK BLAST OFF!');
    if (window.soundEngine) window.soundEngine.playPowerupSFX();
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
        hemiLight.color.setHex(0x38bdf8);
        hemiLight.groundColor.setHex(0x0284c7);
      }
      if (sunLight) {
        sunLight.color.setHex(0x00f5d4);
        sunLight.intensity = 1.1;
      }
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

  // Apply Control Mode UI
  function applyControlMode(mode) {
    state.controlMode = mode;
    localStorage.setItem('urban_dash_control_mode', mode);

    const optSwipe = document.getElementById('opt-ctrl-swipe');
    const optButtons = document.getElementById('opt-ctrl-buttons');

    if (mode === 'buttons') {
      if (virtualButtons) virtualButtons.classList.remove('hidden');
      if (optButtons) optButtons.classList.add('active');
      if (optSwipe) optSwipe.classList.remove('active');
    } else {
      // Clean swipe mode
      if (virtualButtons) virtualButtons.classList.add('hidden');
      if (optSwipe) optSwipe.classList.add('active');
      if (optButtons) optButtons.classList.remove('active');
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

    // Dynamic Camera Framing for mobile devices
    const fov = aspect < 0.65 ? 68 : 58;
    const camZ = aspect < 0.65 ? 9.2 : 8.2;
    const camY = aspect < 0.65 ? 5.2 : 4.6;

    camera = new THREE.PerspectiveCamera(fov, aspect, 0.5, 320);
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, 1.8, -18);

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

    sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
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

    // Build World & Hero
    buildMetroEnvironment();
    buildHeroKai();
    setupControls();
    applyControlMode(state.controlMode);

    window.addEventListener('resize', onWindowResize);
  }

  // --- BUILD HERO RUNNER (KAI) ---
  function buildHeroKai() {
    playerGroup = new THREE.Group();

    // Stylized PBR Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd8b8, roughness: 0.55, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2110, roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.1 });
    const capWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.15 });
    const jacketTrimMat = new THREE.MeshStandardMaterial({ color: 0x00f5d4, roughness: 0.3, emissive: 0x00f5d4, emissiveIntensity: 0.25 });
    const headphonesMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.4 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const sneakerSoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const sneakerGripMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const sneakerUpperMat = new THREE.MeshStandardMaterial({ color: 0x00f5d4, roughness: 0.35 });
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.85 });

    kaiModel = new THREE.Group();

    // 1. TORSO (Streetwear windbreaker jacket with cyan neon conduits)
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.25, 0.65), jacketMat);
    torsoMesh.position.y = 1.6;
    torsoMesh.castShadow = true;
    kaiModel.add(torsoMesh);

    // Neon speed conduit stripe across chest
    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.68), jacketTrimMat);
    chestStripe.position.set(-0.2, 1.6, 0);
    kaiModel.add(chestStripe);

    // DJ Headphones resting around neck
    const phonesMesh = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 8, 16), headphonesMat);
    phonesMesh.rotation.x = Math.PI / 2;
    phonesMesh.position.set(0, 2.22, 0.05);
    kaiModel.add(phonesMesh);

    // 2. HEAD & FACE (Faces -Z, Back of head faces +Z toward camera)
    headMesh = new THREE.Group();
    headMesh.position.set(0, 2.6, 0.05);

    const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 16), skinMat);
    headBase.castShadow = true;
    headMesh.add(headBase);

    // 3D Cartoon Ears
    [-0.43, 0.43].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), skinMat);
      ear.scale.set(0.6, 1.1, 0.9);
      ear.position.set(ex, 0, 0.02);
      headMesh.add(ear);
    });

    // Expressive Cartoon Eyes
    const eyeGeom = new THREE.SphereGeometry(0.09, 12, 12);
    const irisGeom = new THREE.SphereGeometry(0.055, 10, 10);
    const pupilGeom = new THREE.SphereGeometry(0.032, 10, 10);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4 });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x090e17 });

    [-0.16, 0.16].forEach((eyeX) => {
      const eyeW = new THREE.Mesh(eyeGeom, eyeWhiteMat);
      eyeW.position.set(eyeX, 0.04, -0.4);
      headMesh.add(eyeW);

      const iris = new THREE.Mesh(irisGeom, eyeIrisMat);
      iris.position.set(eyeX, 0.04, -0.46);
      headMesh.add(iris);

      const pupil = new THREE.Mesh(pupilGeom, eyePupilMat);
      pupil.position.set(eyeX, 0.04, -0.48);
      headMesh.add(pupil);
    });

    // Skater hair tufts
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.5), hairMat);
    hair.position.set(0, 0.2, -0.1);
    headMesh.add(hair);

    // 3. BACKWARDS PARKOUR CAP (Visor faces +Z toward camera)
    capGroup = new THREE.Group();
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      capMat
    );
    capDome.position.y = 0.08;
    capDome.castShadow = true;
    capGroup.add(capDome);

    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.42), capWhiteMat);
    capBrim.position.set(0, 0.06, 0.48);
    capBrim.rotation.x = 0.12;
    capGroup.add(capBrim);

    headMesh.add(capGroup);
    kaiModel.add(headMesh);

    // 4. POWER PACK (On back facing camera +Z)
    const packMesh = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.92, 0.38), backpackMat);
    packMesh.position.set(0, 1.65, 0.48);
    packMesh.castShadow = true;
    kaiModel.add(packMesh);

    // Dual Energy Cells in pack
    const cellGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.45, 10);
    const cellL = new THREE.Mesh(cellGeom, jacketTrimMat);
    cellL.position.set(-0.25, 1.95, 0.48);
    kaiModel.add(cellL);

    const cellR = new THREE.Mesh(cellGeom, jacketTrimMat);
    cellR.position.set(0.25, 1.95, 0.48);
    kaiModel.add(cellR);

    // Jetpack Thruster Model (Active when Jetpack powerup picked up)
    jetpackMesh = new THREE.Group();
    const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.8, 12), chromeMat);
    thrusterL.position.set(-0.48, 1.65, 0.52);
    const thrusterR = thrusterL.clone();
    thrusterR.position.x = 0.48;
    jetpackMesh.add(thrusterL);
    jetpackMesh.add(thrusterR);
    jetpackMesh.visible = false;
    kaiModel.add(jetpackMesh);

    // 5. ARMS & HANDS
    const sleeveGeom = new THREE.CylinderGeometry(0.15, 0.13, 0.35, 10);
    const armGeom = new THREE.CylinderGeometry(0.12, 0.1, 0.65, 10);
    const handGeom = new THREE.SphereGeometry(0.13, 10, 10);

    // Left Arm
    leftArm = new THREE.Group();
    leftArm.position.set(-0.64, 2.05, 0);
    const leftSleeve = new THREE.Mesh(sleeveGeom, jacketMat);
    leftSleeve.position.y = -0.15;
    const leftArmMesh = new THREE.Mesh(armGeom, skinMat);
    leftArmMesh.position.y = -0.55;
    leftArmMesh.castShadow = true;
    const leftHand = new THREE.Mesh(handGeom, skinMat);
    leftHand.position.y = -0.92;
    leftArm.add(leftSleeve);
    leftArm.add(leftArmMesh);
    leftArm.add(leftHand);
    kaiModel.add(leftArm);

    // Right Arm
    rightArm = new THREE.Group();
    rightArm.position.set(0.64, 2.05, 0);
    const rightSleeve = new THREE.Mesh(sleeveGeom, jacketMat);
    rightSleeve.position.y = -0.15;
    const rightArmMesh = new THREE.Mesh(armGeom, skinMat);
    rightArmMesh.position.y = -0.55;
    rightArmMesh.castShadow = true;
    const rightHand = new THREE.Mesh(handGeom, skinMat);
    rightHand.position.y = -0.92;
    rightArm.add(rightSleeve);
    rightArm.add(rightArmMesh);
    rightArm.add(rightHand);
    kaiModel.add(rightArm);

    // 6. LEGS & ENERGY KICKS SNEAKERS
    const legGeom = new THREE.BoxGeometry(0.36, 0.88, 0.38);
    const soleGeom = new THREE.BoxGeometry(0.42, 0.16, 0.76);
    const upperShoeGeom = new THREE.BoxGeometry(0.38, 0.3, 0.68);

    // Left Leg
    leftLeg = new THREE.Group();
    leftLeg.position.set(-0.28, 1.05, 0);
    const leftLegMesh = new THREE.Mesh(legGeom, jeansMat);
    leftLegMesh.position.y = -0.42;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);

    const leftSole = new THREE.Mesh(soleGeom, sneakerSoleMat);
    leftSole.position.set(0, -0.92, -0.1);
    leftSole.castShadow = true;
    const leftUpper = new THREE.Mesh(upperShoeGeom, sneakerUpperMat);
    leftUpper.position.set(0, -0.72, -0.08);
    leftLeg.add(leftSole);
    leftLeg.add(leftUpper);
    kaiModel.add(leftLeg);

    // Right Leg
    rightLeg = new THREE.Group();
    rightLeg.position.set(0.28, 1.05, 0);
    const rightLegMesh = new THREE.Mesh(legGeom, jeansMat);
    rightLegMesh.position.y = -0.42;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);

    const rightSole = new THREE.Mesh(soleGeom, sneakerSoleMat);
    rightSole.position.set(0, -0.92, -0.1);
    rightSole.castShadow = true;
    const rightUpper = new THREE.Mesh(upperShoeGeom, sneakerUpperMat);
    rightUpper.position.set(0, -0.72, -0.08);
    rightLeg.add(rightSole);
    rightLeg.add(rightUpper);
    kaiModel.add(rightLeg);

    // 7. HOVERBOARD (Visible during Boost / Shield)
    const boardGeom = new THREE.BoxGeometry(1.4, 0.12, 3.2);
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

    // Mobile Swipe Gesture (1 Gesture = Exactly 1 Lane Switch)
    const overlay = document.getElementById('touch-overlay');
    let touchStartX = 0;
    let touchStartY = 0;
    let hasSwipedInCurrentTouch = false;

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        hasSwipedInCurrentTouch = false;
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
      if (hasSwipedInCurrentTouch || !state.running || state.paused) return;
      if (e.touches.length > 0) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX > 22 || absY > 22) {
          hasSwipedInCurrentTouch = true;
          if (absX > absY) {
            if (dx > 0) moveLane(1);
            else moveLane(-1);
          } else {
            if (dy < 0) doJump();
            else doSlide();
          }
        }
      }
    }, { passive: true });

    overlay.addEventListener('touchend', () => {
      hasSwipedInCurrentTouch = false;
    }, { passive: true });

    // Virtual Buttons
    const bindBtn = (id, action) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          action();
        });
        btn.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          action();
        }, { passive: true });
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
        if (a1) a1.textContent = muted ? '🔇 AUDIO: OFF' : '🔊 AUDIO: ON';
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

    nextSpawnZ = -45;
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

    const laneDelta = state.targetX - state.playerX;
    kaiModel.rotation.z = -laneDelta * 0.12;
    kaiModel.rotation.y = laneDelta * 0.15;

    // Camera follow (always centered, wide FOV prevents edge clipping)
    const targetCamX = state.playerX * 0.72;
    camera.position.x += (targetCamX - camera.position.x) * 16 * delta;
    camera.position.y = (state.jetpackTimer > 0) ? (JETPACK_FLIGHT_Y + 3.2) : (state.isSliding ? 3.8 : 5.0);

    // Limb Animations
    runAnimTime += delta * (state.speed * 0.35);

    if (state.jetpackTimer > 0) {
      // Flying posture
      kaiModel.scale.set(1, 1, 1);
      kaiModel.position.y = 0;
      leftLeg.rotation.x = 0.3;
      rightLeg.rotation.x = 0.3;
      leftArm.rotation.x = 0.2;
      rightArm.rotation.x = 0.2;
    } else if (state.isSliding) {
      kaiModel.scale.set(1.15, 0.45, 1.25);
      kaiModel.position.y = -0.3;
      leftLeg.rotation.x = -1.2;
      rightLeg.rotation.x = -1.2;
      leftArm.rotation.x = 0.8;
      rightArm.rotation.x = 0.8;
    } else if (state.isJumping) {
      kaiModel.scale.set(1, 1, 1);
      kaiModel.position.y = 0;
      leftLeg.rotation.x = -0.7;
      rightLeg.rotation.x = 0.5;
      leftArm.rotation.x = 2.4;
      rightArm.rotation.x = 2.4;
    } else {
      kaiModel.scale.set(1, 1, 1);
      kaiModel.position.y = Math.sin(runAnimTime * 2) * 0.08;
      const legAngle = Math.sin(runAnimTime) * 0.75;
      leftLeg.rotation.x = legAngle;
      rightLeg.rotation.x = -legAngle;
      leftArm.rotation.x = -legAngle * 1.1;
      rightArm.rotation.x = legAngle * 1.1;
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

      // 🧲 MAGNET (CHUMBAK) PULL: Pulls all crystals across all 3 tracks!
      if (state.magnetTimer > 0 && dist < 32) {
        crystal.position.x += (state.playerX - crystal.position.x) * 14 * delta;
        crystal.position.y += (state.playerY + 1.2 - crystal.position.y) * 14 * delta;
      } else if (state.isBoosted && dist < 14) {
        crystal.position.x += (state.playerX - crystal.position.x) * 12 * delta;
        crystal.position.y += (state.playerY + 1.2 - crystal.position.y) * 12 * delta;
      }

      if (dist < 1.7 && !crystal.userData.collected) {
        crystal.userData.collected = true;
        state.coins++;
        state.score += 60;
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
})();
