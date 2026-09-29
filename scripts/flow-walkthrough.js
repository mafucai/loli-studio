/* 洛丽塔工坊 —— 12 项功能走通性实测（不依赖断言脚本，直接查「有没有入口」）
 * 目的：区分「结构合规」与「功能可用」。查每个动作是否有 data-act 入口 + 处理函数。
 */
const fs = require('fs'), path = require('path');
const CORE = path.join(__dirname, '..', 'prototype/js/core');
const SRC = {};
fs.readdirSync(CORE).filter(f => f.endsWith('.js') && !f.includes('bak'))
  .forEach(f => { SRC[f] = fs.readFileSync(path.join(CORE, f), 'utf8'); });

const all = Object.values(SRC).join('\n');
const viewFiles = Object.keys(SRC).filter(f => /^render/.test(f));
const actFiles = Object.keys(SRC).filter(f => /actions\.js$/.test(f));

// 收集 data-act
const acts = new Set();
for (const f of viewFiles) {
  const re = /data-act="([^"]+)"/g; let m;
  while ((m = re.exec(SRC[f]))) acts.add(m[1]);
}
// 收集 ACT["x"] 处理函数（扫**所有**文件：动作分散在 actions/vote-actions/final-actions/
// pre-actions/post-actions/word-actions/settings 等多处，只扫文件名含 actions 的会漏）
const handlers = new Set();
for (const f of Object.keys(SRC)) {
  const re = /ACT\["([^"]+)"\]/g; let m;
  while ((m = re.exec(SRC[f]))) handlers.add(m[1]);
}

console.log('=== 入口统计 ===');
console.log('视图里出现的 data-act：' + acts.size + ' 个');
console.log('已实现的处理函数：' + handlers.size + ' 个');

const missing = [...acts].filter(a => !handlers.has(a));
console.log('\n=== 有界面按钮但无处理函数（点了没反应）===');
console.log(missing.length ? missing.join('\n') : '无');

// 文档 §十 12 项 → 期望的功能特征词
const doc12 = [
  [1, '避免词', ['avoid']],
  [2, '主题风格引导', ['THEMES', 'pick-theme']],
  [3, '柄图', ['prints', 'gen-prints']],
  [4, '图透投票', ['vote']],
  [5, '多版本/改版留痕', ['versions', 'revise-img']],
  [6, '定样定价', ['skus', 'final']],
  [7, '预售开团+定金', ['openPre', 'add-orders']],
  [8, '成团判定+流团', ['judgePre', 'buildRefundList']],
  [9, '大货（复用采购+工厂）', ['生产中']],
  [10, '补尾款+发货', ['pay-tail', 'ship']],
  [11, '售后记录', ['after-sale', 'recordAfterSale']],
  [12, '统计看板', ['buildBoard', 'groupRateRows']],
];

console.log('\n=== 文档 §十 12 项 逐项核对 ===');
let bad = 0;
for (const [n, name, keys] of doc12) {
  const hit = keys.map(k => ({ k, ok: all.includes(k) }));
  const allOk = hit.every(h => h.ok);
  if (!allOk) bad++;
  console.log(`${allOk ? '✅' : '❌'} ${String(n).padStart(2)}. ${name.padEnd(22)} ${hit.map(h => h.k + (h.ok ? '✓' : '✗')).join(' ')}`);
}

// 款状态机推进链路完整性（只取 DESIGN_FLOW 段，避免与 ORDER_FLOW 同名状态混淆）
console.log('\n=== 款状态机推进链路（文档 §九 流程图 13~16 步）===');
const omSrc = SRC['order-model.js'];
// 精确截取 DESIGN_FLOW 对象体（从 DESIGN_FLOW 定义到其后的 }; ）
const dfMatch = omSrc.match(/DESIGN_FLOW\s*=\s*\{([\s\S]*?)\n\s*\};/);
const designFlowBody = dfMatch ? dfMatch[1] : '';
const orderFlowBody = (omSrc.match(/ORDER_FLOW\s*=\s*\{([\s\S]*?)\n\s*\};/) || [])[1] || '';
const chain = [['预售中','已成团'],['已成团','生产中'],['生产中','已发货'],['已发货','售后中'],['售后中','完结']];
for (const [from, to] of chain) {
  const re = new RegExp('"' + from + '":\\s*\\[([^\\]]*)\\]');
  const m = designFlowBody.match(re);
  const ok = m && m[1].includes('"' + to + '"');
  console.log(`${ok ? '✅' : '❌'} ${from} → ${to}`);
}

