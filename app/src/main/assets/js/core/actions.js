/* 动作层：事件委托 + 业务动作。禁 document. 直接引用具体元素，
 * 只通过 event.target.closest('[data-act]') 分发（失败品反模式禁止）。
 */
(function (global) {
  "use strict";

    function report(msg) {
      var box = document.getElementById("error-box");
      if (!box) {
        box = document.createElement("div");
        box.id = "error-box";
        box.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:80;padding:12px;border-radius:10px;background:#3a1717;color:#ffd7d7;font-size:13px;line-height:1.5";
        document.body.appendChild(box);
      }
      box.textContent = "错误：" + msg;
      box.addEventListener("click", function () { box.remove(); }, { once: true });
    }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 1600);
  }

  // 找到当前正在编辑的设计单 id
  function curId() {
    return global.Store.currentId();
  }
  function cur() {
    return global.Store.getDesign(curId());
  }
  function patch(action, obj) {
    var id = curId();
    var d = global.Store.patch(id, obj, action);
    global.__render && __render();
    return d;
  }

  var ACT = {};

    ACT["gen-words"] = async function () {
      var ta = document.getElementById("in-prompt");
      var prompt = ta ? ta.value.trim() : "";
      if (!prompt) { toast("先写一句设计需求"); return; }
      var d = cur();
      if (!d) { toast("请先从历史里选一条或新建"); return; }
      Store.setCurrentId(d.id);
      if (AI.mode() !== "real") {
        patch("演示设计词", { prompt: prompt, words: Factory.designWords(prompt), wordsSource: "demo" });
        toast("演示模式：本地生成");
        return;
      }
      toast("正在调用文本接口");
      var reply = await AI.chat(prompt, { system: "你是洛丽塔服装设计助手。只返回 JSON，不要 Markdown。字段：style、season、mainFabric、color、details、decors、sizes、mood。三个数组字段必须是字符串数组。" });
      if (reply && reply.__error) { report(reply.__error); return; }
      var parsed;
      try { parsed = JSON.parse(String(reply).replace(/^```json\s*|```$/g, "").trim()); }
      catch (e) { report("接口返回不是有效 JSON：" + reply); return; }
      var words = { prompt: prompt, style: String(parsed.style || ""), season: String(parsed.season || ""), mainFabric: String(parsed.mainFabric || ""), color: String(parsed.color || ""), details: Array.isArray(parsed.details) ? parsed.details.map(String) : [], decors: Array.isArray(parsed.decors) ? parsed.decors.map(String) : [], sizes: Array.isArray(parsed.sizes) ? parsed.sizes.map(String) : [], mood: String(parsed.mood || "") };
      if (!words.style || !words.color || !words.mainFabric || !words.details.length) { report("接口结果缺少必要字段"); return; }
      patch("真实设计词", { prompt: prompt, words: words, wordsSource: "ai" });
      toast("文本接口生成完成");
    };

  async function makeImage(kind, prompt, save){
    if(AI.imageMode()!=="real"){
      var d=cur();
      save(AI.img(kind, Date.now(), 360, 480), "demo");
      toast("演示图");
      return;
    }
    var secs = 0;
    var stage = "准备中";
    global.__imgProgress = function (msg) { stage = msg || stage; };
    toast("正在生成图片…（" + stage + "）");
    var tick = setInterval(function(){
      secs += 5;
      toast("正在生成图片…（" + secs + " 秒 · " + stage + "）");
    }, 5000);
    try {
      var result = await AI.image(prompt);
      if (result.__error) { report(result.__error); return; }
      save(result.uri, "ai");
      toast("图片生成完成");
    } catch (e) {
      report("图片生成异常：" + (e && e.message ? e.message : String(e)));
    } finally {
      clearInterval(tick);
      global.__imgProgress = null;
    }
  }
  ACT["gen-img"] = function () { var d=cur(); if(!d||!d.words){ toast("先生成设计词"); return; } var w=d.words; makeImage("dress","洛丽塔服装平铺图，"+w.color+"，"+w.style+"，"+w.mainFabric+"，细节："+w.details.join("、"), function(uri,source){ patch("生成图",{imgUri:uri,imgPassed:false,imgSource:source}); }); };


  ACT["pass-img"] = function () { patch("通过图", { imgPassed: true }); toast("已通过，去拆件"); };
  ACT["reject-img"] = function () { patch("驳回图", { imgUri: null, imgPassed: false }); };

  ACT["gen-bom"] = async function () {
    var d = cur();
    if (!d || !d.words) { toast("先生成设计词"); return; }
    // 真实模式：让文本 AI 真拆件；失败或演示模式：回退本地零件表（明确标注来源）
    if (AI.mode() === "real") {
      toast("正在让 AI 拆件…");
      var imgNote = d.imgUri ? (d.imgPassed ? "已通过审核的设计图" : "设计图") : "";
      var res = await AI.splitBom(d.words, imgNote);
      if (res && res.__error) {
        report(res.__error + "（已回退本地零件表）");
        patch("生成 BOM（本地）", { bom: Factory.bom(d.words) });
        return;
      }
      var local = Factory.bom(d.words);
      // 用 AI 的零件/工序，价格与固定成本沿用本地计算口径
      var bom = {
        rows: res.parts.map(function (p, i) {
          var base = local.rows[i % local.rows.length];
          return { part: p.part, material: p.material, amount: p.amount, unit: p.unit, price: base.price, subtotal: Math.round(p.amount * base.price), note: "" };
        }),
        labor: res.steps.length ? res.steps : local.labor,
        words: d.words
      };
      bom.fabricTotal = bom.rows.reduce(function (s, r) { return s + (r.subtotal || 0); }, 0);
      bom.fixedTotal = local.fixedTotal;
      bom.laborTotal = local.laborTotal;
      patch("AI 拆件", { bom: bom, bomSource: "ai" });
      toast("AI 拆件完成，共 " + bom.rows.length + " 个零件");
      return;
    }
    patch("生成 BOM（本地演示）", { bom: Factory.bom(d.words), bomSource: "demo" });
  };

  // AI 比价：给采购清单让文本 AI 判断哪家更便宜
  ACT["ai-compare"] = async function () {
    var d = cur();
    if (!d || !d.sourcing || !d.sourcing.length) { toast("先生成采购清单"); return; }
    if (AI.mode() !== "real") { toast("AI 比价需要先在接口设置里填文本接口"); return; }
    toast("正在让 AI 比价…");
    var res = await AI.comparePrice(d.sourcing);
    if (res && res.__error) { report(res.__error); return; }
    patch("AI 比价", { aiCompare: { items: res.items, at: new Date().toISOString() } });
    toast("AI 给了 " + res.items.length + " 条省钱建议，请点链接核实真实价格");
  };

    ACT["run-check"] = function () {
      var d = cur();
      if (!d || !d.words) { toast("先生成设计词"); return; }
      patch("生成查重入口", { check: Factory.dedup(d.words), markedOriginal: false });
    };
    ACT["set-check"] = function (el) {
      var d = cur();
      if (!d || !d.check) return;
      var index = Number(el.getAttribute("data-index"));
      var value = el.getAttribute("data-value");
      if (!d.check.results[index] || ["原创", "相近", "雷同"].indexOf(value) < 0) { report("查重选项无效"); return; }
      var check = JSON.parse(JSON.stringify(d.check));
      check.results[index].verdict = value;
      check.pass = check.results.every(function (item) { return item.verdict && item.verdict !== "雷同"; });
      patch("记录查重", { check: check, markedOriginal: false });
    };

  ACT["mark-original"] = function () {
    var d = cur();
    if (!d || !d.check || !d.check.pass) { toast("先通过查重"); return; }
    patch("标原创", { markedOriginal: true });
    toast("已标原创");
  };
  ACT["reject-original"] = function () {
    var d = cur();
    if (!d) return;
    patch("驳回原创", { markedOriginal: false, step: "word" });
    toast("回设计词改主色/廓形");
  };

    ACT["run-sourcing"] = function () {
      var d = cur();
      if (!d || !d.markedOriginal || !d.bom) { toast("先标原创并完成拆件"); return; }
      patch("生成采购入口", { sourcing: Factory.sourcing(d.bom) });
    };
    ACT["set-price"] = function (el) {
      var d = cur();
      if (!d || !d.sourcing) return;
      var index = Number(el.getAttribute("data-index"));
      var value = el.value.trim();
      var price = value === "" ? null : Number(value);
      if (price !== null && (!isFinite(price) || price < 0)) { report("单价必须是非负数字"); return; }
      var sourcing = JSON.parse(JSON.stringify(d.sourcing));
      if (!sourcing[index]) { report("采购项目不存在"); return; }
      sourcing[index].price = price;
      patch("记录真实单价", { sourcing: sourcing });
    };

  ACT["gen-combo"] = function () { var d=cur(); if(!d||!d.sourcing||!d.words){ toast("先完成采购"); return; } var w=d.words; makeImage("combo","洛丽塔服装组合平铺图，展示"+w.color+w.style+"主裙、裙撑、蝴蝶结和蕾丝", function(uri,source){ patch("合成组合",{combo:{uri:uri,note:source==="ai"?"图片接口生成":"演示图",source:source}}); }); };


  ACT["gen-model"] = function () { var d=cur(); if(!d||!d.combo||!d.words){ toast("先完成组合"); return; } var w=d.words; makeImage("model","模特穿着"+w.color+w.style+"洛丽塔裙，正面全身，服装细节清晰", function(uri,source){ patch("生成模特",{model:{uri:uri,note:source==="ai"?"图片接口生成":"演示图",source:source}}); }); };


    ACT["run-factories"] = function () {
      var d = cur();
      if (!d || !d.model) { toast("先生成模特图"); return; }
      patch("生成工厂搜索", { factories: Factory.factories(), pickedFactory: null });
    };
    ACT["add-factory"] = function () {
      var d = cur();
      if (!d || !d.factories) { toast("先生成工厂搜索"); return; }
      var name = document.getElementById("factory-name").value.trim();
      var region = document.getElementById("factory-region").value.trim();
      var contact = document.getElementById("factory-contact").value.trim();
      var min = Number(document.getElementById("factory-min").value);
      var unitCost = Number(document.getElementById("factory-cost").value);
      if (!name || !region || !contact || !isFinite(min) || min <= 0 || !isFinite(unitCost) || unitCost <= 0) { report("工厂名称、地区、联系方式、起订量和单价都要填写"); return; }
      var data = JSON.parse(JSON.stringify(d.factories));
      data.records.push({ name: name, region: region, contact: contact, min: min, unitCost: unitCost });
      patch("记录工厂", { factories: data });
      toast("工厂已记录");
    };
    ACT["pick-fact"] = function (el) {
      var d = cur();
      var index = Number(el.getAttribute("data-idx"));
      var item = d && d.factories && d.factories.records[index];
      if (!item) { report("工厂记录不存在"); return; }
      patch("选择工厂", { pickedFactory: item });
    };

    ACT["run-finance"] = function () {
      var d = cur();
      if (!d || !d.pickedFactory || !d.sourcing || !d.sourcing.length) { toast("先完成采购和工厂"); return; }
      if (!d.sourcing.every(function (item) { return typeof item.price === "number"; })) { report("采购单价还没填完"); return; }
      var material = d.sourcing.reduce(function (sum, item) { return sum + item.price * item.amount; }, 0);
      var result = Factory.finance({ material: material, labor: d.pickedFactory.unitCost, fixed: document.getElementById("cost-fixed").value, feeRate: document.getElementById("cost-fee").value, shipping: document.getElementById("cost-ship").value, pack: document.getElementById("cost-pack").value, price: document.getElementById("cost-price").value, qty: document.getElementById("cost-qty").value });
      if (result.error) { report(result.error); return; }
      patch("计算真实成本", { finance: result });
    };

  ACT["goto"] = function (el) {
    var id = el.getAttribute("data-step");
    var d = cur();
    if (d) Store.patch(d.id, { step: id }, "跳转：" + id);
    global.ST_VIEW = null;
    Router.goto(id);
    global.__render && __render();
  };
  ACT["next"] = function (el) {
    var id = el.getAttribute("data-step");
    var d = cur();
    if (d) Store.patch(d.id, { step: id }, "下一步：" + id);
    Router.goto(id);
  };

  ACT["new"] = function () {
    var d = Store.newDesign("");
    Store.saveDesign(d);
    Store.setCurrentId(d.id);
    Router.goto("word");
    global.__render && __render();
    toast("已新建设计单");
  };

  ACT["history"] = function () {
    global.ST_VIEW = global.ST_VIEW === "history" ? null : "history";
    if (global.ST_VIEW === "history") {
      global.__render && __render();
    }
  };

  // 历史页两个标签：设计单 / 图片
  ACT["hist-tab"] = function (el) {
    var tab = (el && el.getAttribute("data-tab")) || "orders";
    global.HIST_TAB = tab;
    global.__render && __render();
  };
  ACT["open-history"] = function (el) {
    var id = el.getAttribute("data-id");
    Store.setCurrentId(id);
    var d = Store.getDesign(id);
    if (d) Router.goto(d.step);
    global.ST_VIEW = null;
    global.__render && __render();
  };

  ACT["keep"] = function () {
    var d = cur();
    if (!d) { toast("没有可保存的设计单"); return; }
    var ta = document.getElementById("in-prompt");
    if (ta && ta.value.trim() !== d.prompt) d = Store.patch(d.id, { prompt: ta.value.trim() }, "保存草稿");
    toast(d ? "已保存" : "保存失败");
  };

  ACT["del-cur"] = function () {
    var id = curId();
    if (!id) return;
    if (!confirm("删除当前设计单？此操作不可恢复。")) return;
    Store.deleteDesign(id);
    Store.setCurrentId("");
    Router.goto("word");
    global.__render && __render();
    toast("已删除");
  };

  function bind(viewEl, container) {
    viewEl.addEventListener("change", function (ev) {
        var el = ev.target.closest("[data-act='set-price']");
        if (!el) return;
        try { ACT["set-price"](el); }
        catch (e) { report(e && e.message ? e.message : String(e)); }
      });
      viewEl.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-act]");
      if (!el) return;
      var act = el.getAttribute("data-act");
      if (ACT[act]) {
        try { ACT[act](el, container); }
        catch (e) { report(e && e.message ? e.message : String(e)); }
      }
    });
    // 表单提交（设置）：交给 Settings 模块处理，只绑一次
    if (global.Settings && global.Settings.bindForms) global.Settings.bindForms(container);
  }

  // 把 ACT 与公共函数注入 Settings 模块（接口设置/模型拉取/AI 搜索）
  if (global.Settings && global.Settings.register) {
    global.Settings.register(ACT, { toast: toast, report: report, patch: patch, cur: cur });
  }

  global.Actions = { bind: bind, toast: toast, report: report, run: run };
  // 供外部把 data-act 字符串直接分发给动作层，用于程序化触发
  function run(actName, el) {
    if (ACT[actName]) {
      try { ACT[actName](el); }
      catch (e) { report(e && e.message ? e.message : String(e)); }
    }
  }
})(window);
