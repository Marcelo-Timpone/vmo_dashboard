import React from 'react';
import { ExedLogo } from './ExedLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#071726] text-white border-t border-slate-800 px-4 py-2.5 mt-auto no-print">
      <div className="w-full flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <ExedLogo variant="white" size="sm" />
          <span className="text-slate-600">|</span>
          <span className="font-bold tracking-wider text-slate-300 uppercase text-[11px]">
            VMO Corporativo
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span className="text-[#F26522] font-semibold text-[11px]">Exed Consulting © 2026</span>
        </div>
      </div>
    </footer>
  );
};
