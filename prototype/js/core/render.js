/* 纯渲染层：只返回 HTML 字符串，禁 document.（用 grep 断言）
 * 结构统一为：screen(标题 + 进度点 + 内容块)，每个界面最多三块。
 */
(function (global) {
  "use strict";

  var PAGES = [
    { id: "design", title: "设计", head: "word",  steps: ["word", "img", "part"] },
    { id: "make",   title: "制作", head: "check", steps: ["check", "buy", "look"] },
    { id: "run",    title: "经营", head: "model", steps: ["model", "fact", "cost"] }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? "-" : "") + "¥" + Math.abs(n).toLocaleString("zh-CN");
  }
  function stepName(id) {
    var list = global.Router && Router.STEPS;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].title;
    return "";
  }
  function pageOf(id) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].steps.indexOf(id) >= 0) return PAGES[i];
    return PAGES[0];
  }

  /* 底部三个主入口 */
  function tabbar(curId) {
    var page = pageOf(curId);
    return PAGES.map(function (item) {
      return '<button type="button" class="tab' + (item.id === page.id ? " cur" : "") +
        '" data-act="goto" data-step="' + item.head + '"><i></i><span>' + item.title + "</span></button>";
    }).join("");
  }

  /* 页内三点进度 */
  function dots(curId) {
    var page = pageOf(curId);
    var at = page.steps.indexOf(curId);
    var out = "";
    for (var i = 0; i < 3; i++) out += '<b class="' + (i === at ? "on" : "") + '"></b>';
    return '<div class="dots">' + out + "</div>";
  }

  /* 统一页面骨架 */
  function screen(curId, title, sub, body) {
    return '<div class="screen">' + dots(curId) + "<h1>" + title + "</h1>" +
      '<p class="sub">' + sub + "</p>" + body + pageBar(curId) + "</div>";
  }

    var ORDER = Router.STEPS.map(function (x) { return x.id; });
    function pageBar(curId) {
      var i = ORDER.indexOf(curId);
      var back = i > 0
        ? '<button type="button" class="btn" data-act="goto" data-step="' + ORDER[i - 1] + '">返回</button>'
        : '<button type="button" class="btn" data-act="history">历史</button>';
      return '<div class="actions">' + back +
        '<button type="button" class="btn" data-act="keep">保存</button>' +
        '<button type="button" class="btn bad" data-act="del-cur">删除</button></div>';
    }

  function menu(step, title, text) {
    return '<button type="button" class="menu-card" data-act="goto" data-step="' + step +
      '"><span><b>' + title + "</b><small>" + text + "</small></span><em>›</em></button>";
  }

  function nextBtn(step, label) {
    return '<button type="button" class="btn primary wide" data-act="next" data-step="' + step +
      '">' + label + "</button>";
  }

  /* 1 设计词 */
  function vWord(d) {
    var w = d.words;
    var body = '<div class="block">' + menu("word", "设计词", "生成款式、颜色和面料") +
      menu("img", "出图", "看一眼，满意再往下") + menu("part", "拆件", "拆成物料和工序") + "</div>";

    body += '<div class="block"><h2>填写需求</h2>' +
      '<textarea id="in-prompt" placeholder="例：雾霾蓝英式下午茶，春夏薄款，蝴蝶结收腰">' +
      esc(d.prompt || "") + "</textarea>" +
      '<button type="button" class="btn primary wide" data-act="gen-words">生成设计词</button></div>';

    if (w) {
      body += '<div class="block"><h2>结果</h2>' +
        '<div class="kv"><span>风格</span><span>' + esc(w.style) + "</span></div>" +
        '<div class="kv"><span>季节</span><span>' + esc(w.season) + "</span></div>" +
        '<div class="kv"><span>主面料</span><span>' + esc(w.mainFabric) + "</span></div>" +
        '<div class="kv"><span>主色</span><span>' + esc(w.color) + "</span></div>" +
        '<div style="margin-top:12px">' +
        w.details.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") +
        w.decors.map(function (x) { return '<span class="tag plain">' + esc(x) + "</span>"; }).join("") +
        "</div>" + (w.mood ? '<p class="note">' + esc(w.mood) + "</p>" : "") + "</div>";
      body += nextBtn("img", "下一步 · 出图");
    }
    return screen("word", "设计", "第 1 步，共 9 步", body);
  }

  /* 2 出图 */
  function vImg(d) {
    var body = "";
    if (!d.imgUri) {
      body += '<div class="block"><h2>候选图</h2>' +
        '<p class="hint">还没有图。生成一张看看，不满意可以重画。</p>' +
        '<button type="button" class="btn primary wide" data-act="gen-img">生成候选图</button></div>';
    } else {
      body += '<div class="block"><h2>候选图</h2>' +
        '<img class="card-img tall" src="' + esc(d.imgUri) + '" alt="候选图">' +
        '<div class="actions">' +
        '<button type="button" class="btn bad" data-act="reject-img">重画</button>' +
        '<button type="button" class="btn ok" data-act="pass-img">通过</button></div>' +
        '<button type="button" class="btn wide small" data-act="gen-img">再生成一张</button></div>';
    }
    if (d.imgPassed) body += nextBtn("part", "下一步 · 拆件");
    return screen("img", "出图", d.imgPassed ? "已通过，可以去拆件" : "第 2 步，共 9 步", body);
  }

  /* 3 拆件 */
  function vPart(d) {
    var b = d.bom;
    var body = "";
    if (!b) {
      body += '<div class="block"><h2>物料清单</h2>' +
        '<p class="hint">先通过上一步的图片，再拆件。</p>' +
        '<button type="button" class="btn primary wide" data-act="gen-bom">生成清单</button></div>';
    } else {
      var srcNote = d.bomSource === "ai" ? "由文本 AI 拆解" : "由本地零件库生成（演示）";
      body += '<div class="block"><h2>物料</h2><p class="hint">来源：' + esc(srcNote) + '</p><div class="scroll-x"><table><thead><tr>' +
        "<th>零件</th><th>材料</th><th>用量</th><th>价</th></tr></thead><tbody>" +
        b.rows.map(function (r) {
          return "<tr><td>" + esc(r.part) + '<div class="muted" style="font-size:11px">' + esc(r.note) + "</div></td>" +
            "<td>" + esc(r.material) + '</td><td class="num">' + r.amount + esc(r.unit) + "</td>" +
            '<td class="num">' + money(r.subtotal) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";

      body += '<div class="block"><h2>工序</h2><div class="scroll-x"><table><thead><tr>' +
        "<th>工序</th><th>工时</th><th>成本</th></tr></thead><tbody>" +
        b.labor.map(function (l) {
          return "<tr><td>" + esc(l.step) + '</td><td class="num">' + esc(l.time) +
            '</td><td class="num">' + money(l.cost) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="hr"></div>' +
        '<div class="kv"><span>面料辅料</span><span>' + money(b.fabricTotal) + "</span></div>" +
        '<div class="kv"><span>工时</span><span>' + money(b.laborTotal) + "</span></div>" +
        '<div class="kv"><span>固定成本</span><span>' + money(b.fixedTotal) + "</span></div>" +
        '<div class="kv"><span>样衣单件成本</span><span>' + money(b.total) + "</span></div>" +
        nextBtn("check", "下一步 · 查重") + "</div>";
    }
    return screen("part", "拆件", "第 3 步，共 9 步", body);
  }

  /* 4 查重 */
  function vCheck(d) {
    var c = d.check;
    var body = '<div class="block">' + menu("check", "查重", "打开官方搜索并记录结果") + menu("buy", "采购", "买料，看实物") + menu("look", "组合", "拼起来是什么样") + "</div>";
    if (!c) {
      body += '<div class="block"><h2>查重</h2><p class="hint">生成五个平台的官方搜索入口。结果由你查看后选择，不会自动抓取。</p><button type="button" class="btn primary wide" data-act="run-check">生成搜索入口</button></div>';
    } else {
      body += '<div class="block"><h2>搜索词</h2><p>' + esc(c.keyword) + '</p><div class="stack">' + c.results.map(function (r, index) {
        return '<div class="block"><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.platform) + ' 官方搜索</a><div class="actions">' + ["原创", "相近", "雷同"].map(function (name) {
          return '<button type="button" class="btn small' + (r.verdict === name ? " primary" : "") + '" data-act="set-check" data-index="' + index + '" data-value="' + name + '">' + name + "</button>";
        }).join("") + "</div></div>";
      }).join("") + "</div></div>";
      body += '<div class="block"><h2>AI 帮我搜</h2>' +
        '<p class="hint">让 AI 搜相似款参考。仅供参考，不是平台实测。</p>' +
        '<button type="button" class="btn wide" data-act="ai-search" data-where="check">AI 搜索相似款</button></div>';
      body += R.aiResults("AI 相似款", d.aiCheck);
      var done = c.results.every(function (r) { return r.verdict; });
      var duplicated = c.results.some(function (r) { return r.verdict === "雷同"; });
      if (d.markedOriginal) body += '<div class="block" style="text-align:center"><span class="origil">原创</span>' + nextBtn("buy", "下一步 · 采购") + "</div>";
      else if (done && !duplicated) body += '<div class="block"><h2>原创确认</h2><p class="hint">五个平台都没有选择雷同。</p><button type="button" class="btn ok wide" data-act="mark-original">标为原创</button></div>';
      else if (done) body += '<div class="block"><h2>不能标原创</h2><p class="hint">至少有一个平台选择了雷同。</p><button type="button" class="btn bad wide" data-act="reject-original">回设计词改款</button></div>';
      else body += '<div class="block"><p class="hint">五个平台都选择后才能判断。</p></div>';
    }
    return screen("check", "查重", "第 4 步，共 9 步", body);
  }

  /* 5 采购 */
  function vBuy(d) {
    var list = d.sourcing || [];
    var body = "";
    if (!list.length) {
      body += '<div class="block"><h2>采购</h2><p class="hint">先标原创，再生成官方搜索入口。</p><button type="button" class="btn primary wide" data-act="run-sourcing">生成采购入口</button></div>';
    } else {
      body += list.map(function (item, index) {
        return '<div class="block"><h2>' + esc(item.part) + '</h2><p class="hint">' + esc(item.material) + " × " + item.amount + esc(item.unit) + '</p><div class="actions">' + item.links.map(function (link) {
          return '<a class="btn small" href="' + esc(link.url) + '" target="_blank" rel="noopener">' + esc(link.name) + "</a>";
        }).join("") + '</div><label>真实单价（元）</label><input data-act="set-price" data-index="' + index + '" inputmode="decimal" value="' + (item.price == null ? "" : esc(item.price)) + '" placeholder="查看后填写">' + (item.price == null ? '<p class="hint">未填写</p>' : '<p class="hint">小计 ' + money(item.price * item.amount) + "</p>") + "</div>";
      }).join("");
      var complete = list.every(function (item) { return typeof item.price === "number" && item.price >= 0; });
      var total = list.reduce(function (sum, item) { return sum + (item.price || 0) * item.amount; }, 0);
      body += '<div class="block"><h2>AI 帮我比价</h2>' +
        '<p class="hint">让文本 AI 判断每个零件在哪类平台更可能便宜。仅供参考，真实价格请点上面链接核实。</p>' +
        '<button type="button" class="btn wide" data-act="ai-compare">AI 比价</button>' +
        (d.aiCompare && d.aiCompare.items && d.aiCompare.items.length
          ? '<div class="stack" style="margin-top:10px">' + d.aiCompare.items.map(function (it) {
              return '<div class="hr"></div><strong>' + esc(it.part) + '</strong>' +
                (it.best ? '<p class="hint">建议平台：<span class="gold">' + esc(it.best) + "</span></p>" : "") +
                (it.keyword ? '<p class="hint">搜索词：' + esc(it.keyword) + "</p>" : "") +
                (it.tip ? '<p class="hint">' + esc(it.tip) + "</p>" : "");
            }).join("") + "</div>"
          : "") +
        "</div>";
      body += '<div class="block"><h2>采购合计</h2><div class="price">' + (complete ? money(total) : "待填写") + '</div><p class="hint">只统计你填写的真实价格。</p>' + (complete ? nextBtn("look", "下一步 · 组合") : "") + "</div>";
    }
    return screen("buy", "采购", "第 5 步，共 9 步", body);
  }

  /* 6 组合 */
  function vLook(d) {
    var c = d.combo;
    var b = d.bom;
    var body = "";
    if (!c) {
      body += '<div class="block"><h2>组合</h2>' +
        '<p class="hint">先完成采购，再合成组合图。</p>' +
        '<button type="button" class="btn primary wide" data-act="gen-combo">合成组合图</button></div>';
    } else {
      body += '<div class="block"><h2>组合实况</h2>' +
        '<img class="card-img wide" src="' + esc(c.uri) + '" alt="组合实况">' +
        '<p class="note">' + esc(c.note) + "</p></div>";
      if (b) {
        var fabric = Math.round(b.fabricTotal * 0.75);
        var labor = Math.round(b.laborTotal * 0.55);
        var fixed = Math.round(b.fixedTotal / 100);
        body += '<div class="block"><h2>按采购价重算</h2>' +
          '<div class="kv"><span>面料辅料</span><span>' + money(fabric) + "</span></div>" +
          '<div class="kv"><span>工时</span><span>' + money(labor) + "</span></div>" +
          '<div class="kv"><span>固定成本</span><span>' + money(fixed) + "</span></div>" +
          '<div class="kv"><span>大货单件成本</span><span>' + money(fabric + labor + fixed) + "</span></div>" +
          "</div>";
      }
      body += R.estimateBlock(d);
      body += nextBtn("model", "下一步 · 模特");
    }
    return screen("look", "组合", "第 6 步，共 9 步", body);
  }

  /* 7 模特 */
  function vModel(d) {
    var m = d.model;
    var body = '<div class="block">' + menu("model", "模特", "穿在身上什么样") +
      menu("fact", "工厂", "找谁生产") + menu("cost", "成本", "一件赚多少") + "</div>";
    if (!m) {
      body += '<div class="block"><h2>模特图</h2>' +
        '<p class="hint">先完成组合，再生成模特图。</p>' +
        '<button type="button" class="btn primary wide" data-act="gen-model">生成模特图</button></div>';
    } else {
      body += '<div class="block"><h2>穿着效果</h2><div class="grid2">' +
        '<img class="card-img thin" src="' + esc(m.uri) + '" alt="正面">' +
        '<img class="card-img thin" src="' +
        esc(AI.img("model", (d.bom ? d.bom.words.style : "") + "back", 200, 400)) + '" alt="背面">' +
        "</div><p class=\"note\">" + esc(m.note) + "</p></div>" +
        nextBtn("fact", "下一步 · 工厂");
    }
    return screen("model", "模特", "第 7 步，共 9 步", body);
  }

  /* 8 工厂 */
  function vFact(d) {
    var data = d.factories;
    var body = "";
    if (!data) {
      body += '<div class="block"><h2>工厂</h2><p class="hint">生成官方搜索入口。看到真实工厂后手动记录。</p><button type="button" class="btn primary wide" data-act="run-factories">生成工厂搜索</button></div>';
    } else {
      body += '<div class="block"><h2>搜索</h2><p>' + esc(data.keyword) + '</p><div class="actions">' + data.links.map(function (link) {
        return '<a class="btn small" href="' + esc(link.url) + '" target="_blank" rel="noopener">' + esc(link.name) + "</a>";
      }).join("") + "</div></div>";
      body += '<div class="block"><h2>AI 帮我搜工厂</h2>' +
        '<p class="hint">让 AI 搜洛丽塔代工厂 / 产业带线索。仅供参考，务必自行核实。</p>' +
        '<button type="button" class="btn wide" data-act="ai-search" data-where="fact">AI 搜索代工厂</button></div>';
      body += R.aiResults("AI 工厂线索", d.aiFactories);
      body += '<div class="block"><h2>记录真实工厂</h2><input id="factory-name" placeholder="工厂名称"><input id="factory-region" placeholder="地区"><input id="factory-contact" placeholder="联系方式"><input id="factory-min" inputmode="numeric" placeholder="起订量"><input id="factory-cost" inputmode="decimal" placeholder="加工单价（元）"><button type="button" class="btn primary wide" data-act="add-factory">添加记录</button></div>';
      body += '<div class="block"><h2>已记录</h2>' + (data.records.length ? data.records.map(function (item, index) {
        var picked = d.pickedFactory && d.pickedFactory.name === item.name;
        return '<div class="hr"></div><strong>' + esc(item.name) + '</strong><p class="hint">' + esc(item.region) + " · " + esc(item.contact) + " · 起订 " + item.min + " 件 · " + money(item.unitCost) + '/件</p><button type="button" class="btn small' + (picked ? " primary" : "") + '" data-act="pick-fact" data-idx="' + index + '">' + (picked ? "已选择" : "选这家") + "</button>";
      }).join("") : '<p class="hint">还没有记录。</p>') + "</div>";
      if (d.pickedFactory) body += nextBtn("cost", "下一步 · 成本");
    }
    return screen("fact", "工厂", "第 8 步，共 9 步", body);
  }

  /* 9 成本 */
  function vCost(d) {
    var f = d.finance;
    var material = (d.sourcing || []).reduce(function (sum, item) { return sum + (Number(item.price) || 0) * Number(item.amount || 0); }, 0);
    var labor = d.pickedFactory ? Number(d.pickedFactory.unitCost) : 0;
    var body = '<div class="block"><h2>已知成本</h2><div class="kv"><span>物料</span><span>' + money(material) + '</span></div><div class="kv"><span>工厂加工</span><span>' + money(labor) + '</span></div></div>' +
      '<div class="block"><h2>填写真实费用</h2>' +
      '<div class="grid2">' +
        '<div><label for="cost-price">单件售价（元）</label><input id="cost-price" inputmode="decimal" placeholder="例如 899"></div>' +
        '<div><label for="cost-fee">平台佣金（%）</label><input id="cost-fee" inputmode="decimal" placeholder="例如 5"></div>' +
        '<div><label for="cost-ship">单件快递（元）</label><input id="cost-ship" inputmode="decimal" placeholder="例如 8"></div>' +
        '<div><label for="cost-pack">单件包装（元）</label><input id="cost-pack" inputmode="decimal" placeholder="例如 3"></div>' +
        '<div><label for="cost-fixed">固定费用总额（元）</label><input id="cost-fixed" inputmode="decimal" placeholder="例如 500"></div>' +
        '<div><label for="cost-qty">生产数量（件）</label><input id="cost-qty" inputmode="numeric" placeholder="例如 100"></div>' +
      '</div>' +
      '<button type="button" class="btn primary wide" data-act="run-finance" style="margin-top:14px">计算</button></div>';
    if (f && !f.error) body += '<div class="block"><h2>结果</h2><div class="price">' + money(f.profit) + '<small> / 件利润</small></div><div class="hr"></div><div class="kv"><span>收入</span><span>' + money(f.income) + '</span></div><div class="kv"><span>生产成本</span><span class="bad">-' + money(f.cost * f.qty) + '</span></div><div class="kv"><span>平台佣金</span><span class="bad">-' + money(f.fee * f.qty) + '</span></div><div class="kv"><span>快递包装</span><span class="bad">-' + money((f.shipping + f.pack) * f.qty) + '</span></div><div class="kv"><span>总利润</span><span>' + money(f.totalProfit) + '</span></div><div class="kv"><span>利润率</span><span>' + f.margin.toFixed(1) + '%</span></div></div>';
    return screen("cost", "成本", "第 9 步，共 9 步", body);
  }

  global.R = {
    esc: esc, money: money, tabbar: tabbar,
    vWord: vWord, vImg: vImg, vPart: vPart, vCheck: vCheck, vBuy: vBuy,
    vLook: vLook, vModel: vModel, vFact: vFact, vCost: vCost
  };
})(window);
