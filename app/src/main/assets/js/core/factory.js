/* 演示数据工厂：设计词 / BOM / 查重 / 采购 / 组合 / 模特 / 工厂 / 成本
 * 纯计算 + 纯数据。禁 document.、禁 localStorage（唯一事实源在 store.js）。
 * 全部走 AI.srand 的确定性种子，同 seed 得到同结果 → 可回归断言。
 */
(function (global) {
  "use strict";
  var R = global.AI.srand;

  // 洛丽塔版型/风格词库
  var STYLE = ["古典哥特", "甜系", "软妹", "洛丽塔基础款", "中华娘", "英式下午茶", "洛可可", "暗黑系", "和风", "学院风"];
  var SEASON = ["春夏薄款", "春秋常规", "冬季加厚", "四季通用"];
  var FABRIC = ["蕾丝硬纱", "雪纺", "网纱", "塔夫绸", "提花缎", "欧根纱", "针织棉", "灯芯绒"];
  var COLOR = ["雾霾蓝", "奶油白", "酒红", "墨绿", "玫瑰粉", "黑金", "薰衣草紫", "奶咖"];
  var DETAIL = ["双层蕾丝裙撑", "蝴蝶结收腰", "荷叶边袖口", "抽绳束口", "金属环饰", "缎带蝴蝶结", "珍珠扣", "刺绣花边", "缎带蝴蝶结"];
  var DECOR = ["立体花朵", "蕾丝刺绣", "丝带蝴蝶结", "珍珠点缀", "金属扣", "蕾丝蝴蝶结"];
  var SIZE = ["5码", "7码", "9码", "11码", "13码"];

  // 企划：主题风格（文档【第二层】第 0 步）
  var THEMES = ["甜系", "古典", "哥特", "中华风", "和风", "暗黑"];

  // 避免词的候选标签（只是快捷标签，用户可自由输入）
  var AVOID_TAGS = ["蕾丝", "蝴蝶结", "印花", "亮片", "露肩", "长袖", "高腰", "动物纹"];

  // color 兼容：单值 → 单元素数组（老数据零迁移）
  // 语义正确：单色的款就是「只有一个颜色的款」，不是降级、不标旧格式
  function toColors(c) {
    if (Array.isArray(c)) return c.map(function (x) { return String(x); }).filter(Boolean);
    var s = String(c == null ? "" : c).trim();
    return s ? [s] : [];
  }

  // 柄图候选：纯花色，不是服装造型图（柄图 = 印花图案）
  function printCandidates(theme, seed) {
    var t = THEMES.indexOf(theme) >= 0 ? theme : THEMES[0];
    var palettes = {
      "甜系": ["#f6d5e0", "#f9ecd9", "#e8b4c8"],
      "古典": ["#e8dcc3", "#c9a96a", "#8a6f4a"],
      "哥特": ["#2a2230", "#5a3a52", "#9a6f8a"],
      "中华风": ["#8a2b28", "#d9a441", "#f0e0c0"],
      "和风": ["#3a4a5a", "#c96f6a", "#efe4d2"],
      "暗黑": ["#1a1a1e", "#3a2f3a", "#6a5a4a"]
    };
    var p = palettes[t];
    var names = ["小碎花", "缎带格纹", "藤蔓蕾丝", "月相星轨", "缎面暗纹", "蝴蝶结链"];
    var out = [];
    for (var i = 0; i < 6; i++) {
      out.push({ id: "p" + i, name: names[i], uri: printSvg(i, p, seed || t + i) });
    }
    return out;
  }

  // 纯 SVG 花色：不依赖 CDN、不依赖图片接口
  function printSvg(i, p, seed) {
    var rnd = R("print:" + seed + i);
    var shapes = "";
    var n = 10 + Math.floor(rnd() * 8);
    for (var k = 0; k < n; k++) {
      var x = Math.round(rnd() * 100), y = Math.round(rnd() * 100), r = 3 + rnd() * 9;
      var c = p[k % p.length];
      if (i % 3 === 0) shapes += '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(1) + '" fill="' + c + '" opacity="0.85"/>';
      else if (i % 3 === 1) shapes += '<rect x="' + x + '" y="' + y + '" width="' + (r * 1.4).toFixed(1) + '" height="' + r.toFixed(1) + '" fill="' + c + '" opacity="0.8" transform="rotate(' + Math.round(rnd() * 45) + " " + x + " " + y + ')"/>';
      else shapes += '<path d="M' + x + " " + y + " q " + (r * 1.6).toFixed(1) + " -" + (r * 1.6).toFixed(1) + " " + (r * 3.2).toFixed(1) + ' 0" stroke="' + c + '" stroke-width="1.6" fill="none" opacity="0.85"/>';
    }
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#' +
      (i % 2 ? "221f1c" : "1b1815") + '"/>' + shapes + "</svg>");
  }

  // 柄图描述：进 AI prompt 用（文字版，AI 看不到图）
  function printDesc(prints) {
    if (!prints || !prints.picks || !prints.picks.length) return "";
    var map = {};
    printCandidates(prints.theme).forEach(function (c) { map[c.id] = c.name; });
    return prints.picks.map(function (id) { return map[id] || ""; }).filter(Boolean).join("、");
  }

  // 图透投票（文档第 4 项）：投票/驳回/待定的可选值 + 改版原因
  var VOTE_CHOICES = ["通过", "驳回", "待定"];
  var REVISE_REASONS = ["廓形不对", "颜色偏了", "细节过多", "细节太少", "面料不适", "价格偏高", "其他"];

  // 追加一条版本记录（纯函数：不改原数组，返回新数组）
  // 「留痕」的全部含义：旧版本永不删除，只往后追加
  function pushVersion(versions, entry) {
    var list = Array.isArray(versions) ? versions.slice() : [];
    list.push({
      n: list.length + 1,
      uri: String(entry.uri || ""),
      source: String(entry.source || "demo"),
      at: entry.at || new Date().toISOString(),
      reason: String(entry.reason || ""),
      note: String(entry.note || "")
    });
    return list;
  }

  // 追加一条投票记录
  function pushVote(votes, entry) {
    var list = Array.isArray(votes) ? votes.slice() : [];
    list.push({
      versionNo: Number(entry.versionNo) || 1,
      choice: VOTE_CHOICES.indexOf(entry.choice) >= 0 ? entry.choice : "待定",
      note: String(entry.note || ""),
      at: entry.at || new Date().toISOString()
    });
    return list;
  }

  /* ===== 定样定价（文档第 6 项）===== */
  // 目标成团件数默认 1000，支持按款/批次/颜色覆盖（文档 §六补充：分色成团）
  var DEFAULT_TARGET = 1000;
  var DEFAULT_DEPOSIT_RATE = 20;   // 定金默认 20%

  // 按颜色生成 SKU 行：每个颜色一行，默认 1000 件；已有设置则沿用（不覆盖用户改过的）
  function buildSkus(colors, existing) {
    var list = Array.isArray(colors) ? colors.filter(Boolean) : [];
    var old = Array.isArray(existing) ? existing : [];
    var map = {};
    old.forEach(function (s) { if (s && s.color) map[String(s.color)] = s; });
    return list.map(function (c) {
      var prev = map[String(c)];
      return {
        color: String(c),
        target: prev && isFinite(Number(prev.target)) && Number(prev.target) > 0
          ? Number(prev.target) : DEFAULT_TARGET
      };
    });
  }

  // 定样定价计算 + 校验（纯函数）
  // 返回 { __error } 或完整结果
  function financeFinal(input) {
    var price = Number(input.price);
    var cost = Number(input.cost);          // 来自第 10 步的单件成本
    var rate = Number(input.depositRate);
    var leadDays = Number(input.leadDays);
    var skus = Array.isArray(input.skus) ? input.skus : [];

    if (!isFinite(price) || price <= 0) return { __error: "公布价必须大于 0" };
    if (!isFinite(rate) || rate < 0 || rate > 100) return { __error: "定金比例须在 0~100 之间" };
    if (!isFinite(leadDays) || leadDays <= 0) return { __error: "工期必须是正整数天" };
    if (!skus.length) return { __error: "至少要有一个颜色（没有颜色就没有 SKU）" };
    for (var i = 0; i < skus.length; i++) {
      var t = Number(skus[i].target);
      if (!isFinite(t) || t <= 0) return { __error: "「" + skus[i].color + "」的目标成团件数必须大于 0" };
    }

    var deposit = Math.round(price * rate / 100);
    var balance = price - deposit;
    var totalTarget = skus.reduce(function (s, x) { return s + Number(x.target); }, 0);
    // 保本件数：固定成本之外，单件毛利为 price - cost
    var unitMargin = price - cost;
    var breakEven = unitMargin > 0 ? Math.ceil(Number(input.fixed || 0) / unitMargin) : -1;
    return {
      price: price, cost: cost, deposit: deposit, balance: balance, depositRate: rate,
      leadDays: leadDays, deadline: input.deadline || "",
      skus: skus.map(function (x) { return { color: String(x.color), target: Number(x.target) }; }),
      totalTarget: totalTarget,
      unitMargin: unitMargin,
      breakEven: breakEven,
      // 成团后的满额收入（按目标件数）
      fullIncome: price * totalTarget,
      fullProfit: unitMargin * totalTarget,
      at: new Date().toISOString()
    };
  }

  // 1) 设计词：给一句 prompt 返回结构化设计词
  function designWords(prompt) {
    var rnd = R(prompt || "empty");
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    function sample(a, n) {
      var c = a.slice(), out = [];
      for (var i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
      return out;
    }
    return {
      prompt: prompt,
      style: pick(STYLE),
      season: pick(SEASON),
      mainFabric: pick(FABRIC),
      color: [pick(COLOR)],
      details: sample(DETAIL, 4),
      decors: sample(DECOR, 3),
      sizes: SIZE.slice(),
      mood: "参考：" + (prompt || "甜系日常").slice(0, 30)
    };
  }

  // 2) BOM：从设计词拆零件，含面料米数、辅料、工序、耗时
  function bom(words) {
    var rnd = R("bom:" + toColors(words.color).join("+") + words.style);
    var rows = [
      { part: "主裙身（外层）", material: words.mainFabric, amount: 2.4, unit: "米", price: 55, note: "含蕾丝拼接" },
      { part: "内衬裙", material: "涤纶里布", amount: 2.0, unit: "米", price: 12, note: "防透" },
      { part: "裙撑（半钢圈）", material: "蕾丝硬纱", amount: 1.2, unit: "米", price: 38, note: "撑开轮廓" },
      { part: "袖口荷叶边", material: words.mainFabric, amount: 0.8, unit: "米", price: 55, note: words.details[0] || "" },
      { part: "蝴蝶结收腰", material: "缎带 25mm", amount: 3.5, unit: "米", price: 6, note: "" },
      { part: "腰带（缎带）", material: "缎带 40mm", amount: 1.0, unit: "米", price: 6, note: "" },
      { part: "领口蕾丝花边", material: "水溶蕾丝", amount: 0.6, unit: "米", price: 22, note: "" },
      { part: "胸围蕾丝", material: "水溶蕾丝", amount: 0.5, unit: "米", price: 22, note: "" },
      { part: "扣子（珍珠）", material: "亚克力", amount: 5, unit: "颗", price: 1.2, note: "" },
      { part: "里布贴袋", material: "涤纶", amount: 0.4, unit: "米", price: 12, note: "" }
    ];
    var total = 0;
    rows.forEach(function (r) {
      r.subtotal = Math.round(r.amount * r.price * (0.92 + rnd() * 0.16));
      total += r.subtotal;
    });
    var labor = [
      { step: "打版", time: "2 h", cost: 60 },
      { step: "裁剪", time: "1 h", cost: 25 },
      { step: "车缝主裙", time: "3 h", cost: 75 },
      { step: "车缝内衬+里布", time: "2 h", cost: 50 },
      { step: "装蕾丝花边", time: "2.5 h", cost: 65 },
      { step: "刺绣/绣花", time: "1.5 h", cost: 45 },
      { step: "压皱定型", time: "0.5 h", cost: 15 },
      { step: "检验/熨烫/包装", time: "1 h", cost: 30 }
    ];
    var laborTotal = labor.reduce(function (s, x) { return s + x.cost; }, 0);
    var fixed = { "印花制版": 25, "样品寄样运费": 20, "吊牌包装": 8, "拍照/模特": 15 };
    var fixedTotal = Object.keys(fixed).reduce(function (s, k) { return s + fixed[k]; }, 0);
    return {
      words: words, rows: rows, fabricTotal: total,
      labor: labor, laborTotal: laborTotal,
      fixed: fixed, fixedTotal: fixedTotal,
      total: total + laborTotal + fixedTotal
    };
  }

  // 3) 查重：小红书 / 抖音 / 淘宝 / 闲鱼 / 微博
  function dedup(words) {
    var keyword = ["洛丽塔", words.style || ""].concat(toColors(words.color)).concat([words.mainFabric || ""]).filter(Boolean).join(" ");
    var q = encodeURIComponent(keyword);
    return {
      keyword: keyword,
      source: "manual",
      results: [
        { platform: "小红书", url: "https://www.xiaohongshu.com/search_result?keyword=" + q, verdict: "" },
        { platform: "抖音", url: "https://www.douyin.com/search/" + q, verdict: "" },
        { platform: "淘宝", url: "https://s.taobao.com/search?q=" + q, verdict: "" },
        { platform: "拼多多", url: "https://mobile.yangkeduo.com/search_result.html?search_key=" + q, verdict: "" },
        { platform: "闲鱼", url: "https://www.goofish.com/search?q=" + q, verdict: "" }
      ],
      pass: false
    };
  }

  // 4) 采购：面料 + 辅料链接（拼多多/1688 优先便宜）
  function sourcing(bomData) {
    return bomData.rows.map(function (row) {
      var keyword = [row.material, row.part, "洛丽塔"].filter(Boolean).join(" ");
      var q = encodeURIComponent(keyword);
      return {
        part: row.part, material: row.material, amount: row.amount, unit: row.unit, keyword: keyword,
        links: [
          { name: "拼多多", url: "https://mobile.yangkeduo.com/search_result.html?search_key=" + q },
          { name: "淘宝", url: "https://s.taobao.com/search?q=" + q },
          { name: "1688", url: "https://s.1688.com/selloffer/offer_search.htm?keywords=" + q }
        ],
        chosen: "", price: null, link: ""
      };
    });
  }

  // 5) 组合实况 + 6) 模特图：仅返回 URI + 描述
  function combo(bomData) { return { uri: global.AI.img("combo", toColors(bomData.words.color).join(""), 400, 500), note: "组合状态：主裙 + 裙撑 + 蝴蝶结，正面平铺" }; }
  function look(bomData)   { return { uri: global.AI.img("look",  bomData.words.style, 400, 500), note: "细节：领口 + 袖口 + 蕾丝花边" }; }
  function model(bomData)  { return { uri: global.AI.img("model", toColors(bomData.words.color).join("") + bomData.words.style, 300, 600), note: "模特穿着效果，站姿正面" }; }

  function factories() {
    var keyword = "洛丽塔 服装加工 工厂";
    var q = encodeURIComponent(keyword);
    return { keyword: keyword, links: [
      { name: "1688", url: "https://s.1688.com/selloffer/offer_search.htm?keywords=" + q },
      { name: "百度", url: "https://www.baidu.com/s?wd=" + q },
      { name: "天眼查", url: "https://www.tianyancha.com/search?key=" + q }
    ], records: [] };
  }

  
  function finance(input) {
    var material = Number(input.material);
    var labor = Number(input.labor);
    var fixed = Number(input.fixed);
    var feeRate = Number(input.feeRate);
    var shipping = Number(input.shipping);
    var pack = Number(input.pack);
    var price = Number(input.price);
    var qty = Number(input.qty);
    if (![material, labor, fixed, feeRate, shipping, pack, price, qty].every(isFinite) || [material, labor, fixed, shipping, pack, price, qty].some(function (n) { return n < 0; }) || qty <= 0 || feeRate < 0 || feeRate > 100) return { error: "成本输入不完整或无效" };
    var cost = material + labor + fixed / qty;
    var fee = price * feeRate / 100;
    var profit = price - cost - fee - shipping - pack;
    return { material: material, labor: labor, fixed: fixed, qty: qty, price: price, cost: cost, fee: fee, shipping: shipping, pack: pack, profit: profit, margin: price ? profit / price * 100 : 0, income: price * qty, expense: (cost + fee + shipping + pack) * qty, totalProfit: profit * qty };
  }


  global.Factory = {
    designWords: designWords, bom: bom, dedup: dedup, sourcing: sourcing,
    combo: combo, look: look, model: model, factories: factories, finance: finance,
    toColors: toColors, THEMES: THEMES, AVOID_TAGS: AVOID_TAGS,
    printCandidates: printCandidates, printDesc: printDesc,
    VOTE_CHOICES: VOTE_CHOICES, REVISE_REASONS: REVISE_REASONS,
    pushVersion: pushVersion, pushVote: pushVote,
    DEFAULT_TARGET: DEFAULT_TARGET, DEFAULT_DEPOSIT_RATE: DEFAULT_DEPOSIT_RATE,
    buildSkus: buildSkus, financeFinal: financeFinal
  };
})(window);
