import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AssetPanel } from '../components/canvas/AssetPanel';
import { GenerationActionDialog } from '../components/canvas/GenerationActionDialog';
import { InfiniteCanvas } from '../components/canvas/InfiniteCanvas';
import { PublishDialog } from '../components/canvas/PublishDialog';
import { ResultPanel } from '../components/canvas/ResultPanel';
import { useSparkStore } from '../store';
import './Canvas.css';

export default function CanvasPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const {
    activeProject,
    assets,
    looks,
    shots,
    publishedLookIds,
    activeCategory,
    selectedPublishShotIds,
    loadingWorkspace,
    busy,
    error,
    loadWorkspace,
    renameProject,
    setActiveCategory,
    uploadAssetFiles,
    updateAssetMeta,
    deleteAssetById,
    generateLooksForAssets,
    generateShotForLook,
    togglePublishShotSelection,
    setShotAdopted,
    replaceLookItemAsset,
    publishSelectedShots,
    clearPublishSelection,
  } = useSparkStore();
  const [publishLookId, setPublishLookId] = useState<string | null>(null);
  const [resultPanelOpen, setResultPanelOpen] = useState(false);
  const [generationDialog, setGenerationDialog] = useState<{
    lookId: string;
    action: 'change_model' | 'change_background';
  } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState('');

  useEffect(() => {
    if (!projectId) return;
    void loadWorkspace(projectId);
  }, [loadWorkspace, projectId]);

  useEffect(() => {
    setDraftProjectName(activeProject?.name ?? '');
  }, [activeProject?.name]);

  if (!projectId) {
    return null;
  }

  const publishLook = looks.find((look) => look.id === publishLookId) ?? null;
  const generationLook = looks.find((look) => look.id === generationDialog?.lookId) ?? null;
  const publishShots = shots.filter(
    (shot) => selectedPublishShotIds.includes(shot.id) && shot.look_id === publishLookId
  );

  const handlePublishSubmit = async (payload: { title: string; description: string; tags: string[] }) => {
    if (!publishLookId) return;
    await publishSelectedShots(projectId, publishLookId, payload);
    setPublishLookId(null);
  };

  const submitProjectRename = async () => {
    const currentName = activeProject?.name?.trim() ?? '';
    const nextName = draftProjectName.trim();

    if (!activeProject || !nextName) {
      setDraftProjectName(activeProject?.name ?? '');
      setIsEditingTitle(false);
      return;
    }

    if (nextName === currentName) {
      setIsEditingTitle(false);
      return;
    }

    try {
      await renameProject(projectId, nextName);
      setIsEditingTitle(false);
    } catch {
      // 错误由全局 store 状态展示，保持编辑态便于用户继续修改
    }
  };

  return (
    <div className="canvas-page">
      <header className="canvas-topbar">
        <button type="button" className="canvas-back" onClick={() => navigate('/')}>
          ← Dashboard
        </button>
        <div className="canvas-titleblock">
          <span>Spark workspace</span>
          {isEditingTitle ? (
            <input
              className="canvas-title-input"
              value={draftProjectName}
              onChange={(event) => setDraftProjectName(event.target.value)}
              onBlur={() => {
                void submitProjectRename();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitProjectRename();
                }
                if (event.key === 'Escape') {
                  setDraftProjectName(activeProject?.name ?? '');
                  setIsEditingTitle(false);
                }
              }}
              maxLength={200}
              autoFocus
              aria-label="编辑方案名称"
            />
          ) : (
            <button
              type="button"
              className="canvas-title-trigger"
              onClick={() => {
                setDraftProjectName(activeProject?.name ?? '');
                setIsEditingTitle(true);
              }}
              disabled={!activeProject}
              title="点击重命名方案"
            >
              {activeProject?.name ?? 'Loading project...'}
            </button>
          )}
        </div>
        <div className="canvas-status">
          <button
            type="button"
            className={`canvas-results-toggle ${resultPanelOpen ? 'is-open' : ''}`}
            onClick={() => setResultPanelOpen((value) => !value)}
          >
            {resultPanelOpen ? '关闭结果箱' : '结果箱'}
          </button>
          {loadingWorkspace ? <span>Loading workspace...</span> : null}
          {busy ? <span>Syncing API...</span> : null}
          {error ? <span className="is-error">{error}</span> : null}
        </div>
      </header>

      <main className="canvas-layout">
        <AssetPanel
          assets={assets}
          activeCategory={activeCategory}
          busy={busy}
          onCategoryChange={setActiveCategory}
          onUpload={(files) => {
            if (!files || files.length === 0) return;
            const category = activeCategory === 'all' ? 'product' : activeCategory;
            void uploadAssetFiles(projectId, Array.from(files), category);
          }}
          onDeleteAsset={(assetId) => {
            void deleteAssetById(assetId);
          }}
          onUpdateAsset={(assetId, payload) => {
            void updateAssetMeta(assetId, payload);
          }}
        />

        <InfiniteCanvas
          looks={looks}
          shots={shots}
          busy={busy}
          onUploadFiles={(files) => {
            const category = activeCategory === 'all' ? 'product' : activeCategory;
            return uploadAssetFiles(projectId, files, category);
          }}
          onGenerateLooks={async (assetIds) => {
            await generateLooksForAssets(projectId, {
              assetIds,
              mode: assetIds.length > 2 ? 'group' : 'complete',
              count: 3,
            });
          }}
          onGenerateShot={async (lookId, action, customPrompt) => {
            if (action === 'change_model' || action === 'change_background') {
              setGenerationDialog({ lookId, action });
              return;
            }
            await generateShotForLook(projectId, lookId, {
              action,
              customPrompt,
            });
          }}
          onToggleAdopt={(shotId, adopted) => {
            void setShotAdopted(projectId, shotId, adopted);
          }}
          onReplaceLookItemAsset={(lookId, itemId, assetId) => {
            void replaceLookItemAsset(lookId, itemId, assetId);
          }}
        />

        <ResultPanel
          open={resultPanelOpen}
          looks={looks}
          shots={shots}
          selectedShotIds={selectedPublishShotIds}
          publishedLookIds={publishedLookIds}
          onToggleShot={togglePublishShotSelection}
          onToggleAdopt={(shotId, adopted) => {
            void setShotAdopted(projectId, shotId, adopted);
          }}
          onPublish={(lookId) => setPublishLookId(lookId)}
        />
      </main>

      <PublishDialog
        open={publishLook !== null}
        look={publishLook}
        shots={publishShots}
        busy={busy}
        onClose={() => {
          setPublishLookId(null);
          clearPublishSelection();
        }}
        onSubmit={handlePublishSubmit}
      />

      <GenerationActionDialog
        open={generationDialog !== null}
        look={generationLook}
        action={generationDialog?.action ?? null}
        busy={busy}
        onClose={() => setGenerationDialog(null)}
        onSubmit={async ({ presetId, customPrompt, parameters }) => {
          if (!generationDialog) return;
          await generateShotForLook(projectId, generationDialog.lookId, {
            action: generationDialog.action,
            presetId,
            customPrompt,
            parameters,
          });
          setGenerationDialog(null);
        }}
      />
    </div>
  );
}
