/* FLOW — audience flow sketching tool by Tastbaar
   Static, no dependencies. World units are metres; 1 m = 24 px at 100%. */
(() => {
'use strict';

const VERSION = '0.2';
const PX = 24;            // px per metre at zoom 1
const CELL = 0.25;        // navigation grid cell (m)
const AGENT_R = 0.22;     // body radius (m)
const MAX_AGENTS = 3000;
const MONO = '"Courier Prime", "Courier New", Courier, monospace';
const ACCENT = window.TB_ACCENT || '#0ff';
const STORE = 'tastbaar-flow-doc';
const STORE_SEEN = 'tastbaar-flow-seen';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const uid = p => p + '_' + Math.random().toString(36).slice(2, 8);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, def, a, b) => { v = +v; return Number.isFinite(v) ? clamp(v, a, b) : def; };
const fmtTime = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const canIn = d => d.type !== 'out';
const canOut = d => d.type !== 'in';
const TYPE_LABEL = { in: 'IN', out: 'OUT', both: 'IN/OUT', pass: 'PASSAGE' };
const PLAN_LABEL = { in: 'IN', out: 'OUT', both: 'IN/OUT', pass: 'PASS' };
const twoSided = d => d.type === 'both' || d.type === 'pass';

/* =========================================================
   Document
   ========================================================= */
const DEFAULTS = { rate: 15, total: 0, pace: 1.0, curiosity: 0.5 };

function newDoc() {
  return { app: 'tastbaar-flow', version: 1, name: 'UNTITLED', rooms: [], doors: [], elements: [], arrows: [], links: [], labels: [], settings: { ...DEFAULTS } };
}

function exampleDoc() {
  const d = newDoc();
  d.name = 'EXAMPLE';
  d.rooms.push({ id: 'r_foyer', name: 'Foyer', flow: 0.6, pts: [[0, 0], [14, 0], [14, 10], [0, 10]] });
  d.rooms.push({ id: 'r_gallery', name: 'Gallery', flow: 0.6, pts: [[18, -4], [36, -4], [36, 14], [27, 14], [27, 6], [18, 6]] });
  d.doors.push({ id: 'd_in', room: 'r_foyer', edge: 3, t: 0.5, w: 2.0, type: 'in' });
  d.doors.push({ id: 'd_fout', room: 'r_foyer', edge: 1, t: 0.3, w: 1.6, type: 'out' });
  d.doors.push({ id: 'd_gin', room: 'r_gallery', edge: 5, t: 0.6, w: 1.6, type: 'in' });
  d.doors.push({ id: 'd_gout', room: 'r_gallery', edge: 2, t: 0.5, w: 1.6, type: 'out' });
  d.links.push({ id: 'l_1', from: 'd_fout', to: 'd_gin' });
  // a side room with one doorway: people go in, look, and come back the same way
  d.rooms.push({ id: 'r_side', name: 'Archive', flow: 0.6, pts: [[38.5, -2], [44.5, -2], [44.5, 4], [38.5, 4]] });
  d.doors.push({ id: 'd_gp', room: 'r_gallery', edge: 1, t: 5 / 18, w: 1.4, type: 'pass' });
  d.doors.push({ id: 'd_sp', room: 'r_side', edge: 3, t: 0.5, w: 1.4, type: 'pass' });
  d.links.push({ id: 'l_2', from: 'd_gp', to: 'd_sp' });
  // edges of a rectangle: 0 top, 1 right, 2 bottom, 3 left
  const el = (id, name, pts, attr, dwell, views = [], solid = true, near = 0) => d.elements.push(syncEl({ id, name, pts, attr, dwell, views, solid, near }));
  el('e_tix', 'Tickets', rectPts(4, 2.2, 3, 1), 3, 15, [2]);
  el('e_intro', 'Intro screen', rectPts(9.5, 9.6, 3, 0.3), 6, 30, [0], true, 1.5);
  el('e_pa', 'Painting A', rectPts(21.5, -3.75, 3, 0.2), 7, 25, [2], true, 1);
  el('e_pb', 'Painting B', rectPts(30, -3.75, 3, 0.2), 5, 20, [2], true, 1);
  el('e_sc', 'Sculpture', roundPts(23, 1.5, 1.4), 9, 40);
  el('e_vi', 'Vitrine', [[33, 1.5], [34.2, 2], [34.2, 4.2], [33, 4.6]], 6, 20, [0, 2, 3]);
  el('e_vid', 'Video', rectPts(35.8, 10, 0.2, 3), 8, 60, [3], true, 2.5);
  el('e_arch', 'Archive box', rectPts(42.5, 1, 1.6, 2.4), 6, 30);
  el('e_floor', 'Floor text', rectPts(31.5, 11.5, 2.5, 1.5), 4, 10, [], false);
  d.arrows.push({ id: 'a_1', x1: 2, y1: 5, x2: 11, y2: 4 });
  d.arrows.push({ id: 'a_2', x1: 20, y1: 2.5, x2: 31, y2: 0.5 });
  d.arrows.push({ id: 'a_3', x1: 33, y1: 6, x2: 31.5, y2: 12 });
  d.labels.push({ id: 't_1', x: -0.5, y: 12, text: 'Street side\nQueue forms here at opening', style: 'text' });
  return d;
}

function normalize(d) {
  const n = newDoc();
  if (!d || typeof d !== 'object') return n;
  n.name = String(d.name || 'UNTITLED').slice(0, 60);
  n.rooms = (Array.isArray(d.rooms) ? d.rooms : [])
    .filter(r => r && Array.isArray(r.pts) && r.pts.length >= 3)
    .map(r => ({ id: String(r.id || uid('r')), name: String(r.name || 'Room'), flow: num(r.flow, 0.6, 0, 1), pts: r.pts.map(p => [+p[0] || 0, +p[1] || 0]) }));
  const rids = new Set(n.rooms.map(r => r.id));
  n.doors = (Array.isArray(d.doors) ? d.doors : [])
    .filter(x => x && rids.has(x.room))
    .map(x => ({ id: String(x.id || uid('d')), room: x.room, edge: Math.max(0, x.edge | 0), t: num(x.t, 0.5, 0, 1), w: num(x.w, 1.6, 0.4, 100), type: ['in', 'out', 'both', 'pass'].includes(x.type) ? x.type : 'both' }));
  n.elements = (Array.isArray(d.elements) ? d.elements : []).filter(e => e && Array.isArray(e.pts) && e.pts.length >= 3).map(e => {
    const pts = e.pts.map(p => [+p[0] || 0, +p[1] || 0]);
    const views = (Array.isArray(e.views) ? e.views : []).map(v => v | 0).filter((v, i, a) => v >= 0 && v < pts.length && a.indexOf(v) === i);
    return syncEl({ id: String(e.id || uid('e')), name: String(e.name || 'Element'), pts, views,
      attr: num(e.attr, 5, 1, 10), dwell: num(e.dwell, 20, 0, 3600), near: num(e.near, 0, 0, 50), solid: e.solid !== false });
  });
  n.arrows = (Array.isArray(d.arrows) ? d.arrows : []).filter(Boolean).map(a => ({ id: String(a.id || uid('a')), x1: +a.x1 || 0, y1: +a.y1 || 0, x2: +a.x2 || 0, y2: +a.y2 || 0 }));
  const dids = new Set(n.doors.map(x => x.id));
  n.links = (Array.isArray(d.links) ? d.links : []).filter(l => l && dids.has(l.from) && dids.has(l.to)).map(l => ({ id: String(l.id || uid('l')), from: l.from, to: l.to }));
  n.labels = (Array.isArray(d.labels) ? d.labels : []).filter(Boolean).map(t => ({ id: String(t.id || uid('t')), x: +t.x || 0, y: +t.y || 0, text: String(t.text == null ? 'Label' : t.text).slice(0, 400), style: t.style === 'text' ? 'text' : 'box' }));
  const s = d.settings || {};
  n.settings = { rate: num(s.rate, DEFAULTS.rate, 0, 600), total: Math.round(num(s.total, 0, 0, 1e6)), pace: num(s.pace, DEFAULTS.pace, 0.2, 3), curiosity: num(s.curiosity, DEFAULTS.curiosity, 0, 1) };
  return n;
}

let doc = newDoc();

/* =========================================================
   Geometry
   ========================================================= */
function pip(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = clamp(t, 0, 1);
  const qx = ax + t * dx, qy = ay + t * dy;
  return { d: Math.hypot(px - qx, py - qy), t, x: qx, y: qy };
}
function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a / 2);
}
function bboxOf(pts) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of pts) { if (p[0] < minx) minx = p[0]; if (p[1] < miny) miny = p[1]; if (p[0] > maxx) maxx = p[0]; if (p[1] > maxy) maxy = p[1]; }
  return { minx, miny, maxx, maxy };
}
// signed distance to the element's outline (negative inside)
function elDist(e, x, y) {
  const p = e.pts, n = p.length;
  let m = Infinity;
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; const d = segDist(x, y, a[0], a[1], b[0], b[1]).d; if (d < m) m = d; }
  return pip(x, y, p) ? -m : m;
}
const elH = e => e.h;
const rectPts = (x, y, w, h) => [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]];
function roundPts(x, y, dia, n = 16) {
  const r = dia / 2, out = [];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2; out.push([+(x + Math.cos(a) * r).toFixed(3), +(y + Math.sin(a) * r).toFixed(3)]); }
  return out;
}
// x, y, w, h are kept in step with the outline (bounding box), for labels and quick checks
function syncEl(e) {
  const bb = bboxOf(e.pts);
  e.x = (bb.minx + bb.maxx) / 2; e.y = (bb.miny + bb.maxy) / 2;
  e.w = Math.max(0.01, bb.maxx - bb.minx); e.h = Math.max(0.01, bb.maxy - bb.miny);
  return e;
}
function scaleEl(e, w, h) {
  const sx = w / e.w, sy = h / e.h, cx = e.x, cy = e.y;
  e.pts = e.pts.map(p => [+(cx + (p[0] - cx) * sx).toFixed(3), +(cy + (p[1] - cy) * sy).toFixed(3)]);
  syncEl(e);
}
// the sides of a polygon, each with its outward normal
function polyEdges(pts) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
    let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (pip(mx + nx * 0.01, my + ny * 0.01, pts)) { nx = -nx; ny = -ny; }
    out.push({ i, ax: a[0], ay: a[1], bx: b[0], by: b[1], L, nx, ny, mx, my });
  }
  return out;
}
const viewEdges = e => { const E = polyEdges(e.pts); return e.views && e.views.length ? E.filter(x => e.views.includes(x.i)) : E; };
const hasViews = e => !!(e.views && e.views.length);
// where someone standing at (x, y) looks: the nearest viewing side, or the middle
function lookPoint(e, x, y) {
  if (!hasViews(e)) return [e.x, e.y];
  let best = null;
  for (const E of viewEdges(e)) { const s = segDist(x, y, E.ax, E.ay, E.bx, E.by); if (!best || s.d < best.d) best = s; }
  return best ? [best.x, best.y] : [e.x, e.y];
}
const noticeR = e => 1.2 + e.attr * 0.4;
// how many people can look at it comfortably at once
const capacity = e => {
  const r = (e.near || 0) + 0.45;   // the line people stand on
  if (!hasViews(e)) return Math.max(2, Math.round((polyEdges(e.pts).reduce((t, E) => t + E.L, 0) + 2 * Math.PI * r) / 0.75));
  return Math.max(2, Math.round(viewEdges(e).reduce((t, E) => t + E.L + 2 * r, 0) / 0.75));
};

const roomById = id => doc.rooms.find(r => r.id === id);
const doorById = id => doc.doors.find(d => d.id === id);
const elById = id => doc.elements.find(e => e.id === id);
function roomAt(x, y) {
  for (let i = doc.rooms.length - 1; i >= 0; i--) if (pip(x, y, doc.rooms[i].pts)) return doc.rooms[i];
  return null;
}

/* ---------- cached derived geometry (rebuilt after every edit) ---------- */
let ver = 0, geo = null;
function G() {
  if (!geo || geo.ver !== ver) geo = { ver, door: new Map(), elRoom: new Map(), arRoom: new Map(), walls: new Map(), nav: new Map() };
  return geo;
}
function invalidate() { ver++; needsRender = true; }

