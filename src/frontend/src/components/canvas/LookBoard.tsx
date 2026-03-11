import { Group, Rect, Shadow, Textbox } from 'fabric';
import type { FabricObject } from 'fabric';
import type { Look } from '../../types';

const BOARD_WIDTH = 280;
const BOARD_HEIGHT = 220;

function createSlotCard(label: string, x: number, y: number): FabricObject[] {
  const card = new Rect({
    left: x,
    top: y,
    width: 72,
    height: 82,
    rx: 16,
    ry: 16,
    fill: 'rgba(255, 255, 255, 0.07)',
    stroke: 'rgba(255, 255, 255, 0.08)',
    strokeWidth: 1,
  });

  const text = new Textbox(label, {
    left: x + 8,
    top: y + 10,
    width: 56,
    fontSize: 11,
    lineHeight: 1.15,
    fill: 'rgba(236, 241, 248, 0.82)',
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
  });

  return [card, text];
}

export function createLookBoardGroup(look: Look, left: number, top: number, promptOverride?: string): Group {
  const header = new Rect({
    left: 0,
    top: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    rx: 24,
    ry: 24,
    fill: 'rgba(25, 25, 29, 0.96)',
    stroke: 'rgba(255, 255, 255, 0.16)',
    strokeWidth: 1,
    shadow: new Shadow({
      color: 'rgba(0, 0, 0, 0.28)',
      blur: 26,
      offsetX: 0,
      offsetY: 14,
    }),
  });

  const eyebrow = new Textbox('LOOK BOARD', {
    left: 18,
    top: 16,
    width: BOARD_WIDTH - 36,
    fontSize: 10,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fontWeight: '600',
    charSpacing: 90,
    fill: 'rgba(225, 230, 239, 0.52)',
  });

  const title = new Textbox(look.name, {
    left: 18,
    top: 34,
    width: BOARD_WIDTH - 36,
    fontSize: 20,
    fontFamily: 'Iowan Old Style, Georgia, serif',
    fill: '#fafbff',
    fontWeight: '600',
  });

  const tags = new Textbox(look.style_tags.join(' · ') || 'curated look board', {
    left: 18,
    top: 64,
    width: BOARD_WIDTH - 36,
    fontSize: 11,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: 'rgba(163, 172, 187, 0.72)',
  });

  const description = new Textbox(promptOverride ?? look.description ?? 'Generated styling board for Spark review.', {
    left: 18,
    top: 162,
    width: BOARD_WIDTH - 36,
    fontSize: 12,
    lineHeight: 1.2,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: 'rgba(232, 237, 246, 0.8)',
  });
  description.set('name', 'prompt-text');

  const slotNodes: FabricObject[] = [];
  look.items.slice(0, 3).forEach((item, index) => {
    const cardX = 18 + index * 84;
    const cardY = 90;
    const label = item.placeholder_desc ?? item.category.toUpperCase();
    slotNodes.push(...createSlotCard(label, cardX, cardY));
  });

  const group = new Group([header, eyebrow, title, tags, ...slotNodes, description], {
    left,
    top,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    hoverCursor: 'pointer',
  });

  group.set('data', {
    kind: 'look-board',
    entityId: look.id,
    label: look.name,
    prompt: promptOverride ?? look.description ?? '',
  });
  return group;
}

export const lookBoardSize = { width: BOARD_WIDTH, height: BOARD_HEIGHT };
