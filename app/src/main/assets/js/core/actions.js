/* 动作层：事件委托 + 业务动作。禁 document. 直接引用具体元素，
 * 只通过 event.target.closest('[data-act]') 分发（失败品反模式禁止）。
 */
(function (global) {
  "use strict";

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

  ACT["gen-words"] = function () {
    var ta = document.getElementById("in-prompt");
    var prompt = ta ? ta.value.trim() : "";
    if (!prompt) { toast("先写一句设计需求"); return; }
    var d = cur();
    if (!d) { toast("请先从「历史」里选一条或新建"); return; }
    Store.setCurrentId(d.id);
    var w = Factory.designWords(prompt);
    patch("生成设计词", { prompt: prompt, words: w });
    toast(AI.mode() === "real" ? "AI 生成完成" : "演示模式：本地生成完成");
  };

  ACT["gen-img"] = function () {
    var d = cur();
    if (!d) return;
    if (!d.words) { toast("先生成设计词"); return; }
    var seed = d.words.color + d.words.style + Date.now();
    var uri = AI.img("dress", seed, 360, 480);
    patch("生成图", { imgUri: uri, imgPassed: false });
    toast(AI.mode() === "real" ? "AI 出图完成" : "演示模式：本地出图");
  };

  ACT["pass-img"] = function () { patch("通过图", { imgPassed: true }); toast("已通过，去拆件"); };
  ACT["reject-img"] = function () { patch("驳回图", { imgUri: null, imgPassed: false }); };

  ACT["gen-bom"] = function () {
    var d = cur();
    if (!d || !d.words) { toast("先生成设计词"); return; }
    patch("生成 BOM", { bom: Factory.bom(d.words) });
  };

  ACT["run-check"] = function () {
    var d = cur();
    if (!d || !d.bom) { toast("先生成 BOM"); return; }
    patch("查重", { check: Factory.dedup(d.bom.words) });
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
    if (!d || !d.markedOriginal) { toast("先标原创"); return; }
    patch("拉采购", { sourcing: Factory.sourcing(d.bom) });
  };

  ACT["gen-combo"] = function () {
    var d = cur();
    if (!d || !d.sourcing) { toast("先完成采购"); return; }
    patch("合成组合", { combo: Factory.combo(d.bom) });
  };

  ACT["gen-model"] = function () {
    var d = cur();
    if (!d || !d.combo) { toast("先完成组合"); return; }
    patch("生成模特", { model: Factory.model(d.bom) });
  };

  ACT["run-factories"] = function () {
    var d = cur();
    if (!d || !d.model) { toast("先生成模特图"); return; }
    patch("搜工厂", { factories: Factory.factories(d.bom) });
  };

  ACT["pick-fact"] = function (el) {
    var d = cur();
    if (!d || !d.factories) return;
    var i = parseInt(el.getAttribute("data-idx"), 10);
    var f = d.factories[i];
    if (!f) return;
    patch("选工厂", { pickedFactory: f });
    toast("已选：" + f.name);
  };
  ACT["call-fact"] = function (el) {
    var d = cur();
    if (!d || !d.factories) return;
    var i = parseInt(el.getAttribute("data-idx"), 10);
    var f = d.factories[i];
    if (!f) return;
    toast("联系：" + f.name + " · " + f.contact);
  };

  ACT["run-finance"] = function () {
    var d = cur();
    if (!d || !d.pickedFactory) { toast("先选工厂"); return; }
    patch("算成本", { finance: Factory.finance(d.bom, d.factories, [50, 100, 200, 500]) });
  };

  ACT["goto"] = function (el) {
    var id = el.getAttribute("data-step");
    Router.goto(id);
  };
  ACT["next"] = function (el) {
    Router.goto(el.getAttribute("data-step"));
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
  ACT["open-history"] = function (el) {
    var id = el.getAttribute("data-id");
    Store.setCurrentId(id);
    var d = Store.getDesign(id);
    if (d) Router.goto(d.step);
    global.ST_VIEW = null;
    global.__render && __render();
  };

  ACT["del-cur"] = function () {
    var id = curId();
    if (!id) return;
    Store.deleteDesign(id);
    Store.setCurrentId("");
    Router.goto("word");
    global.__render && __render();
    toast("已删除");
  };

  ACT["close-sheet"] = function () { document.getElementById("sheet").hidden = true; };
  ACT["open-settings"] = function () {
    var c = Store.getCfg();
    document.getElementById("in-base").value = c.base || "";
    document.getElementById("in-key").value = c.key || "";
    document.getElementById("in-model").value = c.model || "";
    document.getElementById("sheet").hidden = false;
  };

  function saveSettings(ev) {
    ev.preventDefault();
    var base = document.getElementById("in-base").value.trim();
    var key = document.getElementById("in-key").value.trim();
    var model = document.getElementById("in-model").value.trim();
    Store.setCfg({ base: base, key: key, model: model });
    document.getElementById("sheet").hidden = true;
    global.__render && __render();
    toast(AI.mode() === "real" ? "接口已保存（真实模式）" : "演示模式");
  }

  function bind(viewEl, container) {
    viewEl.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-act]");
      if (!el) return;
      var act = el.getAttribute("data-act");
      if (ACT[act]) {
        try { ACT[act](el, container); }
        catch (e) { console.error("[act]", act, e); toast("操作失败：" + (e.message || e)); }
      }
    });
    // 表单提交（设置）
    if (container.id === "form-settings") container.addEventListener("submit", saveSettings, false);
  }

  global.Actions = { bind: bind, toast: toast, run: run };
  // 供外部把 data-act 字符串直接分发给动作层，用于程序化触发
  function run(actName, el) {
    if (ACT[actName]) {
      try { ACT[actName](el); }
      catch (e) { console.error("[act]", actName, e); toast("操作失败：" + (e.message || e)); }
    }
  }
})(window);
