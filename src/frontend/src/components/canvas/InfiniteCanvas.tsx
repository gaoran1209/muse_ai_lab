import { useEffect, useRef, useCallback, useState } from 'react';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';
import { useCanvasStore } from '../../store';
import { LIMITS } from '../../types';
import { BottomPromptBar } from './BottomPromptBar';
import './InfiniteCanvas.css';

/**
 * 无限画布组件（深色节点编辑器风格）
 */
export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store 状态
  const { isPanning, setPanning, togglePanMode } = useCanvasStore();

  // Fabric 画布 Hook（背景设为透明，让 CSS 点阵网格透出）
  const { canvas, viewport, resize, setZoom, pan, addImage, addVideo, addText, deleteSelected } =
    useFabricCanvas(canvasRef, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '',          // 透明，CSS 背景透出
      onViewportChange: () => {},
      onImageSelect: (info) => {
        setSelectedImageUrl(info.dataUrl);
        setSelectedImagePos({ x: info.canvasLeft + info.canvasWidth / 2, y: info.canvasTop + info.canvasHeight / 2 });
      },
      onSelectionClear: () => {
        setSelectedImageUrl(null);
        setSelectedImagePos(null);
      },
    });

  // 本地状态
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImagePos, setSelectedImagePos] = useState<{ x: number; y: number } | null>(null);

  /**
   * 点阵网格随视口平移/缩放而移动
   * backgroundSize  = 24 * zoom（dot 间距跟随缩放）
   * backgroundPosition = vpt[4] % size, vpt[5] % size（点随平移偏移）
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = 24;
    const size = base * viewport.zoom;
    // viewport.x = -vpt[4]，所以 vpt[4] = -viewport.x
    const x = ((-viewport.x % size) + size) % size;
    const y = ((-viewport.y % size) + size) % size;
    container.style.backgroundSize = `${size}px ${size}px`;
    container.style.backgroundPosition = `${x}px ${y}px`;
  }, [viewport]);

  /**
   * 生成图片后放置在画布视口中心
   */
  const handleImageGenerated = useCallback(
    (base64: string) => {
      const url = `data:image/png;base64,${base64}`;
      const cx = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
      const cy = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
      addImage(url, { x: cx, y: cy });
    },
    [addImage, viewport]
  );

  /**
   * 视频生成后添加到画布
   */
  const handleVideoGenerated = useCallback(
    (base64: string) => {
      // 如果有选中的图片，放在图片右侧；否则放在画布中央
      let x, y;
      if (selectedImagePos) {
        x = selectedImagePos.x + 200; // 放在选中图片右侧 200 像素处
        y = selectedImagePos.y;
      } else {
        x = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
        y = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
      }
      addVideo(base64, { x, y });
    },
    [addVideo, viewport, selectedImagePos]
  );

  /**
   * 初始化：窗口 resize 时调整画布尺寸
   */
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [resize]);

  /**
   * 键盘快捷键
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && canvas) {
        const active = canvas.getActiveObject();
        if (active && !(active as any).isEditing) {
          e.preventDefault();
          deleteSelected();
        }
      }
      if (e.code === 'Escape') {
        setPanning(false);
        if (canvas) {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvas, setPanning, deleteSelected]);

  /**
   * 平移模式时禁用画布对象的选择 / 拖拽
   */
  useEffect(() => {
    if (!canvas) return;
    const disable = isSpacePressed || isPanning;
    canvas.selection = !disable;
    canvas.getObjects().forEach((obj) => {
      obj.selectable = !disable;
      obj.evented = !disable;
    });
    canvas.requestRenderAll();
  }, [canvas, isSpacePressed, isPanning]);

  const isActuallyPanning = isSpacePressed || isPanning;

  // ==================== 鼠标事件 ====================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isActuallyPanning || e.button === 1) {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    },
    [isActuallyPanning]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        pan(e.clientX - lastMousePos.x, e.clientY - lastMousePos.y);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
      if (isActuallyPanning) {
        (e.currentTarget as HTMLDivElement).style.cursor = isDragging ? 'grabbing' : 'grab';
      } else {
        (e.currentTarget as HTMLDivElement).style.cursor = 'default';
      }
    },
    [isDragging, isActuallyPanning, lastMousePos, pan]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(LIMITS.minZoom, Math.min(LIMITS.maxZoom, viewport.zoom + delta));
      setZoom(newZoom, { x: e.clientX, y: e.clientY });
    },
    [viewport.zoom, setZoom]
  );

  // ==================== 工具栏操作 ====================

  const handleAddText = useCallback(() => {
    const x = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
    const y = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
    addText('双击编辑文字', { x, y });
  }, [addText, viewport]);

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        const x = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
        const y = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
        addImage(url, { x, y });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [viewport, addImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        const x = (e.clientX + viewport.x) / viewport.zoom;
        const y = (e.clientY + viewport.y) / viewport.zoom;
        addImage(url, { x, y });
      };
      reader.readAsDataURL(file);
    },
    [viewport, addImage]
  );

  return (
    <div
      ref={containerRef}
      className="infinite-canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} />

      {/* 隐藏文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 底部生成面板（始终可见） */}
      <BottomPromptBar
        onImageGenerated={handleImageGenerated}
        onVideoGenerated={handleVideoGenerated}
        selectedImageDataUrl={selectedImageUrl}
      />

      {/* 左侧工具侧边栏 */}
      <div className="canvas-sidebar">
        <button onClick={handleAddText} className="sidebar-button" data-tip="文字">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" />
          </svg>
        </button>
        <button onClick={handleUploadClick} className="sidebar-button" data-tip="上传图片">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" fill="currentColor" stroke="none" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" />
          </svg>
        </button>

        <div className="sidebar-divider" />

        <button
          onClick={togglePanMode}
          className={`sidebar-button ${isPanning ? 'active' : ''}`}
          data-tip="平移"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 11V6a2 2 0 00-4 0M14 10V4a2 2 0 00-4 0v6M10 10.5V8a2 2 0 00-4 0v8c0 4 3 7 7 7h1a5 5 0 005-5v-5a2 2 0 00-4 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => setZoom(Math.max(LIMITS.minZoom, viewport.zoom - 0.1))}
          className="sidebar-button"
          data-tip="缩小"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <span className="zoom-display">{Math.round(viewport.zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(LIMITS.maxZoom, viewport.zoom + 0.1))}
          className="sidebar-button"
          data-tip="放大"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 平移模式提示 */}
      {isActuallyPanning && (
        <div className="pan-mode-indicator">
          {isSpacePressed ? '松开空格退出平移' : 'ESC 退出平移模式'}
        </div>
      )}

      {/* 拖拽提示 */}
      <div className="drag-hint">拖拽图片到画布 · 上传</div>
    </div>
  );
}
