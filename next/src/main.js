// The Poll. One mission: poll a stadium, shrink the margin with sample size, then watch two big polls miss.
import { EF } from './effort.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GlowPoints, skyDome, mulberry, clamp, lerp } from './fx.js';
import { buildStadium, N, NL, YES_L, YES_U, A0, B0 } from './stadium.js';
import { SRC, cite, LANES, GUESS, Q1, Q2, Q3, KINDS, CLASSIFY, FIELDS, ABOUT } from './content.js';

const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const DTCAP = parseFloat(qs.get('dtcap')) || 0.05;
const isPhone = () => innerWidth < 820;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pc = (p, d = 1) => (p * 100).toFixed(d), nf = (n) => n.toLocaleString('en-US');
const STEPS = ['brief', 'sample', 'size', 'list', 'vote', 'debrief'];
const TRUE_P = (YES_L + YES_U) / N, P_YES = 0.18, P_NO = 0.31, LO = 30, HI = 70, MAXSLAB = 70;
const moeOf = (p, n) => 1.96 * Math.sqrt((p * (1 - p)) / n);

// ---------- state ----------
const fresh = () => ({ sel: null, tries: 0, first: null, done: false });
const st = { step: 'title', polls: [], count: {}, guess: null, q1: fresh(), q2: fresh(), q2poll: null, q3: fresh(), cls: { i: 0, sel: null, tries: 0, done: false, first: [] }, revealed: false, revealT: 0, queue: [], qT: 0, log: [] };
LANES.forEach((l) => (st.count[l.k] = 0));
const cam = { yaw: 0.5, pitch: 0.6, yawT: 0.5, pitchT: 0.6, w: 200, h: 95, wT: 200, hT: 95, zoom: 1, spin: true };
const log = (what, extra = {}) => { if (extra.ok === false) EF.wrong(); if (extra.ok === true) EF.resolved(); if (extra.ok !== undefined && what !== 'build') EF.mark({ ok: extra.ok }); return st.log.push({ step: st.step, what, ...extra }); };

// ---------- renderer and scene ----------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x04050d, 0.0012);
scene.add(skyDome(0x050818, 0x141338, 0x020208));
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x05060c, 0.9));
const dl = new THREE.DirectionalLight(0xcfd8ff, 0.8); dl.position.set(-80, 160, 60); scene.add(dl);

const S = buildStadium(); scene.add(S.tiers);
const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshBasicMaterial({ color: 0x030409 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; scene.add(ground);

// seats
const seatGeo = new THREE.BufferGeometry();
seatGeo.setAttribute('position', new THREE.BufferAttribute(S.pos, 3));
const aState = new THREE.BufferAttribute(new Float32Array(N), 1), aT = new THREE.BufferAttribute(new Float32Array(N), 1);
aState.setUsage(THREE.DynamicDrawUsage); aT.setUsage(THREE.DynamicDrawUsage); seatGeo.setAttribute('aState', aState); seatGeo.setAttribute('aT', aT);
const seatMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uPop: { value: 2.2 }, uLit: { value: 0.62 } },
  vertexShader: `attribute float aState; attribute float aT; uniform float uTime; uniform float uScale; uniform float uPop; uniform float uLit; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); float d = -mv.z; float on = step(0.5,aState)*step(aT,uTime); float age = max(0.0,uTime-aT);
      vec3 col = aState < 1.5 ? vec3(1.0,0.64,0.12) : vec3(0.08,0.7,0.95); float pop = 1.0 + uPop*exp(-age*2.6);
      vC = mix(vec3(0.075,0.095,0.17), col*pop, on); gl_Position = projectionMatrix*mv; gl_PointSize = max(1.6, mix(0.4,uLit,on)*uScale/d); }`,
  fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord-0.5)*2.0; if (r > 1.0) discard; gl_FragColor = vec4(vC*(1.0-0.45*r*r), 1.0); }' });
const seats = new THREE.Points(seatGeo, seatMat); seats.frustumCulled = false; scene.add(seats);

// field: a number line from 30% to 70%
const X = (pct) => (pct - 50) * 2;
const fc = document.createElement('canvas'); fc.width = 2048; fc.height = 1280; const fx2 = fc.getContext('2d');
function paintField(truth) {
  const w = 2048, h = 1280, sx = w / (2 * A0 + 4), sz = h / (2 * B0 + 4), PX = (x) => (x + A0 + 2) * sx, PZ = (z) => (z + B0 + 2) * sz;
  fx2.fillStyle = '#070b14'; fx2.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) { fx2.fillStyle = i % 2 ? '#0a101c' : '#0c1322'; fx2.fillRect(PX(-42), PZ(-20 + i * 8), PX(42) - PX(-42), 8 * sz); }
  fx2.textAlign = 'center'; fx2.textBaseline = 'middle';
  for (let p = LO; p <= HI; p += 5) { const big = p % 10 === 0, x = PX(X(p)); fx2.strokeStyle = p === 50 ? 'rgba(255,255,255,.85)' : big ? 'rgba(150,180,255,.5)' : 'rgba(150,180,255,.22)'; fx2.lineWidth = p === 50 ? 5 : 3; fx2.beginPath(); fx2.moveTo(x, PZ(-21)); fx2.lineTo(x, PZ(21)); fx2.stroke();
    if (big) { fx2.fillStyle = p === 50 ? '#fff' : 'rgba(190,210,255,.9)'; fx2.font = '700 54px Inter, sans-serif'; fx2.fillText(p + '%', x, PZ(25)); fx2.save(); fx2.translate(x, PZ(-25)); fx2.rotate(Math.PI); fx2.fillText(p + '%', 0, 0); fx2.restore(); } }
  fx2.strokeStyle = 'rgba(150,180,255,.35)'; fx2.lineWidth = 3; fx2.strokeRect(PX(-42), PZ(-21), PX(42) - PX(-42), PZ(21) - PZ(-21));
  fx2.font = '600 34px Inter, sans-serif'; fx2.fillStyle = 'rgba(190,210,255,.7)'; fx2.fillText('SHARE VOTING YES', PX(-27), PZ(25)); fx2.save(); fx2.translate(PX(27), PZ(-25)); fx2.rotate(Math.PI); fx2.fillText('SHARE VOTING YES', 0, 0); fx2.restore();
}
paintField(); const fieldTex = new THREE.CanvasTexture(fc); fieldTex.colorSpace = THREE.SRGBColorSpace; fieldTex.anisotropy = 8;
const field = new THREE.Mesh(new THREE.PlaneGeometry(2 * A0 + 4, 2 * B0 + 4), new THREE.MeshBasicMaterial({ map: fieldTex, fog: false })); field.rotation.x = -Math.PI / 2; field.position.y = 0.05; scene.add(field);