function elRoomId(e) {
  const g = G();
  if (!g.elRoom.has(e.id)) { const r = roomAt(e.x, e.y); g.elRoom.set(e.id, r ? r.id : null); }
  return g.elRoom.get(e.id);
}
function arRoomId(a) {
  const g = G();
  if (!g.arRoom.has(a.id)) { const r = roomAt((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2) || roomAt(a.x1, a.y1); g.arRoom.set(a.id, r ? r.id : null); }
  return g.arRoom.get(a.id);
}

function doorG(d) {
  const g = G();
  if (g.door.has(d.id)) return g.door.get(d.id);
  let v = null;
  const room = roomById(d.room);
  if (room) {
    const pts = room.pts, n = pts.length, e = Math.min(d.edge, n - 1);
    const a = pts[e], b = pts[(e + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > 1e-6) {
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      const w = Math.min(d.w, L);
      const c = clamp(d.t * L, w / 2, L - w / 2);
      const mx = a[0] + ux * c, my = a[1] + uy * c;
      let nx = -uy, ny = ux;
      if (!pip(mx + nx * 0.05, my + ny * 0.05, pts)) { nx = -nx; ny = -ny; }
      v = { edge: e, L, w, ux, uy, nx, ny, mx, my, t0: (c - w / 2) / L, t1: (c + w / 2) / L,
        x0: mx - ux * w / 2, y0: my - uy * w / 2, x1: mx + ux * w / 2, y1: my + uy * w / 2 };
    }
  }
  g.door.set(d.id, v);
  return v;
}

function wallSegs(room) {
  const g = G();
  let w = g.walls.get(room.id);
  if (w) return w;
  w = [];
  const n = room.pts.length;
  const ds = doc.doors.filter(d => d.room === room.id).map(doorG).filter(Boolean);
  for (let e = 0; e < n; e++) {
    const a = room.pts[e], b = room.pts[(e + 1) % n];
    const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const cuts = ds.filter(q => q.edge === e).sort((p, q) => p.t0 - q.t0);
    let t = 0;
    for (const q of cuts) {
      if (q.t0 > t + 1e-6) { const p0 = at(t), p1 = at(q.t0); w.push([p0[0], p0[1], p1[0], p1[1]]); }
      t = Math.max(t, q.t1);
    }
    if (t < 1 - 1e-6) { const p0 = at(t), p1 = at(1); w.push([p0[0], p0[1], p1[0], p1[1]]); }
  }
  g.walls.set(room.id, w);
  return w;
}

function nearestEdgeOf(room, x, y) {
  let best = null;
  const n = room.pts.length;
  for (let e = 0; e < n; e++) {
    const a = room.pts[e], b = room.pts[(e + 1) % n];
    const s = segDist(x, y, a[0], a[1], b[0], b[1]);
    if (!best || s.d < best.d) best = { room, edge: e, t: s.t, d: s.d, x: s.x, y: s.y, L: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  }
  return best;
}
function nearestEdgeAll(x, y) {
  let best = null;
  for (const r of doc.rooms) { const ne = nearestEdgeOf(r, x, y); if (!best || ne.d < best.d) best = ne; }
  return best;
}

// rooms and elements share corner editing. Doors (rooms) and viewing sides (elements) follow their edge.
const isRoom = o => doc.rooms.includes(o);
function insertVertex(room, i, p, s) {
  room.pts.splice(i + 1, 0, p);
  if (!isRoom(room)) {
    room.views = (room.views || []).flatMap(v => v > i ? [v + 1] : v === i ? [i, i + 1] : [v]);
    syncEl(room); invalidate(); return;
  }
  for (const d of doc.doors) {
    if (d.room !== room.id) continue;
    if (d.edge > i) d.edge++;
    else if (d.edge === i) {
      if (d.t < s) d.t = d.t / s;
      else { d.edge = i + 1; d.t = (d.t - s) / (1 - s); }
    }
  }
  invalidate();
}
function deleteVertex(room, i) {
  if (room.pts.length <= 3) { toast(isRoom(room) ? 'A room needs at least three corners' : 'An element needs at least three corners'); return; }
  if (!isRoom(room)) {
    const n = room.pts.length, old = new Set(room.views || []), prev = (i - 1 + n) % n, nv = [];
    for (let j = 0; j < n - 1; j++) { const ov = j < i ? j : j + 1; if (old.has(ov) || (ov === prev && old.has(i))) nv.push(j); }
    room.pts.splice(i, 1); room.views = nv; syncEl(room);
    invalidate(); commit(); return;
  }
  const keep = doc.doors.filter(d => d.room === room.id).map(d => [d, doorG(d)]);
  room.pts.splice(i, 1);
  invalidate();
  for (const [d, g] of keep) { if (!g) continue; const ne = nearestEdgeOf(room, g.mx, g.my); d.edge = ne.edge; d.t = ne.t; }
  invalidate();
  commit();
}

function linkCurve(l) {
  const a = doorById(l.from), b = doorById(l.to);
  const g1 = a && doorG(a), g2 = b && doorG(b);
  if (!g1 || !g2) return null;
  const D = Math.hypot(g2.mx - g1.mx, g2.my - g1.my);
  const k = Math.max(1.2, D * 0.35);
  return [g1.mx, g1.my, g1.mx - g1.nx * k, g1.my - g1.ny * k, g2.mx - g2.nx * k, g2.my - g2.ny * k, g2.mx, g2.my];
}
function bez(p, t) {
  const u = 1 - t;
  return [u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
          u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]];
}

function doorName(d) {
  const r = roomById(d.room);
  const same = doc.doors.filter(x => x.room === d.room && x.type === d.type);
  const idx = same.length > 1 ? ' ' + (same.indexOf(d) + 1) : '';
  return `${(r ? r.name : '?').toUpperCase()} · ${TYPE_LABEL[d.type]}${idx}`;
}
const isLinkTarget = d => doc.links.some(l => l.to === d.id);
// people only arrive from outside through IN and IN/OUT doors that nothing leads into
const sources = () => doc.doors.filter(d => canIn(d) && d.type !== 'pass' && !isLinkTarget(d) && roomById(d.room));
// where a door takes you. Two linked passages work both ways.
function leadsTo(d) {
  const l = doc.links.find(x => x.from === d.id);
  if (l) return doorById(l.to) || null;
  if (d.type === 'pass') {
    const r = doc.links.find(x => x.to === d.id && (doorById(x.from) || {}).type === 'pass');
    if (r) return doorById(r.from) || null;
  }
  return null;
}
// a passage that goes nowhere is just a wall to the audience
const canExit = d => canOut(d) && (d.type !== 'pass' || !!leadsTo(d));
const isTwoWay = l => (doorById(l.from) || {}).type === 'pass' && (doorById(l.to) || {}).type === 'pass';
function setLink(from, to) {
  const pp = from.type === 'pass' && to && to.type === 'pass';
  doc.links = doc.links.filter(l => l.from !== from.id && !(pp && isTwoWay(l) && [l.from, l.to].some(id => id === from.id || id === to.id)));
  if (!to) return null;
  const l = { id: uid('l'), from: from.id, to: to.id };
  doc.links.push(l);
  return l;
}

/* =========================================================
   Navigation: per-room grid + cost fields (Dijkstra)
   Arrows make walking with the flow cheaper and against it dearer.
   ========================================================= */
class Heap {
  constructor() { this.k = []; this.p = []; this.lastP = 0; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p);
    while (i > 0) { const q = (i - 1) >> 1; if (P[q] <= p) break; K[i] = K[q]; P[i] = P[q]; i = q; }
    K[i] = k; P[i] = p;
  }
  pop() {
    const K = this.k, P = this.p, top = K[0]; this.lastP = P[0];
    const lk = K.pop(), lp = P.pop(), n = K.length;
    if (n) {
      let i = 0;
      for (;;) { let l = 2 * i + 1; if (l >= n) break; const r = l + 1; if (r < n && P[r] < P[l]) l = r; if (P[l] >= lp) break; K[i] = K[l]; P[i] = P[l]; i = l; }
      K[i] = lk; P[i] = lp;
    }
    return top;
  }
}

const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

function getNav(room) {
  const g = G();
  let n = g.nav.get(room.id);
  if (!n) { n = buildNav(room); g.nav.set(room.id, n); }
  return n;
}

function buildNav(room) {
  const bb = bboxOf(room.pts);
  const ox = bb.minx, oy = bb.miny;
  const W = Math.max(1, Math.ceil((bb.maxx - ox) / CELL)), H = Math.max(1, Math.ceil((bb.maxy - oy) / CELL));
  const N = W * H;
  const walls = wallSegs(room);
  const els = doc.elements.filter(e => elRoomId(e) === room.id);
  const solids = els.filter(e => e.solid);
  const arrows = doc.arrows.filter(a => arRoomId(a) === room.id).map(a => {
    const L = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
    return { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, ux: (a.x2 - a.x1) / L, uy: (a.y2 - a.y1) / L };
  });
  const walk = new Uint8Array(N), clear = new Float32Array(N), ax = new Float32Array(N), ay = new Float32Array(N);
  const SIG = 2 * 2.2 * 2.2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, cx = ox + (i + 0.5) * CELL, cy = oy + (j + 0.5) * CELL;
    if (!pip(cx, cy, room.pts)) continue;
    let wd = Infinity;
    for (const s of walls) { const d = segDist(cx, cy, s[0], s[1], s[2], s[3]).d; if (d < wd) wd = d; }
    for (const e of solids) { const d = elDist(e, cx, cy); if (d < wd) wd = Math.max(d, 0); }
    clear[k] = wd;
    if (wd < 0.18) continue;
    walk[k] = 1;
    let sx = 0, sy = 0;
    for (const a of arrows) { const d = segDist(cx, cy, a.x1, a.y1, a.x2, a.y2).d; const w = Math.exp(-(d * d) / SIG); sx += a.ux * w; sy += a.uy * w; }
    const m = Math.hypot(sx, sy);
    if (m > 1) { sx /= m; sy /= m; }
    ax[k] = sx; ay[k] = sy;
  }
  return { room, ox, oy, W, H, walk, clear, ax, ay, els, doors: doc.doors.filter(d => d.room === room.id), fields: new Map() };
}

function buildField(nv, isSeed) {
  const { W, H, walk, clear, ax, ay } = nv;
  const N = W * H;
  const dist = new Float64Array(N).fill(Infinity);
  const heap = new Heap();
  for (let k = 0; k < N; k++) {
    if (!walk[k]) continue;
    const i = k % W, j = (k - i) / W;
    if (isSeed(nv.ox + (i + 0.5) * CELL, nv.oy + (j + 0.5) * CELL)) { dist[k] = 0; heap.push(k, 0); }
  }
  const S = nv.room.flow == null ? 0.6 : nv.room.flow;
  while (heap.size) {
    const k = heap.pop(), d = heap.lastP;
    if (d > dist[k]) continue;
    const i = k % W, j = (k - i) / W;
    for (const [di, dj, len] of NB) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = nj * W + ni;
      if (!walk[nk]) continue;
      if (di && dj && (!walk[j * W + ni] || !walk[nj * W + i])) continue;
      const mx = -di / len, my = -dj / len;           // walking from nk towards k
      const fx = (ax[k] + ax[nk]) * 0.5, fy = (ay[k] + ay[nk]) * 0.5;
      let c = len * CELL * Math.max(0.25, 1 - S * (mx * fx + my * fy));
      const cl = clear[nk];
      if (cl < 0.6) c *= 1 + (0.6 - cl) * 2.5;
      const nd = d + c;
      if (nd < dist[nk]) { dist[nk] = nd; heap.push(nk, nd); }
    }
  }
  const gx = new Float32Array(N), gy = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const dk = dist[k];
    if (!walk[k] || !(dk < Infinity) || dk === 0) continue;
    const i = k % W, j = (k - i) / W;
    let sx = 0, sy = 0;
    for (const [di, dj, len] of NB) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = nj * W + ni;
      if (!walk[nk] || !(dist[nk] < Infinity)) continue;
      if (di && dj && (!walk[j * W + ni] || !walk[nj * W + i])) continue;
      const gr = (dk - dist[nk]) / (len * CELL);
      if (gr > 0) { sx += di / len * gr; sy += dj / len * gr; }
    }
    const m = Math.hypot(sx, sy);
    if (m > 0) { gx[k] = sx / m; gy[k] = sy / m; }
  }
  return { dist, gx, gy };
}

function elField(nv, el) {
  const key = 'e' + el.id;
  let f = nv.fields.get(key);
  if (!f) {
    // people stand in a band: no closer than the minimal viewing distance, about 0.9 m deep
    const lo = el.near || 0, reach = lo + (el.solid || lo > 0 ? 0.9 : 0.4);
    if (!hasViews(el)) f = buildField(nv, (x, y) => { const d = elDist(el, x, y); return d <= reach && d >= lo - 0.05; });
    else {
      // stand in front of a viewing side
      const E = viewEdges(el);
      f = buildField(nv, (x, y) => {
        if (el.solid && pip(x, y, el.pts)) return false;
        for (const q of E) { const s = segDist(x, y, q.ax, q.ay, q.bx, q.by); if (s.d <= reach + 0.1 && s.d >= lo - 0.05 && (x - s.x) * q.nx + (y - s.y) * q.ny > -0.01) return true; }
        return false;
      });
    }
    nv.fields.set(key, f);
  }
  return f;
}
function doorField(nv, d) {
  const key = 'd' + d.id;
  let f = nv.fields.get(key);
  if (!f) {
    const g = doorG(d);
    f = buildField(nv, (x, y) => !!g && segDist(x, y, g.x0, g.y0, g.x1, g.y1).d <= 0.55);
    nv.fields.set(key, f);
  }
  return f;
}

function cellAt(nv, x, y) {
  const i = Math.floor((x - nv.ox) / CELL), j = Math.floor((y - nv.oy) / CELL);
  if (i < 0 || j < 0 || i >= nv.W || j >= nv.H) return -1;
  return j * nv.W + i;
}
const walkAt = (nv, x, y) => { const k = cellAt(nv, x, y); return k >= 0 && nv.walk[k] === 1; };
const distAt = (nv, f, x, y) => { const k = cellAt(nv, x, y); return k < 0 ? Infinity : f.dist[k]; };
function dirAt(nv, f, x, y) {
  const fx = (x - nv.ox) / CELL - 0.5, fy = (y - nv.oy) / CELL - 0.5;
  const i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
  let sx = 0, sy = 0, sw = 0;
  for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
    const i = i0 + di, j = j0 + dj;
    if (i < 0 || j < 0 || i >= nv.W || j >= nv.H) continue;
    const k = j * nv.W + i;
    if (!nv.walk[k] || !(f.dist[k] < Infinity)) continue;
    const w = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty);
    sx += f.gx[k] * w; sy += f.gy[k] * w; sw += w;
  }
  if (sw < 1e-6) { const k = cellAt(nv, x, y); return k >= 0 ? [f.gx[k], f.gy[k]] : [0, 0]; }
  const m = Math.hypot(sx, sy);
  return m > 1e-6 ? [sx / m, sy / m] : [0, 0];
}
function nearestWalkable(nv, x, y) {
  const ci = Math.floor((x - nv.ox) / CELL), cj = Math.floor((y - nv.oy) / CELL);
  for (let r = 0; r < 16; r++) {
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
      if (i < 0 || j < 0 || i >= nv.W || j >= nv.H) continue;
      const k = j * nv.W + i;
      if (nv.walk[k]) return [nv.ox + (i + 0.5) * CELL, nv.oy + (j + 0.5) * CELL];
    }
  }
  return null;
}

/* =========================================================
   Simulation
   ========================================================= */
const sim = { viewers: new Map(), running: false, speed: 1, t: 0, agents: [], nextId: 1, spawned: 0, exited: 0, staySum: 0, peak: 0, nextSpawn: 0, el: new Map(), heat: null };

function resetSim() {
  Object.assign(sim, { viewers: new Map(), running: false, t: 0, agents: [], nextId: 1, spawned: 0, exited: 0, staySum: 0, peak: 0, nextSpawn: 0, el: new Map(), heat: null });
  hoverAgent = null; hideTip();
  updatePlay(); updateStats(); needsRender = true;
}
function elStat(id) {
  let s = sim.el.get(id);
  if (!s) { s = { visits: 0, dwell: 0 }; sim.el.set(id, s); }
  return s;
}

function spawnAgent(door) {
  const a = { id: sim.nextId++, x: 0, y: 0, vx: 0, vy: 0, sx: 0, sy: 0, h: 0, speed: doc.settings.pace * rand(0.8, 1.2),
    born: sim.t, room: null, state: 'walk', target: null, plan: [], seen: new Set(), visited: new Set(),
    wa: Math.random() * Math.PI * 2, dwell: 0, look: null, enterT: 0, retry: 0, exit: null, entry: null, leftEntry: false, rooms: 0 };
  if (!enterRoom(a, door)) return;
  sim.agents.push(a);
  sim.spawned++;
}

function enterRoom(a, door) {
  const g = doorG(door), room = roomById(door.room);
  if (!g || !room) return false;
  const nv = getNav(room);
  let placed = false;
  for (let tries = 0; tries < 10 && !placed; tries++) {
    const off = (Math.random() - 0.5) * Math.max(0, g.w - 0.6);
    const depth = 0.35 + tries * 0.12;
    const x = g.mx + g.ux * off + g.nx * depth, y = g.my + g.uy * off + g.ny * depth;
    if (walkAt(nv, x, y)) { a.x = x; a.y = y; placed = true; }
  }
  if (!placed) {
    const p = nearestWalkable(nv, g.mx + g.nx * 0.5, g.my + g.ny * 0.5);
    if (!p) return false;
    a.x = p[0]; a.y = p[1];
  }
  a.room = room.id; a.entry = door.id; a.leftEntry = false; a.enterT = sim.t; a.rooms++; a.prog = null; a.stuck = 0;
  a.plan = []; a.seen = new Set(); a.visited = new Set(); a.state = 'walk'; a.target = null; a.look = null;
  a.h = Math.atan2(g.ny, g.nx); a.vx = g.nx * a.speed * 0.6; a.vy = g.ny * a.speed * 0.6;
  const cur = doc.settings.curiosity;
  for (const el of nv.els) if (Math.random() < clamp(cur * (el.attr / 10) * 0.9, 0, 0.95)) a.plan.push(el.id);
  chooseExit(a, nv);
  return true;
}

