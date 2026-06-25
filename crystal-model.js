/**
 * crystal-model.js
 * Butterworth-Van Dyke (BVD) equivalent circuit model.
 * All frequencies in Hz, impedances in Ohms, capacitances in Farads, inductances in Henries.
 */

class CrystalModel {
  /**
   * @param {object} params
   * @param {number} params.Lm  - Motional inductance (H)   — represents mechanical mass/inertia
   * @param {number} params.Cm  - Motional capacitance (F)  — represents elasticity/compliance
   * @param {number} params.Rm  - Motional resistance (Ω)   — represents internal friction/damping
   * @param {number} params.C0  - Static (electrode) capacitance (F)
   */
  constructor({ Lm, Cm, Rm, C0 }) {
    this.Lm = Lm;
    this.Cm = Cm;
    this.Rm = Rm;
    this.C0 = C0;
  }

  /** Series resonance ωs = 1/√(Lm·Cm) */
  get ws() {
    return 1 / Math.sqrt(this.Lm * this.Cm);
  }

  /** Series resonance frequency fs (Hz) */
  get fs() {
    return this.ws / (2 * Math.PI);
  }

  /**
   * Parallel / anti-resonance ωp ≈ ωs · √(1 + Cm/C0)
   * Exact: ωp = √((Cm + C0)/(Lm·Cm·C0))
   */
  get wp() {
    return Math.sqrt((this.Cm + this.C0) / (this.Lm * this.Cm * this.C0));
  }

  /** Parallel resonance frequency fp (Hz) */
  get fp() {
    return this.wp / (2 * Math.PI);
  }

  /** Quality factor Q = ωs·Lm / Rm  =  1/(ωs·Cm·Rm) */
  get Q() {
    return (this.ws * this.Lm) / this.Rm;
  }

  /** Fractional frequency separation Δω/ωs ≈ Cm/(2·C0) */
  get deltaOmegaNorm() {
    return this.Cm / (2 * this.C0);
  }

  /**
   * Oscillation frequency with external load capacitance CL (Pierce oscillator).
   * First-order Taylor expansion: ωL ≈ ωs · (1 + Cm / (2·(C0 + CL)))
   * @param {number} CL  - Load capacitance (F)
   * @returns {number} fL (Hz)
   */
  fWithLoad(CL) {
    const wL = this.ws * (1 + this.Cm / (2 * (this.C0 + CL)));
    return wL / (2 * Math.PI);
  }

  /**
   * Complex impedance Z(ω) of the full BVD circuit.
   * Z_motional = Rm + j·ω·Lm + 1/(j·ω·Cm)
   * Z_static   = 1/(j·ω·C0)
   * Z_total    = Z_motional ∥ Z_static
   *
   * Returns { re, im, mag, phase }
   * @param {number} freq - Frequency in Hz
   */
  impedance(freq) {
    const w = 2 * Math.PI * freq;

    // Motional branch: Z_m = Rm + j(wLm - 1/(wCm))
    const zmRe = this.Rm;
    const zmIm = w * this.Lm - 1 / (w * this.Cm);

    // Static branch: Z_0 = -j/(wC0)
    const z0Im = -1 / (w * this.C0);

    // Parallel combination: Z = (Z_m * Z_0) / (Z_m + Z_0)
    // Numerator = Z_m · Z_0  (Z_0 is purely imaginary)
    const numRe = zmRe * 0 - zmIm * z0Im; // Re(Z_m · Z_0)
    const numIm = zmRe * z0Im + zmIm * 0;  // Im(Z_m · Z_0)

    // Denominator = Z_m + Z_0
    const denRe = zmRe;
    const denIm = zmIm + z0Im;
    const denMag2 = denRe * denRe + denIm * denIm;

    const re = (numRe * denRe + numIm * denIm) / denMag2;
    const im = (numIm * denRe - numRe * denIm) / denMag2;
    const mag = Math.sqrt(re * re + im * im);
    const phase = Math.atan2(im, re) * (180 / Math.PI);

    return { re, im, mag, phase };
  }

  /**
   * Generate impedance curve data across a frequency sweep.
   * @param {number} nPoints - Number of sample points
   * @returns {Array<{f, magDb, phase}>}
   */
  sweepImpedance(nPoints = 600) {
    const fCenter = (this.fs + this.fp) / 2;
    const span = Math.max((this.fp - this.fs) * 8, fCenter * 0.001);
    const fStart = fCenter - span / 2;
    const fStop  = fCenter + span / 2;

    const data = [];
    for (let i = 0; i < nPoints; i++) {
      const f = fStart + (fStop - fStart) * (i / (nPoints - 1));
      const z = this.impedance(f);
      const magDb = z.mag > 0 ? 20 * Math.log10(z.mag) : -200;
      data.push({ f, magDb, phase: z.phase, mag: z.mag });
    }
    return data;
  }

  /**
   * Simulate damped oscillation of the crystal (mechanical analogy).
   * x''(t) + (Rm/Lm)·x'(t) + (1/(Lm·Cm))·x(t) = 0
   * Solution: x(t) = A·e^(-αt)·cos(ωd·t)
   * @param {number} duration - seconds
   * @param {number} sampleRate - samples per second
   */
  simulateTransient(duration = 10e-6, sampleRate = 1e9) {
    const alpha = this.Rm / (2 * this.Lm);            // decay constant
    const wd    = Math.sqrt(Math.max(this.ws * this.ws - alpha * alpha, 0)); // damped freq
    const dt    = 1 / sampleRate;
    const n     = Math.floor(duration * sampleRate);
    const out   = [];

    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const x = Math.exp(-alpha * t) * Math.cos(wd * t);
      out.push({ t, x });
    }
    return out;
  }
}

// Default 10 MHz AT-cut quartz crystal (typical datasheet values)
const DEFAULT_PARAMS = {
  Lm: 10e-3,       // 10 mH
  Cm: 25.33e-15,   // 25.33 fF  → fs ≈ 10 MHz
  Rm: 5,           // 5 Ω
  C0: 3.5e-12,     // 3.5 pF   (C0 >> Cm  ✓)
};

export { CrystalModel, DEFAULT_PARAMS };
