/* 履约视图区块：尾款 / 发货 / 售后（批 E3）
 * 依据：文档 §五 异常矩阵（尾款逾期催款、发货、售后登记）。
 * 只出界面 + 清单，不做任何自动动作。
 */
(function (global) {
  "use strict";

  function esc(s) { return global.R.esc(s); }
  function money(n) { return global.R.money(n); }

  // 按状态分组（用于列表展示）
  function groupByState(list) {
    var map = {};
    (list || []).forEach(function (o) {
      (map[o.state] = map[o.state] || []).push(o);
    });
    return map;
  }

  function orderRow(o, extra) {
    return "<tr><td>" + esc(o.anonId) + "</td><td>" + esc(o.color) + "</td>" +
      "<td>" + esc(o.batchNo) + "</td><td>" + (o.qty || 0) + "</td>" +
      (extra || "") + "</tr>";
  }

  // ---- 大货生产（文档 §十 第 9 项 / §九 流程图 第 13 步）----
  // 款状态推进：已成团 → 生产中 → 已发货 → 售后中 → 完结。
  // 订单侧的「发货/售后」只改订单状态，这里负责**款状态**，两者独立（文档 §二/§三）。
  function blockBatch(d) {
    var OM = global.OrderModel;
    var cur = d.designState || "预售中";
    var NEXT = { "已成团": "生产中", "生产中": "已发货", "已发货": "售后中", "售后中": "完结" };
    var next = NEXT[cur];
    var body = '<div class="block"><h2>大货生产</h2>' +
      '<div class="kv"><span>款状态</span><b>' + esc(cur) + "</b></div>" +
      '<p class="hint">大货复用第 6 步采购与第 10 步工厂的信息；这里只推款状态，不改订单。</p>';
    if (next) {
      var allowed = OM ? OM.canTransitDesign(cur, next) : false;
      body += allowed
        ? '<button type="button" class="btn wide" data-act="design-next">推进款状态：' + esc(cur) + " → " + esc(next) + "</button>"
        : '<p class="muted">款状态「' + esc(cur) + '」不能推进到「' + esc(next) + '」。</p>';
    } else {
      body += '<p class="muted">款状态「' + esc(cur) + '」已是终态，无需推进。</p>';
    }
    // 改款重开（文档 §十一 闭环）——流团或售后后允许重开
    var canReopen = OM ? OM.canTransitDesign(cur, "改款重开") : false;
    if (canReopen) {
      body += '<button type="button" class="btn ghost wide" data-act="design-reopen">改款重开（回到图透/定样）</button>';
    }
    return body + "</div>";
  }

  // ---- 补尾款 ----
  function blockTail(d, list) {
    var wait = (list || []).filter(function (o) {
      return o.state === "待尾款" || o.state === "尾款逾期";
    });
    var over = (list || []).filter(function (o) { return o.state === "尾款逾期"; });
    var body = '<div class="block"><h2>补尾款</h2>' +
      '<div class="kv"><span>待补尾款</span><b>' + wait.length + " 单</b></div>" +
      '<div class="kv"><span>其中已逾期</span><b>' + over.length + " 单</b></div>";
    if (wait.length) {
      body += '<button type="button" class="btn primary wide" data-act="pay-tail">' +
        "登记补尾款（" + wait.length + " 单）</button>";
    }
    if (!over.length) {
      body += '<button type="button" class="btn wide" data-act="tail-overdue">' +
        "标记尾款逾期 + 生成催款清单</button>";
    }
    body += '<p class="hint">催款清单只生成，App 不自动发送（文档 §五）。</p>';

    var dun = d.tailDunning;
    if (dun && dun.count) {
      body += "<h3>催款清单（" + dun.count + " 单）</h3>" +
        '<div class="scroll-x"><table><thead><tr><th>匿名ID</th><th>颜色</th><th>批次</th><th>数量</th></tr></thead><tbody>' +
        dun.rows.map(function (o) { return orderRow(o, ""); }).join("") +
        "</tbody></table></div>";
    }
    return body + "</div>";
  }

  // ---- 发货 + 真单号录入（§一：只有发货/退款/对账能读写单号）----
  function blockShip(list) {
    var wait = (list || []).filter(function (o) { return o.state === "待发货"; });
    var sent = (list || []).filter(function (o) { return o.state === "已发货"; }).slice(0, 5);
    var body = '<div class="block"><h2>发货</h2>' +
      '<div class="kv"><span>待发货</span><b>' + wait.length + " 单</b></div>";
    if (wait.length) {
      body += '<button type="button" class="btn primary wide" data-act="ship">' +
        "标记发货（" + wait.length + " 单）</button>";
    }
    sent.forEach(function (o) {
      body += '<div class="realno-box" data-realno-box="' + esc(o.anonId) + '">' +
        "<label>" + esc(o.anonId) + " · " + esc(o.color) + " 真单号</label>" +
        '<input class="inp" data-realno-input type="text" placeholder="发货后才可录入" value="' + esc(o.realNo || "") + '">' +
        '<button type="button" class="btn sm" data-act="set-realno">保存单号</button></div>';
    });
    body += '<p class="hint">订单结构不含姓名/电话/地址；真单号仅「发货/退款/对账」可读写（文档 §一）。</p>';
    return body + "</div>";
  }

  // ---- 售后登记（原因可点选，§五）----
  function blockAfterSale(list) {
    var OM = global.OrderModel;
    var reasons = (OM && OM.AFTER_SALE_REASONS) || [];
    var candidates = (list || []).filter(function (o) {
      return ["已发货", "售后"].indexOf(o.state) >= 0;
    });
    var stat = OM ? OM.afterSaleStats(list) : { rows: [], total: 0 };
    var body = '<div class="block"><h2>售后登记</h2>' +
      '<p class="hint">只记录原因与留痕，不做任何自动动作（文档 §五）。</p>';
    if (!candidates.length) {
      body += '<p class="muted">暂无可登记售后的订单（需已发货）。</p>';
    } else {
      var o = candidates[candidates.length - 1];
      body += '<div class="aftersale-box" data-aftersale-box="' + esc(o.anonId) + '">' +
        '<div class="kv"><span>订单</span><b>' + esc(o.anonId) + " · " + esc(o.color) + "</b></div>" +
        '<select class="inp" data-aftersale-reason>' +
        reasons.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + "</option>"; }).join("") +
        "</select>" +
        '<input class="inp" data-aftersale-note type="text" placeholder="备注（可选）">' +
        '<button type="button" class="btn wide" data-act="after-sale">登记售后</button></div>';
    }
    if (stat.total) {
      body += "<h3>原因分布</h3><div class=\"chips\">" +
        stat.rows.map(function (r) {
          return '<span class="tag">' + esc(r.reason) + " ×" + r.count + "</span>";
        }).join("") + "</div>";
    }
    return body + "</div>";
  }

  global.RenderFlux = {
    groupByState: groupByState,
    blockBatch: blockBatch,
    blockTail: blockTail, blockShip: blockShip, blockAfterSale: blockAfterSale
  };
})(window);
