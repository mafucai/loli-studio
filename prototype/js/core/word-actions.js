/* 企划 + 设计词动作（从 actions.js 拆出，遵守单文件 ≤400 行铁律）
 * 覆盖：主题、柄图、避免词、设计词生成
 * 依赖：由 actions.js 通过 Actions.registerWord(ACT, 工具) 注入。
 */
(function (global) {
  "use strict";

  function registerWord(ACT, H) {
    var patch = H.patch, cur = H.cur, report = H.report, toast = H.toast;
    var Factory = global.Factory, AI = global.AI, Store = global.Store;

  ACT["pick-theme"] = function (el) {
    var value = el.getAttribute("data-value");
    if (Factory.THEMES.indexOf(value) < 0) { report("主题无效"); return; }
    var d = cur();
    // 换主题后旧柄图作废，必须重选（柄图跟着主题走）
    patch("选主题", { theme: value, prints: null });
  };
  ACT["gen-prints"] = function () {
    var d = cur();
    if (!d || !d.theme) { toast("先选主题风格"); return; }
    var items = Factory.printCandidates(d.theme, d.theme + Date.now());
    patch("生成柄图候选", { prints: { theme: d.theme, items: items, picks: [], mode: "demo", at: new Date().toISOString() } });
  };
  ACT["pick-print"] = function (el) {
    var d = cur();
    if (!d || !d.prints) { report("先生成柄图候选"); return; }
    var value = el.getAttribute("data-value");
    var exists = (d.prints.items || []).some(function (x) { return x.id === value; });
    if (!exists) { report("柄图候选不存在"); return; }
    var prints = JSON.parse(JSON.stringify(d.prints));
    prints.picks = prints.picks[0] === value ? [] : [value];   // 单选；再点一次取消
    patch("选柄图", { prints: prints });
  };
  ACT["save-avoid"] = function () {
    var d = cur();
    if (!d) { toast("请先从历史里选一条或新建"); return; }
    var input = document.getElementById("in-avoid");
    if (!input) return;
    var list = String(input.value || "").split(/[,，、\s]+/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x; })
      .slice(0, 20);
    patch("保存避免词", { avoid: list });
    toast(list.length ? "已保存 " + list.length + " 个避免词" : "已清空避免词");
  };

    ACT["gen-words"] = async function () {
      var ta = document.getElementById("in-prompt");
      var prompt = ta ? ta.value.trim() : "";
      var d0 = cur();
      var hasPrint = !!(d0 && d0.prints && d0.prints.picks && d0.prints.picks.length);
      var hasTheme = !!(d0 && d0.theme);
      if (!prompt && !hasPrint && !hasTheme) { toast("先写一句设计需求，或先做企划"); return; }
      var d = cur();
      if (!d) { toast("请先从历史里选一条或新建"); return; }
      Store.setCurrentId(d.id);
      var theme = d.theme || "";
      var printText = Factory.printDesc({ theme: theme, picks: (d.prints && d.prints.picks) || [] });
      var avoid = d.avoid || [];
      var built = AI.buildWordPrompt({ theme: theme, prints: printText, avoid: avoid, prompt: prompt });
      var promptForFactory = [theme, printText, prompt].filter(Boolean).join(" ") || prompt;
      if (AI.mode() !== "real") {
        patch("演示设计词", { prompt: prompt, words: Factory.designWords(promptForFactory), wordsSource: "demo" });
        toast("演示模式：本地生成");
        return;
      }
      toast("正在调用文本接口");
      var reply = await AI.chat(built.user, { system: built.system });
      if (reply && reply.__error) { report(reply.__error); return; }
      var parsed;
      try { parsed = JSON.parse(String(reply).replace(/^```json\s*|```$/g, "").trim()); }
      catch (e) { report("接口返回不是有效 JSON：" + reply); return; }
      var words = { prompt: prompt, style: String(parsed.style || ""), season: String(parsed.season || ""), mainFabric: String(parsed.mainFabric || ""), color: Factory.toColors(parsed.color), details: Array.isArray(parsed.details) ? parsed.details.map(String) : [], decors: Array.isArray(parsed.decors) ? parsed.decors.map(String) : [], sizes: Array.isArray(parsed.sizes) ? parsed.sizes.map(String) : [], mood: String(parsed.mood || "") };
      if (!words.style || !words.color.length || !words.mainFabric || !words.details.length) { report("接口结果缺少必要字段"); return; }
      patch("真实设计词", { prompt: prompt, words: words, wordsSource: "ai" });
      toast("文本接口生成完成");
    };    return ACT;
  }

  global.Actions = global.Actions || {};
  global.Actions.registerWord = registerWord;
})(window);
