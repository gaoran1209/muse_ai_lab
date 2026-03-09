import { useState, useEffect, useRef } from 'react';
import './BottomPromptBar.css';

// ==================== 类型定义 ====================

type Mode = 'image' | 'video';

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
  onImageGenerated: (base64: string) => void;
  onVideoGenerated: (base64: string) => void;
  selectedImageDataUrl?: string | null;
}

// ==================== 工具 ====================

function shortLabel(vendor: string): string {
  const map: Record<string, string> = {
    thirtytwo_nano_banana: 'Nano Banana',
    thirtytwo_seedream: 'Seedream',
    thirtytwo_kling: 'Kling',
    zhipu: 'Zhipu',
    gemini: 'Gemini',
    thirtytwo: '302.AI',
  };
  return map[vendor] ?? vendor;
}

function paramLabel(p: ExposedParam): string {
  return p.description || p.name;
}

/** chip 上显示的值（简短） */
function chipDisplay(p: ExposedParam, val: unknown): string {
  if (val === null || val === undefined || val === '') {
    return p.description || p.name;
  }
  return String(val);
}

/** 判断参数是否为图片类型（通过画布选中传入，前端不显示 chip） */
function isImageParam(param: ExposedParam): boolean {
  const name = param.name.toLowerCase();
  return name === 'image' || name === 'images';
}

/** 将 data URL 转为 File 对象 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

/** 上传图片文件到 OSS，返回 URL */
async function uploadImageToOSS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/v1/upload/image', { method: 'POST', body: formData });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || '图片上传失败');
  return data.url as string;
}

// ==================== 主组件 ====================

