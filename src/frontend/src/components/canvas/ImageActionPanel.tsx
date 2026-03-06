import { useState, useEffect } from 'react';
import './ImageActionPanel.css';

// ==================== 类型定义 ====================

type GenerationMode = 'image' | 'video';

interface ExposedParam {
  name: string;
  type: string;
  default: unknown;
  description: string;
  choices: string[] | null;
  required: boolean;
}

interface ProviderInfo {
  vendor: string;
  model: string;
  available: boolean;
  info: {
    provider_type: string;
    exposed_params: ExposedParam[];
  };
}

interface Props {
  /** 面板锚点：图片右边缘的屏幕坐标 */
  anchor: { x: number; y: number };
  onClose: () => void;
  /** 图片生成成功后，将 base64 内容添加到画布 */
  onImageGenerated: (base64: string) => void;
}

// ==================== 参数渲染 ====================

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ExposedParam;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const displayName = param.description || param.name;

  if (param.choices && param.choices.length > 0) {
    return (
      <div className="panel-field">
        <label className="panel-label" title={param.description}>{displayName}</label>
        <select
          className="panel-select"
          value={String(value ?? param.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {param.choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    );
  }

  if (param.type === 'bool') {
    return (
      <div className="panel-field panel-field-row">
        <label className="panel-label" title={param.description}>{displayName}</label>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    );
  }

  if (param.type === 'int' || param.type === 'float') {
    return (
      <div className="panel-field">
        <label className="panel-label" title={param.description}>{displayName}</label>
        <input
          type="number"
          className="panel-input"
          value={String(value ?? param.default ?? '')}
          onChange={(e) =>
            onChange(param.type === 'int' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))
          }
        />
      </div>
    );
  }

  // list[str] 或 str
  return (
    <div className="panel-field">
      <label className="panel-label" title={param.description}>{displayName}</label>
      <input
        type="text"
        className="panel-input"
        value={String(value ?? '')}
        placeholder={param.type.startsWith('list') ? '逗号分隔的 URL' : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ==================== 主组件 ====================

const PANEL_WIDTH = 300;
const PANEL_GAP = 12;
const MARGIN = 8;

export function ImageActionPanel({ anchor, onClose, onImageGenerated }: Props) {
  const [mode, setMode] = useState<GenerationMode>('image');
  const [imageProviders, setImageProviders] = useState<ProviderInfo[]>([]);
  const [videoProviders, setVideoProviders] = useState<ProviderInfo[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 获取所有 Provider
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/image/providers').then((r) => r.json()),
      fetch('/api/v1/video/providers').then((r) => r.json()),
    ])
      .then(([imgList, vidList]: [ProviderInfo[], ProviderInfo[]]) => {
        setImageProviders(imgList);
        setVideoProviders(vidList);
        if (imgList.length > 0) {
          setSelectedVendor(imgList[0].vendor);
          setParams(buildDefaults(imgList[0]));
        }
      })
      .catch(() => setError('无法获取厂商列表，请检查后端服务'));
  }, []);

  // 切换模式时重置厂商和参数
  useEffect(() => {
    const providers = mode === 'image' ? imageProviders : videoProviders;
    if (providers.length > 0) {
      setSelectedVendor(providers[0].vendor);
      setParams(buildDefaults(providers[0]));
    }
    setError(null);
    setSuccess(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换厂商时重置参数
  useEffect(() => {
    const providers = mode === 'image' ? imageProviders : videoProviders;
    const provider = providers.find((p) => p.vendor === selectedVendor);
    if (provider) {
      setParams(buildDefaults(provider));
      setError(null);
    }
  }, [selectedVendor]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildDefaults(provider: ProviderInfo): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const param of provider.info.exposed_params) {
      defaults[param.name] = param.default ?? '';
    }
    return defaults;
  }

  const currentProviders = mode === 'image' ? imageProviders : videoProviders;
  const currentProvider = currentProviders.find((p) => p.vendor === selectedVendor);

  // 处理参数中的 list[str] 类型（从逗号字符串转为数组）
  function buildRequestParams(): Record<string, unknown> {
    if (!currentProvider) return {};
    const result: Record<string, unknown> = {};
    for (const param of currentProvider.info.exposed_params) {
      const val = params[param.name];
      if (val === '' || val === null || val === undefined) continue;
      if (param.type.startsWith('list')) {
        const arr = String(val)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (arr.length > 0) result[param.name] = arr;
      } else {
        result[param.name] = val;
      }
    }
    return result;
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const endpoint = mode === 'image' ? '/api/v1/image/generate' : '/api/v1/video/generate';

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: selectedVendor,
          prompt: prompt.trim(),
          parameters: buildRequestParams(),
        }),
      });
      const data = await resp.json();

      if (!data.success) {
        setError(data.error || '生成失败');
        return;
      }

      if (mode === 'image') {
        onImageGenerated(data.content as string);
        setSuccess('图片已添加到画布');
      } else {
        // 视频：触发下载
        const blob = base64ToBlob(data.content as string, 'video/mp4');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated_${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess('视频已开始下载');
      }
    } catch {
      setError('请求失败，请检查后端服务是否正常运行');
    } finally {
      setLoading(false);
    }
  }

  // 计算面板位置：优先显示在图片右侧，空间不足则左侧
  let left = anchor.x + PANEL_GAP;
  const top = Math.max(
    MARGIN,
    Math.min(anchor.y, window.innerHeight - 480 - MARGIN)
  );

  if (left + PANEL_WIDTH > window.innerWidth - MARGIN) {
    left = anchor.x - PANEL_WIDTH - PANEL_GAP;
  }
  left = Math.max(MARGIN, left);

  return (
    <div className="image-action-panel" style={{ left, top }}>
      {/* 头部：Tab + 关闭 */}
      <div className="panel-header">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${mode === 'image' ? 'active' : ''}`}
            onClick={() => setMode('image')}
          >
            生成图片
          </button>
          <button
            className={`panel-tab ${mode === 'video' ? 'active' : ''}`}
            onClick={() => setMode('video')}
          >
            生成视频
          </button>
        </div>
        <button className="panel-close" onClick={onClose} title="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="panel-body">
        {/* 厂商选择 */}
        <div className="panel-field">
          <label className="panel-label">厂商</label>
          <select
            className="panel-select"
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            disabled={currentProviders.length === 0}
          >
            {currentProviders.map((p) => (
              <option key={p.vendor} value={p.vendor}>
                {p.vendor}
              </option>
            ))}
          </select>
        </div>

        {/* 提示词 */}
        <div className="panel-field">
          <label className="panel-label">提示词</label>
          <textarea
            className="panel-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`描述要${mode === 'image' ? '生成的图片' : '生成的视频'}内容...`}
            rows={3}
          />
        </div>

        {/* 动态参数 */}
        {currentProvider && currentProvider.info.exposed_params.length > 0 && (
          <div className="panel-params-section">
            <div className="panel-params-title">参数</div>
            {currentProvider.info.exposed_params.map((param) => (
              <ParamField
                key={param.name}
                param={param}
                value={params[param.name]}
                onChange={(val) => setParams((prev) => ({ ...prev, [param.name]: val }))}
              />
            ))}
          </div>
        )}

        {/* 错误 / 成功提示 */}
        {error && <div className="panel-error">{error}</div>}
        {success && <div className="panel-success">{success}</div>}

        {/* 生成按钮 */}
        <button
          className="panel-generate"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <span className="panel-spinner" />
          ) : null}
          {loading ? '生成中...' : `生成${mode === 'image' ? '图片' : '视频'}`}
        </button>
      </div>
    </div>
  );
}

// ==================== 工具函数 ====================

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNums)], { type: mimeType });
}
