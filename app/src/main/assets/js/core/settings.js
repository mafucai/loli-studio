/* 接口设置 / 模型拉取 / AI 联网搜索
 * 从 actions.js 拆出：actions.js 需要 ≤400 行（项目铁律）。
 * 依赖：Actions（注册动作）、Store、R、AI、__render。
 * 由 actions.js 在 init 后调用 Settings.register(ACT, helpers) 注入 ACT 与公共函数。
 */
(function (global) {
  "use strict";

  var EP_UI = {
    text:  { list: "ep-list-text",  empty: "ep-empty-text",  editor: "ep-editor-text",
             name: "in-t-name", base: "in-t-base", key: "in-t-key", model: "in-t-model" },
    image: { list: "ep-list-image", empty: "ep-empty-image", editor: "ep-editor-image",
             name: "in-i-name", base: "in-i-base", key: "in-i-key", model: "in-i-model" }
  };

  var ACT = null, H = null;   // 由 register 注入
  var MODELS = { text: [], image: [] };

  function esc2(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function kindOf(el) { return (el && el.getAttribute("data-kind")) === "image" ? "image" : "text"; }

  // —— 刷新单个池的界面 ——
  function refreshPool(kind) {
    var ui = EP_UI[kind];
    if (!ui) return;
    var list = Store.listEndpoints(kind);
    var act = Store.activeEndpoint(kind);
    var listEl = document.getElementById(ui.list);
    if (listEl) listEl.innerHTML = R.epListHTML(list, act ? act.id : "", kind);
    var emptyEl = document.getElementById(ui.empty);
    var editEl = document.getElementById(ui.editor);
    if (!act) {
      if (emptyEl) emptyEl.style.display = "";
      if (editEl) editEl.style.display = "none";
      hideModelPanel(kind);
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    if (editEl) editEl.style.display = "";
    document.getElementById(ui.name).value = act.name || "";
    document.getElementById(ui.base).value = act.base || "";
    document.getElementById(ui.key).value = act.key || "";
    document.getElementById(ui.model).value = act.model || "";
  }

  function refreshSettings() { refreshPool("text"); refreshPool("image"); }

  // —— 把某个池编辑器里的内容写回该池当前接口 ——
  function savePoolEditor(kind) {
    var ui = EP_UI[kind];
    if (!ui) return null;
    var act = Store.activeEndpoint(kind);
    if (!act) return null;
    var nameEl = document.getElementById(ui.name);
    return Store.updateEndpoint(kind, act.id, {
      name: (nameEl ? nameEl.value.trim() : "") || act.name || "未命名",
      base: document.getElementById(ui.base).value.trim(),
      key: document.getElementById(ui.key).value.trim(),
      model: document.getElementById(ui.model).value.trim()
    });
  }

  // —— 模型列表面板 ——
  function modelPanelEl(kind) {
    return document.getElementById(kind === "image" ? "model-panel-image" : "model-panel-text");
  }
  function hideModelPanel(kind) {
    var p = modelPanelEl(kind);
    if (p) { p.style.display = "none"; p.innerHTML = ""; }
  }
  function showModelPanel(kind, models, err) {
    var p = modelPanelEl(kind);
    if (!p) return;
    var html = '<div class="mp-head">' + (err ? esc2(err) : "可用的模型（点一个填入）") + "</div>";
    if (models && models.length) {
      html += '<div class="mp-list">' + models.map(function (m) {
        return '<button type="button" class="mp-item" data-act="pick-model" data-kind="' + kind +
          '" data-name="' + esc2(m) + '">' + esc2(m) + "</button>";
      }).join("") + "</div>";
    }
    html += '<div class="mp-foot">拉不到？直接在「' + (kind === "image" ? "图片" : "文本") + '模型」框里手打即可。</div>';
    p.innerHTML = html;
    p.style.display = "";
  }

  function saveSettings(ev) {
    ev.preventDefault();
    var kind = (ev.target && ev.target.id === "form-image") ? "image" : "text";
    var saved = savePoolEditor(kind);
    if (!saved) { H.toast("先新增一套接口"); return; }
    refreshPool(kind);
    global.__render && __render();
    var m = kind === "image" ? AI.imageMode() : AI.mode();
    H.toast("已保存（" + (m === "real" ? "真实模式" : "演示模式：地址或密钥为空") + "）");
  }

  function register(act, helpers) {
    ACT = act; H = helpers;

    ACT["close-sheet"] = function () {
      document.getElementById("sheet").classList.remove("open");
    };
    ACT["open-settings"] = function () {
      refreshSettings();
      document.getElementById("sheet").classList.add("open");
    };
    ACT["ep-add"] = function (el) {
      var kind = kindOf(el);
      var e = Store.addEndpoint(kind);
      Store.setActiveEndpoint(kind, e.id);
      refreshPool(kind);
      global.__render && __render();
      H.toast("已新增一套" + (kind === "image" ? "图片" : "文本") + "接口，填好后保存");
    };
    ACT["ep-pick"] = function (el) {
      var kind = kindOf(el);
      var id = el.getAttribute("data-id");
      savePoolEditor(kind);            // 切换前先保存当前编辑内容，避免丢改动
      Store.setActiveEndpoint(kind, id);
      refreshPool(kind);
      global.__render && __render();
    };
    ACT["ep-del"] = function (el) {
      var kind = kindOf(el);
      var act = Store.activeEndpoint(kind);
      if (!act) return;
      if (!confirm("删除" + (kind === "image" ? "图片" : "文本") + "接口「" + (act.name || "未命名") + "」？")) return;
      Store.removeEndpoint(kind, act.id);
      refreshPool(kind);
      global.__render && __render();
      H.toast("已删除");
    };

    // 拉取该接口支持的模型列表
    ACT["fetch-models"] = async function (el) {
      var kind = kindOf(el);
      savePoolEditor(kind);            // 用最新填的地址/密钥去拉
      hideModelPanel(kind);
      H.toast("正在拉取模型列表…");
      var res = await AI.listModels(kind);
      if (res && res.__error) {
        H.toast(res.__error);
        showModelPanel(kind, [], res.__error);
        return;
      }
      MODELS[kind] = res.models || [];
      showModelPanel(kind, MODELS[kind], "");
      H.toast("拉到 " + MODELS[kind].length + " 个模型，点一个填进去");
    };
    ACT["pick-model"] = function (el) {
      var kind = kindOf(el);
      var ui = EP_UI[kind];
      var name = el.getAttribute("data-name") || "";
      if (ui) document.getElementById(ui.model).value = name;
      hideModelPanel(kind);
      H.toast("已填入：" + name + "，记得点保存");
    };

    // AI 联网搜索（查重 / 工厂）
    ACT["ai-search"] = async function (el) {
      var where = (el && el.getAttribute("data-where")) || "check";
      var d = H.cur();
      if (!d) { H.toast("先建立设计单"); return; }
      if (AI.mode() !== "real") { H.toast("AI 搜索需要先在接口设置里填文本接口"); return; }

      var w = d.words || {};
      var q = where === "fact"
        ? [w.style, w.mainFabric, "洛丽塔 代工厂 产业带"].filter(Boolean).join(" ")
        : ["洛丽塔", w.style, w.color, w.mainFabric, "相似款 原创"].filter(Boolean).join(" ");

      H.toast("正在让 AI 搜索…");
      var reply = await AI.searchWeb(q);
      if (reply && reply.__error) { H.report(reply.__error); return; }
      var items;
      try {
        var t = String(reply).replace(/^```json\s*|```$/g, "").trim();
        items = JSON.parse(t);
        if (!Array.isArray(items)) throw new Error("不是数组");
      } catch (e) {
        H.report("AI 返回的不是有效列表：" + String(reply).slice(0, 200));
        return;
      }
      var clean = items.slice(0, 8).map(function (it) {
        return {
          title: String((it && it.title) || "").slice(0, 120),
          source: String((it && it.source) || "").slice(0, 30),
          price: String((it && it.price) || "").slice(0, 30),
          url: /^https:\/\//i.test((it && it.url) || "") ? it.url : ""
        };
      });
      var patchObj = {};
      patchObj[where === "fact" ? "aiFactories" : "aiCheck"] =
        { query: q, items: clean, at: new Date().toISOString() };
      H.patch("AI 搜索（" + (where === "fact" ? "工厂" : "查重") + "）", patchObj);
      H.toast("AI 搜到 " + clean.length + " 条，请逐条点开核实");
    };
  }

  global.Settings = {
    register: register,
    refresh: refreshSettings,
    saveSettings: saveSettings,
    bindForms: function (container) {
      if (container.id === "form-text" || container.id === "form-image") {
        container.addEventListener("submit", saveSettings, false);
      }
    }
  };
})(window);
