
# INNO LIT V0.2.3.3-B Stage 2
# Global AI Model Center
# Run from D:\test\inno-lit

$ErrorActionPreference = "Stop"
$root = "D:\test\inno-lit"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root ".inno-lit-stage2-backup-$stamp"
$stage = Join-Path $env:TEMP "innolit-stage2-$stamp"

Set-Location $root

$files = @(
    "src\App.tsx",
    "src\ConceptStudio.tsx",
    "src\CreativeChat.tsx",
    "src\RefinementWorkspace.tsx",
    "src\TaskModelCenter.tsx",
    "src\ModelControls.tsx",
    "src\App.css"
)

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        throw "Missing file: $file"
    }
}

New-Item -ItemType Directory -Force $backup, $stage | Out-Null

foreach ($file in $files) {
    $folder = Split-Path $file -Parent
    New-Item -ItemType Directory -Force (Join-Path $backup $folder) | Out-Null
    New-Item -ItemType Directory -Force (Join-Path $stage $folder) | Out-Null
    Copy-Item $file (Join-Path $backup $file)
    Copy-Item $file (Join-Path $stage $file)
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$file) {
    $content = [System.IO.File]::ReadAllText(
        (Join-Path $stage $file)
    )

    # 统一临时源码中的换行符，避免 CRLF/LF 匹配失败
    return $content.Replace("`r`n", "`n").Replace("`r", "`n")
}

function Save-Source([string]$file, [string]$content) {
    [System.IO.File]::WriteAllText(
        (Join-Path $stage $file),
        $content,
        $utf8
    )
}

function Replace-Once(
    [string]$source,
    [string]$old,
    [string]$new,
    [string]$description
) {
    # 统一换行符，并去除 here-string 意外产生的首尾换行
    $old = $old.Replace("`r`n", "`n").Trim("`n")
    $new = $new.Replace("`r`n", "`n").Trim("`n")

    $first = $source.IndexOf(
        $old,
        [StringComparison]::Ordinal
    )

    if ($first -lt 0) {
        throw "Source mismatch: $description"
    }

    $second = $source.IndexOf(
        $old,
        $first + $old.Length,
        [StringComparison]::Ordinal
    )

    if ($second -ge 0) {
        throw "Ambiguous replacement: $description"
    }

    return $source.Substring(0, $first) +
           $new +
           $source.Substring($first + $old.Length)
}

function Remove-Once(
    [string]$source,
    [string]$old,
    [string]$description
) {
    return Replace-Once $source $old "" $description
}

Write-Host "Stage 2: preparing source changes..." -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. App.tsx: global model center
# ------------------------------------------------------------

$s = Read-Source "src\App.tsx"

$s = Replace-Once $s `
    "PanelRightOpen, FolderOpen, Trash2" `
    "PanelRightOpen, FolderOpen, Trash2, Settings2" `
    "App icon import"

$s = Replace-Once $s `
    "import { CreativeChat } from './CreativeChat'" `
    "import { CreativeChat } from './CreativeChat'`nimport { TaskModelCenter } from './TaskModelCenter'" `
    "TaskModelCenter import"

$s = Replace-Once $s `
    "  const [routing, setRouting] = useState<AIModelRouting>(createEmptyRouting)" `
    "  const [routing, setRouting] = useState<AIModelRouting>(createEmptyRouting)`n  const [modelCenterOpen, setModelCenterOpen] = useState(false)" `
    "Global model center state"

$old = @'
        {saveFailed && <p className="workspace-save-error"
'@

$new = @'
        <div className="global-model-center-toggle">
          <button
            type="button"
            aria-expanded={modelCenterOpen}
            aria-controls="global-ai-model-center"
            onClick={() => setModelCenterOpen(open => !open)}
          >
            <Settings2 size={16} />
            AI 模型中心
          </button>
        </div>

        {modelCenterOpen && (
          <section
            id="global-ai-model-center"
            className="studio-surface global-model-center"
            aria-label="全局 AI 模型中心"
          >
            <div className="global-model-center-header">
              <h2>AI 模型中心</h2>
              <button
                type="button"
                onClick={() => setModelCenterOpen(false)}
              >
                关闭
              </button>
            </div>

            <TaskModelCenter
              routing={routing}
              defaultText={modelSettings}
              defaultImage={imageSettings}
              onDefaultTextChange={editModelSettings}
              onDefaultImageChange={editImageSettings}
              onChange={editTaskSettings}
              onReset={resetTaskSettings}
            />
          </section>
        )}

        {saveFailed && <p className="workspace-save-error"
'@

$s = Replace-Once $s $old $new "Global model center UI"

$s = Replace-Once $s `
    "            onSettingsChange={editModelSettings}`n            routing={routing}" `
    "            routing={routing}`n            onOpenModelCenter={() => setModelCenterOpen(true)}" `
    "ConceptStudio model center callback"

