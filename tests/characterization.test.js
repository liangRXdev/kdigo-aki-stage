'use strict';
// 鎖住重構前 index.html 的畫面與複製文字輸出（tests/fixtures/characterization.json，
// 由 tests/helpers/record-snapshot.js 對 3a238c3 錄製）。
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPage } = require('./helpers/dom');
const { buildCases, keyOf } = require('./helpers/cases');
const snapshot = require('./fixtures/characterization.json');
const RULES = require('./fixtures/intended-changes');

test('characterization：輸出與重構前一致（刻意修正除外）', () => {
    const cases = buildCases();
    assert.equal(cases.length, Object.keys(snapshot).length);
    const used = new Set();
    for (const c of cases) {
        const old = snapshot[keyOf(c)];
        assert.ok(old, `snapshot 缺 ${keyOf(c)}`);
        const page = loadPage();
        page.run(c);
        const now = page.compact();
        const rule = RULES.find(r => r.match(c, old));
        if (rule) {
            used.add(rule.id);
            assert.ok(rule.check(now, old, c), `[${rule.id}] ${keyOf(c)}\nnow=${JSON.stringify(now)}\nold=${JSON.stringify(old)}`);
        } else {
            assert.deepEqual(now, old, keyOf(c));
        }
    }
    for (const r of RULES) assert.ok(used.has(r.id), `規則 ${r.id} 未命中任何案例`);
});
