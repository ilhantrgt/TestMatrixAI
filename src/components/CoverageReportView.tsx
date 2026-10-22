import React, { useState } from 'react';
import {
  RequirementItem,
  TestCase,
  GenerationStats,
} from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  PieChart,
  HelpCircle,
  ChevronRight,
  Filter,
  Layers,
  Zap,
  ArrowRight,
  Info,
  Loader2,
  Check,
  X,
} from 'lucide-react';

interface CoverageReportViewProps {
  requirements: RequirementItem[];
  testCases: TestCase[];
  stats: GenerationStats;
  recommendations?: string[];
  onAutoGenerateMissing: (req: RequirementItem) => Promise<number | void> | void;
  onExpandAllCoverage?: () => Promise<number | void> | void;
  isRefining: boolean;
  isRefiningReqId?: string | null;
  language?: 'tr' | 'en';
}

export const CoverageReportView: React.FC<CoverageReportViewProps> = ({
  requirements,
  testCases,
  stats,
  recommendations,
  onAutoGenerateMissing,
  onExpandAllCoverage,
  isRefining,
  isRefiningReqId,
  language = 'tr',
}) => {
  const [filter, setFilter] = useState<'all' | 'full' | 'partial' | 'uncovered'>('all');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [completedReqIds, setCompletedReqIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isExpandingAll, setIsExpandingAll] = useState(false);

  const handleExpandAllClick = async () => {
    if (!onExpandAllCoverage) return;
    setIsExpandingAll(true);
    try {
      const result = await onExpandAllCoverage();
      const countText = typeof result === 'number' && result > 0 ? ` (${result} yeni test senaryosu eklendi)` : '';
      setToastMsg(`✓ Tüm gereksinimler için ISTQB test tiplerinden senaryolar başarıyla üretildi!${countText}`);
      setTimeout(() => setToastMsg(null), 8000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExpandingAll(false);
    }
  };

  const handleCompleteClick = async (req: RequirementItem) => {
    try {
      const result = await onAutoGenerateMissing(req);
      setCompletedReqIds((prev) => new Set([...prev, req.id]));
      const countText = typeof result === 'number' && result > 0 ? ` (${result} yeni test senaryosu eklendi)` : '';
      setToastMsg(`✓ ${req.id} gereksinimi için eksik testler başarıyla tamamlandı!${countText}`);
      setTimeout(() => setToastMsg(null), 6000);
    } catch (e) {
      console.error(e);
    }
  };

  // Group test cases by reqId
  const getTCsForReq = (reqId: string) => {
    return testCases.filter(
      (tc) => tc.reqId.toLowerCase().trim() === reqId.toLowerCase().trim()
    );
  };

  const fullyCoveredCount = requirements.filter(
    (r) => r.coverageStatus === 'Full' || getTCsForReq(r.id).length >= 2
  ).length;

  const partiallyCoveredCount = requirements.filter(
    (r) => r.coverageStatus === 'Partial' || (getTCsForReq(r.id).length === 1)
  ).length;

  const uncoveredCount = requirements.filter(
    (r) => r.coverageStatus === 'Uncovered' || getTCsForReq(r.id).length === 0
  ).length;

  const filteredReqs = requirements.filter((req) => {
    const tcs = getTCsForReq(req.id);
    const status = req.coverageStatus || (tcs.length >= 2 ? 'Full' : tcs.length === 1 ? 'Partial' : 'Uncovered');
    if (filter === 'full') return status === 'Full';
    if (filter === 'partial') return status === 'Partial';
    if (filter === 'uncovered') return status === 'Uncovered';
    return true;
  });

  return (
    <div className="space-y-6 text-slate-100">
      {/* Coverage Methodology Explanation Header */}
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 font-bold bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                QA Matrix Engine
              </span>
              <span className="text-xs text-slate-400 font-medium">• Otomatik Kapsam & Eksik Analiz Raporu</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-400" />
              Gereksinim Kapsama ve Eksiklik Analizi
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Yapay zeka modeli, SRS dökümanınızdaki tüm gereksinimleri ($R_1, R_2, \dots$) atomik olarak ayrıştırır ve türetilen test senaryolarının bu maddelerin pozitif akışlarını, negatif durumlarını, sınır değerlerini (BVA) ve güvenlik gereksinimlerini ne oranda kapsadığını ISTQB QA ilkelerine göre hesaplar.
            </p>
          </div>

          {/* Action Card & Formula */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[280px]">
            {onExpandAllCoverage && (
              <button
                onClick={handleExpandAllClick}
                disabled={isExpandingAll || isRefining}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-900/30 border border-blue-400/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isExpandingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Tüm Kapsam Genişletiliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>Kapsamı Genişlet: Tüm ISTQB Tiplerinden Ekle</span>
                  </>
                )}
              </button>
            )}

            <div className="bg-[#0A0C10] border border-white/10 p-4 rounded-xl flex flex-col justify-between flex-1">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Hesaplama Formülü</span>
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" title="Kapsama Oranı Formülü" />
              </div>
              <div className="font-mono text-xs bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-blue-300">
                Kapsama % = (Test Edilen Req / Toplam Req) × 100
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Toplam Kapsama Score:</span>
                <span className="font-extrabold text-emerald-400 text-sm">%{stats.coverageScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
          <div className="bg-[#0A0C10] border border-white/10 p-3.5 rounded-xl">
            <div className="text-[11px] text-slate-400 font-medium">Toplam Gereksinim</div>
            <div className="text-2xl font-black text-white mt-1">{requirements.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Analiz Edilen Döküman</div>
          </div>

          <div className="bg-[#0A0C10] border border-emerald-500/20 p-3.5 rounded-xl">
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tam Kapsanan
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{fullyCoveredCount}</div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">Pozitif + Negatif Tam</div>
          </div>

          <div className="bg-[#0A0C10] border border-amber-500/20 p-3.5 rounded-xl">
            <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Kısmi Kapsanan
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">{partiallyCoveredCount}</div>
            <div className="text-[10px] text-amber-500/80 mt-0.5">Edge Cases/Hata Senaryosu Eksik</div>
          </div>

          <div className="bg-[#0A0C10] border border-rose-500/20 p-3.5 rounded-xl">
            <div className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Eksik / Kapsanmayan
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">{uncoveredCount}</div>
            <div className="text-[10px] text-rose-500/80 mt-0.5">0 Test Senaryosu Bağlı</div>
          </div>
        </div>
      </div>

      {/* Toast Notification Banner when Missing Tests Completed */}
      {toastMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-300 text-sm">{toastMsg}</p>
              <p className="text-[11px] text-emerald-400/80">
                Yeni üretilen test senaryoları Test Case Matrisine ve RTM'ye otomatik olarak eklenmiştir.
              </p>
            </div>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="p-1 hover:bg-emerald-800/50 rounded-lg text-emerald-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recommendations & Risk Analysis Box */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-[#0D1117] border border-blue-500/20 rounded-2xl p-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-blue-300 uppercase tracking-wider text-[11px] mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Yapay Zeka Test Mühendisliği Kapsam ve Risk Değerlendirmesi</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="bg-[#0A0C10] p-3 rounded-xl border border-white/5 flex items-start gap-2.5 text-slate-300"
              >
                <ChevronRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requirement Filter & List Header */}
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Gereksinim Detaylı Kapsam Tablosu
            </h3>
            <p className="text-xs text-slate-400">
              Hangi gereksinimlerin test edildiğini ve hangilerinin ne tür eksikleri olduğunu inceleyin.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#0A0C10] p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tümü ({requirements.length})
            </button>
            <button
              onClick={() => setFilter('full')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'full'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Tam Kapsananlar ({fullyCoveredCount})
            </button>
            <button
              onClick={() => setFilter('partial')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'partial'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              Kısmi Kapsananlar ({partiallyCoveredCount})
            </button>
            <button
              onClick={() => setFilter('uncovered')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'uncovered'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Eksik Kalanlar ({uncoveredCount})
            </button>
          </div>
        </div>

        {/* Requirements Detailed List */}
        <div className="space-y-3">
          {filteredReqs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Seçilen filtreye uygun gereksinim bulunamadı.
            </div>
          ) : (
            filteredReqs.map((req) => {
              const matchedTCs = getTCsForReq(req.id);
              const status =
                req.coverageStatus ||
                (matchedTCs.length >= 2 ? 'Full' : matchedTCs.length === 1 ? 'Partial' : 'Uncovered');

              const positiveTCs = matchedTCs.filter((tc) => tc.testType === 'Pozitif');
              const negativeTCs = matchedTCs.filter((tc) => tc.testType === 'Negatif');
              const edgeTCs = matchedTCs.filter(
                (tc) =>
                  String(tc.testType).includes('Sınır') ||
                  tc.testType === 'Güvenlik' ||
                  tc.testType === 'Performans'
              );

              return (
                <div
                  key={req.id}
                  className={`bg-[#0A0C10] border rounded-xl p-4 transition-all ${
                    status === 'Full'
                      ? 'border-emerald-500/20 hover:border-emerald-500/40'
                      : status === 'Partial'
                      ? 'border-amber-500/30 hover:border-amber-500/50'
                      : 'border-rose-500/30 hover:border-rose-500/50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Req Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
                          {req.id}
                        </span>
                        {req.category && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded uppercase font-mono">
                            {req.category}
                          </span>
                        )}

                        {/* Status Badge */}
                        {status === 'Full' && (
                          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Tam Kapsandı (%100)
                          </span>
                        )}
                        {status === 'Partial' && (
                          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Kısmi Kapsandı (Hata/Edge Case Eksik)
                          </span>
                        )}
                        {status === 'Uncovered' && (
                          <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Eksik / Test Üretilmedi
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-white">{req.title}</h4>
                      <p className="text-xs text-slate-300 line-clamp-2">{req.description}</p>
                    </div>

                      {/* Right: Actions & TC Counts */}
                      <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10 justify-between md:justify-end">
                        <div className="text-right text-xs space-y-0.5">
                          <div className="text-slate-300 font-semibold">
                            <strong className="text-blue-400">{matchedTCs.length}</strong> Test Senaryosu
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {positiveTCs.length} Pozitif • {negativeTCs.length} Negatif • {edgeTCs.length} Sınır/Güvenlik
                          </div>
                        </div>

                        {isRefiningReqId === req.id ? (
                          <button
                            disabled
                            className="bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-2 cursor-wait"
                          >
                            <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                            <span>Eksik Testler Tamamlanıyor...</span>
                          </button>
                        ) : completedReqIds.has(req.id) ? (
                          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Eksik Testler Tamamlandı</span>
                          </div>
                        ) : (status === 'Partial' || status === 'Uncovered') ? (
                          <button
                            onClick={() => handleCompleteClick(req)}
                            disabled={isRefining}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                            title="Yapay zekanın bu gereksinimin eksik kalan negatif/sınır senaryolarını tamamlamasını sağlayın"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Eksik Testleri Tamamla</span>
                          </button>
                        ) : null}
                      </div>
                  </div>

                  {/* Missing Gap Details if Partial/Uncovered */}
                  {(status === 'Partial' || status === 'Uncovered') && req.gapDescription && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>Eksiklik Tespiti:</strong> {req.gapDescription}
                      </div>
                    </div>
                  )}

                  {/* Linked Test Cases Pills */}
                  {matchedTCs.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-mono text-slate-500 font-bold">
                        Bağlı Senaryolar:
                      </span>
                      {matchedTCs.map((tc) => (
                        <span
                          key={tc.id}
                          className="font-mono text-[11px] bg-slate-900 border border-slate-800 text-blue-300 px-2 py-0.5 rounded"
                        >
                          {tc.id} ({tc.testType})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
