# INNO LIT

运行 `npm ci` 和 `npm run dev`，打开终端显示的本地地址。创意对话和 Concept Studio 默认使用本地规则。

## 自配模型

在本地开发服务或构建预览中，从创意对话或 Concept Studio 选择「自配 API 模型」，填写服务的 HTTPS API 地址、模型 ID 和自己的密钥。创意对话使用 Chat Completions，Concept Studio 另需 JSON 输出支持。DeepSeek 示例使用 `https://api.deepseek.com` 和 `deepseek-flash`。

模型设置在两个入口间共用，刷新后清除。创意对话发送本轮消息和当前项目的近期对话，Concept Studio 发送当前设计简报。AI 回复、概念轮次与报告会标注模型 ID 和服务域名。

从一条对话回复点击「转为概念」，手动填写或让模型整理概念卡和简报。选择「加入并填入简报草稿」后，核心构想会成为可编辑的设计起点。补齐设计问题、目标用户和使用场景，再点击「基于简报生成概念」探索不同变体。概念比较中的「让模型评分」会按创新性、可行性和用户价值给出独立评分与理由，人工评分仍可单独编辑。

## 概念图与展板

在 Concept Studio 选择方案并进入「方案深化」。先在「深化 AI 模型设置」填写文字模型的 API，分别完成「深化笔记」「可行性验证」「原创性检索」的 AI 分析、人工修正和人工确认。修改记录会使该步确认失效。AI 可提出验证方案，但不会填写实测记录或替用户宣称实测通过；可行性分析结论和实测结果分别记录。

原创性检索可让 AI 制定检索词、比较已录入来源，或通过 Crossref 检索后交给模型比较。模型只看到标题、链接与用户已有的比较文字，不代表已读全文。返回的比较必须引用本次真实输入来源，不能自行添加来源；论文检索不替代专利与产品检索。请阅读原文、补充范围，再确认人工结论。

三步确认后，在「完善与冻结」让 AI 综合记录完善九句话概念、洞察、机制、使用流程和总结。人工修正最终方案，明确产品造型、结构、比例、材质、配色、关键交互、标识系统和统一标题字体，再冻结。冻结会保存独立快照；需要修改时创建修订版，旧冻结版本与图片保留。报告包含 AI 原始建议、人工记录、实测状态、完善结果和冻结规范。

「概念图与展板」先制作并审核唯一产品母版，再分别制作 Landscape Entry Image（WHY + WHAT + Hero Scene）、Portrait Entry Image（HOW + 结构 / 关键交互）与 Poster Area 1（Problem + Insight + Solution + Mechanism + Use Flow + Value）。每张入口单独生成或上传图片；不得重复使用同一图片。产品一致性按冻结规范逐项审核，标题与字体统一由排版程序绘制。参考图生成不能自动保证产品完全一致，不符合规范的候选图应重新制作。

母版图片接口支持 SiliconFlow 和 Images 兼容格式，服务须支持 `/images/generations`；可填写 HTTPS 基础地址或完整生成地址。Kolors 示例为 `https://api.siliconflow.cn/v1`、`Kwai-Kolors/Kolors`、1024×1024。三张延展图强制携带已审核母版，当前内置参考图通道支持 SiliconFlow 的 `Qwen/Qwen-Image-Edit` / `Qwen/Qwen-Image-Edit-2509`，通过 JSON `image` 字段传参考图，不传 `image_size`。Kolors 不会用于三张入口的无参考独立重画；也可上传已确认是同一产品的独立场景或交互图片。费用按所选服务规则计算，模型可用性以服务商为准。

每张入口审核通过后才能导出 PNG。更换母版会使原延展图失效；重新上传或生成后再审核。Poster 的使用场景主图区域占整板约 52%，不得以结构图、机制图或爆炸图占据第一视觉；只有冻结前记录了项目不适合场景表达的具体理由时才允许例外。AI 图标注为场景演绎，不能作为真实测试照片。

图片限制为 8 MB、边长不超过 8192 像素；IndexedDB 按项目、轮次、方案、冻结版本和入口分别保存，并记录母版摘要与人工审核。旧版概念图保留下载入口，历史冻结版图片只读查看和导出。文字模型与图片模型配置分别共用，密钥刷新后清除。浏览器清除网站数据会删除本地内容，请及时导出。

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
