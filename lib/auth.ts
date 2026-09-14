import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from './supabaseAdmin';

// ==============================================================================
// AUTENTICAÇÃO REAL DE USUÁRIOS (login + gestão de usuários pelo PMO)
// ==============================================================================
// Tabela usada: `vmo_auth_users` no Supabase — SEM políticas públicas de RLS,
// acessível apenas pelo backend via Service Role Key. Nunca confundir com a
// tabela `usuarios` (essa é só um diretório usado pela sincronização do
// front-end com o Supabase e não guarda senha nenhuma).
//
// Sessão: um JWT assinado com AUTH_JWT_SECRET, contendo {sub, username, role,
// name}. Sem esse segredo configurado, um valor padrão de desenvolvimento é
// usado (com aviso) — configure AUTH_JWT_SECRET em produção.

export type UserRole = 'pmo' | 'demonstrativo';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export type PublicAuthUser = Omit<AuthUser, 'passwordHash'>;

export interface SessionPayload {
  sub: string;
  username: string;
  role: UserRole;
  name: string;
}

const DEV_FALLBACK_JWT_SECRET = 'exed-vmo-dev-only-insecure-secret-troque-em-producao';
const TABLE = 'vmo_auth_users';
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'vmo_auth_users.json');
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

function getJwtSecret(): string {
  const secret = (process.env.AUTH_JWT_SECRET || '').trim();
  if (!secret) {
    console.warn(
      '[auth] AUTH_JWT_SECRET não configurado — usando segredo de desenvolvimento inseguro. Configure essa variável de ambiente em produção (Vercel > Settings > Environment Variables).'
    );
    return DEV_FALLBACK_JWT_SECRET;
  }
  return secret;
}

// ------------------------------------------------------------------------------
// Senhas
// ------------------------------------------------------------------------------
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ------------------------------------------------------------------------------
// Sessão (JWT)
// ------------------------------------------------------------------------------
export function signSession(user: Pick<AuthUser, 'id' | 'username' | 'role' | 'name'>): string {
  const payload: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded === 'object' && decoded && 'sub' in decoded) {
      return decoded as unknown as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: any): string {
  const authHeader = req.headers?.['authorization'] ?? req.headers?.['Authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return '';
}

/** Retorna a sessão válida do request, ou null se ausente/expirada/inválida. */
export function getSessionFromRequest(req: any): SessionPayload | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  return verifySession(token);
}

/** Exige uma sessão válida com role 'pmo'. Retorna a sessão ou null. */
export function requirePmoSession(req: any): SessionPayload | null {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== 'pmo') return null;
  return session;
}

export function toPublicUser(user: AuthUser): PublicAuthUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

// ------------------------------------------------------------------------------
// Persistência (Supabase, com fallback em arquivo local só para dev sem Supabase)
// ------------------------------------------------------------------------------
function readUsersFromDisk(): AuthUser[] {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[auth] Não foi possível ler o arquivo local de usuários:', err);
  }
  return [];
}

function writeUsersToDisk(users: AuthUser[]): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('[auth] Não foi possível gravar o arquivo local de usuários (normal em ambiente serverless):', err?.message || err);
  }
}

function rowToAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function seedDefaultUsersIfEmpty(): Promise<AuthUser[]> {
  const now = new Date().toISOString();
  const seeded: AuthUser[] = [
    {
      id: 'usr-pmo-default',
      username: 'pmo@exedconsulting.com',
      name: 'Gestor VMO / PMO Corporativo',
      role: 'pmo',
      passwordHash: await hashPassword('ExedVmo@2026!'),
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'usr-demo-default',
      username: 'demonstrativo@exedconsulting.com',
      name: 'Visualizador Executivo',
      role: 'demonstrativo',
      passwordHash: await hashPassword('Demonstrativo@2026'),
      createdAt: now,
      updatedAt: now
    }
  ];
  await saveAllUsers(seeded);
  return seeded;
}

