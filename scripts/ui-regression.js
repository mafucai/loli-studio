#!/usr/bin/env node
/* loli-studio · 调用蓝图断言（离线，不启 server）
 * 断言项：
 *  1. 渲染层不含 document.
 *  2. 存储键只在 store.js 出现
 *  3. 无 onclick= 拼接
 *  4. 单文件 ≤400 行
 *  5. 九步全部注册
 *  6. 动作路由完备（所有 data-act 都有对应处理）
 *  7. 事件委托只绑一次（main.js 里 bind 调用次数 vs 唯一容器数）
 *  8. factory 纯函数（无 DOM/localStorage）
 *  9. 存储键唯一事实源
 * 10. 加载顺序依赖
 * 退出码 0 = 通过，1 = 有失败
 */
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "..", "prototype");

var files = {
  "index.html":       "index.html",
  "styles.css":       "styles.css",
  "router.js":        "js/core/router.js",
  "ai.js":            "js/core/ai.js",
  "factory.js":       "js/core/factory.js",
  "store.js":         "js/core/store.js",
  "render.js":        "js/core/render.js",
  "actions.js":       "js/core/actions.js",
  "main.js":          "js/core/main.js"
};

var src = {};
var ok = 0, fail = 0;
function read(k) { return fs.readFileSync(path.join(ROOT, files[k]), "utf8"); }

function assert(cond, msg) {
  if (cond) { ok++; console.log("  ✅ " + msg); }
  else      { fail++; console.log("  ❌ " + msg); }
}

// 读文件
Object.keys(files).forEach(function (k) { src[k] = read(k); });

// 1. 渲染层禁 document.（含 code 行，排除注释）
var codeOnly = src["render.js"].split("\n")
  .filter(function (l) {
    var t = l.trim();
    return t && !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*/");
  })
  .join("\n");
assert(!/document\./.test(codeOnly), "1. 渲染层无 document.（含 code 行）");

// 2. localStorage 只在 store.js
["factory.js","render.js","ai.js","router.js","actions.js","main.js"].forEach(function (f) {
  // 排除注释
  var codeOnly = src[f].split("\n").filter(function (l) {
    var t = l.trim(); return t && !t.startsWith("*") && !t.startsWith("//");
  }).join("\n");
  assert(!/localStorage/.test(codeOnly), "2. " + f + " 无 localStorage 旁路");
});

// 3. 无 onclick= 拼接
["render.js","actions.js","main.js","index.html"].forEach(function (f) {
  assert(!new RegExp('onclick\\s*=', 'i').test(src[f]), "3. " + f + " 无 onclick= 拼接");
});

// 4. 单文件 ≤400 行
Object.keys(src).forEach(function (f) {
  var lines = src[f].split("\n").length;
  assert(lines <= 400, "4. " + f + " 行数 " + lines + " ≤ 400");
});

// 5. 九步全部注册
["word","img","part","check","buy","look","model","fact","cost"].forEach(function (id) {
  assert(new RegExp("registerPage\\([\"']" + id + "[\"']").test(src["main.js"]),
    "5. main.js 注册视图 " + id);
});

// 6. Router.STEPS 有 9 步
var stepsCount = (src["router.js"].match(/\{ id: "/g) || []).length;
assert(stepsCount === 9, "6. Router.STEPS 恰好 9 步（实际 " + stepsCount + "）");

// 7. 所有 data-act 都有对应处理函数
var acts = {};
var m;
var regex = /\bACT\["([^"]+)"\]\s*=/g;
while ((m = regex.exec(src["actions.js"]))) acts[m[1]] = true;
// 收集 render 里出现的所有 data-act
var usedActs = {};
var r2 = /data-act="([^"]+)"/g;
while ((m = r2.exec(src["render.js"]))) usedActs[m[1]] = true;
// 加上 main.js 里 run() 直接调用的
var r3 = /Actions\.run\("([^"]+)"/g;
while ((m = r3.exec(src["main.js"]))) usedActs[m[1]] = true;
Object.keys(usedActs).forEach(function (a) {
  assert(acts[a] === true, "7. data-act=\"" + a + "\" 在 actions.js 有处理");
});

