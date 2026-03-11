import type { LookItem } from '@/types';

interface OutfitDetailProps {
  description: string | null;
  tags: string[];
  items: LookItem[];
}

export function OutfitDetail({ description, tags, items }: OutfitDetailProps) {
  return (
    <section className="land-outfit-detail land-section-card">
      <div>
        <h2 className="land-feed-title" style={{ fontSize: 'clamp(24px, 3vw, 38px)' }}>
          Outfit Detail
        </h2>
        <p className="land-outfit-copy">
          {description || 'This published look keeps the styling note compact and lets the garments do the talking.'}
        </p>
        <div className="land-tag-list">
          {tags.map((tag) => (
            <span className="land-tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="land-item-grid">
        {items.map((item) => (
          <article className="land-item-card" key={item.id}>
            {item.asset_url ? (
              <img className="land-item-image" src={item.asset_url} alt={item.category} />
            ) : (
              <div className="land-item-placeholder">
                <span>{item.placeholder_desc || 'Asset not attached for this styling slot.'}</span>
              </div>
            )}
            <h3 className="land-item-name">{item.category}</h3>
            <p className="land-item-note">{item.placeholder_desc || 'Published with an existing asset.'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
