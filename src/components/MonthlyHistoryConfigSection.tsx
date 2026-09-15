import React, { useState } from 'react';
import { MonthlyKpiSnapshot } from '../types';
import { MONTH_FULL } from '../utils/monthlyComparison';

interface MonthlyHistoryConfigSectionProps {
  monthlyHistory: MonthlyKpiSnapshot[];
  onUpdateMonthlyHistory: (history: MonthlyKpiSnapshot[]) => void;
}

const MONTH_NAMES = MONTH_FULL;

// ==============================================================================
// T4 — EDITOR DO HISTÓRICO MENSAL
// ==============================================================================
// Os campos são declarados como dados, não como JSX repetido: acrescentar um
// indicador novo é acrescentar uma linha nesta lista.
//
// `obrigatorio` marca os dois campos que sempre existiram. Todo o resto é
// opcional — e campo deixado em branco NÃO é gravado como zero, é gravado como
// ausente. O dashboard então mostra "—" em vez de fingir que o valor é zero.
// Essa distinção é o ponto central da tela: zero e "não sei" são coisas
// diferentes num relatório executivo.
// ==============================================================================
type CampoNumerico = {
  chave: keyof MonthlyKpiSnapshot;
  rotulo: string;
  placeholder: string;
  passo?: string;
  obrigatorio?: boolean;
  ajuda?: string;
};

const GRUPOS: Array<{ titulo: string; descricao: string; campos: CampoNumerico[] }> = [
  {
    titulo: 'One Page — cartões do mês',
    descricao: 'Alimentam os quatro cartões do topo, os sparklines e o gráfico de expansão.',
    campos: [
      {
        chave: 'revenueBilled',
        rotulo: 'Faturamento do mês (R$)',
        placeholder: 'Ex: 1800000',
        obrigatorio: true,
        ajuda: 'Faturamento DAQUELE mês, não acumulado.'
      },
      {
        chave: 'marginAvg',
        rotulo: 'Margem média do mês (%)',
        placeholder: 'Ex: 24.5',
        passo: '0.1',
        obrigatorio: true
      },
      { chave: 'totalSpend', rotulo: 'Gasto total do mês (R$)', placeholder: 'Ex: 1350000' },
      { chave: 'clientsServed', rotulo: 'Clientes atendidos', placeholder: 'Ex: 14' },
      { chave: 'goLivesCompleted', rotulo: 'Go-lives concluídos', placeholder: 'Ex: 2' },
      { chave: 'activeProjects', rotulo: 'Projetos ativos', placeholder: 'Ex: 23' }
    ]
  },
  {
    titulo: 'Pontos de Atenção',
    descricao: 'Comparativos da segunda página.',
    campos: [
      { chave: 'avgScheduleDelay', rotulo: 'Atraso médio de cronograma (%)', placeholder: 'Ex: 1.8', passo: '0.1' },
      { chave: 'signedDocsAvg', rotulo: 'Documentação assinada — média (%)', placeholder: 'Ex: 82.5', passo: '0.1' },
      { chave: 'detractorCount', rotulo: 'Projetos detratores', placeholder: 'Ex: 3' }
    ]
  },
  {
    titulo: 'Informações Gerais',
    descricao: 'Comparativos da terceira página.',
    campos: [
      { chave: 'almAdoptionPercent', rotulo: 'Adoção SAP Cloud ALM (%)', placeholder: 'Ex: 76', passo: '0.1' },
      { chave: 'openCrCount', rotulo: 'CRs em aberto (qtd.)', placeholder: 'Ex: 5' },
      { chave: 'openCrValue', rotulo: 'Valor das CRs em aberto (R$)', placeholder: 'Ex: 420000' },
      { chave: 'npsAvg', rotulo: 'NPS médio (0 a 10)', placeholder: 'Ex: 8.6', passo: '0.1' }
    ]
  },
  {
    titulo: 'Detalhamento Financeiro',
    descricao: 'Comparativos da quarta página.',
    campos: [
      { chave: 'plannedBudgetTotal', rotulo: 'Orçamento planejado total (R$)', placeholder: 'Ex: 9800000' },
      { chave: 'reimbursableTotal', rotulo: 'Gasto reembolsável total (R$)', placeholder: 'Ex: 240000' }
    ]
  }
];

