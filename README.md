# Earth-Retaining Structures Calculator

An interactive, browser-based calculator implementing the limit-state design methodology of
**AS 4678-2002 *Earth-retaining structures*** (incorporating Amendment Nos 1 & 2).

**[Open the calculator](index.html)** — pure static HTML/CSS/JS, no build step, no server. Open
`index.html` directly, or serve the repo with GitHub Pages.

## What it covers

The Standard is limit-state format: for every check, the design resistance effect must be
greater than or equal to the design action effect, **R\* ≥ S\*** (Cl. 3.1.2). Four modules:

1. **Structure Classification & Design Soil Parameters** — classification A/B/C (Table 1.1)
   drives the structure factor `n` (Table 5.2); fill condition (controlled Class I/II,
   uncontrolled, in-situ) drives the material uncertainty factors (Table 5.1(A) for effective/peak
   strength, or Table 5.1(B) for undrained strength), giving design values `φ*`/`c*`
   (Eq. 5.2(1), 5.2(2)). These outputs feed the other three modules.
2. **Gravity/Cantilever Wall Stability** — Rankine active earth pressure on a vertical plane at
   the back of the heel (valid for any stem batter), or Coulomb with explicit wall friction and
   batter. Checks sliding (Limit Mode U1), overturning (U2) and bearing (U6) in `R*≥S*` format,
   with load factors of 1.25 on dead/soil-weight actions, 1.5 on live-load surcharge and 1.0 on
   water pressure (Cl. 4.1). Bearing capacity uses the classical Meyerhof/Vesic strip-footing
   equation.
3. **Reinforced Soil (MSE) Wall Reinforcement** — design tensile strength of soil reinforcement,
   `Td* = Tu·φup·(φrc·φue)·φri·(φrt·φrs·φrst·φud)·n` (Eq. 5.5(1)), checked against the required
   tensile force for a layer at a given depth and spacing (Limit Mode U3/U4).
4. **Ground Anchors & Soil Nails** (Appendix B/C) — tendon rupture check (Eq. B4(1)), rock-to-grout
   bond capacity using typical Ostermayer bond stresses (Table B3), soil anchor pull-out for
   bulb-type (Eq. B4(2)) and under-reamed anchors (Eq. B4(3)), and working/proof/lock-off load
   limits (Cl. B4.4, Table B1).

## What it deliberately leaves out

- Global (slope-stability) failure (Limit Mode U5) and seismic loading (Appendix I) are not
  implemented.
- Sections use one soil parameter set for backfill and foundation; override the Module 1 inputs
  if site conditions differ between the two.
- Table 5.1(B) undrained factors and the anchor/nail modules are provided as calculation aids;
  they do not replace field/laboratory testing or specialist geotechnical review, which the
  Standard requires for anchor and nail capacities in particular (Cl. B4.1, Note 2).

## How the calculations relate to the Standard

AS 4678-2002 is copyrighted by Standards Australia / SAI Global. This tool does **not** reproduce
the Standard's clause text, notes or figures. It implements:

- **Classical, public-domain geotechnical formulas** — Rankine and Coulomb active earth pressure
  theory, limit-equilibrium sliding/overturning/bearing checks, and anchor bond mechanics. These
  are standard textbook soil mechanics, not expression original to AS 4678.
- **AS 4678's published numeric factors and limit-state format** — the partial factor tables and
  design equations cited above (by clause/table/equation number in the UI), used here as
  calculation inputs and results, not as reproduced text.

If you need the full requirements, definitions, commentary or figures, obtain the current edition
of AS 4678 from [Standards Australia](https://www.standards.org.au) or SAI Global.

## Disclaimer

This is an informative design aid. It is not a substitute for the current, complete Standard, for
site-specific geotechnical investigation, or for review and sign-off by a suitably qualified and
experienced engineer. Verify all inputs, assumptions and results independently before relying on
them for any real design.

## Project structure

```
index.html              app shell / navigation
assets/style.css         styling
js/shared.js             shared state, reference-table data, helper functions
js/classification.js     Module 1 — structure classification & design soil parameters
js/stability.js          Module 2 — gravity/cantilever wall stability
js/reinforcement.js      Module 3 — MSE reinforcement design
js/anchors.js            Module 4 — ground anchors & soil nails
js/main.js               tab navigation / module mounting
```

## License

Code in this repository is MIT-licensed (see [LICENSE](LICENSE)). This license covers the code
only — it does not extend to, and does not grant any rights in, AS 4678-2002 itself.
