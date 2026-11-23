import { ProductWorkflowStudio } from './ProductWorkflowStudio'
import type { Concept, ConceptBatch } from './concepts'
import type { ImageSettings } from './imageGeneration'
import type { ModelSettings } from './modelGeneration'
import './VisualStudio.css'

type VisualProps = {
  imageModels?: {sketchImage:ImageSettings;heroImage:ImageSettings;presentationImage:ImageSettings}
  projectId: string; projectName: string; round: ConceptBatch; roundNumber: number
  concept: Concept; imageSettings: ImageSettings; imageConfiguration: string; modelSettings: ModelSettings; reportSettings?: ModelSettings; stepSettings?: ModelSettings
  onChange: (update: (current: Concept) => Concept) => void
}
export function VisualStudio(props: VisualProps) {
  return <>
    <details><summary>查看当前图片模型配置</summary><p className="studio-hint">{props.imageConfiguration}</p></details>
    <ProductWorkflowStudio {...props} />
  </>
}
