import {
  store,
  getDesignSoilParams,
  getStructureFactor,
  renderResultCard,
  fmt,
  deg2rad,
  TABLE_B1,
  TABLE_B2,
  TABLE_B3,
} from "./shared.js";

const st = {
  category: "cat2",
  // Tendon
  S_star: 150, // kN, factored design action (working/ultimate load to be resisted)
  fy: 1670, // MPa, characteristic tensile strength of tendon
  Ap: 150, // mm^2, tendon cross-sectional area
  phiK: TABLE_B2.tendon,
  // Rock bond
  rockRow: 0,
  rockColumn: "igneousMetamorphic",
  boreDiameter: 0.1, // m
  Lf_rock: 6, // m, fixed (bond) anchor length
  phiB: TABLE_B2.bond,
  // Soil anchor - bulb type
  N1: 145, // kN/m, empirical bulb-type pull-out coefficient (Cl B4.3(a): 130-160)
  Lf_bulb: 6, // m
  // Soil anchor - under-reamed
  D_bell: 0.45, // m
  Lf_under: 4, // m
};

export function mountAnchors(root) {
  root.innerHTML = `
    <section class="module">
      <h2>4. Ground Anchors &amp; Soil Nails (Appendix B / C)</h2>
      <p class="module-intro">
        Appendix C confirms soil-nail tension/bond/rupture checks follow the same mechanics as
        ground anchors in Appendix B, so this module covers both. All checks use the AS 4678
        limit-state format R* ≥ S*.
      </p>

      <div class="card">
        <h3>Anchor category (Table B1)</h3>
        <label>Category
          <select id="an-category"></select>
        </label>
        <div class="kv" id="an-category-output"></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Tendon capacity — Eq. B4(1)</h3>
          <p class="hint"><code>S* ≤ φk·n·f<sub>y</sub>·A<sub>p</sub></code></p>
          <label>Factored design action, S* (kN)
            <input type="number" id="an-S" step="5">
          </label>
          <label>Characteristic tensile strength of tendon, f<sub>y</sub> (MPa)
            <input type="number" id="an-fy" step="10">
          </label>
          <label>Tendon cross-sectional area, A<sub>p</sub> (mm²)
            <input type="number" id="an-Ap" step="5">
          </label>
          <label>Material reduction factor — tendon, φk (Table B2)
            <input type="number" id="an-phik" step="0.01">
          </label>
          <div id="an-result-tendon"></div>
        </div>

        <div class="card">
          <h3>Rock-to-grout bond capacity (Cl. B4.2.3, Table B3)</h3>
          <label>Rock condition
            <select id="an-rockrow"></select>
          </label>
          <label>Rock type group
            <select id="an-rockcol">
              <option value="igneousMetamorphic">Igneous &amp; metamorphic (granite, gabbro, basalt, tuff, diorite, gneiss, schist, slate, quartzite)</option>
              <option value="conglomerateBreccia">Conglomerate &amp; breccia / sandstone, limestone, chalk, dolomite</option>
              <option value="argillaceous">Argillaceous sediments (marl, shale, claystone, mudstone, siltstone)</option>
            </select>
          </label>
          <label>Ultimate bond stress, τ (MPa) <span class="hint-inline">(auto-filled from Table B3 — override if test data available)</span>
            <input type="number" id="an-bondstress" step="0.1">
          </label>
          <label>Drilled hole diameter, D (m)
            <input type="number" id="an-borediam" step="0.01">
          </label>
          <label>Fixed anchor (bond) length, L<sub>f</sub> (m)
            <input type="number" id="an-lfrock" step="0.5">
          </label>
          <p class="hint">Minimum fixed anchor length 3 m recommended; increasing L<sub>f</sub> beyond 10–12 m does not usually increase capacity (Cl. B4.2.3).</p>
          <div id="an-result-rock"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>Soil anchor pull-out — bulb type, Eq. B4(2)</h3>
          <p class="hint"><code>T₁* = n·φb·N₁·L<sub>f</sub>·tan φ*</code></p>
          <label>Empirical coefficient, N₁ (kN/m) <span class="hint-inline">(typically 130–160)</span>
            <input type="number" id="an-N1" step="5">
          </label>
          <label>Fixed anchor length, L<sub>f</sub> (m)
            <input type="number" id="an-lfbulb" step="0.5">
          </label>
          <div class="kv" id="an-soil-summary"></div>
          <div id="an-result-bulb"></div>
        </div>

        <div class="card">
          <h3>Soil anchor pull-out — under-reamed, Eq. B4(3)</h3>
          <p class="hint"><code>T₁* = π·φb·D·L<sub>f</sub>·c*</code> (stiff cohesive soils, bells at 3D centres)</p>
          <label>Under-ream (bell) diameter, D (m)
            <input type="number" id="an-Dbell" step="0.05">
          </label>
          <label>Fixed anchor length, L<sub>f</sub> (m)
            <input type="number" id="an-lfunder" step="0.5">
          </label>
          <p class="hint">Uses design cohesion c* from Module 1 — set a cohesive (undrained or effective c') soil there, or this check will correctly show zero capacity for a purely granular soil.</p>
          <div id="an-result-under"></div>
        </div>
      </div>

      <div class="card">
        <h3>Working / proof / lock-off load limits (Cl. B4.4, steel tendons)</h3>
        <div class="kv" id="an-loads-output"></div>
      </div>
    </section>`;

  const el = (id) => root.querySelector(id);

  const catSel = el("#an-category");
  catSel.innerHTML = TABLE_B1.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
  catSel.value = st.category;
  catSel.addEventListener("change", (e) => { st.category = e.target.value; render(); });

  const rockSel = el("#an-rockrow");
  rockSel.innerHTML = TABLE_B3.map((r, i) => `<option value="${i}">${r.condition}</option>`).join("");
  rockSel.value = st.rockRow;

  function bindNumber(id, key) {
    const input = el(id);
    input.value = st[key];
    input.addEventListener("input", (e) => { st[key] = parseFloat(e.target.value) || 0; render(); });
  }
  bindNumber("#an-S", "S_star");
  bindNumber("#an-fy", "fy");
  bindNumber("#an-Ap", "Ap");
  bindNumber("#an-phik", "phiK");
  bindNumber("#an-bondstress", "bondStressOverride");
  bindNumber("#an-borediam", "boreDiameter");
  bindNumber("#an-lfrock", "Lf_rock");
  bindNumber("#an-N1", "N1");
  bindNumber("#an-lfbulb", "Lf_bulb");
  bindNumber("#an-Dbell", "D_bell");
  bindNumber("#an-lfunder", "Lf_under");

  rockSel.addEventListener("change", (e) => {
    st.rockRow = e.target.value;
    applyRockDefault();
    render();
  });
  el("#an-rockcol").addEventListener("change", (e) => {
    st.rockColumn = e.target.value;
    applyRockDefault();
    render();
  });

  function applyRockDefault() {
    const row = TABLE_B3[st.rockRow];
    st.bondStressOverride = row[st.rockColumn];
    el("#an-bondstress").value = st.bondStressOverride;
  }
  applyRockDefault();

  function render() {
    const shared = store.state;
    const soil = getDesignSoilParams(shared);
    const n = getStructureFactor(shared.classification);
    const cat = TABLE_B1.find((c) => c.id === st.category);

    el("#an-category-output").innerHTML = `
      <div class="kv-row"><span>Proof-load reduction factor, k</span><span>${cat.k.toFixed(2)}</span></div>
      <div class="kv-row"><span>Minimum proof load / working load, P<sub>P</sub>/P<sub>W</sub></span><span>${cat.ratio.toFixed(2)}</span></div>`;

    // Tendon
    const tendonCapacity = st.phiK * n.uls * st.fy * st.Ap / 1000; // kN
    renderResultCard(el("#an-result-tendon"), {
      title: "Tendon rupture check",
      clause: "Eq. B4(1)",
      R: tendonCapacity,
      Rlabel: "Tendon capacity",
      S: st.S_star,
      Slabel: "Factored design action",
    });

    // Rock bond
    const bondCapacity = st.bondStressOverride * 1000 * Math.PI * st.boreDiameter * st.Lf_rock * st.phiB * n.uls; // kN
    renderResultCard(el("#an-result-rock"), {
      title: "Rock-to-grout bond check",
      clause: "Cl. B4.2.3",
      R: bondCapacity,
      Rlabel: "Bond capacity",
      S: st.S_star,
      Slabel: "Factored design action",
    });

    // Soil anchor summary
    el("#an-soil-summary").innerHTML = `
      <div class="kv-row"><span>Design friction angle, φ*</span><span>${fmt(soil.phi_star, 1)}°</span></div>
      <div class="kv-row"><span>Design cohesion, c*</span><span>${fmt(soil.c_star, 1)} kPa</span></div>`;

    // Bulb type
    const bulbCapacity = n.uls * st.phiB * st.N1 * st.Lf_bulb * Math.tan(deg2rad(soil.phi_star));
    renderResultCard(el("#an-result-bulb"), {
      title: "Bulb-type pull-out check",
      clause: "Eq. B4(2)",
      R: bulbCapacity,
      Rlabel: "Pull-out resistance",
      S: st.S_star,
      Slabel: "Factored design action",
    });

    // Under-reamed
    const underCapacity = Math.PI * st.phiB * st.D_bell * st.Lf_under * soil.c_star;
    renderResultCard(el("#an-result-under"), {
      title: "Under-reamed pull-out check",
      clause: "Eq. B4(3)",
      R: underCapacity,
      Rlabel: "Pull-out resistance",
      S: st.S_star,
      Slabel: "Factored design action",
    });

    // Working/proof/lock-off (steel tendons)
    const fyCharForce = (st.fy * st.Ap) / 1000; // kN
    const PW_max = 0.6 * fyCharForce;
    const PW_max_temp = 0.65 * fyCharForce;
    const PLO_max = 0.75 * fyCharForce;
    const PP_min = st.S_star * cat.ratio;

    el("#an-loads-output").innerHTML = `
      <div class="kv-row"><span>Characteristic tendon yield force</span><span>${fmt(fyCharForce)} kN</span></div>
      <div class="kv-row"><span>Max working load P<sub>W</sub> (permanent, 60%)</span><span>${fmt(PW_max)} kN</span></div>
      <div class="kv-row"><span>Max working load P<sub>W</sub> (temporary, 65%)</span><span>${fmt(PW_max_temp)} kN</span></div>
      <div class="kv-row"><span>Max lock-off load P<sub>LO</sub> (75%)</span><span>${fmt(PLO_max)} kN</span></div>
      <div class="kv-row highlight"><span>Min proof load P<sub>P</sub> = ${cat.ratio.toFixed(2)} × S*</span><span>${fmt(PP_min)} kN</span></div>
      <div class="kv-row muted"><span colspan="2">Cl. B4.4, Table B1</span></div>`;
  }

  render();
  store.subscribe(render);
}
