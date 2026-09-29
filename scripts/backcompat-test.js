/* 后向兼容实测：老设计单（color 是单值、无 theme/prints/avoid）必须能渲染，不崩 */
const fs=require("fs"),vm=require("vm"),path=require("path");
const ROOT = path.join(__dirname, "..", "prototype");
const read=f=>fs.readFileSync(path.join(ROOT,"js/core",f),"utf8");
const ctx=vm.createContext({window:{},console,Date,Math,JSON,encodeURIComponent,parseInt,isNaN,String,Number,Array,Object});
["router.js","ai.js","factory.js","order-model.js","store.js","render.js","render-extra.js"].forEach(f=>vm.runInContext(read(f),ctx,{filename:f}));
const {R,Router,Factory,OrderModel}=ctx.window;
ctx.OrderModel=OrderModel; ctx.window.OrderModel=OrderModel;
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
ok("cost 的下一步是 final", Router.nextId("cost")==="final");
ok("final 的下一步是 pre", Router.nextId("final")==="pre");
ok("pre 无下一步", Router.nextId("pre")==="");
ok("STEPS 13 步", Router.STEPS.length===13);


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


console.log("— H. 定样定价（批 D）—");
ok("buildSkus 默认 1000", JSON.stringify(Factory.buildSkus(["a","b"]))==='[{"color":"a","target":1000},{"color":"b","target":1000}]');
ok("buildSkus 沿用已改值", Factory.buildSkus(["a","b"],[{color:"a",target:500}])[0].target===500);
ok("buildSkus 未列颜色→默认", Factory.buildSkus(["a","b"],[{color:"a",target:500}])[1].target===1000);
ok("buildSkus 空颜色→空数组", Factory.buildSkus([]).length===0);
const F1=Factory.financeFinal({price:899,cost:265,depositRate:20,leadDays:45,skus:[{color:"a",target:1000},{color:"b",target:800}],fixed:5000});
ok("定金=价×比例", F1.deposit===Math.round(899*0.2));
ok("尾款=价-定金", F1.balance===899-F1.deposit);
ok("总目标=各色之和", F1.totalTarget===1800);
ok("单件毛利=价-成本", F1.unitMargin===899-265);
ok("保本件数=固定成本/毛利向上取整", F1.breakEven===Math.ceil(5000/634));
ok("满额利润=毛利×总目标", F1.fullProfit===634*1800);
ok("价≤0 被拒", !!Factory.financeFinal({price:0,cost:1,depositRate:20,leadDays:45,skus:[{color:"a",target:1}]}).__error);
ok("无颜色被拒", !!Factory.financeFinal({price:9,cost:1,depositRate:20,leadDays:45,skus:[]}).__error);
ok("目标件数≤0 被拒", !!Factory.financeFinal({price:9,cost:1,depositRate:20,leadDays:45,skus:[{color:"a",target:0}]}).__error);
ok("工期≤0 被拒", !!Factory.financeFinal({price:9,cost:1,depositRate:20,leadDays:0,skus:[{color:"a",target:1}]}).__error);
ok("定金比例>100 被拒", !!Factory.financeFinal({price:9,cost:1,depositRate:101,leadDays:5,skus:[{color:"a",target:1}]}).__error);
ok("价低于成本→保本件数为 -1", Factory.financeFinal({price:100,cost:200,depositRate:20,leadDays:5,skus:[{color:"a",target:1}],fixed:100}).breakEven===-1);
// 老设计单（无 final 字段）渲染定样页不崩
let hFinal="";
try { hFinal=R.vFinal({id:"x",step:"final",words:{color:["a"]},finance:null}); ok("vFinal 无 finance 不崩", hFinal.indexOf("先在第 10 步")>=0); }
catch(e){ ok("vFinal 无 finance 不崩 ["+e.message+"]", false); }
try { const h2=R.vFinal({id:"x",step:"final",words:{color:["白紫"]},finance:{cost:265,price:899,fixed:5000}}); ok("vFinal 有 finance 可渲染", h2.indexOf("公布价")>=0 && h2.indexOf("白紫")>=0); }
catch(e){ ok("vFinal 有 finance 可渲染 ["+e.message+"]", false); }


