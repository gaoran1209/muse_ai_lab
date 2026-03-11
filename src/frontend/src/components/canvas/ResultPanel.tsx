import { useState } from 'react';
import type { Look, Shot } from '../../types';
import './ResultPanel.css';

interface ResultPanelProps {
  open: boolean;
  looks: Look[];
  shots: Shot[];
  selectedShotIds: string[];
  publishedLookIds: string[];
  onToggleShot: (shotId: string) => void;
  onToggleAdopt: (shotId: string, adopted: boolean) => void;
  onPublish: (lookId: string) => void;
}

export function ResultPanel({
  open,
  looks,
  shots,
  selectedShotIds,
  publishedLookIds,
  onToggleShot,
  onToggleAdopt,
  onPublish,
}: ResultPanelProps) {
  const [collapsedLookIds, setCollapsedLookIds] = useState<string[]>([]);
  const adoptedShots = shots.filter((shot) => shot.adopted);

  const toggleLookCollapse = (lookId: string) => {
    setCollapsedLookIds((current) =>
      current.includes(lookId)
        ? current.filter((item) => item !== lookId)
        : [...current, lookId]
    );
  };

  const formatTime = (value: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  return (
    <aside className={`result-panel ${open ? 'is-open' : 'is-hidden'}`}>
      <div className="result-panel-header">
        <span className="result-panel-eyebrow">Result queue</span>
        <h2>结果面板</h2>
      </div>

      <div className="result-panel-groups">
        {looks.map((look) => {
          const lookShots = adoptedShots.filter((shot) => shot.look_id === look.id);
          if (lookShots.length === 0) return null;

          const selectedCount = lookShots.filter((shot) => selectedShotIds.includes(shot.id)).length;
          const isCollapsed = collapsedLookIds.includes(look.id);

          return (
            <section key={look.id} className="result-group">
              <header className="result-group-header">
                <div>
                  <h3>{look.name}</h3>
                  <p>{look.style_tags.join(' · ') || 'Ready for publish review'}</p>
                </div>
                <div className="result-group-header-actions">
                  {publishedLookIds.includes(look.id) ? <span className="published-pill">已发布</span> : null}
                  <button type="button" className="result-collapse-button" onClick={() => toggleLookCollapse(look.id)}>
                    {isCollapsed ? '展开' : '收起'}
                  </button>
                </div>
              </header>

              {!isCollapsed ? (
                <>
                  <div className="result-thumbnails">
                    {lookShots.map((shot) => (
                      <article key={shot.id} className="result-thumb-card">
                        <button
                          type="button"
                          className={`result-thumb ${selectedShotIds.includes(shot.id) ? 'is-selected' : ''}`}
                          onClick={() => onToggleShot(shot.id)}
                        >
                          {shot.thumbnail_url ?? shot.url ? (
                            <img src={shot.thumbnail_url ?? shot.url ?? ''} alt={shot.prompt ?? shot.id} />
                          ) : (
                            <div className="result-thumb-placeholder">Shot</div>
                          )}
                        </button>
                        <div className="result-thumb-actions">
                          <div className="result-thumb-meta">
                            <span>{selectedShotIds.includes(shot.id) ? 'Selected' : 'Adopted'}</span>
                            <span>{formatTime(shot.created_at)}</span>
                          </div>
                          <button type="button" onClick={() => onToggleAdopt(shot.id, false)}>
                            移出
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="publish-button"
                    onClick={() => onPublish(look.id)}
                    disabled={selectedCount === 0}
                  >
                    发布到 Muse Land
                  </button>
                </>
              ) : (
                <div className="result-collapsed-summary">
                  <span>{lookShots.length} 个已采纳结果</span>
                  <span>{selectedCount} 个待发布</span>
                </div>
              )}
            </section>
          );
        })}

        {adoptedShots.length === 0 ? (
          <div className="result-empty">
            <h3>还没有采纳结果</h3>
            <p>在画布中生成 Shot 并采纳后，这里会按 Look 自动归组。</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
