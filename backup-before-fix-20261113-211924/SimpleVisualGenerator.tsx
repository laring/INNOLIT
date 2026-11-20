
import { useEffect, useRef, useState } from 'react'
import type { Concept, ConceptBatch } from './concepts'
import { developmentOf } from './conceptDevelopment'
import {
  generateConceptImage,
  imageSizes,
  supportsImageReference,
} from './imageGeneration'
import type { ImageSettings } from './imageGeneration'
import type { ModelSettings } from './modelGeneration'
import { translateVisualWithAI } from './visualPromptAI'
import { getVisual, putVisual } from './visualStore'
import type { SavedVisual } from './visualStore'
import { downloadBlob } from './conceptBoard'
import { industrialDesignPrompt, industrialTaskNames } from './industrialDesignTasks'
import type { IndustrialTask } from './industrialDesignTasks'

type GenerateMode = 'concept' | 'board'
type OutputSize = 'landscape' | 'portrait' | 'square'

type Props = {
  projectId: string
  roundNumber: number
  frozenId?: string
  concept: Concept
  round: ConceptBatch
  settings: ImageSettings
  textSettings?: ModelSettings
  masterBlob?: Blob
}

type SizeConfig = {
  width: number
  height: number
  apiSize: typeof imageSizes[number]
}

const MAX_JPG_BYTES = 5 * 1024 * 1024

const sizes: Record<OutputSize, SizeConfig> = {
  landscape: {
    width: 4750,
    height: 3167,
    apiSize: '1536x1024',
  },
  portrait: {
    width: 3167,
    height: 4750,
    apiSize: '1024x1536',
  },
  square: {
    width: 1024,
    height: 1024,
    apiSize: '1024x1024',
  },
}

function recordKey(
  projectId: string,
  roundNumber: number,
  conceptId: string,
  frozenId: string | undefined,
  mode: GenerateMode,
  size: OutputSize,
  task: IndustrialTask,
) {
  return JSON.stringify([
    'simple-visual-v022',
    projectId,
    roundNumber,
    conceptId,
    frozenId ?? 'unfrozen',
    mode,
    size,
    ...(task === 'original' ? [] : [task]),
  ])
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error('无法读取产品母版图片。'))

    reader.readAsDataURL(blob)
  })
}

async function exportJpeg(
  source: Blob,
  width: number,
  height: number,
): Promise<Blob> {