/* 探针：验证 change 委托链每一环 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const server = spawn("python3", ["-m", "http.server", "8768", "--bind", "127.0.0.1"], { cwd: "prototype", stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => console.log("[页]", m.text().slice(0, 160)));
  await page.goto("http://127.0.0.1:8768/index.html", { waitUntil: "domcontentloaded" });
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

  const probe = await page.evaluate(() => {
    const out = {};
    const view = document.getElementById("view");
    // 1) 在 view 上加探针
    view.addEventListener("change", (ev) => { out.__probeFired = true; console.log("[探针] change 冒泡到 view, target=", ev.target.tagName, ev.target.getAttribute && ev.target.getAttribute("data-act")); }, { once: true, capture: false });
    out.curId = Store.currentId();
    out.designs0 = JSON.parse(localStorage.getItem("loli-studio.designs.v1"))[0].id;
    out.designCount = JSON.parse(localStorage.getItem("loli-studio.designs.v1")).length;
    out.viewHasListener = typeof view.onload === "undefined"; // 占位
    out.input0 = document.querySelector("[data-act='set-price']") ? "有" : "无";
    return out;
  });
  console.log("探针前置:", JSON.stringify(probe));

  await page.locator("[data-act='set-price']").nth(0).fill("10");
  await page.locator("[data-act='set-price']").nth(0).dispatchEvent("change");
  await sleep(300);

  const after = await page.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem("loli-studio.designs.v1"));
    const d = arr.find(x => x.id === Store.currentId()) || arr[0];
    return { probeFired: window.__fired || "见日志", curSourcing0: (d.sourcing || [])[0] && d.sourcing[0].price, prices: (d.sourcing || []).map(s => s.price) };
  });
  console.log("填后存储:", JSON.stringify(after));
  await browser.close();
})().then(() => process.exit(0)).catch((e) => { console.error("FAIL:", String(e).slice(0, 300)); process.exit(1); }).finally(() => server.kill());
