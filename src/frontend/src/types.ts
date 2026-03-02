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

// ==================== 常量 ====================

/** 画布颜色 */
export const COLORS = {
  background: '#f8fafc',
  grid: '#e2e8f0',
  selection: '#3b82f6',
  text: '#1e293b',
} as const;

/** 画布尺寸限制 */
export const LIMITS = {
  minZoom: 0.1,
  maxZoom: 5,
  defaultFontSize: 16,
  minTextWidth: 120,
} as const;
