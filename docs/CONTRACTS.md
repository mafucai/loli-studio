# CONTRACTS — loli-studio 契约

> 定位：六层体系**第二层（契约层）**。定义模块之间如何稳定协作。
> **本文件只冻结「已经稳定、批 D/E 不会动」的部分。**
> 未冻结的部分明确标注，**不假装完整**——这是本文件第一原则。

---

## 一、冻结范围声明（先读这条）

| 状态 | 含义 |
|---|---|
| **🔒 冻结** | 改动需走 §五「变更流程」。**语义、参数、副作用不变** |
| **🔓 未冻结** | 批 D/E 会新增或调整，**本文件只记录现状，不作保证** |

**明确不冻结的两件事：**

1. **`data-act` 名单的完整性** —— 批 D（定样定价）、批 E（预售/订单/看板）**必然会新增**动作（如 `confirm-sample`、`submit-order` 等）。
   **本文件只保证「已列入的动作语义不变」，不保证名单不再增长。**
2. **预售相关数据表结构** —— 订单表、SKU/颜色子表、批次/成团子表，**等批 E 做完再冻结**。

---

## 二、🔒 存储契约（冻结）

### 2.1 存储键

| 键 | 用途 | 版本 |
|---|---|---|
| `loli-studio.designs.v1` | 全部设计单数组 | v1（**已冻结**） |
| `loli-studio.endpoints.v2` | 接口池（文本/图片各自多套） | v2（**已冻结**） |
| `loli-studio.designs.v1.cur` | 当前编辑中的设计单 id | — |

**唯一读写方**：`store.js`。**其他任何文件出现 localStorage 即为违规**（`ui-regression.js` 第 2 项断言强制）。

### 2.2 设计单结构（`designs[]` 的元素）

| 字段 | 类型 | 状态 | 说明 |
|---|---|---|---|
| `id` | string | 🔒 | 唯一 id |
| `createdAt` / `updatedAt` | ISO string | 🔒 | — |
| `prompt` | string | 🔒 | 用户输入的需求原话 |
| `step` | string | 🔒 | 当前步骤 id，对应 `Router.STEPS` |
| `theme` | string | 🔒 | 企划：主题风格（6 选 1） |
| `prints` | object\|null | 🔒 | 企划：`{theme, items[], picks[], mode, at}` |
| `avoid` | string[] | 🔒 | 设计词：避免词，**真的传给文本 AI** |
| `words` | object\|null | 🔒 | 设计词结果（见 2.3） |
| `imgUri` / `imgPassed` / `imgSource` | string/bool/string | 🔒 | 出图 |
| `versions` | object[] | 🔒 | **图透：版本留痕，只增不删**（见 2.4） |
| `currentVersion` | number | 🔒 | 当前查看的版本下标 |
| `votes` | object[] | 🔒 | 图透：投票记录（见 2.5） |
| `reviseReason` / `voteNote` | string | 🔒 | 图透：临时的原因/意见 |
| `bom` / `bomSource` | object\|null | 🔒 | 拆件 |
| `check` / `markedOriginal` | object\|null / bool | 🔒 | 查重 |
| `sourcing` | object[]\|null | 🔒 | 采购 |
| `combo` / `model` / `factories` / `pickedFactory` / `finance` | — | 🔒 | 组合/模特/工厂/成本 |
| `history` | object[] | 🔒 | 操作留痕，上限 60 条（超出裁掉最老的） |

**后向兼容要求**：老设计单**没有**新字段（`theme`/`prints`/`avoid`/`versions`/`votes`）时，**必须能正常渲染**，不得抛错。读取一律用 `|| []` / `|| ""` 兜底，**不写迁移代码**。

### 2.3 `words.color` 契约（🔒 冻结，**唯一破坏性改动**）

