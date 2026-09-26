/* 唯一事实源：设计单 / 接口配置 / 历史
 * 所有存储键的唯一读写方。任何跨模块读写必须经此模块，禁止旁路。
 */
(function (global) {
  "use strict";
  var K_D = "loli-studio.designs.v1";    // 全部设计单数组
  var K_C = "loli-studio.cfg.v1";        // 接口配置

  function read(k, fb) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : fb; }
    catch (e) { return fb; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { /* 满或私隐模式：静默 */ }
  }

  // —— 接口配置（多套地址/密钥）——
  // 存储结构：{ list: [ {id,name,base,key,model,imageModel}, ... ], activeId: "ep_xxx" }
  // 兼容旧结构：旧版是单个扁平对象 {base,key,model,imageModel} → 自动迁移成 1 套
  var K_EP = "loli-studio.endpoints.v1";

  function epId() { return "ep" + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  function emptyEp(name) {
    return { id: epId(), name: name || "新接口", base: "", key: "", model: "", imageModel: "" };
  }

  function loadStore() {
    var s = read(K_EP, null);
    if (s && Array.isArray(s.list)) {
      return { list: s.list, activeId: s.activeId || (s.list[0] && s.list[0].id) || "" };
    }
    // 迁移旧 cfg
    var old = read(K_C, null);
    if (old && (old.base || old.key || old.model || old.imageModel)) {
      var e = emptyEp("默认接口");
      e.base = old.base || ""; e.key = old.key || "";
      e.model = old.model || ""; e.imageModel = old.imageModel || "";
      var migrated = { list: [e], activeId: e.id };
      write(K_EP, migrated);
      return migrated;
    }
    return { list: [], activeId: "" };
  }

  function saveStore(s) { write(K_EP, s); }

  // 列表：始终返回数组（可能为空）
  function listEndpoints() { return loadStore().list; }
  function activeEndpoint() {
    var s = loadStore();
    for (var i = 0; i < s.list.length; i++) if (s.list[i].id === s.activeId) return s.list[i];
    return s.list[0] || null;
  }
  function addEndpoint(name) {
    var s = loadStore();
    var e = emptyEp(name || ("接口 " + (s.list.length + 1)));
    s.list.push(e);
    if (!s.activeId) s.activeId = e.id;
    saveStore(s);
    return e;
  }
  function updateEndpoint(id, patch) {
    var s = loadStore();
    for (var i = 0; i < s.list.length; i++) {
      if (s.list[i].id === id) {
        Object.keys(patch).forEach(function (k) { s.list[i][k] = patch[k]; });
        saveStore(s);
        return s.list[i];
      }
    }
    return null;
  }
  function removeEndpoint(id) {
    var s = loadStore();
    s.list = s.list.filter(function (e) { return e.id !== id; });
    if (s.activeId === id) s.activeId = s.list[0] ? s.list[0].id : "";
    saveStore(s);
    return true;
  }
  function setActiveEndpoint(id) {
    var s = loadStore();
    for (var i = 0; i < s.list.length; i++) if (s.list[i].id === id) { s.activeId = id; saveStore(s); return true; }
    return false;
  }

  // getCfg/setCfg 保持旧签名：返回/写入「当前生效那一套」的扁平结构，ai.js 无需改动
  function getCfg() {
    var a = activeEndpoint();
    if (!a) return { base: "", key: "", model: "", imageModel: "" };
    return { base: a.base || "", key: a.key || "", model: a.model || "", imageModel: a.imageModel || "" };
  }
  function setCfg(c) {
    var a = activeEndpoint();
    if (!a) { a = addEndpoint("默认接口"); }
    return updateEndpoint(a.id, {
      base: c.base || "", key: c.key || "",
      model: c.model || "", imageModel: c.imageModel || ""
    });
  }

  // —— 设计单（当前编辑中的这一条）——
  function newDesign(prompt) {
    return {
      id: "d" + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: prompt || "",
      step: "word",
      words: null,           // step 1
      imgUri: null,          // step 2
      imgPassed: false,
      bom: null,             // step 3
      check: null,           // step 4
      markedOriginal: false,
      sourcing: null,        // step 5
      combo: null,           // step 6
      model: null,           // step 7
      factories: null,       // step 8
      finance: null,         // step 9
      pickedFactory: null,
      history: [{ at: new Date().toISOString(), act: "新建", from: null, to: "word" }]
    };
  }

  function listDesigns() {
    var arr = read(K_D, []);
    if (!Array.isArray(arr)) arr = [];
    return arr.slice().sort(function (a, b) { return (b.updatedAt || "").localeCompare(a.updatedAt || ""); });
  }

  function getDesign(id) {
    var arr = read(K_D, []);
    for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === id) return arr[i];
    return null;
  }

  function saveDesign(d) {
    if (!d || !d.id) return false;
    d.updatedAt = new Date().toISOString();
    var arr = read(K_D, []);
    var i = -1;
    for (var k = 0; k < arr.length; k++) if (arr[k] && arr[k].id === d.id) { i = k; break; }
    if (i >= 0) arr[i] = d; else arr.push(d);
    write(K_D, arr);
    return true;
  }

  function deleteDesign(id) {
    var arr = read(K_D, []).filter(function (d) { return !d || d.id !== id; });
    write(K_D, arr);
    return true;
  }

  function currentId() { return localStorage.getItem(K_D + ".cur") || ""; }
  function setCurrentId(id) { if (id) localStorage.setItem(K_D + ".cur", id); }

  // —— 更新字段 + 记历史（唯一入口）——
  function patch(id, patchObj, action) {
    var d = getDesign(id);
    if (!d) return null;
    Object.keys(patchObj).forEach(function (k) { d[k] = patchObj[k]; });
    d.updatedAt = new Date().toISOString();
    d.history = d.history || [];
    d.history.push({ at: d.updatedAt, act: action || "更新", step: d.step });
    if (d.history.length > 60) d.history = d.history.slice(-60);
    saveDesign(d);
    return d;
  }

  global.Store = {
    newDesign: newDesign, saveDesign: saveDesign, patch: patch,
    getDesign: getDesign, listDesigns: listDesigns, deleteDesign: deleteDesign,
    getCfg: getCfg, setCfg: setCfg, currentId: currentId, setCurrentId: setCurrentId,
    // 多套接口
    listEndpoints: listEndpoints, activeEndpoint: activeEndpoint,
    addEndpoint: addEndpoint, updateEndpoint: updateEndpoint,
    removeEndpoint: removeEndpoint, setActiveEndpoint: setActiveEndpoint,
    _keys: { K_D: K_D, K_C: K_C, K_EP: K_EP }  // 暴露键名仅用于回归断言
  };
})(window);
