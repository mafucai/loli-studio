/* 多套接口 + 全功能逻辑回归（无需浏览器，node 直接跑）
 * 用最小 localStorage/DOM 桩，加载全部核心 JS，跑真实调用路径。
 */
const fs = require("fs"), vm = require("vm"), path = require("path");
let pass = 0, fail = 0;
function ok(n, c) { c ? (pass++, console.log("  ✅ " + n)) : (fail++, console.log("  ❌ " + n)); }

// —— localStorage 桩 ——
const LS = {};
const localStorage = {
  getItem: k => (k in LS ? LS[k] : null),
  setItem: (k, v) => { LS[k] = String(v); },
  removeItem: k => { delete LS[k]; },
  clear: () => { Object.keys(LS).forEach(k => delete LS[k]); }
};

// —— DOM 桩 ——
function el(id) {
  return {
    id, value: "", _text: "", _html: "", _cls: "", _style: { display: "" }, _attrs: {},
    style: { display: "", cssText: "", width: "" },
    tagName: "DIV",
    get textContent() { return this._text; }, set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); },
    get className() { return this._cls; }, set className(v) { this._cls = String(v); },
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
      toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    _h: {}, addEventListener(t, f){ (this._h[t]=this._h[t]||[]).push(f); },
    removeEventListener(){}, appendChild(c){return c;}, remove(){}, insertBefore(c){return c;},
    select(){}, querySelector(){return null;}, querySelectorAll(){return [];},
    getAttribute(k){ return this._attrs[k] ?? null; }, setAttribute(k,v){ this._attrs[k]=v; },
    fire(t, ev){ (this._h[t]||[]).forEach(f=>f(ev||{preventDefault(){}})); }
  };
}
const ids = ["view","title","badge-mock","progress-fill","steps","sheet","toast",
  "in-t-name","in-t-base","in-t-key","in-t-model",
  "in-i-name","in-i-base","in-i-key","in-i-model","in-i-size","in-i-timeout",
  "ep-list-text","ep-list-image","ep-empty-text","ep-empty-image",
  "ep-editor-text","ep-editor-image","form-text","form-image",
  "btn-history","errdot","errpanel","errsum","errbody","errfoot","errcopy","errclear","errclose",
  "in-prompt","factory-name","factory-region","factory-contact","factory-min","factory-cost",
  "cost-fixed","cost-fee","cost-ship","cost-pack","cost-price","cost-qty"];
const els = {}; ids.forEach(i => els[i] = el(i));
els["form-text"].id = "form-text";
els["form-image"].id = "form-image";
els["sheet"].id = "sheet";
const document = {
  readyState: "complete", body: el("body"), documentElement: el("html"),
  getElementById: i => els[i] || null,
  createElement: t => el("new-" + t),
  addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => []
};
const winH = {};
const window = { document, localStorage, addEventListener: (t,f) => (winH[t]=winH[t]||[]).push(f),
  removeEventListener: () => {}, navigator: {}, fetch: () => Promise.reject(new Error("no-net")),
  confirm: () => true, alert: () => {} };
window.window = window;

// —— 加载核心 JS（顺序同 index.html，共享同一全局上下文）——
const ctx = { window, document, localStorage, console, setTimeout, clearTimeout, Date, JSON,
  String, Number, Array, Math, isFinite, Error, Promise, confirm: () => true, fetch: window.fetch,
  encodeURIComponent, decodeURIComponent, parseFloat, parseInt, isNaN };
