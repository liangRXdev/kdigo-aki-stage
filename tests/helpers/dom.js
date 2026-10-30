// 極簡 fake DOM：載入 index.html 的 <script>（含 src 外部檔）於 vm 內執行，
// 只模擬本工具用到的 API（getElementById / querySelector(All) / value / checked /
// style.display / innerHTML / alert / clipboard），不引入任何外部相依。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');

function parseInlineDisplay(attrs) {
    const m = /style="[^"]*display:\s*([a-z]+)/i.exec(attrs);
    return m ? m[1] : '';
}

function makeElement(tag, attrs, registry) {
    const typeM = /type="([^"]+)"/.exec(attrs);
    const el = {
        tagName: tag.toUpperCase(),
        type: typeM ? typeM[1] : '',
        value: '',
        checked: false,
        innerText: '',
        style: { display: parseInlineDisplay(attrs) },
        _children: [],
        addEventListener() {},
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
        get: () => html,
        set: v => {
            html = String(v);
            // 移除舊的動態子元素，再登錄新的 <input id=...>
            el._children.forEach(id => registry.delete(id));
            el._children = [];
            const re = /<(input|select)\b([^>]*)\bid="([^"]+)"([^>]*)>/g;
            let m;
            while ((m = re.exec(html))) {
                registry.set(m[3], makeElement(m[1], m[2] + m[4], registry));
                el._children.push(m[3]);
            }
        },
    });
    return el;
}

function loadPage() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const registry = new Map();
    const tagRe = /<([a-z]+)\b([^>]*)\bid="([^"]+)"([^>]*)>/g;
    let m;
    while ((m = tagRe.exec(html))) {
        if (m[1] === 'script') continue;
        registry.set(m[3], makeElement(m[1], m[2] + m[4], registry));
    }
    // <select> 預設值 = 第一個 <option>
    const selRe = /<select\b[^>]*id="([^"]+)"[^>]*>\s*<option value="([^"]*)"/g;
    while ((m = selRe.exec(html))) registry.get(m[1]).value = m[2];

    const alerts = [];
    const clipboard = [];
    const copyBtn = { innerHTML: '', style: {} };
    const document = {
        getElementById: id => registry.get(id) || null,
        querySelector: sel => (sel === '.btn-copy' ? copyBtn : null),
        querySelectorAll: sel => {
            const t = /input\[type="([^"]+)"\]/.exec(sel);
            return [...registry.values()].filter(e => e.tagName === 'INPUT' && t && e.type === t[1]);
        },
    };
    const context = {
        document,
        alert: msg => alerts.push(msg),
        navigator: { clipboard: { writeText: t => { clipboard.push(t); return { then: () => ({ catch() {} }) }; } } },
        window: { addEventListener() {}, location: { reload() {} } },
        setTimeout() {},
        console,
    };
    vm.createContext(context);

    const scriptRe = /<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g;
    while ((m = scriptRe.exec(html))) {
        const code = m[1] ? fs.readFileSync(path.join(ROOT, m[1]), 'utf8') : m[2];
        vm.runInContext(code, context, { filename: m[1] || 'index.html<inline>' });
    }

    const $ = id => registry.get(id);
    return {
        context, alerts, clipboard, $,
        fill(input) {
            const f = Object.assign({ baseScr: '', currScr: '', timeframe: '', isRRT: false,
                weight: '', uVol: '', uTime: '', biomarker: 'NotTested' }, input);
            for (const k of ['baseScr', 'currScr', 'timeframe', 'weight', 'uVol', 'uTime', 'biomarker']) $(k).value = String(f[k]);
            $('isRRT').checked = !!f.isRRT;
        },
        // 執行分析並擷取畫面與複製文字
        run(input) {
            this.fill(input);
            alerts.length = 0;
            context.calculateAKI();
            return this.snapshot();
        },
        snapshot() {
            clipboard.length = 0;
            context.copyResults();
            return {
                alert: alerts[alerts.length - 1] || null,
                visible: $('resultBox').style.display === 'block',
                resC: $('res-c').innerHTML,
                resU: $('res-u').innerHTML,
                badge: $('stageBadge').innerText,
                copy: clipboard[0] || null,
            };
        },
        // characterization 用：copy 文字以 hash 存，其餘欄位原文保存
        compact() {
            const s = this.snapshot();
            s.copy = s.copy === null ? null : crypto.createHash('sha256').update(s.copy).digest('hex').slice(0, 16);
            return s;
        },
    };
}

module.exports = { loadPage, ROOT };
