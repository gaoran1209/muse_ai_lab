import { useEffect, useRef, useCallback, useState } from 'react';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';
import { useCanvasStore } from '../../store';
import { COLORS, LIMITS } from '../../types';
import './InfiniteCanvas.css';

/**
 * 无限画布组件
 */
export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store 状态
  const { isPanning, setPanning, togglePanMode } = useCanvasStore();

  // Fabric 画布 Hook
  const { canvas, viewport, resize, setZoom, pan, addImage, addText, deleteSelected } =
    useFabricCanvas(canvasRef, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: COLORS.background,
      onViewportChange: () => {},
    });

  // 本地状态
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  /**
   * 初始化：设置画布大小和事件监听
   */
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [resize]);

  /**
   * 键盘快捷键
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 空格键：切换平移模式
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setPanning(true);
      }

      // Delete/Backspace：删除选中元素
      if ((e.code === 'Delete' || e.code === 'Backspace') && canvas) {
        const activeObject = canvas.getActiveObject();
        if (activeObject && !(activeObject as any).isEditing) {
          e.preventDefault();
          deleteSelected();
        }
      }

      // ESC：退出平移模式
      if (e.code === 'Escape') {
        setPanning(false);
        if (canvas) {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvas, setPanning, deleteSelected]);

  /**
   * 鼠标按下
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 平移模式或中键：开始拖拽
      if (isPanning || e.button === 1) {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    },
    [isPanning]
  );

  /**
   * 鼠标移动
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        pan(dx, dy);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }

      // 更新鼠标样式
      if (isPanning) {
        (e.currentTarget as HTMLDivElement).style.cursor = isDragging ? 'grabbing' : 'grab';
      } else {
        (e.currentTarget as HTMLDivElement).style.cursor = 'default';
      }
    },
    [isDragging, isPanning, lastMousePos, pan]
  );

  /**
   * 鼠标释放
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * 鼠标滚轮：缩放
   */
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();

      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(
        LIMITS.minZoom,
        Math.min(LIMITS.maxZoom, viewport.zoom + zoomDelta)
      );

      setZoom(newZoom, { x: e.clientX, y: e.clientY });
    },
    [viewport.zoom, setZoom]
  );

  /**
   * 添加文字
   */
  const handleAddText = useCallback(() => {
    // 将屏幕中心坐标转换为画布坐标
    // viewport.x = -vpt[4], 所以 vpt[4] = -viewport.x
    // CanvasX = (ScreenX - vpt[4]) / zoom = (ScreenX + viewport.x) / zoom
    const x = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
    const y = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
    addText('双击编辑文字', { x, y });
  }, [addText, viewport]);

  /**
   * 触发图片上传
   */
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 处理图片文件选择
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 读取图片
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        // 将屏幕中心坐标转换为画布坐标
        const x = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
        const y = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
        addImage(url, { x, y });
      };
      reader.readAsDataURL(file);

      // 重置 input
      e.target.value = '';
    },
    [viewport, addImage]
  );

  /**
   * 处理文件拖拽
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();

      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        // 将屏幕坐标转换为画布坐标
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

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 工具栏 */}
      <div className="canvas-toolbar">
        <div className="toolbar-group">
          <button onClick={handleAddText} className="toolbar-button" title="添加文字">
            <span>T</span>
            添加文字
          </button>
          <button onClick={handleUploadClick} className="toolbar-button" title="上传图片">
            <span>🖼️</span>
            上传图片
          </button>
          <button onClick={deleteSelected} className="toolbar-button" title="删除选中">
            <span>🗑️</span>
            删除
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={togglePanMode}
            className={`toolbar-button ${isPanning ? 'active' : ''}`}
            title="平移模式 (空格)"
          >
            <span>✋</span>
            {isPanning ? '平移中' : '平移 (空格)'}
          </button>
          <button
            onClick={() => setZoom(viewport.zoom + 0.1)}
            className="toolbar-button"
            title="放大"
          >
            <span>🔍+</span>
          </button>
          <span className="zoom-level">{Math.round(viewport.zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.max(0.1, viewport.zoom - 0.1))}
            className="toolbar-button"
            title="缩小"
          >
            <span>🔍-</span>
          </button>
        </div>
      </div>

      {/* 平移模式提示 */}
      {isPanning && (
        <div className="pan-mode-indicator">
          按住鼠标拖拽移动画布
        </div>
      )}

      {/* 拖拽提示 */}
      <div className="drag-hint">
        拖拽图片到画布上传
      </div>
    </div>
  );
}
