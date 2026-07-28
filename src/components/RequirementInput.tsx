import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  BookOpen,
  Settings2,
  CheckSquare,
  Square,
  Shield,
  Zap,
  HelpCircle,
  Code,
  FileSpreadsheet,
} from 'lucide-react';
import { GenerationConfig, SampleRequirementDoc } from '../types';
import { SAMPLE_REQUIREMENT_DOCS } from '../data/sampleRequirements';

interface RequirementInputProps {
  requirementText: string;
  onChangeRequirementText: (text: string) => void;
  config: GenerationConfig;
  onChangeConfig: (config: GenerationConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  activeTemplateName: string;
  onOpenTemplateModal: () => void;
}

export const RequirementInput: React.FC<RequirementInputProps> = ({
  requirementText,
  onChangeRequirementText,
  config,
  onChangeConfig,
  onGenerate,
  isGenerating,
  activeTemplateName,
  onOpenTemplateModal,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'sample' | 'file'>('paste');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSelectSample = (sample: SampleRequirementDoc) => {
    onChangeRequirementText(sample.content);
    setActiveTab('paste');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onChangeRequirementText(content);
        setActiveTab('paste');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 text-slate-200">
      {/* Input Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white">1. Gereksinim Dökümanı (SRS / User Story)</h2>
            <p className="text-xs text-slate-400">
              Analiz edilecek iş gereksinimlerini metin olarak yapıştırın veya örnek döküman seçin.
            </p>
          </div>
        </div>

        {/* Input Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs font-medium border border-slate-700/60">
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Metin / Döküman</span>
          </button>

          <button
            onClick={() => setActiveTab('sample')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'sample'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Örnek Gereksinim Dökümanları</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'file'
                ? 'bg-indigo-600 text-white font-semibold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Dosya Yükle</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'paste' && (
        <div className="space-y-3">
          <textarea
            value={requirementText}
            onChange={(e) => onChangeRequirementText(e.target.value)}
            placeholder="Gereksinim dökümanını buraya yapıştırın veya yazın... (Örn: [REQ-01] Kullanıcı parola sıfırlama talebinde bulunduğunda SMS OTP kodu gönderilmelidir...)"
            rows={8}
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Karakter sayısı: <strong className="text-slate-200">{requirementText.length}</strong>
            </span>
            <span className="text-indigo-400">
              💡 İpucu: REQ-01, REQ-02 gibi kodlar kullanırsanız izlenebilirlik matrisi otomatik eşleşir.
            </span>
          </div>
        </div>
      )}

      {activeTab === 'sample' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_REQUIREMENT_DOCS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className="p-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/80 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <span className="text-[10px] uppercase font-mono font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md inline-block mb-2">
                  {sample.category}
                </span>
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors mb-1">
                  {sample.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-3">{sample.description}</p>
              </div>
              <button className="mt-3 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                <span>Bu Dökümanı Kullan</span>
                <span>→</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'file' && (
        <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/40 rounded-xl p-8 text-center transition-colors">
          <input
            type="file"
            accept=".txt,.md,.json,.csv,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
            id="req-file-upload"
          />
          <label htmlFor="req-file-upload" className="cursor-pointer flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Gereksinim Dökümanı Dosyası Yükleyin</p>
              <p className="text-xs text-slate-400 mt-1">.TXT, .MD, .JSON veya metin dökümanları desteklenmektedir.</p>
            </div>
          </label>
        </div>
      )}

      {/* Generation Parameters & Options */}
      <div className="mt-5 border-t border-slate-800 pt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Test Kapsamı & Tiptleri:
            </span>

            {/* Test Type Toggles */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-200 select-none bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <input
                type="checkbox"
                checked={config.includeBoundary}
                onChange={(e) => onChangeConfig({ ...config, includeBoundary: e.target.checked })}
                className="accent-indigo-500 w-3.5 h-3.5 rounded"
              />
              <span>Sınır Değer Analizi (Boundary Value)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-200 select-none bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <input
                type="checkbox"
                checked={config.includeSecurity}
                onChange={(e) => onChangeConfig({ ...config, includeSecurity: e.target.checked })}
                className="accent-indigo-500 w-3.5 h-3.5 rounded"
              />
              <span>Güvenlik & Yetki Kontrolleri</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-200 select-none bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
              <input
                type="checkbox"
                checked={config.includePerformance}
                onChange={(e) => onChangeConfig({ ...config, includePerformance: e.target.checked })}
                className="accent-indigo-500 w-3.5 h-3.5 rounded"
              />
              <span>Performans & Zaman Aşımı</span>
            </label>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Gelişmiş Seçenekleri Gizle' : 'Özel Yönergeler & Şablon'}</span>
          </button>
        </div>

        {/* Advanced Area */}
        {showAdvanced && (
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3 text-xs animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Çıktı Excel Şablonu: <strong className="text-emerald-300">{activeTemplateName}</strong></span>
              </div>
              <button
                onClick={onOpenTemplateModal}
                className="text-xs font-semibold text-indigo-400 hover:underline"
              >
                Şablon Sütunlarını Değiştir
              </button>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Özel AI Test Talimatı (Prompt Guidance):
              </label>
              <input
                type="text"
                value={config.customInstructions || ''}
                onChange={(e) => onChangeConfig({ ...config, customInstructions: e.target.value })}
                placeholder="Örn: 'Tüm test adımlarına HTTP 200/400 status kodlarını ekle', 'Luhn algoritması testlerini detaylandır'..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div className="pt-2 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tüm test adımları ve beklenen sonuçlar ISTQB standartlarına uygundur.</span>
          </div>

          <button
            onClick={onGenerate}
            disabled={isGenerating || !requirementText.trim()}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all transform ${
              isGenerating || !requirementText.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>AI Gereksinimleri Analiz Ediyor...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Otomatik Test Case'leri Üret</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
