/* ============================================================================
   POST APOCALYPTIC INDIA — LAST STAND  ·  v1.0
   A first-person zombie survival shooter. Three.js r160, zero build step.
   Systems: FPP controller (WASD/sprint/jump/crouch), AK-47 with ADS,
   procedural viewmodel + hands, hitscan combat with hit zones, undead AI
   (wander → chase → attack) with separation & obstacle avoidance,
   blood/impact VFX, procedural WebAudio, 4 themed night arenas.
   ============================================================================ */
'use strict';

/* ------------------------------- helpers --------------------------------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/* --------------------------- renderer / scene ---------------------------- */
const W = () => window.innerWidth, H = () => window.innerHeight;
const container = document.getElementById('game3d');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(W(), H());
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);
const canvasEl = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, W() / H(), 0.08, 240);
camera.rotation.order = 'YXZ';
scene.add(camera);
const clock = new THREE.Clock();

// viewmodel lives in its own scene so it never clips world geometry
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(58, W() / H(), 0.01, 5);
vmScene.add(new THREE.HemisphereLight(0x9a8fd0, 0x1a1420, 0.9));
const vmKey = new THREE.DirectionalLight(0xfff2dd, 1.5); vmKey.position.set(-0.6, 1, 0.4); vmScene.add(vmKey);
const vmFlashLight = new THREE.PointLight(0xffb45e, 0, 3, 2); vmFlashLight.position.set(0.3, 0, 0.2); vmScene.add(vmFlashLight);

let lvlFog = null, hemi = null, moon = null;

/* ------------------------------- audio ----------------------------------- */
const AudioSys = (() => {
  let ctx = null, master = null, muted = false, volume = 0.8;
  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  const now = () => ctx.currentTime;
  function env(g, t0, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  function noiseBuf(len) {
    const b = ctx.createBuffer(1, Math.max(1, len * ctx.sampleRate | 0), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function shotNoise(t0, dur, freq, q, peak) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    const g = ctx.createGain(); env(g, t0, 0.002, peak, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
  }
  function tone(t0, type, f0, f1, a, d, peak) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + a + d);
    const g = ctx.createGain(); env(g, t0, a, peak, d);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + a + d + 0.05);
  }
  return {
    ensure, get muted() { return muted; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : volume; return muted; },
    setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; },
    akShot() {
      if (!ctx || muted) return; const t = now();
      shotNoise(t, 0.06, 2400, 0.8, 0.5); shotNoise(t, 0.22, 500, 0.6, 0.55);
      tone(t, 'triangle', 160, 45, 0.001, 0.14, 0.5);
    },
    akReload() {
      if (!ctx || muted) return; const t = now();
      tone(t, 'square', 900, 500, 0.004, 0.03, 0.12);
      tone(t + 0.5, 'square', 600, 300, 0.004, 0.04, 0.12);
      tone(t + 1.1, 'square', 1200, 700, 0.003, 0.03, 0.14);
      tone(t + 1.5, 'square', 800, 400, 0.004, 0.05, 0.16);
    },
    dryClick() { if (!ctx || muted) return; tone(now(), 'square', 1800, 900, 0.001, 0.02, 0.08); },
    casings() { if (!ctx || muted) return; const t = now(); tone(t, 'square', 4000 + rand(-500, 500), 2500, 0.001, 0.015, 0.05); },
    footstep(surf) {
      if (!ctx || muted) return; const t = now();
      const f = surf === 'water' ? 900 : surf === 'dirt' ? 700 : 1100;
      shotNoise(t, 0.045, f + rand(-150, 150), 1.2, 0.1);
    },
    groan(dst) {
      if (!ctx || muted) return; const t = now(), g = clamp(1 - dst / 34, 0.05, 1) * 0.4;
      tone(t, 'sawtooth', rand(65, 110), rand(40, 70), 0.14, 0.7, g);
      tone(t + 0.06, 'sawtooth', rand(50, 90), 35, 0.2, 0.8, g * 0.6);
    },
    scream(dst) {
      if (!ctx || muted) return; const t = now(), g = clamp(1 - dst / 40, 0.1, 1) * 0.5;
      tone(t, 'sawtooth', rand(300, 500), rand(90, 150), 0.03, 0.5, g);
      tone(t, 'square', rand(600, 900), 200, 0.02, 0.4, g * 0.4);
    },
    bite() {
      if (!ctx || muted) return; const t = now();
      shotNoise(t, 0.08, 350, 1.5, 0.6); tone(t, 'sawtooth', 140, 55, 0.005, 0.18, 0.45);
    },
    flesh() { if (!ctx || muted) return; shotNoise(now(), 0.09, 420, 1.1, 0.5); },
    bone() { if (!ctx || muted) return; const t = now(); tone(t, 'square', 2200, 1400, 0.001, 0.03, 0.14); shotNoise(t, 0.05, 1500, 3, 0.2); },
    impact() { if (!ctx || muted) return; shotNoise(now(), 0.06, 2000 + rand(-400, 800), 2, 0.16); },
    bodyfall() { if (!ctx || muted) return; const t = now(); shotNoise(t, 0.12, 240, 0.9, 0.4); tone(t, 'sine', 90, 40, 0.004, 0.14, 0.3); },
    heartbeat() {
      if (!ctx || muted) return; const t = now();
      tone(t, 'sine', 62, 40, 0.008, 0.13, 0.5); tone(t + 0.24, 'sine', 55, 36, 0.008, 0.11, 0.38);
    },
    ui() { if (!ctx || muted) return; tone(now(), 'sine', 720, 520, 0.004, 0.07, 0.1); },
    waveHorn() {
      if (!ctx || muted) return; const t = now();
      tone(t, 'sawtooth', 95, 88, 0.06, 1.5, 0.24); tone(t + 0.03, 'sawtooth', 142, 130, 0.06, 1.4, 0.15);
    },
    wind() {
      if (!ctx || muted) return; const t = now();
      const s = ctx.createBufferSource(); s.buffer = noiseBuf(2.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340;
      const g = ctx.createGain(); env(g, t, 0.9, 0.028, 1.3);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 2.3);
    },
  };
})();

/* ------------------------------ geometry cache --------------------------- */
const SharedGeo = {
  cache: {},
  _s(g) { g.userData.shared = true; return g; },
  box(w, h, d) { const k = `b${w},${h},${d}`; return this.cache[k] || (this.cache[k] = this._s(new THREE.BoxGeometry(w, h, d))); },
  plane(w, h) { const k = `p${w},${h}`; return this.cache[k] || (this.cache[k] = this._s(new THREE.PlaneGeometry(w, h))); },
  cyl(rt, rb, h, s) { const k = `c${rt},${rb},${h},${s}`; return this.cache[k] || (this.cache[k] = this._s(new THREE.CylinderGeometry(rt, rb, h, s))); },
  cone(r, h, s) { const k = `k${r},${h},${s}`; return this.cache[k] || (this.cache[k] = this._s(new THREE.ConeGeometry(r, h, s))); },
  sph(r) { const k = `s${r}`; return this.cache[k] || (this.cache[k] = this._s(new THREE.SphereGeometry(r, 10, 8))); },
  torus(r, t, rs, ts, arc) { const k = `t${r},${t},${arc}`; return this.cache[k] || (this.cache[k] = this._s(new THREE.TorusGeometry(r, t, rs, ts, arc))); },
};

/* ------------------------------ game state ------------------------------- */
const MAG = 30;
const game = {
  state: 'title', level: 0, waveTotal: 10, spawned: 0, kills: 0, killsHs: 0,
  shotsFired: 0, shotsHit: 0, levelLog: [], deathCause: '',
  cylinder: MAG, reserve: 22, reloading: 0,
  stam: 100, stamHeat: 0, winded: false,
};
let zombies = [];
const Fires = [];
let CaneField = null, River = null, waterY = -900;
let worldGroup = null, blockers = [];

/* ------------------------------ input ------------------------------------ */
const keys = {};
const mouse = { down: false, rmb: false, dx: 0, dy: 0 };
let sens = 1.0, bobOn = true, flashLightOn = true, baseFov = 75;

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'KeyM') AudioSys.toggleMute();
  if (e.code === 'Escape' && game.state === 'playing') pauseGame();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
canvasEl.addEventListener('mousedown', e => {
  if (game.state !== 'playing') return;
  if (document.pointerLockElement !== canvasEl) { lockPointer(); return; }
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) mouse.rmb = true;
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rmb = false; });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvasEl && game.state === 'playing') {
    mouse.dx += e.movementX * 0.0021 * sens;
    mouse.dy += e.movementY * 0.0021 * sens;
  }
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvasEl && game.state === 'playing') pauseGame();
});
function lockPointer() { try { canvasEl.requestPointerLock(); } catch (_) {} }
window.addEventListener('resize', () => {
  camera.aspect = W() / H(); camera.updateProjectionMatrix();
  vmCamera.aspect = camera.aspect; vmCamera.updateProjectionMatrix();
  renderer.setSize(W(), H());
});

/* ------------------------------ player ----------------------------------- */
const EYE = 1.62, EYE_CROUCH = 0.95;
const GRAV = 22, JUMP_V = 7.2;
const WALK = 5.0, SPRINT = 8.4, CROUCH_SPD = 2.6, ACC_GROUND = 55, ACC_AIR = 12, FRICTION = 10;
const player = {
  pos: new THREE.Vector3(0, 0, 48), vel: new THREE.Vector3(),
  yaw: Math.PI, pitch: 0, crouch: 0, onGround: true,
  hp: 100, dead: false, regenT: 0,
  bobT: 0, bobA: 0, stepAcc: 0, lastSurf: 'stone', noiseLoud: false, windedS: false,
};

