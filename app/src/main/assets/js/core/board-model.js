/* 统计看板模型（文档 §六 已拍板阈值版 + §六补充 分色成团粒度）
 * 依据：主人拍板的三阈值完整版；「阈值触发→动作」列名（成团率/定金转化率是低于触发，退款率是高于触发）
 *
 * 【取数边界】
 *  - 成团率：按【颜色 × 批次】逐行，实际成团件数 ÷ 该色目标件数。数据全在本地，可算。
 *  - 定金转化率：分母「商品详情页访客数 UV」App 内拿不到 → uv 未录时显示「待录」，
 *    不参与触发、不假算（主人拍板）。录入后才出转化率与预警。
 *  - 退款率：近 30 天成功退款订单数 ÷ 近 30 天支付订单数，本地可算。
 *
 * 【重要】本文件只「算 + 给动作建议」，不执行任何动作（App 不自动退款/不自动通知）。
 */
(function (global) {
  "use strict";

  // ===== 阈值（唯一来源；改阈值只改这里）=====
  var THRESHOLDS = {
    groupRate:  { warn: 1.0,   bad: 1.0   },  // 成团率 < 100% → 流团（低于触发）
    depositCVR: { warn: 0.008, bad: 0.003 },  // ≥0.8% 正常；0.3%~0.8% 预警；<0.3% 异常（低于触发）
    refundRate: { warn: 0.15,  bad: 0.25  },  // ≥15% 预警；≥25% 异常（高于触发）
    afterSalePct:{ warn: 0.3, bad: 0.5 }      // 售后某原因占比：≥30% 预警；≥50% 异常
  };

  // 三档：ok / warn / bad
  function level(lowHigh, v, t, okWhenBelow) {
    if (v == null || !isFinite(v)) return "none";
    if (lowHigh === "low") {                 // 越高越好（成团率、转化率）
      if (v < t.bad) return "bad";
      if (v < t.warn) return "warn";
      return "ok";
    }
    if (lowHigh === "high") {                // 越低越好（退款率、售后占比）
      if (v >= t.bad) return "bad";
      if (v >= t.warn) return "warn";
      return "ok";
    }
    return "none";                           // 方向不明确 → 不下结论
  }

  // ===== 1. 成团率（按颜色 × 批次，§六补充）=====
  function groupRateRows(pre, orders) {
    var OM = global.OrderModel;
    if (!OM || !pre) return [];
    var tally = OM.tallyByBatch(pre, orders);
    return tally.map(function (t) {
      var rate = t.target > 0 ? t.got / t.target : 0;
      return {
        color: t.color, batchNo: t.batchNo, target: t.target, got: t.got,
        rate: rate, enough: t.enough,
        level: level("low", rate, THRESHOLDS.groupRate),
        trigger: rate < THRESHOLDS.groupRate.warn ? "低于" : "—",
        action: rate < THRESHOLDS.groupRate.warn ? "流团：退还定金、发布流团通知、关闭该批次订单" : "正常"
      };
    });
  }

  // ===== 2. 定金转化率（UV 未录 → 待录，不触发）=====
  function depositCVR(paidCount, uv) {
    var n = Number(uv);
    if (!uv || !isFinite(n) || n <= 0) {
      return { uv: null, paid: Number(paidCount) || 0, cvr: null, level: "none",
               display: "待录", trigger: "—", action: "先录入店铺后台的商品详情页访客数（UV）" };
    }
    var cvr = (Number(paidCount) || 0) / n;
    var lv = level("low", cvr, THRESHOLDS.depositCVR);
    var act = lv === "bad"
      ? "标红 + 暂停推广 + 复盘详情页 + 提前预警流团风险"
      : (lv === "warn"
        ? "标黄 + 对比同店其他款 + 检查详情页/定金设置 + 评估推广"
        : "正常");
    return { uv: n, paid: Number(paidCount) || 0, cvr: cvr, level: lv, display: pct(cvr, 2),
             trigger: lv === "ok" ? "—" : "低于", action: act };
  }

  // ===== 3. 退款率（近 30 天）=====
  function refundRate(orders, now, days) {
    var nd = days || 30;
    var end = now ? new Date(now).getTime() : Date.now();
    var start = end - nd * 86400000;
    var in30 = (orders || []).filter(function (o) {
      var t = Date.parse((o.paidAt || o.at || "").toString().length <= 10
        ? (o.paidAt || o.at) + "T00:00:00" : (o.paidAt || o.at || ""));
      return isFinite(t) && t >= start && t <= end;
    });
    var paid = in30.filter(function (o) {
      return ["已付定金","待尾款","尾款逾期","已付尾款","待发货","已发货","售后","完结","退款中","已退款"].indexOf(o.state) >= 0;
    }).length;
    var refunded = in30.filter(function (o) { return o.state === "已退款"; }).length;
    var rate = paid > 0 ? refunded / paid : 0;
    var lv = paid > 0 ? level("high", rate, THRESHOLDS.refundRate) : "none";
    var act = lv === "bad"
      ? "标红 + 暂停推广 + 客服介入 + 排查尺码表"
      : (lv === "warn" ? "标黄 + 按款/批次拆分 + 拉退款原因分布" : "正常");
    return { paid: paid, refunded: refunded, rate: rate, level: lv,
             display: paid > 0 ? pct(rate, 2) : "样本不足", trigger: lv === "ok" || lv === "none" ? "—" : "高于",
             action: act };
  }

  function pct(v, d) { return (Number(v) * 100).toFixed(d == null ? 2 : d) + "%"; }

  // ===== 汇总：看板一行 =====
  function buildBoard(pre, orders, opts) {
    opts = opts || {};
    var rows = groupRateRows(pre, orders);
    var failed = rows.filter(function (r) { return !r.enough; });
    var paidCount = (orders || []).filter(function (o) {
      return ["已付定金","待尾款","尾款逾期","已付尾款","待发货","已发货","售后","完结"].indexOf(o.state) >= 0;
    }).length;
    return {
      group: { rows: rows, failed: failed, total: rows.length,
               rate: rows.length
                 ? rows.reduce(function (s, r) { return s + r.got; }, 0) /
                   Math.max(1, rows.reduce(function (s, r) { return s + r.target; }, 0))
                 : null },
      cvr: depositCVR(paidCount, opts.uv),
      refund: refundRate(orders, opts.now, opts.days),
      afterSale: global.OrderModel ? global.OrderModel.afterSaleStats(orders) : { rows: [], total: 0 },
      at: new Date().toISOString()
    };
  }

  global.BoardModel = {
    THRESHOLDS: THRESHOLDS, level: level, pct: pct,
    groupRateRows: groupRateRows, depositCVR: depositCVR, refundRate: refundRate,
    buildBoard: buildBoard
  };
})(window);
