// 刻意修 bug 造成的 characterization 差異。每條規則：
//   match(c, old)  → 此案是否受該修正影響
//   check(now, old, c) → 回傳 true 表示新輸出符合預期
// 不屬於任何規則的案例，新輸出必須與 snapshot 完全一致。
'use strict';
module.exports = [];