// slabs: one per poll, stacked into histograms, one lane per method
const SW = 1.7, SH = 0.95, SD = 5.6, laneZ = (i) => -16 + i * 8;
const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(SW, SH, SD), new THREE.MeshBasicMaterial({ fog: false }), LANES.length * MAXSLAB); slabs.frustumCulled = false; slabs.count = 0; scene.add(slabs);
const slabList = [], bins = LANES.map(() => ({})), _m = new THREE.Matrix4(), _c = new THREE.Color();
function addSlab(li, p, miss) {
  if (slabList.filter((s) => s.li === li).length >= MAXSLAB) return;
  const b = clamp(Math.floor(p * 100), LO, HI - 1), k = (bins[li][b] = (bins[li][b] || 0) + 1);
  const s = { li, x: X(b + 0.5), z: laneZ(li), ty: 0.1 + (k - 0.5) * SH, y: 46 + Math.random() * 6, v: 0, i: slabList.length, p }; slabList.push(s); slabs.count = slabList.length;
  slabs.setColorAt(s.i, _c.setRGB(...LANES[li].col.map((v) => v * 0.62))); slabs.instanceColor.needsUpdate = true; _m.makeTranslation(s.x, s.y, s.z); slabs.setMatrixAt(s.i, _m); slabs.instanceMatrix.needsUpdate = true;
}
slabs.setColorAt(0, _c.setRGB(1, 1, 1));
const truth = new THREE.Mesh(new THREE.PlaneGeometry(44, 26), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.2, 0.35), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); truth.rotation.y = Math.PI / 2; truth.position.set(X(TRUE_P * 100), 13, 0); truth.visible = false; scene.add(truth);

// floodlights and stars
const glow = new GlowPoints(900); scene.add(glow.points);
const towers = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => { const g = new THREE.Group(), x = a * (S.rim.x + 14), z = b * (S.rim.z + 12); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 78, 8), new THREE.MeshStandardMaterial({ color: 0x10141f, roughness: 0.8 })); pole.position.y = 39; const lamp = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 1.1, 1.3), fog: false })); lamp.position.y = 80; g.add(pole, lamp); g.position.set(x, 0, z); lamp.lookAt(V(-x, -50, -z)); scene.add(g); return V(x, 80, z); });
const rnd = mulberry(8), stars = []; for (let i = 0; i < 520; i++) { const th = rnd() * 6.283, ph = 0.06 + rnd() * 1.3, r = 700; stars.push(r * Math.cos(th) * Math.cos(ph), r * Math.sin(ph), r * Math.sin(th) * Math.cos(ph), rnd()); }

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: isPhone() ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.36, 0.55, 0.92)); composer.addPass(new OutputPass());
let W = 1, H = 1; const view = { cx: 0, cy: 0, fw: 1, fh: 1 };
function layout() { W = innerWidth; H = innerHeight; const ph = isPhone();
  if (st.step === 'title') Object.assign(view, ph ? { cx: W / 2, cy: H * 0.32, fw: W, fh: H * 0.6 } : { cx: W * 0.62, cy: H * 0.5, fw: W * 0.8, fh: H });
  else if (ph) { const fh = H * 0.54 - 44; Object.assign(view, { cx: W / 2, cy: 44 + fh / 2 + 20, fw: W, fh }); }
  else Object.assign(view, { cx: (W - 460) / 2, cy: H / 2 + 20, fw: W - 460, fh: H - 60 }); }
function resize() { layout(); const pr = Math.min(devicePixelRatio || 1, isPhone() ? 1.5 : 2); renderer.setPixelRatio(pr); renderer.setSize(W, H, false); composer.setPixelRatio(pr); composer.setSize(W, H); camera.aspect = W / H; }
addEventListener('resize', resize);