async function saveAllUsers(users: AuthUser[]): Promise<void> {
  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdminClient();
    try {
      const rows = users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        password_hash: u.passwordHash,
        created_at: u.createdAt,
        updated_at: u.updatedAt
      }));
      const { error } = await client!.from(TABLE).upsert(rows);
      if (!error) return;
      console.warn('[auth] Falha ao gravar usuários no Supabase:', error.message);
    } catch (err) {
      console.warn('[auth] Erro ao gravar usuários no Supabase:', err);
    }
  }
  writeUsersToDisk(users);
}

export async function listUsers(): Promise<AuthUser[]> {
  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdminClient();
    try {
      const { data, error } = await client!.from(TABLE).select('*').order('created_at', { ascending: true });
      if (!error && Array.isArray(data)) {
        if (data.length === 0) {
          return await seedDefaultUsersIfEmpty();
        }
        return data.map(rowToAuthUser);
      }
      console.warn('[auth] Erro ao ler usuários do Supabase, usando fallback local:', error?.message);
    } catch (err) {
      console.warn('[auth] Falha ao conectar ao Supabase para ler usuários, usando fallback local:', err);
    }
  }

  const local = readUsersFromDisk();
  if (local.length === 0) {
    return await seedDefaultUsersIfEmpty();
  }
  return local;
}

export async function findUserByUsername(username: string): Promise<AuthUser | null> {
  const normalized = username.trim().toLowerCase();
  const users = await listUsers();
  return users.find(u => u.username.toLowerCase() === normalized) || null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const users = await listUsers();
  return users.find(u => u.id === id) || null;
}

export async function createUser(input: {
  username: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password || !input.name?.trim()) {
    return { success: false, error: 'Usuário, senha e nome são obrigatórios.' };
  }
  if (input.password.length < 8) {
    return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
  }
  const existing = await findUserByUsername(username);
  if (existing) {
    return { success: false, error: 'Já existe um usuário com esse nome de usuário/e-mail.' };
  }

  const now = new Date().toISOString();
  const newUser: AuthUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username,
    name: input.name.trim(),
    role: input.role === 'pmo' ? 'pmo' : 'demonstrativo',
    passwordHash: await hashPassword(input.password),
    createdAt: now,
    updatedAt: now
  };

  const users = await listUsers();
  users.push(newUser);
  await saveAllUsers(users);

  return { success: true, user: newUser };
}

export async function updateUser(
  id: string,
  updates: { name?: string; role?: UserRole; password?: string }
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const users = await listUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) {
    return { success: false, error: 'Usuário não encontrado.' };
  }

  if (updates.password) {
    if (updates.password.length < 8) {
      return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
    }
    users[idx].passwordHash = await hashPassword(updates.password);
  }
  if (updates.name?.trim()) {
    users[idx].name = updates.name.trim();
  }
  if (updates.role === 'pmo' || updates.role === 'demonstrativo') {
    // Impede remover o último PMO restante (evita ficar sem ninguém com acesso administrativo)
    const remainingPmoCount = users.filter(u => u.role === 'pmo' && u.id !== id).length;
    if (users[idx].role === 'pmo' && updates.role !== 'pmo' && remainingPmoCount === 0) {
      return { success: false, error: 'Não é possível remover o último usuário PMO do sistema.' };
    }
    users[idx].role = updates.role;
  }
  users[idx].updatedAt = new Date().toISOString();

  await saveAllUsers(users);
  return { success: true, user: users[idx] };
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  const users = await listUsers();
  const target = users.find(u => u.id === id);
  if (!target) {
    return { success: false, error: 'Usuário não encontrado.' };
  }
  const remainingPmoCount = users.filter(u => u.role === 'pmo' && u.id !== id).length;
  if (target.role === 'pmo' && remainingPmoCount === 0) {
    return { success: false, error: 'Não é possível excluir o último usuário PMO do sistema.' };
  }

  const updated = users.filter(u => u.id !== id);

  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdminClient();
    try {
      const { error } = await client!.from(TABLE).delete().eq('id', id);
      if (!error) return { success: true };
      console.warn('[auth] Falha ao excluir usuário no Supabase:', error.message);
    } catch (err) {
      console.warn('[auth] Erro ao excluir usuário no Supabase:', err);
    }
  }

  writeUsersToDisk(updated);
  return { success: true };
}