ctx.globalThis = ctx;
ctx.self = ctx;
// 让 window 上的属性同时可见为裸全局（模拟浏览器 window 即全局）
Object.defineProperty(ctx, "Router", { get: () => window.Router, configurable: true });
Object.defineProperty(ctx, "Store", { get: () => window.Store, configurable: true });
Object.defineProperty(ctx, "R", { get: () => window.R, configurable: true });
Object.defineProperty(ctx, "AI", { get: () => window.AI, configurable: true });
Object.defineProperty(ctx, "Actions", { get: () => window.Actions, configurable: true });
Object.defineProperty(ctx, "Factory", { get: () => window.Factory, configurable: true });
Object.defineProperty(ctx, "ST", { get: () => window.ST, set: v => { window.ST = v; }, configurable: true });
Object.defineProperty(ctx, "ST_VIEW", { get: () => window.ST_VIEW, set: v => { window.ST_VIEW = v; }, configurable: true });
Object.defineProperty(ctx, "__render", { get: () => window.__render, set: v => { window.__render = v; }, configurable: true });
vm.createContext(ctx);
["router.js","ai.js","store.js","factory.js","render.js","render-extra.js","settings.js","actions.js","main.js"].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, "..", "prototype", "js", "core", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
});

const S = window.Store, A = window.Actions, AI = window.AI, R = window.R;

console.log("— 1. 文本池：新增 / 列表 / 切换 —");
ok("初始无文本接口", S.listEndpoints("text").length === 0);
const t1 = S.addEndpoint("text", "主力");
S.setActiveEndpoint("text", t1.id);
S.updateEndpoint("text", t1.id, { base: "https://a.com/v1", key: "k1", model: "m1" });
const t2 = S.addEndpoint("text", "备用");
S.updateEndpoint("text", t2.id, { base: "https://b.com/v1", key: "k2", model: "m2" });
ok("文本列表长度 2", S.listEndpoints("text").length === 2);
ok("文本当前=主力", S.activeEndpoint("text").name === "主力");
ok("getCfg 返回主力", S.getCfg().base === "https://a.com/v1" && S.getCfg().key === "k1");

console.log("— 2. 文本切换后 getCfg 跟随 —");
S.setActiveEndpoint("text", t2.id);
ok("切到备用后 base=b", S.getCfg().base === "https://b.com/v1");
ok("切到备用后 key=k2", S.getCfg().key === "k2");
ok("AI.mode() 变 real", AI.mode() === "real");

console.log("— 3. 图片池完全独立 —");
ok("初始图片池为空（不受文本影响）", S.listEndpoints("image").length === 0);
ok("图片未配置 → imageMode=mock", AI.imageMode() === "mock");
const im1 = S.addEndpoint("image", "图片主力");
S.updateEndpoint("image", im1.id, { base: "https://img.com/v1", key: "ik", model: "dall-e-3" });
ok("图片池有 1 套", S.listEndpoints("image").length === 1);
ok("imageMode 变 real", AI.imageMode() === "real");
ok("getImageCfg 独立返回", S.getImageCfg().base === "https://img.com/v1" && S.getImageCfg().model === "dall-e-3");
ok("文本池未被图片污染", S.getCfg().base === "https://b.com/v1");
ok("两池 id 不冲突", S.listEndpoints("text")[0].id !== S.listEndpoints("image")[0].id);

console.log("— 4. 删掉文本当前生效的那套 —");
S.removeEndpoint("text", t2.id);
ok("文本剩 1 套", S.listEndpoints("text").length === 1);
ok("自动切回主力", S.activeEndpoint("text").name === "主力");
ok("getCfg 跟随回主力", S.getCfg().base === "https://a.com/v1");
ok("图片池不受影响", S.listEndpoints("image").length === 1);

console.log("— 5. 旧版 v1 单配置自动迁移 —");
LS["loli-studio.cfg.v1"] = JSON.stringify({ base: "https://old.com/v1", key: "oldk", model: "oldm", imageModel: "oldimg" });
delete LS["loli-studio.endpoints.v2"];
delete LS["loli-studio.endpoints.v1"];
ok("迁移出文本 1 套", S.listEndpoints("text").length === 1);
ok("迁移出图片 1 套", S.listEndpoints("image").length === 1);
ok("文本内容正确", S.getCfg().base === "https://old.com/v1" && S.getCfg().model === "oldm");
ok("图片内容正确", S.getImageCfg().model === "oldimg");

