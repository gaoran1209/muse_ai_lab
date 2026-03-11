import type { Look, Shot } from '../../types';
import './ResultPanel.css';

interface ResultPanelProps {
  looks: Look[];
  shots: Shot[];
  selectedShotIds: string[];
  publishedLookIds: string[];
  onToggleShot: (shotId: string) => void;
  onToggleAdopt: (shotId: string, adopted: boolean) => void;
  onPublish: (lookId: string) => void;
}

export function ResultPanel({
  looks,
  shots,
  selectedShotIds,
  publishedLookIds,
  onToggleShot,
  onToggleAdopt,
  onPublish,
}: ResultPanelProps) {
  const adoptedShots = shots.filter((shot) => shot.adopted);

  return (
    <aside className="result-panel">
      <div className="result-panel-header">
        <span className="result-panel-eyebrow">Result queue</span>
        <h2>结果面板</h2>
      </div>

      <div className="result-panel-groups">
        {looks.map((look) => {
          const lookShots = adoptedShots.filter((shot) => shot.look_id === look.id);
          if (lookShots.length === 0) return null;

          const selectedCount = lookShots.filter((shot) => selectedShotIds.includes(shot.id)).length;

          return (
            <section key={look.id} className="result-group">
              <header>
                <div>
                  <h3>{look.name}</h3>
                  <p>{look.style_tags.join(' · ') || 'Ready for publish review'}</p>
                </div>
                {publishedLookIds.includes(look.id) ? <span className="published-pill">已发布</span> : null}
              </header>

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
                      <span>{selectedShotIds.includes(shot.id) ? 'Selected' : 'Adopted'}</span>
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
