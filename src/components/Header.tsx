import React from 'react';
import { FileSpreadsheet, Sparkles, Download, RefreshCw, Globe, LogOut, User, Cloud, CloudCheck, BookOpen } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  templateName: string;
  onOpenTemplateModal: () => void;
  onOpenJiraModal: () => void;
  onOpenGuideModal?: () => void;
  onExportExcel: () => void;
  onReset: () => void;
  hasTestCases: boolean;
  language: 'tr' | 'en';
  onToggleLanguage: () => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  isCloudSynced?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  templateName,
  onOpenTemplateModal,
  onOpenJiraModal,
  onOpenGuideModal,
  onExportExcel,
  onReset,
  hasTestCases,
  language,
  onToggleLanguage,
  currentUser,
  onLogout,
  isCloudSynced = true,
}) => {
  return (
    <header className="bg-[#0D1117] border-b border-white/10 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-100 tracking-tight">TestMatrix AI</h1>
              <span className="bg-blue-500/20 text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-md border border-blue-500/30">
                QA Engineering Tool
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {language === 'tr'
                ? 'Gereksinim Dökümanından Otomatik Test Case & RTM'
                : 'Automated Test Case & RTM from SRS / PRD'}
            </p>
          </div>
        </div>

        {/* Center / Template Indicator */}
        <button
          onClick={onOpenTemplateModal}
          className="hidden lg:flex items-center gap-2 bg-[#0A0C10] hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 text-xs transition-colors"
          title={language === 'tr' ? 'Şablon Sütun Yapısını Değiştir / Excel Yükle' : 'Configure Export Excel Template'}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>{language === 'tr' ? 'Şablon:' : 'Template:'} <strong className="text-emerald-300">{templateName}</strong></span>
          <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">
            {language === 'tr' ? 'Düzenle' : 'Edit'}
          </span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Database Sync Status */}
          <div
            className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-xl text-[11px] font-medium"
            title={
              language === 'tr'
                ? 'Firebase Firestore Bulut Veri Tabanı Aktif ve Senkronize'
                : 'Firebase Firestore Cloud DB Synced'
            }
          >
            <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 font-semibold hidden md:inline">
              {language === 'tr' ? 'Firebase Bulut' : 'Firebase Cloud'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* User Profile Badge */}
          {currentUser && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 pl-2 pr-1.5 py-1 rounded-xl">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-lg" />
                ) : (
                  (currentUser.name || currentUser.email).charAt(0).toUpperCase()
                )}
              </div>
              <div className="hidden sm:block text-left text-[11px] leading-tight">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="truncate max-w-[140px]">
                    {currentUser.name && currentUser.name !== 'Google Kullanıcısı'
                      ? currentUser.name
                      : currentUser.email}
                  </span>
                  {currentUser.provider === 'google' && (
                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1 rounded font-mono shrink-0">
                      Google
                    </span>
                  )}
                </p>
                <p className="text-slate-400 text-[10px] truncate max-w-[150px]" title={currentUser.email}>
                  {currentUser.email}
                </p>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors ml-1 shrink-0"
                  title={language === 'tr' ? 'Oturumu Kapat' : 'Sign Out'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Kullanıcı Kılavuzu (User Guide) Button */}
          {onOpenGuideModal && (
            <button
              onClick={onOpenGuideModal}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 transition-colors"
              title={language === 'tr' ? 'Kullanıcı Kılavuzu ve Yardım' : 'User Manual & Guide'}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{language === 'tr' ? 'Kılavuz' : 'User Guide'}</span>
            </button>
          )}

          {/* Jira Integration Button */}
          <button
            onClick={onOpenJiraModal}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-colors"
            title="Atlassian Jira Entegrasyon Ayarları"
          >
            <span className="font-bold font-mono bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
              J
            </span>
            <span className="hidden sm:inline">Jira</span>
          </button>

          {/* Language toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#0A0C10] hover:bg-slate-800 text-slate-200 border border-indigo-500/30 hover:border-indigo-400 transition-colors shadow-sm"
            title={
              language === 'tr'
                ? 'Üretim Dili: Türkçe (İngilizce yapmak için tıklayın)'
                : 'Generation Language: English (Click for Turkish)'
            }
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>{language === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}</span>
          </button>

          {/* Temizle (Reset) Button - Always Visible */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-500/40 transition-colors"
            title={
              language === 'tr'
                ? 'Gereksinim metni ve üretilmiş tüm test verilerini temizle'
                : 'Clear requirement text and reset all data'
            }
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">{language === 'tr' ? 'Temizle' : 'Clear'}</span>
          </button>

          {hasTestCases && (
            <button
              onClick={onExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm px-3.5 py-1.5 rounded-lg shadow-md shadow-emerald-900/30 transition-all transform active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'tr' ? 'Excel İndir (.xlsx)' : 'Export Excel (.xlsx)'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};