console.log("— 6. 旧版 v2 混合池自动迁移 —");
delete LS["loli-studio.endpoints.v2"];
LS["loli-studio.endpoints.v1"] = JSON.stringify({
  list: [{ id: "epA", name: "甲", base: "https://a.com/v1", key: "k", model: "m", imageModel: "im" }],
  activeId: "epA"
});
ok("混合池拆出文本", S.listEndpoints("text").length === 1 && S.getCfg().model === "m");
ok("混合池拆出图片", S.listEndpoints("image").length === 1 && S.getImageCfg().model === "im");

console.log("— 7. 渲染列表 HTML（含 kind）—");
LS["loli-studio.endpoints.v2"] = JSON.stringify({
  text: { list: [{id:"tA",name:"甲",base:"https://a.com/v1",key:"",model:"",imageModel:""},
                 {id:"tB",name:"乙",base:"https://b.com/v1",key:"",model:"",imageModel:""}], activeId:"tB" },
  image: { list: [{id:"iA",name:"图甲",base:"https://img.com/v1",key:"",model:"",imageModel:""}], activeId:"iA" }
});
const htmlT = R.epListHTML(S.listEndpoints("text"), S.activeEndpoint("text").id, "text");
const htmlI = R.epListHTML(S.listEndpoints("image"), S.activeEndpoint("image").id, "image");
ok("文本 HTML 两条", (htmlT.match(/ep-item/g) || []).length === 2);
ok("文本 HTML 带 data-kind=text", htmlT.includes('data-kind="text"'));
ok("图片 HTML 带 data-kind=image", htmlI.includes('data-kind="image"'));
ok("HTML 标出「用中」", htmlT.includes("用中"));
ok("HTML 去掉协议前缀", htmlT.includes("a.com/v1") && !htmlT.includes("https://a.com"));

console.log("— 8. 设置面板动作（两个池）—");
A.run("open-settings");
ok("面板已开", els.sheet.classList.contains("open"));
ok("文本列表已渲染", els["ep-list-text"].innerHTML.includes("ep-item"));
ok("图片列表已渲染", els["ep-list-image"].innerHTML.includes("ep-item"));
A.run("ep-add", { getAttribute: k => k === "data-kind" ? "text" : null });
ok("文本新增后 3 套", S.listEndpoints("text").length === 3);
A.run("ep-add", { getAttribute: k => k === "data-kind" ? "image" : null });
ok("图片新增后 2 套", S.listEndpoints("image").length === 2);
els["in-t-name"].value = "文本改名"; els["in-t-base"].value = "https://tx.com/v1";
els["in-t-key"].value = "txk"; els["in-t-model"].value = "txm";
els["form-text"].fire("submit", { preventDefault(){}, target: els["form-text"] });
ok("文本保存生效", S.activeEndpoint("text").base === "https://tx.com/v1" && S.activeEndpoint("text").name === "文本改名");
els["in-i-name"].value = "图片改名"; els["in-i-base"].value = "https://ix.com/v1";
els["in-i-key"].value = "ixk"; els["in-i-model"].value = "ixm";
els["form-image"].fire("submit", { preventDefault(){}, target: els["form-image"] });
ok("图片保存生效", S.activeEndpoint("image").base === "https://ix.com/v1");
ok("文本保存不影响图片", S.activeEndpoint("text").base === "https://tx.com/v1");

console.log("— 9. 表单提交不双触发 —");
const nT = S.listEndpoints("text").length, nI = S.listEndpoints("image").length;
els["form-text"].fire("submit", { preventDefault(){}, target: els["form-text"] });
els["form-image"].fire("submit", { preventDefault(){}, target: els["form-image"] });
ok("提交后数量不变", S.listEndpoints("text").length === nT && S.listEndpoints("image").length === nI);

