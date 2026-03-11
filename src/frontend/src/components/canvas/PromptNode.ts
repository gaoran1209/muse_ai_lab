import { Group, Rect, Shadow, Textbox } from 'fabric';
import type { FabricObject } from 'fabric';

export type PromptNodeType = 'text' | 'image' | 'video';

const NODE_SIZES: Record<PromptNodeType, { width: number; height: number }> = {
  text: { width: 260, height: 148 },
  image: { width: 216, height: 286 },
  video: { width: 216, height: 286 },
};

function getNodeCopy(kind: PromptNodeType) {
  if (kind === 'text') {
    return {
      title: 'Text',
      hint: 'Script, ad copy, brand text',
      glyph: 'T',
      label: 'TEXT NODE',
    };
  }

  if (kind === 'video') {
    return {
      title: 'Video',
      hint: 'Motion shot, runway clip, campaign reel',
      glyph: 'V',
      label: 'VIDEO NODE',
    };
  }

  return {
    title: 'Image',
    hint: 'Hero frame, editorial image, product shot',
    glyph: 'I',
    label: 'IMAGE NODE',
  };
}

function truncatePrompt(prompt: string, kind: PromptNodeType) {
  const limit = kind === 'text' ? 160 : 120;
  if (prompt.length <= limit) return prompt;
  return `${prompt.slice(0, limit - 1)}…`;
}

export function createPromptNodeGroup(
  kind: PromptNodeType,
  prompt: string,
  left: number,
  top: number,
  id = `prompt-node-${Date.now()}`
): Group {
  const size = NODE_SIZES[kind];
  const copy = getNodeCopy(kind);

  const shell = new Rect({
    left: 0,
    top: 0,
    width: size.width,
    height: size.height,
    rx: 28,
    ry: 28,
    fill: 'rgba(26, 26, 30, 0.94)',
    stroke: 'rgba(255, 255, 255, 0.18)',
    strokeWidth: 1.2,
    shadow: new Shadow({
      color: 'rgba(0, 0, 0, 0.34)',
      blur: 30,
      offsetX: 0,
      offsetY: 18,
    }),
  });

  const badge = new Textbox(copy.label, {
    left: 20,
    top: 18,
    width: size.width - 40,
    fontSize: 11,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fontWeight: '600',
    charSpacing: 80,
    fill: 'rgba(228, 233, 242, 0.56)',
    selectable: false,
    evented: false,
  });
  badge.set('name', 'badge');

  const iconTile = new Rect({
    left: 20,
    top: kind === 'text' ? 48 : 54,
    width: 54,
    height: 54,
    rx: 18,
    ry: 18,
    fill: 'rgba(255, 255, 255, 0.08)',
    stroke: 'rgba(255, 255, 255, 0.06)',
    strokeWidth: 1,
  });

  const iconGlyph = new Textbox(copy.glyph, {
    left: 40,
    top: kind === 'text' ? 60 : 66,
    width: 20,
    fontSize: 28,
    fontFamily: 'Iowan Old Style, Georgia, serif',
    fontWeight: '700',
    fill: 'rgba(250, 250, 252, 0.86)',
    textAlign: 'center',
    selectable: false,
    evented: false,
  });

  const title = new Textbox(copy.title, {
    left: 88,
    top: kind === 'text' ? 54 : 62,
    width: size.width - 108,
    fontSize: 22,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fontWeight: '600',
    fill: '#f7f8fb',
    selectable: false,
    evented: false,
  });

  const hint = new Textbox(copy.hint, {
    left: 88,
    top: kind === 'text' ? 84 : 96,
    width: size.width - 108,
    fontSize: 12,
    lineHeight: 1.15,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: 'rgba(205, 212, 224, 0.48)',
    selectable: false,
    evented: false,
  });

  const promptBox = new Rect({
    left: 20,
    top: kind === 'text' ? 112 : size.height - 104,
    width: size.width - 40,
    height: kind === 'text' ? 20 : 64,
    rx: 16,
    ry: 16,
    fill: 'rgba(255, 255, 255, 0.05)',
  });

  const promptText = new Textbox(truncatePrompt(prompt, kind), {
    left: 24,
    top: kind === 'text' ? 116 : size.height - 98,
    width: size.width - 48,
    fontSize: kind === 'text' ? 13 : 12,
    lineHeight: 1.18,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: 'rgba(241, 244, 250, 0.8)',
    selectable: false,
    evented: false,
  });
  promptText.set('name', 'prompt-text');

  const objects: FabricObject[] = [shell, badge, iconTile, iconGlyph, title, hint, promptBox, promptText];
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
    kind: 'prompt-node',
    entityId: id,
    nodeType: kind,
    label: copy.title,
    prompt,
  });

  return group;
}

export function updatePromptNodeGroup(group: Group, prompt: string) {
  const data = (group.get('data') as Record<string, unknown> | undefined) ?? {};
  const kind = (data.nodeType as PromptNodeType | undefined) ?? 'text';
  const promptText = group
    .getObjects()
    .find((object) => object.get('name') === 'prompt-text') as
    | Textbox
    | undefined;

  if (promptText) {
    promptText.set({ text: truncatePrompt(prompt, kind) });
  }

  group.set('data', {
    ...data,
    prompt,
  });
}

export function getPromptNodeSize(kind: PromptNodeType) {
  return NODE_SIZES[kind];
}
