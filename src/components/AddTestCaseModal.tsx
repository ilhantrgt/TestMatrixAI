import React, { useState, useEffect } from 'react';
import { TestCase, RequirementItem } from '../types';
import { X, Plus, Layers, FileCheck, CheckCircle, ListPlus, Shield, AlertTriangle } from 'lucide-react';
import { generateNextTestCaseId } from '../utils/idGenerator';

interface AddTestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: RequirementItem[];
  testCases?: TestCase[];
  defaultReqId?: string;
  onAddTestCase: (newTc: TestCase) => void;
  language?: 'tr' | 'en';
}

export const AddTestCaseModal: React.FC<AddTestCaseModalProps> = ({
  isOpen,
  onClose,
  requirements,
  testCases = [],
  defaultReqId,
  onAddTestCase,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const [selectedReqId, setSelectedReqId] = useState<string>('');
  const [tcId, setTcId] = useState<string>('');
  const [moduleName, setModuleName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [preconditions, setPreconditions] = useState<string>('');
  const [stepsText, setStepsText] = useState<string>('');
  const [testData, setTestData] = useState<string>('');
  const [expectedResult, setExpectedResult] = useState<string>('');
  const [priority, setPriority] = useState<TestCase['priority']>('Orta');
  const [testType, setTestType] = useState<TestCase['testType']>('Pozitif');
  const [executionType, setExecutionType] = useState<TestCase['executionType']>('Manuel');
  const [severity, setSeverity] = useState<TestCase['severity']>('Normal');

  // Initialize form whenever modal opens or defaultReqId changes
  useEffect(() => {
    if (isOpen) {
      const initialReqId = defaultReqId || requirements[0]?.id || 'REQ-01';
      setSelectedReqId(initialReqId);

      const targetReq = requirements.find((r) => r.id === initialReqId);
      const mod = targetReq?.category || targetReq?.title || (isEn ? 'General Module' : 'Genel Modül');
      setModuleName(mod);

      // Generate next sequential ID for this requirement
      const nextId = generateNextTestCaseId(initialReqId, testCases);
      setTcId(nextId);

      setTitle('');
      setDescription('');
      setPreconditions(
        isEn
          ? 'System is active and user is logged in.'
          : 'Sistem aktif ve kullanıcı oturum açmış durumda.'
      );
      setStepsText(
        isEn
          ? '1. Access the relevant page.\n2. Input the required parameters.\n3. Click confirm button.'
          : '1. İlgili sayfaya erişin.\n2. Gerekli verileri girin.\n3. Onay butonuna tıklayın.'
      );
      setTestData(isEn ? 'Sample test data' : 'Örnek test verisi');
      setExpectedResult(
        isEn
          ? 'Operation completes successfully with confirmation message.'
          : 'İşlem başarıyla tamamlanmalı ve sistem uygun mesajı göstermelidir.'
      );
      setPriority('Orta');
      setTestType('Pozitif');
      setExecutionType('Manuel');
      setSeverity('Normal');
    }
  }, [isOpen, defaultReqId, requirements, testCases, isEn]);


  // Update module name and ID when req ID changes
  const handleReqChange = (newReqId: string) => {
    setSelectedReqId(newReqId);
    const targetReq = requirements.find((r) => r.id === newReqId);
    if (targetReq) {
      setModuleName(targetReq.category || targetReq.title || 'Genel Modül');
    }
    const nextId = generateNextTestCaseId(newReqId, testCases);
    setTcId(nextId);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Lütfen test senaryosu başlığını girin.');
      return;
    }

    // Process steps line-by-line
    const parsedSteps = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newTestCase: TestCase = {
      id: tcId.trim() || `TC-${Date.now().toString().slice(-4)}`,
      reqId: selectedReqId,
      module: moduleName.trim() || 'Genel Modül',
      title: title.trim(),
      description: description.trim() || title.trim(),
      preconditions: preconditions.trim(),
      steps: parsedSteps.length > 0 ? parsedSteps : ['1. Test adımını gerçekleştir.'],
      testData: testData.trim(),
      expectedResult: expectedResult.trim(),
      priority,
      testType,
      executionType,
      severity,
    };

    onAddTestCase(newTestCase);
    onClose();
  };

  const selectedReqObj = requirements.find((r) => r.id === selectedReqId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manuel Test Case Ekle</span>
                <span className="text-xs font-mono font-normal bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  {selectedReqId}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Seçili gereksinime özel yeni manuel test senaryosu tanımlayın.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Requirement Selector */}
          <div className="bg-slate-950/60 p-3.5 border border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Hedef Gereksinim (Requirement):
            </label>
            <select
              value={selectedReqId}
              onChange={(e) => handleReqChange(e.target.value)}
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
                Gereksinim Tanımı: {selectedReqObj.description}
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
                placeholder="Örn: TC-REQ01-01"
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
              placeholder="Örn: Geçersiz Kart Numarası İle Ödeme Denemesi"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Preconditions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Test Ön Koşulu (Preconditions):
            </label>
            <input
              type="text"
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              placeholder="Örn: Kullanıcı giriş yapmış ve sepette 1 ürün ekli olmalıdır."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Test Steps */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Test Adımları (Her adımı yeni satıra yazın):
            </label>
            <textarea
              rows={4}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={'1. Ödeme sayfasına gidin.\n2. Kart numarası alanına "4000 0000 0000 0000" girin.\n3. Öde butonuna basın.'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Data */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Test Verisi (Test Data):
              </label>
              <textarea
                rows={3}
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder="Örn: Kart No: 4000..., SKT: 12/28, CVV: 123"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Expected Result */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Beklenen Sonuç (Expected Result):
              </label>
              <textarea
                rows={3}
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="Örn: 'Geçersiz Kart' uyarısı alınmalı ve işlem iptal edilmelidir."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Categorization & Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-3.5 border border-slate-800 rounded-xl">
            {/* Test Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Test Tipi (ISTQB):
              </label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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

            {/* Priority */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Öncelik:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Yüksek">Yüksek</option>
                <option value="Orta">Orta</option>
                <option value="Düşük">Düşük</option>
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Manuel">Manuel</option>
                <option value="Otomasyon">Otomasyon</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Kritiklik (Severity):
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Kritik">Kritik</option>
                <option value="Yüksek">Yüksek</option>
                <option value="Normal">Normal</option>
                <option value="Düşük">Düşük</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Test Senaryosunu Ekle</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
