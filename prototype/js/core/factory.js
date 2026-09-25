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
    var keyword = ["洛丽塔", words.style || "", words.color || "", words.mainFabric || ""].filter(Boolean).join(" ");
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
  function combo(bomData) { return { uri: global.AI.img("combo", bomData.words.color, 400, 500), note: "组合状态：主裙 + 裙撑 + 蝴蝶结，正面平铺" }; }
  function look(bomData)   { return { uri: global.AI.img("look",  bomData.words.style, 400, 500), note: "细节：领口 + 袖口 + 蕾丝花边" }; }
  function model(bomData)  { return { uri: global.AI.img("model", bomData.words.color + bomData.words.style, 300, 600), note: "模特穿着效果，站姿正面" }; }

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
    combo: combo, look: look, model: model, factories: factories, finance: finance
  };
})(window);
