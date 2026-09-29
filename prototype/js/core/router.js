/* 页面注册层（组合语义：所有 step 注册叠加，绝不覆盖）
 * 依赖方向：无依赖。仅导出 registerPage / render / goto / STEPS。
 */
(function (global) {
  "use strict";
  var STEPS = [
    { id: "plan",  n: 0, title: "企划" },
    { id: "word",  n: 1, title: "设计词" },
    { id: "img",   n: 2, title: "出图" },
    { id: "vote",  n: 3, title: "图透" },
    { id: "part",  n: 4, title: "拆件" },
    { id: "check", n: 5, title: "查重" },
    { id: "buy",   n: 6, title: "采购" },
    { id: "look",  n: 7, title: "组合" },
    { id: "model", n: 8, title: "模特" },
    { id: "fact",  n: 9, title: "工厂" },
    { id: "cost",  n: 10, title: "成本" },
    { id: "final", n: 11, title: "定样" },
    { id: "pre",   n: 12, title: "预售" }
  ];
  var views = {};

  function registerPage(id, fn) {
    if (!views[id]) views[id] = [];
    views[id].push(fn);           // 追加，不覆盖
  }

  function render(id, ctx) {
    var list = views[id];
    if (!list || !list.length) return '<div class="empty">未注册视图：' + id + '</div>';
    return list.map(function (fn) { return fn(ctx); }).join("");
  }

  function goto(id) {
    if (!views[id]) return false;
    global.ST = (global.ST || { step: 0 });
    ST.step = id;
    global.__render && __render();
    return true;
  }

  function idx(id) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i;
    return 0;
  }

  // 取某步的相邻步（避免各文件写死 "word"/"img" 这类字面量）
  function prevId(id) { var i = idx(id); return i > 0 ? STEPS[i - 1].id : ""; }
  function nextId(id) { var i = idx(id); return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1].id : ""; }

  global.Router = { STEPS: STEPS, registerPage: registerPage, render: render, goto: goto,
    idx: idx, prevId: prevId, nextId: nextId, views: views };
})(window);