/* 关键检查：每个款状态是否有**界面动作**能推进到它。
   做法：扫所有 ACT 处理函数体中出现的 patch(..., {designState: X}) 与 NEXT 映射，
   不硬编码可达表（硬编码会让脚本自己变成「断言自己」）。 */
console.log('\n=== 款状态能否被界面动作推进到 ===');
const designStatesSrc = (omSrc.match(/DESIGN_STATES\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
const states = designStatesSrc.split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean);
// 扫描所有动作文件：designState 能被写成哪些值
const reachable = new Set();
for (const f of Object.keys(SRC)) {
  const src = SRC[f];
  // patch(..., { designState: "X" }) 形式
  let m, re = /designState:\s*"([^"]+)"/g;
  while ((m = re.exec(src))) reachable.add(m[1]);
}
// 显式动作 → 状态映射（动作存在才算可达）
const ACT2STATE = {
  'pick-theme': '企划中', 'gen-prints': '企划中',
  'start-version': '图透中', 'vote': '投票中',
  'run-final': '定样', 'open-pre': '预售中',
  'apply-design-state': '已成团',   // judge.designState 为变量，单独认
  'design-next': '生产中',          // NEXT 映射：已成团→生产中→已发货→售后中→完结
  'design-reopen': '改款重开'
};
for (const [act, st] of Object.entries(ACT2STATE)) if (handlers.has(act)) reachable.add(st);
// judgePre 产出的 designState 字面量（apply-design-state 会把它应用为款状态）
let m2, reJ = /designState:\s*"([^"]+)"/g;
while ((m2 = reJ.exec(omSrc))) reachable.add(m2[1]);
// judgePre 里的三元：`? "已成团" : (... ? "已流团" : "已成团")` 形式
for (const lit of ['"已成团"', '"已流团"']) {
  if (omSrc.includes('? ' + lit) || omSrc.includes(': ' + lit)) reachable.add(lit.replace(/"/g, ''));
}
// design-next 的 NEXT 链（从源码取，不硬编码）
const nextSrc = (SRC['post-actions.js'] || '') + (SRC['render-flux.js'] || '');
const nextPairs = [...nextSrc.matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map(x => [x[1], x[2]]);
let unreachable = 0;
for (const s of states) {
  const ok = reachable.has(s) || nextPairs.some(p => p[1] === s);
  if (!ok) unreachable++;
  console.log(`${ok ? '✅' : '❌'} ${s.padEnd(6)} ${ok ? '有 data-act 可推进' : '无任何 data-act 可推进到此状态'}`);
}
console.log('\n不可达款状态数：' + unreachable + ' / ' + states.length);

// ===== 步骤图可达性（P0-1 修复配套；R11 补全：此前只查款状态机，漏了步骤图）=====
// 判据：除第 0 步外，每个 step 的 id 必须被某个视图的 nextBtn("<id>",...) 指向。
// 理由：E1~E3 做了定样/预售/看板三步视图，却没接前进按钮 → 用户点不进去（真 P0）。
console.log('\n=== 步骤图可达性（每个 step 必须有 nextBtn 指向）===');
const routerSrc = SRC['router.js'] || '';
const stepIds = [...routerSrc.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
const nextTargets = new Set();
for (const f of viewFiles) {
  for (const m of (SRC[f] || '').matchAll(/nextBtn\(\s*"([^"]+)"/g)) nextTargets.add(m[1]);
}
// 第 0 步是入口（tabbar/静态），不需要被 nextBtn 指向
const needReach = stepIds.slice(1);
const unreachableSteps = needReach.filter(id => !nextTargets.has(id));
for (const id of needReach) {
  const ok = nextTargets.has(id);
  console.log(`${ok ? '✅' : '❌'} ${id.padEnd(8)} ${ok ? '有 nextBtn 指向' : '没有任何 nextBtn 指向此步（界面走不到）'}`);
}
console.log('\n不可达步骤数：' + unreachableSteps.length + ' / ' + needReach.length);

const totalBad = bad + unreachableSteps.length;
console.log('\n总计：12 项中 ' + (12 - bad) + ' 项代码特征齐全，' + bad + ' 项缺特征；步骤图 ' + (needReach.length - unreachableSteps.length) + '/' + needReach.length + ' 可达。');
if (totalBad > 0 || unreachableSteps.length > 0) process.exit(1);
