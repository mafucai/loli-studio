# VALIDATION — loli-studio 验证索引

> 定位：六层体系**第五层（验证层）**。说明「哪项验什么」。
> **本文件目前是骨架**：只写「脚本入口、分组、验什么方向」。
> **372 项明细等批 D/E 完成后一次填**（断言还在长，现在写明细会立刻过期）。
>
> 写法说明：骨架的价值是「**不用翻 7 个文件就知道验证在哪、分几组**」。

---

## 一、怎么跑

```sh
# 全部（CI 里跑的就是这些，顺序一致）
cd /workspace/apps/loli-studio
node scripts/ui-regression.js
node scripts/e2e-data.js
node scripts/full-logic-test.js
node scripts/models-logic-test.js
node scripts/image-logic-test.js
node scripts/backcompat-test.js
node scripts/error-assistant-test.js

# 语法检查（每个改动文件都要跑）
node --check prototype/js/core/<改动文件>.js
```

**退出码**：`0` = 全通过，`1` = 有失败。CI 中任一失败 → **不出包**。

**CI 位置**：`.github/workflows/apk.yml` 的 `Regression gate` 步（在 `Set up Java` **之前**，跑不过就不进构建）。

---

## 二、脚本总览

| # | 脚本 | 类型 | 项数 | 验什么方向 |
|---|---|---|---|---|
| 1 | `ui-regression.js` | **静态**（扫源码） | 162 | 结构合规：文件行数、加载顺序、`data-act` 完备、铁律遵守 |
| 2 | `e2e-data.js` | 动态（数据链路） | 38 | 演示数据工厂的完整性与边界（不起 server、不碰 DOM） |
| 3 | `full-logic-test.js` | **动态**（真实代码路径） | 74 | 用 DOM/localStorage 桩加载全部 JS，跑真实调用链 |
| 4 | `models-logic-test.js` | 动态 | 15 | 接口池：新增/切换/删除/两个池互不污染 |
| 5 | `image-logic-test.js` | 动态 | 22 | 出图链路：参数回退顺序、响应形状兼容 |
| 6 | `backcompat-test.js` | **动态**（实测） | 35 | **后向兼容 + 脏数据**：老设计单能渲染、不出现 `undefined`/逗号串 |
| 7 | `error-assistant-test.js` | **动态**（实测） | 26 | 报错助手：注入错误看角标/面板是否真的更新 |
| | **合计** | | **372** | |

**「静态」vs「动态」**：静态 = grep 源码字符串（**抓不到运行时错误**）；动态 = 真跑代码。**两者不可互相替代**（见 `EVOLUTION.md` D2 的元结论）。

---

## 三、断言分组（骨架）

> 编号对应脚本里的断言前缀，如 `17a.` / `A组`。

### 3.1 `ui-regression.js`（1~17 组）

| 组 | 主题 |
|---|---|
| 1 | 渲染层无 `document.` |
| 2 | `localStorage` 只在 `store.js` |
| 3 | 无 `onclick=` 拼接 |
| 4 | 单文件 ≤400 行 |
| 5 | 所有视图已注册 |
| 6 | `Router.STEPS` 步数正确 |
| 7 | 所有 `data-act` 有处理函数 |
| 8 | `factory` 是纯函数（无 DOM/存储/innerHTML） |
| 9 | 存储键唯一事实源 |
| 10 | 加载顺序依赖（10a~10f） |
| 11 | 事件委托只绑一次 |
| 12 | 关键业务动作齐全 |
| 13 | 演示数据工厂函数齐全 |
| 14 | `AI.img` 返回本地 SVG（不依赖 CDN） |
| 15 | **企划批**（15a~15o）：主题/柄图/避免词/`color` 数组 |
| 16 | **`color` 兼容函数**（16a/16c/16d）+ **R8 脚本无硬编码路径**（16b） |
| 17 | **图透批**（17a~17j）：多版本、投票、改版留痕、步骤文案动态化 |

### 3.2 `backcompat-test.js` 分组

| 组 | 主题 |
|---|---|
| A | `color` 兼容：单值 → 数组 |
| B | 老设计单（单值 `color`、无新字段）渲染不崩 |
| C | 柄图/主题/避免词真的进 prompt |
| D | 柄图候选：本地 SVG、确定性 |
| E | `Router` 相邻步 |
| F | **脏 prompt 检测**：不许 `undefined`、不许逗号串 |
| G | 企划字段缺省安全 |

### 3.3 `error-assistant-test.js` 分组

