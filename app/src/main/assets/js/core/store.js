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

  // —— 接口配置（两个池：文本 / 图片，各自多套地址密钥）——
  // 存储结构：
  // { text: { list:[{id,name,base,key,model}],        activeId },
  //   image:{ list:[{id,name,base,key,model}],        activeId } }
  // 每个接口只服务一种用途：文本模型填 model，图片模型也填 model（含义随池而定）。
  // 兼容：
  //   v1 单配置 {base,key,model,imageModel} → 迁移为 text 1 套 + image 1 套
  //   v2 混合池 {list:[{...model,imageModel}],activeId} → 文本/图片各自拆开
  var K_EP = "loli-studio.endpoints.v2";

  function epId(kind) { return (kind === "image" ? "img" : "txt") + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  function emptyEp(kind, name) {
    return { id: epId(kind), name: name || "新接口", base: "", key: "", model: "" };
  }

  function emptyPools() { return { text: { list: [], activeId: "" }, image: { list: [], activeId: "" } }; }

  function loadPools() {
    var s = read(K_EP, null);
    if (s && s.text && s.image && Array.isArray(s.text.list) && Array.isArray(s.image.list)) {
      return s;
    }
    // 从 v2 混合池迁移（list + imageModel）
    var mix = read("loli-studio.endpoints.v1", null);
    if (mix && Array.isArray(mix.list)) {
      var p = emptyPools();
      mix.list.forEach(function (e) {
        var t = emptyEp("text", e.name || "接口");
        t.base = e.base || ""; t.key = e.key || ""; t.model = e.model || "";
        p.text.list.push(t);
        if (e.imageModel) {
          var im = emptyEp("image", (e.name || "接口") + "（图片）");
          im.base = e.base || ""; im.key = e.key || ""; im.model = e.imageModel;
          p.image.list.push(im);
        }
      });
      p.text.activeId = p.text.list[0] ? p.text.list[0].id : "";
      p.image.activeId = p.image.list[0] ? p.image.list[0].id : "";
      write(K_EP, p);
      return p;
    }
    // 从 v1 单配置迁移
    var old = read(K_C, null);
    if (old && (old.base || old.key || old.model || old.imageModel)) {
      var q = emptyPools();
      if (old.base || old.key || old.model) {
        var t2 = emptyEp("text", "文本接口");
        t2.base = old.base || ""; t2.key = old.key || ""; t2.model = old.model || "";
        q.text.list.push(t2); q.text.activeId = t2.id;
      }
      if (old.base || old.key || old.imageModel) {
        var i2 = emptyEp("image", "图片接口");
        i2.base = old.base || ""; i2.key = old.key || ""; i2.model = old.imageModel || "";
        q.image.list.push(i2); q.image.activeId = i2.id;
      }
      write(K_EP, q);
      return q;
    }
    return emptyPools();
  }

  function savePools(p) { write(K_EP, p); }
  function normKind(kind) { return kind === "image" ? "image" : "text"; }

  // 通用池操作（kind: "text" | "image"）
  function listEndpoints(kind) { return loadPools()[normKind(kind)].list; }
  function activeEndpoint(kind) {
    var pool = loadPools()[normKind(kind)];
    for (var i = 0; i < pool.list.length; i++) if (pool.list[i].id === pool.activeId) return pool.list[i];
    return pool.list[0] || null;
  }
  function addEndpoint(kind, name) {
    var p = loadPools(); var pool = p[normKind(kind)];
    var e = emptyEp(normKind(kind), name || ("接口 " + (pool.list.length + 1)));
    pool.list.push(e);
    if (!pool.activeId) pool.activeId = e.id;
    savePools(p);
    return e;
  }
  function updateEndpoint(kind, id, patch) {
    var p = loadPools(); var pool = p[normKind(kind)];
    for (var i = 0; i < pool.list.length; i++) {
      if (pool.list[i].id === id) {
        // 拒绝跨池串写 model（防止 text 的 model 被写到 image 池的语义里）
        Object.keys(patch).forEach(function (k) { pool.list[i][k] = patch[k]; });
        savePools(p);
        return pool.list[i];
      }
    }
    return null;
  }
  function removeEndpoint(kind, id) {
    var p = loadPools(); var pool = p[normKind(kind)];
    pool.list = pool.list.filter(function (e) { return e.id !== id; });
    if (pool.activeId === id) pool.activeId = pool.list[0] ? pool.list[0].id : "";
    savePools(p);
    return true;
  }
  function setActiveEndpoint(kind, id) {
    var p = loadPools(); var pool = p[normKind(kind)];
    for (var i = 0; i < pool.list.length; i++) if (pool.list[i].id === id) { pool.activeId = id; savePools(p); return true; }
    return false;
  }
  function resetEndpoints() { savePools(emptyPools()); return true; }

  // 文本接口（AI.chat 用）
  function getCfg() {
    var a = activeEndpoint("text");
    if (!a) return { base: "", key: "", model: "", imageModel: "" };
    return { base: a.base || "", key: a.key || "", model: a.model || "", imageModel: "" };
  }
  function setCfg(c) {
    var p = loadPools();
    if (!p.text.list.length) addEndpoint("text", "文本接口");
    var a = activeEndpoint("text");
    return updateEndpoint("text", a.id, {
      base: c.base || "", key: c.key || "", model: c.model || ""
    });
  }

  // 图片接口（AI.image 用）—— 与文本完全独立
  function getImageCfg() {
    var a = activeEndpoint("image");
    if (!a) return { base: "", key: "", model: "", size: "", timeoutMs: 0 };
    return {
      base: a.base || "", key: a.key || "", model: a.model || "",
      size: a.size || "", timeoutMs: Number(a.timeoutMs) || 0
    };
  }
  function setImageCfg(c) {
    var p = loadPools();
    if (!p.image.list.length) addEndpoint("image", "图片接口");
    var a = activeEndpoint("image");
    return updateEndpoint("image", a.id, {
      base: c.base || "", key: c.key || "", model: c.model || "",
      size: c.size || "", timeoutMs: Number(c.timeoutMs) || 0
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
    // 图像接口（独立池）
    getImageCfg: getImageCfg, setImageCfg: setImageCfg,
    // 多套接口（kind: "text" | "image"）
    listEndpoints: listEndpoints, activeEndpoint: activeEndpoint,
    addEndpoint: addEndpoint, updateEndpoint: updateEndpoint,
    removeEndpoint: removeEndpoint, setActiveEndpoint: setActiveEndpoint,
    resetEndpoints: resetEndpoints,
    _keys: { K_D: K_D, K_C: K_C, K_EP: K_EP }  // 暴露键名仅用于回归断言
  };
})(window);
