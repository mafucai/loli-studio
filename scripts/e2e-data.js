/* 端到端数据链路测试：模拟走完九步，验证每一步产出结构
 * 直接加载 factory.js + ai.js（纯模块，不依赖 DOM），
 * 顺序调用 Factory 的九个函数，断言关键字段存在且非空。
 * 断言：数据流能完整走通 = UI 层没有拿到 undefined。
 */
var path = require("path");
var fs = require("fs");
var vm = require("vm");

var ROOT = path.resolve(__dirname, "..", "prototype");
function load(rel) {
  var code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  return code;
}

// 模拟一个极简 window/global，让 IIFE 能跑
var fakeWindow = {};
var ctx = { window: fakeWindow, console: console, Date: Date, Math: Math, JSON: JSON, encodeURIComponent: encodeURIComponent };
vm.createContext(ctx);

// ai.js 依赖 window.AI；factory.js 依赖 window.AI；两者都是 IIFE(window)
var codeAI = load("js/core/ai.js");
var codeFactory = load("js/core/factory.js");
vm.runInContext(codeAI, ctx, { filename: "ai.js" });
vm.runInContext(codeFactory, ctx, { filename: "factory.js" });

var AI = fakeWindow.AI;
var Factory = fakeWindow.Factory;
if (!AI || !Factory) {
  console.error("❌ 加载失败：AI 或 Factory 未导出");
  process.exit(1);
}

var ok = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { ok++; console.log("  ✅ " + msg); }
  else      { fail++; console.log("  ❌ " + msg); }
}

// —— 模拟一条完整设计单流程 ——
console.log("【链路测试】设计词 → 出图 → 拆件 → 查重 → 采购 → 组合 → 模特 → 工厂 → 成本\n");

// step 1: 设计词
var words = Factory.designWords("雾霾蓝 英式下午茶 春夏薄款 甜美日常 蝴蝶结收腰");
assert(words && words.style,    "step1 设计词 · 风格：" + (words && words.style));
assert(words && words.color,    "step1 设计词 · 主色：" + (words && words.color));
assert(words && words.mainFabric,"step1 设计词 · 主面料：" + (words && words.mainFabric));
assert(words && words.details && words.details.length >= 3, "step1 设计词 · 细节数：" + (words && words.details && words.details.length));
assert(words && words.decors && words.decors.length >= 2,   "step1 设计词 · 装饰数：" + (words && words.decors && words.decors.length));
assert(words && words.sizes && words.sizes.length === 5,    "step1 设计词 · 5 个尺码");

// step 2: 出图
var imgUri = AI.img("dress", words.color + words.style, 360, 480);
assert(typeof imgUri === "string" && imgUri.startsWith("data:image/svg+xml"), "step2 出图 · 返回本地 SVG data URI（不依赖 CDN）");

// step 3: 拆件 BOM
var bom = Factory.bom(words);
assert(bom && bom.rows && bom.rows.length >= 8,      "step3 BOM · 零件行数：" + (bom && bom.rows && bom.rows.length));
assert(bom && typeof bom.fabricTotal === "number" && bom.fabricTotal > 100, "step3 BOM · 面料合计：" + (bom && bom.fabricTotal));
assert(bom && bom.labor && bom.labor.length >= 6,     "step3 BOM · 工序步数：" + (bom && bom.labor && bom.labor.length));
assert(bom && typeof bom.total === "number" && bom.total > 200, "step3 BOM · 单件总成本：" + (bom && bom.total));