function unstick(a, nv) {
  a.ghost = sim.t + 2;                          // let them slip through the crowd for a moment
  const k = cellAt(nv, a.x, a.y);
  if (k >= 0) { const i = k % nv.W, j = (k - i) / nv.W; a.x = nv.ox + (i + 0.5) * CELL; a.y = nv.oy + (j + 0.5) * CELL; }
  a.wa = Math.random() * Math.PI * 2;
  a.vx = 0; a.vy = 0;
  const t = a.target;
  let f = null;
  if (t && t.kind === 'exit') { const d = doorById(t.id); if (d && d.room === a.room) f = doorField(nv, d); }
  if (t && t.kind === 'el') { const el = nv.els.find(e => e.id === t.id); if (el) f = elField(nv, el); }
  if (f && k >= 0) {
    // wedged behind something: take one step to the best neighbouring cell
    const i = k % nv.W, j = (k - i) / nv.W;
    let best = -1, bd = f.dist[k];
    for (const [di, dj] of NB) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nv.W || nj >= nv.H) continue;
      const nk = nj * nv.W + ni;
      if (nv.walk[nk] && f.dist[nk] < bd) { bd = f.dist[nk]; best = nk; }
    }
    if (best >= 0) { const bi = best % nv.W, bj = (best - bi) / nv.W; a.x = nv.ox + (bi + 0.5) * CELL; a.y = nv.oy + (bj + 0.5) * CELL; }
  }
  if (t && t.kind === 'exit') {
    const d = doorById(t.id), g = d && doorG(d);
    if (g && a.stuck >= 2 && segDist(a.x, a.y, g.x0, g.y0, g.x1, g.y1).d < 2) return d;   // close enough: through you go
    if (a.stuck >= 3) { a.leftEntry = true; chooseExit(a, nv, t.id); a.target = null; }
  } else if (t && t.kind === 'el') {
    if (a.stuck >= 2) { a.visited.add(t.id); a.plan = a.plan.filter(id => id !== t.id); a.target = null; }
  } else a.target = null;
  return null;
}

function chooseExit(a, nv, avoid) {
  const outs = nv.doors.filter(canExit);
  let pool = outs.filter(d => d.id !== a.entry && d.id !== avoid);
  if (!pool.length) pool = outs.filter(d => d.id !== avoid);
  if (!pool.length) pool = outs;
  a.exit = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
}

function pickTarget(a, nv) {
  let best = null, bd = Infinity;
  const keep = [];
  for (const id of a.plan) {
    const el = nv.els.find(e => e.id === id);
    if (!el || a.visited.has(id)) continue;
    if ((sim.viewers.get(id) || 0) >= capacity(el)) { a.visited.add(id); continue; }   // too busy, skip it
    const d = distAt(nv, elField(nv, el), a.x, a.y);
    if (!(d < Infinity)) continue;
    keep.push(id);
    if (d < bd) { bd = d; best = { kind: 'el', id }; }
  }
  a.plan = keep;
  if (best) { a.target = best; return; }
  let d = a.exit && doorById(a.exit);
  if (!d || d.room !== a.room || !canExit(d)) { chooseExit(a, nv); d = a.exit && doorById(a.exit); }
  if (d && distAt(nv, doorField(nv, d), a.x, a.y) < Infinity) { a.target = { kind: 'exit', id: d.id }; return; }
  a.target = { kind: 'wander' }; a.retry = sim.t + 3;
}

const wrapA = x => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
const turn = (h, want, k) => h + wrapA(want - h) * Math.min(1, k);

function exitAgent(a, door) {
  const to = leadsTo(door);
  if (to && roomById(to.room) && enterRoom(a, to)) return true;
  if (door.type === 'pass') { a.target = null; a.exit = null; return true; }   // passage lost its partner: never vanish here
  sim.exited++;
  sim.staySum += sim.t - a.born;
  return false;
}

function stepAgent(a, dt, cur) {
  const room = roomById(a.room);
  if (!room) return false;
  const nv = getNav(room);
  if (!walkAt(nv, a.x, a.y)) {
    const p = nearestWalkable(nv, a.x, a.y);
    if (!p) return false;
    a.x = p[0]; a.y = p[1];
  }
  if (!a.leftEntry) {
    const d = doorById(a.entry), g = d && doorG(d);
    if (!g || segDist(a.x, a.y, g.x0, g.y0, g.x1, g.y1).d > 1.4) a.leftEntry = true;
  }

  // noticing things on the way
  if (a.state === 'walk' && cur > 0) {
    for (const el of nv.els) {
      if (a.visited.has(el.id) || a.seen.has(el.id) || a.plan.includes(el.id)) continue;
      const R = noticeR(el);
      if (Math.abs(el.x - a.x) > R + el.w || Math.abs(el.y - a.y) > R + el.h) continue;
      if (elDist(el, a.x, a.y) < R) {
        a.seen.add(el.id);
        if (Math.random() < cur * (el.attr / 10) * 0.7) { a.plan.push(el.id); a.target = null; }
      }
    }
  }

  let dx = 0, dy = 0, sp = a.speed * (1 - cur * 0.2);

  if (a.state === 'dwell') {
    a.dwell -= dt;
    const el = elById(a.look);
    if (el) elStat(el.id).dwell += dt;
    if (!el || a.dwell <= 0 || elRoomId(el) !== a.room) {
      if (el) a.visited.add(el.id);
      a.plan = a.plan.filter(id => id !== a.look);
      a.state = 'walk'; a.target = null; a.look = null;
    } else {
      const lp = a.lookPt || [el.x, el.y];
      const want = Math.atan2(lp[1] - a.y, lp[0] - a.x) + Math.sin(sim.t * 0.6 + a.id * 1.7) * 0.4;
      a.h = turn(a.h, want, dt * 2.5);
      sp = 0;
    }
  }

  if (a.state === 'walk') {
    if (!a.target || (a.target.kind === 'wander' && sim.t > a.retry)) pickTarget(a, nv);
    const t = a.target;
    let gx = 0, gy = 0, wander = 0.12 + cur * 0.45;
    if (t.kind === 'el') {
      const el = nv.els.find(e => e.id === t.id);
      if (!el) { a.target = null; a.plan = a.plan.filter(id => id !== t.id); }
      else {
        const f = elField(nv, el), dh = distAt(nv, f, a.x, a.y);
        if (dh === 0 && (sim.viewers.get(el.id) || 0) >= capacity(el)) {
          a.visited.add(el.id); a.plan = a.plan.filter(id => id !== el.id); a.target = null;   // arrived, too busy
        } else if (dh === 0) {
          sim.viewers.set(el.id, (sim.viewers.get(el.id) || 0) + 1);
          a.state = 'dwell'; a.look = el.id; a.lookPt = lookPoint(el, a.x, a.y);
          a.dwell = el.dwell * (0.4 + cur * 1.2) * rand(0.6, 1.4);
          elStat(el.id).visits++;
        } else if (!(dh < Infinity)) { a.target = null; a.plan = a.plan.filter(id => id !== t.id); }
        else { [gx, gy] = dirAt(nv, f, a.x, a.y); sp *= clamp(0.35 + dh / 1.5, 0.35, 1); }
      }
    } else if (t.kind === 'exit') {
      const d = doorById(t.id), g = d && doorG(d);
      if (!g || d.room !== a.room || !canExit(d)) { a.target = null; a.exit = null; }
      else {
        const f = doorField(nv, d);
        // just came in through this door: step into the room and look around before turning back
        const back = d.id === a.entry && !a.leftEntry && sim.t - a.enterT < 8;
        if (!back && (distAt(nv, f, a.x, a.y) === 0 || segDist(a.x, a.y, g.x0, g.y0, g.x1, g.y1).d < 0.5)) return exitAgent(a, d);
        [gx, gy] = dirAt(nv, f, a.x, a.y);
        if (back) { gx = -gx; gy = -gy; if (!gx && !gy) { gx = g.nx; gy = g.ny; } }
        wander *= 0.6;
      }
    } else {
      wander = 1; sp *= 0.55;
    }
    const k = cellAt(nv, a.x, a.y);
    const S = room.flow == null ? 0.6 : room.flow;
    const bx = k >= 0 ? nv.ax[k] * S * 0.45 : 0, by = k >= 0 ? nv.ay[k] * S * 0.45 : 0;
    a.wa += (Math.random() - 0.5) * dt * 4;
    dx = gx + bx + Math.cos(a.wa) * wander;
    dy = gy + by + Math.sin(a.wa) * wander;
    const m = Math.hypot(dx, dy);
    if (m > 1e-6) { dx /= m; dy /= m; }
  }

  const tvx = dx * sp + a.sx, tvy = dy * sp + a.sy;
  const bl = Math.min(1, dt * 5);
  a.vx += (tvx - a.vx) * bl; a.vy += (tvy - a.vy) * bl;
  const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
  // while looking, the crowd can shuffle you along the viewing band but not push you off it
  let ok = (x, y) => walkAt(nv, x, y);
  if (a.state === 'dwell') {
    const el = elById(a.look), f = el && nv.els.includes(el) ? elField(nv, el) : null;
    if (f && distAt(nv, f, a.x, a.y) === 0) ok = (x, y) => walkAt(nv, x, y) && distAt(nv, f, x, y) === 0;
  }
  if (ok(nx, ny)) { a.x = nx; a.y = ny; }
  else if (ok(nx, a.y)) { a.x = nx; a.vy *= 0.5; }
  else if (ok(a.x, ny)) { a.y = ny; a.vx *= 0.5; }
  else { a.vx *= 0.2; a.vy *= 0.2; }
  if (a.state === 'walk') {
    const v = Math.hypot(a.vx, a.vy);
    if (v > 0.08) a.h = turn(a.h, Math.atan2(a.vy, a.vx), dt * 6);
    // stuck? (jammed in a doorway, wedged on a corner, or the plan changed under their feet)
    if (!a.prog) a.prog = { x: a.x, y: a.y, t: sim.t };
    if (Math.hypot(a.x - a.prog.x, a.y - a.prog.y) > 0.4) { a.prog = { x: a.x, y: a.y, t: sim.t }; a.stuck = 0; }
    else if (sim.t - a.prog.t > 4) {
      a.prog.t = sim.t;
      a.stuck = (a.stuck || 0) + 1;
      const d = unstick(a, nv);
      if (d) return exitAgent(a, d);
    }
  } else a.prog = null;
  const h = sim.heat;
  if (h) {
    const i = Math.floor((a.x - h.ox) / h.res), j = Math.floor((a.y - h.oy) / h.res);
    if (i >= 0 && j >= 0 && i < h.W && j < h.H) h.data[j * h.W + i] += dt;
  }
  return true;
}

function separation() {
  const cells = new Map();
  for (const a of sim.agents) {
    const key = Math.floor(a.x) * 73856093 ^ Math.floor(a.y) * 19349663;
    let arr = cells.get(key);
    if (!arr) cells.set(key, arr = []);
    arr.push(a);
  }
  const RR = 0.62;
  for (const a of sim.agents) {
    a.sx = 0; a.sy = 0;
    const cx = Math.floor(a.x), cy = Math.floor(a.y);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const arr = cells.get((cx + ox) * 73856093 ^ (cy + oy) * 19349663);
      if (!arr) continue;
      for (const b of arr) {
        if (b === a || b.room !== a.room || a.ghost > sim.t || b.ghost > sim.t) continue;
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < RR * RR) {
          if (d2 < 1e-8) { a.sx += Math.random() - 0.5; a.sy += Math.random() - 0.5; continue; }
          const d = Math.sqrt(d2), f = (RR - d) / RR * (b.state === 'dwell' && a.state !== 'dwell' ? 0.45 : 1);   // slip past people who are looking
          a.sx += dx / d * f * 1.4; a.sy += dy / d * f * 1.4;
        }
      }
    }
  }
}

function ensureHeat() {
  if (sim.heat && sim.heat.ver === ver) return;
  if (!doc.rooms.length) { sim.heat = null; return; }
  const bb = bboxOf(doc.rooms.flatMap(r => r.pts));
  const res = 0.5, ox = Math.floor(bb.minx) - 1, oy = Math.floor(bb.miny) - 1;
  const W = Math.ceil((bb.maxx - ox) / res) + 2, H = Math.ceil((bb.maxy - oy) / res) + 2;
  const key = [ox, oy, W, H].join(',');
  if (sim.heat && sim.heat.key === key) { sim.heat.ver = ver; return; }
  sim.heat = { key, ver, ox, oy, W, H, res, data: new Float32Array(W * H) };
}

function simStep(dt) {
  sim.t += dt;
  const S = doc.settings;
  ensureHeat();
  const src = sources();
  if (src.length && S.rate > 0) {
    sim.nextSpawn -= dt;
    while (sim.nextSpawn <= 0) {
      if ((S.total && sim.spawned >= S.total) || sim.agents.length >= MAX_AGENTS) { sim.nextSpawn = 0; break; }
      spawnAgent(src[Math.floor(Math.random() * src.length)]);
      sim.nextSpawn += -Math.log(1 - Math.random()) / (S.rate / 60);
    }
  }
  separation();
  sim.viewers = new Map();
  for (const a of sim.agents) if (a.state === 'dwell') sim.viewers.set(a.look, (sim.viewers.get(a.look) || 0) + 1);
  const cur = S.curiosity;
  const keep = [];
  for (const a of sim.agents) if (stepAgent(a, dt, cur)) keep.push(a);
  sim.agents = keep;
  if (hoverAgent && !keep.includes(hoverAgent)) { hoverAgent = null; hideTip(); }
  sim.peak = Math.max(sim.peak, keep.length);
  if (S.total && sim.spawned >= S.total && !keep.length) { sim.running = false; updatePlay(); toast('Everyone has left'); }
}

/* =========================================================
   Rendering
   ========================================================= */
const canvas = $('#stage');
const ctx = canvas.getContext('2d');
let dpr = 1, CW = 0, CH = 0;
const view = { x: 0, y: 0, z: 1 };
let needsRender = true;
let tool = 'select', sel = null, drag = null, hoverAgent = null, hoverEdge = null, snap = true, showHeat = false, showCones = true;

const S2W = (sx, sy) => [(sx - view.x) / (PX * view.z), (sy - view.y) / (PX * view.z)];
const tolW = px => px / (PX * view.z);
const snapv = v => snap ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100;

