import { useEffect } from 'react';

import { ContentCard } from '@/components/land/ContentCard';
import { FeedHeader } from '@/components/land/FeedHeader';
import '@/components/land/LandComponents.css';
import { useFeedStore } from '@/store';
import './Land.css';

export default function LandPage() {
  const {
    feed,
    availableTags,
    total,
    hasMore,
    loading,
    error,
    limit,
    page,
    tag,
    view,
    loadFeed,
    setTag,
    setView,
  } = useFeedStore();

  useEffect(() => {
    if (feed.length === 0 && !loading) {
      void loadFeed({ page: 1 });
    }
  }, [feed.length, loadFeed, loading]);

  const handleViewChange = (nextView: 'for-you' | 'by-collection') => {
    setView(nextView);
    if (nextView === 'for-you' && tag !== null) {
      void setTag(null);
    }
  };

  const isEmpty = !loading && feed.length === 0 && !error;

  return (
    <main className="land-page">
      <div className="land-page-shell">
        <FeedHeader
          view={view}
          total={total}
          tags={availableTags}
          activeTag={tag}
          onViewChange={handleViewChange}
          onTagChange={(nextTag) => void setTag(nextTag)}
        />

        {error && feed.length === 0 ? (
          <section className="land-feed-state land-section-card">
            <p>{error}</p>
            <button
              type="button"
              className="land-button primary"
              onClick={() => void loadFeed({ page: 1, tag })}
            >
              Retry
            </button>
          </section>
        ) : null}

        {isEmpty ? (
          <section className="land-feed-state land-section-card">
            <p>还没有已发布内容。等 Spark 端发布内容后，这里会按正式契约自动展示。</p>
          </section>
        ) : null}

        {feed.length > 0 ? (
          <section className="land-feed-masonry" aria-live="polite">
            {feed.map((content) => (
              <ContentCard content={content} key={content.id} />
            ))}
          </section>
        ) : null}

        {error && feed.length > 0 ? (
          <section className="land-feed-state land-section-card">
            <p>{error}</p>
          </section>
        ) : null}

        {hasMore && feed.length > 0 ? (
          <div className="land-feed-footer">
            <button
              type="button"
              className="land-button primary land-feed-load-more"
              disabled={loading}
              onClick={() => void loadFeed({ append: true, page, limit, tag })}
            >
              {loading ? 'Loading...' : 'Load More Looks'}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
