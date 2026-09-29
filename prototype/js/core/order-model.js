/* 订单模型 + 状态机 + 成团统计（从 factory.js 拆出，遵守单文件 ≤400 行铁律）
 * 依据：文档 §三 订单状态机、§一 数据边界、§六补充 分色成团
 *
 * 【隐私硬约束】订单结构里**不存在**买家姓名/电话/地址字段。
 *   只有：匿名 ID + 颜色 + 批次 + 数量 + 金额 + 状态 + 时间（+ 默认空白的真单号）。
 *   真单号只有「发货 / 退款 / 对账」三个动作能读，读时留审计记录。
 */
(function (global) {
  "use strict";

  // 默认成团件数：从 Factory 取，避免两处各定义一份（改一处忘另一处的隐患）
  function defTarget() {
    return (global.Factory && global.Factory.DEFAULT_TARGET) || 1000;
  }

  // 订单状态（文档 §三 + §五 尾款逾期）
  var ORDER_STATES = ["待定金","已付定金","待尾款","尾款逾期","已付尾款","待发货","已发货","售后","完结","退款中","已退款","定金逾期"];
  var ORDER_FLOW = {
    "待定金":   ["已付定金","定金逾期"],
    "已付定金": ["待尾款","退款中"],
    "待尾款":   ["已付尾款","尾款逾期","退款中"],
    // 尾款逾期：标记逾期 → 出催款清单（§五「不自动发」）。仍可补付尾款。
    "尾款逾期": ["已付尾款","退款中"],
    "已付尾款": ["待发货","退款中"],
    "待发货":   ["已发货","退款中"],
    "已发货":   ["售后","完结"],
    "售后":     ["完结"],
    "退款中":   ["已退款"],
    "已退款":   [],
    "定金逾期": [],
    "完结":     []
  };
  // 只有这三个动作能读/写真单号（文档 §一）
  var REALNO_ACTS = ["发货","退款","对账"];

  function canTransit(from, to) {
    var list = ORDER_FLOW[from];
    return !!list && list.indexOf(to) >= 0;
  }

  // 匿名 ID：D-0001 起递增（对外唯一标识；文档 §一 要求看板/导出只含匿名 ID）
  function nextAnonId(seq) {
    var n = Number(seq) || 0;
    return "D-" + String(n).padStart(4, "0");
  }

  // 开团：依据定样结果建批次（按颜色；target 来自 final.skus）
  function openPre(final, existingPre) {
    if (!final || final.__error) return { __error: "先完成定样定价" };
    if (!final.skus || !final.skus.length) return { __error: "定样没有颜色，无法开团" };
    var prev = existingPre || {};
    var batches = (prev.batches || []).slice();
    var has = {};
    batches.forEach(function (b) { has[b.color + "#" + b.no] = true; });
    final.skus.forEach(function (s) {
      var key = s.color + "#1";
      if (has[key]) return;                       // 已开过一团，不重复开
      batches.push({
        no: 1, color: String(s.color), target: Number(s.target) || defTarget(),
        openedAt: new Date().toISOString()
      });
    });
    return {
      batches: batches,
      nextAnon: Number(prev.nextAnon) || 1,
      price: final.price, deposit: final.deposit, balance: final.balance,
      leadDays: final.leadDays, deadline: final.deadline,
      openedAt: prev.openedAt || new Date().toISOString()
    };
  }

  // 解析批量粘贴：每行「颜色,数量,金额」，允许顿号/制表符分隔
  // 返回 { rows:[{color,qty,amount,batchNo}], errors:[{line,text,reason}] }
  function parseOrderLines(text, pre) {
    var lines = String(text || "").split("\n");
    var rows = [], errors = [];
    var batchOf = {};
    ((pre && pre.batches) || []).forEach(function (b) { batchOf[b.color] = b.no; });
    lines.forEach(function (raw, i) {
      var t = raw.trim();
      if (!t) return;
      var parts = t.split(/[,，、\t]+/).map(function (x) { return x.trim(); });
      if (parts.length < 3) { errors.push({ line: i + 1, text: t, reason: "至少三列：颜色,数量,金额" }); return; }
      var color = parts[0];
      var qty = Number(parts[1]);
      var amount = Number(parts[2]);
      if (!color) { errors.push({ line: i + 1, text: t, reason: "颜色为空" }); return; }
      if (!isFinite(qty) || qty <= 0) { errors.push({ line: i + 1, text: t, reason: "数量必须是正整数" }); return; }
      if (!isFinite(amount) || amount < 0) { errors.push({ line: i + 1, text: t, reason: "金额必须非负" }); return; }
      if (pre && batchOf[color] === undefined) { errors.push({ line: i + 1, text: t, reason: "颜色「" + color + "」不在本次开团的批次里" }); return; }
      rows.push({ color: color, qty: qty, amount: amount, batchNo: batchOf[color] || 1 });
    });
    return { rows: rows, errors: errors };
  }

  // 由批次行生成定金单（匿名 ID 自动递增；**不产生姓名/电话/地址字段**）
  function makeOrders(pre, rows) {
    var list = [];
    var seq = Number(pre && pre.nextAnon) || 1;
    (rows || []).forEach(function (r) {
      list.push({
        anonId: nextAnonId(seq++),
        realNo: "",                         // 默认空：只有发货/退款/对账才写
        color: String(r.color),
        batchNo: Number(r.batchNo) || 1,
        qty: Number(r.qty),
        amount: Number(r.amount),
        state: "已付定金",                   // 定金单录入即视为已付
        at: new Date().toISOString()
      });
    });
    return { orders: list, nextAnon: seq };
  }

  // 单个颜色 × 批次 的成团统计（文档 §六补充：按颜色×批次取数）
  function tallyByBatch(pre, orders) {
    var out = [];
    ((pre && pre.batches) || []).forEach(function (b) {
      var got = 0;
      (orders || []).forEach(function (o) {
        if (o.color === b.color && Number(o.batchNo) === Number(b.no) &&
            ["已付定金","待尾款","已付尾款","待发货","已发货","售后","完结"].indexOf(o.state) >= 0) {
          got += Number(o.qty) || 0;
        }
      });
      out.push({
        color: b.color, batchNo: b.no, target: b.target, got: got,
        rate: b.target > 0 ? got / b.target : 0,
        enough: b.target > 0 && got >= b.target
      });
    });
    return out;
  }
  /* ===== 成团判定（文档 §二 款状态机 / §四 部分成团 / §五 异常矩阵）===== */
  // 款状态机（与订单状态机分开；文档 §二）
  var DESIGN_STATES = ["企划中","图透中","投票中","定样","预售中","已成团","已流团","生产中","已发货","售后中","完结","改款重开"];
  var DESIGN_FLOW = {
    "企划中":   ["图透中","改款重开"],
    "图透中":   ["投票中","改款重开"],
    "投票中":   ["定样","改款重开"],
    "定样":     ["预售中","改款重开"],
    "预售中":   ["已成团","已流团"],
    "已成团":   ["生产中"],
    "已流团":   ["改款重开","完结"],
    "生产中":   ["已发货"],
    "已发货":   ["售后中","完结"],
    "售后中":   ["完结","改款重开"],
    "完结":     [],
    "改款重开": ["图透中","定样"]
  };

  function canTransitDesign(from, to) {
    var list = DESIGN_FLOW[from];
    return !!list && list.indexOf(to) >= 0;
  }

  // 是否已到成团截止日（deadline 为空视为「未设」，不自动判定）
  function isDue(deadline, now) {
    if (!deadline) return false;
    var t = Date.parse(String(deadline).length <= 10 ? deadline + "T23:59:59" : deadline);
    if (!isFinite(t)) return false;
    return (now ? new Date(now) : new Date()).getTime() >= t;
  }

  // 成团判定（§四 A 分色成团）：
  //   逐个「颜色 × 批次」判定 → 够线=已成团，不够线=该色流团（退还该色定金）
  //   返回 { rows:[{color,batchNo,target,got,rate,enough}], enough:[...], failed:[...],
  //          designState:"已成团"|"已流团"|"", refundable:[订单 anonId...] }
  function judgePre(pre, orders, opts) {
    opts = opts || {};
    if (!pre) return { __error: "还没开团" };
    var tally = tallyByBatch(pre, orders);
    if (!tally.length) return { __error: "没有批次可判定" };
    var enough = tally.filter(function (t) { return t.enough; });
    var failed = tally.filter(function (t) { return !t.enough; });
    // 定金逾期/已退款的订单不占成团名额（§五），tallyByBatch 已排除
    var failedKeys = {};
    failed.forEach(function (t) { failedKeys[t.color + "#" + t.batchNo] = true; });
    var refundable = (orders || []).filter(function (o) {
      return failedKeys[o.color + "#" + Number(o.batchNo)] &&
             ["已付定金","待尾款","已付尾款"].indexOf(o.state) >= 0;
    }).map(function (o) { return o.anonId; });
    // 款状态：全不够→已流团；只要有够的→已成团（部分成团按 §四 处理）
    var state = failed.length === 0 ? "已成团" : (enough.length === 0 ? "已流团" : "已成团");
    return {
      rows: tally, enough: enough, failed: failed,
      designState: state,
      partial: enough.length > 0 && failed.length > 0,
      refundable: refundable,
      at: new Date().toISOString()
    };
  }

  // 流团退款：把流团色的订单推进「退款中」，并生成退款清单（App 不自动退，只出清单）
  function buildRefundList(pre, orders, judgeResult) {
    var ids = (judgeResult && judgeResult.refundable) || [];
    var rows = (orders || []).filter(function (o) { return ids.indexOf(o.anonId) >= 0; });
    var total = rows.reduce(function (s, o) { return s + (Number(o.amount) || 0); }, 0);
    return {
      rows: rows.map(function (o) {
        return { anonId: o.anonId, color: o.color, batchNo: o.batchNo, qty: o.qty,
                 amount: o.amount, from: o.state };
      }),
      total: total, count: rows.length, at: new Date().toISOString()
    };
  }

  // ===== 批 E3：订单推进 =====

  // 统一流转：校验状态机 + 记事件。返回新订单数组（不改原数组）
  function transit(list, anonId, to, why, actor) {
    var arr = (list || []).slice();
    var i = -1;
    for (var k = 0; k < arr.length; k++) if (arr[k].anonId === anonId) { i = k; break; }
    if (i < 0) return { __error: "找不到订单 " + anonId };
    var from = arr[i].state;
    if (from === to) return { __error: anonId + " 已经是「" + to + "」" };
    if (!canTransit(from, to)) return { __error: "「" + from + "」不能直接到「" + to + "」" };
    var ev = (arr[i].events || []).concat([{
      at: new Date().toISOString(), from: from, to: to,
      why: why || "", actor: actor || "商家"
    }]);
    var next = {};
    for (var p in arr[i]) if (Object.prototype.hasOwnProperty.call(arr[i], p)) next[p] = arr[i][p];
    next.state = to;
    next.events = ev;
    if (to === "已付尾款") next.paidTailAt = new Date().toISOString();
    if (to === "已发货") next.shippedAt = new Date().toISOString();
    arr[i] = next;
    return { orders: arr, from: from, to: to, anonId: anonId };
  }

  // 批量流转（补尾款等场景）：返回 { orders, done:[], failed:[{anonId,reason}] }
  function transitMany(list, ids, to, why, actor) {
    var work = (list || []).slice(), done = [], failed = [];
    (ids || []).forEach(function (id) {
      var r = transit(work, id, to, why, actor);
      if (r.__error) failed.push({ anonId: id, reason: r.__error });
      else { work = r.orders; done.push(id); }
    });
    return { orders: work, done: done, failed: failed };
  }

  // 尾款逾期判定：已到截止日且仍是「待尾款」的订单
  function tailOverdue(orders, deadline, now) {
    if (!isDue(deadline, now)) return [];
    return (orders || []).filter(function (o) { return o.state === "待尾款"; })
      .map(function (o) { return o.anonId; });
  }

  // 催款清单（§五：标记逾期 → 出清单，不自动发）
  function buildTailDunning(orders, ids) {
    var set = ids || tailOverdue(orders, arguments[2]);
    var rows = (orders || []).filter(function (o) { return set.indexOf(o.anonId) >= 0; });
    return {
      rows: rows.map(function (o) {
        return { anonId: o.anonId, color: o.color, batchNo: o.batchNo,
                 qty: o.qty, amount: o.amount, state: o.state };
      }),
      count: rows.length, at: new Date().toISOString()
    };
  }

  // 发货清单：待发货订单（发货时才允许录真单号，文档 §一）
  function buildShipList(orders) {
    var rows = (orders || []).filter(function (o) { return o.state === "待发货"; });
    return {
      rows: rows.map(function (o) {
        return { anonId: o.anonId, color: o.color, batchNo: o.batchNo, qty: o.qty,
                 amount: o.amount, realNo: o.realNo || "", state: o.state };
      }),
      count: rows.length, at: new Date().toISOString()
    };
  }

  // 写/读真单号：只有「发货/退款/对账」能读写（文档 §一）
  function setRealNo(list, anonId, realNo, act) {
    if (REALNO_ACTS.indexOf(act) < 0) return { __error: "「" + act + "」无权读写单号" };
    var arr = (list || []).slice(), hit = false;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].anonId !== anonId) continue;
      if (["待发货","已发货","售后"].indexOf(arr[i].state) < 0) {
        return { __error: arr[i].state + " 状态不能录单号" };
      }
      var n = {};
      for (var p in arr[i]) if (Object.prototype.hasOwnProperty.call(arr[i], p)) n[p] = arr[i][p];
      n.realNo = String(realNo || "");
      arr[i] = n; hit = true; break;
    }
    if (!hit) return { __error: "找不到订单 " + anonId };
    return { orders: arr, anonId: anonId, act: act };
  }

  // ===== 售后原因（§五 异常矩阵可点选记录；只记录，不自动执行）=====
  var AFTER_SALE_REASONS = [
    "尺码不合","色差","做工瑕疵","面料问题","物流破损","错发漏发",
    "赠品缺货","工厂翻车(抽检不合格)","工厂延期","版权投诉",
    "面料断货/涨价","买家取消","平台判责/抽检","合并发货"
  ];

  // 记录售后：推进到「售后」并写原因；只留痕，不改别的
  function recordAfterSale(list, anonId, reason, note) {
    if (AFTER_SALE_REASONS.indexOf(reason) < 0) return { __error: "未知售后原因：" + reason };
    var arr = (list || []).slice(), i = -1;
    for (var k = 0; k < arr.length; k++) if (arr[k].anonId === anonId) { i = k; break; }
    if (i < 0) return { __error: "找不到订单 " + anonId };
    var o = arr[i], from = o.state;
    var cur = (from === "售后") ? "售后" : "售后";
    if (from !== "售后" && !canTransit(from, "售后")) {
      return { __error: "「" + from + "」不能登记售后" };
    }
    var n = {};
    for (var p in o) if (Object.prototype.hasOwnProperty.call(o, p)) n[p] = o[p];
    n.state = cur;
    n.afterSale = (o.afterSale || []).concat([{
      at: new Date().toISOString(), reason: reason, note: note || "", from: from
    }]);
    arr[i] = n;
    return { orders: arr, anonId: anonId, reason: reason };
  }

  // 售后原因分布（供看板「售后某原因占比」）
  function afterSaleStats(orders) {
    var map = {}, total = 0;
    (orders || []).forEach(function (o) {
      (o.afterSale || []).forEach(function (a) {
        map[a.reason] = (map[a.reason] || 0) + 1; total++;
      });
    });
    var rows = Object.keys(map).map(function (r) {
      return { reason: r, count: map[r], pct: total ? map[r] / total : 0 };
    }).sort(function (a, b) { return b.count - a.count; });
    return { rows: rows, total: total };
  }

  global.OrderModel = {
    ORDER_STATES: ORDER_STATES, ORDER_FLOW: ORDER_FLOW, REALNO_ACTS: REALNO_ACTS,
    DESIGN_STATES: DESIGN_STATES, DESIGN_FLOW: DESIGN_FLOW,
    AFTER_SALE_REASONS: AFTER_SALE_REASONS,
    canTransit: canTransit, canTransitDesign: canTransitDesign,
    nextAnonId: nextAnonId, openPre: openPre,
    parseOrderLines: parseOrderLines, makeOrders: makeOrders, tallyByBatch: tallyByBatch,
    isDue: isDue, judgePre: judgePre, buildRefundList: buildRefundList,
    transit: transit, transitMany: transitMany,
    tailOverdue: tailOverdue, buildTailDunning: buildTailDunning,
    buildShipList: buildShipList, setRealNo: setRealNo,
    recordAfterSale: recordAfterSale, afterSaleStats: afterSaleStats
  };
})(window);
