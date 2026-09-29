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

    // —— 成团判定 + 流团退款（文档 §四 / §五）——
    ACT["judge-pre"] = function () {
      var d = cur();
      if (!d || !d.pre) { toast("先开团"); return; }
      if (!(d.orders || []).length) { report("还没有定金单，无法判定"); return; }
      var j = OrderModel.judgePre(d.pre, d.orders);
      if (j.__error) { report(j.__error); return; }
      patch("成团判定：" + j.designState + (j.partial ? "（部分成团）" : ""), { judge: j });
      var msg = j.failed.length
        ? "判定完成：" + j.enough.length + " 个批次成团，" + j.failed.length + " 个流团"
        : "判定完成：全部成团";
      toast(msg);
    };

    ACT["build-refund"] = function () {
      var d = cur();
      if (!d || !d.judge) { toast("先判定成团"); return; }
      if (!d.judge.refundable.length) { toast("没有需要退款的订单"); return; }
      var list = OrderModel.buildRefundList(d.pre, d.orders, d.judge);
      patch("生成流团退款清单（" + list.count + " 单）", { refundList: list });
      toast("清单已生成：应退 " + list.total + " 元（真实退款请在平台操作）");
    };

    // 标记已退款：把清单里的订单推进「退款中 → 已退款」（走状态机校验）
    ACT["mark-refunded"] = function () {
      var d = cur();
      if (!d || !d.refundList || !d.refundList.rows.length) { toast("先生成退款清单"); return; }
      var ids = {};
      d.refundList.rows.forEach(function (r) { ids[r.anonId] = true; });
      var events = (d.orderEvents || []).slice();
      var changed = 0, blocked = [];
      var orders = (d.orders || []).map(function (o) {
        if (!ids[o.anonId]) return o;
        var step1 = OrderModel.canTransit(o.state, "退款中");
        if (!step1) { blocked.push(o.anonId + "（" + o.state + "）"); return o; }
        events.push({ at: new Date().toISOString(), anonId: o.anonId, act: "流团退款",
                      from: o.state, to: "已退款", why: "未达成团线" });
        changed++;
        return Object.assign({}, o, { state: "已退款" });
      });
      if (!changed) { report("没有可退款的订单处于合法状态。" + (blocked.length ? "受阻：" + blocked.join("、") : "")); return; }
      patch("标记已退款 " + changed + " 单", { orders: orders, orderEvents: events });
      toast("已退款 " + changed + " 单" + (blocked.length ? "，" + blocked.length + " 单状态不允许" : ""));
    };

    ACT["apply-design-state"] = function () {
      var d = cur();
      if (!d || !d.judge) { toast("先判定成团"); return; }
      var target = d.judge.designState;
      var from = d.designState || "预售中";
      if (!OrderModel.canTransitDesign(from, target)) { report("款状态不允许 " + from + " → " + target); return; }
      patch("款状态：" + from + " → " + target, { designState: target });
      toast("款状态已改为「" + target + "」");
    };

    return ACT;
  }

  global.Actions = global.Actions || {};
  global.Actions.registerPre = registerPre;
})(window);
