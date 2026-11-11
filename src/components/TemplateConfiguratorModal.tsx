import React, { useState } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { ExcelTemplateConfig, MappedFieldType, TemplateColumn } from '../types';
import { PRESET_TEMPLATES } from '../data/presetTemplates';
import { parseUploadedExcelTemplate } from '../utils/excelHelper';

interface TemplateConfiguratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTemplate: ExcelTemplateConfig;
  onSaveTemplate: (template: ExcelTemplateConfig) => void;
}

const FIELD_OPTIONS: { value: MappedFieldType; label: string; description: string }[] = [
  { value: 'testCaseId', label: 'Test Case ID', description: 'Örn: TC-REQ01-001' },
  { value: 'reqId', label: 'Gereksinim ID (Req ID)', description: 'Örn: REQ-PAY-01' },
  { value: 'module', label: 'Modül / Özellik Name', description: 'Örn: Sepet & Ödeme' },
  { value: 'title', label: 'Test Senaryosu Başlığı', description: 'Örn: Başarılı İndirim Kuponu Uygulama' },
  { value: 'description', label: 'Test Açıklaması / Amacı', description: 'Testin genel hedefi' },
  { value: 'preconditions', label: 'Ön Koşullar (Preconditions)', description: 'Kullanıcının giriş yapmış olması, sepetin dolu olması vb.' },
  { value: 'steps', label: 'Test Adımları (Numbered Steps)', description: '1. Giriş yap, 2. Kodu yaz...' },
  { value: 'testData', label: 'Test Verisi (Test Data)', description: 'Kupon Kodu: YAZ2026, Kart No: 4543...' },
  { value: 'expectedResult', label: 'Beklenen Sonuç (Expected Result)', description: '%20 indirim uygulanmalı ve mesaj görünmeli' },
  { value: 'priority', label: 'Öncelik (Priority)', description: 'Yüksek / Orta / Düşük' },
  { value: 'testType', label: 'Test Tipi (Test Type)', description: 'Pozitif, Negatif, Sınır Değer, Güvenlik' },
  { value: 'executionType', label: 'Çalıştırma Türü', description: 'Manuel / Otomasyon' },
  { value: 'severity', label: 'Önem Derecesi (Severity)', description: 'Kritik / Yüksek / Normal / Düşük' },
  { value: 'custom', label: 'Sabit / Özel Metin (Custom Text)', description: 'Sabit değer yazar (örn. "Her Sürüm")' },
];

