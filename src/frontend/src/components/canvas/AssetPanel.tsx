import { useEffect, useMemo, useState } from 'react';
import type { Asset, AssetTags } from '../../types';
import './AssetPanel.css';

const LIBRARY_SCOPES: Array<{ value: 'public' | 'user'; label: string }> = [
  { value: 'public', label: '公共' },
  { value: 'user', label: '我的' },
];

const CATEGORIES: Array<{ value: 'all' | Asset['category']; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'product', label: '商品' },
  { value: 'model', label: '模特' },
  { value: 'background', label: '背景' },
  { value: 'pose', label: '姿势' },
];

interface AssetPanelProps {
  open: boolean;
  libraryAssets: Asset[];
  linkedAssetIds: string[];
  activeCategory: 'all' | Asset['category'];
  activeLibraryScope: 'public' | 'user';
  busy: boolean;
  onCategoryChange: (category: 'all' | Asset['category']) => void;
  onLibraryScopeChange: (scope: 'public' | 'user') => void;
  onUpload: (files: FileList | null) => void;
  onEnsureLinked: (assetId: string) => void;
  onDeleteAsset: (assetId: string) => void;
  onUpdateAsset: (assetId: string, payload: { category?: Asset['category']; tags?: AssetTags }) => void;
  onToggleOpen: () => void;
}

function AssetImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return <div className={`asset-image-fallback ${className ?? ''}`}>加载失败</div>;
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function AssetPanel({
  open,
  libraryAssets,
  linkedAssetIds,
  activeCategory,
  activeLibraryScope,
  busy,
  onCategoryChange,
  onLibraryScopeChange,
  onUpload,
  onEnsureLinked,
  onDeleteAsset,
  onUpdateAsset,
  onToggleOpen,
}: AssetPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<AssetTags>({
    category: 'product',
    subcategory: '',
    color: '',
    style: '',
    season: '',
    occasion: '',
  });
  const visibleAssets = libraryAssets.filter((asset) => {
    if (asset.library_scope !== activeLibraryScope) return false;
    if (activeCategory === 'all') return true;
    return asset.category === activeCategory;
  });
  const editingAsset = useMemo(
    () => libraryAssets.find((asset) => asset.id === editingAssetId) ?? null,
    [libraryAssets, editingAssetId]
  );

  useEffect(() => {
    if (!editingAsset) return;
    setDraftTags({
      category: editingAsset.category,
      subcategory: editingAsset.tags?.subcategory ?? '',
      color: editingAsset.tags?.color ?? '',
      style: editingAsset.tags?.style ?? '',
      season: editingAsset.tags?.season ?? '',
      occasion: editingAsset.tags?.occasion ?? '',
    });
  }, [editingAsset]);

  return (
    <>
      <div className={`asset-panel-shell ${open ? 'is-open' : 'is-collapsed'}`}>
        <aside
          className={`asset-panel ${isDragOver ? 'is-dragover' : ''}`}
          onDragOver={(event) => {
            if (event.dataTransfer.files.length === 0 || !open) return;
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            if (event.dataTransfer.files.length === 0 || !open) return;
            event.preventDefault();
            setIsDragOver(false);
            onUpload(event.dataTransfer.files);
          }}
        >
          <div className="asset-panel-header">
            <div>
              <span className="asset-panel-eyebrow">Asset library</span>
              <h2>素材库</h2>
            </div>
            <button
              type="button"
              className="asset-panel-collapse-btn"
              onClick={onToggleOpen}
              aria-label="收起素材库"
            >
              ‹
            </button>
          </div>

          <div className="asset-tabs" role="tablist" aria-label="Asset categories">
            {LIBRARY_SCOPES.map((scope) => (
              <button
                key={scope.value}
                type="button"
                className={scope.value === activeLibraryScope ? 'is-active' : ''}
                onClick={() => onLibraryScopeChange(scope.value)}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="asset-tabs asset-tabs-secondary" role="tablist" aria-label="Asset categories">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                className={category.value === activeCategory ? 'is-active' : ''}
                onClick={() => onCategoryChange(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="asset-grid">
            {visibleAssets.map((asset) => (
              <div key={asset.id} className="asset-card-wrap">
                <button
                  type="button"
                  className="asset-card"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        id: asset.id,
                        url: asset.url,
                        label: asset.original_filename ?? asset.id,
                      })
                    );
                    if (!linkedAssetIds.includes(asset.id)) {
                      onEnsureLinked(asset.id);
                    }
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  <AssetImage
                    src={asset.thumbnail_url ?? asset.url}
                    alt={asset.original_filename ?? asset.id}
                  />
                  <span>{asset.original_filename ?? asset.tags?.subcategory ?? asset.category}</span>
                </button>
                <div className="asset-card-overlay">
                  <button type="button" onClick={() => setPreviewAsset(asset)}>
                    预览
                  </button>
                  <button type="button" onClick={() => setEditingAssetId(asset.id)}>
                    标签
                  </button>
                  {asset.library_scope === 'user' ? (
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => {
                        const confirmed = window.confirm(`确认删除素材“${asset.original_filename ?? asset.id}”？`);
                        if (confirmed) {
                          onDeleteAsset(asset.id);
                        }
                      }}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {visibleAssets.length === 0 ? (
              <div className="asset-empty">
                <strong>{busy ? '上传中...' : '拖拽图片到这里上传'}</strong>
                <span>当前列表为空时，整个素材库区域可作为上传落点。</span>
              </div>
            ) : null}
          </div>
        </aside>

        {!open ? (
          <button
            type="button"
            className="asset-panel-toggle"
            onClick={onToggleOpen}
            aria-expanded={false}
            aria-label="展开素材库"
          >
            ›
          </button>
        ) : null}
      </div>

      {previewAsset ? (
        <div className="asset-modal-backdrop" role="presentation" onClick={() => setPreviewAsset(null)}>
          <div className="asset-modal asset-preview-modal" onClick={(event) => event.stopPropagation()}>
            <header className="asset-modal-header">
              <div>
                <span className="asset-panel-eyebrow">Preview</span>
                <h3>{previewAsset.original_filename ?? previewAsset.id}</h3>
              </div>
              <button type="button" onClick={() => setPreviewAsset(null)}>
                关闭
              </button>
            </header>
            <AssetImage
              className="asset-preview-image"
              src={previewAsset.url}
              alt={previewAsset.original_filename ?? previewAsset.id}
            />
          </div>
        </div>
      ) : null}

      {editingAsset ? (
        <div className="asset-modal-backdrop" role="presentation" onClick={() => setEditingAssetId(null)}>
          <div className="asset-modal" onClick={(event) => event.stopPropagation()}>
            <header className="asset-modal-header">
              <div>
                <span className="asset-panel-eyebrow">Tag editor</span>
                <h3>{editingAsset.original_filename ?? editingAsset.id}</h3>
              </div>
              <button type="button" onClick={() => setEditingAssetId(null)}>
                关闭
              </button>
            </header>

            <div className="asset-editor-grid">
              <label>
                分类
                <select
                  value={draftTags.category}
                  onChange={(event) =>
                    setDraftTags((prev) => ({
                      ...prev,
                      category: event.target.value as Asset['category'],
                    }))
                  }
                >
                  <option value="product">商品</option>
                  <option value="model">模特</option>
                  <option value="background">背景</option>
                  <option value="pose">姿势</option>
                </select>
              </label>
              <label>
                子类
                <input
                  value={draftTags.subcategory ?? ''}
                  onChange={(event) => setDraftTags((prev) => ({ ...prev, subcategory: event.target.value }))}
                />
              </label>
              <label>
                颜色
                <input
                  value={draftTags.color ?? ''}
                  onChange={(event) => setDraftTags((prev) => ({ ...prev, color: event.target.value }))}
                />
              </label>
              <label>
                风格
                <input
                  value={draftTags.style ?? ''}
                  onChange={(event) => setDraftTags((prev) => ({ ...prev, style: event.target.value }))}
                />
              </label>
              <label>
                季节
                <input
                  value={draftTags.season ?? ''}
                  onChange={(event) => setDraftTags((prev) => ({ ...prev, season: event.target.value }))}
                />
              </label>
              <label>
                场合
                <input
                  value={draftTags.occasion ?? ''}
                  onChange={(event) => setDraftTags((prev) => ({ ...prev, occasion: event.target.value }))}
                />
              </label>
            </div>

            <footer className="asset-modal-footer">
              <button type="button" onClick={() => setEditingAssetId(null)}>
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onUpdateAsset(editingAsset.id, {
                    category: draftTags.category as Asset['category'],
                    tags: {
                      category: draftTags.category,
                      subcategory: draftTags.subcategory || undefined,
                      color: draftTags.color || undefined,
                      style: draftTags.style || undefined,
                      season: draftTags.season || undefined,
                      occasion: draftTags.occasion || undefined,
                    },
                  });
                  setEditingAssetId(null);
                }}
              >
                保存标签
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
