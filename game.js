/**
 * Subway Runner 3D - Jake Skater Boy Edition
 * Full WebGL 3D Engine powered by Three.js
 */

(function () {
  'use strict';

  // --- GAME CONFIGURATION ---
  const TRACK_SPACING = 2.8; // Tuned for perfect mobile aspect ratio so Jake is NEVER cut off on Left or Right
  const LANES = [-TRACK_SPACING, 0, TRACK_SPACING]; // -1: Left, 0: Center, 1: Right
  const VISIBLE_DISTANCE = 260;
  const JUMP_HEIGHT = 4.6;
  const GRAVITY = 32.0;
  const TRAIN_HEIGHT = 3.5;

  // --- GAME STATE ---
  const state = {
    running: false,
    paused: false,
    score: 0,
    coins: 0,
    distance: 0,
    speed: 48,
    maxSpeed: 82,
    currentLane: 0, // -1, 0, 1
    playerX: 0,
    targetX: 0,
    playerY: 0,
    groundY: 0, // 0 for ground, TRAIN_HEIGHT for train roof!
    vy: 0,
    isJumping: false,
    isSliding: false,
    slideTimer: 0,
    slideDuration: 0.65,
    isBoosted: false,
    boostTimer: 0,
    overdriveCharge: 0,
    multiplier: 1
  };

  // High score storage
  let savedData = {
    highScore: 0,
    totalCoins: 0
  };

  try {
    const raw = localStorage.getItem('subway_runner_data');
    if (raw) savedData = Object.assign(savedData, JSON.parse(raw));
  } catch (e) {}

  function saveData() {
    try {
      localStorage.setItem('subway_runner_data', JSON.stringify(savedData));
    } catch (e) {}
  }

  // --- THREE.JS GLOBALS ---
  let scene, camera, renderer;
  let playerGroup, jakeModel, hoverboardMesh;
  let leftLeg, rightLeg, leftArm, rightArm, headMesh, capGroup;
  let tracksGroup, obstacles = [], coins = [], particles = [];
  let clock = new THREE.Clock();
  let runAnimTime = 0;

  // DOM Elements
  const container = document.getElementById('game-container');
  const canvas = document.getElementById('gameCanvas');
  const hud = document.getElementById('hud');
  const hudScore = document.getElementById('hud-score');
  const hudCoins = document.getElementById('hud-credits');
  const hudSpeed = document.getElementById('hud-speed');
  const hudOverdriveFill = document.getElementById('hud-overdrive-fill');
  const startScreen = document.getElementById('start-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScoreEl = document.getElementById('final-score');
  const finalDistanceEl = document.getElementById('final-distance');
  const finalCreditsEl = document.getElementById('final-credits');
  const menuHighScore = document.getElementById('menu-high-score');
  const menuCredits = document.getElementById('menu-credits');
  const newRecordBadge = document.getElementById('new-record-badge');

  if (menuHighScore) menuHighScore.textContent = savedData.highScore;
  if (menuCredits) menuCredits.textContent = savedData.totalCoins;

  // --- INITIALIZE THREE.JS SCENE ---
  function initEngine() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / height;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8); // Sunny vibrant sky
    scene.fog = new THREE.Fog(0x38bdf8, 100, VISIBLE_DISTANCE);

    // Dynamic FOV & Camera Framing for Mobile Phones:
    // Wide FOV (68) and slightly farther back so Jake on Left and Right tracks is 100% in view!
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
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 0.9);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
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

    // Rim Back-Light (Creates authentic Subway Surfers character edge glow)
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
    rimLight.position.set(-15, 25, -35);
    scene.add(rimLight);

    // Build World & Player
    buildRailwayEnvironment();
    buildJakeCharacter();
    setupControls();

    window.addEventListener('resize', onWindowResize);
  }

  // --- BUILD AUTHENTIC HIGH-DETAIL JAKE (SUBWAY SURFERS 3D HERO) ---
  function buildJakeCharacter() {
    playerGroup = new THREE.Group();

    // High-End PBR Stylized Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd8b8, roughness: 0.55, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.7 });
    const capRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.1 });
    const capWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
    const capStrapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const denimVestMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45, metalness: 0.1 });
    const vestPocketMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
    const bronzeButtonMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.8 });
    const whiteHoodieMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.55, metalness: 0.05 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.6 });
    const shoeSoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const shoeTreadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const shoeRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
    const shoeLaceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.85 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeIrisMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    jakeModel = new THREE.Group();

    // 1. TORSO (White Hoodie + Blue Denim Vest with Pockets & Bronze Buttons)
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.25, 0.65), denimVestMat);
    torsoMesh.position.y = 1.6;
    torsoMesh.castShadow = true;
    jakeModel.add(torsoMesh);

    // White shirt chest panel
    const chestShirt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.95, 0.67), whiteHoodieMat);
    chestShirt.position.set(0, 1.55, -0.02);
    jakeModel.add(chestShirt);

    // White hoodie collar folded around neck
    const hoodCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.22, 12), whiteHoodieMat);
    hoodCollar.position.set(0, 2.22, 0.05);
    hoodCollar.castShadow = true;
    jakeModel.add(hoodCollar);

    // Vest chest pockets (front -Z)
    [-0.24, 0.24].forEach((px) => {
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.04), vestPocketMat);
      pocket.position.set(px, 1.75, -0.34);
      jakeModel.add(pocket);

      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), bronzeButtonMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(px, 1.84, -0.36);
      jakeModel.add(btn);
    });

    // Backpack shoulder harness straps
    [-0.32, 0.32].forEach((sx) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.04), strapMat);
      strap.position.set(sx, 1.65, -0.33);
      jakeModel.add(strap);
    });

    // 2. HEAD & DETAILED FACE (Faces -Z forward, Back of head faces +Z toward camera)
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

    // Expressive Cartoon Eyes (Front -Z)
    const eyeGeom = new THREE.SphereGeometry(0.09, 12, 12);
    const irisGeom = new THREE.SphereGeometry(0.055, 10, 10);
    const pupilGeom = new THREE.SphereGeometry(0.032, 10, 10);
    const glintGeom = new THREE.SphereGeometry(0.018, 6, 6);

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

      const glint = new THREE.Mesh(glintGeom, eyeWhiteMat);
      glint.position.set(eyeX + 0.02, 0.06, -0.49);
      headMesh.add(glint);

      // Brown arched skater eyebrows
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.03), hairMat);
      brow.position.set(eyeX, 0.16, -0.41);
      brow.rotation.z = (eyeX < 0 ? -0.1 : 0.1);
      headMesh.add(brow);
    });

    // Cute confident smile mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.02), new THREE.MeshBasicMaterial({ color: 0x881337 }));
    mouth.position.set(0, -0.16, -0.42);
    headMesh.add(mouth);

    // Skater hair tufts (bangs in front and neck tufts in back)
    const hairBangs = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.35), hairMat);
    hairBangs.position.set(0, 0.28, -0.25);
    headMesh.add(hairBangs);

    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.35), hairMat);
    hairBack.position.set(0, -0.12, 0.32);
    headMesh.add(hairBack);

    // 3. BACKWARDS RED BASEBALL CAP (Original Jake Signature)
    capGroup = new THREE.Group();

    // Red cap dome
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      capRedMat
    );
    capDome.position.y = 0.08;
    capDome.castShadow = true;
    capGroup.add(capDome);

    // White visor / brim pointing backward (+Z toward camera)
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.42), capWhiteMat);
    capBrim.position.set(0, 0.06, 0.48);
    capBrim.rotation.x = 0.12;
    capGroup.add(capBrim);

    // Black plastic snapback adjustment strap in back
    const capStrap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.03), capStrapMat);
    capStrap.position.set(0, -0.04, 0.48);
    capGroup.add(capStrap);

    // Cap button
    const capBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 8), capWhiteMat);
    capBtn.position.y = 0.54;
    capGroup.add(capBtn);

    headMesh.add(capGroup);
    jakeModel.add(headMesh);

    // 4. SPRAY-PAINT BACKPACK (On back facing camera +Z)
    const packMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.94, 0.42), backpackMat);
    packMesh.position.set(0, 1.65, 0.48);
    packMesh.castShadow = true;
    jakeModel.add(packMesh);

    // Front pocket of backpack
    const packPocket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.45, 0.12), new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.5 }));
    packPocket.position.set(0, 1.45, 0.72);
    jakeModel.add(packPocket);

    // Twin spray paint cans (Green & Gold) with shiny chrome nozzles!
    const canGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.48, 10);
    const nozzleGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8);

    // Left Spray Can (Green)
    const canL = new THREE.Mesh(canGeom, new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35 }));
    canL.position.set(-0.28, 1.95, 0.48);
    canL.rotation.z = -0.15;
    const nozL = new THREE.Mesh(nozzleGeom, chromeMat);
    nozL.position.y = 0.28;
    canL.add(nozL);
    jakeModel.add(canL);

    // Right Spray Can (Yellow)
    const canR = new THREE.Mesh(canGeom, new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35 }));
    canR.position.set(0.28, 1.95, 0.48);
    canR.rotation.z = 0.15;
    const nozR = new THREE.Mesh(nozzleGeom, chromeMat);
    nozR.position.y = 0.28;
    canR.add(nozR);
    jakeModel.add(canR);

    // 5. ARMS & HANDS (Denim shoulder vest sleeves + skin forearms)
    const sleeveGeom = new THREE.CylinderGeometry(0.15, 0.14, 0.32, 10);
    const armGeom = new THREE.CylinderGeometry(0.12, 0.1, 0.65, 10);
    const handGeom = new THREE.SphereGeometry(0.13, 10, 10);

    // Left Arm
    leftArm = new THREE.Group();
    leftArm.position.set(-0.64, 2.05, 0);
    const leftSleeve = new THREE.Mesh(sleeveGeom, denimVestMat);
    leftSleeve.position.y = -0.15;
    const leftArmMesh = new THREE.Mesh(armGeom, skinMat);
    leftArmMesh.position.y = -0.55;
    leftArmMesh.castShadow = true;
    const leftHand = new THREE.Mesh(handGeom, skinMat);
    leftHand.position.y = -0.92;
    leftArm.add(leftSleeve);
    leftArm.add(leftArmMesh);
    leftArm.add(leftHand);
    jakeModel.add(leftArm);

    // Right Arm
    rightArm = new THREE.Group();
    rightArm.position.set(0.64, 2.05, 0);
    const rightSleeve = new THREE.Mesh(sleeveGeom, denimVestMat);
    rightSleeve.position.y = -0.15;
    const rightArmMesh = new THREE.Mesh(armGeom, skinMat);
    rightArmMesh.position.y = -0.55;
    rightArmMesh.castShadow = true;
    const rightHand = new THREE.Mesh(handGeom, skinMat);
    rightHand.position.y = -0.92;
    rightArm.add(rightSleeve);
    rightArm.add(rightArmMesh);
    rightArm.add(rightHand);
    jakeModel.add(rightArm);

    // 6. LEGS & DETAILED CHUNKY SNEAKERS (Hips with running stride)
    const legGeom = new THREE.BoxGeometry(0.36, 0.88, 0.38);
    const cuffGeom = new THREE.BoxGeometry(0.38, 0.12, 0.4);
    const soleGeom = new THREE.BoxGeometry(0.42, 0.16, 0.76);
    const treadGeom = new THREE.BoxGeometry(0.42, 0.05, 0.76);
    const upperShoeGeom = new THREE.BoxGeometry(0.38, 0.3, 0.68);
    const laceGeom = new THREE.BoxGeometry(0.24, 0.04, 0.32);

    // Left Leg
    leftLeg = new THREE.Group();
    leftLeg.position.set(-0.28, 1.05, 0);
    const leftLegMesh = new THREE.Mesh(legGeom, jeansMat);
    leftLegMesh.position.y = -0.42;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);

    const leftCuff = new THREE.Mesh(cuffGeom, cuffMat);
    leftCuff.position.y = -0.82;
    leftLeg.add(leftCuff);

    // Left Chunky Skate Sneaker
    const leftTread = new THREE.Mesh(treadGeom, shoeTreadMat);
    leftTread.position.set(0, -1.02, -0.1);
    const leftSole = new THREE.Mesh(soleGeom, shoeSoleMat);
    leftSole.position.set(0, -0.92, -0.1);
    leftSole.castShadow = true;
    const leftUpper = new THREE.Mesh(upperShoeGeom, shoeRedMat);
    leftUpper.position.set(0, -0.72, -0.08);
    const leftLaces = new THREE.Mesh(laceGeom, shoeLaceMat);
    leftLaces.position.set(0, -0.58, -0.18);
    leftLeg.add(leftTread);
    leftLeg.add(leftSole);
    leftLeg.add(leftUpper);
    leftLeg.add(leftLaces);
    jakeModel.add(leftLeg);

    // Right Leg
    rightLeg = new THREE.Group();
    rightLeg.position.set(0.28, 1.05, 0);
    const rightLegMesh = new THREE.Mesh(legGeom, jeansMat);
    rightLegMesh.position.y = -0.42;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);

    const rightCuff = new THREE.Mesh(cuffGeom, cuffMat);
    rightCuff.position.y = -0.82;
    rightLeg.add(rightCuff);

    // Right Chunky Skate Sneaker
    const rightTread = new THREE.Mesh(treadGeom, shoeTreadMat);
    rightTread.position.set(0, -1.02, -0.1);
    const rightSole = new THREE.Mesh(soleGeom, shoeSoleMat);
    rightSole.position.set(0, -0.92, -0.1);
    rightSole.castShadow = true;
    const rightUpper = new THREE.Mesh(upperShoeGeom, shoeRedMat);
    rightUpper.position.set(0, -0.72, -0.08);
    const rightLaces = new THREE.Mesh(laceGeom, shoeLaceMat);
    rightLaces.position.set(0, -0.58, -0.18);
    rightLeg.add(rightTread);
    rightLeg.add(rightSole);
    rightLeg.add(rightUpper);
    rightLeg.add(rightLaces);
    jakeModel.add(rightLeg);

    // 7. HOVERBOARD (Visible during Boost)
    const boardGeom = new THREE.BoxGeometry(1.4, 0.12, 3.2);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.4 });
    hoverboardMesh = new THREE.Mesh(boardGeom, boardMat);
    hoverboardMesh.position.set(0, -0.05, 0);
    hoverboardMesh.visible = false;
    jakeModel.add(hoverboardMesh);

    // Jake faces forward down tracks (-Z)
    jakeModel.rotation.y = 0;

    playerGroup.add(jakeModel);
    scene.add(playerGroup);
  }

  // --- BUILD RAILWAY TRACKS & DIVIDERS ---
  function buildRailwayEnvironment() {
    tracksGroup = new THREE.Group();

    // 1. Ballast gravel ground bed
    const groundGeom = new THREE.PlaneGeometry(42, 600);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -150);
    ground.receiveShadow = true;
    tracksGroup.add(ground);

    // 2. Concrete side walls
    const wallGeom = new THREE.BoxGeometry(1.6, 6, 600);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

    const leftWall = new THREE.Mesh(wallGeom, wallMat);
    leftWall.position.set(-9.5, 3, -150);
    tracksGroup.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeom, wallMat);
    rightWall.position.set(9.5, 3, -150);
    tracksGroup.add(rightWall);

    // 3. Track Dividers (Safety Curbs between lanes)
    const dividerGeom = new THREE.BoxGeometry(0.35, 0.28, 600);
    const dividerMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    [-TRACK_SPACING / 2, TRACK_SPACING / 2].forEach((dx) => {
      const divider = new THREE.Mesh(dividerGeom, dividerMat);
      divider.position.set(dx, 0.14, -150);
      tracksGroup.add(divider);
    });

    // 4. Steel Rails & Wooden Sleepers for the 3 Lanes
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xcfd6e4,
      metalness: 0.9,
      roughness: 0.2
    });
    const tieMat = new THREE.MeshLambertMaterial({ color: 0x583e2e });

    LANES.forEach((laneX) => {
      // Left Rail
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railL.position.set(laneX - 0.85, 0.1, -150);
      tracksGroup.add(railL);

      // Right Rail
      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 600), railMat);
      railR.position.set(laneX + 0.85, 0.1, -150);
      tracksGroup.add(railR);
    });

    // Wooden Sleepers along the tracks
    const tieGeom = new THREE.BoxGeometry(2.1, 0.16, 0.45);
    for (let z = 20; z > -320; z -= 2.4) {
      LANES.forEach((laneX) => {
        const tie = new THREE.Mesh(tieGeom, tieMat);
        tie.position.set(laneX, 0.02, z);
        tie.receiveShadow = true;
        tracksGroup.add(tie);
      });
    }

    // Overhead Signal Gantries with Traffic Lights
    const archMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    for (let z = 0; z > -320; z -= 48) {
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(0, 0, z);

      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8.5, 8), archMat);
      pL.position.set(-8.5, 4.25, 0);
      const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8.5, 8), archMat);
      pR.position.set(8.5, 4.25, 0);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.45, 0.45), archMat);
      beam.position.set(0, 8.2, 0);

      // Green signal arrows above tracks
      LANES.forEach((lx) => {
        const signal = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), greenLightMat);
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

  // --- TRAIN OBSTACLE WITH RUNNABLE ROOF & OPTIONAL RAMP ---
  function createTrainObstacle(laneIndex, zPos, hasRamp = false) {
    const trainGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    trainGroup.position.set(laneX, 0, zPos);

    const trainDepth = 26;

    // Train Carriage Body
    const bodyGeom = new THREE.BoxGeometry(2.35, TRAIN_HEIGHT, trainDepth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Subway Red
      roughness: 0.35,
      metalness: 0.15
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = TRAIN_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    trainGroup.add(body);

    // Solid Yellow Roof (Runnable surface!)
    const roofGeom = new THREE.BoxGeometry(2.45, 0.35, trainDepth + 0.2);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4
    });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = TRAIN_HEIGHT + 0.15;
    roof.receiveShadow = true;
    trainGroup.add(roof);

    // Front Windshield (facing +Z toward incoming player)
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.8
    });
    const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 0.2), windowMat);
    frontWindshield.position.set(0, 2.4, trainDepth / 2 + 0.05);
    trainGroup.add(frontWindshield);

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lightL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 10), lightMat);
    lightL.rotation.x = Math.PI / 2;
    lightL.position.set(-0.75, 1.1, trainDepth / 2 + 0.05);
    const lightR = lightL.clone();
    lightR.position.x = 0.75;
    trainGroup.add(lightL);
    trainGroup.add(lightR);

    // Front Bumper
    const grillMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const grill = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 0.4), grillMat);
    grill.position.set(0, 0.45, trainDepth / 2);
    trainGroup.add(grill);

    // Optional SLOPED RAMP at the front of the train
    if (hasRamp) {
      const rampLength = 5.5;
      const rampGeom = new THREE.BoxGeometry(2.3, 0.3, rampLength);
      const rampMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
      const ramp = new THREE.Mesh(rampGeom, rampMat);
      // Angle the ramp from ground to roof
      ramp.position.set(0, TRAIN_HEIGHT / 2, trainDepth / 2 + rampLength / 2);
      ramp.rotation.x = -Math.atan2(TRAIN_HEIGHT, rampLength);
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      trainGroup.add(ramp);
    }

    trainGroup.userData = {
      type: 'train',
      lane: laneIndex,
      width: 2.8,
      height: TRAIN_HEIGHT,
      depth: trainDepth,
      hasRamp: hasRamp,
      frontZ: trainDepth / 2 + (hasRamp ? 5.5 : 0),
      backZ: -trainDepth / 2
    };

    scene.add(trainGroup);
    obstacles.push(trainGroup);

    // Spawn a trail of coins ON TOP of the train roof!
    for (let rz = -8; rz <= 8; rz += 3.5) {
      createCoin(laneIndex, zPos + rz, TRAIN_HEIGHT + 1.2);
    }
  }

  // --- TRACK HURDLE (JUMP OVER) ---
  function createHurdleObstacle(laneIndex, zPos) {
    const hurdleGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    hurdleGroup.position.set(laneX, 0, zPos);

    // Red/White striped jump barrier
    const barGeom = new THREE.BoxGeometry(2.6, 0.35, 0.25);
    const bar = new THREE.Mesh(barGeom, new THREE.MeshLambertMaterial({ color: 0xef4444 }));
    bar.position.y = 0.95;
    bar.castShadow = true;
    hurdleGroup.add(bar);

    [-0.7, 0, 0.7].forEach((sx) => {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.36, 0.27),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      stripe.position.set(sx, 0.95, 0);
      hurdleGroup.add(stripe);
    });

    const legGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const legL = new THREE.Mesh(legGeom, legMat);
    legL.position.set(-1.15, 0.55, 0);
    const legR = legL.clone();
    legR.position.x = 1.15;
    hurdleGroup.add(legL);
    hurdleGroup.add(legR);

    hurdleGroup.userData = {
      type: 'hurdle',
      lane: laneIndex,
      width: 2.6,
      height: 1.1,
      depth: 0.4
    };

    scene.add(hurdleGroup);
    obstacles.push(hurdleGroup);
  }

  // --- OVERHEAD SIGNAL GIRDER (SLIDE UNDER) ---
  function createOverheadSlideObstacle(laneIndex, zPos) {
    const beamGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    beamGroup.position.set(laneX, 0, zPos);

    // Overhead crossbar
    const beamGeom = new THREE.BoxGeometry(2.9, 1.6, 0.35);
    const beam = new THREE.Mesh(beamGeom, new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
    beam.position.y = 2.45;
    beam.castShadow = true;
    beamGroup.add(beam);

    // Hazard stripes
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    [-0.8, -0.2, 0.4].forEach((sx) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.62, 0.37), stripeMat);
      stripe.position.set(sx, 2.45, 0);
      beamGroup.add(stripe);
    });

    // High side posts
    const postGeom = new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const postL = new THREE.Mesh(postGeom, postMat);
    postL.position.set(-1.35, 1.7, 0);
    const postR = postL.clone();
    postR.position.x = 1.35;
    beamGroup.add(postL);
    beamGroup.add(postR);

    beamGroup.userData = {
      type: 'overhead',
      lane: laneIndex,
      width: 2.9,
      height: 3.4,
      slideClearance: 1.65,
      depth: 0.4
    };

    scene.add(beamGroup);
    obstacles.push(beamGroup);
  }

  // --- GOLD COIN FACTORY ---
  const coinGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    metalness: 0.95,
    roughness: 0.15
  });

  function createCoin(laneIndex, zPos, yPos = 1.2) {
    const coin = new THREE.Mesh(coinGeom, coinMat);
    coin.rotation.z = Math.PI / 2;
    coin.position.set(LANES[laneIndex], yPos, zPos);
    coin.castShadow = true;
    coin.userData = { lane: laneIndex, collected: false };
    scene.add(coin);
    coins.push(coin);
  }

  // --- BALANCED, FAIR LEVEL SPAWNER (60-85m PACING) ---
  let nextSpawnZ = -45;

  function spawnWorldPattern() {
    while (nextSpawnZ > -280) {
      const roll = Math.random();
      const openLane = Math.floor(Math.random() * 3); // 0, 1, 2
      const obstacleLane = (openLane + 1 + Math.floor(Math.random() * 2)) % 3;

      if (roll < 0.42) {
        // Red Subway Train (50% chance to have a ramp!)
        const hasRamp = Math.random() < 0.5;
        createTrainObstacle(obstacleLane, nextSpawnZ, hasRamp);

        // Ground coins in the open lane
        for (let cz = -2; cz <= 3; cz++) {
          createCoin(openLane, nextSpawnZ + cz * 3.5, 1.2);
        }
        nextSpawnZ -= 65; // Generous distance for safe reaction
      } else if (roll < 0.72) {
        // Hurdle (Jump)
        createHurdleObstacle(obstacleLane, nextSpawnZ);

        // Arch of coins jumping over hurdle
        createCoin(obstacleLane, nextSpawnZ + 3.5, 1.4);
        createCoin(obstacleLane, nextSpawnZ, 3.4);
        createCoin(obstacleLane, nextSpawnZ - 3.5, 1.4);
        nextSpawnZ -= 55;
      } else {
        // Overhead beam (Slide)
        createOverheadSlideObstacle(obstacleLane, nextSpawnZ);

        // Low slide coins
        for (let cz = -2; cz <= 2; cz++) {
          createCoin(obstacleLane, nextSpawnZ + cz * 2.8, 0.55);
        }
        nextSpawnZ -= 55;
      }
    }
  }

  // --- ULTRA-RESPONSIVE MOBILE SWIPE & CONTROLS ---
  function setupControls() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (!state.running || state.paused) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLane(-1);
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveLane(1);
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') doJump();
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') doSlide();
      else if (e.key === 'Shift') triggerBoost();
    });

    // Mobile Touch Gesture Detector (1 Swipe = Exactly 1 Track Switch, never skips middle!)
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

        // Require 22px clear intentional swipe
        if (absX > 22 || absY > 22) {
          hasSwipedInCurrentTouch = true; // Lock gesture: Exactly 1 lane switch per swipe!
          if (absX > absY) {
            // Move 1 lane only: Left (-1) -> Center (0) -> Right (1)
            if (dx > 0) moveLane(1);
            else moveLane(-1);
          } else {
            // Jump or Slide
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

    // Menu Buttons
    const startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.addEventListener('click', startGame);

    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', startGame);

    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

    const audioBtn = document.getElementById('btn-audio');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        if (window.soundEngine) {
          const muted = window.soundEngine.toggleMute();
          audioBtn.textContent = muted ? '🔇 AUDIO: OFF' : '🔊 AUDIO: ON';
        }
      });
    }
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
    // Can jump if on ground or running on a train roof
    if (!state.isJumping) {
      state.isJumping = true;
      state.isSliding = false;
      state.vy = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
      if (window.soundEngine) window.soundEngine.playJumpSFX();
    }
  }

  function doSlide() {
    state.isSliding = true;
    state.slideTimer = state.slideDuration;
    if (state.isJumping) {
      // Fast athletic dive down
      state.vy = -22;
    }
    if (window.soundEngine) window.soundEngine.playSlideSFX();
  }

  function triggerBoost() {
    if (state.overdriveCharge >= 25 || state.isBoosted) {
      state.isBoosted = true;
      state.boostTimer = 6.0;
      state.overdriveCharge = 0;
      if (hoverboardMesh) hoverboardMesh.visible = true;
      if (window.soundEngine) window.soundEngine.playCoinSFX(3);
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

  // --- GAME START & RESET ---
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

    obstacles.forEach((obs) => scene.remove(obs));
    obstacles = [];
    coins.forEach((c) => scene.remove(c));
    coins = [];

    nextSpawnZ = -45;
    spawnWorldPattern();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    if (hoverboardMesh) hoverboardMesh.visible = false;

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

    const isNewRecord = state.score > savedData.highScore;
    if (isNewRecord) savedData.highScore = Math.floor(state.score);
    savedData.totalCoins += state.coins;
    saveData();

    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    if (finalScoreEl) finalScoreEl.textContent = Math.floor(state.score);
    if (finalDistanceEl) finalDistanceEl.textContent = Math.floor(state.distance) + ' m';
    if (finalCreditsEl) finalCreditsEl.textContent = '+' + state.coins;
    if (newRecordBadge) newRecordBadge.style.display = isNewRecord ? 'inline-block' : 'none';
  }

  // --- MAIN LOOP ---
  function update(delta) {
    if (!state.running || state.paused) return;

    // Boost timer
    if (state.isBoosted) {
      state.boostTimer -= delta;
      state.speed = 75;
      if (state.boostTimer <= 0) {
        state.isBoosted = false;
        state.speed = 48;
        if (hoverboardMesh) hoverboardMesh.visible = false;
      }
    } else {
      state.speed = Math.min(state.maxSpeed, state.speed + delta * 0.35);
    }

    const distDelta = state.speed * delta;
    state.distance += distDelta;
    state.score += distDelta * state.multiplier * 1.5;

    // Charge Boost
    state.overdriveCharge = Math.min(100, state.overdriveCharge + delta * 7);
    if (hudOverdriveFill) hudOverdriveFill.style.width = state.overdriveCharge + '%';

    // Snappy Horizontal Lane Transition (Fast 28x interpolation)
    state.playerX += (state.targetX - state.playerX) * 28 * delta;

    // Check train roof ground support!
    let activeRoofGround = 0;
    for (let obs of obstacles) {
      if (obs.userData.type === 'train') {
        const laneX = LANES[obs.userData.lane];
        if (Math.abs(state.playerX - laneX) < 1.4) {
          const zRel = obs.position.z - playerGroup.position.z;
          // If player is on or over the train body
          if (zRel > obs.userData.backZ && zRel < obs.userData.frontZ) {
            // If train has ramp and player is entering ramp
            if (obs.userData.hasRamp && zRel > obs.userData.depth / 2) {
              const rampProgress = (obs.userData.frontZ - zRel) / 5.5;
              activeRoofGround = Math.max(activeRoofGround, rampProgress * TRAIN_HEIGHT);
            } else {
              activeRoofGround = Math.max(activeRoofGround, TRAIN_HEIGHT);
            }
          }
        }
      }
    }

    // Smooth ground adjustment
    if (state.playerY >= activeRoofGround - 0.4) {
      state.groundY = activeRoofGround;
    } else if (activeRoofGround === 0) {
      state.groundY = 0;
    }

    // Jump & Gravity Physics with Support Ground
    if (state.isJumping || state.playerY > state.groundY) {
      state.vy -= GRAVITY * delta;
      state.playerY += state.vy * delta;

      // Land on ground or train roof
      if (state.playerY <= state.groundY) {
        state.playerY = state.groundY;
        state.vy = 0;
        state.isJumping = false;
      }
    } else {
      state.playerY = state.groundY;
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

    // Natural forward facing with lateral lean
    const laneDelta = state.targetX - state.playerX;
    jakeModel.rotation.z = -laneDelta * 0.12;
    jakeModel.rotation.y = laneDelta * 0.15; // Leans slightly into the track switch

    // Camera follow (tracks player laterally so Jake is ALWAYS centered and never cut off)
    const targetCamX = state.playerX * 0.72;
    camera.position.x += (targetCamX - camera.position.x) * 16 * delta;
    camera.position.y = state.isSliding ? 3.8 : 5.0;

    // Limb Animations
    runAnimTime += delta * (state.speed * 0.35);

    if (state.isSliding) {
      // Low slide posture
      jakeModel.scale.set(1.15, 0.45, 1.25);
      jakeModel.position.y = -0.3;
      leftLeg.rotation.x = -1.2;
      rightLeg.rotation.x = -1.2;
      leftArm.rotation.x = 0.8;
      rightArm.rotation.x = 0.8;
    } else if (state.isJumping) {
      // Athletic jump posture
      jakeModel.scale.set(1, 1, 1);
      jakeModel.position.y = 0;
      leftLeg.rotation.x = -0.7;
      rightLeg.rotation.x = 0.5;
      leftArm.rotation.x = 2.4;
      rightArm.rotation.x = 2.4;
    } else {
      // Natural forward running stride
      jakeModel.scale.set(1, 1, 1);
      jakeModel.position.y = Math.sin(runAnimTime * 2) * 0.08;
      const legAngle = Math.sin(runAnimTime) * 0.75;
      leftLeg.rotation.x = legAngle;
      rightLeg.rotation.x = -legAngle;
      leftArm.rotation.x = -legAngle * 1.1;
      rightArm.rotation.x = legAngle * 1.1;
      headMesh.rotation.y = Math.sin(runAnimTime * 0.5) * 0.08;
    }

    // Move obstacles towards player (+Z direction)
    const moveZ = distDelta;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.position.z += moveZ;

      // Check collision
      if (Math.abs(obs.position.z) < 18) {
        if (checkCollision(obs)) {
          gameOver();
          return;
        }
      }

      // Recycle obstacles behind player
      if (obs.position.z > 25) {
        scene.remove(obs);
        obstacles.splice(i, 1);
      }
    }

    // Move & collect coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.position.z += moveZ;
      coin.rotation.y += delta * 4.5;

      const dist = coin.position.distanceTo(playerGroup.position);

      // Magnet during boost
      if (state.isBoosted && dist < 14) {
        coin.position.x += (state.playerX - coin.position.x) * 12 * delta;
        coin.position.y += (state.playerY + 1.2 - coin.position.y) * 12 * delta;
      }

      if (dist < 1.6 && !coin.userData.collected) {
        coin.userData.collected = true;
        state.coins++;
        state.score += 50;
        if (window.soundEngine) window.soundEngine.playCoinSFX();
        scene.remove(coin);
        coins.splice(i, 1);
        continue;
      }

      if (coin.position.z > 20) {
        scene.remove(coin);
        coins.splice(i, 1);
      }
    }

    // Spawner
    nextSpawnZ += moveZ;
    spawnWorldPattern();

    // HUD Update
    if (hudScore) hudScore.textContent = Math.floor(state.score);
    if (hudCoins) hudCoins.textContent = state.coins;
    if (hudSpeed) hudSpeed.textContent = Math.floor(state.speed * 1.2) + ' KM/H';
  }

  // --- COLLISION DETECTION (FAST-PASS OVER HURDLES & UNDER BEAMS LIKE SUBWAY!) ---
  function checkCollision(obs) {
    const laneX = LANES[obs.userData.lane];
    // Must be in the same lane horizontally
    if (Math.abs(state.playerX - laneX) > 1.1) return false;

    const zDist = obs.position.z - playerGroup.position.z;

    if (obs.userData.type === 'train') {
      // If train has a ramp, front entry is safe (Jake runs right up!)
      if (obs.userData.hasRamp) {
        return false;
      }
      // If jumping or running on top of the train roof: SAFE! No crash!
      if (state.playerY >= TRAIN_HEIGHT - 0.3) {
        return false;
      }
      // Only crash if running into the solid front bumper of the train at ground level
      if (zDist > 0 && zDist < 1.3) {
        return true;
      }
    } else if (obs.userData.type === 'hurdle') {
      // In Subway Surfers: If player swiped UP to jump, they CLEANLY FAST-PASS over the hurdle!
      if (state.isJumping && state.playerY > 0.35) {
        return false; // Fast-pass success!
      }
      // Only crash if running on ground into the hurdle without jumping
      if (Math.abs(zDist) < 0.85 && state.playerY < 0.85) {
        return true;
      }
    } else if (obs.userData.type === 'overhead') {
      // In Subway Surfers: If player swiped DOWN to slide, they CLEANLY FAST-PASS under the beam!
      if (state.isSliding) {
        return false; // Fast-pass slide success!
      }
      // Only crash if running standing upright into the low beam
      if (Math.abs(zDist) < 0.85 && state.playerY > 0.3) {
        return true;
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
