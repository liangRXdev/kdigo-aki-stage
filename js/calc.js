// KDIGO 2026 AKI C-/U-Stage 判定（純函式，無 DOM 相依）。
// 瀏覽器：<script src="js/calc.js"> → window.KdigoCalc；Node：module.exports。
(function (root) {
    'use strict';

    // 浮點容差：0.3、1.5 倍等門檻以 IEEE 754 計算會落在門檻下方
    // （1.4 − 1.1 = 0.2999…、1.2 / 0.8 = 1.4999…），比較時一律容許 EPS。
    const EPS = 1e-9;
    const gte = (a, b) => a >= b - EPS;
    // 尿量 rate 的「< 門檻」同理（3.3 / 1.1 / 6 = 0.4999…），數學上等於門檻者不算低於。
    const lt  = (a, b) => a < b - EPS;

    // 輸入皆為表單原始字串（或 boolean）；回傳 { error } 或分期結果。
    function evaluateAKI(input) {
        const str = v => (v === undefined || v === null ? '' : String(v).trim());
        const baseScrVal = str(input.baseScr);
        const currScrVal = str(input.currScr);
        const wtVal  = str(input.weight);
        const volVal = str(input.uVol);
        const hrsVal = str(input.uTime);
        const isRRT  = !!input.isRRT;
        const timeframe = str(input.timeframe);
        // <48h 的變化必然也落在 7d 內，故同時滿足絕對值窗與倍率窗
        const is48h  = timeframe === 'lt48';
        const is7d   = timeframe === 'lt48' || timeframe === '48h-7d';

        const uFieldsFilled = [wtVal, volVal, hrsVal].filter(v => v !== '').length;

        if (!isRRT && baseScrVal === '' && currScrVal === '' && uFieldsFilled === 0)
            return { error: '請填入至少一項資料（SCr 或尿量），或勾選 RRT。' };
        if (baseScrVal !== '' && currScrVal === '')
            return { error: '已填入 Baseline SCr，請同時填入 Current SCr。' };
        if (currScrVal !== '' && baseScrVal === '')
            return { error: '已填入 Current SCr，請同時填入 Baseline SCr。' };
        if (uFieldsFilled > 0 && uFieldsFilled < 3)
            return { error: '尿量分期需同時填入體重、尿量、收集時間三欄。' };
        if (!isRRT && baseScrVal !== '' && currScrVal !== '' && timeframe === '')
            return { error: '已填入 SCr，請選擇 SCr 變化的時間窗。' };

        const bScr = parseFloat(baseScrVal);
        const cScr = parseFloat(currScrVal);
        const wt   = parseFloat(wtVal);
        const vol  = parseFloat(volVal);
        const hrs  = parseFloat(hrsVal);

        // 數值範圍：避免 ÷0（Infinity）、NaN 或負值被靜默判為 C0 / U-Stage
        const pos = (s, n) => s === '' || (Number.isFinite(n) && n > 0);
        if (!pos(baseScrVal, bScr) || !pos(currScrVal, cScr))
            return { error: 'SCr 必須為大於 0 的數值（mg/dL）。' };
        if (uFieldsFilled === 3) {
            if (!pos(wtVal, wt))  return { error: '體重必須為大於 0 的數值（kg）。' };
            if (!pos(hrsVal, hrs)) return { error: '收集時間必須為大於 0 的數值（小時）。' };
            if (!(Number.isFinite(vol) && vol >= 0)) return { error: '尿量必須為 ≥0 的數值（mL）。' };
        }

        // 1. C-Stage
        let cStageInt = 0, cStage = "C0", cDesc = "未達標";
        if (!isRRT && baseScrVal === '') cDesc = "未提供 SCr（未評估）";

        if (isRRT) {
            cStageInt = 3; cStage = "C3"; cDesc = "Initiation of RRT";
        } else if (!isNaN(bScr) && !isNaN(cScr) && bScr > 0) {
            const ratio = cScr / bScr;
            const diff  = cScr - bScr;
            if (is48h || is7d) {
                const dOK = gte(diff, 0.3);
                const c3ByRatio = gte(ratio, 3.0) && is7d;
                const c3ByAbs   = gte(cScr, 4.0) && dOK && (is48h || is7d);
                if (c3ByRatio || c3ByAbs) {
                    cStageInt = 3; cStage = "C3";
                    cDesc = c3ByRatio
                        ? `≥3.0x baseline (Ratio: ${ratio.toFixed(2)}, 7 天內)`
                        : `SCr ≥4.0 mg/dL 伴急性上升 ≥0.3 mg/dL (Δ${diff.toFixed(2)})`;
                } else if (gte(ratio, 2.0) && is7d) {
                    cStageInt = 2; cStage = "C2";
                    cDesc = `2.0–2.9x baseline (Ratio: ${ratio.toFixed(2)}, 7 天內)`;
                } else if ((gte(ratio, 1.5) && is7d) || (dOK && is48h)) {
                    cStageInt = 1; cStage = "C1";
                    const reasons = [];
                    if (dOK && is48h) reasons.push(`Δ${diff.toFixed(2)} mg/dL within 48h`);
                    if (gte(ratio, 1.5) && is7d) reasons.push(`${ratio.toFixed(2)}x baseline within 7d`);
                    cDesc = reasons.join(' / ');
                }
            } else {
                cDesc = "時間窗 >7 天或時間不明 — 不符 AKI 時間定義（請考量 AKD / CKD）";
            }
        }

        // 2. U-Stage
        let uStageInt = 0, uStage = "U0", uDesc = "未提供尿量（未評估）";

        if (!isNaN(wt) && !isNaN(vol) && !isNaN(hrs) && wt > 0 && hrs > 0) {
            const rate = vol / wt / hrs;
            if (lt(rate, 0.3) && hrs >= 24) {
                uStageInt = 3; uStage = "U3";
                uDesc = `Rate: ${rate.toFixed(2)} mL/kg/h for ${hrs}h (< 0.3 × ≥24h)`;
            } else if (lt(rate, 0.1) && hrs > 12) {
                uStageInt = 3; uStage = "U3";
                uDesc = `Near-anuria (Rate: ${rate.toFixed(3)} mL/kg/h for ${hrs}h)`;
            } else if (lt(rate, 0.5) && hrs > 12) {
                uStageInt = 2; uStage = "U2";
                uDesc = `Rate: ${rate.toFixed(2)} mL/kg/h for ${hrs}h`;
            } else if (lt(rate, 0.5) && hrs >= 6 && hrs <= 12) {
                uStageInt = 1; uStage = "U1";
                uDesc = `Rate: ${rate.toFixed(2)} mL/kg/h for ${hrs}h`;
            } else if (lt(rate, 0.5)) {
                uDesc = `收集時間 <6h，未達 U1 最短判定時間 (Rate: ${rate.toFixed(2)} mL/kg/h for ${hrs}h)`;
            } else {
                uDesc = `正常 (Rate: ${rate.toFixed(2)} mL/kg/h)`;
            }
        }

        return {
            error: null,
            cStageInt, cStage, cDesc,
            uStageInt, uStage, uDesc,
            // 最終分期：C 與 U 取較高者（B 維度不納入）
            finalStage: Math.max(cStageInt, uStageInt),
        };
    }

    const api = { evaluateAKI };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.KdigoCalc = api;
})(this);
