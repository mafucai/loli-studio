/* 后向兼容实测：老设计单（color 是单值、无 theme/prints/avoid）必须能渲染，不崩 */
const fs=require("fs"),vm=require("vm"),path=require("path");
const ROOT="/workspace/apps/loli-studio/prototype";
const read=f=>fs.readFileSync(path.join(ROOT,"js/core",f),"utf8");
const ctx=vm.createContext({window:{},console,Date,Math,JSON,encodeURIComponent,parseInt,isNaN,String,Number,Array,Object});
["router.js","ai.js","factory.js","store.js","render.js","render-extra.js"].forEach(f=>vm.runInContext(read(f),ctx,{filename:f}));
const {R,Router,Factory}=ctx.window;
const g=ctx; // render 内部按裸全局找 Router/Factory/AI，桩里要把它们暴露成裸全局
g.Router=Router; g.Factory=Factory; g.AI=ctx.window.AI; g.Store=ctx.window.Store;
ctx.window.Router=Router; ctx.window.Factory=Factory;
let pass=0,fail=0;
const ok=(n,c)=>{c?(pass++,console.log("  ✅ "+n)):(fail++,console.log("  ❌ "+n));};

console.log("— A. color 兼容 —");
ok('toColors("白紫") → ["白紫"]', JSON.stringify(Factory.toColors("白紫"))==='["白紫"]');
ok('toColors(["a","b"]) 不被拆散', JSON.stringify(Factory.toColors(["a","b"]))==='["a","b"]');
ok('toColors(null) → []', JSON.stringify(Factory.toColors(null))==='[]');
ok('R.colors("白紫") → ["白紫"]', JSON.stringify(R.colors("白紫"))==='["白紫"]');
ok('R.colors(["a"]) → ["a"]', JSON.stringify(R.colors(["a"]))==='["a"]');

console.log("— B. 老设计单（单值 color，无新字段）可渲染 —");
const legacy={id:"d1",step:"word",prompt:"老单",
  words:{prompt:"老单",style:"甜系",season:"春夏薄款",mainFabric:"雪纺",color:"白紫",
    details:["蝴蝶结收腰"],decors:["蕾丝"],sizes:["5码"],mood:""},
  bom:null,check:null,sourcing:null,combo:null,model:null,factories:null,finance:null};
let html="";
try { html=R.vWord(legacy); ok("vWord 渲染老数据不崩", true); }
catch(e){ ok("vWord 渲染老数据不崩 ["+e.message+"]", false); }
ok("老数据主色显示为「白紫」", html.indexOf("白紫")>=0);
try { const h2=R.vPlan(legacy); ok("vPlan 渲染老数据（无 theme/prints）不崩", h2.indexOf("先选一个主题风格")>=0); }
catch(e){ ok("vPlan 渲染老数据不崩 ["+e.message+"]", false); }
ok("老数据 avoid 缺省不报错", html.indexOf("避免词")>=0);

console.log("— C. 柄图进 prompt —");
const built=ctx.window.AI.buildWordPrompt({theme:"哥特",prints:"月相星轨",avoid:["蕾丝","亮片"],prompt:"暗色长裙"});
ok("system 含主题", built.system.indexOf("哥特")>=0);
ok("system 含避免词", built.system.indexOf("蕾丝")>=0 && built.system.indexOf("亮片")>=0);
ok("user 含柄图", built.user.indexOf("月相星轨")>=0);
ok("user 含需求", built.user.indexOf("暗色长裙")>=0);
const b2=ctx.window.AI.buildWordPrompt({prompt:"只有需求"});
ok("无主题无避免词时不塞垃圾", b2.system.indexOf("必须")>=0 && b2.user==="需求：只有需求");

console.log("— D. 柄图候选 —");
const cands=Factory.printCandidates("和风");
ok("6 个候选", cands.length===6);
ok("候选是本地 SVG", cands.every(c=>c.uri.indexOf("data:image/svg+xml")===0));
ok("same seed 同结果", JSON.stringify(Factory.printCandidates("和风"))===JSON.stringify(cands));
ok("printDesc 取到名字", Factory.printDesc({theme:"和风",picks:["p2"]})==="藤蔓蕾丝");
ok("printDesc 空 picks → 空串", Factory.printDesc({theme:"和风",picks:[]})==="");

console.log("— E. Router 相邻步 —");
ok("plan 无上一步", Router.prevId("plan")==="");
ok("plan 的下一步是 word", Router.nextId("plan")==="word");
ok("img 的下一步是 vote", Router.nextId("img")==="vote");
ok("vote 的下一步是 part", Router.nextId("vote")==="part");
ok("cost 无下一步", Router.nextId("cost")==="");
ok("STEPS 11 步", Router.STEPS.length===11);


console.log("— F. 脏 prompt 检测（color 数组化后最容易出的错）—");
// 多色设计单：所有拼给 AI 的文本都不许出现 "undefined" 或逗号串
const multi={prompt:"双色裙",style:"甜系",season:"春夏薄款",mainFabric:"雪纺",
  color:["雾霾蓝","奶油白"],details:["蝴蝶结收腰"],decors:["蕾丝"],sizes:["5码"],mood:""};
const dirtyDesc=[
  "洛丽塔服装平铺图，"+Factory.toColors(multi.color).join("、")+"，"+multi.style+"，"+multi.mainFabric,
  [ "洛丽塔", multi.style ].concat(Factory.toColors(multi.color)).concat([multi.mainFabric]).join(" ")
].join("\n");
ok("出图/搜索词无 undefined", dirtyDesc.indexOf("undefined")<0);
ok("出图/搜索词无逗号串（应为顿号）", dirtyDesc.indexOf("雾霾蓝,奶油白")<0);
ok("多色以顿号出现", dirtyDesc.indexOf("雾霾蓝、奶油白")>=0);
ok("designWords 的 color 是数组", Array.isArray(Factory.designWords("x").color));
ok("bom 用数组 color 不崩", !!Factory.bom(multi).rows.length);
ok("dedup 多色关键词无逗号串", Factory.dedup(multi).keyword.indexOf(",")<0);
ok("combo 多色不崩", Factory.combo(Factory.bom(multi)).uri.indexOf("data:image/svg+xml")===0);
ok("printDesc 正常", Factory.printDesc({theme:"甜系",picks:["p1"]})==="缎带格纹");

console.log("— G. 企划字段缺省安全 —");
ok("无 theme 时 vPlan 提示先选主题", R.vPlan({}).indexOf("先选一个主题风格")>=0);
ok("有 theme 无 prints 时提示", R.vPlan({theme:"哥特"}).indexOf("柄图是出图的输入")>=0);

console.log("\n结果：✅ "+pass+"  ❌ "+fail);
process.exit(fail?1:0);
