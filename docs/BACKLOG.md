# 有序需求清单

本轮基线：origin/develop 540e404；分支 test/workflow-regression。负责人：开发执行、项目所有者验收。优先级是执行顺序，预算不是交付承诺；超出预算先缩范围。

|顺序|需求|预算|状态|
|---|---|---|---|
|1|[P1：自动填写、人工修改、刷新恢复及项目隔离回归](https://github.com/laring/INNOLIT/issues/3)|0.5 天|已实现，待 PR 合入|
|2|[P1：包装 ZIP 与报告 PPTX 导出完整性回归](https://github.com/laring/INNOLIT/issues/4)|0.5 天|已实现，待 PR 合入|
|3|[P2：建立固定模拟数据的完整演示链路](https://github.com/laring/INNOLIT/issues/5)|1 天|已实现，待 PR 合入|
|4|[P2：浏览器回归接入自动检查并保留失败证据](https://github.com/laring/INNOLIT/issues/6)|0.5 天|已实现，待 PR 合入|
|5|[P3：补齐旧项目与存储失败的浏览器恢复覆盖](https://github.com/laring/INNOLIT/issues/7)|1 天|后续候选|

本轮不增加产品功能。合入 PR 时自动关闭前四项，第五项继续排队。需求变化先更新 Issue，再修改范围。

交付：[PR #8](https://github.com/laring/INNOLIT/pull/8)。自动检查包含 Windows / Ubuntu 的 verify 与 Chromium 浏览器回归；失败时保留七天截图、trace 和报告。