console.log("— 10. 全流程功能（九步数据链路）—");
LS["loli-studio.designs.v1"] = "[]";
const d = S.newDesign("雾霾蓝英式下午茶");
S.saveDesign(d); S.setCurrentId(d.id);
els["in-prompt"].value = "雾霾蓝英式下午茶";
S.patch(d.id, { words: window.Factory.designWords("雾霾蓝英式下午茶") }, "设计词");
ok("设计词生成", !!S.getDesign(d.id).words);
S.patch(d.id, { bom: window.Factory.bom(S.getDesign(d.id).words) }, "拆件");
ok("BOM 生成", S.getDesign(d.id).bom && S.getDesign(d.id).bom.rows.length > 0);
S.patch(d.id, { check: window.Factory.dedup(S.getDesign(d.id).words) }, "查重");
ok("查重生成", S.getDesign(d.id).check.results.length === 5);
S.patch(d.id, { markedOriginal: true }, "原创");
S.patch(d.id, { sourcing: window.Factory.sourcing(S.getDesign(d.id).bom) }, "采购");
ok("采购生成", S.getDesign(d.id).sourcing.length > 0);
S.patch(d.id, { factories: window.Factory.factories() }, "工厂");
ok("工厂搜索生成（初始无虚构记录）", S.getDesign(d.id).factories && S.getDesign(d.id).factories.records.length === 0 && S.getDesign(d.id).factories.links.length >= 3);
const fin = window.Factory.finance({ material: 300, labor: 50, fixed: 100, feeRate: 5, shipping: 20, pack: 10, price: 800, qty: 100 });
ok("成本计算", !fin.error && fin.profit > 0);

console.log("— 11. 报错助手仍正常 —");
winH.error[0]({ message: "probe-err", lineno: 1 });
ok("角标计数=1", els.errdot.textContent === "1");
winH.unhandledrejection[0]({ reason: new Error("probe-rej") });
ok("角标计数=2", els.errdot.textContent === "2");

console.log("— 12. 拉取模型列表（API 存在）—");
ok("AI.listModels 是函数", typeof AI.listModels === "function");
ok("AI.searchWeb 是函数", typeof AI.searchWeb === "function");

console.log("— 13. 估价块（组合页）—");
// 造一份有采购单价的设计单
LS["loli-studio.designs.v1"] = "[]";
const dz = S.newDesign("估价测试");
dz.words = window.Factory.designWords("估价测试");
dz.bom = window.Factory.bom(dz.words);
dz.sourcing = window.Factory.sourcing(dz.bom).map(function (x, i) { x.price = 10 + i; return x; });
dz.combo = { uri: "data:image/svg+xml,x", note: "演示图" };
S.saveDesign(dz); S.setCurrentId(dz.id);
const lookHTML = R.vLook(S.getDesign(dz.id));
ok("组合页含估价块", lookHTML.indexOf("估算价格") >= 0);
ok("估价块含件估算成本", lookHTML.indexOf("件估算成本") >= 0);
ok("估价块含建议零售价", lookHTML.indexOf("建议零售价") >= 0);
ok("估价块含保底售价", lookHTML.indexOf("保底售价") >= 0);

console.log("— 14. 未填单价时估价块给提示 —");
const d2 = S.newDesign("无单价");
d2.words = window.Factory.designWords("无单价");
d2.bom = window.Factory.bom(d2.words);
d2.sourcing = window.Factory.sourcing(d2.bom);   // price 全为 null
d2.combo = { uri: "x", note: "y" };
S.saveDesign(d2); S.setCurrentId(d2.id);
const lookHTML2 = R.vLook(S.getDesign(d2.id));
ok("未填单价时提示去采购填单价", lookHTML2.indexOf("还没填采购单价") >= 0);

