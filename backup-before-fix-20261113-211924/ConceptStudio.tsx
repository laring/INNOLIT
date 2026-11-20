import { useEffect, useRef, useState } from 'react'

import type { FormEvent } from 'react'

import { ArrowLeft, ArrowRight, Layers } from 'lucide-react'

import {

  addChatConcept, appendConceptRound, conceptCounts, conceptSourceLabel, draftFromConcept, normalizeDraft, sentenceLabels,

  startingPointLimit,

  modelSourceLabel,

} from './concepts'

import type {

  ChatIdea, Concept, ConceptBatch, ConceptCount, ConceptDraft, ConceptStudioState, Score, ScoreDimension,

} from './concepts'

import { RefinementWorkspace } from './RefinementWorkspace'

import { canUseCustomModel, generateWithModel, hasModelSettings } from './modelGeneration'

import type { ModelSettings } from './modelGeneration'

import type { ImageSettings } from './imageGeneration'

import { resolveTextModel, resolveImageModel } from './aiModelRouter'

import type { AIModelRouting } from './aiModelRouter'

import { ModelControls } from './ModelControls'

import { ChatConceptImport } from './ChatConceptImport'

import { ConceptComparison } from './ConceptComparison'

import './ConceptStudio.css'
















type StudioProps = {

  projectId: string

  projectName: string

  state: ConceptStudioState

  onChange: (update: (current: ConceptStudioState) => ConceptStudioState) => void

  settings: ModelSettings



  routing: AIModelRouting





  imageSettings: ImageSettings



  idea?: ChatIdea

  onDismissIdea: () => void

  onOpenModelCenter: () => void

}



const sentences = Object.keys(sentenceLabels) as (keyof typeof sentenceLabels)[]



function ConceptFramework({ concept }: { concept: Concept }) {