// ---------- labels ----------
const labels = [], labRoot = $('#labels'), _t = V();
function label(text, cls, pos, show) { const el = document.createElement('div'); el.className = 'lab ' + cls; el.textContent = text; labRoot.appendChild(el); labels.push({ el, pos, show }); return el; }
LANES.forEach((l, i) => { const el = label(l.label, 'small lane', () => _t.set(44.5, 1.5, laneZ(i)), () => st.count[l.k] > 0 && !isPhone() && st.step !== 'title'); el.style.borderColor = l.css; });
label('The vote: 53.0% Yes', 'truth', () => _t.set(X(TRUE_P * 100), 32, 0), () => st.revealed && clock - st.revealT > 3.4);
function placeLabels() { for (const L of labels) { let on = L.show(); if (on) { const p = L.pos().project(camera), x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H; on = p.z < 1 && x > 10 && x < W - 10 && y > 54 && y < H - 10; if (on) L.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`; } L.el.style.opacity = on ? 1 : 0; } }

// ---------- sampling: the model ----------
const poolAll = Int32Array.from({ length: N }, (_, i) => i), poolClub = Int32Array.from({ length: NL }, (_, i) => i);
function draw(pool, n) { const M = pool.length; for (let i = 0; i < n; i++) { const j = i + Math.floor(Math.random() * (M - i)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; } return pool.subarray(0, n); }
let lit = [];
function sample(method, n) {
  let idx;
  if (method === 'rand') idx = draw(poolAll, n);
  else if (method === 'club') idx = draw(poolClub, n);
  else { const out = []; for (let i = 0; i < N; i++) if (Math.random() < (S.pref[i] ? P_YES : P_NO)) out.push(i); idx = out; }
  let yes = 0; for (let i = 0; i < idx.length; i++) yes += S.pref[idx[i]];
  return { idx, n: idx.length, yes };
}
function light(idx, sweep) {
  if (st.revealed) return; const A = aState.array, T = aT.array, now = clock;
  for (const i of lit) A[i] = 0; lit = Array.from(idx);
  for (const i of lit) { A[i] = S.pref[i] ? 1 : 2; T[i] = sweep ? now + ((S.ang[i] + Math.PI) / 6.283) * 1.1 : now; }
  aState.needsUpdate = true; aT.needsUpdate = true; seatMat.uniforms.uLit.value = lit.length <= 100 ? 1.9 : lit.length <= 400 ? 1.4 : lit.length <= 1600 ? 0.95 : 0.62; seatMat.uniforms.uPop.value = lit.length > 3000 ? 0.8 : 2.2;
}
function poll(k, { sweep = false, quiet = false } = {}) {
  const li = LANES.findIndex((l) => l.k === k), L = LANES[li], r = sample(L.method, L.n), p = r.yes / r.n, moe = moeOf(p, r.n);
  const rec = { id: st.polls.length + 1, k, li, n: r.n, yes: r.yes, p, moe, lo: p - moe, hi: p + moe }; rec.hit = rec.lo <= TRUE_P && TRUE_P <= rec.hi;
  st.polls.push(rec); st.count[k]++; light(r.idx, sweep); addSlab(li, p); if (!quiet) { hud(); } return rec;
}
const lane = (k) => st.polls.filter((p) => p.k === k);
function stats(k) { const a = lane(k); if (!a.length) return null; const ps = a.map((p) => p.p); return { n: a.length, mean: ps.reduce((s, x) => s + x, 0) / a.length, min: Math.min(...ps), max: Math.max(...ps), hits: a.filter((p) => p.hit).length, moe: a.reduce((s, p) => s + p.moe, 0) / a.length, size: Math.round(a.reduce((s, p) => s + p.n, 0) / a.length) }; }

// ---------- HUD ----------
const ch = $('#chart'), cx2 = ch.getContext('2d');
function hud() {
  const last = st.polls[st.polls.length - 1], R = $('#read');
  if (st.revealed) { const t = clamp((clock - st.revealT) / 3.6, 0, 1), y = Math.round(N * TRUE_P * t), no = Math.round(N * (1 - TRUE_P) * t); R.innerHTML = `<div class="l1">The vote · ${nf(y + no)} of ${nf(N)} counted</div><div class="l2"><span class="yes">${nf(y)} Yes</span><small class="no">${nf(no)} No</small></div>`; }
  else if (last) R.innerHTML = `<div class="l1">Poll ${last.id} · ${nf(last.n)} ${last.k === 'club' ? 'from the club list' : last.k === 'mail' ? 'ballots returned' : 'random seats'}</div><div class="l2"><span class="yes">${pc(last.p)}% Yes</span><small>± ${pc(last.moe)}</small></div>`;
  else R.innerHTML = '<div class="l1">No polls yet</div><div class="l2"><small>Gold seats say Yes. Teal seats say No.</small></div>';
  const w = 860, h = 420, PXc = (p) => 40 + ((p * 100 - LO) / (HI - LO)) * (w - 80), rows = 12, show = st.polls.slice(-rows).reverse();
  cx2.clearRect(0, 0, w, h); cx2.font = '600 22px Inter, sans-serif'; cx2.textAlign = 'center';
  for (let p = LO; p <= HI; p += 10) { const x = PXc(p / 100); cx2.strokeStyle = p === 50 ? 'rgba(255,255,255,.7)' : 'rgba(160,190,255,.2)'; cx2.lineWidth = p === 50 ? 2.5 : 1.5; cx2.setLineDash(p === 50 ? [8, 6] : []); cx2.beginPath(); cx2.moveTo(x, 8); cx2.lineTo(x, h - 38); cx2.stroke(); cx2.setLineDash([]); cx2.fillStyle = '#a9c0e8'; cx2.fillText(p + '%', x, h - 10); }
  const done = st.revealed && clock - st.revealT > 3.4;
  if (done) { const x = PXc(TRUE_P); cx2.strokeStyle = '#ffd75a'; cx2.lineWidth = 5; cx2.beginPath(); cx2.moveTo(x, 4); cx2.lineTo(x, h - 38); cx2.stroke(); }
  show.forEach((p, i) => { const y = 24 + i * 29, col = LANES[p.li].css, miss = done && !p.hit; cx2.globalAlpha = miss ? 0.45 : 1; cx2.strokeStyle = col; cx2.lineWidth = i === 0 ? 9 : 6; cx2.lineCap = 'round'; cx2.beginPath(); cx2.moveTo(PXc(Math.max(p.lo, LO / 100)), y); cx2.lineTo(PXc(Math.min(p.hi, HI / 100)), y); cx2.stroke(); cx2.fillStyle = '#fff'; cx2.beginPath(); cx2.arc(PXc(clamp(p.p, LO / 100, HI / 100)), y, i === 0 ? 8 : 6, 0, 7); cx2.fill(); cx2.globalAlpha = 1; if (miss) { cx2.fillStyle = '#ff7a7a'; cx2.textAlign = 'left'; cx2.font = '700 20px Inter, sans-serif'; cx2.fillText('missed', PXc(Math.min(p.hi, 0.62)) + 14, y + 7); cx2.textAlign = 'center'; cx2.font = '600 22px Inter, sans-serif'; } });
  $('#legend').innerHTML = LANES.filter((l) => st.count[l.k]).map((l) => `<span><i style="background:${l.css}"></i>${l.label}</span>`).join('') + (st.polls.length ? '<span>Bar = poll ± margin</span>' : '');
}

// ---------- panel ----------
const panel = $('#panelBody');
const seg = (name, opts, q, cls = 'one') => `<div class="seg ${cls}">${opts.map((o, i) => `<label><input type="radio" name="${name}" value="${i}" ${q.sel === i ? 'checked' : ''} ${q.done ? 'disabled' : ''}><span>${o}</span></label>`).join('')}</div>`;
const nextBtn = (t, on = true) => `<div class="row"><button class="btn pri" data-act="next" ${on ? '' : 'disabled'}>${t}</button></div>`;
const order = (n, seed) => { const r = mulberry(seed), a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ORD = { q1: order(3, 5), q2: order(3, 9), q3: order(3, 2) };
const shuf = (name, Q, q) => seg(name, ORD[name].map((i) => Q.opts[i]), { sel: q.sel === null ? null : ORD[name].indexOf(q.sel), done: q.done });
// answer keys, computed from the model
const key = {
  q1() { const r = moeOf(0.5, 400) / moeOf(0.5, 100); let b = 0; Q1.vals.forEach((v, i) => { if (Math.abs(v - r) < Math.abs(Q1.vals[b] - r)) b = i; }); return b; },
  q2() { const p = st.q2poll; return p.lo > 0.5 ? 0 : p.hi < 0.5 ? 2 : 1; },
  q3() { const clubP = YES_L / NL, m6400 = moeOf(clubP, 6400), smaller = m6400 < moeOf(TRUE_P, 400), misses = Math.abs(clubP - TRUE_P) > m6400; return smaller ? (misses ? 0 : 1) : 2; },
};
const row = (k) => { const s = stats(k), L = LANES.find((l) => l.k === k); return s ? `<tr><th>${L.label}</th><td>${s.n}</td><td>± ${pc(s.moe)}</td><td>${pc(s.min, 0)} to ${pc(s.max, 0)}</td></tr>` : ''; };
const tbl = (ks) => `<div class="tw"><table class="stat"><thead><tr><th>Poll type</th><th>Polls</th><th>Margin</th><th>Results ran</th></tr></thead><tbody>${ks.map(row).join('')}</tbody></table></div>`;
const busy = () => st.queue.length > 0;

function render(keep = true) {
  const s = st.step, sc = $('#panel').scrollTop; document.body.dataset.state = s; layout();
  document.querySelectorAll('#steps li').forEach((li, i) => { const k = STEPS.indexOf(s); li.className = i === k ? 'cur' : i < k ? 'done' : ''; });
  let h = ''; const c = st.count, dis = busy() ? 'disabled' : '';
  if (s === 'brief') {
    h = `<p class="kick">Step 1 of 6</p><h2 tabindex="-1">The night before</h2><p>This stadium holds 50,000 people. Tomorrow they all vote Yes or No on Measure 7. Tonight nobody knows the result.</p><p>You run the poll. Every seat you ask lights up: gold for Yes, teal for No. Each finished poll drops a block on the field at its result.</p>
    <fieldset class="q"><legend>Before you start: to land within about 3 points of the real result, how many of the 50,000 do you need to ask?</legend>${seg('guess', GUESS, { sel: st.guess, done: st.guess !== null }, 'three')}</fieldset>`;
    if (st.guess !== null) h += `<p>Noted. You will check it yourself.</p>` + nextBtn('Run your first poll');
  } else if (s === 'sample') {
    const a = lane('r100');
    h = `<p class="kick">Step 2 of 6</p><h2 tabindex="-1">Ask 100 people</h2><p>Pick 100 seats at random. Every seat has the same chance.</p><div class="row"><button class="btn pri" data-act="p:r100" ${dis}>Poll 100 random seats</button>${c.r100 ? `<button class="btn" data-act="b:r100" ${dis}>Run 20 more</button>` : ''}</div>`;
    if (c.r100 === 1) h += `<p>Your poll says ${pc(a[0].p)}% Yes. Ask a different 100.</p>`;
    if (c.r100 >= 2) h += `<p>Same stadium, same night, different answers. Your ${c.r100} polls ran from ${pc(stats('r100').min, 0)}% to ${pc(stats('r100').max, 0)}% Yes. That scatter is sampling error. Nothing about the stadium changed.</p>`;
    if (c.r100 >= 2 && c.r100 < 10) h += `<p class="hint">Run at least 10 polls to see the pile take shape on the field.</p>`;
    if (c.r100 >= 10) {
      h += `<p>The margin of error puts a number on the scatter. For 100 people it is about ± ${pc(moeOf(0.5, 100))} points.</p><fieldset class="q"><legend>Next you will ask 400 seats instead of 100. Four times the people. What happens to the margin of error?</legend>${shuf('q1', Q1, st.q1)}</fieldset>`;
      if (st.q1.done) h += `<p class="fb ${st.q1.first ? 'good' : ''}">${st.q1.first ? 'Yes. ' : 'It is cut in half. '}The margin is 1.96 × √(p(1 − p)/n). Four times the sample gives half the margin: ± ${pc(moeOf(0.5, 100))} becomes ± ${pc(moeOf(0.5, 400))}. To halve it again you need 1,600.</p><p class="src">${cite('osStat')}</p>` + nextBtn('Try bigger samples');
      else if (st.q1.tries) h += `<p class="fb bad">${Q1.hint}</p>`;
    }
  } else if (s === 'size') {
    h = `<p class="kick">Step 3 of 6</p><h2 tabindex="-1">Buy precision</h2><p>Run polls of 400 and of 1,600 and watch the new piles on the field. Each one gets its own lane.</p>
    <div class="row"><button class="btn pri" data-act="p:r400" ${dis}>Poll 400</button><button class="btn" data-act="b:r400" ${dis}>Run 20</button></div><div class="row"><button class="btn pri" data-act="p:r1600" ${dis}>Poll 1,600</button><button class="btn" data-act="b:r1600" ${dis}>Run 20</button></div>${c.r400 < 10 || c.r1600 < 10 ? `<p class="hint">Run at least 10 of each size to continue. So far: ${c.r400} polls of 400 and ${c.r1600} polls of 1,600.</p>` : `<p class="hint">You have enough polls. Answer the question below.</p>`}${tbl(['r100', 'r400', 'r1600'])}`;
    if (c.r400 >= 10 && c.r1600 >= 10) {
      if (!st.q2poll) { const a = lane('r400'); st.q2poll = a.find((p) => p.p > 0.5 && p.lo < 0.5) || a[a.length - 1]; }
      const p = st.q2poll;
      h += `<p>The population is 50,000 either way. The margin depends on how many you ask, not on what share of the stadium that is.</p><fieldset class="q"><legend>Your poll ${p.id} asked 400 seats and said ${pc(p.p)}% Yes, margin ± ${pc(p.moe)}. A headline reads "Measure 7 leads." What does this one poll support?</legend>${shuf('q2', Q2, st.q2)}</fieldset>`;
      if (st.q2.done) h += `<p class="fb ${st.q2.first ? 'good' : ''}">The range runs from ${pc(p.lo)}% to ${pc(p.hi)}%. ${key.q2() === 1 ? 'It includes 50, so this poll cannot say which side is ahead.' : key.q2() === 0 ? 'All of it sits above 50.' : 'All of it sits below 50.'} With two options, the margin on the lead is about twice the margin on one side's share.</p><p class="src">${cite('pewMoe')} · ${cite('osGov')}</p>` + nextBtn('Get a bigger sample, cheap');
      else if (st.q2.tries) h += `<p class="fb bad">${Q2.hint}</p>`;
    }
  } else if (s === 'list') {
    h = `<p class="kick">Step 4 of 6</p><h2 tabindex="-1">Two shortcuts</h2><p>Random seats are slow to reach. A donor hands you the season-ticket list: 12,000 people in the lower bowl, with phone numbers. You can call 6,400 of them tonight. That is 16 times your poll of 400.</p>
    <fieldset class="q"><legend>Compared with 400 random seats, a poll of 6,400 from the club list will have:</legend>${shuf('q3', Q3, st.q3)}</fieldset>`;
    if (!st.q3.done && st.q3.tries) h += `<p class="fb bad">${Q3.hint}</p>`;
    if (st.q3.done) {
      h += `<div class="row"><button class="btn pri" data-act="p:club" ${dis}>Poll 6,400 from the club list</button></div>`;
      if (c.club) { const p = lane('club').slice(-1)[0]; h += `<p>${pc(p.p)}% Yes, margin ± ${pc(p.moe)}. Only the lower bowl lit up.</p><p>Second shortcut: skip the list. Put a ballot on every one of the 50,000 seats and count what comes back.</p><div class="row"><button class="btn pri" data-act="p:mail" ${dis}>Mail all 50,000</button></div>`; }
      if (c.mail) { const p = lane('mail').slice(-1)[0]; h += `<p>${nf(p.n)} ballots came back, a ${pc(p.n / N, 0)}% response. ${pc(p.p)}% Yes, margin ± ${pc(p.moe)}.</p><p class="fb">Both shortcuts report a margin under 2 points. A margin of error is computed from the sample size alone. It has not been checked against the vote.</p>${tbl(['r1600', 'club', 'mail'])}` + nextBtn('Election night'); }
    }
  } else if (s === 'vote') {
    h = `<p class="kick">Step 5 of 6</p><h2 tabindex="-1">Election night</h2>`;
    if (!st.revealed) h += `<p>The polls are closed. Every seat now shows its vote.</p><div class="row"><button class="btn pri big" data-act="count">Count the vote</button></div>`;
    else if (clock - st.revealT < 3.6) h += `<p>Counting…</p>`;
    else {
      const hits = LANES.map((l) => { const x = stats(l.k); return x ? `<tr><th>${l.label}</th><td>${pc(x.mean)}%</td><td>± ${pc(x.moe)}</td><td>${x.hits} of ${x.n}</td></tr>` : ''; }).join('');
      h += `<p>Measure 7 passes with ${nf(N * TRUE_P)} of ${nf(N)} votes: <b>53.0% Yes</b>. The gold line on the field marks it.</p><div class="tw"><table class="stat"><thead><tr><th>Poll type</th><th>Average</th><th>Margin</th><th>Ranges that caught 53.0</th></tr></thead><tbody>${hits}</tbody></table></div>
      <p>Name the error in each case.</p><div class="prog"><i style="width:${((st.cls.i + (st.cls.done ? 1 : 0)) / CLASSIFY.length) * 100}%"></i></div>`;
      const k = st.cls.i, C = CLASSIFY[k];
      h += `<fieldset class="q"><legend>${k + 1} of ${CLASSIFY.length}. ${C.q}</legend>${seg('cls', KINDS, st.cls, 'three')}</fieldset>`;
      if (st.cls.done) h += `<p class="fb ${st.cls.first[k] ? 'good' : ''}">${C.ok}</p>` + nextBtn(k < CLASSIFY.length - 1 ? 'Next case' : 'This happened in 1936');
      else if (st.cls.tries) h += `<p class="fb bad">${C.no}</p>`;
    }
  } else if (s === 'debrief') {
    const pts = [st.q1.first, st.q2.first, st.q3.first, ...CLASSIFY.map((_, i) => st.cls.first[i])], n = pts.filter(Boolean).length, s16 = stats('r1600'), cl = stats('club'), ml = stats('mail');
    h = `<p class="kick">Step 6 of 6</p><h2 tabindex="-1">The Literary Digest, 1936</h2>
    <p>In 1936 The Literary Digest mailed about 10 million straw ballots, most of them to names from telephone books and car registrations. 2,376,523 came back: 1,293,669 for Alf Landon and 972,897 for Franklin Roosevelt. That is 57 percent of the two-party tally for Landon.</p>
    <p>Roosevelt won 60.8 percent of the vote to Landon's 36.5 and carried 46 of 48 states.</p>
    <p class="mis">Scholars disagree on the cause. Squire (1988) found that the list and the low response both biased the result. Lusinchi (2012) argues the list was not the problem and nonresponse was. You ran both in this stadium.</p>
    <p class="src">${cite('lus')} · ${cite('squire')} · ${cite('app')}</p>
    <h3>Your night</h3><p class="big2">${n} of ${pts.length} on the first try</p>
    <ul class="obj"><li class="${pts[0] ? 'ok' : 'no'}"><span class="mark">${pts[0] ? '✓' : '·'}</span><div>Predict how sample size changes the margin<small>${st.guess === null ? '' : `Your opening guess was ${GUESS[st.guess].toLowerCase()}. `}${s16 ? `Your ${s16.n} polls of 1,600 carried a margin of ± ${pc(s16.moe)} and ${s16.hits} of them caught the result. ` : ''}About 1,000 gives ± ${pc(moeOf(0.5, 1000))}.</small></div></li>
    <li class="${pts[1] ? 'ok' : 'no'}"><span class="mark">${pts[1] ? '✓' : '·'}</span><div>Interpret a poll with its margin<small>${st.q2poll ? `Poll ${st.q2poll.id}: ${pc(st.q2poll.p)}% ± ${pc(st.q2poll.moe)}.` : ''}</small></div></li>
    <li class="${pts.slice(2).every(Boolean) ? 'ok' : 'no'}"><span class="mark">${pts.slice(2).every(Boolean) ? '✓' : '·'}</span><div>Tell sampling error from bias<small>${cl ? `Your club list poll said ${pc(cl.mean)}% ± ${pc(cl.moe)}. ` : ''}${ml ? `Your mail-in poll said ${pc(ml.mean)}% ± ${pc(ml.moe)}. ` : ''}The vote was 53.0%. ${pts.slice(2).filter(Boolean).length} of ${pts.length - 2} questions right on the first try.</small></div></li></ul>
    <h3>Your answers, in the order you gave them</h3><ul class="try">${trail().map((t) => `<li>${t}</li>`).join('')}</ul>
    <p class="hint">First answers are kept even when a second try was right. A first answer is where a common idea shows.</p>${EF.html()}
    <h3>Where this shows up</h3><div class="cards">${FIELDS.map((f) => `<div class="cardf"><h4>${f.h}</h4><p>${f.p}${f.k ? ` <span class="src">${cite(f.k)}${f.k2 ? ' · ' + cite(f.k2) : ''}</span>` : ''}</p></div>`).join('')}</div>
    <h3>Take it further</h3><p>A news story reports an online survey with 20,000 responses, shared through social media. What does that number tell you about the margin of error? What does it not tell you?</p>
    <div class="row"><button class="btn" data-act="again">Play again</button><button class="btn" data-act="about">Sources and method</button></div>`;
  }
  panel.innerHTML = h; $('#panel').scrollTop = keep ? sc : 0; hud();
  // a new question or the Next button must never sit unseen below the fold
  { const P = $('#panel'), nx = panel.querySelector('[data-act=next]'), q = panel.querySelector('fieldset.q input:not(:disabled)'), tgt = nx || (q && q.closest('fieldset'));
    const key = s + ':' + (nx ? 'next' : q ? q.name : '');
    if (tgt && keep && key !== st.seenKey) { const r = tgt.getBoundingClientRect(), pr = P.getBoundingClientRect(); if (r.bottom > pr.bottom - 8 || r.top < pr.top) tgt.scrollIntoView({ block: nx ? 'nearest' : 'center' }); tgt.classList.add('flash'); }
    st.seenKey = tgt ? key : null; }
}
function focusH() { const h2 = panel.querySelector('h2'); if (h2) h2.focus({ preventScroll: true }); }
function go(step) {
  st.step = step; cam.spin = step === 'title' || step === 'debrief';
  const wide = ['title', 'brief', 'debrief'].includes(step); cam.wT = wide ? 215 : step === 'vote' ? 190 : 128; cam.hT = wide ? 100 : step === 'vote' ? 90 : 62;
  cam.pitchT = wide ? 0.5 : 0.66; if (!cam.spin) cam.yawT = step === 'vote' ? 0.75 : 0.42;
  render(false); focusH();
}
EF.watch(() => { if (!document.querySelector('#panel fieldset.q input:not(:disabled), #panelBody fieldset.q input:not(:disabled)')) return null; return { brief: 'Opening guess', sample: 'Four times the sample', size: 'Reading a poll with its margin', list: 'The club list', vote: 'Error case ' + (st.cls.i + 1) }[st.step] || null; });
function trail() {
  const QN = { q1: ['Four times the sample', Q1], q2: ['Reading a poll with its margin', Q2], q3: ['The club list of 6,400', Q3] }, out = [];
  if (st.guess !== null) out.push(`Opening guess, before any poll: ${GUESS[st.guess].toLowerCase()}.`);
  for (const k of ['q1', 'q2', 'q3']) { const picks = st.log.filter((l) => l.what === k); if (!picks.length) continue; const lab = (l) => (QN[k][1].opts ? QN[k][1].opts[l.sel] : QN[k][1].labels ? QN[k][1].labels[l.sel] : String(l.sel)); out.push(`${QN[k][0]}. First answer: "${lab(picks[0])}" ${picks[0].ok ? '✓' : '✕'}${picks.length > 1 ? `. After the hint: "${lab(picks[1])}" ${picks[1].ok ? '✓' : '✕'}` : ''}.`); }
  CLASSIFY.forEach((C, i) => { const picks = st.log.filter((l) => l.what === 'cls' && l.k === i); if (!picks.length) return; out.push(`"${C.q}" You said: ${picks.map((l) => KINDS[l.sel].toLowerCase() + (l.ok ? ' ✓' : ' ✕')).join(', then ')}.`); });
  return out;
}
function answer(name, i) {
  const two = (q, sel, ok) => { if (q.done) return; q.sel = sel; q.tries++; if (q.first === null) q.first = ok; if (ok || q.tries > 1) q.done = true; log(name, { sel, ok }); };
  if (name === 'guess') { if (st.guess === null) { st.guess = i; log('guess', { i }); } }
  else if (name === 'cls') { const q = st.cls; if (q.done) return; q.sel = i; q.tries++; const ok = i === CLASSIFY[q.i].ans; if (q.first[q.i] === undefined) q.first[q.i] = ok; if (ok) q.done = true; log('cls', { k: q.i, sel: i, ok }); }
  else { const sel = ORD[name][i]; two(st[name], sel, sel === key[name]()); }
  render();
}
function act(a) {
  if (a === 'begin') go('brief');
  else if (a === 'about') { $('#aboutBody').innerHTML = ABOUT; $('#modal').hidden = false; $('#modalClose').focus(); }
  else if (a === 'closeAbout') $('#modal').hidden = true;
  else if (a.startsWith('p:')) { const r = poll(a.slice(2), { sweep: true }); log('poll', { k: r.k, p: r.p, n: r.n }); if (st.polls.filter((q) => q.k === r.k).length > 10) EF.extra('Extra polls'); render(); }
  else if (a.startsWith('b:')) { for (let i = 0; i < 20; i++) st.queue.push(a.slice(2)); log('batch', { k: a.slice(2) }); render(); }
  else if (a === 'count') { st.revealed = true; st.revealT = clock; const A = aState.array, T = aT.array; for (let i = 0; i < N; i++) { A[i] = S.pref[i] ? 1 : 2; T[i] = clock + ((S.pos[i * 3] + S.rim.x) / (2 * S.rim.x)) * 3.2; } aState.needsUpdate = aT.needsUpdate = true; seatMat.uniforms.uLit.value = 0.62; seatMat.uniforms.uPop.value = 0.45; truth.visible = true; cam.spin = true; log('count'); render(); st.pending = true; }
  else if (a === 'again') location.href = location.pathname + location.search;
  else if (a === 'next') { EF.resolved(); if (st.step === 'vote' && st.cls.i < CLASSIFY.length - 1) { st.cls.i++; st.cls.sel = null; st.cls.tries = 0; st.cls.done = false; render(); } else go(STEPS[STEPS.indexOf(st.step) + 1]); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act); else if (e.target.id === 'modal') act('closeAbout'); });
