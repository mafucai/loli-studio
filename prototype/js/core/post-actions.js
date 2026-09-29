/* 批 E3 动作：补尾款 / 尾款逾期催款 / 发货（录真单号）/ 售后登记 / 看板 UV 录入
 * 注册方式与 pre-actions.js 一致：actions.js 通过 Actions.registerPost(ACT, H) 注入。
 * 边界：App 不收款、不自动通知、不代替平台。所有动作只改本地状态并留痕。
 */
(function (global) {
  "use strict";

  function registerPost(ACT, H) {
    var patch = H.patch, cur = H.cur, report = H.report, toast = H.toast;
    var OrderModel = global.OrderModel;

    function orderList() { var d = cur(); return (d && d.orders) || []; }
    function commit(list, msg) { patch(msg, { orders: list }); return true; }

    // ---- 补尾款：待尾款 / 尾款逾期 → 已付尾款 ----
    ACT["pay-tail"] = function () {
      var d = cur();
      if (!d || !d.pre) { toast("先在第 12 步开团"); return; }
      var list = orderList();
      var ids = list.filter(function (o) {
        return o.state === "待尾款" || o.state === "尾款逾期";
      }).map(function (o) { return o.anonId; });
      if (!ids.length) { toast("没有待补尾款的订单"); return; }
      var r = OrderModel.transitMany(list, ids, "已付尾款", "补尾款", "商家");
      commit(r.orders, "补尾款 " + r.done.length + " 单");
      toast("已登记补尾款 " + r.done.length + " 单" +
        (r.failed.length ? "，失败 " + r.failed.length + " 单：" + r.failed[0].reason : ""));
    };

    // ---- 尾款逾期：标记逾期 → 生成催款清单（§五：不自动发）----
    ACT["tail-overdue"] = function () {
      var d = cur();
      if (!d || !d.pre) { toast("先开团"); return; }
      var list = orderList();
      var ids = list.filter(function (o) { return o.state === "待尾款"; })
                    .map(function (o) { return o.anonId; });
      if (!ids.length) { toast("没有待尾款订单"); return; }
      var r = OrderModel.transitMany(list, ids, "尾款逾期", "超期未补尾款", "系统");
      var dun = OrderModel.buildTailDunning(r.orders, ids);
      patch("标记尾款逾期 " + r.done.length + " 单", { orders: r.orders, tailDunning: dun });
      toast("已标记 " + r.done.length + " 单逾期，催款清单已生成（App 不自动发送）");
    };

    // ---- 发货：待发货 → 已发货（发货后才允许录真单号）----
    ACT["ship"] = function () {
      var d = cur();
      if (!d || !d.pre) { toast("先开团"); return; }
      var list = orderList();
      var ids = list.filter(function (o) { return o.state === "待发货"; })
                    .map(function (o) { return o.anonId; });
      if (!ids.length) { toast("没有待发货订单"); return; }
      var r = OrderModel.transitMany(list, ids, "已发货", "发货", "商家");
      commit(r.orders, "发货 " + r.done.length + " 单");
      toast("已标记发货 " + r.done.length + " 单，可录入真单号");
    };

    // ---- 录真单号（只有 发货/退款/对账 能写，见 OrderModel.REALNO_ACTS）----
    ACT["set-realno"] = function (el) {
      var box = el.closest("[data-realno-box]");
      if (!box) { report("找不到单号输入区"); return; }
      var anonId = box.getAttribute("data-realno-box");
      var input = box.querySelector("[data-realno-input]");
      var r = OrderModel.setRealNo(orderList(), anonId, input ? input.value : "", "发货");
      if (r.__error) { report(r.__error); return; }
      commit(r.orders, "录单号 " + anonId);
      toast(anonId + " 单号已保存");
    };

    // ---- 售后登记：原因可点选（§五），只留痕，不自动执行 ----
    ACT["after-sale"] = function (el) {
      var box = el.closest("[data-aftersale-box]");
      if (!box) { report("找不到售后登记区"); return; }
      var anonId = box.getAttribute("data-aftersale-box");
      var reasonEl = box.querySelector("[data-aftersale-reason]");
      var noteEl = box.querySelector("[data-aftersale-note]");
      var reason = reasonEl ? reasonEl.value : "";
      var r = OrderModel.recordAfterSale(orderList(), anonId, reason, noteEl ? noteEl.value : "");
      if (r.__error) { report(r.__error); return; }
      commit(r.orders, "售后登记 " + anonId);
      toast(anonId + " 售后已登记：" + reason + "（只记录，不做动作）");
    };

    // ---- 看板：录入 UV（定金转化率分母；不录则显示「待录」）----
    ACT["set-uv"] = function () {
      var d = cur();
      if (!d) { toast("没有当前设计单"); return; }
      var v = global.prompt ? global.prompt(
        "录入店铺后台的「商品详情页访客数（UV）」：\n（≥0.8% 正常；0.3%~0.8% 预警；<0.3% 异常）",
        d.uv == null ? "" : String(d.uv)) : null;
      if (v == null) { toast("已取消"); return; }
      var n = parseInt(v, 10);
      if (!isFinite(n) || n < 0) { report("UV 需为非负整数"); return; }
      patch("录入 UV " + n, { uv: n });
      toast("UV 已录入：" + n);
    };

    // ---- 大货：推进款状态（文档 §十 第 9 项 / §九 第 13~16 步）----
    // 只推款状态，走状态机校验；订单状态由 ship / after-sale 各自负责（两者独立）。
    ACT["design-next"] = function () {
      var d = cur();
      if (!d) { toast("没有当前设计单"); return; }
      var curState = d.designState || "预售中";
      var NEXT = { "已成团": "生产中", "生产中": "已发货", "已发货": "售后中", "售后中": "完结" };
      var to = NEXT[curState];
      if (!to) { toast("款状态「" + curState + "」已是终态"); return; }
      if (!OrderModel.canTransitDesign(curState, to)) {
        report("款状态不允许 " + curState + " → " + to);
        return;
      }
      patch("款状态：" + curState + " → " + to, { designState: to });
      toast("款状态已改为「" + to + "」");
    };

    ACT["design-reopen"] = function () {
      var d = cur();
      if (!d) { toast("没有当前设计单"); return; }
      var curState = d.designState || "预售中";
      if (!OrderModel.canTransitDesign(curState, "改款重开")) {
        report("款状态「" + curState + "」不能改款重开");
        return;
      }
      patch("款状态：" + curState + " → 改款重开", { designState: "改款重开" });
      toast("已改款重开，回到图透/定样");
    };

    return ACT;
  }

  global.Actions = global.Actions || {};
  global.Actions.registerPost = registerPost;
})(window);
