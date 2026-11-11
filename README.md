# INNO LIT

运行 `npm ci` 和 `npm run dev`，打开终端显示的本地地址。创意对话和 Concept Studio 默认使用本地规则。

## 自配模型

在本地开发服务或构建预览中，从创意对话或 Concept Studio 选择「自配 API 模型」，填写服务的 HTTPS API 地址、模型 ID 和自己的密钥。创意对话使用 Chat Completions，Concept Studio 另需 JSON 输出支持。DeepSeek 示例使用 `https://api.deepseek.com` 和 `deepseek-flash`。

模型设置在两个入口间共用，刷新后清除。创意对话发送本轮消息和当前项目的近期对话，Concept Studio 发送当前设计简报。AI 回复、概念轮次与报告会标注模型 ID 和服务域名。

从一条对话回复点击「转为概念」，手动填写或让模型整理概念卡和简报。选择「加入并填入简报草稿」后，核心构想会成为可编辑的设计起点。补齐设计问题、目标用户和使用场景，再点击「基于简报生成概念」探索不同变体。概念比较中的「让模型评分」会按创新性、可行性和用户价值给出独立评分与理由，人工评分仍可单独编辑。

## 概念图与展板

在 Concept Studio 选择方案并进入「方案深化 → 概念图与展板」。概念结构图根据当前方案在本地绘制，无需 API；产品概念图可上传 PNG、JPEG、WebP，或填写独立的图片模型 API 设置生成。图片描述可以编辑。

图片接口支持 SiliconFlow 和 Images 兼容格式，服务须支持 `/images/generations`；可填写 HTTPS 基础地址或完整生成地址。SiliconFlow 示例使用 `https://api.siliconflow.cn/v1`、`Kwai-Kolors/Kolors`、1024×1024。其他模型须选择其支持的尺寸。文字模型与图片模型分别配置，设置与密钥仅保留在当前页面会话，刷新后清除。生成会向所选服务发送图片描述，按该服务计费。

切换「概念结构图」「横版展板」「竖版展板」预览，点击「导出 PNG」下载排版结果。产品图片也可单独下载。图片限制为 8 MB、边长不超过 8192 像素；使用 IndexedDB 按项目、轮次和方案单独保存，文字、图片描述和版式仍随项目保存。删除项目时同时清理图片。当前浏览器清除网站数据会删除这些本地内容，请及时导出。图像来源会标注为用户上传或 AI 生成。

图片生成与文字 API 均需通过 `npm run dev` 或 `npm run preview` 启动本机服务；仅将 `dist` 放在静态服务器上不提供 API 转发。

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
