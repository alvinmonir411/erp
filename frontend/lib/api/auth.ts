import { LoginResponse } from '../../types/api';
import { apiRequest } from './client';

export async function login(
  identifier: string,
  password: string
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function getProfile() {
  return apiRequest('/auth/profile', {
    method: 'GET',
  });
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_expires_at');
    window.location.href = '/login';
  }
}
