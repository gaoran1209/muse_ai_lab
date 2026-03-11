interface InteractionBarProps {
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  liked: boolean;
  favorited: boolean;
  likePending: boolean;
  favoritePending: boolean;
  onLike: () => void;
  onFavorite: () => void;
  onCommentFocus: () => void;
}

export function InteractionBar({
  likeCount,
  favoriteCount,
  commentCount,
  liked,
  favorited,
  likePending,
  favoritePending,
  onLike,
  onFavorite,
  onCommentFocus,
}: InteractionBarProps) {
  return (
    <div className="land-interaction-bar">
      <button
        type="button"
        className={`land-action-button ${liked ? 'active' : ''}`}
        onClick={onLike}
        disabled={likePending}
      >
        ♥ Like <span>{likeCount}</span>
      </button>
      <button
        type="button"
        className={`land-action-button ${favorited ? 'active' : ''}`}
        onClick={onFavorite}
        disabled={favoritePending}
      >
        ★ Favorite <span>{favoriteCount}</span>
      </button>
      <button type="button" className="land-action-button" onClick={onCommentFocus}>
        ✎ Comment <span>{commentCount}</span>
      </button>
    </div>
  );
}
