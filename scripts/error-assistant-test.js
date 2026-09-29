/* 报错助手实测：注入错误 → 看角标/面板是否真的更新（走 main.js 真实代码路径） */
const fs=require("fs"),vm=require("vm"),path=require("path");
const ROOT="/workspace/apps/loli-studio/prototype";
const read=f=>fs.readFileSync(path.join(ROOT,"js/core",f),"utf8");

function el(id){return{
  id,value:"",_text:"",_html:"",_cls:"",_attrs:{},children:[],
  style:{display:"",cssText:"",width:""},tagName:"DIV",
  get textContent(){return this._text;},set textContent(v){this._text=String(v);},
  get innerHTML(){return this._html;},set innerHTML(v){this._html=String(v);},
  get className(){return this._cls;},set className(v){this._cls=String(v);},
  classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},
    toggle(c,on){on===undefined?(this._s.has(c)?this._s.delete(c):this._s.add(c)):(on?this._s.add(c):this._s.delete(c));},
    contains(c){return this._s.has(c);}},
  _h:{},addEventListener(t,f){(this._h[t]=this._h[t]||[]).push(f);},
  removeEventListener(){},appendChild(c){this.children.push(c);return c;},remove(){},
  querySelector(){return null;},querySelectorAll(){return [];},
  getAttribute(k){return this._attrs[k]??null;},setAttribute(k,v){this._attrs[k]=v;},
  fire(t,ev){(this._h[t]||[]).forEach(f=>f(ev||{preventDefault(){}}));},
  select(){},dispatchEvent(){},closest(){return null;}
};}
const ids=["view","title","badge-mock","progress-fill","steps","sheet","toast",
 "errdot","errpanel","errsum","errbody","errfoot","errcopy","errclear","errclose",
 "btn-history","form-text","form-image","ep-list-text","ep-list-image",
 "ep-empty-text","ep-empty-image","ep-editor-text","ep-editor-image",
 "model-panel-text","model-panel-image","in-t-name","in-t-base","in-t-key","in-t-model",
 "in-i-name","in-i-base","in-i-key","in-i-model","in-i-size","in-i-timeout","in-prompt","in-avoid"];
