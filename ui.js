/**
 * ui.js
 * Wires HTML controls → CrystalModel → chart renders + metrics display.
 */

import { CrystalModel, DEFAULT_PARAMS } from './crystal-model.js';
import { drawImpedanceCurve, drawTransientWaveform, formatHz, formatTime } from './charts.js';

// ─── State ────────────────────────────────────────────────────────────────────

let model = new CrystalModel(DEFAULT_PARAMS);
let transientData = [];
let sweepData     = [];

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const els = {};
const ids = [
  'lm', 'cm', 'rm', 'c0', 'cl',
  'val-lm', 'val-cm', 'val-rm', 'val-c0', 'val-cl',
  'metric-fs', 'metric-fp', 'metric-q', 'metric-fl', 'metric-delta',
  'canvas-impedance', 'canvas-transient',
  'region-label', 'probe-freq', 'probe-result',
  'preset-select',
];

function initDom() {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) els[id] = el;
  });
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = {
  '10MHz-AT': { Lm: 10e-3,   Cm: 25.33e-15, Rm: 5,   C0: 3.5e-12 },
  '4MHz-AT':  { Lm: 62.5e-3, Cm: 25.5e-15,  Rm: 15,  C0: 5.0e-12 },
  '32kHz-TF': { Lm: 3.5,     Cm: 7.0e-15,   Rm: 40e3, C0: 1.3e-12 },
  '20MHz-SC': { Lm: 3.2e-3,  Cm: 20e-15,    Rm: 8,   C0: 4.0e-12 },
  'Custom':   null,
};

// ─── Slider → model ───────────────────────────────────────────────────────────

const SLIDER_CONFIG = {
  lm: { param: 'Lm', scale: v => v * 1e-3,          fmt: v => (v * 1e3).toFixed(2) + ' mH' },
  cm: { param: 'Cm', scale: v => v * 1e-15,          fmt: v => (v * 1e15).toFixed(2) + ' fF' },
  rm: { param: 'Rm', scale: v => v,                  fmt: v => v.toFixed(1) + ' Ω'  },
  c0: { param: 'C0', scale: v => v * 1e-12,          fmt: v => (v * 1e12).toFixed(2) + ' pF' },
  cl: { param: '_CL', scale: v => v * 1e-12,         fmt: v => (v * 1e12).toFixed(1) + ' pF' },
};

function readSliders() {
  const raw = {};
  for (const [key, cfg] of Object.entries(SLIDER_CONFIG)) {
    const el = els[key];
    if (!el) continue;
    const v = parseFloat(el.value);
    raw[key] = v;
    const valEl = els[`val-${key}`];
    if (valEl) valEl.textContent = cfg.fmt(cfg.scale(v));
  }
  return raw;
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  // Lm in mH, Cm in fF, Rm in Ω, C0 in pF
  if (els['lm']) els['lm'].value = p.Lm * 1e3;
  if (els['cm']) els['cm'].value = p.Cm * 1e15;
  if (els['rm']) els['rm'].value = p.Rm;
  if (els['c0']) els['c0'].value = p.C0 * 1e12;
}

// ─── Main update loop ─────────────────────────────────────────────────────────

function update() {
  const raw = readSliders();
  const CL  = SLIDER_CONFIG.cl.scale(raw.cl || 10);

  model = new CrystalModel({
    Lm: SLIDER_CONFIG.lm.scale(raw.lm),
    Cm: SLIDER_CONFIG.cm.scale(raw.cm),
    Rm: SLIDER_CONFIG.rm.scale(raw.rm),
    C0: SLIDER_CONFIG.c0.scale(raw.c0),
  });

  // Metrics
  if (els['metric-fs'])    els['metric-fs'].textContent    = formatHz(model.fs) + 'Hz';
  if (els['metric-fp'])    els['metric-fp'].textContent    = formatHz(model.fp) + 'Hz';
  if (els['metric-q'])     els['metric-q'].textContent     = model.Q.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  if (els['metric-fl'])    els['metric-fl'].textContent    = formatHz(model.fWithLoad(CL)) + 'Hz';
  if (els['metric-delta']) els['metric-delta'].textContent = (model.deltaOmegaNorm * 1e6).toFixed(1) + ' ppm';

  // Region description
  if (els['region-label']) {
    const ratio = model.Cm / model.C0;
    els['region-label'].textContent =
      `Janela indutiva: Δf ≈ ${((model.fp - model.fs) / model.fs * 1e6).toFixed(0)} ppm — ` +
      `Cm/C0 = ${(ratio * 1e6).toFixed(1)} ppm`;
  }

  // Charts
  sweepData = model.sweepImpedance(600);
  drawImpedanceCurve(els['canvas-impedance'], sweepData, model.fs, model.fp);

  const duration   = Math.min(50 / model.fs, 200e-6);
  const sampleRate = Math.min(model.fs * 50, 500e6);
  transientData = model.simulateTransient(duration, sampleRate);
  const alpha = model.Rm / (2 * model.Lm);
  drawTransientWaveform(els['canvas-transient'], transientData, { alpha });
}

// ─── Probe tool ───────────────────────────────────────────────────────────────

function probeFrequency() {
  const fInput = els['probe-freq'];
  const result = els['probe-result'];
  if (!fInput || !result) return;

  const fHz = parseFloat(fInput.value) * 1e6;
  if (!isFinite(fHz) || fHz <= 0) { result.textContent = 'Frequência inválida'; return; }

  const z = model.impedance(fHz);
  const region =
    fHz < model.fs ? 'Capacitivo (abaixo de fs)' :
    fHz > model.fp ? 'Capacitivo (acima de fp)' :
    'Indutivo (entre fs e fp)';

  result.innerHTML =
    `|Z| = ${z.mag >= 1e6 ? (z.mag/1e6).toFixed(2)+' MΩ' : z.mag >= 1e3 ? (z.mag/1e3).toFixed(2)+' kΩ' : z.mag.toFixed(1)+' Ω'} &nbsp;|&nbsp; ` +
    `φ = ${z.phase.toFixed(1)}° &nbsp;|&nbsp; ${region}`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  initDom();

  // Bind sliders
  for (const key of Object.keys(SLIDER_CONFIG)) {
    const el = els[key];
    if (el) el.addEventListener('input', () => { markCustom(); update(); });
  }

  // Preset selector
  const presetEl = els['preset-select'];
  if (presetEl) {
    presetEl.addEventListener('change', e => {
      if (e.target.value !== 'Custom') {
        applyPreset(e.target.value);
        update();
      }
    });
  }

  // Probe button
  const btn = document.getElementById('btn-probe');
  if (btn) btn.addEventListener('click', probeFrequency);
  const probeInput = els['probe-freq'];
  if (probeInput) probeInput.addEventListener('keydown', e => { if (e.key === 'Enter') probeFrequency(); });

  // Resize
  window.addEventListener('resize', update);

  update();
}

function markCustom() {
  const el = els['preset-select'];
  if (el) el.value = 'Custom';
}

export { init };
