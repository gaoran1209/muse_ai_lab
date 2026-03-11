import { useEffect, useRef, useCallback, useState } from 'react';
import { Canvas, Point, Image as FabricImage, Textbox, type Canvas as FabricCanvas } from 'fabric';
import { COLORS, LIMITS, type Viewport } from '../types';

// ==================== Fabric 画布 Hook ====================

export interface ImageSelectInfo {
  canvasLeft: number;
  canvasTop: number;
  canvasWidth: number;
  canvasHeight: number;
  dataUrl: string; // base64 data URL of the selected image
  imageUrl?: string;
}

export interface UseFabricCanvasOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  onViewportChange?: (viewport: Viewport) => void;
  onImageSelect?: (info: ImageSelectInfo) => void;
  onSelectionChange?: (info: CanvasSelectionInfo) => void;
  onSelectionClear?: () => void;
  onCanvasDoubleClick?: (info: { canvasX: number; canvasY: number; screenX: number; screenY: number }) => void;
}

export interface CanvasSelectionInfo {
  items: Array<{
    kind: string;
    entityId?: string;
    data?: Record<string, unknown>;
  }>;
  anchor: { x: number; y: number };
}

export function useFabricCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseFabricCanvasOptions = {}
) {
  const {
    width = window.innerWidth,
    height = window.innerHeight,
    backgroundColor = COLORS.background,
    onViewportChange,
  } = options;

  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [isReady, setIsReady] = useState(false);
  const selectionAnchorRef = useRef<string>('');

  // 保持回调 refs 最新，避免事件监听器中的旧闭包
  const onImageSelectRef = useRef(options.onImageSelect);
  const onSelectionChangeRef = useRef(options.onSelectionChange);
  const onSelectionClearRef = useRef(options.onSelectionClear);
  const onCanvasDoubleClickRef = useRef(options.onCanvasDoubleClick);

  useEffect(() => { onImageSelectRef.current = options.onImageSelect; }, [options.onImageSelect]);
  useEffect(() => { onSelectionChangeRef.current = options.onSelectionChange; }, [options.onSelectionChange]);
  useEffect(() => { onSelectionClearRef.current = options.onSelectionClear; }, [options.onSelectionClear]);
  useEffect(() => { onCanvasDoubleClickRef.current = options.onCanvasDoubleClick; }, [options.onCanvasDoubleClick]);

  // 初始化画布
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      selection: true,
      preserveObjectStacking: true,
    });

    const getAnchorFromObject = (activeObject: {
      getBoundingRect: () => { left: number; top: number; width: number; height: number };
    }) => {
      const bounds = activeObject.getBoundingRect();
      return {
        x: bounds.left + bounds.width / 2,
        y: bounds.top,
      };
    };

    // 监听对象移动事件，确保控制点实时更新
    canvas.on('object:moving', () => {
      canvas.requestRenderAll();
    });

    // 监听对象缩放事件
    canvas.on('object:scaling', () => {
      canvas.requestRenderAll();
    });

    // 图片选中时通知外部
    const notifySelectionChanged = (
      selectedObjects: Array<{ data?: { kind?: string; entityId?: string } }>,
      activeObject: { getBoundingRect: () => { left: number; top: number; width: number; height: number } } | null
    ) => {
      if (!activeObject || selectedObjects.length === 0) return;
      const anchor = getAnchorFromObject(activeObject);
      onSelectionChangeRef.current?.({
        items: selectedObjects.map((obj) => ({
          kind: obj.data?.kind ?? 'unknown',
          entityId: obj.data?.entityId,
          data: obj.data,
        })),
        anchor,
      });
      selectionAnchorRef.current = `${anchor.x}:${anchor.y}:${selectedObjects.length}`;
    };

    const notifyImageSelected = (obj: any) => {
      const data = (obj?.get?.('data') as Record<string, unknown> | undefined) ?? obj?.data;
      const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : undefined;
      if (obj?.type !== 'image' && !imageUrl) {
        return;
      }
      const bounds = obj.getBoundingRect();
      let dataUrl = imageUrl?.startsWith('data:') ? imageUrl : '';
      if (obj?.type === 'image' && !dataUrl) {
        try {
          dataUrl = obj.toDataURL({ format: 'png' });
        } catch {
          dataUrl = '';
        }
      }
      onImageSelectRef.current?.({
        canvasLeft: bounds.left,
        canvasTop: bounds.top,
        canvasWidth: bounds.width,
        canvasHeight: bounds.height,
        dataUrl,
        imageUrl,
      });
    };

    canvas.on('selection:created', (e: any) => {
      notifySelectionChanged(e.selected ?? [], canvas.getActiveObject() as never);
      if (e.selected?.length === 1) {
        notifyImageSelected(e.selected[0]);
      } else {
        onSelectionClearRef.current?.();
      }
    });

    canvas.on('selection:updated', (e: any) => {
      notifySelectionChanged(e.selected ?? [], canvas.getActiveObject() as never);
      if (e.selected?.length === 1) {
        notifyImageSelected(e.selected[0]);
      } else {
        onSelectionClearRef.current?.();
      }
    });

    canvas.on('selection:cleared', () => {
      selectionAnchorRef.current = '';
      onSelectionChangeRef.current?.({
        items: [],
        anchor: { x: 0, y: 0 },
      });
      onSelectionClearRef.current?.();
    });

    canvas.on('mouse:dblclick', (event: any) => {
      if (event.target) return;
      const pointer = canvas.getPointer(event.e);
      onCanvasDoubleClickRef.current?.({
        canvasX: pointer.x,
        canvasY: pointer.y,
        screenX: event.e.clientX,
        screenY: event.e.clientY,
      });
    });

    canvas.on('after:render', () => {
      const activeObject = canvas.getActiveObject() as
        | {
            getBoundingRect: () => { left: number; top: number; width: number; height: number };
          }
        | null;
      const activeObjects = canvas.getActiveObjects() as Array<{ data?: { kind?: string; entityId?: string } }>;
      if (!activeObject || activeObjects.length === 0) return;
      const anchor = getAnchorFromObject(activeObject);
      const nextSignature = `${anchor.x}:${anchor.y}:${activeObjects.length}`;
      if (nextSignature === selectionAnchorRef.current) return;
      notifySelectionChanged(activeObjects, activeObject);
    });

    fabricCanvasRef.current = canvas;
    setIsReady(true);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
      setIsReady(false);
    };
  }, [canvasRef, width, height, backgroundColor]);

  // 更新画布大小
  const resize = useCallback((newWidth: number, newHeight: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.setWidth(newWidth);
    canvas.setHeight(newHeight);
    canvas.renderAll();
  }, []);

  // 设置缩放
  const setZoom = useCallback(
    (zoom: number, center?: { x: number; y: number }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const clampedZoom = Math.max(LIMITS.minZoom, Math.min(LIMITS.maxZoom, zoom));

      if (center) {
        canvas.zoomToPoint(new Point(center.x, center.y), clampedZoom);
      } else {
        canvas.setZoom(clampedZoom);
      }

      // 手动更新 viewport 状态
      const vpt = canvas.viewportTransform;
      if (vpt) {
        const newViewport = { x: -vpt[4], y: -vpt[5], zoom: vpt[0] };
        viewportRef.current = newViewport;
        setViewport(newViewport);
        onViewportChange?.(newViewport);
      }

      canvas.requestRenderAll();
    },
    [onViewportChange]
  );

  // 平移画布
  const pan = useCallback(
    (dx: number, dy: number) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const vpt = canvas.viewportTransform;
      if (vpt) {
        vpt[4] += dx;
        vpt[5] += dy;

        // 手动更新 viewport 状态
        const newViewport = { x: -vpt[4], y: -vpt[5], zoom: vpt[0] };
        viewportRef.current = newViewport;
        setViewport(newViewport);
        onViewportChange?.(newViewport);

        canvas.requestRenderAll();
      }
    },
    [onViewportChange]
  );

  // 添加图片（禁用旋转）
  const addImage = useCallback(
    async (
      url: string,
      options: { x?: number; y?: number; id?: string; data?: Record<string, unknown> } = {}
    ) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;

      try {
        const isDataUrl = url.startsWith('data:');
        const img = await FabricImage.fromURL(url, isDataUrl ? {} : { crossOrigin: 'anonymous' });
        if (!img) return null;

        const { x = 100, y = 100, id, data } = options;

        // 限制图片最大尺寸（相对画布适中）
        const maxSize = 280;
        const scale = Math.min(1, maxSize / Math.max(img.width!, img.height!));
        if (scale < 1) img.scale(scale);

        // 设置 origin 为中心；带边框，隐藏选择控制手柄
        img.set({
          left: x,
          top: y,
          originX: 'center',
          originY: 'center',
          selectable: true,
          hasControls: false,
          hasBorders: false,
          hasRotatingPoint: false,
          lockRotation: true,
          stroke: 'rgba(255, 255, 255, 0.18)',
          strokeWidth: 2,
          strokeUniform: true,
          padding: 6,
          ...(id && { data: { id, ...(data ?? {}) } }),
          ...(!id && data ? { data } : {}),
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();

        return img;
      } catch (err) {
        console.error('Failed to add image:', err);
        return null;
      }
    },
    []
  );

  // 添加文字
  const addText = useCallback(
    (text: string, options: { x?: number; y?: number; fontSize?: number } = {}) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return null;

      const { x = 100, y = 100, fontSize = LIMITS.defaultFontSize } = options;

      const textBox = new Textbox(text, {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        fontSize,
        fill: COLORS.text,
        width: LIMITS.minTextWidth,
        selectable: true,
        splitByGrapheme: true,
      });

      canvas.add(textBox);
      canvas.setActiveObject(textBox);
      canvas.requestRenderAll();

      return textBox;
    },
    []
  );

  // 添加视频到画布（简单的覆盖层实现）
  const addVideo = useCallback(
    (base64: string, options: { x: number; y: number } = { x: 100, y: 100 }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const { x, y } = options;

      // 创建 video 元素
      const videoElement = document.createElement('video');
      videoElement.src = `data:video/mp4;base64,${base64}`;
      videoElement.autoplay = true;
      videoElement.loop = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.crossOrigin = 'anonymous';
      videoElement.style.cssText = `
        position: absolute;
        max-width: 400px;
        max-height: 400px;
        z-index: 100;
        border: 2px solid rgba(255, 255, 255, 0.18);
        border-radius: 8px;
        cursor: grab;
        user-select: none;
      `;

      // 视频可拖拽状态
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };

      // 计算视频位置（画布坐标到屏幕坐标）
      let canvasX = x;
      let canvasY = y;

      const updateVideoPosition = () => {
        const screenX = canvasX * viewportRef.current.zoom - viewportRef.current.x;
        const screenY = canvasY * viewportRef.current.zoom - viewportRef.current.y;
        videoElement.style.left = `${screenX}px`;
        videoElement.style.top = `${screenY}px`;
      };

      updateVideoPosition();

      // 拖拽逻辑
      videoElement.addEventListener('mousedown', (e: MouseEvent) => {
        isDragging = true;
        videoElement.style.cursor = 'grabbing';
        dragOffset.x = e.clientX - parseFloat(videoElement.style.left);
        dragOffset.y = e.clientY - parseFloat(videoElement.style.top);
        e.stopPropagation();
        e.preventDefault();
      });

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newScreenX = e.clientX - dragOffset.x;
        const newScreenY = e.clientY - dragOffset.y;
        // 反向计算画布坐标
        canvasX = (newScreenX + viewportRef.current.x) / viewportRef.current.zoom;
        canvasY = (newScreenY + viewportRef.current.y) / viewportRef.current.zoom;
        updateVideoPosition();
      };

      const stopDrag = () => {
        isDragging = false;
        videoElement.style.cursor = 'grab';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopDrag);

      // 添加到 canvas 父容器
      const canvasElement = canvas.getElement();
      const container = canvasElement.parentElement;
      if (container) {
        container.appendChild(videoElement);
      }

      // 监听 viewport 变化更新位置
      const updateHandler = () => {
        updateVideoPosition();
      };
      canvas.on('after:render', updateHandler);
    },
    []
  );

  // 删除选中
  const deleteSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      canvas.discardActiveObject();
      activeObjects.forEach((obj: any) => canvas.remove(obj));
      canvas.requestRenderAll();
    }
  }, []);

  // 清空画布
  const clear = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = backgroundColor;
    canvas.renderAll();
  }, [backgroundColor]);

  return {
    canvas: fabricCanvasRef.current,
    isReady,
    viewport,
    resize,
    setZoom,
    pan,
    addImage,
    addVideo,
    addText,
    deleteSelected,
    clear,
  };
}
