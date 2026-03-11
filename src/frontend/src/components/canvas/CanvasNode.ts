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
}

const NODE_SIZES: Record<CanvasNodeType, { width: number; height: number }> = {
  text: { width: 312, height: 312 },
  image: { width: 264, height: 336 },
  video: { width: 264, height: 336 },
};

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
      const clip = new Rect({
        left: 0,
        top: 0,
        width: size.width,
        height: size.height,
        rx: 22,
        ry: 22,
        originX: 'left',
        originY: 'top',
      });
      const image = await FabricImage.fromURL(config.imageUrl, {
        ...(config.imageUrl.startsWith('data:') ? {} : { crossOrigin: 'anonymous' }),
      });
      image.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        clipPath: clip,
      });
      const scale = Math.max(size.width / (image.width ?? size.width), size.height / (image.height ?? size.height));
      image.scale(scale);
      image.set({
        left: (size.width - image.getScaledWidth()) / 2,
        top: (size.height - image.getScaledHeight()) / 2,
      });
      image.set('name', 'media-image');
      objects.push(image);
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

export async function createCanvasNodeGroup(
  config: CanvasNodeConfig,
  left: number,
  top: number
): Promise<Group> {
  const size = NODE_SIZES[config.type];
  const copy = nodeCopy(config.type);

  const title = new Textbox(config.title ?? copy.title, {
    left: 0,
    top: -34,
    width: size.width,
    fontSize: 14,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fontWeight: '600',
    fill: 'rgba(236, 238, 244, 0.86)',
    selectable: false,
    evented: false,
  });
  title.set('name', 'node-title');

  const shell = new Rect({
    left: 0,
    top: 0,
    width: size.width,
    height: size.height,
    rx: config.type === 'image' ? 24 : 18,
    ry: config.type === 'image' ? 24 : 18,
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

  const visualLayer = await buildVisualLayer(config, size);
  const objects: FabricObject[] = [title, shell, ...visualLayer];
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

  group.set('data', {
    kind: config.kind,
    entityId: config.entityId,
    nodeType: config.type,
    label: config.title ?? copy.title,
    prompt: config.prompt ?? '',
    imageUrl: config.imageUrl ?? null,
    statusText: config.statusText ?? null,
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
