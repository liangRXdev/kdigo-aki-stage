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
        let rules = RULES.filter(r => r.match(c, old));
        if (rules.some(r => r.exclusive)) rules = rules.filter(r => r.exclusive);
        const mutable = new Set(rules.flatMap(r => (typeof r.fields === 'function' ? r.fields(c, old) : r.fields)));
        for (const r of rules) {
            used.add(r.id);
            assert.ok(r.check(now, old, c), `[${r.id}] ${keyOf(c)}\nnow=${JSON.stringify(now)}\nold=${JSON.stringify(old)}`);
        }
        for (const f of Object.keys(old))
            if (!mutable.has(f)) assert.deepEqual(now[f], old[f], `${f} 不應改變：${keyOf(c)}`);
    }
    for (const r of RULES) assert.ok(used.has(r.id), `規則 ${r.id} 未命中任何案例`);
});
