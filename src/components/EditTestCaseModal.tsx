import React, { useState, useEffect } from 'react';
import { TestCase, RequirementItem } from '../types';
import { X, Edit3, Check, Layers, AlertTriangle, FileCheck, Shield } from 'lucide-react';
import { formatStepsText } from '../utils/excelHelper';

interface EditTestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCase: TestCase | null;
  requirements: RequirementItem[];
  onSave: (updatedTc: TestCase) => void;
}

export const EditTestCaseModal: React.FC<EditTestCaseModalProps> = ({
  isOpen,
  onClose,
  testCase,
  requirements,
  onSave,
}) => {
  const [tcId, setTcId] = useState('');
  const [selectedReqId, setSelectedReqId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [title, setTitle] = useState('');
  const [preconditions, setPreconditions] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [testData, setTestData] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [priority, setPriority] = useState<'Yüksek' | 'Orta' | 'Düşük'>('Orta');
  const [testType, setTestType] = useState<string>('Pozitif (Fonksiyonel Doğruluk)');
  const [executionType, setExecutionType] = useState<'Manuel' | 'Otomasyon'>('Manuel');
  const [severity, setSeverity] = useState<'Kritik' | 'Yüksek' | 'Normal' | 'Düşük'>('Normal');

  useEffect(() => {
    if (testCase) {
      setTcId(testCase.id || '');
      setSelectedReqId(testCase.reqId || requirements[0]?.id || 'REQ-01');
      setModuleName(testCase.module || '');
      setTitle(testCase.title || '');
      setPreconditions(testCase.preconditions || '');
      setStepsText(formatStepsText(testCase.steps));
      setTestData(testCase.testData || '');
      setExpectedResult(testCase.expectedResult || '');
      setPriority(testCase.priority || 'Orta');
      setTestType(testCase.testType || 'Pozitif');
      setExecutionType(testCase.executionType || 'Manuel');
      setSeverity(testCase.severity || 'Normal');
    }
  }, [testCase, requirements]);

  if (!isOpen || !testCase) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Lütfen test senaryosu başlığını giriniz.');
      return;
    }

    // Process steps text line by line
    const stepsArray = stepsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const updatedTestCase: TestCase = {
      ...testCase,
      id: tcId.trim() || testCase.id,
      reqId: selectedReqId,
      module: moduleName.trim() || 'Genel Modül',
      title: title.trim(),
      description: testCase.description || title.trim(),
      preconditions: preconditions.trim(),
      steps: stepsArray.length > 0 ? stepsArray : ['1. Test adımını gerçekleştir.'],
      testData: testData.trim(),
      expectedResult: expectedResult.trim(),
      priority,
      testType,
      executionType,
      severity,
    };

    onSave(updatedTestCase);
    onClose();
  };

  const selectedReqObj = requirements.find((r) => r.id === selectedReqId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Test Senaryosu Düzenle & Güncelle</span>
                <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  {testCase.id}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Test adımları, ön koşullar, test verisi ve beklenen sonuçları rahatça düzenleyin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Requirement Selector */}
          <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              İlişkili Gereksinim (Requirement):
            </label>
            <select
              value={selectedReqId}
              onChange={(e) => {
                setSelectedReqId(e.target.value);
                const req = requirements.find((r) => r.id === e.target.value);
                if (req) setModuleName(req.category || req.title || moduleName);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {requirements.map((req) => (
                <option key={req.id} value={req.id}>
                  [{req.id}] {req.title}
                </option>
              ))}
            </select>
            {selectedReqObj && (
              <p className="text-[11px] text-slate-400 italic bg-slate-900/50 p-2 rounded border border-slate-800/80">
                Gereksinim Açıklaması: {selectedReqObj.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Case ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Test Case ID:
              </label>
              <input
                type="text"
                value={tcId}
                onChange={(e) => setTcId(e.target.value)}
                placeholder="Örn: TC-REQ01-001"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Module Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Sistem / Modül Adı:
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="Örn: Ödeme Sistemi"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Test Case Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Test Senaryosu Başlığı <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Sepet Tutarı ve KDV Hesaplamasının Doğrulanması"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Preconditions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Test Ön Koşulu (Preconditions):
            </label>
            <textarea
              rows={3}
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              placeholder="Örn: Kullanıcı sisteme giriş yapmış ve sepetine en az 1 ürün eklemiş olmalıdır."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* Test Steps */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Test Adımları (Her adımı yeni bir satıra yazınız):
              </label>
              <span className="text-[11px] text-slate-500">Örn: 1. Sayfaya gidin.</span>
            </div>
            <textarea
              rows={6}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={'1. Sepetim sayfasına gidin.\n2. Ürün miktarını 2 olarak güncelleyin.\n3. Toplam tutarı kontrol edin.'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs text-indigo-100 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
            />
          </div>

          {/* Test Data & Expected Result */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Data */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Test Verisi (Test Data):
              </label>
              <textarea
                rows={4}
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder="Örn: Ürün 1: 100 TL (%20 KDV), Adet: 2"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>

            {/* Expected Result */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Beklenen Sonuç (Expected Result):
              </label>
              <textarea
                rows={4}
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="Örn: Ara toplam 200 TL, KDV 40 TL ve Genel Toplam 240 TL olarak doğru hesaplanmalıdır."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-emerald-300 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>
          </div>

          {/* Attributes Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {/* Priority */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Öncelik:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Yüksek">Yüksek</option>
                <option value="Orta">Orta</option>
                <option value="Düşük">Düşük</option>
              </select>
            </div>

            {/* Test Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Test Tipi (ISTQB):
              </label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <optgroup label="Fonksiyonel Testler">
                  <option value="Pozitif (Fonksiyonel Doğruluk)">Pozitif (Fonksiyonel Doğruluk)</option>
                  <option value="Negatif (Hata Yönetimi)">Negatif (Hata Yönetimi)</option>
                  <option value="Sınır Değer Analizi (BVA)">Sınır Değer Analizi (BVA)</option>
                  <option value="Eşdeğer Sınıflandırma (EP)">Eşdeğer Sınıflandırma (EP)</option>
                  <option value="Durum Geçiş Testi (State Transition)">Durum Geçiş Testi (State Transition)</option>
                  <option value="Karar Tablosu Testi (Decision Table)">Karar Tablosu Testi (Decision Table)</option>
                  <option value="Kullanım Senaryosu Testi (Use Case)">Kullanım Senaryosu Testi (Use Case)</option>
                </optgroup>
                <optgroup label="Fonksiyonel Olmayan Testler">
                  <option value="Performans Testi (Performance)">Performans Testi (Performance)</option>
                  <option value="Yük ve Stres Testi (Load & Stress)">Yük ve Stres Testi (Load & Stress)</option>
                  <option value="Güvenlik ve Yetki Testi (Security)">Güvenlik ve Yetki Testi (Security)</option>
                  <option value="Kullanılabilirlik Testi (Usability / UX)">Kullanılabilirlik Testi (Usability / UX)</option>
                  <option value="Uyumluluk ve Çapraz Platform (Compatibility)">Uyumluluk ve Çapraz Platform (Compatibility)</option>
                  <option value="Erişilebilirlik Testi (Accessibility / WCAG)">Erişilebilirlik Testi (Accessibility / WCAG)</option>
                  <option value="Güvenilirlik ve Kurtarılabilirlik (Reliability)">Güvenilirlik ve Kurtarılabilirlik (Reliability)</option>
                  <option value="Taşınabilirlik Testi (Portability)">Taşınabilirlik Testi (Portability)</option>
                </optgroup>
                <optgroup label="Değişiklikle İlgili Testler">
                  <option value="Regresyon Testi (Regression)">Regresyon Testi (Regression)</option>
                  <option value="Yeniden Test / Onaylama (Re-Testing)">Yeniden Test / Onaylama (Re-Testing)</option>
                </optgroup>
                <optgroup label="Kabul & Entegrasyon Testleri">
                  <option value="Kullanıcı Kabul Testi (UAT)">Kullanıcı Kabul Testi (UAT)</option>
                  <option value="Sistem Entegrasyon Testi (SIT)">Sistem Entegrasyon Testi (SIT)</option>
                  <option value="Yapısal / Kod Kapsama (White-Box)">Yapısal / Kod Kapsama (White-Box)</option>
                </optgroup>
              </select>
            </div>

            {/* Execution Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Koşum Türü:
              </label>
              <select
                value={executionType}
                onChange={(e) => setExecutionType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Manuel">Manuel</option>
                <option value="Otomasyon">Otomasyon</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Kritiklik:
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Kritik">Kritik</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Normal">Normal</option>
                <option value="Düşük">Düşük</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Değişiklikleri Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
