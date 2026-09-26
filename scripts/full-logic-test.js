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
const ids = ["view","title","badge-mock","progress-fill","steps","sheet","form-settings","toast",
  "in-ep-name","in-base","in-key","in-model","in-image-model","ep-list","ep-empty","ep-editor",
  "btn-history","errdot","errpanel","errsum","errbody","errfoot","errcopy","errclear","errclose",
  "in-prompt","factory-name","factory-region","factory-contact","factory-min","factory-cost",
  "cost-fixed","cost-fee","cost-ship","cost-pack","cost-price","cost-qty"];
const els = {}; ids.forEach(i => els[i] = el(i));
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
const ctx = { window, document, localStorage, console, setTimeout, Date, JSON,
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
["router.js","ai.js","store.js","factory.js","render.js","actions.js","main.js"].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, "..", "prototype", "js", "core", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
});

const S = window.Store, A = window.Actions, AI = window.AI, R = window.R;

console.log("— 1. 多套接口：新增 / 列表 / 切换 —");
ok("初始无接口", S.listEndpoints().length === 0);
const e1 = S.addEndpoint("主力");
S.setActiveEndpoint(e1.id);
S.updateEndpoint(e1.id, { base: "https://a.com/v1", key: "k1", model: "m1", imageModel: "" });
const e2 = S.addEndpoint("备用");
S.updateEndpoint(e2.id, { base: "https://b.com/v1", key: "k2", model: "m2", imageModel: "img2" });
ok("列表长度 2", S.listEndpoints().length === 2);
ok("当前生效=主力", S.activeEndpoint().name === "主力");
ok("getCfg 返回主力", S.getCfg().base === "https://a.com/v1" && S.getCfg().key === "k1");

console.log("— 2. 切换后 getCfg 跟随 —");
S.setActiveEndpoint(e2.id);
ok("切到备用后 base=b", S.getCfg().base === "https://b.com/v1");
ok("切到备用后 key=k2", S.getCfg().key === "k2");
ok("AI.mode() 变 real", AI.mode() === "real");
ok("imageMode 变 real（备用有 imageModel）", AI.imageMode() === "real");

console.log("— 3. 删掉当前生效的那套 —");
S.removeEndpoint(e2.id);
ok("剩 1 套", S.listEndpoints().length === 1);
ok("自动切回主力", S.activeEndpoint().name === "主力");
ok("getCfg 跟随回主力", S.getCfg().base === "https://a.com/v1");

console.log("— 4. 旧版单配置自动迁移 —");
LS["loli-studio.cfg.v1"] = JSON.stringify({ base: "https://old.com/v1", key: "oldk", model: "oldm", imageModel: "" });
delete LS["loli-studio.endpoints.v1"];
ok("迁移后得到 1 套", S.listEndpoints().length === 1);
ok("迁移内容正确", S.getCfg().base === "https://old.com/v1" && S.getCfg().key === "oldk");

console.log("— 5. rendered 列表 HTML —");
LS["loli-studio.endpoints.v1"] = JSON.stringify({
  list: [{id:"epA",name:"甲",base:"https://a.com/v1",key:"",model:"",imageModel:""},
         {id:"epB",name:"乙",base:"https://b.com/v1",key:"",model:"",imageModel:""}],
  activeId: "epB" });
const html = R.epListHTML(S.listEndpoints(), S.activeEndpoint().id);
ok("HTML 含两个条目", (html.match(/ep-item/g) || []).length === 2);
ok("HTML 标出「用中」", html.includes("用中"));
ok("HTML 含名称", html.includes("甲") && html.includes("乙"));
ok("HTML 去掉协议前缀", html.includes("a.com/v1") && !html.includes("https://a.com"));

console.log("— 6. 设置面板动作 —");
A.run("open-settings");
ok("面板已开", els.sheet.classList.contains("open"));
ok("列表已渲染", els["ep-list"].innerHTML.includes("ep-item"));
A.run("ep-add");
ok("新增后 3 套", S.listEndpoints().length === 3);
ok("新增的那套成为当前", S.activeEndpoint().name.includes("接口"));
els["ep-list"].innerHTML = html; // 模拟渲染
els["in-base"].value = "https://x.com/v1"; els["in-key"].value = "xk";
els["in-model"].value = "xm"; els["in-ep-name"].value = "改名了";
window.__saveCurrentEditor();
ok("编辑保存后 base 更新", S.activeEndpoint().base === "https://x.com/v1");
ok("编辑保存后 名称更新", S.activeEndpoint().name === "改名了");

console.log("— 7. 表单提交不双触发 —");
const before = S.listEndpoints().length;
els["form-settings"].fire("submit", { preventDefault(){} });
ok("提交后无异常且数量不变", S.listEndpoints().length === before);

console.log("— 8. 全流程功能（九步数据链路）—");
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

console.log("— 9. 报错助手仍正常 —");
winH.error[0]({ message: "probe-err", lineno: 1 });
ok("角标计数=1", els.errdot.textContent === "1");
winH.unhandledrejection[0]({ reason: new Error("probe-rej") });
ok("角标计数=2", els.errdot.textContent === "2");

console.log("\n——— 结果 ———");
console.log("✅ 通过 " + pass + "  ❌ 失败 " + fail);
process.exit(fail === 0 ? 0 : 1);