$s = Replace-Once $s `
    "            onSettingsChange={editModelSettings}`n          />" `
    "            onOpenModelCenter={() => setModelCenterOpen(true)}`n          />" `
    "CreativeChat model center callback"

# Remove obsolete ConceptStudio model-setting props

$obsoleteAppProps = @(
    '            onTaskSettingsChange={editTaskSettings}'
    '            onTaskReset={resetTaskSettings}'
    '            onImageSettingsChange={editImageSettings}'
)

foreach ($prop in $obsoleteAppProps) {
    $s = Remove-Once $s $prop "App obsolete ConceptStudio prop"
}
Save-Source "src\App.tsx" $s

# ------------------------------------------------------------
# 2. ConceptStudio.tsx
# ------------------------------------------------------------

$s = Read-Source "src\ConceptStudio.tsx"

$s = Remove-Once $s `
    "  onSettingsChange: (change: Partial<ModelSettings>) => void`n" `
    "ConceptStudio old settings callback"

$s = Remove-Once $s `
    "  onTaskSettingsChange: (task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) => void`n" `
    "ConceptStudio task edit prop"

$s = Remove-Once $s `
    "  onTaskReset: (task: AITask) => void`n" `
    "ConceptStudio task reset prop"

$s = Remove-Once $s `
    "  onImageSettingsChange: (change: Partial<ImageSettings>) => void`n" `
    "ConceptStudio image edit prop"

$s = Replace-Once $s `
    "  onDismissIdea: () => void" `
    "  onDismissIdea: () => void`n  onOpenModelCenter: () => void" `
    "ConceptStudio open callback prop"

$s = Replace-Once $s `
    "settings, onSettingsChange, routing, onTaskSettingsChange, onTaskReset, imageSettings, onImageSettingsChange, idea, onDismissIdea" `
    "settings, routing, imageSettings, idea, onDismissIdea, onOpenModelCenter" `
    "ConceptStudio component parameters"

$old = @'
              settings={settings}
              onSettingsChange={change => {
                onTaskSettingsChange('concept', change)
                setNotice('')
              }}
'@

$new = @'
              settings={conceptSettings}
              onOpenModelCenter={onOpenModelCenter}
'@

$s = Replace-Once $s $old $new "ConceptStudio ModelControls"

$removeProps = @(
    "            routing={routing}`n",
    "            onTaskSettingsChange={onTaskSettingsChange}`n",
    "            onTaskReset={onTaskReset}`n",
    "            defaultTextSettings={settings}`n",
    "            defaultImageSettings={imageSettings}`n",
    "            onImageSettingsChange={onImageSettingsChange}`n",
    "            onSettingsChange={onSettingsChange}`n"
)

foreach ($prop in $removeProps) {
    $s = Remove-Once $s $prop "RefinementWorkspace obsolete prop"
}

$s = Replace-Once $s `
    "import type { AIModelRouting, AITask } from './aiModelRouter'" `
    "import type { AIModelRouting } from './aiModelRouter'" `
    "ConceptStudio unused AITask import"

Save-Source "src\ConceptStudio.tsx" $s

# ------------------------------------------------------------
# 3. CreativeChat.tsx
# ------------------------------------------------------------

$s = Read-Source "src\CreativeChat.tsx"

$s = Replace-Once $s `
    "  onSettingsChange: (change: Partial<ModelSettings>) => void" `
    "  onOpenModelCenter: () => void" `
    "CreativeChat callback type"

