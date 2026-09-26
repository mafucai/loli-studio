/* 终极探针：记录所有 addEventListener + 包裹 Store.patch + 追踪 change 全链路 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const server = spawn("python3", ["-m", "http.server", "8770", "--bind", "127.0.0.1"], { cwd: "prototype", stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => console.log("[页]", m.text().slice(0, 220)));

  await page.addInitScript(() => {
    window.__LISTENERS = [];
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type === "change") {
        const tag = this.id ? "#" + this.id : this.tagName;
        window.__LISTENERS.push({ target: tag, fn: String(fn).slice(0, 120) });
      }
      return orig.call(this, type, fn, opts);
    };
  });

  await page.goto("http://127.0.0.1:8770/index.html", { waitUntil: "domcontentloaded" });
  await page.fill("#in-prompt", "雾霾蓝英式下午茶");
  await page.click("[data-act='gen-words']");
  await page.click("[data-act='next'][data-step='img']");
  await page.click("[data-act='gen-img']");
  await page.click("[data-act='pass-img']");
  await page.click("[data-act='next'][data-step='part']");
  await page.click("[data-act='gen-bom']");
  await page.click("[data-act='next'][data-step='check']");
  await page.click("[data-act='run-check']");
  for (const name of ["小红书", "抖音", "淘宝", "拼多多", "闲鱼"]) await page.click(`text=${name} 官方搜索 >> xpath=.. >> text=原创`);
  await page.click("[data-act='mark-original']");
  await page.click("[data-act='next'][data-step='buy']");
  await page.click("[data-act='run-sourcing']");

  const pre = await page.evaluate(() => {
    // 包 Store.patch 记 payload 全文
    const orig = Store.patch;
    window.__PATCHES = [];
    Store.patch = function (id, obj, act) { window.__PATCHES.push({ id: id, act: act, item0: obj.sourcing && JSON.parse(JSON.stringify(obj.sourcing[0])), inputVal: (document.querySelector("[data-act='set-price']") || {}).value }); return orig.apply(this, arguments); };
    // 包 localStorage.setItem 记全部写入
    window.__WRITES = [];
    const origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) { window.__WRITES.push({ k: k, v: String(v).slice(0, 120), at: Date.now() }); return origSet(k, v); };
    return { changeListeners: window.__LISTENERS };
  });
  console.log("change监听器注册记录:", JSON.stringify(pre.changeListeners ? pre.changeListeners.length : pre, null, 2));

  await page.locator("[data-act='set-price']").nth(0).fill("10");
  await page.locator("[data-act='set-price']").nth(0).dispatchEvent("change");
  await sleep(300);
  const post = await page.evaluate(() => ({
    patches: window.__PATCHES,
    writes: window.__WRITES.filter(w => w.k.includes("designs")),
    price0: JSON.parse(localStorage.getItem("loli-studio.designs.v1")).find(x => x.id === Store.currentId()).sourcing[0].price,
    curId: Store.currentId(),
    lsCur: localStorage.getItem("loli-studio.designs.v1.cur"),
  }));
  console.log("change后:", JSON.stringify(post, null, 2));
  await browser.close();
})().then(() => process.exit(0)).catch((e) => { console.error("FAIL:", String(e).slice(0, 300)); process.exit(1); }).finally(() => server.kill());
