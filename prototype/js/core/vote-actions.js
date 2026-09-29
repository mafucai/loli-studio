/* 图透动作（从 actions.js 拆出，遵守单文件 ≤400 行铁律）
 * 依赖：由 actions.js 通过 Actions.registerVote(ACT, 工具) 注入。
 *       本文件不自行查找 View/Store，避免两套事实源。
 * 铁律：versions 数组只增不删 —— 这就是「改版留痕」的全部含义。
 */
(function (global) {
  "use strict";

  function registerVote(ACT, H) {
    var patch = H.patch, cur = H.cur, report = H.report, toast = H.toast;
    var makeImage = H.makeImage;
    var Factory = global.Factory;

  ACT["start-version"] = function () {
    var d = cur();
    if (!d || !d.imgUri) { toast("先生成并选一张候选图"); return; }
    if ((d.versions || []).length) { toast("已有版本记录，用「改版重开」加新版"); return; }
    var list = Factory.pushVersion([], {
      uri: d.imgUri, source: d.imgSource || "demo",
      reason: "", note: "首版"
    });
    patch("建立第 1 版", { versions: list, currentVersion: 0 });
  };
  ACT["switch-version"] = function (el) {
    var d = cur();
    if (!d || !(d.versions || []).length) { report("还没有版本记录"); return; }
    var index = Number(el.getAttribute("data-index"));
    if (!d.versions[index]) { report("版本不存在"); return; }
    patch("切换版本", { currentVersion: index, voteNote: "" });
  };
  ACT["vote"] = function (el) {
    var d = cur();
    if (!d || !(d.versions || []).length) { report("先建立第 1 版"); return; }
    var value = el.getAttribute("data-value");
    if (Factory.VOTE_CHOICES.indexOf(value) < 0) { report("投票选项无效"); return; }
    var note = document.getElementById("in-vnote");
    var curVer = d.versions[d.currentVersion || 0];
    var votes = Factory.pushVote(d.votes, {
      versionNo: curVer.n, choice: value, note: note ? note.value.trim() : ""
    });
    patch("图透投票：" + value, { votes: votes, voteNote: (note ? note.value.trim() : "") });
  };
  ACT["save-vote"] = function () {
    var d = cur();
    if (!d || !(d.versions || []).length) { toast("先建立第 1 版"); return; }
    var note = document.getElementById("in-vnote");
    var text = note ? note.value.trim() : "";
    if (!text) { toast("先写一句意见"); return; }
    var curVer = d.versions[d.currentVersion || 0];
    var votes = Factory.pushVote(d.votes, { versionNo: curVer.n, choice: "待定", note: text });
    patch("记录图透意见", { votes: votes, voteNote: text });
    toast("已记录");
  };
  ACT["pick-reason"] = function (el) {
    var value = el.getAttribute("data-value");
    if (Factory.REVISE_REASONS.indexOf(value) < 0) { report("改版原因无效"); return; }
    var input = document.getElementById("in-reason");
    if (input) input.value = value;                       // 只填输入框，不落库
    patch("选改版原因", { reviseReason: value });
  };
  // 改版重开：必须填原因；新增一版（旧版保留）；需要图片接口或走演示图
  ACT["revise-img"] = async function () {
    var d = cur();
    if (!d || !(d.versions || []).length) { toast("先建立第 1 版"); return; }
    var input = document.getElementById("in-reason");
    var reason = (input && input.value.trim()) || d.reviseReason || "";
    if (!reason) { report("改版必须填原因，否则留痕没有意义"); return; }
    if (!d.words) { toast("先生成设计词"); return; }
    var w = d.words;
    var nextNo = (d.versions || []).length + 1;
    var prompt = "洛丽塔服装平铺图，改版第 " + nextNo + " 版，" +
      Factory.toColors(w.color).join("、") + "，" + w.style +
      "，改进方向：" + reason + "，细节：" + (w.details || []).join("、");

    function save(uri, source) {
      var list = Factory.pushVersion(d.versions, { uri: uri, source: source, reason: reason, note: "" });
      patch("改版第 " + nextNo + " 版（" + reason + "）",
        { versions: list, currentVersion: list.length - 1, reviseReason: "", voteNote: "" });
      toast("已生成第 " + nextNo + " 版，旧版保留");
    }
    makeImage("dress", prompt, save);
  };
    return ACT;
  }

  global.Actions = global.Actions || {};
  global.Actions.registerVote = registerVote;
})(window);