function makeCone(color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, color === 'ink' ? 'rgba(0,0,0,0.26)' : hexA(ACCENT, 0.75));
  grad.addColorStop(1, color === 'ink' ? 'rgba(0,0,0,0)' : hexA(ACCENT, 0));
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64 - 52); g.lineTo(128, 64 + 52); g.closePath(); g.fill();
  return c;
}
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${f[0]},${f[1]},${f[2]},${a})`;
}
const CONE = { ink: makeCone('ink'), accent: makeCone('accent') };
const CONE_L = 0.95; // metres

function resize() {
  dpr = window.devicePixelRatio || 1;
  CW = window.innerWidth; CH = window.innerHeight;
  canvas.width = Math.round(CW * dpr); canvas.height = Math.round(CH * dpr);
  canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
  needsRender = true;
}

function polyPath(c, pts) {
  c.beginPath();
  pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
  c.closePath();
}
function elPath(c, e) { polyPath(c, e.pts); }
function headPts(x, y, ang, size) {
  const a1 = ang + Math.PI - 0.5, a2 = ang + Math.PI + 0.5;
  return [[x + Math.cos(a1) * size, y + Math.sin(a1) * size], [x, y], [x + Math.cos(a2) * size, y + Math.sin(a2) * size]];
}
function strokePts(c, pts) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }

function drawLabel(c, text, x, y, anchor, size = 11, bg = '#000', fg = '#fff') {
  c.font = `${size}px ${MONO}`;
  const tw = c.measureText(text).width, bw = Math.ceil(tw + 10), bh = size + 6;
  let bx = x, by = y;
  if (anchor[1] === 'r') bx = x - bw;
  if (anchor[1] === 'c') bx = x - bw / 2;
  if (anchor[0] === 'b') by = y - bh;
  if (anchor[0] === 'm') by = y - bh / 2;
  c.fillStyle = bg; c.fillRect(bx, by, bw, bh);
  c.fillStyle = fg; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(text, bx + 5, by + bh / 2 + 0.5);
  return { bx, by, bw, bh };
}

function roomCounts() {
  const m = new Map();
  for (const a of sim.agents) m.set(a.room, (m.get(a.room) || 0) + 1);
  return m;
}
function viewersOf(id) { let n = 0; for (const a of sim.agents) if (a.state === 'dwell' && a.look === id) n++; return n; }

function drawGrid(c, v, W, H) {
  let step = PX * v.z;
  while (step < 12) step *= 5;
  const r = clamp(v.z, 0.6, 1.4);
  c.save();
  c.globalAlpha = 0.09; c.fillStyle = '#000';
  const x0 = ((v.x % step) + step) % step, y0 = ((v.y % step) + step) % step;
  for (let y = y0; y < H; y += step) for (let x = x0; x < W; x += step) c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

function drawScene(c, v, W, H, o) {
  const s = PX * v.z, u = 1 / s;
  const atS = (x, y, fn) => { c.save(); c.translate(x, y); c.scale(u, u); fn(); c.restore(); };
  if (o.grid) drawGrid(c, v, W, H);
  c.save();
  c.translate(v.x, v.y); c.scale(s, s);
  const isSel = (kind, id) => o.ui && sel && sel.kind === kind && sel.id === id;

  // floors
  for (const r of doc.rooms) {
    if (isSel('room', r.id)) { c.save(); c.translate(6 * u, 6 * u); polyPath(c, r.pts); c.fillStyle = ACCENT; c.fill(); c.restore(); }
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.2)'; c.shadowBlur = 12 * o.sh; c.shadowOffsetY = 6 * o.sh;
    polyPath(c, r.pts); c.fillStyle = '#fff'; c.fill();
    c.restore();
  }

  // heat
  if (o.heat && sim.heat) {
    const h = sim.heat;
    let max = 0;
    for (let i = 0; i < h.data.length; i++) if (h.data[i] > max) max = h.data[i];
    if (max > 0) {
      c.save();
      c.beginPath();
      for (const r of doc.rooms) r.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
      c.clip();
      c.fillStyle = '#000';
      for (let j = 0; j < h.H; j++) for (let i = 0; i < h.W; i++) {
        const val = h.data[j * h.W + i];
        if (val <= 0) continue;
        c.globalAlpha = Math.sqrt(val / max) * 0.34;
        c.fillRect(h.ox + i * h.res, h.oy + j * h.res, h.res + u, h.res + u);
      }
      c.restore();
    }
  }

  // flow arrows
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const a of doc.arrows) {
    const selA = isSel('arrow', a.id);
    c.strokeStyle = selA ? ACCENT : '#9a9a9a';
    c.lineWidth = (selA ? 3 : 1.5) * u;
    strokePts(c, [[a.x1, a.y1], [a.x2, a.y2]]);
    strokePts(c, headPts(a.x2, a.y2, Math.atan2(a.y2 - a.y1, a.x2 - a.x1), 0.45));
  }

  // elements
  for (const e of doc.elements) {
    if (isSel('element', e.id)) {
      // reach: a soft band around it
      c.save(); c.strokeStyle = 'rgba(0,0,0,0.045)'; c.lineJoin = 'round'; c.lineWidth = noticeR(e) * 2; elPath(c, e); c.stroke(); c.restore();
      c.save(); c.translate(6 * u, 6 * u); elPath(c, e); c.fillStyle = ACCENT; c.fill(); c.restore();
      if (e.near > 0) {   // where viewing starts
        c.save(); c.setLineDash([4 * u, 4 * u]); c.strokeStyle = '#000'; c.lineWidth = 1 * u; c.lineCap = 'butt';
        c.beginPath();
        for (const E of viewEdges(e)) {
          const ox = E.nx * e.near, oy = E.ny * e.near;
          c.moveTo(E.ax + ox, E.ay + oy); c.lineTo(E.bx + ox, E.by + oy);
          if (!hasViews(e)) {   // round the outside corners
            const nx2 = polyEdges(e.pts)[(E.i + 1) % e.pts.length];
            const a0 = Math.atan2(E.ny, E.nx), a1 = Math.atan2(nx2.ny, nx2.nx);
            let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
            if (Math.abs(da) > 0.01) { c.moveTo(E.bx + ox, E.by + oy); c.arc(E.bx, E.by, e.near, a0, a0 + da, da < 0); }
          }
        }
        c.stroke(); c.restore();
      }
    }
    c.save();
    if (e.solid) { c.shadowColor = 'rgba(0,0,0,0.2)'; c.shadowBlur = 12 * o.sh; c.shadowOffsetY = 6 * o.sh; c.fillStyle = '#fff'; }
    else c.fillStyle = 'rgba(0,0,0,0.045)';
    elPath(c, e); c.fill();
    c.restore();
    if (!e.solid) { c.save(); c.setLineDash([3 * u, 3 * u]); c.strokeStyle = '#999'; c.lineWidth = 1 * u; elPath(c, e); c.stroke(); c.restore(); }
    if (hasViews(e)) {   // viewing sides in ink
      c.save(); c.strokeStyle = '#000'; c.lineWidth = 2.5 * u; c.lineCap = 'butt';
      c.beginPath(); for (const E of viewEdges(e)) { c.moveTo(E.ax, E.ay); c.lineTo(E.bx, E.by); } c.stroke(); c.restore();
    }
  }

  // walls + doors
  c.strokeStyle = '#000'; c.lineWidth = 2 * u; c.lineCap = 'square';
  for (const r of doc.rooms) {
    c.beginPath();
    for (const w of wallSegs(r)) { c.moveTo(w[0], w[1]); c.lineTo(w[2], w[3]); }
    c.stroke();
  }
  c.lineCap = 'round';
  for (const d of doc.doors) {
    const g = doorG(d);
    if (!g) continue;
    if (isSel('door', d.id) || (drag && drag.type === 'link' && drag.over === d)) {
      c.save(); c.strokeStyle = ACCENT; c.lineWidth = 6 * u; strokePts(c, [[g.x0, g.y0], [g.x1, g.y1]]); c.restore();
    }
    c.strokeStyle = '#000'; c.lineWidth = 1.5 * u;
    const tk = 0.18;
    strokePts(c, [[g.x0 - g.nx * tk, g.y0 - g.ny * tk], [g.x0 + g.nx * tk, g.y0 + g.ny * tk]]);
    strokePts(c, [[g.x1 - g.nx * tk, g.y1 - g.ny * tk], [g.x1 + g.nx * tk, g.y1 + g.ny * tk]]);
    if (canIn(d)) strokePts(c, headPts(g.mx + g.nx * 0.42 + (twoSided(d) ? g.ux * 0.25 : 0), g.my + g.ny * 0.42 + (twoSided(d) ? g.uy * 0.25 : 0), Math.atan2(g.ny, g.nx), 0.22));
    if (canOut(d)) strokePts(c, headPts(g.mx - g.nx * 0.42 - (twoSided(d) ? g.ux * 0.25 : 0), g.my - g.ny * 0.42 - (twoSided(d) ? g.uy * 0.25 : 0), Math.atan2(-g.ny, -g.nx), 0.22));
  }

  // links
  for (const l of doc.links) {
    const p = linkCurve(l);
    if (!p) continue;
    const selL = isSel('link', l.id);
    c.save();
    c.strokeStyle = selL ? ACCENT : '#9a9a9a';
    c.lineWidth = (selL ? 2.5 : 1.2) * u;
    if (!selL) c.setLineDash([4 * u, 4 * u]);
    c.beginPath(); c.moveTo(p[0], p[1]); c.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); c.stroke();
    c.setLineDash([]);
    if (!isTwoWay(l)) strokePts(c, headPts(p[6], p[7], Math.atan2(p[7] - p[5], p[6] - p[4]), 0.4));
    c.restore();
  }

  // agents
  if (o.agents && sim.agents.length) {
    const live = sim.agents.filter(a => roomById(a.room));
    if (o.cones) {
      for (const a of live) {
        c.save(); c.translate(a.x, a.y); c.rotate(a.h);
        c.drawImage(a.state === 'dwell' ? CONE.accent : CONE.ink, 0, -CONE_L / 2, CONE_L, CONE_L);
        c.restore();
      }
    }
    c.beginPath();
    for (const a of live) { c.moveTo(a.x + AGENT_R, a.y); c.arc(a.x, a.y, AGENT_R, 0, Math.PI * 2); }
    c.fillStyle = '#111'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1 * u; c.stroke();
    if (o.ui && hoverAgent && live.includes(hoverAgent)) {
      const a = hoverAgent;
      const tp = agentGoalPoint(a);
      if (tp) { c.save(); c.setLineDash([3 * u, 3 * u]); c.strokeStyle = '#000'; c.lineWidth = 1 * u; strokePts(c, [[a.x, a.y], tp]); c.restore(); }
      c.beginPath(); c.arc(a.x, a.y, AGENT_R + 3 * u, 0, Math.PI * 2);
      c.strokeStyle = ACCENT; c.lineWidth = 3 * u; c.stroke();
    }
  }

  // text: element names, door labels, room labels
  for (const e of doc.elements) {
    atS(e.x, e.y, () => {
      const name = e.name.toUpperCase();
      c.font = `10px ${MONO}`;
      const tw = c.measureText(name).width;
      const wpx = e.w * s, hpx = elH(e) * s;
      c.fillStyle = '#000'; c.textAlign = 'center';
      if (tw < wpx - 6 && hpx > 14) { c.textBaseline = 'middle'; c.fillText(name, 0, 0.5); }
      else { c.textBaseline = 'top'; c.fillStyle = '#555'; c.fillText(name, 0, hpx / 2 + 4); }
      if (sim.t > 0) {
        const n = viewersOf(e.id);
        if (n) drawLabel(c, String(n), wpx / 2, -hpx / 2, 'br', 10);
      }
    });
  }
  for (const d of doc.doors) {
    const g = doorG(d);
    if (!g || (d.type === 'pass' && leadsTo(d))) continue;
    atS(g.mx - g.nx * 0.5, g.my - g.ny * 0.5, () => {
      c.font = `10px ${MONO}`; c.fillStyle = '#777'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const off = 8;
      c.fillText(PLAN_LABEL[d.type], -g.nx * off, -g.ny * off);
    });
  }
  const counts = sim.t > 0 ? roomCounts() : null;
  for (const r of doc.rooms) {
    const bb = bboxOf(r.pts);
    atS(bb.minx, bb.miny, () => drawLabel(c, r.name.toUpperCase(), 0, -6, 'bl', 11));
    if (counts) atS(bb.maxx, bb.miny, () => drawLabel(c, String(counts.get(r.id) || 0), 0, -6, 'br', 11));
  }

  // free labels
  if (o.ui) labelBoxes.clear();
  for (const t of doc.labels) {
    atS(t.x, t.y, () => {
      const b = drawFreeLabel(c, t, isSel('label', t.id));
      if (o.ui) labelBoxes.set(t.id, { x: v.x + t.x * s + b.x, y: v.y + t.y * s + b.y, w: b.w, h: b.h });
    });
  }

  // editing handles and previews
  if (o.ui) drawUI(c, s, u, atS);
  c.restore();
}

const labelBoxes = new Map();   // screen-space boxes from the last frame, for hit testing
const LABEL_SIZE = 12, LABEL_LH = 16;
const labelLines = t => (t.text || ' ').toUpperCase().split('\n');
// labels are anchored at their top-left corner; text style is sentence case
function drawFreeLabel(c, t, selected) {
  c.font = `${LABEL_SIZE}px ${MONO}`;
  c.textAlign = 'left'; c.textBaseline = 'middle';
  if (t.style === 'box') {
    const lines = labelLines(t);
    const w = Math.ceil(Math.max(...lines.map(l => c.measureText(l).width)) + 12), h = lines.length * LABEL_LH + 4;
    if (selected) { c.fillStyle = ACCENT; c.fillRect(4, 4, w, h); }
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    lines.forEach((l, i) => c.fillText(l, 6, 2 + LABEL_LH * (i + 0.5) + 0.5));
    return { x: 0, y: 0, w, h };
  }
  const lines = (t.text || ' ').split('\n');
  const w = Math.ceil(Math.max(...lines.map(l => c.measureText(l).width)) + 4), h = lines.length * LABEL_LH;
  if (selected) { c.fillStyle = hexA(ACCENT, 0.35); c.fillRect(-2, 0, w, h); }
  c.fillStyle = '#000';
  lines.forEach((l, i) => c.fillText(l, 0, LABEL_LH * (i + 0.5) + 0.5));
  return { x: -2, y: 0, w, h };
}

function agentGoalPoint(a) {
  if (a.state === 'dwell') { const el = elById(a.look); return el ? [el.x, el.y] : null; }
  if (!a.target) return null;
  if (a.target.kind === 'el') { const el = elById(a.target.id); return el ? [el.x, el.y] : null; }
  if (a.target.kind === 'exit') { const d = doorById(a.target.id), g = d && doorG(d); return g ? [g.mx, g.my] : null; }
  return null;
}

// the VIEW toggles of a selected element, in screen pixels
function viewMarkers(e) {
  const s = PX * view.z, out = [];
  for (const E of polyEdges(e.pts)) {
    if (E.L * s < 10) continue;
    const w = 34, h = 14, off = 14 + Math.abs(E.nx) * w / 2 + Math.abs(E.ny) * h / 2;
    const cx = view.x + E.mx * s + E.nx * off, cy = view.y + E.my * s + E.ny * off;
    out.push({ i: E.i, on: (e.views || []).includes(E.i), x: cx - w / 2, y: cy - h / 2, w, h });
  }
  return out;
}

function handle(c, u, x, y, kind = 'square') {
  c.beginPath();
  if (kind === 'square') c.rect(x - 4.5 * u, y - 4.5 * u, 9 * u, 9 * u);
  else c.arc(x, y, 5 * u, 0, Math.PI * 2);
  c.fillStyle = '#fff'; c.fill();
  c.strokeStyle = kind === 'square' ? '#000' : '#999'; c.lineWidth = 1 * u; c.stroke();
  if (kind === 'plus') {
    c.beginPath(); c.moveTo(x - 2.5 * u, y); c.lineTo(x + 2.5 * u, y); c.moveTo(x, y - 2.5 * u); c.lineTo(x, y + 2.5 * u);
    c.strokeStyle = '#777'; c.stroke();
  }
}

function drawUI(c, s, u, atS) {
  const o = getSel();
  if (o && (sel.kind === 'room' || sel.kind === 'element')) {
    const n = o.pts.length;
    if (sel.kind === 'element') {
      for (const m of viewMarkers(o)) {
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.scale(dpr, dpr);
        c.font = `10px ${MONO}`;
        c.fillStyle = m.on ? '#000' : '#fff'; c.fillRect(m.x, m.y, m.w, m.h);
        if (!m.on) { c.strokeStyle = '#ccc'; c.lineWidth = 1; c.strokeRect(m.x + 0.5, m.y + 0.5, m.w - 1, m.h - 1); }
        c.fillStyle = m.on ? '#fff' : '#999'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('VIEW', m.x + m.w / 2, m.y + m.h / 2 + 0.5);
        c.restore();
      }
    }
    // lengths, just outside each side
    for (let i = 0; i < n && sel.kind === 'room'; i++) {
      const a = o.pts[i], b = o.pts[(i + 1) % n];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.05) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      if (pip(mx + nx * 0.05, my + ny * 0.05, o.pts)) { nx = -nx; ny = -ny; }   // point outwards
      const text = Number(L.toFixed(2)) + ' M';
      atS(mx, my, () => {
        c.font = `10px ${MONO}`;
        const tw = c.measureText(text).width + 8, th = 14;
        const off = 16 + Math.abs(nx) * tw / 2;               // clear of the wall and the + handle
        const x = nx * off - tw / 2, y = ny * (16 + th / 2) - th / 2;
        c.fillStyle = '#fff'; c.fillRect(x, y, tw, th);
        c.fillStyle = '#000'; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(text, x + 4, y + th / 2 + 0.5);
      });
    }
    for (let i = 0; i < n; i++) { const a = o.pts[i], b = o.pts[(i + 1) % n]; handle(c, u, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 'plus'); }
    for (const p of o.pts) handle(c, u, p[0], p[1]);
  }
  if (o && sel.kind === 'arrow') { handle(c, u, o.x1, o.y1); handle(c, u, o.x2, o.y2); }

  if (drag && drag.type === 'newRoom') {
    c.save(); c.setLineDash([4 * u, 4 * u]); c.strokeStyle = '#000'; c.lineWidth = 1 * u;
    c.strokeRect(Math.min(drag.x1, drag.x2), Math.min(drag.y1, drag.y2), Math.abs(drag.x2 - drag.x1), Math.abs(drag.y2 - drag.y1));
    c.restore();
    const w = Math.abs(drag.x2 - drag.x1), h = Math.abs(drag.y2 - drag.y1);
    c.save(); c.translate(Math.max(drag.x1, drag.x2), Math.max(drag.y1, drag.y2)); c.scale(u, u);
    drawLabel(c, `${w.toFixed(1)} × ${h.toFixed(1)} M`, 6, 6, 'tl', 11); c.restore();
  }
  if (drag && drag.type === 'newArrow') {
    c.strokeStyle = ACCENT; c.lineWidth = 3 * u; c.lineCap = 'round';
    strokePts(c, [[drag.x1, drag.y1], [drag.x2, drag.y2]]);
    strokePts(c, headPts(drag.x2, drag.y2, Math.atan2(drag.y2 - drag.y1, drag.x2 - drag.x1), 0.45));
  }
  if (drag && drag.type === 'link') {
    const g = doorG(drag.from);
    if (g) { c.save(); c.setLineDash([4 * u, 4 * u]); c.strokeStyle = '#000'; c.lineWidth = 1.5 * u; strokePts(c, [[g.mx, g.my], [drag.x2, drag.y2]]); c.restore(); }
  }
  if (tool === 'door' && hoverEdge && !drag) {
    const w = Math.min(1.6, hoverEdge.L);
    const a = hoverEdge.room.pts[hoverEdge.edge], b = hoverEdge.room.pts[(hoverEdge.edge + 1) % hoverEdge.room.pts.length];
    const ux = (b[0] - a[0]) / hoverEdge.L, uy = (b[1] - a[1]) / hoverEdge.L;
    const cc = clamp(hoverEdge.t * hoverEdge.L, w / 2, hoverEdge.L - w / 2);
    const mx = a[0] + ux * cc, my = a[1] + uy * cc;
    c.save(); c.strokeStyle = ACCENT; c.lineWidth = 6 * u; strokePts(c, [[mx - ux * w / 2, my - uy * w / 2], [mx + ux * w / 2, my + uy * w / 2]]); c.restore();
  }
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CW, CH);
  drawScene(ctx, view, CW, CH, { grid: true, ui: true, agents: true, heat: showHeat, cones: showCones, sh: dpr });
}

/* =========================================================
   Selection, history, persistence
   ========================================================= */
function getSel() {
  if (!sel) return null;
  const list = { room: doc.rooms, door: doc.doors, element: doc.elements, arrow: doc.arrows, link: doc.links, label: doc.labels }[sel.kind];
  return list ? list.find(x => x.id === sel.id) || null : null;
}
function select(kind, id) {
  const next = kind ? { kind, id } : null;
  if (JSON.stringify(next) === JSON.stringify(sel)) return;
  sel = next;
  buildInspector();
  needsRender = true;
}

let undoStack = [], redoStack = [], current = null;
const snapshot = () => JSON.stringify(doc);
function commit() {
  const s = snapshot();
  if (s === current) return;
  if (current !== null) { undoStack.push(current); if (undoStack.length > 200) undoStack.shift(); }
  current = s; redoStack = [];
  lsSet(STORE, s);
  updateUndo();
}
function restoreState(s) {
  doc = normalize(JSON.parse(s));
  current = s;
  invalidate();
  if (sel && !getSel()) sel = null;
  buildInspector(); syncSettings(); renderName();
  lsSet(STORE, s);
  updateUndo();
}
function undo() { if (!undoStack.length) return; redoStack.push(current); restoreState(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(current); restoreState(redoStack.pop()); }
function updateUndo() { $('#btn-undo').disabled = !undoStack.length; $('#btn-redo').disabled = !redoStack.length; }

function loadDoc(d, keepHistory = true) {
  doc = normalize(d);
  sel = null;
  resetSim();
  invalidate();
  if (keepHistory) commit(); else { current = snapshot(); undoStack = []; redoStack = []; lsSet(STORE, current); updateUndo(); }
  buildInspector(); syncSettings(); renderName();
  fitView();
}

function deleteSel() {
  const o = getSel();
  if (!o) return;
  if (sel.kind === 'room') {
    const doorIds = new Set(doc.doors.filter(d => d.room === o.id).map(d => d.id));
    doc.elements = doc.elements.filter(e => elRoomId(e) !== o.id);
    doc.arrows = doc.arrows.filter(a => arRoomId(a) !== o.id);
    doc.doors = doc.doors.filter(d => !doorIds.has(d.id));
    doc.links = doc.links.filter(l => !doorIds.has(l.from) && !doorIds.has(l.to));
    doc.rooms = doc.rooms.filter(r => r !== o);
  } else if (sel.kind === 'door') {
    doc.doors = doc.doors.filter(d => d !== o);
    doc.links = doc.links.filter(l => l.from !== o.id && l.to !== o.id);
  } else if (sel.kind === 'element') doc.elements = doc.elements.filter(e => e !== o);
  else if (sel.kind === 'arrow') doc.arrows = doc.arrows.filter(a => a !== o);
  else if (sel.kind === 'link') doc.links = doc.links.filter(l => l !== o);
  else if (sel.kind === 'label') doc.labels = doc.labels.filter(t => t !== o);
  sel = null;
  invalidate(); commit(); buildInspector();
}

function contentBBox() {
  const pts = [];
  for (const r of doc.rooms) pts.push(...r.pts);
  for (const e of doc.elements) { pts.push([e.x - e.w / 2, e.y - elH(e) / 2], [e.x + e.w / 2, e.y + elH(e) / 2]); }
  for (const a of doc.arrows) pts.push([a.x1, a.y1], [a.x2, a.y2]);
  for (const t of doc.labels) { const n = labelLines(t); pts.push([t.x, t.y], [t.x + Math.max(...n.map(l => l.length)) * LABEL_SIZE * 0.6 / PX + 0.5, t.y + n.length * LABEL_LH / PX]); }
  if (!pts.length) return null;
  return bboxOf(pts);
}

function fitView() {
  const wide = CW > 600;
  const brandW = $('#brand-title span').getBoundingClientRect().width || 0;
  const left = wide ? 284 : 12, right = wide ? Math.max(140, brandW + 24) : 12, top = wide ? 80 : 110, bottom = wide ? 40 : 120;
  const bb = contentBBox();
  if (!bb) { view.z = 1; view.x = left + 24; view.y = top + 24; needsRender = true; updateMeta(); return; }
  const aw = Math.max(100, CW - left - right), ah = Math.max(100, CH - top - bottom);
  const bw = Math.max(1, bb.maxx - bb.minx) * PX, bh = Math.max(1, bb.maxy - bb.miny) * PX;
  const z = clamp(Math.min(aw / bw, ah / bh), 0.15, 2.5);
  view.z = z;
  view.x = left + (aw - bw * z) / 2 - bb.minx * PX * z;
  view.y = top + (ah - bh * z) / 2 - bb.miny * PX * z;
  needsRender = true; updateMeta();
}

function zoomAt(sx, sy, f) {
  const nz = clamp(view.z * f, 0.15, 6);
  const [wx, wy] = S2W(sx, sy);
  view.z = nz;
  view.x = sx - wx * PX * nz; view.y = sy - wy * PX * nz;
  needsRender = true; updateMeta();
}

/* =========================================================
   Pointer interaction
   ========================================================= */
function hitDoor(x, y, tol) {
  for (let i = doc.doors.length - 1; i >= 0; i--) {
    const d = doc.doors[i], g = doorG(d);
    if (g && segDist(x, y, g.x0, g.y0, g.x1, g.y1).d < tol) return d;
  }
  return null;
}
function hitElement(x, y, tol) {
  for (let i = doc.elements.length - 1; i >= 0; i--) if (elDist(doc.elements[i], x, y) <= tol * 0.5) return doc.elements[i];
  return null;
}
function hitArrow(x, y, tol) {
  for (let i = doc.arrows.length - 1; i >= 0; i--) { const a = doc.arrows[i]; if (segDist(x, y, a.x1, a.y1, a.x2, a.y2).d < tol) return a; }
  return null;
}
function hitLink(x, y, tol) {
  for (const l of doc.links) {
    const p = linkCurve(l);
    if (!p) continue;
    let prev = bez(p, 0);
    for (let i = 1; i <= 24; i++) {
      const q = bez(p, i / 24);
      if (segDist(x, y, prev[0], prev[1], q[0], q[1]).d < tol) return l;
      prev = q;
    }
  }
  return null;
}
const hitRoom = (x, y) => roomAt(x, y);
function hitLabel(sx, sy) {
  for (let i = doc.labels.length - 1; i >= 0; i--) {
    const b = labelBoxes.get(doc.labels[i].id);
    if (b && sx >= b.x - 3 && sx <= b.x + b.w + 3 && sy >= b.y - 3 && sy <= b.y + b.h + 3) return doc.labels[i];
  }
  return null;
}
function hitAgent(x, y) {
  let best = null, bd = AGENT_R + tolW(5);
  for (const a of sim.agents) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } }
  return best;
}

const pointers = new Map();
let pinch = null;

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2 };
    if (drag && drag.type !== 'pan') { restoreState(current); }
    drag = null;
    return;
  }
  const [wx, wy] = S2W(e.clientX, e.clientY);
  if (e.button === 1 || e.button === 2) { drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
  if (e.button !== 0) return;
  hideTip();
  const tol = tolW(e.pointerType === 'touch' ? 14 : 8);

  if (tool === 'select') return downSelect(wx, wy, tol, e);

  if (tool === 'room') { const x = snapv(wx), y = snapv(wy); drag = { type: 'newRoom', x1: x, y1: y, x2: x, y2: y }; return; }

  if (tool === 'door') {
    const hd = hitDoor(wx, wy, tol);
    if (hd) { select('door', hd.id); drag = { type: 'door', door: hd }; return; }
    const ne = nearestEdgeAll(wx, wy);
    if (ne && ne.d < tolW(14)) {
      const ds = doc.doors.filter(d => d.room === ne.room.id);
      // the first room gets the way in and out; doors in other rooms start as passages
      const others = doc.doors.some(d => d.room !== ne.room.id);
      const type = others ? 'pass' : !ds.some(canIn) ? 'in' : !ds.some(canOut) ? 'out' : 'pass';
      const door = { id: uid('d'), room: ne.room.id, edge: ne.edge, t: ne.t, w: Math.min(1.6, ne.L), type };
      doc.doors.push(door);
      invalidate();
      select('door', door.id);
      drag = { type: 'door', door };
    } else toast('Click on a wall to add a door');
    return;
  }

  if (tool === 'label') {
    const hl = hitLabel(e.clientX, e.clientY);
    if (hl) { select('label', hl.id); drag = { type: 'moveLabel', t: hl, ox: wx - hl.x, oy: wy - hl.y }; return; }
    const t = { id: uid('t'), x: snapv(wx), y: snapv(wy), text: 'Label', style: 'box' };
    doc.labels.push(t);
    select('label', t.id);
    commit();
    setTool('select');
    focusLabelText();
    needsRender = true;
    return;
  }

  if (tool === 'arrow') { drag = { type: 'newArrow', x1: snapv(wx), y1: snapv(wy), x2: snapv(wx), y2: snapv(wy) }; return; }

  if (tool === 'element') {
    const el = syncEl({ id: uid('e'), name: 'Element ' + (doc.elements.length + 1), pts: rectPts(snapv(wx), snapv(wy), 2, 1), views: [], attr: 5, dwell: 20, near: 0, solid: true });
    if (!roomAt(el.x, el.y)) toast('Place elements inside a room so people can find them');
    doc.elements.push(el);
    invalidate();
    select('element', el.id);
    drag = { type: 'moveEl', el, px: wx, py: wy, o: el.pts.map(p => p.slice()) };
    setTool('select');
    return;
  }

  if (tool === 'link') {
    const hd = hitDoor(wx, wy, tol);
    if (hd && canOut(hd)) { drag = { type: 'link', from: hd, x2: wx, y2: wy, over: null }; select('door', hd.id); }
    else if (hd) toast('Start from an OUT door');
    else drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  }
});

function downSelect(wx, wy, tol, e) {
  const o = getSel();
  if (o && sel.kind === 'element') {
    const m = viewMarkers(o).find(q => e.clientX >= q.x && e.clientX <= q.x + q.w && e.clientY >= q.y && e.clientY <= q.y + q.h);
    if (m) {
      const v = new Set(o.views || []);
      v.has(m.i) ? v.delete(m.i) : v.add(m.i);
      o.views = [...v].sort((p, q) => p - q);
      invalidate(); commit(); buildInspector();
      return;
    }
  }
  if (o && (sel.kind === 'room' || sel.kind === 'element')) {
    const vi = o.pts.findIndex(p => Math.hypot(p[0] - wx, p[1] - wy) < tol);
    if (vi >= 0) { drag = { type: 'vertex', room: o, i: vi }; return; }
    const n = o.pts.length;
    for (let i = 0; i < n; i++) {
      const a = o.pts[i], b = o.pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (Math.hypot(mx - wx, my - wy) < tol) { insertVertex(o, i, [mx, my], 0.5); drag = { type: 'vertex', room: o, i: i + 1 }; return; }
    }
  }
  if (o && sel.kind === 'arrow') {
    if (Math.hypot(o.x1 - wx, o.y1 - wy) < tol) { drag = { type: 'arrowEnd', a: o, end: 1 }; return; }
    if (Math.hypot(o.x2 - wx, o.y2 - wy) < tol) { drag = { type: 'arrowEnd', a: o, end: 2 }; return; }
  }
  let h;
  if ((h = hitLabel(e.clientX, e.clientY))) { select('label', h.id); drag = { type: 'moveLabel', t: h, ox: wx - h.x, oy: wy - h.y }; return; }
  if ((h = hitDoor(wx, wy, tol))) { select('door', h.id); drag = { type: 'door', door: h }; return; }
  if ((h = hitElement(wx, wy, tol))) { select('element', h.id); drag = { type: 'moveEl', el: h, px: wx, py: wy, o: h.pts.map(p => p.slice()) }; return; }
  if ((h = hitArrow(wx, wy, tol))) { select('arrow', h.id); drag = { type: 'moveArrow', a: h, px: wx, py: wy, o: { ...h } }; return; }
  if ((h = hitLink(wx, wy, tol))) { select('link', h.id); return; }
  if ((h = hitRoom(wx, wy))) {
    select('room', h.id);
    drag = { type: 'moveRoom', room: h, px: wx, py: wy, o: h.pts.map(p => p.slice()),
      els: doc.elements.filter(x => elRoomId(x) === h.id).map(x => [x, x.pts.map(p => p.slice())]),
      ars: doc.arrows.filter(x => arRoomId(x) === h.id).map(x => [x, x.x1, x.y1, x.x2, x.y2]),
      lbs: doc.labels.filter(x => pip(x.x, x.y, h.pts)).map(x => [x, x.x, x.y]),
      ags: sim.agents.filter(a => a.room === h.id).map(a => [a, a.x, a.y]) };
    return;
  }
  select(null);
  drag = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
}

canvas.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [p, q] = [...pointers.values()];
    const d = Math.hypot(p.x - q.x, p.y - q.y), cx = (p.x + q.x) / 2, cy = (p.y + q.y) / 2;
    view.x += cx - pinch.cx; view.y += cy - pinch.cy;
    zoomAt(cx, cy, d / (pinch.d || d));
    pinch = { d, cx, cy };
    return;
  }
  const [wx, wy] = S2W(e.clientX, e.clientY);
  if (drag) { moveDrag(wx, wy, e); return; }
  hoverAt(wx, wy, e);
});

function moveDrag(wx, wy, e) {
  const d = drag;
  switch (d.type) {
    case 'pan': view.x = d.vx + (e.clientX - d.sx); view.y = d.vy + (e.clientY - d.sy); break;
    case 'vertex': {
      const fine = !isRoom(d.room);   // elements are small: snap to 10 cm
      d.room.pts[d.i] = fine ? [snap ? Math.round(wx * 10) / 10 : +wx.toFixed(2), snap ? Math.round(wy * 10) / 10 : +wy.toFixed(2)] : [snapv(wx), snapv(wy)];
      if (fine) { syncEl(d.room); refreshInspectorValues(); }
      invalidate(); break;
    }
    case 'moveRoom': {
      const dx = snapv(wx - d.px), dy = snapv(wy - d.py);
      d.room.pts = d.o.map(p => [p[0] + dx, p[1] + dy]);
      d.els.forEach(([x, P]) => { x.pts = P.map(p => [p[0] + dx, p[1] + dy]); syncEl(x); });
      d.ars.forEach(([x, x1, y1, x2, y2]) => { x.x1 = x1 + dx; x.y1 = y1 + dy; x.x2 = x2 + dx; x.y2 = y2 + dy; });
      d.ags.forEach(([a, X, Y]) => { a.x = X + dx; a.y = Y + dy; });
      d.lbs.forEach(([x, X, Y]) => { x.x = X + dx; x.y = Y + dy; });
      invalidate(); break;
    }
    case 'moveLabel': d.t.x = snapv(wx - d.ox); d.t.y = snapv(wy - d.oy); needsRender = true; break;
    case 'moveEl': {
      const dx = snapv(wx - d.px), dy = snapv(wy - d.py);
      d.el.pts = d.o.map(p => [p[0] + dx, p[1] + dy]); syncEl(d.el);
      invalidate(); break;
    }
    case 'arrowEnd': d.a['x' + d.end] = snapv(wx); d.a['y' + d.end] = snapv(wy); invalidate(); break;
    case 'moveArrow': {
      const dx = snapv(wx - d.px), dy = snapv(wy - d.py);
      Object.assign(d.a, { x1: d.o.x1 + dx, y1: d.o.y1 + dy, x2: d.o.x2 + dx, y2: d.o.y2 + dy });
      invalidate(); break;
    }
    case 'door': {
      const r = roomById(d.door.room);
      if (r) { const ne = nearestEdgeOf(r, wx, wy); d.door.edge = ne.edge; d.door.t = ne.t; invalidate(); }
      break;
    }
    case 'newRoom': d.x2 = snapv(wx); d.y2 = snapv(wy); break;
    case 'newArrow': d.x2 = snapv(wx); d.y2 = snapv(wy); break;
    case 'link': {
      d.x2 = wx; d.y2 = wy;
      const h = hitDoor(wx, wy, tolW(10));
      d.over = h && canIn(h) && h.room !== d.from.room ? h : null;
      break;
    }
  }
  needsRender = true;
}

function hoverAt(wx, wy, e) {
  let cursor = tool === 'select' ? 'default' : 'crosshair';
  const prevEdge = hoverEdge;
  hoverEdge = null;
  if (tool === 'door') {
    const ne = nearestEdgeAll(wx, wy);
    if (ne && ne.d < tolW(14) && !hitDoor(wx, wy, tolW(8))) hoverEdge = ne;
    if (hoverEdge || prevEdge) needsRender = true;
  }
  if (tool === 'select') {
    const tol = tolW(8), o = getSel();
    if (o && (sel.kind === 'room' || sel.kind === 'element') && (o.pts.some(p => Math.hypot(p[0] - wx, p[1] - wy) < tol))) cursor = 'move';
    else if (o && sel.kind === 'element' && viewMarkers(o).some(q => e.clientX >= q.x && e.clientX <= q.x + q.w && e.clientY >= q.y && e.clientY <= q.y + q.h)) cursor = 'pointer';
    else if (hitDoor(wx, wy, tol)) cursor = 'ew-resize';
    else if (hitLabel(e.clientX, e.clientY) || hitElement(wx, wy, tol) || hitArrow(wx, wy, tol)) cursor = 'move';
    else if (hitLink(wx, wy, tol)) cursor = 'pointer';
    else if (hitRoom(wx, wy)) cursor = 'move';
  }
  if (tool === 'link') cursor = hitDoor(wx, wy, tolW(8)) ? 'pointer' : 'default';
  const ag = sim.agents.length ? hitAgent(wx, wy) : null;
  if (ag !== hoverAgent) { hoverAgent = ag; needsRender = true; }
  if (ag) { cursor = 'default'; showTip(e.clientX, e.clientY); } else hideTip();
  canvas.style.cursor = cursor;
}

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.type === 'newRoom') {
    const w = Math.abs(d.x2 - d.x1), h = Math.abs(d.y2 - d.y1);
    if (w >= 1 && h >= 1) {
      const x0 = Math.min(d.x1, d.x2), y0 = Math.min(d.y1, d.y2);
      const room = { id: uid('r'), name: 'Room ' + (doc.rooms.length + 1), flow: 0.6, pts: [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]] };
      doc.rooms.push(room);
      invalidate();
      select('room', room.id);
      setTool('select');
    } else toast('Drag to draw a room');
  } else if (d.type === 'newArrow') {
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= 0.5) {
      const a = { id: uid('a'), x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 };
      doc.arrows.push(a);
      if (!arRoomId(a)) toast('Arrows only steer people inside a room');
      invalidate();
    }
  } else if (d.type === 'link') {
    if (d.over) {
      const l = setLink(d.from, d.over);
      select('link', l.id);
      invalidate();
    }
  }
  if (d.type !== 'pan') { commit(); buildInspector(); }
  needsRender = true;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!drag) { hideTip(); if (hoverEdge) { hoverEdge = null; needsRender = true; } } });

function focusLabelText() {
  // after the click has finished, or the canvas takes the focus back
  setTimeout(() => { const ta = $('#inspector textarea[data-k="text"]'); if (ta) { ta.focus(); ta.select(); } }, 0);
}
canvas.addEventListener('dblclick', e => {
  if (tool !== 'select') return;
  const hl = hitLabel(e.clientX, e.clientY);
  if (hl) { select('label', hl.id); focusLabelText(); return; }
  const [wx, wy] = S2W(e.clientX, e.clientY);
  const o = getSel(), tol = tolW(8);
  if (o && (sel.kind === 'room' || sel.kind === 'element')) {
    const vi = o.pts.findIndex(p => Math.hypot(p[0] - wx, p[1] - wy) < tol);
    if (vi >= 0) { deleteVertex(o, vi); buildInspector(); return; }
    const ne = nearestEdgeOf(o, wx, wy);
    if (ne.d < tol && ne.t > 0.02 && ne.t < 0.98) { insertVertex(o, ne.edge, isRoom(o) ? [snapv(ne.x), snapv(ne.y)] : [+ne.x.toFixed(2), +ne.y.toFixed(2)], ne.t); commit(); buildInspector(); }
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const k = e.deltaMode === 1 ? 0.05 : 0.0015;
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : k)));
}, { passive: false });

/* =========================================================
   Tooltip / toast / hint
   ========================================================= */
const tipEl = $('#tip');
let tipPos = [0, 0];
function agentInfo(a) {
  const room = roomById(a.room);
  let what = 'WANDERING';
  if (a.state === 'dwell') { const el = elById(a.look); what = 'LOOKING AT ' + (el ? el.name.toUpperCase() : '…'); }
  else if (a.target && a.target.kind === 'el') { const el = elById(a.target.id); what = 'GOING TO ' + (el ? el.name.toUpperCase() : '…'); }
  else if (a.target && a.target.kind === 'exit') {
    const d = doorById(a.target.id);
    const next = d && leadsTo(d);
    what = next ? 'ON TO ' + (roomById(next.room)?.name || '').toUpperCase() : 'LEAVING';
  }
  return `#${String(a.id).padStart(4, '0')} · ${what} · ${(room ? room.name : '').toUpperCase()} · ${fmtTime(sim.t - a.born)}`;
}
function showTip(x, y) {
  if (x != null) tipPos = [x, y];
  if (!hoverAgent) return hideTip();
  tipEl.textContent = agentInfo(hoverAgent);
  tipEl.classList.remove('hidden');
  const w = tipEl.offsetWidth;
  let left = tipPos[0] + 14;
  if (left + w > CW - 8) left = tipPos[0] - w - 14;
  tipEl.style.left = left + 'px';
  tipEl.style.top = (tipPos[1] + 14) + 'px';
}
function hideTip() { tipEl.classList.add('hidden'); }

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

