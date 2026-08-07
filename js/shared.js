// Shared state, reference data and helper functions used across all modules.
// Table/equation references are to AS 4678-2002 (Incorporating Amendment Nos 1 and 2).

// ---- Table 5.1(A): strength/serviceability uncertainty factors, peak (c', phi') basis ----
export const TABLE_5_1_A = {
  controlledI:  { label: "Controlled fill — Class I",  phi_u: 0.95, phi_uc: 0.90, phi_u_sls: 1.00, phi_uc_sls: 1.00 },
  controlledII: { label: "Controlled fill — Class II", phi_u: 0.90, phi_uc: 0.75, phi_u_sls: 0.95, phi_uc_sls: 0.85 },
  uncontrolled: { label: "Uncontrolled fill",               phi_u: 0.75, phi_uc: 0.50, phi_u_sls: 0.90, phi_uc_sls: 0.65 },
  insitu:       { label: "In-situ material",                phi_u: 0.85, phi_uc: 0.70, phi_u_sls: 1.00, phi_uc_sls: 0.85 },
};

// ---- Table 5.1(B): strength/serviceability uncertainty factors, undrained (cu, phi_u) basis ----
export const TABLE_5_1_B = {
  controlledI:  { label: "Controlled fill — Class I",  phi_u: 0.0, phi_uc: 0.6, phi_u_sls: 0.0, phi_uc_sls: 0.9 },
  controlledII: { label: "Controlled fill — Class II", phi_u: 0.0, phi_uc: 0.5, phi_u_sls: 0.0, phi_uc_sls: 0.8 },
  uncontrolled: { label: "Uncontrolled fill",               phi_u: 0.0, phi_uc: 0.3, phi_u_sls: 0.0, phi_uc_sls: 0.5 },
  insitu:       { label: "In-situ material",                phi_u: 0.0, phi_uc: 0.5, phi_u_sls: 0.0, phi_uc_sls: 0.75 },
};

// ---- Table 5.2: structure classification design factor n ----
export const TABLE_5_2_N = {
  C: { uls: 0.9, sls: 1.0, desc: "High consequence — significant damage or risk to life if the structure fails" },
  B: { uls: 1.0, sls: 1.0, desc: "Medium consequence — not covered by Classification A or C" },
  A: { uls: 1.1, sls: 1.0, desc: "Low consequence — minimal damage/loss of access if the structure fails (walls ≤1.5 m only)" },
};

// ---- Table 4.1: minimum live load surcharge (kPa) ----
export const TABLE_4_1_LIVE_LOAD = {
  BC: { label: "Classification B or C", steep: 2.5, flat: 5.0 },
  A:  { label: "Classification A",      steep: 1.5, flat: 2.5 },
};

// ---- Table B1: minimum proof load factors for ground anchors ----
export const TABLE_B1 = [
  { id: "cat1", label: "Category 1 — temporary, service life < 6 months, Class A structure", k: 0.9, ratio: 1.1 },
  { id: "cat2", label: "Category 2 — temporary, service life ≤ 5 years, Class B structure", k: 0.85, ratio: 1.25 },
  { id: "cat3", label: "Category 3 — permanent anchors, or any temporary anchor on a Class C structure", k: 0.8, ratio: 1.5 },
];

// ---- Table B2: minimum material reduction factors for anchors ----
export const TABLE_B2 = { tendon: 0.9, bond: 0.7 };

// ---- Table B3: ultimate rock-to-grout bond stress (MPa), after Ostermayer ----
export const TABLE_B3 = [
  { condition: "Unweathered (FR) — very good mineral bond, disjunction > 0.3 m", igneousMetamorphic: 4.0, conglomerateBreccia: 2.7, argillaceous: 1.7 },
  { condition: "Weathered (SW) — good mineral bond, disjunction 0.1–0.3 m", igneousMetamorphic: 2.5, conglomerateBreccia: 1.9, argillaceous: 1.0 },
  { condition: "Distinctly weathered (DW) — poor mineral bond, disjunction < 0.1 m", igneousMetamorphic: 1.3, conglomerateBreccia: 0.8, argillaceous: 0.4 },
];

// ---- Shared reactive store ----
const listeners = new Set();
export const store = {
  state: {
    classification: "B",
    basis: "peak", // 'peak' -> Table 5.1(A), 'undrained' -> Table 5.1(B)
    fillType: "controlledI",
    phi_char: 32,   // deg, characteristic (peak) friction angle
    c_char: 0,      // kPa, characteristic (peak) cohesion
    cu_char: 0,     // kPa, characteristic undrained shear strength
    gamma: 18,      // kN/m3, backfill unit weight
  },
  subscribe(fn) {
    listeners.add(fn);
    fn(this.state);
    return () => listeners.delete(fn);
  },
  update(patch) {
    Object.assign(this.state, patch);
    listeners.forEach((fn) => fn(this.state));
  },
};

// ---- Derived design-value helpers ----

// Eq. 5.2(2): phi* = atan( phi_u * tan(phi) )
export function designFrictionAngleDeg(phiCharDeg, factor) {
  const phiRad = (phiCharDeg * Math.PI) / 180;
  return (Math.atan(factor * Math.tan(phiRad)) * 180) / Math.PI;
}

// Eq. 5.2(1): c* = phi_uc * c
export function designCohesion(cChar, factor) {
  return factor * cChar;
}

export function getDesignFactors(state) {
  const table = state.basis === "undrained" ? TABLE_5_1_B : TABLE_5_1_A;
  return table[state.fillType];
}

export function getDesignSoilParams(state) {
  const f = getDesignFactors(state);
  if (state.basis === "undrained") {
    return {
      phi_star: designFrictionAngleDeg(0, f.phi_u), // undrained: phi_u = 0 by definition (Table 5.1(B))
      c_star: designCohesion(state.cu_char, f.phi_uc),
      basisLabel: "Undrained (cu, φu)",
    };
  }
  return {
    phi_star: designFrictionAngleDeg(state.phi_char, f.phi_u),
    c_star: designCohesion(state.c_char, f.phi_uc),
    basisLabel: "Effective / peak (c', φ')",
  };
}

export function getStructureFactor(classification) {
  return TABLE_5_2_N[classification];
}

// ---- Generic limit-state comparison: R* >= S* ----
export function checkLimitState(R, S) {
  const ratio = S === 0 ? Infinity : R / S;
  return { R, S, ratio, pass: R >= S - 1e-9 };
}

// ---- Formatting ----
export function fmt(n, dp = 2) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function deg2rad(d) {
  return (d * Math.PI) / 180;
}
export function rad2deg(r) {
  return (r * 180) / Math.PI;
}

// ---- Renders a pass/fail result card into a container element ----
export function renderResultCard(container, { title, clause, R, Rlabel, S, Slabel }) {
  const { ratio, pass } = checkLimitState(R, S);
  container.innerHTML = `
    <div class="result-card ${pass ? "pass" : "fail"}">
      <div class="result-head">
        <span class="result-title">${title}</span>
        <span class="result-clause">${clause}</span>
      </div>
      <div class="result-row"><span>${Rlabel}: R*</span><span>${fmt(R)}</span></div>
      <div class="result-row"><span>${Slabel}: S*</span><span>${fmt(S)}</span></div>
      <div class="result-verdict">
        <span class="verdict-badge">${pass ? "PASS" : "FAIL"}</span>
        <span class="verdict-formula">R*&nbsp;≥&nbsp;S*&nbsp;&mdash;&nbsp;ratio ${fmt(ratio)}</span>
      </div>
    </div>`;
}
