import React, { useState, useMemo } from 'react';
import mammoth from 'mammoth';
import {
  FileText,
  Upload,
  Sparkles,
  BookOpen,
  Settings2,
  Shield,
  Layers,
  AlertTriangle,
  Eye,
  Edit3,
  Brain,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
  FileSpreadsheet,
  FileCode,
  FileType,
} from 'lucide-react';
import { parseExcelToRequirementText } from '../utils/excelHelper';
import { detectTablesAndStructures } from '../utils/tableParser';
import { DocumentVisualPreview } from './DocumentVisualPreview';
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
  onOpenCorporateMemoryModal?: () => void;
  activeCorporateRulesCount?: number;
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
  onOpenCorporateMemoryModal,
  activeCorporateRulesCount = 0,
}) => {
  const isEn = config.language === 'en';
  const [activeTab, setActiveTab] = useState<'paste' | 'visual_preview' | 'sample' | 'file'>('paste');
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [fileUploadInfo, setFileUploadInfo] = useState<{
    fileName: string;
    charCount: number;
    wordCount: number;
  } | null>(null);

  // Parse structured blocks (tables, bullets, headings) for live preview
  const parsedDocumentBlocks = useMemo(() => {
    return detectTablesAndStructures(requirementText);
  }, [requirementText]);

  const detectedTablesCount = useMemo(() => {
    return parsedDocumentBlocks.filter((b) => b.type === 'table').length;
  }, [parsedDocumentBlocks]);

  // Selected ISTQB Test Techniques
  const selectedFunctional = config.selectedFunctionalTypes || [
    'Pozitif (Fonksiyonel Doğruluk)',
    'Negatif (Hata Yönetimi)',
    'Sınır Değer Analizi (BVA)',
  ];

  const selectedNonFunctional = config.selectedNonFunctionalTypes || [
    'Güvenlik ve Yetki Testi (Security)',
  ];

  const totalSelectedTechniques = selectedFunctional.length + selectedNonFunctional.length;

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
    setFileUploadInfo(null);
    setActiveTab('paste');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    // 1. Excel files
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const text = await parseExcelToRequirementText(file);
        if (text && text.trim()) {
          const words = text.trim().split(/\s+/).length;
          onChangeRequirementText(text);
          setFileUploadInfo({ fileName: file.name, charCount: text.length, wordCount: words });
          setActiveTab('paste');
        } else {
          alert(isEn ? 'No readable text found in Excel file.' : 'Excel dosyasında okunabilir metin bulunamadı.');
        }
      } catch (err: any) {
        alert(isEn ? 'Error reading Excel file: ' + (err?.message || '') : 'Excel dosyası okunurken hata oluştu: ' + (err?.message || 'Geçersiz dosya'));
      }
      return;
    }

    // 2. Word documents (.docx / .doc)
    if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value || '';
        if (text && text.trim()) {
          const cleanText = text.trim();
          const words = cleanText.split(/\s+/).length;
          onChangeRequirementText(cleanText);
          setFileUploadInfo({ fileName: file.name, charCount: cleanText.length, wordCount: words });
          setActiveTab('paste');
        } else {
          alert(isEn ? 'Could not extract text from Word document.' : 'Word belgesinden metin ayıklanamadı. Belgenin boş veya şifreli olmadığından emin olun.');
        }
      } catch (err: any) {
        alert(isEn ? 'Error parsing Word document: ' + (err?.message || '') : 'Word dökümanı okunurken hata oluştu. Lütfen dosyanızın .docx formatında olduğundan veya metni doğrudan yapıştırdığınızdan emin olun: ' + (err?.message || ''));
      }
      return;
    }

    // 3. Text based files (.txt, .md, .json, .csv)
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const words = content.trim().split(/\s+/).length;
        onChangeRequirementText(content);
        setFileUploadInfo({ fileName: file.name, charCount: content.length, wordCount: words });
        setActiveTab('paste');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-[#0D1117] border border-white/10 rounded-2xl shadow-xl p-4 sm:p-5 text-slate-200">
      {/* Sleek Minimal Header with Mode Segmented Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-white">
              {isEn ? 'Requirement Document' : 'Gereksinim Dökümanı'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400">
              {isEn
                ? 'Enter requirements, upload files or pick templates'
                : 'İş gereksinimlerini girin, Word/Excel yükleyin veya örnek seçin'}
            </p>
          </div>
        </div>

        {/* Input Mode Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Editor' : 'Metin'}</span>
            </button>

            <button
              onClick={() => setActiveTab('visual_preview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'visual_preview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isEn ? 'Preview' : 'Önizleme'}</span>
              {detectedTablesCount > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold">
                  {detectedTablesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('sample')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'sample'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isEn ? 'Samples' : 'Örnekler'}</span>
            </button>

            <button
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isEn ? 'Upload' : 'Dosya'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'paste' && (
        <div className="space-y-3">
          {fileUploadInfo && (
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs text-blue-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="font-semibold">{fileUploadInfo.fileName}</span>
                <span className="text-blue-300/70">
                  ({fileUploadInfo.wordCount} {isEn ? 'words' : 'kelime'}, {fileUploadInfo.charCount} {isEn ? 'chars' : 'karakter'})
                </span>
              </div>
              <button
                onClick={() => {
                  setFileUploadInfo(null);
                  onChangeRequirementText('');
                }}
                className="text-slate-400 hover:text-rose-300 font-medium"
              >
                {isEn ? 'Clear File' : 'Dosyayı Kaldır'}
              </button>
            </div>
          )}

          <div className="relative">
            <textarea
              value={requirementText}
              onChange={(e) => onChangeRequirementText(e.target.value)}
              placeholder={
                isEn
                  ? 'Paste your requirements, user stories, acceptance criteria or specification text here...\n\nTip: You can also use markdown tables, bullet points, or upload Word/Excel documents.'
                  : 'Gereksinim dökümanını, Kullanıcı Hikayelerini (User Story), Kabul Kriterlerini (AC) veya GTD/TD metnini buraya yapıştırın...\n\nİpucu: Tablolar, kurallar ve madde imleri otomatik ayrıştırılır.'
              }
              rows={8}
              className="w-full bg-[#07090E] border border-white/10 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-y transition-colors"
            />
            {requirementText && (
              <div className="absolute right-3 bottom-3 text-[11px] text-slate-500 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800 pointer-events-none">
                {requirementText.trim().split(/\s+/).filter(Boolean).length} {isEn ? 'words' : 'kelime'} | {requirementText.length} {isEn ? 'chars' : 'karakter'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Preview Tab */}
      {activeTab === 'visual_preview' && (
        <div className="space-y-3">
          <div className="bg-[#07090E] border border-white/10 rounded-xl p-4 max-h-[360px] overflow-y-auto">
            <DocumentVisualPreview blocks={parsedDocumentBlocks} />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>
              {isEn
                ? `Total ${parsedDocumentBlocks.length} blocks detected (${detectedTablesCount} tables).`
                : `Toplam ${parsedDocumentBlocks.length} blok algılandı (${detectedTablesCount} tablo).`}
            </span>
            <button
              onClick={() => setActiveTab('paste')}
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Back to Text Editor' : 'Metin Düzenleme Moduna Dön'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sample Requirements Tab */}
      {activeTab === 'sample' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_REQUIREMENT_DOCS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className="p-3.5 bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/80 rounded-xl cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <span className="text-[10px] uppercase font-mono font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md inline-block mb-1.5">
                  {sample.category}
                </span>
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-blue-300 transition-colors mb-1">
                  {sample.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-2">{sample.description}</p>
              </div>
              <button className="mt-3 text-xs font-semibold text-blue-400 group-hover:text-blue-300 flex items-center gap-1">
                <span>{isEn ? 'Use This Document' : 'Bu Dökümanı Kullan'}</span>
                <span>→</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="border border-dashed border-slate-700 hover:border-blue-500 bg-[#07090E] rounded-xl p-6 text-center transition-colors">
          <input
            type="file"
            accept=".docx,.doc,.xlsx,.xls,.txt,.md,.json,.csv"
            onChange={handleFileUpload}
            className="hidden"
            id="req-file-upload"
          />
          <label htmlFor="req-file-upload" className="cursor-pointer flex flex-col items-center justify-center gap-2.5">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">
                {isEn ? 'Upload Requirement Document (.docx, .xlsx, .txt)' : 'Gereksinim Dökümanı Dosyası Yükleyin'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isEn
                  ? 'Word (.docx), Excel (.xlsx), Text (.txt, .md, .csv) supported.'
                  : 'Word (.docx 20+ sayfa), Excel (.xlsx), Metin (.txt, .md, .csv) dosyaları otomatik ayrıştırılır.'}
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Sleek Compact Action Bar */}
      <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Technique Scope Chips & Custom Instructions Trigger */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setShowOptionsModal(!showOptionsModal)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showOptionsModal
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:border-slate-600 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
            <span>{isEn ? 'ISTQB Test Scope' : 'ISTQB Test Kapsamı'}</span>
            <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {totalSelectedTechniques} {isEn ? 'selected' : 'seçili'}
            </span>
            {showOptionsModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              showCustomPrompt || config.customInstructions
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'AI Prompt Guidance' : 'Özel Yönerge'}</span>
            {config.customInstructions && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </button>

          {activeCorporateRulesCount > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
              <Brain className="w-3 h-3 text-emerald-400" />
              <span>{activeCorporateRulesCount} {isEn ? 'Corporate Rules Active' : 'Kurumsal Kural Aktif'}</span>
            </span>
          )}
        </div>

        {/* Right: Main Generate Button */}
        <button
          onClick={() => {
            if (totalSelectedTechniques === 0) {
              alert(
                isEn
                  ? 'Please select at least 1 test technique from the ISTQB Test Scope!'
                  : 'Lütfen test case üretimi için ISTQB Test Kapsamından en az bir teknik seçiniz!'
              );
              return;
            }
            onGenerate();
          }}
          disabled={isGenerating || !requirementText.trim() || totalSelectedTechniques === 0}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs sm:text-sm text-white transition-all transform active:scale-95 ${
            isGenerating || !requirementText.trim() || totalSelectedTechniques === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-900/30 hover:scale-[1.01]'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{isEn ? 'AI Generating Cases...' : 'AI Testleri Üretiyor...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{isEn ? 'Generate Test Cases' : 'Otomatik Test Case Üret'}</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Custom AI Prompt Guidance Bar */}
      {showCustomPrompt && (
        <div className="mt-3 bg-[#07090E] border border-amber-500/20 p-3 rounded-xl space-y-1.5 animate-in fade-in duration-150">
          <label className="text-xs text-amber-200 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'Custom AI Prompt Guidance:' : 'Özel AI Test Talimatı (Prompt):'}</span>
          </label>
          <input
            type="text"
            value={config.customInstructions || ''}
            onChange={(e) => onChangeConfig({ ...config, customInstructions: e.target.value })}
            placeholder={
              isEn
                ? "e.g., 'Include HTTP 200/400 status codes in steps', 'Detail boundary limits for salary field'..."
                : "Örn: 'Tüm test adımlarına HTTP 200/400 status kodlarını ekle', 'Maaş alanı sınır değerlerini detaylandır'..."
            }
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* Expandable Clean ISTQB Scope Tray */}
      {showOptionsModal && (
        <div className="mt-3 bg-[#07090E] border border-white/10 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {isEn ? 'ISTQB Test Techniques Configuration' : 'ISTQB Test Teknikleri Yapılandırması'}
              </h3>
            </div>
            <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
              ISTQB CTFL
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Functional Column */}
            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{isEn ? 'Functional Testing' : 'Fonksiyonel Testler'}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({selectedFunctional.length}/{FUNCTIONAL_TEST_TYPES.length})
                  </span>
                </h4>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllFunctional}
                    className="text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    {isEn ? 'All' : 'Tümü'}
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={clearAllFunctional}
                    className="text-slate-400 hover:text-slate-300"
                  >
                    {isEn ? 'Clear' : 'Temizle'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {FUNCTIONAL_TEST_TYPES.map((type) => {
                  const isSelected = selectedFunctional.includes(type);
                  return (
                    <label
                      key={type}
                      onClick={() => toggleFunctionalType(type)}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="accent-emerald-500 mt-0.5 w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span className="leading-tight text-[11px]">{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Non-Functional Column */}
            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>{isEn ? 'Non-Functional Testing' : 'Fonksiyonel Olmayan'}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({selectedNonFunctional.length}/{NON_FUNCTIONAL_TEST_TYPES.length})
                  </span>
                </h4>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllNonFunctional}
                    className="text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    {isEn ? 'All' : 'Tümü'}
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={clearAllNonFunctional}
                    className="text-slate-400 hover:text-slate-300"
                  >
                    {isEn ? 'Clear' : 'Temizle'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {NON_FUNCTIONAL_TEST_TYPES.map((type) => {
                  const isSelected = selectedNonFunctional.includes(type);
                  return (
                    <label
                      key={type}
                      onClick={() => toggleNonFunctionalType(type)}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all select-none ${
                        isSelected
                          ? 'bg-purple-500/10 border-purple-500/40 text-purple-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="accent-purple-500 mt-0.5 w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span className="leading-tight text-[11px]">{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