const TODOS_OS_CAMPOS = GRUPOS.flatMap(g => g.campos);

type FormState = {
  year: number;
  month: number;
  // string vazia = campo não preenchido (≠ zero)
  valores: Record<string, string>;
};

function formVazio(): FormState {
  return {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    valores: Object.fromEntries(TODOS_OS_CAMPOS.map(c => [c.chave as string, '']))
  };
}

export const MonthlyHistoryConfigSection: React.FC<MonthlyHistoryConfigSectionProps> = ({
  monthlyHistory,
  onUpdateMonthlyHistory
}) => {
  const [form, setForm] = useState<FormState>(formVazio);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({
    'One Page — cartões do mês': true
  });

  const sorted = [...monthlyHistory].sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const showFeedback = (texto: string, erro = false) => {
    setFeedback({ texto, erro });
    setTimeout(() => setFeedback(null), 5000);
  };

  const setValor = (chave: string, valor: string) =>
    setForm(prev => ({ ...prev, valores: { ...prev.valores, [chave]: valor } }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const monthKey = `${form.year}-${String(form.month).padStart(2, '0')}`;

    const faltando = TODOS_OS_CAMPOS.filter(
      c => c.obrigatorio && (form.valores[c.chave as string] ?? '').trim() === ''
    );
    if (faltando.length > 0) {
      showFeedback(`Preencha: ${faltando.map(c => c.rotulo).join(', ')}.`, true);
      return;
    }

    const entry: MonthlyKpiSnapshot = {
      monthKey,
      year: form.year,
      month: form.month,
      revenueBilled: Number(form.valores.revenueBilled) || 0,
      marginAvg: Number(form.valores.marginAvg) || 0
    };

    // Campos opcionais em branco NÃO entram no objeto. É isso que preserva a
    // diferença entre "zero" e "sem dado" lá no dashboard.
    TODOS_OS_CAMPOS.filter(c => !c.obrigatorio).forEach(campo => {
      const bruto = form.valores[campo.chave as string];
      if (bruto !== undefined && bruto.trim() !== '' && Number.isFinite(Number(bruto))) {
        (entry as any)[campo.chave] = Number(bruto);
      }
    });

    // Preserva o detalhe por projeto gravado pela migração: esta tela não edita
    // projectSnapshots, e sobrescrever o mês não pode apagá-los.
    const anterior = monthlyHistory.find(h => h.monthKey === monthKey);
    if (anterior?.projectSnapshots?.length) {
      entry.projectSnapshots = anterior.projectSnapshots;
    }

    const semEsteMes = monthlyHistory.filter(h => h.monthKey !== monthKey);
    onUpdateMonthlyHistory(
      [...semEsteMes, entry].sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    );
    showFeedback(
      editingKey
        ? `Mês ${MONTH_NAMES[form.month - 1]}/${form.year} atualizado.`
        : `Mês ${MONTH_NAMES[form.month - 1]}/${form.year} adicionado.`
    );
    setForm(formVazio());
    setEditingKey(null);
  };

  const startEdit = (entry: MonthlyKpiSnapshot) => {
    setEditingKey(entry.monthKey);
    setForm({
      year: entry.year,
      month: entry.month,
      valores: Object.fromEntries(
        TODOS_OS_CAMPOS.map(c => {
          const valor = entry[c.chave];
          return [c.chave as string, typeof valor === 'number' ? String(valor) : ''];
        })
      )
    });
    setGruposAbertos(Object.fromEntries(GRUPOS.map(g => [g.titulo, true])));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setForm(formVazio());
  };

  const handleDelete = (monthKey: string) => {
    onUpdateMonthlyHistory(monthlyHistory.filter(h => h.monthKey !== monthKey));
    showFeedback('Mês removido do histórico.');
    if (editingKey === monthKey) cancelEdit();
  };

  const contarPreenchidos = (entry: MonthlyKpiSnapshot) =>
    TODOS_OS_CAMPOS.filter(c => typeof entry[c.chave] === 'number').length;

  return (
    <div className="bg-white border border-slate-300 p-4 space-y-4" id="monthly-history-config-panel">
      <div className="p-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 space-y-1.5">
        <p>
          Indicadores agregados por mês, usados por todos os comparativos "vs mês anterior" das
          quatro páginas do dashboard. Normalmente preenchido pela migração automática — use esta
          tela para corrigir um mês ou preencher manualmente quando necessário.
        </p>
        <p className="font-semibold text-slate-700">
          Campo deixado em branco não é gravado como zero: fica registrado como ausente, e o
          dashboard mostra "—" em vez de desenhar uma variação sem base. Só faturamento e margem
          são obrigatórios.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-2.5 text-xs font-semibold border ${
            feedback.erro
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-green-50 border-green-300 text-green-800'
          }`}
        >
          {feedback.texto}
        </div>
      )}

      <form onSubmit={handleSave} className="border border-slate-200 p-3 space-y-3 bg-slate-50">
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
        </div>

        {GRUPOS.map(grupo => {
          const aberto = gruposAbertos[grupo.titulo] ?? false;
          const preenchidos = grupo.campos.filter(
            c => (form.valores[c.chave as string] ?? '').trim() !== ''
          ).length;

          return (
            <div key={grupo.titulo} className="border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setGruposAbertos(prev => ({ ...prev, [grupo.titulo]: !aberto }))}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer bg-slate-100 hover:bg-slate-200 border-none"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    {grupo.titulo}
                  </span>
                  <span className="text-[10px] text-slate-500">{grupo.descricao}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-600 whitespace-nowrap">
                  {preenchidos}/{grupo.campos.length} {aberto ? '\u25B2' : '\u25BC'}
                </span>
              </button>

              {aberto && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3">
                  {grupo.campos.map(campo => (
                    <div key={campo.chave as string}>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {campo.rotulo}
                        {campo.obrigatorio && <span className="text-red-600 ml-0.5">*</span>}
                      </label>
                      <input
                        type="number"
                        step={campo.passo}
                        value={form.valores[campo.chave as string] ?? ''}
                        onChange={e => setValor(campo.chave as string, e.target.value)}
                        placeholder={campo.placeholder}
                        className="w-full px-2.5 py-1.5 border border-slate-300 text-xs font-mono"
                      />
                      {campo.ajuda && (
                        <span className="block text-[10px] text-slate-500 mt-0.5">{campo.ajuda}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-exed-accent hover:bg-exed-accent-strong text-white text-xs font-bold uppercase tracking-wide cursor-pointer transition-colors"
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
        {sorted.map(entry => {
          const preenchidos = contarPreenchidos(entry);
          const comProjetos = entry.projectSnapshots?.length ?? 0;

          return (
            <div key={entry.monthKey} className="p-3 flex items-center justify-between gap-2 bg-white">
              <div className="min-w-0">
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {MONTH_NAMES[entry.month - 1]}/{entry.year}
                </span>
                <span className="ml-3 text-[11px] text-slate-500">
                  Faturamento: R$ {entry.revenueBilled.toLocaleString('pt-BR')} &middot; Margem: {entry.marginAvg}%
                </span>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {preenchidos} de {TODOS_OS_CAMPOS.length} indicadores preenchidos
                  {comProjetos > 0 && ` \u00B7 ${comProjetos} projetos com detalhe histórico`}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
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
          );
        })}
      </div>
    </div>
  );
};
