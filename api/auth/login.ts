import { handlePreflight } from '../../lib/apiAuth';
import { findUserByUsername, verifyPassword, signSession, toPublicUser } from '../../lib/auth';

export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
    }

    const user = await findUserByUsername(String(username));
    // Mensagem genérica de propósito: não revela se o usuário existe ou não.
    const invalidCredentialsResponse = () =>
      res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });

    if (!user) return invalidCredentialsResponse();

    const validPassword = await verifyPassword(String(password), user.passwordHash);
    if (!validPassword) return invalidCredentialsResponse();

    const token = signSession(user);

    return res.status(200).json({
      success: true,
      token,
      user: toPublicUser(user)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao autenticar.' });
  }
}
