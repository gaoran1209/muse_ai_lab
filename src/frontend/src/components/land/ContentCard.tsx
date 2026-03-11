import { Link } from 'react-router-dom';

import type { ContentBrief } from '@/types';

interface ContentCardProps {
  content: ContentBrief;
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently published';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function ContentCard({ content }: ContentCardProps) {
  return (
    <article className="land-content-card">
      <Link className="land-card-link" to={`/land/${content.id}`}>
        {content.cover_url ? (
          <img
            className="land-content-card-image"
            src={content.cover_url}
            alt={content.title}
            loading="lazy"
          />
        ) : (
          <div className="land-content-card-placeholder">
            <span>No cover image yet. Open detail to inspect the published shots.</span>
          </div>
        )}

        <div className="land-content-card-body">
          <div className="land-content-card-meta">
            <span>Muse Creator</span>
            <span>{formatPublishedAt(content.published_at)}</span>
          </div>

          <h2 className="land-content-card-title">{content.title}</h2>

          <div className="land-tag-list">
            {content.tags.slice(0, 3).map((tag) => (
              <span className="land-tag" key={tag}>
                #{tag}
              </span>
            ))}
          </div>

          <div className="land-content-card-stats">
            <div className="land-inline-stats">
              <span className="land-inline-stat">♥ {content.like_count}</span>
              <span className="land-inline-stat">★ {content.favorite_count}</span>
            </div>
            <span>View detail</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
