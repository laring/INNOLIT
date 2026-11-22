import {generateConceptBatch} from '../src/concepts.ts'
import {freezeConcept} from '../src/conceptDevelopment.ts'
import {brief,developedConcept} from '../tests/fixtures/development.mjs'
export function demoProjects(){
 const batch=generateConceptBatch(brief),concept=freezeConcept(developedConcept(),'demo-freeze',1700000000000)
 concept.id='demo-concept';batch.concepts[0]=concept;batch.selectedId=concept.id
 return [{id:'demo-main',name:'演示 A · 无声休息牌',messages:[{id:'demo-user',role:'user',content:'设计一款课间安静休息的桌面工具。'},{id:'demo-answer',role:'assistant',content:'演示模拟：翻面开启无声休息计时，可拆卸维修。'}],updatedAt:1700000000000,conceptStudio:{draft:brief,rounds:[batch],activeRound:0}},{id:'demo-other',name:'演示 B · 隔离验证',messages:[],updatedAt:1700000000000}]
}
export const demoInputs={product:'无声翻面休息牌：翻面启动无声休息计时',markets:'首发建议：中国大陆',audience:'课间需要安静休息的中学生',hardware:'演示设计：整体双面外壳',positioning:'规划：简洁、安静、易操作',manufacturing:'演示批量：100件',evidence:'仅含演示资料，无真实市场、测试或认证记录'}
