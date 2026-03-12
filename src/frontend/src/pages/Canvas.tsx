import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AssetPanel } from '../components/canvas/AssetPanel';
import type { QuickAction } from '../components/canvas/FloatingToolbar';
import { GenerationActionDialog } from '../components/canvas/GenerationActionDialog';
import { InfiniteCanvas } from '../components/canvas/InfiniteCanvas';
import { PublishDialog } from '../components/canvas/PublishDialog';
import { ResultPanel } from '../components/canvas/ResultPanel';
import { useCanvasAutosave } from '../hooks/useCanvasAutosave';
import { useSparkStore } from '../store';
import './Canvas.css';

export default function CanvasPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const {
    activeProject,
    assets,
    libraryAssets,
    looks,
    shots,
    publishedLookIds,
    activeCategory,
    activeLibraryScope,
    selectedPublishShotIds,
    loadingWorkspace,
    busy,
    error,
    projectCanvasState,
    loadWorkspace,
    renameProject,
    setActiveCategory,
    setActiveLibraryScope,
    uploadAssetFiles,
    ensureAssetLinked,
    updateAssetMeta,
    deleteAssetById,
    generateLooksForAssets,
    generateShotForLook,
    togglePublishShotSelection,
    setShotAdopted,
    saveLookDraft,
    saveShotCanvasPosition,
    saveProjectCanvasState,
    replaceLookItemAsset,
    publishSelectedShots,
    clearPublishSelection,
  } = useSparkStore();
  const [publishLookId, setPublishLookId] = useState<string | null>(null);
  const [assetPanelOpen, setAssetPanelOpen] = useState(true);
  const [resultPanelOpen, setResultPanelOpen] = useState(false);
  const [generationDialog, setGenerationDialog] = useState<{
    lookId: string;
    action: 'change_model' | 'change_background' | 'tryon';
    defaultMode?: string;
    sourceImageUrl?: string | null;
    targetPosition?: { x: number; y: number } | null;
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

  const { initialCanvasState, reportCanvasStateChange, saveLabel } = useCanvasAutosave({
    projectId: projectId ?? null,
    looks,
    shots,
    serverCanvasState: projectCanvasState,
    saveLookDraft,
    saveShotCanvasPosition,
    saveProjectCanvasState,
  });

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

  const handleQuickAction = useCallback(
    (
      action: QuickAction,
      imageUrl: string | null,
      targetPosition: { x: number; y: number } | null,
      lookId: string | null
    ) => {
      const actionMap: Record<QuickAction, { dialogAction: 'change_background' | 'change_model' | 'tryon'; mode?: string }> = {
        bg_blend: { dialogAction: 'change_background', mode: 'blend' },
        bg_replace: { dialogAction: 'change_background', mode: 'replace' },
        model_replicate: { dialogAction: 'change_model', mode: 'replicate' },
        model_swap_face: { dialogAction: 'change_model', mode: 'swap_face' },
        tryon: { dialogAction: 'tryon' },
      };

      const mapped = actionMap[action];
      if (!mapped) return;

      const targetLookId = lookId ?? looks[0]?.id ?? '';
      if (!targetLookId) return;

      setGenerationDialog({
        lookId: targetLookId,
        action: mapped.dialogAction,
        defaultMode: mapped.mode,
        sourceImageUrl: imageUrl,
        targetPosition,
      });
    },
    [looks]
  );

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
          {loadingWorkspace ? <span>Loading workspace...</span> : null}
          {busy ? <span>Syncing API...</span> : null}
          {saveLabel ? <span>{saveLabel}</span> : null}
          {error ? <span className="is-error">{error}</span> : null}
        </div>
      </header>

      <main className="canvas-layout">
        <AssetPanel
          open={assetPanelOpen}
          libraryAssets={libraryAssets}
          linkedAssetIds={assets.map((asset) => asset.id)}
          activeCategory={activeCategory}
          activeLibraryScope={activeLibraryScope}
          busy={busy}
          onCategoryChange={setActiveCategory}
          onLibraryScopeChange={setActiveLibraryScope}
          onUpload={(files) => {
            if (!files || files.length === 0) return;
            const category = activeCategory === 'all' ? 'product' : activeCategory;
            void uploadAssetFiles(projectId, Array.from(files), category);
          }}
          onEnsureLinked={(assetId) => {
            void ensureAssetLinked(projectId, assetId);
          }}
          onDeleteAsset={(assetId) => {
            void deleteAssetById(assetId);
          }}
          onUpdateAsset={(assetId, payload) => {
            void updateAssetMeta(assetId, payload);
          }}
          onToggleOpen={() => setAssetPanelOpen((value) => !value)}
        />

        <InfiniteCanvas
          projectId={projectId}
          looks={looks}
          shots={shots}
          busy={busy}
          initialCanvasState={initialCanvasState}
          onCanvasStateChange={reportCanvasStateChange}
          onUploadFiles={(files) => {
            const category = activeCategory === 'all' ? 'product' : activeCategory;
            return uploadAssetFiles(projectId, files, category).then(() => undefined);
          }}
          onGenerateLooks={async (assetIds) => {
            await generateLooksForAssets(projectId, {
              assetIds,
              mode: assetIds.length > 2 ? 'group' : 'complete',
              count: 3,
            });
          }}
          onGenerateShot={async (lookId, action, customPrompt) => {
            if (action === 'change_model' || action === 'change_background' || action === 'tryon') {
              setGenerationDialog({ lookId, action });
              return;
            }
            await generateShotForLook(projectId, lookId, {
              action,
              customPrompt,
            });
          }}
          onGenerateVideo={(lookId) => {
            void generateShotForLook(projectId, lookId, {
              type: 'video',
              action: 'custom',
              customPrompt: looks.find((l) => l.id === lookId)?.description ?? '',
            });
          }}
          onToggleAdopt={(shotId, adopted) => {
            void setShotAdopted(projectId, shotId, adopted);
          }}
          onSaveLookBoardPosition={(lookId, boardPosition) => {
            void saveLookDraft(lookId, { boardPosition });
          }}
          onSaveShotCanvasPosition={(shotId, canvasPosition) => {
            void saveShotCanvasPosition(shotId, canvasPosition);
          }}
          onReplaceLookItemAsset={(lookId, itemId, assetId) => {
            void replaceLookItemAsset(lookId, itemId, assetId);
          }}
          onQuickAction={handleQuickAction}
        />

        <ResultPanel
          open={resultPanelOpen}
          onToggleOpen={() => setResultPanelOpen((value) => !value)}
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
        assets={assets}
        action={generationDialog?.action ?? null}
        defaultMode={generationDialog?.defaultMode}
        busy={busy}
        onClose={() => setGenerationDialog(null)}
        onUploadReference={async (files) => uploadAssetFiles(projectId, files, 'model')}
        onSubmit={async ({ presetId, customPrompt, referenceImageUrl, parameters }) => {
          if (!generationDialog) return;
          await generateShotForLook(projectId, generationDialog.lookId, {
            action: generationDialog.action,
            presetId,
            customPrompt,
            referenceImageUrl: referenceImageUrl ?? generationDialog.sourceImageUrl ?? undefined,
            parameters,
            pendingCanvasPosition: generationDialog.targetPosition ?? undefined,
          });
          setGenerationDialog(null);
        }}
      />
    </div>
  );
}