function playerUpdate(dt) {
  // look
  player.yaw -= mouse.dx; player.pitch = clamp(player.pitch - mouse.dy, -1.45, 1.45);
  mouse.dx = 0; mouse.dy = 0;

  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const wish = new THREE.Vector3();
  if (keys['KeyW'] || keys['ArrowUp']) wish.add(fwd);
  if (keys['KeyS'] || keys['ArrowDown']) wish.sub(fwd);
  if (keys['KeyD'] || keys['ArrowRight']) wish.add(right);
  if (keys['KeyA'] || keys['ArrowLeft']) wish.sub(right);
  const moving = wish.lengthSq() > 0;
  if (moving) wish.normalize();

  const wantCrouch = keys['KeyC'] || keys['ControlLeft'] || keys['ControlRight'];
  player.crouch = damp(player.crouch, wantCrouch ? 1 : 0, 12, dt);
  const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && moving && !wantCrouch && !player.windedS && game.stam > 1;
  const maxSpd = wantCrouch ? CROUCH_SPD : sprinting ? SPRINT : WALK;

  if (moving) {
    player.vel.x += wish.x * (player.onGround ? ACC_GROUND : ACC_AIR) * dt;
    player.vel.z += wish.z * (player.onGround ? ACC_GROUND : ACC_AIR) * dt;
  } else if (player.onGround) {
    const f = Math.max(0, 1 - FRICTION * dt);
    player.vel.x *= f; player.vel.z *= f;
    if (Math.abs(player.vel.x) < 0.02) player.vel.x = 0;
    if (Math.abs(player.vel.z) < 0.02) player.vel.z = 0;
  }
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (hv > maxSpd) { const s = maxSpd / hv; player.vel.x *= s; player.vel.z *= s; }

  if (keys['Space'] && player.onGround && !wantCrouch) { player.vel.y = JUMP_V; player.onGround = false; }
  player.vel.y -= GRAV * dt;

  const half = 0.42;
  const nx = player.pos.x + player.vel.x * dt;
  if (!hitWorld(nx, player.pos.z, half)) player.pos.x = nx; else player.vel.x = 0;
  const nz = player.pos.z + player.vel.z * dt;
  if (!hitWorld(player.pos.x, nz, half)) player.pos.z = nz; else player.vel.z = 0;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) { player.pos.y = 0; player.vel.y = 0; player.onGround = true; }

  // stamina (sprint)
  if (sprinting && hv > 1) game.stam = Math.max(0, game.stam - 10 * dt);
  else game.stam = Math.min(100, game.stam + 15 * dt);
  if (game.stam <= 0.5) player.windedS = true;
  if (player.windedS && game.stam > 28) player.windedS = false;
  player.noiseLoud = sprinting || hv > 6.4;

  // head bob + footsteps
  const speed2d = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && speed2d > 0.5) {
    player.bobT += dt * (wantCrouch ? 6.5 : sprinting ? 11.5 : 8.8) * (speed2d / WALK);
    player.bobA = damp(player.bobA, 1, 8, dt);
    player.stepAcc += speed2d * dt;
    const stride = sprinting ? 2.9 : wantCrouch ? 1.7 : 2.2;
    if (player.stepAcc > stride) { player.stepAcc = 0; AudioSys.footstep(player.lastSurf); }
  } else player.bobA = damp(player.bobA, 0, 8, dt);
  if (River && player.pos.x > 10) player.lastSurf = 'water';

  const bobX = Math.cos(player.bobT) * 0.034 * player.bobA * (bobOn ? 1 : 0);
  const bobY = Math.abs(Math.sin(player.bobT)) * 0.048 * player.bobA * (bobOn ? 1 : 0);
  const eyeY = lerp(EYE, EYE_CROUCH, player.crouch) + bobY + player.pos.y;
  camera.position.set(player.pos.x + bobX * 0.35, eyeY, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch + wpn.pitchKick;
  camera.rotation.z = bobX * 0.15;

  // slow regen after 6s unharmed
  player.regenT += dt;
  if (player.regenT > 6 && player.hp < 100 && !player.dead) player.hp = Math.min(100, player.hp + 3.0 * dt);
  return { speed2d, sprinting };
}
function hitWorld(x, z, half) {
  for (const b of blockers)
    if (x > b.minX - half && x < b.maxX + half && z > b.minZ - half && z < b.maxZ + half) return true;
  return false;
}

/* --------------------------- AK-47 viewmodel ----------------------------- */
const gunParts = {};
function buildAK() {
  const metal = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.42, metalness: 0.82 });
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x191b1f, roughness: 0.5, metalness: 0.75 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5e3a1e, roughness: 0.62, metalness: 0.08 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a2d16, roughness: 0.68 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a5f45, roughness: 0.85 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2c2f26, roughness: 1 });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };
  add(SharedGeo.box(0.34, 0.075, 0.075), metal, 0, 0, 0);                       // receiver
  add(SharedGeo.box(0.30, 0.03, 0.062), metalDark, -0.01, 0.052, 0);            // dust cover
  add(SharedGeo.cyl(0.014, 0.014, 0.34, 10), metalDark, 0.30, 0.012, 0, 0, 0, Math.PI / 2); // barrel
  add(SharedGeo.cyl(0.02, 0.02, 0.06, 10), metal, 0.20, 0.035, 0, 0, 0, Math.PI / 2);       // gas block
  add(SharedGeo.box(0.05, 0.05, 0.045), metal, 0.40, 0.012, 0);                 // muzzle brake
  add(SharedGeo.box(0.055, 0.03, 0.035), metal, 0.245, 0.052, 0);               // gas tube
  add(SharedGeo.box(0.20, 0.052, 0.058), wood, 0.245, -0.012, 0);               // handguard
  add(SharedGeo.box(0.24, 0.055, 0.05), woodDark, -0.27, -0.045, 0, 0, 0, 0.10);// stock
  add(SharedGeo.box(0.045, 0.11, 0.05), woodDark, -0.06, -0.085, 0, 0.32);      // grip
  const mag1 = add(SharedGeo.box(0.05, 0.13, 0.075), metalDark, 0.03, -0.115, 0, 0.38);
  const mag2 = add(SharedGeo.box(0.05, 0.11, 0.07), metalDark, 0.075, -0.20, 0, 0.62);
  add(SharedGeo.box(0.016, 0.045, 0.02), metal, 0.435, 0.05, 0);                // front sight
  add(SharedGeo.box(0.02, 0.03, 0.02), metal, -0.10, 0.075, 0);                 // rear sight
  add(SharedGeo.box(0.03, 0.014, 0.05), metal, -0.02, 0.03, 0.05);              // charging handle
  // hands
  const rhF = add(SharedGeo.box(0.055, 0.13, 0.06), skin, -0.075, -0.07, 0, 0.3);
  const rhS = add(SharedGeo.box(0.07, 0.17, 0.075), sleeve, -0.105, -0.19, 0.01, 0.5);
  const lhF = add(SharedGeo.box(0.06, 0.06, 0.075), skin, 0.24, -0.06, 0.01);
  const lhS = add(SharedGeo.box(0.075, 0.07, 0.20), sleeve, 0.14, -0.13, -0.09, 0.7, 0, 0.5);
  // muzzle flash + lights
  const flash = new THREE.Mesh(SharedGeo.cone(0.05, 0.16, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.rotation.z = -Math.PI / 2; flash.position.set(0.50, 0.012, 0); g.add(flash);
  const worldFlash = new THREE.PointLight(0xffb45e, 0, 10, 2); worldFlash.position.set(0.5, 0.1, 0); g.add(worldFlash);
  gunParts.group = g; gunParts.flash = flash; gunParts.worldFlash = worldFlash;
  gunParts.mag = [mag1, mag2]; gunParts.rh = [rhF, rhS]; gunParts.lh = [lhF, lhS];
  vmScene.add(g);
  return g;
}
buildAK();

const wpn = {
  rpm: 600, dmgBody: 34, dmgHead: 130, dmgLimb: 20, range: 90,
  bloomBase: 0.0035, bloomMax: 0.05, bloom: 0,
  kick: 0, kickV: 0, pitchKick: 0, adsT: 0, fireT: 0,
  hipPos: new THREE.Vector3(0.26, -0.25, -0.5), adsPos: new THREE.Vector3(0, -0.166, -0.34),
  swayX: 0, swayY: 0, reloadDip: 0,
};
let recoilYawVel = 0;

function tryReload() {
  if (game.state !== 'playing') return;
  if (game.reloading > 0 || game.cylinder >= MAG || game.reserve <= 0) return;
  game.reloading = 2.1;
  AudioSys.akReload();
}
function autoReloadIfNeeded() {
  if (game.cylinder <= 0 && game.reloading <= 0 && game.reserve > 0) tryReload();
}
function finishReload() {
  const take = Math.min(MAG - game.cylinder, game.reserve);
  game.cylinder += take; game.reserve -= take;
  wpn.bloom = 0;
}

const ray = new THREE.Raycaster();
function shoot() {
  if (game.reloading > 0 || game.cylinder <= 0 || game.stam < 2) {
    if (game.cylinder <= 0 && game.reloading <= 0) { AudioSys.dryClick(); autoReloadIfNeeded(); }
    return;
  }
  game.cylinder--; game.shotsFired++;
  AudioSys.akShot();
  game.stamHeat = Math.min(1, game.stamHeat + 0.16);
  game.stam = Math.max(0, game.stam - (2 + game.stamHeat * 4.4));
  if (game.stam <= 0.5) game.winded = true;

  const adsF = lerp(1, 0.32, wpn.adsT);
  const moveF = 1 + Math.hypot(player.vel.x, player.vel.z) * 0.12;
  const spread = (wpn.bloomBase + wpn.bloom) * adsF * moveF;
  wpn.bloom = Math.min(wpn.bloomMax, wpn.bloom + 0.0042);

  const dir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  dir.x += rand(-spread, spread); dir.y += rand(-spread, spread);
  dir.normalize();
  const hit = castBullet(camera.position, dir, wpn.range);

  wpn.kickV = Math.min(wpn.kickV + 2.6, 5.2);
  wpn.pitchKick += 0.011 + rand(0, 0.004);
  recoilYawVel += rand(-0.0035, 0.0035);
  gunParts.flash.material.opacity = 0.95;
  gunParts.flash.rotation.z = -Math.PI / 2 + rand(-0.2, 0.2);
  gunParts.flash.scale.setScalar(rand(0.8, 1.3));
  if (flashLightOn) { gunParts.worldFlash.intensity = 7; vmFlashLight.intensity = 5; }

  ejectCasing();
  if (hit) applyBulletHit(hit);
  UI.xhSpread();
}

function castBullet(origin, dir, range) {
  ray.set(origin, dir); ray.far = range;
  const zHits = [];
  for (const z of zombies) {
    if (z.dead) continue;
    if (z.group.position.distanceToSquared(origin) > (range + 2) * (range + 2)) continue;
    for (const [mesh, zone] of z.parts) {
      const hm = ray.intersectObject(mesh, false);
      if (hm.length) zHits.push({ z, zone, dist: hm[0].distance, point: hm[0].point });
    }
  }
  // world: slab test against blocker AABBs (with height — bullets clear low cover)
  let worldDist = range, worldPoint = null;
  const invX = 1 / dir.x, invY = 1 / dir.y, invZ = 1 / dir.z;
  for (const b of blockers) {
    let tmin = 0, tmax = worldDist, ok = true;
    const mins = [b.minX, -0.5, b.minZ], maxs = [b.maxX, b.h || 3, b.maxZ];
    const o = [origin.x, origin.y, origin.z], inv = [invX, invY, invZ];
    for (let a = 0; a < 3; a++) {
      let t1 = (mins[a] - o[a]) * inv[a], t2 = (maxs[a] - o[a]) * inv[a];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) { ok = false; break; }
    }
    if (ok && tmin > 0 && tmin < worldDist) { worldDist = tmin; worldPoint = origin.clone().addScaledVector(dir, tmin); }
  }
  if (dir.y < -0.001) {
    const tg = -origin.y / dir.y;
    if (tg > 0 && tg < worldDist) { worldDist = tg; worldPoint = origin.clone().addScaledVector(dir, tg); }
  }
  let best = null;
  for (const h of zHits) if (h.dist < worldDist && (!best || h.dist < best.dist)) best = h;
  if (best) return { type: 'zombie', ...best };
  if (worldPoint) return { type: 'world', dist: worldDist, point: worldPoint };
  return null;
}

