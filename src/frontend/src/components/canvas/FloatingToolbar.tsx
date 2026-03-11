import './FloatingToolbar.css';

export type FloatingSelectionKind =
  | 'asset-image'
  | 'look-board'
  | 'look-item-node'
  | 'shot-node'
  | 'prompt-node';

interface FloatingToolbarProps {
  anchor: { x: number; y: number };
  selectionKind: FloatingSelectionKind;
  count: number;
  adopted?: boolean;
  onGenerateLooks?: () => void;
  onGroupSelection?: () => void;
  onGenerateShot?: (action: 'change_model' | 'change_background' | 'tryon' | 'custom') => void;
  onToggleAdopt?: () => void;
}

export function FloatingToolbar({
  anchor,
  selectionKind,
  count,
  adopted,
  onGenerateLooks,
  onGroupSelection,
  onGenerateShot,
  onToggleAdopt,
}: FloatingToolbarProps) {
  return (
    <div className="floating-toolbar" style={{ left: anchor.x, top: anchor.y }}>
      {selectionKind === 'asset-image' ? (
        <>
          <span className="floating-toolbar-badge">{count > 1 ? `${count} images` : 'image'}</span>
          {count > 1 ? (
            <>
              <button type="button" onClick={onGroupSelection}>
                组合
              </button>
              <button type="button" onClick={onGenerateLooks}>
                AI 搭配成组
              </button>
            </>
          ) : (
            <button type="button" onClick={onGenerateLooks}>
              AI 搭配
            </button>
          )}
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
          <button
            type="button"
            disabled
            title="Spark 端 TryOn 还缺少参考图选择入口，当前暂不开放"
          >
            TryOn
          </button>
          <button type="button" onClick={() => onGenerateShot?.('custom')}>
            自定义
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

      {selectionKind === 'look-item-node' ? <span className="floating-toolbar-badge">Image</span> : null}

      {selectionKind === 'prompt-node' ? (
        <span className="floating-toolbar-badge">Node</span>
      ) : null}
    </div>
  );
}
