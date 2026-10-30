'use strict';
// index.html 互動流程：resetForm()、copyResults() 與畫面一致性。
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers/dom');

const AKI = { baseScr: '1.0', currScr: '2.0', timeframe: 'lt48' };
const NO_AKI = { baseScr: '1.0', currScr: '1.1', timeframe: 'lt48' };

test('resetForm：清空輸入、藥物勾選、結果與複製文字', () => {
    const p = loadPage();
    p.run(AKI);
    p.$('sad_nsai').checked = true;
    p.context.updateSadmansActions();
    p.$('tdm_vanc').checked = true;
    p.context.resetForm();
    for (const id of ['baseScr', 'currScr', 'timeframe', 'weight', 'uVol', 'uTime']) assert.equal(p.$(id).value, '', id);
    assert.equal(p.$('isRRT').checked, false);
    // 勾選框可能已隨面板移除；存在時必須為未勾選
    for (const id of ['sad_nsai', 'tdm_vanc']) assert.ok(!p.$(id) || !p.$(id).checked, id);
    assert.equal(p.$('biomarker').value, 'NotTested');
    for (const id of ['resultBox', 'sadmansBox', 'tdmBox', 'nephrotoxBox', 'postakiBox']) assert.equal(p.$(id).style.display, 'none', id);
    const s = p.snapshot();
    assert.equal(s.copy, null);
});

test('copyResults：AKI 時含已勾選藥物與 KAMPS，與畫面一致', () => {
    const p = loadPage();
    p.run(AKI);
    p.$('sad_nsai').checked = true;
    p.$('ntx_dig').checked = true;
    const { copy } = p.snapshot();
    assert.match(copy, /C2/);
    assert.match(copy, /\[SADMANS 停藥審視\][\s\S]*NSAIDs/);
    assert.match(copy, /\[其他腎毒性藥物\][\s\S]*Digoxin/);
    assert.match(copy, /KAMPS/);
    assert.doesNotMatch(copy, /TDM\]/);
});

test('copyResults：重新分析為非 AKI 後，隱藏面板的舊勾選不得進入複製文字', () => {
    const p = loadPage();
    p.run(AKI);
    p.$('sad_nsai').checked = true;
    p.$('tdm_vanc').checked = true;
    p.$('ntx_dig').checked = true;
    const s = p.run(NO_AKI);
    assert.equal(p.$('sadmansBox').style.display, 'none');
    assert.doesNotMatch(s.copy, /SADMANS|Vancomycin|Digoxin|KAMPS/);
    assert.match(s.copy, /目前無 AKI 指徵/);
});

test('驗證失敗時隱藏舊結果並清除複製文字，不殘留上一次分析', () => {
    const p = loadPage();
    p.run(AKI);
    const s = p.run({ baseScr: '1.0', currScr: '', timeframe: 'lt48' });
    assert.match(s.alert, /Current SCr/);
    assert.equal(s.visible, false);
    assert.equal(s.copy, null);
});

test('程式碼不含西里爾字母（防同形字識別字，如 postaкi）', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const { ROOT } = require('./helpers/dom');
    for (const f of ['index.html', 'js/calc.js', 'sw.js'])
        assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /[Ѐ-ӿ]/, f);
});