function applyBulletHit(hit) {
  game.shotsHit++;
  if (hit.type === 'zombie') {
    const z = hit.z;
    let dmg = hit.zone === 'head' ? wpn.dmgHead : hit.zone === 'limb' ? wpn.dmgLimb : wpn.dmgBody;
    dmg *= clamp(1 - hit.dist / wpn.range * 0.35, 0.65, 1);
    z.hp -= dmg;
    z.alert = true; z.alertT = 8;
    bloodBurst(hit.point, hit.point.clone().sub(camera.position).normalize());
    if (hit.zone === 'head') AudioSys.bone(); else AudioSys.flesh();
    if (z.hp <= 0) killZombie(z, hit.zone, hit.point);
    else {
      z.staggerT = Math.min(0.5, 0.18 + dmg * 0.004); z.hitFlash = 1;
      UI.hitmark(hit.zone === 'head'); UI.xhHit(hit.zone === 'head' ? 'crit' : 'hit');
    }
  } else { impactFX(hit.point); AudioSys.impact(); }
}

function killZombie(z, zone, point) {
  z.dead = true; z.deadT = 0;
  game.kills++; if (zone === 'head') game.killsHs++;
  AudioSys.bodyfall();
  if (zone === 'head') { z.headGone = true; bloodBurst(point, point.clone().sub(camera.position).normalize(), 1.6); }
  UI.killfeed(zone === 'head', z.runner);
  UI.xhHit('kill');
  for (const o of zombies)
    if (o !== z && !o.dead && o.group.position.distanceTo(z.group.position) < 14) { o.alert = true; o.alertT = 6; }
  checkWaveProgress();
}

/* ------------------------------ zombies ---------------------------------- */
const Z_KINDS = [
  { name: 'walker', spd: [1.1, 1.7], hp: 100, scale: [0.95, 1.06], dmg: 11, color: 0x9aa08e, cloth: 0x3a3a42, groanT: [4, 9] },
  { name: 'walker', spd: [1.0, 1.6], hp: 110, scale: [0.98, 1.1], dmg: 12, color: 0x8e9a8a, cloth: 0x4a3a30, groanT: [4, 9] },
  { name: 'runner', spd: [3.4, 4.3], hp: 70, scale: [0.9, 1.0], dmg: 9, color: 0xa89a80, cloth: 0x2c3440, groanT: [3, 7] },
  { name: 'brute', spd: [0.8, 1.2], hp: 260, scale: [1.16, 1.3], dmg: 24, color: 0x7a8578, cloth: 0x33261e, groanT: [5, 10] },
];
function kindForLevel(lvl, i) {
  if (lvl === 0) return i < 8 ? Z_KINDS[0] : Z_KINDS[1];
  if (lvl === 1) return i < 9 ? Z_KINDS[randi(0, 1)] : (i % 3 === 0 ? Z_KINDS[2] : Z_KINDS[1]);
  if (lvl === 2) return i % 4 === 0 ? Z_KINDS[2] : (i % 9 === 8 ? Z_KINDS[3] : Z_KINDS[randi(0, 1)]);
  return i % 3 === 0 ? Z_KINDS[2] : (i % 7 === 6 ? Z_KINDS[3] : Z_KINDS[randi(0, 1)]);
}

