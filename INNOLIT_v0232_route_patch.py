"""INNO LIT V0.2.3.2 routing patch. Run from repository root: python INNOLIT_v0232_route_patch.py"""
from pathlib import Path
import subprocess, shutil, sys, datetime
root=Path.cwd(); src=root/'src'
files=['App.tsx','ConceptStudio.tsx','RefinementWorkspace.tsx','VisualStudio.tsx']
original={f:(src/f).read_text(encoding='utf-8-sig') for f in files}
if not (src/'aiModelRouter.ts').exists(): sys.exit('缺少 src/aiModelRouter.ts，停止。')
backup=root/('.inno-lit-routing-backup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir()
for f,v in original.items(): (backup/f).write_text(v,encoding='utf-8')
def replace(s,old,new,filename):
 n=s.count(old)
 if n!=1: raise ValueError(f'{filename}: expected one anchor, found {n}: {old[:90]!r}')
 return s.replace(old,new,1)
try:
 a=original['App.tsx']
 a=replace(a,"import type { ImageSettings } from './imageGeneration'", "import type { ImageSettings } from './imageGeneration'\nimport { createEmptyRouting, resolveTextModel } from './aiModelRouter'\nimport type { AIModelRouting, AITask } from './aiModelRouter'",'App')
 a=replace(a,"  const [transfer, setTransfer]", "  const [routing, setRouting] = useState<AIModelRouting>(createEmptyRouting)\n  function editTaskSettings(task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) {\n    setRouting(current => {\n      const previous = current[task] ?? (task === 'image' ? imageSettings : modelSettings)\n      const next = { ...previous, ...change }\n      if (next.baseUrl.trim() !== previous.baseUrl.trim()) next.apiKey = ''\n      return { ...current, [task]: next } as AIModelRouting\n    })\n  }\n  function resetTaskSettings(task: AITask) {\n    setRouting(current => ({ ...current, [task]: null }))\n  }\n  const [transfer, setTransfer]",'App')
 a=replace(a,"            settings={modelSettings}\n            onSettingsChange={editModelSettings}\n            imageSettings={imageSettings}","            settings={modelSettings}\n            onSettingsChange={editModelSettings}\n            routing={routing}\n            onTaskSettingsChange={editTaskSettings}\n            onTaskReset={resetTaskSettings}\n            imageSettings={imageSettings}",'App')
 a=replace(a,"            settings={modelSettings}\n            onSettingsChange={editModelSettings}\n          />", "            settings={resolveTextModel('concept', routing, modelSettings)}\n            onSettingsChange={editModelSettings}\n          />",'App')
 c=original['ConceptStudio.tsx']
 c=replace(c,"import type { ImageSettings } from './imageGeneration'", "import type { ImageSettings } from './imageGeneration'\nimport { resolveTextModel, resolveImageModel } from './aiModelRouter'\nimport type { AIModelRouting, AITask } from './aiModelRouter'",'ConceptStudio')
 c=replace(c,"  imageSettings: ImageSettings\n", "  routing: AIModelRouting\n  onTaskSettingsChange: (task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) => void\n  onTaskReset: (task: AITask) => void\n  imageSettings: ImageSettings\n",'ConceptStudio')
 c=replace(c,"settings, onSettingsChange, imageSettings, onImageSettingsChange, idea, onDismissIdea", "settings, onSettingsChange, routing, onTaskSettingsChange, onTaskReset, imageSettings, onImageSettingsChange, idea, onDismissIdea",'ConceptStudio')
 c=replace(c,"  const configured = hasModelSettings(settings)", "  const conceptSettings = resolveTextModel('concept', routing, settings)\n  const refinementSettings = resolveTextModel('refinement', routing, settings)\n  const translationSettings = resolveTextModel('translation', routing, settings)\n  const routedImageSettings = resolveImageModel(routing, imageSettings)\n  const configured = hasModelSettings(conceptSettings)",'ConceptStudio')
 c=replace(c,"generateWithModel(draft, settings, signal)","generateWithModel(draft, conceptSettings, signal)",'ConceptStudio')
 c=replace(c,"            imageSettings={imageSettings}\n", "             imageSettings={routedImageSettings}\n            translationSettings={translationSettings}\n            routing={routing}\n            onTaskSettingsChange={onTaskSettingsChange}\n            onTaskReset={onTaskReset}\n            defaultTextSettings={settings}\n            defaultImageSettings={imageSettings}\n",'ConceptStudio')
 c=replace(c,"            settings={settings}\n            onSettingsChange={onSettingsChange}", "            settings={refinementSettings}\n            onSettingsChange={onSettingsChange}",'ConceptStudio')
 c=replace(c,"            settings={settings}\n            onDismiss={onDismissIdea}","            settings={conceptSettings}\n            onDismiss={onDismissIdea}",'ConceptStudio')
 c=replace(c,"               settings={settings}\n               onSettingsChange={change =>", "               settings={conceptSettings}\n               onSettingsChange={change => {\n                 onTaskSettingsChange('concept', change)\n                 setNotice('')\n               }}\n               customModel={customModel}\n               onModeChange={custom => {\n                 setCustomModel(custom)\n                 setNotice('')\n               }}\n               disabled={generating}\n               requestDescription=\"生成时会将当前设计简报发送给所选服务。\"\n             />\n           </div>\n           <div className=\"studio-actions\">\n             <label className=\"studio-field\">\n              生成数量\n               <select value={draft.count} disabled={generating} onChange={event => editDraft({ count: Number(event.target.value) as ConceptCount })}>\n                 {conceptCounts.map(count => <option key={count} value={count}>{count} 个</option>)}\n               </select>\n             </label>\n             <button type=\"submit\" className=\"studio-button primary\" disabled={!ready || Boolean(unchanged) || generating || (customModel && !configured)}>", 'ConceptStudio') if False else c
 # Concept Studio local ModelControls edits concept dedicated; leave default model controls for compatibility.
 c=replace(c,"onSettingsChange(change)\n                setNotice('')", "onTaskSettingsChange('concept', change)\n                setNotice('')",'ConceptStudio')
 c=replace(c,"`正在使用 ${settings.model.trim()} 生成概念…`", "`正在使用 ${conceptSettings.model.trim()} 生成概念…`",'ConceptStudio')
 c=replace(c,"                batch={batch}\n                settings={settings}","                batch={batch}\n                settings={refinementSettings}",'ConceptStudio')
 r=original['RefinementWorkspace.tsx']
 r=replace(r,"import type { ModelSettings } from './modelGeneration'", "import type { ModelSettings } from './modelGeneration'\nimport type { AIModelRouting, AITask } from './aiModelRouter'\nimport { TaskModelCenter } from './TaskModelCenter'",'Refinement')
 r=replace(r,"  imageSettings: ImageSettings\n", "  routing: AIModelRouting\n  onTaskSettingsChange: (task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) => void\n  onTaskReset: (task: AITask) => void\n  defaultTextSettings: ModelSettings\n  defaultImageSettings: ImageSettings\n  translationSettings: ModelSettings\n  imageSettings: ImageSettings\n",'Refinement')
 r=replace(r,"children, imageSettings, onImageSettingsChange, settings, onSettingsChange }: RefinementProps", "children, imageSettings, onImageSettingsChange, settings, onSettingsChange, routing, onTaskSettingsChange, onTaskReset, defaultTextSettings, defaultImageSettings, translationSettings }: RefinementProps",'Refinement')
 r=replace(r,'        <summary>深化 AI 模型设置</summary>\n        <ModelControls settings={settings} onSettingsChange={onSettingsChange} settingsOnly customModel onModeChange={() => {}} disabled={false}\n          requestDescription="深化分析、检索比较和完善总结共用此文字模型。模型建议由你修正与确认。" />', '        <summary>深化 AI 模型设置 · 统一模型中心</summary>\n        <TaskModelCenter routing={routing} defaultText={defaultTextSettings} defaultImage={defaultImageSettings} onChange={onTaskSettingsChange} onReset={onTaskReset} />','Refinement')
 r=replace(r,"import { ModelControls } from './ModelControls'\n",'', 'Refinement')
 r=replace(r,"        modelSettings={settings} ","        modelSettings={translationSettings} ",'Refinement')
 v=original['VisualStudio.tsx']
 import re
 pattern=r'\n\s*<details className="visual-api-settings">.*?</details>'
 if len(re.findall(pattern,v,flags=re.S))!=1: raise ValueError('VisualStudio: image settings panel not found uniquely')
 v=re.sub(pattern,'\n              <p className="studio-hint">图像模型：{imageSettings.model || "未配置"}。请在「深化 AI 模型设置」统一管理。</p>',v,count=1,flags=re.S)
 v=replace(v,"import { imageSizes } from './imageGeneration'\n",'', 'VisualStudio')
 v=replace(v,"  onImageSettingsChange: (\n    change: Partial<ImageSettings>,\n  ) => void\n",'', 'VisualStudio')
 v=replace(v,"  onImageSettingsChange,\n",'', 'VisualStudio')
 # No longer needed after removing settings panel
 r=replace(r,"import { ModelControls } from './ModelControls'\n",'', 'Refinement') if "import { ModelControls } from './ModelControls'\n" in r else r
 center='''import type { ModelSettings } from './modelGeneration'
import type { ImageSettings } from './imageGeneration'
import { imageSizes } from './imageGeneration'
import { aiTasks } from './aiModelRouter'
import type { AIModelRouting, AITask } from './aiModelRouter'

type Props = {
  routing: AIModelRouting
  defaultText: ModelSettings
  defaultImage: ImageSettings
  onChange: (task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) => void
  onReset: (task: AITask) => void
}
const presets = [
  { label: 'DeepSeek', url: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { label: '硅基流动', url: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3-8B' },
  { label: '阿里云百炼', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
] as const
const tasks = Object.keys(aiTasks) as AITask[]
export function TaskModelCenter({ routing, defaultText, defaultImage, onChange, onReset }: Props) {
  return (
    <div className="model-settings">
      <p>四类任务可独立配置。未单独配置时继承默认模型。API Key 只保留在本次页面会话中。</p>
      {tasks.map(task => {
        const image = task === 'image'
        const fallback = image ? defaultImage : defaultText
        const active = routing[task] ?? fallback
        return (
          <fieldset key={task} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <legend><strong>{aiTasks[task]}</strong></legend>
            <label>
              配置方式
              <select value={routing[task] ? 'dedicated' : 'fallback'} onChange={event => {
                if (event.target.value === 'fallback') onReset(task)
                else onChange(task, { ...fallback })
              }}>
                <option value="fallback">继承默认配置</option>
                <option value="dedicated">独立模型</option>
              </select>
            </label>
            {routing[task] && (
              <>
                <label>服务商预设
                  <select value="" onChange={event => {
                    const preset = presets.find(item => item.label === event.target.value)
                    if (preset) onChange(task, { baseUrl: preset.url, model: preset.model })
                  }}>
                    <option value="">选择预设或手动填写</option>
                    {(image ? presets.filter(item => item.label === '硅基流动') : presets).map(item => <option key={item.label} value={item.label}>{item.label}</option>)}
                  </select>
                </label>
                <label>API 地址
                  <input value={active.baseUrl} onChange={event => onChange(task, { baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
                </label>
                <label>模型 ID
                  <input value={active.model} onChange={event => onChange(task, { model: event.target.value })} />
                </label>
                <label>API Key
                  <input type="password" autoComplete="off" value={active.apiKey} onChange={event => onChange(task, { apiKey: event.target.value })} />
                </label>
                {image && (
                  <>
                    <label>图像接口协议
                      <select value={(active as ImageSettings).protocol} onChange={event => onChange(task, { protocol: event.target.value as ImageSettings['protocol'] })}>
                        <option value="siliconflow">SiliconFlow</option>
                        <option value="images">Images 兼容接口</option>
                      </select>
                    </label>
                    <label>母版尺寸
                      <select value={(active as ImageSettings).size} onChange={event => onChange(task, { size: event.target.value as ImageSettings['size'] })}>
                        {imageSizes.map(size => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            <p className="studio-hint">当前模型：{active.model || '未配置'}{routing[task] ? '（独立）' : '（继承）'}</p>
          </fieldset>
        )
      })}
      <p className="studio-hint">当前仅支持现有后端兼容的云端接口。Ollama、Gemini、Claude 等非兼容接口需后端适配；模型预设不代表已通过连接测试。</p>
    </div>
  )
}
'''
 # remove no longer used VisualStudio onImageSettingsChange from refinement's VisualStudio invocation
 r=replace(r,"        onImageSettingsChange={onImageSettingsChange} />", "         />", 'Refinement')
 # Refinement still has onImageSettingsChange prop unused; remove from destructuring only, keep type for compatibility
 r=replace(r,"children, imageSettings, onImageSettingsChange, settings,", "children, imageSettings, settings,", 'Refinement')
 # VisualStudio still has onImageSettingsChange removed, and Refinement no longer uses it
 updates={'App.tsx':a,'ConceptStudio.tsx':c,'RefinementWorkspace.tsx':r,'VisualStudio.tsx':v,'TaskModelCenter.tsx':center}
 for f,content in updates.items(): (src/f).write_text(content,encoding='utf-8')
 print('已写入五个文件。备份目录：',backup)
 print('请运行 npm run build 和 npm run lint；若失败，使用备份恢复四个原文件，并删除 TaskModelCenter.tsx。')
except Exception as exc:
 print('修改中止，未写入任何源码：',exc)
 sys.exit(1)
