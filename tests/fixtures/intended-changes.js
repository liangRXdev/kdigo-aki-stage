// 刻意修 bug 造成的 characterization 差異。每條規則：
//   match(c, old)      → 此案是否受該修正影響
//   fields             → 該修正允許改變的欄位；其餘欄位必須與 snapshot 完全一致
//   check(now, old, c) → 回傳 true 表示新輸出符合預期
//   exclusive          → 命中時只套用此規則（例如輸入被擋下，其他修正無從比較）
// 不屬於任何規則的案例，新輸出必須與 snapshot 完全一致。
'use strict';
const stageOf = html => (/<strong>([CU]\d)<\/strong>/.exec(html || '') || [])[1];

// 以 0.01 mg/dL 整數運算的 C-Stage 精確 oracle（不受 IEEE 754 誤差影響）
function exactCStage(c) {
    if (c.isRRT || !['lt48', '48h-7d'].includes(c.timeframe)) return null;
    const b = Math.round(parseFloat(c.baseScr) * 100), k = Math.round(parseFloat(c.currScr) * 100);
    if (!(b > 0) || isNaN(k)) return null;
    const is48h = c.timeframe === 'lt48';
    if (k >= 3 * b || (k >= 400 && k - b >= 30)) return 'C3';
    if (k >= 2 * b) return 'C2';
    if (2 * k >= 3 * b || (is48h && k - b >= 30)) return 'C1';
    return 'C0';
}
// C1 理由字串應列出的條件（48h Δ / 7d 倍率）
function exactC1Reasons(c) {
    const b = Math.round(parseFloat(c.baseScr) * 100), k = Math.round(parseFloat(c.currScr) * 100);
    return { d48: c.timeframe === 'lt48' && k - b >= 30, r7: 2 * k >= 3 * b };
}
const reasonsOf = html => ({ d48: /within 48h/.test(html), r7: /x baseline within 7d/.test(html) });
const sameReasons = (a, b) => a.d48 === b.d48 && a.r7 === b.r7;
function exactMatches(html, c) {
    const e = exactCStage(c);
    if (stageOf(html) !== e) return false;
    return e !== 'C1' || sameReasons(reasonsOf(html), exactC1Reasons(c));
}

const bad = (v, allowZero) => v !== '' && !(parseFloat(v) > 0 || (allowZero && parseFloat(v) === 0));

const noScr = c => c.baseScr === '' && !c.isRRT;
const shortLowUO = c => parseFloat(c.weight) > 0 && parseFloat(c.uTime) > 0 && parseFloat(c.uTime) < 6 &&
    parseFloat(c.uVol) >= 0 && parseFloat(c.uVol) / parseFloat(c.weight) / parseFloat(c.uTime) < 0.5;

module.exports = [
    {
        id: 'fix-invalid-range',
        // 舊版未擋：SCr ≤0、體重 ≤0、時數 ≤0、尿量 <0（須在原有「缺欄位」檢查通過後）
        match: (c, old) => old.alert === null && (bad(c.baseScr) || bad(c.currScr) ||
            bad(c.weight) || bad(c.uTime) || bad(c.uVol, true)),
        exclusive: true,
        fields: ['alert', 'visible', 'resC', 'resU', 'badge', 'copy'],
        check: now => /大於 0|≥0/.test(now.alert || '') && !now.visible && now.copy === null,
    },
    {
        id: 'fix-float-threshold',
        match: (c, old) => exactCStage(c) !== null && old.alert === null && !exactMatches(old.resC, c),
        fields: ['resC', 'badge', 'copy'],
        check: (now, old, c) => exactMatches(now.resC, c),
    },
    {
        id: 'fix-partial-labels',
        // 未輸入 SCr / 尿量時舊版顯示「未達標」；收集 <6h 且 rate <0.5 舊版顯示「正常」
        match: (c, old) => old.alert === null && (noScr(c) || c.weight === '' || shortLowUO(c)),
        fields: c => [...(noScr(c) ? ['resC'] : []), ...(c.weight === '' || shortLowUO(c) ? ['resU'] : []), 'copy'],
        check: (now, old, c) =>
            (!noScr(c) || now.resC === '<strong>C0</strong>: 未提供 SCr（未評估）') &&
            (c.weight !== '' || now.resU === '<strong>U0</strong>: 未提供尿量（未評估）') &&
            (!shortLowUO(c) || /^<strong>U0<\/strong>: 收集時間 <6h/.test(now.resU)),
    },
];
