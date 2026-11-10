# INNO LIT

运行 `npm ci` 和 `npm run dev`，打开终端显示的本地地址。Concept Studio 默认使用本地规则生成。

## 自配模型

在本地开发服务或构建预览中，打开 Concept Studio，选择「自配 API 模型」，填写服务的 HTTPS API 地址、模型 ID 和自己的密钥。服务需支持 Chat Completions 及 JSON 输出。例如 [DeepSeek](https://api-docs.deepseek.com/guides/json_mode/) 使用 `https://api.deepseek.com`，可填入 `deepseek-flash`。

点击生成时，简报由本地服务转发至所填的模型服务。密钥只用于当前工作区会话。轮次与报告会记录模型 ID 和服务域名。

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
