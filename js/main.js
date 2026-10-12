// Neon Club — 3D padel court landing page
// Three.js scene with scroll-driven camera, day/night cycle, floodlights and weather.

const CONFIG = {
  timeOverride: -1,   // -1 = use device clock, otherwise hour 0–24
  timeLapse: false,   // true = full day cycle in 60s
  rallySpeed: 1,      // 0.5 – 2
  parallax: true,     // subtle mouse parallax on camera
};

// page is RTL: mirror the camera on X so the court stays opposite the text column
const MIRROR_X = document.documentElement.dir === 'rtl' ? -1 : 1;

const IS_MOBILE = matchMedia('(max-width: 768px), (pointer: coarse)').matches;

const scroller = document.getElementById('scroller');
const sections = [...scroller.querySelectorAll('section')];
const navButtons = [...document.querySelectorAll('[data-goto]')];
const timeLabelEl = document.getElementById('time-label');

function scrollProgress() {
  const y = scroller.scrollTop;
  for (let i = sections.length - 1; i >= 0; i--) {
    if (y >= sections[i].offsetTop) {
      const next = sections[i + 1];
      if (!next) return i;
      return i + Math.min(1, (y - sections[i].offsetTop) / (next.offsetTop - sections[i].offsetTop));
    }
  }
  return 0;
}

