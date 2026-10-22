import React from 'react';
import { RequirementItem, TestCase } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Link2, FileCheck } from 'lucide-react';

interface TraceabilityMatrixViewProps {
  requirements: RequirementItem[];
  testCases: TestCase[];
  language?: 'tr' | 'en';
}

export const TraceabilityMatrixView: React.FC<TraceabilityMatrixViewProps> = ({
  requirements,
  testCases,
  language = 'tr',
}) => {
  const isEn = language === 'en';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-200 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white">
              {isEn ? 'Requirements Traceability Matrix (RTM)' : 'Gereksinim İzlenebilirlik Matrisi (RTM)'}
            </h2>
            <p className="text-xs text-slate-400">
              {isEn
                ? '1:N mapping of requirements to test scenarios and coverage status.'
                : 'Gereksinimler ile test senaryolarının 1:N ilişkisi ve kapsama durumları.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isEn ? 'Full Coverage' : 'Tam Kapsandı'}</span>
          </span>
          <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isEn ? 'Partial Coverage' : 'Kısmi Kapsandı'}</span>
          </span>
        </div>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-32">{isEn ? 'Req ID' : 'Req ID'}</th>
                <th className="py-3 px-4 w-64">{isEn ? 'Requirement Title & Description' : 'Gereksinim Başlığı & Tanımı'}</th>
                <th className="py-3 px-4 w-28 text-center">{isEn ? 'Linked Tests' : 'Bağlı Test'}</th>
                <th className="py-3 px-4 w-40 text-center">{isEn ? 'Test Breakdown' : 'Test Dağılımı'}</th>
                <th className="py-3 px-4 w-36 text-center">{isEn ? 'RTM Coverage' : 'RTM Kapsama'}</th>
                <th className="py-3 px-4">{isEn ? 'Mapped Test Case IDs' : "Eşleşen Test Case ID'leri"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {requirements.map((req) => {
                const matchedTCs = testCases.filter(
                  (tc) => tc.reqId.toLowerCase().trim() === req.id.toLowerCase().trim()
                );
                const posCount = matchedTCs.filter((tc) => tc.testType.includes('Pozitif') || tc.testType.includes('Positive')).length;
                const negCount = matchedTCs.filter((tc) => tc.testType.includes('Negatif') || tc.testType.includes('Negative')).length;
                const otherCount = matchedTCs.length - posCount - negCount;

                let statusBadge = (
                  <span className="bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-md font-medium text-[11px] inline-flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {isEn ? 'Not Covered' : 'Kapsanmadı'}
                  </span>
                );

                if (matchedTCs.length >= 3 && posCount >= 1 && negCount >= 1) {
                  statusBadge = (
                    <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md font-medium text-[11px] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {isEn ? 'Full Coverage' : 'Tam Kapsandı'}
                    </span>
                  );
                } else if (matchedTCs.length > 0) {
                  statusBadge = (
                    <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md font-medium text-[11px] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {isEn ? 'Partial Coverage' : 'Kısmi Kapsandı'}
                    </span>
                  );
                }

                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition-colors align-top">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {req.id}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100 mb-0.5">{req.title}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {req.description}
                      </p>
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-white text-sm">
                      {matchedTCs.length}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-[11px] font-mono">
                        <span className="bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded" title={isEn ? 'Positive' : 'Pozitif'}>
                          +{posCount}
                        </span>
                        <span className="bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded" title={isEn ? 'Negative' : 'Negatif'}>
                          -{negCount}
                        </span>
                        {otherCount > 0 && (
                          <span className="bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded" title={isEn ? 'Other' : 'Diğer'}>
                            ~{otherCount}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">{statusBadge}</td>

                    <td className="py-3 px-4 font-mono text-[11px]">
                      {matchedTCs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {matchedTCs.map((tc) => (
                            <span
                              key={tc.id}
                              className="bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-0.5 rounded border border-slate-700 font-semibold cursor-default"
                              title={tc.title}
                            >
                              {tc.id}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">
                          {isEn ? 'No test cases linked' : 'Test senaryosu bağlı değil'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

