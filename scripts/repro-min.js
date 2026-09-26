/* 最小实验：单个 set-price 后观察存储与视图 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const server = spawn("python3", ["-m", "http.server", "8767", "--bind", "127.0.0.1"], { cwd: "prototype", stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("[cerr]", m.text().slice(0, 200)); });
  await page.goto("http://127.0.0.1:8767/index.html", { waitUntil: "domcontentloaded" });
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

  const dump = async (tag) => {
    const o = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem("loli-studio.designs.v1"))[0];
      return { prices: (d.sourcing || []).map(s => s.price), complete: (d.sourcing || []).every(s => typeof s.price === "number"), nextBtn: !!document.querySelector("[data-act='next'][data-step='look']"), hint0: (document.querySelector(".block .hint") || {}).textContent };
    });
    console.log(tag, JSON.stringify(o));
  };
  await dump("填充前:");
  await page.locator("[data-act='set-price']").nth(0).fill("10");
  await page.locator("[data-act='set-price']").nth(0).dispatchEvent("change");
  await sleep(200);
  await dump("填1个后:");
  await page.locator("[data-act='set-price']").nth(1).fill("10");
  await page.locator("[data-act='set-price']").nth(1).dispatchEvent("change");
  await sleep(200);
  await dump("填2个后:");
  await browser.close();
})().then(() => process.exit(0)).catch((e) => { console.error("FAIL:", String(e).slice(0, 300)); process.exit(1); }).finally(() => server.kill());
