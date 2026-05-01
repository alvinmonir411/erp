import { User, Role, UserStatus } from '../../types/api';
import { apiRequest } from './client';

export async function getUsers(): Promise<User[]> {
  return apiRequest<User[]>('/users', {
    method: 'GET',
  });
}

export async function createUser(data: {
  name: string;
  username: string;
  email: string;
  password?: string;
  role: Role;
}): Promise<User> {
  return apiRequest<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    role?: Role;
    status?: UserStatus;
  }
): Promise<User> {
  return apiRequest<User>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deactivateUser(id: string): Promise<User> {
  return apiRequest<User>(`/users/${id}/deactivate`, {
    method: 'PATCH',
  });
}

export async function deleteUser(id: string): Promise<void> {
  await apiRequest<void>(`/users/${id}`, {
    method: 'DELETE',
  });
}
