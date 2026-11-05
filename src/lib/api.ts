const TOKEN_KEY = 'veritas_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error) errorMessage = errData.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function uploadLocalFile(file: File, folder = 'general'): Promise<{ url: string; fileName: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  return apiFetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

