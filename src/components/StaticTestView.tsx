import React, { useState } from 'react';
import {
  RequirementItem,
  RequirementStaticTestReport,
  OverallStaticTestSummary,
  StaticTestFinding,
  StaticTestSeverity,
  StaticTestDimension,
  QualityGateStatus,
} from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Sliders,
  FileCheck2,
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  HelpCircle,
  Download,
  Info,
  Bug,
  Lightbulb,
  ExternalLink,
  Zap,
} from 'lucide-react';

interface StaticTestViewProps {
  requirements: RequirementItem[];
  requirementText: string;
  staticTestReports?: Record<string, RequirementStaticTestReport>;
  staticTestSummary?: OverallStaticTestSummary | null;
  isAnalyzing: boolean;
  onRunStaticTest: () => Promise<void> | void;
  onApplyImprovedRequirement: (reqId: string, improvedVersion: string) => void;
  onProceedToTestGeneration?: () => void;
  language?: 'tr' | 'en';
}

export const StaticTestView: React.FC<StaticTestViewProps> = ({
  requirements,
  requirementText,
  staticTestReports = {},
  staticTestSummary,
  isAnalyzing,
  onRunStaticTest,
  onApplyImprovedRequirement,
  onProceedToTestGeneration,
  language = 'tr',
}) => {
  const isTr = language !== 'en';
  const [filterStatus, setFilterStatus] = useState<'all' | 'blocked' | 'needs_review' | 'ready'>('all');
  const [filterDimension, setFilterDimension] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const hasReports = Object.keys(staticTestReports).length > 0;

  // Filtered requirements list
  const filteredList = requirements.filter((req) => {
    const report = staticTestReports[req.id];
    if (filterStatus !== 'all') {
      if (filterStatus === 'blocked' && report?.qualityGateStatus !== 'blocked') return false;
      if (filterStatus === 'needs_review' && report?.qualityGateStatus !== 'needs_review') return false;
      if (filterStatus === 'ready' && report?.qualityGateStatus !== 'ready') return false;
    }

    if (filterDimension !== 'all' && report?.findings) {
      const hasDim = report.findings.some((f) => f.dimension === filterDimension);
      if (!hasDim) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inId = req.id.toLowerCase().includes(q);
      const inTitle = req.title.toLowerCase().includes(q);
      const inDesc = req.description.toLowerCase().includes(q);
      const inFindings = report?.findings?.some(
        (f) => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      );
      if (!inId && !inTitle && !inDesc && !inFindings) return false;
    }

    return true;
  });

  const handleCopyImproved = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyClick = (reqId: string, improvedVersion: string) => {
    onApplyImprovedRequirement(reqId, improvedVersion);
    setAppliedIds((prev) => new Set(prev).add(reqId));
  };

  const getSeverityBadge = (severity: StaticTestSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            {isTr ? 'Kritik Kusur' : 'Critical Defect'}
          </span>
        );
      case 'major':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            {isTr ? 'Majör Kusur' : 'Major Defect'}
          </span>
        );
      case 'minor':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" />
            {isTr ? 'Minör Kusur' : 'Minor Defect'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {isTr ? 'Bilgi' : 'Info'}
          </span>
        );
    }
  };

  const getDimensionLabel = (dim: StaticTestDimension) => {
    switch (dim) {
      case 'clarity':
        return isTr ? 'Açıklık & Belirsizlik' : 'Clarity & Ambiguity';
      case 'consistency':
        return isTr ? 'Tutarlılık' : 'Consistency';
      case 'completeness':
        return isTr ? 'Eksiksizlik & Uç Durum' : 'Completeness & Edge Cases';
      case 'testability':
        return isTr ? 'Test Edilebilirlik' : 'Testability & Verifiability';
      case 'atomicity':
        return isTr ? 'Atomiklik' : 'Atomicity';
      default:
        return dim;
    }
  };

  const getStatusBadge = (status?: QualityGateStatus) => {
    if (status === 'blocked') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          {isTr ? 'BLOKE EDİLDİ' : 'BLOCKED'}
        </span>
      );
    }
    if (status === 'needs_review') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {isTr ? 'İNCELEME GEREKLİ' : 'NEEDS REVIEW'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        {isTr ? 'TESTE HAZIR (ONAYLANDI)' : 'READY FOR TEST'}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 border-emerald-500 bg-emerald-50';
    if (score >= 60) return 'text-amber-600 border-amber-500 bg-amber-50';
    return 'text-rose-600 border-rose-500 bg-rose-50';
  };

  const downloadJsonReport = () => {
    const reportData = {
      summary: staticTestSummary,
      reports: staticTestReports,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `static-test-quality-gate-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner / Concept Intro */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>ISTQB & IEEE 830 / ISO 29148 Standardı</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <FileCheck2 className="w-8 h-8 text-indigo-400" />
              {isTr ? 'Gereksinimlerin Statik Testi & Kalite Kapısı' : 'Static Testing of Requirements & Quality Gate'}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {isTr
                ? 'Yazılım geliştirme ve test senaryosu tasarımına başlanmadan önce gereksinimlerin kalitesini, açıklığını, tutarlılığını, eksiksizliğini ve test edilebilirliğini doğrular. Kalite problemi ve potansiyel risk barındıran yetersiz maddelerin sonraki aşamalara taşınmasını engeller.'
                : 'Systematically evaluates requirements quality, clarity, consistency, completeness, and verifiability before software development and test authoring start to prevent defective specifications from moving downstream.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto">
            <button
              onClick={() => onRunStaticTest()}
              disabled={isAnalyzing}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? (isTr ? 'Analiz Yapılıyor...' : 'Analyzing...') : (isTr ? 'Statik Testi Çalıştır' : 'Run Static Test')}</span>
            </button>

            {hasReports && (
              <button
                onClick={downloadJsonReport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                title={isTr ? 'Raporu JSON formatında indir' : 'Download JSON report'}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{isTr ? 'Raporu İndir' : 'Export'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* If Not Analyzed Yet */}
      {!hasReports && !isAnalyzing && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            {isTr ? 'Gereksinimler Henüz Statik Teste Tabi Tutulmadı' : 'Requirements Not Yet Statically Tested'}
          </h3>
          <p className="text-sm text-slate-500 max-w-xl mx-auto mb-6">
            {isTr
              ? 'Yazılım test tasarımına ve test senaryosu üretimine geçmeden önce gereksinim metnindeki muğlak kelimeleri ("hızlı", "kolay", "vb."), eksik hata durumlarını ve test edilemeyen hükümleri tespit etmek için statik testi başlatın.'
              : 'Before authoring test cases, run static analysis to catch ambiguous phrasing, missing exception flows, and untestable acceptance criteria.'}
          </p>
          <button
            onClick={() => onRunStaticTest()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
          >
            <Zap className="w-4 h-4" />
            <span>{isTr ? 'Statik Kalite Analizini Başlat' : 'Start Static Quality Analysis'}</span>
          </button>
        </div>
      )}

      {/* When Analyzed: Dashboard & Summary */}
      {hasReports && (
        <>
          {/* Executive Quality Gate Result Banner */}
          {staticTestSummary && (
            <div
              className={`rounded-2xl p-6 border shadow-sm transition-all ${
                staticTestSummary.qualityGateResult === 'BLOCK'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : staticTestSummary.qualityGateResult === 'CONDITIONAL'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${
                      staticTestSummary.qualityGateResult === 'BLOCK'
                        ? 'bg-rose-100 text-rose-700'
                        : staticTestSummary.qualityGateResult === 'CONDITIONAL'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {staticTestSummary.qualityGateResult === 'BLOCK' ? (
                      <ShieldAlert className="w-8 h-8" />
                    ) : staticTestSummary.qualityGateResult === 'CONDITIONAL' ? (
                      <AlertTriangle className="w-8 h-8" />
                    ) : (
                      <ShieldCheck className="w-8 h-8" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-extrabold tracking-wider opacity-75">
                        {isTr ? 'Kalite Kapısı (Quality Gate) Sonucu' : 'Quality Gate Outcome'}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                          staticTestSummary.qualityGateResult === 'BLOCK'
                            ? 'bg-rose-200 text-rose-900'
                            : staticTestSummary.qualityGateResult === 'CONDITIONAL'
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-emerald-200 text-emerald-900'
                        }`}
                      >
                        {staticTestSummary.qualityGateResult === 'BLOCK'
                          ? isTr
                            ? 'BLOKE EDİLDİ (TEST TASARIMI DURDURULDU)'
                            : 'BLOCKED (DO NOT PROCEED)'
                          : staticTestSummary.qualityGateResult === 'CONDITIONAL'
                          ? isTr
                            ? 'ŞARTLI GEÇİŞ (REVİZYON ÖNERİLİR)'
                            : 'CONDITIONAL (REVIEWS NEEDED)'
                          : isTr
                          ? 'BAŞARIYLA GEÇTİ (TESTE HAZIR)'
                          : 'PASSED (READY FOR TEST)'}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold mt-1">
                      {staticTestSummary.qualityGateResult === 'BLOCK'
                        ? isTr
                          ? `${staticTestSummary.blockedCount} adet gereksinim Kalite Kapısına takıldı. Test tasarımına başlanamaz!`
                          : `${staticTestSummary.blockedCount} requirements failed the Quality Gate. Resolve critical defects first!`
                        : staticTestSummary.qualityGateResult === 'CONDITIONAL'
                        ? isTr
                          ? 'Gereksinimlerde bazı belirsizlikler ve eksik hata durumları mevcut. İyileştirme önerilir.'
                          : 'Requirements contain minor ambiguities and missing edge cases. Revisions suggested.'
                        : isTr
                        ? 'Tüm gereksinimler ISTQB kalite ve test edilebilirlik standartlarını karşılamaktadır.'
                        : 'All requirements meet ISTQB quality and testability criteria.'}
                    </h2>

                    <p className="text-xs sm:text-sm mt-1 opacity-90 max-w-3xl">
                      {isTr
                        ? 'Kalitesiz gereksinimler test mühendislerinin geçersiz test senaryoları yazmasına ve yazılımda kritik mimari hatalara neden olur. Bloke edilen maddeler için önerilen iyileştirmeleri uygulayarak gereksinimlerinizi güncelleyebilirsiniz.'
                        : 'Poor requirements cause invalid test design and architectural defects. Use the suggested refactorings to fix blocked items before authoring test cases.'}
                    </p>
                  </div>
                </div>

                {onProceedToTestGeneration && (
                  <button
                    onClick={onProceedToTestGeneration}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-sm transition-all whitespace-nowrap"
                  >
                    <span>{isTr ? 'Test Senaryolarına Geç' : 'Proceed to Test Cases'}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Quality Score */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {isTr ? 'Gereksinim Kalite Skoru' : 'Overall Quality Score'}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {staticTestSummary?.overallScore ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">/ 100</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {staticTestSummary && staticTestSummary.overallScore >= 80
                    ? isTr
                      ? 'Yüksek Kalite Seviyesi'
                      : 'High Quality Grade'
                    : staticTestSummary && staticTestSummary.overallScore >= 60
                    ? isTr
                      ? 'Orta Seviye (Revizyon Gerekli)'
                      : 'Moderate Quality'
                    : isTr
                    ? 'Kritik Kalite Yetersizliği'
                    : 'Critical Quality Deficit'}
                </p>
              </div>

              <div
                className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center font-bold text-lg ${getScoreColor(
                  staticTestSummary?.overallScore ?? 0
                )}`}
              >
                {staticTestSummary?.overallScore ?? 0}%
              </div>
            </div>

            {/* Quality Gate Status Counts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isTr ? 'Kalite Kapısı Dağılımı' : 'Quality Gate Distribution'}
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {isTr ? 'Teste Hazır:' : 'Ready:'}
                  </span>
                  <span className="font-bold text-slate-800">{staticTestSummary?.readyCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {isTr ? 'İnceleme Gerekli:' : 'Review Needed:'}
                  </span>
                  <span className="font-bold text-slate-800">{staticTestSummary?.needsReviewCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-rose-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    {isTr ? 'Bloke Edildi:' : 'Blocked:'}
                  </span>
                  <span className="font-bold text-slate-800">{staticTestSummary?.blockedCount ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Defect Severity Counts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isTr ? 'Tespit Edilen Kusurlar' : 'Identified Defects'}
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-rose-700 font-medium">
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    {isTr ? 'Kritik Kusur:' : 'Critical:'}
                  </span>
                  <span className="font-bold text-rose-700">
                    {staticTestSummary?.criticalDefects ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {isTr ? 'Majör Belirsizlik:' : 'Major:'}
                  </span>
                  <span className="font-bold text-amber-700">{staticTestSummary?.majorDefects ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    {isTr ? 'Minör Kusur:' : 'Minor:'}
                  </span>
                  <span className="font-bold text-blue-700">{staticTestSummary?.minorDefects ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Dimension Breakdown Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isTr ? 'Boyut Başarı Ortalamaları' : 'Dimension Averages'}
              </p>
              <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{isTr ? 'Açıklık:' : 'Clarity:'}</span>
                  <span className="font-bold text-slate-800">
                    %{staticTestSummary?.dimensionAverages?.clarity ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{isTr ? 'Eksiksizlik:' : 'Completeness:'}</span>
                  <span className="font-bold text-slate-800">
                    %{staticTestSummary?.dimensionAverages?.completeness ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{isTr ? 'Test Edilebilirlik:' : 'Testability:'}</span>
                  <span className="font-bold text-slate-800">
                    %{staticTestSummary?.dimensionAverages?.testability ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Risks & Recommendations Callout */}
          {staticTestSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-rose-400 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>{isTr ? 'Erken Aşama Potansiyel Riskleri' : 'Identified Early Phase Risks'}</span>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  {staticTestSummary.keyRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-indigo-950 text-indigo-100 rounded-2xl p-5 border border-indigo-900 shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-indigo-300 font-bold text-sm">
                  <Lightbulb className="w-4 h-4 text-indigo-300" />
                  <span>{isTr ? 'Kalite İyileştirme ve Aksiyon Önerileri' : 'Actionable Quality Recommendations'}</span>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-indigo-200">
                  {staticTestSummary.qualityRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Requirements Filter & Explorer Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isTr
                      ? 'Gereksinim no, başlık veya kusur ara...'
                      : 'Search by requirement ID, title, or defect...'
                  }
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    filterStatus === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isTr ? 'Tümü' : 'All'} ({requirements.length})
                </button>
                <button
                  onClick={() => setFilterStatus('blocked')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    filterStatus === 'blocked'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  {isTr ? 'Bloke Olanlar' : 'Blocked'} ({staticTestSummary?.blockedCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterStatus('needs_review')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    filterStatus === 'needs_review'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {isTr ? 'İnceleme Gerekli' : 'Review'} ({staticTestSummary?.needsReviewCount ?? 0})
                </button>
                <button
                  onClick={() => setFilterStatus('ready')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    filterStatus === 'ready'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  {isTr ? 'Teste Hazır' : 'Ready'} ({staticTestSummary?.readyCount ?? 0})
                </button>
              </div>
            </div>

            {/* Dimension Filter Tabs */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs overflow-x-auto">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                {isTr ? 'Kusur Boyutu:' : 'Dimension:'}
              </span>
              {[
                { id: 'all', label: isTr ? 'Tüm Boyutlar' : 'All Dimensions' },
                { id: 'clarity', label: isTr ? 'Açıklık & Belirsizlik' : 'Clarity' },
                { id: 'completeness', label: isTr ? 'Eksiksizlik & İstisnalar' : 'Completeness' },
                { id: 'testability', label: isTr ? 'Test Edilebilirlik' : 'Testability' },
                { id: 'consistency', label: isTr ? 'Tutarlılık' : 'Consistency' },
                { id: 'atomicity', label: isTr ? 'Atomiklik' : 'Atomicity' },
              ].map((dim) => (
                <button
                  key={dim.id}
                  onClick={() => setFilterDimension(dim.id)}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium whitespace-nowrap ${
                    filterDimension === dim.id
                      ? 'bg-indigo-100 text-indigo-700 font-bold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {dim.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requirements List Cards */}
          <div className="space-y-4">
            {filteredList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                {isTr ? 'Filtreye uygun gereksinim bulunamadı.' : 'No requirements match the selected filter.'}
              </div>
            ) : (
              filteredList.map((req, idx) => {
                const report = staticTestReports[req.id];
                const isExpanded = expandedReqId === req.id;
                const isApplied = appliedIds.has(req.id);
                const findingsCount = report?.findings?.length ?? 0;

                return (
                  <div
                    key={`${req.id}-${idx}`}
                    className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
                      report?.qualityGateStatus === 'blocked'
                        ? 'border-rose-300 hover:border-rose-400'
                        : report?.qualityGateStatus === 'needs_review'
                        ? 'border-amber-300 hover:border-amber-400'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                      className="p-5 cursor-pointer hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <button
                          type="button"
                          className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>

                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {req.id}
                            </span>
                            {req.category && (
                              <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                                {req.category}
                              </span>
                            )}
                            {getStatusBadge(report?.qualityGateStatus)}
                            {isApplied && (
                              <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                {isTr ? 'İyileştirme Uygulandı' : 'Refactor Applied'}
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-slate-900">{req.title}</h3>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 max-w-3xl">
                            {req.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Score & Defect Badges */}
                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Bug className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800">{findingsCount}</span>
                          <span>{isTr ? 'Kusur' : 'Defects'}</span>
                        </div>

                        <div
                          className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-sm ${getScoreColor(
                            report?.score ?? 0
                          )}`}
                        >
                          {report?.score ?? 0}%
                        </div>
                      </div>
                    </div>

                    {/* Card Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-6">
                        {/* Requirement Text vs Dimension Scores */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Left: Original Requirement Text */}
                          <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              {isTr ? 'Orijinal Gereksinim Metni' : 'Original Requirement Specification'}
                            </h4>
                            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
                              {req.description}
                            </div>
                          </div>

                          {/* Right: Dimension Scores for this requirement */}
                          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2.5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Sliders className="w-3.5 h-3.5 text-slate-400" />
                              {isTr ? 'Boyut Puanları' : 'Dimension Scores'}
                            </h4>
                            {[
                              { label: isTr ? 'Açıklık (Clarity)' : 'Clarity', val: report?.clarityScore ?? 0 },
                              { label: isTr ? 'Eksiksizlik (Completeness)' : 'Completeness', val: report?.completenessScore ?? 0 },
                              { label: isTr ? 'Test Edilebilirlik' : 'Testability', val: report?.testabilityScore ?? 0 },
                              { label: isTr ? 'Tutarlılık' : 'Consistency', val: report?.consistencyScore ?? 0 },
                              { label: isTr ? 'Atomiklik' : 'Atomicity', val: report?.atomicityScore ?? 0 },
                            ].map((d, i) => (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-slate-600">
                                  <span>{d.label}</span>
                                  <span className="font-bold text-slate-800">%{d.val}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      d.val >= 80 ? 'bg-emerald-500' : d.val >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${d.val}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Defect Findings List */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Bug className="w-3.5 h-3.5 text-rose-500" />
                            {isTr ? 'Tespit Edilen Kalite Kusurları ve İhlaller' : 'Detected Defects & Rule Violations'} ({findingsCount})
                          </h4>

                          {findingsCount === 0 ? (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span>{isTr ? 'Bu gereksinimde hiçbir kritik veya majör kalite kusuru tespit edilmedi.' : 'No critical or major defects identified.'}</span>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {report?.findings.map((finding, fIdx) => (
                                <div
                                  key={`${finding.id}-${fIdx}`}
                                  className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {getSeverityBadge(finding.severity)}
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        {getDimensionLabel(finding.dimension)}
                                      </span>
                                      <span className="text-xs font-bold text-slate-900">{finding.title}</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400">{finding.id}</span>
                                  </div>

                                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                                    {finding.description}
                                  </p>

                                  {finding.offendingTextSnippet && (
                                    <div className="text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded border border-rose-100 inline-block font-mono">
                                      {isTr ? 'Problemli İfade:' : 'Offending Phrase:'} &ldquo;{finding.offendingTextSnippet}&rdquo;
                                    </div>
                                  )}

                                  <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5 text-xs text-amber-900 flex items-start gap-2">
                                    <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-semibold">{isTr ? 'Düzeltme Tavsiyesi: ' : 'Fix Recommendation: '}</span>
                                      <span>{finding.recommendation}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* AI Refactored Requirement (Side-by-side or Replacement) */}
                        {report?.improvedVersion && (
                          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 rounded-xl p-5 border border-indigo-200 shadow-xs space-y-3">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                <span>{isTr ? 'Yapay Zeka İyileştirilmiş Gereksinim Önerisi (IEEE 830 Standart)' : 'AI Refactored Requirement (IEEE 830 Standard)'}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyImproved(report.improvedVersion!, req.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-all"
                                >
                                  {copiedId === req.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{isTr ? 'Kopyalandı' : 'Copied'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                                      <span>{isTr ? 'Kopyala' : 'Copy'}</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleApplyClick(req.id, report.improvedVersion!)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/25 transition-all"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                                  <span>{isTr ? 'Gereksinimi Güncelle (Uygula)' : 'Apply to Specification'}</span>
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-indigo-700">
                              {report.improvedRationale ||
                                (isTr
                                  ? 'Muğlak kelimeler yerine ölçülebilir SLA ve hata durumları eklenmiş versiyon:'
                                  : 'Refactored version with measurable criteria and negative flows:')}
                            </p>

                            <div className="bg-white rounded-lg p-3.5 border border-indigo-100 text-xs sm:text-sm font-mono text-slate-800 leading-relaxed whitespace-pre-line shadow-2xs">
                              {report.improvedVersion}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
