import React, { useState } from 'react';
import { MonthlyKpiSnapshot } from '../types';

interface MonthlyHistoryConfigSectionProps {
  monthlyHistory: MonthlyKpiSnapshot[];
  onUpdateMonthlyHistory: (history: MonthlyKpiSnapshot[]) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const emptyForm = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  revenueBilled: 0,
  marginAvg: 0
};

export const MonthlyHistoryConfigSection: React.FC<MonthlyHistoryConfigSectionProps> = ({
  monthlyHistory,
  onUpdateMonthlyHistory
}) => {
  const [form, setForm] = useState(emptyForm);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sorted = [...monthlyHistory].sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const showFeedback = (text: string) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const monthKey = `${form.year}-${String(form.month).padStart(2, '0')}`;
    const entry: MonthlyKpiSnapshot = {
      monthKey,
      year: form.year,
      month: form.month,
      revenueBilled: Number(form.revenueBilled) || 0,
      marginAvg: Number(form.marginAvg) || 0
    };

    const withoutThisMonth = monthlyHistory.filter(h => h.monthKey !== monthKey);
    onUpdateMonthlyHistory([...withoutThisMonth, entry]);
    showFeedback(
      editingKey
        ? `Mês ${MONTH_NAMES[form.month - 1]}/${form.year} atualizado.`
        : `Mês ${MONTH_NAMES[form.month - 1]}/${form.year} adicionado.`
    );
    setForm(emptyForm);
    setEditingKey(null);
  };

  const startEdit = (entry: MonthlyKpiSnapshot) => {
    setEditingKey(entry.monthKey);
    setForm({
      year: entry.year,
      month: entry.month,
      revenueBilled: entry.revenueBilled,
      marginAvg: entry.marginAvg
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setForm(emptyForm);
  };

  const handleDelete = (monthKey: string) => {
    onUpdateMonthlyHistory(monthlyHistory.filter(h => h.monthKey !== monthKey));
    showFeedback('Mês removido do histórico.');
    if (editingKey === monthKey) cancelEdit();
  };

  return (
    <div className="bg-white border border-slate-300 p-4 space-y-4" id="monthly-history-config-panel">
      <div className="p-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200">
        Indicadores agregados por mês (faturamento total e margem média), usados
        pelos gráficos comparativos do dashboard (meta de receita e evolução de
        margem). Normalmente preenchido pela migração automática — use esta
        tela para corrigir um mês ou preencher manualmente quando necessário.
      </div>

      {feedback && (
        <div className="p-2.5 text-xs font-semibold border bg-green-50 border-green-300 text-green-800">
          {feedback}
        </div>
      )}

      <form onSubmit={handleSave} className="border border-slate-200 p-3 space-y-2.5 bg-slate-50">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          {editingKey ? `Editando ${MONTH_NAMES[form.month - 1]}/${form.year}` : 'Adicionar / Corrigir Mês'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mês</label>
            <select
              value={form.month}
              onChange={e => setForm(prev => ({ ...prev, month: Number(e.target.value) }))}
              disabled={!!editingKey}
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs bg-white disabled:bg-slate-100"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ano</label>
            <input
              type="number"
              value={form.year}
              disabled={!!editingKey}
              onChange={e => setForm(prev => ({ ...prev, year: Number(e.target.value) }))}
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Faturamento do Mês (R$)</label>
            <input
              type="number"
              value={form.revenueBilled}
              onChange={e => setForm(prev => ({ ...prev, revenueBilled: Number(e.target.value) }))}
              placeholder="Ex: 1800000"
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Margem Média do Mês (%)</label>
            <input
              type="number"
              step="0.1"
              value={form.marginAvg}
              onChange={e => setForm(prev => ({ ...prev, marginAvg: Number(e.target.value) }))}
              placeholder="Ex: 24.5"
              className="w-full px-2.5 py-1.5 border border-slate-300 text-xs font-mono"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-[#F26522] hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wide cursor-pointer transition-colors"
          >
            {editingKey ? 'Salvar Alterações' : 'Adicionar Mês'}
          </button>
          {editingKey && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wide cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="border border-slate-200 divide-y divide-slate-200">
        {sorted.length === 0 && (
          <div className="p-3 text-xs text-slate-500">Nenhum mês migrado ainda.</div>
        )}
        {sorted.map(entry => (
          <div key={entry.monthKey} className="p-3 flex items-center justify-between gap-2 bg-white">
            <div>
              <span className="font-mono font-bold text-slate-800 text-xs">
                {MONTH_NAMES[entry.month - 1]}/{entry.year}
              </span>
              <span className="ml-3 text-[11px] text-slate-500">
                Faturamento: R$ {entry.revenueBilled.toLocaleString('pt-BR')} · Margem: {entry.marginAvg}%
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(entry)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase cursor-pointer border border-slate-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(entry.monthKey)}
                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold uppercase cursor-pointer border border-red-200"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
