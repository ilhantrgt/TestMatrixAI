import React from 'react';
import {
  Sparkles,
  Download,
  RefreshCw,
  Globe,
  LogOut,
  Settings,
  BookOpen,
} from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  onOpenSettingsModal: () => void;
  onOpenGuideModal?: () => void;
  onExportExcel: () => void;
  onReset: () => void;
  hasTestCases: boolean;
  language: 'tr' | 'en';
  onToggleLanguage: () => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  activeRulesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettingsModal,
  onOpenGuideModal,
  onExportExcel,
  onReset,
  hasTestCases,
  language,
  onToggleLanguage,
  currentUser,
  onLogout,
  activeRulesCount = 0,
}) => {
  const isEn = language === 'en';

  return (
    <header className="bg-[#0D1117] border-b border-white/10 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand Section */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base sm:text-lg text-slate-100 tracking-tight">
              TestMatrix
            </span>
            <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow-sm">
              AI
            </span>
          </div>
        </div>

        {/* Action Controls - Clean & Minimal */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Language Switcher */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            title={isEn ? 'Switch to Turkish' : 'İngilizceye Geç'}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isEn ? '🇬🇧 EN' : '🇹🇷 TR'}</span>
          </button>

          {/* User Guide Button */}
          {onOpenGuideModal && (
            <button
              onClick={onOpenGuideModal}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              title={isEn ? 'User Guide & Documentation' : 'Kullanıcı Kılavuzu & Bilgi'}
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">{isEn ? 'Guide' : 'Kılavuz'}</span>
            </button>
          )}

          {/* Unified Settings & Configuration Center Button */}
          <button
            onClick={onOpenSettingsModal}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors shadow-sm"
            title={
              isEn
                ? 'System Settings: Corporate Memory, Excel Template & Jira'
                : 'Sistem Ayarları: Kurumsal Hafıza, Excel Şablonu ve Jira'
            }
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isEn ? 'Settings' : 'Ayarlar'}</span>
            {activeRulesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title={`${activeRulesCount} active rules`} />
            )}
          </button>

          {/* Temizle (Reset) Button */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 px-2.5 py-1.5 rounded-xl hover:bg-rose-950/30 border border-slate-800 hover:border-rose-500/30 transition-colors"
            title={isEn ? 'Clear requirement and test data' : 'Metin ve üretilen tüm testleri temizle'}
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">{isEn ? 'Clear' : 'Temizle'}</span>
          </button>

          {/* Export Excel (When test cases available) */}
          {hasTestCases && (
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl shadow-md shadow-emerald-900/30 transition-all transform active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isEn ? 'Export Excel' : 'Excel İndir'}</span>
            </button>
          )}

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 pl-1.5 pr-1 py-1 rounded-xl ml-1">
              <div
                className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-[11px] shrink-0"
                title={currentUser.email}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-6 h-6 rounded-lg" />
                ) : (
                  (currentUser.name || currentUser.email).charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[11px] text-slate-300 font-medium truncate max-w-[90px] sm:max-w-[120px] hidden sm:inline">
                {currentUser.name && currentUser.name !== 'Google Kullanıcısı'
                  ? currentUser.name
                  : currentUser.email.split('@')[0]}
              </span>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                  title={isEn ? 'Sign Out' : 'Oturumu Kapat'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
