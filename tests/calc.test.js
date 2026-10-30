'use strict';
// js/calc.js 單元測試：依 KDIGO 2026 AKI/AKD public review draft（2026-03）C／U 標準。
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAKI } = require('../js/calc.js');

const C = (baseScr, currScr, timeframe, extra = {}) => evaluateAKI({ baseScr, currScr, timeframe, ...extra });
const U = (weight, uVol, uTime) => evaluateAKI({ weight, uVol, uTime });

test('C：timeframe lt48 — Δ≥0.3 與倍率規則皆啟用', () => {
    assert.equal(C('1.0', '1.3', 'lt48').cStage, 'C1');
    assert.equal(C('1.0', '1.5', 'lt48').cStage, 'C1');
    assert.equal(C('1.0', '2.0', 'lt48').cStage, 'C2');
    assert.equal(C('1.0', '3.0', 'lt48').cStage, 'C3');
    assert.equal(C('3.8', '4.2', 'lt48').cStage, 'C3');
});

test('C：timeframe 48h-7d — 停用 Δ≥0.3，保留倍率', () => {
    assert.equal(C('1.0', '1.4', '48h-7d').cStage, 'C0');
    assert.equal(C('1.0', '1.5', '48h-7d').cStage, 'C1');
    assert.equal(C('1.0', '2.9', '48h-7d').cStage, 'C2');
    assert.equal(C('1.0', '3.0', '48h-7d').cStage, 'C3');
});

test('C：timeframe gt7 — 全部規則停用', () => {
    for (const curr of ['1.3', '1.5', '2.0', '3.0', '4.5']) assert.equal(C('1.0', curr, 'gt7').cStage, 'C0');
    assert.match(C('1.0', '3.0', 'gt7').cDesc, /AKD/);
});

test('C：SCr ≥4.0 需伴 Δ≥0.3（e611327 刻意設計）', () => {
    assert.equal(C('4.0', '4.1', 'lt48').cStage, 'C0');
    assert.equal(C('1.5', '4.0', '48h-7d').cStage, 'C3');
    assert.equal(C('3.5', '4.0', 'lt48').cStage, 'C3');
});

test('C：RRT 不論 timeframe 皆 C3', () => {
    for (const tf of ['', 'lt48', '48h-7d', 'gt7']) assert.equal(evaluateAKI({ isRRT: true, timeframe: tf }).cStage, 'C3');
});

test('C：恢復期（current < baseline）為 C0', () => {
    const r = C('2.0', '1.2', 'lt48');
    assert.equal(r.cStage, 'C0');
});

test('U：6–12h <0.5 → U1；>12h → U2；<0.3 ≥24h → U3', () => {
    assert.equal(U('70', '200', '6').uStage, 'U1');
    assert.equal(U('70', '400', '12').uStage, 'U1');
    assert.equal(U('70', '400', '12.5').uStage, 'U2');
    assert.equal(U('70', '500', '24').uStage, 'U3');
    assert.equal(U('70', '700', '24').uStage, 'U2');
});

test('U：rate 恰 0.5 不符（<0.5）', () => {
    assert.equal(U('70', '210', '6').uStage, 'U0');
});

test('U：無尿 >12h → U3；恰 12h 不觸發', () => {
    assert.equal(U('70', '0', '13').uStage, 'U3');
    assert.match(U('70', '0', '13').uDesc, /anuria/);
    assert.equal(U('70', '0', '12').uStage, 'U1');
});

test('最終分期 = max(C, U)；僅單邊有資料時取該邊', () => {
    assert.equal(evaluateAKI({ baseScr: '1.0', currScr: '1.5', timeframe: 'lt48', weight: '70', uVol: '400', uTime: '13' }).finalStage, 2);
    assert.equal(evaluateAKI({ baseScr: '1.0', currScr: '3.0', timeframe: 'lt48', weight: '70', uVol: '200', uTime: '6' }).finalStage, 3);
    assert.equal(C('1.0', '2.0', 'lt48').finalStage, 2);
    assert.equal(U('70', '200', '6').finalStage, 1);
    assert.equal(evaluateAKI({ isRRT: true }).finalStage, 3);
});

