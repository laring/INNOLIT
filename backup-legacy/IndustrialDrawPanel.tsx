
import type {
  DesignFreezeMode,
  IndustrialDrawTask,
} from './industrialDesignTasks'

import {
  INDUSTRIAL_DRAW_TASKS,
} from './industrialDesignTasks'

interface Props {
  task: IndustrialDrawTask
  onTaskChange: (task: IndustrialDrawTask) => void
  styleDescription: string
  onStyleChange: (value: string) => void
  freezeMode: DesignFreezeMode
  onFreezeModeChange: (value: DesignFreezeMode) => void
}

export function IndustrialDrawPanel({
  task,
  onTaskChange,
  styleDescription,
  onStyleChange,
  freezeMode,
  onFreezeModeChange,
}: Props) {
  return (
    <section
      className="industrial-draw-panel"
      aria-label="专业工业设计绘图"
    >
      <h3>专业工业设计绘图</h3>

      <div className="industrial-draw-task-grid">
        {INDUSTRIAL_DRAW_TASKS.map(item => (
          <button
            key={item.id}
            type="button"
            className="industrial-draw-task"
            aria-pressed={task === item.id}
            onClick={() => onTaskChange(item.id)}
          >
            <strong>{item.name}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>

      {task !== 'original' && (
        <>
          <label className="studio-field">
            风格描述
            <textarea
              value={styleDescription}
              onChange={event =>
                onStyleChange(event.target.value)
              }
              placeholder={
                '例如：轻盈、太空感、银白色、年轻化、' +
                '极简曲面、绿色制造'
              }
              rows={3}
            />
          </label>

          {task === 'hero-render' && (
            <fieldset>
              <legend>产品外观状态</legend>

              <label>
                <input
                  type="radio"
                  name="industrial-freeze"
                  checked={freezeMode === 'explore'}
                  onChange={() =>
                    onFreezeModeChange('explore')
                  }
                />
                创意探索
              </label>

              <label>
                <input
                  type="radio"
                  name="industrial-freeze"
                  checked={freezeMode === 'locked'}
                  onChange={() =>
                    onFreezeModeChange('locked')
                  }
                />
                外观锁定
              </label>
            </fieldset>
          )}

          <p className="studio-hint">
            {task === 'ten-sketches'
              ? '生成一张包含十个不同设计方向的草图板。'
              : freezeMode === 'locked'
                ? '保持参考产品外观一致，仅优化视觉表现。'
                : '探索更具创新性的产品形态与视觉语言。'}
          </p>
        </>
      )}
    </section>
  )
}
