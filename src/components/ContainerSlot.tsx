import React from 'react';
import { EyeOff } from 'lucide-react';
import { ContainerLayoutConfig } from '../types';

interface ContainerSlotProps {
  id: string;
  layout?: ContainerLayoutConfig[];
  isPmo: boolean;
  children: React.ReactNode;
}

/**
 * Envolve um contêiner de dashboard aplicando a ordem e a visibilidade
 * configuradas em Configurações > Layout do Dashboard.
 * - Usa a propriedade CSS `order`, então funciona tanto dentro de um
 *   `flex flex-col` quanto de um `grid` — não é necessário mover o JSX
 *   original de lugar.
 * - Quando oculto: usuários não-PMO simplesmente não veem o contêiner;
 *   usuários PMO continuam vendo (com um aviso), já que a regra é
 *   "oculto para todos, exceto PMO".
 */
export const ContainerSlot: React.FC<ContainerSlotProps> = ({ id, layout, isPmo, children }) => {
  const config = layout?.find(c => c.id === id);
  const order = config?.order ?? 0;
  const hidden = config?.hidden ?? false;

  if (hidden && !isPmo) return null;

  return (
    <div style={{ order }}>
      {hidden && isPmo && (
        <div className="mb-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-500 text-[10px] font-bold uppercase tracking-wide no-print">
          <EyeOff size={11} />
          Oculto para outros usuários — visível só para você (PMO)
        </div>
      )}
      {children}
    </div>
  );
};