function makeZombie(kind, x, z) {
  const s = rand(kind.scale[0], kind.scale[1]);
  const g = new THREE.Group();
  const skinC = new THREE.Color(kind.color).offsetHSL(rand(-0.02, 0.02), rand(-0.08, 0.02), rand(-0.08, 0.05));
  const skin = new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: kind.cloth, roughness: 1 });
  const cloth2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(kind.cloth).offsetHSL(0, 0, rand(-0.05, 0.05)), roughness: 1 });
  const parts = [];
  const addPart = (geo, mat, x2, y2, z2, zone, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x2, y2, z2); m.rotation.set(rx, ry, rz);
    m.castShadow = true; g.add(m); if (zone) parts.push([m, zone]); return m;
  };
  const torso = addPart(SharedGeo.box(0.46, 0.62, 0.26), skin, 0, 1.24, 0, 'body');
  const ribM = new THREE.MeshStandardMaterial({ color: 0x5e5a50, roughness: 1 });
  for (let i = 0; i < 3; i++) addPart(SharedGeo.box(0.34, 0.035, 0.27), ribM, 0, 1.36 - i * 0.09, 0, null);
  addPart(SharedGeo.box(0.475, 0.28, 0.272), cloth, 0, 0.98, 0, 'body');
  addPart(SharedGeo.box(0.2, 0.34, 0.275), cloth2, -0.12, 1.3, 0, 'body');
  addPart(SharedGeo.box(0.4, 0.22, 0.26), cloth, 0, 0.86, 0, 'body');
  const head = addPart(SharedGeo.box(0.21, 0.26, 0.22), skin, 0, 1.72, 0, 'head');
  addPart(SharedGeo.box(0.16, 0.09, 0.18), skin, 0, 1.565, 0.02, 'head');
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.4 });
  const glintM = new THREE.MeshBasicMaterial({ color: 0xd8e6ff });
  [[-0.05], [0.05]].forEach(([ex]) => {
    const e = new THREE.Mesh(SharedGeo.sph(0.021), eyeM); e.position.set(ex, 1.75, 0.115); g.add(e);
    const gl = new THREE.Mesh(SharedGeo.sph(0.006), glintM); gl.position.set(ex, 1.754, 0.131); g.add(gl);
  });
  addPart(SharedGeo.box(0.19, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 1 }), 0, 1.865, -0.01, 'head');
  const armL = addPart(SharedGeo.box(0.13, 0.52, 0.13), skin, -0.33, 1.28, 0.06, 'limb', 0, 0, 0.5);
  const armR = addPart(SharedGeo.box(0.13, 0.52, 0.13), skin, 0.33, 1.28, 0.06, 'limb', 0, 0, -0.5);
  const foreL = addPart(SharedGeo.box(0.11, 0.44, 0.11), skin, -0.47, 1.02, 0.14, 'limb', 0, 0, 0.32);
  const foreR = addPart(SharedGeo.box(0.11, 0.44, 0.11), skin, 0.47, 1.02, 0.14, 'limb', 0, 0, -0.32);
  addPart(SharedGeo.box(0.09, 0.14, 0.05), skin, -0.55, 0.80, 0.19, 'limb', 0.4, 0, 0.25);
  addPart(SharedGeo.box(0.09, 0.14, 0.05), skin, 0.55, 0.80, 0.19, 'limb', 0.4, 0, -0.25);
  const legL = addPart(SharedGeo.box(0.16, 0.52, 0.17), cloth2, -0.12, 0.52, 0, 'limb');
  const legR = addPart(SharedGeo.box(0.16, 0.52, 0.17), cloth2, 0.12, 0.52, 0, 'limb');
  const shinL = addPart(SharedGeo.box(0.14, 0.3, 0.15), cloth2, -0.12, 0.15, 0, 'limb');
  const shinR = addPart(SharedGeo.box(0.14, 0.3, 0.15), cloth2, 0.12, 0.15, 0, 'limb');
  addPart(SharedGeo.box(0.13, 0.07, 0.26), skin, -0.12, 0.035, 0.05, 'limb');
  addPart(SharedGeo.box(0.13, 0.07, 0.26), skin, 0.12, 0.035, 0.05, 'limb');
  const woundM = new THREE.MeshStandardMaterial({ color: 0x4a1410, roughness: 0.6 });
  addPart(SharedGeo.box(0.1, 0.14, 0.015), woundM, rand(-0.12, 0.12), 1.3, 0.135, null);
  addPart(SharedGeo.box(0.07, 0.1, 0.015), woundM, rand(-0.14, 0.14), 1.1, 0.135, null);
  addPart(SharedGeo.box(0.05, 0.06, 0.015), woundM, rand(-0.07, 0.07), 1.74, 0.115, null);

  g.scale.setScalar(s);
  g.position.set(x, 0, z);
  worldGroup.add(g);
  zombies.push({
    kind, group: g, parts, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR, torso,
    hp: kind.hp * (1 + game.level * 0.06), spd: rand(kind.spd[0], kind.spd[1]), dmg: kind.dmg,
    runner: kind.name === 'runner', brute: kind.name === 'brute',
    state: 'wander', alert: false, alertT: 0,
    wanderTarget: new THREE.Vector3(x, 0, z), wanderT: 0,
    atkCd: rand(0, 0.5), staggerT: 0, hitFlash: 0, dead: false, deadT: 0, headGone: false,
    groanT: rand(kind.groanT[0], kind.groanT[1]),
    animT: rand(0, 10), lurchPhase: rand(0, TAU), lurchFreq: rand(0.4, 1.1),
    yaw: rand(0, TAU), attackAnimT: 0,
  });
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function zombieUpdate(z, dt) {
  const g = z.group;
  if (z.dead) {
    z.deadT += dt;
    g.rotation.x = damp(g.rotation.x, -Math.PI / 2 * 0.92, 3.2, dt);
    g.position.y = damp(g.position.y, -0.72 * g.scale.x, 3.2, dt);
    return;
  }
  const toP = _v1.set(player.pos.x - g.position.x, 0, player.pos.z - g.position.z);
  const dist = toP.length();

  // perception
  z.alertT -= dt;
  if (z.alertT <= 0) z.alert = false;
  const seesPlayer = dist < 34;
  const hears = player.noiseLoud && dist < 26;
  if ((seesPlayer || hears || z.alert) && dist > 1.2) {
    if (z.state !== 'chase' && dist < 30 && Math.random() < 0.3) AudioSys.scream(dist);
    z.state = 'chase'; z.alert = true; z.alertT = 5;
  }
  if (z.state === 'chase' && dist > 42) { z.state = 'wander'; z.alert = false; }
  if (z.staggerT > 0) z.staggerT -= dt;

  let mvx = 0, mvz = 0, targetYaw = z.yaw, speed = 0;
  if (z.state === 'wander') {
    z.wanderT -= dt;
    if (z.wanderT <= 0 || g.position.distanceTo(z.wanderTarget) < 1.2) {
      z.wanderT = rand(3, 8);
      z.wanderTarget.set(g.position.x + rand(-14, 14), 0, g.position.z + rand(-14, 14));
    }
    _v2.set(z.wanderTarget.x - g.position.x, 0, z.wanderTarget.z - g.position.z);
    const wd = _v2.length();
    if (wd > 0.5) {
      speed = z.spd * 0.32;
      mvx = _v2.x / wd * speed; mvz = _v2.z / wd * speed;
      targetYaw = Math.atan2(_v2.x, _v2.z);
    }
  } else if (z.state === 'chase') {
    if (dist > 1.55) {
      speed = z.spd * (z.staggerT > 0 ? 0.15 : 1) * (dist < 6 ? 1.12 : 1);
      let dx = toP.x / dist, dz = toP.z / dist;
      if (hitWorld(g.position.x + dx * 1.4, g.position.z + dz * 1.4, 0.5)) {
        const a0 = Math.atan2(dx, dz);
        let found = false;
        for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
          const a = a0 + off;
          if (!hitWorld(g.position.x + Math.sin(a) * 1.4, g.position.z + Math.cos(a) * 1.4, 0.5)) {
            dx = Math.sin(a); dz = Math.cos(a); found = true; break;
          }
        }
        if (!found) { dx = -dx; dz = -dz; }
      }
      mvx = dx * speed; mvz = dz * speed;
      targetYaw = Math.atan2(dx, dz);
    } else {
      z.atkCd -= dt;
      targetYaw = Math.atan2(toP.x, toP.z);
      if (z.atkCd <= 0 && z.staggerT <= 0) {
        z.atkCd = z.runner ? 0.85 : z.brute ? 1.5 : 1.15;
        z.attackAnimT = 0.45;
        if (dist < 2.1 && !player.dead) {
          player.hp -= z.dmg * (1 + game.level * 0.05);
          player.regenT = 0;
          AudioSys.bite(); UI.dmgFlash();
          if (player.hp <= 0 && !player.dead) killPlayer('torn apart in ' + LEVELS[game.level].name.toLowerCase());
        }
      }
    }
  }

  // separation
  for (const o of zombies) {
    if (o === z || o.dead) continue;
    const ddx = g.position.x - o.group.position.x, ddz = g.position.z - o.group.position.z;
    const d2 = ddx * ddx + ddz * ddz;
    if (d2 < 1.2 && d2 > 0.0001) {
      const d = Math.sqrt(d2), push = (1.1 - d) * 2.4;
      mvx += ddx / d * push; mvz += ddz / d * push;
    }
  }
  if (mvx || mvz) {
    const nx = g.position.x + mvx * dt, nz = g.position.z + mvz * dt;
    if (!hitWorld(nx, g.position.z, 0.38)) g.position.x = nx;
    if (!hitWorld(g.position.x, nz, 0.38)) g.position.z = nz;
    const L = LEVELS[game.level].len / 2 - 1.5;
    g.position.x = clamp(g.position.x, -L, L); g.position.z = clamp(g.position.z, -L, L);
  }
  let dyaw = targetYaw - z.yaw;
  while (dyaw > Math.PI) dyaw -= TAU; while (dyaw < -Math.PI) dyaw += TAU;
  z.yaw += dyaw * Math.min(1, dt * 6);
  g.rotation.y = z.yaw;

  // animation
  z.animT += dt * (z.state === 'chase' ? (z.runner ? 11 : 7) * (speed > 0.1 ? 1 : 0.25) : 2.4);
  const t = z.animT;
  const lurch = Math.sin(t * z.lurchFreq * 2 + z.lurchPhase);
  const lurchJerk = lurch > 0.7 ? (lurch - 0.7) * 3 : 0;
  const swing = Math.sin(t), swing2 = Math.sin(t + Math.PI);
  const attacking = z.attackAnimT > 0;
  if (attacking) z.attackAnimT -= dt;

  if (!z.headGone) {
    z.head.rotation.x = 0.22 + Math.sin(t * 0.7) * 0.1;
    z.head.rotation.z = Math.sin(t * 0.45 + z.lurchPhase) * 0.16;
  }
  z.torso.rotation.x = 0.18 + Math.abs(lurch) * 0.1 + (z.runner ? 0.24 : 0);
  const reach = z.state === 'chase' ? 1 : 0.25;
  const aBaseX = lerp(-0.5, -1.15, reach);
  z.armL.rotation.x = damp(z.armL.rotation.x, aBaseX + swing * 0.14, 8, dt);
  z.armR.rotation.x = damp(z.armR.rotation.x, aBaseX + swing2 * 0.14, 8, dt);
  z.foreL.rotation.x = damp(z.foreL.rotation.x, lerp(-0.32, -0.15, reach) + lurchJerk * 0.3, 8, dt);
  z.foreR.rotation.x = damp(z.foreR.rotation.x, lerp(-0.32, -0.15, reach) - lurchJerk * 0.3, 8, dt);
  const legAmp = z.runner ? 0.75 : 0.45;
  z.legL.rotation.x = swing * legAmp * 0.5 - 0.1;
  z.legR.rotation.x = swing2 * legAmp * 0.5 - 0.1;
  z.shinL.rotation.x = Math.max(0, -swing) * legAmp * 0.7;
  z.shinR.rotation.x = Math.max(0, -swing2) * legAmp * 0.7;
  g.position.y = Math.abs(Math.sin(t)) * 0.045 + lurchJerk * 0.02;
  g.rotation.z = Math.sin(t * 0.5 + z.lurchPhase) * 0.06;
  if (attacking) {
    const lunge = Math.sin((1 - z.attackAnimT / 0.45) * Math.PI) * 0.5;
    z.armL.rotation.x = -1.7 + lunge * 0.4; z.armR.rotation.x = -1.7 + lunge * 0.4;
  }
  if (z.hitFlash > 0) {
    z.hitFlash -= dt * 4;
    const f = Math.max(0, z.hitFlash);
    for (const [m] of z.parts) if (m.material.emissive) m.material.emissive.setRGB(f * 0.5, 0, 0);
  }
  z.groanT -= dt;
  if (z.groanT <= 0) {
    z.groanT = rand(z.kind.groanT[0], z.kind.groanT[1]);
    if (dist < 30) AudioSys.groan(dist);
  }
}

/* ------------------------------- VFX -------------------------------------- */
const effects = [], casings = [], casPool = [], decals = [];
function spawnFx(mesh, dur, update) { effects.push({ mesh, t: 0, dur, update }); }
function bloodBurst(p, dir, scale = 1) {
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(SharedGeo.sph(0.05), new THREE.MeshBasicMaterial({ color: 0x8a0f14, transparent: true }));
    m.position.copy(p); m.scale.setScalar(rand(0.5, 1.4));
    worldGroup.add(m);
    const v = dir.clone().multiplyScalar(rand(2, 5)).add(new THREE.Vector3(rand(-1.6, 1.6), rand(0.5, 3), rand(-1.6, 1.6)));
    spawnFx(m, rand(0.25, 0.5), (fx, dt) => {
      v.y -= 12 * dt; m.position.addScaledVector(v, dt);
      m.material.opacity = 1 - fx.t / fx.dur;
    });
  }
  if (decals.length > 60) { const old = decals.shift(); worldGroup.remove(old); }
  const d = new THREE.Mesh(SharedGeo.plane(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x3d0a0c, transparent: true, opacity: 0.85, depthWrite: false }));
  d.rotation.set(-Math.PI / 2, 0, rand(0, TAU));
  d.scale.setScalar(rand(0.7, 1.5) * scale);
  d.position.set(p.x + rand(-0.4, 0.4), 0.015 + Math.random() * 0.004, p.z + rand(-0.4, 0.4));
  worldGroup.add(d); decals.push(d);
}
function impactFX(p) {
  const m = new THREE.Mesh(SharedGeo.sph(0.06), new THREE.MeshBasicMaterial({ color: 0xbcb2a4, transparent: true, opacity: 0.9 }));
  m.position.copy(p); worldGroup.add(m);
  spawnFx(m, 0.3, (fx, dt) => { m.scale.multiplyScalar(1 + dt * 9); m.material.opacity = 0.9 * (1 - fx.t / fx.dur); });
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(SharedGeo.sph(0.02), new THREE.MeshBasicMaterial({ color: 0xffcf8a }));
    f.position.copy(p); worldGroup.add(f);
    const v = new THREE.Vector3(rand(-2, 2), rand(1, 3.4), rand(-2, 2));
    spawnFx(f, 0.24, (fx, dt) => { v.y -= 14 * dt; f.position.addScaledVector(v, dt); f.material.opacity = 1 - fx.t / fx.dur; });
  }
}
function ejectCasing() {
  let c = casPool.pop();
  if (!c) c = new THREE.Mesh(SharedGeo.cyl(0.008, 0.008, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.35 }));
  const side = new THREE.Vector3(1, 0.4, 0).applyEuler(camera.rotation);
  c.position.copy(camera.position).addScaledVector(side, 0.4);
  worldGroup.add(c);
  const v = side.multiplyScalar(rand(1.4, 2.2)).add(new THREE.Vector3(rand(-0.3, 0.3), rand(1.4, 2.2), rand(-0.3, 0.3)));
  casings.push({ m: c, v, rv: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), t: 0 });
  AudioSys.casings();
}
function updateCasings(dt) {
  for (let i = casings.length - 1; i >= 0; i--) {
    const c = casings[i];
    c.t += dt; c.v.y -= 12 * dt;
    c.m.position.addScaledVector(c.v, dt);
    c.m.rotation.x += c.rv.x * dt; c.m.rotation.y += c.rv.y * dt;
    if (c.m.position.y < 0.02) {
      c.m.position.y = 0.02; c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6;
      if (Math.abs(c.v.y) < 0.4 || c.t > 5) { worldGroup.remove(c.m); casPool.push(c.m); casings.splice(i, 1); }
    } else if (c.t > 6) { worldGroup.remove(c.m); casPool.push(c.m); casings.splice(i, 1); }
  }
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.t += dt;
    if (fx.update) fx.update(fx, dt);
    if (fx.t >= fx.dur) { worldGroup.remove(fx.mesh); effects.splice(i, 1); }
  }
}

