/* 模型拉取 async 验收（独立文件：需要 await，避免被同步测试提前退出） */
const fs = require("fs"), vm = require("vm"), path = require("path");
let pass = 0, fail = 0;
function ok(n, c) { c ? (pass++, console.log("  ✅ " + n)) : (fail++, console.log("  ❌ " + n)); }

const LS = {};
const localStorage = {
  getItem: k => (k in LS ? LS[k] : null),
  setItem: (k, v) => { LS[k] = String(v); },
  removeItem: k => { delete LS[k]; }, clear: () => { Object.keys(LS).forEach(k => delete LS[k]); }
};

let FETCH_MODE = "none";   // none | ok | empty | err
let LAST_URL = "", LAST_HEADERS = null;
function fakeFetch(url, opts) {
  LAST_URL = url; LAST_HEADERS = (opts && opts.headers) || {};
  if (FETCH_MODE === "ok") {
    return Promise.resolve({ ok: true, status: 200,
      json: () => Promise.resolve({ data: [{ id: "gpt-4o-mini" }, { id: "dall-e-3" }, { id: "gpt-4o-mini" }] }) });
  }
  if (FETCH_MODE === "empty") {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }) });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
}

function el(id) {
  return { id, value: "", textContent: "", innerHTML: "", className: "", style: { display: "", cssText: "", width: "" },
    tagName: "DIV", _attrs: {}, _h: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
      toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);}, contains(c){return this._s.has(c);} },
    addEventListener(t,f){ (this._h[t]=this._h[t]||[]).push(f); },
    removeEventListener(){}, appendChild(c){return c;}, remove(){}, insertBefore(c){return c;},
    select(){}, querySelector(){return null;}, querySelectorAll(){return [];},
    getAttribute(k){ return this._attrs[k] ?? null; }, setAttribute(k,v){ this._attrs[k]=v; },
    fire(t,ev){ (this._h[t]||[]).forEach(f=>f(ev||{preventDefault(){}})); } };
}
const ELS = {};
["view","title","badge-mock","progress-fill","steps","sheet","toast","form-text","form-image",
 "ep-list-text","ep-list-image","ep-empty-text","ep-empty-image","ep-editor-text","ep-editor-image",
 "in-t-name","in-t-base","in-t-key","in-t-model","in-i-name","in-i-base","in-i-key","in-i-model",
 "btn-history","errdot","errpanel","errsum","errbody","errfoot","errcopy","errclear","errclose"]
 .forEach(i => { ELS[i] = el(i); ELS[i].id = i; });

const document = { readyState: "complete", body: el("body"), documentElement: el("html"),
  getElementById: id => ELS[id] || null,
  createElement: t => el("new-" + t), addEventListener: () => {},
  querySelector: () => null, querySelectorAll: () => [] };
const window = { document, localStorage, addEventListener: () => {}, removeEventListener: () => {},
  navigator: {}, fetch: fakeFetch };
window.window = window;

const ctx = { window, document, localStorage, console, setTimeout, clearTimeout, Date, JSON,
  String, Number, Array, Math, isFinite, Error, Promise, confirm: () => true, fetch: fakeFetch,
  encodeURIComponent, decodeURIComponent, parseFloat, parseInt, isNaN };
ctx.globalThis = ctx;
Object.defineProperty(ctx, "Router", { get: () => window.Router, configurable: true });
Object.defineProperty(ctx, "Store", { get: () => window.Store, configurable: true });
Object.defineProperty(ctx, "R", { get: () => window.R, configurable: true });
Object.defineProperty(ctx, "AI", { get: () => window.AI, configurable: true });
Object.defineProperty(ctx, "Actions", { get: () => window.Actions, configurable: true });
Object.defineProperty(ctx, "Factory", { get: () => window.Factory, configurable: true });
Object.defineProperty(ctx, "Settings", { get: () => window.Settings, configurable: true });
Object.defineProperty(ctx, "ST", { get: () => window.ST, set: v => { window.ST = v; }, configurable: true });
Object.defineProperty(ctx, "ST_VIEW", { get: () => window.ST_VIEW, set: v => { window.ST_VIEW = v; }, configurable: true });
Object.defineProperty(ctx, "__render", { get: () => window.__render, set: v => { window.__render = v; }, configurable: true });
vm.createContext(ctx);
["router.js","ai.js","store.js","factory.js","render.js","render-extra.js","settings.js","actions.js","main.js"].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, "..", "prototype", "js", "core", f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
});
const S = window.Store, AI = window.AI;

