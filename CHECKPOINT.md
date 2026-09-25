# loli-studio 进度清单（防断点用）

每次断点后：先读这个文件，看「最后一批落盘到哪」，接着写下一批。

## 当前状态：**S0 完成，等主人手机浏览器验收**

## 验收链接
```
http://192.168.1.5:8765/index.html
```
（服务器已启动，`python3 -m http.server 8765 --bind 0.0.0.0`，工作目录 `/workspace/apps/loli-studio/prototype`）

## 已完成的文件（全部落盘）

| # | 文件 | 用途 | 状态 |
|---|---|---|---|
| 1 | .ai/state.json | 门禁（frontend_approved=false） | ✅ |
| 1 | CHECKPOINT.md | 本文件 | ✅ |
| 2 | prototype/index.html | 入口骨架 | ✅ 45 行 |
| 2 | prototype/styles.css | 暗色工坊金视觉 | ✅ 105 行 |
| 3 | prototype/js/core/router.js | 页面注册（组合语义） | ✅ 44 行 |
| 3 | prototype/js/core/ai.js | AI 调用（mock 优先，可切真实） | ✅ 74 行 |
| 3 | prototype/js/core/factory.js | 演示数据工厂（9 步数据） | ✅ 193 行 |
| 4 | prototype/js/core/store.js | 唯一事实源：设计单 localStorage | ✅ 97 行 |
| 4 | prototype/js/core/render.js | 纯函数渲染（禁 document.） | ✅ 322 行 |
| 4 | prototype/js/core/actions.js | 事件委托 + 业务动作 | ✅ 214 行 |
| 5 | prototype/js/core/main.js | 入口，绑一次 | ✅ 131 行 |
| 6 | scripts/ui-regression.js | 蓝图断言 | ✅ 97 项全绿 |
| 6 | scripts/e2e-data.js | 端到端数据链路断言 | ✅ 120 项全绿 |

## 修复过的真实 bug（node --check 抓到）
1. **factory.js 第 71 行**：`{ 印花制版: 25, "拍照/模特": 15 }` —— 未加引号的中文 key 里有斜杠 `/`，JS 语法直接崩。已修为全部加引号。
2. **render.js 第 303 行**：`d[s.id === "word" ? "words" : (...))` 嵌套括号不匹配，浏览器打开就崩。已改为 `STEP_FIELD` 查表。

## 蓝图断言覆盖（scripts/ui-regression.js，97 项）
- 渲染层无 `document.`（唯一）
- 存储键只在 store.js（唯一事实源）
- 无 `onclick=` 拼接（反模式禁）
- 所有单文件 ≤400 行
- 9 步全部注册，Router.STEPS 恰好 9
- 所有 `data-act` 都有对应处理函数
- factory 纯函数（无 DOM、无存储、无 innerHTML）
- 存储键名唯一事实源
- 加载顺序依赖（render 在 router/ai 后、actions 在 store/factory 后、main 最后）
- view/steps 事件委托各只绑一次
- 18 个业务动作齐全
- 9 个工厂函数齐全
- AI.img 返回本地 SVG data URI，不依赖 CDN

## 数据链路断言（scripts/e2e-data.js，120 项）
- 设计词结构完整（风格/色/面料/细节/装饰/尺码）
- 出图返回本地 SVG data URI
- BOM 10 个零件、7 个工序、总成本 >200
- 查重 5 平台、判定为原创/相近/雷同之一、有跳转链接
- 采购 10 条，渠道命中拼多多/1688/淘宝/闲鱼/广州
- 组合图、模特图都是本地 SVG
- 工厂 6 家、产业带覆盖杭州/湖州/广州/嘉兴/潮州/苏州
- 成本 4 个起订量档，淘宝 > 拼多多、毛利率 40%、批量越大越便宜
- 推荐工厂按 MOQ 匹配最小档、单价最低

## 铁律提醒（每次落盘前对着看一眼）
1. 事件委托**只绑一次**（失败品死因）—— ✅ 已断言
2. 渲染层文件里**不许出现 document.**—— ✅ 已断言
3. 单文件 ≤400 行 —— ✅ 已断言
4. 禁 onclick="Fn('名字')"，用 data-* 属性 —— ✅ 已断言
5. 存储键唯一读写方 = store.js —— ✅ 已断言
6. 断网时所有流程可 mock 跑完 —— ✅ AI.img 返回本地 SVG data URI，不依赖 CDN

## 已定决策（不要反复问）
- 项目名：loli-studio（洛丽塔工坊）
- 视觉：暗底 #12110f / 金 #d9b26a / 米白字 #ece4d3
- 导航：九步分步向导（设计词→出图→拆件→查重→采购→组合→模特→工厂→成本）
- 历史记录常驻右上角入口
- AI 接口：留空走 mock，填 Base URL + Key 才真调；页面右上角徽章明示当前模式（演示 / AI）

## 下一步（主人手机浏览器验收通过后）
1. 主人确认 S0 视觉和交互
2. 更新 `.ai/state.json` 的 `frontend_approved=true`
3. 才进 §3：建 GitHub 仓库 / 治理四件套 / apk.yml / CALL-GRAPH.md / Kotlin WebView / 首推