const HINTS = {
  select: 'Click to select. Drag to move. Drag empty space to pan. Scroll or pinch to zoom.',
  room: 'Drag to draw a room. Shape it afterwards by dragging its corners.',
  door: 'Click a wall to add a door. Drag it along the wall to move it.',
  arrow: 'Drag inside a room to show the general direction of the flow.',
  element: 'Click inside a room to place an element. Elements pull people in.',
  link: 'Drag between two PASSAGE doors to connect rooms both ways, or from an OUT to an IN door for one way.',
  label: 'Click to place a label. Double-click a label to edit its text.',
};
function setTool(t) {
  tool = t;
  $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  $('#hint').textContent = HINTS[t] || '';
  hoverEdge = null;
  canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
  needsRender = true;
}
function updateMeta() { $('#meta').textContent = `FLOW v${VERSION} · ${Math.round(view.z * 100)}%`; }

/* =========================================================
   Inspector
   ========================================================= */
const FMT = {
  pct: v => Math.round(v * 100) + '%',
  int: v => String(Math.round(v)),
  sec: v => Math.round(v) + ' S',
  m: v => (v ? Number(v.toFixed(1)) + ' M' : 'NONE'),
};
const fieldText = (label, key, val) => `<div class="field"><div class="field-top"><span class="label">${label}</span></div><input type="text" data-k="${key}" value="${esc(val)}" maxlength="40"></div>`;
const fieldNum = (label, key, val, min, max, step, unit) => `<div class="field"><div class="field-top"><span class="label">${label}</span><span class="val muted">${unit || ''}</span></div><input type="number" data-k="${key}" value="${val}" min="${min}" max="${max}" step="${step}"></div>`;
const fieldRange = (label, key, val, min, max, step, fmt) => `<div class="field"><div class="field-top"><span class="label">${label}</span><span class="val" data-show="${key}" data-fmt="${fmt}">${FMT[fmt](val)}</span></div><input type="range" data-k="${key}" value="${val}" min="${min}" max="${max}" step="${step}"></div>`;
const fieldSeg = (label, key, val, opts) => `<div class="field"><div class="field-top"><span class="label">${label}</span></div><div class="seg">${opts.map(([v, t]) => `<button class="btn${String(val) === String(v) ? ' on' : ''}" data-set="${key}" data-v="${v}">${t}</button>`).join('')}</div></div>`;
const stat = (k, v, live) => `<div class="stat"><span class="k">${k}</span><span class="v"${live ? ` data-live="${live}"` : ''}>${v}</span></div>`;

