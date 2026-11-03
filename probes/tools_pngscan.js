// tools_pngscan.js — 解 PNG，找竖直黑线（列边界）与水平黑线（行边界）
const fs = require('fs'), zlib = require('zlib');
function decode(p) {
  const b = fs.readFileSync(p);
  let o = 8, w = 0, h = 0, ct = 0, bd = 8, idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8);
    const data = b.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 4;
  const bpp = ch * bd / 8, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++], line = raw.slice(pos, pos + stride); pos += stride;
    const cur = out.slice(y * stride, (y + 1) * stride), prev = y ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, c = prev ? prev[x] : 0, d = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += c; else if (f === 3) v += (a + c) >> 1;
      else if (f === 4) { const pp = a + c - d, pa = Math.abs(pp - a), pb = Math.abs(pp - c), pc = Math.abs(pp - d); v += pa <= pb && pa <= pc ? a : pb <= pc ? c : d; }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
function runs(isOn, n) {                      // 连续为真的区间
  const r = []; let s = -1;
  for (let i = 0; i < n; i++) { if (isOn(i)) { if (s < 0) s = i; } else if (s >= 0) { r.push([s, i - 1]); s = -1; } }
  if (s >= 0) r.push([s, n - 1]);
  return r;
}
const ink = (img, x, y) => { const i = y * img.w * img.ch + x * img.ch; return img.data[i]; };
// 一格内的"墨迹跨度"（px）：只认明显灰黑的像素，排除格线（格线在 x0/x1 端点，调用方给内缩后的区间）
function inkSpan(img, x0, x1, y0, y1, thr) {
  const t = thr == null ? 250 : thr;
  x0 = Math.ceil(x0); x1 = Math.floor(x1); y0 = Math.ceil(y0); y1 = Math.floor(y1);
  let mnx = -1, mxx = -1;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) if (ink(img, x, y) < t) { if (mnx < 0) mnx = x; mxx = x; break; }
  }
  return mnx < 0 ? 0 : mxx - mnx + 1;
}
module.exports = { decode, runs, ink, inkSpan };

if (require.main !== module) return;
const p = process.argv[2];
const img = decode(p);
const dark = (x, y) => { const i = y * img.w * img.ch + x * img.ch; return img.data[i] < 90 && img.data[i + 1] < 90 && img.data[i + 2] < 90; };
// 取表体中部一条扫描带，统计"整列大多为黑"的竖线
const y0 = +process.argv[3] || 100, y1 = +process.argv[4] || 400;
const vlines = runs(x => { let k = 0; for (let y = y0; y <= y1; y++) if (dark(x, y)) k++; return k > (y1 - y0) * 0.6; }, img.w);
const hlines = runs(y => { let k = 0; for (let x = 2; x < img.w - 2; x++) if (dark(x, y)) k++; return k > (img.w - 4) * 0.6; }, img.h);
const ctr = vlines.map(r => (r[0] + r[1]) / 2);
console.log('size', img.w + 'x' + img.h, 'scan', y0 + '-' + y1);
console.log('vlines px', JSON.stringify(ctr));
console.log('vlines pt', JSON.stringify(ctr.map(v => +(v * 1.5).toFixed(1))));
console.log('vgap pt ', JSON.stringify(ctr.slice(1).map((v, i) => +((v - ctr[i]) * 1.5).toFixed(1))));
console.log('hlines px', JSON.stringify(hlines.map(r => (r[0] + r[1]) / 2)));
console.log('hgap pt ', JSON.stringify((() => { const c = hlines.map(r => (r[0] + r[1]) / 2); return c.slice(1).map((v, i) => +((v - c[i]) * 1.5).toFixed(1)); })()));
