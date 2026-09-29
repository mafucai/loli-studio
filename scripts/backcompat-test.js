/* 后向兼容实测：老设计单（color 是单值、无 theme/prints/avoid）必须能渲染，不崩 */
const fs=require("fs"),vm=require("vm"),path=require("path");
const ROOT = path.join(__dirname, "..", "prototype");
const read=f=>fs.readFileSync(path.join(ROOT,"js/core",f),"utf8");
const ctx=vm.createContext({window:{},console,Date,Math,JSON,encodeURIComponent,parseInt,isNaN,String,Number,Array,Object});
["router.js","ai.js","factory.js","order-model.js","board-model.js","store.js","render.js","render-extra.js","render-flux.js","render-board.js"].forEach(f=>vm.runInContext(read(f),ctx,{filename:f}));
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
ok("pre 有下一步 board", Router.nextId("pre")==="board");
ok("board 无下一步", Router.nextId("board")==="");
ok("STEPS 不少于 13 步", Router.STEPS.length>=13 && Router.STEPS.length===Router.STEPS.filter(function(s){return !!s.id;}).length);


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


console.log("— J. 成团判定 / 流团退款（批 E2）—");
const PRE2={batches:[{no:1,color:"白紫",target:10},{no:1,color:"黑黑",target:10}],nextAnon:1,deadline:"2099-12-31"};
const ORD2=[
 {anonId:"D-0001",color:"白紫",batchNo:1,qty:10,amount:900,state:"已付定金"},
 {anonId:"D-0002",color:"黑黑",batchNo:1,qty:3,amount:270,state:"已付定金"}
];
const JD2=OrderModel.judgePre(PRE2,ORD2);
ok("部分成团 → designState 已成团", JD2.designState==="已成团");
ok("partial 标记为真", JD2.partial===true);
ok("够线色 = 白紫", JD2.enough.length===1 && JD2.enough[0].color==="白紫");
ok("流团色 = 黑黑", JD2.failed.length===1 && JD2.failed[0].color==="黑黑");
ok("只退流团色的定金", JSON.stringify(JD2.refundable)===JSON.stringify(["D-0002"]));

// 全部不够 → 已流团，全退
const JD3=OrderModel.judgePre(PRE2,[{anonId:"D-1",color:"黑黑",batchNo:1,qty:1,amount:90,state:"已付定金"}]);
ok("全部不够 → 已流团", JD3.designState==="已流团");
ok("全部流团时全退", JD3.refundable.length===1);
ok("全部够 → 非 partial", OrderModel.judgePre(PRE2,[{anonId:"D-1",color:"白紫",batchNo:1,qty:10,amount:900,state:"已付定金"},{anonId:"D-2",color:"黑黑",batchNo:1,qty:10,amount:900,state:"已付定金"}]).partial===false);

// 不占成团名额：定金逾期/已退款/完结 的状态不计
["定金逾期","已退款"].forEach(function (st) {
  const j=OrderModel.judgePre(PRE2,[{anonId:"D-9",color:"白紫",batchNo:1,qty:10,amount:900,state:st}]);
  ok(st+" 不计入成团 → 白紫仍流团", j.enough.length===0);
});
ok("待尾款/已付尾款 仍计入成团", OrderModel.judgePre(PRE2,[{anonId:"D-9",color:"白紫",batchNo:1,qty:10,amount:900,state:"已付尾款"}]).enough.length===1);

// 退款清单
const RFL=OrderModel.buildRefundList(PRE2,ORD2,JD2);
ok("清单只含应退单", RFL.count===1 && RFL.rows[0].anonId==="D-0002");
ok("应退金额 = 该单定金", RFL.total===270);
ok("清单不含身份字段", RFL.rows.every(r=>!("name" in r)&&!("phone" in r)&&!("address" in r)));

// 到期判断
ok("过期日期 isDue=true", OrderModel.isDue("2020-01-01"));
ok("未来日期 isDue=false", !OrderModel.isDue("2099-01-01"));
ok("空 deadline 不自动判", !OrderModel.isDue(""));
ok("非法日期不崩", !OrderModel.isDue("乱码"));

