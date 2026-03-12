import * as fabric from 'fabric';
import { Group, Rect, Shadow, Textbox, Image as FabricImage } from 'fabric';
import type { FabricObject } from 'fabric';

export type CanvasNodeType = 'text' | 'image' | 'video';

export interface CanvasNodeConfig {
  kind: string;
  entityId: string;
  type: CanvasNodeType;
  title?: string;
  prompt?: string;
  imageUrl?: string | null;
  statusText?: string | null;
  loading?: boolean;
}

const NODE_SIZES: Record<CanvasNodeType, { width: number; height: number }> = {
  text: { width: 312, height: 312 },
  image: { width: 252, height: 336 },
  video: { width: 264, height: 336 },
};

const IMAGE_CORNER_RADIUS = 24;
const IMAGE_TITLE_OFFSET = 34;
const BlurFilterCtor = (
  fabric as unknown as {
    filters?: {
      Blur?: new (options: { blur: number }) => unknown;
    };
  }
).filters?.Blur;

function getImageSourceSize(image: FabricImage, fallback: { width: number; height: number }) {
  const element = image.getElement() as
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | undefined;

  const naturalWidth =
    ('naturalWidth' in (element ?? {}) ? Number((element as HTMLImageElement).naturalWidth) : 0) ||
    ('videoWidth' in (element ?? {}) ? Number((element as HTMLVideoElement).videoWidth) : 0) ||
    ('width' in (element ?? {}) ? Number((element as HTMLImageElement | HTMLCanvasElement).width) : 0) ||
    image.width ||
    fallback.width;

  const naturalHeight =
    ('naturalHeight' in (element ?? {}) ? Number((element as HTMLImageElement).naturalHeight) : 0) ||
    ('videoHeight' in (element ?? {}) ? Number((element as HTMLVideoElement).videoHeight) : 0) ||
    ('height' in (element ?? {}) ? Number((element as HTMLImageElement | HTMLCanvasElement).height) : 0) ||
    image.height ||
    fallback.height;

  return {
    width: naturalWidth > 0 ? naturalWidth : fallback.width,
    height: naturalHeight > 0 ? naturalHeight : fallback.height,
  };
}

function nodeCopy(type: CanvasNodeType) {
  if (type === 'text') {
    return {
      title: 'Text',
      placeholder: 'Tap into your words...',
      glyph: '≡',
    };
  }

  if (type === 'video') {
    return {
      title: 'Video',
      placeholder: '',
      glyph: '▷',
    };
  }

  return {
    title: 'Image',
    placeholder: '',
    glyph: '◫',
  };
}

