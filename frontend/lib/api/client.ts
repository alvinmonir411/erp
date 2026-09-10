const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api');

type ApiRequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined | null>;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(cleanPath, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }


  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { query, headers, ...restOptions } = options;
  const authHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(buildUrl(path, query), {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    cache: 'no-store',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_expires_at');
    window.location.href = '/login';
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;

    try {
      const data = (await response.json()) as { message?: string | string[] };
      const message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message ?? fallbackMessage;
      throw new ApiError(message, response.status);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(fallbackMessage, response.status);
    }
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    if (!response.ok) {
      throw new ApiError(text || `Request failed with status ${response.status}`, response.status);
    }
    return text as unknown as T;
  }
}