// 款状态机
ok("预售中→已成团 合法", OrderModel.canTransitDesign("预售中","已成团"));
ok("预售中→已流团 合法", OrderModel.canTransitDesign("预售中","已流团"));
ok("预售中→生产中 非法", !OrderModel.canTransitDesign("预售中","生产中"));
ok("已流团→改款重开 合法（闭环 §十一）", OrderModel.canTransitDesign("已流团","改款重开"));
ok("未开团判定被拒", !!OrderModel.judgePre(null,[]).__error);

// 老设计单（无 judge/pre/orders）渲染不崩
try { const h=R.vPre({id:"x",step:"pre",final:FIN,pre:PRE,orders:[]}); ok("vPre 无判定期不崩", h.indexOf("成团判定")>=0); }
catch(e){ ok("vPre 无判定期不崩 ["+e.message+"]", false); }
try { const h2=R.vPre({id:"x",step:"pre",final:FIN,pre:PRE,orders:MADE.orders,judge:JD2,refundList:RFL});
  ok("vPre 有判定+清单可渲染", h2.indexOf("判定结果")>=0 && h2.indexOf("流团退款清单")>=0 && h2.indexOf("D-0002")>=0); }
catch(e){ ok("vPre 有判定+清单可渲染 ["+e.message+"]", false); }

console.log("\n— K. 批 E3：尾款 / 发货 / 售后 / 看板 —");
const BM=ctx.window.BoardModel;
if(ctx.window.RenderBoard&&!R.vBoard) R.vBoard=ctx.window.RenderBoard.vBoard;
ok("BoardModel 已加载", !!BM);
// 状态机：尾款逾期
ok("待尾款→尾款逾期 合法", OrderModel.canTransit("待尾款","尾款逾期"));
ok("尾款逾期→已付尾款 合法（可补付）", OrderModel.canTransit("尾款逾期","已付尾款"));
ok("尾款逾期→待发货 非法（必须先补尾款）", !OrderModel.canTransit("尾款逾期","待发货"));
ok("已付尾款→待发货 合法", OrderModel.canTransit("已付尾款","待发货"));
ok("待发货→已发货 合法", OrderModel.canTransit("待发货","已发货"));
ok("已发货→售后 合法", OrderModel.canTransit("已发货","售后"));

// transit 实测
const L3=[{anonId:"D-0001",color:"白紫",batchNo:1,qty:10,amount:900,state:"待尾款"},
          {anonId:"D-0002",color:"绿",batchNo:1,qty:5,amount:450,state:"待尾款"}];
const tr=OrderModel.transit(L3,"D-0001","尾款逾期","超期","系统");
ok("transit 成功", !tr.__error && tr.from==="待尾款" && tr.to==="尾款逾期");
ok("transit 留痕 events", tr.orders[0].events && tr.orders[0].events.length===1 && tr.orders[0].events[0].why==="超期");
ok("transit 不改原数组", L3[0].state==="待尾款");
const bad=OrderModel.transit(L3,"D-0001","已发货","跳步","商家");
ok("非法流转被拒", !!bad.__error && bad.__error.indexOf("不能直接到")>=0);
ok("找不到订单被拒", !!OrderModel.transit(L3,"D-9999","尾款逾期","x","商家").__error);
ok("同状态被拒", !!OrderModel.transit(L3,"D-0001","待尾款","x","商家").__error);

// transitMany
const tm=OrderModel.transitMany(L3,["D-0001","D-0002"],"已付尾款","补尾款","商家");
ok("transitMany 全成功", tm.done.length===2 && tm.failed.length===0);
ok("transitMany 带 paidTailAt", !!tm.orders[0].paidTailAt);

// 催款清单（§五：只出清单，不自动发）
const dun=OrderModel.buildTailDunning(L3,["D-0001"]);
ok("催款清单只含指定单", dun.count===1 && dun.rows[0].anonId==="D-0001");
ok("催款清单不含身份字段", dun.rows.every(r=>!("name" in r)&&!("phone" in r)&&!("address" in r)));

// 真单号权限（§一）
const L4=[{anonId:"D-0001",color:"绿",batchNo:1,qty:5,amount:450,state:"待发货",realNo:""}];
ok("发货可写单号", !OrderModel.setRealNo(L4,"D-0001","SF123","发货").__error);
ok("对账可写单号", !OrderModel.setRealNo(L4,"D-0001","SF123","对账").__error);
ok("退款可写单号", !OrderModel.setRealNo(L4,"D-0001","SF123","退款").__error);
ok("其他动作写单号被拒（§一）", !!OrderModel.setRealNo(L4,"D-0001","SF123","看板").__error);
ok("待定金状态不能录单号", !!OrderModel.setRealNo([{anonId:"D-1",state:"待定金"}],"D-1","x","发货").__error);

