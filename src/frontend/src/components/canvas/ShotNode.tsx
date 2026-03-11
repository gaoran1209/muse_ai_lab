import { Group, Image as FabricImage, Rect, Shadow, Textbox } from 'fabric';
import type { FabricObject } from 'fabric';
import type { Shot } from '../../types';

const SHOT_WIDTH = 202;
const SHOT_HEIGHT = 292;

export async function createShotNodeGroup(
  shot: Shot,
  left: number,
  top: number,
  promptOverride?: string
): Promise<Group> {
  const background = new Rect({
    left: 0,
    top: 0,
    width: SHOT_WIDTH,
    height: SHOT_HEIGHT,
    rx: 26,
    ry: 26,
    fill: 'rgba(24, 24, 28, 0.98)',
    stroke: shot.adopted ? 'rgba(132, 228, 182, 0.96)' : 'rgba(255, 255, 255, 0.18)',
    strokeWidth: shot.adopted ? 1.8 : 1,
    shadow: new Shadow({
      color: 'rgba(0, 0, 0, 0.34)',
      blur: 28,
      offsetX: 0,
      offsetY: 18,
    }),
  });

  const caption = new Textbox(shot.adopted ? 'ADOPTED SHOT' : 'RESULT NODE', {
    left: 16,
    top: 14,
    width: SHOT_WIDTH - 32,
    fontSize: 11,
    fill: shot.adopted ? '#84e4b6' : 'rgba(222, 228, 238, 0.6)',
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    fontWeight: '600',
    charSpacing: 90,
  });

  const prompt = new Textbox(promptOverride ?? shot.prompt ?? 'Generated frame', {
    left: 16,
    top: SHOT_HEIGHT - 52,
    width: SHOT_WIDTH - 32,
    fontSize: 11,
    fill: 'rgba(238, 242, 249, 0.82)',
    fontFamily: 'Avenir Next, SF Pro Display, PingFang SC, sans-serif',
    lineHeight: 1.15,
  });
  prompt.set('name', 'prompt-text');

  const objects: FabricObject[] = [background, caption, prompt];

  if (shot.url) {
    try {
      const image = await FabricImage.fromURL(shot.url, { crossOrigin: 'anonymous' });
      image.set({
        left: 14,
        top: 38,
        width: SHOT_WIDTH - 28,
        height: 188,
        rx: 18,
        ry: 18,
        selectable: false,
      });
      objects.push(image);
    } catch {
      const placeholder = new Rect({
        left: 14,
        top: 38,
        width: SHOT_WIDTH - 28,
        height: 188,
        rx: 16,
        ry: 16,
        fill: '#203041',
      });
      objects.push(placeholder);
    }
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
    kind: 'shot-node',
    entityId: shot.id,
    label: shot.adopted ? 'Adopted shot' : 'Shot result',
    prompt: promptOverride ?? shot.prompt ?? '',
  });
  return group;
}

export const shotNodeSize = { width: SHOT_WIDTH, height: SHOT_HEIGHT };