| 组 | 主题 |
|---|---|
| 1 | 初始状态（无错误时角标显示 ✓） |
| 2 | 注入 JS 错误 → 角标/面板更新 |
| 3 | 3 秒内同错去重 |
| 4 | 异步错误被捕获 |
| 5 | 资源加载失败（capture 阶段） |
| 6 | 原生桥 `__nativeError` 回显 |
| 7 | 面板开关 / 清空 |
| 8 | 上限 50 条 |
| 9 | `Actions.report` 红框通道 |
| 10 | 原生桥 `logError` 被调用 |

### 3.4 其余脚本

| 脚本 | 分组主题 |
|---|---|
| `e2e-data.js` | 设计词字段完整 / BOM 物料工序 / 查重五平台 / 采购入口 / 组合模特图 / 工厂搜索 / 成本计算 |
| `full-logic-test.js` | 文本池 / 图片池 / 迁移 / 渲染 HTML / 设置动作 / 表单 / 九步链路 / 报错助手 / 估价块 / AI 拆件比价 / 图片历史 |
| `models-logic-test.js` | 接口池 CRUD、两池隔离 |
| `image-logic-test.js` | 参数回退、响应形状兼容、无桥退回 |

---

## 四、覆盖矩阵（做了什么 → 被什么验）

| 功能 | 断言 |
|---|---|
| 企划（主题/柄图） | 15b~15d、16、backcompat G |
| 避免词 | 15e、15i、backcompat C |
| 设计词 `color` 数组 | 15m、backcompat A/F |
| 出图 | image-logic（22）、e2e |
| **图透（多版本/投票）** | 17a~17j |
| 拆件 | full-logic、e2e |
| 查重 / 采购 / 组合 / 模特 / 工厂 / 成本 | full-logic、e2e |
| 接口设置 | models-logic、full-logic |
| 报错助手 | error-assistant（26） |
| 后向兼容 | backcompat（35） |
| 铁律（行数/存储/加载序） | ui-regression 1~11 |

**空白（尚未覆盖）**：预设的预售线（批 D/E 待做）、像素级视觉（需 chromium）、真机行为。

---

## 五、待填（等批 D/E 后）

| # | 待填内容 | 为什么现在不填 |
|---|---|---|
| 1 | 372 项**逐条**明细（当前只有分组） | 批 D/E 会大幅增项，现在写会立刻过期 |
| 2 | 批次新增后的**项数校准** | 同上 |
| 3 | 预售线覆盖矩阵 | 功能还没做 |
| 4 | 视觉验收清单 | 需真机/浏览器 |

---

## 六、已知局限

| # | 项 | 说明 |
|---|---|---|
| 1 | 本地缺 chromium | 浏览器实测（Playwright）跑不了，代码路径已用 Node 桩走通，**像素级视觉未验** |
| 2 | `dom-test.js` 已报废 | DOM 桩不解析文本节点，末尾 3 项永远失败。真实点击走 `browser-acceptance.js` |
| 3 | 静态断言偏多 | 静态 162 项 vs 动态 135 项。**静态抓不到运行时错误**（D2 教训） |
| 4 | 无覆盖率统计 | 只统计「断言项数」，不统计「代码行覆盖」 |

---

## 批 E3 新增断言（614 项总量）

| 脚本 | 组 | 验什么 |
|---|---|---|
| `ui-regression.js` | 组 22（22a~22ad） | 履约动作存在、`尾款逾期` 状态、`transit`/`transitMany`、`REALNO_ACTS` 三项不变、`setRealNo` 权限校验、售后枚举、催款不自动发、看板四指标、阈值数值（0.8%/0.3%、15%/25%）、「阈值触发」列名、低于/高于方向、board 步骤与视图注册、4 个新文件 ≤400 行 |
| `backcompat-test.js` | K 组（41 项，实测） | 状态机流转合法性（含 `尾款逾期` 不可跳步）、`transit` 留痕与不改原数组、批量流转、催款清单、真单号四类权限、售后登记与统计、成团率逐行、UV 待录四断言、转化率三档、退款率四档、`buildBoard` 不改订单、`vBoard` 渲染、履约区块渲染 |

**新增可执行文件**（均在 `prototype/js/core/`，且已同步 `app/src/main/assets/`）：

| 文件 | 行数 | 职责 |
|---|---|---|
| `board-model.js` | 128 | 阈值常量 + 三指标计算 + 看板汇总 |
| `render-board.js` | 100 | 看板视图（第 14 步） |
| `render-flux.js` | 110 | 履约区块（补尾款/发货/售后） |
| `post-actions.js` | 102 | 履约动作（6 个 `data-act`） |

**E3 期间修正的同类缺陷**：D8（断言写死易变值）→ 新增 R10；D9（断言逼出隐式分支）→ `level()` 补显式 `high`。
