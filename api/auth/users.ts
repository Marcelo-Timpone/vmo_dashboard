import { handlePreflight } from '../../lib/apiAuth.js';
import {
  requirePmoSession,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  toPublicUser,
  getSessionFromRequest
} from '../../lib/auth.js';

function sendForbidden(res: any) {
  res.status(403).json({
    success: false,
    error: 'Acesso restrito a usuários com perfil PMO. Faça login com uma conta PMO para gerenciar usuários.'
  });
}

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  // Toda a gestão de usuários (listar, criar, editar, excluir) exige uma
  // sessão válida com role 'pmo' — verificado aqui no servidor, não apenas
  // escondendo botões no front-end.
  const session = requirePmoSession(req);
  if (!session) {
    // Diferencia "não logado" de "logado mas sem permissão" só para log interno;
    // a resposta ao cliente é a mesma nos dois casos.
    const anySession = getSessionFromRequest(req);
    if (!anySession) {
      return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
    return sendForbidden(res);
  }

  if (req.method === 'GET') {
    const users = await listUsers();
    return res.status(200).json({ success: true, users: users.map(toPublicUser) });
  }

  if (req.method === 'POST') {
    const { username, password, name, role } = req.body || {};
    const result = await createUser({ username, password, name, role });
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, user: toPublicUser(result.user!) });
  }

  if (req.method === 'PUT') {
    const { id, name, role, password } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'ID do usuário é obrigatório.' });

    const result = await updateUser(id, { name, role, password });
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.status(200).json({ success: true, user: toPublicUser(result.user!) });
  }

  if (req.method === 'DELETE') {
    const id = req.body?.id || req.query?.id;
    if (!id) return res.status(400).json({ success: false, error: 'ID do usuário é obrigatório.' });

    if (id === session.sub) {
      return res.status(400).json({ success: false, error: 'Você não pode excluir sua própria conta enquanto está logado com ela.' });
    }

    const result = await deleteUser(String(id));
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
  return res.status(405).json({ success: false, error: 'Método não permitido' });
}
