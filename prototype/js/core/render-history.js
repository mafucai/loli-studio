/* 历史页视图（批 E5：从 render-extra.js 拆出，避免单文件超 400 行）
 * 文档 §十 第 3 项 / §六补充「多款并行」：必须能从历史页新建下一款。
 * 此前 vHistory 只有列表、没有新建入口 —— ACT["new"] 实现了却零按钮绑定，
 * 多款并行场景下用户无法开新款（只能重启 App 触发自动建单）。
 */
(function (global) {
  "use strict";

  function esc(s) { return global.R.esc(s); }
  function stepName(id) {
    var steps = (global.Router && global.Router.STEPS) || [];
    for (var i = 0; i < steps.length; i++) if (steps[i].id === id) return steps[i].title;
    return "";
  }

  function vHistory(list) {
    var tab = (typeof global.HIST_TAB !== "undefined" && global.HIST_TAB) ? global.HIST_TAB : "orders";
    var tabs = '<div class="tabs">' +
      '<button type="button" class="tab' + (tab === "orders" ? " on" : "") + '" data-act="hist-tab" data-tab="orders">设计单</button>' +
      '<button type="button" class="tab' + (tab === "images" ? " on" : "") + '" data-act="hist-tab" data-tab="images">图片</button>' +
      "</div>";

    // 新建入口：**始终渲染**（空态与有数据时都要，支持多款并行）
    var newBtn = '<button type="button" class="btn primary wide" data-act="new">＋ 新建设计单</button>';

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
    return '<div class="screen"><h1>历史</h1><p class="sub">共 ' + list.length + " 个设计单</p>" +
      tabs + body + '<div class="block">' + newBtn +
      '<p class="hint">多款并行：每款一个设计单，各自独立统计成团。</p></div></div>';
  }

  // 自己挂到 R 上（不依赖 render-extra.js 的加载时机：
  // 本文件在 index.html 里位于 render-extra 之后，若由 render-extra 赋值会拿到 undefined）
  var R = global.R || (global.R = {});
  R.vHistory = vHistory;
  global.RenderHistory = { vHistory: vHistory };
})(window);
