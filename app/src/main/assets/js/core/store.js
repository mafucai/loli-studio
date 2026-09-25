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

  // —— 接口配置 ——
  function getCfg() { return read(K_C, { base: "", key: "", model: "" }); }
  function setCfg(c) { write(K_C, c); }

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
    _keys: { K_D: K_D, K_C: K_C }  // 暴露键名仅用于回归断言
  };
})(window);
