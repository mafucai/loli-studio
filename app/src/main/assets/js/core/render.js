/* 纯渲染层：只返回 HTML 字符串，禁 document.（用 grep 断言）
 * 依赖：Router.STEPS 只用于索引；不碰 Store、不碰 AI。
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? "-" : "") + "¥" + Math.abs(n).toLocaleString("zh-CN");
  }
  function stepIcon(n, state) {
    if (state === "done") return '<i>✓</i>';
    return '<i>' + n + '</i>';
  }
  function stepName(id) {
    var s = global.Router && Router.STEPS;
    for (var i = 0; i < s.length; i++) if (s[i].id === id) return s[i].title;
    return "";
  }

  // 顶部九步导航
  function stepsNav(curId, design) {
    var ids = Router.STEPS.map(function (s) { return s.id; });
    var idx = ids.indexOf(curId);
    var h = "";
    ids.forEach(function (id, i) {
      var cls = i < idx ? "done" : (i === idx ? "cur" : "");
      h += '<button type="button" class="step ' + cls + '" data-act="goto" data-step="' + esc(id) + '">' +
        stepIcon(Router.STEPS[i].n, i < idx ? "done" : "") +
        '<span>' + esc(stepName(id)) + '</span></button>';
    });
    return h;
  }

  // 进度条
  function progress(curId) {
    var ids = Router.STEPS.map(function (s) { return s.id; });
    var pct = Math.round(ids.indexOf(curId) / (ids.length - 1) * 100);
    return '<div style="height:2px;background:rgba(236,228,211,.08);margin:0 12px 8px"><i style="display:block;height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--gold),var(--gold-2))"></i></div>';
  }

  // 步骤 1：设计词
  function vWord(d) {
    var w = d.words || null;
    var html = '<div class="panel"><h2>1 · 设计词</h2>' +
      '<p class="hint">一句话告诉 AI 你想要的洛丽塔风格（颜色 / 版型 / 场合 / 主题），下一步 AI 生成设计词。</p>' +
      '<textarea id="in-prompt" placeholder="例：雾霾蓝英式下午茶风格 春夏薄款 甜美日常 蝴蝶结收腰">' + esc(d.prompt || "") + '</textarea>' +
      '<div class="row gap" style="margin-top:10px"><button class="btn primary wide" data-act="gen-words">生成设计词</button></div></div>';
    if (w) {
      html += '<div class="panel"><h2>AI 输出</h2>' +
        '<div class="row between"><span class="tag">风格</span><strong>' + esc(w.style) + '</strong></div>' +
        '<div class="kv"><span>季节</span><span>' + esc(w.season) + '</span></div>' +
        '<div class="kv"><span>主面料</span><span>' + esc(w.mainFabric) + '</span></div>' +
        '<div class="kv"><span>主色</span><span>' + esc(w.color) + '</span></div>' +
        '<div style="margin-top:10px"><div class="hint">细节</div><div>' +
        w.details.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join("") +
        '</div></div>' +
        '<div style="margin-top:10px"><div class="hint">装饰</div><div>' +
        w.decors.map(function (x) { return '<span class="tag plain">' + esc(x) + '</span>'; }).join("") +
        '</div></div>' +
        '<div style="margin-top:10px"><div class="hint">尺寸</div><div>' +
        w.sizes.map(function (x) { return '<span class="tag plain">' + esc(x) + '</span>'; }).join("") +
        '</div></div>' +
        '<p class="note">' + esc(w.mood) + '</p></div>';
    }
    html += '<button class="btn wide ' + (w ? 'primary' : '') + '" data-act="next" data-step="img">' + (w ? '下一步：出图 →' : '先生成设计词') + '</button>';
    return html;
  }

  // 步骤 2：出图 + 审图
  function vImg(d) {
    var h = '<div class="panel"><h2>2 · 出图</h2>' +
      '<p class="hint">AI 根据设计词生成 4 张候选图，选一张进入拆件。</p>';
    if (!d.imgUri) {
      h += '<div class="empty">还没有图。先在第 1 步生成设计词，或点击生成。</div>' +
        '<button class="btn primary wide" data-act="gen-img">生成候选图</button>';
    } else {
      h += '<img class="card-img tall" src="' + esc(d.imgUri) + '" alt="候选图">' +
        '<div class="row gap" style="margin-top:10px">' +
        '<button class="btn bad" data-act="reject-img">驳回 · 重画</button>' +
        '<button class="btn ok" data-act="pass-img">通过 · 拆件</button></div>';
      h += '<button class="btn wide small" data-act="gen-img" style="margin-top:6px">再生一张</button>';
    }
    h += '</div>';
    if (d.imgPassed) {
      h += '<button class="btn primary wide" data-act="next" data-step="part">下一步：拆件 →</button>';
    }
    return h;
  }

  // 步骤 3：拆件 BOM
  function vPart(d) {
    var b = d.bom;
    var h = '<div class="panel"><h2>3 · 拆件 · BOM</h2>';
    if (!b) {
      h += '<div class="empty">先在第 2 步通过图片，才能拆件。</div>' +
        '<button class="btn primary wide" data-act="gen-bom">生成 BOM</button>';
    } else {
      h += '<table><thead><tr><th>零件</th><th>材料</th><th>用量</th><th>价</th></tr></thead><tbody>' +
        b.rows.map(function (r) {
          return '<tr><td>' + esc(r.part) + '<div class="muted" style="font-size:10px">' + esc(r.note) + '</div></td>' +
            '<td>' + esc(r.material) + '</td><td class="num">' + r.amount + r.unit + '</td>' +
            '<td class="num">' + money(r.subtotal) + '</td></tr>';
        }).join("") +
        '</tbody></table>' +
        '<div class="hr"></div>' +
        '<div class="kv"><span>面料辅料合计</span><span>' + money(b.fabricTotal) + '</span></div>' +
        '<div class="kv"><span>工时合计</span><span>' + money(b.laborTotal) + '</span></div>' +
        '<div class="kv"><span>固定成本（制版/寄样）</span><span>' + money(b.fixedTotal) + '</span></div>' +
        '<div class="kv"><span><strong>单件成本</strong></span><span>' + money(b.total) + '</span></div>' +
        '<div class="hint" style="margin-top:8px">工艺步骤</div>' +
        '<div class="scroll-x"><table><thead><tr><th>工序</th><th>工时</th><th>成本</th></tr></thead><tbody>' +
        b.labor.map(function (l) {
          return '<tr><td>' + esc(l.step) + '</td><td class="num">' + esc(l.time) + '</td><td class="num">' + money(l.cost) + '</td></tr>';
        }).join("") + '</tbody></table></div></div>';
    }
    h += '<button class="btn primary wide" data-act="next" data-step="check" style="margin-top:6px">下一步：查重 →</button>';
    return h;
  }

  // 步骤 4：查重 + 原创
  function vCheck(d) {
    var c = d.check;
    var h = '<div class="panel"><h2>4 · 查重 · 原创</h2>';
    if (!c) {
      h += '<div class="empty">先在拆件完成。</div><button class="btn primary wide" data-act="run-check">跨平台查重</button>';
    } else {
      h += '<p class="hint">AI 已扫描 5 大平台相似款，按最高相似度判定。</p>' +
        '<table><thead><tr><th>平台</th><th>相似款</th><th>最高</th><th>判定</th></tr></thead><tbody>' +
        c.results.map(function (r) {
          var cls = r.verdict === "原创" ? "ok" : (r.verdict === "相近" ? "warn" : "bad");
          return '<tr><td><a href="' + esc(r.url) + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none">' + esc(r.platform) + '</a></td>' +
            '<td class="num">' + r.hits + '</td><td class="num">' + r.maxSim + '%</td>' +
            '<td><span class="tag ' + cls + '">' + esc(r.verdict) + '</span></td></tr>';
        }).join("") +
        '</tbody></table>' +
        '<div class="hr"></div>' +
        '<div class="kv"><span>最差判定</span><span>' + esc(c.worst.verdict) + '</span></div>' +
        '<div class="kv"><span>建议</span><span>' + esc(c.worst.note) + '</span></div>';
      if (c.pass && !d.markedOriginal) {
        h += '<button class="btn ok wide" data-act="mark-original" style="margin-top:10px">标原创通过</button>';
      }
      if (d.markedOriginal) {
        h += '<div style="margin-top:10px;text-align:center"><span class="origil">原创 ✓</span></div>';
      }
      if (!c.pass) {
        h += '<button class="btn bad wide" data-act="reject-original" style="margin-top:10px">驳回 · 回设计词</button>';
      }
    }
    h += '</div>';
    if (d.markedOriginal) h += '<button class="btn primary wide" data-act="next" data-step="buy">下一步：采购 →</button>';
    return h;
  }

  // 步骤 5：采购 + 实物图
  function vBuy(d) {
    var s = d.sourcing;
    var b = d.bom;
    var h = '<div class="panel"><h2>5 · 采购 · 实物链接</h2>';
    if (!s) {
      h += '<div class="empty">先完成查重 + 标原创。</div><button class="btn primary wide" data-act="run-sourcing">拉采购清单</button>';
    } else {
      h += '<p class="hint">按最低单价排序，给出拼多多/1688 链接，点击可直接跳。</p>' +
        '<table><thead><tr><th>零件</th><th>渠道</th><th>单价</th><th>省</th></tr></thead><tbody>' +
        s.map(function (r) {
          var save = (b && b.rows.find(function (x) { return x.part === r.part; })) ? (b.rows.find(function (x) { return x.part === r.part; }).subtotal - r.priceBest * r.amount) : 0;
          return '<tr><td>' + esc(r.part) + '<div class="muted" style="font-size:10px">' + esc(r.material) + ' ×' + r.amount + r.unit + '</div></td>' +
            '<td><a href="' + esc(r.link) + '" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none">' + esc(r.channel) + '</a><br>' +
            '<a href="' + esc(r.altLink) + '" target="_blank" rel="noopener" style="color:var(--ink-2);font-size:10px;text-decoration:none">备选·' + esc(r.alt) + '</a></td>' +
            '<td class="num">' + money(r.priceBest) + '</td><td class="num ok">省' + money(save) + '</td></tr>';
        }).join("") + '</tbody></table>';
      // 实物图（4 件）
      h += '<div class="divider-txt">实 物 图</div>' +
        '<div class="grid2">' +
        [ {t:'主裙身',k:'dress',c:b?b.words.color:''}, {t:'裙撑',k:'detail',c:'白'}, {t:'袖口',k:'look',c:b?b.words.mainFabric:''}, {t:'蝴蝶结',k:'combo',c:'粉'} ]
          .map(function (x) {
            return '<div><img class="card-img sq" src="' + esc(AI.img(x.k, x.t + x.c + (b?b.id:''), 200, 200)) + '" alt="' + esc(x.t) + '">' +
              '<div class="muted" style="text-align:center;font-size:11px;margin-top:4px">' + esc(x.t) + '</div></div>';
          }).join("") + '</div>';
    }
    h += '</div>';
    if (s) h += '<button class="btn primary wide" data-act="next" data-step="look">下一步：组合实况 →</button>';
    return h;
  }

  // 步骤 6：组合实况 + 算价
  function vLook(d) {
    var c = d.combo, b = d.bom;
    var h = '<div class="panel"><h2>6 · 组合实况 · 算价</h2>';
    if (!c) {
      h += '<div class="empty">先完成采购。</div><button class="btn primary wide" data-act="gen-combo">合成组合图</button>';
    } else {
      h += '<img class="card-img wide" src="' + esc(c.uri) + '" alt="组合实况">' +
        '<p class="note">' + esc(c.note) + '</p>';
      if (b) {
        h += '<div class="hr"></div><div class="hint">按当前采购价重算</div>' +
          '<div class="kv"><span>面料辅料（已议价）</span><span>' + money(Math.round(b.fabricTotal * 0.75)) + '</span></div>' +
          '<div class="kv"><span>工时/大货</span><span>' + money(Math.round(b.laborTotal * 0.55)) + '</span></div>' +
          '<div class="kv"><span>固定成本（摊）</span><span>' + money(Math.round(b.fixedTotal / 100)) + '</span></div>' +
          '<div class="kv"><span><strong>大货单件成本</strong></span><span>' + money(Math.round(b.fabricTotal*0.75 + b.laborTotal*0.55 + b.fixedTotal/100)) + '</span></div>';
      }
    }
    h += '</div>';
    if (c) h += '<button class="btn primary wide" data-act="next" data-step="model">下一步：模特细节 →</button>';
    return h;
  }

  // 步骤 7：模特细节
  function vModel(d) {
    var m = d.model;
    var h = '<div class="panel"><h2>7 · 模特细节图</h2>';
    if (!m) {
      h += '<div class="empty">先完成组合实况。</div><button class="btn primary wide" data-act="gen-model">生成模特图</button>';
    } else {
      h += '<div class="grid2"><img class="card-img thin" src="' + esc(m.uri) + '" alt="模特正面">' +
        '<img class="card-img thin" src="' + esc(AI.img("model", (d.bom?d.bom.words.style:"s")+"back", 200, 400)) + '" alt="模特背面"></div>' +
        '<p class="note">' + esc(m.note) + '</p>';
    }
    h += '</div>';
    if (m) h += '<button class="btn primary wide" data-act="next" data-step="fact">下一步：工厂寻源 →</button>';
    return h;
  }

  // 步骤 8：工厂寻源
  function vFact(d) {
    var fs = d.factories;
    var h = '<div class="panel"><h2>8 · 工厂寻源</h2>';
    if (!fs) {
      h += '<div class="empty">先完成模特图。</div><button class="btn primary wide" data-act="run-factories">搜工厂</button>';
    } else {
      h += '<p class="hint">按单价升序。点击选中合作工厂。</p>';
      fs.slice().sort(function (a, b) { return a.unitCost - b.unitCost; }).forEach(function (f, i) {
        var cur = d.pickedFactory && d.pickedFactory.name === f.name;
        h += '<div class="panel tight" style="margin-bottom:8px;border:' + (cur ? '1px solid var(--gold)' : '1px solid var(--line)') + '">' +
          '<div class="row between"><strong>' + esc(f.name) + '</strong>' +
          '<span class="price" style="font-size:16px">' + money(f.unitCost) + '<small>/件</small></span></div>' +
          '<div class="muted" style="font-size:11px">' + esc(f.region) + ' · ' + esc(f.scale) + ' · MOQ ' + f.min + '件 · ' + esc(f.leadTime) + '</div>' +
          '<div style="margin-top:6px">' + f.tags.map(function (t) { return '<span class="tag plain">' + esc(t) + '</span>'; }).join("") + '</div>' +
          '<div class="row gap" style="margin-top:8px">' +
          '<button class="btn small" data-act="call-fact" data-idx="' + fs.indexOf(f) + '">联系</button>' +
          '<button class="btn small ' + (cur ? 'primary' : '') + '" data-act="pick-fact" data-idx="' + fs.indexOf(f) + '">' + (cur ? '✓ 已选' : '选这家') + '</button>' +
          '<a class="btn small" href="' + esc(f.link) + '" target="_blank" rel="noopener">1688</a></div></div>';
      });
    }
    h += '</div>';
    if (d.pickedFactory) h += '<button class="btn primary wide" data-act="next" data-step="cost">下一步：成本利润 →</button>';
    return h;
  }

  // 步骤 9：成本 / 利润 / 收支
  function vCost(d) {
    var f = d.finance, b = d.bom, pf = d.pickedFactory;
    var h = '<div class="panel"><h2>9 · 成本 / 利润 / 收支</h2>';
    if (!f) {
      h += '<div class="empty">先在第 8 步选合作工厂。</div><button class="btn primary wide" data-act="run-finance">算成本</button>';
    } else {
      h += '<div class="kv"><span>面料辅料（已议价）</span><span>' + money(f.materialCost) + '</span></div>' +
        '<div class="kv"><span>工时（大货单件）</span><span>' + money(f.laborPerUnit) + '</span></div>' +
        '<div class="kv"><span>固定成本（样衣/制版，摊 50 件）</span><span>' + money(f.fixedPerUnit) + '</span></div>' +
        '<div class="kv"><span>合作工厂</span><span>' + esc(pf ? pf.name : "未选") + '</span></div>';
      h += '<div class="hr"></div><div class="hint">不同起订量档</div>' +
        '<div class="scroll-x"><table><thead><tr><th>量</th><th>成本</th><th>淘宝售</th><th>拼多多售</th><th>毛</th></tr></thead><tbody>' +
        f.tiers.map(function (t) {
          return '<tr><td class="num">' + t.qty + '</td>' +
            '<td class="num">' + money(t.costPerUnit) + '</td>' +
            '<td class="num">' + money(t.retailTb) + '</td>' +
            '<td class="num">' + money(t.retailPdd) + '</td>' +
            '<td class="num ok">' + money(t.profitTb) + '</td></tr>';
        }).join("") + '</tbody></table></div>';
      var rec = f.tiers[1] || f.tiers[0];   // 默认看 100 件档
      h += '<div class="hr"></div><div class="hint">推荐档：' + rec.qty + ' 件 · 淘宝定价 ' + money(rec.retailTb) + '</div>' +
        '<div class="price">' + money(rec.profitTb) + '<small> / 件毛利</small></div>' +
        '<div class="kv"><span>毛利率（淘宝）</span><span>' + rec.marginTb + '%</span></div>' +
        '<div class="kv"><span>毛利（拼多多）</span><span>' + money(rec.profitPdd) + '</span></div>' +
        '<div class="kv"><span>总毛利（' + rec.qty + '件·淘宝）</span><span>' + money(rec.grossTb) + '</span></div>' +
        '<div class="hr"></div><div class="hint">收入 / 支出拆解（单件）</div>' +
        '<div class="kv"><span>售价</span><span>' + money(rec.retailTb) + '</span></div>' +
        '<div class="kv"><span>· 平台佣金 6%</span><span class="bad">-' + money(rec.fee) + '</span></div>' +
        '<div class="kv"><span>· 快递</span><span class="bad">-' + money(rec.ship) + '</span></div>' +
        '<div class="kv"><span>· 包装</span><span class="bad">-' + money(rec.pack) + '</span></div>' +
        '<div class="kv"><span>· 生产成本</span><span class="bad">-' + money(rec.costPerUnit) + '</span></div>' +
        '<div class="kv"><span><strong>= 单件净毛利</strong></span><span class="ok"><strong>' + money(rec.profitTb) + '</strong></span></div>';
      h += '<div class="note">演示数据基于当前设计词 + 采购价。真实报价以工厂打样确认为准。' +
        (b ? '<br>版型参考：' + esc(b.words.style) + ' · ' + esc(b.words.color) : '') + '</div>';
    }
    h += '</div>';
    return h;
  }

  // 历史列表（右上角入口）
  function vHistory(list) {
    var h = '<div class="panel"><h2>历史记录</h2>';
    if (!list.length) {
      h += '<div class="empty">还没有任何设计单。回到「设计词」新建一条。</div>';
      h += '</div>';
      return h;
    }
    // 每步完成状态：字段名 → step 对应
    var STEP_FIELD = {
      word:  "words",
      img:   "imgPassed",
      part:  "bom",
      check: "markedOriginal",
      buy:   "sourcing",
      look:  "combo",
      model: "model",
      fact:  "pickedFactory",
      cost:  "finance"
    };
    list.forEach(function (d) {
      var steps = Router.STEPS.map(function (s) {
        var done = !!d[STEP_FIELD[s.id]];
        var cls = done ? "d" : (s.id === d.step ? "c" : "p");
        return '<b class="' + cls + '">' + s.title + '</b>';
      }).join("");
      var time = new Date(d.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      h += '<div class="history-item" data-act="open-history" data-id="' + esc(d.id) + '">' +
        '<div class="t">' + esc(d.prompt || "(未命名设计单)") + '</div>' +
        '<div class="m">' + time + ' · 当前：' + esc(stepName(d.step)) + (d.markedOriginal ? ' · 原创✓' : '') + '</div>' +
        '<div class="steps-mini">' + steps + '</div></div>';
    });
    h += '</div>';
    return h;
  }

  global.R = {
    esc: esc, money: money, stepsNav: stepsNav, progress: progress,
    vWord: vWord, vImg: vImg, vPart: vPart, vCheck: vCheck, vBuy: vBuy,
    vLook: vLook, vModel: vModel, vFact: vFact, vCost: vCost, vHistory: vHistory
  };
})(window);
