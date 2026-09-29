/* 定样定价动作（从 actions.js 拆出，遵守单文件 ≤400 行铁律）
 * 依赖：由 actions.js 通过 Actions.registerFinal(ACT, 工具) 注入。
 * 语义：cost 页算「成本」，本页定「对外公布价 + 成团线 + 工期」。
 */
(function (global) {
  "use strict";

  function registerFinal(ACT, H) {
    var patch = H.patch, cur = H.cur, report = H.report, toast = H.toast;
    var Factory = global.Factory;

  // cost 页不动；本页填「对外公布价」，与成本页的测算售价语义不同
  ACT["run-final"] = function () {
    var d = cur();
    if (!d || !d.finance || d.finance.error) { toast("先在第 10 步算出成本"); return; }
    var colors = Factory.toColors(d.words ? d.words.color : []);
    if (!colors.length) { report("没有颜色：回设计词页重新生成"); return; }
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; };
    // SKU 目标件数直接从界面读（不落草稿，避免脏状态）；读不到才用默认
    var inputs = document.querySelectorAll ? document.querySelectorAll("[data-sku]") : [];
    var skus = [];
    for (var i = 0; i < inputs.length; i++) {
      var color = inputs[i].getAttribute("data-color");
      var v = Number(inputs[i].value);
      skus.push({ color: color, target: isFinite(v) && v > 0 ? v : Factory.DEFAULT_TARGET });
    }
    if (!skus.length) skus = Factory.buildSkus(colors);
    var res = Factory.financeFinal({
      price: g("fin-price"),
      cost: Number(d.finance.cost),
      depositRate: g("fin-rate") || Factory.DEFAULT_DEPOSIT_RATE,
      leadDays: g("fin-lead"),
      deadline: g("fin-deadline"),
      skus: skus,
      fixed: Number(d.finance.fixed) || 0
    });
    if (res.__error) { report(res.__error); return; }
    patch("定样定价", { final: res });
    toast("定样完成：定金 " + res.deposit + " / 尾款 " + res.balance);
  };
    return ACT;
  }

  global.Actions = global.Actions || {};
  global.Actions.registerFinal = registerFinal;
})(window);
