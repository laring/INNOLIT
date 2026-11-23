import type {Project} from './projects.ts'
import {getProjectStudio} from './projects.ts'
import {sentenceLabels} from './concepts.ts'
import {stepConfirmed} from './conceptDevelopment.ts'
import {emptyPlanningInputs,planningContext,planningModules,planningTemplate} from './planningReport.ts'
import {reportContext} from './reportModel.ts'
export function designProgress(project:Project){
 const studio=getProjectStudio(project),batch=studio.rounds[studio.activeRound],concept=batch?.concepts.find(item=>item.id===batch.selectedId)
 const brief=studio.draft
 const problem=Boolean(brief.problem.trim()&&brief.audience.trim()&&brief.scenario.trim())
 const directions=Boolean(batch?.concepts.length)
 const selected=Boolean(concept&&concept.title.trim()&&Object.keys(sentenceLabels).every(key=>concept.sentences[key as keyof typeof sentenceLabels]?.trim()))
 const reviewed=Boolean(concept&&(stepConfirmed(concept,'validation')&&stepConfirmed(concept,'research')))
 const planning=concept?.planningReport,report=planning?.product
 const completeReport=Boolean(concept&&((concept.aiReport?.text.trim()&&concept.aiReport.contextKey===reportContext(concept))||(report&&report.contextKey===planningContext(concept,{...emptyPlanningInputs,...planning?.inputs})&&report.sections.length===planningModules.product.length&&report.sections.every((section,index)=>section.title.trim()&&section.body.trim()&&section.body.trim()!==planningTemplate('product',report.contextKey).sections[index]?.body.trim()))))
 return [
 {title:'01 · 问题与场景',done:problem,detail:'填写设计问题、目标用户和使用场景'},
 {title:'02 · 创意方向',done:directions,detail:'在当前轮次生成或整理创意方向'},
 {title:'03 · 产品概念',done:selected,detail:'选定方案并完善九句话概念'},
 {title:'04 · 可行性验证与原创性检索',done:reviewed,detail:'完成当前方案的验证与检索资料并人工确认'},
 {title:'05 · 设计报告',done:completeReport,detail:'保存内容完整、与当前资料一致的设计报告'},
 ]
}
