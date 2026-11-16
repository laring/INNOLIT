# INNO LIT

运行 `npm ci` 和 `npm run dev`，打开终端显示的本地地址。创意对话和 Concept Studio 默认使用本地规则。

## 自配模型

OpenRouter 图片通道已接入参考图：查询 `/images/models` 的输入能力，再将原图通过 `input_references` 发送到 `/images`，不再整体禁止 OpenRouter，也不再限制为单个 Recraft 模型。具体模型仍须支持图片输入；能文生图不等于能读取参考图。不会自动切换模型或丢弃参考图。参见 [OpenRouter 官方参考图接口](https://openrouter.ai/docs/guides/overview/multimodal/image-generation#image-to-image-reference-images)。

图片配置的生效顺序为「概念图与展板独立配置 → 原有图像生成任务 → 默认图像模型」，每一层使用完整的地址、协议、模型和密钥，不拼接其他层的密钥。配置中心与概念图页面共用同一份生效摘要。SiliconFlow、Images 兼容、OpenAI、OpenRouter 均发送当前配置的密钥到本机转发服务，且只放在 Authorization 请求头中；转发优先使用该密钥。原有 OpenAI／OpenRouter 环境变量仅保留给旧调用兼容，不再要求页面配置另存服务器密钥。更换服务地址会清空旧服务密钥；刷新后全部模型密钥仍会清除。

在本地开发服务或构建预览中，打开顶部「AI 模型中心」，填写服务的 HTTPS API 地址、模型 ID 和自己的密钥；各任务可以覆盖默认模型。创意对话使用 Chat Completions，Concept Studio 另需 JSON 输出支持。DeepSeek 示例使用 `https://api.deepseek.com` 和 `deepseek-flash`。

首页对话、概念生成、深化笔记、可行性验证、原创性检索、方案优化、概念图与展板、设计报告八个环节均可独立配置。优先使用环节独立配置，其次继承原有四类任务配置，最后继承默认模型；「原有四类任务与视觉转译配置」保留旧配置和专业生图的文字转译模型。配置及密钥仅保留在本次页面会话，刷新后清除。创意对话发送近期对话，Concept Studio 发送当前设计简报，报告整理发送已有报告记录。AI 回复、概念轮次与报告标注模型 ID 和服务域名。

从一条对话回复点击「转为概念」，手动填写或让模型整理概念卡和简报。选择「加入并填入简报草稿」后，核心构想会成为可编辑的设计起点。补齐设计问题、目标用户和使用场景，再点击「基于简报生成概念」探索不同变体。概念比较中的「让模型评分」会按创新性、可行性和用户价值给出独立评分与理由，人工评分仍可单独编辑。

## AI 深化与概念冻结

在 Concept Studio 选择方案并进入「方案深化」。在「AI 模型中心」配置文字模型，分别完成「深化笔记」「可行性验证」「原创性检索」的 AI 分析、人工修正和人工确认。修改记录会使该步确认失效。AI 可提出验证方案，但不会填写实测记录或替用户宣称实测通过；可行性分析结论和实测结果分别记录。

原创性检索可让 AI 制定检索词、比较已录入来源，或通过 Crossref 检索后交给模型比较。模型只看到标题、链接与用户已有的比较文字，不代表已读全文。返回的比较必须引用本次真实输入来源，不能自行添加来源；论文检索不替代专利与产品检索。请阅读原文、补充范围，再确认人工结论。

在「方案优化与定稿」可直接让 AI 根据当前概念与已有记录完善九句话、洞察、机制、使用流程和总结，不要求先完成三步确认。人工可修正优化稿，直接进入概念图制作。未完成的分析、检索和实测仍明确为待完成。冻结为可选操作：若要正式冻结，仍需三步确认、完整产品规范和最终核对；冻结保存独立快照，修改时创建修订版，旧版本与图片保留。设计报告可由独立模型整理草稿、人工修改并随原始记录导出；依据变化会提示复核草稿。

## 概念图与展板

默认入口为「五步产品设计」；原有「自由排版与三图」及「AI 专业流程」仍可切换。

1. **十款草图**：风格参考图可选，不选图时按设计简报文生图；也可上传 1 张自己的风格图，或点击「不使用参考图」移除。AI 在一幅 2×5 草图中生成十款产品设计，点击 01–10 数字即可选款；不提供内置风格及手动上传选款。只有选图时才需要支持参考图输入的模型，不支持时不会静默忽略原图。
2. **产品效果图**：资深工业设计师角色，直接使用选定草图由 AI 生成效果图，无需上传产品效果图。修改名称、品牌、功能及深化说明不会取消已有选款；重新生成整张草图或改变编号才需要重新选款。AI 文字建议可人工修正；未调研的趋势和未验证功能保持为提案。生成状态、配置缺失及服务报错紧邻按钮显示。确认效果图为唯一外观基准，产品名称、品牌文字和主色统一管理。
3. **结构爆炸图**：资深结构／模具工程师角色，使用同一效果图参考，配合可编辑组件编号。PNG 按原生像素核对指定印刷宽度，写入不低于 300 dpi 的 pHYs；原图不足时阻止导出，不放大补像素。图片为结构示意，不能代替加工图。
4. **模具与 DFM**：收集材料牌号、供应商收缩率、外形、壁厚、公差和穴数。AI 基于文字及文件目录提出 DFM 建议，不能读取／验证 CAD 几何。支持产品三维、模具总装与正式加工图原件的本地保存、摘要校验和 ZIP 交付。真实资料不全时仅导出待审准备包；自动生成可直接拆图加工的全套三维模具尚未实现。包内外形 DXF 明确只作包络参考，绝非型腔或加工图。
5. **品牌包装**：资深品牌视觉设计师角色，可生成包装效果预览；打样文件单独输出可编辑 artwork.svg、毫米 1:1 dieline.svg／dieline.dxf、规格 JSON、工艺说明 ZIP。采用参数化反插口纸盒模板，输入真实内尺寸、纸材、粘口、插舌和出血；实际产品效果图直接嵌入包装，不重新绘制产品。当前矢量稿仍需印厂进行纸厚补偿、字体转曲、CMYK／专色、刀模和制版审查，并非已认证的最终印刷文件。

五步资料、选款与阶段随项目保存，图片和工程附件使用 IndexedDB。上游选款、品牌或产品资料改变会使下游图片失效；历史图片保留下载。工程附件单文件上限 30 MB、合计 90 MB，交付 ZIP 上限 128 MB。STEP／IGES 与 DXF 是中性／二维交换资料，不保证 SolidWorks、UG/NX、Creo、AutoCAD 的原生特征或直接加工兼容；以接收方实际校核为准。

文件规格参考：[W3C PNG pHYs](https://www.w3.org/TR/png/)、[Autodesk DXF 毫米单位](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-DXF/files/GUID-A85E8E67-27CD-4C59-BE61-4DC9FADBE74A.htm)、[SolidWorks DXF 二维导入](https://help.solidworks.com/2025/english/SolidWorks/slddxf/t_importingdxfdwg.htm?format=P&value=)。

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

OpenRouter 图片请求默认仅提交模型、提示词，以及用户选中的参考图；不再固定附加 aspect_ratio 或 n，原图尺寸使用模型默认值。HTTP 400 等错误会显示经过密钥与图片数据脱敏的服务商具体原因，不自动重试或计费调用其他模型。无参考图时不查询参考图能力，也不发送 input_references。


### 设计报告：PCB 产品策划与市场合规

在 Concept Studio 选定方案后进入「设计报告」，填写产品、目标地区、客群、硬件、价格与竞品、成本供应链和证据。两套独立的 12 章草稿使用 AI 模型中心的「设计报告」模型，可逐章修正并随项目保存；未配置模型可建立明确标为非 AI 的本地评审提纲。重新生成会覆盖当前类型草稿，请先导出保留修改。

「导出图文 PPTX」生成 16:9 可编辑演示稿，自动分页、引用当前概念已保存的产品效果图和结构图，保留原图比例，并加入可编辑的硬件架构、法务预审或阶段门槛示意。过期产品图和过期报告均显示提醒。缺少产品图时不伪造图片。Markdown 导出也包含两套草稿及输入。

合规报告仅为内部审查草稿，无实时法规检索。CCC、CE、FCC、RoHS、REACH 等按产品范围及地区条件评估；适用标准版本、化学限值、豁免、认证费用及法律结论须依据原文、测试与专业审查确认。内置官方入口供核查，不代表产品已取得认证。市场规模、竞品数据、成本和试验结果不得编造。
