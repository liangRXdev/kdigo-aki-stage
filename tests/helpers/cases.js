// Characterization 輸入網格：涵蓋 timeframe × 邊界值 × 極端值 × 部分輸入。
'use strict';
function buildCases() {
    const cases = [];
    const scrBase = ['', '0', '-1', '0.4', '0.8', '1.0', '1.1', '2.0', '3.7'];
    const scrCurr = ['', '0.5', '0.6', '0.7', '1.2', '1.3', '1.4', '1.5', '2.0', '2.4', '3.0', '4.0', '4.1'];
    const tfs = ['', 'lt48', '48h-7d', 'gt7'];
    for (const baseScr of scrBase) for (const currScr of scrCurr) for (const timeframe of tfs) for (const isRRT of [false, true])
        cases.push({ baseScr, currScr, timeframe, isRRT });
    const wts = ['', '0', '-70', '70'];
    const vols = ['', '0', '-10', '100', '210', '300', '420', '504', '840'];
    const hrsList = ['', '0', '4', '6', '12', '12.5', '24', '25'];
    for (const weight of wts) for (const uVol of vols) for (const uTime of hrsList)
        cases.push({ weight, uVol, uTime });
    // C + U 併存：最終分期取較高者
    for (const [b, c, tf] of [['1.0', '1.5', '48h-7d'], ['1.0', '2.0', '48h-7d'], ['1.0', '3.0', 'lt48'], ['1.0', '1.0', 'lt48']])
        for (const [w, v, h] of [['70', '700', '6'], ['70', '200', '6'], ['70', '400', '13'], ['70', '0', '13']])
            cases.push({ baseScr: b, currScr: c, timeframe: tf, weight: w, uVol: v, uTime: h });
    cases.push({ isRRT: true, weight: '70', uVol: '700', uTime: '6' });
    cases.push({ biomarker: 'B1', baseScr: '1.0', currScr: '1.0', timeframe: 'lt48' });
    const seen = new Set();
    return cases.map(c => Object.assign({ baseScr: '', currScr: '', timeframe: '', isRRT: false,
        weight: '', uVol: '', uTime: '', biomarker: 'NotTested' }, c))
        .filter(c => !seen.has(keyOf(c)) && seen.add(keyOf(c)));
}
const keyOf = c => JSON.stringify([c.baseScr, c.currScr, c.timeframe, c.isRRT, c.weight, c.uVol, c.uTime, c.biomarker]);
module.exports = { buildCases, keyOf };
