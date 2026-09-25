/* 端到端数据链路测试：验证演示数据与真实记录边界。 */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var root = path.resolve(__dirname, "..", "prototype");
var fakeWindow = {};
var context = { window: fakeWindow, console: console, Date: Date, Math: Math, JSON: JSON, encodeURIComponent: encodeURIComponent };
context.global = context;
vm.createContext(context);
["js/core/ai.js", "js/core/factory.js"].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
});
var AI = fakeWindow.AI;
var Factory = fakeWindow.Factory;
var passed = 0;
var failed = 0;
function assert(condition, message) {
  if (condition) { passed++; console.log("  ✅ " + message); }
  else { failed++; console.log("  ❌ " + message); }
}
var words = Factory.designWords("雾霾蓝 英式下午茶");
assert(words.style && words.color && words.mainFabric, "设计词字段完整");
assert(AI.img("dress", "seed", 100, 100).indexOf("data:image/svg+xml") === 0, "演示图为本地 SVG");
var bom = Factory.bom(words);
assert(bom.rows.length >= 8 && bom.total > 0, "拆件有物料和成本");
var check = Factory.dedup(words);
assert(check.results.length === 5 && check.pass === false, "查重有五个平台且初始不通过");
check.results.forEach(function (item) { assert(item.verdict === "" && /^https:\/\//.test(item.url), item.platform + " 搜索入口有效"); });
var sourcing = Factory.sourcing(bom);
assert(sourcing.length === bom.rows.length, "每项物料都有采购入口");
sourcing.forEach(function (item) {
  assert(item.links.map(function (link) { return link.name; }).join("/") === "拼多多/淘宝/1688", item.part + " 三个采购平台");
  assert(item.price === null, item.part + " 初始无假价格");
});
assert(Factory.combo(bom).uri.indexOf("data:image/svg+xml") === 0, "组合演示图有效");
assert(Factory.model(bom).uri.indexOf("data:image/svg+xml") === 0, "模特演示图有效");
var factories = Factory.factories();
assert(factories.links.map(function (link) { return link.name; }).join("/") === "1688/百度/天眼查", "工厂搜索平台正确");
assert(factories.records.length === 0, "工厂初始无虚构记录");
var finance = Factory.finance({ material: 100, labor: 160, fixed: 500, feeRate: 6, shipping: 8, pack: 3, price: 399, qty: 100 });
assert(finance.cost === 265, "单件成本正确");
assert(finance.income === 39900, "总收入正确");
assert(Math.round(finance.totalProfit) === 9906, "总利润正确");
assert(Factory.finance({ material: -1, labor: 1, fixed: 1, feeRate: 1, shipping: 1, pack: 1, price: 1, qty: 1 }).error, "无效成本被拒绝");
console.log("结果：✅ " + passed + "  ❌ " + failed);
process.exit(failed ? 1 : 0);
