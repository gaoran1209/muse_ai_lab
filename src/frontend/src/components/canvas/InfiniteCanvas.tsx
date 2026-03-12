import { ActiveSelection } from 'fabric';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFabricCanvas } from '../../hooks/useFabricCanvas';
import { useCanvasStore } from '../../store';
import {
  LIMITS,
  type CanvasDraftState,
  type CanvasGenerationMeta,
  type CanvasLocalBoard,
  type CanvasLocalNode,
  type Look,
  type Shot,
} from '../../types';
import { BottomPromptBar, type GeneratedMediaPayload, type PromptSelection } from './BottomPromptBar';
import { createCanvasNodeGroup, getCanvasNodeSize, type CanvasNodeType, updateCanvasNodeGroup } from './CanvasNode';
import { FloatingToolbar, type FloatingSelectionKind, type QuickAction } from './FloatingToolbar';
import { createLookFrameGroup } from './LookFrame';
import './InfiniteCanvas.css';

interface InfiniteCanvasProps {
  projectId: string;
  looks: Look[];
  shots: Shot[];
  busy: boolean;
  initialCanvasState: CanvasDraftState | null;
  onCanvasStateChange: (canvasState: CanvasDraftState) => void;
  onGenerateLooks: (assetIds: string[]) => Promise<void>;
  onGenerateShot: (
    lookId: string,
    action: 'change_model' | 'change_background' | 'tryon' | 'custom',
    customPrompt?: string
  ) => Promise<void>;
  onGenerateVideo?: (lookId: string) => void;
  onToggleAdopt: (shotId: string, adopted: boolean) => void;
  onSaveLookBoardPosition: (
    lookId: string,
    boardPosition: NonNullable<Look['board_position']>
  ) => void;
  onSaveShotCanvasPosition: (
    shotId: string,
    canvasPosition: NonNullable<Shot['canvas_position']>
  ) => void;
  onUploadFiles: (files: File[]) => Promise<void> | void;
  onReplaceLookItemAsset: (lookId: string, itemId: string, assetId: string) => void;
  onQuickAction?: (
    action: QuickAction,
    imageUrl: string | null,
    targetPosition: { x: number; y: number } | null,
    lookId: string | null
  ) => void;
}

interface ToolbarSelection {
  anchor: { x: number; y: number };
  bottomAnchor: { x: number; y: number };
  kind: FloatingSelectionKind;
  ids: string[];
  data?: Record<string, unknown>;
}

interface CreateMenuState {
  canvasX: number;
  canvasY: number;
  screenX: number;
  screenY: number;
}

interface ClipboardNodeDescriptor {
  kind: 'node';
  nodeKind: CanvasLocalNode['kind'];
  type: CanvasNodeType;
  label: string;
  prompt: string;
  x: number;
  y: number;
  imageUrl?: string | null;
  statusText?: string | null;
  generation?: CanvasGenerationMeta | null;
}

interface ClipboardBoardDescriptor {
  kind: 'board';
  name: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: ClipboardNodeDescriptor[];
}

type ClipboardDescriptor = ClipboardNodeDescriptor | ClipboardBoardDescriptor;

type Position = { x: number; y: number };
type FramePosition = { x: number; y: number; width: number; height: number };

const BOARD_PADDING_X = 36;
const BOARD_PADDING_Y = 44;
const BOARD_TITLE_HEIGHT = 32;
const BOARD_GAP_X = 28;
const BOARD_GAP_Y = 32;
const DEFAULT_BOARD_ORIGIN = { x: 120, y: 120 };
const DEFAULT_BOARD_SPACING = { x: 980, y: 620 };

function defaultPrompt(type: CanvasNodeType) {
  if (type === 'text') return '';
  if (type === 'video') return 'Describe motion, camera, and energy for this clip.';
  return 'Describe the image you want to generate.';
}

function computeBoardFrame(look: Look, lookIndex: number): FramePosition {
  const items = Math.max(look.items.length, 1);
  const columns = items > 2 ? 2 : items;
  const rows = Math.ceil(items / columns);
  const imageSize = getCanvasNodeSize('image');
  const width = BOARD_PADDING_X * 2 + columns * imageSize.width + (columns - 1) * BOARD_GAP_X;
  const height =
    BOARD_TITLE_HEIGHT +
    BOARD_PADDING_Y * 2 +
    rows * imageSize.height +
    (rows - 1) * BOARD_GAP_Y;

  if (look.board_position) {
    return {
      x: look.board_position.x,
      y: look.board_position.y,
      width: Math.max(look.board_position.width, width),
      height: Math.max(look.board_position.height, height),
    };
  }

  return {
    x: DEFAULT_BOARD_ORIGIN.x + (lookIndex % 2) * DEFAULT_BOARD_SPACING.x,
    y: DEFAULT_BOARD_ORIGIN.y + Math.floor(lookIndex / 2) * DEFAULT_BOARD_SPACING.y,
    width,
    height,
  };
}

function computeNodePositionInFrame(frame: FramePosition, itemIndex: number, count: number) {
  const columns = count > 2 ? 2 : Math.max(count, 1);
  const column = itemIndex % columns;
  const row = Math.floor(itemIndex / columns);
  const imageSize = getCanvasNodeSize('image');
  return {
    x:
      frame.x +
      BOARD_PADDING_X +
      imageSize.width / 2 +
      column * (imageSize.width + BOARD_GAP_X),
    y:
      frame.y +
      BOARD_TITLE_HEIGHT +
      BOARD_PADDING_Y +
      imageSize.height / 2 +
      row * (imageSize.height + BOARD_GAP_Y),
  };
}

function defaultShotPosition(frame: FramePosition, shotIndex: number): Position {
  const size = getCanvasNodeSize('image');
  const column = shotIndex % 2;
  const row = Math.floor(shotIndex / 2);
  return {
    x: frame.x + frame.width + 160 + column * (size.width + 64),
    y: frame.y + 110 + row * (size.height + 52),
  };
}

