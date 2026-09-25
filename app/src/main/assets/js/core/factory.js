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
      color: pick(COLOR),
      details: sample(DETAIL, 4),
      decors: sample(DECOR, 3),
      sizes: SIZE.slice(),
      mood: "参考：" + (prompt || "甜系日常").slice(0, 30)
    };
  }

  // 2) BOM：从设计词拆零件，含面料米数、辅料、工序、耗时
  function bom(words) {
    var rnd = R("bom:" + words.color + words.style);
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
    var rnd = R("chk:" + words.color + words.details.join(","));
    var platforms = [
      { name: "小红书", url: "https://www.xiaohongshu.com/search_result?keyword=洛丽塔+裙子+" + words.color },
      { name: "抖音",   url: "https://www.douyin.com/search/洛丽塔+" + words.style },
      { name: "淘宝",   url: "https://s.taobao.com/search?q=洛丽塔+裙子+" + words.color },
      { name: "拼多多", url: "https://mobile.yangkeduo.com/search_result.html?search_type=shop&keyword=洛丽塔+裙子" },
      { name: "闲鱼",   url: "https://www.goofish.com/search?q=洛丽塔+" + words.style }
    ];
    var results = platforms.map(function (p) {
      var hits = Math.floor(rnd() * 40);           // 0-39 相似款
      var maxSim = Math.round(15 + rnd() * 70);    // 15-85%
      var verdict = maxSim >= 70 ? "雷同" : (maxSim >= 50 ? "相近" : "原创");
      return {
        platform: p.name, url: p.url, hits: hits, maxSim: maxSim,
        verdict: verdict, note: verdict === "雷同" ? "需改主色/廓形" : (verdict === "相近" ? "改领口/袖口" : "可标原创")
      };
    });
    var worst = results.reduce(function (a, b) { return b.maxSim > a.maxSim ? b : a; });
    var pass = worst.verdict !== "雷同";
    return { results: results, worst: worst, pass: pass, color: words.color };
  }

  // 4) 采购：面料 + 辅料链接（拼多多/1688 优先便宜）
  function sourcing(bomData) {
    var rnd = R("src:" + bomData.color + bomData.mainFabric);
    var channels = ["拼多多", "1688", "淘宝", "闲鱼", "广州中大布匹市场"];
    return bomData.rows.map(function (r) {
      var ch1 = channels[Math.floor(rnd() * channels.length)];
      var ch2 = channels[Math.floor(rnd() * channels.length) % channels.length];
      var priceBest = Math.round(r.price * 0.62);
      var priceOk = Math.round(r.price * 0.85);
      var link = "https://mobile.pinduoduo.com/goods.html?search_type=shop&keyword=" + encodeURIComponent(r.material + " " + r.part) + "&page_id=" + Math.floor(rnd() * 1e9);
      return {
        part: r.part, material: r.material, amount: r.amount, unit: r.unit,
        channel: ch1, alt: ch2, priceBest: priceBest, priceOk: priceOk,
        link: link, altLink: link.replace("pinduoduo", "1688.com").replace("https://", "https://s.1688.com/search/page.html?keywords=")
      };
    });
  }

  // 5) 组合实况 + 6) 模特图：仅返回 URI + 描述
  function combo(bomData) { return { uri: global.AI.img("combo", bomData.words.color, 400, 500), note: "组合状态：主裙 + 裙撑 + 蝴蝶结，正面平铺" }; }
  function look(bomData)   { return { uri: global.AI.img("look",  bomData.words.style, 400, 500), note: "细节：领口 + 袖口 + 蕾丝花边" }; }
  function model(bomData)  { return { uri: global.AI.img("model", bomData.words.color + bomData.words.style, 300, 600), note: "模特穿着效果，站姿正面" }; }

  // 7) 工厂寻源（国内洛丽塔产业带：广州/杭州/湖州/嘉兴）
  var FACTORY_SEED = [
    { name: "杭州××服饰有限公司", region: "浙江杭州", scale: "工厂 30-80 人", min: 30, unitCost: 168, leadTime: "15 天", tags: ["刺绣强", "响应快"] },
    { name: "湖州××针织有限公司", region: "浙江湖州", scale: "工厂 15-30 人", min: 50, unitCost: 145, leadTime: "12 天", tags: ["单价低", "小单"] },
    { name: "广州××服装厂", region: "广东广州", scale: "工厂 80-200 人", min: 100, unitCost: 195, leadTime: "25 天", tags: ["大牌代工", "版准"] },
    { name: "嘉兴××针织厂", region: "浙江嘉兴", scale: "工厂 20-50 人", min: 40, unitCost: 162, leadTime: "18 天", tags: ["蕾丝好", "支持寄样"] },
    { name: "潮州××针织", region: "广东潮州", scale: "工厂 15-30 人", min: 60, unitCost: 138, leadTime: "14 天", tags: ["便宜", "沟通需耐心"] },
    { name: "苏州××时装", region: "江苏苏州", scale: "工厂 30-80 人", min: 80, unitCost: 178, leadTime: "20 天", tags: ["英式下午茶经验", "质检严"] }
  ];
  function factories(bomData) {
    var rnd = R("fct:" + bomData.words.style);
    return FACTORY_SEED.map(function (f) {
      return {
        name: f.name, region: f.region, scale: f.scale, min: f.min,
        unitCost: f.unitCost + Math.floor((rnd() - 0.5) * 30), leadTime: f.leadTime,
        tags: f.tags.slice(),
        contact: "13" + String(Math.floor(1e8 + rnd() * 9e8)),
        qq: String(4 + Math.floor(rnd() * 8e8)),
        link: "https://s.1688.com/search/page.html?keywords=" + encodeURIComponent("洛丽塔 " + f.region)
      };
    });
  }

  // 8) 成本 / 利润 / 收支：多档量算单价 + 毛利
  function finance(bomData, factoriesList, qtyList) {
    var materialCost = bomData.fabricTotal;
    var laborPerUnit = Math.round(bomData.laborTotal * 0.55);  // 大货比样衣省一半工时
    var fixedPerUnit = bomData.fixedTotal;
    var tiers = (qtyList || [50, 100, 200, 500]).map(function (q) {
      // 面料随量降 15%（大货议价），固定成本按 q 摊
      var fabricCost = Math.round(materialCost * (q >= 200 ? 0.75 : q >= 100 ? 0.85 : 1.0));
      var unitFixed = Math.round(fixedPerUnit / q);
      var costPerUnit = fabricCost + laborPerUnit + unitFixed;
      // 定价：拼多多/淘宝参考同型款 × 1.5-1.9 倍
      var retailPdd = Math.round(costPerUnit * 1.6);
      var retailTb  = Math.round(costPerUnit * 1.9);
      // 平台佣金 + 支付 6%；快递 8 元/单；包装 3 元/单
      var platformFee = Math.round(retailTb * 0.06);
      var shipping = 8;
      var pack = 3;
      var profitTb = retailTb - costPerUnit - platformFee - shipping - pack;
      var profitPdd = retailPdd - costPerUnit - platformFee - shipping - pack;
      return {
        qty: q, costPerUnit: costPerUnit, retailTb: retailTb, retailPdd: retailPdd,
        profitTb: profitTb, profitPdd: profitPdd,
        marginTb: Math.round(profitTb / retailTb * 100),
        marginPdd: Math.round(profitPdd / retailPdd * 100),
        grossTb: profitTb * q, grossPdd: profitPdd * q,
        fee: platformFee, ship: shipping, pack: pack
      };
    });
    // 建议合作工厂：min 小于最小档、单价低
    var minQ = tiers[0].qty;
    var best = factoriesList.filter(function (f) { return f.min <= minQ; })
      .sort(function (a, b) { return a.unitCost - b.unitCost; })[0] || factoriesList[0];
    return {
      materialCost: materialCost, laborPerUnit: laborPerUnit, fixedPerUnit: fixedPerUnit,
      tiers: tiers, best: best
    };
  }

  global.Factory = {
    designWords: designWords, bom: bom, dedup: dedup, sourcing: sourcing,
    combo: combo, look: look, model: model, factories: factories, finance: finance
  };
})(window);
