/* 无 jsdom 的点击验证：手写极简 DOM，真实加载 render/actions 并模拟事件 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = "/workspace/apps/loli-studio/prototype";
const read = (f) => fs.readFileSync(path.join(ROOT, "js/core", f), "utf8");

/* —— 极简 DOM —— */
function makeEl(tag) {
  const el = {
    tag,
    children: [],
    attrs: {},
    _text: "",
    classes: new Set(),
    listeners: {},
    style: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    dispatch(type, target) {
      const ev = { type, target: target || this, bubbles: true, preventDefault() {} };
      (this.listeners[type] || []).forEach((fn) => fn(ev));
    },
    get classList() {
      const self = this;
      return {
        add: (c) => self.classes.add(c),
        remove: (c) => self.classes.delete(c),
        contains: (c) => self.classes.has(c),
        toggle: (c, on) => (on ? self.classes.add(c) : self.classes.delete(c))
      };
    },
    set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get className() { return [...this.classes].join(" "); },
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() {
      return this._text + this.children.map((c) => c.textContent).join("");
    },
    set innerHTML(v) { this._html = String(v); this.children = parseHTML(String(v), this); },
    get innerHTML() { return this._html || ""; },
    querySelector(sel) { return this._find(sel, true); },
    querySelectorAll(sel) { return this._find(sel, false); },
    closest(sel) {
      let node = this;
      const want = sel.replace(/^\[|\]$/g, "").split("=")[0];
      while (node) {
        if (node.attrs && node.attrs[want] !== undefined) return node;
        node = node._parent;
      }
      return null;
    },
    _find(sel, one) {
      const out = [];
      const match = (el) => {
        if (sel.startsWith(".")) return el.classes.has(sel.slice(1));
        if (sel.startsWith("#")) return el.attrs.id === sel.slice(1);
        if (sel.startsWith("[")) {
          const key = sel.slice(1, -1).split("=")[0];
          return el.attrs[key] !== undefined;
        }
        return el.tag === sel;
      };
      const walk = (el) => {
        el.children.forEach((c) => {
          if (match(c)) out.push(c);
          walk(c);
        });
      };
      walk(this);
      return one ? out[0] || null : out;
    },
    appendChild(c) { c._parent = this; this.children.push(c); return c; },
    insertBefore(c) { return this.appendChild(c); }
  };
  return el;
}

/* 只解析本页用到的标签与属性 */
function parseHTML(html, parent) {
  const nodes = [];
  const re = /<(\w+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const el = makeEl(m[1].toLowerCase());
    const attrRe = /([\w:-]+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[2]))) el.attrs[a[1]] = a[2];
    if (el.attrs.class) el.className = el.attrs.class;
    el._parent = parent;
    nodes.push(el);
  }
  return nodes;
}

const document = {
  readyState: "complete",
  body: makeEl("body"),
  getElementById(id) {
    const all = [];
    const walk = (el) => { el.children.forEach((c) => { all.push(c); walk(c); }); };
    walk(this.body);
    return all.find((e) => e.attrs.id === id) || null;
  },
  createElement: (t) => makeEl(t),
  querySelector(sel) { return this.body._find(sel, true); },
  querySelectorAll(sel) { return this.body._find(sel, false); },
  addEventListener() {}
};

/* 页面骨架：与 index.html 一致的关键节点 */
["btn-history", "title", "badge-mock", "progress-fill", "view", "steps", "toast", "sheet", "form-settings", "in-base", "in-key", "in-model"].forEach((id) => {
  const el = makeEl("div");
  el.attrs.id = id;
  document.body.appendChild(el);
});

const store = {};
const window = {
  document,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  },
  addEventListener() {},
  setTimeout: (fn) => fn && 0,
  clearTimeout() {},
  Date, Math, JSON, console, encodeURIComponent, parseInt, isNaN,
  location: { href: "http://localhost/" }
};
window.window = window;

const ctx = vm.createContext(window);
/* 顺序与 index.html 一致 */
["router.js", "ai.js", "store.js", "factory.js", "render.js", "actions.js", "main.js"].forEach((f) => {
  vm.runInContext(read(f), ctx, { filename: f });
});

let pass = 0, fail = 0;
const check = (ok, msg) => { ok ? (pass++, console.log("  ✅ " + msg)) : (fail++, console.log("  ❌ " + msg)); };

const tabs = document.getElementById("steps").querySelectorAll(".tab");
check(tabs.length === 3, "底部三个页签，实际 " + tabs.length);
console.log("    页签：" + tabs.map((t) => t.textContent.trim()).join(" / "));

const title = () => document.getElementById("title").textContent.trim();

function clickTab(label) {
  const tab = document.getElementById("steps").querySelectorAll(".tab")
    .find((t) => t.textContent.includes(label));
  if (!tab) return { ok: false };
  tab.dispatchEvent("click", tab);
  return {
    ok: true,
    title: title(),
    menus: document.querySelectorAll(".menu-card").map((m) => m.querySelector("b").textContent)
  };
}

["设计", "制作", "经营"].forEach((label) => {
  const r = clickTab(label);
  check(r.ok, "点击「" + label + "」有响应，当前页：" + r.title);
  if (r.ok) check(r.menus.length === 3, "  「" + label + "」三个按钮：" + r.menus.join("、") + "（" + r.menus.length + "）");
});

/* 点第一个菜单进具体步骤 */
const first = document.querySelectorAll(".menu-card")[0];
if (first) {
  first.dispatchEvent("click", first);
  check(title().length > 0, "菜单可进入步骤：" + title());
}

console.log("\n结果：✅ " + pass + "  ❌ " + fail);
process.exit(fail === 0 ? 0 : 1);
