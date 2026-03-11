import { useState } from 'react';
import type { Asset } from '../../types';
import './AssetPanel.css';

const CATEGORIES: Array<{ value: 'all' | Asset['category']; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'product', label: '商品' },
  { value: 'model', label: '模特' },
  { value: 'background', label: '背景' },
  { value: 'pose', label: '姿势' },
];

interface AssetPanelProps {
  assets: Asset[];
  activeCategory: 'all' | Asset['category'];
  busy: boolean;
  onCategoryChange: (category: 'all' | Asset['category']) => void;
  onUpload: (files: FileList | null) => void;
}

export function AssetPanel({
  assets,
  activeCategory,
  busy,
  onCategoryChange,
  onUpload,
}: AssetPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const visibleAssets =
    activeCategory === 'all'
      ? assets
      : assets.filter((asset) => asset.category === activeCategory);

  return (
    <aside
      className={`asset-panel ${isDragOver ? 'is-dragover' : ''}`}
      onDragOver={(event) => {
        if (event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        if (event.dataTransfer.files.length === 0) return;
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
      </div>

      <div className="asset-tabs" role="tablist" aria-label="Asset categories">
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
          <button
            key={asset.id}
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
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <img src={asset.thumbnail_url ?? asset.url} alt={asset.original_filename ?? asset.id} />
            <span>{asset.original_filename ?? asset.tags?.subcategory ?? asset.category}</span>
          </button>
        ))}
        {visibleAssets.length === 0 ? (
          <div className="asset-empty">
            <strong>{busy ? '上传中...' : '拖拽图片到这里上传'}</strong>
            <span>当前列表为空时，整个素材库区域可作为上传落点。</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
