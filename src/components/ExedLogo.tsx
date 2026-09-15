import React from 'react';

interface ExedLogoProps {
  variant?: 'dark' | 'white' | 'orange';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  onlyIcon?: boolean;
}

export const ExedLogo: React.FC<ExedLogoProps> = ({
  variant = 'dark',
  size = 'md',
  showSubtitle = false,
  onlyIcon = false
}) => {
  const isWhite = variant === 'white';
  const logoSrc = isWhite ? '/exed-logo-white.svg' : '/exed-logo-dark.svg';
  const heightPx = size === 'sm' ? 24 : size === 'lg' ? 38 : size === 'xl' ? 48 : 30;

  if (onlyIcon) {
    return (
      <img
        src="/favicon.svg"
        alt="Exed Logo Icon"
        style={{ height: `${heightPx}px`, width: 'auto' }}
        className="inline-block select-none"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="inline-flex items-center gap-2 select-none" id="exed-logo-container">
      <img
        src={logoSrc}
        alt="Exed Consulting"
        style={{ height: `${heightPx}px`, width: 'auto' }}
        className="h-auto max-w-full block"
        referrerPolicy="no-referrer"
      />
      {showSubtitle && (
        <span
          className={`text-xs uppercase tracking-wider font-bold ${
            isWhite ? 'text-exed-accent' : 'text-exed-accent'
          }`}
        >
          VMO
        </span>
      )}
    </div>
  );
};
