// Spherical helpers for drawing and morphing routes.
import { distanceNm } from './router.js';

const RAD = Math.PI / 180;

export const toVec = ([lat, lng]) => [
  Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD),
];

export function slerpLatLng(va, vb, t) {
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const om = Math.acos(dot);
  const [ka, kb] = om < 1e-9 ? [1 - t, t] : [Math.sin((1 - t) * om) / Math.sin(om), Math.sin(t * om) / Math.sin(om)];
  const x = ka * va[0] + kb * vb[0], y = ka * va[1] + kb * vb[1], z = ka * va[2] + kb * vb[2];
  return [Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD];
}

// Resample a [lat, lng] polyline to n points evenly spaced by great-circle arc length.
export function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distanceNm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  const total = cum.at(-1) || 1;
  const out = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (seg < pts.length - 2 && cum[seg + 1] < target) seg++;
    const span = cum[seg + 1] - cum[seg] || 1;
    out.push(slerpLatLng(toVec(pts[seg]), toVec(pts[seg + 1]), Math.min(1, (target - cum[seg]) / span)));
  }
  return out;
}
