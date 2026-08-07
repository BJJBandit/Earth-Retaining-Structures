import {
  store,
  getDesignSoilParams,
  getStructureFactor,
  checkLimitState,
  renderResultCard,
  fmt,
  deg2rad,
} from "./shared.js";

const GAMMA_WATER = 9.81; // kN/m3

// Classical Rankine active earth-pressure coefficient, sloping backfill.
// Ka = cosB * (cosB - sqrt(cos2B - cos2phi)) / (cosB + sqrt(cos2B - cos2phi))
function rankineKa(phiDeg, betaDeg) {
  const phi = deg2rad(phiDeg);
  const beta = deg2rad(betaDeg);
  const cosBeta = Math.cos(beta);
  const cosPhi = Math.cos(phi);
  const inner = cosBeta * cosBeta - cosPhi * cosPhi;
  if (inner < 0) return null; // backfill slope exceeds friction angle - no real solution
  const sq = Math.sqrt(inner);
  const denom = cosBeta + sq;
  if (denom === 0) return null;
  return cosBeta * (cosBeta - sq) / denom;
}

// Classical Coulomb active earth-pressure coefficient.
// alpha = wall back-face batter from vertical, delta = wall/soil interface friction, beta = backfill slope.
function coulombKa(phiDeg, betaDeg, alphaDeg, deltaDeg) {
  const phi = deg2rad(phiDeg);
  const beta = deg2rad(betaDeg);
  const alpha = deg2rad(alphaDeg);
  const delta = deg2rad(deltaDeg);
  const num = Math.pow(Math.cos(phi - alpha), 2);
  const cosAlpha2 = Math.pow(Math.cos(alpha), 2);
  const cosDA = Math.cos(delta + alpha);
  const sqrtArg =
    (Math.sin(phi + delta) * Math.sin(phi - beta)) / (cosDA * Math.cos(alpha - beta));
  if (sqrtArg < -1) return null;
  const bracket = 1 + Math.sqrt(Math.max(sqrtArg, 0));
  const denom = cosAlpha2 * cosDA * bracket * bracket;
  if (denom === 0) return null;
  return num / denom;
}

function rankineKp(phiDeg) {
  const phi = deg2rad(phiDeg);
  return (1 + Math.sin(phi)) / (1 - Math.sin(phi));
}

// Meyerhof/Vesic bearing capacity factors (strip footing, no shape/depth factors).
function bearingFactors(phiDeg) {
  const phi = deg2rad(phiDeg);
  const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
  const Nc = phiDeg > 0.01 ? (Nq - 1) / Math.tan(phi) : 5.14;
  const Ngamma = 2 * (Nq + 1) * Math.tan(phi);
  return { Nq, Nc, Ngamma };
}

const st = {
  method: "rankine",
  H: 3.0,
  baseThickness: 0.4,
  toeLength: 0.6,
  stemThickness: 0.3,
  B: 2.2,
  betaDeg: 0,
  q: 5,
  gammaConcrete: 24,
  waterHeight: 0,
  deltaBaseDeg: 21,
  cBaseAdhesion: 0,
  includePassive: false,
  embedmentDepth: 0,
  wallFrictionDeltaDeg: 21,
  wallBatterDeg: 0,
};

