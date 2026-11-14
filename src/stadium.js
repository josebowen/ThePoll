// The stadium: 50,000 seats on a rounded bowl, each with a fixed vote. Lower bowl = the "club list".
import * as THREE from 'three';
import { mulberry } from './fx.js';
export const N = 50000, NL = 12000, YES_L = 4920, YES_U = 21580; // 26,500 Yes = 53.0%
export const A0 = 46, B0 = 28;
const EXP = 3.2, SP = 0.46;
const pt = (d, t) => { const c = Math.cos(t), s = Math.sin(t), e = 2 / EXP; return [(A0 + d) * Math.sign(c) * Math.abs(c) ** e, (B0 + d) * Math.sign(s) * Math.abs(s) ** e]; };

export function buildStadium() {
  const pos = new Float32Array(N * 3), ang = new Float32Array(N); let n = 0;
  const placeRow = (d, y, max) => {
    const M = 720, P = [], L = [0]; for (let i = 0; i <= M; i++) { P.push(pt(d, (i / M) * Math.PI * 2)); if (i) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); }
    const cnt = Math.min(max, Math.floor(L[M] / SP)); let j = 0;
    for (let k = 0; k < cnt; k++) { const s = ((k + 0.5) / cnt) * L[M]; while (L[j + 1] < s) j++; const u = (s - L[j]) / (L[j + 1] - L[j]); const x = P[j][0] + (P[j + 1][0] - P[j][0]) * u, z = P[j][1] + (P[j + 1][1] - P[j][1]) * u; pos[n * 3] = x; pos[n * 3 + 1] = y + 0.3; pos[n * 3 + 2] = z; ang[n] = Math.atan2(z, x); n++; }
    return cnt;
  };
  let r = 0, d = 3, y = 0.9; while (n < NL) { d = 3 + r * 0.72; y = 0.9 + r * 0.42; placeRow(d, y, NL - n); r++; }
  const dL = d, yL = y, dU0 = dL + 4.2, yU0 = yL + 4.6; r = 0;
  while (n < N) { d = dU0 + r * 0.66; y = yU0 + r * 0.6; placeRow(d, y, N - n); r++; }
  const dU1 = d, yU1 = y;
  // votes: exact counts, seeded
  const pref = new Uint8Array(N), rnd = mulberry(1936);
  const assign = (a, b, yes) => { const idx = []; for (let i = a; i < b; i++) idx.push(i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } for (let i = 0; i < yes; i++) pref[idx[i]] = 1; };
  assign(0, NL, YES_L); assign(NL, N, YES_U);
  // concrete
  const prof = [[1.6, -0.2], [1.6, 0.6], [dL + 0.7, yL + 0.3], [dL + 3.4, yL + 0.3], [dL + 3.4, yU0 - 0.5], [dU1 + 0.9, yU1 + 0.3], [dU1 + 0.9, yU1 + 2.4], [dU1 + 2.6, yU1 + 2.4], [dU1 + 5, -0.5]];
  const M = 144, v = [], idx = [];
  prof.forEach(([dd, yy]) => { for (let i = 0; i <= M; i++) { const [x, z] = pt(dd, (i / M) * Math.PI * 2); v.push(x, yy, z); } });
  for (let p = 0; p < prof.length - 1; p++) for (let i = 0; i < M; i++) { const a = p * (M + 1) + i, b = a + 1, c = a + M + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
  const tiers = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x141b2e, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
  return { pos, ang, pref, tiers, rim: { x: A0 + dU1 + 5, z: B0 + dU1 + 5, y: yU1 + 2.4 }, rows: { dL, yL, dU0, yU0, dU1, yU1 } };
}
