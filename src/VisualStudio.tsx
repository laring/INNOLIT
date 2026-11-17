import { ProductWorkflowStudio } from './ProductWorkflowStudio'
import type { Concept, ConceptBatch } from './concepts'
import type { ImageSettings } from './imageGeneration'
import type { ModelSettings } from './modelGeneration'
import './VisualStudio.css'

type VisualProps = {
  projectId: string; projectName: string; round: ConceptBatch; roundNumber: number
  concept: Concept; imageSettings: ImageSettings; imageConfiguration: string; modelSettings: ModelSettings; reportSettings?: ModelSettings
  onChange: (update: (current: Concept) => Concept) => void
}
export function VisualStudio(props: VisualProps) {
  return <>
    <p className="studio-hint" role="status">当前实际图片配置：{props.imageConfiguration}（与顶部 AI 模型中心同步）</p>
    <ProductWorkflowStudio {...props} />
  </>
}
