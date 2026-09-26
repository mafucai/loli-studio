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
    async function image(prompt){
      var c=imgCfg(); var base=String(c.base||"").replace(/\/+$/,"");
      if(!/^https:\/\//i.test(base)) return {__error:"图片接口地址必须使用 HTTPS"};
      if(!c.model) return {__error:"未填写图片模型（图片接口独立设置）"};
      try{
        var r=await fetch(base+"/images/generations",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+c.key},body:JSON.stringify({model:c.model,prompt:prompt,size:"1024x1536",response_format:"b64_json"})});
        if(!r.ok) throw new Error("HTTP "+r.status);
        var j=await r.json(); var item=j.data&&j.data[0]; if(!item) throw new Error("接口没有返回图片");
        var uri=item.b64_json?"data:image/png;base64,"+item.b64_json:(/^https:\/\//i.test(item.url||"")?item.url:"");
        if(!uri) throw new Error("图片地址不安全或为空");
        return {uri:uri, source:"ai"};
      }catch(e){ return {__error:"图片接口失败："+e.message}; }
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

    global.AI = {
      chat: chat, mode: mode, imageMode: imageMode, img: imgDataUri, image: image,
      srand: srand, listModels: listModels, searchWeb: searchWeb
    };
})(window);
