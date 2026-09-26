/* 逐环实测：store 可写性 → Actions.run 直调 → 监听器绑定对象 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const server = spawn("python3", ["-m", "http.server", "8769", "--bind", "127.0.0.1"], { cwd: "prototype", stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => console.log("[页]", m.text().slice(0, 220)));
  await page.goto("http://127.0.0.1:8769/index.html", { waitUntil: "domcontentloaded" });
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

  const rings = await page.evaluate(() => {
    const out = {};
    const el = document.querySelector("[data-act='set-price']");
    out.el0 = el ? el.getAttribute("data-index") : null;
    // 环1：Store.patch 直调
    try { Store.patch(Store.currentId(), { __probe: 1 }, "环1"); out.ring1_storePatch = "OK"; } catch (e) { out.ring1_storePatch = "FAIL " + e.message; }
    out.afterRing1 = JSON.parse(localStorage.getItem("loli-studio.designs.v1"))[0].__probe === 1;
    // 环2：Actions.run 直调 set-price（绕过监听器）
    try {
      el.value = "10";
      Actions.run("set-price", el);
      const d0 = JSON.parse(localStorage.getItem("loli-studio.designs.v1")).find(x => x.id === Store.currentId());
      out.ring2_actionsRun = d0 && d0.sourcing && d0.sourcing[0].price === 10 ? "OK" : "FAIL 存储未变";
    } catch (e) { out.ring2_actionsRun = "FAIL " + e.message; }
    // 环3：监听器绑定对象核对（getEventListeners 仅 devtools 可用，改用特征行为：再挂一个自己的 change 看先后）
    out.viewId = document.getElementById("view") === document.querySelector("main") ? "同一元素" : "不同元素!";
    out.mainCount = document.querySelectorAll("main#view").length;
    return out;
  });
  console.log("逐环:", JSON.stringify(rings, null, 2));

  // 环4：真实 change 事件（fill+blur 模拟用户操作，而不是 dispatchEvent）
  await page.locator("[data-act='set-price']").nth(1).fill("20");
  await page.locator("[data-act='set-price']").nth(1).blur();
  await sleep(300);
  const afterBlur = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("loli-studio.designs.v1")).find(x => x.id === Store.currentId());
    return { price1: d.sourcing[1].price, nextBtn: !!document.querySelector("[data-act='next'][data-step='look']") };
  });
  console.log("真实blur后:", JSON.stringify(afterBlur));
  await browser.close();
})().then(() => process.exit(0)).catch((e) => { console.error("FAIL:", String(e).slice(0, 300)); process.exit(1); }).finally(() => server.kill());
