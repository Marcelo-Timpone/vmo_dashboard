import React, { useState } from 'react';
import { PromptRecordItem } from '../types';

interface PromptManagerModalProps {
  prompts: PromptRecordItem[];
  onAddPrompt: (title: string, content: string) => void;
  onClose: () => void;
}

export const PromptManagerModal: React.FC<PromptManagerModalProps> = ({
  prompts,
  onAddPrompt,
  onClose
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>(prompts[0]?.id || '');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPrompts = prompts.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId) || prompts[0];

  const handleCopy = (text: string, label = 'Prompt copiado para a área de transferência') => {
    navigator.clipboard.writeText(text);
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(null), 3500);
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const title = newTitle.trim() || `Prompt ${prompts.length + 1}`;
    onAddPrompt(title, newContent.trim());
    setNewTitle('');
    setNewContent('');
  };

  // Download all prompts combined into a single structured .TXT document
  const handleDownloadAllText = () => {
    let text = `================================================================================\n`;
    text += `HISTÓRICO COMPLETO DE PROMPTS - PROJETO VMO EXED CONSULTING\n`;
    text += `Ambiente: Front-end Mockup Vercel / Next.js com Tailwind CSS\n`;
    text += `Data de Exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    text += `Total de Prompts Registrados: ${prompts.length}\n`;
    text += `================================================================================\n\n`;

    prompts.forEach((p, index) => {
      text += `--------------------------------------------------------------------------------\n`;
      text += `[PROMPT #${index + 1}] - ${p.title}\n`;
      text += `ID: ${p.id} | Registrado em: ${p.timestamp}\n`;
      text += `--------------------------------------------------------------------------------\n\n`;
      text += `${p.content.trim()}\n\n\n`;
    });

    text += `================================================================================\n`;
    text += `FIM DO HISTÓRICO DE PROMPTS - EXED CONSULTING\n`;
    text += `================================================================================\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_prompts_completo_vmo_exed_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download all prompts in JSON format
  const handleDownloadAllJson = () => {
    const payload = {
      project: 'VMO Corporativo - Exed Consulting',
      exportedAt: new Date().toISOString(),
      totalPrompts: prompts.length,
      prompts
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_prompts_completo_vmo_exed_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy all prompts combined to clipboard
  const handleCopyAll = () => {
    let text = `HISTÓRICO COMPLETO DE PROMPTS - VMO EXED CONSULTING (${prompts.length} prompts)\n\n`;
    prompts.forEach((p, index) => {
      text += `=== [PROMPT #${index + 1}] ${p.title} (${p.timestamp}) ===\n`;
      text += `${p.content.trim()}\n\n`;
    });
    handleCopy(text, `Todos os ${prompts.length} prompts foram copiados para a área de transferência!`);
  };

  const handleDownloadSingle = (prompt: PromptRecordItem) => {
    let text = `================================================================================\n`;
    text += `${prompt.title}\n`;
    text += `Data de Registro: ${prompt.timestamp}\n`;
    text += `ID: ${prompt.id}\n`;
    text += `================================================================================\n\n`;
    text += prompt.content.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prompt.id}_${prompt.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" id="prompt-history-modal">
      <div className="bg-white border-2 border-[#0B2240] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="bg-[#0B2240] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#F26522]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base tracking-wide">
              Histórico Completo de Prompts e Especificações do Projeto
            </span>
            <span className="bg-[#F26522] text-white text-[11px] font-bold px-2 py-0.5">
              {prompts.length} Registros
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-[#F26522] font-bold text-sm cursor-pointer bg-transparent border-none"
          >
            [ Fechar ]
          </button>
        </div>

        {/* Global Batch Download Toolbar */}
        <div className="bg-[#071726] border-b border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-300 font-medium">
            Opções de Download em Lote (Todos os {prompts.length} Prompts):
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAllText}
              className="bg-[#F26522] hover:bg-orange-600 text-white font-bold px-3 py-1.5 cursor-pointer border-none flex items-center gap-1.5 transition-colors shadow-sm"
              title="Baixar arquivo TXT com todos os prompts compilados"
            >
              <span>Baixar Todos (.TXT)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadAllJson}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 cursor-pointer border-none flex items-center gap-1.5 transition-colors"
              title="Baixar arquivo JSON com todos os prompts estruturados"
            >
              <span>Baixar Todos (.JSON)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium px-3 py-1.5 cursor-pointer border border-slate-600 transition-colors"
              title="Copiar texto compilado de todos os prompts"
            >
              <span>Copiar Todos</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Bar */}
        {copyStatus && (
          <div className="bg-emerald-100 border-b border-emerald-300 px-4 py-2 text-emerald-900 font-semibold text-xs flex items-center justify-between">
            <span>✓ {copyStatus}</span>
            <button
              type="button"
              onClick={() => setCopyStatus(null)}
              className="text-emerald-900 font-bold hover:underline cursor-pointer bg-transparent border-none"
            >
              [ Fechar ]
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 text-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* List of prompts */}
            <div className="border border-slate-300 p-2.5 bg-slate-50 flex flex-col">
              <div className="font-bold text-slate-900 pb-2 mb-2 border-b border-slate-300 flex justify-between items-center">
                <span>Lista de Prompts ({prompts.length})</span>
              </div>

              {/* Search box */}
              <div className="mb-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filtrar por texto..."
                  className="w-full px-2 py-1 border border-slate-300 bg-white text-xs focus:outline-none focus:border-[#0B2240]"
                />
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {filteredPrompts.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPromptId(p.id)}
                    className={`w-full text-left p-2 text-xs border cursor-pointer transition-colors ${
                      selectedPrompt?.id === p.id
                        ? 'bg-[#0B2240] text-white border-[#0B2240] font-semibold'
                        : 'bg-white text-slate-800 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.2 ${
                        selectedPrompt?.id === p.id ? 'bg-[#F26522] text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className={`text-[10px] ${selectedPrompt?.id === p.id ? 'text-slate-300' : 'text-slate-500'}`}>
                        {p.timestamp}
                      </span>
                    </div>
                    <div className="line-clamp-2 font-medium leading-tight">{p.title}</div>
                  </button>
                ))}

                {filteredPrompts.length === 0 && (
                  <div className="text-slate-400 p-3 text-center">Nenhum prompt encontrado.</div>
                )}
              </div>
            </div>

            {/* Prompt Viewer */}
            <div className="md:col-span-2 border border-slate-300 p-3 bg-white flex flex-col">
              {selectedPrompt ? (
                <>
                  <div className="flex flex-wrap justify-between items-center gap-2 pb-2 mb-2 border-b border-slate-200">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{selectedPrompt.title}</div>
                      <div className="text-[11px] text-slate-500">
                        Registrado em: {selectedPrompt.timestamp} | ID: <span className="font-mono">{selectedPrompt.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedPrompt.content)}
                        className="px-2.5 py-1 bg-[#0B2240] hover:bg-[#F26522] text-white text-xs font-semibold cursor-pointer border-none transition-colors"
                      >
                        Copiar Este
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(selectedPrompt)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer border border-slate-300 transition-colors"
                        title="Baixar este prompt individual em arquivo TXT"
                      >
                        Baixar TXT
                      </button>
                    </div>
                  </div>

                  <pre className="p-3 bg-slate-50 border border-slate-200 text-slate-900 text-xs whitespace-pre-wrap font-mono overflow-y-auto max-h-72 leading-relaxed selection:bg-[#F26522] selection:text-white">
                    {selectedPrompt.content}
                  </pre>
                </>
              ) : (
                <div className="text-slate-400 p-4">Nenhum prompt selecionado.</div>
              )}
            </div>
          </div>

          {/* Add Next Prompt Section */}
          <div className="pt-3 border-t border-slate-300">
            <div className="font-bold text-slate-900 mb-1.5">
              Registrar Novo Prompt / Atualização de Requisito:
            </div>
            <form onSubmit={handleSaveNew} className="space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Título do Prompt / Assunto da Atualização (ex: Prompt 7 - Ajuste de Exportação)"
                className="w-full px-3 py-1.5 border border-slate-300 text-xs focus:outline-none focus:border-[#0B2240]"
              />
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="Cole aqui o conteúdo integral do novo prompt..."
                rows={3}
                className="w-full px-3 py-1.5 border border-slate-300 text-xs focus:outline-none focus:border-[#0B2240] font-mono"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#F26522] hover:bg-orange-600 text-white font-bold text-xs cursor-pointer border-none transition-colors"
                >
                  Salvar Prompt no Registro
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 text-slate-600 text-xs">
          <span>Exed Consulting VMO - Registro técnico persistido no navegador</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAllText}
              className="text-[#0B2240] hover:text-[#F26522] font-semibold underline cursor-pointer bg-transparent border-none"
            >
              [ Baixar Todos .TXT ]
            </button>
            <button
              type="button"
              onClick={handleDownloadAllJson}
              className="text-[#0B2240] hover:text-[#F26522] font-semibold underline cursor-pointer bg-transparent border-none"
            >
              [ Baixar Todos .JSON ]
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1 bg-slate-300 hover:bg-slate-400 text-slate-800 font-semibold cursor-pointer border-none ml-2"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
