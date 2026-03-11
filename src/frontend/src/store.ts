import { create } from 'zustand';
import {
  commentLandContent,
  createTryOnTask,
  favoriteLandContent,
  fetchLandContentDetail,
  fetchLandFeed,
  fetchPromotePayload,
  fetchTryOnTask,
  likeLandContent,
} from '@/api/land';
import {
  adoptShot,
  createAsset,
  createProject,
  deleteAsset,
  deleteProject,
  duplicateProject,
  fetchProjects,
  fetchWorkspace,
  generateLooks,
  generateShot,
  publishContent,
  updateAsset,
  updateLook,
  updateProject,
} from './lib/sparkApi';
import type {
  Asset,
  CanvasItem,
  Content,
  ContentBrief,
  FeedParams,
  LandContentDetail,
  Look,
  ProjectDetail,
  PromoteResponse,
  Shot,
  TryOnTask,
  Viewport,
} from './types';

// ============================================================
// CANVAS STORE — 现有画布状态（保留原有代码）
// ============================================================

interface CanvasStore {
  // 状态
  items: CanvasItem[];
  viewport: Viewport;
  selectedIds: string[];
  isPanning: boolean;

  // 操作
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  deleteItem: (id: string) => void;
  deleteSelected: () => void;
  clearAll: () => void;
  selectItem: (id: string) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  setViewport: (viewport: Partial<Viewport>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPanning: (isPanning: boolean) => void;
  togglePanMode: () => void;
}

const defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 };

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // 初始状态
  items: [],
  viewport: defaultViewport,
  selectedIds: [],
  isPanning: false,

  // 操作
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? ({ ...item, ...updates } as CanvasItem) : item
      ),
    })),

  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),

  deleteSelected: () =>
    set((state) => ({
      items: state.items.filter((item) => !state.selectedIds.includes(item.id)),
      selectedIds: [],
    })),

  clearAll: () => set({ items: [], selectedIds: [], viewport: defaultViewport }),

  selectItem: (id) => set({ selectedIds: [id] }),

  deselectAll: () => set({ selectedIds: [] }),

  isSelected: (id) => get().selectedIds.includes(id),

  setViewport: (viewport) =>
    set((state) => ({ viewport: { ...state.viewport, ...viewport } })),

  zoomIn: () =>
    set((state) => ({
      viewport: { ...state.viewport, zoom: Math.min(2, state.viewport.zoom + 0.1) },
    })),

  zoomOut: () =>
    set((state) => ({
      viewport: { ...state.viewport, zoom: Math.max(0.5, state.viewport.zoom - 0.1) },
    })),

  setPanning: (isPanning) => set({ isPanning }),

  togglePanMode: () => set((state) => ({ isPanning: !state.isPanning })),
}));

// ============================================================
// SPARK STORE — Agent B 负责实现
// 包含：ProjectStore, AssetStore, LookStore, GenerationStore
// ============================================================
interface SparkStore {
  projects: ProjectDetail[];
  activeProject: ProjectDetail | null;
  assets: Asset[];
  looks: Look[];
  shots: Shot[];
  publishedLookIds: string[];
  activeCategory: 'all' | Asset['category'];
  selectedPublishShotIds: string[];
  selectedLookId: string | null;
  loadingProjects: boolean;
  loadingWorkspace: boolean;
  busy: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  createProjectAndOpen: (name?: string) => Promise<ProjectDetail>;
  duplicateProjectAndOpen: (projectId: string) => Promise<ProjectDetail>;
  deleteProjectById: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, name: string) => Promise<ProjectDetail>;
  loadWorkspace: (projectId: string) => Promise<void>;
  setActiveCategory: (category: 'all' | Asset['category']) => void;
  uploadAssetFiles: (projectId: string, files: File[], category: Asset['category']) => Promise<void>;
  updateAssetMeta: (assetId: string, payload: { category?: Asset['category']; tags?: Asset['tags'] }) => Promise<Asset>;
  deleteAssetById: (assetId: string) => Promise<void>;
  upsertLook: (look: Look) => void;
  upsertShot: (shot: Shot) => void;
  generateLooksForAssets: (
    projectId: string,
    options: { assetIds: string[]; mode: 'auto' | 'complete' | 'group'; count: number }
  ) => Promise<Look[]>;
  generateShotForLook: (
    projectId: string,
    lookId: string,
    options: {
      type?: 'image' | 'video';
      action: 'change_model' | 'change_background' | 'tryon' | 'custom';
      vendor?: string;
      presetId?: string;
      customPrompt?: string;
      parameters?: Record<string, string | number | boolean | null>;
    }
  ) => Promise<Shot>;
  setSelectedLookId: (lookId: string | null) => void;
  togglePublishShotSelection: (shotId: string) => void;
  clearPublishSelection: () => void;
  setShotAdopted: (projectId: string, shotId: string, adopted: boolean) => Promise<void>;
  replaceLookItemAsset: (lookId: string, itemId: string, assetId: string) => Promise<Look>;
  publishSelectedShots: (
    projectId: string,
    lookId: string,
    payload: { title: string; description: string; tags: string[] }
  ) => Promise<Content>;
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) return [nextItem, ...items];

  const nextItems = [...items];
  nextItems[existingIndex] = nextItem;
  return nextItems;
}

