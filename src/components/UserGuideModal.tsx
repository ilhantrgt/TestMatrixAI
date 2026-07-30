import React, { useState } from 'react';
import {
  X,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Search,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  HelpCircle,
  Layers,
  ArrowRight,
  Database,
  ExternalLink,
  Code2,
  Sliders,
  CheckSquare,
  AlertTriangle,
  PlayCircle,
  Activity,
  Zap,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: 'tr' | 'en';
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  language = 'tr',
}) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'techniques' | 'jira' | 'templates' | 'faq'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-[#121721] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="bg-[#0A0C10] px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-blue-500 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                TestMatrix AI Kullanıcı Kılavuzu
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  v2.5 Live
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Gereksinim Yönetimi, Yapay Zeka Test Üretimi ve Kalete Güvence Rehberi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-[#0D1117] px-6 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <div className="flex items-center gap-1 py-2">
            <button
              onClick={() => setActiveTab('quickstart')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'quickstart'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Hızlı Başlangıç</span>
            </button>

            <button
              onClick={() => setActiveTab('techniques')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'techniques'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Test Teknikleri</span>
            </button>

            <button
              onClick={() => setActiveTab('jira')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'jira'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold">
                J
              </span>
              <span>Jira Entegrasyonu</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Şablon & Excel</span>
            </button>

            <button
              onClick={() => setActiveTab('faq')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'faq'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-rose-400" />
              <span>Soru & Cevap (SSS)</span>
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed text-slate-300">
          {/* TAB 1: QUICK START */}
          {activeTab === 'quickstart' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/20 p-5 rounded-2xl border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    TestMatrix AI Nedir?
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    TestMatrix AI; İş Analitiği metinlerinden (SRS, PRD, User Story) yazılım test mühendisliği standartlarına (ISTQB) uygun, yüksek kapsama oranına sahip otomatik Test Case'ler, İzlenebilirlik Matrisi (RTM) ve Jira hata kayıtları üreten yapay zeka destekli platformdur.
                  </p>
                </div>
              </div>

              <h4 className="font-bold text-white text-base flex items-center gap-2 pt-2 border-b border-white/10 pb-2">
                <PlayCircle className="w-5 h-5 text-indigo-400" />
                Adım Adım Kullanım Akışı
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                      1
                    </span>
                    <h5 className="font-bold text-white text-sm">Gereksinim Girme / Excel Yükleme</h5>
                  </div>
                  <p className="text-xs text-slate-400 pl-8">
                    Sol paneldeki metin alanına yazılım gereksiniminizi yapıştırın ya da bilgisayarınızdan hazır bir <strong>Excel / SRS dökümanı</strong> sürükleyip bırakın. Örnek senaryo butonlarını kullanarak hızlıca test edebilirsiniz.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                      2
                    </span>
                    <h5 className="font-bold text-white text-sm">Test Tekniklerini Seçme (Kritik)</h5>
                  </div>
                  <p className="text-xs text-slate-400 pl-8">
                    Yapay zekanın testi neye göre türeteceğini belirlemek için <strong>Fonksiyonel</strong> (Sınır Değer, Durum Geçiş, Karar Tablosu vb.) veya <strong>Fonksiyonel Olmayan</strong> (Performans, Güvenlik) tekniklerden <u>en az 1 tanesini</u> seçin.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                      3
                    </span>
                    <h5 className="font-bold text-white text-sm">Yapay Zeka Test Case Üretimi</h5>
                  </div>
                  <p className="text-xs text-slate-400 pl-8">
                    <strong>"Otomatik Test Case'leri Üret"</strong> butonuna basın. Yapay zeka gereksinimi analiz eder, seçilen tekniklere göre Ön Koşul, Adımlar, Beklenen Sonuç ve Öncelik seviyeleriyle test case'leri saniyeler içinde türetir.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                      4
                    </span>
                    <h5 className="font-bold text-white text-sm">Test Koşumu & Jira Aktarımı</h5>
                  </div>
                  <p className="text-xs text-slate-400 pl-8">
                    Üretilen test durumlarını <strong>Test Koşum Görünümü</strong> sekmesinden Başarılı/Başarısız olarak işaretleyin. Başarısız geçen adımları doğrudan kişisel <strong>Jira projenize Hata (Bug)</strong> olarak gönderin.
                  </p>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block font-semibold mb-0.5">Bulut Veri Tabanı Senkronizasyonu:</strong>
                  Girdiğiniz tüm gereksinimler, test senaryoları ve Jira konfigürasyonu Firebase Firestore bulut veritabanında Google/Kullanıcı hesabınıza özel olarak anlık saklanır. Farklı cihazlardan girdiğinizde verileriniz korunur.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEST TECHNIQUES */}
          {activeTab === 'techniques' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-base font-bold text-white mb-1">ISTQB Standartlarında Test Teknikleri</h3>
                <p className="text-xs text-slate-400">
                  Aşağıdaki teknikler yapay zeka istemine yön verir ve test durumlarının kapsama kalitesini doğrudan artırır.
                </p>
              </div>

              <div className="space-y-3">
                {/* Technique 1 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-blue-400 text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      Sınır Değer Analizi (Boundary Value Analysis - BVA)
                    </h4>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">Fonksiyonel</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Sayısal veya aralıklı alanlarda sınırların hemen altı, tam üstü ve üstündeki değerleri test eder (örn. 18-65 yaş kabul ediyorsa 17, 18, 65, 66 test edilir).
                  </p>
                </div>

                {/* Technique 2 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-indigo-400 text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      Eşdeğer Sınıflara Bölme (Equivalence Partitioning - EP)
                    </h4>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">Fonksiyonel</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Girdileri geçerli ve geçersiz kümelere bölerek gereksiz tekrarlı testleri engeller, kümeden temsilci değerlerle test türetir.
                  </p>
                </div>

                {/* Technique 3 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-purple-400 text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      Karar Tablosu (Decision Table Testing)
                    </h4>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">Fonksiyonel</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Birden fazla iş kuralının ve mantıksal durumun (AND/OR kombinasyonları) bir arada bulunduğu karmaşık iş mantıklarını doğrular.
                  </p>
                </div>

                {/* Technique 4 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      Durum Geçiş Testi (State Transition Testing)
                    </h4>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">Fonksiyonel</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Sipariş durumu (Yeni -&gt; Onaylandı -&gt; Kargoda -&gt; Teslim Edildi) gibi yaşam döngüsündeki statü değişimlerini ve geçiş kurallarını test eder.
                  </p>
                </div>

                {/* Technique 5 */}
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      Hata Tahminleme & Güvenlik (Error Guessing & Security)
                    </h4>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">Negatif / Güvenlik</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Null karakterler, SQL Injection denemeleri, yetkisiz erişim, kopan bağlantı ve beklenmeyen kullanıcı davranışlarını hedefler.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JIRA INTEGRATION */}
          {activeTab === 'jira' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Kullanıcı Bazlı Jira Entegrasyon Rehberi</h3>
                <p className="text-xs text-slate-400">
                  Her kullanıcı kendi Atlassian Jira hesabına özel bağlantı kurabilir. Bilgileriniz şifrelenmiş olarak kişisel hesabınıza kaydedilir.
                </p>
              </div>

              <div className="bg-[#0A0C10] p-5 rounded-2xl border border-white/10 space-y-4">
                <h4 className="font-bold text-blue-400 text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Jira Bilgilerini Alma Adımları:
                </h4>

                <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-300 pl-1">
                  <li>
                    <strong>Jira Alan Adı (Domain):</strong> Jira panenize giriş yaptığınız adresin alan adını yazın. Örn: <code className="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded font-mono">sirketiniz.atlassian.net</code>
                  </li>
                  <li>
                    <strong>Kullanıcı E-Postası:</strong> Atlassian hesabınızın kayıtlı e-posta adresi.
                  </li>
                  <li>
                    <strong>API Token Oluşturma:</strong>{' '}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      id.atlassian.com/manage-profile/security/api-tokens <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    adresine gidip <em>"Create API Token"</em> butonuna basın. Oluşan anahtarı kopyalayıp uygulamaya yapıştırın.
                  </li>
                  <li>
                    <strong>Proje Anahtarı (Project Key):</strong> Hataların aktarılacağı Jira projesinin kısaltma kodu (Örn: <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono">PROJ</code> veya <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono">QA</code>).
                  </li>
                </ol>

                <div className="pt-2">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Jira bağlantınızı kaydettikten sonra <strong>Test Koşumu</strong> sayfasından başarısız olan testlerin yanındaki <strong>"Jira'ya Aktar"</strong> butonuna basarak anında Jira task/bug açabilirsiniz.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEMPLATES & EXCEL */}
          {activeTab === 'templates' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Şablon Konfigüratörü ve Özel Excel Yapısı</h3>
                <p className="text-xs text-slate-400">
                  Şirketinizin test yönetim aracına veya iç standartlarına uygun sütun başlıklarıyla dışa aktarım yapın.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-2">
                  <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Hazır Şablonlar
                  </h4>
                  <p className="text-xs text-slate-300">
                    Header'daki <strong>"Şablon"</strong> butonuna tıklayarak <em>Standard QA</em>, <em>Jira Xray Compatible</em>, <em>Zephyr Scale Format</em> veya <em>Agile Lean Format</em> şablonlarından birini tek tıkla seçebilirsiniz.
                  </p>
                </div>

                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-2">
                  <h4 className="font-bold text-blue-400 text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    Kendi Excel Şablonunu Yükleme
                  </h4>
                  <p className="text-xs text-slate-300">
                    Kendi kurumsal Excel (.xlsx) şablonunuzu yüklediğinizde, uygulamanın sütun isimlerini sizin başlıklarınıza otomatik eşlemesini sağlayabilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Sıkça Sorulan Sorular (SSS)</h3>
                <p className="text-xs text-slate-400">Karşılaşabileceğiniz durumlar ve çözümleri.</p>
              </div>

              <div className="space-y-3">
                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-rose-400" />
                    "Otomatik Test Case'leri Üret" butonu neden tıklanamıyor?
                  </h4>
                  <p className="text-xs text-slate-400 pl-6">
                    Test case üretilebilmesi için <strong>en az 1 test tekniğinin</strong> (Fonksiyonel veya Fonksiyonel Olmayan Testler) işaretlenmiş olması gerekmektedir. Ayrıca sol taraftaki gereksinim metin alanı boş olmamalıdır.
                  </p>
                </div>

                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-400" />
                    Farklı bir bilgisayardan girdiğimde verilerim korunur mu?
                  </h4>
                  <p className="text-xs text-slate-400 pl-6">
                    Evet, Google hesabınızla giriş yaptığınızda üretilen tüm test senaryoları, gereksinim dökümanı ve Jira ayarlarınız bulut veritabanında hesabınıza bağlı saklanır.
                  </p>
                </div>

                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    Jira konfigürasyonum başkaları tarafından görülebilir mi?
                  </h4>
                  <p className="text-xs text-slate-400 pl-6">
                    Hayır. Jira API Token ve bağlantı bilgileriniz her kullanıcı hesabına özel izolasyonla saklanır. Başka bir kullanıcı sisteme girdiğinde kendi boş veya kayıtlı formunu görür.
                  </p>
                </div>

                <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/10 space-y-1">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-purple-400" />
                    Traceability Matrix (RTM) nasıl çalışır?
                  </h4>
                  <p className="text-xs text-slate-400 pl-6">
                    Gereksinimdeki her bir iş kuralı (REQ-001, REQ-002...) üretilen test case'lerle otomatik eşleştirilir. Bu sayede hiçbir gereksinimin test edilmeden kalmadığı (%100 Kapsama) görsel grafiklerle doğrulanır.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0A0C10] px-6 py-3.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>TestMatrix AI - Quality Assurance Platform</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-600/30"
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
