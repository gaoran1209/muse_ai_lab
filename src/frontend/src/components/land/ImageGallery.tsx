import { useEffect, useState } from 'react';

import type { Shot } from '@/types';

interface ImageGalleryProps {
  title: string;
  shots: Shot[];
  coverUrl: string | null;
}

type GalleryImage = {
  id: string;
  url: string | null;
  label: string;
};

function buildImages(shots: Shot[], coverUrl: string | null): GalleryImage[] {
  const imageShots = shots
    .filter((shot) => shot.type === 'image')
    .map((shot, index) => ({
      id: shot.id,
      url: shot.url || shot.thumbnail_url,
      label: `Look ${index + 1}`,
    }))
    .filter((shot) => shot.url);

  if (imageShots.length > 0) {
    return imageShots;
  }

  if (coverUrl) {
    return [{ id: 'cover', url: coverUrl, label: 'Cover' }];
  }

  return [];
}

export function ImageGallery({ title, shots, coverUrl }: ImageGalleryProps) {
  const images = buildImages(shots, coverUrl);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [shots, coverUrl]);

  const activeImage = images[activeIndex] ?? null;

  return (
    <section className="land-gallery land-section-card">
      <div className="land-gallery-stage">
        {activeImage?.url ? (
          <img src={activeImage.url} alt={`${title} - ${activeImage.label}`} />
        ) : (
          <div className="land-gallery-placeholder">
            <span>This content has no ready-to-view gallery image yet.</span>
          </div>
        )}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="land-gallery-nav prev"
              onClick={() => setActiveIndex((prev) => (prev - 1 + images.length) % images.length)}
            >
              ←
            </button>
            <button
              type="button"
              className="land-gallery-nav next"
              onClick={() => setActiveIndex((prev) => (prev + 1) % images.length)}
            >
              →
            </button>
          </>
        ) : null}

        {activeImage ? (
          <div className="land-gallery-caption">
            {activeIndex + 1} / {images.length} · {activeImage.label}
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="land-gallery-thumbs">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className={`land-gallery-thumb ${index === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              {image.url ? (
                <img src={image.url} alt={`${title} thumbnail ${index + 1}`} />
              ) : (
                <div className="land-gallery-thumb-placeholder">Preview unavailable</div>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