function buildInspector() {
  const box = $('#inspector');
  const o = getSel();
  if (!o) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  const kind = sel.kind;
  let h = `<div class="panel-head"><span class="label">${{ room: 'ROOM', door: 'DOOR', element: 'ELEMENT', arrow: 'FLOW ARROW', link: 'LINK', label: 'LABEL' }[kind]}</span><button class="btn close" data-act="close" aria-label="Close">×</button></div><div class="panel-body">`;

  if (kind === 'room') {
    h += fieldText('NAME', 'name', o.name);
    h += fieldRange('FLOW STRENGTH', 'flow', o.flow, 0, 1, 0.05, 'pct');
    h += `<div class="stats">${stat('Area', polyArea(o.pts).toFixed(1) + ' m²')}${stat('Corners', o.pts.length)}${stat('People now', 0, 'room-now')}${stat('Doors', doc.doors.filter(d => d.room === o.id).length)}</div>`;
    h += `<p class="note">Drag a corner to reshape. Drag a + to add a corner. Double-click a corner to remove it. Flow strength sets how closely people follow the arrows.</p>`;
  }
  if (kind === 'door') {
    h += fieldSeg('TYPE', 'type', o.type, [['in', 'IN'], ['out', 'OUT'], ['both', 'IN/OUT'], ['pass', 'PASSAGE']]);
    h += fieldNum('WIDTH', 'w', o.w, 0.4, 50, 0.1, 'M');
    if (canOut(o)) {
      const to = leadsTo(o);
      const targets = doc.doors.filter(d => d.room !== o.room && canIn(d));
      const none = o.type === 'pass' ? 'NOT CONNECTED' : 'OUTSIDE · LEAVES';
      h += `<div class="field"><div class="field-top"><span class="label">${o.type === 'pass' ? 'CONNECTS TO' : 'LEADS TO'}</span></div><select data-act="link"><option value="">${none}</option>${targets.map(d => `<option value="${d.id}"${to && to.id === d.id ? ' selected' : ''}>${esc(doorName(d))}</option>`).join('')}</select></div>`;
    }
    const from = doc.links.filter(l => l.to === o.id && !(o.type === 'pass' && isTwoWay(l))).map(l => doorById(l.from)).filter(Boolean);
    const DOOR_NOTE = {
      in: 'The way in from outside. People arrive here.',
      out: 'The way out. People leave the simulation here, unless it leads to another room.',
      both: 'To the outside, both ways. People arrive and leave here.',
      pass: 'Connects two rooms, both ways when the other side is a passage too. Nobody arrives or leaves the simulation here.',
    };
    h += `<p class="note">${DOOR_NOTE[o.type]}</p>`;
    if (from.length) h += `<p class="note">People arrive here from ${from.map(d => esc(doorName(d))).join(', ')}.</p>`;
    h += `<p class="note">Drag the door along the walls of its room to move it.</p>`;
  }
  if (kind === 'element') {
    h += fieldText('NAME', 'name', o.name);
    h += `<div class="field-pair">${fieldNum('WIDTH', 'w', +o.w.toFixed(2), 0.1, 100, 0.1, 'M')}${fieldNum('DEPTH', 'h', +o.h.toFixed(2), 0.1, 100, 0.1, 'M')}</div>`;
    h += `<div class="field"><div class="field-top"><span class="label">SHAPE</span><span class="val muted">${o.pts.length} CORNERS</span></div><div class="seg"><button class="btn" data-act="shape" data-v="rect">RECT</button><button class="btn" data-act="shape" data-v="round">ROUND</button></div></div>`;
    h += `<div class="field"><div class="field-top"><span class="label">VIEWED FROM</span><span class="val">${hasViews(o) ? o.views.length + (o.views.length > 1 ? ' SIDES' : ' SIDE') : 'ALL SIDES'}</span></div>${hasViews(o) ? '<div class="seg"><button class="btn" data-act="allsides">ALL SIDES</button></div>' : ''}</div>`;
    h += fieldRange('ATTRACTION', 'attr', o.attr, 1, 10, 1, 'int');
    h += fieldRange('VIEWING TIME', 'dwell', o.dwell, 0, 300, 5, 'sec');
    h += fieldRange('MIN DISTANCE', 'near', o.near || 0, 0, 8, 0.1, 'm');
    h += fieldSeg('BLOCKS WALKING', 'solid', o.solid, [['true', 'YES'], ['false', 'NO']]);
    h += `<div class="stats">${stat('Looking now', 0, 'el-now')}${stat('Visits', 0, 'el-visits')}${stat('Avg look', '–', 'el-avg')}${stat('Reach', noticeR(o).toFixed(1) + ' m', 'el-reach')}${stat('Fits', capacity(o) + ' people', 'el-cap')}</div>`;
    h += `<p class="note">Drag a corner to reshape. Drag a + to add a corner. Double-click a corner to remove it. Click VIEW next to a side to make it a viewing side: people stand in front of it and look at it.</p>`;
    h += `<p class="note">Attraction sets how far away people notice it and how many go and look. The grey band shows its reach. When it's full, people skip it.</p>`;
    h += `<p class="note">Min distance keeps people back, like a screen or a big canvas. The dashed line shows where they start standing. If there's no room for that, people skip it.</p>`;
  }
  if (kind === 'label') {
    h += `<div class="field"><div class="field-top"><span class="label">TEXT</span><span class="val muted">ENTER = NEW LINE</span></div><textarea data-k="text" rows="3" maxlength="400">${esc(o.text)}</textarea></div>`;
    h += fieldSeg('STYLE', 'style', o.style, [['box', 'LABEL'], ['text', 'TEXT']]);
    h += `<p class="note">Drag to move. Labels inside a room move with it.</p>`;
  }
  if (kind === 'arrow') {
    h += `<p class="note">People lean towards the arrow's direction nearby. Walking against it costs them more. Set how strong per room.</p>`;
    h += `<div class="row"><button class="btn" data-act="reverse">REVERSE</button></div>`;
  }
  if (kind === 'link') {
    const a = doorById(o.from), b = doorById(o.to);
    h += `<p class="note">People leaving through <b>${esc(a ? doorName(a) : '?')}</b> come in through <b>${esc(b ? doorName(b) : '?')}</b>.</p>`;
  }
  h += `<div class="row end" style="margin-top:6px"><button class="btn danger" data-act="delete">DELETE</button></div></div>`;
  box.innerHTML = h;
  refreshInspectorValues();
  updateLive();
}