function pendingShotPreviewUrl(shot: Shot, look: Look | undefined): string | null {
  const inputImages = Array.isArray(shot.parameters?.input_images)
    ? shot.parameters.input_images.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  if (inputImages[0]) {
    return inputImages[0];
  }
  return look?.items.find((item) => item.asset_url)?.asset_url ?? null;
}

function shotStatusText(shot: Shot) {
  if (shot.status === 'queued' || shot.status === 'processing') {
    return '生成中...';
  }
  if (shot.status === 'failed') {
    return '生成失败';
  }
  return shot.adopted ? '已采纳' : '待确认';
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function InfiniteCanvas({
  projectId,
  looks,
  shots,
  busy,
  initialCanvasState,
  onCanvasStateChange,
  onGenerateLooks,
  onGenerateShot,
  onGenerateVideo,
  onToggleAdopt,
  onSaveLookBoardPosition,
  onSaveShotCanvasPosition,
  onUploadFiles,
  onReplaceLookItemAsset,
  onQuickAction,
}: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isPanning, setPanning, togglePanMode } = useCanvasStore();
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [toolbarSelection, setToolbarSelection] = useState<ToolbarSelection | null>(null);
  const [promptSelection, setPromptSelection] = useState<PromptSelection | null>(null);
  const [createMenu, setCreateMenu] = useState<CreateMenuState | null>(null);
  const [lookPromptOverrides, setLookPromptOverrides] = useState<Record<string, string>>({});
  const [lookFrameOverrides, setLookFrameOverrides] = useState<Record<string, FramePosition>>({});
  const [shotPositionOverrides, setShotPositionOverrides] = useState<Record<string, Position>>({});
  const [hiddenLookIds, setHiddenLookIds] = useState<string[]>([]);
  const [hiddenLookItemIds, setHiddenLookItemIds] = useState<string[]>([]);
  const [hiddenShotIds, setHiddenShotIds] = useState<string[]>([]);
  const [localNodes, setLocalNodes] = useState<CanvasLocalNode[]>([]);
  const [localBoards, setLocalBoards] = useState<CanvasLocalBoard[]>([]);
  const clipboardRef = useRef<ClipboardDescriptor[]>([]);
  const dragHighlightRef = useRef<{ object: any; originalStroke: unknown; originalStrokeWidth: unknown } | null>(null);
  const hydratedProjectRef = useRef<string | null>(null);

  const visibleLooks = useMemo(
    () => looks.filter((look) => !hiddenLookIds.includes(look.id)),
    [hiddenLookIds, looks]
  );
  const visibleShots = useMemo(
    () => shots.filter((shot) => !hiddenShotIds.includes(shot.id)),
    [hiddenShotIds, shots]
  );
  const looksWithOverrides = useMemo(
    () =>
      visibleLooks.map((look, lookIndex) => ({
        ...look,
        description: lookPromptOverrides[look.id] ?? look.description,
        frame: lookFrameOverrides[look.id] ?? computeBoardFrame(look, lookIndex),
      })),
    [lookFrameOverrides, lookPromptOverrides, visibleLooks]
  );
  const shotsWithOverrides = useMemo(
    () =>
      visibleShots.map((shot) => ({
        ...shot,
        position: shotPositionOverrides[shot.id] ?? shot.canvas_position ?? null,
      })),
    [shotPositionOverrides, visibleShots]
  );

  const buildLocalNodeFromDescriptor = useCallback(
    (descriptor: ClipboardNodeDescriptor, index = 0): CanvasLocalNode => ({
      id: `${descriptor.nodeKind}-${Date.now()}-${index}`,
      kind: descriptor.nodeKind,
      type: descriptor.type,
      label: descriptor.label,
      prompt: descriptor.prompt,
      x: descriptor.x,
      y: descriptor.y,
      imageUrl: descriptor.imageUrl ?? null,
      statusText: descriptor.statusText ?? null,
      generation: descriptor.generation ?? null,
    }),
    []
  );

  const buildBoardClipboardDescriptor = useCallback(
    (boardId: string): ClipboardBoardDescriptor | null => {
      const localBoard = localBoards.find((item) => item.id === boardId);
      if (localBoard) {
        const children = localBoard.itemIds
          .map((itemId) => localNodes.find((node) => node.id === itemId))
          .filter((node): node is CanvasLocalNode => Boolean(node))
          .map((node) => ({
            kind: 'node' as const,
            nodeKind: node.kind,
            type: node.type,
            label: node.label,
            prompt: node.prompt,
            x: node.x,
            y: node.y,
            imageUrl: node.imageUrl ?? null,
            statusText: node.statusText ?? null,
            generation: node.generation ?? null,
          }));
        return {
          kind: 'board',
          name: localBoard.name,
          prompt: localBoard.prompt,
          x: localBoard.frame.x,
          y: localBoard.frame.y,
          width: localBoard.frame.width,
          height: localBoard.frame.height,
          children,
        };
      }

      const look = looksWithOverrides.find((item) => item.id === boardId);
      if (!look) return null;
      const children = look.items
        .filter((item) => !hiddenLookItemIds.includes(item.id))
        .map((item, itemIndex) => {
          const position = computeNodePositionInFrame(look.frame, itemIndex, look.items.length);
          return {
            kind: 'node' as const,
            nodeKind: 'asset-image' as const,
            type: 'image' as const,
            label: item.category,
            prompt: item.placeholder_desc ?? '',
            x: position.x,
            y: position.y,
            imageUrl: item.asset_url ?? null,
            statusText: null,
            generation: null,
          };
        });
      return {
        kind: 'board',
        name: look.name,
        prompt: look.description ?? '',
        x: look.frame.x,
        y: look.frame.y,
        width: look.frame.width,
        height: look.frame.height,
        children,
      };
    },
    [hiddenLookItemIds, localBoards, localNodes, looksWithOverrides]
  );

  const { canvas, viewport, resize, setZoom, pan } = useFabricCanvas(canvasRef, {
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '',
    onSelectionChange: (info) => {
      const filtered = info.items.filter((item) => item.kind !== 'unknown');
      if (filtered.length === 0) {
        setToolbarSelection(null);
        setPromptSelection(null);
        setSelectedImageDataUrl(null);
        setSelectedImageUrl(null);
        return;
      }

      const primary = filtered[0];
      const normalizedKind =
        filtered.length > 1 &&
        filtered.every((item) => item.kind === 'asset-image' || item.kind === 'look-item-node')
          ? 'asset-image'
          : (primary.kind as ToolbarSelection['kind']);
      setToolbarSelection({
        anchor: info.anchor,
        bottomAnchor: info.bottomAnchor,
        kind: normalizedKind,
        ids: filtered.map((item) => item.entityId ?? '').filter(Boolean),
        data: primary.data,
      });

      if (filtered.length !== 1) {
        setPromptSelection(null);
        return;
      }

      const entityId = primary.entityId ?? '';
      const data = primary.data ?? {};
      const selectionImageUrl = typeof data.imageUrl === 'string' ? data.imageUrl : null;
      const nodeType = (data.nodeType as CanvasNodeType | undefined) ?? 'image';
      const nodeLabel = (data.label as string | undefined) ?? 'Node';
      const prompt = (data.prompt as string | undefined) ?? '';

      setSelectedImageDataUrl(selectionImageUrl?.startsWith('data:') ? selectionImageUrl : null);
      setSelectedImageUrl(selectionImageUrl);

      if (primary.kind === 'look-board') {
        const localBoard = localBoards.find((item) => item.id === entityId);
        if (localBoard) {
          setPromptSelection({
            id: localBoard.id,
            kind: 'Board',
            label: localBoard.name,
            prompt: localBoard.prompt,
            helper: '输入文本会与当前 Board 一起发送给模型。',
          });
          return;
        }
        const look = looksWithOverrides.find((item) => item.id === entityId);
        if (!look) return;
        setPromptSelection({
          id: look.id,
          kind: 'Board',
          label: look.name,
          prompt: look.description ?? '',
          helper: '输入文本会与当前 Look 一起发送给模型。',
        });
        return;
      }

      if (primary.kind === 'shot-node') {
        const shot = shotsWithOverrides.find((item) => item.id === entityId);
        if (!shot) return;
        setPromptSelection({
          id: shot.id,
          kind: shot.type === 'video' ? 'Video' : 'Image',
          label: shot.adopted ? '已采纳结果' : '生成结果',
          prompt: prompt,
          helper: '输入文本会与当前结果节点一起发送给模型。',
          mode: shot.type,
        });
        return;
      }

      if (primary.kind === 'look-item-node' || primary.kind === 'asset-image' || primary.kind === 'prompt-node') {
        setPromptSelection({
          id: entityId,
          kind: nodeType === 'text' ? 'Text' : nodeType === 'video' ? 'Video' : 'Image',
          label: nodeLabel,
          prompt,
          helper:
            primary.kind === 'look-item-node'
              ? '输入文本会与当前对象一起发送给模型。'
              : primary.kind === 'asset-image'
                ? '拖入画布的图像会作为输入节点发送给模型。'
                : '选中对象后，底部会出现 prompt 对话框。',
          mode: nodeType === 'text' ? undefined : nodeType,
        });
        return;
      }

      setPromptSelection(null);
    },
    onImageSelect: (info) => {
      setSelectedImageDataUrl(info.dataUrl || null);
      setSelectedImageUrl(info.imageUrl ?? null);
    },
    onSelectionClear: () => {
      setToolbarSelection(null);
      setPromptSelection(null);
      setSelectedImageDataUrl(null);
      setSelectedImageUrl(null);
    },
    onCanvasDoubleClick: (info) => {
      setCreateMenu(info);
    },
  });

  useEffect(() => {
    const snapshot = initialCanvasState;
    if (!snapshot) return;
    setLookPromptOverrides(snapshot.lookPromptOverrides ?? {});
    setLookFrameOverrides(snapshot.lookFrameOverrides ?? {});
    setShotPositionOverrides(snapshot.shotPositionOverrides ?? {});
    setHiddenLookIds(snapshot.hiddenLookIds ?? []);
    setHiddenLookItemIds(snapshot.hiddenLookItemIds ?? []);
    setHiddenShotIds(snapshot.hiddenShotIds ?? []);
    setLocalNodes(snapshot.localNodes ?? []);
    setLocalBoards(snapshot.localBoards ?? []);
    hydratedProjectRef.current = projectId;
  }, [initialCanvasState, projectId]);

  useEffect(() => {
    if (hydratedProjectRef.current !== projectId) return;
    onCanvasStateChange({
      version: 1,
      lookPromptOverrides,
      lookFrameOverrides,
      shotPositionOverrides,
      hiddenLookIds,
      hiddenLookItemIds,
      hiddenShotIds,
      localNodes,
      localBoards,
    });
  }, [
    hiddenLookIds,
    hiddenLookItemIds,
    hiddenShotIds,
    localBoards,
    localNodes,
    lookFrameOverrides,
    lookPromptOverrides,
    onCanvasStateChange,
    shotPositionOverrides,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = 24;
    const size = base * viewport.zoom;
    const x = ((-viewport.x % size) + size) % size;
    const y = ((-viewport.y % size) + size) % size;
    container.style.backgroundSize = `${size}px ${size}px`;
    container.style.backgroundPosition = `${x}px ${y}px`;
  }, [viewport]);

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

  const buildSelectionClipboard = useCallback((): ClipboardDescriptor[] => {
    if (!canvas) return [];
    const activeObjects = canvas.getActiveObjects();
    const descriptors: ClipboardDescriptor[] = [];
    const consumedIds = new Set<string>();

    activeObjects.forEach((object) => {
      const data = (object.get('data') as Record<string, unknown> | undefined) ?? {};
      const entityId = data.entityId as string | undefined;
      const kind = data.kind as string | undefined;
      if (!entityId || !kind || consumedIds.has(entityId)) return;

      if (kind === 'look-board') {
        const boardDescriptor = buildBoardClipboardDescriptor(entityId);
        if (boardDescriptor) {
          descriptors.push(boardDescriptor);
          boardDescriptor.children.forEach((child) => consumedIds.add(`${child.label}-${child.x}-${child.y}`));
        }
        return;
      }

      const bounds = object.getBoundingRect();
      const nodeType =
        (data.nodeType as CanvasNodeType | undefined) ??
        (kind === 'shot-node' ? (((data.label as string | undefined) ?? '').toLowerCase() === 'video' ? 'video' : 'image') : 'image');
      descriptors.push({
        kind: 'node',
        nodeKind: kind === 'prompt-node' ? 'prompt-node' : 'asset-image',
        type: nodeType,
        label: (data.label as string | undefined) ?? 'Image',
        prompt: (data.prompt as string | undefined) ?? '',
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        imageUrl: (data.imageUrl as string | undefined) ?? null,
        statusText: (data.statusText as string | undefined) ?? null,
      });
    });

    return descriptors;
  }, [buildBoardClipboardDescriptor, canvas]);

  const pasteClipboard = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const offset = 36;
    const nextNodes: CanvasLocalNode[] = [];
    const nextBoards: CanvasLocalBoard[] = [];

    clipboardRef.current.forEach((descriptor, descriptorIndex) => {
      if (descriptor.kind === 'node') {
        nextNodes.push(
          buildLocalNodeFromDescriptor(
            {
              ...descriptor,
              x: descriptor.x + offset,
              y: descriptor.y + offset,
            },
            descriptorIndex
          )
        );
        return;
      }

      const childIds: string[] = [];
      descriptor.children.forEach((child, childIndex) => {
        const nextNode = buildLocalNodeFromDescriptor(
          {
            ...child,
            x: child.x + offset,
            y: child.y + offset,
          },
          descriptorIndex * 100 + childIndex
        );
        childIds.push(nextNode.id);
        nextNodes.push(nextNode);
      });

      nextBoards.push({
        id: `local-board-${Date.now()}-${descriptorIndex}`,
        name: descriptor.name,
        prompt: descriptor.prompt,
        itemIds: childIds,
        frame: {
          x: descriptor.x + offset,
          y: descriptor.y + offset,
          width: descriptor.width,
          height: descriptor.height,
        },
      });
    });

    if (nextNodes.length > 0) {
      setLocalNodes((prev) => [...prev, ...nextNodes]);
    }
    if (nextBoards.length > 0) {
      setLocalBoards((prev) => [...prev, ...nextBoards]);
    }
  }, [buildLocalNodeFromDescriptor]);

  const deleteSelection = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;

    const nextHiddenLookIds = new Set<string>();
    const nextHiddenLookItemIds = new Set<string>();
    const nextHiddenShotIds = new Set<string>();
    const nextLocalNodeIds = new Set<string>();
    const nextLocalBoardIds = new Set<string>();

    activeObjects.forEach((object) => {
      const data = (object.get('data') as Record<string, unknown> | undefined) ?? {};
      const entityId = data.entityId as string | undefined;
      const kind = data.kind as string | undefined;
      if (!entityId || !kind) return;

      if (kind === 'look-board') {
        if (localBoards.some((item) => item.id === entityId)) {
          nextLocalBoardIds.add(entityId);
        } else {
          nextHiddenLookIds.add(entityId);
        }
        return;
      }

      if (kind === 'look-item-node') {
        nextHiddenLookItemIds.add(entityId);
        return;
      }

      if (kind === 'shot-node') {
        nextHiddenShotIds.add(entityId);
        return;
      }

      if (kind === 'prompt-node' || kind === 'asset-image') {
        nextLocalNodeIds.add(entityId);
      }
    });

    if (nextHiddenLookIds.size > 0) {
      setHiddenLookIds((prev) => [...prev, ...Array.from(nextHiddenLookIds)]);
    }
    if (nextHiddenLookItemIds.size > 0) {
      setHiddenLookItemIds((prev) => [...prev, ...Array.from(nextHiddenLookItemIds)]);
    }
    if (nextHiddenShotIds.size > 0) {
      setHiddenShotIds((prev) => [...prev, ...Array.from(nextHiddenShotIds)]);
    }
    if (nextLocalNodeIds.size > 0) {
      setLocalNodes((prev) => prev.filter((node) => !nextLocalNodeIds.has(node.id)));
    }
    if (nextLocalBoardIds.size > 0) {
      setLocalBoards((prev) => prev.filter((board) => !nextLocalBoardIds.has(board.id)));
    }

    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [canvas, localBoards]);

  const selectAllObjects = useCallback(() => {
    if (!canvas) return;
    const selectableObjects = canvas.getObjects().filter((object) => object.selectable && object.visible !== false);
    if (selectableObjects.length === 0) return;
    const selection = new ActiveSelection(selectableObjects, { canvas });
    canvas.setActiveObject(selection);
    canvas.requestRenderAll();
  }, [canvas]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setIsSpacePressed(true);
      }
      if ((event.code === 'Delete' || event.code === 'Backspace') && canvas) {
        const active = canvas.getActiveObject();
        if (active && !(active as { isEditing?: boolean }).isEditing) {
          event.preventDefault();
          deleteSelection();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        if (canvas?.getActiveObjects().length) {
          event.preventDefault();
          clipboardRef.current = buildSelectionClipboard();
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteClipboard();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllObjects();
      }
      if (event.code === 'Escape') {
        setPanning(false);
        if (canvas) {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [buildSelectionClipboard, canvas, deleteSelection, pasteClipboard, selectAllObjects, setPanning]);

  useEffect(() => {
    if (!canvas) return;
    const disable = isSpacePressed || isPanning;
    canvas.selection = !disable;
    canvas.getObjects().forEach((object) => {
      const data = object.get('data') as { kind?: string } | undefined;
      object.selectable = !disable && data?.kind !== 'look-item-node';
      object.evented = !disable;
      if (data?.kind === 'look-item-node') {
        object.selectable = !disable;
        object.lockMovementX = true;
        object.lockMovementY = true;
      }
    });
    canvas.requestRenderAll();
  }, [canvas, isPanning, isSpacePressed]);

  useEffect(() => {
    if (!canvas) return;
    let disposed = false;

    const draw = async () => {
      // Capture currently selected entity IDs so we can restore selection after redraw
      const previousActiveIds: string[] = [];
      const activeObjects = canvas.getActiveObjects();
      activeObjects.forEach((obj) => {
        const data = (obj.get('data') as Record<string, unknown> | undefined) ?? {};
        const entityId = data.entityId as string | undefined;
        if (entityId) previousActiveIds.push(entityId);
      });

      const businessObjects = canvas
        .getObjects()
        .filter((object) => {
          const data = object.get('data') as { kind?: string } | undefined;
          return ['look-board', 'look-item-node', 'shot-node', 'prompt-node', 'asset-image', 'local-board'].includes(data?.kind ?? '');
        });
      businessObjects.forEach((object) => canvas.remove(object));

      for (const look of looksWithOverrides) {
        const childNodes: Array<{ left?: number; top?: number; set: (options: Record<string, unknown>) => void; setCoords: () => void; lockMovementX?: boolean; lockMovementY?: boolean; }> = [];
        const frame = createLookFrameGroup(look, look.frame.x, look.frame.y, look.frame.width, look.frame.height);
        let previousLeft = look.frame.x;
        let previousTop = look.frame.y;
        if (!disposed) {
          canvas.add(frame);
        }

        for (const [itemIndex, item] of look.items.entries()) {
          if (hiddenLookItemIds.includes(item.id)) continue;
          const position = computeNodePositionInFrame(look.frame, itemIndex, look.items.length);
          const node = await createCanvasNodeGroup(
            {
              kind: 'look-item-node',
              entityId: item.id,
              type: 'image',
              title: item.category,
              prompt: item.placeholder_desc ?? '',
              imageUrl: item.asset_url ?? null,
            },
            position.x,
            position.y
          );
          node.lockMovementX = true;
          node.lockMovementY = true;
          childNodes.push(node);
          if (!disposed) canvas.add(node);
        }

        frame.on('moving', () => {
          const nextLeft = frame.left ?? previousLeft;
          const nextTop = frame.top ?? previousTop;
          const dx = nextLeft - previousLeft;
          const dy = nextTop - previousTop;
          previousLeft = nextLeft;
          previousTop = nextTop;
          childNodes.forEach((node) => {
            node.set({
              left: (node.left ?? 0) + dx,
              top: (node.top ?? 0) + dy,
            });
            node.setCoords();
          });
          canvas.requestRenderAll();
        });
        frame.on('modified', () => {
          const nextFrame = {
            x: frame.left ?? look.frame.x,
            y: frame.top ?? look.frame.y,
            width: look.frame.width,
            height: look.frame.height,
          };
          setLookFrameOverrides((prev) => ({
            ...prev,
            [look.id]: nextFrame,
          }));
          onSaveLookBoardPosition(look.id, nextFrame);
        });
      }

      const shotIndexByLook = new Map<string, number>();
      for (const shot of shotsWithOverrides) {
        const look = looksWithOverrides.find((item) => item.id === shot.look_id);
        const frame = look?.frame;
        if (!frame) continue;
        const index = shotIndexByLook.get(shot.look_id) ?? 0;
        shotIndexByLook.set(shot.look_id, index + 1);
        const position = shot.position ?? defaultShotPosition(frame, index);
        const previewUrl =
          shot.type === 'image'
            ? shot.thumbnail_url ?? shot.url ?? pendingShotPreviewUrl(shot, look)
            : null;
        const node = await createCanvasNodeGroup(
          {
            kind: 'shot-node',
            entityId: shot.id,
            type: shot.type,
            title: shot.type === 'video' ? 'Video' : 'Image',
            prompt: shot.prompt ?? '',
            imageUrl: previewUrl,
            statusText: shotStatusText(shot),
            loading: shot.status === 'queued' || shot.status === 'processing',
          },
          position.x,
          position.y
        );
        node.on('modified', () => {
          const nextPosition = {
            x: node.left ?? position.x,
            y: node.top ?? position.y,
          };
          setShotPositionOverrides((prev) => ({
            ...prev,
            [shot.id]: nextPosition,
          }));
          onSaveShotCanvasPosition(shot.id, nextPosition);
        });
        if (!disposed) canvas.add(node);
      }

      for (const localNode of localNodes) {
        const node = await createCanvasNodeGroup(
          {
            kind: localNode.kind,
            entityId: localNode.id,
            type: localNode.type,
            title: localNode.label,
            prompt: localNode.prompt,
            imageUrl: localNode.imageUrl ?? null,
            statusText: localNode.statusText ?? null,
          },
          localNode.x,
          localNode.y
        );
        node.on('modified', () => {
          setLocalNodes((prev) =>
            prev.map((item) =>
              item.id === localNode.id
                ? { ...item, x: node.left ?? localNode.x, y: node.top ?? localNode.y }
                : item
            )
          );
        });
        if (!disposed) canvas.add(node);
      }

      for (const board of localBoards) {
        const frame = createLookFrameGroup(
          {
            id: board.id,
            project_id: '',
            name: board.name,
            description: board.prompt,
            style_tags: [],
            board_position: board.frame,
            items: [],
            created_at: '',
          },
          board.frame.x,
          board.frame.y,
          board.frame.width,
          board.frame.height
        );
        frame.set('data', {
          kind: 'look-board',
          entityId: board.id,
          label: board.name,
          prompt: board.prompt,
          source: 'local-board',
        });
        let previousLeft = board.frame.x;
        let previousTop = board.frame.y;
        frame.on('moving', () => {
          const nextLeft = frame.left ?? previousLeft;
          const nextTop = frame.top ?? previousTop;
          const dx = nextLeft - previousLeft;
          const dy = nextTop - previousTop;
          previousLeft = nextLeft;
          previousTop = nextTop;
          board.itemIds.forEach((itemId) => {
            const node = canvas
              .getObjects()
              .find((object) => ((object.get('data') as Record<string, unknown> | undefined)?.entityId as string | undefined) === itemId);
            if (!node) return;
            node.set({
              left: (node.left ?? 0) + dx,
              top: (node.top ?? 0) + dy,
            });
            node.setCoords();
          });
          canvas.requestRenderAll();
        });
        frame.on('modified', () => {
          // Sync children positions to React state
          const newPositions: Record<string, { x: number; y: number }> = {};
          board.itemIds.forEach((itemId) => {
            const node = canvas
              .getObjects()
              .find((object) => ((object.get('data') as Record<string, unknown> | undefined)?.entityId as string | undefined) === itemId);
            if (node) {
              newPositions[itemId] = { x: node.left ?? 0, y: node.top ?? 0 };
            }
          });

          setLocalNodes((prev) =>
            prev.map((item) =>
              newPositions[item.id]
                ? { ...item, x: newPositions[item.id].x, y: newPositions[item.id].y }
                : item
            )
          );

          setLocalBoards((prev) =>
            prev.map((item) =>
              item.id === board.id
                ? {
                    ...item,
                    frame: {
                      ...item.frame,
                      x: frame.left ?? item.frame.x,
                      y: frame.top ?? item.frame.y,
                    },
                  }
                : item
            )
          );
        });
        if (!disposed) canvas.add(frame);
      }

      if (!disposed) {
        // Restore selection if objects were previously selected
        if (previousActiveIds.length > 0) {
          const objectsToSelect = canvas.getObjects().filter((obj) => {
            const data = (obj.get('data') as Record<string, unknown> | undefined) ?? {};
            return previousActiveIds.includes(data.entityId as string);
          });
          if (objectsToSelect.length === 1) {
            canvas.setActiveObject(objectsToSelect[0]);
          } else if (objectsToSelect.length > 1) {
            const selection = new ActiveSelection(objectsToSelect, { canvas });
            canvas.setActiveObject(selection);
          }
        }
        canvas.requestRenderAll();
      }
    };

    void draw();
    return () => {
      disposed = true;
    };
  }, [
    canvas,
    hiddenLookItemIds,
    localBoards,
    localNodes,
    looksWithOverrides,
    onSaveLookBoardPosition,
    onSaveShotCanvasPosition,
    shotsWithOverrides,
  ]);

  const isActuallyPanning = isSpacePressed || isPanning;

  const handleImageGenerated = useCallback(
    ({ content, generation }: GeneratedMediaPayload) => {
      const imageUrl = `data:image/png;base64,${content}`;
      const selectedId = toolbarSelection?.ids[0];
      const selectedType = toolbarSelection?.data?.nodeType as CanvasNodeType | undefined;
      if (toolbarSelection?.kind === 'prompt-node' && selectedId && selectedType === 'image') {
        setLocalNodes((prev) =>
          prev.map((node) =>
            node.id === selectedId
              ? {
                  ...node,
                  imageUrl,
                  prompt: promptSelection?.prompt ?? node.prompt,
                  generation,
                }
              : node
          )
        );
        return;
      }
      setLocalNodes((prev) => [
        ...prev,
        {
          id: `prompt-node-${Date.now()}`,
          kind: 'prompt-node',
          type: 'image',
          label: 'Image',
          prompt: promptSelection?.prompt ?? defaultPrompt('image'),
          x: (window.innerWidth / 2 + viewport.x) / viewport.zoom,
          y: (window.innerHeight / 2 + viewport.y) / viewport.zoom,
          imageUrl,
          generation,
        },
      ]);
    },
    [promptSelection?.prompt, toolbarSelection, viewport]
  );

  const handleVideoGenerated = useCallback(
    ({ generation }: GeneratedMediaPayload) => {
      const selectedId = toolbarSelection?.ids[0];
      const selectedType = toolbarSelection?.data?.nodeType as CanvasNodeType | undefined;
      if (toolbarSelection?.kind === 'prompt-node' && selectedId && selectedType === 'video') {
        setLocalNodes((prev) =>
          prev.map((node) =>
            node.id === selectedId ? { ...node, statusText: '视频已生成', generation } : node
          )
        );
        return;
      }
      setLocalNodes((prev) => [
        ...prev,
        {
          id: `prompt-node-${Date.now()}`,
          kind: 'prompt-node',
          type: 'video',
          label: 'Video',
          prompt: promptSelection?.prompt ?? defaultPrompt('video'),
          x: (window.innerWidth / 2 + viewport.x) / viewport.zoom,
          y: (window.innerHeight / 2 + viewport.y) / viewport.zoom,
          statusText: '视频已生成',
          generation,
        },
      ]);
    },
    [promptSelection?.prompt, toolbarSelection, viewport]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (createMenu) {
        setCreateMenu(null);
      }
      const target = canvas?.findTarget?.(event.nativeEvent);
      const shouldPan =
        event.button === 1 ||
        isActuallyPanning ||
        (!target && event.button === 0);
      if (shouldPan) {
        event.preventDefault();
        setIsDragging(true);
        setLastMousePos({ x: event.clientX, y: event.clientY });
      }
    },
    [canvas, createMenu, isActuallyPanning]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        pan(event.clientX - lastMousePos.x, event.clientY - lastMousePos.y);
        setLastMousePos({ x: event.clientX, y: event.clientY });
      }
      event.currentTarget.style.cursor =
        isDragging || isActuallyPanning ? (isDragging ? 'grabbing' : 'grab') : 'default';
    },
    [isDragging, isActuallyPanning, lastMousePos, pan]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.ctrlKey) {
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        const nextZoom = Math.max(LIMITS.minZoom, Math.min(LIMITS.maxZoom, viewport.zoom + delta));
        setZoom(nextZoom, { x: event.clientX, y: event.clientY });
        return;
      }

      pan(-event.deltaX, -event.deltaY);
    },
    [pan, setZoom, viewport.zoom]
  );

  const addLocalNode = useCallback((node: CanvasLocalNode) => {
    setLocalNodes((prev) => [...prev, node]);
  }, []);

  const addPromptNodeAt = useCallback(
    (nodeType: CanvasNodeType, x: number, y: number) => {
      addLocalNode({
        id: `prompt-node-${Date.now()}`,
        kind: 'prompt-node',
        type: nodeType,
        label: nodeType === 'text' ? 'Text' : nodeType === 'video' ? 'Video' : 'Image',
        prompt: defaultPrompt(nodeType),
        x,
        y,
        generation: null,
      });
    },
    [addLocalNode]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const containerBounds = event.currentTarget.getBoundingClientRect();
      const screenX = event.clientX - containerBounds.left;
      const screenY = event.clientY - containerBounds.top;
      const dropX = (event.clientX + viewport.x) / viewport.zoom;
      const dropY = (event.clientY + viewport.y) / viewport.zoom;

      if (event.dataTransfer.files.length > 0) {
        const imageFiles = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          void onUploadFiles(imageFiles);
          const previews = await Promise.all(
            imageFiles.map(async (file, index) => ({
              id: `asset-node-${Date.now()}-${index}`,
              imageUrl: await readImageFile(file),
              label: file.name,
            }))
          );
          previews.forEach((preview, index) => {
            addLocalNode({
              id: preview.id,
              kind: 'asset-image',
              type: 'image',
              label: 'Image',
              prompt: '',
              x: dropX + index * 28,
              y: dropY + index * 28,
              imageUrl: preview.imageUrl,
              generation: null,
            });
          });
        }
        return;
      }

      const payload = event.dataTransfer.getData('application/json');
      if (!payload) return;

      try {
        const asset = JSON.parse(payload) as { id: string; url: string; label: string };
        const targetObject = canvas
          ?.getObjects()
          .find((object) => {
            const data = object.get('data') as Record<string, unknown> | undefined;
            if (data?.kind !== 'look-item-node') return false;
            const bounds = object.getBoundingRect();
            return (
              screenX >= bounds.left &&
              screenX <= bounds.left + bounds.width &&
              screenY >= bounds.top &&
              screenY <= bounds.top + bounds.height
            );
          });
        const targetItemId = (targetObject?.get('data') as Record<string, unknown> | undefined)?.entityId as
          | string
          | undefined;

        if (targetItemId) {
          const targetLook = looks.find((look) => look.items.some((item) => item.id === targetItemId));
          if (targetLook) {
            onReplaceLookItemAsset(targetLook.id, targetItemId, asset.id);
            return;
          }
        }

        addLocalNode({
          id: `${asset.id}-${Date.now()}`,
          kind: 'asset-image',
          type: 'image',
          label: 'Image',
          prompt: '',
          x: dropX,
          y: dropY,
          imageUrl: asset.url,
          generation: null,
        });
      } catch {
        // Ignore malformed payloads.
      }
    },
    [addLocalNode, canvas, looks, onReplaceLookItemAsset, onUploadFiles, viewport]
  );

  const handleSelectionPromptChange = useCallback(
    (nextPrompt: string) => {
      if (!toolbarSelection || toolbarSelection.ids.length !== 1) return;
      const selectedId = toolbarSelection.ids[0];

      if (toolbarSelection.kind === 'look-board') {
        const localBoard = localBoards.find((item) => item.id === selectedId);
        if (localBoard) {
          setLocalBoards((prev) =>
            prev.map((item) => (item.id === selectedId ? { ...item, prompt: nextPrompt } : item))
          );
        } else {
          setLookPromptOverrides((prev) => ({ ...prev, [selectedId]: nextPrompt }));
        }
      }

      if (toolbarSelection.kind === 'prompt-node' || toolbarSelection.kind === 'asset-image') {
        setLocalNodes((prev) =>
          prev.map((node) => (node.id === selectedId ? { ...node, prompt: nextPrompt } : node))
        );
      }

      if (canvas) {
        const activeObject = canvas.getActiveObject() as any;
        if (activeObject) {
          const data = (activeObject.get('data') as Record<string, unknown> | undefined) ?? {};
          activeObject.set('data', { ...data, prompt: nextPrompt });
          if (toolbarSelection.kind === 'prompt-node' || toolbarSelection.kind === 'asset-image') {
            updateCanvasNodeGroup(activeObject, nextPrompt);
          }
          canvas.requestRenderAll();
        }
      }

      setPromptSelection((prev) => (prev && prev.id === selectedId ? { ...prev, prompt: nextPrompt } : prev));
    },
    [canvas, localBoards, toolbarSelection]
  );

  const handleGroupSelection = useCallback(() => {
    if (!canvas || !toolbarSelection || toolbarSelection.ids.length < 2) return;

    const selectedObjects = canvas.getActiveObjects();
    if (selectedObjects.length < 2) return;

    const bounds = selectedObjects.reduce(
      (acc, object) => {
        const rect = object.getBoundingRect();
        return {
          left: Math.min(acc.left, rect.left),
          top: Math.min(acc.top, rect.top),
          right: Math.max(acc.right, rect.left + rect.width),
          bottom: Math.max(acc.bottom, rect.top + rect.height),
        };
      },
      { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 }
    );

    const boardId = `local-board-${Date.now()}`;
    setLocalBoards((prev) => [
      ...prev,
      {
        id: boardId,
        name: `Board ${prev.length + 1}`,
        prompt: '',
        itemIds: toolbarSelection.ids,
        frame: {
          x: bounds.left - 24,
          y: bounds.top - 44,
          width: bounds.right - bounds.left + 48,
          height: bounds.bottom - bounds.top + 68,
        },
      },
    ]);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [canvas, toolbarSelection]);

  const handleClearSelection = useCallback(() => {
    if (canvas) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
    setToolbarSelection(null);
    setPromptSelection(null);
    setSelectedImageDataUrl(null);
    setSelectedImageUrl(null);
  }, [canvas]);

  const handleCreateNode = useCallback(
    (nodeType: CanvasNodeType) => {
      if (!createMenu) return;
      addPromptNodeAt(nodeType, createMenu.canvasX, createMenu.canvasY);
      setCreateMenu(null);
    },
    [addPromptNodeAt, createMenu]
  );

  const selectedShot =
    toolbarSelection?.kind === 'shot-node'
      ? shotsWithOverrides.find((shot) => shot.id === toolbarSelection.ids[0])
      : undefined;

  return (
    <div
      ref={containerRef}
      className="infinite-canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onWheel={handleWheel}
      onDragOver={(event) => {
        event.preventDefault();
        if (!canvas) return;
        const containerBounds = event.currentTarget.getBoundingClientRect();
        const screenX = event.clientX - containerBounds.left;
        const screenY = event.clientY - containerBounds.top;
        const target = canvas.getObjects().find((object) => {
          const data = object.get('data') as Record<string, unknown> | undefined;
          if (data?.kind !== 'look-item-node') return false;
          const bounds = object.getBoundingRect();
          return screenX >= bounds.left && screenX <= bounds.left + bounds.width && screenY >= bounds.top && screenY <= bounds.top + bounds.height;
        });
        const prev = dragHighlightRef.current;
        if (prev && prev.object !== target) {
          prev.object.set({ stroke: prev.originalStroke, strokeWidth: prev.originalStrokeWidth });
          dragHighlightRef.current = null;
          canvas.requestRenderAll();
        }
        if (target && !prev) {
          dragHighlightRef.current = { object: target, originalStroke: target.get('stroke'), originalStrokeWidth: target.get('strokeWidth') };
          target.set({ stroke: 'rgba(126, 156, 255, 0.9)', strokeWidth: 3 });
          canvas.requestRenderAll();
        }
      }}
      onDragLeave={() => {
        if (dragHighlightRef.current && canvas) {
          const prev = dragHighlightRef.current;
          prev.object.set({ stroke: prev.originalStroke, strokeWidth: prev.originalStrokeWidth });
          dragHighlightRef.current = null;
          canvas.requestRenderAll();
        }
      }}
      onDrop={(event) => {
        if (dragHighlightRef.current && canvas) {
          const prev = dragHighlightRef.current;
          prev.object.set({ stroke: prev.originalStroke, strokeWidth: prev.originalStrokeWidth });
          dragHighlightRef.current = null;
          canvas.requestRenderAll();
        }
        void handleDrop(event);
      }}
    >
      <canvas ref={canvasRef} />

      {toolbarSelection ? (
        <FloatingToolbar
          anchor={toolbarSelection.anchor}
          selectionKind={toolbarSelection.kind}
          count={toolbarSelection.ids.length}
          adopted={selectedShot?.adopted}
          onGroupSelection={handleGroupSelection}
          onGenerateLooks={() => {
            const assetIds = toolbarSelection.ids.filter((id) => !id.startsWith('asset-node-'));
            if (assetIds.length === 0) return;
            void onGenerateLooks(assetIds);
          }}
          onGenerateShot={(action) => {
            const lookId = toolbarSelection.ids[0];
            if (!lookId) return;
            const prompt = lookPromptOverrides[lookId] ?? looks.find((look) => look.id === lookId)?.description ?? '';
            void onGenerateShot(lookId, action, action === 'custom' ? prompt : undefined);
          }}
          onGenerateVideo={() => {
            const lookId = toolbarSelection.ids[0];
            if (lookId) onGenerateVideo?.(lookId);
          }}
          onToggleAdopt={() => {
            if (!selectedShot) return;
            onToggleAdopt(selectedShot.id, !selectedShot.adopted);
          }}
          onQuickAction={(action) => {
            const imageUrl = toolbarSelection?.data?.imageUrl as string | null ?? null;
            const selectedId = toolbarSelection?.ids[0] ?? null;
            const selectedObject = canvas?.getActiveObject();
            const targetPosition =
              selectedObject && typeof selectedObject.left === 'number' && typeof selectedObject.top === 'number'
                ? {
                    x: selectedObject.left + selectedObject.getScaledWidth() + 56,
                    y: selectedObject.top,
                  }
                : null;
            const parentLookId =
              toolbarSelection?.kind === 'look-item-node' && selectedId
                ? looks.find((look) => look.items.some((item) => item.id === selectedId))?.id ?? null
                : null;
            onQuickAction?.(action, imageUrl, targetPosition, parentLookId);
          }}
        />
      ) : null}

      {createMenu ? (
        <div
          className="node-create-menu"
          style={{ left: createMenu.screenX, top: createMenu.screenY }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <span className="node-create-menu-title">Add Nodes</span>
          <button type="button" className="node-create-item is-active" onClick={() => handleCreateNode('text')}>
            <span className="node-create-icon">T</span>
            <span>
              <strong>Text</strong>
              <em>单一文本内容</em>
            </span>
          </button>
          <button type="button" className="node-create-item" onClick={() => handleCreateNode('image')}>
            <span className="node-create-icon">I</span>
            <span>
              <strong>Image</strong>
              <em>空状态支持 prompt 生图</em>
            </span>
          </button>
          <button type="button" className="node-create-item" onClick={() => handleCreateNode('video')}>
            <span className="node-create-icon">V</span>
            <span>
              <strong>Video</strong>
              <em>空状态支持 prompt 生视频</em>
            </span>
          </button>
        </div>
      ) : null}

      <BottomPromptBar
        visible={Boolean(promptSelection)}
        onImageGenerated={handleImageGenerated}
        onVideoGenerated={handleVideoGenerated}
        selectedImageDataUrl={selectedImageDataUrl}
        selectedImageUrl={selectedImageUrl}
        selection={promptSelection}
        onSelectionPromptChange={handleSelectionPromptChange}
        onClearSelection={handleClearSelection}
        anchorX={toolbarSelection?.bottomAnchor.x}
        anchorY={toolbarSelection?.bottomAnchor.y}
      />

      <div className="canvas-sidebar">
        <button
          onClick={() => {
            const x = (window.innerWidth / 2 + viewport.x) / viewport.zoom;
            const y = (window.innerHeight / 2 + viewport.y) / viewport.zoom;
            addPromptNodeAt('text', x, y);
          }}
          className="sidebar-button"
          data-tip="文字"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" />
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
        {busy ? <span className="canvas-busy-indicator">SYNC</span> : null}
      </div>
    </div>
  );
}
