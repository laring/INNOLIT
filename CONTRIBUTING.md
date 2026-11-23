# INNO LIT 开发约定

需求负责人：项目所有者，决定优先级与范围；开发负责实现和验证。维持 React 19、TypeScript 7、Vite 8、Oxlint。每项改动独立验收。

## 基线与分支

统一基线包含 feature/concept-studio-v02 和 feature/visual-simple-v022 的开发历史，保留最新正式源码，旧备份归档不进入基线。
本次流程 PR 合入 develop 后，所有新工作从最新 origin/develop 创建 feature/、fix/ 或 chore/ 分支。main 仅用于经确认的发布；不强推，不把旧分支再次作为新功能基线。
流程 PR 合入前继续以本 PR 的分支 chore/dev-foundations 作为候选集成基线，避免回到旧 develop 丢失功能。

## 运行环境

Node.js 24.22.1，npm 11.19.1。安装 Node 后核对 `node --version` 和 `npm --version`；必要时 `npm install -g npm@11.19.1`。支持 nvm 的环境可运行 `nvm install`、`nvm use`。
Windows nvm-windows 请运行 `nvm install 24.22.1`、`nvm use 24.22.1`。

```powershell
npm ci
npm run dev
```

提交前统一运行 `npm run verify`，依次执行 Lint、自动测试、生产构建；任一步失败立即停止。
自动测试使用模拟服务，不使用真实 API Key，不自动发起付费生成。
本地模型通过 AI 模型中心配置；代理保存在不入库的 .env.local，参考 .env.example。

## 从需求到合入

1. 使用 Issue 模板登记需求或问题，补齐范围、优先级、预算和验收条件。
2. 确认当前修改已提交，再从最新 origin/develop 创建独立分支。不要切换有未保存工作的工作目录，可使用 git worktree。
3. 完成最小可演示改动，运行 npm run verify。
4. 推送并创建目标为 develop 的 PR，按模板填写结果和验证。
5. GitHub Actions 的 Windows、Ubuntu 两项检查通过，至少一位评审人核对行为后合入。单人项目保留自审记录，不冒充第二人审批。
6. 需求关闭时记录实际结果与遗留项；发布再单独评审 main 的变更。

仓库管理员应在 GitHub 为 develop/main 启用 PR 合入要求及状态检查 verify (ubuntu-latest)、verify (windows-latest)，禁止强推。CI 文件本身不会启用分支保护；Issue 表单需合入默认分支后才会被 GitHub 自动列出。

## 演示与发布

本地演示：`npm run build` 后 `npm run preview -- --host localhost --port 5173 --strictPort`。
此项目包含本机 API 转发，不能仅上传 dist 就期望 AI 功能可用；正式部署 API 服务另立需求。
回退用 git revert 或上一份发布版本，保留历史，不使用强推回退。
