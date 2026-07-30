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
  CheckCircle2,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { parseExcelToRequirementText } from '../utils/excelHelper';
import {
  GenerationConfig,
  SampleRequirementDoc,
  FUNCTIONAL_TEST_TYPES,
  NON_FUNCTIONAL_TEST_TYPES,
} from '../types';
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

  // Selected ISTQB Test Techniques
  const selectedFunctional = config.selectedFunctionalTypes || [
    'Pozitif (Fonksiyonel Doğruluk)',
    'Negatif (Hata Yönetimi)',
    'Sınır Değer Analizi (BVA)',
  ];

  const selectedNonFunctional = config.selectedNonFunctionalTypes || [
    'Güvenlik ve Yetki Testi (Security)',
  ];

  const toggleFunctionalType = (type: string) => {
    const exists = selectedFunctional.includes(type);
    const updated = exists
      ? selectedFunctional.filter((t) => t !== type)
      : [...selectedFunctional, type];
    onChangeConfig({
      ...config,
      selectedFunctionalTypes: updated,
      includeBoundary: updated.some((t) => t.includes('Sınır') || t.includes('BVA')),
    });
  };

  const toggleNonFunctionalType = (type: string) => {
    const exists = selectedNonFunctional.includes(type);
    const updated = exists
      ? selectedNonFunctional.filter((t) => t !== type)
      : [...selectedNonFunctional, type];
    onChangeConfig({
      ...config,
      selectedNonFunctionalTypes: updated,
      includeSecurity: updated.some((t) => t.includes('Güvenlik') || t.includes('Security')),
      includePerformance: updated.some((t) => t.includes('Performans') || t.includes('Yük')),
      includeUsability: updated.some((t) => t.includes('Kullanılabilirlik') || t.includes('UX')),
      includeCompatibility: updated.some((t) => t.includes('Uyumluluk')),
      includeUAT: updated.some((t) => t.includes('Kullanıcı Kabul') || t.includes('UAT')),
      includeRegression: updated.some((t) => t.includes('Regresyon')),
    });
  };

  const selectAllFunctional = () => {
    onChangeConfig({
      ...config,
      selectedFunctionalTypes: [...FUNCTIONAL_TEST_TYPES],
      includeBoundary: true,
    });
  };

  const clearAllFunctional = () => {
    onChangeConfig({
      ...config,
      selectedFunctionalTypes: [],
      includeBoundary: false,
    });
  };

  const selectAllNonFunctional = () => {
    onChangeConfig({
      ...config,
      selectedNonFunctionalTypes: [...NON_FUNCTIONAL_TEST_TYPES],
      includeSecurity: true,
      includePerformance: true,
      includeUsability: true,
      includeCompatibility: true,
      includeUAT: true,
      includeRegression: true,
    });
  };

  const clearAllNonFunctional = () => {
    onChangeConfig({
      ...config,
      selectedNonFunctionalTypes: [],
      includeSecurity: false,
      includePerformance: false,
      includeUsability: false,
      includeCompatibility: false,
      includeUAT: false,
      includeRegression: false,
    });
  };

  const handleSelectSample = (sample: SampleRequirementDoc) => {
    onChangeRequirementText(sample.content);
    setActiveTab('paste');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const text = await parseExcelToRequirementText(file);
        if (text && text.trim()) {
          onChangeRequirementText(text);
          setActiveTab('paste');
        } else {
          alert('Excel dosyasında okunabilir metin bulunamadı.');
        }
      } catch (err: any) {
        alert('Excel dosyası okunurken hata oluştu: ' + (err?.message || 'Geçersiz dosya'));
      }
      return;
    }

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
            <h2 className="font-bold text-base text-white">1. Gereksinim Dökümanı (GTD / TD / SRS / User Story)</h2>
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
            accept=".xlsx,.xls,.txt,.md,.json,.csv,.doc,.docx"
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
              <p className="text-xs text-slate-400 mt-1">.XLSX, .XLS, .TXT, .MD, .JSON veya .CSV dökümanları desteklenmektedir.</p>
            </div>
          </label>
        </div>
      )}

      {/* Generation Parameters & Options */}
      <div className="mt-5 border-t border-slate-800 pt-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase text-white tracking-wider">
              ISTQB Standart Test Kapsamı & Seçilebilir Teknikler
            </h3>
          </div>
          <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
            ISTQB CTFL Standard
          </span>
        </div>

        {/* Two Category Columns: Fonksiyonel & Fonksiyonel Olmayan */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Section 1: Fonksiyonel Testler */}
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                  <span>Fonksiyonel Testler</span>
                  <span className="text-[10px] text-slate-500 font-normal">({selectedFunctional.length}/{FUNCTIONAL_TEST_TYPES.length})</span>
                </h4>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllFunctional}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  Tümünü Seç
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={clearAllFunctional}
                  className="text-slate-400 hover:text-slate-300 font-medium transition-colors"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {FUNCTIONAL_TEST_TYPES.map((type) => {
                const isSelected = selectedFunctional.includes(type);
                return (
                  <label
                    key={type}
                    onClick={() => toggleFunctionalType(type)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-sm shadow-emerald-950'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-emerald-500 mt-0.5 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className="leading-tight">{type}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Fonksiyonel Olmayan Testler */}
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                  <span>Fonksiyonel Olmayan Testler</span>
                  <span className="text-[10px] text-slate-500 font-normal">({selectedNonFunctional.length}/{NON_FUNCTIONAL_TEST_TYPES.length})</span>
                </h4>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAllNonFunctional}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  Tümünü Seç
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={clearAllNonFunctional}
                  className="text-slate-400 hover:text-slate-300 font-medium transition-colors"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {NON_FUNCTIONAL_TEST_TYPES.map((type) => {
                const isSelected = selectedNonFunctional.includes(type);
                return (
                  <label
                    key={type}
                    onClick={() => toggleNonFunctionalType(type)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-purple-500/10 border-purple-500/40 text-purple-200 shadow-sm shadow-purple-950'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-purple-500 mt-0.5 w-3.5 h-3.5 rounded cursor-pointer"
                    />
                    <span className="leading-tight">{type}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="text-slate-500">Test Case Üretim Dili:</span>
            <span className="text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md font-semibold">
              {config.language === 'tr' ? '🇹🇷 Türkçe (TR)' : '🇬🇧 English (EN)'}
            </span>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Gelişmiş Yönergeleri Gizle' : 'Özel Yönergeler (Prompt)'}</span>
          </button>
        </div>

        {/* Advanced Area - Only Custom AI Guidance */}
        {showAdvanced && (
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3 text-xs animate-in fade-in duration-150">
            <div>
              <label className="block text-slate-300 mb-1.5 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Özel AI Test Talimatı (Prompt Guidance):</span>
              </label>
              <input
                type="text"
                value={config.customInstructions || ''}
                onChange={(e) => onChangeConfig({ ...config, customInstructions: e.target.value })}
                placeholder="Örn: 'Tüm test adımlarına HTTP 200/400 status kodlarını ekle', 'Luhn algoritması testlerini detaylandır'..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                AI modellerinin test senaryolarını üretirken özellikle dikkat etmesini istediğiniz kuralları buraya yazabilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* Validation Warning when 0 techniques selected */}
        {selectedFunctional.length + selectedNonFunctional.length === 0 && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 font-medium animate-in fade-in duration-150">
            <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0" />
            <span>
              <strong>En az 1 test tekniği seçilmelidir:</strong> Test case'lerin neye göre üretileceğini belirlemek için lütfen yukarıdaki Fonksiyonel veya Fonksiyonel Olmayan Testler bölümünden en az bir teknik işaretleyin.
            </span>
          </div>
        )}

        {/* Primary Action Button */}
        <div className="pt-2 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tüm test adımları ve beklenen sonuçlar ISTQB standartlarına uygundur.</span>
          </div>

          <button
            onClick={() => {
              if (selectedFunctional.length + selectedNonFunctional.length === 0) {
                alert('Lütfen test case üretimi için en az bir test tekniği seçiniz! (Fonksiyonel veya Fonksiyonel Olmayan Testler bölümünden seçim yapabilirsiniz).');
                return;
              }
              onGenerate();
            }}
            disabled={isGenerating || !requirementText.trim() || selectedFunctional.length + selectedNonFunctional.length === 0}
            title={
              selectedFunctional.length + selectedNonFunctional.length === 0
                ? 'Test case üretimi için en az 1 test tekniği seçilmelidir'
                : undefined
            }
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all transform ${
              isGenerating || !requirementText.trim() || selectedFunctional.length + selectedNonFunctional.length === 0
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
