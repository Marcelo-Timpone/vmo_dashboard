import React, { useState } from 'react';

interface ClientLogoProps {
  clientName: string;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'neon' | 'light' | 'dark-solid';
}

// Fallback initial generator
export const getClientInitials = (name: string): string => {
  if (!name) return 'EX';
  const clean = name.replace(/grupo|cia|s\/a|ltda|e|&/gi, '').trim();
  const parts = clean.split(' ').filter(w => w.length > 1);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const ClientLogo: React.FC<ClientLogoProps> = ({
  clientName,
  logoUrl,
  size = 'sm',
  className = '',
  theme = 'neon'
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-5 h-5 min-w-5 min-h-5 text-[9px]',
    sm: 'w-6 h-6 min-w-6 min-h-6 text-[10px]',
    md: 'w-7 h-7 min-w-7 min-h-7 text-[11px]',
    lg: 'w-9 h-9 min-w-9 min-h-9 text-xs'
  };

  const isLight = theme === 'light';

  // If a logoUrl exists and hasn't failed, render the crisp small PNG logo
  if (logoUrl && !imageError) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-sm overflow-hidden shrink-0 border transition-all ${
          sizeClasses[size]
        } ${
          isLight
            ? 'bg-white border-slate-300 shadow-xs'
            : 'bg-[#081726] border-[#1C3B60] shadow-xs'
        } ${className}`}
        title={`Logo de ${clientName}`}
      >
        <img
          src={logoUrl}
          alt={`Logo ${clientName}`}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Graceful fallback: Stylized monogram box
  return (
    <div
      className={`inline-flex items-center justify-center font-bold font-mono rounded-sm shrink-0 border select-none ${
        sizeClasses[size]
      } ${
        isLight
          ? 'bg-slate-100 text-[#0088CC] border-slate-300'
          : 'bg-[#091D33] text-[#00D2FF] border-[#1B406A]'
      } ${className}`}
      title={clientName}
    >
      {getClientInitials(clientName)}
    </div>
  );
};
