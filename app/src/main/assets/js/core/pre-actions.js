/* 预售开团动作（独立文件，避免 actions.js 超 400 行）
 * 依赖：actions.js 通过 Actions.registerPre(ACT, 工具) 注入。
 * 隐私硬约束：录入定金单只产生匿名 ID，不采集姓名/电话/地址。
 */
(function (global) {
  "use strict";

  function registerPre(ACT, H) {
    var patch = H.patch, cur = H.cur, report = H.report, toast = H.toast;
    var Factory = global.Factory, OrderModel = global.OrderModel;

    ACT["open-pre"] = function () {
      var d = cur();
      if (!d || !d.final || d.final.__error) { toast("先在第 11 步完成定样"); return; }
      var res = OrderModel.openPre(d.final, d.pre);
      if (res.__error) { report(res.__error); return; }
      patch("开团", { pre: res });
      toast("已开 " + res.batches.length + " 个批次");
    };

    ACT["add-orders"] = function () {
      var d = cur();
      if (!d || !d.pre) { toast("先开团"); return; }
      var ta = document.getElementById("in-orders");
      var text = ta ? ta.value : "";
      var parsed = OrderModel.parseOrderLines(text, d.pre);
      if (parsed.errors.length) {
        report("第 " + parsed.errors[0].line + " 行有问题：" + parsed.errors[0].reason +
          (parsed.errors.length > 1 ? "（共 " + parsed.errors.length + " 行有问题）" : ""));
        return;
      }
      if (!parsed.rows.length) { toast("没有可录入的订单"); return; }
      var made = OrderModel.makeOrders(d.pre, parsed.rows);
      // 匿名 ID 从 d.pre.nextAnon 起继续，不回退（防止 ID 重复）
      var pre = JSON.parse(JSON.stringify(d.pre));
      pre.nextAnon = made.nextAnon;
      patch("录入定金单 " + made.orders.length + " 条", {
        pre: pre, orders: (d.orders || []).concat(made.orders)
      });
      toast("已录入 " + made.orders.length + " 单");
    };

    return ACT;
  }

  global.Actions = global.Actions || {};
  global.Actions.registerPre = registerPre;
})(window);
