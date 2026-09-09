import React, { useState } from 'react';
import { ExedLogo } from './ExedLogo';
import { UserRole, UserSession } from '../types';

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRoleLogin = (role: UserRole) => {
    const defaultUser = role === 'pmo' ? 'PMO@exedconsulting.com' : 'demonstrativo@exedconsulting.com';
    const session: UserSession = {
      username: username.trim() || defaultUser,
      role,
      token: `vmo_jwt_${role}_${Date.now()}_signed_exed`,
      loginTime: new Date().toLocaleTimeString('pt-BR'),
      expiresInMinutes: 60
    };
    onLogin(session);
  };

  return (
    <div className="min-h-screen w-full bg-[#050E1A] flex flex-col justify-between items-center px-4 py-8 select-none">
      {/* Top Bar with Brandmark */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <ExedLogo variant="white" size="sm" />
          <span className="text-slate-600">|</span>
          <span className="font-semibold text-slate-300">VMO Corporativo</span>
        </div>
      </div>

      {/* Main Login Card - Corporate Neon */}
      <div className="w-full max-w-md my-auto bg-[#091B2E] border border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
        {/* Card Header */}
        <div className="bg-[#071726] px-6 py-6 text-center border-b-2 border-[#F26522] shadow-[0_2px_15px_rgba(242,101,34,0.15)]">
          <div className="flex justify-center mb-3">
            <ExedLogo variant="white" size="lg" />
          </div>
          <h1 className="text-white font-bold tracking-wider text-sm sm:text-base uppercase m-0">
            PORTAL EXECUTIVO VMO CORPORATIVO
          </h1>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-7 space-y-4 text-xs">
          {/* User field */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              Usuário Corporativo
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[#050F1A] border border-slate-700 text-slate-100 focus:outline-none focus:border-[#F26522] text-xs transition-colors shadow-inner"
              placeholder=""
            />
          </div>

          {/* Password field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-slate-300 font-bold">
                Senha de Acesso
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-[#F26522] hover:text-orange-400 font-semibold cursor-pointer underline bg-transparent border-none transition-colors"
              >
                {showPassword ? 'Ocultar senha' : 'Ver senha'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#050F1A] border border-slate-700 text-slate-100 focus:outline-none focus:border-[#F26522] text-xs transition-colors shadow-inner"
              placeholder=""
            />
          </div>

          {/* Action Buttons: Strict Roles */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={() => handleRoleLogin('pmo')}
              className="w-full py-3 bg-[#F26522] hover:bg-orange-600 text-white font-bold tracking-wider uppercase text-xs cursor-pointer border-none transition-all shadow-[0_0_15px_rgba(242,101,34,0.3)] text-center"
            >
              Entrar como Perfil PMO
            </button>

            <button
              type="button"
              onClick={() => handleRoleLogin('demonstrativo')}
              className="w-full py-2.5 bg-[#0C2440] hover:bg-[#123660] text-slate-200 hover:text-white font-bold tracking-wider uppercase text-xs cursor-pointer border border-slate-700 transition-colors text-center"
            >
              Entrar como Perfil Demonstrativo
            </button>
          </div>
        </div>
      </div>

      {/* Clean Footer on Login Page */}
      <div className="text-slate-500 text-xs text-center mt-6">
        <span>Exed Consulting © 2026 — VMO Corporativo</span>
      </div>
    </div>
  );
};
