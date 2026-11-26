const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api');

type ApiRequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined | null>;
  skipAuthRedirect?: boolean;
};

let isRedirectingToLogin = false;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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

async function parseErrorResponse(response: Response): Promise<{
  message: string;
  code?: string;
}> {
  const fallbackMessage = `Request failed with status ${response.status}`;

  try {
    const rawText = await response.text();
    if (!rawText) {
      return { message: fallbackMessage };
    }

    try {
      const data = JSON.parse(rawText) as {
        message?: string | string[];
        code?: string;
      };
      const message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || fallbackMessage;
      return { message, code: data.code };
    } catch {
      return { message: rawText || fallbackMessage };
    }
  } catch {
    return { message: fallbackMessage };
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { query, headers, skipAuthRedirect = false, ...restOptions } = options;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const isLoginRequest =
    cleanPath === 'auth/login' || cleanPath.startsWith('auth/login?');

  const authHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined' && !isLoginRequest) {
    const token = localStorage.getItem('token');
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(
      'Unable to connect to the server. Please check your internet connection or verify the backend service is running.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 401) {
    const { message, code } = await parseErrorResponse(response);
    const isOnLoginPage =
      typeof window !== 'undefined' && window.location.pathname === '/login';

    // Never redirect/reload when attempting to sign in or already on the login page
    if (skipAuthRedirect || isLoginRequest || isOnLoginPage) {
      throw new ApiError(
        message || 'Invalid credentials. Please check and try again.',
        401,
        code,
      );
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('auth_expires_at');
      if (!isRedirectingToLogin) {
        isRedirectingToLogin = true;
        window.location.href = '/login?reason=expired';
      }
    }

    throw new ApiError('Session expired. Please sign in again.', 401, code);
  }

  if (!response.ok) {
    const { message, code } = await parseErrorResponse(response);
    throw new ApiError(message, response.status, code);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
