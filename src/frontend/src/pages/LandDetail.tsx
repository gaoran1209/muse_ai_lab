import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { uploadImageToOSS } from '@/api/land';
import { ImageGallery } from '@/components/land/ImageGallery';
import { InteractionBar } from '@/components/land/InteractionBar';
import '@/components/land/LandComponents.css';
import { OutfitDetail } from '@/components/land/OutfitDetail';
import { PromoteDialog } from '@/components/land/PromoteDialog';
import { TryOnDialog } from '@/components/land/TryOnDialog';
import { useInteractionStore, useTryOnStore } from '@/store';
import './LandDetail.css';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function LandDetailPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const commentRef = useRef<HTMLTextAreaElement | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isTryOnOpen, setTryOnOpen] = useState(false);
  const [tryOnDialogError, setTryOnDialogError] = useState<string | null>(null);
  const [isPromoteOpen, setPromoteOpen] = useState(false);

  const {
    detail,
    loading,
    error,
    actionError,
    commentSubmitting,
    pendingLike,
    pendingFavorite,
    loadingPromote,
    promote,
    promoteError,
    loadDetail,
    clearDetail,
    toggleLike,
    toggleFavorite,
    submitComment,
    loadPromote,
    clearPromote,
  } = useInteractionStore();

  const {
    currentTask,
    contentId: tryOnContentId,
    submitting,
    polling,
    error: tryOnError,
    startTryOn,
    stopPolling,
    clearTask,
  } = useTryOnStore();

  useEffect(() => {
    if (!contentId) {
      return;
    }

    void loadDetail(contentId);
    clearPromote();
    clearTask();

    return () => {
      clearDetail();
      clearPromote();
      clearTask();
      stopPolling();
    };
  }, [clearDetail, clearPromote, clearTask, contentId, loadDetail, stopPolling]);

  if (!contentId) {
    return (
      <main className="land-detail-page">
        <div className="land-detail-shell">
          <section className="land-section-card land-detail-state">
            <p>缺少内容 ID，无法加载详情。</p>
          </section>
        </div>
      </main>
    );
  }

  const activeContentId = contentId;

  const isTryOnForCurrentContent =
    currentTask?.content_id === activeContentId || tryOnContentId === activeContentId;

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!detail) {
      return;
    }

    try {
      await submitComment(detail.id, commentText);
      setCommentText('');
    } catch {
      // store already keeps the action error for display
    }
  }

  async function handleTryOnSubmit(file: File): Promise<void> {
    setTryOnDialogError(null);

    try {
      const userPhotoUrl = await uploadImageToOSS(file);
      await startTryOn(activeContentId, userPhotoUrl);
      setTryOnOpen(false);
    } catch (uploadError) {
      setTryOnDialogError(
        uploadError instanceof Error ? uploadError.message : 'TryOn 提交失败'
      );
    }
  }

  async function handleTryOnSubmitUrl(url: string): Promise<void> {
    setTryOnDialogError(null);

    try {
      await startTryOn(activeContentId, url);
      setTryOnOpen(false);
    } catch (submitError) {
      setTryOnDialogError(
        submitError instanceof Error ? submitError.message : 'TryOn 提交失败'
      );
    }
  }

  async function handleOpenPromote(): Promise<void> {
    setPromoteOpen(true);
    if (!promote && !loadingPromote) {
      await loadPromote(activeContentId);
    }
  }

  return (
    <main className="land-detail-page">
      <div className="land-detail-shell">
        <Link className="land-detail-back" to="/land">
          ← Back to Feed
        </Link>

        {loading ? (
          <section className="land-section-card land-detail-state">
            <p>Loading detail...</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="land-section-card land-detail-state">
            <p>{error}</p>
            <button
              type="button"
              className="land-button primary"
              onClick={() => void loadDetail(activeContentId)}
            >
              Retry
            </button>
          </section>
        ) : null}

        {!loading && !error && detail ? (
          <div className="land-detail-grid">
            <div className="land-detail-column">
              <ImageGallery title={detail.title} shots={detail.shots} coverUrl={detail.cover_url} />
              <OutfitDetail
                description={detail.description}
                tags={detail.tags}
                items={detail.items}
              />
            </div>

            <aside className="land-detail-column">
              <section className="land-section-card land-detail-panel">
                <div className="land-detail-meta">
                  <span className="land-detail-author">Muse Creator · {formatTimestamp(detail.published_at)}</span>
                  <div className="land-tag-list">
                    {detail.tags.slice(0, 2).map((tag) => (
                      <span className="land-tag" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <h1 className="land-detail-title">{detail.title}</h1>
                <p className="land-detail-copy">
                  {detail.description || 'Published from Spark and wired into Land with the official interaction and TryOn contract.'}
                </p>

                <div className="land-detail-actions">
                  <InteractionBar
                    likeCount={detail.like_count}
                    favoriteCount={detail.favorite_count}
                    commentCount={detail.comment_count}
                    liked={detail.user_liked}
                    favorited={detail.user_favorited}
                    likePending={pendingLike}
                    favoritePending={pendingFavorite}
                    onLike={() => void toggleLike(detail.id)}
                    onFavorite={() => void toggleFavorite(detail.id)}
                    onCommentFocus={() => commentRef.current?.focus()}
                  />
                </div>

                <div className="land-detail-secondary-actions">
                  <button type="button" className="land-button primary" onClick={() => setTryOnOpen(true)}>
                    TryOn Me
                  </button>
                  <button type="button" className="land-button secondary" onClick={() => void handleOpenPromote()}>
                    Promote
                  </button>
                </div>

                {actionError ? <p className="land-error" style={{ marginTop: '14px' }}>{actionError}</p> : null}
              </section>

              <section className="land-section-card land-tryon-panel">
                <h2 className="land-panel-title">Latest TryOn</h2>
                <p className="land-detail-copy">
                  提交后结果会内联显示在这里；轮询中的任务会持续更新，离开页面时自动停止。
                </p>

                {isTryOnForCurrentContent && currentTask ? (
                  <>
                    <div className="land-tryon-status">
                      {polling ? 'processing' : currentTask.status}
                    </div>
                    <div className="land-tryon-grid">
                      <article className="land-tryon-card">
                        {currentTask.user_photo_url ? (
                          <img src={currentTask.user_photo_url} alt="Uploaded for TryOn" />
                        ) : (
                          <div className="land-tryon-placeholder">No uploaded source image</div>
                        )}
                        <div className="land-tryon-card-body">
                          <strong>Uploaded photo</strong>
                          <p>{formatTimestamp(currentTask.created_at)}</p>
                        </div>
                      </article>

                      <article className="land-tryon-card">
                        {currentTask.result_url ? (
                          <img src={currentTask.result_url} alt="TryOn result" />
                        ) : (
                          <div className="land-tryon-placeholder">
                            {currentTask.status === 'failed'
                              ? 'TryOn failed. Upload another photo to retry.'
                              : 'Generating result...'}
                          </div>
                        )}
                        <div className="land-tryon-card-body">
                          <strong>Generated result</strong>
                          <p>
                            {currentTask.completed_at
                              ? formatTimestamp(currentTask.completed_at)
                              : 'Waiting for completion'}
                          </p>
                        </div>
                      </article>
                    </div>
                  </>
                ) : (
                  <div className="land-tryon-placeholder" style={{ borderRadius: '22px', marginTop: '18px' }}>
                    No TryOn result yet for this content.
                  </div>
                )}

                {tryOnError ? <p className="land-error" style={{ marginTop: '14px' }}>{tryOnError}</p> : null}
              </section>

              <section className="land-section-card land-comments-panel">
                <h2 className="land-panel-title">Comments</h2>

                <form className="land-comment-form" onSubmit={handleCommentSubmit}>
                  <textarea
                    ref={commentRef}
                    className="land-comment-textarea"
                    placeholder="说说你想看的版本，或者你会怎么推广这套 look。"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                  />
                  <div className="land-detail-secondary-actions">
                    <button
                      type="submit"
                      className="land-button primary"
                      disabled={commentSubmitting || commentText.trim().length === 0}
                    >
                      {commentSubmitting ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>

                <div className="land-comment-list">
                  {detail.comments.length > 0 ? (
                    detail.comments.map((comment) => (
                      <article className="land-comment-card" key={comment.id}>
                        <div className="land-comment-card-header">
                          <span>{comment.user_identifier || 'Anonymous'}</span>
                          <span>{formatTimestamp(comment.created_at)}</span>
                        </div>
                        <p>{comment.comment_text || 'No comment text.'}</p>
                      </article>
                    ))
                  ) : (
                    <article className="land-comment-card">
                      <p>还没有评论。第一条评论会直接走正式 `comment` 接口写回。</p>
                    </article>
                  )}
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>

      <TryOnDialog
        isOpen={isTryOnOpen}
        submitting={submitting}
        error={tryOnDialogError || tryOnError}
        onClose={() => {
          setTryOnDialogError(null);
          setTryOnOpen(false);
        }}
        onSubmit={handleTryOnSubmit}
        onSubmitUrl={handleTryOnSubmitUrl}
      />

      <PromoteDialog
        isOpen={isPromoteOpen}
        loading={loadingPromote}
        error={promoteError}
        promote={promote}
        onClose={() => setPromoteOpen(false)}
      />
    </main>
  );
}