| 项 | 约定 |
|---|---|
| **现状** | `string[]`，如 `["白紫", "黑黑"]` |
| **历史** | 曾是单值 `string`（如 `"白紫"`） |
| **兼容口径** | **单值自动转单元素数组**：`"白紫"` → `["白紫"]` |
| **不做** | 不标「旧格式」、不做数据迁移、不排除老数据 |
| **为什么** | 单色款本来就是「只有一个颜色的款」，转成 `["白紫"]` **语义完全正确**；标旧格式会让老数据在分色统计里凭空消失 |
| **强制** | 任何使用 `color` 的地方**必须先过兼容函数**：`Factory.toColors()` / `R.colors()` / `AI.toColorsStr()` |
| **违规示例** | `"文本" + words.color` → 隐式转成 `"白紫,黑黑"`，脏数据混进 prompt |

**取数要求（为批 E 的分色成团准备）**：成团率按 **颜色 × 批次** 逐行计算，目标成团件数默认 1000，支持按款/批次/颜色覆盖。

### 2.4 `versions[]` 契约（🔒 冻结）

```
{ n: 版本号(从1开始), uri: 图片URI, source: "ai"|"demo",
  at: ISO时间, reason: 改版原因, note: 备注 }
```

| 铁律 | 说明 |
|---|---|
| **只增不删** | 这是「改版留痕」的全部含义。`pushVersion` 用 `slice()` 复制原数组，**不含 `splice`/`pop`/`shift`** |
| **改版必须填原因** | 不填原因，留痕没有意义 → 代码层强制拦截 |
| **不改旧条目** | 已有版本的任何字段不得修改 |

### 2.5 `votes[]` 契约（🔒 冻结）

```
{ versionNo: 版本号, choice: "通过"|"驳回"|"待定", note: 意见, at: ISO时间 }
```

- 记录**可追溯**：每次投票追加一条，不覆盖
- `note` 是自由文本，**不做校验**（商家自己看得懂就行）

### 2.6 接口池（`endpoints.v2`）迁移链（🔒 冻结）

| 旧版本 | 迁移到 | 规则 |
|---|---|---|
| v1 单配置 `loli-studio.cfg.v1` | v2 双池 | 文本 1 套 + 图片 1 套（识别 `imageModel` 字段） |
| v2 混合池 `endpoints.v1` | v2 双池 | 按 `model` / `imageModel` 拆成两个池 |

**已按此迁移过，不得再变**（老用户数据已落盘）。

---

## 三、🔒 路由契约（冻结语义，不冻结名单）

### 3.1 步骤表（`Router.STEPS`）

| n | id | 标题 |
|---|---|---|
| 0 | `plan` | 企划 |
| 1 | `word` | 设计词 |
| 2 | `img` | 出图 |
| 3 | `vote` | 图透 |
| 4 | `part` | 拆件 |
| 5 | `check` | 查重 |
| 6 | `buy` | 采购 |
| 7 | `look` | 组合 |
| 8 | `model` | 模特 |
| 9 | `fact` | 工厂 |
| 10 | `cost` | 成本 |
| 11 | `final` | 定样 |
| 12 | `pre` | 预售 |
| 13 | `board` | 看板 |

| 冻结项 | 说明 |
|---|---|
| **已列步骤的 id 与语义** | 不变（改 id 会破坏所有老设计单的 `step` 字段） |
| **`Router.prevId()` / `nextId()`** | 相邻步**必须动态取**，不许写死 `"word"`/`"img"` 字面量 |
| **步骤文案** | 必须走 `stepLabel(id)` 动态生成，**不硬编码「共 N 步」** |
| 🔓 **名单完整性** | 批 E 会新增（如 `pre` 预售、`board` 看板） |

### 3.2 🔒 `data-act` 动作契约（语义冻结）

> **名单不冻结**：批 D/E 会新增。本表只保证**已列动作的含义、参数、副作用不变**。

**企划（🔒）**

| `data-act` | 参数 | 副作用 |
|---|---|---|
| `pick-theme` | `data-value` = 6 主题之一 | 设 `theme`；**换主题后 `prints` 作废置 null** |
| `gen-prints` | — | 生成 6 个柄图候选（本地 SVG） |
| `pick-print` | `data-value` = 候选 id | 单选；**再点同一张则取消** |
| `save-avoid` | 读 `#in-avoid` | 分隔符 `,，、空格`，上限 20 个 |

