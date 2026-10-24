export function isCapacitorApp(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

export function getServerUrl(): string {
  const custom = localStorage.getItem('mymusic_server_url');
  if (custom) return custom.replace(/\/+$/, '');
  return '';
}

export function setServerUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) {
    localStorage.removeItem('mymusic_server_url');
  } else {
    localStorage.setItem('mymusic_server_url', cleaned);
  }
}

export function getApiBase(): string {
  const server = getServerUrl();
  return server ? `${server}/api/v1` : '/api/v1';
}

export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const server = getServerUrl();
  if (server) {
    return `${server}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('mymusic_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${apiBase}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err: any) {
    throw new ApiError(0, 'Network unavailable. Check your connection or offline status.');
  }

  // Handle Token Expiration (401) and Refresh
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('mymusic_refresh_token');
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            localStorage.setItem('mymusic_token', data.access_token);
            onRefreshed(data.access_token);
            isRefreshing = false;

            // Retry original request with new token
            headers.set('Authorization', `Bearer ${data.access_token}`);
            return apiRequest<T>(endpoint, { ...options, headers });
          } else {
            localStorage.removeItem('mymusic_token');
            localStorage.removeItem('mymusic_refresh_token');
            isRefreshing = false;
          }
        } catch {
          isRefreshing = false;
        }
      } else {
        // Wait for active refresh
        return new Promise<T>((resolve) => {
          subscribeTokenRefresh((newToken) => {
            headers.set('Authorization', `Bearer ${newToken}`);
            resolve(apiRequest<T>(endpoint, { ...options, headers }));
          });
        });
      }
    }
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    let errorData = null;
    try {
      errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // Body not JSON
    }
    throw new ApiError(response.status, errorDetail, errorData);
  }

  if (response.status === 204) {
    return null as any;
  }

  return response.json();
}
