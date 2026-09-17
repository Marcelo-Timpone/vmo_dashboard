import { handlePreflight, isAuthorized, sendUnauthorized } from '../../lib/apiAuth.js';
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '../../lib/supabaseAdmin.js';

// =============================================================================
// BACKUP COMPLETO, RESTAURAÇÃO E LIMPEZA TOTAL
// =============================================================================
// GET  → backup no formato "vmo-backup" (versão 2): estado inteiro do app e as
//        tabelas vmo_projetos_ids e vmo_migracao_arquivos. Sem usuários/senhas.
// POST → { acao: 'restaurar', confirmacao: 'RESTAURAR', backup }
//        { acao: 'apagar_tudo', confirmacao: 'APAGAR' }
// Cada operação roda no banco em uma função só (tudo ou nada):
// vmo_backup_completo, vmo_restaurar_backup e vmo_apagar_dados.
export default async function handler(req: any, res: any) {
  if (handlePreflight(req, res)) return;
  if (!isAuthorized(req)) return sendUnauthorized(res);

  if (!isSupabaseAdminConfigured()) {
    return res.status(503).json({
      sucesso: false,
      mensagem: 'Supabase não configurado no servidor (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).'
    });
  }
  const client = getSupabaseAdminClient()!;

  try {
    if (req.method === 'GET') {
      const { data, error } = await client.rpc('vmo_backup_completo');
      if (error) throw new Error(error.message);
      const carimbo = String((data as any)?.gerado_em || new Date().toISOString())
        .slice(0, 16)
        .replace(/[-:T]/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="vmo-backup-${carimbo}.json"`);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const carimbo = new Date().toISOString();

      if (body.acao === 'apagar_tudo') {
        if (body.confirmacao !== 'APAGAR') {
          return res.status(400).json({ sucesso: false, mensagem: 'Confirmação ausente: envie confirmacao = "APAGAR".' });
        }
        const { data, error } = await client.rpc('vmo_apagar_dados', { p_carimbo: carimbo });
        if (error) throw new Error(error.message);
        return res.status(200).json({
          sucesso: true,
          mensagem: 'Todos os dados foram apagados.',
          resumo: data,
          ultima_atualizacao: carimbo
        });
      }

      if (body.acao === 'restaurar') {
        if (body.confirmacao !== 'RESTAURAR') {
          return res.status(400).json({ sucesso: false, mensagem: 'Confirmação ausente: envie confirmacao = "RESTAURAR".' });
        }
        const backup = body.backup;
        if (!backup || backup.formato !== 'vmo-backup' || typeof backup.estado !== 'object' || backup.estado === null) {
          return res.status(400).json({
            sucesso: false,
            mensagem: 'O arquivo não é um backup completo do VMO (formato vmo-backup).'
          });
        }
        const { data, error } = await client.rpc('vmo_restaurar_backup', { p_backup: backup, p_carimbo: carimbo });
        if (error) throw new Error(error.message);
        return res.status(200).json({
          sucesso: true,
          mensagem: 'Backup restaurado.',
          resumo: data,
          ultima_atualizacao: carimbo
        });
      }

      return res.status(400).json({ sucesso: false, mensagem: 'Ação desconhecida. Use apagar_tudo ou restaurar.' });
    }

    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Falha na operação de backup: ' + (err?.message || 'erro desconhecido')
    });
  }
}
