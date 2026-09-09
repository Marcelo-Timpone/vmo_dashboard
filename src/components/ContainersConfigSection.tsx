import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Save, CheckCircle2 } from 'lucide-react';
import { SapProjectFinancial, ContainerParamSettings } from '../types';

export type { ContainerParamSettings };


export const DEFAULT_CONTAINER_SETTINGS: ContainerParamSettings = {
  annualRevenueTarget: 120000000,
  contractMarginTarget: 24.0,
  topClientsLimit: 5,
  gaugeMinScale: 94.0,
  delayRedLimit: 2.0,
  detractorRevenueCutoff: 0,
  docsGreenLimit: 80,
  docsYellowLimit: 70,
  legacyNoticeText: 'Dados antigos não incluídos, controle interno agendado',
  almAdoptionTarget: 80,
  npsPromoterCutoff: 75,
  crHighValueAlert: 100000
};

interface ContainersConfigSectionProps {
  projects: SapProjectFinancial[];
  settings: ContainerParamSettings;
  onUpdateSettings: (newSettings: ContainerParamSettings) => void;
}

export const ContainersConfigSection: React.FC<ContainersConfigSectionProps> = ({
  projects,
  settings: propSettings,
  onUpdateSettings
}) => {
  const [settings, setSettings] = useState<ContainerParamSettings>(propSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSettings(propSettings);
  }, [propSettings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_CONTAINER_SETTINGS);
    onUpdateSettings(DEFAULT_CONTAINER_SETTINGS);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-4 select-text" id="pmo-containers-config-module">
      {/* Overview Banner */}
      <div className="bg-white border border-slate-300 p-4 text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-[#0B2240]" />
            <span className="font-bold text-sm text-[#0B2240] uppercase tracking-wide">
              Configurações Individuais dos Contêineres
            </span>
          </div>
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 size={13} />
                Parâmetros aplicados aos dashboards!
              </span>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer border border-slate-300 text-xs flex items-center gap-1 transition-colors"
              title="Restaura os valores padrões recomendados"
            >
              <RotateCcw size={12} />
              Restaurar Padrões
            </button>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE CONFIGURAÇÃO INDIVIDUAL DOS CONTÊINERES */}
      <form onSubmit={handleSave} className="bg-white border border-slate-300 p-4 text-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Grupo 1: Metas Financeiras (One Page) */}
          <div className="border border-slate-200 p-3 space-y-2.5 bg-slate-50">
            <div className="font-bold text-[#0B2240] text-xs uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>One Page: Metas</span>
              <span className="text-[10px] text-blue-600 font-bold">4 Contêineres</span>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Meta Anual de Receita (Burnup - R$)
              </label>
              <input
                type="number"
                value={settings.annualRevenueTarget}
                onChange={e => setSettings({ ...settings, annualRevenueTarget: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="1000000"
              />
              <span className="text-[10px] text-slate-500">Padrão: R$ 120.000.000 (R$ 120M)</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Meta Contratual de Margem Média (%)
              </label>
              <input
                type="number"
                value={settings.contractMarginTarget}
                onChange={e => setSettings({ ...settings, contractMarginTarget: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="0.1"
              />
              <span className="text-[10px] text-slate-500">Padrão: 24.0%</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Quantidade de Clientes no Ranking Top
              </label>
              <input
                type="number"
                value={settings.topClientsLimit}
                onChange={e => setSettings({ ...settings, topClientsLimit: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                min="3"
                max="15"
              />
              <span className="text-[10px] text-slate-500">Padrão: 5 clientes</span>
            </div>
          </div>

          {/* Grupo 2: Aderência & Prazos (Pontos de Atenção) */}
          <div className="border border-slate-200 p-3 space-y-2.5 bg-slate-50">
            <div className="font-bold text-[#0B2240] text-xs uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Pontos de Atenção: Prazos</span>
              <span className="text-[10px] text-amber-600 font-bold">Cronogramas</span>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Escala Mínima do Arco de Aderência (%)
              </label>
              <input
                type="number"
                value={settings.gaugeMinScale}
                onChange={e => setSettings({ ...settings, gaugeMinScale: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="0.5"
                min="80"
                max="98"
              />
              <span className="text-[10px] text-slate-500">Padrão: 94.0% (faixa de 94% a 100%)</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Limite de Atraso Crítico Vermelho (%)
              </label>
              <input
                type="number"
                value={settings.delayRedLimit}
                onChange={e => setSettings({ ...settings, delayRedLimit: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="0.1"
              />
              <span className="text-[10px] text-slate-500">Padrão: &ge; 2.0% em vermelho</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Corte Detratores de Receita (R$)
              </label>
              <input
                type="number"
                value={settings.detractorRevenueCutoff}
                onChange={e => setSettings({ ...settings, detractorRevenueCutoff: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="100000"
              />
              <span className="text-[10px] text-slate-500">0 = faturado menor que orçado</span>
            </div>
          </div>

          {/* Grupo 3: Documentação & Legados (Pontos de Atenção) */}
          <div className="border border-slate-200 p-3 space-y-2.5 bg-slate-50">
            <div className="font-bold text-[#0B2240] text-xs uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Pontos de Atenção: Docs</span>
              <span className="text-[10px] text-amber-600 font-bold">Governança</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Corte Verde (&gt; %)
                </label>
                <input
                  type="number"
                  value={settings.docsGreenLimit}
                  onChange={e => setSettings({ ...settings, docsGreenLimit: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                  Corte Amarelo (%)
                </label>
                <input
                  type="number"
                  value={settings.docsYellowLimit}
                  onChange={e => setSettings({ ...settings, docsYellowLimit: Number(e.target.value) })}
                  className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                  step="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Texto Padrão para Projetos Legados
              </label>
              <input
                type="text"
                value={settings.legacyNoticeText}
                onChange={e => setSettings({ ...settings, legacyNoticeText: e.target.value })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white text-slate-900"
              />
              <span className="text-[10px] text-slate-500">Exibido quando isLegacyDocs = true</span>
            </div>
          </div>

          {/* Grupo 4: Informações Gerais (Recursos, ALM & NPS) */}
          <div className="border border-slate-200 p-3 space-y-2.5 bg-slate-50">
            <div className="font-bold text-[#0B2240] text-xs uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Informações Gerais</span>
              <span className="text-[10px] text-emerald-600 font-bold">Operação</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Meta de Adoção SAP Cloud ALM (%)
              </label>
              <input
                type="number"
                value={settings.almAdoptionTarget}
                onChange={e => setSettings({ ...settings, almAdoptionTarget: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="5"
                min="0"
                max="100"
              />
              <span className="text-[10px] text-slate-500">Padrão: 80% dos projetos</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Corte de NPS Excelente / Promotor
              </label>
              <input
                type="number"
                value={settings.npsPromoterCutoff}
                onChange={e => setSettings({ ...settings, npsPromoterCutoff: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="5"
                min="50"
                max="100"
              />
              <span className="text-[10px] text-slate-500">Padrão: &ge; 75 pontos</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                Alerta de CRs de Alto Valor (R$)
              </label>
              <input
                type="number"
                value={settings.crHighValueAlert}
                onChange={e => setSettings({ ...settings, crHighValueAlert: Number(e.target.value) })}
                className="w-full p-1.5 border border-slate-300 text-xs bg-white font-mono text-slate-900"
                step="10000"
              />
              <span className="text-[10px] text-slate-500">Destaque de atenção para o PMO</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="submit"
            className="px-4 py-2 bg-[#0B2240] hover:bg-[#F26522] text-white font-bold cursor-pointer border-none text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Save size={13} />
            Salvar Parâmetros dos Contêineres (Afetar Dashboard)
          </button>
        </div>
      </form>
    </div>
  );
};
