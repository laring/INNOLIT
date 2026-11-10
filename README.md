# INNO LIT

运行 `npm ci` 和 `npm run dev`，打开终端显示的本地地址。创意对话和 Concept Studio 默认使用本地规则。

## 自配模型

在本地开发服务或构建预览中，从创意对话或 Concept Studio 选择「自配 API 模型」，填写服务的 HTTPS API 地址、模型 ID 和自己的密钥。创意对话使用 Chat Completions，Concept Studio 另需 JSON 输出支持。DeepSeek 示例使用 `https://api.deepseek.com` 和 `deepseek-flash`。

模型设置在两个入口间共用，刷新后清除。创意对话发送本轮消息和当前项目的近期对话，Concept Studio 发送当前设计简报。AI 回复、概念轮次与报告会标注模型 ID 和服务域名。

从一条对话回复点击「转为概念」，手动填写或让模型整理概念卡和简报。选择「加入并填入简报草稿」后，核心构想会成为可编辑的设计起点。补齐设计问题、目标用户和使用场景，再点击「基于简报生成概念」探索不同变体。概念比较中的「让模型评分」会按创新性、可行性和用户价值给出独立评分与理由，人工评分仍可单独编辑。

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
