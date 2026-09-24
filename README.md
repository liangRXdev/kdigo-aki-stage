# KDIGO 2026 AKI Staging Calculator

**English** | [繁體中文](README.zh-TW.md)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge)](https://liangrxdev.github.io/kdigo-aki-stage)

## 1. Summary and Positioning
This project implements the acute kidney injury (AKI) staging algorithm from the draft KDIGO 2026 clinical practice guideline (Clinical Practice Guideline for AKI and AKD, March 2026 Public Review Draft). Its core goal is to replace the traditional single highest-grade stage with a precision-medicine-oriented **C-U-B (Creatinine, Urine, Biomarker) system of independent multi-dimensional stages**. The interface is in Traditional Chinese.

## 2. Facts: Inputs and Outputs

The interpretation logic follows the definitions in KDIGO 2026 Table 6:

| Dimension | Inputs | Logic | Outputs |
| :--- | :--- | :--- | :--- |
| **C-Stage** | Baseline SCr, current SCr, **48 h window** (Δ≥0.3) / **7 d window** (fold change), RRT status | Fold change (1.5x/2.0x/3.0x, requires the 7 d window checked); absolute increase Δ≥0.3 (requires the 48 h window checked); SCr ≥4.0 also requires an acute rise ≥0.3 mg/dL; RRT is staged C3 directly | C0, C1, C2, C3 |
| **U-Stage** | Body weight (kg), total urine output (mL), collection time (h) | Converted to a rate (mL/kg/h) and compared against 6 h / 12 h / 24 h thresholds; a rate < 0.1 mL/kg/h sustained >12 h is automatically staged near-anuria (U3) | U0, U1, U2, U3 |
| **B-Stage** | Structural biomarkers (e.g. NGAL, TIMP-2×IGFBP7) | Classified directly from lab results | Not Evaluated, B0, B1 |
| **Combined output** | The three dimensions above | String concatenation and risk-color formatting | e.g. `AKI Profile: C1 U2 B1` |

## 3. Interpretation: Algorithm Changes and Clinical Meaning

Compared with older calculators based on KDIGO 2012, this tool makes the following algorithm-level corrections, with clinical reasoning:
* **Decoupled staging (key correction):** The old guideline takes `Max(SCr Stage, UO Stage)` as the final stage, which is flawed. Clinically, a pure hemodynamic change (high U-Stage) and structural parenchymal injury (high B-Stage / C-Stage) carry completely different prognoses. This system always shows C, U and B separately to reflect the patient's physiology accurately.
* **Two independent time-window paths:** Δ≥0.3 mg/dL within 48 h and ≥1.5× baseline within 7 d are two independent diagnostic paths, and the user confirms each separately. The fold-change criteria for C2 (2–2.9x) and C3 (≥3x) apply only to the 7 d window; SCr ≥ 4.0 mg/dL is staged C3 only with an accompanying acute rise ≥ 0.3 mg/dL, excluding false positives from CKD patients with chronically high SCr.
* **Stricter urine-output time matrix:** Strictly maps `<0.5 mL/kg/h` over 6–12 h (U1) or >12 h (U2); U3 uses a near-anuria threshold of `< 0.1 mL/kg/h` sustained >12 h, avoiding misses caused by requiring strictly zero output.
* **Input validation:** Data completeness is checked before analysis: baseline / current SCr must be entered as a pair; the three urine fields (weight, volume, collection time) must be filled together; an all-blank submission is flagged immediately rather than silently outputting C0.
* **Explicit confounders:** Clinical factors that may cause false negatives or positives (see limitations) are part of the form and dynamically generate warnings, reducing over- and under-diagnosis.

## 4. Limitations & Confounders

Per KDIGO 2026 Table 2, the algorithm needs expert adjustment in the following situations; the system has built-in warnings for them:
1. **Drug interference:** Diuretics can force up urine output and mask the true U-Stage; RASi or SGLT2i can raise SCr as a hemodynamic effect rather than structural injury.
2. **Extreme baseline physiology:** In patients with very low muscle mass or hepatic impairment, baseline SCr is low, which can delay or miss C-Stage diagnosis.
3. **Physiological hyperfiltration:** Pregnancy increases GFR physiologically and may mask an early SCr rise.
4. **Pediatric patients:** Children under 18 need specific eGFR equations (e.g. the Schwartz equation) and pediatric urine-output cutoffs, which this calculator does not cover.

## 5. Deployment
The project is a pure frontend static single-page app (SPA) written in HTML/CSS/vanilla JS with no backend dependency, keeping patient data private.
* **Live Demo:** [https://liangrxdev.github.io/kdigo-aki-stage/](https://liangrxdev.github.io/kdigo-aki-stage/)
* **Usage:** Clone or download `index.html` and run it offline in any modern browser.

## 6. Disclaimer
**This tool is for education and academic evaluation by healthcare professionals only.** Results must not replace the clinician's overall professional judgment.

## 7. References
* KDIGO 2026 Clinical Practice Guideline for Acute Kidney Injury (AKI) and Acute Kidney Disease (AKD) - Public Review Draft, March 2026.
