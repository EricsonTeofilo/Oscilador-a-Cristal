/**
 * charts.js
 * Lightweight canvas chart utilities — no external dependencies.
 */

/** Map a data value to canvas pixel coordinates */
function mapRange(val, inMin, inMax, outMin, outMax) {
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Draw the impedance magnitude (|Z| dB) vs frequency curve.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{f, magDb}>} data
 * @param {number} fs - Series resonance (Hz)
 * @param {number} fp - Parallel resonance (Hz)
 * @param {object} opts
 */
function drawImpedanceCurve(canvas, data, fs, fp, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth  || canvas.width  / dpr;
  const H = canvas.clientHeight || canvas.height / dpr;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 24, right: 24, bottom: 52, left: 64 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top  - pad.bottom;

  // Background
  ctx.fillStyle = opts.bg || '#0d1117';
  ctx.fillRect(0, 0, W, H);

  if (!data || data.length === 0) return;

  const fVals   = data.map(d => d.f);
  const dbVals  = data.map(d => d.magDb).filter(isFinite);
  const fMin    = fVals[0];
  const fMax    = fVals[fVals.length - 1];
  const dbMin   = Math.min(...dbVals) - 10;
  const dbMax   = Math.max(...dbVals) + 10;

  // Grid
  ctx.strokeStyle = '#1e2d40';
  ctx.lineWidth = 1;
  const yGridSteps = 6;
  for (let i = 0; i <= yGridSteps; i++) {
    const y = pad.top + ch * (i / yGridSteps);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cw, y);
    ctx.stroke();
    const dbLabel = (dbMax - (dbMax - dbMin) * (i / yGridSteps)).toFixed(0);
    ctx.fillStyle = '#5a7a9a';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(dbLabel + ' dB', pad.left - 6, y + 4);
  }

  // Axes labels
  ctx.fillStyle = '#8ab4d4';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Frequência (Hz)', pad.left + cw / 2, H - 8);

  ctx.save();
  ctx.translate(14, pad.top + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('|Z| (dB Ω)', 0, 0);
  ctx.restore();

  // Resonance vertical markers
  const drawMarker = (freq, label, color) => {
    const x = pad.left + mapRange(freq, fMin, fMax, 0, cw);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + ch);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, pad.top - 6);
  };

  drawMarker(fs, 'fs', '#00e5a0');
  drawMarker(fp, 'fp', '#ff6b6b');

  // Inductive region fill
  const xFs = pad.left + mapRange(fs, fMin, fMax, 0, cw);
  const xFp = pad.left + mapRange(fp, fMin, fMax, 0, cw);
  ctx.fillStyle = 'rgba(100,160,255,0.06)';
  ctx.fillRect(xFs, pad.top, xFp - xFs, ch);

  // Impedance curve
  ctx.beginPath();
  ctx.lineWidth = 2.5;

  // Gradient stroke
  const grad = ctx.createLinearGradient(pad.left, 0, pad.left + cw, 0);
  grad.addColorStop(0,   '#3a8ef6');
  grad.addColorStop(0.5, '#00e5a0');
  grad.addColorStop(1,   '#ff6b6b');
  ctx.strokeStyle = grad;

  let first = true;
  for (const d of data) {
    if (!isFinite(d.magDb)) { first = true; continue; }
    const x = pad.left + mapRange(d.f, fMin, fMax, 0, cw);
    const y = pad.top  + mapRange(d.magDb, dbMax, dbMin, 0, ch);
    const yc = Math.max(pad.top, Math.min(pad.top + ch, y));
    if (first) { ctx.moveTo(x, yc); first = false; } else { ctx.lineTo(x, yc); }
  }
  ctx.stroke();

  // X-axis frequency ticks
  const tickCount = 6;
  ctx.fillStyle = '#5a7a9a';
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= tickCount; i++) {
    const f = fMin + (fMax - fMin) * (i / tickCount);
    const x = pad.left + cw * (i / tickCount);
    ctx.fillText(formatHz(f), x, pad.top + ch + 18);
  }
}

/**
 * Draw the transient oscillation waveform.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{t, x}>} data
 */
