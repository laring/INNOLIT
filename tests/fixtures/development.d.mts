import type {Concept,ConceptDraft,ModelSource} from '../../src/concepts.ts'
import type {ProductIdentity} from '../../src/conceptDevelopment.ts'
export const brief:ConceptDraft
export const source:ModelSource
export const identity:ProductIdentity
export function responseFor(stage:string,input?:Record<string,unknown>):Record<string,unknown>
export function developedConcept():Concept
