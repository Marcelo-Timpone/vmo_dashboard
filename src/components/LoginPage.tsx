import React, { useState } from 'react';
import { ExedLogo } from './ExedLogo';
import { UserSession } from '../types';
import { loginRequest } from '../services/authService';

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!username.trim() || !password) {
      setErrorMessage('Informe usuário e senha.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await loginRequest(username.trim(), password);

    setIsSubmitting(false);

    if (!result.success || !result.token || !result.user) {
      setErrorMessage(result.error || 'Usuário ou senha inválidos.');
      return;
    }

    const session: UserSession = {
      username: result.user.username,
      role: result.user.role,
      token: result.token,
      loginTime: new Date().toLocaleTimeString('pt-BR'),
      expiresInMinutes: 8 * 60,
      userId: result.user.id,
      name: result.user.name
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md my-auto bg-[#091B2E] border border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
      >
        {/* Card Header */}
        <div className="bg-[#071726] px-6 py-6 text-center border-b-2 border-exed-accent shadow-[0_2px_15px_var(--exed-accent-glow-soft)]">
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
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[#050F1A] border border-slate-700 text-slate-100 focus:outline-none focus:border-exed-accent text-xs transition-colors shadow-inner"
              placeholder="seu.usuario@exedconsulting.com"
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
                className="text-xs text-exed-accent hover:text-exed-accent-strong font-semibold cursor-pointer underline bg-transparent border-none transition-colors"
              >
                {showPassword ? 'Ocultar senha' : 'Ver senha'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#050F1A] border border-slate-700 text-slate-100 focus:outline-none focus:border-exed-accent text-xs transition-colors shadow-inner"
              placeholder=""
            />
          </div>

          {errorMessage && (
            <div className="px-3 py-2 bg-red-950/50 border border-red-800 text-red-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-exed-accent hover:bg-exed-accent-strong disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold tracking-wider uppercase text-xs cursor-pointer border-none transition-all shadow-[0_0_15px_var(--exed-accent-glow)] text-center"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </div>
      </form>

      {/* Clean Footer on Login Page */}
      <div className="text-slate-500 text-xs text-center mt-6">
        <span>Exed Consulting © 2026 — VMO Corporativo</span>
      </div>
    </div>
  );
};
