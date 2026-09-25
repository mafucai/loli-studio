# CALL-GRAPH — loli-studio

本蓝图描述当前已通过的前端。Android 壳尚未存在，不在本版假装已经接通。

## 1. 模块分层

| 文件 | 层 | 职责 | 禁止 |
|---|---|---|---|
| `router.js` | 基建 | 九步注册、渲染调度 | 写业务和存储 |
| `store.js` | 数据 | 设计单、当前单、接口配置 | 碰 DOM、发请求 |
| `factory.js` | 引擎 | 生成演示数据 | 碰 DOM、写存储、冒充实测 |
| `ai.js` | 引擎 | 判断演示/真实模式并调用兼容接口 | 写死密钥、隐藏错误 |
| `render.js` | 渲染 | 设计单数据转 HTML | 执行 DOM、改状态 |
| `actions.js` | 控制器 | 把 `data-act` 分发到动作 | 直接读写存储键 |
| `main.js` | 入口 | 注册页面并绑定一次事件 | 重复绑定、夹带计算 |

依赖方向：入口 → 控制器 → 渲染；控制器 → 数据/引擎；渲染 → 基建。禁止反向调用。

## 2. 模块化阈值

| 信号 | 阈值 | 当前处理 |
|---|---|---|
| 单文件 | 400 行 | `scripts/ui-regression.js` 检查 |
| 单函数 | 60 行 | 新增函数超过时先拆 |
| 渲染层 DOM 操作 | 0 次 | 只允许返回字符串 |
| 同一存储键读写方 | 1 个 | 只能是 `store.js` |

## 3. 存储键

| 键 | 唯一读写方 | 其他模块入口 |
|---|---|---|
| `loli-studio.designs.v1` | `store.js` | `list/get/save/patch/delete` |
| `loli-studio.designs.v1.cur` | `store.js` | `currentId/setCurrentId` |
| `loli-studio.cfg.v1` | `store.js` | `getCfg/setCfg` |

## 4. 中央路由

`registerPage` 是追加，不是覆盖。页面钩子不能放进渲染对象。

| 页面 | 注册函数 | 主动作 |
|---|---|---|
| `word` | `R.vWord` | `gen-words` |
| `img` | `R.vImg` | `gen-img`、`pass-img`、`reject-img` |
| `part` | `R.vPart` | `gen-bom` |
| `check` | `R.vCheck` | `run-check`、`mark-original` |
| `buy` | `R.vBuy` | `run-sourcing` |
| `look` | `R.vLook` | `gen-combo` |
| `model` | `R.vModel` | `gen-model` |
| `fact` | `R.vFact` | `run-factories`、`pick-fact` |
| `cost` | `R.vCost` | `run-finance` |
| `history` | `R.vHistory` | `open-history` |

`main.js` 只给 `#view` 和 `#steps` 各绑定一次点击委托。

## 5. 修改检查

- 新按钮使用 `data-act`，并在 `actions.js` 注册同名动作。
- 新存储字段只通过 `Store.patch` 写入。
- 新页面由拥有者调用 `registerPage`，不得覆盖旧注册。
- 动态 HTML 先转义，不用 `onclick`。
- 改完运行 `node scripts/ui-regression.js` 与 `node scripts/e2e-data.js`。

## 6. 红线

- 注册只能追加。
- 渲染结果不得携带 `onEnter`。
- 一个存储键一个读写方。
- 动态节点用 `data-*` 和事件委托。