test('部分輸入：缺欄位回傳錯誤訊息', () => {
    assert.match(evaluateAKI({}).error, /至少一項/);
    assert.match(evaluateAKI({ baseScr: '1.0' }).error, /Current SCr/);
    assert.match(evaluateAKI({ currScr: '1.0' }).error, /Baseline SCr/);
    assert.match(evaluateAKI({ weight: '70', uVol: '100' }).error, /三欄/);
    assert.match(C('1.0', '1.5', '').error, /時間窗/);
});

test('浮點邊界：Δ 恰 0.3 判 C1（1.1→1.4 = 0.2999…）', () => {
    assert.equal(C('1.1', '1.4', 'lt48').cStage, 'C1');
    assert.equal(C('2.0', '2.3', 'lt48').cStage, 'C1');
    assert.equal(C('0.4', '0.7', 'lt48').cStage, 'C1');
    assert.match(C('1.1', '1.4', 'lt48').cDesc, /Δ0\.30/);
});

test('浮點邊界：ratio 恰 1.5／3.0 判對應分期（0.8→1.2 = 1.4999…）', () => {
    assert.equal(C('0.8', '1.2', '48h-7d').cStage, 'C1');
    assert.equal(C('1.1', '1.65', '48h-7d').cStage, 'C1');
    assert.equal(C('0.8', '2.4', '48h-7d').cStage, 'C3');
    assert.equal(C('1.1', '3.3', '48h-7d').cStage, 'C3');
    assert.equal(C('1.0', '2.0', '48h-7d').cStage, 'C2');
});

test('浮點邊界：SCr 恰 4.0 且 Δ 恰 0.3 → C3（3.7→4.0）', () => {
    assert.equal(C('3.7', '4.0', 'lt48').cStage, 'C3');
});

test('浮點容差不放寬真正未達標者', () => {
    assert.equal(C('1.0', '1.29', 'lt48').cStage, 'C0');
    assert.equal(C('1.0', '1.49', '48h-7d').cStage, 'C0');
    assert.equal(C('1.0', '1.99', '48h-7d').cStage, 'C1');
    assert.equal(C('1.0', '2.99', '48h-7d').cStage, 'C2');
    assert.equal(C('3.71', '4.0', 'lt48').cStage, 'C0');
    assert.equal(C('3.0', '3.99', 'lt48').cStage, 'C1');
});

test('極端值：SCr ≤0、負值、非有限數 → 回傳錯誤，不靜默判 C0', () => {
    for (const [b, k] of [['0', '1.2'], ['-1', '1.2'], ['1.0', '0'], ['1.0', '-0.5'], ['1e400', '1.2'], ['abc', '1.2']]) {
        const r = C(b, k, 'lt48');
        assert.match(r.error || '', /SCr.*大於 0/, `${b}→${k}`);
    }
    assert.match(C('0', '1.2', 'lt48', { isRRT: true }).error || '', /SCr.*大於 0/);
});

test('極端值：體重 ≤0、收集時間 ≤0、尿量為負 → 回傳錯誤', () => {
    for (const [w, v, h, re] of [
        ['0', '100', '6', /體重/], ['-70', '100', '6', /體重/],
        ['70', '100', '0', /收集時間/], ['70', '100', '-6', /收集時間/],
        ['70', '-10', '6', /尿量/], ['70', 'abc', '6', /尿量/],
    ]) assert.match(U(w, v, h).error || '', re, `${w}/${v}/${h}`);
});

test('極端值：尿量 0 為有效輸入（無尿）', () => {
    assert.equal(U('70', '0', '6').error, null);
});

test('輸出不得出現 NaN、Infinity 或負值', () => {
    const { buildCases } = require('./helpers/cases');
    for (const c of buildCases()) {
        const r = evaluateAKI(c);
        if (r.error) continue;
        for (const s of [r.cDesc, r.uDesc]) assert.doesNotMatch(s, /NaN|Infinity|-\d/, `${JSON.stringify(c)} → ${s}`);
        for (const n of [r.cStageInt, r.uStageInt, r.finalStage]) assert.ok(Number.isInteger(n) && n >= 0 && n <= 3);
    }
});