document.addEventListener('change', (e) => { if (e.target.type === 'radio') answer(e.target.name, +e.target.value); });
let down = null;
const drag = (dx, dy) => { cam.yawT = cam.yaw = cam.yaw - dx * 0.005; cam.pitchT = cam.pitch = clamp(cam.pitch + dy * 0.004, 0.22, 1.35); cam.spin = false; };
addEventListener('keydown', (e) => { if (e.key === 'Escape') act('closeAbout'); if (document.activeElement !== canvas) return; const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (d) { drag(d[0] * 24, d[1] * 24); e.preventDefault(); } });
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!down) return; drag(e.clientX - down.x, e.clientY - down.y); down.x = e.clientX; down.y = e.clientY; });
canvas.addEventListener('pointerup', () => { down = null; }); canvas.addEventListener('pointercancel', () => { down = null; });
canvas.addEventListener('wheel', (e) => { cam.zoom = clamp(cam.zoom * (1 + e.deltaY * 0.001), 0.5, 1.5); e.preventDefault(); }, { passive: false });

// ---------- loop ----------
let clock = 0, demoT = 1.5; const tgt = V(0, 5, 0);
function tick(dt) {
  clock += dt;
  if (st.queue.length) { st.qT -= dt; if (st.qT <= 0) { poll(st.queue.shift(), { quiet: st.queue.length > 0 }); st.qT = 0.12; if (!st.queue.length) render(); } }
  if (st.step === 'title') { demoT -= dt; if (demoT <= 0) { demoT = 3.2; light(sample('rand', 1600).idx, true); } }
  if (st.pending && clock - st.revealT > 3.6) { st.pending = false; render(); }
  if (st.revealed && clock - st.revealT < 4) hud();
  truth.material.opacity = st.revealed ? 0.2 * clamp((clock - st.revealT - 3.2) / 1.2, 0, 1) : 0;
  let moved = false; for (const s of slabList) if (s.y > s.ty) { s.v += 160 * dt; s.y = Math.max(s.ty, s.y - s.v * dt); _m.makeTranslation(s.x, s.y, s.z); slabs.setMatrixAt(s.i, _m); moved = true; } if (moved) slabs.instanceMatrix.needsUpdate = true;
  if (cam.spin) cam.yawT += dt * 0.07;
  const k = Math.min(1, dt * 2.2); cam.yaw += (cam.yawT - cam.yaw) * k; cam.pitch += (cam.pitchT - cam.pitch) * k; cam.w += (cam.wT - cam.w) * k; cam.h += (cam.hT - cam.h) * k;
}
function draw3() {
  const t = Math.tan((camera.fov * Math.PI) / 360), ph = isPhone();
  const d = Math.max((cam.h * H) / (2 * t * view.fh), (cam.w * (ph ? 0.62 : 1) * H) / (2 * t * view.fw)) * cam.zoom;
  camera.position.set(tgt.x + d * Math.sin(cam.yaw) * Math.cos(cam.pitch), tgt.y + d * Math.sin(cam.pitch), tgt.z + d * Math.cos(cam.yaw) * Math.cos(cam.pitch)); camera.lookAt(tgt);
  camera.setViewOffset(W, H, W / 2 - view.cx, H / 2 - view.cy, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  seatMat.uniforms.uTime.value = clock; seatMat.uniforms.uScale.value = H / (2 * t);
  glow.begin(); for (const p of towers) glow.add(p.x, p.y, p.z, 0.7, 0.75, 1.0, 16); for (let i = 0; i < stars.length; i += 4) { const tw = 0.5 + 0.5 * Math.sin(clock * (0.6 + stars[i + 3]) + i); glow.add(stars[i], stars[i + 1], stars[i + 2], 0.7 * tw, 0.75 * tw, 1.0 * tw, 1.6 + stars[i + 3] * 2.2); } glow.end(); glow.mat.uniforms.uScale.value = H * 0.9; glow.mat.uniforms.uFog.value = 0;
  composer.render(); placeLabels();
}
let last = performance.now();
function frame(now) { const dt = Math.min(DTCAP, (now - last) / 1000); last = now; tick(dt); draw3(); requestAnimationFrame(frame); }

// ---------- test hook ----------
window.__demo = { go, act, answer, poll, st, cam, key, stats,
  warm(sec) { for (let t = 0; t < sec; t += 0.05) tick(0.05); draw3(); },
  state: () => ({ step: st.step, polls: st.polls.length, count: st.count, guess: st.guess, q1: st.q1, q2: st.q2, q3: st.q3, cls: st.cls, revealed: st.revealed, keys: { q1: key.q1(), q3: key.q3(), q2: st.q2poll ? key.q2() : null }, slabs: slabList.length }),
  // model check: population counts, then many draws of each kind without touching the scene
  verify(reps = 2000) { let yes = 0, yl = 0; for (let i = 0; i < N; i++) { yes += S.pref[i]; if (i < NL) yl += S.pref[i]; } const out = { seats: S.pos.length / 3, yes, yesLower: yl };
    for (const [m, n] of [['rand', 100], ['rand', 400], ['rand', 1600], ['club', 6400], ['mail', 0]]) { let sum = 0, sq = 0, hit = 0, nn = 0; const R = m === 'mail' ? 40 : reps; for (let r = 0; r < R; r++) { const s = sample(m, n), p = s.yes / s.n, e = moeOf(p, s.n); sum += p; sq += p * p; nn += s.n; if (p - e <= TRUE_P && TRUE_P <= p + e) hit++; } const mean = sum / R; out[m + n] = { mean: +mean.toFixed(4), sd: +Math.sqrt(sq / R - mean * mean).toFixed(4), cover: +(hit / R).toFixed(3), n: Math.round(nn / R) }; } return out; } };

resize(); render(false); requestAnimationFrame(frame);
