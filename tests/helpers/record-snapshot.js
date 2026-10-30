// 一次性：以「重構前」的 index.html 錄製 characterization snapshot。
// 用法：node tests/helpers/record-snapshot.js > tests/fixtures/characterization.json
'use strict';
const { loadPage } = require('./dom');
const { buildCases, keyOf } = require('./cases');
const out = {};
for (const c of buildCases()) {
    const page = loadPage(); // 每案獨立頁面，避免前案殘留
    page.run(c);
    out[keyOf(c)] = page.compact();
}
process.stdout.write('{\n' + Object.entries(out).map(([k, v]) => JSON.stringify(k) + ':' + JSON.stringify(v)).join(',\n') + '\n}' + '\n');
