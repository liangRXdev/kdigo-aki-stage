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