// 售后登记
const L5=[{anonId:"D-0001",color:"绿",batchNo:1,qty:5,amount:450,state:"已发货"}];
const as=OrderModel.recordAfterSale(L5,"D-0001","尺码不合","偏小");
ok("售后登记成功", !as.__error && as.orders[0].state==="售后");
ok("售后留痕原因", as.orders[0].afterSale[0].reason==="尺码不合");
ok("未知售后原因被拒", !!OrderModel.recordAfterSale(L5,"D-0001","瞎写","x").__error);
ok("售后原因枚举 ≥10 项", OrderModel.AFTER_SALE_REASONS.length>=10);
const st=OrderModel.afterSaleStats(as.orders);
ok("售后分布统计", st.total===1 && st.rows[0].reason==="尺码不合" && st.rows[0].pct===1);

// 看板：成团率按 颜色×批次
const PRE3={batches:[{color:"白紫",no:1,target:1000},{color:"绿",no:1,target:1000}]};
const ORD3=[{anonId:"D-1",color:"白紫",batchNo:1,qty:1000,amount:90000,state:"已付定金"},
            {anonId:"D-2",color:"绿",batchNo:1,qty:300,amount:27000,state:"已付定金"}];
const gr=BM.groupRateRows(PRE3,ORD3);
ok("成团率逐行 2 行", gr.length===2);
ok("够线行 enough=true", gr.filter(r=>r.color==="白紫")[0].enough===true);
ok("不够线行 enough=false", gr.filter(r=>r.color==="绿")[0].enough===false);
ok("不够线触发「低于」", gr.filter(r=>r.color==="绿")[0].trigger==="低于");
ok("不够线动作含流团", gr.filter(r=>r.color==="绿")[0].action.indexOf("流团")>=0);

// UV 未录 → 待录，不触发
const c0=BM.depositCVR(100,null);
ok("UV 未录 display=待录", c0.display==="待录");
ok("UV 未录 level=none", c0.level==="none");
ok("UV 未录 cvr=null", c0.cvr===null);
ok("UV 未录 trigger 不触发", c0.trigger==="—");
const c1=BM.depositCVR(100,10000);   // 1%
ok("UV 1% → ok", c1.level==="ok");
const c2=BM.depositCVR(50,10000);    // 0.5%
ok("UV 0.5% → warn", c2.level==="warn");
const c3=BM.depositCVR(20,10000);    // 0.2%
ok("UV 0.2% → bad", c3.level==="bad");
ok("bad 触发「低于」", c3.trigger==="低于");
ok("bad 动作含暂停推广", c3.action.indexOf("暂停推广")>=0);

// 退款率（高于触发）
const now=new Date().toISOString();
const ORD4=[];
for(let i=0;i<100;i++) ORD4.push({anonId:"P-"+i,state:i<10?"已退款":"已付定金",paidAt:now});
const rr=BM.refundRate(ORD4,now,30);
ok("退款率 10/100=10%", Math.abs(rr.rate-0.1)<1e-9);
ok("10% → ok（<15%）", rr.level==="ok");
ok("退款率触发方向=高于", BM.refundRate(ORD4.map((o,i)=>({anonId:o.anonId,state:i<20?"已退款":"已付定金",paidAt:now})),now,30).trigger==="高于");
ok("20% → warn", BM.refundRate(ORD4.map((o,i)=>({anonId:o.anonId,state:i<20?"已退款":"已付定金",paidAt:now})),now,30).level==="warn");
ok("30% → bad", BM.refundRate(ORD4.map((o,i)=>({anonId:o.anonId,state:i<30?"已退款":"已付定金",paidAt:now})),now,30).level==="bad");
ok("无样本不瞎判", BM.refundRate([],now,30).level==="none");

// 看板汇总
const bd=BM.buildBoard(PRE3,ORD3,{uv:10000});
ok("buildBoard 含四块", !!bd.group && !!bd.cvr && !!bd.refund && !!bd.afterSale);
ok("buildBoard 不改动订单", ORD3[0].state==="已付定金");

