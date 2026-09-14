import { AuthUserRecord, UserRole } from '../types';

interface LoginResult {
  success: boolean;
  token?: string;
  user?: AuthUserRecord;
  error?: string;
}

interface UsersListResult {
  success: boolean;
  users?: AuthUserRecord[];
  error?: string;
}

interface UserMutationResult {
  success: boolean;
  user?: AuthUserRecord;
  error?: string;
}

function normalizeUser(raw: any): AuthUserRecord {
  return {
    id: raw.id,
    username: raw.username,
    name: raw.name,
    role: raw.role,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

export async function loginRequest(username: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Usuário ou senha inválidos.' };
    }
    return { success: true, token: data.token, user: normalizeUser(data.user) };
  } catch (err: any) {
    return { success: false, error: 'Não foi possível conectar ao servidor. Tente novamente.' };
  }
}

export async function fetchUsers(token: string): Promise<UsersListResult> {
  try {
    const res = await fetch('/api/auth/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao carregar usuários.' };
    }
    return { success: true, users: (data.users || []).map(normalizeUser) };
  } catch (err: any) {
    return { success: false, error: 'Não foi possível conectar ao servidor.' };
  }
}

export async function createUserRequest(
  token: string,
  input: { username: string; password: string; name: string; role: UserRole }
): Promise<UserMutationResult> {
  try {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao criar usuário.' };
    }
    return { success: true, user: normalizeUser(data.user) };
  } catch (err: any) {
    return { success: false, error: 'Não foi possível conectar ao servidor.' };
  }
}

export async function updateUserRequest(
  token: string,
  input: { id: string; name?: string; role?: UserRole; password?: string }
): Promise<UserMutationResult> {
  try {
    const res = await fetch('/api/auth/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao atualizar usuário.' };
    }
    return { success: true, user: normalizeUser(data.user) };
  } catch (err: any) {
    return { success: false, error: 'Não foi possível conectar ao servidor.' };
  }
}

export async function deleteUserRequest(token: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao excluir usuário.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Não foi possível conectar ao servidor.' };
  }
}
