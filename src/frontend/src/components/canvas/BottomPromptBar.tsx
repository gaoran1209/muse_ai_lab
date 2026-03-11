import { useEffect, useRef, useState } from 'react';
import './BottomPromptBar.css';

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

export interface PromptSelection {
  id: string;
  label: string;
  kind: string;
  prompt: string;
  mode?: Mode | null;
  helper?: string;
}

interface Props {
  onImageGenerated: (base64: string) => void;
  onVideoGenerated: (base64: string) => void;
  selectedImageDataUrl?: string | null;
  selectedImageUrl?: string | null;
  selection?: PromptSelection | null;
  onSelectionPromptChange?: (prompt: string) => void;
  onClearSelection?: () => void;
}

const IMAGE_MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'imagen-4.0-fast-generate-001': 'Imagen 4.0 Fast',
  'imagen-4.0-generate-001': 'Imagen 4.0',
  'imagen-4.0-ultra-generate-001': 'Imagen 4.0 Ultra',
};

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

function choiceLabel(param: ExposedParam, value: unknown): string {
  if (param.name === 'model_name') {
    return IMAGE_MODEL_LABELS[String(value)] ?? String(value);
  }
  return String(value);
}

function paramLabel(p: ExposedParam): string {
  return p.description || p.name;
}

function chipDisplay(p: ExposedParam, val: unknown): string {
  if (val === null || val === undefined || val === '') {
    return p.description || p.name;
  }
  return choiceLabel(p, val);
}

function isImageParam(param: ExposedParam): boolean {
  const name = param.name.toLowerCase();
  return name === 'image' || name === 'images';
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

async function uploadImageToOSS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/v1/upload/image', { method: 'POST', body: formData });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || '图片上传失败');
  return data.url as string;
}