function drawTransientWaveform(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth  || canvas.width  / dpr;
  const H = canvas.clientHeight || canvas.height / dpr;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 24, right: 24, bottom: 52, left: 64 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top  - pad.bottom;

  ctx.fillStyle = opts.bg || '#0d1117';
  ctx.fillRect(0, 0, W, H);

  if (!data || data.length === 0) return;

  const tMax = data[data.length - 1].t;
  const tMin = 0;

  // Grid
  ctx.strokeStyle = '#1e2d40';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + ch * (i / 4);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
    const label = (1 - 2 * (i / 4)).toFixed(1);
    ctx.fillStyle = '#5a7a9a';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, pad.left - 6, y + 4);
  }

  // Envelope
  ctx.strokeStyle = 'rgba(0,229,160,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  let firstEnv = true;
  for (const d of data) {
    const alpha = opts.alpha || 0;
    const env = Math.exp(-alpha * d.t);
    const x = pad.left + mapRange(d.t, tMin, tMax, 0, cw);
    const y = pad.top + mapRange(env, 1, -1, 0, ch);
    if (firstEnv) { ctx.moveTo(x, y); firstEnv = false; }
    else ctx.lineTo(x, y);
  }
  ctx.beginPath();
  firstEnv = true;
  for (const d of data) {
    const alpha = opts.alpha || 0;
    const env = Math.exp(-alpha * d.t);
    const x = pad.left + mapRange(d.t, tMin, tMax, 0, cw);
    const y = pad.top  + mapRange(env,  1, -1, 0, ch);
    if (firstEnv) { ctx.moveTo(x, y); firstEnv = false; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  firstEnv = true;
  for (const d of data) {
    const alpha = opts.alpha || 0;
    const env = -Math.exp(-alpha * d.t);
    const x = pad.left + mapRange(d.t, tMin, tMax, 0, cw);
    const y = pad.top  + mapRange(env,  1, -1, 0, ch);
    if (firstEnv) { ctx.moveTo(x, y); firstEnv = false; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Waveform
  ctx.beginPath();
  const grad2 = ctx.createLinearGradient(pad.left, 0, pad.left + cw, 0);
  grad2.addColorStop(0,   '#3a8ef6');
  grad2.addColorStop(1,   'rgba(58,142,246,0.2)');
  ctx.strokeStyle = grad2;
  ctx.lineWidth = 1.8;

  // Downsample for performance
  const maxPts = 2000;
  const step = Math.max(1, Math.floor(data.length / maxPts));
  let firstPt = true;
  for (let i = 0; i < data.length; i += step) {
    const d = data[i];
    const x = pad.left + mapRange(d.t, tMin, tMax, 0, cw);
    const y = pad.top  + mapRange(d.x, 1, -1, 0, ch);
    if (firstPt) { ctx.moveTo(x, y); firstPt = false; } else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#8ab4d4';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Tempo (s)', pad.left + cw / 2, H - 8);
  ctx.save();
  ctx.translate(14, pad.top + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Amplitude (norm.)', 0, 0);
  ctx.restore();

  // Time ticks
  ctx.fillStyle = '#5a7a9a';
  ctx.font = '10px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const t = tMin + (tMax - tMin) * (i / 5);
    const x = pad.left + cw * (i / 5);
    ctx.fillText(formatTime(t), x, pad.top + ch + 18);
  }
}

/** Format frequency with SI prefix */
function formatHz(f) {
  if (f >= 1e9) return (f / 1e9).toFixed(2) + ' G';
  if (f >= 1e6) return (f / 1e6).toFixed(2) + ' M';
  if (f >= 1e3) return (f / 1e3).toFixed(1) + ' k';
  return f.toFixed(0);
}

/** Format time with SI prefix */
function formatTime(t) {
  if (t === 0) return '0';
  if (t < 1e-9) return (t * 1e12).toFixed(1) + ' p';
  if (t < 1e-6) return (t * 1e9).toFixed(1) + ' n';
  if (t < 1e-3) return (t * 1e6).toFixed(1) + ' µ';
  return (t * 1e3).toFixed(1) + ' m';
}

export { drawImpedanceCurve, drawTransientWaveform, formatHz, formatTime };
