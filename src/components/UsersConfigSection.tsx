import React, { useEffect, useState } from 'react';
import { AuthUserRecord, UserRole, UserSession } from '../types';
import { fetchUsers, createUserRequest, updateUserRequest, deleteUserRequest } from '../services/authService';

interface UsersConfigSectionProps {
  session: UserSession;
}

const emptyNewUser = { username: '', password: '', name: '', role: 'demonstrativo' as UserRole };

export const UsersConfigSection: React.FC<UsersConfigSectionProps> = ({ session }) => {
  const [users, setUsers] = useState<AuthUserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newUser, setNewUser] = useState(emptyNewUser);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('demonstrativo');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isPmo = session.role === 'pmo';

  const loadUsers = async () => {
    setIsLoading(true);
    setLoadError(null);
    const result = await fetchUsers(session.token);
    setIsLoading(false);
    if (!result.success) {
      setLoadError(result.error || 'Falha ao carregar usuários.');
      return;
    }
    setUsers(result.users || []);
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    const result = await createUserRequest(session.token, newUser);
    setIsCreating(false);
    if (!result.success) {
      showFeedback('error', result.error || 'Falha ao criar usuário.');
      return;
    }
    showFeedback('success', `Usuário "${newUser.username}" criado com sucesso.`);
    setNewUser(emptyNewUser);
    loadUsers();
  };

  const startEdit = (user: AuthUserRecord) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPassword('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPassword('');
  };

  const handleSaveEdit = async (id: string) => {
    if (isSavingEdit) return;
    setIsSavingEdit(true);
    const payload: { id: string; name?: string; role?: UserRole; password?: string } = {
      id,
      name: editName,
      role: editRole
    };
    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }
    const result = await updateUserRequest(session.token, payload);
    setIsSavingEdit(false);
    if (!result.success) {
      showFeedback('error', result.error || 'Falha ao salvar alterações.');
      return;
    }
    showFeedback('success', 'Usuário atualizado com sucesso.');
    setEditingId(null);
    setEditPassword('');
    loadUsers();
  };

  const handleDelete = async (id: string, username: string) => {
    const result = await deleteUserRequest(session.token, id);
    if (!result.success) {
      showFeedback('error', result.error || 'Falha ao excluir usuário.');
      return;
    }
    showFeedback('success', `Usuário "${username}" excluído.`);
    loadUsers();
  };

  if (!isPmo) {
    return (
      <div className="bg-white border border-slate-300 p-4 text-xs text-slate-600">
        Apenas usuários com perfil PMO podem gerenciar usuários.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-300 p-4 space-y-4" id="usuarios-config-panel">
      {feedback && (
        <div
          className={`p-2.5 text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Formulário de novo usuário */}
      <form onSubmit={handleCreate} className="border border-slate-200 p-3 space-y-2.5 bg-slate-50">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Adicionar Novo Usuário</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Usuário (e-mail)</label>
            <input
              type="text"
              required
              value={newUser.username}
              onChange={e => setNewUser(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs focus:outline-none focus:border-[#F26522]"
              placeholder="nome@exedconsulting.com"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome Completo</label>
            <input
              type="text"
              required
              value={newUser.name}
              onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs focus:outline-none focus:border-[#F26522]"
              placeholder="Nome do usuário"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Senha (mín. 8 caracteres)</label>
            <input
              type="text"
              required
              minLength={8}
              value={newUser.password}
              onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs focus:outline-none focus:border-[#F26522]"
              placeholder="Senha inicial"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Perfil</label>
            <select
              value={newUser.role}
              onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as UserRole }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs focus:outline-none focus:border-[#F26522] bg-white"
            >
              <option value="demonstrativo">Demonstrativo (somente leitura)</option>
              <option value="pmo">PMO (acesso total)</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="px-4 py-2 bg-[#F26522] hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wide cursor-pointer transition-colors"
        >
          {isCreating ? 'Criando...' : 'Adicionar Usuário'}
        </button>
      </form>

      {/* Lista de usuários */}
      {isLoading && <div className="text-xs text-slate-500 p-3">Carregando usuários...</div>}
      {loadError && (
        <div className="p-2.5 text-xs font-semibold border bg-red-50 border-red-300 text-red-800">{loadError}</div>
      )}

      {!isLoading && !loadError && (
        <div className="border border-slate-200 divide-y divide-slate-200">
          {users.map(user => (
            <div key={user.id} className="p-3 bg-white">
              {editingId === user.id ? (
                <div className="space-y-2">
                  <div className="font-mono font-bold text-slate-800 text-xs">{user.username}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="px-2 py-1 border border-slate-300 text-xs"
                      placeholder="Nome"
                    />
                    <select
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as UserRole)}
                      className="px-2 py-1 border border-slate-300 text-xs bg-white"
                    >
                      <option value="demonstrativo">Demonstrativo</option>
                      <option value="pmo">PMO</option>
                    </select>
                    <input
                      type="text"
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      className="px-2 py-1 border border-slate-300 text-xs"
                      placeholder="Nova senha (opcional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(user.id)}
                      disabled={isSavingEdit}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-[11px] font-bold uppercase cursor-pointer"
                    >
                      {isSavingEdit ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold uppercase cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-mono font-bold text-slate-800 text-xs">{user.username}</div>
                    <div className="text-[11px] text-slate-500">
                      {user.name} ·{' '}
                      <span
                        className={`font-bold ${user.role === 'pmo' ? 'text-[#F26522]' : 'text-slate-500'}`}
                      >
                        {user.role === 'pmo' ? 'PMO' : 'Demonstrativo'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase cursor-pointer border border-slate-300"
                    >
                      Editar / Trocar Senha
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id, user.username)}
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold uppercase cursor-pointer border border-red-200"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