console.log("— 15. AI 结果渲染（aiResults）—");
const aiH = R.aiResults("AI 相似款", { query: "洛丽塔 甜系", items: [
  { title: "某相似款", source: "小红书", price: "￥299", url: "https://www.xiaohongshu.com/x" },
  { title: "无链接项", source: "淘宝", price: "", url: "" }
]});
ok("含标题", aiH.indexOf("某相似款") >= 0);
ok("含平台与价格", aiH.indexOf("小红书") >= 0 && aiH.indexOf("299") >= 0);
ok("含打开链接", aiH.indexOf("https://www.xiaohongshu.com/x") >= 0);
ok("标明仅供参考", aiH.indexOf("不是平台实测") >= 0);
ok("无链接项显示无链接", aiH.indexOf("无链接") >= 0);
const aiEmpty = R.aiResults("AI 工厂线索", null);
ok("无结果时给提示", aiEmpty.indexOf("还没有 AI 结果") >= 0);

console.log("— 16. 查重/工厂页含 AI 搜索按钮 —");
S.patch(dz.id, { check: window.Factory.dedup(S.getDesign(dz.id).words) }, "查重");
const chkHTML = R.vCheck(S.getDesign(dz.id));
ok("查重页含 AI 搜索按钮", chkHTML.indexOf('data-act="ai-search"') >= 0);
S.patch(dz.id, { factories: window.Factory.factories() }, "工厂");
const factHTML = R.vFact(S.getDesign(dz.id));
ok("工厂页含 AI 搜索按钮", factHTML.indexOf('data-where="fact"') >= 0);

console.log("— 17. AI 拆件 / AI 比价 API 存在 —");
ok("AI.splitBom 是函数", typeof AI.splitBom === "function");
ok("AI.comparePrice 是函数", typeof AI.comparePrice === "function");
ok("拆件按钮存在", R.vPart(S.getDesign(dz.id)).length > 0);

console.log("— 18. 比价块 + 采购页 —");
S.patch(dz.id, { aiCompare: { items: [{ part: "裙撑", best: "1688", keyword: "蕾丝硬纱 裙撑", tip: "1688 按米买更便宜" }] } }, "比价");
const buyHTML = R.vBuy(S.getDesign(dz.id));
ok("采购页含 AI 比价按钮", buyHTML.indexOf('data-act="ai-compare"') >= 0);
ok("采购页显示比价结果", buyHTML.indexOf("1688") >= 0 && buyHTML.indexOf("裙撑") >= 0);

console.log("— 19. 拆件来源标注 —");
S.patch(dz.id, { bomSource: "ai" }, "标AI");
ok("AI 拆件标注来源", R.vPart(S.getDesign(dz.id)).indexOf("由文本 AI 拆解") >= 0);
S.patch(dz.id, { bomSource: "demo" }, "标演示");
ok("本地拆件标注演示", R.vPart(S.getDesign(dz.id)).indexOf("本地零件库生成") >= 0);

console.log("— 20. 图片历史（标签 + 汇总）—");
S.patch(dz.id, { imgUri: "data:image/svg+xml,design" }, "加设计图");
const listAll = S.listDesigns();
const ordHTML = R.vHistory(listAll);
ok("历史页含两个标签", ordHTML.indexOf('data-tab="orders"') >= 0 && ordHTML.indexOf('data-tab="images"') >= 0);
ok("默认显示设计单", ordHTML.indexOf("全部设计单") >= 0);
window.HIST_TAB = "images";
const imgHTML = R.vHistory(listAll);
ok("切到图片标签", imgHTML.indexOf("全部图片") >= 0);
ok("图片历史含设计图", imgHTML.indexOf("设计图") >= 0);
ok("图片历史含组合图", imgHTML.indexOf("组合图") >= 0);
ok("图片历史用网格", imgHTML.indexOf("img-grid") >= 0);
window.HIST_TAB = undefined;

console.log("\n——— 结果 ———");
console.log("✅ 通过 " + pass + "  ❌ 失败 " + fail);
process.exit(fail === 0 ? 0 : 1);