$s = Replace-Once $s `
    "settings, onSettingsChange }: ChatProps" `
    "settings, onOpenModelCenter }: ChatProps" `
    "CreativeChat component parameters"

$old = @'
              onSettingsChange={change => {
                onSettingsChange(change)
                setNotice('')
              }}
'@

$new = @'
              onOpenModelCenter={onOpenModelCenter}
'@

$s = Replace-Once $s $old $new "CreativeChat ModelControls"

Save-Source "src\CreativeChat.tsx" $s

# ------------------------------------------------------------
# 4. RefinementWorkspace.tsx
# ------------------------------------------------------------

$s = Read-Source "src\RefinementWorkspace.tsx"

$s = Remove-Once $s `
    "import type { AIModelRouting, AITask } from './aiModelRouter'`n" `
    "Refinement routing import"

$s = Remove-Once $s `
    "import { TaskModelCenter } from './TaskModelCenter'`n" `
    "Refinement duplicate model center import"

$obsoleteTypes = @(
    "  routing: AIModelRouting`n",
    "  onTaskSettingsChange: (task: AITask, change: Partial<ModelSettings> | Partial<ImageSettings>) => void`n",
    "  onTaskReset: (task: AITask) => void`n",
    "  defaultTextSettings: ModelSettings`n",
    "  defaultImageSettings: ImageSettings`n",
    "  onImageSettingsChange: (change: Partial<ImageSettings>) => void`n",
    "  onSettingsChange: (change: Partial<ModelSettings>) => void`n"
)

foreach ($prop in $obsoleteTypes) {
    $s = Remove-Once $s $prop "Refinement obsolete type"
}

$s = Replace-Once $s `
    "imageSettings, settings, routing, onTaskSettingsChange, onTaskReset, defaultTextSettings, defaultImageSettings, translationSettings" `
    "imageSettings, settings, translationSettings" `
    "Refinement component parameters"

# Remove duplicate model center using exact boundaries

$startMarker = '<details className="studio-surface development-model-settings">'
$endMarker = '</details>'

$start = $s.IndexOf($startMarker, [StringComparison]::Ordinal)

if ($start -lt 0) {
    throw "Cannot find development model center start marker"
}

$nextStart = $s.IndexOf(
    $startMarker,
    $start + $startMarker.Length,
    [StringComparison]::Ordinal
)

if ($nextStart -ge 0) {
    throw "Multiple development model centers found"
}

$end = $s.IndexOf(
    $endMarker,
    $start + $startMarker.Length,
    [StringComparison]::Ordinal
)

if ($end -lt 0) {
    throw "Cannot find development model center end marker"
}

$end += $endMarker.Length

$oldBlock = $s.Substring($start, $end - $start)

if (
    -not $oldBlock.Contains('<summary>AI 模型中心</summary>') -or
    -not $oldBlock.Contains('<TaskModelCenter')
) {
    throw "Unexpected content inside development model center"
}

$newBlock = @'
<p className="studio-hint">
        方案深化模型：{settings.model.trim() || '未配置'}
        （在全局 AI 模型中心管理）
      </p>
'@

$s = $s.Substring(0, $start) +
     $newBlock +
     $s.Substring($end)

Save-Source "src\RefinementWorkspace.tsx" $s

# ------------------------------------------------------------
# 5. TaskModelCenter.tsx: default model configuration
# ------------------------------------------------------------

$s = Read-Source "src\TaskModelCenter.tsx"

$s = Replace-Once $s `
    "  onChange: (task:" `
    "  onDefaultTextChange: (change: Partial<ModelSettings>) => void`n  onDefaultImageChange: (change: Partial<ImageSettings>) => void`n  onChange: (task:" `
    "Default model callback types"

