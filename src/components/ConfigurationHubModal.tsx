import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Brain,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Plus,
  Save,
  Globe,
  Lock,
  Key,
  Folder,
  Upload,
  Info,
  ArrowRight,
  Database,
  Cloud,
  Check,
} from 'lucide-react';
import {
  CorporateMemoryRule,
  ExcelTemplateConfig,
  JiraConfig,
  UserProfile,
  MappedFieldType,
  TemplateColumn,
} from '../types';
import { PRESET_TEMPLATES } from '../data/presetTemplates';
import { parseUploadedExcelTemplate } from '../utils/excelHelper';

export type ConfigTab = 'memory' | 'template' | 'jira' | 'cloud';

interface ConfigurationHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ConfigTab;
  language: 'tr' | 'en';
  // Corporate Memory Props
  corporateRules: CorporateMemoryRule[];
  onAddCorporateRule: (rule: Omit<CorporateMemoryRule, 'id' | 'createdAt'>) => void;
  onDeleteCorporateRule: (id: string) => void;
  onToggleCorporateRule: (id: string) => void;
  onResetCorporateRules: () => void;
  // Template Props
  activeTemplate: ExcelTemplateConfig;
  onSaveTemplate: (template: ExcelTemplateConfig) => void;
  // Jira Props
  jiraConfig: JiraConfig;
  onSaveJiraConfig: (config: JiraConfig) => void;
  // Cloud / User
  currentUser?: UserProfile | null;
}

const FIELD_OPTIONS: { value: MappedFieldType; label: string; description: string }[] = [
  { value: 'testCaseId', label: 'Test Case ID', description: 'Örn: TC-REQ01-001' },
  { value: 'reqId', label: 'Gereksinim ID (Req ID)', description: 'Örn: REQ-PAY-01' },
  { value: 'module', label: 'Modül / Özellik Name', description: 'Örn: Sepet & Ödeme' },
  { value: 'title', label: 'Test Senaryosu Başlığı', description: 'Örn: Başarılı İndirim Kuponu Uygulama' },
  { value: 'description', label: 'Test Açıklaması / Amacı', description: 'Testin genel hedefi' },
  { value: 'preconditions', label: 'Ön Koşullar (Preconditions)', description: 'Kullanıcının giriş yapmış olması vb.' },
  { value: 'steps', label: 'Test Adımları (Numbered Steps)', description: '1. Giriş yap, 2. Kodu yaz...' },
  { value: 'testData', label: 'Test Verisi (Test Data)', description: 'Kupon Kodu: YAZ2026, Kart No: 4543...' },
  { value: 'expectedResult', label: 'Beklenen Sonuç (Expected Result)', description: '%20 indirim uygulanmalı ve mesaj görünmeli' },
  { value: 'priority', label: 'Öncelik (Priority)', description: 'Yüksek / Orta / Düşük' },
  { value: 'testType', label: 'Test Tipi (Test Type)', description: 'Pozitif, Negatif, Sınır Değer, Güvenlik' },
  { value: 'executionType', label: 'Çalıştırma Türü', description: 'Manuel / Otomasyon' },
  { value: 'severity', label: 'Önem Derecesi (Severity)', description: 'Kritik / Yüksek / Normal / Düşük' },
  { value: 'custom', label: 'Sabit / Özel Metin (Custom Text)', description: 'Sabit değer yazar (örn. "Her Sürüm")' },
];

