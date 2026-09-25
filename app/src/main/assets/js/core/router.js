/* 页面注册层（组合语义：所有 step 注册叠加，绝不覆盖）
 * 依赖方向：无依赖。仅导出 registerPage / render / goto / STEPS。
 */
(function (global) {
  "use strict";
  var STEPS = [
    { id: "word",  n: 1, title: "设计词" },
    { id: "img",   n: 2, title: "出图" },
    { id: "part",  n: 3, title: "拆件" },
    { id: "check", n: 4, title: "查重" },
    { id: "buy",   n: 5, title: "采购" },
    { id: "look",  n: 6, title: "组合" },
    { id: "model", n: 7, title: "模特" },
    { id: "fact",  n: 8, title: "工厂" },
    { id: "cost",  n: 9, title: "成本" }
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

  global.Router = { STEPS: STEPS, registerPage: registerPage, render: render, goto: goto, idx: idx, views: views };
})(window);
