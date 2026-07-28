import React from 'react';
import { FileSpreadsheet, Sparkles, ShieldCheck, Download, RefreshCw, FileText } from 'lucide-react';

interface HeaderProps {
  templateName: string;
  onOpenTemplateModal: () => void;
  onOpenJiraModal: () => void;
  onExportExcel: () => void;
  onReset: () => void;
  hasTestCases: boolean;
  language: 'tr' | 'en';
  onToggleLanguage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  templateName,
  onOpenTemplateModal,
  onOpenJiraModal,
  onExportExcel,
  onReset,
  hasTestCases,
  language,
  onToggleLanguage,
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
              Gereksinim Dökümanından Otomatik Test Case & RTM Jeneratörü
            </p>
          </div>
        </div>

        {/* Center / Template Indicator */}
        <button
          onClick={onOpenTemplateModal}
          className="hidden md:flex items-center gap-2 bg-[#0A0C10] hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 text-xs transition-colors"
          title="Şablon Sütun Yapısını Değiştir / Excel Yükle"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Şablon: <strong className="text-emerald-300">{templateName}</strong></span>
          <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">Düzenle</span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Jira Integration Button */}
          <button
            onClick={onOpenJiraModal}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-colors"
            title="Atlassian Jira Entegrasyon Ayarları"
          >
            <span className="font-bold font-mono bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
              J
            </span>
            <span className="hidden sm:inline">Jira Entegrasyonu</span>
          </button>

          {/* Language toggle */}
          <button
            onClick={onToggleLanguage}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#0A0C10] hover:bg-slate-800 text-slate-300 border border-white/10 transition-colors"
            title="Dil Değiştir"
          >
            {language === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}
          </button>

          {hasTestCases && (
            <>
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Yeni Dökümandan Başla"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Temizle</span>
              </button>

              <button
                onClick={onExportExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm px-3.5 py-1.5 rounded-lg shadow-md shadow-emerald-900/30 transition-all transform active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Excel İndir (.xlsx)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

