'use strict';
// sw.js：以 fake ServiceWorkerGlobalScope 驗證 install 預快取與 activate 只清本工具舊 cache。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./helpers/dom');

function loadSW(existingKeys) {
    const handlers = {};
    const stores = new Map(existingKeys.map(k => [k, []]));
    const caches = {
        open: async k => { if (!stores.has(k)) stores.set(k, []); return { addAll: async a => { stores.get(k).push(...a); } }; },
        keys: async () => [...stores.keys()],
        delete: async k => stores.delete(k),
    };
    const self = {
        addEventListener: (t, fn) => { handlers[t] = fn; },
        skipWaiting: async () => {}, clients: { claim: async () => {} },
        location: { origin: 'https://liangrxdev.github.io' },
    };
    const ctx = { self, caches, fetch: async () => ({ ok: true }) };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8') + '\n;this.__CACHE = CACHE; this.__ASSETS = ASSETS;', ctx);
    const fire = async type => { let p; handlers[type]({ waitUntil: x => { p = x; } }); await p; };
    return { ctx, stores, fire };
}

// 版本號每次動 shell 檔都會升，測試不寫死，只鎖格式
const CURRENT = loadSW([]).ctx.__CACHE;
const CURRENT_N = Number((/^kdigo-aki-v(\d+)$/.exec(CURRENT) || [])[1]);

test('sw：CACHE 格式為 kdigo-aki-vN（N ≥ 5）', () => {
    assert.ok(CURRENT_N >= 5, CURRENT);
});

test('sw：install 預快取 index.html 引用的本地 script 與 manifest 圖示', async () => {
    const sw = loadSW([]);
    await sw.fire('install');
    const cached = sw.stores.get(sw.ctx.__CACHE);
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const srcs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => './' + m[1]);
    assert.ok(srcs.includes('./js/calc.js'));
    const icons = require(path.join(ROOT, 'manifest.json')).icons.map(i => './' + i.src);
    for (const a of ['./index.html', './manifest.json', ...srcs, ...icons]) assert.ok(cached.includes(a), a);
    for (const a of cached) assert.ok(fs.existsSync(path.join(ROOT, a)), `ASSETS 指向不存在檔案 ${a}`);
});

test('sw：activate 只刪 kdigo-aki- 前綴的舊版，不動其他工具 cache', async () => {
    const others = ['other-tool-v1', 'kdigo-akd-v1', 'kdigo-aki', 'vanco-tdm-v9'];
    const olds = Array.from({ length: CURRENT_N - 1 }, (_, i) => `kdigo-aki-v${i + 1}`);
    const sw = loadSW([...olds, CURRENT, ...others]);
    await sw.fire('activate');
    assert.deepEqual([...sw.stores.keys()].sort(), [CURRENT, ...others].sort());
});
