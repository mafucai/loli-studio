/* DOM 契约检查：动作层读取的 data-* 属性，渲染层是否真的输出了？
 * 动机：断言全绿 ≠ 按钮能用。若动作读 data-color 而渲染没写，用户点了就是空值/报错。
 * 这是 flow-walkthrough.js 的第二层（后者只查「有没有处理函数」，不查「参数对不对」）。
 */
const fs = require('fs'), path = require('path');
const CORE = path.join(__dirname, '..', 'prototype/js/core');
const SRC = {};
fs.readdirSync(CORE).filter(f => f.endsWith('.js') && !f.includes('bak'))
  .forEach(f => { SRC[f] = fs.readFileSync(path.join(CORE, f), 'utf8'); });

const CLS = {
  action: /actions?\.js$|settings\.js$/,
  // 视图输出 = render* 文件 + settings.js（它也用 innerHTML 渲染按钮，
  // 如 showModelPanel 里的 data-act="pick-model" data-name）。只看 render* 会漏。
  view: /^render|settings\.js$/
};

console.log('=== 1. 动作读的 data-* 属性 → 渲染是否输出 ===\n');

// 收集：每个动作读的属性
const reads = [];   // {file, act, attr}
for (const f of Object.keys(SRC)) {
  if (!CLS.action.test(f)) continue;
  const src = SRC[f];
  // 按 ACT["x"] = ... 切块
  const blocks = src.split(/ACT\["/).slice(1);
  for (const b of blocks) {
    const name = b.slice(0, b.indexOf('"'));
    const body = b.slice(0, b.indexOf('\n  ACT[') >= 0 ? b.indexOf('\n  ACT[') : b.length);
    const attrs = new Set();
    let m, re = /getAttribute\("(data-[a-z-]+)"\)/g;
    while ((m = re.exec(body))) attrs.add(m[1]);
    re = /dataset\.([a-zA-Z]+)/g;
    while ((m = re.exec(body))) attrs.add('data-' + m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase()));
    re = /querySelector\("\[?(data-[a-z-]+)[\]=]/g;
    while ((m = re.exec(body))) attrs.add(m[1]);
    attrs.forEach(a => reads.push({ file: f, act: name, attr: a }));
  }
}

// 收集：渲染层输出的属性
// 注意：HTML 里 data-* 有两种写法 —— 带值 `data-x="v"` 与**无值属性** `data-x`（bool 型）。
// 后者前面通常是空格、后面是空格或 '>'，不能只匹配 `=`。
const writes = new Set();
for (const f of Object.keys(SRC)) {
  if (!CLS.view.test(f)) continue;
  const src = SRC[f];
  let m;
  let re = /\b(data-[a-z-]+)\s*=/g;               // 带值
  while ((m = re.exec(src))) writes.add(m[1]);
  re = /[\s"'](data-[a-z-]+)(?=[\s>])/g;          // 无值（bool）属性
  while ((m = re.exec(src))) writes.add(m[1]);
}
// 动作层/视图层里 JS 动态设置 dataset 的也算输出
for (const f of Object.keys(SRC)) {
  let m, re = /setAttribute\("(data-[a-z-]+)"/g;
  while ((m = re.exec(SRC[f]))) writes.add(m[1]);
}

console.log('渲染层输出的 data-* 属性：' + [...writes].sort().join(', '));
console.log('');

let missing = 0;
const seen = new Set();
for (const r of reads) {
  const key = r.attr + '|' + r.act;
  if (seen.has(key)) continue;
  seen.add(key);
  // 该属性是否被任何视图输出
  const out = writes.has(r.attr);
  // 或者它其实是 JS 自己创建的容器（如 realno-box 由视图渲染）
  if (!out) {
    missing++;
    console.log(`❌ ${r.act} 读 ${r.attr}，但渲染层从未输出该属性`);
  }
}
if (!missing) console.log('✅ 动作读取的所有 data-* 属性，渲染层都有输出');

// === 2. 动作需要的属性，界面是否至少渲染过一次 ===
// 说明：不检查「同一个标签上」（如 set-realno 的按钮在 data-realno-box 容器**内部**，
// 属性在父级 —— 事件委派靠 el.closest 找容器，这是有意设计）。只查「有没有渲染出来」。
console.log('\n=== 2. 动作所需属性在界面是否渲染过 ===\n');
const need = {};
for (const r of reads) (need[r.act] = need[r.act] || new Set()).add(r.attr);

const btnProblems = [];
for (const [act, attrs] of Object.entries(need)) {
  for (const a of attrs) {
    if (!writes.has(a)) btnProblems.push(`data-act="${act}" 需要 ${a}，但界面从未渲染该属性`);
  }
}
if (btnProblems.length) btnProblems.forEach(p => console.log('❌ ' + p));
else console.log('✅ 所有动作所需属性界面都有渲染');

// === 3. data-act 名单 vs 实际渲染点 ===
console.log('\n=== 3. 动作定义 vs 界面入口（孤立动作 = 写了没人用）===\n');
const defined = new Set();
for (const f of Object.keys(SRC)) {
  let m, re = /ACT\["([^"]+)"\]/g;
  while ((m = re.exec(SRC[f]))) defined.add(m[1]);
}
const rendered = new Set();
for (const f of Object.keys(SRC)) {
  if (!CLS.view.test(f)) continue;
  let m, re = /data-act="([^"]+)"/g;
  while ((m = re.exec(SRC[f]))) rendered.add(m[1]);
}
// index.html 里的静态按钮也算界面入口（如 ep-add / close-sheet / fetch-models）
const INDEX = path.join(__dirname, '..', 'prototype/index.html');
if (fs.existsSync(INDEX)) {
  let m, re = /data-act="([^"]+)"/g;
  const html = fs.readFileSync(INDEX, 'utf8');
  while ((m = re.exec(html))) rendered.add(m[1]);
}
// JS 里 Actions.run("x") 也算入口（如 main.js 把 badge-mock 绑到 open-settings）
for (const f of Object.keys(SRC)) {
  let m, re = /Actions\.run\("([^"]+)"/g;
  while ((m = re.exec(SRC[f]))) rendered.add(m[1]);
}
const orphanActs = [...defined].filter(a => !rendered.has(a));
console.log('已定义动作 ' + defined.size + ' 个；界面渲染入口 ' + rendered.size + ' 个');
if (orphanActs.length) {
  console.log('⚠️ 定义了但界面无入口（可能是路由分发用的，需人工确认）：');
  orphanActs.forEach(a => console.log('   · ' + a));
} else console.log('✅ 无孤立动作');

console.log('\n——— 汇总 ———');
console.log('缺属性：' + missing + ' | 按钮缺参数：' + btnProblems.length + ' | 孤立动作：' + orphanActs.length);