const els={};ids.forEach(i=>els[i]=el(i));
const winH={};
const document={readyState:"complete",body:el("body"),
  getElementById:i=>els[i]||null,createElement:t=>el("new-"+t),
  addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const localStorage={_s:{},getItem(k){return k in this._s?this._s[k]:null;},
  setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const window={document,localStorage,addEventListener:(t,f)=>(winH[t]=winH[t]||[]).push(f),
  removeEventListener(){},navigator:{},fetch:()=>Promise.reject(new Error("no-net")),
  confirm:()=>true,alert(){},setTimeout:setTimeout,clearTimeout:clearTimeout};
window.window=window;
const ctx={window,document,localStorage,console,setTimeout,clearTimeout,Date,JSON,String,Number,Array,Object,Math,isFinite,Error,Promise,confirm:()=>true,fetch:window.fetch,encodeURIComponent,decodeURIComponent,parseInt,parseFloat,isNaN};
ctx.globalThis=ctx;ctx.self=ctx;
["Router","Store","R","AI","Actions","Factory","Settings"].forEach(k=>Object.defineProperty(ctx,k,{get:()=>window[k],configurable:true}));
vm.createContext(ctx);
["router.js","ai.js","store.js","factory.js","render.js","render-extra.js","settings.js","actions.js","main.js"]
  .forEach(f=>vm.runInContext(read(f),ctx,{filename:f}));

let pass=0,fail=0;const ok=(n,c)=>{c?(pass++,console.log("  ✅ "+n)):(fail++,console.log("  ❌ "+n));};

console.log("— 1. 初始状态（无错误时也可见）—");
ok("角标显示 ✓", els.errdot.textContent==="✓");
ok("角标 class=errdot ok", els.errdot.className==="errdot ok");
ok("摘要显示「就绪 · 已捕获 0 条」", els.errsum.textContent==="就绪 · 已捕获 0 条");
ok("面板正文有「暂未捕获到错误」", els.errbody.innerHTML.indexOf("暂未捕获到错误")>=0);

console.log("— 2. 注入 JS 错误（error 事件，走真实监听器）—");
winH.error[0]({message:"probe-js-err",lineno:42,filename:"app.js"});
ok("角标变 1", els.errdot.textContent==="1");
ok("角标 class=errdot bad", els.errdot.className==="errdot bad");
ok("摘要显示「已捕获 1 条」", els.errsum.textContent==="已捕获 1 条");
ok("面板显示错误原文", els.errbody.innerHTML.indexOf("probe-js-err")>=0);
ok("面板显示位置 app.js:42", els.errbody.innerHTML.indexOf("app.js:42")>=0);

console.log("— 3. 3 秒内同错去重 —");
winH.error[0]({message:"probe-js-err",lineno:42,filename:"app.js"});
ok("重复同错不加计数（仍是 1）", els.errdot.textContent==="1");

console.log("— 4. 注入异步错误（unhandledrejection）—");
winH.unhandledrejection[0]({reason:new Error("probe-reject")});
ok("角标变 2", els.errdot.textContent==="2");
ok("面板显示异步错误", els.errbody.innerHTML.indexOf("probe-reject")>=0);

console.log("— 5. 资源加载失败（capture 阶段，IMG）—");
const fakeImg={tagName:"IMG",src:"https://x/y.png",href:""};
winH.error[0]({target:fakeImg});
ok("角标变 3", els.errdot.textContent==="3");
ok("面板识别为资源加载失败", els.errbody.innerHTML.indexOf("资源加载失败")>=0&&els.errbody.innerHTML.indexOf("y.png")>=0);

console.log("— 6. 原生桥回显通道 __nativeError —");
ok("window.__nativeError 已挂载", typeof window.__nativeError==="function");
window.__nativeError("native-side-crash");
ok("角标变 4", els.errdot.textContent==="4");
ok("面板标注来源 native", els.errbody.innerHTML.indexOf('class="src native"')>=0);
ok("面板显示 native 原文", els.errbody.innerHTML.indexOf("native-side-crash")>=0);

console.log("— 7. 面板开关 / 清空 —");
els.errdot.fire("click",{});
ok("点击角标 → 面板 open", els.errpanel.classList.contains("open"));
els.errdot.fire("click",{});
ok("再点 → 面板关闭", !els.errpanel.classList.contains("open"));
els.errclear.fire("click",{});
ok("清空后角标回到 ✓", els.errdot.textContent==="✓");
ok("清空后摘要回「就绪 · 已捕获 0 条」", els.errsum.textContent==="就绪 · 已捕获 0 条");

console.log("— 8. 上限 50 条（不无限涨）—");
for(let i=0;i<60;i++) window.__nativeError("err-"+i+"-"+Math.random());
ok("角标计数 ≤50", Number(els.errdot.textContent)<=50);
ok("角标确实是 50", Number(els.errdot.textContent)===50);

console.log("— 9. Actions.report 仍往页面写红框 —");
const Actions=window.Actions;
const box=el("error-box");document.getElementById=i=>i==="error-box"?box:(els[i]||null);
Actions.report("report-通道测试");
ok("红框显示错误", box.textContent.indexOf("report-通道测试")>=0);

console.log("— 10. 原生桥 logError 会被调用（若存在）—");
let logged=[];
window.NativeErrorBridge={logError:m=>logged.push(String(m)),
  fetchImageAsDataUri(){}};
winH.error[0]({message:"bridge-probe",lineno:1});
ok("logError 收到消息", logged.some(x=>x.indexOf("bridge-probe")>=0));

console.log("\n结果：✅ "+pass+"  ❌ "+fail);
process.exit(fail?1:0);