/* ---------------------------- waves / levels ------------------------------ */
let spawnTimer = 0;
function spawnZombie() {
  const kind = kindForLevel(game.level, game.spawned);
  const L = LEVELS[game.level];
  let x, z, tries = 0;
  do {
    const side = randi(0, 2);
    if (side === 0) { x = rand(-L.len / 3, L.len / 3); z = -L.len / 2 + 3; }
    else if (side === 1) { x = -L.len / 2 + 3; z = rand(-L.len / 3, L.len / 3); }
    else { x = rand(-L.len / 3, L.len / 3); z = L.len / 2 - 3; }
    tries++;
  } while (Math.hypot(x - player.pos.x, z - player.pos.z) < 22 && tries < 8);
  makeZombie(kind, x, z);
  game.spawned++;
}
function checkWaveProgress() {
  if (game.waveTotal - game.kills <= 0 && game.state === 'playing') levelCleared();
}
function levelCleared() {
  game.state = 'cleared';
  game.levelLog.push({ lvl: game.level, ok: true, kills: game.kills, hp: Math.round(player.hp), ammo: game.cylinder + game.reserve });
  AudioSys.ui();
  UI.showBanner('THE STREET GOES QUIET', 'level ' + (game.level + 1) + ' cleared — catching breath…');
  setTimeout(() => {
    if (game.state !== 'cleared') return;
    if (game.level >= LEVELS.length - 1) winGame(); else nextLevel();
  }, 2600);
}
function nextLevel() {
  game.level++;
  const budget = [52, 70, 84, 90][game.level];
  const total = game.cylinder + game.reserve;
  if (total < budget) game.reserve += budget - total;
  game.kills = 0; game.spawned = 0;
  player.hp = Math.min(100, player.hp + 25);
  game.stam = 100; game.stamHeat = 0; game.winded = false;
  buildLevel(game.level);
  startWave();
}
function startWave() {
  game.state = 'playing';
  game.waveTotal = LEVELS[game.level].count;
  AudioSys.waveHorn();
  UI.showBanner('LEVEL ' + (game.level + 1) + ' — ' + LEVELS[game.level].name, LEVELS[game.level].sub);
  UI.setLevel(game.level);
  spawnTimer = 0.8;
}
function waveUpdate(dt) {
  if (game.state !== 'playing') return;
  const alive = zombies.filter(z => !z.dead).length;
  const toSpawn = game.waveTotal - game.spawned;
  if (toSpawn > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && alive < 9 + game.level * 3) {
      spawnZombie();
      spawnTimer = Math.max(0.4, rand(0.9, 2.2) - game.level * 0.12);
    }
  }
}

/* ---------------------------- flow control -------------------------------- */
function killPlayer(cause) {
  player.dead = true;
  game.state = 'dead';
  game.deathCause = cause;
  game.levelLog.push({ lvl: game.level, ok: false, kills: game.kills, hp: 0, ammo: game.cylinder + game.reserve });
  document.exitPointerLock && document.exitPointerLock();
  AudioSys.bodyfall();
  UI.showDeath();
}
function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  document.exitPointerLock && document.exitPointerLock();
  document.getElementById('pauseOv').hidden = false;
}
function resumeGame() {
  document.getElementById('pauseOv').hidden = true;
  game.state = 'playing';
  lockPointer();
}
function winGame() {
  game.state = 'won';
  document.exitPointerLock && document.exitPointerLock();
  UI.showWin();
}
function startRun() {
  zombies.forEach(z => worldGroup && worldGroup.remove(z.group)); zombies = [];
  decals.forEach(d => worldGroup && worldGroup.remove(d)); decals.length = 0;
  effects.forEach(fx => worldGroup && worldGroup.remove(fx.mesh)); effects.length = 0;
  casings.forEach(c => worldGroup && worldGroup.remove(c.m)); casings.length = 0;
  game.level = 0; game.kills = 0; game.killsHs = 0;
  game.shotsFired = 0; game.shotsHit = 0; game.levelLog = []; game.deathCause = '';
  game.cylinder = MAG; game.reserve = 22; game.reloading = 0;
  game.stam = 100; game.stamHeat = 0; game.winded = false;
  player.hp = 100; player.dead = false;
  player.pos.set(0, 0, LEVELS[0].len / 2 - 12);
  player.vel.set(0, 0, 0); player.yaw = Math.PI; player.pitch = 0;
  wpn.bloom = 0; wpn.kick = 0; wpn.kickV = 0; wpn.pitchKick = 0; wpn.adsT = 0;
  buildLevel(0);
  startWave();
  document.getElementById('titleOv').hidden = true;
  document.getElementById('deathOv').hidden = true;
  document.getElementById('winOv').hidden = true;
  AudioSys.ensure();
  lockPointer();
}

/* ------------------------------- UI glue ---------------------------------- */
const $ = id => document.getElementById(id);
const UI = {
  setLevel(lvl) {
    $('lvlName').textContent = 'LEVEL ' + (lvl + 1) + ' — ' + LEVELS[lvl].name;
    $('statTotal').textContent = LEVELS[lvl].count;
    document.querySelectorAll('#topline .wave-dot').forEach((d, i) => {
      d.className = 'wave-dot' + (i < lvl ? ' done' : i === lvl ? ' cur' : '');
    });
  },
  hud() {
    $('hpNum').textContent = Math.max(0, Math.round(player.hp));
    const hf = $('hpFill');
    hf.style.width = clamp(player.hp, 0, 100) + '%';
    hf.className = player.hp < 30 ? 'low' : player.hp < 60 ? 'mid' : '';
    $('stamNum').textContent = Math.round(game.stam);
    const sf = $('stamFill');
    sf.style.width = game.stam + '%';
    sf.className = game.stam < 30 ? 'low' : '';
    $('warn').className = (game.stam < 30 && game.state === 'playing') ? 'hud on' : 'hud';

    $('ammoBig').innerHTML = game.cylinder + '<small> / ' + (MAG + game.reserve) + '</small>';
    const mags = Math.ceil(game.reserve / MAG);
    $('reserve').innerHTML = '<b>+' + game.reserve + '</b> RESERVE · ' + mags + (mags === 1 ? ' Mag' : ' Mags');
    const pips = $('magPips');
    if (pips.childElementCount !== 4) pips.innerHTML = '<span class="pip lbl">MAGS</span>' + '<span class="pip"></span>'.repeat(3);
    const magCount = Math.ceil((game.cylinder + game.reserve) / MAG);
    pips.querySelectorAll('.pip:not(.lbl)').forEach((p, i) => { p.className = 'pip' + (i < magCount ? ' on' : ''); });
    const rh = $('reloadHint');
    if (game.reloading > 0) { rh.className = 'busy'; rh.textContent = 'RELOADING…'; }
    else if (game.cylinder === 0) { rh.className = 'on'; rh.textContent = game.reserve > 0 ? 'R — RELOAD' : 'NO AMMO LEFT'; }
    else if (game.cylinder <= 10) { rh.className = 'on'; rh.textContent = 'R — RELOAD'; }
    else rh.className = '';

    $('statKills').textContent = game.kills;
    $('statAlive').textContent = zombies.filter(z => !z.dead).length;
  },
  killfeed(hs, runner) {
    const kf = $('killfeed');
    const d = document.createElement('div');
    d.className = hs ? 'hs' : 'kill';
    d.textContent = (hs ? '☠ HEADSHOT — ' : '✕ dropped ') + (runner ? 'runner' : 'freak');
    kf.prepend(d);
    while (kf.childElementCount > 5) kf.lastChild.remove();
    setTimeout(() => d.remove(), 3800);
  },
  xhHit(kind) {
    const el = $('xhHit');
    el.className = kind;
    clearTimeout(this._xhT);
    this._xhT = setTimeout(() => { el.className = ''; }, kind === 'kill' ? 260 : 130);
  },
  xhSpread() {
    const gap = 4 + wpn.bloom * 260 * lerp(1, 0.4, wpn.adsT);
    $('xhGapT').style.top = (-gap - 7) + 'px';
    $('xhGapB').style.top = gap + 'px';
    $('xhGapL').style.left = (-gap - 7) + 'px';
    $('xhGapR').style.left = gap + 'px';
  },
  hitmark(crit) {
    const h = $('hitmark');
    h.className = crit ? 'crit' : '';
    h.style.opacity = 1;
    h.style.transform = 'translate(-50%,-50%) rotate(45deg) scale(1.25)';
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => { h.style.opacity = 0; h.style.transform = 'translate(-50%,-50%) rotate(45deg) scale(1)'; }, 90);
  },
  dmgFlash() {
    const v = $('dmgVin');
    v.style.transition = 'none';
    v.style.opacity = Math.min(1, 0.45 + (100 - player.hp) / 160);
    requestAnimationFrame(() => { v.style.transition = 'opacity .7s'; v.style.opacity = Math.max(0, (45 - player.hp) / 90); });
  },
  showBanner(main, sub) {
    $('bannerMain').textContent = main;
    $('bannerSub').textContent = sub || '';
    $('banner').className = 'hud on';
    clearTimeout(this._bT);
    this._bT = setTimeout(() => { $('banner').className = 'hud'; }, 3400);
  },
  showDeath() {
    $('deathCause').textContent = game.deathCause || 'the street keeps you.';
    $('dKills').textContent = game.kills;
    $('dHead').textContent = game.killsHs;
    $('dAcc').textContent = game.shotsFired ? Math.round(game.shotsHit / game.shotsFired * 100) + '%' : '—';
    $('dLvl').textContent = game.level + 1;
    $('deathLevels').innerHTML = game.levelLog.map(l =>
      `L${l.lvl + 1} ${LEVELS[l.lvl].name}: ${l.ok ? '<b>cleared</b>' : '<span class="fail">overrun</span>'} — ${l.kills} kills · ${l.hp} hp · ${l.ammo} rds`
    ).join('<br>');
    $('deathOv').hidden = false;
  },
  showWin() {
    $('wKills').textContent = game.levelLog.reduce((s, l) => s + l.kills, 0);
    $('wHead').textContent = game.killsHs;
    $('wAcc').textContent = game.shotsFired ? Math.round(game.shotsHit / game.shotsFired * 100) + '%' : '—';
    $('wHp').textContent = Math.round(player.hp);
    $('winOv').hidden = false;
  },
};

