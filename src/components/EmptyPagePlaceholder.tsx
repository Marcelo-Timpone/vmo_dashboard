import React from 'react';
import { FilterSolutionType } from './LateralControls';
import { AlertCircle, FileText, BarChart3, Clock } from 'lucide-react';

interface EmptyPagePlaceholderProps {
  title: string;
  subtitle: string;
  pageType: 'pontos_atencao' | 'informacoes_gerais' | 'detalhamento_financeiro';
  selectedFilters: FilterSolutionType[];
}

export const EmptyPagePlaceholder: React.FC<EmptyPagePlaceholderProps> = ({
  title,
  subtitle,
  pageType,
  selectedFilters
}) => {
  const getIcon = () => {
    switch (pageType) {
      case 'pontos_atencao':
        return <AlertCircle size={28} className="text-[#FF3366]" />;
      case 'informacoes_gerais':
        return <FileText size={28} className="text-[#00D2FF]" />;
      case 'detalhamento_financeiro':
        return <BarChart3 size={28} className="text-[#00FF88]" />;
    }
  };

  return (
    <div className="w-full h-full max-w-[1600px] mx-auto flex flex-col justify-start gap-4 text-slate-100">
      {/* Page Title Header */}
      <div className="bg-[#0A1C30] border border-[#16385C] p-4 flex flex-wrap items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#071626] border border-slate-700">
            {getIcon()}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase m-0">
              {title}
            </h1>
            <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Filtro Ativo:</span>
          <span className="bg-[#071626] text-[#00D2FF] px-2.5 py-1 font-semibold border border-[#00D2FF]/30">
            {selectedFilters.join(', ')}
          </span>
        </div>
      </div>

      {/* Empty Slate Card waiting for user specifications */}
      <div className="flex-1 min-h-[380px] bg-[#0A1C30]/60 border border-[#16385C] p-8 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="w-14 h-14 bg-[#071626] border border-slate-700 flex items-center justify-center mb-4 text-slate-500 shadow-inner">
          <Clock size={28} className="text-exed-accent" />
        </div>
        <div className="text-sm font-bold text-white uppercase tracking-wider mb-1">
          {title}
        </div>
        <p className="text-xs text-slate-400 max-w-md m-0">
          Esta página está estruturada e pronta no webapp. Os módulos e indicadores serão preenchidos conforme as próximas diretrizes executivas do VMO Corporativo.
        </p>
      </div>
    </div>
  );
};
