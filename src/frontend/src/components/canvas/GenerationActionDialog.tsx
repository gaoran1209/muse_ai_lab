import { useEffect, useMemo, useState } from 'react';
import type { Look } from '../../types';
import './GenerationActionDialog.css';

type GenerationAction = 'change_model' | 'change_background';

interface GenerationActionDialogProps {
  open: boolean;
  look: Look | null;
  action: GenerationAction | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    presetId: string;
    customPrompt?: string;
    parameters: Record<string, string>;
  }) => Promise<void>;
}

const MODEL_PRESETS = [
  { id: 'model_01', title: 'Model 01', copy: '亚洲女性模特，利落短发，都市感。' },
  { id: 'model_02', title: 'Model 02', copy: '欧洲男性模特，商业时装风格。' },
  { id: 'model_03', title: 'Model 03', copy: '中性模特，极简高级感。' },
];

const BACKGROUND_PRESETS = [
  { id: 'scene_01', title: '街拍-行走', copy: '城市街拍，自然光，轻微动态。' },
  { id: 'scene_02', title: '棚拍-站姿', copy: '白色摄影棚，柔光，电商主图。' },
  { id: 'scene_03', title: '生活方式', copy: '室内暖光，内容社区分发感。' },
];

export function GenerationActionDialog({
  open,
  look,
  action,
  busy,
  onClose,
  onSubmit,
}: GenerationActionDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState('');
  const [mode, setMode] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  const presets = useMemo(
    () => (action === 'change_model' ? MODEL_PRESETS : BACKGROUND_PRESETS),
    [action]
  );

  useEffect(() => {
    if (!open || !action) return;
    setSelectedPreset(presets[0]?.id ?? '');
    setMode(action === 'change_model' ? 'replicate' : 'blend');
    setCustomPrompt('');
  }, [action, open, presets]);

  if (!open || !action || !look) return null;

  const dialogTitle = action === 'change_model' ? '换模特配置' : '换背景配置';
  const modeOptions =
    action === 'change_model'
      ? [
          { value: 'replicate', label: '真人复刻', copy: '保留服装与构图，重绘成目标模特。' },
          { value: 'swap_face', label: '原图换脸', copy: '更贴近原图，只替换面部特征。' },
        ]
      : [
          { value: 'blend', label: '氛围融合', copy: '以背景氛围驱动整体重绘。' },
          { value: 'replace', label: '精准替换', copy: '更偏硬替换，保留背景结构。' },
        ];

  return (
    <div className="generation-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="generation-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="generation-dialog-header">
          <div>
            <span className="generation-dialog-kicker">Spark Action</span>
            <h2>{dialogTitle}</h2>
            <p>{look.name}</p>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <section className="generation-dialog-section">
          <h3>预设选择</h3>
          <div className="generation-preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`generation-preset-card ${selectedPreset === preset.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedPreset(preset.id)}
              >
                <strong>{preset.title}</strong>
                <span>{preset.copy}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="generation-dialog-section">
          <h3>处理模式</h3>
          <div className="generation-mode-grid">
            {modeOptions.map((option) => (
              <label key={option.value} className={`generation-mode-card ${mode === option.value ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="generation-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={(event) => setMode(event.target.value)}
                />
                <strong>{option.label}</strong>
                <span>{option.copy}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="generation-dialog-section">
          <h3>补充指令</h3>
          <textarea
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="可选：补充姿势、光线、氛围、镜头感等细节。"
            rows={4}
          />
        </section>

        <footer className="generation-dialog-footer">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || !selectedPreset || !mode}
            onClick={() =>
              void onSubmit({
                presetId: selectedPreset,
                customPrompt: customPrompt.trim() || undefined,
                parameters: { mode },
              })
            }
          >
            {busy ? '生成中...' : '开始生成'}
          </button>
        </footer>
      </div>
    </div>
  );
}
