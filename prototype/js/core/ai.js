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
          var base = String(c.base || "").replace(/\/+$/, "");
          if (!/^https:\/\//i.test(base)) throw new Error("接口地址必须使用 HTTPS");
          var r = await fetch(base + "/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.key },
            body: JSON.stringify({
              model: c.model || "gpt-4o-mini",
              messages: [{ role: "system", content: opts.system || "你是洛丽塔服装设计助手。" }, { role: "user", content: user }],
              temperature: 0.4
            })
          });
          if (!r.ok) throw new Error("HTTP " + r.status);
          var j = await r.json();
          var text = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
          if (!text) throw new Error("接口没有返回内容");
          return text;
        } catch (e) {
          return { __error: "接口调用失败：" + e.message };
        }
      }
      if (opts.mock) return opts.mock(user);
      return "[演示模式] 当前没有调用外部接口。";
    }

  // 图片：mock 时用本地 SVG 数据 URI，不依赖任何 CDN（流程 §3.7 硬约束）
  // 图片接口与文本接口完全独立：各用各的地址 / 密钥 / 模型
  function imgCfg() {
    if (global.Store && Store.getImageCfg) return Store.getImageCfg() || {};
    return {};   // 没有独立图片池时，明确视为未配置（不回落文本接口）
  }
  function imageMode(){ var c=imgCfg(); return c.base && c.key && c.model ? "real" : "mock"; }
    function imgDataUri(kind, seed, w, h){
      w=w||360; h=h||480; var rnd=srand(kind+seed);
      var palette={dress:["#e8d5c4","#c9a3b8","#f4e6d3"],detail:["#2a2431","#4a3d52","#8b6f9e"],model:["#1a1611","#3a2f3a","#6a4d5e"],combo:["#3a3129","#5a4a3a","#8a7050"],look:["#c9b8a0","#9a8870","#6a5a45"]}[kind]||["#c9b8a0","#9a8870","#6a5a45"];
      var shapes=""; for(var i=0;i<14;i++){var x=Math.floor(rnd()*w),y=Math.floor(rnd()*h),r=20+Math.floor(rnd()*120),o=(0.06+rnd()*0.18).toFixed(3); shapes+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+palette[i%3]+'" opacity="'+o+'"/>';}
      return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'"><rect width="100%" height="100%" fill="#1b1815"/>'+shapes+'<text x="50%" y="54%" text-anchor="middle" fill="#d9b26a" font-family="serif" font-size="20">演示图</text></svg>');
    }
    // 把外链图片转成 data URI（部分 WebView 会拦 file:// 页面加载外链图片）
    // 失败时原样返回，让 <img> 自己去试
    async function urlToDataUri(url, timeoutMs) {
      if (!/^https:\/\//i.test(url)) return url;
      var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 30000) : null;
      try {
        var r = await fetch(url, { signal: ctrl ? ctrl.signal : undefined });
        if (!r.ok) return url;
        var blob = await r.blob();
        return await new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () { resolve(String(fr.result || url)); };
          fr.onerror = function () { resolve(url); };
          fr.readAsDataURL(blob);
        });
      } catch (e) {
        return url;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    // 单次图片请求（可指定参数），带超时
    async function imgRequest(c, prompt, body, timeoutMs) {
      var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = null;
      if (ctrl) timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
      try {
        var r = await fetch(c.base + "/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.key },
          body: JSON.stringify(body),
          signal: ctrl ? ctrl.signal : undefined
        });
        if (!r.ok) {
          var t = "";
          try { t = await r.text(); } catch (e2) {}
          throw new Error("HTTP " + r.status + (t ? " " + t.slice(0, 120) : ""));
        }
        return await r.json();
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    // 从任意形状的响应里取出图片（兼容 b64 / url / 数组 / 嵌套 data）
    function pickImage(j) {
      var item = (j && j.data && j.data[0]) || (j && j.data) || j || {};
      if (Array.isArray(item)) item = item[0] || {};
      var b64 = item.b64_json || item.b64 || (j && j.b64_json) || "";
      if (b64) return { uri: "data:image/png;base64," + b64, source: "ai" };
      var url = item.url || (j && j.url) || "";
      if (/^https:\/\//i.test(url)) return { uri: url, source: "ai" };
      // 有些中转把图片放在 revisions / images 里
      var alt = (j && j.images && j.images[0]) || "";
      if (typeof alt === "string" && /^https:\/\//i.test(alt)) return { uri: alt, source: "ai" };
      if (typeof alt === "string" && alt.length > 1000) return { uri: "data:image/png;base64," + alt, source: "ai" };
      // 兼容 revisions 结构（部分中转/Grok 系）
      var rev = (item && item.revisions && item.revisions[0]) || (j && j.revisions && j.revisions[0]) || null;
      if (rev) {
        var rurl = rev.url || rev.image_url || "";
        if (/^https:\/\//i.test(rurl)) return { uri: rurl, source: "ai" };
        var rb64 = rev.b64_json || rev.b64 || "";
        if (rb64) return { uri: "data:image/png;base64," + rb64, source: "ai" };
      }
      return null;
    }

    // 图片生成：按「快→慢」尝试多种参数组合，任一成功即返回
    // 说明：不再写死 b64+1024x1536，避免接口慢或参数不被支持时干等两三分钟
    async function image(prompt) {
      var c = imgCfg(); var base = String(c.base || "").replace(/\/+$/, "");
      if (!/^https:\/\//i.test(base)) return { __error: "图片接口地址必须使用 HTTPS" };
      if (!c.model) return { __error: "未填写图片模型（图片接口独立设置）" };
      c.base = base;

      var size = c.size || "1024x1024";          // 可在设置里自定义；默认比 1024x1536 小
      var timeoutMs = Number(c.timeoutMs) || 90000;

      // 参数组合：先 url（快），再 b64（兼容）
      var attempts = [
        { label: "url/" + size, body: { model: c.model, prompt: prompt, size: size, response_format: "url", n: 1 } },
        { label: "默认/" + size, body: { model: c.model, prompt: prompt, size: size, n: 1 } },
        { label: "b64/" + size, body: { model: c.model, prompt: prompt, size: size, response_format: "b64_json", n: 1 } }
      ];

      var lastErr = "";
      for (var i = 0; i < attempts.length; i++) {
        if (global.__imgProgress) global.__imgProgress("尝试 " + attempts[i].label);
        try {
          var j = await imgRequest(c, prompt, attempts[i].body, timeoutMs);
          var got = pickImage(j);
          if (got) {
            // 若拿到的是外链，先尝试转 data URI（避免 WebView 拦外链图片）
            if (/^https:\/\//i.test(got.uri)) {
              if (global.__imgProgress) global.__imgProgress("下载图片…");
              got.uri = await urlToDataUri(got.uri, timeoutMs);
            }
            return got;
          }
          lastErr = attempts[i].label + " 没返回图片";
        } catch (e) {
          lastErr = attempts[i].label + "：" + e.message;
          // 地址/鉴权错误不必换参数重试
          if (/HTTP 40[13]/.test(e.message)) break;
          if (/aborted/i.test(e.message) || /AbortError/i.test(e.name || "")) {
            return { __error: "图片接口超时（" + Math.round(timeoutMs / 1000) + "秒）。可在接口设置里改小尺寸或调超时。" };
          }
        }
      }
      return { __error: "图片接口失败：" + lastErr };
    }

    // 拉取接口支持的模型列表（GET {base}/models，OpenAI 兼容格式）
    // 不保证每个中转站都开放；失败时返回错误信息，让上层提示「可手打」
    async function listModels(kind) {
      var c = kind === "image" ? imgCfg() : cfg();
      var base = String(c.base || "").replace(/\/+$/, "");
      if (!base) return { __error: "还没填接口地址" };
      if (!/^https:\/\//i.test(base)) return { __error: "接口地址必须使用 HTTPS" };
      if (!c.key) return { __error: "还没填 API Key" };
      try {
        var r = await fetch(base + "/models", {
          method: "GET",
          headers: { "Authorization": "Bearer " + c.key }
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        var j = await r.json();
        var arr = (j && j.data) || (Array.isArray(j) ? j : null);
        if (!arr || !arr.length) throw new Error("接口没有返回模型列表");
        var ids = [];
        for (var i = 0; i < arr.length; i++) {
          var id = arr[i] && (arr[i].id || arr[i].model || arr[i].name);
          if (id && ids.indexOf(String(id)) < 0) ids.push(String(id));
        }
        ids.sort();
        return { models: ids };
      } catch (e) {
        return { __error: "拉取失败：" + e.message + "（可手动填写模型名）" };
      }
    }

    // 让 AI 联网搜索（用于「AI 自己拉取各大平台」）：
    // 走 chat 接口，system 明确要求返回 JSON 数组，含 title/price/url/source。
    // 接口若不支持联网，模型只会根据已有知识作答——所以结果必须由用户点开链接自行核实。
    async function searchWeb(query, opts) {
      opts = opts || {};
      var sys = opts.system || (
        "你是电商调研助手。请根据用户给的关键词，列出可能的相似商品或参考信息。" +
        "只返回 JSON 数组，不要 Markdown。每项字段：title（标题）、source（平台名）、price（参考价，带￥，没有就空字符串）、url（可点击的搜索或商品地址）。" +
        "url 一律使用对应平台的公开搜索地址；不要编造具体商品 ID。列 5 条。"
      );
      return chat(query, { system: sys });
    }

    // 让文本模型拆件：不依赖视觉模型，用设计词 + 图片描述文本
    // 返回 { parts:[{part,material,amount,unit}], steps:[{step,time}] }
    async function splitBom(words, imgNote) {
      var desc = [
        "风格：" + (words.style || ""),
        "季节：" + (words.season || ""),
        "主面料：" + (words.mainFabric || ""),
        "颜色：" + (words.color || ""),
        "细节：" + ((words.details || []).join("、")),
        "装饰：" + ((words.decors || []).join("、")),
        "尺码：" + ((words.sizes || []).join("、")),
        imgNote ? "图片说明：" + imgNote : ""
      ].filter(Boolean).join("\n");
      var sys = "你是洛丽塔服装打版师。根据服装描述，拆出可采购的零件清单和制作工序。" +
        "只返回 JSON，不要 Markdown。格式：{\"parts\":[{\"part\":\"零件名\",\"material\":\"材料\",\"amount\":数字,\"unit\":\"米/个/颗\"}]," +
        "\"steps\":[{\"step\":\"工序名\",\"time\":\"小时\"}]}。" +
        "parts 至少 8 项，steps 至少 6 项。材料用量要真实。";
      var reply = await chat(desc, { system: sys });
      if (reply && reply.__error) return { __error: reply.__error };
      try {
        var t = String(reply).replace(/^```json\s*|```$/g, "").trim();
        var j = JSON.parse(t);
        if (!j.parts || !j.parts.length) throw new Error("缺少 parts");
        // 归一化：补默认字段
        j.parts = j.parts.map(function (p) {
          return {
            part: String(p.part || "").slice(0, 40),
            material: String(p.material || "").slice(0, 40),
            amount: Number(p.amount) || 1,
            unit: String(p.unit || "个").slice(0, 6)
          };
        }).filter(function (p) { return p.part; });
        j.steps = (j.steps || []).map(function (s) {
          return { step: String(s.step || "").slice(0, 30), time: String(s.time || "").slice(0, 12) };
        }).filter(function (s) { return s.step; });
        return j;
      } catch (e) {
        return { __error: "AI 拆件返回的不是有效 JSON：" + String(reply).slice(0, 160) };
      }
    }

    // 让文本模型比价：给零件清单，返回每个零件「哪家可能更便宜 + 关键词」
    // 注意：AI 只给参考判断，真实价格必须用户点链接自行核实
    async function comparePrice(items) {
      var list = items.map(function (it, i) {
        return (i + 1) + ". " + it.part + "（" + it.material + "，" + it.amount + it.unit + "）";
      }).join("\n");
      var sys = "你是服装采购比价助手。根据零件清单，判断每个零件在哪类平台更可能便宜，" +
        "并给出一句省钱建议。只返回 JSON 数组，不要 Markdown。" +
        "每项字段：part（零件名）、best（建议平台之一：拼多多/1688/淘宝/闲鱼）、" +
        "keyword（搜索关键词）、tip（一句话省钱建议）。不要编造具体价格和店铺。";
      var reply = await chat(list, { system: sys });
      if (reply && reply.__error) return { __error: reply.__error };
      try {
        var t = String(reply).replace(/^```json\s*|```$/g, "").trim();
        var arr = JSON.parse(t);
        if (!Array.isArray(arr)) throw new Error("不是数组");
        return { items: arr.slice(0, 20).map(function (x) {
          return {
            part: String((x && x.part) || "").slice(0, 40),
            best: String((x && x.best) || "").slice(0, 10),
            keyword: String((x && x.keyword) || "").slice(0, 60),
            tip: String((x && x.tip) || "").slice(0, 120)
          };
        }).filter(function (x) { return x.part; }) };
      } catch (e) {
        return { __error: "AI 比价返回的不是有效 JSON：" + String(reply).slice(0, 160) };
      }
    }

    global.AI = {
      chat: chat, mode: mode, imageMode: imageMode, img: imgDataUri, image: image,
      srand: srand, listModels: listModels, searchWeb: searchWeb,
      splitBom: splitBom, comparePrice: comparePrice
    };
})(window);