export const TemplateConfiguratorModal: React.FC<TemplateConfiguratorModalProps> = ({
  isOpen,
  onClose,
  activeTemplate,
  onSaveTemplate,
}) => {
  const [template, setTemplate] = useState<ExcelTemplateConfig>({ ...activeTemplate });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: ExcelTemplateConfig) => {
    setTemplate({ ...preset, columns: preset.columns.map((col) => ({ ...col })) });
    setSuccessMessage(`"${preset.templateName}" şablonu yüklendi.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const parsed = await parseUploadedExcelTemplate(file);
      setTemplate(parsed);
      setSuccessMessage(`"${file.name}" dosyasındaki ${parsed.columns.length} sütun yapısı başarıyla çıkartıldı!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Excel şablonu yüklenirken bir hata oluştu.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleColumnNameChange = (index: number, newName: string) => {
    const updated = [...template.columns];
    updated[index].name = newName;
    setTemplate({ ...template, columns: updated });
  };

  const handleMappingChange = (index: number, mappedField: MappedFieldType) => {
    const updated = [...template.columns];
    updated[index].mappedField = mappedField;
    setTemplate({ ...template, columns: updated });
  };

  const handleDefaultValueChange = (index: number, value: string) => {
    const updated = [...template.columns];
    updated[index].defaultValue = value;
    setTemplate({ ...template, columns: updated });
  };

  const handleAddColumn = () => {
    const newCol: TemplateColumn = {
      id: `col_new_${Date.now()}`,
      name: `Yeni Sütun ${template.columns.length + 1}`,
      mappedField: 'custom',
      defaultValue: '',
      width: 20,
    };
    setTemplate({ ...template, columns: [...template.columns, newCol] });
  };

  const handleRemoveColumn = (index: number) => {
    if (template.columns.length <= 1) {
      alert('Şablonda en az 1 sütun bulunmalıdır.');
      return;
    }
    const updated = template.columns.filter((_, i) => i !== index);
    setTemplate({ ...template, columns: updated });
  };

  const handleSave = () => {
    onSaveTemplate(template);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Excel Test Şablonu & Sütun Eşleştirici</h2>
              <p className="text-xs text-slate-400">
                Şirketinizin özel test dökümanı formatını yükleyin veya hazır şablonlardan seçin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Preset templates bar */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2 block">
              Hazır Şablonlar
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRESET_TEMPLATES.map((preset) => {
                const isSelected = template.templateName === preset.templateName;
                return (
                  <button
                    key={preset.templateName}
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/80 text-white shadow-md shadow-indigo-950'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-indigo-300">{preset.templateName}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {preset.columns.length} Sütun ({preset.sheetName})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Custom Excel Template */}
          <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-slate-500 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-template-upload"
            />
            <label
              htmlFor="excel-template-upload"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <Upload className="w-7 h-7 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Kendi Özel Excel Şablonunuzu Yükleyin (.xlsx)
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Excel dosyanızın başlık satırı otomatik okunacak ve sütun eşleşmesi yapılacaktır.
                </p>
              </div>
            </label>
            {isUploading && (
              <p className="text-xs text-indigo-400 mt-2 font-medium">Excel şablonu analiz ediliyor...</p>
            )}
            {uploadError && (
              <p className="text-xs text-rose-400 mt-2 font-medium">{uploadError}</p>
            )}
            {successMessage && (
              <p className="text-xs text-emerald-400 mt-2 font-medium">{successMessage}</p>
            )}
          </div>

          {/* Active Template Configuration Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  Sütun Yapısı ve Alan Eşleştirmeleri
                </span>
                <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-full font-mono">
                  {template.columns.length} Sütun
                </span>
              </div>

              <button
                onClick={handleAddColumn}
                className="flex items-center gap-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Sütun Ekle</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Excel Sütun Başlığı</th>
                      <th className="py-3 px-4 w-8 text-center">→</th>
                      <th className="py-3 px-4">AI Veri Alanı Eşleştirmesi</th>
                      <th className="py-3 px-4 w-12 text-center">Sil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {template.columns.map((col, idx) => (
                      <tr key={col.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-500">{idx + 1}</td>

                        {/* Column Header Name in Excel */}
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => handleColumnNameChange(idx, e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-white text-xs font-medium focus:outline-none"
                            placeholder="Sütun Adı"
                          />
                        </td>

                        <td className="py-2.5 px-4 text-center text-slate-500">
                          <ArrowRight className="w-4 h-4 inline" />
                        </td>

                        {/* Mapped Field Selection */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-1">
                            <select
                              value={col.mappedField}
                              onChange={(e) =>
                                handleMappingChange(idx, e.target.value as MappedFieldType)
                              }
                              className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-indigo-300 text-xs font-medium focus:outline-none"
                            >
                              {FIELD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label} ({opt.description})
                                </option>
                              ))}
                            </select>

                            {col.mappedField === 'custom' && (
                              <input
                                type="text"
                                value={col.defaultValue || ''}
                                onChange={(e) => handleDefaultValueChange(idx, e.target.value)}
                                placeholder="Varsayılan metin değeri..."
                                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-300 text-[11px] focus:outline-none"
                              />
                            )}
                          </div>
                        </td>

                        {/* Remove Column */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleRemoveColumn(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                            title="Sütunu Kaldır"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-start gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <p>
              Yapay zeka, ürettiği test senaryolarını tam olarak buradaki <strong>Excel Sütun Başlıkları</strong> sırasına göre hizalayacaktır. İndirilecek Excel dökümanı şirketinizin şablonu ile birebir aynı sütun isimlerine sahip olacaktır.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Şablon Adı: <strong className="text-slate-200">{template.templateName}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 transition-colors"
            >
              Şablonu Kaydet ve Kullan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
