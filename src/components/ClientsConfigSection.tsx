import React, { useState, useRef } from 'react';
import { ClientInfo, SapProjectFinancial, SolutionType } from '../types';
import { ClientLogo } from './ClientLogo';

interface ClientsConfigSectionProps {
  clients: ClientInfo[];
  onUpdateClients: (clients: ClientInfo[]) => void;
  projects: SapProjectFinancial[];
  onUpdateProjects: (projects: SapProjectFinancial[]) => void;
  onShowMessage?: (msg: string, isError?: boolean) => void;
}

export const ClientsConfigSection: React.FC<ClientsConfigSectionProps> = ({
  clients,
  onUpdateClients,
  projects,
  onUpdateProjects,
  onShowMessage
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<ClientInfo | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newClient, setNewClient] = useState<Partial<ClientInfo>>({
    name: '',
    shortName: '',
    logoUrl: '',
    defaultSolution: 'RISE',
    primaryColor: '#003087',
    notes: ''
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetClientIdForUpload, setTargetClientIdForUpload] = useState<string | null>(null);

  // Filter clients
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.shortName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.defaultSolution && c.defaultSolution.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle direct file upload for PNG/SVG logo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, clientId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (onShowMessage) onShowMessage('Por favor, selecione um arquivo de imagem válido (PNG, SVG, JPG, WEBP).', true);
      return;
    }

    // Read file as base64 Data URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const targetId = clientId || targetClientIdForUpload;

      if (targetId) {
        // Updating existing client
        const updated = clients.map(c => {
          if (c.id === targetId) {
            return { ...c, logoUrl: dataUrl };
          }
          return c;
        });
        onUpdateClients(updated);

        // Also update projects linked to this client
        const clientObj = clients.find(c => c.id === targetId);
        if (clientObj) {
          const updatedProjects = projects.map(p => {
            if (p.client === clientObj.name || (p.client && clientObj.shortName && p.client.includes(clientObj.shortName))) {
              return { ...p, clientLogo: dataUrl };
            }
            return p;
          });
          onUpdateProjects(updatedProjects);
        }

        if (onShowMessage) onShowMessage(`Logo atualizado com sucesso para o cliente!`);
      } else {
        // Adding new client form
        setNewClient(prev => ({ ...prev, logoUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
    setTargetClientIdForUpload(null);
  };

  const triggerUploadForClient = (clientId: string) => {
    setTargetClientIdForUpload(clientId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSaveNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name?.trim()) {
      if (onShowMessage) onShowMessage('O nome do cliente é obrigatório.', true);
      return;
    }

    const shortName = newClient.shortName?.trim() || newClient.name.split(' ')[0];
    const id = `cli-${Date.now()}`;
    const logoUrl = newClient.logoUrl?.trim() || '/assets/logos/gerdau.png';

    const created: ClientInfo = {
      id,
      name: newClient.name.trim(),
      shortName,
      logoUrl,
      defaultSolution: (newClient.defaultSolution as SolutionType) || 'RISE',
      primaryColor: newClient.primaryColor || '#003087',
      notes: newClient.notes || ''
    };

    onUpdateClients([created, ...clients]);
    setIsAddingNew(false);
    setNewClient({
      name: '',
      shortName: '',
      logoUrl: '',
      defaultSolution: 'RISE',
      primaryColor: '#003087',
      notes: ''
    });

    if (onShowMessage) onShowMessage(`Cliente "${created.name}" adicionado com sucesso!`);
  };

  const handleUpdateClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const previousClient = clients.find(c => c.id === editingClient.id);
    const updated = clients.map(c => (c.id === editingClient.id ? editingClient : c));
    onUpdateClients(updated);

    // Sync logo and client name changes to all projects linked to this client
    const prevName = previousClient ? previousClient.name : editingClient.name;
    const prevShort = previousClient?.shortName;

    const updatedProjects = projects.map(p => {
      const matches =
        p.client === prevName ||
        (prevShort && p.client && p.client.includes(prevShort)) ||
        p.client === editingClient.name ||
        (p.client && editingClient.shortName && p.client.includes(editingClient.shortName));

      if (matches) {
        return {
          ...p,
          clientLogo: editingClient.logoUrl,
          client: editingClient.name
        };
      }
      return p;
    });
    onUpdateProjects(updatedProjects);

    setEditingClient(null);
    if (onShowMessage) onShowMessage(`Dados e logo de "${editingClient.name}" atualizados com sucesso no dashboard!`);
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    // Execução direta sem window.confirm (não funciona de forma confiável no
    // ambiente de iframe deste webapp — mesmo motivo documentado nos botões
    // de dados demonstrativos). Mantém consistência com handleDeleteProject.
    onUpdateClients(clients.filter(c => c.id !== clientId));
    if (onShowMessage) onShowMessage(`Cliente "${clientName}" excluído.`);
  };

  return (
    <div className="bg-white border border-slate-300 p-4 space-y-4" id="vmo-clients-logos-module">
      {/* Hidden File Input for instant uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/svg+xml, image/webp"
        className="hidden"
        onChange={e => handleFileUpload(e)}
      />

      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-bold text-sm text-[#0B2240] uppercase tracking-wide flex items-center gap-2">
              Gestão de Clientes & Logotipos (PMO)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="px-3 py-1.5 bg-[#0B2240] hover:bg-[#F26522] text-white font-bold text-xs cursor-pointer border-none transition-colors flex items-center gap-1"
            >
              Novo cliente
            </button>
          </div>
        </div>
      </div>

      {/* Form: Add New Client */}
      {isAddingNew && (
        <form onSubmit={handleSaveNewClient} className="p-3 bg-slate-50 border border-slate-300 space-y-3">
          <div className="font-bold text-xs text-slate-800 uppercase flex justify-between items-center">
            <span>Cadastrar Novo Cliente com Logotipo</span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-slate-500 hover:text-slate-700 text-xs cursor-pointer bg-transparent border-none"
            >
              ✕ Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nome Completo do Cliente *:</label>
              <input
                type="text"
                value={newClient.name}
                onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                placeholder="Ex: Grupo Industrial Gerdau & Cia"
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nome Curto / Sigla:</label>
              <input
                type="text"
                value={newClient.shortName}
                onChange={e => setNewClient({ ...newClient, shortName: e.target.value })}
                placeholder="Ex: Gerdau"
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Frente Padrão:</label>
              <select
                value={newClient.defaultSolution}
                onChange={e => setNewClient({ ...newClient, defaultSolution: e.target.value as SolutionType })}
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs"
              >
                <option value="RISE">RISE (S/4HANA Cloud)</option>
                <option value="GROW">GROW with SAP</option>
                <option value="SCP (IBP)">SCP (IBP)</option>
                <option value="Fábrica">Fábrica de Software</option>
                <option value="SCE">SCE (EWM / TM)</option>
              </select>
            </div>
          </div>

          {/* Logo Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-center bg-white p-2.5 border border-slate-200">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Upload de Logo (PNG, SVG ou JPEG):</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={e => handleFileUpload(e)}
                  className="text-xs file:mr-2 file:py-1 file:px-2.5 file:border-0 file:text-xs file:font-semibold file:bg-[#0B2240] file:text-white hover:file:bg-[#F26522] cursor-pointer"
                />
                <span className="text-[11px] text-slate-500">ou informe uma URL:</span>
              </div>
              <input
                type="text"
                value={newClient.logoUrl}
                onChange={e => setNewClient({ ...newClient, logoUrl: e.target.value })}
                placeholder="/assets/logos/nome.png ou https://..."
                className="w-full p-1.5 mt-1.5 border border-slate-300 bg-white text-slate-900 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 rounded-sm">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Pré-visualização</span>
              <ClientLogo
                clientName={newClient.name || 'Novo'}
                logoUrl={newClient.logoUrl}
                size="lg"
                theme="light"
              />
              <span className="text-[10px] text-slate-600 mt-1 font-mono">{newClient.shortName || 'Logo'}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer border-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#0B2240] hover:bg-[#F26522] text-white text-xs font-bold cursor-pointer border-none transition-colors"
            >
              Salvar Cliente
            </button>
          </div>
        </form>
      )}

      {/* Form: Edit Existing Client */}
      {editingClient && (
        <form onSubmit={handleUpdateClientSubmit} className="p-3 bg-amber-50/50 border border-amber-300 space-y-3">
          <div className="font-bold text-xs text-amber-900 uppercase flex justify-between items-center">
            <span>Editar Cliente: {editingClient.name}</span>
            <button
              type="button"
              onClick={() => setEditingClient(null)}
              className="text-slate-500 hover:text-slate-700 text-xs cursor-pointer bg-transparent border-none"
            >
              ✕ Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nome do Cliente:</label>
              <input
                type="text"
                value={editingClient.name}
                onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nome Curto:</label>
              <input
                type="text"
                value={editingClient.shortName}
                onChange={e => setEditingClient({ ...editingClient, shortName: e.target.value })}
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Frente Padrão:</label>
              <select
                value={editingClient.defaultSolution || 'RISE'}
                onChange={e => setEditingClient({ ...editingClient, defaultSolution: e.target.value as SolutionType })}
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs"
              >
                <option value="RISE">RISE (S/4HANA Cloud)</option>
                <option value="GROW">GROW with SAP</option>
                <option value="SCP (IBP)">SCP (IBP)</option>
                <option value="Fábrica">Fábrica de Software</option>
                <option value="SCE">SCE (EWM / TM)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs items-center bg-white p-2.5 border border-slate-200">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block font-semibold text-slate-700">Substituir Logo (PNG/SVG/JPG):</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerUploadForClient(editingClient.id)}
                  className="px-3 py-1.5 bg-[#0B2240] hover:bg-[#F26522] text-white text-xs font-bold cursor-pointer border-none transition-colors"
                >
                  Selecionar Imagem PNG do Computador
                </button>
              </div>
              <input
                type="text"
                value={editingClient.logoUrl}
                onChange={e => setEditingClient({ ...editingClient, logoUrl: e.target.value })}
                placeholder="URL ou caminho do logo"
                className="w-full p-1.5 border border-slate-300 bg-white text-slate-900 text-xs font-mono"
              />
            </div>

            <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 rounded-sm">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Logo Atual</span>
              <ClientLogo
                clientName={editingClient.name}
                logoUrl={editingClient.logoUrl}
                size="lg"
                theme="light"
              />
              <span className="text-[10px] text-slate-600 mt-1 font-mono">{editingClient.shortName}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingClient(null)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer border-none"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#0B2240] hover:bg-[#F26522] text-white text-xs font-bold cursor-pointer border-none transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, sigla ou frente..."
            className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
          />
        </div>
        <div className="text-[11px] text-slate-500">
          Exibindo {filteredClients.length} de {clients.length} clientes
        </div>
      </div>

      {/* Clients Table with Logos */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 uppercase text-[10px]">
              <th className="p-2 border border-slate-300 w-12 text-center">Logo</th>
              <th className="p-2 border border-slate-300">Cliente / Razão Social</th>
              <th className="p-2 border border-slate-300">Sigla</th>
              <th className="p-2 border border-slate-300">Frente Padrão</th>
              <th className="p-2 border border-slate-300 text-center">Projetos Ativos</th>
              <th className="p-2 border border-slate-300 text-center w-36">Ações PMO</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => {
              const activeProjectsCount = projects.filter(
                p => p.client === client.name || (p.client && client.shortName && p.client.includes(client.shortName))
              ).length;

              return (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  {/* Small Logo Column */}
                  <td className="p-2 border border-slate-200 text-center align-middle">
                    <div className="flex items-center justify-center">
                      <ClientLogo
                        clientName={client.name}
                        logoUrl={client.logoUrl}
                        size="md"
                        theme="light"
                      />
                    </div>
                  </td>

                  {/* Client Name */}
                  <td className="p-2 border border-slate-200">
                    <div className="font-semibold text-slate-900">{client.name}</div>
                    {client.notes && (
                      <div className="text-[11px] text-slate-500">{client.notes}</div>
                    )}
                  </td>

                  {/* Short Name */}
                  <td className="p-2 border border-slate-200 font-mono font-bold text-slate-700">
                    {client.shortName}
                  </td>

                  {/* Solution Front */}
                  <td className="p-2 border border-slate-200">
                    <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      {client.defaultSolution || 'RISE'}
                    </span>
                  </td>

                  {/* Linked Projects Count */}
                  <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-800">
                    {activeProjectsCount}
                  </td>

                  {/* Action Buttons */}
                  <td className="p-2 border border-slate-200 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => triggerUploadForClient(client.id)}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#00D2FF] hover:text-[#0B2240] text-slate-700 font-semibold text-[11px] border border-slate-300 cursor-pointer transition-colors"
                        title="Fazer upload de PNG para este cliente"
                      >
                        Trocar Logo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingClient(client)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-300 cursor-pointer transition-colors"
                        title="Editar detalhes do cliente"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="px-2 py-1 bg-transparent hover:bg-rose-50 text-rose-700 font-semibold text-[11px] border border-rose-200 cursor-pointer transition-colors"
                        title="Excluir cliente"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