let currentSec = -1;
function updateNav() {
  const sec = Math.round(scrollProgress());
  if (sec === currentSec) return;
  currentSec = sec;
  navButtons.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.goto) === sec));
}
scroller.addEventListener('scroll', updateNav, { passive: true });
const menuBtn = document.getElementById('menu-btn');
const setMenu = (open) => { document.body.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
navButtons.forEach((b) => b.addEventListener('click', () => {
  setMenu(false);
  const s = sections[Number(b.dataset.goto)];
  if (s) scroller.scrollTo({ top: s.offsetTop, behavior: 'smooth' });
}));
updateNav();

const ui = { label: '', day: null };
function setUI(label, day) {
  if (label !== ui.label) { ui.label = label; timeLabelEl.textContent = label; }
  if (day !== ui.day) { ui.day = day; document.body.classList.toggle('is-night', !day); }
}

async function init() {
  const base = 'https://esm.sh/three@0.160.0';
    const [THREE, { RoundedBoxGeometry }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import(base),
      import(base + '/examples/jsm/geometries/RoundedBoxGeometry.js'),
      import(base + '/examples/jsm/postprocessing/EffectComposer.js'),
      import(base + '/examples/jsm/postprocessing/RenderPass.js'),
      import(base + '/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import(base + '/examples/jsm/postprocessing/OutputPass.js'),
    ]);
    const host = document.getElementById('scene');
    if (!host) return;
    const V3 = THREE.Vector3;
    const CYAN = '#3ee6ff', MAG = '#ff3ec8';
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    const W = () => host.clientWidth || innerWidth, H = () => host.clientHeight || innerHeight;
  
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2));
    renderer.setSize(W(), H());
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);
  
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3ebe0');
    scene.fog = new THREE.Fog('#f3ebe0', 30, 80);
    const camera = new THREE.PerspectiveCamera(32, W() / H(), 0.1, 300);
  
    const hemi = new THREE.HemisphereLight('#fff6ea', '#c9b49c', 1.3); scene.add(hemi);
    const pc = new THREE.PointLight(CYAN, 0, 0, 2); pc.position.set(-9, 2.5, 0); scene.add(pc);
    const pm = new THREE.PointLight(MAG, 0, 0, 2); pm.position.set(9, 2.5, 0); scene.add(pm);
    const sun = new THREE.DirectionalLight('#fff1df', 2.4);
    sun.castShadow = true; sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 90 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);
  
    // day/night materials: clay colour by day, neon/emissive by night
    const dnList = [];
    const dn = (dayC, nightC, glow = 0, extra = {}) => {
      const m = new THREE.MeshStandardMaterial({ color: dayC, roughness: 0.75, metalness: 0, ...extra });
      dnList.push({ m, d: new THREE.Color(dayC), n: new THREE.Color(nightC), glow });
      return m;
    };
    const rbox = (w, h, d, mat, x, y, z, r = 0.04) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    };
  
    const post = dn('#fffaf2', '#1a2550');
    const railTop = dn('#ff8a3d', CYAN, 1.6);
    const railLow = dn('#f6e6d2', MAG, 1.6);
    const lineM = dn('#ffffff', '#cfe0ff', 0.15);
  
    const groundMat = new THREE.MeshStandardMaterial({ color: '#efe5d8', roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(120, 60, '#2f6bff', '#2f6bff');
    grid.material.transparent = true; grid.material.opacity = 0; grid.position.y = 0.004; scene.add(grid);
    // court slab, slightly raised & rounded like a rug
    rbox(21, 0.18, 11, dn('#ffb26b', '#0d1f63'), 0, 0.09, 0, 0.09);
    rbox(20, 0.04, 10, dn('#7fa8e6', '#163f96', 0, { roughness: 0.95 }), 0, 0.2, 0, 0.02);
    rbox(0.06, 0.02, 10, lineM, 6.95, 0.225, 0, 0.01); rbox(0.06, 0.02, 10, lineM, -6.95, 0.225, 0, 0.01);
    rbox(13.9, 0.02, 0.06, lineM, 0, 0.225, 0, 0.01);
    const Y0 = 0.22;
  
    const nc = document.createElement('canvas'); nc.width = nc.height = 32;
    const nx = nc.getContext('2d'); nx.strokeStyle = '#fff'; nx.lineWidth = 3; nx.strokeRect(0, 0, 32, 32);
    const ntex = new THREE.CanvasTexture(nc); ntex.wrapS = ntex.wrapT = THREE.RepeatWrapping; ntex.repeat.set(90, 8);
    const netMat = new THREE.MeshBasicMaterial({ map: ntex, color: '#ffffff', transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.88), netMat);
    net.rotation.y = Math.PI / 2; net.position.set(0, Y0 + 0.46, 0); scene.add(net);
    rbox(0.08, 0.08, 10, railTop, 0, Y0 + 0.9, 0);
    rbox(0.16, 1, 0.16, post, 0, Y0 + 0.48, 5.05, 0.06); rbox(0.16, 1, 0.16, post, 0, Y0 + 0.48, -5.05, 0.06);
  
    const glassMat = new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.14, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const glass = (w, h, x, y, z, rotY) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); m.position.set(x, Y0 + y, z); m.rotation.y = rotY; scene.add(m); };
    [-1, 1].forEach((s) => {
      glass(10, 3, s * 10, 1.5, 0, Math.PI / 2);
      rbox(0.12, 0.12, 10.1, railTop, s * 10, Y0 + 3, 0);
      [-1, 1].forEach((z) => {
        glass(4, 3, s * 8, 1.5, z * 5, 0); glass(2, 2, s * 5, 1, z * 5, 0);
        rbox(4, 0.12, 0.12, railTop, s * 8, Y0 + 3, z * 5); rbox(2, 0.12, 0.12, railTop, s * 5, Y0 + 2, z * 5);
      });
      for (let z = -5; z <= 5; z += 2.5) rbox(0.16, 3.1, 0.16, post, s * 10.04, Y0 + 1.55, z, 0.06);
    });
    [-6, -4, -2, 0, 2, 4, 6].forEach((x) => [-1, 1].forEach((z) => rbox(0.14, 3.1, 0.14, post, x, Y0 + 1.55, z * 5.04, 0.05)));
    rbox(20.2, 0.08, 0.08, railLow, 0, Y0 + 0.05, 5.04); rbox(20.2, 0.08, 0.08, railLow, 0, Y0 + 0.05, -5.04);
    rbox(0.08, 0.08, 10.2, railLow, 10.04, Y0 + 0.05, 0); rbox(0.08, 0.08, 10.2, railLow, -10.04, Y0 + 0.05, 0);
    rbox(8, 0.12, 0.12, railTop, 0, Y0 + 3, 5.04); rbox(8, 0.12, 0.12, railTop, 0, Y0 + 3, -5.04);
    const meshPts = [];
    const meshPanel = (x0, x1, y0, y1, z) => {
      for (let x = x0; x <= x1 + 1e-6; x += 0.25) meshPts.push(x, Y0 + y0, z, x, Y0 + y1, z);
      for (let y = y0; y <= y1 + 1e-6; y += 0.25) meshPts.push(x0, Y0 + y, z, x1, Y0 + y, z);
    };
    [-1, 1].forEach((z) => { meshPanel(-4, 4, 0, 3, z * 5.04); meshPanel(4, 6, 2, 3, z * 5.04); meshPanel(-6, -4, 2, 3, z * 5.04); });
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(meshPts, 3));
    const meshLineMat = new THREE.LineBasicMaterial({ color: '#d9c7b2', transparent: true, opacity: 0.7 });
    scene.add(new THREE.LineSegments(mg, meshLineMat));
  
    // clay props: benches, ball buckets, plants
    const seat = dn('#ff8a3d', '#26305a'), leg = dn('#e9d6bf', '#1a2550');
    [-1, 1].forEach((s) => [-3.2, 3.2].forEach((x) => {
      rbox(2.4, 0.16, 0.6, seat, x, 0.5, s * 7.3, 0.07);
      rbox(0.14, 0.42, 0.5, leg, x - 1, 0.21, s * 7.3, 0.05); rbox(0.14, 0.42, 0.5, leg, x + 1, 0.21, s * 7.3, 0.05);
    }));
    const potM = dn('#f6efe4', '#1a2550'), leafM = dn('#8fd14f', '#2bd88a', 0.6), soilM = dn('#9c7656', '#0a1030');
    const plant = (x, z, sc) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(sc); scene.add(g);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.9, 32), potM); pot.position.y = 0.45; pot.castShadow = true; g.add(pot);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), soilM); soil.position.y = 0.88; g.add(soil);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), leafM);
        leaf.scale.set(0.55, 1.6, 0.25); const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.25, 1.4, Math.sin(a) * 0.25);
        leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); leaf.castShadow = true; g.add(leaf);
      }
    };
    plant(11.8, 6.4, 1.1); plant(-11.6, -6.6, 0.95); plant(-12, 6.2, 0.8);
    const bucketM = dn('#5b8def', '#26305a'), propBall = dn('#e6f25a', '#d8fbff', 0.8);
    [[8.5, 7.4], [-8.4, -7.3]].forEach(([x, z]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.6, 28), bucketM); b.position.set(x, 0.3, z); b.castShadow = true; scene.add(b);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), propBall); s.position.set(x + rand(-0.2, 0.2), 0.64 + rand(0, 0.08), z + rand(-0.2, 0.2)); scene.add(s); }
    });
  
    // floodlights: clay poles, warm lamps switch on at dusk
    const poleM = dn('#fffaf2', '#fffaf2'), headM = dn('#ff8a3d', '#ff8a3d');
    const lampM = new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd99a', emissiveIntensity: 0, roughness: 0.4 });
    const floods = [];
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const x = sx * 10.9, z = sz * 6;
      rbox(0.26, 6.6, 0.26, poleM, x, 3.3, z, 0.1);
      rbox(0.7, 0.18, 0.7, poleM, x, 0.09, z, 0.08);
      const head = new THREE.Group(); head.position.set(x - sx * 0.35, 6.7, z - sz * 0.25); scene.add(head);
      head.lookAt(sx * 4, 0, 0);
      const shell = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.7, 0.4, 3, 0.12), headM); shell.castShadow = true; head.add(shell);
      const face = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.52, 0.06, 2, 0.03), lampM); face.position.z = 0.2; head.add(face);
      const sp = new THREE.SpotLight('#ffd9a0', 0, 34, 0.75, 0.75, 1.2);
      sp.position.copy(head.position); sp.target.position.set(sx * 4, 0, sz * 1.5);
      scene.add(sp); scene.add(sp.target); floods.push(sp);
    });
  
    // weather: drifting clay clouds by day, stars at night
    const cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, transparent: true, opacity: 1 });
    const clouds = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(rand(0, 3));
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.9, 1.5), 24, 16), cloudM);
        s.position.set((j - (n - 1) / 2) * 1.3 + rand(-0.2, 0.2), rand(0, 0.5), rand(-0.4, 0.4));
        s.scale.y = 0.8; s.castShadow = true; g.add(s);
      }
      g.position.set(rand(-32, 32), rand(9, 13), rand(-14, 14));
      g.userData.v = rand(0.25, 0.6);
      scene.add(g); clouds.push(g);
    }
    const SN = IS_MOBILE ? 250 : 500, spos = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const th = rand(0, Math.PI * 2), ph = rand(0.08, 1.35), r = 140;
      spos.set([Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r, Math.sin(th) * Math.cos(ph) * r], i * 3);
    }
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    const starM = new THREE.PointsMaterial({ color: '#fff6e0', size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const stars = new THREE.Points(sgeo, starM); scene.add(stars);
  
    const DN = 300, dpos = new Float32Array(DN * 3), dvel = [];
    for (let i = 0; i < DN; i++) { dpos.set([rand(-10, 10), rand(0.2, 6), rand(-5.5, 5.5)], i * 3); dvel.push(rand(0.02, 0.08)); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dustMat = new THREE.PointsMaterial({ color: '#cfe6ff', size: 0.05, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(dg, dustMat));
  
    const ballMat = dn('#e6f25a', '#f2fff8', 1.4);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), ballMat);
    ball.castShadow = true; scene.add(ball);
    const TN = 46, trailPos = new Float32Array(TN * 3), trailCol = new Float32Array(TN * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Line(tg, trailMat));
    const cC = new THREE.Color(CYAN), cM = new THREE.Color(MAG), tmpC = new THREE.Color();
    const trail = [];
  
    const HEAD = 0.94;
    const makeRacket = (dayC, nightC) => {
      const pivot = new THREE.Group();
      const g = new THREE.Group(); g.position.y = HEAD; pivot.add(g);
      const faceMat = dn(dayC, '#0b1430');
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 48), faceMat);
      face.rotation.z = Math.PI / 2; face.scale.set(1.15, 1, 1); g.add(face);
      const rimMat = dn('#fffaf2', nightC, 1.6);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 14, 64), rimMat);
      rim.rotation.y = Math.PI / 2; rim.scale.set(1, 1.15, 1); g.add(rim);
      for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) {
        if (Math.abs(c) === 2 && r === 2) continue;
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), rimMat);
        d.position.set(0.032, 0.1 - r * 0.1, c * 0.07); d.rotation.y = Math.PI / 2; g.add(d);
        const d2 = d.clone(); d2.position.x = -0.032; d2.rotation.y = -Math.PI / 2; g.add(d2);
      }
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.28, 16), dn('#2a2320', '#0b1430'));
      handle.position.y = -0.42; g.add(handle);
      const grip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), rimMat);
      grip.position.y = -0.57; g.add(grip);
      g.scale.setScalar(1.7);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(pivot);
      return pivot;
    };
    const R = [];
    [1, -1].forEach((s) => [-1, 1].forEach((lane) => {
      const home = new V3(s * 7.6, 1.1 + Y0, lane * 2.5);
      const mesh = makeRacket(s > 0 ? '#ff8a3d' : '#5b8def', s > 0 ? MAG : CYAN);
      R.push({ s, lane, mesh, home, pos: home.clone(), vel: new V3(), target: home.clone(), swingAt: -10, hand: 1, overhead: false, hopAt: -10, seed: rand(0, 10) });
    }));
    const racket = (s, lane) => R.find((r) => r.s === s && r.lane === lane);
  
    let shot = null, T = 0, lobNext = false;
    const BY = 0.13 + Y0;
    const startShot = (side, from, t0) => {
      const o = -side, sp = CONFIG.rallySpeed;
      const lob = !lobNext && Math.random() < 0.16;
      const smashBack = lobNext; lobNext = false;
      const pb = new V3(o * (lob ? rand(6.5, 8.5) : rand(3.5, 7)), BY, rand(-3.8, 3.8));
      const segs = [{ a: from.clone(), b: pb, T: (lob ? rand(1.7, 2.0) : smashBack ? rand(0.7, 0.85) : rand(1.0, 1.3)) / sp, h: lob ? rand(4.2, 5) : smashBack ? rand(0.8, 1.2) : rand(2.2, 3.1) }];
      let hit;
      if (lob) {
        hit = new V3(o * rand(6, 7), Y0 + rand(2.0, 2.3), clamp(pb.z + rand(-0.8, 0.8), -4, 4));
        segs.push({ a: pb, b: hit, T: 0.8 / sp, h: 1.7 }); lobNext = true;
      } else if (Math.random() < 0.38) {
        const w = new V3(o * 9.85, Y0 + rand(1.2, 1.9), clamp(pb.z + rand(-1, 1), -4.5, 4.5));
        segs.push({ a: pb, b: w, T: 0.45 / sp, h: 0.7 });
        hit = new V3(o * rand(7, 7.8), Y0 + rand(0.9, 1.4), clamp(w.z + rand(-1, 1), -4, 4));
        segs.push({ a: w, b: hit, T: 0.5 / sp, h: 0.4 });
      } else {
        hit = new V3(o * rand(8, 9), Y0 + rand(0.8, 1.4), clamp(pb.z + rand(-1.2, 1.2), -4.2, 4.2));
        segs.push({ a: pb, b: hit, T: 0.55 / sp, h: 1.0 });
      }
      const total = segs.reduce((s, x) => s + x.T, 0);
      shot = { side, o, segs, t0, total, hit };
      const lane = hit.z < 0 ? -1 : 1;
      const rec = racket(o, lane), partner = racket(o, -lane);
      rec.target = hit.clone().add(new V3(o * 0.15, -HEAD, 0));
      rec.swingAt = t0 + total; rec.hand = Math.random() < 0.5 ? -1 : 1; rec.overhead = hit.y - Y0 > 1.8;
      partner.target = new V3(o * 6.6, 1.1 + Y0 - HEAD, -lane * 2.3);
      R.forEach((r) => { if (r.s === o) r.hopAt = t0 + 0.05; });
      R.filter((r) => r.s === side).forEach((r) => (r.target = r.home.clone().add(new V3(0, -HEAD, 0))));
    };
    R.forEach((r) => { r.pos.y -= HEAD; r.target.y -= HEAD; });
    startShot(1, new V3(8.3, 1.1 + Y0, 2), 0);
    const ballAt = (t, out) => {
      let e = t - shot.t0;
      for (const sg of shot.segs) {
        if (e <= sg.T) { const s = e / sg.T; out.lerpVectors(sg.a, sg.b, s); out.y += 4 * sg.h * s * (1 - s); return; }
        e -= sg.T;
      }
      out.copy(shot.hit);
    };
    const swingAngle = (u) => {
      if (u < -0.5 || u > 0.75) return 0;
      if (u < -0.12) return -1.15 * sstep((u + 0.5) / 0.38);
      if (u < 0.08) return -1.15 + 2.25 * sstep((u + 0.12) / 0.2);
      return 1.1 * (1 - sstep((u - 0.08) / 0.67));
    };
  
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0, 0.5, 0.6);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  
    const P = (bg, sunC, sunI, sky, gnd, hemiI, nk, day) => ({ bg: new THREE.Color(bg), sunC: new THREE.Color(sunC), sunI, sky: new THREE.Color(sky), gnd: new THREE.Color(gnd), hemiI, nk, day });
    const NIGHT = P('#3a4266', '#b9c6ff', 0.9, '#8d98c8', '#2a2c44', 0.75, 1, 0);
    const DAY = P('#f3ebe0', '#fff1df', 2.2, '#fff8ee', '#d6c2aa', 1.35, 0, 1);
    const KF = [
      [0, NIGHT], [5, NIGHT],
      [6.5, P('#f0c7b4', '#ff9c70', 1.4, '#ffd2bf', '#b89a9a', 1.1, 0.35, 0.6)],
      [8.5, DAY], [16, DAY],
      [18, P('#f2cfae', '#ffad6a', 1.9, '#ffe0c2', '#c9a68e', 1.2, 0.2, 0.8)],
      [19.5, P('#8a6f8e', '#ffb08a', 1.0, '#c9a6c0', '#4a3a52', 0.95, 0.85, 0.15)],
      [21, NIGHT], [24, NIGHT],
    ];
    const cur = P('#000', '#000', 0, '#000', '#000', 0, 0, 0);
    const sample = (h) => {
      let i = 0; while (i < KF.length - 2 && h >= KF[i + 1][0]) i++;
      const [h0, a] = KF[i], [h1, b] = KF[i + 1], t = sstep((h - h0) / (h1 - h0));
      ['bg', 'sunC', 'sky', 'gnd'].forEach((k) => cur[k].lerpColors(a[k], b[k], t));
      ['sunI', 'hemiI', 'nk', 'day'].forEach((k) => (cur[k] = a[k] + (b[k] - a[k]) * t));
      return cur;
    };
    const phase = (h) => (h < 5 ? 'شب' : h < 7.5 ? 'سپیده‌دم' : h < 12 ? 'صبح' : h < 17 ? 'بعدازظهر' : h < 19 ? 'غروب طلایی' : h < 21 ? 'شامگاه' : 'شب');
    const fa = new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });
    const startHour = (() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; })();
    const hourNow = () => {
      const ov = CONFIG.timeOverride;
      if (CONFIG.timeLapse) return (startHour + (T / 60) * 24) % 24;
      if (ov >= 0) return ov % 24;
      const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    };
    let lastLabelT = -1;
  
    // camera stop per section: [position, look-at]; hero look-at shifted so court sits right of the headline
    const SHOTS = [
      [[13, 11, 21], [-5.5, 0, 1.5]],
      [[-19, 3.2, 8], [-2.5, 1.2, 2.5]],
      [[2, 27, 9], [3.5, 0, 0]],
      [[3.5, 1.8, 10.5], [-1.5, 1.2, -2]],
      [[-16, 12, -20], [-5, 0, -2]],
    ].map(([p, t]) => [new V3(p[0] * MIRROR_X, p[1], p[2]), new V3(t[0] * MIRROR_X, t[1], t[2])]);
    const camP = new V3(), camT = new V3(), wantP = new V3(), wantT = new V3();
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    const onMove = (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; };
    addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') onMove(e); });
    // phones: gentle sway from device tilt
    const onTilt = (e) => {
      if (e.gamma == null) return;
      mouse.x = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
      mouse.y = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 90));
    };
    const enableTilt = () => {
      const D = window.DeviceOrientationEvent;
      if (!D) return;
      if (typeof D.requestPermission === 'function') {
        D.requestPermission().then((s) => { if (s === 'granted') addEventListener('deviceorientation', onTilt); }).catch(() => {});
      } else addEventListener('deviceorientation', onTilt);
    };
    if (IS_MOBILE && CONFIG.parallax) {
      if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') addEventListener('touchend', enableTilt, { once: true });
      else enableTilt();
    }
    let pS = 0, first = true;
    const placeCam = (dt) => {
      const target = clamp(scrollProgress(), 0, SHOTS.length - 1);
      pS = first ? target : pS + (target - pS) * (1 - Math.exp(-dt * 4));
      const i = Math.min(Math.floor(pS), SHOTS.length - 2), f = sstep(pS - i);
      wantP.lerpVectors(SHOTS[i][0], SHOTS[i + 1][0], f);
      wantT.lerpVectors(SHOTS[i][1], SHOTS[i + 1][1], f);
      if (camera.aspect < 1) { wantT.x *= 0.15; wantT.z *= 0.15; wantT.y -= 2.5; wantP.sub(wantT).multiplyScalar(1.7).add(wantT); }
      camP.copy(wantP); camT.copy(wantT);
      if (CONFIG.parallax) {
        mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
        camP.x += mouse.sx * 1.6; camP.y -= mouse.sy * 1.0;
      }
      camera.position.copy(camP); camera.lookAt(camT); first = false;
    };
  
    const onResize = () => {
      const w = host.clientWidth || innerWidth, hh = host.clientHeight || innerHeight;
      if (!w || !hh) return;
      camera.aspect = w / hh; camera.updateProjectionMatrix();
      renderer.setSize(w, hh); composer.setSize(w, hh);
    };
    const ro = new ResizeObserver(onResize); ro.observe(host);
    addEventListener('resize', onResize);
    onResize();
  
    const clock = new THREE.Clock();
    const bp = new V3(), off = new V3();
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      T += dt;
  
      const h = hourNow(), E = sample(h), nk = E.nk;
      scene.background.copy(E.bg); scene.fog.color.copy(E.bg);
      groundMat.color.copy(E.bg).multiplyScalar(0.97);
      hemi.color.copy(E.sky); hemi.groundColor.copy(E.gnd); hemi.intensity = E.hemiI;
      const up = h >= 6 && h < 18;
      const th = up ? ((h - 6) / 12) * Math.PI : (((h >= 18 ? h - 18 : h + 6)) / 12) * Math.PI;
      const el = Math.max(Math.sin(th), 0.35);
      sun.position.set(Math.cos(th) * 18 + 6, el * 30, 18);
      sun.color.copy(E.sunC); sun.intensity = E.sunI;
      pc.intensity = pm.intensity = 12 * nk;
      pc.intensity = pm.intensity = 0;
      grid.material.opacity = 0; dustMat.opacity = 0; trailMat.opacity = 0; bloom.strength = 0;
      const fl = sstep((nk - 0.15) / 0.6);
      floods.forEach((f) => (f.intensity = fl * 60));
      lampM.emissiveIntensity = fl * 1.6;
      const cloudA = clamp(E.day * 1.3 - 0.1, 0, 1);
      cloudM.opacity = cloudA; cloudM.color.lerpColors(new THREE.Color('#9aa3c8'), new THREE.Color('#ffffff'), E.day);
      clouds.forEach((g) => {
        g.visible = cloudA > 0.02;
        g.position.x += g.userData.v * dt; if (g.position.x > 36) g.position.x = -36;
      });
      starM.opacity = sstep((nk - 0.5) / 0.5) * 0.9;
      stars.rotation.y += dt * 0.004;
      if (T - lastLabelT > 0.25) {
        lastLabelT = T;
        const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
        const label = `${fa.format(hh)}:${fa.format(mm)} · ${phase(h)}`;
        const day = E.day > 0.5;
        setUI(label, day);
      }
  
      while (T - shot.t0 >= shot.total) startShot(shot.o, shot.hit, shot.t0 + shot.total);
      ballAt(T, bp);
      ball.position.copy(bp);
      trail.unshift(bp.clone()); if (trail.length > TN) trail.pop();
      for (let i = 0; i < TN; i++) {
        const p = trail[Math.min(i, trail.length - 1)];
        trailPos[i * 3] = p.x; trailPos[i * 3 + 1] = p.y; trailPos[i * 3 + 2] = p.z;
        tmpC.copy(cC).lerp(cM, i / TN).multiplyScalar(Math.pow(1 - i / TN, 1.6) * 1.6 * nk);
        trailCol[i * 3] = tmpC.r; trailCol[i * 3 + 1] = tmpC.g; trailCol[i * 3 + 2] = tmpC.b;
      }
      tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true;
  
      const k = 16, c = 2 * Math.sqrt(k) * 0.9;
      R.forEach((r) => {
        off.copy(r.target).sub(r.pos).multiplyScalar(k).addScaledVector(r.vel, -c);
        r.vel.addScaledVector(off, dt); r.pos.addScaledVector(r.vel, dt);
        const a = swingAngle(T - r.swingAt), Rr = 0.85;
        const m = r.mesh;
        m.position.copy(r.pos);
        if (r.overhead) {
          m.position.x += r.s * Rr * (1 - Math.cos(a));
          m.position.y += -Math.sin(a) * Rr * 0.7;
          m.rotation.set(0, r.hand * a * 0.25, r.s * a * 0.9);
        } else {
          m.position.x += r.s * Rr * (1 - Math.cos(a));
          m.position.z += r.hand * Rr * Math.sin(a);
          m.position.y += a * 0.25;
          m.rotation.set(r.hand * a * 0.35 - r.vel.z * 0.05, r.s * r.hand * a * 0.9, r.vel.x * 0.04 + Math.sin(T * 1.1 + r.seed) * 0.05);
        }
        const hop = T - r.hopAt;
        if (hop > 0 && hop < 0.32) m.position.y += Math.sin((hop / 0.32) * Math.PI) * 0.14;
        m.position.y += Math.sin(T * 1.7 + r.seed) * 0.03;
        m.position.z += Math.sin(T * 0.9 + r.seed * 2) * 0.04;
      });
  
      if (nk > 0.01) {
        for (let i = 0; i < DN; i++) {
          let y = dpos[i * 3 + 1] + dvel[i] * dt; if (y > 6) y = 0.2;
          dpos[i * 3 + 1] = y; dpos[i * 3] += Math.sin(T * 0.3 + i) * 0.002;
        }
        dg.attributes.position.needsUpdate = true;
      }
  
      placeCam(dt);
      composer.render();
    };
    tick();
  
    
}

init();