// vBoard 渲染
try { const h=R.vBoard({id:"x",step:"board",pre:PRE3,orders:ORD3,uv:10000});
  ok("vBoard 渲染不崩", h.indexOf("成团率")>=0 && h.indexOf("定金转化率")>=0 && h.indexOf("退款率")>=0); }
catch(e){ ok("vBoard 渲染不崩 ["+e.message+"]", false); }
try { const h2=R.vBoard({id:"x",step:"board"});
  ok("vBoard 无数据不崩（显示待录）", h2.indexOf("待录")>=0 || h2.indexOf("还没有可统计")>=0); }
catch(e){ ok("vBoard 无数据不崩 ["+e.message+"]", false); }

// 履约区块渲染
try { const h3=R.vPre({id:"x",step:"pre",final:FIN,pre:PRE3,orders:ORD3});
  ok("vPre 含尾款/发货/售后区块", h3.indexOf("补尾款")>=0 && h3.indexOf("发货")>=0 && h3.indexOf("售后登记")>=0); }
catch(e){ ok("vPre 含履约区块 ["+e.message+"]", false); }

// ===== L 组：批 E4 大货款状态全链路（实测）=====
const OM_L = OrderModel;
ok("已成团→生产中 合法（大货）", OM_L.canTransitDesign("已成团", "生产中"));
ok("生产中→已发货 合法", OM_L.canTransitDesign("生产中", "已发货"));
ok("已发货→售后中 合法", OM_L.canTransitDesign("已发货", "售后中"));
ok("售后中→完结 合法", OM_L.canTransitDesign("售后中", "完结"));
ok("已成团→已发货 非法（不可跳步）", !OM_L.canTransitDesign("已成团", "已发货"));
ok("已流团→改款重开 合法（闭环）", OM_L.canTransitDesign("已流团", "改款重开"));
ok("已发货→改款重开 非法（未售后不能重开）", !OM_L.canTransitDesign("已发货", "改款重开"));

// 款状态机与订单状态机是两套（文档 §二/§三），同名不同义
ok("DESIGN 有「售后中」", OM_L.DESIGN_STATES.indexOf("售后中") >= 0);
ok("ORDER 有「售后」（无「中」）", OM_L.ORDER_STATES.indexOf("售后") >= 0 && OM_L.ORDER_STATES.indexOf("售后中") < 0);
ok("两套状态机互不干扰（同名不混用）", (function () {
  // 真正要防的：把订单状态的「售后」写进款状态机，或反之（文档 §二/§三 要求分开）
  // 合法重名只有这 2 个（语义在两层里一致，不构成混淆）：
  //   已发货 —— 订单发出 = 款进入发货期
  //   完结   —— 两层各自的终态
  var LEGAL_OVERLAP = ["已发货", "完结"];
  var overlap = OM_L.DESIGN_STATES.filter(function (s) { return OM_L.ORDER_STATES.indexOf(s) >= 0; });
  var same = overlap.length === LEGAL_OVERLAP.length &&
             overlap.every(function (s) { return LEGAL_OVERLAP.indexOf(s) >= 0; });
  return same;
})());
ok("「售后中」只在款状态机（订单侧叫「售后」，不混用）",
  OM_L.DESIGN_STATES.indexOf("售后中") >= 0 && OM_L.ORDER_STATES.indexOf("售后中") < 0);

// 大货区块渲染
try {
  const h = R.vPre({ id: "x", step: "pre", final: FIN, pre: PRE3, orders: ORD3, designState: "已成团" });
  ok("预售页含大货区块", h.indexOf("大货生产") >= 0 && h.indexOf("design-next") >= 0);
} catch (e) { ok("预售页含大货区块 [" + e.message + "]", false); }
try {
  const h2 = R.vPre({ id: "x", step: "pre", final: FIN, pre: PRE3, orders: ORD3, designState: "完结" });
  ok("终态款状态不报错且无推进按钮", h2.indexOf("大货生产") >= 0 && h2.indexOf("已是终态") >= 0);
} catch (e) { ok("终态款状态渲染 [" + e.message + "]", false); }

console.log("\n结果：✅ "+pass+"  ❌ "+fail);
process.exit(fail?1:0);
