# INNO LIT

运行 `npm ci` 和 `npm run dev`，打开终端显示的本地地址。创意对话和 Concept Studio 默认使用本地规则。

## 自配模型

在本地开发服务或构建预览中，打开顶部「AI 模型中心」，填写服务的 HTTPS API 地址、模型 ID 和自己的密钥；各任务可以覆盖默认模型。创意对话使用 Chat Completions，Concept Studio 另需 JSON 输出支持。DeepSeek 示例使用 `https://api.deepseek.com` 和 `deepseek-flash`。

首页对话、概念生成、深化笔记、可行性验证、原创性检索、方案优化、概念图与展板、设计报告八个环节均可独立配置。优先使用环节独立配置，其次继承原有四类任务配置，最后继承默认模型；「原有四类任务与视觉转译配置」保留旧配置和专业生图的文字转译模型。配置及密钥仅保留在本次页面会话，刷新后清除。创意对话发送近期对话，Concept Studio 发送当前设计简报，报告整理发送已有报告记录。AI 回复、概念轮次与报告标注模型 ID 和服务域名。

从一条对话回复点击「转为概念」，手动填写或让模型整理概念卡和简报。选择「加入并填入简报草稿」后，核心构想会成为可编辑的设计起点。补齐设计问题、目标用户和使用场景，再点击「基于简报生成概念」探索不同变体。概念比较中的「让模型评分」会按创新性、可行性和用户价值给出独立评分与理由，人工评分仍可单独编辑。

## AI 深化与概念冻结

在 Concept Studio 选择方案并进入「方案深化」。在「AI 模型中心」配置文字模型，分别完成「深化笔记」「可行性验证」「原创性检索」的 AI 分析、人工修正和人工确认。修改记录会使该步确认失效。AI 可提出验证方案，但不会填写实测记录或替用户宣称实测通过；可行性分析结论和实测结果分别记录。

原创性检索可让 AI 制定检索词、比较已录入来源，或通过 Crossref 检索后交给模型比较。模型只看到标题、链接与用户已有的比较文字，不代表已读全文。返回的比较必须引用本次真实输入来源，不能自行添加来源；论文检索不替代专利与产品检索。请阅读原文、补充范围，再确认人工结论。

在「方案优化与定稿」可直接让 AI 根据当前概念与已有记录完善九句话、洞察、机制、使用流程和总结，不要求先完成三步确认。人工可修正优化稿，直接进入概念图制作。未完成的分析、检索和实测仍明确为待完成。冻结为可选操作：若要正式冻结，仍需三步确认、完整产品规范和最终核对；冻结保存独立快照，修改时创建修订版，旧版本与图片保留。设计报告可由独立模型整理草稿、人工修改并随原始记录导出；依据变化会提示复核草稿。

## 概念图与展板

选定方案后直接进入「概念图与展板」，无需先冻结概念或完成逐图审核。默认用三张图表达场景与价值、结构与交互、完整概念，也可选择只生成 1 张或 2 张。

默认的「本地概念示意（非 AI）」不需要 API，会根据概念内容绘制产品、用户场景和关键动作的示意。三张图使用同一套产品图形和配色，分别安排场景、操作近景和概念叙事。它是帮助表达想法的规则式示意，具体产品效果可选择自配图片 API 或上传图片。

每张图都可选择横版、竖版、方形或自定义版面，直接填写宽高像素后预览、导出 PNG。尺寸为 320–6000 px、总像素不超过 2400 万、宽高比在 1:4 至 4:1；支持常见 A4/A3 像素尺寸。此处控制最终导出尺寸，API 模型原图尺寸在图片模型设置内选择。三图各有独立构图，完整概念图将主要画面放在版面中央超过 50% 的区域。

图片 API 使用全局 AI 模型中心的图片任务配置，支持 SiliconFlow 和 Images 兼容格式，可填 HTTPS 基础地址或完整 `/images/generations` 地址。Kolors 示例：`https://api.siliconflow.cn/v1`、`Kwai-Kolors/Kolors`、1024×1024。选择参考图编辑模型时，会自动使用已有的产品图片作为共用参考；当前内置通道支持 SiliconFlow 的 `Qwen/Qwen-Image-Edit` / `Qwen/Qwen-Image-Edit-2509`。没有参考图时，可先上传产品图或换用文生图模型。三图共用概念和已有产品规范，但 AI 图片仍需自行核对造型细节，必要时单独重生成或上传替换。

「打开原有 AI 专业流程」保留已有的概念转译和冻结母版延展流程，其配置和图片不受自由排版入口影响。

专业生图的视觉转译也支持当前概念或优化稿，不强制冻结。模型可返回纯 JSON、Markdown JSON 代码块或带解释文字的完整 JSON；空内容、截断、数组、缺少 prompt、提示词过短或超出图片接口总长度会给出具体错误。不会猜补被截断的内容。冻结版继续校验完整产品规范。此仓库的自动测试使用模拟模型响应，不代表任一服务商的真实账户、额度或模型权限已验证。

图片限制为 8 MB、边长不超过 8192 像素。图片使用 IndexedDB 按项目、轮次、方案与版本分开保存，张数、版式、尺寸和说明随项目保存。减少张数不会删除隐藏的图片；原先的母版、冻结版和早期概念图仍在「之前保存的图片」中，已审核的旧版展板可继续导出。生图中断时已保存的图片会保留。API 密钥刷新后清除；清除浏览器网站数据会删除本地内容，请及时导出。

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
