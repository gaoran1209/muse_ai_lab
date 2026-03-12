import { useState } from 'react';
import './FloatingToolbar.css';

export type FloatingSelectionKind =
  | 'asset-image'
  | 'look-board'
  | 'look-item-node'
  | 'shot-node'
  | 'prompt-node';

export type QuickAction =
  | 'bg_blend'
  | 'bg_replace'
  | 'model_replicate'
  | 'model_swap_face'
  | 'tryon';

interface FloatingToolbarProps {
  anchor: { x: number; y: number };
  selectionKind: FloatingSelectionKind;
  count: number;
  adopted?: boolean;
  onGenerateLooks?: () => void;
  onGroupSelection?: () => void;
  onGenerateShot?: (action: 'change_model' | 'change_background' | 'tryon' | 'custom') => void;
  onGenerateVideo?: () => void;
  onToggleAdopt?: () => void;
  onQuickAction?: (action: QuickAction) => void;
}

export function FloatingToolbar({
  anchor,
  selectionKind,
  count,
  adopted,
  onGenerateLooks,
  onGroupSelection,
  onGenerateShot,
  onGenerateVideo,
  onToggleAdopt,
  onQuickAction,
}: FloatingToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'bg' | 'model' | null>(null);

  const showQuickActions =
    count === 1 &&
    (selectionKind === 'asset-image' ||
      selectionKind === 'look-item-node' ||
      selectionKind === 'prompt-node');

  return (
    <div
      className="floating-toolbar"
      style={{ left: anchor.x, top: anchor.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {selectionKind === 'asset-image' ? (
        <>
          <span className="floating-toolbar-badge">{count > 1 ? `${count} images` : 'image'}</span>
          {count > 1 ? (
            <button type="button" onClick={onGroupSelection}>
              组合
            </button>
          ) : null}
          <button type="button" onClick={onGenerateLooks}>
            {count <= 2 ? '✨ AI 搭配' : 'AI 搭配成组'}
          </button>
        </>
      ) : null}

      {selectionKind === 'look-board' ? (
        <>
          <span className="floating-toolbar-badge">Board</span>
          <button type="button" onClick={() => onGenerateShot?.('change_model')}>
            换模特
          </button>
          <button type="button" onClick={() => onGenerateShot?.('change_background')}>
            换背景
          </button>
          <button type="button" onClick={() => onGenerateShot?.('tryon')}>
            TryOn
          </button>
          <button type="button" onClick={() => onGenerateShot?.('custom')}>
            自定义
          </button>
          <button type="button" onClick={onGenerateVideo}>
            🎬 生成视频
          </button>
        </>
      ) : null}

      {selectionKind === 'shot-node' ? (
        <>
          <span className="floating-toolbar-badge">Result</span>
          <button type="button" onClick={onToggleAdopt}>
            {adopted ? '取消采纳' : '采纳结果'}
          </button>
        </>
      ) : null}

      {selectionKind === 'look-item-node' && !showQuickActions ? (
        <span className="floating-toolbar-badge">Image</span>
      ) : null}

      {selectionKind === 'prompt-node' && !showQuickActions ? (
        <span className="floating-toolbar-badge">Node</span>
      ) : null}

      {showQuickActions ? (
        <>
          <div className="floating-toolbar-divider" />
          <div className="floating-toolbar-menu-wrap">
            <button
              type="button"
              className={openMenu === 'bg' ? 'is-active' : ''}
              onClick={() => setOpenMenu(openMenu === 'bg' ? null : 'bg')}
            >
              换背景 ▾
            </button>
            {openMenu === 'bg' ? (
              <div className="floating-toolbar-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    onQuickAction?.('bg_blend');
                    setOpenMenu(null);
                  }}
                >
                  <strong>氛围融合</strong>
                  <span>以背景氛围驱动整体重绘</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickAction?.('bg_replace');
                    setOpenMenu(null);
                  }}
                >
                  <strong>精准替换</strong>
                  <span>保留背景结构，抠像替换</span>
                </button>
              </div>
            ) : null}
          </div>
          <div className="floating-toolbar-menu-wrap">
            <button
              type="button"
              className={openMenu === 'model' ? 'is-active' : ''}
              onClick={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
            >
              换模特 ▾
            </button>
            {openMenu === 'model' ? (
              <div className="floating-toolbar-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    onQuickAction?.('model_replicate');
                    setOpenMenu(null);
                  }}
                >
                  <strong>真人复刻</strong>
                  <span>保留服装构图，全局重绘</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onQuickAction?.('model_swap_face');
                    setOpenMenu(null);
                  }}
                >
                  <strong>原图换脸</strong>
                  <span>仅替换面部特征</span>
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="floating-toolbar-tryon"
            onClick={() => onQuickAction?.('tryon')}
          >
            TryOn
          </button>
        </>
      ) : null}
    </div>
  );
}
