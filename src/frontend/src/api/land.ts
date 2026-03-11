import type {
  CommentCreateRequest,
  ContentBrief,
  FeedParams,
  Interaction,
  InteractionToggleResponse,
  LandContentDetail,
  PaginatedResponse,
  PromoteResponse,
  TryOnCreateRequest,
  TryOnTask,
} from '@/types';

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  detail?: string;
};

const API_ROOT = '/api/v1';
const USER_STORAGE_KEY = 'muse-land-user-id';

function buildQuery(params: FeedParams): string {
  const query = new URLSearchParams();

  if (params.tag) {
    query.set('tag', params.tag);
  }
  if (params.page) {
    query.set('page', String(params.page));
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as T | ApiEnvelope<T>)
    : null;

  if (!response.ok) {
    const message =
      (payload as ApiEnvelope<T> | null)?.error ||
      (payload as ApiEnvelope<T> | null)?.detail ||
      response.statusText ||
      'Request failed';
    throw new Error(message);
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  return parseResponse<T>(response);
}

function normalizeFeedResponse(
  payload: PaginatedResponse<ContentBrief> | ContentBrief[]
): PaginatedResponse<ContentBrief> {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      page: 1,
      limit: payload.length || 20,
    };
  }

  return payload;
}

export function getLandUserIdentifier(): string {
  const fallback = `muse-land-${Math.random().toString(36).slice(2, 10)}`;

  if (typeof window === 'undefined') {
    return fallback;
  }

  const existing = window.localStorage.getItem(USER_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  window.localStorage.setItem(USER_STORAGE_KEY, fallback);
  return fallback;
}

export async function fetchLandFeed(
  params: FeedParams
): Promise<PaginatedResponse<ContentBrief>> {
  const payload = await request<PaginatedResponse<ContentBrief> | ContentBrief[]>(
    `/land/feed${buildQuery(params)}`
  );
  return normalizeFeedResponse(payload);
}

export async function fetchLandContentDetail(contentId: string): Promise<LandContentDetail> {
  const query = new URLSearchParams({
    user_identifier: getLandUserIdentifier(),
  });
  return request<LandContentDetail>(`/land/contents/${contentId}?${query.toString()}`);
}

export async function likeLandContent(contentId: string): Promise<InteractionToggleResponse> {
  return request<InteractionToggleResponse>(`/land/contents/${contentId}/like`, {
    method: 'POST',
    body: JSON.stringify({ user_identifier: getLandUserIdentifier() }),
  });
}

export async function favoriteLandContent(contentId: string): Promise<InteractionToggleResponse> {
  return request<InteractionToggleResponse>(`/land/contents/${contentId}/favorite`, {
    method: 'POST',
    body: JSON.stringify({ user_identifier: getLandUserIdentifier() }),
  });
}

export async function commentLandContent(
  contentId: string,
  payload: CommentCreateRequest
): Promise<Interaction> {
  return request<Interaction>(`/land/contents/${contentId}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      user_identifier: payload.user_identifier ?? getLandUserIdentifier(),
    }),
  });
}

export async function createTryOnTask(
  contentId: string,
  payload: TryOnCreateRequest
): Promise<TryOnTask> {
  return request<TryOnTask>(`/land/contents/${contentId}/tryon`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTryOnTask(taskId: string): Promise<TryOnTask> {
  return request<TryOnTask>(`/land/tryon/${taskId}`);
}

export async function fetchPromotePayload(contentId: string): Promise<PromoteResponse> {
  return request<PromoteResponse>(`/land/contents/${contentId}/promote`);
}

export async function uploadImageToOSS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_ROOT}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json()) as { success?: boolean; url?: string; error?: string };
  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.error || '图片上传失败');
  }

  return payload.url;
}