async function buildVisualLayer(
  config: CanvasNodeConfig,
  size: { width: number; height: number }
): Promise<FabricObject[]> {
  const objects: FabricObject[] = [];
  const copy = nodeCopy(config.type);

  if (config.type === 'image' && config.imageUrl) {
    try {
      const image = await FabricImage.fromURL(config.imageUrl, {
        ...(config.imageUrl.startsWith('data:') ? {} : { crossOrigin: 'anonymous' }),
      });
      const sourceSize = getImageSourceSize(image, size);
      image.set({
        width: sourceSize.width,
        height: sourceSize.height,
        left: size.width / 2,
        top: size.height / 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      const useCover = config.kind === 'look-item-node';
      const scale = useCover
        ? Math.max(size.width / sourceSize.width, size.height / sourceSize.height)
        : Math.min(size.width / sourceSize.width, size.height / sourceSize.height);
      image.set({
        scaleX: scale,
        scaleY: scale,
      });
      if (config.loading && BlurFilterCtor) {
        image.filters = [new BlurFilterCtor({ blur: 0.35 })] as never[];
        image.applyFilters();
        image.set({
          opacity: 0.88,
        });
      }
      image.set('name', 'media-image');
      objects.push(image);
      if (config.loading) {
        const loadingOverlay = new Rect({
          left: 0,
          top: size.height - 56,
          width: size.width,
          height: 56,
          fill: 'rgba(8, 10, 14, 0.34)',
          selectable: false,
          evented: false,
        });
        loadingOverlay.set('name', 'loading-overlay');
        objects.push(loadingOverlay);
      }
      return objects;
    } catch {
      // Fall through to placeholder state.
    }
  }

  const tile = new Rect({
    left: size.width / 2 - 23,
    top: size.height / 2 - 23,
    width: 46,
    height: 46,
    rx: 12,
    ry: 12,
    fill: 'rgba(255, 255, 255, 0.06)',
    stroke: 'rgba(255, 255, 255, 0.18)',
    strokeWidth: 1,
    selectable: false,
    evented: false,
  });

  const glyph = new Textbox(copy.glyph, {
    left: size.width / 2 - 16,
    top: size.height / 2 - 18,
    width: 32,
    textAlign: 'center',
    fontSize: config.type === 'text' ? 24 : 28,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: 'rgba(255, 255, 255, 0.42)',
    selectable: false,
    evented: false,
  });

  const placeholder = new Textbox(config.prompt?.trim() || copy.placeholder, {
    left: 18,
    top: 20,
    width: size.width - 36,
    fontSize: config.type === 'text' ? 13 : 12,
    lineHeight: 1.25,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: config.type === 'text' ? 'rgba(255, 255, 255, 0.42)' : 'rgba(255, 255, 255, 0.3)',
    selectable: false,
    evented: false,
  });
  placeholder.set('name', 'content-text');

  objects.push(tile, glyph);
  if (config.type === 'text' || !config.imageUrl) {
    objects.push(placeholder);
  }
  return objects;
}

async function resolveNodeSize(config: CanvasNodeConfig): Promise<{ width: number; height: number }> {
  const baseSize = NODE_SIZES[config.type];
  if (config.type !== 'image' || !config.imageUrl || config.kind === 'look-item-node') {
    return baseSize;
  }

  try {
    const image = await FabricImage.fromURL(config.imageUrl, {
      ...(config.imageUrl.startsWith('data:') ? {} : { crossOrigin: 'anonymous' }),
    });
    const sourceSize = getImageSourceSize(image, baseSize);
    const width = sourceSize.width;
    const height = sourceSize.height;
    if (width <= 0 || height <= 0) {
      return baseSize;
    }

    const aspectRatio = width / height;
    if (aspectRatio >= 1) {
      return {
        width: baseSize.height,
        height: Math.max(180, baseSize.height / aspectRatio),
      };
    }

    return {
      width: Math.max(180, baseSize.height * aspectRatio),
      height: baseSize.height,
    };
  } catch {
    return baseSize;
  }
}

export async function createCanvasNodeGroup(
  config: CanvasNodeConfig,
  left: number,
  top: number
): Promise<Group> {
  const size = await resolveNodeSize(config);
  const copy = nodeCopy(config.type);

  const shell = new Rect({
    left: 0,
    top: 0,
    width: size.width,
    height: size.height,
    rx: config.type === 'image' ? IMAGE_CORNER_RADIUS : 18,
    ry: config.type === 'image' ? IMAGE_CORNER_RADIUS : 18,
    fill: config.type === 'image' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(31, 31, 35, 0.96)',
    stroke: config.type === 'image' ? 'rgba(228, 230, 234, 0.72)' : 'rgba(255, 255, 255, 0.42)',
    strokeWidth: config.type === 'image' ? 2.4 : 1.4,
    shadow: new Shadow({
      color: 'rgba(0, 0, 0, 0.28)',
      blur: config.type === 'image' ? 18 : 24,
      offsetX: 0,
      offsetY: config.type === 'image' ? 10 : 12,
    }),
    selectable: false,
    evented: false,
  });

  const statusText = config.statusText
    ? new Textbox(config.statusText, {
        left: 16,
        top: size.height - 28,
        width: size.width - 32,
        fontSize: 11,
        fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
        fill: 'rgba(255, 255, 255, 0.44)',
        selectable: false,
        evented: false,
      })
    : null;
  if (statusText) {
    statusText.set('name', 'status-text');
  }

  // PRD 5.1.3.2: 左上角使用文字标识对象类型 Text|Image|Video
  const typeBadge = new Textbox(copy.title, {
    left: 12,
    top: 10,
    width: 60,
    fontSize: 10,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fontWeight: '700',
    fill: 'rgba(255, 255, 255, 0.52)',
    selectable: false,
    evented: false,
  });
  typeBadge.set('name', 'type-badge');

  const visualLayer = await buildVisualLayer(config, size);
  const objects: FabricObject[] = [shell, ...visualLayer, typeBadge];
  if (config.type !== 'image') {
    const title = new Textbox(config.title ?? copy.title, {
      left: 0,
      top: -IMAGE_TITLE_OFFSET,
      width: size.width,
      fontSize: 14,
      fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
      fontWeight: '600',
      fill: 'rgba(236, 238, 244, 0.86)',
      selectable: false,
      evented: false,
    });
    title.set('name', 'node-title');
    objects.unshift(title);
  }
  if (statusText) {
    objects.push(statusText);
  }

  const group = new Group(objects, {
    left,
    top,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    hoverCursor: 'pointer',
  });

  if (config.type === 'image' && config.kind === 'look-item-node') {
    group.clipPath = new Rect({
      left: size.width / 2,
      top: size.height / 2,
      width: size.width,
      height: size.height,
      rx: IMAGE_CORNER_RADIUS,
      ry: IMAGE_CORNER_RADIUS,
      originX: 'center',
      originY: 'center',
      absolutePositioned: false,
    });
  }

  group.set('data', {
    kind: config.kind,
    entityId: config.entityId,
    nodeType: config.type,
    label: config.title ?? copy.title,
    prompt: config.prompt ?? '',
    imageUrl: config.imageUrl ?? null,
    statusText: config.statusText ?? null,
    loading: config.loading ?? false,
    toolbarAnchorOffsetTop: config.type === 'image' ? 0 : IMAGE_TITLE_OFFSET,
  });

  return group;
}

export function updateCanvasNodeGroup(group: Group, prompt: string) {
  const data = (group.get('data') as Record<string, unknown> | undefined) ?? {};
  const nodeType = (data.nodeType as CanvasNodeType | undefined) ?? 'text';
  if (nodeType === 'text') {
    const contentText = group
      .getObjects()
      .find((object) => object.get('name') === 'content-text') as Textbox | undefined;
    if (contentText) {
      contentText.set({ text: prompt.trim() || nodeCopy('text').placeholder });
    }
  }

  group.set('data', {
    ...data,
    prompt,
  });
}

export function getCanvasNodeSize(type: CanvasNodeType) {
  return NODE_SIZES[type];
}