$('startBtn').onclick = startRun;
$('restartBtn').onclick = startRun;
$('againBtn').onclick = startRun;
$('restartBtn2').onclick = startRun;
$('resumeBtn').onclick = resumeGame;
$('sensRange').oninput = e => { sens = e.target.value / 100; $('sensVal').textContent = sens.toFixed(1); };
$('fovRange').oninput = e => { baseFov = +e.target.value; camera.fov = baseFov; camera.updateProjectionMatrix(); $('fovVal').textContent = baseFov; };
$('volRange').oninput = e => { AudioSys.setVolume(e.target.value / 100); $('volVal').textContent = e.target.value + '%'; };
$('bobTgl').onchange = e => bobOn = e.target.checked;
$('flashTgl').onchange = e => flashLightOn = e.target.checked;
$('gearBtn').onclick = () => { const p = $('gearPanel'); p.hidden = !p.hidden; };

/* ------------------------------- rain ------------------------------------- */
let rainPts = null; const rainVel = [];
(function buildRain() {
  const N = 900;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-40, 40); pos[i * 3 + 1] = rand(0, 22); pos[i * 3 + 2] = rand(-40, 40);
    rainVel.push(rand(16, 22));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8fa3c8, size: 0.055, transparent: true, opacity: 0.5 }));
  scene.add(rainPts);
})();
function updateRain(dt) {
  const p = rainPts.geometry.attributes.position.array;
  const cx = camera.position.x, cz = camera.position.z;
  for (let i = 0; i < rainVel.length; i++) {
    p[i * 3 + 1] -= rainVel[i] * dt;
    if (p[i * 3 + 1] < 0) { p[i * 3] = cx + rand(-30, 30); p[i * 3 + 1] = rand(16, 22); p[i * 3 + 2] = cz + rand(-30, 30); }
  }
  rainPts.geometry.attributes.position.needsUpdate = true;
}

/* --------------------------- viewmodel anim ------------------------------- */
let swayMX = 0, swayMY = 0;
function updateViewmodel(dt) {
  // sway target from recent look delta
  swayMX = damp(swayMX, clamp(mouse.dxAcc || 0, -1, 1), 8, dt);
  swayMY = damp(swayMY, clamp(mouse.dyAcc || 0, -1, 1), 8, dt);
  // spring recoil
  wpn.kickV -= wpn.kick * 42 * dt; wpn.kickV *= Math.max(0, 1 - 9 * dt); wpn.kick += wpn.kickV * dt;
  wpn.pitchKick = damp(wpn.pitchKick, 0, 7, dt);
  recoilYawVel *= Math.max(0, 1 - 7 * dt);
  player.yaw += recoilYawVel; // tiny horizontal recoil drift

  // reload dip
  const targetDip = game.reloading > 0 ? 1 : 0;
  wpn.reloadDip = damp(wpn.reloadDip, targetDip, 8, dt);

  // ADS pose blend
  const hip = wpn.hipPos, ads = wpn.adsPos;
  const px = lerp(hip.x, ads.x, wpn.adsT), py = lerp(hip.y, ads.y, wpn.adsT), pz = lerp(hip.z, ads.z, wpn.adsT);
  const bobAmt = (1 - wpn.adsT * 0.85) * player.bobA;
  const bx = Math.cos(player.bobT) * 0.012 * bobAmt;
  const by = Math.abs(Math.sin(player.bobT)) * 0.014 * bobAmt;
  const idle = Math.sin(performance.now() / 1000 * 1.4) * 0.0022 * (1 - wpn.adsT);

  const g = gunParts.group;
  g.position.set(
    px + bx - swayMX * 0.012 + idle,
    py + by - swayMY * 0.010 - wpn.reloadDip * 0.22 + idle * 0.6,
    pz + wpn.kick * 0.045
  );
  g.rotation.set(
    -swayMY * 0.05 + wpn.kick * 0.06 + wpn.reloadDip * 0.5,
    -swayMX * 0.06 + wpn.reloadDip * 0.3,
    swayMX * 0.03 + wpn.reloadDip * 0.35
  );
  // magazine visibility during reload (dropped mag feel)
  const magOut = wpn.reloadDip > 0.4;
  gunParts.mag.forEach(m => { m.visible = !magOut; });

  // world muzzle flash light follows camera
  gunParts.worldFlash.position.set(camera.position.x, camera.position.y - 0.1, camera.position.z).addScaledVector(new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation), 0.7);
  if (gunParts.worldFlash.intensity > 0) gunParts.worldFlash.intensity = Math.max(0, gunParts.worldFlash.intensity - dt * 160);
  if (vmFlashLight.intensity > 0) vmFlashLight.intensity = Math.max(0, vmFlashLight.intensity - dt * 130);
  if (gunParts.flash.material.opacity > 0) gunParts.flash.material.opacity = Math.max(0, gunParts.flash.material.opacity - dt * 14);
}

/* --------------------------- level construction --------------------------- */
function makeCanvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const groundTex = {};
function asphaltTexture(base, crack) {
  return makeCanvas(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(${randi(0, 40)},${randi(0, 38)},${randi(0, 34)},${rand(0.04, 0.16)})`; g.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 3)); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(200,195,185,${rand(0.015, 0.06)})`; g.fillRect(rand(0, 256), rand(0, 256), rand(1, 2), rand(1, 2)); }
    for (let i = 0; i < crack; i++) {
      g.strokeStyle = `rgba(8,8,10,${rand(0.25, 0.55)})`; g.lineWidth = rand(0.5, 1.6); g.beginPath();
      let x = rand(0, 256), y = rand(0, 256); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += rand(-26, 26); y += rand(-26, 26); g.lineTo(x, y); } g.stroke();
    }
  });
}
function brickTexture() {
  return makeCanvas(256, 256, (g) => {
    g.fillStyle = '#17120e'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) {
      const off = (y / 16) % 2 ? 16 : 0;
      for (let x = -16; x < 256; x += 32) {
        const v = randi(0, 26);
        g.fillStyle = `rgb(${34 + v},${24 + v * 0.7 | 0},${17 + v * 0.5 | 0})`;
        g.fillRect(x + off + 1, y + 1, 30, 14);
        if (Math.random() < 0.2) { g.fillStyle = 'rgba(10,8,6,.5)'; g.fillRect(x + off + rand(2, 20), y + rand(2, 8), rand(3, 9), rand(2, 6)); }
      }
    }
  });
}
function concreteTexture() {
  return makeCanvas(256, 256, (g) => {
    g.fillStyle = '#1d1d21'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) { const v = randi(18, 42); g.fillStyle = `rgba(${v},${v},${v + 3},${rand(0.2, 0.5)})`; g.fillRect(rand(0, 256), rand(0, 256), rand(1, 4), rand(1, 4)); }
    for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(5,5,8,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(rand(0, 256), rand(0, 256)); g.lineTo(rand(0, 256), rand(0, 256)); g.stroke(); }
  });
}
function windowTexture() {
  return makeCanvas(128, 256, (g) => {
    g.fillStyle = '#0a0a0e'; g.fillRect(0, 0, 128, 256);
    for (let y = 10; y < 250; y += 22) for (let x = 8; x < 120; x += 20) {
      if (Math.random() < 0.14) { g.fillStyle = `rgba(255,${randi(150, 200)},80,${rand(0.35, 0.9)})`; g.fillRect(x, y, 9, 12); }
      else { g.fillStyle = `rgba(${randi(14, 26)},${randi(14, 26)},${randi(18, 30)},1)`; g.fillRect(x, y, 9, 12); }
    }
  });
}

const LEVELS = [
  { name: 'SLUM STREET', sub: 'they are learning you', count: 10, len: 130, ground: 'asphalt',
    sky: [0x05060c, 0x14101f], fogC: 0x0a0912, fogD: 0.016, ambient: 0x3a3652, moonI: 0.5, hemiI: 0.34, exposure: 1.1,
    lampposts: [[-14, -18], [16, 6]], fires: [], lamps: [] },
  { name: 'VILLAGE ROAD', sub: 'the cane moves', count: 16, len: 130, ground: 'dirt',
    sky: [0x060a08, 0x101a10], fogC: 0x0a100b, fogD: 0.018, ambient: 0x3d4a3a, moonI: 0.44, hemiI: 0.3, exposure: 1.06,
    lampposts: [[0, -2]], fires: [[9, -14]], lamps: [] },
  { name: 'OLD MARKET', sub: 'echoes between shutters', count: 24, len: 130, ground: 'stone',
    sky: [0x080710, 0x1a1220], fogC: 0x100b18, fogD: 0.021, ambient: 0x463a58, moonI: 0.42, hemiI: 0.3, exposure: 1.12,
    lampposts: [], fires: [[7, 9]], lamps: [[-9, 3, 0xffc966, 26], [10, -8, 0xffb35c, 20]] },
  { name: 'THE GHATS', sub: 'the river takes everything twice', count: 30, len: 140, ground: 'stone',
    sky: [0x070910, 0x131624], fogC: 0x0b0e18, fogD: 0.014, ambient: 0x40465e, moonI: 0.55, hemiI: 0.36, exposure: 1.18,
    lampposts: [], fires: [], lamps: [] },
];

