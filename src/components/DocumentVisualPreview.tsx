import React from 'react';
import { Table, ListOrdered, FileText, CheckCircle2, Copy, Code2 } from 'lucide-react';
import { ParsedDocumentBlock } from '../utils/tableParser';

interface DocumentVisualPreviewProps {
  blocks: ParsedDocumentBlock[];
}

export const DocumentVisualPreview: React.FC<DocumentVisualPreviewProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
        Görsel önizleme için metin veya tablo yapıştırın.
      </div>
    );
  }

  const tableCount = blocks.filter((b) => b.type === 'table').length;
  const listCount = blocks.filter((b) => b.type === 'bullet_list').length;
  const codeCount = blocks.filter((b) => b.type === 'code_snippet').length;

  return (
    <div className="space-y-4">
      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {tableCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
            <Table className="w-3.5 h-3.5" />
            <span>{tableCount} Gerçek Tablo</span>
          </span>
        )}
        {listCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
            <ListOrdered className="w-3.5 h-3.5" />
            <span>{listCount} Numaralı/Madde Grubu</span>
          </span>
        )}
        {codeCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
            <Code2 className="w-3.5 h-3.5" />
            <span>{codeCount} XML / Kod Bloğu</span>
          </span>
        )}
      </div>

      {/* Render Blocks */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {blocks.map((block, idx) => {
          if (block.type === 'heading') {
            return (
              <div
                key={idx}
                className="font-bold text-sm text-indigo-300 border-b border-indigo-500/20 pb-1.5 pt-2 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>{block.content}</span>
              </div>
            );
          }

          if (block.type === 'table' && block.tableData) {
            const { headers, rows } = block.tableData;
            return (
              <div
                key={idx}
                className="border border-slate-700/80 rounded-xl overflow-hidden shadow-lg bg-slate-950"
              >
                <div className="bg-slate-800/90 px-3 py-2 border-b border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold">
                    <Table className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Word / Excel Tablosu ({rows.length + 1} Satır, {headers.length} Sütun)</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Durum Geçiş Tablosu
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-300 font-semibold border-b border-slate-800">
                        {headers.map((h, hIdx) => (
                          <th
                            key={hIdx}
                            className="px-3 py-2.5 border-r border-slate-800 last:border-r-0 whitespace-nowrap text-indigo-200"
                          >
                            {h || `Sütun ${hIdx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-indigo-950/20 transition-colors odd:bg-slate-950 even:bg-slate-900/40"
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-2 border-r border-slate-800/60 last:border-r-0 text-slate-200 whitespace-nowrap"
                            >
                              {cell || <span className="text-slate-600">-</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (block.type === 'bullet_list' && block.listItems) {
            return (
              <div
                key={idx}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-300"
              >
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <ListOrdered className="w-3 h-3 text-indigo-400" />
                  <span>İş Maddeleri & Şartlar</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {block.listItems.map((item, lIdx) => (
                    <li key={lIdx} className="flex items-start gap-2 text-slate-200 leading-relaxed">
                      <span className="text-indigo-400 font-bold shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }

          if (block.type === 'code_snippet' && block.content) {
            return (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-amber-300/90 overflow-x-auto shadow-inner"
              >
                <div className="text-[10px] text-slate-500 font-sans uppercase font-bold mb-1 flex items-center gap-1">
                  <Code2 className="w-3 h-3 text-amber-400" />
                  <span>XML / Payload Örneği</span>
                </div>
                <pre className="whitespace-pre">{block.content}</pre>
              </div>
            );
          }

          return (
            <p key={idx} className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {block.content}
            </p>
          );
        })}
      </div>
    </div>
  );
};
