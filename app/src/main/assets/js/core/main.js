/* 入口：唯一一次事件绑定。失败品教训：绑定散落 = 按钮失效。
 * 每个稳定容器（view/steps/sheet/btn-history/badge-mock/form-settings）只在 init 里绑一次，
 * 后续 render 只换 innerHTML，事件通过委托自动生效。
 */
(function (global) {
  "use strict";

  // 页面视图注册（追加，不覆盖）
  Router.registerPage("word",    R.vWord);
  Router.registerPage("img",     R.vImg);
  Router.registerPage("part",    R.vPart);
  Router.registerPage("check",   R.vCheck);
  Router.registerPage("buy",     R.vBuy);
  Router.registerPage("look",    R.vLook);
  Router.registerPage("model",   R.vModel);
  Router.registerPage("fact",    R.vFact);
  Router.registerPage("cost",    R.vCost);
  Router.registerPage("history", R.vHistory);

  // 全局状态
  global.ST = global.ST || { step: "word" };
  global.ST_VIEW = null;

  function ensureDesign() {
    if (Store.currentId() && Store.getDesign(Store.currentId())) return;
    var arr = Store.listDesigns();
    if (arr.length) {
      Store.setCurrentId(arr[0].id);
      global.ST.step = arr[0].step || "word";
      return;
    }
    var d = Store.newDesign("");
    Store.saveDesign(d);
    Store.setCurrentId(d.id);
    global.ST.step = "word";
  }

  function stepNameOf(id) {
    for (var i = 0; i < Router.STEPS.length; i++) if (Router.STEPS[i].id === id) return Router.STEPS[i].title;
    return "";
  }

  function render() {
    var viewEl = document.getElementById("view");
    var titleEl = document.getElementById("title");
    var badge = document.getElementById("badge-mock");
    var progressEl = document.getElementById("progress-fill");
    var stepsEl = document.getElementById("steps");

    var isReal = AI.mode() === "real";
    badge.textContent = isReal ? "AI" : "演示";
    badge.classList.toggle("real", isReal);

    if (global.ST_VIEW === "history") {
      titleEl.textContent = "历史";
      progressEl.style.width = "100%";
      viewEl.innerHTML = R.vHistory(Store.listDesigns());
    } else {
      ensureDesign();
      var d = Store.getDesign(Store.currentId());
      var step = d ? d.step : "word";
      if (!Router.views[step]) step = "word";
      global.ST.step = step;
      titleEl.textContent = stepNameOf(step);
      var idx = Router.idx(step);
      progressEl.style.width = Math.round(idx / (Router.STEPS.length - 1) * 100) + "%";
      viewEl.innerHTML = Router.render(step, d);
    }

    stepsEl.innerHTML = R.tabbar(global.ST_VIEW === "history" ? "word" : global.ST.step);
  }
  global.__render = render;

  function init() {
    ensureDesign();

    var viewEl = document.getElementById("view");
    var stepsEl = document.getElementById("steps");
    var sheetEl = document.getElementById("sheet");
    var form = document.getElementById("form-settings");

    // 1) 主视图 / 底部步骤条：委托绑定一次
    Actions.bind(viewEl, viewEl);
    Actions.bind(stepsEl, stepsEl);

    // 2) 「历史」按钮：直接分发动作
    document.getElementById("btn-history").addEventListener("click", function () {
      Actions.run("history", null);
    });

    // 3) 顶部徽章 = 打开接口设置（可切换 mock/real）
    document.getElementById("badge-mock").addEventListener("click", function () {
      Actions.run("open-settings", null);
    });

    // 4) 点遮罩关闭
    sheetEl.addEventListener("click", function (ev) {
      if (ev.target === sheetEl) sheetEl.classList.remove("open");
    });
    Actions.bind(sheetEl, sheetEl);

    // 5) 设置表单提交：只绑一次
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      Store.setCfg({
        base:  document.getElementById("in-base").value.trim(),
        key:   document.getElementById("in-key").value.trim(),
        model: document.getElementById("in-model").value.trim()
      });
      sheetEl.classList.remove("open");
      render();
      Actions.toast(AI.mode() === "real" ? "接口已保存（真实模式）" : "演示模式");
    });

    render();
  }

  // 全局错误兜底：不吞错，把信息显出来
  window.addEventListener("error", function (ev) {
    var b = document.getElementById("boot-error");
    if (!b) {
      b = document.createElement("div");
      b.id = "boot-error";
      b.style.cssText = "color:#d96b6b;font-size:11px;padding:8px;background:rgba(217,107,107,.1);border-radius:6px;margin:8px";
      document.body.insertBefore(b, document.body.firstChild);
    }
    b.textContent = "错误：" + (ev.message || ev.error) + (ev.filename ? " · " + ev.filename + ":" + ev.lineno : "");
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
