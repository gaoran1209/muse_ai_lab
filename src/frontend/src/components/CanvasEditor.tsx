import type { ComponentProps } from 'react';

import { InfiniteCanvas } from './canvas/InfiniteCanvas';

/**
 * 画布编辑器组件
 */
export function CanvasEditor(props: ComponentProps<typeof InfiniteCanvas>) {
  return <InfiniteCanvas {...props} />;
}