export function BottomPromptBar({
  onImageGenerated,
  onVideoGenerated,
  selectedImageDataUrl,
  selectedImageUrl,
  selection,
  onSelectionPromptChange,
  onClearSelection,
}: Props) {
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
    const provider = providers.find((item) => item.vendor === selectedVendor);
    if (provider) {
      setParams(buildDefaults(provider));
    }
    setOpenChip(null);
  }, [selectedVendor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selection) return;
    setPrompt(selection.prompt ?? '');
    if (selection.mode) {
      setMode(selection.mode);
    }
    setError(null);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    });
  }, [selection?.id, selection?.prompt, selection?.mode]);

  function buildDefaults(provider: ProviderInfo): Record<string, unknown> {
    return Object.fromEntries(
      provider.info.exposed_params
        .filter((param) => !isImageParam(param))
        .map((param) => [param.name, param.default ?? ''])
    );
  }

  function buildRequestParams(currentProvider: ProviderInfo | undefined): Record<string, unknown> {
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
  const currentProvider = currentProviders.find((provider) => provider.vendor === selectedVendor);
  const exposedParams = currentProvider?.info.exposed_params ?? [];
  const visibleParams = exposedParams.filter((param) => !isImageParam(param));
  const showVendorChip = !(mode === 'image' && currentProviders.length === 1 && currentProviders[0]?.vendor === 'gemini');

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextPrompt = event.target.value;
    setPrompt(nextPrompt);
    if (selection) {
      onSelectionPromptChange?.(nextPrompt);
    }
    const element = event.target;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  };

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const requestParams = buildRequestParams(currentProvider);

      if (selectedImageDataUrl || selectedImageUrl) {
        const url = selectedImageDataUrl
          ? await uploadImageToOSS(dataUrlToFile(selectedImageDataUrl, `canvas_${Date.now()}.png`))
          : selectedImageUrl!;
        const imageParam = exposedParams.find((param) => isImageParam(param));
        if (imageParam) {
          requestParams[imageParam.name] = imageParam.type.includes('list') ? [url] : url;
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
      if (!data.success) {
        setError(data.error || '生成失败');
        return;
      }

      if (selection) {
        onSelectionPromptChange?.(prompt.trim());
      }

      if (mode === 'image') {
        onImageGenerated(data.content as string);
      } else {
        onVideoGenerated(data.content as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请检查后端服务');
    } finally {
      setLoading(false);
    }
  }

  function renderParamChip(param: ExposedParam) {
    const key = param.name;
    const val = params[key];
    const isOpen = openChip === key;

    if (param.choices && param.choices.length > 0) {
      return (
        <div key={key} className="chip-wrapper">
          <button
            className={`param-chip ${isOpen ? 'open' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              setOpenChip(isOpen ? null : key);
            }}
            title={param.description}
          >
            {chipDisplay(param, val)}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3.5l3 3 3-3" strokeLinecap="round" />
            </svg>
          </button>
          {isOpen ? (
            <div className="chip-dropdown">
              {param.choices.map((choice) => (
                <button
                  key={String(choice)}
                  className={`chip-option ${String(val) === String(choice) ? 'selected' : ''}`}
                  onClick={() => {
                    const parsed =
                      param.type === 'int'
                        ? parseInt(String(choice), 10)
                        : param.type === 'float'
                          ? parseFloat(String(choice))
                          : choice;
                    setParams((prev) => ({ ...prev, [key]: parsed }));
                    setOpenChip(null);
                  }}
                >
                  {choiceLabel(param, choice)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

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

    return (
      <div key={key} className="chip-wrapper">
        <button
          className={`param-chip ${isOpen ? 'open' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpenChip(isOpen ? null : key);
          }}
          title={param.description}
        >
          {chipDisplay(param, val)}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2L4 8" strokeLinecap="round" />
          </svg>
        </button>
        {isOpen ? (
          <div className="chip-dropdown chip-input-dropdown">
            <label className="chip-input-label">{paramLabel(param)}</label>
            <input
              type={param.type === 'int' || param.type === 'float' ? 'number' : 'text'}
              className="chip-input"
              value={String(val ?? '')}
              placeholder={String(param.default ?? '')}
              autoFocus
              onChange={(event) => {
                const rawValue = event.target.value;
                const nextValue =
                  param.type === 'int'
                    ? parseInt(rawValue, 10)
                    : param.type === 'float'
                      ? parseFloat(rawValue)
                      : rawValue;
                setParams((prev) => ({ ...prev, [key]: Number.isNaN(nextValue) ? '' : nextValue }));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setOpenChip(null);
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bottom-prompt-bar" onClick={() => setOpenChip(null)}>
      {selection ? (
        <div className="selection-context-row">
          <div className="selection-context-copy">
            <span className="selection-context-kicker">{selection.kind}</span>
            <strong>{selection.label}</strong>
            {selection.helper ? <em>{selection.helper}</em> : null}
          </div>
          <button type="button" className="selection-clear-button" onClick={onClearSelection}>
            关闭
          </button>
        </div>
      ) : null}

      {selectedImageDataUrl || selectedImageUrl ? (
        <div className="selected-image-row">
          <img
            src={selectedImageDataUrl ?? selectedImageUrl ?? ''}
            alt="选中图片"
            className="selected-image-thumb"
          />
          <span className="selected-image-label">
            {selection ? '当前对象会引用已选中的参考图' : '已选中参考图片'}
          </span>
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        className="prompt-textarea"
        value={prompt}
        onChange={handleTextareaInput}
        onKeyDown={handleKeyDown}
        placeholder={selection ? '编辑当前对象的 prompt...' : 'Describe anything you want to generate'}
        rows={2}
      />

      {error ? <div className="bar-error">{error}</div> : null}

      <div className="prompt-controls" onClick={(event) => event.stopPropagation()}>
        <div className="controls-left">
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
              图片
            </button>
            <button
              className={`mode-tab ${mode === 'video' ? 'active' : ''}`}
              onClick={() => setMode('video')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none" />
              </svg>
              视频
            </button>
          </div>

          <div className="controls-divider" />

          {showVendorChip && currentProviders.length > 0 ? (
            <div className="chip-wrapper">
              <button
                className={`param-chip vendor-chip ${openChip === '__vendor' ? 'open' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
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
              {openChip === '__vendor' ? (
                <div className="chip-dropdown">
                  {currentProviders.map((provider) => (
                    <button
                      key={provider.vendor}
                      className={`chip-option ${provider.vendor === selectedVendor ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedVendor(provider.vendor);
                        setOpenChip(null);
                      }}
                    >
                      {shortLabel(provider.vendor)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {visibleParams.map((param) => renderParamChip(param))}
        </div>

        <div className="controls-right">
          <span className="prompt-hint">Ctrl / Cmd + Enter</span>
          <button
            className={`generate-btn ${loading ? 'loading' : ''}`}
            onClick={() => void handleGenerate()}
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