**设计词（🔒）**

| `data-act` | 参数 | 副作用 |
|---|---|---|
| `gen-words` | 读 `#in-prompt` | 主题 + 柄图 + 避免词**一并进 prompt**；返回的 `color` 强制转数组 |
| `save-avoid` | 见上 | — |

**图透（🔒）**

| `data-act` | 参数 | 副作用 |
|---|---|---|
| `start-version` | — | 把当前图设为第 1 版；**已有版本时拒绝** |
| `switch-version` | `data-index` | 切当前版本，清空 `voteNote` |
| `vote` | `data-value` = 通过/驳回/待定 | 追加一条投票记录 |
| `save-vote` | 读 `#in-vnote` | 追加一条「待定」投票；**空文本拒绝** |
| `pick-reason` | `data-value` = 7 原因之一 | **只填输入框，不改 versions** |
| `revise-img` | 读 `#in-reason` | **必须填原因**；追加新版；旧版保留 |

**其余九步的动作语义**：见 `prototype/js/core/actions.js`（🔒 不变）。

**预售与履约（🔒 语义冻结，批 E1~E3）**

| `data-act` | 参数 | 副作用 |
|---|---|---|
| `open-pre` | — | 依据 `final.skus` 建批次；无定样则拒绝 |
| `add-orders` | 读 `#in-orders` | 批量粘贴解析（颜色,数量,金额）；**只产匿名 ID，不采集身份信息** |
| `judge-pre` | — | 按 颜色×批次 判定；产出 `judge` |
| `build-refund` | — | 生成退款清单；**App 不自动退款** |
| `mark-refunded` | — | 清单内订单推进「退款中 → 已退款」；**非法状态明确报出哪几单** |
| `apply-design-state` | — | 把款状态改为判定值；**走状态机校验** |
| `pay-tail` | — | `待尾款｜尾款逾期 → 已付尾款` |
| `tail-overdue` | — | 批量标记 `尾款逾期` + 生成催款清单；**不自动发送** |
| `ship` | — | `待发货 → 已发货` |
| `set-realno` | `data-realno-box` / `data-realno-input` | 写 `realNo`；**仅 `发货/退款/对账` 可读写（§一）** |
| `after-sale` | `data-aftersale-box` / `-reason` / `-note` | 记录售后原因；**只留痕，不做动作** |
| `set-uv` | `prompt` 输入 | 写 `uv`；**未录则看板显示「待录」不触发** |

**看板阈值契约（🔒 数值冻结）**

| 指标 | 阈值 | 方向 |
|---|---|---|
| 成团率 | `< 100%` | 低于 |
| 定金转化率 | `≥0.8%` 正常 / `0.3%~0.8%` 预警 / `<0.3%` 异常 | 低于 |
| 退款率（近 30 天） | `≥15%` 预警 / `≥25%` 异常 | 高于 |
| 售后原因占比 | `≥30%` 预警 / `≥50%` 异常 | 高于 |

唯一来源：`board-model.js` 的 `THRESHOLDS`。改阈值只改这一处。

**订单状态机契约（🔒）**

`待定金 → 已付定金 → 待尾款 → 尾款逾期 → 已付尾款 → 待发货 → 已发货 → 售后 → 完结`，另有 `退款中 → 已退款`、`定金逾期` 终态。
**已有流转关系不得改动**；新增状态须同时更新 `ui-regression` 组 22 与 `backcompat` K 组。

### 3.3 骨架契约（🔒）

| 约定 | 强制方式 |
|---|---|
| 每页最多 3 个内容块 | 设计约定 |
| 底部三个主入口（设计/制作/经营） | `PAGES` 数组 |
| 页内进度点数量 = 该页步骤数 | 动态生成（不许写死 3 个） |
| 页面首/尾按钮 | 首步给「历史」，其余给「返回」 |

---

## 四、🔒 AI 接口契约（冻结）

### 4.1 文本接口（OpenAI 兼容）