// step 4: 查重
var chk = Factory.dedup(words);
assert(chk && chk.results && chk.results.length === 5, "step4 查重 · 5 个平台：" + chk.results.map(function (r) { return r.platform; }).join("/"));
chk.results.forEach(function (r) {
  assert(r.verdict === "原创" || r.verdict === "相近" || r.verdict === "雷同", "step4 查重 · " + r.platform + " 判定：" + r.verdict + "（相似度" + r.maxSim + "%）");
  assert(/^(http|https):\/\//.test(r.url), "step4 查重 · " + r.platform + " 有跳转链接");
});
assert(typeof chk.pass === "boolean", "step4 查重 · pass 字段为布尔：" + chk.pass);
assert(typeof chk.worst.maxSim === "number", "step4 查重 · 有 worst 字段");

// step 5: 采购
var src = Factory.sourcing(bom);
assert(src && src.length === bom.rows.length, "step5 采购 · 每条 BOM 都有采购：" + src.length);
src.forEach(function (s, i) {
  assert(s.channel && /拼多多|1688|淘宝|闲鱼|广州/.test(s.channel), "step5 采购[" + i + "] 渠道：" + s.channel);
  assert(typeof s.priceBest === "number" && s.priceBest > 0, "step5 采购[" + i + "] 最低价：" + s.priceBest);
  assert(/^https:\/\//.test(s.link), "step5 采购[" + i + "] 有拼多多/1688 链接");
});

// step 6: 组合实况
var combo = Factory.combo(bom);
assert(combo && combo.uri && combo.uri.startsWith("data:image/svg+xml"), "step6 组合图 · 本地 SVG");
assert(combo && combo.note, "step6 组合图 · 有说明：" + combo.note);

// step 7: 模特图
var model = Factory.model(bom);
assert(model && model.uri && model.uri.startsWith("data:image/svg+xml"), "step7 模特图 · 本地 SVG");

// step 8: 工厂
var fcts = Factory.factories(bom);
assert(fcts && fcts.length >= 5, "step8 工厂 · 数量：" + (fcts && fcts.length));
fcts.forEach(function (f) {
  assert(f.region && /杭州|湖州|广州|嘉兴|潮州|苏州/.test(f.region), "step8 工厂 · " + f.name + " 产业带：" + f.region);
  assert(typeof f.unitCost === "number" && f.unitCost > 100, "step8 工厂 · " + f.name + " 单价：" + f.unitCost);
  assert(typeof f.min === "number" && f.min > 0, "step8 工厂 · " + f.name + " MOQ：" + f.min);
  assert(f.contact && f.contact.length >= 11, "step8 工厂 · " + f.name + " 联系电话长度：" + f.contact.length);
  assert(f.tags && f.tags.length >= 1, "step8 工厂 · " + f.name + " 标签：" + f.tags.join("/"));
});

// step 9: 成本利润
var fin = Factory.finance(bom, fcts, [50, 100, 200, 500]);
assert(fin && fin.tiers && fin.tiers.length === 4, "step9 成本 · 4 个起订量档");
fin.tiers.forEach(function (t) {
  assert(t.costPerUnit > 0, "step9 " + t.qty + "件 · 成本：" + t.costPerUnit);
  assert(t.retailTb > t.costPerUnit, "step9 " + t.qty + "件 · 淘宝定价 > 成本：" + t.retailTb + ">" + t.costPerUnit);
  assert(t.retailPdd < t.retailTb, "step9 " + t.qty + "件 · 拼多多定价 < 淘宝：" + t.retailPdd + "<" + t.retailTb);
  assert(t.profitTb > 0, "step9 " + t.qty + "件 · 淘宝毛利为正：" + t.profitTb);
  assert(t.profitPdd > 0, "step9 " + t.qty + "件 · 拼多多毛利为正：" + t.profitPdd);
  assert(t.marginTb > 0 && t.marginTb < 100, "step9 " + t.qty + "件 · 淘宝毛利率：" + t.marginTb + "%");
  assert(t.grossTb > 0, "step9 " + t.qty + "件 · 总毛利（淘宝）：" + t.grossTb);
});
assert(fin.best, "step9 · 推荐工厂：" + (fin.best && fin.best.name));

// 检查量越大越便宜
var cheap = fin.tiers[fin.tiers.length - 1].costPerUnit;
var expensive = fin.tiers[0].costPerUnit;
assert(cheap <= expensive, "step9 · 批量越大单价越低：" + expensive + " → " + cheap);

console.log("\n——— 数据链路结果 ———");
console.log("✅ " + ok + "  ✅❌ " + fail);
process.exit(fail === 0 ? 0 : 1);
