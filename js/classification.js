import {
  store,
  TABLE_5_1_A,
  TABLE_5_1_B,
  TABLE_5_2_N,
  getDesignFactors,
  getDesignSoilParams,
  getStructureFactor,
  fmt,
} from "./shared.js";

export function mountClassification(root) {
  root.innerHTML = `
    <section class="module">
      <h2>1. Structure Classification &amp; Design Soil Parameters</h2>
      <p class="module-intro">
        Sets the structure classification factor (Table 5.2) and the soil material uncertainty
        factors (Table 5.1(A)/(B)) used to derive design soil strength (Eq. 5.2(1), 5.2(2)).
        These outputs feed the Stability, Reinforcement and Anchors &amp; Nails modules.
      </p>

      <div class="grid-2">
        <div class="card">
          <h3>Structure classification (Table 1.1 / Appendix A)</h3>
          <label>Classification
            <select id="cls-classification">
              <option value="A">A — low consequence of failure</option>
              <option value="B" selected>B — medium consequence of failure</option>
              <option value="C">C — high consequence of failure</option>
            </select>
          </label>
          <p class="hint" id="cls-classification-hint"></p>
          <div class="kv" id="cls-n-output"></div>
        </div>

        <div class="card">
          <h3>Soil strength basis</h3>
          <label>Analysis basis
            <select id="cls-basis">
              <option value="peak" selected>Effective / peak strength (c', φ') — Table 5.1(A)</option>
              <option value="undrained">Undrained strength (cu, φu) — Table 5.1(B)</option>
            </select>
          </label>
          <label>Fill condition
            <select id="cls-filltype"></select>
          </label>
          <p class="hint">Partial factors apply to characteristic values only; in no case should factors exceed those for Class I controlled fill.</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card" id="cls-input-card"></div>
        <div class="card">
          <h3>Design (factored) soil parameters</h3>
          <div class="kv" id="cls-design-output"></div>
        </div>
      </div>
    </section>`;

  const classificationSel = root.querySelector("#cls-classification");
  const basisSel = root.querySelector("#cls-basis");
  const fillSel = root.querySelector("#cls-filltype");
  const inputCard = root.querySelector("#cls-input-card");
  const nOutput = root.querySelector("#cls-n-output");
  const clsHint = root.querySelector("#cls-classification-hint");
  const designOutput = root.querySelector("#cls-design-output");

  function populateFillOptions() {
    const table = basisSel.value === "undrained" ? TABLE_5_1_B : TABLE_5_1_A;
    fillSel.innerHTML = Object.entries(table)
      .map(([key, v]) => `<option value="${key}">${v.label}</option>`)
      .join("");
    fillSel.value = store.state.fillType;
  }

  function renderInputCard() {
    if (basisSel.value === "undrained") {
      inputCard.innerHTML = `
        <h3>Characteristic soil strength (undrained)</h3>
        <label>Characteristic undrained shear strength, c<sub>u</sub> (kPa)
          <input type="number" id="cls-cu" step="1" value="${store.state.cu_char}">
        </label>
        <label>Backfill unit weight, γ (kN/m³)
          <input type="number" id="cls-gamma" step="0.5" value="${store.state.gamma}">
        </label>`;
      inputCard.querySelector("#cls-cu").addEventListener("input", (e) =>
        store.update({ cu_char: parseFloat(e.target.value) || 0 })
      );
    } else {
      inputCard.innerHTML = `
        <h3>Characteristic soil strength (effective / peak)</h3>
        <label>Characteristic friction angle, φ' (degrees)
          <input type="number" id="cls-phi" step="0.5" value="${store.state.phi_char}">
        </label>
        <label>Characteristic cohesion, c' (kPa)
          <input type="number" id="cls-c" step="0.5" value="${store.state.c_char}">
        </label>
        <label>Backfill unit weight, γ (kN/m³)
          <input type="number" id="cls-gamma" step="0.5" value="${store.state.gamma}">
        </label>`;
      inputCard.querySelector("#cls-phi").addEventListener("input", (e) =>
        store.update({ phi_char: parseFloat(e.target.value) || 0 })
      );
      inputCard.querySelector("#cls-c").addEventListener("input", (e) =>
        store.update({ c_char: parseFloat(e.target.value) || 0 })
      );
    }
    inputCard.querySelector("#cls-gamma").addEventListener("input", (e) =>
      store.update({ gamma: parseFloat(e.target.value) || 0 })
    );
  }

  function render() {
    const n = getStructureFactor(store.state.classification);
    const f = getDesignFactors(store.state);
    const design = getDesignSoilParams(store.state);

    const hints = {
      A: "Low consequence of failure: minimal damage/loss of access. Deemed Classification B where wall height H &gt; 1.5 m (Cl. 1.2.2).",
      B: "Medium consequence of failure: any structure not covered by Classification A or C.",
      C: "High consequence of failure: significant damage or risk to life.",
    };
    clsHint.innerHTML = hints[store.state.classification];

    nOutput.innerHTML = `
      <div class="kv-row"><span>Structure factor n (ULS)</span><span>${n.uls.toFixed(2)}</span></div>
      <div class="kv-row"><span>Structure factor n (SLS)</span><span>${n.sls.toFixed(2)}</span></div>
      <div class="kv-row muted"><span colspan="2">Table 5.2</span></div>`;

    designOutput.innerHTML = `
      <div class="kv-row"><span>Basis</span><span>${design.basisLabel}</span></div>
      <div class="kv-row"><span>φu (strength uncertainty)</span><span>${f.phi_u.toFixed(2)}</span></div>
      <div class="kv-row"><span>φuc (strength uncertainty)</span><span>${f.phi_uc.toFixed(2)}</span></div>
      <div class="kv-row highlight"><span>Design friction angle, φ*</span><span>${fmt(design.phi_star, 1)}°</span></div>
      <div class="kv-row highlight"><span>Design cohesion, c*</span><span>${fmt(design.c_star, 1)} kPa</span></div>
      <div class="kv-row muted"><span colspan="2">Eq. 5.2(1), 5.2(2), Table 5.1(${store.state.basis === "undrained" ? "B" : "A"})</span></div>`;
  }

  classificationSel.value = store.state.classification;
  basisSel.value = store.state.basis;
  populateFillOptions();
  renderInputCard();

  classificationSel.addEventListener("change", (e) => store.update({ classification: e.target.value }));
  basisSel.addEventListener("change", (e) => {
    store.update({ basis: e.target.value });
    populateFillOptions();
    renderInputCard();
  });
  fillSel.addEventListener("change", (e) => store.update({ fillType: e.target.value }));

  store.subscribe(render);
}