| 项 | 约定 |
|---|---|
| 调用点 | `POST {base}/chat/completions` |
| 鉴权 | `Authorization: Bearer {key}` |
| **地址必须 HTTPS** | 明文 `http://` 会被拒（`throw new Error("接口地址必须使用 HTTPS")`） |
| 失败处理 | 返回 `{__error: "..."}`，**不回退成假装成功** |
| 模型列表 | `GET {base}/models`，失败给明确原因，允许手打 |

### 4.2 图片接口（与文本**完全独立**）

| 项 | 约定 |
|---|---|
| 调用点 | `POST {base}/images/generations` |
| 参数尝试顺序 | `b64_json` → 默认 → `url`（**b64 优先**：一次拿到数据，不依赖二次下载） |
| 超时 | 默认 90 秒，可在设置里改 |
| `mock` 模式 | 返回**本地 SVG data URI**，**不依赖 CDN** |

### 4.3 模式标识（🔒）

| 模式 | 判定 | 页面标识 |
|---|---|---|
| `real` | `base` **且** `key` 都有 | 徽章显示「AI」 |
| `mock` | 否则 | 徽章显示「演示」 |

**演示数据必须标明「演示」**，禁止显示成真实结果。

---

## 五、变更流程（**契约不是说明书，是门禁**）

> 光写「什么不能改」不够。要改冻结项，**必须走以下流程**。

### 5.1 改 🔒 存储结构

1. **先写迁移函数**（从旧结构转新结构，兼容老数据）
2. **加断言**（在 `backcompat-test.js` 加「老数据能渲染」实测）
3. **在 `EVOLUTION.md` 记一条**（现象/根因/应对/规则更新）
4. 以上三步**缺一不可**，否则不许改

### 5.2 改 🔒 `data-act` 语义

1. **改语义 = 破坏性变更**。先在 `CONTRACTS.md` 把该项从 🔒 改为 🔓 并说明原因
2. 同步改 `ui-regression.js` 第 7 项（所有 `data-act` 有处理）与第 17 组断言
3. 更新本文件

### 5.3 新增 `data-act`（**允许，不算破坏**）

1. 直接加，但**必须同时加断言**（`ui-regression.js` 第 7 项会自动要求有处理函数）
2. 在本文件 §3.2 补一行（标注新增批次）

### 5.4 新增步骤

1. `Router.STEPS` 加一项（`n` 按序）
2. `main.js` 注册视图
3. `ui-regression.js` 第 5 项 id 列表 + 第 6 项步数 + 第 10a 项脚本数
4. `stepLabel` 会自动跟上，**不用改文案**

### 5.5 门禁（强制执行，不可绕过）

| 门禁 | 位置 | 不过会怎样 |
|---|---|---|
| 7 个断言脚本 | `apk.yml` 的 `Regression gate` 步 | **不出包** |
| 单文件 ≤400 行 | 同上 | 同上 |
| `localStorage` 只在 `store.js` | 同上 | 同上 |
| 渲染层无 `document.` | 同上 | 同上 |

**不得删除、拆分绕过、改名躲避或伪造结果。** 疑似误报时保留证据并在 `EVOLUTION.md` 记录。

---

## 六、本文件与代码的对应关系

| 契约 | 代码位置 | 断言位置 |
|---|---|---|
| 存储键唯一读写方 | `store.js` | `ui-regression.js` 第 2、9 项 |
| `color` 兼容 | `factory.js` / `render.js` / `ai.js` | `backcompat-test.js` A、F 组 |
| `versions` 只增不删 | `factory.js` `pushVersion` | `ui-regression.js` 17g、17h |
| 改版必须填原因 | `vote-actions.js` | `ui-regression.js` 17e |
| 步骤表 | `router.js` | `ui-regression.js` 第 5、6 项 |
| `data-act` 有处理 | `actions.js` / `settings.js` / `vote-actions.js` | `ui-regression.js` 第 7 项 |
| 加载顺序 | `index.html` | `ui-regression.js` 第 10 项 |

**改任一项，对应断言必须同步更新。**
