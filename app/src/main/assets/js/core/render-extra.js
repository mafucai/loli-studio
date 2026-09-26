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

  function stepName(id) {
    var steps = (global.Router && Router.STEPS) || [];
    for (var i = 0; i < steps.length; i++) if (steps[i].id === id) return steps[i].title;
    return "";
  }

  // 历史页：设计单 / 图片 两个标签
  function vHistory(list) {
    var tab = (typeof global.HIST_TAB !== "undefined" && global.HIST_TAB) ? global.HIST_TAB : "orders";
    var tabs = '<div class="tabs">' +
      '<button type="button" class="tab' + (tab === "orders" ? " on" : "") + '" data-act="hist-tab" data-tab="orders">设计单</button>' +
      '<button type="button" class="tab' + (tab === "images" ? " on" : "") + '" data-act="hist-tab" data-tab="images">图片</button>' +
      "</div>";

    var body = "";
    if (tab === "images") {
      var imgs = [];
      list.forEach(function (d) {
        var label = d.prompt || "未命名设计单";
        if (d.imgUri) imgs.push({ uri: d.imgUri, kind: "设计图", label: label, id: d.id });
        if (d.combo && d.combo.uri) imgs.push({ uri: d.combo.uri, kind: "组合图", label: label, id: d.id });
        if (d.model && d.model.uri) imgs.push({ uri: d.model.uri, kind: "模特图", label: label, id: d.id });
      });
      if (!imgs.length) {
        body = '<div class="empty">还没有生成过图片。</div>';
      } else {
        body = '<div class="block"><h2>全部图片</h2><div class="img-grid">' + imgs.map(function (im) {
          return '<button type="button" class="img-cell" data-act="open-history" data-id="' + esc(im.id) + '">' +
            '<img src="' + esc(im.uri) + '" alt="' + esc(im.kind) + '">' +
            '<span class="cap">' + esc(im.kind) + '</span>' +
            '<span class="sub">' + esc(im.label) + "</span></button>";
        }).join("") + "</div></div>";
      }
    } else {
      if (!list.length) {
        body = '<div class="empty">还没有设计单。</div>';
      } else {
        body = '<div class="block"><h2>全部设计单</h2>' + list.map(function (d) {
          var time = new Date(d.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
          return '<button type="button" class="history-item" data-act="open-history" data-id="' + esc(d.id) + '">' +
            '<span class="t">' + esc(d.prompt || "未命名设计单") + "</span>" +
            '<span class="m">' + time + " · " + esc(stepName(d.step)) + (d.markedOriginal ? " · 原创" : "") + "</span></button>";
        }).join("") + "</div>";
      }
    }
    return '<div class="screen"><h1>历史</h1><p class="sub">共 ' + list.length + " 个设计单</p>" + tabs + body + "</div>";
  }

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

  var _origHistory = R.vHistory;
  R.vHistory = vHistory;
  R.aiResults = aiResults;
  R.estimateBlock = estimateBlock;
  R.epListHTML = epListHTML;
})(window);
