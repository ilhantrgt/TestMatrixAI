import React, { useMemo, useState } from 'react';
import { Maximize2, Minimize2, GitBranch, Image as ImageIcon } from 'lucide-react';
import { ParsedClientDiagram, ClientDiagramNode } from '../utils/diagramClientParser';

interface DiagramFlowPreviewProps {
  parsedDiagram: ParsedClientDiagram;
  imageDataUrl?: string | null;
  imageFileName?: string | null;
  isEn?: boolean;
}

interface PositionedNode extends ClientDiagramNode {
  x: number;
  y: number;
  w: number;
  h: number;
  level: number;
}

export const DiagramFlowPreview: React.FC<DiagramFlowPreviewProps> = ({
  parsedDiagram,
  imageDataUrl,
  imageFileName,
  isEn = false,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);

  // Topological BFS layering for crisp SVG layout
  const layout = useMemo(() => {
    const { nodes, edges } = parsedDiagram;
    if (!nodes || nodes.length === 0) return null;

    const inDeg = new Map<string, number>();
    const outMap = new Map<string, string[]>();
    nodes.forEach((n) => {
      inDeg.set(n.id, 0);
      outMap.set(n.id, []);
    });
    edges.forEach((e) => {
      outMap.get(e.from)?.push(e.to);
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    });

    const levels = new Map<string, number>();
    const startNodes = nodes.filter((n) => n.type === 'start' || (inDeg.get(n.id) || 0) === 0);
    const queue: string[] = (startNodes.length > 0 ? startNodes : [nodes[0]]).map((n) => n.id);
    queue.forEach((id) => levels.set(id, 0));

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const currLvl = levels.get(curr) || 0;
      for (const nxt of outMap.get(curr) || []) {
        if (!levels.has(nxt)) {
          levels.set(nxt, currLvl + 1);
          queue.push(nxt);
        }
      }
    }

    // Assign any disconnected nodes
    nodes.forEach((n) => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    const byLevel = new Map<number, ClientDiagramNode[]>();
    nodes.forEach((n) => {
      const lvl = levels.get(n.id) || 0;
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(n);
    });

    const NODE_W = 196;
    const NODE_H = 44;
    const X_GAP = 36;
    const Y_GAP = 42;
    const PAD_X = 24;
    const PAD_Y = 24;

    const maxCols = Math.max(1, ...Array.from(byLevel.values()).map((arr) => arr.length));
    const totalWidth = Math.max(460, maxCols * (NODE_W + X_GAP) - X_GAP + PAD_X * 2);

    const positioned = new Map<string, PositionedNode>();
    const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);

    sortedLevels.forEach((lvl) => {
      const rowNodes = byLevel.get(lvl)!;
      const rowWidth = rowNodes.length * NODE_W + (rowNodes.length - 1) * X_GAP;
      const startX = (totalWidth - rowWidth) / 2;
      const y = PAD_Y + lvl * (NODE_H + Y_GAP);

      rowNodes.forEach((n, idx) => {
        positioned.set(n.id, {
          ...n,
          x: startX + idx * (NODE_W + X_GAP),
          y,
          w: NODE_W,
          h: NODE_H,
          level: lvl,
        });
      });
    });

    const totalHeight = PAD_Y * 2 + sortedLevels.length * (NODE_H + Y_GAP) - Y_GAP;
    return { positioned, totalWidth, totalHeight };
  }, [parsedDiagram]);

  if (imageDataUrl) {
    return (
      <div className="bg-[#07090E] border border-white/10 rounded-xl overflow-hidden flex flex-col h-full">
        <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0">
            <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-medium truncate">{imageFileName || (isEn ? 'Uploaded Diagram' : 'Yüklenen Diyagram Görseli')}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 whitespace-nowrap shrink-0 px-2 py-1 rounded hover:bg-white/5 transition-colors"
          >
            {isZoomed ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isZoomed ? (isEn ? 'Fit' : 'Sığdır') : (isEn ? 'Expand' : 'Büyüt')}</span>
          </button>
        </div>

        <div className={`p-3 flex items-center justify-center bg-[#05070B] overflow-auto ${isZoomed ? 'max-h-[540px]' : 'h-[300px]'}`}>
          <img
            src={imageDataUrl}
            alt={imageFileName || 'Activity Diagram Preview'}
            referrerPolicy="no-referrer"
            className={isZoomed ? 'max-w-none max-h-none rounded' : 'max-w-full max-h-full object-contain rounded'}
          />
        </div>
      </div>
    );
  }

  if (!layout || parsedDiagram.nodes.length === 0) {
    return (
      <div className="bg-[#07090E] border border-white/10 rounded-xl p-6 h-full min-h-[300px] flex flex-col items-center justify-center text-center gap-2.5">
        <GitBranch className="w-6 h-6 text-slate-500" />
        <p className="text-xs font-medium text-slate-300">
          {isEn ? 'Activity Diagram Preview' : 'Süreç Çizimi Önizlemesi'}
        </p>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          {isEn
            ? 'Upload a diagram image, paste from clipboard (Ctrl+V), or enter Mermaid / PlantUML / arrow syntax on the left to inspect nodes and decision paths.'
            : 'Soldan bir diyagram görseli yükleyin, panodan yapıştırın (Ctrl+V) veya Mermaid / PlantUML akışı yazarak düğümleri ve karar dallarını canlı görüntüleyin.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#07090E] border border-white/10 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-slate-900/50">
        <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0">
          <GitBranch className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-medium truncate">
            {isEn ? 'Live Process Graph' : 'Canlı Süreç Akışı'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums whitespace-nowrap shrink-0">
          <span>{parsedDiagram.nodes.length} {isEn ? 'nodes' : 'düğüm'}</span>
          <span aria-hidden="true">·</span>
          <span>{parsedDiagram.decisionCount} {isEn ? 'decisions' : 'karar'}</span>
          <span aria-hidden="true">·</span>
          <span>{parsedDiagram.edges.length} {isEn ? 'edges' : 'geçiş'}</span>
        </div>
      </div>

      <div className="p-3 bg-[#05070B] overflow-auto h-[300px]">
        <svg
          width={layout.totalWidth}
          height={layout.totalHeight}
          viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
          className="mx-auto"
        >
          <defs>
            <marker id="tm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
            </marker>
            <marker id="tm-arrow-neg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
            </marker>
          </defs>

          {/* Edges */}
          {parsedDiagram.edges.map((edge, idx) => {
            const fromNode = layout.positioned.get(edge.from);
            const toNode = layout.positioned.get(edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + fromNode.w / 2;
            const y1 = fromNode.y + fromNode.h;
            const x2 = toNode.x + toNode.w / 2;
            const y2 = toNode.y;

            const isBackEdge = toNode.level <= fromNode.level;
            const strokeColor = edge.isNegative ? '#EF4444' : '#475569';
            const marker = edge.isNegative ? 'url(#tm-arrow-neg)' : 'url(#tm-arrow)';

            let pathD = '';
            let labelX = (x1 + x2) / 2;
            let labelY = (y1 + y2) / 2;

            if (isBackEdge) {
              const offsetSide = fromNode.x + fromNode.w + 36;
              const startY = fromNode.y + fromNode.h / 2;
              const endY = toNode.y + toNode.h / 2;
              pathD = `M ${fromNode.x + fromNode.w} ${startY} C ${offsetSide} ${startY}, ${offsetSide} ${endY}, ${toNode.x + toNode.w} ${endY}`;
              labelX = offsetSide - 8;
              labelY = (startY + endY) / 2;
            } else {
              const midY = (y1 + y2) / 2;
              pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2 - 2}`;
            }

            return (
              <g key={`${edge.from}-${edge.to}-${idx}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  strokeDasharray={isBackEdge ? '4 3' : undefined}
                  markerEnd={marker}
                />
                {edge.label && (
                  <g>
                    <rect
                      x={labelX - Math.min(70, edge.label.length * 3.3 + 8)}
                      y={labelY - 9}
                      width={Math.min(140, edge.label.length * 6.6 + 16)}
                      height={17}
                      rx={4}
                      fill="#0F172A"
                      stroke={edge.isNegative ? '#7F1D1D' : '#1E293B'}
                      strokeWidth={1}
                    />
                    <text
                      x={labelX}
                      y={labelY + 3}
                      textAnchor="middle"
                      fontSize="10"
                      fill={edge.isNegative ? '#FCA5A5' : '#93C5FD'}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      {edge.label.length > 20 ? edge.label.slice(0, 19) + '…' : edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {Array.from(layout.positioned.values()).map((node: PositionedNode) => {
            const fill =
              node.type === 'start'
                ? '#064E3B'
                : node.type === 'end'
                ? '#3F1D2B'
                : node.type === 'decision'
                ? '#1E293B'
                : node.type === 'fork_join'
                ? '#1E1B4B'
                : '#0F172A';

            const stroke =
              node.type === 'start'
                ? '#10B981'
                : node.type === 'end'
                ? '#F43F5E'
                : node.type === 'decision'
                ? '#F59E0B'
                : node.type === 'fork_join'
                ? '#818CF8'
                : '#334155';

            const rx = node.type === 'start' || node.type === 'end' ? 20 : node.type === 'decision' ? 4 : 8;
            const shortLabel = node.label.length > 27 ? node.label.slice(0, 26) + '…' : node.label;

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx={rx}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={node.type === 'decision' ? 1.5 : 1.25}
                />
                {node.type === 'decision' && (
                  <polygon
                    points={`${node.x + 12},${node.y + node.h / 2} ${node.x + 18},${node.y + node.h / 2 - 5} ${node.x + 24},${node.y + node.h / 2} ${node.x + 18},${node.y + node.h / 2 + 5}`}
                    fill="#F59E0B"
                  />
                )}
                <text
                  x={node.type === 'decision' ? node.x + node.w / 2 + 6 : node.x + node.w / 2}
                  y={node.y + node.h / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={node.type === 'start' || node.type === 'end' ? '600' : '500'}
                  fill="#F1F5F9"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
