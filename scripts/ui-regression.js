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
  "render-extra.js":  "js/core/render-extra.js",
  "settings.js":      "js/core/settings.js",
  "vote-actions.js":  "js/core/vote-actions.js",
  "final-actions.js": "js/core/final-actions.js",
  "word-actions.js":  "js/core/word-actions.js",
  "render-vote.js":   "js/core/render-vote.js",
  "order-model.js":   "js/core/order-model.js",
  "pre-actions.js":   "js/core/pre-actions.js",
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
var codeOnly = (src["render.js"] + "\n" + src["render-extra.js"]).split("\n")
  .filter(function (l) {
    var t = l.trim();
    return t && !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*/");
  })
  .join("\n");
assert(!/document\./.test(codeOnly), "1. 渲染层无 document.（含 code 行）");

// 2. localStorage 只在 store.js
["factory.js","render.js","render-extra.js","ai.js","router.js","settings.js","vote-actions.js","final-actions.js","pre-actions.js","word-actions.js","actions.js","main.js","order-model.js"].forEach(function (f) {
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

// 5. 全部步骤注册（0 企划 + 原九步）
["plan","word","img","vote","part","check","buy","look","model","fact","cost","final","pre"].forEach(function (id) {
  assert(new RegExp("registerPage\\([\"']" + id + "[\"']").test(src["main.js"]),
    "5. main.js 注册视图 " + id);
});

// 6. Router.STEPS 有 10 步
var stepsCount = (src["router.js"].match(/\{ id: "/g) || []).length;
assert(stepsCount === 13, "6. Router.STEPS 恰好 13 步（实际 " + stepsCount + "）");

// 7. 所有 data-act 都有对应处理函数
var acts = {};
var m;
var regex = /\bACT\["([^"]+)"\]\s*=/g;
while ((m = regex.exec(src["actions.js"]))) acts[m[1]] = true;
// 设置相关动作已拆到 settings.js；图透拆到 vote-actions.js；定样拆到 final-actions.js
while ((m = regex.exec(src["settings.js"]))) acts[m[1]] = true;
while ((m = regex.exec(src["vote-actions.js"]))) acts[m[1]] = true;
while ((m = regex.exec(src["final-actions.js"]))) acts[m[1]] = true;
while ((m = regex.exec(src["word-actions.js"]))) acts[m[1]] = true;
while ((m = regex.exec(src["pre-actions.js"]))) acts[m[1]] = true;
// 收集 render 里出现的所有 data-act
var usedActs = {};
var r2 = /data-act="([^"]+)"/g;
while ((m = r2.exec(src["render.js"]))) usedActs[m[1]] = true;
while ((m = r2.exec(src["render-extra.js"]))) usedActs[m[1]] = true;
while ((m = r2.exec(src["render-vote.js"]))) usedActs[m[1]] = true;
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
["render.js","render-extra.js","factory.js","ai.js","router.js","settings.js","actions.js","main.js"].forEach(function (f) {
  assert(!/loli-studio\.designs\.v1/.test(src[f]) && !/loli-studio\.cfg\.v1/.test(src[f]),
    "9. " + f + " 不直接引用存储键名");
});

// 10. 加载顺序依赖：index.html 加载顺序为 router→ai→factory→store→render→actions→main
var htmlScripts = (src["index.html"].match(/src="([^"]+)"/g) || [])
  .map(function (s) { return s.match(/src="([^"]+)"/)[1]; });
var expected = ["js/core/router.js","js/core/ai.js","js/core/factory.js","js/core/order-model.js","js/core/store.js","js/core/render.js","js/core/render-vote.js","js/core/render-extra.js","js/core/settings.js","js/core/vote-actions.js","js/core/final-actions.js","js/core/pre-actions.js","js/core/word-actions.js","js/core/actions.js","js/core/main.js"];
// 顺序：router, ai, factory 是纯模块无依赖；store 也不依赖；render 依赖 Router/AI；actions 依赖 Store/Router/AI；main 依赖全部
var orderIdx = {};
expected.forEach(function (e, i) { orderIdx[e] = i; });
var actualIdx = {};
htmlScripts.forEach(function (s, i) { actualIdx[s] = i; });
assert(htmlScripts.length === 15, "10a. index.html 加载 15 个脚本（实际 " + htmlScripts.length + "）");
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

// 15. 企划批（0 企划 / 柄图 / 避免词 / color 数组）
assert(/function vPlan\s*\(/.test(src["render-extra.js"]), "15a. 企划视图 vPlan 存在");
assert(/dat-act|data-act="pick-theme"/.test(src["render-extra.js"]), "15b. 企划页有选主题动作");
assert(/data-act="gen-prints"/.test(src["render-extra.js"]), "15c. 企划页有生成柄图动作");
assert(/data-act="pick-print"/.test(src["render-extra.js"]), "15d. 企划页有选柄图动作");
assert(/data-act="save-avoid"/.test(src["render.js"]), "15e. 设计词页有保存避免词动作");
["pick-theme","gen-prints","pick-print","save-avoid"].forEach(function (a) {
  assert(acts[a] === true, "15f. 企划动作存在: " + a);
});
// 柄图未选不能进设计词：企划页 nextBtn 只在 picks 非空时输出
assert(/picks\.length\)\s*\{\s*body \+= [\s\S]{0,200}?nextBtn\("word"/.test(src["render-extra.js"]),
  "15g. 柄图未选时不给「下一步 · 设计词」");
// 避免词/主题/柄图真的进 prompt：actions 里调用 buildWordPrompt
assert(/AI\.buildWordPrompt\(/.test(src["word-actions.js"]), "15h. gen-words 调用 buildWordPrompt");
assert(/avoid:\s*avoid/.test(src["word-actions.js"]), "15i. 避免词传入 prompt");
assert(/theme:\s*theme/.test(src["word-actions.js"]), "15j. 主题传入 prompt");
// color 数组：工厂函数存在
assert(/function toColors\s*\(/.test(src["factory.js"]), "15k. factory.toColors 存在");
assert(/global\.Factory[\s\S]{0,400}?toColors:\s*toColors/.test(src["factory.js"]), "15l. toColors 已导出");
assert(/color:\s*\[pick\(COLOR\)\]/.test(src["factory.js"]), "15m. designWords 的 color 是数组");
assert(/function colors\s*\(/.test(src["render.js"]), "15n. 渲染层有 color 兼容函数");
// 不写死步骤字面量：用 Router.prevId 取相邻步
assert(!/ORDER\.indexOf/.test(src["render.js"]), "15o. 渲染层不再写死 ORDER 数组");

// 16b. R8：脚本禁止硬编码绝对路径（D7 教训 —— 本地 pwd 恰好命中，CI 必炸）
var fsWalk = require("fs").readdirSync(path.join(__dirname));
var badPath = [];
fsWalk.filter(function (n) { return /\.js$/.test(n); }).forEach(function (n) {
  var p = path.join(__dirname, n);
  var code = fs.readFileSync(p, "utf8");
  // 只看字符串字面量里的绝对路径（排除注释行）
  code.split("\n").forEach(function (line, i) {
    var t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    // 只禁「指向某台特定机器目录结构」的路径；/tmp/ 是正当的临时输出，不禁
    if (/["']\/(workspace|home|Users)\//.test(line)) badPath.push(n + ":" + (i + 1));
  });
});
assert(badPath.length === 0,
  "16b. R8 脚本无硬编码绝对路径" + (badPath.length ? " → " + badPath.join(", ") : ""));

// 16. color 数组化：不在源码里做正则扫描（容易误报），改由 backcompat-test.js 实测。
//     这里只断言「兼容函数存在且被导出」，实测交给 backcompat-test.js（含 undefined 串检查）。
assert(/function toColors\s*\(/.test(src["factory.js"]) && /toColors:\s*toColors/.test(src["factory.js"]),
  "16a. factory.toColors 定义并导出");
assert(/function colors\s*\(/.test(src["render.js"]), "16d. render 层有 color 兼容函数");
assert(/function toColorsStr\s*\(/.test(src["ai.js"]) || /toColors/.test(src["ai.js"]),
  "16c. ai.js 有 color 兼容转换");


// 17. 批 C：图透投票 + 改版留痕
assert(/function vVote\s*\(/.test(src["render-vote.js"]), "17a. 图透视图 vVote 存在");
["start-version","switch-version","vote","save-vote","pick-reason","revise-img"].forEach(function (a) {
  assert(acts[a] === true, "17b. 图透动作存在: " + a);
});
assert(/data-act="switch-version"/.test(src["render-vote.js"]), "17c. 版本缩略图可切换");
assert(/data-act="revise-img"/.test(src["render-vote.js"]), "17d. 改版入口存在");
// 改版必须填原因
assert(/改版必须填原因/.test(src["vote-actions.js"]), "17e. 改版强制填原因");
// versions 只增不删：pushVersion 用 slice 复制，且无 splice/pop/shift
assert(/function pushVersion\s*\(/.test(src["factory.js"]), "17f. pushVersion 存在");
var pv = (src["factory.js"].match(/function pushVersion[\s\S]*?\n  \}/) || [""])[0];
assert(pv.indexOf("slice()") >= 0, "17g. pushVersion 复制原数组（不改原引用）");
assert(!/splice|\bpop\(|\bshift\(/.test(pv), "17h. pushVersion 不删旧版本");
// 步骤文案不再写死
assert(!/共 9 步/.test(src["render.js"]), "17i. 渲染层不再写死「共 9 步」");
assert(/function stepLabel\s*\(/.test(src["render.js"]), "17j. 步骤文案从 Router.STEPS 动态取");


// 18. 批 D：定样定价
assert(/function vFinal\s*\(/.test(src["render-extra.js"]), "18a. 定样视图 vFinal 存在");
assert(acts["run-final"] === true, "18b. 定样动作 run-final 存在");
assert(/function buildSkus\s*\(/.test(src["factory.js"]), "18c. buildSkus 存在");
assert(/function financeFinal\s*\(/.test(src["factory.js"]), "18d. financeFinal 存在");
assert(/DEFAULT_TARGET\s*=\s*1000/.test(src["factory.js"]), "18e. 默认成团件数 1000");
assert(/DEFAULT_DEPOSIT_RATE/.test(src["factory.js"]), "18f. 默认定金比例存在");
// SKU 输入用 data-sku（不是 data-act，避免与动作系统混淆）
assert(/data-sku="/.test(src["render-extra.js"]), "18g. SKU 输入用 data-sku");
assert(!/data-act="set-target"/.test(src["render-extra.js"]), "18h. 未把 SKU 输入伪装成动作");
// cost 页不动（方案 B）
assert(/cost-fee/.test(src["render.js"]) && /cost-price/.test(src["render.js"]),
  "18i. cost 页原有输入未被移除（方案 B：cost 不动）");
// 定样页读的是 finance.cost（成本页结果），不是自己重算
assert(/d\.finance\.cost|finance\.cost/.test(src["final-actions.js"]), "18j. 定样引用成本页结果");


// 19. R3 落地：render-extra.js 若调用 render.js 的内部函数，必须走 R.xxx
//     或被本文件的同名 wrapper 包住。裸引用会在运行时 ReferenceError（D2/D8 同类）。
(function () {
  var extra = src["render-extra.js"];
  var code = extra.split("\n").filter(function (l) {
    var t = l.trim(); return t && !t.startsWith("*") && !t.startsWith("//");
  }).join("\n");
  // 本文件自己定义为 wrapper 的函数名（function xxx(...) { return R.xxx(...) }）——视为已包装
  var wrapped = {};
  var wr = /function\s+(\w+)\s*\([^)]*\)\s*\{\s*return\s+R\.\w+/g, w;
  while ((w = wr.exec(code)) !== null) wrapped[w[1]] = true;
  var internals = ["screen", "stepLabel", "dots", "pageBar"];
  var offenders = [];
  internals.forEach(function (fn) {
    if (wrapped[fn]) return;                                  // 有 wrapper，安全
    var re = new RegExp("(^|[^\\w.])" + fn + "\\s*\\(", "g"), m;
    while ((m = re.exec(code)) !== null) {
      var prefix = code.slice(Math.max(0, m.index - 12), m.index + m[1].length);
      if (/function\s*$/.test(prefix)) continue;              // 正在定义（非调用）
      offenders.push(fn);
      break;
    }
  });
  assert(offenders.length === 0,
    "19. render-extra.js 调用 render.js 内部函数时走了 wrapper/R." +
    (offenders.length ? " → 裸用: " + offenders.join(",") : ""));
})();


// 20. 批 E1：预售开团 + 订单模型（含 §一 隐私硬约束）
assert(/function vPre\s*\(/.test(src["render-extra.js"]), "20a. 预售视图 vPre 存在");
["open-pre","add-orders"].forEach(function (a) { assert(acts[a] === true, "20b. 预售动作存在: " + a); });
assert(/function registerPre\s*\(/.test(src["pre-actions.js"]), "20c. pre-actions 已注册");
assert(/function openPre\s*\(/.test(src["order-model.js"]), "20d. openPre 存在");
assert(/function parseOrderLines\s*\(/.test(src["order-model.js"]), "20e. 批量解析 parseOrderLines 存在");
assert(/function tallyByBatch\s*\(/.test(src["order-model.js"]), "20f. 按颜色×批次统计存在");
// §一 隐私硬约束：订单结构里不许出现身份字段
var omCode = src["order-model.js"].split("\n").filter(function (l) {
  var t = l.trim(); return t && !t.startsWith("*") && !t.startsWith("//");
}).join("\n");
["name","phone","tel","address","addr","buyer"].forEach(function (bad) {
  assert(!new RegExp(bad + "\\s*:", "i").test(omCode), "20g. 订单模型无身份字段: " + bad);
});
// 真单号默认空 + 只有三个动作能读
assert(/realNo:\s*""/.test(src["order-model.js"]), "20h. realNo 默认空");
assert(/REALNO_ACTS\s*=\s*\[[^\]]*发货[^\]]*退款[^\]]*对账/.test(src["order-model.js"]),
  "20i. 真单号限「发货/退款/对账」三个动作");
// 状态机写死且可校验
assert(/ORDER_FLOW\s*=\s*\{/.test(src["order-model.js"]), "20j. 订单状态机存在");
assert(/function canTransit\s*\(/.test(src["order-model.js"]), "20k. 非法流转校验存在");
// 默认成团数单一定义源（不许两处各写一份）
var omDefs = (src["order-model.js"].match(/DEFAULT_TARGET\s*=\s*1000/g) || []).length;
var fcDefs = (src["factory.js"].match(/DEFAULT_TARGET\s*=\s*1000/g) || []).length;
assert(omDefs === 0 && fcDefs === 1, "20l. DEFAULT_TARGET 只在 factory.js 定义一次");
assert(/global\.Factory\.DEFAULT_TARGET/.test(src["order-model.js"]), "20m. order-model 从 Factory 取默认值");


// 21. 批 E2：成团判定 + 流团退款
["judge-pre","build-refund","mark-refunded","apply-design-state"].forEach(function (a) {
  assert(acts[a] === true, "21a. 成团判定动作存在: " + a);
});
assert(/function judgePre\s*\(/.test(src["order-model.js"]), "21b. judgePre 存在");
assert(/function buildRefundList\s*\(/.test(src["order-model.js"]), "21c. 退款清单生成存在");
assert(/function isDue\s*\(/.test(src["order-model.js"]), "21d. 到期判断存在");
assert(/DESIGN_FLOW\s*=\s*\{/.test(src["order-model.js"]), "21e. 款状态机存在");
assert(/function canTransitDesign\s*\(/.test(src["order-model.js"]), "21f. 款状态流转校验存在");
// 款状态机与订单状态机必须是两套（文档 §二/§三 分开）
assert(/ORDER_FLOW\s*=/.test(src["order-model.js"]) && /DESIGN_FLOW\s*=/.test(src["order-model.js"]),
  "21g. 款状态机与订单状态机分开");
// 判定结果要含 partial（部分成团，§四 A 策略）
assert(/partial:/.test(src["order-model.js"]), "21h. 判定结果含 partial");
// 预售页必须写明分色成团提示（文档 §四 硬要求）
assert(/分色成团/.test(src["render-extra.js"]) && /退还该色定金/.test(src["render-extra.js"]),
  "21i. 预售页写明分色成团与退定金");
// App 不自动退款：清单只是清单
assert(/App 不收款也不自动退款/.test(src["render-extra.js"]), "21j. 明确 App 不自动退款");

console.log("\n——— 结果 ———");
console.log("✅ 通过 " + ok + " 项  ❌ 失败 " + fail + " 项");
process.exit(fail === 0 ? 0 : 1);
