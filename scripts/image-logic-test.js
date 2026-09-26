/* 图片生成逻辑验收：多参数回退、超时、响应格式兼容 */
const fs = require("fs"), vm = require("vm"), path = require("path");
let pass = 0, fail = 0;
function ok(n, c) { c ? (pass++, console.log("  ✅ " + n)) : (fail++, console.log("  ❌ " + n)); }

const LS = {};
const localStorage = { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); },
  removeItem: k => { delete LS[k]; }, clear: () => { Object.keys(LS).forEach(k => delete LS[k]); } };

// 可编排的假 fetch
let PLAN = [];         // 依次返回的响应
let CALLS = [];        // 记录每次请求体
function fakeFetch(url, opts) {
  let body = {};
  try { body = JSON.parse(opts.body); } catch (e) {}
  CALLS.push({ url, body, headers: opts.headers });
  const step = PLAN.shift();
  if (!step) return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("no plan") });
  if (step === "net") return Promise.reject(new Error("network fail"));
  if (step === "abort") { const e = new Error("aborted"); e.name = "AbortError"; return Promise.reject(e); }
  if (typeof step === "object") return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(step) });
  return Promise.resolve({ ok: false, status: Number(step), text: () => Promise.resolve("err" + step) });
}

const ELS = {};
function el(id) { return { id, value: "", textContent: "", innerHTML: "", className: "",
  style: { display: "", cssText: "" }, _attrs: {}, _h: {},
  classList: { _s: new Set(), add(){}, remove(){}, toggle(){}, contains(){return false;} },
  addEventListener(t,f){ (this._h[t]=this._h[t]||[]).push(f); }, removeEventListener(){},
  appendChild(c){return c;}, remove(){}, insertBefore(c){return c;}, select(){},
  querySelector(){return null;}, querySelectorAll(){return [];},
  getAttribute(k){ return this._attrs[k] ?? null; }, setAttribute(k,v){ this._attrs[k]=v; },
  fire(t,ev){ (this._h[t]||[]).forEach(f=>f(ev||{preventDefault(){}})); } }; }
["view","title","badge-mock","progress-fill","steps","sheet","toast","form-text","form-image",
 "ep-list-text","ep-list-image","ep-empty-text","ep-empty-image","ep-editor-text","ep-editor-image",
 "in-t-name","in-t-base","in-t-key","in-t-model","in-i-name","in-i-base","in-i-key","in-i-model",
 "in-i-size","in-i-timeout","btn-history","errdot","errpanel","errsum","errbody","errfoot",
 "errcopy","errclear","errclose"].forEach(i => { ELS[i] = el(i); });

const document = { readyState: "complete", body: el("body"), documentElement: el("html"),
  getElementById: id => ELS[id] || null, createElement: t => el("new-" + t),
  addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] };

const window = { document, localStorage, addEventListener: () => {}, removeEventListener: () => {},
  navigator: {}, fetch: fakeFetch, AbortController: global.AbortController };
window.window = window;

const ctx = { window, document, localStorage, console, setTimeout, clearTimeout, Date, JSON,
  String, Number, Array, Math, isFinite, Error, Promise, confirm: () => true, fetch: fakeFetch,
  AbortController: global.AbortController, encodeURIComponent, decodeURIComponent,
  parseFloat, parseInt, isNaN };
ctx.globalThis = ctx;
["Router","Store","R","AI","Actions","Factory","Settings","ST","ST_VIEW","__render"].forEach(k => {
  Object.defineProperty(ctx, k, { get: () => window[k], set: v => { window[k] = v; }, configurable: true });
});
vm.createContext(ctx);
["router.js","ai.js","store.js","factory.js","render.js","render-extra.js","settings.js","actions.js","main.js"]
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "prototype", "js", "core", f), "utf8"), ctx, { filename: f }));

const S = window.Store, AI = window.AI;

(async () => {
  // 配好图片接口
  const i = S.addEndpoint("image", "图甲");
  S.setActiveEndpoint("image", i.id);
  S.updateEndpoint("image", i.id, { base: "https://img.test/v1", key: "ik", model: "grok-imagine-image-2.0" });

  console.log("— 1. 首选 url 格式，一次成功（快路径）—");
  PLAN = [{ data: [{ url: "https://cdn.test/a.png" }] }]; CALLS = [];
  let r = await AI.image("一条洛丽塔裙");
  ok("返回图片", !r.__error && r.uri === "https://cdn.test/a.png");
  ok("只调一次（不重试）", CALLS.length === 1);
  ok("请求用 response_format=url", CALLS[0].body.response_format === "url");
  ok("默认尺寸 1024x1024（不再写死 1536）", CALLS[0].body.size === "1024x1024");

  console.log("— 2. url 失败 → 自动回退默认/b64 —");
  PLAN = ["400", { data: [{ b64_json: "QUJD" }] }]; CALLS = [];
  r = await AI.image("p");
  ok("回退后拿到 b64", !r.__error && r.uri === "data:image/png;base64,QUJD");
  ok("试了两次", CALLS.length === 2);
  ok("第二次无 response_format", CALLS[1].body.response_format === undefined);

  console.log("— 3. 401/403 直接停，不瞎重试 —");
  PLAN = ["401", {}, {}]; CALLS = [];
  r = await AI.image("p");
  ok("返回错误", !!r.__error);
  ok("鉴权错只试一次", CALLS.length === 1);

  console.log("— 4. 超时给明确的错（不干等）—");
  PLAN = ["abort"]; CALLS = [];
  r = await AI.image("p");
  ok("提示超时", !!r.__error && r.__error.indexOf("超时") >= 0);
  ok("提示可改尺寸或超时", r.__error.indexOf("尺寸") >= 0 || r.__error.indexOf("超时") >= 0);

  console.log("— 5. 响应格式兼容（revisions / 顶层 url / data 数组）—");
  PLAN = [{ data: [{ revisions: [{ url: "https://x/y.png" }] }] }]; CALLS = [];
  r = await AI.image("p");
  ok("识别 revisions.url", !r.__error && r.uri === "https://x/y.png");
  ok("revisions 一次就成功", CALLS.length === 1);
  PLAN = [{ data: [{ revisions: [{ b64_json: "QQ==" }] }] }]; CALLS = [];
  r = await AI.image("p");
  ok("识别 revisions.b64", !r.__error && r.uri === "data:image/png;base64,QQ==");

  console.log("— 6. 自定义尺寸与超时被采纳 —");
  S.updateEndpoint("image", i.id, { size: "768x768", timeoutMs: 30000 });
  PLAN = [{ data: [{ b64_json: "QQ==" }] }]; CALLS = [];
  // url 尝试先失败
  PLAN = ["500", { data: [{ b64_json: "QQ==" }] }];
  r = await AI.image("p");
  ok("用自定义尺寸", CALLS[0].body.size === "768x768");

  console.log("— 7. 未配图片接口时明确报错 —");
  S.updateEndpoint("image", i.id, { model: "" });
  r = await AI.image("p");
  ok("提示缺图片模型", !!r.__error && r.__error.indexOf("模型") >= 0);

  console.log("— 8. 非 HTTPS 拒绝 —");
  S.updateEndpoint("image", i.id, { base: "http://x.com/v1", model: "m" });
  r = await AI.image("p");
  ok("拒绝非 HTTPS", !!r.__error && r.__error.indexOf("HTTPS") >= 0);

  console.log("\n——— 结果 ———");
  console.log("✅ 通过 " + pass + "  ❌ 失败 " + fail);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("FAIL:", e); process.exit(1); });