test('部分輸入：只填尿量時 C 描述為「未提供」而非「未達標」', () => {
    const r = U('70', '200', '6');
    assert.equal(r.cStage, 'C0');
    assert.match(r.cDesc, /未提供 SCr/);
});

test('部分輸入：只填 SCr / 只勾 RRT 時 U 描述為「未提供」', () => {
    assert.match(C('1.0', '2.0', 'lt48').uDesc, /未提供尿量/);
    assert.match(evaluateAKI({ isRRT: true }).uDesc, /未提供尿量/);
});

test('U：收集 <6h 且 rate <0.5 不得標「正常」', () => {
    const r = U('70', '0', '4');
    assert.equal(r.uStage, 'U0');
    assert.doesNotMatch(r.uDesc, /正常/);
    assert.match(r.uDesc, /<6h/);
    assert.match(U('70', '300', '4').uDesc, /正常/);
});

test('U 邊界：hrs 5.9/6/12/12.5/24/25（U3 hrs=24 現行判 U3，標準寫 >24h，列 PR 待決）', () => {
    assert.equal(U('70', '0', '5.9').uStage, 'U0');
    assert.equal(U('70', '200', '6').uStage, 'U1');
    assert.equal(U('70', '200', '12').uStage, 'U1');
    assert.equal(U('70', '200', '12.5').uStage, 'U2');
    assert.equal(U('70', '200', '24').uStage, 'U3'); // 待決：>24h 是否應不含 24
    assert.equal(U('70', '504', '24').uStage, 'U2'); // rate 恰 0.3 → 不符 <0.3
    assert.equal(U('70', '500', '25').uStage, 'U3');
});

test('C 邊界：ratio 恰 2.0 → C2；恰 3.0 → C3；1.99 → C1', () => {
    assert.equal(C('1.0', '2.0', '48h-7d').cStage, 'C2');
    assert.equal(C('1.5', '3.0', 'lt48').cStage, 'C2');
    assert.equal(C('1.0', '3.0', '48h-7d').cStage, 'C3');
    assert.equal(C('1.0', '1.99', 'lt48').cStage, 'C1');
});

test('C 待決現況鎖定：48h-7d、SCr 達 4.0 且 Δ≥0.3 但 ratio <1.5 → 現行判 C3', () => {
    assert.equal(C('3.8', '4.1', '48h-7d').cStage, 'C3');
});

test('RRT 不需 timeframe；RRT + 尿量時 final 仍為 3', () => {
    assert.equal(evaluateAKI({ isRRT: true, baseScr: '1.0', currScr: '1.0' }).cStage, 'C3');
    assert.equal(evaluateAKI({ isRRT: true, weight: '70', uVol: '700', uTime: '6' }).finalStage, 3);
});

test('U 浮點門檻：rate 數學上恰為 0.5／0.3／0.1 時不得因 IEEE 754 誤差被多判一級', () => {
    // 1.1 kg × 6h × 0.5 = 3.3 mL → 3.3/1.1/6 = 0.4999… ；數學上 0.5 不符 <0.5
    assert.equal(U('1.1', '3.3', '6').uStage, 'U0');
    assert.equal(U('3.6', '11.7', '6.5').uStage, 'U0');
    // 4.5 kg × 28h × 0.3 = 37.8 mL → 0.2999… ；數學上 0.3 不符 <0.3（應為 U2）
    assert.equal(U('4.5', '37.8', '28').uStage, 'U2');
    assert.equal(U('16.5', '128.7', '26').uStage, 'U2');
    // 4.5 kg × 18h × 0.1 = 8.1 mL → 0.0999… ；數學上 0.1 不符無尿門檻 <0.1（應為 U2）
    assert.equal(U('4.5', '8.1', '18').uStage, 'U2');
    // 明確低於門檻者不受容差影響
    assert.equal(U('1.1', '3.2', '6').uStage, 'U1');
    assert.equal(U('4.5', '37.7', '28').uStage, 'U3');
});
