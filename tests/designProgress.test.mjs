import {test} from 'node:test'
import assert from 'node:assert/strict'
import {designProgress} from '../src/designProgress.ts'
import {demoProjects} from '../demo/fixture.mjs'
import {planningContext,planningTemplate,emptyPlanningInputs} from '../src/planningReport.ts'
test('progress follows active project and round instead of chat text or unrelated history',()=>{
 const [project,other]=structuredClone(demoProjects())
 assert.deepEqual(designProgress(other).map(step=>step.done),[false,false,false,false,false])
 assert.deepEqual(designProgress(project).map(step=>step.done),[true,true,true,true,false])
 project.conceptStudio.activeRound=99
 assert.deepEqual(designProgress(project).map(step=>step.done),[true,false,false,false,false])
 project.conceptStudio.draft.audience=' '
 assert.equal(designProgress(project)[0].done,false)
})
test('unselected concepts, stale review and report skeletons do not count as complete',()=>{
 const [project]=structuredClone(demoProjects()),batch=project.conceptStudio.rounds[0],concept=batch.concepts[0]
 const id=batch.selectedId;batch.selectedId=null;assert.equal(designProgress(project)[2].done,false);batch.selectedId=id
 concept.research.evidence[0].comparison='modified';assert.equal(designProgress(project)[3].done,false)
 concept.planningReport={inputs:{...emptyPlanningInputs}}
 const key=planningContext(concept,concept.planningReport.inputs)
 concept.planningReport.product=planningTemplate('product',key)
 assert.equal(designProgress(project)[4].done,false)
 concept.planningReport.product.sections.forEach(section=>{section.body='人工填写正文'})
 assert.equal(designProgress(project)[4].done,true)
 concept.notes+=' changed';assert.equal(designProgress(project)[4].done,false)
})

