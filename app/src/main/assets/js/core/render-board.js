/* 看板视图（第 13 步 board）：成团率 / 定金转化率 / 退款率 / 售后分布
 * 依据：文档 §六 已拍板阈值版。列名用「阈值触发→动作」（成团率、转化率低于触发；退款率高于触发）。
 * 边界：只展示与给建议，不做任何动作。
 */
(function (global) {
  "use strict";

  function esc(s) { return global.R.esc(s); }
  function R() { return global.R; }
  function BM() { return global.BoardModel; }

  var LV_LABEL = { ok: "正常", warn: "预警", bad: "异常", none: "—" };
  var LV_CLS = { ok: "", warn: "warn", bad: "bad", none: "muted" };

  function badge(lv) {
    return '<span class="lv ' + (LV_CLS[lv] || "") + '">' + (LV_LABEL[lv] || lv) + '</span>';
  }

  function table(head, rows) {
    return '<table class="tbl board-tbl"><thead><tr>' +
      head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows + "</tbody></table>";
  }

  // ---- 指标 1：成团率（按颜色 × 批次逐行）----
  function blockGroup(g) {
    if (!g.rows.length) return '<div class="block"><h2>成团率</h2><p class="muted">还没开团，没有批次可统计。</p></div>';
    var rows = g.rows.map(function (r) {
      return "<tr class='" + (r.enough ? "" : "row-bad") + "'>" +
        "<td>" + esc(r.color) + "</td><td>" + esc(r.batchNo) + "</td>" +
        "<td>" + r.got + " / " + r.target + "</td>" +
        "<td>" + BM().pct(r.rate, 1) + "</td>" +
        "<td>" + badge(r.level === "ok" ? "ok" : "warn") + "</td>" +
        "<td>" + esc(r.trigger) + "</td>" +
        "<td>" + esc(r.action) + "</td></tr>";
    }).join("");
    return '<div class="block"><h2>成团率 <span class="muted">按颜色 × 批次逐行</span></h2>' +
      table(["颜色", "批次", "实际/目标", "成团率", "状态", "阈值触发", "动作"], rows) +
      (g.failed.length
        ? '<p class="hint bad-hint">有 ' + g.failed.length + " 行未达标 → 走流团流程（退款清单在预售页）</p>"
        : '<p class="hint">全部达标。</p>') + "</div>";
  }

  // ---- 指标 2：定金转化率（UV 未录 → 待录）----
  function blockCVR(c) {
    var body = '<div class="kv"><span>支付定金人数</span><b>' + c.paid + "</b></div>" +
      '<div class="kv"><span>详情页访客数（UV）</span><b>' +
      (c.uv == null ? '<span class="muted">待录</span>' : c.uv) + "</b></div>" +
      '<div class="kv"><span>定金转化率</span><b>' + esc(c.display) + "</b></div>" +
      '<div class="kv"><span>阈值触发</span><b>' + esc(c.trigger) + "</b></div>" +
      '<div class="kv"><span>动作</span><b>' + esc(c.action) + "</b></div>";
    if (c.uv == null) {
      body += '<p class="hint">UV 需从店铺后台录入（≥0.8% 正常；0.3%~0.8% 预警；&lt;0.3% 异常）。未录入不出结论，也不触发动作。</p>' +
        '<button class="btn" data-act="set-uv">录入 UV</button>';
    } else {
      body = '<div class="kv"><span>状态</span><b>' + badge(c.level) + "</b></div>" + body +
        '<button class="btn ghost" data-act="set-uv">改 UV</button>';
    }
    return '<div class="block"><h2>定金转化率</h2>' + body + "</div>";
  }

  // ---- 指标 3：退款率（近 30 天）----
  function blockRefund(r) {
    var rows = "<tr><td>近 30 天支付订单数</td><td>" + r.paid + "</td><td>—</td><td>—</td><td>—</td></tr>" +
      "<tr class='" + (r.level === "ok" || r.level === "none" ? "" : "row-bad") + "'>" +
      "<td>近 30 天成功退款订单数</td><td>" + r.refunded + "</td><td>" + esc(r.display) + "</td>" +
      "<td>" + badge(r.level) + "</td><td>" + esc(r.trigger) + "</td></tr>";
    return '<div class="block"><h2>退款率 <span class="muted">近 30 天</span></h2>' +
      table(["项目", "数量", "比率", "状态", "阈值触发"], rows) +
      '<p class="hint">' + esc(r.action) + "（≥15% 预警；≥25% 异常）</p></div>";
  }

  // ---- 指标 4：售后原因分布 ----
  function blockAfterSale(a) {
    if (!a.rows.length) return '<div class="block"><h2>售后原因分布</h2><p class="muted">暂无售后记录。</p></div>';
    var t = BM().THRESHOLDS.afterSalePct;
    var rows = a.rows.map(function (x) {
      var lv = BM().level("high", x.pct, t);
      return "<tr class='" + (lv === "ok" ? "" : "row-" + (lv === "bad" ? "bad" : "warn")) + "'>" +
        "<td>" + esc(x.reason) + "</td><td>" + x.count + "</td>" +
        "<td>" + BM().pct(x.pct, 1) + "</td><td>" + badge(lv) + "</td>" +
        "<td>" + (lv === "ok" ? "正常" : "反哺改版") + "</td></tr>";
    }).join("");
    return '<div class="block"><h2>售后原因分布</h2>' +
      table(["原因", "次数", "占比", "状态", "动作"], rows) + "</div>";
  }

  function vBoard(d) {
    // P0-1 修复：全仓无 d.board 赋值点（buildBoard 有导出、有断言、但零调用）→ 视图内即时计算。
    // 纯函数：buildBoard 只读 d.pre / d.orders / d.uv，不写存储。
    var b = d && d.board;
    if (!b && d && d.pre && BM()) {
      b = BM().buildBoard(d.pre, d.orders || [], { uv: d.uv, days: 30 });
    }
    var body = '<div class="block"><h2>看板说明</h2>' +
      '<p class="hint">本表列名「阈值触发→动作」。成团率、定金转化率是<b>低于</b>触发；退款率、售后占比是<b>高于</b>触发。' +
      "看板只给结论与建议，不自动退款、不自动通知。</p></div>";
    if (!b) return R().screen("board", "统计看板", "先开团，再回来看数据", body +
      '<div class="block"><p class="muted">还没有可统计的预售数据。</p></div>');
    body += blockGroup(b.group) + blockCVR(b.cvr) + blockRefund(b.refund) + blockAfterSale(b.afterSale);
    return R().screen("board", "统计看板", "成团率 / 定金转化率 / 退款率 / 售后分布", body);
  }

  global.RenderBoard = { vBoard: vBoard };
})(window);