export const ConfigurationHubModal: React.FC<ConfigurationHubModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'memory',
  language,
  corporateRules,
  onAddCorporateRule,
  onDeleteCorporateRule,
  onToggleCorporateRule,
  onResetCorporateRules,
  activeTemplate,
  onSaveTemplate,
  jiraConfig,
  onSaveJiraConfig,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Corporate Memory Form State
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleCategory, setRuleCategory] = useState('Telekomünikasyon');
  const [rulePrompt, setRulePrompt] = useState('');
  const [ruleTags, setRuleTags] = useState('');
  const [ruleExample, setRuleExample] = useState('');

  // Template State
  const [templateForm, setTemplateForm] = useState<ExcelTemplateConfig>({ ...activeTemplate });
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [templateSuccessMsg, setTemplateSuccessMsg] = useState<string | null>(null);
  const [templateErrorMsg, setTemplateErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTemplateForm({ ...activeTemplate });
    }
  }, [isOpen, activeTemplate]);

  // Jira State
  const [jiraForm, setJiraForm] = useState<JiraConfig>(jiraConfig);
  const [jiraSavedMsg, setJiraSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setJiraForm(jiraConfig || {
        domain: '',
        userEmail: '',
        apiToken: '',
        projectKey: 'TEST',
        issueType: 'Bug',
      });
      setJiraSavedMsg(null);
    }
  }, [isOpen, jiraConfig]);

  if (!isOpen) return null;

  const isEn = language === 'en';

  // Handlers for Rule Creation
  const handleCreateRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleTitle.trim() || !rulePrompt.trim()) return;

    onAddCorporateRule({
      title: ruleTitle.trim(),
      category: ruleCategory.trim() || 'Genel',
      promptRule: rulePrompt.trim(),
      isDefaultActive: true,
      tags: ruleTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      exampleContext: ruleExample.trim(),
    });

    setRuleTitle('');
    setRulePrompt('');
    setRuleTags('');
    setRuleExample('');
    setShowAddRuleForm(false);
  };

  // Handlers for Template
  const handlePresetSelect = (preset: ExcelTemplateConfig) => {
    setTemplateForm({ ...preset, columns: preset.columns.map((col) => ({ ...col })) });
    setTemplateSuccessMsg(isEn ? `Applied "${preset.templateName}" template.` : `"${preset.templateName}" şablonu yüklendi.`);
    setTimeout(() => setTemplateSuccessMsg(null), 2500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);
    setTemplateErrorMsg(null);
    try {
      const parsed = await parseUploadedExcelTemplate(file);
      setTemplateForm(parsed);
      setTemplateSuccessMsg(
        isEn
          ? `Excel template "${file.name}" imported with ${parsed.columns.length} columns!`
          : `"${file.name}" dosyasından ${parsed.columns.length} sütun başarıyla algılandı!`
      );
      setTimeout(() => setTemplateSuccessMsg(null), 3500);
    } catch (err: any) {
      setTemplateErrorMsg(err.message || (isEn ? 'Failed to parse Excel' : 'Excel dosyası okunamadı.'));
    } finally {
      setIsUploadingTemplate(false);
      e.target.value = '';
    }
  };

  const handleAddColumn = () => {
    const newCol: TemplateColumn = {
      id: `col_new_${Date.now()}`,
      name: isEn ? 'New Column' : 'Yeni Sütun',
      mappedField: 'custom',
      defaultValue: '',
      width: 20,
    };
    setTemplateForm({ ...templateForm, columns: [...templateForm.columns, newCol] });
  };

  const handleRemoveColumn = (index: number) => {
    if (templateForm.columns.length <= 1) return;
    const updated = templateForm.columns.filter((_, idx) => idx !== index);
    setTemplateForm({ ...templateForm, columns: updated });
  };

  const handleColumnChange = (index: number, field: keyof TemplateColumn, value: any) => {
    const updated = [...templateForm.columns];
    updated[index] = { ...updated[index], [field]: value };
    setTemplateForm({ ...templateForm, columns: updated });
  };

  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTemplate(templateForm);
    setTemplateSuccessMsg(isEn ? 'Excel template configuration saved!' : 'Excel şablon ayarları kaydedildi!');
    setTimeout(() => setTemplateSuccessMsg(null), 2000);
  };

  // Handlers for Jira
  const handleSaveJiraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveJiraConfig(jiraForm);
    setJiraSavedMsg(isEn ? 'Jira configuration saved successfully!' : 'Jira ayarları başarıyla kaydedildi!');
    setTimeout(() => setJiraSavedMsg(null), 2500);
  };

  const activeRulesCount = corporateRules.filter((r) => r.isDefaultActive).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0D1117] border border-white/15 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative text-slate-100 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {isEn ? 'System Settings & Configurations' : 'Ayarlar ve Konfigürasyon Merkezi'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEn
                  ? 'Manage corporate memory rules, Excel export templates, and Jira integrations'
                  : 'Kurumsal hafıza kuralları, Excel şablon yapısı ve Jira entegrasyon ayarları'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="px-6 pt-3 pb-2 border-b border-white/10 flex items-center gap-2 overflow-x-auto bg-slate-950/40 shrink-0">
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'memory'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Brain className="w-4 h-4 text-indigo-300" />
            <span>{isEn ? 'Corporate Memory' : 'Kurumsal Hafıza'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'memory' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {activeRulesCount}/{corporateRules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('template')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'template'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>{isEn ? 'Excel Template' : 'Excel Şablonu'}</span>
            <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {templateForm.columns.length} {isEn ? 'cols' : 'sütun'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('jira')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'jira'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span className="font-bold font-mono bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
              J
            </span>
            <span>Jira</span>
            {jiraConfig.domain && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Configured" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'cloud'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cloud className="w-4 h-4 text-purple-300" />
            <span>{isEn ? 'Account & Cloud' : 'Hesap & Bulut'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: KURUMSAL HAFIZA (CORPORATE MEMORY) */}
          {activeTab === 'memory' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-indigo-200 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    {isEn ? 'Learned Test Engine & Corporate Memory' : 'Öğrenilmiş Kural Motoru & Kurumsal Hafıza'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    {isEn
                      ? 'Active rules are automatically enforced in all AI test case generations as mandatory standards.'
                      : 'Aktif işaretli kurallar, her test senaryosu üretiminde yapay zekaya zorunlu mühendislik standartları olarak enjekte edilir.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={onResetCorporateRules}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors"
                    title={isEn ? 'Restore Telecom & Integration defaults' : 'Telekom ve Sistem varsayılanlarına dön'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Reset Defaults' : 'Varsayılanları Yükle'}</span>
                  </button>

                  <button
                    onClick={() => setShowAddRuleForm(!showAddRuleForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isEn ? 'New Rule' : 'Yeni Kural Ekle'}</span>
                  </button>
                </div>
              </div>

              {/* Add Rule Form */}
              {showAddRuleForm && (
                <form
                  onSubmit={handleCreateRuleSubmit}
                  className="bg-slate-900 border border-indigo-500/30 p-4 rounded-xl space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-xs font-bold text-indigo-300">
                      {isEn ? 'Add New Corporate Engineering Rule' : 'Yeni Kurumsal Test Standardı Tanımla'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddRuleForm(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      {isEn ? 'Cancel' : 'Vazgeç'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        {isEn ? 'Rule Title' : 'Kural Başlığı'} *
                      </label>
                      <input
                        type="text"
                        value={ruleTitle}
                        onChange={(e) => setRuleTitle(e.target.value)}
                        placeholder={isEn ? 'e.g. MAE Suspend Status Validation' : 'Örn: MAE Askıya Alma & İptal Doğrulamaları'}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        {isEn ? 'Category' : 'Kategori'}
                      </label>
                      <input
                        type="text"
                        value={ruleCategory}
                        onChange={(e) => setRuleCategory(e.target.value)}
                        placeholder="Telekomünikasyon, XML / Entegrasyon, Güvenlik vb."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      {isEn ? 'Prompt Instruction / Testing Standard' : 'Yapay Zeka Prompt Kuralı & Test Standardı'} *
                    </label>
                    <textarea
                      value={rulePrompt}
                      onChange={(e) => setRulePrompt(e.target.value)}
                      rows={3}
                      placeholder={
                        isEn
                          ? 'Explain what test cases must always be generated when this condition is encountered...'
                          : 'Bu durumla karşılaşıldığında hangi pozitif/negatif senaryoların ve hangi parametrelerin test edilmesi gerektiğini açıklayın...'
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none font-sans"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        {isEn ? 'Tags (comma separated)' : 'Etiketler (virgülle ayırın)'}
                      </label>
                      <input
                        type="text"
                        value={ruleTags}
                        onChange={(e) => setRuleTags(e.target.value)}
                        placeholder="MAE, XML, Telecom, Security"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        {isEn ? 'Example Context (Optional)' : 'Örnek Bağlam / İlgili Alan (Opsiyonel)'}
                      </label>
                      <input
                        type="text"
                        value={ruleExample}
                        onChange={(e) => setRuleExample(e.target.value)}
                        placeholder="WFM, CIHAZ_TOPLAMA, SMS Gateway"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Save Rule to Memory' : 'Kuralı Hafızaya Kaydet'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List */}
              <div className="space-y-3">
                {corporateRules.length === 0 ? (
                  <div className="text-center py-10 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 text-slate-400">
                    <Brain className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p className="text-xs">{isEn ? 'No rules registered yet.' : 'Henüz kayıtlı kural bulunmamaktadır.'}</p>
                    <button
                      onClick={onResetCorporateRules}
                      className="mt-3 text-indigo-400 hover:underline text-xs"
                    >
                      {isEn ? 'Load standard default rules' : 'Varsayılan kuralları geri yükle'}
                    </button>
                  </div>
                ) : (
                  corporateRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-xl border transition-all ${
                        rule.isDefaultActive
                          ? 'bg-slate-900/80 border-indigo-500/30 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={rule.isDefaultActive}
                            onChange={() => onToggleCorporateRule(rule.id)}
                            className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-950 cursor-pointer"
                            id={`rule-check-${rule.id}`}
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <label
                                htmlFor={`rule-check-${rule.id}`}
                                className="font-semibold text-xs text-white cursor-pointer hover:text-indigo-300"
                              >
                                {rule.title}
                              </label>
                              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.2 rounded-md font-medium border border-indigo-500/30">
                                {rule.category}
                              </span>
                              {rule.isDefaultActive ? (
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                  {isEn ? 'Active' : 'Aktif'}
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.2 rounded">
                                  {isEn ? 'Disabled' : 'Pasif'}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 mt-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed">
                              {rule.promptRule}
                            </p>

                            {rule.tags && rule.tags.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {rule.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => onDeleteCorporateRule(rule.id)}
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/30 transition-colors"
                          title={isEn ? 'Delete Rule' : 'Kuralı Sil'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXCEL ŞABLONU (TEMPLATE CONFIGURATOR) */}
          {activeTab === 'template' && (
            <div className="space-y-6">
              {templateSuccessMsg && (
                <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 p-3 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{templateSuccessMsg}</span>
                </div>
              )}

              {templateErrorMsg && (
                <div className="bg-rose-950/80 border border-rose-500/40 text-rose-200 p-3 rounded-xl text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{templateErrorMsg}</span>
                </div>
              )}

              {/* Preset Templates */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  {isEn ? 'Preset Industry Templates' : 'Hazır Şablonlar'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.templateName}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        templateForm.templateName === preset.templateName
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-md'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-xs font-bold text-white">{preset.templateName}</strong>
                        {templateForm.templateName === preset.templateName && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="inline-block text-[10px] font-mono bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-300">
                        {preset.columns.length} {isEn ? 'columns' : 'sütun'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Excel Import */}
              <div className="bg-slate-900/90 border border-dashed border-slate-700 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    {isEn ? 'Upload Custom Excel Template (.xlsx / .xls)' : 'Kendi Excel Şablonunu Yükle'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isEn
                      ? 'Upload your corporate Excel file; columns and headers will be automatically mapped.'
                      : 'Şirketinizin kullandığı boş test case Excel dosyasını yükleyin; sütun başlıkları otomatik eşleştirilecektir.'}
                  </p>
                </div>

                <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors shrink-0">
                  {isUploadingTemplate ? (isEn ? 'Analyzing...' : 'Yükleniyor...') : (isEn ? 'Select File' : 'Excel Dosyası Seç')}
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploadingTemplate}
                  />
                </label>
              </div>

              {/* Column Mapping Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {isEn ? 'Template Columns & Field Mappings' : 'Sütun Listesi ve Alan Eşleştirmeleri'} (
                    {templateForm.columns.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Add Column' : 'Sütun Ekle'}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {templateForm.columns.map((col, idx) => (
                    <div
                      key={col.id || idx}
                      className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs"
                    >
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            {isEn ? 'Excel Header Name' : 'Excel Sütun Başlığı'}
                          </label>
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => handleColumnChange(idx, 'name', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            {isEn ? 'Mapped Data Field' : 'Bağlanan Test Alanı'}
                          </label>
                          <select
                            value={col.mappedField}
                            onChange={(e) =>
                              handleColumnChange(idx, 'mappedField', e.target.value as MappedFieldType)
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white focus:border-emerald-500 focus:outline-none"
                          >
                            {FIELD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(idx)}
                        disabled={templateForm.columns.length <= 1}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors disabled:opacity-30 self-end sm:self-center"
                        title={isEn ? 'Remove Column' : 'Sütunu Sil'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={handleSaveTemplateSubmit}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isEn ? 'Save Template Settings' : 'Şablon Ayarlarını Kaydet'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JIRA ENTEGRASYONU */}
          {activeTab === 'jira' && (
            <form onSubmit={handleSaveJiraSubmit} className="space-y-4 max-w-xl mx-auto">
              <div className="bg-blue-950/30 border border-blue-500/30 p-4 rounded-xl flex items-start gap-3">
                <span className="font-bold font-mono bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5">
                  J
                </span>
                <div className="text-xs">
                  <h3 className="font-bold text-blue-200">
                    {isEn ? 'Atlassian Jira Cloud Integration' : 'Atlassian Jira Entegrasyonu'}
                  </h3>
                  <p className="text-slate-300 mt-1">
                    {isEn
                      ? 'Link your Jira project to automatically export generated test scenarios as Jira Issues / Test Tasks.'
                      : 'Üretilen test senaryolarını tek tıkla Jira projenize Test Case veya Bug olarak aktarmak için bilgilerinizi girin.'}
                  </p>
                </div>
              </div>

              {jiraSavedMsg && (
                <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 p-3 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{jiraSavedMsg}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {isEn ? 'Jira Domain URL' : 'Jira Domain Adresi'}
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="url"
                    value={jiraForm.domain}
                    onChange={(e) => setJiraForm({ ...jiraForm, domain: e.target.value })}
                    placeholder="https://sirketiniz.atlassian.net"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isEn ? 'Atlassian Email' : 'Kullanıcı E-Postası'}
                  </label>
                  <input
                    type="email"
                    value={jiraForm.userEmail}
                    onChange={(e) => setJiraForm({ ...jiraForm, userEmail: e.target.value })}
                    placeholder="ornek@sirket.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isEn ? 'API Token' : 'Atlassian API Token'}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={jiraForm.apiToken}
                      onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                      placeholder="••••••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isEn ? 'Target Project Key' : 'Varsayılan Proje Kodu (Key)'}
                  </label>
                  <input
                    type="text"
                    value={jiraForm.projectKey}
                    onChange={(e) => setJiraForm({ ...jiraForm, projectKey: e.target.value })}
                    placeholder="Örn: QA, TELECOM, CRM"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isEn ? 'Issue Type' : 'Kayıt Tipi (Issue Type)'}
                  </label>
                  <select
                    value={jiraForm.issueType}
                    onChange={(e) => setJiraForm({ ...jiraForm, issueType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Bug">Bug (Hata)</option>
                    <option value="Test">Test (Xray / Zephyr Test)</option>
                    <option value="Task">Task (Görev)</option>
                    <option value="Story">Story (Gereksinim)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isEn ? 'Save Jira Settings' : 'Jira Ayarlarını Kaydet'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: HESAP & BULUT SENKRONİZASYONU */}
          {activeTab === 'cloud' && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="bg-purple-950/30 border border-purple-500/30 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-purple-200">
                      {isEn ? 'Firebase Firestore Cloud Synchronization' : 'Firebase Bulut Veri Tabanı Senkronizasyonu'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isEn
                        ? 'Your test cases, corporate rules, and projects are securely synced in real-time.'
                        : 'Oluşturduğunuz tüm projeler, test senaryoları ve kurumsal hafıza kuralları bulutta güvendedir.'}
                    </p>
                  </div>
                </div>
              </div>

              {currentUser && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">
                    {isEn ? 'Active User Profile' : 'Aktif Kullanıcı Profili'}
                  </h4>
                  <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-sm">
                      {currentUser.avatarUrl ? (
                        <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-xl" />
                      ) : (
                        (currentUser.name || currentUser.email).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-white">{currentUser.name || currentUser.email}</p>
                      <p className="text-slate-400 text-[11px]">{currentUser.email}</p>
                      <span className="inline-block mt-1 bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                        {currentUser.provider === 'google' ? 'Google Auth' : 'Email/Password'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{isEn ? 'Cloud Database:' : 'Bulut Veritabanı:'}</span>
                  <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Firebase Firestore (Online)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{isEn ? 'Data Security:' : 'Veri Güvenliği:'}</span>
                  <span className="text-slate-200">{isEn ? 'Encrypted User-Scoped Storage' : 'Kullanıcı Bazlı İzolasyon'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between bg-slate-900/40 rounded-b-2xl shrink-0 text-xs">
          <span className="text-slate-400">
            {isEn ? 'TestMatrix AI • QA Engineering Studio' : 'TestMatrix AI • QA Mühendislik Stüdyosu'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            {isEn ? 'Close' : 'Kapat'}
          </button>
        </div>
      </div>
    </div>
  );
};
