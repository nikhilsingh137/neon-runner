/**
 * Subway Runner 3D - Jake Skater Boy Edition
 * Full WebGL 3D Engine powered by Three.js
 */

(function () {
  'use strict';

  // --- GAME CONSTANTS ---
  const TRACK_SPACING = 3.4;
  const LANES = [-TRACK_SPACING, 0, TRACK_SPACING]; // -1: Left, 0: Center, 1: Right
  const SEGMENT_LENGTH = 120;
  const VISIBLE_DISTANCE = 220;
  const JUMP_HEIGHT = 4.2;
  const GRAVITY = 28.0;

  // --- STATE ---
  const state = {
    running: false,
    paused: false,
    score: 0,
    coins: 0,
    distance: 0,
    speed: 38,
    maxSpeed: 78,
    currentLane: 0, // -1, 0, 1
    playerX: 0,
    targetX: 0,
    playerY: 0,
    vy: 0,
    isJumping: false,
    isSliding: false,
    slideTimer: 0,
    slideDuration: 0.75,
    isBoosted: false,
    boostTimer: 0,
    overdriveCharge: 0,
    nearMissCount: 0,
    multiplier: 1,
    character: 'jake'
  };

  // High score & storage
  let savedData = {
    highScore: 0,
    totalCoins: 0,
    character: 'jake'
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
  let tracksGroup, obstacles = [], coins = [], sceneryObjects = [];
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

    // Scene with sky color
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8); // Sunny vibrant sky
    scene.fog = new THREE.Fog(0x38bdf8, 90, VISIBLE_DISTANCE);

    // Camera
    camera = new THREE.PerspectiveCamera(58, width / height, 0.5, 300);
    camera.position.set(0, 4.8, 8.5);
    camera.lookAt(0, 1.8, -12);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.85);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.1);
    sunLight.position.set(25, 45, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);

    // Build World & Player
    buildRailwayEnvironment();
    buildJakeCharacter();
    setupControls();

    window.addEventListener('resize', onWindowResize);
  }

  // --- BUILD JAKE 3D SKATER BOY ---
  function buildJakeCharacter() {
    playerGroup = new THREE.Group();

    // Base materials
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd8b8 }); // Warm skin
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x5a331a }); // Brown hair
    const capRedMat = new THREE.MeshLambertMaterial({ color: 0xe52521 }); // Backwards red cap
    const capWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // Cap brim & white tee
    const denimVestMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }); // Blue denim vest
    const jeansMat = new THREE.MeshLambertMaterial({ color: 0x2563eb }); // Baggy denim jeans
    const shoeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }); // Thick skate soles
    const shoeRedMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 }); // Sneaker red upper
    const backpackMat = new THREE.MeshLambertMaterial({ color: 0xea580c }); // Spray backpack
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x18181b });

    jakeModel = new THREE.Group();

    // 1. TORSO (White shirt + Blue denim vest)
    const torsoGeom = new THREE.BoxGeometry(0.95, 1.25, 0.65);
    const torsoMesh = new THREE.Mesh(torsoGeom, denimVestMat);
    torsoMesh.position.y = 1.6;
    torsoMesh.castShadow = true;
    jakeModel.add(torsoMesh);

    // White shirt visible on chest
    const chestShirtGeom = new THREE.BoxGeometry(0.46, 0.9, 0.67);
    const chestShirt = new THREE.Mesh(chestShirtGeom, capWhiteMat);
    chestShirt.position.set(0, 1.55, 0.02);
    jakeModel.add(chestShirt);

    // 2. HEAD & FACE
    headMesh = new THREE.Group();
    headMesh.position.set(0, 2.55, 0.05);

    // Head base
    const headGeom = new THREE.SphereGeometry(0.42, 16, 16);
    const headBase = new THREE.Mesh(headGeom, skinMat);
    headBase.castShadow = true;
    headMesh.add(headBase);

    // Big stylized boy eyes
    const eyeGeom = new THREE.SphereGeometry(0.08, 12, 12);
    const pupilGeom = new THREE.SphereGeometry(0.045, 10, 10);

    // Left eye
    const leftEye = new THREE.Mesh(eyeGeom, eyeWhiteMat);
    leftEye.position.set(-0.16, 0.04, -0.38);
    const leftPupil = new THREE.Mesh(pupilGeom, eyePupilMat);
    leftPupil.position.set(-0.16, 0.04, -0.44);
    headMesh.add(leftEye);
    headMesh.add(leftPupil);

    // Right eye
    const rightEye = new THREE.Mesh(eyeGeom, eyeWhiteMat);
    rightEye.position.set(0.16, 0.04, -0.38);
    const rightPupil = new THREE.Mesh(pupilGeom, eyePupilMat);
    rightPupil.position.set(0.16, 0.04, -0.44);
    headMesh.add(rightEye);
    headMesh.add(rightPupil);

    // Hair tufts poking out front
    const hairGeom = new THREE.BoxGeometry(0.68, 0.16, 0.35);
    const hairFront = new THREE.Mesh(hairGeom, hairMat);
    hairFront.position.set(0, 0.28, -0.22);
    headMesh.add(hairFront);

    // 3. BACKWARDS RED CAP (Subway Jake signature)
    capGroup = new THREE.Group();
    const capDomeGeom = new THREE.SphereGeometry(0.45, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const capDome = new THREE.Mesh(capDomeGeom, capRedMat);
    capDome.position.y = 0.08;
    capDome.castShadow = true;
    capGroup.add(capDome);

    // Visor/brim turned backwards (+Z direction, pointing back)
    const capBrimGeom = new THREE.BoxGeometry(0.55, 0.06, 0.36);
    const capBrim = new THREE.Mesh(capBrimGeom, capWhiteMat);
    capBrim.position.set(0, 0.08, 0.44);
    capBrim.rotation.x = 0.15;
    capGroup.add(capBrim);

    // Cap top button
    const capBtnGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8);
    const capBtn = new THREE.Mesh(capBtnGeom, capWhiteMat);
    capBtn.position.y = 0.52;
    capGroup.add(capBtn);

    headMesh.add(capGroup);
    jakeModel.add(headMesh);

    // 4. BACKPACK (Jake's orange spray-paint pack)
    const packGeom = new THREE.BoxGeometry(0.72, 0.9, 0.38);
    const packMesh = new THREE.Mesh(packGeom, backpackMat);
    packMesh.position.set(0, 1.65, 0.48);
    packMesh.castShadow = true;
    jakeModel.add(packMesh);

    // Spray paint cans sticking out of backpack
    const canGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.45, 10);
    const canMat1 = new THREE.MeshLambertMaterial({ color: 0x10b981 });
    const canMat2 = new THREE.MeshLambertMaterial({ color: 0xf59e0b });

    const canLeft = new THREE.Mesh(canGeom, canMat1);
    canLeft.position.set(-0.25, 1.95, 0.48);
    canLeft.rotation.z = -0.15;
    jakeModel.add(canLeft);

    const canRight = new THREE.Mesh(canGeom, canMat2);
    canRight.position.set(0.25, 1.95, 0.48);
    canRight.rotation.z = 0.15;
    jakeModel.add(canRight);

    // 5. ARMS & HANDS (Swinging pivots at shoulders)
    const armGeom = new THREE.CylinderGeometry(0.12, 0.1, 0.85, 10);
    const handGeom = new THREE.SphereGeometry(0.13, 10, 10);

    // Left Arm
    leftArm = new THREE.Group();
    leftArm.position.set(-0.62, 2.05, 0);
    const leftArmMesh = new THREE.Mesh(armGeom, skinMat);
    leftArmMesh.position.y = -0.42;
    leftArmMesh.castShadow = true;
    const leftHand = new THREE.Mesh(handGeom, skinMat);
    leftHand.position.y = -0.88;
    leftArm.add(leftArmMesh);
    leftArm.add(leftHand);
    jakeModel.add(leftArm);

    // Right Arm
    rightArm = new THREE.Group();
    rightArm.position.set(0.62, 2.05, 0);
    const rightArmMesh = new THREE.Mesh(armGeom, skinMat);
    rightArmMesh.position.y = -0.42;
    rightArmMesh.castShadow = true;
    const rightHand = new THREE.Mesh(handGeom, skinMat);
    rightHand.position.y = -0.88;
    rightArm.add(rightArmMesh);
    rightArm.add(rightHand);
    jakeModel.add(rightArm);

    // 6. LEGS & SNEAKERS (Swinging running pivots at hips)
    const legGeom = new THREE.BoxGeometry(0.34, 0.85, 0.36);
    const soleGeom = new THREE.BoxGeometry(0.38, 0.15, 0.72);
    const shoeUpperGeom = new THREE.BoxGeometry(0.36, 0.28, 0.65);

    // Left Leg
    leftLeg = new THREE.Group();
    leftLeg.position.set(-0.28, 1.05, 0);
    const leftLegMesh = new THREE.Mesh(legGeom, jeansMat);
    leftLegMesh.position.y = -0.42;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);

    // Left Sneaker
    const leftSole = new THREE.Mesh(soleGeom, shoeWhiteMat);
    leftSole.position.set(0, -0.92, -0.1);
    leftSole.castShadow = true;
    const leftUpper = new THREE.Mesh(shoeUpperGeom, shoeRedMat);
    leftUpper.position.set(0, -0.74, -0.08);
    leftLeg.add(leftSole);
    leftLeg.add(leftUpper);
    jakeModel.add(leftLeg);

    // Right Leg
    rightLeg = new THREE.Group();
    rightLeg.position.set(0.28, 1.05, 0);
    const rightLegMesh = new THREE.Mesh(legGeom, jeansMat);
    rightLegMesh.position.y = -0.42;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);

    // Right Sneaker
    const rightSole = new THREE.Mesh(soleGeom, shoeWhiteMat);
    rightSole.position.set(0, -0.92, -0.1);
    rightSole.castShadow = true;
    const rightUpper = new THREE.Mesh(shoeUpperGeom, shoeRedMat);
    rightUpper.position.set(0, -0.74, -0.08);
    rightLeg.add(rightSole);
    rightLeg.add(rightUpper);
    jakeModel.add(rightLeg);

    // 7. HOVERBOARD (Visible during Boost)
    const boardGeom = new THREE.BoxGeometry(1.4, 0.12, 3.2);
    const boardMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    hoverboardMesh = new THREE.Mesh(boardGeom, boardMat);
    hoverboardMesh.position.set(0, -0.05, 0);
    hoverboardMesh.visible = false;
    jakeModel.add(hoverboardMesh);

    playerGroup.add(jakeModel);
    scene.add(playerGroup);
  }

  // --- BUILD 3 RAILWAY TRACKS & SURROUNDING CITY ---
  function buildRailwayEnvironment() {
    tracksGroup = new THREE.Group();

    // 1. Ground Ballast / Gravel Bed
    const groundGeom = new THREE.PlaneGeometry(36, 600);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -150);
    ground.receiveShadow = true;
    tracksGroup.add(ground);

    // 2. Concrete Side Retaining Walls
    const wallGeom = new THREE.BoxGeometry(1.6, 6, 600);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

    const leftWall = new THREE.Mesh(wallGeom, wallMat);
    leftWall.position.set(-8.5, 3, -150);
    tracksGroup.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeom, wallMat);
    rightWall.position.set(8.5, 3, -150);
    tracksGroup.add(rightWall);

    // 3. Steel Rails & Wooden Ties for each of the 3 Lanes
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xc0c8d8,
      metalness: 0.9,
      roughness: 0.2
    });
    const tieMat = new THREE.MeshLambertMaterial({ color: 0x583e2e }); // Dark wood

    LANES.forEach((laneX) => {
      // Left Steel Rail
      const railGeom = new THREE.BoxGeometry(0.14, 0.22, 600);
      const railL = new THREE.Mesh(railGeom, railMat);
      railL.position.set(laneX - 0.9, 0.1, -150);
      tracksGroup.add(railL);

      // Right Steel Rail
      const railR = new THREE.Mesh(railGeom, railMat);
      railR.position.set(laneX + 0.9, 0.1, -150);
      tracksGroup.add(railR);
    });

    // Repeating Wooden Sleepers (Ties)
    const tieGeom = new THREE.BoxGeometry(2.4, 0.16, 0.45);
    for (let z = 20; z > -320; z -= 2.2) {
      LANES.forEach((laneX) => {
        const tie = new THREE.Mesh(tieGeom, tieMat);
        tie.position.set(laneX, 0.02, z);
        tie.receiveShadow = true;
        tracksGroup.add(tie);
      });
    }

    // Overhead Railway Arch Gantries (spans across the 3 tracks)
    const archMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    for (let z = 0; z > -320; z -= 38) {
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(0, 0, z);

      // Pillars
      const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 8), archMat);
      pL.position.set(-7.5, 4, 0);
      const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 8), archMat);
      pR.position.set(7.5, 4, 0);

      // Cross beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.4, 0.4), archMat);
      beam.position.set(0, 7.8, 0);

      gantryGroup.add(pL);
      gantryGroup.add(pR);
      gantryGroup.add(beam);
      tracksGroup.add(gantryGroup);
    }

    scene.add(tracksGroup);
  }

  // --- OBSTACLE FACTORY: TRAINS, HURDLES, OVERHEAD BEAMS ---
  function createTrainObstacle(laneIndex, zPos) {
    const trainGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    trainGroup.position.set(laneX, 0, zPos);

    // Train Body (Subway Red carriage)
    const bodyGeom = new THREE.BoxGeometry(2.7, 3.8, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcc2222,
      roughness: 0.35,
      metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 2.0;
    body.castShadow = true;
    body.receiveShadow = true;
    trainGroup.add(body);

    // Yellow Roof
    const roofGeom = new THREE.BoxGeometry(2.8, 0.35, 24.2);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = 3.95;
    trainGroup.add(roof);

    // Front Windshield
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.8
    });
    const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 0.2), windowMat);
    frontWindshield.position.set(0, 2.6, 12.05);
    trainGroup.add(frontWindshield);

    // Headlights (Glowing Yellow)
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lightL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 10), lightMat);
    lightL.rotation.x = Math.PI / 2;
    lightL.position.set(-0.85, 1.2, 12.05);
    const lightR = lightL.clone();
    lightR.position.x = 0.85;
    trainGroup.add(lightL);
    trainGroup.add(lightR);

    // Front Cowcatcher Grill
    const grillMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const grill = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.4), grillMat);
    grill.position.set(0, 0.45, 12.0);
    trainGroup.add(grill);

    trainGroup.userData = {
      type: 'train',
      lane: laneIndex,
      width: 2.7,
      height: 3.8,
      depth: 24,
      box: new THREE.Box3()
    };

    scene.add(trainGroup);
    obstacles.push(trainGroup);
  }

  function createHurdleObstacle(laneIndex, zPos) {
    const hurdleGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    hurdleGroup.position.set(laneX, 0, zPos);

    // Wooden / Red striped barrier (JUMP OVER)
    const barGeom = new THREE.BoxGeometry(2.6, 0.35, 0.25);
    const barMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const bar = new THREE.Mesh(barGeom, barMat);
    bar.position.y = 0.95;
    bar.castShadow = true;
    hurdleGroup.add(bar);

    // White stripes
    const stripeGeom = new THREE.BoxGeometry(0.35, 0.36, 0.27);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    [-0.7, 0, 0.7].forEach((sx) => {
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.set(sx, 0.95, 0);
      hurdleGroup.add(stripe);
    });

    // Side legs
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
      depth: 0.4,
      box: new THREE.Box3()
    };

    scene.add(hurdleGroup);
    obstacles.push(hurdleGroup);
  }

  function createOverheadSlideObstacle(laneIndex, zPos) {
    const beamGroup = new THREE.Group();
    const laneX = LANES[laneIndex];
    beamGroup.position.set(laneX, 0, zPos);

    // High overhead girder (SLIDE UNDER)
    const beamGeom = new THREE.BoxGeometry(2.8, 1.6, 0.35);
    const beamMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = 2.45;
    beam.castShadow = true;
    beamGroup.add(beam);

    // Black hazard warning stripes
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    [-0.8, -0.2, 0.4].forEach((sx) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.62, 0.37), stripeMat);
      stripe.position.set(sx, 2.45, 0);
      beamGroup.add(stripe);
    });

    // High side support pillars
    const postGeom = new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const postL = new THREE.Mesh(postGeom, postMat);
    postL.position.set(-1.3, 1.7, 0);
    const postR = postL.clone();
    postR.position.x = 1.3;
    beamGroup.add(postL);
    beamGroup.add(postR);

    beamGroup.userData = {
      type: 'overhead',
      lane: laneIndex,
      width: 2.8,
      height: 3.4,
      slideClearance: 1.65, // Underneath clearance
      depth: 0.4,
      box: new THREE.Box3()
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

  // --- PROCEDURAL LEVEL SPAWNER ---
  let nextSpawnZ = -40;

  function spawnWorldPattern() {
    while (nextSpawnZ > -300) {
      const roll = Math.random();
      const freeLane = Math.floor(Math.random() * 3); // 0, 1, 2
      const obstacleLane = (freeLane + 1 + Math.floor(Math.random() * 2)) % 3;

      if (roll < 0.45) {
        // Red Subway Train
        createTrainObstacle(obstacleLane, nextSpawnZ);
        // Coins in the open lane
        for (let cz = 0; cz < 5; cz++) {
          createCoin(freeLane, nextSpawnZ + cz * 4, 1.2);
        }
        nextSpawnZ -= 36;
      } else if (roll < 0.72) {
        // Hurdle (Jump)
        createHurdleObstacle(obstacleLane, nextSpawnZ);
        // High parabolic arc of coins over the hurdle
        createCoin(obstacleLane, nextSpawnZ + 4, 1.4);
        createCoin(obstacleLane, nextSpawnZ, 3.2); // peak of jump!
        createCoin(obstacleLane, nextSpawnZ - 4, 1.4);
        nextSpawnZ -= 26;
      } else {
        // Overhead beam (Slide)
        createOverheadSlideObstacle(obstacleLane, nextSpawnZ);
        // Low slide coins
        for (let cz = -2; cz <= 2; cz++) {
          createCoin(obstacleLane, nextSpawnZ + cz * 2.5, 0.55);
        }
        nextSpawnZ -= 26;
      }
    }
  }

  // --- INPUT & SWIPE HANDLING ---
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

    // Touch Swipe Detection on mobile
    const overlay = document.getElementById('touch-overlay');
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
      if (!state.running || state.paused) return;
      if (e.changedTouches.length > 0) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) > 28 && dt < 450) {
          if (absX > absY) {
            // Horizontal swipe: Switch railway tracks
            if (dx > 0) moveLane(1);
            else moveLane(-1);
          } else {
            // Vertical swipe: Jump or Slide
            if (dy < 0) doJump();
            else doSlide();
          }
        } else if (dt < 250 && absX < 15 && absY < 15) {
          // Quick tap: activate hoverboard
          triggerBoost();
        }
      }
    }, { passive: true });

    // Virtual HUD buttons
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

    // Start / Restart / Pause buttons
    const startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.addEventListener('click', startGame);

    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) restartBtn.addEventListener('click', startGame);

    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', togglePause);
    }
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', togglePause);
    }

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
    if (!state.isJumping) {
      state.isJumping = true;
      state.isSliding = false; // Cancel slide when jumping
      state.vy = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
      if (window.soundEngine) window.soundEngine.playJumpSFX();
    }
  }

  function doSlide() {
    state.isSliding = true;
    state.slideTimer = state.slideDuration;
    if (state.isJumping) {
      // Fast drop down if mid-air
      state.vy = -18;
    }
    if (window.soundEngine) window.soundEngine.playSlideSFX();
  }

  function triggerBoost() {
    if (state.overdriveCharge >= 30 || state.isBoosted) {
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
    // Reset state
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.coins = 0;
    state.distance = 0;
    state.speed = 38;
    state.currentLane = 0;
    state.playerX = 0;
    state.targetX = 0;
    state.playerY = 0;
    state.vy = 0;
    state.isJumping = false;
    state.isSliding = false;
    state.slideTimer = 0;
    state.isBoosted = false;
    state.boostTimer = 0;
    state.overdriveCharge = 0;
    state.multiplier = 1;

    // Clear existing obstacles and coins
    obstacles.forEach((obs) => scene.remove(obs));
    obstacles = [];
    coins.forEach((c) => scene.remove(c));
    coins = [];

    nextSpawnZ = -40;
    spawnWorldPattern();

    // UI transitions
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    if (hoverboardMesh) hoverboardMesh.visible = false;

    // Start background audio
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

    // Save stats
    const isNewRecord = state.score > savedData.highScore;
    if (isNewRecord) savedData.highScore = Math.floor(state.score);
    savedData.totalCoins += state.coins;
    saveData();

    // Show Game Over Modal
    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    if (finalScoreEl) finalScoreEl.textContent = Math.floor(state.score);
    if (finalDistanceEl) finalDistanceEl.textContent = Math.floor(state.distance) + ' m';
    if (finalCreditsEl) finalCreditsEl.textContent = '+' + state.coins;
    if (newRecordBadge) newRecordBadge.style.display = isNewRecord ? 'inline-block' : 'none';
  }

  // --- MAIN GAME LOOP ---
  function update(delta) {
    if (!state.running || state.paused) return;

    // Boost timer
    if (state.isBoosted) {
      state.boostTimer -= delta;
      state.speed = 68;
      if (state.boostTimer <= 0) {
        state.isBoosted = false;
        state.speed = 38;
        if (hoverboardMesh) hoverboardMesh.visible = false;
      }
    } else {
      // Natural speed progression
      state.speed = Math.min(state.maxSpeed, state.speed + delta * 0.45);
    }

    const distDelta = state.speed * delta;
    state.distance += distDelta;
    state.score += distDelta * state.multiplier * 1.5;

    // Charge Overdrive
    state.overdriveCharge = Math.min(100, state.overdriveCharge + delta * 6);
    if (hudOverdriveFill) hudOverdriveFill.style.width = state.overdriveCharge + '%';

    // Smooth horizontal lane transition
    state.playerX += (state.targetX - state.playerX) * 14 * delta;

    // Jump & Gravity physics
    if (state.isJumping) {
      state.vy -= GRAVITY * delta;
      state.playerY += state.vy * delta;
      if (state.playerY <= 0) {
        state.playerY = 0;
        state.vy = 0;
        state.isJumping = false;
      }
    }

    // Slide timer
    if (state.isSliding) {
      state.slideTimer -= delta;
      if (state.slideTimer <= 0) {
        state.isSliding = false;
      }
    }

    // Position player
    playerGroup.position.set(state.playerX, state.playerY, 0);

    // Lateral tilt/lean when switching lanes
    const laneDelta = state.targetX - state.playerX;
    jakeModel.rotation.z = -laneDelta * 0.08;
    jakeModel.rotation.y = Math.PI + laneDelta * 0.12;

    // Animate Jake limbs (Running cycle)
    runAnimTime += delta * (state.speed * 0.35);

    if (state.isSliding) {
      // Duck down / slide flat
      jakeModel.scale.set(1.15, 0.45, 1.3);
      jakeModel.position.y = -0.3;
      leftLeg.rotation.x = -1.2;
      rightLeg.rotation.x = -1.2;
      leftArm.rotation.x = 0.8;
      rightArm.rotation.x = 0.8;
    } else if (state.isJumping) {
      // Tucked jump posture
      jakeModel.scale.set(1, 1, 1);
      jakeModel.position.y = 0;
      leftLeg.rotation.x = -0.7;
      rightLeg.rotation.x = 0.5;
      leftArm.rotation.x = 2.4;
      rightArm.rotation.x = 2.4;
    } else {
      // Natural running stride
      jakeModel.scale.set(1, 1, 1);
      jakeModel.position.y = Math.sin(runAnimTime * 2) * 0.08; // vertical bob
      const legAngle = Math.sin(runAnimTime) * 0.75;
      leftLeg.rotation.x = legAngle;
      rightLeg.rotation.x = -legAngle;
      leftArm.rotation.x = -legAngle * 1.1;
      rightArm.rotation.x = legAngle * 1.1;
      headMesh.rotation.y = Math.sin(runAnimTime * 0.5) * 0.1;
    }

    // Move tracks and scenery backward (relative motion)
    const moveZ = distDelta;

    // Move obstacles towards player (+Z direction)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.position.z += moveZ;

      // Update collision bounding box
      obs.userData.box.setFromObject(obs);

      // Check collision with player
      if (Math.abs(obs.position.z) < 14) {
        if (checkCollision(obs)) {
          gameOver();
          return;
        }
      }

      // Remove obstacles behind camera
      if (obs.position.z > 20) {
        scene.remove(obs);
        obstacles.splice(i, 1);
      }
    }

    // Move & collect coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.position.z += moveZ;
      coin.rotation.y += delta * 4.5; // Rapid spin

      // Coin collection check
      const pz = playerGroup.position.z;
      const dist = coin.position.distanceTo(playerGroup.position);

      // Magnet attraction during boost
      if (state.isBoosted && dist < 12) {
        coin.position.x += (state.playerX - coin.position.x) * 10 * delta;
        coin.position.y += (state.playerY + 1.2 - coin.position.y) * 10 * delta;
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

    // Recycle next patterns
    nextSpawnZ += moveZ;
    spawnWorldPattern();

    // Update HUD
    if (hudScore) hudScore.textContent = Math.floor(state.score);
    if (hudCoins) hudCoins.textContent = state.coins;
    if (hudSpeed) hudSpeed.textContent = Math.floor(state.speed * 18) + ' KM/H';
  }

  // --- COLLISION DETECTION ---
  function checkCollision(obs) {
    const laneX = LANES[obs.userData.lane];
    // Check horizontal alignment
    if (Math.abs(state.playerX - laneX) > 1.45) return false;

    // Check Z depth overlap
    const zDist = Math.abs(obs.position.z - playerGroup.position.z);

    if (obs.userData.type === 'train') {
      // Long train body: hits if within half depth
      if (zDist < obs.userData.depth * 0.48) {
        // Player cannot jump over trains unless high
        if (state.playerY < 3.2) return true;
      }
    } else if (obs.userData.type === 'hurdle') {
      // Hurdle: cleared if jumping high enough
      if (zDist < 1.1) {
        if (state.playerY < 1.15) return true;
      }
    } else if (obs.userData.type === 'overhead') {
      // Overhead beam: cleared if sliding
      if (zDist < 1.1) {
        if (!state.isSliding && state.playerY > -0.2) return true;
      }
    }

    return false;
  }

  // --- RENDER LOOP ---
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    update(delta);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function onWindowResize() {
    if (!renderer || !camera || !container) return;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // Initialize when DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    initEngine();
    animate();
  });
})();