console.log("— I. 预售开团 / 订单模型（批 E1）—");
const FIN={price:899,cost:265,deposit:Math.round(899*0.2),balance:899-Math.round(899*0.2),
  leadDays:45,deadline:"2026-11-30",skus:[{color:"白紫",target:1000},{color:"黑黑",target:800}]};
const PRE=OrderModel.openPre(FIN,null);
ok("开团按颜色建批次", PRE.batches.length===2);
ok("批次取定样目标数", PRE.batches[0].target===1000 && PRE.batches[1].target===800);
ok("重复开团不重复建批次", OrderModel.openPre(FIN,PRE).batches.length===2);
ok("无定样→开团被拒", !!OrderModel.openPre(null,null).__error);
ok("无颜色→开团被拒", !!OrderModel.openPre({price:1,skus:[]},null).__error);

const P1=OrderModel.parseOrderLines("白紫,3,540\n黑黑,2,360", PRE);
ok("批量解析两行", P1.rows.length===2 && P1.errors.length===0);
ok("解析带批次号", P1.rows[0].batchNo===1);
const P2=OrderModel.parseOrderLines("白紫,3,540\n乱色,1,9\n白紫,x,1\n只有两列", PRE);
ok("未知颜色被拒", P2.errors.some(e=>e.reason.indexOf("不在本次开团")>=0));
ok("非法数量被拒", P2.errors.some(e=>e.reason.indexOf("数量")>=0));
ok("列数不足被拒", P2.errors.some(e=>e.reason.indexOf("三列")>=0));
ok("错误不影响合法行", P2.rows.length===1);
ok("顿号也能分隔", OrderModel.parseOrderLines("白紫、3、540", PRE).rows.length===1);
ok("空行被忽略", OrderModel.parseOrderLines("\n\n", PRE).rows.length===0);

const MADE=OrderModel.makeOrders(PRE,P1.rows);
ok("匿名ID从 D-0001 起", MADE.orders[0].anonId==="D-0001");
ok("匿名ID递增", MADE.orders[1].anonId==="D-0002");
ok("nextAnon 前进", MADE.nextAnon===3);
ok("定金录入即已付定金", MADE.orders.every(o=>o.state==="已付定金"));
ok("realNo 默认空", MADE.orders.every(o=>o.realNo===""));
ok("订单无身份字段", MADE.orders.every(o=>!("name" in o)&&!("phone" in o)&&!("address" in o)));
ok("ID 补零", OrderModel.nextAnonId(7)==="D-0007");

ok("状态机 已付定金→待尾款", OrderModel.canTransit("已付定金","待尾款"));
ok("状态机 待尾款→已付尾款", OrderModel.canTransit("待尾款","已付尾款"));
ok("状态机 已付定金→已发货 非法", !OrderModel.canTransit("已付定金","已发货"));
ok("状态机 完结 无后继", OrderModel.ORDER_FLOW["完结"].length===0);
ok("真单号限三动作", OrderModel.REALNO_ACTS.join("/")==="发货/退款/对账");

const T=OrderModel.tallyByBatch(PRE,MADE.orders);
ok("统计按 颜色×批次 出行", T.length===2);
ok("白紫已成团 3", T[0].got===3);
ok("未达成团线", T[0].enough===false);
ok("成团率 = 实际/目标", Math.abs(T[0].rate-3/1000)<1e-9);
const refunded=Object.assign({},MADE.orders[0],{state:"已退款"});
ok("已退款不计入成团", OrderModel.tallyByBatch(PRE,[refunded])[0].got===0);
const overdue=Object.assign({},MADE.orders[0],{state:"定金逾期"});
ok("定金逾期不计入成团", OrderModel.tallyByBatch(PRE,[overdue])[0].got===0);

let hPre="";
try { hPre=R.vPre({id:"x",step:"pre",final:null,orders:[]}); ok("vPre 无定样不崩", hPre.indexOf("先在第 11 步")>=0); }
catch(e){ ok("vPre 无定样不崩 ["+e.message+"]", false); }
try { const h=R.vPre({id:"x",step:"pre",final:FIN,pre:PRE,orders:MADE.orders}); ok("vPre 有数据可渲染", h.indexOf("D-0001")>=0 && h.indexOf("成团进度")>=0); }
catch(e){ ok("vPre 有数据可渲染 ["+e.message+"]", false); }

console.log("\n结果：✅ "+pass+"  ❌ "+fail);
process.exit(fail?1:0);
