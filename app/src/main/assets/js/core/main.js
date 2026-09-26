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
        model: document.getElementById("in-model").value.trim(),
        imageModel: document.getElementById("in-image-model").value.trim()
      });
      sheetEl.classList.remove("open");
      render();
      Actions.toast(AI.mode() === "real" ? "接口已保存（真实模式）" : "演示模式");
    });

    render();
  }

  // ===== 报错助手：常驻入口 + 可展开面板 =====
  // 设计要点：无错误时也可见（角标显示 ✓ 已就绪），点开能看到「已捕获 N 条」，
  // 这样用户能确认它在工作，而不是「想看的时候它不出现」。
  var ERR = { list: [], max: 50 };

  function errTime() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function errPaint() {
    var dot = document.getElementById("errdot");
    var sum = document.getElementById("errsum");
    var body = document.getElementById("errbody");
    var foot = document.getElementById("errfoot");
    if (!dot || !body) return;
    var n = ERR.list.length;
    dot.textContent = n === 0 ? "✓" : String(n);
    dot.className = "errdot " + (n === 0 ? "ok" : "bad");
    if (sum) sum.textContent = n === 0 ? "就绪 · 已捕获 0 条" : "已捕获 " + n + " 条";
    if (n === 0) {
      body.innerHTML = '<div class="errrow"><div class="txt muted">暂未捕获到错误。运行正常。</div></div>';
    } else {
      body.innerHTML = ERR.list.map(function (e) {
        return '<div class="errrow"><div class="meta">' + e.at
          + '<span class="src ' + e.src + '">' + e.src + '</span></div>'
          + '<div class="txt">' + esc(e.text) + '</div></div>';
      }).join("");
    }
    if (foot) foot.textContent = "收到错误会立刻显示在此，并写入 logcat（LoliStudio / LoliStudio-JS）。";
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // 统一入口：页面侧、原生桥都走这里，避免重复上报
  function errAdd(text, src) {
    var key = src + "|" + text;
    for (var i = 0; i < ERR.list.length; i++) {
      if (ERR.list[i].key === key && Date.now() - ERR.list[i].ts < 3000) return; // 3 秒内同错去重
    }
    ERR.list.push({ key: key, ts: Date.now(), at: errTime(), src: src || "js", text: text });
    if (ERR.list.length > ERR.max) ERR.list.shift();
    errPaint();
  }
  global.__errAdd = errAdd;

  function reportToNative(msg) {
    try {
      if (window.NativeErrorBridge && window.NativeErrorBridge.logError) {
        window.NativeErrorBridge.logError(String(msg));
      }
    } catch (_) { /* 桥不可用（浏览器）时静默 */ }
  }

  function errBindPanel() {
    var dot = document.getElementById("errdot");
    var panel = document.getElementById("errpanel");
    if (!dot || !panel) return;
    dot.addEventListener("click", function () { panel.classList.toggle("open"); });
    var close = document.getElementById("errclose");
    if (close) close.addEventListener("click", function () { panel.classList.remove("open"); });
    var clear = document.getElementById("errclear");
    if (clear) clear.addEventListener("click", function () { ERR.list = []; errPaint(); });
    var copy = document.getElementById("errcopy");
    if (copy) copy.addEventListener("click", function () {
      var txt = ERR.list.map(function (e) { return e.at + " [" + e.src + "] " + e.text; }).join("\n");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt);
        } else {
          var ta = document.createElement("textarea");
          ta.value = txt; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); ta.remove();
        }
        Actions.toast("已复制 " + ERR.list.length + " 条");
      } catch (e) { Actions.toast("复制失败，请手动长按选择"); }
    });
    errPaint();
  }

  window.addEventListener("unhandledrejection", function (ev) {
    var reason = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason || "未知异步错误");
    errAdd("unhandledrejection: " + reason, "js");
    Actions.report(reason);
    reportToNative("unhandledrejection: " + reason);
  });

  // 捕获阶段：资源加载失败（IMG/SCRIPT/LINK）不冒泡，只有 capture 能抓到
  window.addEventListener("error", function (ev) {
    var t = ev.target;
    var msg;
    if (t && t.tagName && /^(IMG|SCRIPT|LINK)$/.test(t.tagName)) {
      msg = "资源加载失败: " + t.tagName + " " + (t.src || t.href || "");
    } else {
      msg = (ev.message || ev.error || "未知错误")
          + (ev.filename ? " · " + ev.filename + ":" + ev.lineno : "");
    }
    errAdd(msg, "js");
    reportToNative(msg);
  }, true);

  // 原生桥注入的错误，回显到同一个面板（避免只进 logcat 看不见）
  window.__nativeError = function (msg) { errAdd(String(msg), "native"); };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { errBindPanel(); init(); });
  } else {
    errBindPanel();
    init();
  }
})(window);