function sortProjectsByUpdatedAt(projects: ProjectDetail[]): ProjectDetail[] {
  return [...projects].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

export const useSparkStore = create<SparkStore>((set, get) => ({
  projects: [],
  activeProject: null,
  assets: [],
  looks: [],
  shots: [],
  publishedLookIds: [],
  activeCategory: 'all',
  selectedPublishShotIds: [],
  selectedLookId: null,
  loadingProjects: false,
  loadingWorkspace: false,
  busy: false,
  error: null,

  loadProjects: async () => {
    set({ loadingProjects: true, error: null });
    try {
      const projects = await fetchProjects();
      set({ projects, loadingProjects: false });
    } catch (error) {
      set({
        loadingProjects: false,
        error: error instanceof Error ? error.message : '无法加载项目列表',
      });
    }
  },

  createProjectAndOpen: async (name = 'Untitled Project') => {
    set({ busy: true, error: null });
    try {
      const project = await createProject(name);
      set((state) => ({
        busy: false,
        activeProject: project,
        projects: [project, ...state.projects],
      }));
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : '新建项目失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  duplicateProjectAndOpen: async (projectId) => {
    set({ busy: true, error: null });
    try {
      const project = await duplicateProject(projectId);
      set((state) => ({
        busy: false,
        activeProject: project,
        projects: sortProjectsByUpdatedAt([project, ...state.projects]),
      }));
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : '复制方案失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  deleteProjectById: async (projectId) => {
    set({ busy: true, error: null });
    try {
      await deleteProject(projectId);
      set((state) => ({
        busy: false,
        projects: state.projects.filter((project) => project.id !== projectId),
        activeProject: state.activeProject?.id === projectId ? null : state.activeProject,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除方案失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  renameProject: async (projectId, name) => {
    set({ busy: true, error: null });
    try {
      const project = await updateProject(projectId, { name });
      set((state) => ({
        busy: false,
        activeProject: state.activeProject?.id === projectId ? project : state.activeProject,
        projects: sortProjectsByUpdatedAt(
          state.projects.map((item) => (item.id === projectId ? project : item))
        ),
      }));
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : '方案重命名失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  loadWorkspace: async (projectId: string) => {
    set({ loadingWorkspace: true, error: null, selectedPublishShotIds: [], selectedLookId: null });
    try {
      const bundle = await fetchWorkspace(projectId);
      set({
        loadingWorkspace: false,
        activeProject: bundle.project,
        assets: bundle.assets,
        looks: bundle.looks,
        shots: bundle.shots,
        publishedLookIds: bundle.publishedLookIds,
      });
    } catch (error) {
      set({
        loadingWorkspace: false,
        error: error instanceof Error ? error.message : '无法加载工作台',
      });
    }
  },

  setActiveCategory: (category) => set({ activeCategory: category }),

  uploadAssetFiles: async (projectId, files, category) => {
    set({ busy: true, error: null });
    try {
      const createdAssets = await Promise.all(
        files.map((file) => createAsset(projectId, file, category))
      );
      set((state) => ({
        busy: false,
        assets: [...createdAssets, ...state.assets],
        activeProject: state.activeProject
          ? { ...state.activeProject, asset_count: state.activeProject.asset_count + createdAssets.length }
          : state.activeProject,
      }));
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : '素材上传失败' });
    }
  },

  updateAssetMeta: async (assetId, payload) => {
    set({ busy: true, error: null });
    try {
      const asset = await updateAsset(assetId, payload);
      set((state) => ({
        busy: false,
        assets: state.assets.map((item) => (item.id === assetId ? asset : item)),
      }));
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : '素材更新失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  deleteAssetById: async (assetId) => {
    set({ busy: true, error: null });
    try {
      await deleteAsset(assetId);
      set((state) => ({
        busy: false,
        assets: state.assets.filter((asset) => asset.id !== assetId),
        activeProject: state.activeProject
          ? {
              ...state.activeProject,
              asset_count: Math.max(0, state.activeProject.asset_count - 1),
            }
          : state.activeProject,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除素材失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  upsertLook: (look) => set((state) => ({ looks: upsertById(state.looks, look) })),

  upsertShot: (shot) => set((state) => ({ shots: upsertById(state.shots, shot) })),

  generateLooksForAssets: async (projectId, options) => {
    set({ busy: true, error: null });
    try {
      const looks = await generateLooks(projectId, options);
      set((state) => ({
        busy: false,
        looks: [...looks.filter((look) => !state.looks.some((item) => item.id === look.id)), ...state.looks],
        activeProject: state.activeProject
          ? { ...state.activeProject, look_count: state.activeProject.look_count + looks.length }
          : state.activeProject,
      }));
      return looks;
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'AI 搭配生成失败' });
      throw error;
    }
  },

  generateShotForLook: async (projectId, lookId, options) => {
    set({ busy: true, error: null });
    try {
      const shot = await generateShot(projectId, lookId, options);
      set((state) => ({ busy: false, shots: upsertById(state.shots, shot) }));
      return shot;
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : '拍摄生成失败' });
      throw error;
    }
  },

  setSelectedLookId: (lookId) => set({ selectedLookId: lookId }),

  togglePublishShotSelection: (shotId) =>
    set((state) => ({
      selectedPublishShotIds: state.selectedPublishShotIds.includes(shotId)
        ? state.selectedPublishShotIds.filter((id) => id !== shotId)
        : [...state.selectedPublishShotIds, shotId],
    })),

  clearPublishSelection: () => set({ selectedPublishShotIds: [] }),

  setShotAdopted: async (projectId, shotId, adopted) => {
    try {
      const shot = await adoptShot(projectId, shotId, adopted);
      set((state) => ({
        shots: state.shots.map((item) => (item.id === shotId ? shot : item)),
        selectedPublishShotIds: adopted
          ? state.selectedPublishShotIds
          : state.selectedPublishShotIds.filter((id) => id !== shotId),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '采纳状态更新失败' });
    }
  },

  replaceLookItemAsset: async (lookId, itemId, assetId) => {
    const look = get().looks.find((item) => item.id === lookId);
    const asset = get().assets.find((item) => item.id === assetId);
    if (!look || !asset) {
      throw new Error('Look 或素材不存在');
    }

    const nextItems = look.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            asset_id: asset.id,
            asset_url: asset.url,
            category: asset.tags?.subcategory ?? asset.category,
            placeholder_desc: null,
          }
        : item
    );

    set({ busy: true, error: null });
    try {
      const updatedLook = await updateLook(lookId, {
        name: look.name,
        description: look.description,
        styleTags: look.style_tags,
        boardPosition: look.board_position,
        items: nextItems,
      });
      set((state) => ({
        busy: false,
        looks: state.looks.map((item) => (item.id === lookId ? updatedLook : item)),
      }));
      return updatedLook;
    } catch (error) {
      const message = error instanceof Error ? error.message : '替换搭配单品失败';
      set({ busy: false, error: message });
      throw error;
    }
  },

  publishSelectedShots: async (projectId, lookId, payload) => {
    const shotIds = get().selectedPublishShotIds.filter((shotId) =>
      get().shots.some((shot) => shot.id === shotId && shot.look_id === lookId)
    );
    const content = await publishContent(projectId, lookId, { ...payload, shotIds });
    set((state) => ({
      publishedLookIds: state.publishedLookIds.includes(lookId)
        ? state.publishedLookIds
        : [...state.publishedLookIds, lookId],
      selectedPublishShotIds: state.selectedPublishShotIds.filter(
        (shotId) => !shotIds.includes(shotId)
      ),
    }));
    return content;
  },
}));

// ============================================================
// LAND STORE — Agent C 负责实现
// 包含：FeedStore, InteractionStore, TryOnStore
// ============================================================
type FeedView = 'for-you' | 'by-collection';

interface FeedStore {
  feed: ContentBrief[];
  availableTags: string[];
  page: number;
  limit: number;
  tag: string | null;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  view: FeedView;
  loadFeed: (params?: FeedParams & { append?: boolean }) => Promise<void>;
  setView: (view: FeedView) => void;
  setTag: (tag: string | null) => Promise<void>;
  reset: () => void;
}

const defaultFeedState = {
  feed: [] as ContentBrief[],
  availableTags: [] as string[],
  page: 1,
  limit: 12,
  tag: null,
  total: 0,
  hasMore: true,
  loading: false,
  error: null as string | null,
  view: 'for-you' as FeedView,
};

export const useFeedStore = create<FeedStore>((set, get) => ({
  ...defaultFeedState,

  loadFeed: async (params) => {
    const append = params?.append ?? false;
    const nextPage = params?.page ?? (append ? get().page + 1 : 1);
    const nextLimit = params?.limit ?? get().limit;
    const nextTag = params?.tag ?? get().tag;

    set({ loading: true, error: null });

    try {
      const response = await fetchLandFeed({
        page: nextPage,
        limit: nextLimit,
        tag: nextTag,
      });

      const nextTags = Array.from(
        new Set(
          (nextTag ? get().availableTags : []).concat(
            response.items.flatMap((item) => item.tags)
          )
        )
      );

      set((state) => ({
        feed: append ? [...state.feed, ...response.items] : response.items,
        availableTags: nextTags,
        page: response.page,
        limit: response.limit,
        tag: nextTag ?? null,
        total: response.total,
        hasMore: response.page * response.limit < response.total,
        loading: false,
        error: null,
      }));
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Feed 加载失败',
      });
    }
  },

  setView: (view) => set({ view }),

  setTag: async (tag) => {
    set({ tag, page: 1, feed: [], hasMore: true });
    await get().loadFeed({ tag, page: 1 });
  },

  reset: () => set({ ...defaultFeedState }),
}));

interface InteractionStore {
  detail: LandContentDetail | null;
  loading: boolean;
  error: string | null;
  commentSubmitting: boolean;
  actionError: string | null;
  pendingLike: boolean;
  pendingFavorite: boolean;
  loadingPromote: boolean;
  promote: PromoteResponse | null;
  promoteError: string | null;
  loadDetail: (contentId: string) => Promise<void>;
  clearDetail: () => void;
  toggleLike: (contentId: string) => Promise<void>;
  toggleFavorite: (contentId: string) => Promise<void>;
  submitComment: (contentId: string, text: string) => Promise<void>;
  loadPromote: (contentId: string) => Promise<void>;
  clearPromote: () => void;
}

export const useInteractionStore = create<InteractionStore>((set, get) => ({
  detail: null,
  loading: false,
  error: null,
  commentSubmitting: false,
  actionError: null,
  pendingLike: false,
  pendingFavorite: false,
  loadingPromote: false,
  promote: null,
  promoteError: null,

  loadDetail: async (contentId) => {
    set({ loading: true, error: null, actionError: null });

    try {
      const detail = await fetchLandContentDetail(contentId);
      set({ detail, loading: false, error: null });
    } catch (error) {
      set({
        detail: null,
        loading: false,
        error: error instanceof Error ? error.message : '详情加载失败',
      });
    }
  },

  clearDetail: () =>
    set({
      detail: null,
      loading: false,
      error: null,
      actionError: null,
    }),

  toggleLike: async (contentId) => {
    const detail = get().detail;
    if (!detail || get().pendingLike) {
      return;
    }

    const optimisticActive = !detail.user_liked;
    const optimisticCount = detail.like_count + (optimisticActive ? 1 : -1);

    set({
      pendingLike: true,
      actionError: null,
      detail: {
        ...detail,
        user_liked: optimisticActive,
        like_count: Math.max(0, optimisticCount),
      },
    });

    try {
      const response = await likeLandContent(contentId);
      set((state) => ({
        pendingLike: false,
        detail: state.detail
          ? {
              ...state.detail,
              user_liked: response.active,
              like_count: response.count,
            }
          : state.detail,
      }));
    } catch (error) {
      set({
        pendingLike: false,
        actionError: error instanceof Error ? error.message : '点赞失败',
        detail,
      });
    }
  },

  toggleFavorite: async (contentId) => {
    const detail = get().detail;
    if (!detail || get().pendingFavorite) {
      return;
    }

    const optimisticActive = !detail.user_favorited;
    const optimisticCount = detail.favorite_count + (optimisticActive ? 1 : -1);

    set({
      pendingFavorite: true,
      actionError: null,
      detail: {
        ...detail,
        user_favorited: optimisticActive,
        favorite_count: Math.max(0, optimisticCount),
      },
    });

    try {
      const response = await favoriteLandContent(contentId);
      set((state) => ({
        pendingFavorite: false,
        detail: state.detail
          ? {
              ...state.detail,
              user_favorited: response.active,
              favorite_count: response.count,
            }
          : state.detail,
      }));
    } catch (error) {
      set({
        pendingFavorite: false,
        actionError: error instanceof Error ? error.message : '收藏失败',
        detail,
      });
    }
  },

  submitComment: async (contentId, text) => {
    const value = text.trim();
    if (!value) {
      return;
    }

    set({ commentSubmitting: true, actionError: null });

    try {
      const comment = await commentLandContent(contentId, { text: value });
      set((state) => ({
        commentSubmitting: false,
        detail: state.detail
          ? {
              ...state.detail,
              comment_count: state.detail.comment_count + 1,
              comments: [comment, ...state.detail.comments],
            }
          : state.detail,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '评论提交失败';
      set({
        commentSubmitting: false,
        actionError: message,
      });
      throw new Error(message);
    }
  },

  loadPromote: async (contentId) => {
    set({ loadingPromote: true, promoteError: null });

    try {
      const promote = await fetchPromotePayload(contentId);
      set({ loadingPromote: false, promote, promoteError: null });
    } catch (error) {
      set({
        loadingPromote: false,
        promote: null,
        promoteError: error instanceof Error ? error.message : '带货链接获取失败',
      });
    }
  },

  clearPromote: () => set({ loadingPromote: false, promote: null, promoteError: null }),
}));

interface TryOnStore {
  currentTask: TryOnTask | null;
  contentId: string | null;
  submitting: boolean;
  polling: boolean;
  error: string | null;
  pollSessionId: number;
  startTryOn: (contentId: string, userPhotoUrl: string) => Promise<void>;
  stopPolling: () => void;
  clearTask: () => void;
}

const POLL_INTERVAL_MS = 2500;

export const useTryOnStore = create<TryOnStore>((set, get) => ({
  currentTask: null,
  contentId: null,
  submitting: false,
  polling: false,
  error: null,
  pollSessionId: 0,

  startTryOn: async (contentId, userPhotoUrl) => {
    const nextSessionId = get().pollSessionId + 1;
    set({
      submitting: true,
      polling: false,
      error: null,
      pollSessionId: nextSessionId,
    });

    try {
      const task = await createTryOnTask(contentId, { user_photo_url: userPhotoUrl });
      set({
        currentTask: task,
        contentId,
        submitting: false,
        polling: task.status === 'queued' || task.status === 'processing',
      });

      if (task.status === 'completed' || task.status === 'failed') {
        return;
      }

      void (async () => {
        try {
          while (get().pollSessionId === nextSessionId) {
            await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));

            if (get().pollSessionId !== nextSessionId) {
              return;
            }

            const latestTask = await fetchTryOnTask(task.id);
            set({
              currentTask: latestTask,
              contentId,
              polling: latestTask.status === 'queued' || latestTask.status === 'processing',
              error: null,
            });

            if (latestTask.status === 'completed' || latestTask.status === 'failed') {
              return;
            }
          }
        } catch (error) {
          set({
            polling: false,
            error: error instanceof Error ? error.message : 'TryOn 轮询失败',
          });
        }
      })();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TryOn 提交失败';
      set({
        submitting: false,
        polling: false,
        error: message,
      });
      throw new Error(message);
    }
  },

  stopPolling: () =>
    set((state) => ({
      pollSessionId: state.pollSessionId + 1,
      polling: false,
    })),

  clearTask: () =>
    set((state) => ({
      currentTask: null,
      contentId: null,
      submitting: false,
      polling: false,
      error: null,
      pollSessionId: state.pollSessionId + 1,
    })),
}));