export function mountStability(root) {
  root.innerHTML = `
    <section class="module">
      <h2>2. Gravity / Cantilever Wall Stability</h2>
      <p class="module-intro">
        Rankine active earth pressure is taken on a vertical plane at the back of the heel
        (valid for any stem batter/step, per the vertical-plane method). Checks follow the
        AS 4678 limit-state format R* ≥ S* (Cl. 3.1.2) for Limit Modes U1 (sliding),
        U2 (rotation/overturning) and U6 (bearing). Load factors: 1.25 on dead/soil-weight
        actions, 1.5 on live-load surcharge, 1.0 on water pressure (Cl. 4.1).
      </p>

      <div class="grid-2">
        <div class="card">
          <h3>Earth pressure method</h3>
          <label>Method
            <select id="st-method">
              <option value="rankine">Rankine (vertical plane at heel)</option>
              <option value="coulomb">Coulomb (wall friction &amp; batter)</option>
            </select>
          </label>
          <label>Backfill slope, β (deg from horizontal)
            <input type="number" id="st-beta" step="1">
          </label>
          <div id="st-coulomb-inputs"></div>
          <label>Live load surcharge, q (kPa)
            <input type="number" id="st-q" step="0.5">
          </label>
          <label>Water table height above base, on retained side (m)
            <input type="number" id="st-water" step="0.1">
          </label>
        </div>

        <div class="card">
          <h3>Wall geometry</h3>
          <label>Retained height, H — footing to backfill surface at heel (m)
            <input type="number" id="st-H" step="0.1">
          </label>
          <label>Base thickness (m)
            <input type="number" id="st-baseT" step="0.05">
          </label>
          <label>Toe length (m)
            <input type="number" id="st-toe" step="0.05">
          </label>
          <label>Stem thickness (m)
            <input type="number" id="st-stemT" step="0.05">
          </label>
          <label>Total base width, B (m)
            <input type="number" id="st-B" step="0.05">
          </label>
          <label>Concrete unit weight (kN/m³)
            <input type="number" id="st-gammac" step="0.5">
          </label>
          <p class="hint" id="st-geom-hint"></p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Sliding &amp; bearing inputs</h3>
          <label>Base friction angle, δ<sub>b</sub> (deg)
            <input type="number" id="st-deltab" step="1">
          </label>
          <p class="hint">Typically 0.5–0.67 × φ* for concrete cast on soil.</p>
          <label>Base adhesion, c<sub>b</sub> (kPa)
            <input type="number" id="st-cb" step="1">
          </label>
          <label><input type="checkbox" id="st-passive"> Include passive resistance at toe</label>
          <label>Embedment depth in front of toe, D (m)
            <input type="number" id="st-D" step="0.1">
          </label>
        </div>
        <div class="card">
          <h3>Design soil parameters (from Module 1)</h3>
          <div class="kv" id="st-soil-summary"></div>
          <div class="kv" id="st-pressure-summary"></div>
        </div>
      </div>

      <div class="grid-3">
        <div id="st-result-sliding"></div>
        <div id="st-result-overturning"></div>
        <div id="st-result-bearing"></div>
      </div>
      <p class="hint" id="st-bearing-note"></p>
    </section>`;

  const el = (id) => root.querySelector(id);
  const inputs = {
    method: el("#st-method"),
    beta: el("#st-beta"),
    q: el("#st-q"),
    water: el("#st-water"),
    H: el("#st-H"),
    baseT: el("#st-baseT"),
    toe: el("#st-toe"),
    stemT: el("#st-stemT"),
    B: el("#st-B"),
    gammac: el("#st-gammac"),
    deltab: el("#st-deltab"),
    cb: el("#st-cb"),
    passive: el("#st-passive"),
    D: el("#st-D"),
  };

  function renderCoulombInputs() {
    const box = el("#st-coulomb-inputs");
    if (st.method !== "coulomb") {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <label>Wall friction angle, δ (deg)
        <input type="number" id="st-walldelta" step="1" value="${st.wallFrictionDeltaDeg}">
      </label>
      <label>Wall back-face batter from vertical, α (deg)
        <input type="number" id="st-wallalpha" step="1" value="${st.wallBatterDeg}">
      </label>`;
    box.querySelector("#st-walldelta").addEventListener("input", (e) => {
      st.wallFrictionDeltaDeg = parseFloat(e.target.value) || 0;
      render();
    });
    box.querySelector("#st-wallalpha").addEventListener("input", (e) => {
      st.wallBatterDeg = parseFloat(e.target.value) || 0;
      render();
    });
  }

  function syncInputsFromState() {
    inputs.method.value = st.method;
    inputs.beta.value = st.betaDeg;
    inputs.q.value = st.q;
    inputs.water.value = st.waterHeight;
    inputs.H.value = st.H;
    inputs.baseT.value = st.baseThickness;
    inputs.toe.value = st.toeLength;
    inputs.stemT.value = st.stemThickness;
    inputs.B.value = st.B;
    inputs.gammac.value = st.gammaConcrete;
    inputs.deltab.value = st.deltaBaseDeg;
    inputs.cb.value = st.cBaseAdhesion;
    inputs.passive.checked = st.includePassive;
    inputs.D.value = st.embedmentDepth;
    renderCoulombInputs();
  }

  Object.entries({
    method: "method",
    beta: "betaDeg",
    q: "q",
    water: "waterHeight",
    H: "H",
    baseT: "baseThickness",
    toe: "toeLength",
    stemT: "stemThickness",
    B: "B",
    gammac: "gammaConcrete",
    deltab: "deltaBaseDeg",
    cb: "cBaseAdhesion",
    D: "embedmentDepth",
  }).forEach(([inputKey, stateKey]) => {
    inputs[inputKey].addEventListener("input", (e) => {
      st[stateKey] = inputKey === "method" ? e.target.value : parseFloat(e.target.value) || 0;
      if (inputKey === "method") renderCoulombInputs();
      render();
    });
  });
  inputs.passive.addEventListener("change", (e) => {
    st.includePassive = e.target.checked;
    render();
  });

  function render() {
    const shared = store.state;
    const soil = getDesignSoilParams(shared);
    const n = getStructureFactor(shared.classification);
    const gammaBackfill = shared.gamma;

    let Ka =
      st.method === "coulomb"
        ? coulombKa(soil.phi_star, st.betaDeg, st.wallBatterDeg, st.wallFrictionDeltaDeg)
        : rankineKa(soil.phi_star, st.betaDeg);

    const soilSummary = el("#st-soil-summary");
    soilSummary.innerHTML = `
      <div class="kv-row"><span>Design friction angle, φ*</span><span>${fmt(soil.phi_star, 1)}°</span></div>
      <div class="kv-row"><span>Design cohesion, c*</span><span>${fmt(soil.c_star, 1)} kPa</span></div>
      <div class="kv-row"><span>Backfill unit weight, γ</span><span>${fmt(gammaBackfill, 1)} kN/m³</span></div>
      <div class="kv-row"><span>Structure factor, n (ULS)</span><span>${n.uls.toFixed(2)}</span></div>`;

    const pressureSummary = el("#st-pressure-summary");
    const bearingNote = el("#st-bearing-note");

    if (Ka === null) {
      pressureSummary.innerHTML = `<p class="warn">No real Ka solution — backfill slope β is too steep relative to φ* (or wall-friction inputs are inconsistent). Reduce β or check inputs.</p>`;
      ["#st-result-sliding", "#st-result-overturning", "#st-result-bearing"].forEach(
        (sel) => (el(sel).innerHTML = "")
      );
      bearingNote.textContent = "";
      return;
    }

    const H = st.H;
    const beta = st.betaDeg;
    const betaRad = deg2rad(beta);

    const Pa = 0.5 * Ka * gammaBackfill * H * H;
    const Pa_h = Pa * Math.cos(betaRad);
    const Pa_v = Pa * Math.sin(betaRad);
    const Pq_h = Ka * st.q * H;
    const Pw = st.waterHeight > 0 ? 0.5 * GAMMA_WATER * st.waterHeight * st.waterHeight : 0;

    const heelLength = Math.max(st.B - st.toeLength - st.stemThickness, 0);
    const stemHeight = Math.max(H - st.baseThickness, 0);

    const W1 = st.B * st.baseThickness * st.gammaConcrete;
    const lever1 = st.B / 2;
    const W2 = stemHeight * st.stemThickness * st.gammaConcrete;
    const lever2 = st.toeLength + st.stemThickness / 2;
    const W3 = heelLength * stemHeight * gammaBackfill;
    const lever3 = st.toeLength + st.stemThickness + heelLength / 2;
    const Wq = st.q * heelLength;

    pressureSummary.innerHTML = `
      <div class="kv-row"><span>Active pressure coefficient, Ka</span><span>${fmt(Ka, 3)}</span></div>
      <div class="kv-row"><span>Active thrust, Pa (soil)</span><span>${fmt(Pa)} kN/m</span></div>
      <div class="kv-row"><span>Surcharge thrust, Pq</span><span>${fmt(Pq_h)} kN/m</span></div>
      <div class="kv-row"><span>Water thrust, Pw</span><span>${fmt(Pw)} kN/m</span></div>
      <div class="kv-row muted"><span colspan="2">Heel length ${fmt(heelLength, 2)} m, stem height ${fmt(stemHeight, 2)} m</span></div>`;

    // ---- Factored actions (S*) ----
    const S_h = 1.25 * Pa_h + 1.5 * Pq_h + 1.0 * Pw;
    const M_o = 1.25 * (Pa_h * (H / 3)) + 1.5 * (Pq_h * (H / 2)) + 1.0 * (Pw * (st.waterHeight / 3));

    // ---- Factored resistance/vertical loads (R*, N*) ----
    const N = 1.25 * (W1 + W2 + W3 + Pa_v) + 1.5 * Wq;
    const M_r = 1.25 * (W1 * lever1 + W2 * lever2 + W3 * lever3 + Pa_v * st.B) + 1.5 * (Wq * lever3);

    // ---- Sliding ----
    const deltaBaseRad = deg2rad(st.deltaBaseDeg);
    const Kp = rankineKp(soil.phi_star);
    const Pp = st.includePassive ? 0.5 * Kp * gammaBackfill * st.embedmentDepth * st.embedmentDepth : 0;
    const R_h = N * Math.tan(deltaBaseRad) + st.cBaseAdhesion * st.B + Pp;

    renderResultCard(el("#st-result-sliding"), {
      title: "Sliding (Limit Mode U1)",
      clause: "Cl. 3.2(a)",
      R: R_h,
      Rlabel: "Sliding resistance",
      S: S_h,
      Slabel: "Driving force",
    });

    // ---- Overturning ----
    renderResultCard(el("#st-result-overturning"), {
      title: "Overturning (Limit Mode U2)",
      clause: "Cl. 3.2(b)",
      R: M_r,
      Rlabel: "Resisting moment",
      S: M_o,
      Slabel: "Overturning moment",
    });

    // ---- Bearing ----
    const xbar = N > 0 ? (M_r - M_o) / N : 0;
    const e = st.B / 2 - xbar;
    const Beff = st.B - 2 * Math.abs(e);

    if (Beff <= 0) {
      el("#st-result-bearing").innerHTML = `<div class="result-card fail"><div class="result-head"><span class="result-title">Bearing (Limit Mode U6)</span><span class="result-clause">Cl. 3.2(f)</span></div><p class="warn">Resultant falls outside the base (B_eff ≤ 0) — increase base width or reduce overturning actions.</p></div>`;
      bearingNote.textContent = "";
    } else {
      const { Nq, Nc, Ngamma } = bearingFactors(soil.phi_star);
      const q0 = gammaBackfill * st.embedmentDepth;
      const qult = soil.c_star * Nc + q0 * Nq + 0.5 * gammaBackfill * Beff * Ngamma;
      const R_bearing = qult * Beff;

      renderResultCard(el("#st-result-bearing"), {
        title: "Bearing (Limit Mode U6)",
        clause: "Cl. 3.2(f)",
        R: R_bearing,
        Rlabel: "Ultimate bearing resistance",
        S: N,
        Slabel: "Applied vertical load",
      });

      const middleThird = Math.abs(e) <= st.B / 6;
      bearingNote.innerHTML = `Eccentricity e = ${fmt(e, 3)} m (${middleThird ? "within" : "outside"} middle third, B/6 = ${fmt(
        st.B / 6,
        3
      )} m — classical geotechnical practice, not an explicit AS 4678 clause). Effective width B_eff = ${fmt(
        Beff,
        2
      )} m. Bearing capacity factors (Meyerhof/Vesic, strip footing): Nq=${fmt(Nq, 2)}, Nc=${fmt(Nc, 2)}, Nγ=${fmt(
        Ngamma,
        2
      )}.`;
    }
  }

  syncInputsFromState();
  store.subscribe(render);
  render();
}
