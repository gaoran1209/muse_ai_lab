type FeedView = 'for-you' | 'by-collection';

interface FeedHeaderProps {
  view: FeedView;
  total: number;
  tags: string[];
  activeTag: string | null;
  onViewChange: (view: FeedView) => void;
  onTagChange: (tag: string | null) => void;
}

export function FeedHeader({
  view,
  total,
  tags,
  activeTag,
  onViewChange,
  onTagChange,
}: FeedHeaderProps) {
  return (
    <section className="land-feed-header land-section-card">
      <div className="land-feed-header-top">
        <div>
          <p className="land-feed-eyebrow">Muse Land</p>
          <h1 className="land-feed-title">Fashion signals, not just pretty pixels.</h1>
          <p className="land-feed-subtitle">
            Feed 里是已经发布的搭配内容。FOR YOU 看最新内容，BY COLLECTION 用标签快速切换当下想看的风格。
          </p>
        </div>
        <div className="land-feed-meta">
          <strong>{total}</strong>
          <span>Published looks</span>
        </div>
      </div>

      <div className="land-tab-group">
        <button
          type="button"
          className={`land-tab-button ${view === 'for-you' ? 'active' : ''}`}
          onClick={() => onViewChange('for-you')}
        >
          For You
        </button>
        <button
          type="button"
          className={`land-tab-button ${view === 'by-collection' ? 'active' : ''}`}
          onClick={() => onViewChange('by-collection')}
        >
          By Collection
        </button>
      </div>

      {view === 'by-collection' ? (
        <div className="land-chip-row">
          <button
            type="button"
            className={`land-chip ${activeTag === null ? 'active' : ''}`}
            onClick={() => onTagChange(null)}
          >
            All styles
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`land-chip ${activeTag === tag ? 'active' : ''}`}
              onClick={() => onTagChange(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
