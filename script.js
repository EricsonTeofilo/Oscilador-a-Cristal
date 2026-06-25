// ==================================
//  Simulador do Oscilador a Cristal
// ===================================

const canvas = document.getElementById('oscCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 650;

// -------------------- Estado da simulação --------------------
let q = 0;
let v = 0;
let t = 0;

let R = 0.5;
let L = 2.4;
let C = 0.5;
let F0 = 1.0;
let omega = 2.0;

let points = [];
const MAX_POINTS = 1500;
let dt = 0.02;

// -------------------- Escala Dinâmica Estável --------------------
let displayMaxVal = 1.0;

// -------------------- Sliders --------------------
const sliderR = document.getElementById('sliderR');
const sliderL = document.getElementById('sliderL');
const sliderC = document.getElementById('sliderC');
const sliderF0 = document.getElementById('sliderF0');
const sliderOmega = document.getElementById('sliderOmega');

const valR = document.getElementById('valR');
const valL = document.getElementById('valL');
const valC = document.getElementById('valC');
const valF0 = document.getElementById('valF0');
const valOmega = document.getElementById('valOmega');

sliderR.oninput = () => {
    R = parseFloat(sliderR.value);
    valR.textContent = R.toFixed(2);
};
sliderL.oninput = () => {
    L = parseFloat(sliderL.value);
    valL.textContent = L.toFixed(2);
};
sliderC.oninput = () => {
    C = parseFloat(sliderC.value);
    valC.textContent = C.toFixed(2);
};
sliderF0.oninput = () => {
    F0 = parseFloat(sliderF0.value);
    valF0.textContent = F0.toFixed(2);
};
sliderOmega.oninput = () => {
    omega = parseFloat(sliderOmega.value);
    valOmega.textContent = omega.toFixed(2);
};

document.getElementById('resetBtn').addEventListener('click', () => {
    q = 0;
    v = 0;
    t = 0;
    points = [];
    displayMaxVal = 1.0;
});

// -------------------- Atualiza equação --------------------
function updateEquation() {
    const eq = document.getElementById('equation');
    eq.innerHTML =
        `${L.toFixed(2)} · (d²q/dt²) + ${R.toFixed(2)} · (dq/dt) + ${(1/C).toFixed(2)} · q = ${F0.toFixed(2)} · sin(${omega.toFixed(2)} · t)`;
}

// -------------------- RK4 --------------------
function rk4Step(q, v, t, dt, R, L, C, F0, omega) {
    function Fext(t) {
        return F0 * Math.sin(omega * t);
    }
    function derivatives(q, v, t) {
        return { dq: v, dv: (Fext(t) - R * v - (1 / C) * q) / L };
    }

    const k1 = derivatives(q, v, t);
    const k2 = derivatives(q + 0.5 * dt * k1.dq, v + 0.5 * dt * k1.dv, t + 0.5 * dt);
    const k3 = derivatives(q + 0.5 * dt * k2.dq, v + 0.5 * dt * k2.dv, t + 0.5 * dt);
    const k4 = derivatives(q + dt * k3.dq, v + dt * k3.dv, t + dt);

    const newQ = q + (dt / 6) * (k1.dq + 2 * k2.dq + 2 * k3.dq + k4.dq);
    const newV = v + (dt / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv);
    return { q: newQ, v: newV };
}

function simulateStep() {
    const result = rk4Step(q, v, t, dt, R, L, C, F0, omega);
    q = result.q;
    v = result.v;
    t += dt;
    points.push(q);
    if (points.length > MAX_POINTS) points.shift();
}

// -------------------- Desenho --------------------
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const centerY = h / 2;

    // ---- Grade de fundo ---
    ctx.strokeStyle = '#e8eef5';
    ctx.lineWidth = 0.6;

    // Linhas verticais
    for (let x = 0; x <= w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    // Linhas horizontais
    for (let y = 0; y <= h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // ---- Linha central horizontal ----
    ctx.strokeStyle = '#c0d0e0';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();

    // ---- Cálculo da escala com "Peak Hold + Release" ----
    let windowMax = 1e-8;
    for (let p of points) {
        const abs = Math.abs(p);
        if (abs > windowMax) windowMax = abs;
    }
    if (windowMax < 0.001) windowMax = 0.001;

    if (windowMax > displayMaxVal) {
        displayMaxVal = windowMax;
    } else {
        displayMaxVal *= 0.999;
    }
    if (displayMaxVal < 0.001) displayMaxVal = 0.001;

    // A escala usa 80% da altura total (40% para cima, 40% para baixo)
    const scale = (0.8 * h / 2) / displayMaxVal;

    // ---- Plotar a curva ----
    ctx.strokeStyle = '#2d6ec4';
    ctx.lineWidth = 2.8;
    ctx.beginPath();

    const startIdx = Math.max(0, points.length - w);
    for (let i = startIdx; i < points.length; i++) {
        const x = i - startIdx; // ocupa a largura total
        const y = centerY - points[i] * scale;
        if (i === startIdx) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ---- Informações sobrepostas ----
    const omegaNat = Math.sqrt(1 / (L * C));

    ctx.fillStyle = '#2d6ec4';
    ctx.font = '16px Segoe UI';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`ω₀ = ${omegaNat.toFixed(3)} rad/s`, w - 20, 15);
    ctx.fillText(`ω = ${omega.toFixed(3)} rad/s`, w - 20, 40);

    ctx.fillStyle = '#1f3b68';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = '16px Segoe UI';
    ctx.fillText(`t = ${t.toFixed(2)} s`, 15, h - 15);
    ctx.fillText(`q = ${q.toFixed(4)} C`, 150, h - 15);
}

// -------------------- Loop --------------------
function animate() {
    for (let i = 0; i < 8; i++) simulateStep();
    updateEquation();
    draw();
    requestAnimationFrame(animate);
}

updateEquation();
animate();
