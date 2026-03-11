// ==================== 类型定义 ====================

/** 画布元素类型 */
export type CanvasItemType = 'text' | 'image';

/** 基础画布元素 */
export interface BaseCanvasItem {
  id: string;
  type: CanvasItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** 文字元素 */
export interface TextNoteItem extends BaseCanvasItem {
  type: 'text';
  content: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  minWidth: number;
  minHeight: number;
}

/** 图片元素 */
export interface ImageItem extends BaseCanvasItem {
  type: 'image';
  url: string;
  file?: File;
  originalWidth?: number;
  originalHeight?: number;
}

/** 画布元素 */
export type CanvasItem = TextNoteItem | ImageItem;

/** 视口状态 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// ==================== 设计系统 ====================

/** 设计 tokens - 字节跳动风格 */
export const DESIGN_TOKENS = {
  // 主色 - 飞书蓝
  primary: {
    main: '#1f71ff',
    hover: '#1a63e6',
    active: '#1557cc',
    light: '#e6f0ff',
    lighter: '#f0f6ff',
  },
  // 语义色
  semantic: {
    success: '#00b628',
    warning: '#ff8800',
    error: '#f54a45',
    info: '#1f71ff',
  },
  // 背景
  bg: {
    primary: '#ffffff',
    secondary: '#f5f6f7',
    tertiary: '#ebecef',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
  // 边框
  border: {
    light: '#e5e6eb',
    default: '#dfe1e6',
    dark: '#c5c9d0',
  },
  // 文字
  text: {
    primary: '#1f2329',
    secondary: '#646a73',
    tertiary: '#8f959e',
    quaternary: '#c9cdd4',
    inverse: '#ffffff',
  },
  // 画布专用
  canvas: {
    bg: '#f5f6f7',
    grid: '#e5e6eb',
    selection: '#1f71ff',
    selectionBg: 'rgba(31, 113, 255, 0.1)',
  },
} as const;

/** 圆角系统 */
export const RADIUS = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const;

/** 阴影系统 */
export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 6px -1px rgba(0, 0, 0, 0.04)',
  md: '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
  lg: '0 4px 8px rgba(0, 0, 0, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.12)',
  xl: '0 8px 16px rgba(0, 0, 0, 0.1), 0 16px 48px -8px rgba(0, 0, 0, 0.14)',
} as const;

/** 间距系统 */
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;

/** 动画缓动函数 */
export const EASING = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/** 动画时长 */
export const DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

// ==================== 旧常量（兼容） ====================

/** @deprecated 使用 DESIGN_TOKENS.canvas */
export const COLORS = {
  background: '#f5f6f7',
  grid: '#e5e6eb',
  selection: '#1f71ff',
  text: '#1f2329',
} as const;

/** 画布尺寸限制 */
export const LIMITS = {
  minZoom: 0.5,
  maxZoom: 2,
  defaultFontSize: 16,
  minTextWidth: 120,
} as const;

// ============================================================
// 业务实体类型（与后端 schemas.py 一一对应）
// ============================================================

/** 素材标签 */
export interface AssetTags {
  category: string;
  subcategory?: string;
  color?: string;
  style?: string;
  season?: string;
  occasion?: string;
}

/** 设计方案 */
export interface Project {
  id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

/** 方案详情（含统计） */
export interface ProjectDetail extends Project {
  asset_count: number;
  look_count: number;
}

/** 素材 */
export interface Asset {
  id: string;
  project_id: string;
  url: string;
  thumbnail_url: string | null;
  category: 'product' | 'model' | 'background' | 'pose';
  tags: AssetTags | null;
  original_filename: string | null;
  created_at: string;
}

/** Look 单品 */
export interface LookItem {
  id: string;
  look_id: string;
  asset_id: string | null;
  category: string;
  placeholder_desc: string | null;
  sort_order: number;
  asset_url?: string | null;
}

/** 搭配方案 */
export interface Look {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  style_tags: string[];
  board_position: { x: number; y: number; width: number; height: number } | null;
  items: LookItem[];
  created_at: string;
}

/** Look 列表项（轻量） */
export interface LookBrief {
  id: string;
  project_id: string;
  name: string;
  style_tags: string[];
  item_count: number;
  created_at: string;
}

/** 生成结果 / 拍摄 */
export interface Shot {
  id: string;
  look_id: string;
  content_id: string | null;
  type: 'image' | 'video';
  url: string | null;
  thumbnail_url: string | null;
  prompt: string | null;
  parameters: Record<string, unknown> | null;
  vendor: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  adopted: boolean;
  canvas_position: { x: number; y: number } | null;
  created_at: string;
}

/** 发布内容 */
export interface Content {
  id: string;
  look_id: string;
  title: string;
  description: string | null;
  tags: string[];
  cover_url: string | null;
  shot_ids: string[];
  like_count: number;
  favorite_count: number;
  comment_count: number;
  published_at: string;
}

/** 内容卡片（Feed 列表轻量版） */
export interface ContentBrief {
  id: string;
  title: string;
  cover_url: string | null;
  tags: string[];
  like_count: number;
  favorite_count: number;
  published_at: string;
}

/** 互动记录 */
export interface Interaction {
  id: string;
  content_id: string;
  type: 'like' | 'favorite' | 'comment';
  user_identifier: string;
  comment_text: string | null;
  created_at: string;
}

/** 试穿任务 */
export interface TryOnTask {
  id: string;
  content_id: string;
  user_photo_url: string;
  result_url: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

// ============================================================
// API 辅助类型
// ============================================================

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface FeedParams {
  tag?: string | null;
  page?: number;
  limit?: number;
}

/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 请求类型
// ============================================================

/** AI 搭配生成请求 */
export interface LookGenerateRequest {
  asset_ids: string[];
  mode: 'auto' | 'complete' | 'group';
  count: number;
}

/** 拍摄/生成任务请求 */
export interface ShotGenerateRequest {
  type: 'image' | 'video';
  action: 'change_model' | 'change_background' | 'tryon' | 'custom';
  vendor?: string;
  preset_id?: string;
  custom_prompt?: string;
  reference_image_url?: string;
  parameters?: Record<string, unknown>;
}

/** 内容发布请求 */
export interface ContentPublishRequest {
  look_id: string;
  shot_ids: string[];
  title: string;
  description?: string;
  tags: string[];
}

/** 评论创建请求 */
export interface CommentCreateRequest {
  text: string;
  user_identifier?: string;
}

/** TryOn 请求 */
export interface TryOnCreateRequest {
  user_photo_url: string;
}

/** Land 内容详情响应（含搭配单品 + 互动状态） */
export interface LandContentDetail extends Content {
  items: LookItem[];
  shots: Shot[];
  comments: Interaction[];
  user_liked: boolean;
  user_favorited: boolean;
}

export interface InteractionToggleResponse {
  content_id: string;
  interaction_type: 'like' | 'favorite' | 'comment';
  active: boolean;
  count: number;
}

/** 带货链接响应 */
export interface PromoteResponse {
  content_id: string;
  promote_url: string;
  qr_code_url: string | null;
}
