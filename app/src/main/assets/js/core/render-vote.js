/* 图透视图（从 render-extra.js 拆出，遵守单文件 ≤400 行铁律）
 * 覆盖：多版本对比、投票、改版留痕
 * 依赖：R.esc / R.money / R.screen / R.stepLabel（render.js 先加载）
 */
(function (global) {
  "use strict";

  var R = global.R || (global.R = {});
  function esc(s) { return R.esc(s); }
  function screen(curId, title, sub, body) { return R.screen(curId, title, sub, body); }
  function stepLabel(id) { return R.stepLabel(id); }

  function vVote(d) {
    var versions = d.versions || [];
    var cur = versions[d.currentVersion || 0] || null;
    var votes = d.votes || [];
    var body = "";

    if (!versions.length) {
      body += '<div class="block"><h2>图透</h2>' +
        '<p class="hint">先把第 2 步的候选图设为第 1 版，才能开始图透。</p>' +
        '<button type="button" class="btn primary wide" data-act="start-version">把当前图设为第 1 版</button></div>';
      return screen("vote", "图透", "第 3 步 · 多版本对比与意见", body);
    }

    body += '<div class="block"><h2>当前 · 第 ' + cur.n + " 版</h2>" +
      '<img class="card-img tall" src="' + esc(cur.uri) + '" alt="第 ' + cur.n + ' 版">' +
      '<p class="hint">来源：' + esc(cur.source === "ai" ? "图片接口生成" : "演示图") +
      " · " + esc(String(cur.at).slice(0, 16).replace("T", " ")) + "</p>" +
      (cur.reason ? '<p class="hint">改版原因：' + esc(cur.reason) + "</p>" : "") +
      (cur.note ? '<p class="note">' + esc(cur.note) + "</p>" : "") + "</div>";

    if (versions.length > 1) {
      body += '<div class="block"><h2>全部版本（' + versions.length + '）</h2>' +
        '<p class="hint">旧版本永不删除，这就是改版留痕。点缩略图切换对比。</p>' +
        '<div class="ver-grid">' + versions.map(function (v, i) {
          var on = i === (d.currentVersion || 0);
          return '<button type="button" class="ver' + (on ? " on" : "") +
            '" data-act="switch-version" data-index="' + i + '">' +
            '<img src="' + esc(v.uri) + '" alt="第 ' + v.n + ' 版">' +
            '<span>第 ' + v.n + " 版</span>" +
            "<em>" + esc(String(v.at).slice(5, 10)) + "</em></button>";
        }).join("") + "</div></div>";
    }

    var curVotes = votes.filter(function (v) { return v.versionNo === cur.n; });
    body += '<div class="block"><h2>这一版怎么评</h2>' +
      '<div class="chips">' + Factory.VOTE_CHOICES.map(function (c) {
        var on = curVotes.some(function (v) { return v.choice === c; });
        return '<button type="button" class="chip' + (on ? " on" : "") +
          '" data-act="vote" data-value="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("") + "</div>" +
      '<label for="in-vnote">意见 / 需要改哪里</label>' +
      '<input id="in-vnote" placeholder="例：裙摆太长，腰线再高一点" value="' + esc(d.voteNote || "") + '">' +
      '<button type="button" class="btn wide" data-act="save-vote">记录这一票</button></div>';

    if (curVotes.length) {
      body += '<div class="block"><h2>已记录</h2>' + curVotes.map(function (v) {
        return '<div class="hr"></div><strong>' + esc(v.choice) + "</strong>" +
          '<p class="hint">' + esc(String(v.at).slice(0, 16).replace("T", " ")) + "</p>" +
          (v.note ? '<p class="note">' + esc(v.note) + "</p>" : "");
      }).join("") + "</div>";
    }

    var revised = versions.filter(function (v) { return v.n > 1; });
    if (revised.length) {
      body += '<div class="block"><h2>改版记录</h2>' + revised.map(function (v) {
        return '<div class="hr"></div><strong>第 ' + v.n + " 版</strong>" +
          '<p class="hint">' + esc(v.reason || "未填原因") + " · " +
          esc(String(v.at).slice(0, 16).replace("T", " ")) + "</p>";
      }).join("") + "</div>";
    }

    body += '<div class="block"><h2>改版重开</h2>' +
      '<p class="hint">改版必须填原因，否则留痕没有意义。改版新增一版，旧版保留。</p>' +
      '<label for="in-reason">改版原因</label>' +
      '<div class="chips">' + Factory.REVISE_REASONS.map(function (r) {
        return '<button type="button" class="chip" data-act="pick-reason" data-value="' + esc(r) + '">' + esc(r) + "</button>";
      }).join("") + "</div>" +
      '<input id="in-reason" placeholder="点上面一项，或自己写" value="' + esc(d.reviseReason || "") + '">' +
      '<button type="button" class="btn primary wide" data-act="revise-img">改版重开（生成新版）</button></div>';

    body += '<div class="block">' + nextBtn("part", "下一步 · 拆件") + "</div>";
    return screen("vote", "图透", "第 3 步 · 多版本对比与意见", body);
  }
  R.vVote = vVote;
})(window);
