import React from 'react';
import { GenerationStats } from '../types';
import { CheckCircle2, ShieldAlert, Target, Activity, Zap, AlertTriangle, Layers } from 'lucide-react';

interface StatsSummaryPanelProps {
  stats: GenerationStats;
  recommendations?: string[];
}

export const StatsSummaryPanel: React.FC<StatsSummaryPanelProps> = ({ stats, recommendations }) => {
  const positivePercent =
    stats.totalTestCases > 0 ? Math.round((stats.positiveCount / stats.totalTestCases) * 100) : 0;
  const negativePercent =
    stats.totalTestCases > 0 ? Math.round((stats.negativeCount / stats.totalTestCases) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total TCs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Toplam Test Case</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.totalTestCases}</div>
          <span className="text-[11px] text-slate-400 mt-1">
            {stats.totalRequirements} Gereksinimden üretildi
          </span>
        </div>

        {/* Coverage Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Gereksinim Kapsama</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">%{stats.coverageScore}</div>
          <span className="text-[11px] text-emerald-300/80 mt-1">
            {stats.coverageScore === 100 ? 'Eksiksiz RTM Eşleşmesi' : 'Kısmi Kapsama'}
          </span>
        </div>

        {/* Positive Tests */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Pozitif (Happy Path)</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-400">{stats.positiveCount}</div>
          <span className="text-[11px] text-slate-400 mt-1">%{positivePercent} Toplam test oranı</span>
        </div>

        {/* Negative Tests */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Negatif / Hata Durumu</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400">{stats.negativeCount}</div>
          <span className="text-[11px] text-slate-400 mt-1">%{negativePercent} Hatalı akış testi</span>
        </div>

        {/* Boundary & Edge Cases */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Sınır Değer (BVA)</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-400">{stats.boundaryCount}</div>
          <span className="text-[11px] text-slate-400 mt-1">Sınır değer senaryoları</span>
        </div>

        {/* Security & Permissions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Güvenlik / Yetki</span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400">{stats.securityCount}</div>
          <span className="text-[11px] text-slate-400 mt-1">Güvenlik senaryoları</span>
        </div>
      </div>

      {/* AI QA Strategy & Edge Case Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-4 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>AI Test Mühendisliği Değerlendirmesi & Risk Tespiti:</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