export function BottomPromptBar({ onImageGenerated, onVideoGenerated, selectedImageDataUrl }: Props) {
  const [mode, setMode] = useState<Mode>('image');
  const [imageProviders, setImageProviders] = useState<ProviderInfo[]>([]);
  const [videoProviders, setVideoProviders] = useState<ProviderInfo[]>([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openChip, setOpenChip] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取 Provider 列表
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
      .catch(() => setError('无法连接后端'));
  }, []);

  useEffect(() => {
    const providers = mode === 'image' ? imageProviders : videoProviders;
    if (providers.length > 0) {
      setSelectedVendor(providers[0].vendor);
      setParams(buildDefaults(providers[0]));
    }
    setOpenChip(null);
    setError(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const providers = mode === 'image' ? imageProviders : videoProviders;
    const p = providers.find((p) => p.vendor === selectedVendor);
    if (p) setParams(buildDefaults(p));
    setOpenChip(null);
  }, [selectedVendor]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildDefaults(p: ProviderInfo): Record<string, unknown> {
    return Object.fromEntries(
      p.info.exposed_params
        .filter((ep) => !isImageParam(ep))
        .map((ep) => [ep.name, ep.default ?? ''])
    );
  }

  function buildRequestParams(): Record<string, unknown> {
    if (!currentProvider) return {};
    const result: Record<string, unknown> = {};
    for (const param of currentProvider.info.exposed_params) {
      if (isImageParam(param)) continue;
      const val = params[param.name];
      if (val === '' || val === null || val === undefined) continue;
      result[param.name] = val;
    }
    return result;
  }

  const currentProviders = mode === 'image' ? imageProviders : videoProviders;
  const currentProvider = currentProviders.find((p) => p.vendor === selectedVendor);
  const exposedParams = currentProvider?.info.exposed_params ?? [];
  // 过滤掉图片参数（后端处理）
  const visibleParams = exposedParams.filter((p) => !isImageParam(p));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const requestParams = buildRequestParams();

      // 如果有选中的画布图片，上传到 OSS 并注入到 image 参数
      if (selectedImageDataUrl) {
        const file = dataUrlToFile(selectedImageDataUrl, `canvas_${Date.now()}.png`);
        const url = await uploadImageToOSS(file);
        // 查找当前 provider 的图片参数名
        const imageParam = exposedParams.find((p) => isImageParam(p));
        if (imageParam) {
          if (imageParam.type.includes('list')) {
            requestParams[imageParam.name] = [url];
          } else {
            requestParams[imageParam.name] = url;
          }
        }
      }

      const endpoint = mode === 'image' ? '/api/v1/image/generate' : '/api/v1/video/generate';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: selectedVendor,
          prompt: prompt.trim(),
          parameters: requestParams,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        if (mode === 'image') {
          onImageGenerated(data.content as string);
        } else {
          onVideoGenerated(data.content as string);
        }
      } else {
        setError(data.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请检查后端服务');
    } finally {
      setLoading(false);
    }
  }

  /** 渲染单个参数 chip（统一入口） */
  function renderParamChip(param: ExposedParam) {
    const key = param.name;
    const val = params[key];
    const isOpen = openChip === key;

    // 有 choices → 下拉选择
    if (param.choices && param.choices.length > 0) {
      return (
        <div key={key} className="chip-wrapper">
          <button
            className={`param-chip ${isOpen ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpenChip(isOpen ? null : key);
            }}
            title={param.description}
          >
            {chipDisplay(param, val)}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3.5l3 3 3-3" strokeLinecap="round" />
            </svg>
          </button>
          {isOpen && (
            <div className="chip-dropdown">
              {param.choices.map((c) => (
                <button
                  key={String(c)}
                  className={`chip-option ${String(val) === String(c) ? 'selected' : ''}`}
                  onClick={() => {
                    const parsed =
                      param.type === 'int' ? parseInt(String(c), 10) :
                      param.type === 'float' ? parseFloat(String(c)) : c;
                    setParams((prev) => ({ ...prev, [key]: parsed }));
                    setOpenChip(null);
                  }}
                >
                  {String(c)}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    // bool → 切换 chip
    if (param.type === 'bool') {
      return (
        <button
          key={key}
          className={`param-chip toggle-chip ${val ? 'on' : ''}`}
          onClick={() => setParams((prev) => ({ ...prev, [key]: !prev[key] }))}
          title={param.description}
        >
          {paramLabel(param)}
          <span className="toggle-dot">{val ? 'ON' : 'OFF'}</span>
        </button>
      );
    }

    // str / int / float → 可编辑 chip（点击展开 inline input）
    return (
      <div key={key} className="chip-wrapper">
        <button
          className={`param-chip ${isOpen ? 'open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenChip(isOpen ? null : key);
          }}
          title={param.description}
        >
          {chipDisplay(param, val)}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2L4 8" strokeLinecap="round" />
          </svg>
        </button>
        {isOpen && (
          <div className="chip-dropdown chip-input-dropdown">
            <label className="chip-input-label">{paramLabel(param)}</label>
            <input
              type={param.type === 'int' || param.type === 'float' ? 'number' : 'text'}
              className="chip-input"
              value={String(val ?? '')}
              placeholder={String(param.default ?? '')}
              autoFocus
              onChange={(e) => {
                const v =
                  param.type === 'int' ? parseInt(e.target.value, 10) :
                  param.type === 'float' ? parseFloat(e.target.value) :
                  e.target.value;
                setParams((prev) => ({ ...prev, [key]: v }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setOpenChip(null);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bottom-prompt-bar" onClick={() => setOpenChip(null)}>
      {/* 选中图片缩略图 */}
      {selectedImageDataUrl && (
        <div className="selected-image-row">
          <img src={selectedImageDataUrl} alt="选中图片" className="selected-image-thumb" />
          <span className="selected-image-label">已选中参考图片</span>
        </div>
      )}

      {/* 输入区域 */}
      <textarea
        ref={textareaRef}
        className="prompt-textarea"
        value={prompt}
        onChange={handleTextareaInput}
        onKeyDown={handleKeyDown}
        placeholder="描述任何你想要生成的内容..."
        rows={2}
      />

      {/* 错误提示 */}
      {error && <div className="bar-error">{error}</div>}

      {/* 控制栏 */}
      <div className="prompt-controls" onClick={(e) => e.stopPropagation()}>
        <div className="controls-left">
          {/* 模式切换 */}
          <div className="mode-tabs">
            <button
              className={`mode-tab ${mode === 'image' ? 'active' : ''}`}
              onClick={() => setMode('image')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" fill="currentColor" stroke="none" />
                <path d="M21 15l-5-5L5 21" strokeLinecap="round" />
              </svg>
              图片生成
            </button>
            <button
              className={`mode-tab ${mode === 'video' ? 'active' : ''}`}
              onClick={() => setMode('video')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none" />
              </svg>
              视频生成
            </button>
          </div>

          <div className="controls-divider" />

          {/* 厂商 chip */}
          {currentProviders.length > 0 && (
            <div className="chip-wrapper">
              <button
                className={`param-chip vendor-chip ${openChip === '__vendor' ? 'open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenChip(openChip === '__vendor' ? null : '__vendor');
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                </svg>
                {shortLabel(selectedVendor)}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5l3 3 3-3" strokeLinecap="round" />
                </svg>
              </button>
              {openChip === '__vendor' && (
                <div className="chip-dropdown">
                  {currentProviders.map((p) => (
                    <button
                      key={p.vendor}
                      className={`chip-option ${p.vendor === selectedVendor ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedVendor(p.vendor);
                        setOpenChip(null);
                      }}
                    >
                      {shortLabel(p.vendor)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 非图片暴露参数 → chips */}
          {visibleParams.map((param) => renderParamChip(param))}
        </div>

        {/* 右侧 */}
        <div className="controls-right">
          <span className="prompt-hint">{'\u2318'} Enter</span>
          <button
            className={`generate-btn ${loading ? 'loading' : ''}`}
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            title="生成"
          >
            {loading ? (
              <span className="btn-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