function clearWorld() {
  if (worldGroup) {
    worldGroup.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    scene.remove(worldGroup);
  }
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  blockers = [];
}
function addBox(w, h, d, x, y, z, mat, solid = true, ry = 0) {
  const m = new THREE.Mesh(SharedGeo.box(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  worldGroup.add(m);
  if (solid) {
    const hw = (Math.abs(Math.cos(ry)) * w + Math.abs(Math.sin(ry)) * d) / 2;
    const hd = (Math.abs(Math.sin(ry)) * w + Math.abs(Math.cos(ry)) * d) / 2;
    blockers.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, h: y + h / 2 });
  }
  return m;
}
function lampGlow(color, intensity, dist, x, y, z, shadow = false) {
  const L = new THREE.PointLight(color, intensity, dist, 1.6);
  L.position.set(x, y, z);
  if (shadow) { L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.bias = -0.004; }
  worldGroup.add(L);
  const bulb = new THREE.Mesh(SharedGeo.sph(0.09), new THREE.MeshBasicMaterial({ color }));
  bulb.position.set(x, y, z); worldGroup.add(bulb);
  return L;
}
function buildingRow(z, len, mat, seedShift) {
  const winTex = windowTexture();
  let x = -len / 2, i = seedShift;
  while (x < len / 2) {
    const w = rand(9, 17), h = rand(9, 26), d = rand(10, 16);
    const m = new THREE.Mesh(SharedGeo.box(1, 1, 1), [
      mat, mat,
      new THREE.MeshStandardMaterial({ map: winTex, color: 0x9a94b8, roughness: 0.95, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.5 }),
      mat, mat, mat
    ]);
    m.scale.set(w, h, d); m.position.set(x + w / 2, h / 2 - 0.5, z + d / 2 * (Math.sign(z) || 1));
    m.castShadow = m.receiveShadow = true;
    worldGroup.add(m);
    blockers.push({ minX: m.position.x - w / 2, maxX: m.position.x + w / 2, minZ: m.position.z - d / 2, maxZ: m.position.z + d / 2, h });
    x += w + rand(0.6, 2.4); i++;
  }
}
function wreckedCar(x, z, ry, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(SharedGeo.box(4.2, 1.0, 1.9), new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 }));
  body.position.y = 0.75; body.castShadow = true;
  const cab = new THREE.Mesh(SharedGeo.box(2.2, 0.75, 1.7), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.4, metalness: 0.5 }));
  cab.position.set(-0.25, 1.55, 0); cab.castShadow = true;
  g.add(body, cab);
  const wg = SharedGeo.cyl(0.38, 0.38, 0.3, 10);
  const wm = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
  [[-1.4, 0.95], [1.4, 0.95], [-1.4, -0.95], [1.4, -0.95]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wg, wm); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w);
  });
  g.position.set(x, 0, z); g.rotation.y = ry;
  worldGroup.add(g);
  blockers.push({ minX: x - 2.4, maxX: x + 2.4, minZ: z - 1.4, maxZ: z + 1.4, h: 1.9 });
}
function deadTree(x, z, s = 1) {
  const g = new THREE.Group();
  const tm = new THREE.MeshStandardMaterial({ color: 0x17110c, roughness: 1 });
  const trunk = new THREE.Mesh(SharedGeo.cyl(0.14 * s, 0.26 * s, 3.4 * s, 7), tm);
  trunk.position.y = 1.7 * s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(SharedGeo.cyl(0.03 * s, 0.09 * s, rand(1.2, 2.2) * s, 5), tm);
    b.position.y = rand(2.2, 3.4) * s;
    b.rotation.set(rand(-1, 1), rand(0, TAU), rand(0.5, 1.2)); b.castShadow = true; g.add(b);
  }
  g.position.set(x, 0, z); worldGroup.add(g);
  blockers.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, h: 3.6 });
}
function fireBarrel(x, z) {
  const b = new THREE.Mesh(SharedGeo.cyl(0.42, 0.42, 1.0, 12), new THREE.MeshStandardMaterial({ color: 0x30241a, roughness: 0.8, metalness: 0.4 }));
  b.position.set(x, 0.5, z); b.castShadow = true; worldGroup.add(b);
  const fl = new THREE.Mesh(SharedGeo.cone(0.4, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xff8c3a, transparent: true, opacity: 0.85 }));
  fl.position.set(x, 1.4, z); worldGroup.add(fl);
  const L = lampGlow(0xff7a2a, 2.4, 14, x, 1.7, z);
  Fires.push({ flame: fl, light: L, x, z, t: rand(0, 9) });
  blockers.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, h: 1.3 });
}
function streetLamp(x, z, bent = false) {
  const pm = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.6, metalness: 0.6 });
  const pole = new THREE.Mesh(SharedGeo.cyl(0.07, 0.1, 5.4, 8), pm);
  pole.position.set(x, 2.7, z); pole.castShadow = true;
  worldGroup.add(pole);
  if (bent) pole.rotation.z = 0.5;
  const hx = x + (bent ? -1.2 : 0.9);
  const arm = new THREE.Mesh(SharedGeo.box(2.0, 0.09, 0.09), pm);
  arm.position.set((x + hx) / 2, 5.3, z); worldGroup.add(arm);
  const sh = new THREE.Mesh(SharedGeo.cone(0.34, 0.3, 8), pm);
  sh.position.set(hx, 5.25, z); worldGroup.add(sh);
  lampGlow(0xffc46b, 2.1, 24, hx, 4.95, z, true);
  blockers.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15, h: 5.6 });
}
function debris(x, z) {
  for (let i = 0; i < randi(3, 7); i++) {
    const s = rand(0.14, 0.55);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * rand(0.3, 0.8), s * rand(0.6, 1.4)),
      new THREE.MeshStandardMaterial({ color: [0x2a2a2e, 0x33291e, 0x23282a, 0x2e2320][randi(0, 3)], roughness: 1 }));
    m.position.set(x + rand(-1.6, 1.6), s * 0.3, z + rand(-1.6, 1.6));
    m.rotation.y = rand(0, TAU); m.castShadow = m.receiveShadow = true;
    worldGroup.add(m);
  }
}