$s = Replace-Once $s `
    "defaultText, defaultImage, onChange, onReset }: Props" `
    "defaultText, defaultImage, onDefaultTextChange, onDefaultImageChange, onChange, onReset }: Props" `
    "Default model callback parameters"

$defaults = @'
      <fieldset className="global-model-defaults">
        <legend><strong>默认文本模型</strong></legend>
        <p className="studio-hint">未独立配置的文本任务继承此模型。</p>

        <label>API 地址
          <input
            value={defaultText.baseUrl}
            onChange={e => onDefaultTextChange({ baseUrl: e.target.value })}
          />
        </label>

        <label>模型 ID
          <input
            value={defaultText.model}
            onChange={e => onDefaultTextChange({ model: e.target.value })}
          />
        </label>

        <label>API Key
          <input
            type="password"
            autoComplete="off"
            value={defaultText.apiKey}
            onChange={e => onDefaultTextChange({ apiKey: e.target.value })}
          />
        </label>
      </fieldset>

      <fieldset className="global-model-defaults">
        <legend><strong>默认图像模型</strong></legend>

        <label>API 地址
          <input
            value={defaultImage.baseUrl}
            onChange={e => onDefaultImageChange({ baseUrl: e.target.value })}
          />
        </label>

        <label>模型 ID
          <input
            value={defaultImage.model}
            onChange={e => onDefaultImageChange({ model: e.target.value })}
          />
        </label>

        <label>API Key
          <input
            type="password"
            autoComplete="off"
            value={defaultImage.apiKey}
            onChange={e => onDefaultImageChange({ apiKey: e.target.value })}
          />
        </label>

        <label>图像接口协议
          <select
            value={defaultImage.protocol}
            onChange={e => onDefaultImageChange({
              protocol: e.target.value as ImageSettings['protocol']
            })}
          >
            <option value="siliconflow">SiliconFlow</option>
            <option value="images">Images 兼容接口</option>
          </select>
        </label>

        <label>母版尺寸
          <select
            value={defaultImage.size}
            onChange={e => onDefaultImageChange({
              size: e.target.value as ImageSettings['size']
            })}
          >
            {imageSizes.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </fieldset>

'@

$s = Replace-Once $s `
    "      {tasks.map(task => {" `
    ($defaults + "      {tasks.map(task => {") `
    "Default model configuration UI"

Save-Source "src\TaskModelCenter.tsx" $s

# ------------------------------------------------------------
# 6. App.css
# ------------------------------------------------------------

$s = Read-Source "src\App.css"

$css = @'

/* V0.2.3.3-B: Global AI Model Center */

.global-model-center-toggle {
  padding: 8px 18px;
}

.global-model-center-toggle button,
.global-model-center-header button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid #d5ded4;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.global-model-center {
  margin: 10px 18px;
  padding: 18px;
}

.global-model-center-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.global-model-defaults {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.global-model-center .model-settings label {
  display: grid;
  gap: 5px;
  margin: 8px 0;
}

.global-model-center .model-settings input,
.global-model-center .model-settings select {
  max-width: 100%;
  min-width: 0;
  padding: 9px;
  border: 1px solid #d5ded4;
  border-radius: 7px;
}

'@

if ($s.Contains("/* V0.2.3.3-B: Global AI Model Center */")) {
    throw "Stage 2 CSS appears to be already installed"
}

Save-Source "src\App.css" ($s + $css)

# ------------------------------------------------------------
# 7. Check current ModelControls.tsx
# ------------------------------------------------------------

$s = Read-Source "src\ModelControls.tsx"

if (-not $s.Contains("onOpenModelCenter")) {
    throw "ModelControls.tsx is not the expected version"
}

if ($s.Contains("onSettingsChange")) {
    throw "ModelControls still contains an old settings callback"
}

# ------------------------------------------------------------
# 8. Apply all changes
# ------------------------------------------------------------

Write-Host "Source checks passed." -ForegroundColor Green
Write-Host "Backup: $backup"

$installed = $false

try {
    foreach ($file in $files) {
        Copy-Item (Join-Path $stage $file) `
                  (Join-Path $root $file) -Force
    }

    $installed = $true

    Write-Host ""
    Write-Host "Running build..." -ForegroundColor Cyan

    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }

    Write-Host "Running lint..." -ForegroundColor Cyan

    npm run lint
    if ($LASTEXITCODE -ne 0) {
        throw "Lint failed"
    }

    Write-Host "Running development tests..." -ForegroundColor Cyan

    node --test tests/development.test.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "Development tests failed"
    }

    Write-Host ""
    Write-Host "STAGE 2 VALIDATION PASSED" -ForegroundColor Green
    Write-Host "Backup: $backup"
    Write-Host "No Git commit has been created."

} catch {
    Write-Host ""
    Write-Host "Validation failed: $($_.Exception.Message)" -ForegroundColor Red

    if ($installed) {
        Write-Host "Restoring source files from backup..." -ForegroundColor Yellow

        foreach ($file in $files) {
            Copy-Item (Join-Path $backup $file) `
                      (Join-Path $root $file) -Force
        }

        Write-Host "Source restoration completed." -ForegroundColor Yellow
    }

    throw
}
