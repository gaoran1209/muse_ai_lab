import { Group, Rect, Textbox } from 'fabric';
import type { Look } from '../../types';

export function createLookFrameGroup(
  look: Look,
  left: number,
  top: number,
  width: number,
  height: number
): Group {
  const border = new Rect({
    left: 0,
    top: 0,
    width,
    height,
    rx: 24,
    ry: 24,
    fill: 'rgba(255, 255, 255, 0.02)',
    stroke: 'rgba(255, 255, 255, 0.18)',
    strokeWidth: 1.2,
    selectable: false,
    evented: false,
  });

  const title = new Textbox(look.name, {
    left: 8,
    top: -30,
    width: width - 16,
    fontSize: 16,
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fill: 'rgba(242, 244, 249, 0.86)',
    fontWeight: '600',
    selectable: false,
    evented: false,
  });

  const group = new Group([border, title], {
    left,
    top,
    originX: 'left',
    originY: 'top',
    hasControls: false,
    hasBorders: false,
    hoverCursor: 'move',
  });

  group.set('data', {
    kind: 'look-board',
    entityId: look.id,
    label: look.name,
    prompt: look.description ?? '',
    width,
    height,
  });

  return group;
}