function refreshInspectorValues() {
  const o = getSel();
  if (!o) return;
  $$('#inspector input[data-k]').forEach(inp => {
    if (document.activeElement === inp) return;
    const v = o[inp.dataset.k];
    if (inp.type === 'number') inp.value = Math.round(v * 100) / 100;
  });
}

$('#inspector').addEventListener('input', e => {
  const inp = e.target, o = getSel();
  if (!o || !inp.dataset.k) return;
  const k = inp.dataset.k;
  if (inp.type === 'text' || inp.tagName === 'TEXTAREA') { o[k] = inp.value; if (sel.kind === 'label') { needsRender = true; return; } }
  else {
    const v = parseFloat(inp.value);
    if (!Number.isFinite(v)) return;
    if (sel.kind === 'element' && (k === 'w' || k === 'h')) {
      const val = clamp(v, +inp.min, +inp.max);
      scaleEl(o, k === 'w' ? val : o.w, k === 'h' ? val : o.h);
    } else o[k] = clamp(v, +inp.min, +inp.max);
    const show = $(`#inspector [data-show="${k}"]`);
    if (show) show.textContent = FMT[show.dataset.fmt](o[k]);
    if (k === 'attr') { const r = $('#inspector [data-live="el-reach"]'); if (r) r.textContent = noticeR(o).toFixed(1) + ' m'; }
    const cp = $('#inspector [data-live="el-cap"]'); if (cp && o.w) cp.textContent = capacity(o) + ' people';
    if (k === 'near') needsRender = true;
  }
  invalidate();
});
$('#inspector').addEventListener('change', e => {
  if (e.target.dataset.act === 'link') {
    const o = getSel();
    setLink(o, doorById(e.target.value) || null);
    invalidate();
  }
  commit();
  if (e.target.dataset.k === 'name') buildInspector();
  if (e.target.dataset.k === 'text') needsRender = true;
});
$('#inspector').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur();
  if (e.key === 'Escape' && e.target.tagName === 'TEXTAREA') e.target.blur();
});
$('#inspector').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const o = getSel();
  if (b.dataset.act === 'close') { select(null); return; }
  if (!o) return;
  if (b.dataset.act === 'delete') { deleteSel(); return; }
  if (b.dataset.act === 'shape') {
    o.pts = b.dataset.v === 'round' ? roundPts(o.x, o.y, Math.max(o.w, o.h)) : rectPts(o.x, o.y, o.w, o.h);
    o.views = []; syncEl(o); invalidate(); commit(); buildInspector(); return;
  }
  if (b.dataset.act === 'allsides') { o.views = []; invalidate(); commit(); buildInspector(); return; }
  if (b.dataset.act === 'reverse') { [o.x1, o.y1, o.x2, o.y2] = [o.x2, o.y2, o.x1, o.y1]; invalidate(); commit(); return; }
  if (b.dataset.set) {
    const k = b.dataset.set;
    let v = b.dataset.v;
    if (v === 'true') v = true; else if (v === 'false') v = false;
    o[k] = v;
    if (k === 'type' && !canOut(o)) doc.links = doc.links.filter(l => l.from !== o.id);
    if (k === 'type' && !canIn(o)) doc.links = doc.links.filter(l => l.to !== o.id);
    invalidate(); commit(); buildInspector();
  }
});

function updateLive() {
  const o = getSel();
  if (!o) return;
  const set = (k, v) => { const el = $(`#inspector [data-live="${k}"]`); if (el) el.textContent = v; };
  if (sel.kind === 'room') set('room-now', sim.agents.filter(a => a.room === o.id).length);
  if (sel.kind === 'element') {
    const s = sim.el.get(o.id);
    set('el-now', viewersOf(o.id));
    set('el-visits', s ? s.visits : 0);
    set('el-avg', s && s.visits ? fmtTime(s.dwell / s.visits) : '–');
  }
}

/* =========================================================
   Simulation panel
   ========================================================= */
function syncSettings() {
  const s = doc.settings;
  $('#in-rate').value = s.rate; $('#v-rate').textContent = s.rate + ' / MIN';
  $('#in-total').value = s.total;
  $('#in-pace').value = s.pace; $('#v-pace').textContent = s.pace.toFixed(2) + ' M/S';
  $('#in-cur').value = s.curiosity; $('#v-cur').textContent = Math.round(s.curiosity * 100) + '%';
}
function bindSetting(id, key, parse) {
  const inp = $(id);
  inp.addEventListener('input', () => { const v = parse(inp.value); if (Number.isFinite(v)) { doc.settings[key] = v; syncLabels(); } });
  inp.addEventListener('change', () => { syncSettings(); commit(); });
}
function syncLabels() {
  const s = doc.settings;
  $('#v-rate').textContent = s.rate + ' / MIN';
  $('#v-pace').textContent = s.pace.toFixed(2) + ' M/S';
  $('#v-cur').textContent = Math.round(s.curiosity * 100) + '%';
}
bindSetting('#in-rate', 'rate', v => clamp(Math.round(+v), 0, 600));
bindSetting('#in-total', 'total', v => clamp(Math.round(+v || 0), 0, 1e6));
bindSetting('#in-pace', 'pace', v => clamp(+v, 0.2, 3));
bindSetting('#in-cur', 'curiosity', v => clamp(+v, 0, 1));

function updatePlay() {
  const b = $('#btn-play');
  b.textContent = sim.running ? 'PAUSE' : (sim.t > 0 ? 'RESUME' : 'PLAY');
}
function togglePlay() {
  if (!sim.running) {
    if (!doc.rooms.length) { toast('Draw a room first'); return; }
    if (!sources().length) { toast('Add an IN door so people can arrive'); return; }
    if (doc.settings.total && sim.spawned >= doc.settings.total && !sim.agents.length) resetSim();
  }
  sim.running = !sim.running;
  updatePlay();
}

function simWarnings() {
  if (!doc.rooms.length) return 'Draw a room to start.';
  if (!sources().length) return 'Add an IN door. People arrive there.';
  const loose = doc.doors.filter(d => d.type === 'pass' && !leadsTo(d));
  if (loose.length) return `${loose.map(doorName).join(', ')} is not connected yet. Use LINK or its panel.`;
  const stuck = doc.rooms.filter(r => doc.doors.some(d => d.room === r.id) && !doc.doors.some(d => d.room === r.id && canExit(d)));
  if (stuck.length) return `${stuck.map(r => r.name.toUpperCase()).join(', ')} has no way out. People will stay.`;
  const unreached = doc.rooms.filter(r => !doc.doors.some(d => d.room === r.id));
  if (unreached.length) return `${unreached.map(r => r.name.toUpperCase()).join(', ')} has no doors yet.`;
  return '';
}

function updateStats() {
  $('#sim-clock').textContent = fmtTime(sim.t);
  $('#s-now').textContent = sim.agents.length;
  $('#s-peak').textContent = sim.peak;
  $('#s-in').textContent = sim.spawned;
  $('#s-out').textContent = sim.exited;
  $('#s-stay').textContent = sim.exited ? fmtTime(sim.staySum / sim.exited) : '–';
  $('#s-hour').textContent = sim.t > 60 ? Math.round(sim.exited / sim.t * 3600) : '–';
  const w = simWarnings(), note = $('#sim-note');
  note.textContent = w;
  note.classList.toggle('hidden', !w);
}

/* =========================================================
   Files: JSON, PNG, SVG
   ========================================================= */
