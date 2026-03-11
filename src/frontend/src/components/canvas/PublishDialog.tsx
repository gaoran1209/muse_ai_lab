import { useEffect, useState } from 'react';
import type { Look, Shot } from '../../types';
import './PublishDialog.css';

interface PublishDialogProps {
  open: boolean;
  look: Look | null;
  shots: Shot[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; description: string; tags: string[] }) => Promise<void>;
}

export function PublishDialog({
  open,
  look,
  shots,
  busy,
  onClose,
  onSubmit,
}: PublishDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!look || !open) return;
    setTitle(look.name);
    setDescription(look.description ?? '');
    setTags(look.style_tags.join(', '));
  }, [look, open]);

  if (!open || !look) return null;

  return (
    <div className="publish-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="publish-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Publish flow</span>
            <h2>{look.name}</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="publish-dialog-grid">
          <label>
            标题
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            标签
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="urban, editorial"
            />
          </label>
          <label className="is-wide">
            描述
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
            />
          </label>
        </div>

        <div className="publish-dialog-shots">
          {shots.map((shot) => (
            <div key={shot.id} className="publish-dialog-shot">
              {shot.thumbnail_url ?? shot.url ? (
                <img src={shot.thumbnail_url ?? shot.url ?? ''} alt={shot.id} />
              ) : (
                <div className="publish-dialog-shot-placeholder">Shot</div>
              )}
            </div>
          ))}
        </div>

        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || title.trim().length === 0}
            onClick={() =>
              void onSubmit({
                title: title.trim(),
                description: description.trim(),
                tags: tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          >
            {busy ? '发布中...' : '确认发布'}
          </button>
        </footer>
      </div>
    </div>
  );
}
