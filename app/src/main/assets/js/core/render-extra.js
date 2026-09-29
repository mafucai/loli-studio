/* 渲染扩展：历史页（设计单 / 图片）、AI 结果块、估价块
 * 从 render.js 拆出：render.js 需 ≤400 行（项目铁律）。
 * 依赖：R.esc / R.money（由 render.js 先加载并导出）。
 * 在 render.js 之后加载，把新渲染函数挂到 R 上。
 */
(function (global) {
  "use strict";

  var R = global.R || (global.R = {});
  function esc(s) { return R.esc(s); }
  function money(n) { return R.money(n); }
  // screen 由 render.js 提供（render.js 先加载），必须走 R.screen 而不是裸引用
  function screen(curId, title, sub, body) { return R.screen(curId, title, sub, body); }
  // OrderModel 由 order-model.js 提供（factory.js 之后加载）
  function OM() { return global.OrderModel; }
  // stepLabel 同理：render.js 的内部函数，必须走 R.stepLabel
  function stepLabel(id) { return R.stepLabel(id); }
  // nextBtn 同理由 render.js 提供，必须走 R.nextBtn（裸引用在沙箱/非全局下会 ReferenceError）
  function nextBtn(step, label) { return R.nextBtn(step, label); }

  /* 0 企划：主题风格 + 柄图（文档【第二层】第 0 步，必须在设计词之前） */
  function vPlan(d) {
    var theme = d.theme || "";
    var prints = d.prints;
    var body = '<div class="block"><h2>主题风格</h2>' +
      '<p class="hint">先定主题，柄图和设计词都会跟着走。</p>' +
      '<div class="chips">' + Factory.THEMES.map(function (t) {
        return '<button type="button" class="chip' + (t === theme ? " on" : "") +
          '" data-act="pick-theme" data-value="' + esc(t) + '">' + esc(t) + "</button>";
      }).join("") + "</div>" +
      '<button type="button" class="btn wide" data-act="gen-prints"' +
      (theme ? "" : " disabled") + ">" +
      (prints && prints.picks && prints.picks.length ? "重新生成柄图候选" : "生成柄图候选") + "</button></div>";

    if (!theme) {
      body += '<div class="block"><h2>柄图</h2><p class="hint">先选一个主题风格。</p></div>';
      return screen("plan", "企划", "第 0 步 · 在设计词之前", body);
    }

    if (!prints) {
      body += '<div class="block"><h2>柄图</h2><p class="hint">柄图是出图的输入，必须先定。</p></div>';
      return screen("plan", "企划", "第 0 步 · 在设计词之前", body);
    }

    var picks = prints.picks || [];
    var src = prints.mode === "ai" ? "图片接口生成" : "本地演示花色（未配图片接口）";
    body += '<div class="block"><h2>柄图（选一张）</h2>' +
      '<p class="hint">来源：' + esc(src) + '。柄图是印花图案本身，不是服装造型图。</p>' +
      '<div class="print-grid">' + prints.items.map(function (item) {
        var on = picks.indexOf(item.id) >= 0;
        return '<button type="button" class="print' + (on ? " on" : "") +
          '" data-act="pick-print" data-value="' + esc(item.id) + '">' +
          '<img src="' + esc(item.uri) + '" alt="' + esc(item.name) + '">' +
          '<span>' + esc(item.name) + "</span></button>";
      }).join("") + "</div>" +
      (prints.error ? '<p class="warn-note">图片接口没成功：' + esc(prints.error) + "。已用本地演示花色。</p>" : "") +
      "</div>";

    if (picks.length) {
      body += '<div class="block"><h2>已选柄图</h2>' + nextBtn("word", "下一步 · 设计词") + "</div>";
    } else {
      body += '<div class="block"><p class="hint">选一张柄图，才能进设计词。</p></div>';
    }
    return screen("plan", "企划", "第 0 步 · 在设计词之前", body);
  }

  function stepName(id) {
    var steps = (global.Router && Router.STEPS) || [];
    for (var i = 0; i < steps.length; i++) if (steps[i].id === id) return steps[i].title;
    return "";
  }

  // 历史页：设计单 / 图片 两个标签
  // AI 搜索结果块
  function aiResults(label, data) {
    if (!data || !data.items || !data.items.length) {
      return '<div class="block"><h2>' + esc(label) + '</h2>' +
        '<p class="hint">还没有 AI 结果。点上面按钮让 AI 搜索。</p></div>';
    }
    return '<div class="block"><h2>' + esc(label) + '结果</h2>' +
      '<p class="hint">搜索词：' + esc(data.query || "") + '</p>' +
      '<p class="warn-note">以下为 AI 参考，不是平台实测。请逐条点开自行核实。</p>' +
      '<div class="stack">' + data.items.map(function (it) {
        var line = '<strong>' + esc(it.title || "（无标题）") + '</strong>';
        var meta = [it.source, it.price, it.sales].filter(Boolean).map(esc).join(" · ");
        var link = it.url
          ? '<a class="btn small" href="' + esc(it.url) + '" target="_blank" rel="noopener">打开</a>'
          : '<span class="hint">无链接</span>';
        return '<div class="hr"></div>' + line + (meta ? '<p class="hint">' + meta + "</p>" : "") + link;
      }).join("") + "</div></div>";
  }

  // 估价块（估算，不是最终成本）
  function estimateBlock(d) {
    var s = d.sourcing || [];
    if (!s.length) return "";
    var material = s.reduce(function (sum, item) { return sum + (Number(item.price) || 0) * Number(item.amount || 0); }, 0);
    if (!material) {
      return '<div class="block"><h2>估算价格</h2>' +
        '<p class="hint">还没填采购单价，去「采购」步骤填完各部分单价后，这里会自动估算。</p></div>';
    }
    var bom = d.bom || {};
    var labor = Number(bom.laborTotal || 0);
    var fixed = Math.round(Number(bom.fixedTotal || 0) / 100);
    var one = Math.round(material + labor + fixed);
    var rec = Math.round(one / 0.35);
    var floor = Math.round(one * 1.6);
    return '<div class="block"><h2>估算价格</h2>' +
      '<p class="hint">按已填采购单价 + 拆件工价估算。工厂报价后，第 9 步给精确成本。</p>' +
      '<div class="kv"><span>物料（采购单价 × 用量）</span><span>' + money(material) + "</span></div>" +
      '<div class="kv"><span>加工工时（拆件估算）</span><span>' + money(labor) + "</span></div>" +
      '<div class="kv"><span>固定分摊（估算）</span><span>' + money(fixed) + "</span></div>" +
      '<div class="price">' + money(one) + "<small> / 件估算成本</small></div>" +
      '<div class="hr"></div>' +
      '<div class="kv"><span>保底售价（成本 × 1.6）</span><span>' + money(floor) + "</span></div>" +
      '<div class="kv"><span>建议零售价（约 65% 毛利）</span><span class="gold">' + money(rec) + "</span></div></div>";
  }

  // 接口列表（纯函数）
  function epListHTML(list, activeId, kind) {
    var k = kind === "image" ? "image" : "text";
    if (!list.length) {
      return '<div class="ep-empty muted">还没有接口。点下面「＋ 新增」开始。</div>';
    }
    return list.map(function (e) {
      var on = e.id === activeId;
      var dt = e.base ? esc(String(e.base).replace(/^https?:\/\//, "")) : "未填地址";
      return '<button type="button" class="ep-item' + (on ? " on" : "") + '" data-act="ep-pick" data-kind="' + k + '" data-id="' + esc(e.id) + '">' +
        (on ? '<span class="tk">用中</span>' : "") +
        '<span class="nm">' + esc(e.name || "未命名") + "</span>" +
        '<span class="dt">' + dt + "</span></button>";
    }).join("");
  }

  /* ===== 定样定价（文档第 6 项）===== */
  // cost 页不动（算成本）；本页做对外定价 + 成团线 + 工期 + SKU
  /* ===== vPre 的三个拆出块（原 vPre 125 行超 60 行规则 → 拆为可独立阅读的块函数）===== */

  // 成团判定块（文档 §四 分色成团 / §五 流团）
  function blockJudge(pre, j) {
    var due = OM().isDue(pre.deadline);
    var html = '<div class="block"><h2>成团判定</h2>' +
      '<p class="hint">本款<b>分色成团</b>：未达线颜色将流团，并退还该色定金。' +
      (pre.deadline ? "<br>成团截止：" + esc(pre.deadline) + (due ? "（已到期）" : "（未到期，可提前判）") : "<br>未设截止日期，可提前判。") +
      "</p>" +
      '<button type="button" class="btn primary wide" data-act="judge-pre">' +
      (j ? "重新判定" : "判定成团") + "</button></div>";

    if (!j) return html;
    var label = j.designState === "已成团" ? (j.partial ? "部分成团" : "全部成团") : "已流团";
    html += '<div class="block"><h2>判定结果 · ' + esc(label) + "</h2>" +
      (j.partial ? '<p class="warn-note">够线的颜色正常做；不够线的颜色单独流团，退还该色定金。</p>' : "") +
      '<div class="stack">' + j.rows.map(function (r) {
        return '<div class="hr"></div><strong>' + esc(r.color) + " · 第 " + r.batchNo + " 团</strong>" +
          '<p class="hint">' + r.got + " / " + r.target + " 件（" + Math.round(r.rate * 100) + "%） → " +
          (r.enough ? '<span class="gold">成团</span>' : '<span class="bad">流团</span>') + "</p>";
      }).join("") + "</div></div>";
    return html;
  }

  // 流团退款清单块（App 不自动退，只出清单；文档 §五 / §一）
  function blockRefund(d, j) {
    if (!j || !j.refundable.length) return "";
    var rl = d.refundList;
    return '<div class="block"><h2>流团退款清单</h2>' +
      '<p class="hint">App 不收款也不自动退款，这里只生成清单。真实退款请在平台操作。</p>' +
      (rl
        ? '<div class="price">' + money(rl.total) + "<small> / 应退定金</small></div>" +
          '<div class="kv"><span>涉及订单</span><span>' + rl.count + " 单</span></div>" +
          '<div class="scroll-x"><table><thead><tr><th>匿名ID</th><th>颜色</th><th>金额</th></tr></thead><tbody>' +
          rl.rows.map(function (r) {
            return "<tr><td>" + esc(r.anonId) + "</td><td>" + esc(r.color) + '</td><td class="num">' + money(r.amount) + "</td></tr>";
          }).join("") + "</tbody></table></div>"
        : '<p class="hint">有 ' + j.refundable.length + " 单需要退定金。</p>") +
      '<button type="button" class="btn wide" data-act="build-refund">' +
      (rl ? "重新生成清单" : "生成退款清单（" + j.refundable.length + " 单）") + "</button>" +
      (rl ? '<button type="button" class="btn bad wide" data-act="mark-refunded">标记为已退款（订单转已退款）</button>' : "") +
      "</div>";
  }

  // 款状态块
  function blockDesignState(d, j) {
    if (!j) return "";
    return '<div class="block"><h2>款状态</h2>' +
      '<div class="kv"><span>当前</span><span>' + esc(d.designState || "预售中") + "</span></div>" +
      '<div class="kv"><span>判定后应为</span><span class="gold">' + esc(j.designState) + "</span></div>" +
      (d.designState === j.designState
        ? '<p class="hint">已同步。</p>'
        : '<button type="button" class="btn primary wide" data-act="apply-design-state">把款状态改为「' + esc(j.designState) + '」</button>') +
      "</div>";
  }

  function vFinal(d) {
    var f = d.finance;
    var colors = R.colors(d.words ? d.words.color : []);
    var body = "";

    if (!f || f.error) {
      body += '<div class="block"><h2>定样</h2>' +
        '<p class="hint">先在第 10 步「成本」里算出单件成本，再来定样定价。</p></div>';
      return screen("final", "定样", stepLabel("final"), body);
    }

    body += '<div class="block"><h2>成本依据（来自成本页）</h2>' +
      '<div class="kv"><span>单件成本</span><span>' + money(f.cost) + "</span></div>" +
      '<div class="kv"><span>成本页填的售价</span><span>' + money(f.price) + "</span></div>" +
      '<p class="hint">这里填的是<b>对外公布价</b>，可以和成本页的测算售价不同。</p></div>';

    var fin = d.final;
    var skus = fin && fin.skus && fin.skus.length ? fin.skus : Factory.buildSkus(colors);
    body += '<div class="block"><h2>公布价格与工期</h2><div class="grid2">' +
      '<div><label for="fin-price">公布价（元）</label><input id="fin-price" inputmode="decimal" placeholder="例如 899" value="' + esc(fin ? fin.price : "") + '"></div>' +
      '<div><label for="fin-rate">定金比例（%）</label><input id="fin-rate" inputmode="decimal" placeholder="20" value="' + esc(fin ? fin.depositRate : Factory.DEFAULT_DEPOSIT_RATE) + '"></div>' +
      '<div><label for="fin-lead">工期（天）</label><input id="fin-lead" inputmode="numeric" placeholder="例如 45" value="' + esc(fin ? fin.leadDays : "") + '"></div>' +
      '<div><label for="fin-deadline">成团截止日期</label><input id="fin-deadline" placeholder="例如 2026-11-30" value="' + esc(fin ? fin.deadline : "") + '"></div>' +
      "</div><p class=\"hint\">成团线默认 " + Factory.DEFAULT_TARGET + " 件，可逐色覆盖（分色成团）。</p></div>";

    body += '<div class="block"><h2>分色成团线</h2>' +
      (colors.length ? "" : '<p class="warn-note">这条设计单没有颜色（words.color 为空），无法设置 SKU。回设计词页重新生成。</p>') +
      '<div class="stack">' + skus.map(function (s, i) {
        return '<div class="sku-row"><span class="sku-color">' + esc(s.color) + "</span>" +
          '<input data-sku="' + i + '" data-color="' + esc(s.color) +
          '" inputmode="numeric" value="' + s.target + '" placeholder="目标件数">' +
          '<span class="hint">件成团</span></div>';
      }).join("") + "</div></div>";

    body += '<div class="block"><h2>算出定样</h2>' +
      '<button type="button" class="btn primary wide" data-act="run-final">生成定样</button></div>';

    if (fin && !fin.__error) {
      body += '<div class="block"><h2>定样结果</h2>' +
        '<div class="price">' + money(fin.price) + "<small> / 件公布价</small></div>" +
        '<div class="hr"></div>' +
        '<div class="kv"><span>定金</span><span>' + money(fin.deposit) + "</span></div>" +
        '<div class="kv"><span>尾款</span><span>' + money(fin.balance) + "</span></div>" +
        '<div class="kv"><span>工期</span><span>' + fin.leadDays + " 天</span></div>" +
        (fin.deadline ? '<div class="kv"><span>成团截止</span><span>' + esc(fin.deadline) + "</span></div>" : "") +
        '<div class="kv"><span>总目标件数</span><span>' + fin.totalTarget + " 件</span></div>" +
        '<div class="kv"><span>单件毛利</span><span>' + money(fin.unitMargin) + "</span></div>" +
        '<div class="kv"><span>满额利润</span><span class="gold">' + money(fin.fullProfit) + "</span></div>" +
        (fin.breakEven > 0
          ? '<div class="kv"><span>保本件数</span><span>' + fin.breakEven + " 件</span></div>"
          : '<p class="warn-note">公布价低于单件成本，怎么卖都亏。</p>') +
        "</div>";
      // 定样完成才能开团（P0-1 修复：此前 final→pre 断头）
      body += '<div class="block">' + nextBtn("pre", "下一步 · 预售开团") + "</div>";
    }

    return screen("final", "定样", stepLabel("final"), body);
  }

  /* ===== 预售开团（文档第 7 项）===== */
  // 严守 §一：只记匿名 ID + 颜色 + 批次 + 数量 + 金额 + 状态；不存姓名/电话/地址
  function vPre(d) {
    var fin = d.final;
    var pre = d.pre;
    var orders = d.orders || [];
    var body = "";

    if (!fin || fin.__error) {
      body += '<div class="block"><h2>预售</h2>' +
        '<p class="hint">先在第 11 步「定样」完成定价，才能开团。</p></div>';
      return screen("pre", "预售", stepLabel("pre"), body);
    }

    if (!pre) {
      body += '<div class="block"><h2>开团</h2>' +
        '<div class="kv"><span>公布价</span><span>' + money(fin.price) + "</span></div>" +
        '<div class="kv"><span>定金</span><span>' + money(fin.deposit) + "</span></div>" +
        '<div class="kv"><span>工期</span><span>' + fin.leadDays + " 天</span></div>" +
        '<p class="hint">开团后按颜色各建一个批次，成团线取定样里设的目标件数。</p>' +
        '<button type="button" class="btn primary wide" data-act="open-pre">开团（按颜色建批次）</button></div>';
      return screen("pre", "预售", stepLabel("pre"), body);
    }

    body += '<div class="block"><h2>本次开团</h2>' +
      '<div class="kv"><span>公布价</span><span>' + money(pre.price) + "</span></div>" +
      '<div class="kv"><span>定金</span><span>' + money(pre.deposit) + "</span></div>" +
      '<div class="kv"><span>成团截止</span><span>' + esc(pre.deadline || "未设") + "</span></div>" +
      '<p class="hint">已开 ' + pre.batches.length + " 个批次（颜色 × 一团）。</p></div>";

    body += '<div class="block"><h2>录入定金单</h2>' +
      '<p class="hint">每行一条：<b>颜色,数量,金额</b>。逗号/顿号/制表符分隔都行。' +
      '<br>App 不收款，这里只记账；也不存买家姓名、电话、地址。</p>' +
      '<textarea id="in-orders" placeholder="白紫,3,540&#10;黑黑,2,360"></textarea>' +
      '<button type="button" class="btn primary wide" data-act="add-orders">批量录入</button></div>';

    var tally = OM().tallyByBatch(pre, orders);
    body += '<div class="block"><h2>成团进度（颜色 × 批次）</h2><div class="scroll-x"><table><thead><tr>' +
      "<th>颜色</th><th>批次</th><th>已成团</th><th>成团线</th><th>进度</th></tr></thead><tbody>" +
      tally.map(function (t) {
        var pct = Math.round(t.rate * 100);
        return "<tr><td>" + esc(t.color) + "</td><td>第 " + t.batchNo + " 团</td>" +
          '<td class="num">' + t.got + '</td><td class="num">' + t.target + "</td>" +
          '<td class="num ' + (t.enough ? "gold" : "") + '">' + pct + "%</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="hint">成团率 = 该颜色该批次的实际件数 ÷ 目标件数，按行判定。</p></div>';

    if (orders.length) {
      body += '<div class="block"><h2>定金单（' + orders.length + "）</h2>" +
        '<p class="hint">默认只显示匿名 ID；真单号只在发货/退款/对账时录入。</p>' +
        '<div class="scroll-x"><table><thead><tr><th>匿名ID</th><th>颜色</th><th>数量</th><th>金额</th><th>状态</th></tr></thead><tbody>' +
        orders.map(function (o) {
          return "<tr><td>" + esc(o.anonId) + "</td><td>" + esc(o.color) + "</td>" +
            '<td class="num">' + o.qty + '</td><td class="num">' + money(o.amount) + "</td>" +
            "<td>" + esc(o.state) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";

      var total = orders.reduce(function (s, o) { return s + (Number(o.amount) || 0); }, 0);
      var sumQty = orders.reduce(function (s, o) { return s + (Number(o.qty) || 0); }, 0);
      body += '<div class="block"><h2>合计</h2><div class="price">' + money(total) +
        "<small> / 定金合计</small></div>" +
        '<div class="kv"><span>订单数</span><span>' + orders.length + " 单</span></div>" +
        '<div class="kv"><span>件数</span><span>' + sumQty + " 件</span></div></div>";
    }

    // —— 成团判定 / 退款清单 / 款状态（拆成独立块函数，见下方 blockJudge/blockRefund/blockDesignState）——
    var j = d.judge;
    body += blockJudge(pre, j);
    body += blockRefund(d, j);
    body += blockDesignState(d, j);

    // —— 履约：大货 / 补尾款 / 发货 / 售后（批 E3 + 批 E4，拆到 render-flux.js）——
    if (global.RenderFlux && d.pre) {
      var Fx = global.RenderFlux;
      body += Fx.blockBatch(d) + Fx.blockTail(d, d.orders) +
              Fx.blockShip(d.orders) + Fx.blockAfterSale(d.orders);
    }

    // P0-1 修复：此前 pre→board 断头，看板走不到
    body += '<div class="block">' + nextBtn("board", "下一步 · 统计看板") + "</div>";

    return screen("pre", "预售", stepLabel("pre"), body);
  }

  // vHistory 已拆到 render-history.js（批 E5；它自己在 R 上挂载，此处不再赋值）
  R.vPlan = vPlan;
  R.vFinal = vFinal;
  R.vPre = vPre;
  R.aiResults = aiResults;
  R.estimateBlock = estimateBlock;
  R.epListHTML = epListHTML;
})(window);
