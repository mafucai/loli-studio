/* innerHTML 陷阱复现：抓谁设置 innerHTML 失败（元素 + 调用栈 + 原始报错） */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
fs.mkdirSync("/tmp/repro-results", { recursive: true });
const server = spawn("python3", ["-m", "http.server", "8766", "--bind", "127.0.0.1"], { cwd: "prototype", stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await sleep(800);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (m) => console.log("[console." + m.type() + "]", m.text().slice(0, 200)));
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

  // 陷阱：包住 Element.prototype.innerHTML setter，失败时打印元素与调用栈
  await page.addInitScript(() => {
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    Object.defineProperty(Element.prototype, "innerHTML", {
      get: desc.get,
      set(v) {
        try { desc.set.call(this, v); }
        catch (e) {
          const id = this.id ? "#" + this.id : "";
          window.__TRAP = (window.__TRAP || []);
          window.__TRAP.push({ el: this.tagName + id + "." + this.className, err: String(e && e.message || e), stack: (e && e.stack || "").split("\n").slice(0, 6).join(" | ") });
          console.error("[TRAP innerHTML]", this.tagName + id, String(e && e.message || e));
          throw e;
        }
      },
      configurable: true,
    });
  });

  await page.goto("http://127.0.0.1:8766/index.html", { waitUntil: "domcontentloaded" });
  const step = async (n, fn) => { console.log("·", n); await fn(); };

  await step("填设计词", () => page.fill("#in-prompt", "雾霾蓝英式下午茶"));
  await step("gen-words", () => page.click("[data-act='gen-words']"));
  await step("next img", () => page.click("[data-act='next'][data-step='img']"));
  await step("gen-img", () => page.click("[data-act='gen-img']"));
  await step("pass-img", () => page.click("[data-act='pass-img']"));
  await step("next part", () => page.click("[data-act='next'][data-step='part']"));
  await step("gen-bom", () => page.click("[data-act='gen-bom']"));
  await step("next check", () => page.click("[data-act='next'][data-step='check']"));
  await step("run-check", () => page.click("[data-act='run-check']"));
  for (const name of ["小红书", "抖音", "淘宝", "拼多多", "闲鱼"]) await page.click(`text=${name} 官方搜索 >> xpath=.. >> text=原创`);
  await step("mark-original", () => page.click("[data-act='mark-original']"));
  await step("next buy", () => page.click("[data-act='next'][data-step='buy']"));
  await step("run-sourcing", () => page.click("[data-act='run-sourcing']"));
  const prices = page.locator("[data-act='set-price']");
  console.log("set-price 数量:", await prices.count());
  for (let i = 0; i < await prices.count(); i++) { await prices.nth(i).fill("10"); await prices.nth(i).dispatchEvent("change"); }
  await step("next look", () => page.click("[data-act='next'][data-step='look']").catch(async (e) => {
    const diag = await page.evaluate(() => ({
      trap: window.__TRAP || null,
      errBox: document.getElementById("error-box") ? document.getElementById("error-box").textContent : null,
      viewLen: (document.getElementById("view") || { innerHTML: "" }).innerHTML.length,
      viewHead: (document.getElementById("view") || { innerHTML: "?" }).innerHTML.slice(0, 260),
      acts: Array.from(document.querySelectorAll("[data-act]")).map(b => b.getAttribute("data-act")).slice(0, 40),
      ls: Object.keys(localStorage).map(k => k + "=" + String(localStorage.getItem(k)).slice(0, 80)),
    }));
    console.log("== next look 失败诊断 ==", JSON.stringify(diag, null, 2));
    await page.screenshot({ path: "/tmp/repro-results/next-look-fail.png", fullPage: true });
    throw e;
  }));
  await step("gen-combo", () => page.click("[data-act='gen-combo']"));
  await step("next model", () => page.click("[data-act='next'][data-step='model']"));
  await step("gen-model", () => page.click("[data-act='gen-model']"));
  await step("next fact", () => page.click("[data-act='next'][data-step='fact']"));
  await step("run-factories", () => page.click("[data-act='run-factories']"));
  await page.fill("#factory-name", "真实工厂"); await page.fill("#factory-region", "杭州");
  await page.fill("#factory-contact", "已核对"); await page.fill("#factory-min", "30");
  await page.fill("#factory-cost", "160");
  await step("add-factory", () => page.click("[data-act='add-factory']"));
  await step("pick-fact", () => page.click("[data-act='pick-fact']"));
  await step("next cost", () => page.click("[data-act='next'][data-step='cost']"));
  await page.fill("#cost-price", "399"); await page.fill("#cost-fee", "6");
  await page.fill("#cost-ship", "8"); await page.fill("#cost-pack", "3");
  await page.fill("#cost-fixed", "500"); await page.fill("#cost-qty", "100");
  await step("run-finance", () => page.click("[data-act='run-finance']"));
  await sleep(300);

  // 关键观测点：run-finance 之后、点历史之前，错误框/陷阱是否已出现
  const mid = await page.evaluate(() => ({
    trap: window.__TRAP || null,
    errBox: document.getElementById("error-box") ? document.getElementById("error-box").textContent : null,
    financeShown: !!document.body.textContent.includes("总利润"),
  }));
  console.log("== 中点观测 ==", JSON.stringify(mid, null, 2));

  await step("点 btn-history", () => page.click("#btn-history", { timeout: 5000 }));
  await sleep(300);
  const end = await page.evaluate(() => ({ trap: window.__TRAP || null, errBox: document.getElementById("error-box") ? document.getElementById("error-box").textContent : null, historyShown: !!document.querySelector(".history-item") }));
  console.log("== 终点观测 ==", JSON.stringify(end, null, 2));
  await page.screenshot({ path: "/tmp/repro-results/end.png", fullPage: true });
  await browser.close();
}
run().then(() => { console.log("DONE"); process.exit(0); }).catch((e) => { console.error("FAIL:", String(e).slice(0, 500)); process.exit(1); }).finally(() => server.kill());
