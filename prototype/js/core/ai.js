/* AI 适配层：留空=mock，填了才真调。永远明示当前模式，不假装成功。
 * 依赖：store.js 的 getCfg/setCfg（运行时查找，避免加载顺序耦合）。
 */
(function (global) {
  "use strict";

  function cfg() {
    return (global.Store && Store.getCfg()) || {};
  }

  function mode() {
    var c = cfg();
    return (c.base && c.key) ? "real" : "mock";
  }

  // 演示模式的确定性伪随机（同一 seed 得到同一结果，便于回归）
  function srand(seed) {
    var s = 0;
    for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  async function chat(user, opts) {
    opts = opts || {};
    if (mode() === "real") {
      try {
        var c = cfg();
        var r = await fetch(c.base.replace(/\/$/, "") + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.key },
          body: JSON.stringify({
            model: c.model || "gpt-4o-mini",
            messages: [{ role: "system", content: opts.system || "你是洛丽塔服装设计助手。" }, { role: "user", content: user }],
            temperature: 0.7
          })
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        var j = await r.json();
        return j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
      } catch (e) {
        return { __error: "接口调用失败：" + e.message + "（已切回演示模式继续）" };
      }
    }
    // mock：本地工厂给结构化回答，不假装是模型输出
    if (opts.mock) return opts.mock(user);
    return "[演示模式] 请填 Base URL + Key 后再试真实生成。当前为本地模拟。";
  }

  // 图片：mock 时用本地 SVG 数据 URI，不依赖任何 CDN（流程 §3.7 硬约束）
  function imgDataUri(kind, seed, w, h) {
    w = w || 360; h = h || 480;
    var rnd = srand(kind + seed);
    var palette = {
      dress: ["#e8d5c4", "#c9a3b8", "#f4e6d3"],
      detail: ["#2a2431", "#4a3d52", "#8b6f9e"],
      model: ["#1a1611", "#3a2f3a", "#6a4d5e"],
      combo: ["#3a3129", "#5a4a3a", "#8a7050"],
      look:  ["#c9b8a0", "#9a8870", "#6a5a45"]
    }[kind] || ["#c9b8a0", "#9a8870", "#6a5a45"];
    var shapes = "";
    for (var i = 0; i < 14; i++) {
      var x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
      var r = 20 + Math.floor(rnd() * 120), o = (0.06 + rnd() * 0.18).toFixed(3);
      shapes += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + palette[i % 3] + '" opacity="' + o + '"/>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<rect width="100%" height="100%" fill="#1b1815"/>' + shapes +
      '<text x="50%" y="52%" text-anchor="middle" fill="#d9b26a" font-family="serif" font-size="20" opacity=".85">' + kind.toUpperCase() + '</text>' +
      '<text x="50%" y="60%" text-anchor="middle" fill="#9a8f7c" font-family="monospace" font-size="11" opacity=".7">' + String(seed).slice(0, 12) + '</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  global.AI = { chat: chat, mode: mode, img: imgDataUri, srand: srand };
})(window);
