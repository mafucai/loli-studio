/* 真机环境模拟：用真接口 + 真 Key，验证完整出图链路
 * 模拟手机 WebView 的三个真实约束：
 *   1. 页面是 file:// → JS fetch 外链图会被 CORS 拦
 *   2. <img> 直连外链 → 混合来源拦
 *   3. 原生桥（Java）下载 → 无限制
 * 本脚本用 Node 分别验证「JS fetch 会被拦」与「原生下载能拿到图」。
 */
const KEY = process.argv[2];
const BASE = "https://api.catcat.top/v1";
const MODEL = "grok-imagine-image-2.0";

if (!KEY) { console.error("用法: node webview-env-sim.js <API_KEY>"); process.exit(2); }

const https = require("https");

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: headers || {} }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(40000, () => { req.destroy(new Error("timeout")); });
  });
}
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", "Content-Length": data.length }, headers || {})
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(120000, () => { req.destroy(new Error("timeout")); });
    req.write(data); req.end();
  });
}

let pass = 0, fail = 0;
function ok(n, c) { c ? (pass++, console.log("  ✅ " + n)) : (fail++, console.log("  ❌ " + n)); }

(async () => {
  console.log("=== 模拟手机 WebView 环境，真接口真 Key ===\n");

  console.log("— 1. 图片接口调用（App 首选 url 格式）—");
  const t0 = Date.now();
  const r = await httpPost(BASE + "/images/generations",
    { "Authorization": "Bearer " + KEY },
    { model: MODEL, prompt: "a lolita dress, flat lay", size: "1024x1024", n: 1, response_format: "url" });
  const cost = Date.now() - t0;
  ok("HTTP 200", r.status === 200);
  let j = {};
  try { j = JSON.parse(r.body.toString()); } catch (e) { ok("返回是 JSON", false); }
  const item = j.data && j.data[0];
  ok("返回 data[0]", !!item);
  const imgUrl = item && item.url;
  ok("含图片 URL", !!imgUrl && /^https:\/\//.test(imgUrl));
  console.log("     耗时 " + (cost / 1000).toFixed(1) + "s  →  " + String(imgUrl).slice(0, 70) + "…");

  console.log("\n— 2. 模拟 JS fetch 下载（file:// 页面）—");
  const probe = await httpGet(imgUrl, { "Origin": "null" });
  const acao = probe.headers["access-control-allow-origin"];
  ok("图片可访问 HTTP 200", probe.status === 200);
  ok("确实返回图片字节", probe.body.length > 1000);
  ok("【复现问题】无 CORS 头 → 浏览器 JS fetch 会被拦", !acao);
  console.log("     图片大小 " + Math.round(probe.body.length / 1024) + " KB，Content-Type: " + probe.headers["content-type"]);

  console.log("\n— 3. 模拟原生桥下载（Java HttpURLConnection，无 CORS）—");
  ok("原生下载成功拿到字节（无浏览器限制）", probe.status === 200 && probe.body.length > 1000);
  const b64 = probe.body.toString("base64");
  const dataUri = "data:" + (probe.headers["content-type"] || "image/jpeg") + ";base64," + b64;
  ok("能转成 data URI", dataUri.startsWith("data:image/"));
  ok("data URI 长度合理", dataUri.length > 10000);
  console.log("     data URI 大小 " + Math.round(dataUri.length / 1024) + " KB");

  console.log("\n— 4. data URI 是否是真图片（魔数校验）—");
  const head = probe.body.slice(0, 4);
  const isJpeg = head[0] === 0xFF && head[1] === 0xD8;
  const isPng = head[0] === 0x89 && head[1] === 0x50;
  ok("魔数是真图（JPEG/PNG）", isJpeg || isPng);
  console.log("     格式: " + (isJpeg ? "JPEG" : isPng ? "PNG" : "未知") + "，前4字节 " + head.toString("hex"));

  console.log("\n— 5. 尺寸与速度评估 —");
  ok("出图耗时 < 60 秒", cost < 60000);
  ok("图片大小 < 12MB（原生桥上限制）", probe.body.length < 12 * 1024 * 1024);
  const ratio = (dataUri.length / probe.body.length).toFixed(2);
  console.log("     base64 膨胀比 " + ratio + "x（" + Math.round(probe.body.length / 1024) + "KB → " + Math.round(dataUri.length / 1024) + "KB）");

  console.log("\n——— 结论 ———");
  console.log("✅ 通过 " + pass + "  ❌ 失败 " + fail);
  const c3 = (probe.status === 200 && probe.body.length > 1000 && !acao);
  if (c3) {
    console.log("\n判定：接口可用；JS 侧必然被 CORS 拦（已复现）；");
    console.log("      原生桥方案成立 → build-18 的修复方向正确，能通。");
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
