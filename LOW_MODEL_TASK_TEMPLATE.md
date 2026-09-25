# LOW_MODEL_TASK_TEMPLATE — loli-studio

执行任务前先读 `PROJECT_RULES.md`、`ACCEPTANCE.md` 和 `RISK_CHECKLIST.md`。

## 任务

- 目标：
- 允许修改的文件：
- 验收命令：
- 不许改动的范围：

## 约束

1. 只改任务点名的文件。
2. 修改前备份。
3. 不重构无关代码，不删除旧文件。
4. 前端 JavaScript 必须通过 `node --check`。
5. 改完运行 `node scripts/ui-regression.js` 和 `node scripts/e2e-data.js`。
6. 不把演示数据写成真实数据。
7. 不接入爬虫，不输出 API Key。
8. 不确定时停止并提问。

## 交付格式

- 改动文件绝对路径
- 备份路径
- 命令结果
- 未解决的问题
