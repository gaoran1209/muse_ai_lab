import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasDraftState, Look, Shot } from '../types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface UseCanvasAutosaveArgs {
  projectId: string | null;
  looks: Look[];
  shots: Shot[];
  serverCanvasState: CanvasDraftState | null;
  saveLookDraft: (
    lookId: string,
    payload: { description?: string | null; boardPosition?: NonNullable<Look['board_position']> }
  ) => Promise<void>;
  saveShotCanvasPosition: (
    shotId: string,
    canvasPosition: NonNullable<Shot['canvas_position']>
  ) => Promise<void>;
  saveProjectCanvasState: (projectId: string, canvasState: CanvasDraftState) => Promise<void>;
}

const AUTOSAVE_DELAY_MS = 600;
const SNAPSHOT_VERSION = 1;

function emptyCanvasState(): CanvasDraftState {
  return {
    version: SNAPSHOT_VERSION,
    lookPromptOverrides: {},
    lookFrameOverrides: {},
    shotPositionOverrides: {},
    hiddenLookIds: [],
    hiddenLookItemIds: [],
    hiddenShotIds: [],
    localNodes: [],
    localBoards: [],
  };
}

function storageKey(projectId: string) {
  return `muse:canvas-autosave:${projectId}`;
}

function readPendingState(projectId: string): CanvasDraftState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    return { ...emptyCanvasState(), ...(JSON.parse(raw) as CanvasDraftState) };
  } catch {
    return null;
  }
}

function writePendingState(projectId: string, canvasState: CanvasDraftState) {
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(canvasState));
}

function clearPendingState(projectId: string) {
  window.localStorage.removeItem(storageKey(projectId));
}

function mergeCanvasState(
  serverState: CanvasDraftState | null,
  localState: CanvasDraftState | null
): CanvasDraftState {
  return {
    ...emptyCanvasState(),
    ...(serverState ?? {}),
    ...(localState ?? {}),
    lookPromptOverrides: {
      ...(serverState?.lookPromptOverrides ?? {}),
      ...(localState?.lookPromptOverrides ?? {}),
    },
    lookFrameOverrides: {
      ...(serverState?.lookFrameOverrides ?? {}),
      ...(localState?.lookFrameOverrides ?? {}),
    },
    shotPositionOverrides: {
      ...(serverState?.shotPositionOverrides ?? {}),
      ...(localState?.shotPositionOverrides ?? {}),
    },
    hiddenLookIds: localState?.hiddenLookIds ?? serverState?.hiddenLookIds ?? [],
    hiddenLookItemIds: localState?.hiddenLookItemIds ?? serverState?.hiddenLookItemIds ?? [],
    hiddenShotIds: localState?.hiddenShotIds ?? serverState?.hiddenShotIds ?? [],
    localNodes: localState?.localNodes ?? serverState?.localNodes ?? [],
    localBoards: localState?.localBoards ?? serverState?.localBoards ?? [],
    version: SNAPSHOT_VERSION,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useCanvasAutosave({
  projectId,
  looks,
  shots,
  serverCanvasState,
  saveLookDraft,
  saveShotCanvasPosition,
  saveProjectCanvasState,
}: UseCanvasAutosaveArgs) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [initialCanvasState, setInitialCanvasState] = useState<CanvasDraftState | null>(null);
  const latestSnapshotRef = useRef<CanvasDraftState>(emptyCanvasState());
  const flushTimerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const looksRef = useRef(looks);
  const shotsRef = useRef(shots);

  useEffect(() => {
    looksRef.current = looks;
  }, [looks]);

  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  useEffect(() => {
    if (!projectId) {
      setInitialCanvasState(null);
      latestSnapshotRef.current = emptyCanvasState();
      return;
    }

    const merged = mergeCanvasState(serverCanvasState, readPendingState(projectId));
    setInitialCanvasState(merged);
    latestSnapshotRef.current = merged;
    dirtyRef.current = Boolean(readPendingState(projectId));
    setSaveStatus(dirtyRef.current ? (navigator.onLine ? 'error' : 'offline') : 'idle');
  }, [projectId, serverCanvasState]);

  const flush = useCallback(async () => {
    if (!projectId) return;

    const snapshot = latestSnapshotRef.current;
    setSaveStatus('saving');

    try {
      const lookTasks = looksRef.current.flatMap((look) => {
        const boardPosition = snapshot.lookFrameOverrides[look.id];
        const description = snapshot.lookPromptOverrides[look.id];
        const nextPayload: { description?: string | null; boardPosition?: NonNullable<Look['board_position']> } = {};

        if (boardPosition && !sameJson(boardPosition, look.board_position)) {
          nextPayload.boardPosition = boardPosition;
        }
        if (
          typeof description === 'string' &&
          description !== (look.description ?? '')
        ) {
          nextPayload.description = description;
        }

        return Object.keys(nextPayload).length > 0 ? [saveLookDraft(look.id, nextPayload)] : [];
      });

      const shotTasks = shotsRef.current.flatMap((shot) => {
        const canvasPosition = snapshot.shotPositionOverrides[shot.id];
        if (!canvasPosition || sameJson(canvasPosition, shot.canvas_position)) {
          return [];
        }
        return [saveShotCanvasPosition(shot.id, canvasPosition)];
      });

      await Promise.all([
        ...lookTasks,
        ...shotTasks,
        saveProjectCanvasState(projectId, snapshot),
      ]);

      clearPendingState(projectId);
      dirtyRef.current = false;
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
    } catch {
      dirtyRef.current = true;
      setSaveStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [projectId, saveLookDraft, saveProjectCanvasState, saveShotCanvasPosition]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = window.setTimeout(() => {
      void flush();
    }, AUTOSAVE_DELAY_MS);
  }, [flush]);

  const reportCanvasStateChange = useCallback(
    (canvasState: CanvasDraftState) => {
      if (!projectId) return;
      latestSnapshotRef.current = { ...canvasState, version: SNAPSHOT_VERSION };
      writePendingState(projectId, latestSnapshotRef.current);
      dirtyRef.current = true;
      setSaveStatus(navigator.onLine ? 'saving' : 'offline');
      scheduleFlush();
    },
    [projectId, scheduleFlush]
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleOnline = () => {
      if (!dirtyRef.current) return;
      setSaveStatus('saving');
      scheduleFlush();
    };

    const handleOffline = () => {
      if (dirtyRef.current) {
        setSaveStatus('offline');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [scheduleFlush]);

  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
    },
    []
  );

  const saveLabel = useMemo(() => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'offline') return 'Offline changes pending';
    if (saveStatus === 'error') return 'Save failed, retrying';
    if (saveStatus === 'saved') return lastSavedAt ? 'Saved' : 'Saved';
    return null;
  }, [lastSavedAt, saveStatus]);

  return {
    initialCanvasState,
    reportCanvasStateChange,
    saveLabel,
    saveStatus,
  };
}