// 8. factory 纯函数：无 DOM、无 localStorage
var factoryCode = src["factory.js"].split("\n").filter(function (l) {
  var t = l.trim(); return t && !t.startsWith("*") && !t.startsWith("//");
}).join("\n");
assert(!/document\./.test(factoryCode), "8a. factory 无 document.");
assert(!/localStorage/.test(factoryCode), "8b. factory 无 localStorage.");
assert(!/\.innerHTML/.test(factoryCode), "8c. factory 无 innerHTML.");

// 9. 存储键唯一事实源：Store 模块暴露 _keys
assert(/K_D\s*=\s*"loli-studio\.designs\.v1"/.test(src["store.js"]), "9a. Store 声明 K_D");
assert(/K_C\s*=\s*"loli-studio\.cfg\.v1"/.test(src["store.js"]),    "9b. Store 声明 K_C");
// 其他模块不含这两个键名字符串
["render.js","factory.js","ai.js","router.js","actions.js","main.js"].forEach(function (f) {
  assert(!/loli-studio\.designs\.v1/.test(src[f]) && !/loli-studio\.cfg\.v1/.test(src[f]),
    "9. " + f + " 不直接引用存储键名");
});

// 10. 加载顺序依赖：index.html 加载顺序为 router→ai→factory→store→render→actions→main
var htmlScripts = (src["index.html"].match(/src="([^"]+)"/g) || [])
  .map(function (s) { return s.match(/src="([^"]+)"/)[1]; });
var expected = ["js/core/router.js","js/core/ai.js","js/core/factory.js","js/core/store.js","js/core/render.js","js/core/actions.js","js/core/main.js"];
// 顺序：router, ai, factory 是纯模块无依赖；store 也不依赖；render 依赖 Router/AI；actions 依赖 Store/Router/AI；main 依赖全部
var orderIdx = {};
expected.forEach(function (e, i) { orderIdx[e] = i; });
var actualIdx = {};
htmlScripts.forEach(function (s, i) { actualIdx[s] = i; });
assert(htmlScripts.length === 7, "10a. index.html 加载 7 个脚本");
// render.js 必须在 router.js 后
assert(actualIdx["js/core/render.js"] > actualIdx["js/core/router.js"], "10b. render 在 router 后");
assert(actualIdx["js/core/render.js"] > actualIdx["js/core/ai.js"],     "10c. render 在 ai 后");
assert(actualIdx["js/core/actions.js"] > actualIdx["js/core/store.js"],"10d. actions 在 store 后");
assert(actualIdx["js/core/actions.js"] > actualIdx["js/core/factory.js"],"10e. actions 在 factory 后");
assert(htmlScripts[htmlScripts.length - 1] === "js/core/main.js", "10f. main.js 最后加载");

// 11. main.js 里 view/steps 事件委托各绑一次
var viewBindCount = (src["main.js"].match(/Actions\.bind\(viewEl/g) || []).length;
var stepsBindCount = (src["main.js"].match(/Actions\.bind\(stepsEl/g) || []).length;
assert(viewBindCount === 1, "11a. viewEl 只绑一次（实际 " + viewBindCount + "）");
assert(stepsBindCount === 1, "11b. stepsEl 只绑一次（实际 " + stepsBindCount + "）");

// 12. 关键动作齐全（业务链路）
["gen-words","gen-img","pass-img","gen-bom","run-check","mark-original",
 "run-sourcing","gen-combo","gen-model","run-factories","pick-fact","run-finance",
 "goto","next","history","open-history","open-settings","close-sheet"].forEach(function (a) {
  assert(acts[a] === true, "12. 业务动作存在: " + a);
});

// 13. 演示数据工厂函数齐全
["designWords","bom","dedup","sourcing","combo","look","model","factories","finance"].forEach(function (f) {
  assert(new RegExp("function " + f + "\\s*\\(").test(src["factory.js"]),
    "13. factory." + f + " 存在");
});

// 14. AI mock 有 imgDataUri（不依赖 CDN）
assert(/data:image\/svg\+xml/.test(src["ai.js"]), "14. AI.img 返回本地 SVG data URI，不依赖 CDN");

console.log("\n——— 结果 ———");
console.log("✅ 通过 " + ok + " 项  ❌ 失败 " + fail + " 项");
process.exit(fail === 0 ? 0 : 1);
