import {
  store,
  getDesignSoilParams,
  getStructureFactor,
  checkLimitState,
  renderResultCard,
  fmt,
  deg2rad,
} from "./shared.js";

function rankineKa(phiDeg, betaDeg) {
  const phi = deg2rad(phiDeg);
  const beta = deg2rad(betaDeg);
  const cosBeta = Math.cos(beta);
  const cosPhi = Math.cos(phi);
  const inner = cosBeta * cosBeta - cosPhi * cosPhi;
  if (inner < 0) return null;
  const sq = Math.sqrt(inner);
  const denom = cosBeta + sq;
  if (denom === 0) return null;
  return cosBeta * (cosBeta - sq) / denom;
}

const st = {
  Tu: 60, // kN/m, short-term ultimate tensile strength of reinforcement
  up: 0.95, // uncertainty factor (product/manufacture)
  rc: 0.55, // reduction factor (creep rupture)
  ue: 0.9, // uncertainty factor (creep/extrapolation)
  ri: 0.9, // reduction factor (installation damage)
  rt: 0.95, // reduction factor (thickness / corrosion)
  rs: 0.95, // reduction factor (strength loss)
  rst: 1.0, // reduction factor (temperature)
  ud: 0.9, // uncertainty factor (overall degradation)
  z: 2.0, // depth of layer below top of wall, m
  Sv: 0.6, // vertical spacing of this reinforcement layer, m
  betaDeg: 0, // backfill slope, deg
  q: 5, // live load surcharge, kPa
};

const FIELDS = [
  ["Tu", "Short-term ultimate tensile strength, T_u (kN/m)", 1],
  ["up", "Uncertainty factor — product/manufacture, φup", 0.01],
  ["rc", "Reduction factor — creep rupture, φrc", 0.01],
  ["ue", "Uncertainty factor — creep extrapolation, φue", 0.01],
  ["ri", "Reduction factor — installation damage, φri", 0.01],
  ["rt", "Reduction factor — thickness loss, φrt", 0.01],
  ["rs", "Reduction factor — strength loss, φrs", 0.01],
  ["rst", "Reduction factor — temperature, φrst", 0.01],
  ["ud", "Uncertainty factor — overall degradation, φud", 0.01],
];

export function mountReinforcement(root) {
  root.innerHTML = `
    <section class="module">
      <h2>3. Reinforced Soil (MSE) Wall — Reinforcement Design</h2>
      <p class="module-intro">
        Design tensile strength of soil reinforcement, Eq. 5.5(1):
        <code>T<sub>d</sub>* = T<sub>u</sub>·φ<sub>up</sub>·(φ<sub>rc</sub>·φ<sub>ue</sub>)·φ<sub>ri</sub>·(φ<sub>rt</sub>·φ<sub>rs</sub>·φ<sub>rst</sub>·φ<sub>ud</sub>)·n</code>,
        compared against the required tensile force per unit width for a single reinforcement
        layer, estimated from Rankine active pressure at that layer's depth (Limit Mode U3/U4,
        Cl. 3.2(c)/(d)).
      </p>

      <div class="grid-2">
        <div class="card" id="rf-factor-inputs">
          <h3>Reinforcement material factors (Table 5.3, Appendix K)</h3>
        </div>
        <div class="card">
          <h3>Reinforcement layer geometry &amp; loading</h3>
          <label>Depth of layer below top of wall, z (m)
            <input type="number" id="rf-z" step="0.1">
          </label>
          <label>Tributary vertical spacing, S<sub>v</sub> (m)
            <input type="number" id="rf-sv" step="0.05">
          </label>
          <label>Backfill slope, β (deg)
            <input type="number" id="rf-beta" step="1">
          </label>
          <label>Live load surcharge, q (kPa)
            <input type="number" id="rf-q" step="0.5">
          </label>
          <div class="kv" id="rf-soil-summary"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Design tensile strength</h3>
          <div class="kv" id="rf-td-output"></div>
        </div>
        <div id="rf-result"></div>
      </div>
    </section>`;

  const el = (id) => root.querySelector(id);

  const factorBox = el("#rf-factor-inputs");
  FIELDS.forEach(([key, label, step]) => {
    const row = document.createElement("label");
    row.innerHTML = `${label} <input type="number" id="rf-${key}" step="${step}" value="${st[key]}">`;
    factorBox.appendChild(row);
    row.querySelector("input").addEventListener("input", (e) => {
      st[key] = parseFloat(e.target.value) || 0;
      render();
    });
  });

  const geomInputs = {
    z: el("#rf-z"),
    sv: el("#rf-sv"),
    beta: el("#rf-beta"),
    q: el("#rf-q"),
  };
  geomInputs.z.value = st.z;
  geomInputs.sv.value = st.Sv;
  geomInputs.beta.value = st.betaDeg;
  geomInputs.q.value = st.q;
  geomInputs.z.addEventListener("input", (e) => { st.z = parseFloat(e.target.value) || 0; render(); });
  geomInputs.sv.addEventListener("input", (e) => { st.Sv = parseFloat(e.target.value) || 0; render(); });
  geomInputs.beta.addEventListener("input", (e) => { st.betaDeg = parseFloat(e.target.value) || 0; render(); });
  geomInputs.q.addEventListener("input", (e) => { st.q = parseFloat(e.target.value) || 0; render(); });

  function render() {
    const shared = store.state;
    const soil = getDesignSoilParams(shared);
    const n = getStructureFactor(shared.classification);

    el("#rf-soil-summary").innerHTML = `
      <div class="kv-row"><span>Design friction angle, φ*</span><span>${fmt(soil.phi_star, 1)}°</span></div>
      <div class="kv-row"><span>Backfill unit weight, γ</span><span>${fmt(shared.gamma, 1)} kN/m³</span></div>
      <div class="kv-row"><span>Structure factor, n (ULS)</span><span>${n.uls.toFixed(2)}</span></div>`;

    const Td = st.Tu * st.up * (st.rc * st.ue) * st.ri * (st.rt * st.rs * st.rst * st.ud) * n.uls;

    el("#rf-td-output").innerHTML = `
      <div class="kv-row highlight"><span>Design tensile strength, T<sub>d</sub>*</span><span>${fmt(Td)} kN/m</span></div>
      <div class="kv-row muted"><span colspan="2">Eq. 5.5(1)</span></div>`;

    const Ka = rankineKa(soil.phi_star, st.betaDeg);
    const resultBox = el("#rf-result");
    if (Ka === null) {
      resultBox.innerHTML = `<p class="warn">No real Ka solution — backfill slope β exceeds φ*.</p>`;
      return;
    }
    const S = st.Sv * (1.25 * Ka * shared.gamma * st.z + 1.5 * Ka * st.q);

    renderResultCard(resultBox, {
      title: "Reinforcement tensile capacity (Limit Mode U3/U4)",
      clause: "Eq. 5.5(1), Cl. 3.2(c)/(d)",
      R: Td,
      Rlabel: "Design tensile strength",
      S: S,
      Slabel: "Required tensile force",
    });
  }

  render();
  store.subscribe(render);
}