const slug = () => (doc.name || 'flow').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow';
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function saveJSON() {
  download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${slug()}.flow.json`);
  toast('Saved');
}
function exportBox() {
  const bb = contentBBox();
  if (!bb) return null;
  return { minx: bb.minx - 2, miny: bb.miny - 2.5, maxx: bb.maxx + 2, maxy: bb.maxy + 2 };
}
async function exportPNG() {
  const bb = exportBox();
  if (!bb) { toast('Nothing to export yet'); return; }
  await document.fonts.ready;
  const scale = 2, w = (bb.maxx - bb.minx) * PX, h = (bb.maxy - bb.miny) * PX;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * scale); cv.height = Math.ceil(h * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  drawScene(c, { x: -bb.minx * PX, y: -bb.miny * PX, z: 1 }, w, h, { grid: false, ui: false, agents: true, heat: showHeat, cones: showCones, sh: scale });
  c.font = `11px ${MONO}`; c.fillStyle = '#aaa'; c.textAlign = 'right'; c.textBaseline = 'bottom';
  c.fillText('tastbaar.studio', w - 8, h - 6);
  cv.toBlob(b => download(b, `${slug()}.png`), 'image/png');
}

function exportSVG() {
  const bb = exportBox();
  if (!bb) { toast('Nothing to export yet'); return; }
  const f = v => (v * PX).toFixed(2);
  const P = (x, y) => `${f(x)},${f(y)}`;
  const W = (bb.maxx - bb.minx) * PX, H = (bb.maxy - bb.miny) * PX;
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(bb.minx)} ${f(bb.miny)} ${W.toFixed(2)} ${H.toFixed(2)}" width="${Math.round(W)}" height="${Math.round(H)}" font-family="'Courier Prime', 'Courier New', monospace">`);
  o.push(`<style>@import url('https://fonts.googleapis.com/css2?family=Courier+Prime&amp;display=swap');</style>`);
  o.push(`<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.2"/></filter>`);
  o.push(`<linearGradient id="cone"><stop offset="0" stop-color="#000" stop-opacity="0.26"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>`);
  o.push(`<linearGradient id="cone-a"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0.75"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></linearGradient>`);
  o.push(`<clipPath id="rooms">${doc.rooms.map(r => `<polygon points="${r.pts.map(p => P(p[0], p[1])).join(' ')}"/>`).join('')}</clipPath></defs>`);

  o.push(`<g id="rooms-floor">`);
  for (const r of doc.rooms) o.push(`<polygon points="${r.pts.map(p => P(p[0], p[1])).join(' ')}" fill="#fff" filter="url(#sh)"/>`);
  o.push(`</g>`);

  if (showHeat && sim.heat) {
    const h = sim.heat;
    let max = 0;
    for (const v of h.data) if (v > max) max = v;
    if (max > 0) {
      o.push(`<g id="heat" fill="#000" clip-path="url(#rooms)">`);
      for (let j = 0; j < h.H; j++) for (let i = 0; i < h.W; i++) {
        const v = h.data[j * h.W + i];
        if (v > 0) o.push(`<rect x="${f(h.ox + i * h.res)}" y="${f(h.oy + j * h.res)}" width="${f(h.res)}" height="${f(h.res)}" fill-opacity="${(Math.sqrt(v / max) * 0.34).toFixed(3)}"/>`);
      }
      o.push(`</g>`);
    }
  }

  o.push(`<g id="flow" stroke="#9a9a9a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none">`);
  for (const a of doc.arrows) {
    const hp = headPts(a.x2, a.y2, Math.atan2(a.y2 - a.y1, a.x2 - a.x1), 0.45);
    o.push(`<line x1="${f(a.x1)}" y1="${f(a.y1)}" x2="${f(a.x2)}" y2="${f(a.y2)}"/><polyline points="${hp.map(p => P(p[0], p[1])).join(' ')}"/>`);
  }
  o.push(`</g>`);

  o.push(`<g id="elements">`);
  for (const e of doc.elements) {
    const attrs = e.solid ? `fill="#fff" filter="url(#sh)"` : `fill="#000" fill-opacity="0.045" stroke="#999" stroke-dasharray="3 3"`;
    o.push(`<polygon points="${e.pts.map(p => P(p[0], p[1])).join(' ')}" ${attrs}/>`);
    if (hasViews(e)) o.push(`<path d="${viewEdges(e).map(E => `M${P(E.ax, E.ay)}L${P(E.bx, E.by)}`).join('')}" stroke="#000" stroke-width="2.5" fill="none"/>`);
  }
  o.push(`</g>`);

  o.push(`<g id="walls" stroke="#000" stroke-width="2" stroke-linecap="square" fill="none">`);
  for (const r of doc.rooms) o.push(`<path d="${wallSegs(r).map(w => `M${P(w[0], w[1])}L${P(w[2], w[3])}`).join('')}"/>`);
  o.push(`</g>`);

  o.push(`<g id="doors" stroke="#000" stroke-width="1.5" stroke-linecap="round" fill="none">`);
  const doorText = [];
  for (const d of doc.doors) {
    const g = doorG(d);
    if (!g) continue;
    const tk = 0.18;
    o.push(`<line x1="${f(g.x0 - g.nx * tk)}" y1="${f(g.y0 - g.ny * tk)}" x2="${f(g.x0 + g.nx * tk)}" y2="${f(g.y0 + g.ny * tk)}"/>`);
    o.push(`<line x1="${f(g.x1 - g.nx * tk)}" y1="${f(g.y1 - g.ny * tk)}" x2="${f(g.x1 + g.nx * tk)}" y2="${f(g.y1 + g.ny * tk)}"/>`);
    const sh = twoSided(d) ? 0.25 : 0;
    if (canIn(d)) o.push(`<polyline points="${headPts(g.mx + g.nx * 0.42 + g.ux * sh, g.my + g.ny * 0.42 + g.uy * sh, Math.atan2(g.ny, g.nx), 0.22).map(p => P(p[0], p[1])).join(' ')}"/>`);
    if (canOut(d)) o.push(`<polyline points="${headPts(g.mx - g.nx * 0.42 - g.ux * sh, g.my - g.ny * 0.42 - g.uy * sh, Math.atan2(-g.ny, -g.nx), 0.22).map(p => P(p[0], p[1])).join(' ')}"/>`);
    if (!(d.type === 'pass' && leadsTo(d))) doorText.push(`<text x="${(g.mx * PX - g.nx * (0.5 * PX + 8)).toFixed(2)}" y="${(g.my * PX - g.ny * (0.5 * PX + 8)).toFixed(2)}">${PLAN_LABEL[d.type]}</text>`);
  }
  o.push(`</g>`);
  o.push(`<g id="door-labels" font-size="10" fill="#777" text-anchor="middle" dominant-baseline="central">${doorText.join('')}</g>`);

  o.push(`<g id="links" stroke="#9a9a9a" stroke-width="1.2" fill="none">`);
  for (const l of doc.links) {
    const p = linkCurve(l);
    if (!p) continue;
    const hp = headPts(p[6], p[7], Math.atan2(p[7] - p[5], p[6] - p[4]), 0.4);
    o.push(`<path d="M${P(p[0], p[1])}C${P(p[2], p[3])} ${P(p[4], p[5])} ${P(p[6], p[7])}" stroke-dasharray="4 4"/>${isTwoWay(l) ? '' : `<polyline points="${hp.map(q => P(q[0], q[1])).join(' ')}"/>`}`);
  }
  o.push(`</g>`);

  const live = sim.agents.filter(a => roomById(a.room));
  if (live.length) {
    o.push(`<g id="audience">`);
    const L = CONE_L * PX, hw = L * 52 / 128;
    if (showCones) for (const a of live) o.push(`<path transform="translate(${f(a.x)} ${f(a.y)}) rotate(${(a.h * 180 / Math.PI).toFixed(1)})" d="M0 0L${L.toFixed(2)} ${(-hw).toFixed(2)}L${L.toFixed(2)} ${hw.toFixed(2)}Z" fill="url(#${a.state === 'dwell' ? 'cone-a' : 'cone'})"/>`);
    for (const a of live) o.push(`<circle cx="${f(a.x)}" cy="${f(a.y)}" r="${f(AGENT_R)}" fill="#111" stroke="#fff" stroke-width="1"><title>#${String(a.id).padStart(4, '0')}</title></circle>`);
    o.push(`</g>`);
  }

  // text
  const lab = (text, x, y, anchor, size = 11) => {
    const bw = Math.ceil(text.length * size * 0.6 + 10), bh = size + 6;
    const bx = anchor[1] === 'r' ? x - bw : x, by = anchor[0] === 'b' ? y - bh : y;
    return `<g><rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw}" height="${bh}" fill="#000"/><text x="${(bx + 5).toFixed(2)}" y="${(by + bh / 2 + 0.5).toFixed(2)}" fill="#fff" font-size="${size}" dominant-baseline="central">${esc(text)}</text></g>`;
  };
  o.push(`<g id="names" font-size="10" text-anchor="middle">`);
  for (const e of doc.elements) {
    const name = e.name.toUpperCase(), wpx = e.w * PX, hpx = elH(e) * PX;
    if (name.length * 6 < wpx - 6 && hpx > 14) o.push(`<text x="${f(e.x)}" y="${(e.y * PX + 0.5).toFixed(2)}" dominant-baseline="central" fill="#000">${esc(name)}</text>`);
    else o.push(`<text x="${f(e.x)}" y="${(e.y * PX + hpx / 2 + 4).toFixed(2)}" dominant-baseline="hanging" fill="#555">${esc(name)}</text>`);
  }
  o.push(`</g>`);
  const counts = sim.t > 0 ? roomCounts() : null;
  o.push(`<g id="room-labels">`);
  for (const r of doc.rooms) {
    const b = bboxOf(r.pts);
    o.push(lab(r.name.toUpperCase(), b.minx * PX, b.miny * PX - 6, 'bl'));
    if (counts) o.push(lab(String(counts.get(r.id) || 0), b.maxx * PX, b.miny * PX - 6, 'br'));
  }
  o.push(`</g>`);
  o.push(`<g id="labels" font-size="${LABEL_SIZE}">`);
  for (const t of doc.labels) {
    const x = t.x * PX, y = t.y * PX;
    if (t.style === 'box') {
      const lines = labelLines(t);
      const w = Math.ceil(Math.max(...lines.map(l => l.length)) * LABEL_SIZE * 0.6 + 12), hh = lines.length * LABEL_LH + 4;
      o.push(`<g><rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w}" height="${hh}" fill="#000"/>${lines.map((l, i) => `<text x="${(x + 6).toFixed(2)}" y="${(y + 2 + LABEL_LH * (i + 0.5) + 0.5).toFixed(2)}" fill="#fff" dominant-baseline="central">${esc(l)}</text>`).join('')}</g>`);
    } else {
      o.push(`<g>${(t.text || '').split('\n').map((l, i) => `<text x="${x.toFixed(2)}" y="${(y + LABEL_LH * (i + 0.5) + 0.5).toFixed(2)}" fill="#000" dominant-baseline="central" xml:space="preserve">${esc(l)}</text>`).join('')}</g>`);
    }
  }
  o.push(`</g>`);
  o.push(`<text x="${(bb.maxx * PX - 8).toFixed(2)}" y="${(bb.maxy * PX - 6).toFixed(2)}" text-anchor="end" font-size="11" fill="#aaa">tastbaar.studio</text>`);
  o.push(`</svg>`);
  download(new Blob([o.join('\n')], { type: 'image/svg+xml' }), `${slug()}.svg`);
}

const fileInput = $('#file-input');
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result);
      if (!data || !Array.isArray(data.rooms)) throw new Error('no rooms');
      loadDoc(data);
      toast('Loaded ' + (doc.name || 'file'));
    } catch (err) { toast('That file is not a Flow project'); }
    fileInput.value = '';
  };
  rd.readAsText(file);
});

/* =========================================================
   Toolbar, keys, welcome
   ========================================================= */
$$('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#btn-snap').addEventListener('click', e => { snap = !snap; e.currentTarget.classList.toggle('on', snap); });
$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);
$('#btn-fit').addEventListener('click', fitView);
$('#btn-new').addEventListener('click', () => { loadDoc(newDoc()); setTool('room'); toast('Empty plan. Drag to draw a room. UNDO brings the old one back.'); });
$('#btn-load').addEventListener('click', () => fileInput.click());
$('#btn-save').addEventListener('click', saveJSON);
$('#btn-png').addEventListener('click', exportPNG);
$('#btn-svg').addEventListener('click', exportSVG);
$('#btn-help').addEventListener('click', () => $('#welcome').classList.remove('hidden'));
$('#btn-play').addEventListener('click', togglePlay);
$('#btn-reset').addEventListener('click', resetSim);
$$('[data-speed]').forEach(b => b.addEventListener('click', () => {
  sim.speed = +b.dataset.speed;
  $$('[data-speed]').forEach(x => x.classList.toggle('on', x === b));
}));
$('#btn-heat').addEventListener('click', e => { showHeat = !showHeat; e.currentTarget.classList.toggle('on', showHeat); needsRender = true; });
$('#btn-cones').addEventListener('click', e => { showCones = !showCones; e.currentTarget.classList.toggle('on', showCones); needsRender = true; });
$('#sim-toggle').addEventListener('click', () => $('#sim-panel').classList.toggle('collapsed'));

// project name
const nameEl = $('#project-name');
function renderName() {
  nameEl.textContent = (doc.name || 'UNTITLED').toUpperCase();
  document.title = `${nameEl.textContent} — Flow — Tastbaar`;
  $('#brand-title span').textContent = nameEl.textContent;
  fitBrand();
}
// the big name runs a little past the top and bottom of the screen, whatever its length
function fitBrand() {
  const box = $('#brand-title'), span = box.firstElementChild;
  box.style.fontSize = '100px';
  const len = span.getBoundingClientRect().height || 1;
  const size = Math.min(100 * window.innerHeight * 1.08 / len, window.innerWidth * 0.42);
  box.style.fontSize = size.toFixed(1) + 'px';
}
nameEl.addEventListener('click', () => {
  if (nameEl.isContentEditable) return;
  nameEl.contentEditable = 'true';
  nameEl.focus();
  const r = document.createRange(); r.selectNodeContents(nameEl);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});
function endRename(save) {
  if (!nameEl.isContentEditable) return;
  nameEl.contentEditable = 'false';
  if (save) { doc.name = nameEl.textContent.trim().slice(0, 60) || 'UNTITLED'; commit(); }
  renderName();
}
nameEl.addEventListener('blur', () => endRename(true));
nameEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); endRename(false); }
});

window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 's') { e.preventDefault(); saveJSON(); return; }
  if (mod && k === 'o') { e.preventDefault(); fileInput.click(); return; }
  if (mod || e.altKey) return;
  if (!$('#welcome').classList.contains('hidden')) { if (k === 'escape' || k === 'enter') closeWelcome(); return; }
  const tools = { v: 'select', r: 'room', d: 'door', a: 'arrow', e: 'element', l: 'link', t: 'label' };
  if (tools[k]) { setTool(tools[k]); return; }
  if (k === ' ') { e.preventDefault(); togglePlay(); return; }
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); return; }
  if (k === 'escape') { if (drag) { restoreState(current); drag = null; } select(null); setTool('select'); return; }
  if (k === 'f') { fitView(); return; }
  if (k === 'h') { $('#btn-heat').click(); return; }
  if (k === '+' || k === '=') { zoomAt(CW / 2, CH / 2, 1.2); return; }
  if (k === '-') { zoomAt(CW / 2, CH / 2, 1 / 1.2); return; }
});

function closeWelcome() { $('#welcome').classList.add('hidden'); lsSet(STORE_SEEN, '1'); }
$('#welcome').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (e.target.id === 'welcome') { closeWelcome(); return; }
  if (!b) return;
  if (b.dataset.act === 'example') loadDoc(exampleDoc());
  if (b.dataset.act === 'empty') { loadDoc(newDoc()); setTool('room'); }
  closeWelcome();
});

/* =========================================================
   Loop + boot
   ========================================================= */
let lastT = performance.now(), uiTick = 0;
function frame(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  if (sim.running) {
    const simDt = dt * sim.speed;
    const n = Math.max(1, Math.ceil(simDt / 0.05));
    for (let i = 0; i < n && sim.running; i++) simStep(simDt / n);
    needsRender = true;
  }
  if (needsRender) { needsRender = false; render(); }
  uiTick += dt;
  if (uiTick > 0.25) { uiTick = 0; updateStats(); updateLive(); if (hoverAgent) showTip(); }
  requestAnimationFrame(frame);
}

function boot() {
  resize();
  window.addEventListener('resize', () => { resize(); fitBrand(); });
  let saved = null;
  const raw = lsGet(STORE);
  if (raw) { try { saved = JSON.parse(raw); } catch (e) { saved = null; } }
  loadDoc(saved && Array.isArray(saved.rooms) ? saved : exampleDoc(), false);
  setTool('select');
  updateMeta(); updateStats();
  if (!lsGet(STORE_SEEN)) $('#welcome').classList.remove('hidden');
  if (window.matchMedia('(max-width: 600px)').matches) $('#sim-panel').classList.add('collapsed');
  if (document.fonts && document.fonts.load) document.fonts.load(`12px "Courier Prime"`).then(() => { needsRender = true; });
  requestAnimationFrame(frame);
  window.FLOW = { invalidate, doc: () => doc, sim, view, loadDoc, exampleDoc, getNav, wallSegs, walkAt, doorField, distAt, roomById, doorById };   // handy for debugging
}
boot();
})();