(async () => {
  console.log("— 1. 未配置接口 → 明确报错，不发请求 —");
  FETCH_MODE = "none";
  let r = await AI.listModels("text");
  ok("返回错误", !!r.__error);
  ok("提示填地址", r.__error.indexOf("接口地址") >= 0);

  console.log("— 2. 填了 http（非 https）→ 拒绝 —");
  const t = S.addEndpoint("text", "甲");
  S.setActiveEndpoint("text", t.id);
  S.updateEndpoint("text", t.id, { base: "http://insecure.com/v1", key: "k", model: "m" });
  r = await AI.listModels("text");
  ok("拒绝非 HTTPS", !!r.__error && r.__error.indexOf("HTTPS") >= 0);

  console.log("— 3. https 但缺 key → 提示填 Key —");
  S.updateEndpoint("text", t.id, { base: "https://api.a.com/v1", key: "", model: "m" });
  r = await AI.listModels("text");
  ok("提示缺 Key", !!r.__error && r.__error.indexOf("API Key") >= 0);

  console.log("— 4. 正常拉取 → 去重 + 排序 —");
  S.updateEndpoint("text", t.id, { base: "https://api.a.com/v1", key: "sk-x", model: "m" });
  FETCH_MODE = "ok";
  r = await AI.listModels("text");
  ok("请求打到 /models", LAST_URL === "https://api.a.com/v1/models");
  ok("带 Bearer 头", LAST_HEADERS["Authorization"] === "Bearer sk-x");
  ok("返回 2 个（去重）", r.models && r.models.length === 2);
  ok("已排序", r.models[0] === "dall-e-3" && r.models[1] === "gpt-4o-mini");

  console.log("— 5. 空列表 → 报错而不是空成功 —");
  FETCH_MODE = "empty";
  r = await AI.listModels("text");
  ok("空列表报错", !!r.__error && r.__error.indexOf("没有返回模型") >= 0);

  console.log("— 6. 404 → 报错并提示可手打 —");
  FETCH_MODE = "err";
  r = await AI.listModels("text");
  ok("404 报错", !!r.__error && r.__error.indexOf("404") >= 0);
  ok("提示可手打", r.__error.indexOf("手动填写") >= 0);

  console.log("— 7. 图片池独立：只读图片池的地址/密钥 —");
  const i = S.addEndpoint("image", "图甲");
  S.setActiveEndpoint("image", i.id);
  S.updateEndpoint("image", i.id, { base: "https://img.b.com/v1", key: "ik", model: "im" });
  FETCH_MODE = "ok";
  await AI.listModels("image");
  ok("图片池用自己的地址", LAST_URL === "https://img.b.com/v1/models");
  ok("图片池用自己的 Key", LAST_HEADERS["Authorization"] === "Bearer ik");

  console.log("— 8. 图片池未配置时不影响文本池结论 —");
  S.updateEndpoint("image", i.id, { base: "", key: "", model: "" });
  r = await AI.listModels("image");
  ok("图片池独立报错", !!r.__error);
  r = await AI.listModels("text");
  ok("文本池仍可拉取", !r.__error && r.models.length === 2);

  console.log("\n——— 结果 ———");
  console.log("✅ 通过 " + pass + "  ❌ 失败 " + fail);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