function buildLevel(idx) {
  const D = LEVELS[idx];
  clearWorld(); Fires.length = 0; CaneField = null; River = null; waterY = -900;

  scene.background = new THREE.Color().lerpColors(new THREE.Color(D.sky[0]), new THREE.Color(D.sky[1]), 0.5);
  scene.fog = lvlFog = new THREE.FogExp2(D.fogC, D.fogD);
  renderer.toneMappingExposure = D.exposure;

  if (hemi) scene.remove(hemi);
  hemi = new THREE.HemisphereLight(D.ambient, 0x0a0a0f, D.hemiI); scene.add(hemi);
  if (moon) scene.remove(moon);
  moon = new THREE.DirectionalLight(0xb8c4e8, D.moonI);
  moon.position.set(-28, 42, -20); moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -70; moon.shadow.camera.right = 70;
  moon.shadow.camera.top = 70; moon.shadow.camera.bottom = -70;
  moon.shadow.camera.far = 130; moon.shadow.bias = -0.002;
  scene.add(moon);

  const L = D.len;
  const gt = groundTex[D.ground] || (groundTex[D.ground] =
    D.ground === 'dirt' ? asphaltTexture('#191510', 6) :
    D.ground === 'stone' ? asphaltTexture('#1c1a1f', 10) : asphaltTexture('#141416', 12));
  const gmap = gt.clone(); gmap.needsUpdate = true;
  gmap.wrapS = gmap.wrapT = THREE.RepeatWrapping; gmap.repeat.set(L / 9, L / 9);
  const ground = new THREE.Mesh(SharedGeo.plane(L, L), new THREE.MeshStandardMaterial({ map: gmap, roughness: 0.96 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  worldGroup.add(ground);

  const B = L / 2 - 2; // invisible arena walls
  blockers.push({ minX: -L, maxX: L, minZ: B, maxZ: B + 1.2, h: 99 });
  blockers.push({ minX: -L, maxX: L, minZ: -B - 1.2, maxZ: -B, h: 99 });
  blockers.push({ minX: B, maxX: B + 1.2, minZ: -L, maxZ: L, h: 99 });
  blockers.push({ minX: -B - 1.2, maxX: -B, minZ: -L, maxZ: L, h: 99 });

  if (idx === 0) {
    buildingRow(-14, L - 24, new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.95 }), 0);
    buildingRow(14, L - 30, new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95 }), 5);
    wreckedCar(-8, -6, 0.4, 0x37414a); wreckedCar(11, 2, -0.7, 0x4a3423); wreckedCar(-3, 9, 1.2, 0x2e3a30);
    debris(-14, -2); debris(6, -10); debris(15, 8); debris(-19, 7);
    deadTree(-17, 12, 1.1); deadTree(19, -9);
    D.lampposts.forEach(([x, z]) => streetLamp(x, z));
    addBox(6, 2.2, 1.4, -L + 6, 1.1, -8, new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 1 }), true, 0.3);
    addBox(6, 2.2, 1.4, L - 6, 1.1, 9, new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 1 }), true, -0.2);
    const sl = new THREE.Mesh(SharedGeo.plane(1.0, 30), new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.4, metalness: 0.2 }));
    sl.rotation.x = -Math.PI / 2; sl.position.set(-12, 0.012, 0); worldGroup.add(sl);
  }
  if (idx === 1) {
    const caneGeo = SharedGeo.cone(0.16, 2.2, 4);
    const caneMat = new THREE.MeshStandardMaterial({ color: 0x3a4a26, roughness: 1 });
    const N = 700, cf = new THREE.InstancedMesh(caneGeo, caneMat, N);
    const dummy = new THREE.Object3D();
    let ci = 0;
    for (let i = 0; i < N; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = rand(-L / 2 + 4, L / 2 - 4), z = side * rand(9, L - 10);
      dummy.position.set(x, 1.0 + rand(-0.15, 0.2), z);
      dummy.rotation.set(rand(-0.12, 0.12), rand(0, TAU), rand(-0.12, 0.12));
      dummy.updateMatrix(); cf.setMatrixAt(ci++, dummy.matrix);
    }
    cf.count = ci; cf.castShadow = true; worldGroup.add(cf);
    CaneField = cf;
    const hutM = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 });
    [[-16, -18, 0.4], [-22, -6, 1.2], [17, -20, -0.6], [20, 4, 0.9], [-19, 12, 0.1]].forEach(([hx, hz, hr]) => {
      const hut = new THREE.Mesh(SharedGeo.box(4.4, 2.6, 3.6), hutM);
      hut.position.set(hx, 1.3, hz); hut.rotation.y = hr; hut.castShadow = hut.receiveShadow = true;
      worldGroup.add(hut);
      const roof = new THREE.Mesh(SharedGeo.cone(3.6, 1.7, 4), new THREE.MeshStandardMaterial({ color: 0x1c150e, roughness: 1 }));
      roof.position.set(hx, 3.4, hz); roof.rotation.y = hr + Math.PI / 4; roof.castShadow = true;
      worldGroup.add(roof);
      blockers.push({ minX: hx - 2.4, maxX: hx + 2.4, minZ: hz - 2.4, maxZ: hz + 2.4, h: 3.6 });
    });
    addBox(7, 2.0, 0.8, 8, 1.0, -22, new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 1 }), true, 0.25);
    addBox(0.8, 3.0, 0.8, 4.6, 1.5, -21, new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 1 }), true);
    deadTree(-11, 16, 1.3); deadTree(13, 14, 0.9); deadTree(-6, -26, 1.5);
    D.lampposts.forEach(([x, z]) => streetLamp(x, z, true));
    D.fires.forEach(([x, z]) => fireBarrel(x, z));
    addBox(1.6, 0.9, 0.9, -4, 0.45, -14, new THREE.MeshStandardMaterial({ color: 0x33261a, roughness: 1 }), true, 0.5);
  }
  if (idx === 2) {
    buildingRow(-12, L - 20, new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }), 11);
    buildingRow(12, L - 20, new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }), 23);
    const shutM = new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 0.6, metalness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const sx = -L / 2 + 10 + i * 7;
      const sh = new THREE.Mesh(SharedGeo.box(3.4, 2.6, 0.16), shutM);
      sh.position.set(sx, 1.4, -10.9); sh.castShadow = true; worldGroup.add(sh);
      const arch = new THREE.Mesh(SharedGeo.torus(0.9, 0.14, 6, 12, Math.PI), shutM);
      arch.position.set(sx, 2.8, -10.8); worldGroup.add(arch);
    }
    const cartM = new THREE.MeshStandardMaterial({ color: 0x2c2115, roughness: 1 });
    [[-4, 6, 0.6], [6, -3, -0.4], [-9, -2, 1.1]].forEach(([cx, cz, cr]) => {
      const cart = new THREE.Group();
      const bed = new THREE.Mesh(SharedGeo.box(2.4, 0.14, 1.4), cartM); bed.position.y = 0.85; bed.castShadow = true;
      const hd = new THREE.Mesh(SharedGeo.box(2.4, 0.5, 0.1), cartM); hd.position.set(0, 1.2, -0.65); hd.castShadow = true;
      cart.add(bed, hd);
      const wg = SharedGeo.cyl(0.42, 0.42, 0.12, 10);
      [-0.9, 0.9].forEach(wx => { const w = new THREE.Mesh(wg, cartM); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, 0); cart.add(w); });
      cart.position.set(cx, 0, cz); cart.rotation.y = cr; worldGroup.add(cart);
      blockers.push({ minX: cx - 1.4, maxX: cx + 1.4, minZ: cz - 0.9, maxZ: cz + 0.9, h: 1.6 });
    });
    const wireM = new THREE.LineBasicMaterial({ color: 0x0a0a0c });
    for (let i = 0; i < 8; i++) {
      const pts = [];
      for (let s = 0; s <= 20; s++) {
        const t = s / 20;
        pts.push(new THREE.Vector3(lerp(-L / 2, L / 2, t), 6.4 + Math.sin(t * 9 + i * 2.4) * 0.35 + i * 0.16, Math.sin(i * 3.1) * 4));
      }
      worldGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    }
    D.fires.forEach(([x, z]) => fireBarrel(x, z));
    D.lamps.forEach(([x, z, c, d]) => lampGlow(c, 1.7, d, x, 3.1, z));
    debris(0, 12); debris(-13, 6); debris(13, -7);
    deadTree(L / 2 - 6, -8, 0.8);
  }
  if (idx === 3) {
    waterY = 0.06;
    const water = new THREE.Mesh(SharedGeo.plane(L * 1.2, L), new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.15, metalness: 0.75 }));
    water.rotation.x = -Math.PI / 2; water.position.set(L / 2 + 16, waterY, 0);
    worldGroup.add(water); River = water;
    const stepM = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 1 });
    for (let s = 0; s < 6; s++) {
      const st = new THREE.Mesh(SharedGeo.box(30, 0.34, 1.5), stepM);
      st.position.set(14 + s * 1.5, 0.17 + s * 0.34, 0); st.receiveShadow = st.castShadow = true;
      worldGroup.add(st);
    }
    const tM = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 1 });
    [[-L / 2 + 9, -16, 7, 12], [-L / 2 + 13, 8, 5, 9], [-L / 2 + 8, 24, 6, 10]].forEach(([tx, tz, tw, th]) => {
      const base = new THREE.Mesh(SharedGeo.box(tw + 2, 4, tw + 2), tM);
      base.position.set(tx, 2, tz); base.castShadow = base.receiveShadow = true; worldGroup.add(base);
      const tower = new THREE.Mesh(SharedGeo.cone(tw * 0.75, th, 8), tM);
      tower.position.set(tx, 4 + th / 2, tz); tower.castShadow = true; worldGroup.add(tower);
      const spire = new THREE.Mesh(SharedGeo.cone(0.35, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x1c1710, metalness: 0.6, roughness: 0.4 }));
      spire.position.set(tx, 4 + th + 0.8, tz); worldGroup.add(spire);
      blockers.push({ minX: tx - tw / 2 - 1, maxX: tx + tw / 2 + 1, minZ: tz - tw / 2 - 1, maxZ: tz + tw / 2 + 1, h: 16 });
    });
    const colM = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const cz = -28 + i * 7;
      const col = new THREE.Mesh(SharedGeo.cyl(0.45, 0.5, 4.6, 9), colM);
      col.position.set(-6, 2.3, cz); col.castShadow = col.receiveShadow = true; worldGroup.add(col);
      blockers.push({ minX: -6.5, maxX: -5.5, minZ: cz - 0.5, maxZ: cz + 0.5, h: 4.6 });
    }
    const boatM = new THREE.MeshStandardMaterial({ color: 0x1d1710, roughness: 0.85 });
    [[24, -12, 0.3], [28, 2, -0.2], [23, 14, 0.5], [30, -22, 0.1]].forEach(([bx, bz, br]) => {
      const boat = new THREE.Mesh(SharedGeo.cyl(0.01, 0.9, 4.4, 5), boatM);
      boat.rotation.z = Math.PI / 2; boat.rotation.y = br;
      boat.position.set(bx, waterY + 0.12, bz); boat.castShadow = true; worldGroup.add(boat);
    });
    const pyre = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const log = new THREE.Mesh(SharedGeo.cyl(0.09, 0.11, 2.0, 6), new THREE.MeshStandardMaterial({ color: 0x140f0a, roughness: 1 }));
      log.rotation.z = Math.PI / 2 - 0.1; log.rotation.y = i * 0.5; log.position.y = 0.15 + i * 0.1;
      pyre.add(log);
    }
    pyre.position.set(6, 0, -12); worldGroup.add(pyre);
    const fl = new THREE.Mesh(SharedGeo.cone(0.55, 1.3, 8), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9 }));
    fl.position.set(6, 1.0, -12); worldGroup.add(fl);
    const PL = lampGlow(0xff7a2a, 3.0, 18, 6, 1.6, -12);
    Fires.push({ flame: fl, light: PL, x: 6, z: -12, t: 0 });
    deadTree(-14, -4, 1.2); deadTree(-16, 18, 1.0);
    debris(2, 6); debris(-12, -14);
  }

  player.pos.set(0, 0, D.len / 2 - 12);
  player.yaw = Math.PI;
  player.vel.set(0, 0, 0);
}

/* ------------------------------ main loop --------------------------------- */
let hbT = 0, windT = 0;
function tick(dt) {
  if (game.state !== 'playing' && game.state !== 'cleared') return;
  playerUpdate(dt);
  wpn.fireT -= dt;
  if (mouse.down && wpn.fireT <= 0) { shoot(); wpn.fireT = 60 / wpn.rpm; }
  if (game.reloading > 0) {
    game.reloading -= dt;
    if (game.reloading <= 0) { game.reloading = 0; finishReload(); }
  }
  autoReloadIfNeeded();
  wpn.adsT = damp(wpn.adsT, (mouse.rmb && game.reloading <= 0) ? 1 : 0, 12, dt);
  camera.fov = lerp(baseFov, baseFov - 18, wpn.adsT);
  camera.updateProjectionMatrix();
  wpn.bloom = Math.max(0, wpn.bloom - dt * 0.03);
  UI.xhSpread();
  game.stamHeat = Math.max(0, game.stamHeat - dt * 0.5);
  if (game.winded && game.stam > 30) game.winded = false;

  for (const z of zombies) zombieUpdate(z, dt);
  if (zombies.length > 46) {
    zombies = zombies.filter(z => {
      if (z.dead && z.deadT > 14) { worldGroup.remove(z.group); return false; }
      return true;
    });
  }
  waveUpdate(dt);
  for (const f of Fires) {
    f.t += dt;
    const fl = 1 + Math.sin(f.t * 11) * 0.18 + Math.sin(f.t * 23) * 0.1;
    if (!f.light.userData.base) f.light.userData.base = f.light.intensity;
    f.light.intensity = f.light.userData.base * fl;
    f.flame.scale.y = fl; f.flame.rotation.y += dt * 2;
  }
  hbT -= dt;
  if (player.hp < 35 && hbT <= 0) { AudioSys.heartbeat(); hbT = lerp(0.55, 1.1, player.hp / 35); }
  windT -= dt;
  if (windT <= 0) { AudioSys.wind(); windT = rand(2.5, 5); }
  updateCasings(dt);
  UI.hud();
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  // self-heal canvas size (occluded/zero-size viewports, stale resize events)
  if (canvasEl.clientWidth !== W() || canvasEl.clientHeight !== H()) {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    vmCamera.aspect = camera.aspect; vmCamera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  }
  tick(dt);
  updateEffects(dt);
  updateRain(dt);
  updateViewmodel(dt);
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
  renderer.autoClear = true;
}

/* ------------------------------ debug hooks ------------------------------- */
window.__dbg = () => ({
  state: game.state, level: game.level, cylinder: game.cylinder, reserve: game.reserve,
  kills: game.kills, waveTotal: game.waveTotal, spawned: game.spawned,
  alive: zombies.filter(z => !z.dead).length, hp: Math.round(player.hp),
  stam: Math.round(game.stam), reloading: game.reloading, ads: +wpn.adsT.toFixed(2),
  pos: { x: +player.pos.x.toFixed(1), y: +player.pos.y.toFixed(1), z: +player.pos.z.toFixed(1) },
  vel: +Math.hypot(player.vel.x, player.vel.z).toFixed(1),
});
window.__set = (k, v) => {
  if (k === 'hp') player.hp = v;
  if (k === 'stam') game.stam = v;
  if (k === 'ammo') { game.cylinder = v; }
  if (k === 'reserve') game.reserve = v;
  if (k === 'state') game.state = v;
  if (k === 'pos') { player.pos.set(v[0], v[1] || 0, v[2]); }
};
window.__pump = (seconds, step = 0.05) => {
  for (let t = 0; t < seconds; t += step) tick(Math.min(step, seconds - t));
  return window.__dbg();
};
window.__fire = () => { mouse.down = true; shoot(); mouse.down = false; return window.__dbg(); };

buildLevel(0);
UI.setLevel(0); UI.hud();
frame();
