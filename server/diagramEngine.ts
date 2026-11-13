import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  generateEngineeringRecommendations,
  calculateGenerationStats,
} from './engineeringEvaluation.ts';

export type DiagramFormat = 'image' | 'mermaid' | 'plantuml' | 'bpmn_xml' | 'text_flow';
export type DiagramCoverageStrategy = 'branch' | 'basis_path' | 'full_e2e';

export interface DiagramNode {
  id: string;
  label: string;
  type: 'start' | 'end' | 'action' | 'decision' | 'fork_join';
  swimlane?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  isNegative?: boolean;
}

export interface EnumeratedPath {
  id: string;
  name: string;
  pathType: 'happy' | 'negative' | 'decision' | 'loop' | 'parallel';
  nodeIds: string[];
  nodeLabels: string[];
  conditions: string[];
  hasLoop: boolean;
  isNegative: boolean;
  isParallel: boolean;
  swimlanes: string[];
}

export interface ParsedDiagramGraph {
  formatDetected: DiagramFormat;
  processTitle: string;
  swimlanes: string[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  paths: EnumeratedPath[];
}

interface DecisionInventoryItem {
  nodeId: string;
  label: string;
  swimlane?: string;
  branches: { label: string; targetLabel: string; isNegative: boolean }[];
}

interface SwimlaneHandoffItem {
  fromSwimlane: string;
  toSwimlane: string;
  fromLabel: string;
  toLabel: string;
  condition?: string;
}

interface GraphDimensions {
  decisions: DecisionInventoryItem[];
  swimlaneHandoffs: SwimlaneHandoffItem[];
  actionNodes: DiagramNode[];
  loopPaths: EnumeratedPath[];
  parallelNodes: DiagramNode[];
}

const NEGATIVE_BRANCH_REGEX =
  /\b(hayır|hayir|no|false|fail|failed|error|hata|red|reject|rejected|iptal|cancel|geçersiz|gecersiz|invalid|blocked|bloke|timeout|zaman\s*aşım|yetersiz|yetkisiz|forbidden|400|401|403|404|409|422|500|503|başarısız|basarisiz|eksik|ret|süre\s*doldu)\b/i;

function decodeHtmlEntities(input: string): string {
  let out = input;
  for (let pass = 0; pass < 4; pass++) {
    const prev = out;
    out = out
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#0*39;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) && code >= 32 ? String.fromCodePoint(code) : ' ';
      })
      .replace(/&#(\d+);?/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) && code >= 32 ? String.fromCodePoint(code) : ' ';
      })
      // Handle malformed/unterminated entities such as "&lt;div&gt" or "&ltdiv&gtÖdeme"
      .replace(/&lt(?=[/\w!])/gi, '<')
      .replace(/&gt(?![a-z0-9])/gi, '>')
      .replace(/(<\/?[a-zA-Z][a-zA-Z0-9:-]*)&gt/gi, '$1>');
    if (out === prev) break;
  }
  return out;
}

const KNOWN_HTML_TAGS =
  'div|span|p|br|hr|b|strong|i|em|u|s|font|li|ul|ol|dl|dt|dd|table|thead|tbody|tr|td|th|h[1-6]|pre|code|blockquote|section|article|header|footer|center|small|sub|sup|a|img|svg|path|g|rect|circle|text|tspan|foreignObject|body|html';

const UNCLOSED_HTML_TAG_RE = new RegExp(
  `<\\/?(?:${KNOWN_HTML_TAGS})(?:\\s+(?:style|class|id|align|color|face|size|href|src|width|height|data-[a-z0-9-]+)\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*))*(?:\\s*\\/?>|\\b)`,
  'gi'
);

export function sanitizeDiagramLabel(raw: string): string {
  if (!raw) return '';
  let s = decodeHtmlEntities(String(raw));
  s = s
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(UNCLOSED_HTML_TAG_RE, ' ')
    .replace(/<\/?[a-zA-Z!][a-zA-Z0-9:-]*(?:\s+[^>]*)?\/?>/g, ' ')
    // Strip truncated unclosed tag fragments at start/end such as "<div" or "div>"
    .replace(/<\/?[a-zA-Z]{1,12}(?:\s+[^>]*)?$/g, ' ')
    .replace(/^[a-zA-Z]{1,12}>/g, ' ');
  s = decodeHtmlEntities(s)
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(UNCLOSED_HTML_TAG_RE, ' ')
    .replace(/<\/?[a-zA-Z!][a-zA-Z0-9:-]*(?:\s+[^>]*)?\/?>/g, ' ')
    .replace(/\\n|\\r|\\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseXmlAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

function cleanNodeShape(raw: string): { label: string; type: DiagramNode['type'] } {
  const s = raw.trim();
  if (/^\(\[.*\]\)$/.test(s) || /^\(\(.*\)\)$/.test(s)) {
    const inner = sanitizeDiagramLabel(s.replace(/^\(\[|\(\(|\)\)|\]\)$/g, ''));
    const isEnd = /bitiş|bitis|end|son|tamamland|iptal|bloke|red|onayland|forbidden|yetersiz|oluşturuldu|gönderildi/i.test(inner);
    const isStart = /başla|basla|start|giriş|tetik/i.test(inner);
    return { label: inner, type: isStart ? 'start' : isEnd ? 'end' : 'start' };
  }
  if (/^\{\{.*\}\}$/.test(s) || /^\{.*\}$/.test(s)) {
    return { label: sanitizeDiagramLabel(s.replace(/^\{\{?|\}?\}\}$/g, '')), type: 'decision' };
  }
  if (/^\[\[.*\]\]$/.test(s)) {
    return { label: sanitizeDiagramLabel(s.replace(/^\[\[|\]\]$/g, '')), type: 'fork_join' };
  }
  if (/^\[\(.*\)\]$/.test(s)) {
    return { label: sanitizeDiagramLabel(s.replace(/^\[\(|\)\]$/g, '')), type: 'action' };
  }
  if (/^\[\/.*\/\]$/.test(s) || /^\[\\.*\\\]$/.test(s)) {
    return { label: sanitizeDiagramLabel(s.replace(/^\[[\/\\]|[\/\\]\]$/g, '')), type: 'action' };
  }
  if (/^\[.*\]$/.test(s) || /^\(.*\)$/.test(s)) {
    const inner = sanitizeDiagramLabel(s.replace(/^\[|\(|\]|\)$/g, ''));
    const isDecision = inner.endsWith('?') || /^(if|eğer|kontrol)\s+/i.test(inner);
    return { label: inner, type: isDecision ? 'decision' : 'action' };
  }
  const cleanS = sanitizeDiagramLabel(s);
  const isDecision = cleanS.endsWith('?') || /^(if|eğer)\s+/i.test(cleanS);
  const isEnd = /^(end|bitiş|bitis|stop|finish|son)$/i.test(cleanS);
  const isStart = /^(start|başla|basla|başlangıç|baslangic)$/i.test(cleanS);
  return {
    label: cleanS,
    type: isStart ? 'start' : isEnd ? 'end' : isDecision ? 'decision' : 'action',
  };
}

export function detectDiagramFormat(rawText: string): DiagramFormat {
  const t = (rawText || '').trim();
  if (/<bpmn:|<definitions|<mxGraphModel|<mxCell|<UserObject/i.test(t)) return 'bpmn_xml';
  if (/@startuml|@enduml|:[^;]+;\s*$/m.test(t)) return 'plantuml';
  if (/^\s*(flowchart|graph|stateDiagram)/im.test(t) || /-->|-\.->|==>/.test(t)) return 'mermaid';
  return 'text_flow';
}

export function parseActivityDiagramText(rawText: string): ParsedDiagramGraph {
  const text = (rawText || '').trim();
  const formatDetected = detectDiagramFormat(text);
  const nodeMap = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  const swimlanesSet = new Set<string>();
  let currentSwimlane: string | undefined;
  let processTitle = 'Süreç Akış Diyagramı';

  const ensureNode = (rawId: string, rawShape?: string) => {
    const id = rawId.trim().replace(/[^a-zA-Z0-9_\-çğıöşüÇĞİÖŞÜ]/g, '_');
    if (!id) return '';
    if (rawShape) {
      const parsed = cleanNodeShape(rawShape);
      const existing = nodeMap.get(id);
      if (!existing || existing.label === id) {
        nodeMap.set(id, {
          id,
          label: parsed.label || id,
          type: parsed.type,
          swimlane: currentSwimlane || existing?.swimlane,
        });
      } else if (currentSwimlane && !existing.swimlane) {
        existing.swimlane = currentSwimlane;
      }
    } else if (!nodeMap.has(id)) {
      const parsed = cleanNodeShape(rawId);
      nodeMap.set(id, {
        id,
        label: parsed.label,
        type: parsed.type,
        swimlane: currentSwimlane,
      });
    } else if (currentSwimlane && !nodeMap.get(id)!.swimlane) {
      nodeMap.get(id)!.swimlane = currentSwimlane;
    }
    return id;
  };

  if (formatDetected === 'bpmn_xml') {
    const isDrawio = /<mxGraphModel|<mxCell|<UserObject/i.test(text);
    if (isDrawio) {
      const swimlaneById = new Map<string, string>();
      const edgeById = new Map<string, DiagramEdge>();
      const pendingEdgeLabels: { parentId: string; label: string }[] = [];

      const handleMxCellRecord = (attrs: Record<string, string>) => {
        const id = attrs.id || `cell_${nodeMap.size + edges.length + 1}`;
        const rawVal = attrs.label || attrs.value || attrs.name || '';
        const label = sanitizeDiagramLabel(rawVal);
        const style = (attrs.style || '').toLowerCase();
        const isEdge = attrs.edge === '1' || (Boolean(attrs.source) && Boolean(attrs.target));

        if (isEdge && attrs.source && attrs.target) {
          const edgeObj: DiagramEdge = {
            from: attrs.source,
            to: attrs.target,
            label: label || undefined,
            isNegative: label ? NEGATIVE_BRANCH_REGEX.test(label) : false,
          };
          edges.push(edgeObj);
          edgeById.set(id, edgeObj);
          return;
        }

        if (style.includes('edgelabel') && attrs.parent && label) {
          pendingEdgeLabels.push({ parentId: attrs.parent, label });
          return;
        }

        if (style.includes('swimlane') && label) {
          swimlaneById.set(id, label);
          swimlanesSet.add(label);
          return;
        }

        if ((id === '0' || id === '1') && !label) return;
        if (!label) return;

        let type: DiagramNode['type'] = 'action';
        if (style.includes('rhombus') || label.endsWith('?') || /^(if|eğer|kontrol)\b/i.test(label)) {
          type = 'decision';
        } else if (style.includes('ellipse') || style.includes('terminator')) {
          type = /bitiş|bitis|end|son|tamamland|iptal|bloke|red|hata/i.test(label) ? 'end' : 'start';
        } else if (/^(başla|basla|start|başlangıç)/i.test(label)) {
          type = 'start';
        } else if (/^(bitiş|bitis|end|stop|son|iptal|red)/i.test(label)) {
          type = 'end';
        }

        const parentLane = attrs.parent ? swimlaneById.get(attrs.parent) : undefined;
        nodeMap.set(id, { id, label, type, swimlane: parentLane });
      };

      // Parse Draw.io <UserObject ...><mxCell .../></UserObject> and <object ...><mxCell .../></object> wrappers
      let remainingXml = text.replace(
        /<(?:UserObject|object)\b([^>]*)>\s*(?:<mxCell\b([^>]*)\/?>)?[\s\S]*?<\/(?:UserObject|object)>/gi,
        (_, wrapperAttrsStr, innerCellAttrsStr) => {
          const merged = {
            ...parseXmlAttributes(innerCellAttrsStr || ''),
            ...parseXmlAttributes(wrapperAttrsStr || ''),
          };
          handleMxCellRecord(merged);
          return '';
        }
      );

      // Parse standalone <mxCell ...>
      const mxMatches = remainingXml.matchAll(/<mxCell\b([^>]*)>/gi);
      for (const m of mxMatches) {
        handleMxCellRecord(parseXmlAttributes(m[1] || ''));
      }

      // Attach any Draw.io edgeLabel cells to their parent edges
      pendingEdgeLabels.forEach(({ parentId, label }) => {
        const targetEdge = edgeById.get(parentId);
        if (targetEdge) {
          targetEdge.label = targetEdge.label ? `${targetEdge.label} ${label}` : label;
          targetEdge.isNegative = NEGATIVE_BRANCH_REGEX.test(targetEdge.label);
        }
      });
    } else {
      // Standard BPMN 2.0 XML (attribute-order independent)
      const bpmnTagMatches = text.matchAll(
        /<(?:bpmn:)?(startEvent|endEvent|task|userTask|serviceTask|scriptTask|exclusiveGateway|inclusiveGateway|parallelGateway|subProcess)\b([^>]*)>/gi
      );
      let seq = 0;
      for (const m of bpmnTagMatches) {
        const tag = m[1].toLowerCase();
        const attrs = parseXmlAttributes(m[2] || '');
        const id = attrs.id || `n_${++seq}`;
        const label = sanitizeDiagramLabel(attrs.name || attrs.value || '');
        if (!label) continue;
        let type: DiagramNode['type'] = 'action';
        if (tag.includes('start')) type = 'start';
        else if (tag.includes('end')) type = 'end';
        else if (tag.includes('exclusive') || tag.includes('inclusive') || label.endsWith('?')) type = 'decision';
        else if (tag.includes('parallel')) type = 'fork_join';
        nodeMap.set(id, { id, label, type });
      }
      const seqFlowMatches = text.matchAll(/<(?:bpmn:)?sequenceFlow\b([^>]*)>/gi);
      for (const fm of seqFlowMatches) {
        const attrs = parseXmlAttributes(fm[1] || '');
        if (!attrs.sourceRef || !attrs.targetRef) continue;
        const label = sanitizeDiagramLabel(attrs.name || '') || undefined;
        edges.push({
          from: attrs.sourceRef,
          to: attrs.targetRef,
          label,
          isNegative: label ? NEGATIVE_BRANCH_REGEX.test(label) : false,
        });
      }
    }
  } else if (formatDetected === 'plantuml') {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let prevId = '';
    let seq = 0;
    const branchStack: { decisionId: string; pendingLabel?: string; branchEnds: string[] }[] = [];

    for (const line of lines) {
      if (line.startsWith('@') || line.startsWith("'")) continue;
      const titleMatch = line.match(/^title\s+(.+)/i);
      if (titleMatch) {
        processTitle = sanitizeDiagramLabel(titleMatch[1]);
        continue;
      }
      const swimMatch = line.match(/^\|([^|]+)\|$/) || line.match(/^partition\s+"?([^"{]+)"?\s*\{?$/i);
      if (swimMatch) {
        currentSwimlane = sanitizeDiagramLabel(swimMatch[1]);
        if (currentSwimlane) swimlanesSet.add(currentSwimlane);
        continue;
      }
      if (line === '}') {
        currentSwimlane = undefined;
        continue;
      }
      if (/^start$/i.test(line)) {
        const id = 'Start';
        nodeMap.set(id, { id, label: 'Başla', type: 'start', swimlane: currentSwimlane });
        prevId = id;
        continue;
      }
      if (/^(stop|end)$/i.test(line)) {
        const id = `End_${++seq}`;
        nodeMap.set(id, { id, label: 'Bitiş', type: 'end', swimlane: currentSwimlane });
        if (prevId) edges.push({ from: prevId, to: id });
        prevId = id;
        continue;
      }
      const ifMatch = line.match(/^(?:else)?if\s*\(([^)]+)\)\s*then\s*(?:\(([^)]+)\))?/i);
      if (ifMatch) {
        const decId = `Dec_${++seq}`;
        const decLabel = sanitizeDiagramLabel(ifMatch[1]);
        nodeMap.set(decId, { id: decId, label: decLabel || decId, type: 'decision', swimlane: currentSwimlane });
        if (/^elseif/i.test(line) && branchStack.length > 0) {
          const top = branchStack[branchStack.length - 1];
          if (prevId && prevId !== top.decisionId) top.branchEnds.push(prevId);
          edges.push({ from: top.decisionId, to: decId, label: 'Hayır / Alternatif', isNegative: true });
        } else if (prevId) {
          edges.push({ from: prevId, to: decId });
        }
        branchStack.push({
          decisionId: decId,
          pendingLabel: sanitizeDiagramLabel(ifMatch[2] || '') || 'Evet',
          branchEnds: [],
        });
        prevId = decId;
        continue;
      }
      const elseMatch = line.match(/^else\s*(?:\(([^)]+)\))?/i);
      if (elseMatch && branchStack.length > 0) {
        const top = branchStack[branchStack.length - 1];
        if (prevId && prevId !== top.decisionId) top.branchEnds.push(prevId);
        top.pendingLabel = sanitizeDiagramLabel(elseMatch[1] || '') || 'Hayır';
        prevId = top.decisionId;
        continue;
      }
      if (/^endif$/i.test(line) && branchStack.length > 0) {
        const closed = branchStack.pop()!;
        if (prevId && prevId !== closed.decisionId) closed.branchEnds.push(prevId);
        continue;
      }
      if (/^fork(\s+again)?$/i.test(line)) {
        const forkId = `Fork_${++seq}`;
        nodeMap.set(forkId, { id: forkId, label: 'Paralel Akış Başlat', type: 'fork_join', swimlane: currentSwimlane });
        if (prevId) edges.push({ from: prevId, to: forkId });
        prevId = forkId;
        continue;
      }
      const repeatWhileMatch = line.match(/^repeat\s+while\s*\(([^)]+)\)/i);
      if (repeatWhileMatch && prevId) {
        const loopDecId = `Loop_${++seq}`;
        const loopLabel = sanitizeDiagramLabel(repeatWhileMatch[1]);
        nodeMap.set(loopDecId, { id: loopDecId, label: loopLabel || loopDecId, type: 'decision', swimlane: currentSwimlane });
        edges.push({ from: prevId, to: loopDecId });
        const startLoopTarget = Array.from(nodeMap.values()).find((n) => n.type === 'action')?.id;
        if (startLoopTarget) {
          edges.push({ from: loopDecId, to: startLoopTarget, label: 'Tekrar Dene', isNegative: false });
        }
        prevId = loopDecId;
        continue;
      }
      const actMatch = line.match(/^:(.+);$/);
      if (actMatch) {
        const actId = `Act_${++seq}`;
        const actLabel = sanitizeDiagramLabel(actMatch[1]);
        if (!actLabel) continue;
        nodeMap.set(actId, {
          id: actId,
          label: actLabel,
          type: actLabel.endsWith('?') ? 'decision' : 'action',
          swimlane: currentSwimlane,
        });
        if (prevId) {
          let lbl: string | undefined;
          const top = branchStack[branchStack.length - 1];
          if (top && prevId === top.decisionId && top.pendingLabel) {
            lbl = top.pendingLabel;
            top.pendingLabel = undefined;
          }
          edges.push({
            from: prevId,
            to: actId,
            label: lbl,
            isNegative: lbl ? NEGATIVE_BRANCH_REGEX.test(lbl) : false,
          });
        }
        prevId = actId;
      }
    }
  } else {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sequentialStepIds: string[] = [];

    for (const line of lines) {
      if (/^(?:flowchart|graph|stateDiagram|%%|style\s+|classDef\s+|class\s+|linkStyle\s+|click\s+|direction\s+)/i.test(line)) continue;
      const titleMatch = line.match(/^(?:title|Başlık|Süreç)\s*:\s*(.+)/i);
      if (titleMatch) {
        processTitle = sanitizeDiagramLabel(titleMatch[1]);
        continue;
      }
      const subMatch = line.match(/^subgraph\s+(?:[a-zA-Z0-9_\-]+\s*\[)?([^\]\n"]+|"[^"]+")\]?/i);
      if (subMatch) {
        currentSwimlane = sanitizeDiagramLabel(subMatch[1]);
        if (currentSwimlane) swimlanesSet.add(currentSwimlane);
        continue;
      }
      if (/^end$/i.test(line)) {
        currentSwimlane = undefined;
        continue;
      }

      const arrowRegex = /\s*(?:--+>|--[^>]*-->|-\.[^.]*\.->|-\.->|==>|\.\.>|->)\s*(?:\|([^|]+)\|)?\s*/g;
      if (arrowRegex.test(line)) {
        arrowRegex.lastIndex = 0;
        const segments: { token: string; edgeLabel?: string }[] = [];
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        while ((match = arrowRegex.exec(line)) !== null) {
          const leftToken = line.slice(lastIdx, match.index).trim();
          const inlineLabelMatch = match[0].match(/(?:--|\-\.)\s*([^->]+?)\s*(?:-->|\.->)/);
          const edgeLabel = sanitizeDiagramLabel(match[1] || inlineLabelMatch?.[1] || '') || undefined;
          segments.push({ token: leftToken, edgeLabel });
          lastIdx = arrowRegex.lastIndex;
        }
        const tailToken = line.slice(lastIdx).trim();
        if (tailToken) segments.push({ token: tailToken });

        for (let i = 0; i < segments.length - 1; i++) {
          const leftRaw = segments[i].token;
          const rightRaw = segments[i + 1].token;
          const edgeLabel = segments[i].edgeLabel;

          const leftParts = leftRaw.match(/^([a-zA-Z0-9_\-çğıöşüÇĞİÖŞÜ]+)\s*([\(\[\{].*[\)\]\}])?$/);
          const rightParts = rightRaw.match(/^([a-zA-Z0-9_\-çğıöşüÇĞİÖŞÜ]+)\s*([\(\[\{].*[\)\]\}])?$/);

          const fromId = leftParts
            ? ensureNode(leftParts[1], leftParts[2])
            : ensureNode(`n_${nodeMap.size + 1}`, leftRaw);
          const toId = rightParts
            ? ensureNode(rightParts[1], rightParts[2])
            : ensureNode(`n_${nodeMap.size + 1}`, rightRaw);

          if (fromId && toId) {
            edges.push({
              from: fromId,
              to: toId,
              label: edgeLabel,
              isNegative: edgeLabel ? NEGATIVE_BRANCH_REGEX.test(edgeLabel) : false,
            });
          }
        }
      } else if (/^(?:\d+[\.\)]|Adım\s*\d+:?)\s+/i.test(line)) {
        // Sequential step text fallback when user pastes numbered steps without arrows
        const cleanedStep = sanitizeDiagramLabel(line.replace(/^(?:\d+[\.\)]|Adım\s*\d+:?)\s+/i, ''));
        if (cleanedStep) {
          const stepId = `Step_${sequentialStepIds.length + 1}`;
          ensureNode(stepId, cleanedStep);
          if (sequentialStepIds.length > 0) {
            edges.push({ from: sequentialStepIds[sequentialStepIds.length - 1], to: stepId });
          }
          sequentialStepIds.push(stepId);
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());
  const paths = enumerateProcessPaths(nodes, edges);

  if (processTitle === 'Süreç Akış Diyagramı' && nodes.length > 0) {
    const startNode = nodes.find((n) => n.type === 'start') || nodes[0];
    processTitle = startNode.label.replace(/^başla\s*:\s*/i, '').trim() || 'Süreç Akış Diyagramı';
  }

  return {
    formatDetected,
    processTitle,
    swimlanes: Array.from(swimlanesSet),
    nodes,
    edges,
    paths,
  };
}

/**
 * Enumerates distinct execution paths (Happy, Decision Branches, Negative/Exceptions, Loops, Parallel Fork/Join)
 * via bounded DFS so cycles/retry loops are captured cleanly as dedicated test paths without infinite recursion.
 */
export function enumerateProcessPaths(nodes: DiagramNode[], edges: DiagramEdge[]): EnumeratedPath[] {
  if (nodes.length === 0) return [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outEdges = new Map<string, DiagramEdge[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((n) => {
    outEdges.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  edges.forEach((e) => {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });

  const startNodes = nodes.filter((n) => n.type === 'start' || (inDegree.get(n.id) || 0) === 0);
  const roots = startNodes.length > 0 ? startNodes : [nodes[0]];

  const rawPaths: {
    nodeIds: string[];
    conditions: string[];
    hasLoop: boolean;
    hasNegativeEdge: boolean;
    hasParallel: boolean;
  }[] = [];

  const MAX_PATHS = 36;
  const MAX_DEPTH = 28;

  const dfs = (
    currentId: string,
    visitedCount: Map<string, number>,
    pathNodeIds: string[],
    conditions: string[],
    hasLoop: boolean,
    hasNegativeEdge: boolean,
    hasParallel: boolean
  ) => {
    if (rawPaths.length >= MAX_PATHS || pathNodeIds.length >= MAX_DEPTH) return;

    const currentNode = nodeById.get(currentId);
    const nextParallel = hasParallel || currentNode?.type === 'fork_join';
    const nextVisited = new Map(visitedCount);
    const visits = (nextVisited.get(currentId) || 0) + 1;
    nextVisited.set(currentId, visits);

    const nextNodeIds = [...pathNodeIds, currentId];
    const outgoing = outEdges.get(currentId) || [];

    if (outgoing.length === 0 || currentNode?.type === 'end' || visits > 1) {
      rawPaths.push({
        nodeIds: nextNodeIds,
        conditions,
        hasLoop: hasLoop || visits > 1,
        hasNegativeEdge,
        hasParallel: nextParallel,
      });
      return;
    }

    for (const edge of outgoing) {
      const targetVisits = nextVisited.get(edge.to) || 0;
      const edgeNeg = Boolean(edge.isNegative) || NEGATIVE_BRANCH_REGEX.test(nodeById.get(edge.to)?.label || '');
      const nextConditions = edge.label
        ? [...conditions, `${currentNode?.label || currentId} → ${edge.label}`]
        : conditions;

      if (targetVisits >= 1) {
        rawPaths.push({
          nodeIds: [...nextNodeIds, edge.to],
          conditions: [...nextConditions, '(Tekrar / Döngü Geçişi)'],
          hasLoop: true,
          hasNegativeEdge: hasNegativeEdge || edgeNeg,
          hasParallel: nextParallel,
        });
      } else {
        dfs(
          edge.to,
          nextVisited,
          nextNodeIds,
          nextConditions,
          hasLoop,
          hasNegativeEdge || edgeNeg,
          nextParallel
        );
      }
    }
  };

  for (const root of roots) {
    dfs(root.id, new Map(), [], [], false, false, false);
  }

  const seenSignatures = new Set<string>();
  const finalPaths: EnumeratedPath[] = [];
  let seq = 1;

  for (const rp of rawPaths) {
    const sig = `${rp.nodeIds.join('>')}|${rp.conditions.join(',')}`;
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);

    const nodeLabels = rp.nodeIds.map((id) => nodeById.get(id)?.label || id);
    const endLabel = nodeLabels[nodeLabels.length - 1] || '';
    const isNeg = rp.hasNegativeEdge || NEGATIVE_BRANCH_REGEX.test(endLabel);
    const pathType: EnumeratedPath['pathType'] = rp.hasLoop
      ? 'loop'
      : isNeg
      ? 'negative'
      : rp.hasParallel
      ? 'parallel'
      : rp.conditions.length > 0 && seq > 1
      ? 'decision'
      : 'happy';

    const swimlanes = Array.from(
      new Set(
        rp.nodeIds
          .map((id) => nodeById.get(id)?.swimlane)
          .filter((s): s is string => Boolean(s))
      )
    );

    const condSummary =
      rp.conditions.length > 0
        ? rp.conditions[rp.conditions.length - 1]
        : `${nodeLabels[0]} → ${endLabel}`;

    const pathPrefix =
      pathType === 'happy'
        ? 'Ana Akış (Happy Path)'
        : pathType === 'loop'
        ? 'Döngü / Tekrar Deneme Akışı'
        : pathType === 'negative'
        ? 'Hata / Red / İstisna Yolu'
        : pathType === 'parallel'
        ? 'Paralel Dal Akışı'
        : 'Alternatif Karar Yolu';

    const id = `PATH-${String(seq).padStart(2, '0')}`;
    seq++;

    finalPaths.push({
      id,
      name: `${pathPrefix}: ${condSummary}`.slice(0, 120),
      pathType,
      nodeIds: rp.nodeIds,
      nodeLabels,
      conditions: rp.conditions,
      hasLoop: rp.hasLoop,
      isNegative: isNeg,
      isParallel: rp.hasParallel,
      swimlanes,
    });
  }

  finalPaths.sort((a, b) => {
    const order = { happy: 0, parallel: 1, decision: 2, loop: 3, negative: 4 };
    return order[a.pathType] - order[b.pathType];
  });

  return finalPaths.map((p, idx) => ({
    ...p,
    id: `PATH-${String(idx + 1).padStart(2, '0')}`,
  }));
}

function extractGraphDimensions(graph: ParsedDiagramGraph): GraphDimensions {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const outEdgesMap = new Map<string, DiagramEdge[]>();
  graph.edges.forEach((e) => {
    if (!outEdgesMap.has(e.from)) outEdgesMap.set(e.from, []);
    outEdgesMap.get(e.from)!.push(e);
  });

  const decisions: DecisionInventoryItem[] = graph.nodes
    .filter((n) => n.type === 'decision' || (outEdgesMap.get(n.id)?.length || 0) >= 2)
    .map((n) => {
      const outgoing = outEdgesMap.get(n.id) || [];
      return {
        nodeId: n.id,
        label: n.label,
        swimlane: n.swimlane,
        branches: outgoing.map((e, i) => ({
          label: e.label || `Dal ${i + 1}`,
          targetLabel: nodeById.get(e.to)?.label || e.to,
          isNegative: Boolean(e.isNegative) || NEGATIVE_BRANCH_REGEX.test(e.label || ''),
        })),
      };
    });

  const handoffSeen = new Set<string>();
  const swimlaneHandoffs: SwimlaneHandoffItem[] = [];
  graph.edges.forEach((e) => {
    const fromNode = nodeById.get(e.from);
    const toNode = nodeById.get(e.to);
    if (fromNode?.swimlane && toNode?.swimlane && fromNode.swimlane !== toNode.swimlane) {
      const key = `${fromNode.swimlane}=>${toNode.swimlane}:${fromNode.label}->${toNode.label}`;
      if (!handoffSeen.has(key)) {
        handoffSeen.add(key);
        swimlaneHandoffs.push({
          fromSwimlane: fromNode.swimlane,
          toSwimlane: toNode.swimlane,
          fromLabel: fromNode.label,
          toLabel: toNode.label,
          condition: e.label,
        });
      }
    }
  });

  const actionNodes = graph.nodes.filter((n) => n.type === 'action');
  const parallelNodes = graph.nodes.filter((n) => n.type === 'fork_join');
  const loopPaths = graph.paths.filter((p) => p.hasLoop);

  return { decisions, swimlaneHandoffs, actionNodes, loopPaths, parallelNodes };
}

function buildStepExpectedPairs(
  nodeLabels: string[],
  conditions: string[],
  isNegativePath: boolean,
  customInstr: string,
  isTurkish: boolean
): { steps: string[]; stepExpectedResults: string[] } {
  const steps: string[] = [];
  const stepExpectedResults: string[] = [];

  nodeLabels.forEach((nodeLabel, nIdx) => {
    const stepNum = nIdx + 1;
    const condForStep = conditions.find((c) => c.startsWith(`${nodeLabel} →`));
    if (nIdx === 0) {
      steps.push(
        isTurkish
          ? `${stepNum}. Süreci "${nodeLabel}" başlangıç noktasından tetikleyin ve ön oturum/parametreleri hazırlayın.${customInstr ? ` (${customInstr.slice(0, 55)})` : ''}`
          : `${stepNum}. Trigger process at "${nodeLabel}" and prepare session parameters.`
      );
      stepExpectedResults.push(
        isTurkish
          ? `${stepNum}. Başlangıç durumu aktif olmalı, işlem takip kimliği (Correlation/Transaction ID) üretilmelidir.`
          : `${stepNum}. Process starts cleanly with a valid correlation ID.`
      );
    } else if (condForStep) {
      const branchLabel = condForStep.split('→')[1]?.trim() || '';
      steps.push(
        isTurkish
          ? `${stepNum}. "${nodeLabel}" karar kapısında "${branchLabel}" dalını tetikleyecek koşullu veriyi gönderin.`
          : `${stepNum}. Supply input at decision "${nodeLabel}" to evaluate branch "${branchLabel}".`
      );
      stepExpectedResults.push(
        isTurkish
          ? `${stepNum}. Karar motoru kuralı doğru değerlendirmeli ve akışı "${branchLabel}" dalına deterministik olarak yönlendirmelidir.`
          : `${stepNum}. Decision gate routes deterministically to "${branchLabel}".`
      );
    } else if (nIdx === nodeLabels.length - 1) {
      steps.push(
        isTurkish
          ? `${stepNum}. Sürecin "${nodeLabel}" terminal durumuna ulaştığını, veritabanı kaydını, bildirimleri ve denetim loglarını doğrulayın.`
          : `${stepNum}. Verify terminal state "${nodeLabel}", persisted state, and audit logs.`
      );
      stepExpectedResults.push(
        isTurkish
          ? isNegativePath
            ? `${stepNum}. Akış güvenli biçimde "${nodeLabel}" durumunda sonlanmalı, kısmi veri tutarsızlığı oluşmamalıdır.`
            : `${stepNum}. Süreç "${nodeLabel}" terminal durumunda başarıyla tamamlanmalı ve tüm kayıtlar tutarlı güncellenmelidir.`
          : `${stepNum}. Terminal state "${nodeLabel}" confirmed with full data consistency.`
      );
    } else {
      steps.push(
        isTurkish
          ? `${stepNum}. "${nodeLabel}" işlem adımını geçerli iş yükü/veri ile çalıştırıp durum geçişini gözlemleyin.`
          : `${stepNum}. Execute activity "${nodeLabel}" and observe state transition.`
      );
      stepExpectedResults.push(
        isTurkish
          ? `${stepNum}. "${nodeLabel}" adımı hata üretmeden tamamlanmalı ve bir sonraki düğüme temiz payload ile geçilmelidir.`
          : `${stepNum}. "${nodeLabel}" finishes cleanly and forwards updated context.`
      );
    }
  });

  if (steps.length === 0) {
    steps.push(isTurkish ? '1. Süreci başlatın ve karar adımını çalıştırın.' : '1. Start process and evaluate decision.');
    stepExpectedResults.push(isTurkish ? '1. Süreç beklenen adıma ulaşmalıdır.' : '1. Process reaches expected node.');
  }

  return { steps, stepExpectedResults };
}

/**
 * Deterministic Graph-to-Test-Case Synthesizer:
 * Produces rich multi-dimensional coverage directly from ParsedDiagramGraph:
 *  - Full node-by-node E2E scenarios for every path
 *  - Per-decision BVA & Decision Table cases
 *  - Swimlane Role/Security & State-Skip prevention
 *  - Loop/Retry, Idempotency & Action Negative Validation
 */
export function synthesizeTestCasesFromDiagramGraph(
  graph: ParsedDiagramGraph,
  strategy: DiagramCoverageStrategy,
  config: any,
  isTurkish: boolean
): {
  requirements: any[];
  testCases: any[];
  diagramAnalysis: any;
} {
  const customInstr = String(config?.customInstructions || '').trim();
  const customHint = customInstr
    ? isTurkish
      ? ` (Özel Yönerge: ${customInstr.slice(0, 90)})`
      : ` (Custom Guidance: ${customInstr.slice(0, 90)})`
    : '';

  let selectedPaths = [...graph.paths];
  if (strategy === 'basis_path' && selectedPaths.length > 8) {
    const happy = selectedPaths.filter((p) => p.pathType === 'happy').slice(0, 2);
    const loop = selectedPaths.filter((p) => p.pathType === 'loop').slice(0, 2);
    const parallel = selectedPaths.filter((p) => p.pathType === 'parallel').slice(0, 2);
    const neg = selectedPaths.filter((p) => p.pathType === 'negative').slice(0, 3);
    const dec = selectedPaths.filter((p) => p.pathType === 'decision').slice(0, 3);
    selectedPaths = Array.from(new Set([...happy, ...parallel, ...loop, ...neg, ...dec]));
  }

  const dims = extractGraphDimensions(graph);
  const requirements: any[] = [];
  const testCases: any[] = [];
  const pathInfos: any[] = [];

  selectedPaths.forEach((p, idx) => {
    const reqId = `FLOW-${String(idx + 1).padStart(2, '0')}`;
    const mod = p.swimlanes[0] || graph.swimlanes[0] || graph.processTitle || 'Süreç Akışı';
    const condDesc =
      p.conditions.length > 0
        ? p.conditions.join(' → ')
        : isTurkish
        ? 'Doğrudan ardışık süreç adımları'
        : 'Direct sequential flow';

    requirements.push({
      id: reqId,
      title: `${p.name}`,
      description: isTurkish
        ? `Süreç Yolu (${p.id}): ${p.nodeLabels.join(' -> ')}. Karar Koşulları: ${condDesc}.${customHint}`
        : `Process Path (${p.id}): ${p.nodeLabels.join(' -> ')}. Conditions: ${condDesc}.${customHint}`,
      category: mod,
      coverageStatus: 'Full',
      missingTestTypes: [],
      gapDescription: isTurkish
        ? `${p.id} süreç yolu çok boyutlu test senaryoları ile tam kapsandı.`
        : `Process path ${p.id} covered across functional and edge dimensions.`,
    });

    pathInfos.push({
      id: p.id,
      name: p.name,
      pathType: p.pathType,
      nodes: p.nodeLabels,
      conditions: p.conditions,
      linkedReqId: reqId,
    });

    const { steps, stepExpectedResults } = buildStepExpectedPairs(
      p.nodeLabels,
      p.conditions,
      p.isNegative,
      customInstr,
      isTurkish
    );

    const testType = p.isNegative
      ? 'Negatif (Hata Yönetimi)'
      : p.hasLoop
      ? 'Durum Geçiş Testi (State Transition)'
      : p.conditions.length > 0 && p.pathType !== 'happy'
      ? 'Karar Tablosu Testi (Decision Table)'
      : 'Pozitif (Fonksiyonel Doğruluk)';

    const endNode = p.nodeLabels[p.nodeLabels.length - 1] || 'Tamamlandı';
    const expectedResult = isTurkish
      ? p.isNegative
        ? `Süreç belirtilen karar koşulunda (${condDesc}) güvenli biçimde reddedilmeli/durdurulmalı ve "${endNode}" durumuna geçmelidir.`
        : `Süreç tüm adımları (${p.nodeLabels.length} düğüm) hatasız tamamlayarak "${endNode}" sonucuna ulaşmalıdır.`
      : `Process follows path ${p.id} cleanly and reaches "${endNode}".`;

    testCases.push({
      id: `TC-${reqId}-01`,
      reqId,
      module: mod,
      title: `[${p.id}] ${p.name}`,
      description: isTurkish
        ? `Activity Diagram üzerindeki "${p.name}" akış yolunun tüm ara düğümleri (${p.nodeLabels.length} adım) kapsayan uçtan uca doğrulaması.`
        : `Full node-by-node E2E verification for "${p.name}".`,
      preconditions: isTurkish
        ? `Sistem aktif, kullanıcı/aktör oturumu açık ve "${p.nodeLabels[0] || 'Başlangıç'}" adımı için ön koşul verileri hazır olmalıdır.`
        : `System active and prerequisites for "${p.nodeLabels[0]}" ready.`,
      steps,
      stepExpectedResults,
      testData:
        p.conditions.length > 0
          ? isTurkish
            ? `Dallanma Koşulları: ${p.conditions.join(' | ')}`
            : `Branch Conditions: ${p.conditions.join(' | ')}`
          : isTurkish
          ? `Geçerli uçtan uca akış test verisi (${mod})`
          : `Valid flow test data (${mod})`,
      expectedResult,
      priority: p.pathType === 'happy' || p.isNegative ? 'Yüksek' : 'Orta',
      testType,
      executionType: 'Manuel',
      severity: p.isNegative ? 'Kritik' : 'Normal',
    });

    // Happy / Loop / Parallel paths receive an additional State / Idempotency / Retry variant when branch or full_e2e
    if (strategy !== 'basis_path' && (p.pathType === 'happy' || p.hasLoop || p.isParallel)) {
      const variantTitle = p.hasLoop
        ? `[Döngü Sınırı] ${p.id} - Maksimum Tekrar Deneme & Kilitlenme Doğrulaması`
        : p.isParallel
        ? `[Eşzamanlılık] ${p.id} - Paralel Dal Senkronizasyonu ve Kısmi Gecikme Testi`
        : `[Idempotency] ${p.id} - Mükerrer İstek / Çift Tetikleme Önleme Testi`;

      testCases.push({
        id: `TC-${reqId}-02`,
        reqId,
        module: mod,
        title: variantTitle,
        description: isTurkish
          ? p.hasLoop
            ? `${p.id} döngüsünde N-1. denemede kurtarma ile maksimum deneme aşımında güvenli durdurma davranışını doğrular.`
            : p.isParallel
            ? `${p.id} paralel fork/join dallarının farklı hızlarda tamamlanmasına rağmen birleşme noktasında veri bütünlüğünü koruduğunu doğrular.`
            : `${p.id} ana akışının art arda çift tıklama / tekrar gönderim altında mükerrer kayıt üretmediğini doğrular.`
          : `State transition, idempotency and concurrency verification for ${p.id}.`,
        preconditions: isTurkish
          ? `"${p.nodeLabels[0]}" aşaması için aktif oturum ve benzersiz işlem anahtarı (Idempotency-Key) mevcut olmalıdır.`
          : `Active session and idempotency context available.`,
        steps: isTurkish
          ? p.hasLoop
            ? [
                `1. "${p.nodeLabels[0]}" adımından süreci başlatın ve döngü karar noktasına ulaşın.`,
                `2. İlk hata/tekrar koşulunu üreterek döngüye 1. kez girildiğini doğrulayın.`,
                `3. Maksimum izin verilen tekrar sayısına kadar geçersiz veri ile döngüyü tetikleyin.`,
                `4. Limit aşıldığında sürecin kilitlenme/hata dalına yönlendiğini ve geçerli denemeyle kurtarılmadığını kontrol edin.`,
              ]
            : p.isParallel
            ? [
                `1. "${p.nodeLabels[0]}" akışını başlatıp paralel fork düğümüne ulaşın.`,
                `2. Paralel dallardan ilkini normal sürede, diğerini yapay gecikme ile tamamlayın.`,
                `3. Birleştirme (Join) noktasında her iki dalın sonucunun beklendiğini doğrulayın.`,
                `4. Nihai "${endNode}" durumunda tüm alt sonuçların tutarlı birleştiğini teyit edin.`,
              ]
            : [
                `1. "${p.nodeLabels[0]}" adımını geçerli verilerle doldurun.`,
                `2. Onay / gönderim aksiyonunu milisaniyeler içinde art arda iki kez tetikleyin.`,
                `3. İlk isteğin "${endNode}" durumuna ulaştığını, ikinci isteğin ise engellendiğini/aynı sonucu döndürdüğünü doğrulayın.`,
              ]
          : ['1. Start path.', '2. Execute retry/parallel/double-submit condition.', '3. Verify state integrity.'],
        stepExpectedResults: isTurkish
          ? p.hasLoop
            ? [
                '1. Süreç döngü kapısına temiz payload ile ulaşmalıdır.',
                '2. Sayaç 1 artmalı ve tekrar akışı tetiklenmelidir.',
                '3. Her tekrar denemesi denetim loguna ayrı zaman damgasıyla yazılmalıdır.',
                '4. Maksimum eşik aşıldığında sonsuz döngü oluşmamalı, oturum/işlem güvenli hata durumuyla kapatılmalıdır.',
              ]
            : p.isParallel
            ? [
                '1. Paralel dallar eşzamanlı olarak tetiklenmelidir.',
                '2. Hızlı biten dal erken tamamlama ile süreci bozmamalı, join bariyerinde beklemelidir.',
                '3. Tüm dallar tamamlanmadan bir sonraki düğüme geçilmemelidir.',
                '4. Nihai durumda veri kaybı veya yarış durumu (race condition) oluşmamalıdır.',
              ]
            : [
                '1. Form/istek parametreleri doğrulanmalıdır.',
                '2. Sistem ikinci isteği aynı Idempotency-Key ile yakalamalıdır.',
                '3. Veritabanında yalnızca tek bir geçerli işlem kaydı oluşturulmalıdır.',
              ]
          : ['1. Initialized.', '2. Guard enforced.', '3. Single consistent outcome.'],
        testData: isTurkish
          ? p.hasLoop
            ? 'Tekrar Sayacı = N-1 ve N+1 (Limit Aşımı)'
            : 'Eşzamanlı çift istek / gecikmeli paralel yanıt'
          : 'Loop limit & concurrency payload',
        expectedResult: isTurkish
          ? 'Durum geçişi ve işlem bütünlüğü yarış durumu olmadan korunmalıdır.'
          : 'State transition and idempotency remain intact.',
        priority: 'Yüksek',
        testType: 'Durum Geçiş Testi (State Transition)',
        executionType: 'Manuel',
        severity: 'Kritik',
      });
    }
  });

  // 2. Per-Decision-Gate Dedicated BVA & Decision Table Cases (even if paths were already covered)
  const decisionLimit = strategy === 'full_e2e' ? dims.decisions.length : strategy === 'branch' ? Math.min(dims.decisions.length, 5) : Math.min(dims.decisions.length, 2);
  dims.decisions.slice(0, decisionLimit).forEach((dec, dIdx) => {
    const targetReqId = requirements[dIdx % Math.max(1, requirements.length)]?.id || 'FLOW-01';
    const branchSummary = dec.branches.map((b) => `"${b.label}" -> ${b.targetLabel}`).join(' | ');

    testCases.push({
      id: `TC-DEC-${String(dIdx + 1).padStart(2, '0')}-BVA`,
      reqId: targetReqId,
      module: dec.swimlane || graph.processTitle || 'Karar Motoru',
      title: `[Karar & Sınır Değer] "${dec.label}" - Eşik Değer & Dallanma Doğrulaması`,
      description: isTurkish
        ? `"${dec.label}" karar noktasındaki (${branchSummary}) tüm koşulların sınır altı, tam sınır, sınır üstü ve boş değerlerde doğru yönlendirme yaptığını doğrular.`
        : `Boundary and decision table test for decision node "${dec.label}".`,
      preconditions: isTurkish
        ? `Akış "${dec.label}" karar düğümünden hemen önceki adımda bekliyor olmalıdır.`
        : `Process positioned before decision node "${dec.label}".`,
      steps: isTurkish
        ? [
            `1. Süreci başlatıp "${dec.label}" karar noktasına ulaşın.`,
            `2. Koşulu sağlayan tam sınır değerini (Boundary Min/Max) göndererek olumlu dal geçişini test edin.`,
            `3. Koşulu ihlal eden sınır dışı (Min-1 / Max+1 veya geçersiz) değer ile isteği yineleyin.`,
            `4. Karar parametresini boş (null/undefined) bırakarak varsayılan/hata dalı davranışını doğrulayın.`,
          ]
        : [
            `1. Reach decision "${dec.label}".`,
            `2. Test exact boundary value.`,
            `3. Test out-of-bounds value.`,
            `4. Test null/empty input.`,
          ],
      stepExpectedResults: isTurkish
        ? [
            `1. Karar kapısı gelen payload üzerindeki ilgili kriteri okumalıdır.`,
            `2. Eşik değerde olumlu/beklenen dal (${dec.branches[0]?.label || 'Evet'}) seçilmelidir.`,
            `3. Sınır dışı girdi kesinlikle olumsuz/alternatif dala yönlendirilmeli ve yanlış onay verilmemelidir.`,
            `4. Eksik parametrede sistem belirsiz geçiş yapmamalı, doğrulama hatası veya güvenli ret dalını tetiklemelidir.`,
          ]
        : ['1. Gate inspects payload.', '2. Exact threshold accepted.', '3. Out-of-bounds rejected.', '4. Null handled safely.'],
      testData: isTurkish
        ? `Eşik: Min, Exact, Max+1, Null (${dec.branches.map((b) => b.label).join(' / ')})`
        : `Boundary dataset (${dec.label})`,
      expectedResult: isTurkish
        ? `"${dec.label}" karar kapısı tüm sınır ve null koşullarda belirleyici (deterministic) yönlendirme yapmalıdır.`
        : `Decision node "${dec.label}" behaves deterministically across boundaries.`,
      priority: 'Yüksek',
      testType: 'Sınır Değer Analizi (BVA)',
      executionType: 'Manuel',
      severity: 'Yüksek',
    });
  });

  // 3. Action-Node Input Validation & Downstream Timeout / Rollback Cases
  if (strategy !== 'basis_path') {
    const actionLimit = strategy === 'full_e2e' ? Math.min(dims.actionNodes.length, 4) : Math.min(dims.actionNodes.length, 2);
    dims.actionNodes.slice(0, actionLimit).forEach((act, aIdx) => {
      const targetReqId = requirements[(aIdx + 1) % Math.max(1, requirements.length)]?.id || 'FLOW-01';
      testCases.push({
        id: `TC-ACT-${String(aIdx + 1).padStart(2, '0')}-NEG`,
        reqId: targetReqId,
        module: act.swimlane || graph.processTitle || 'İşlem Adımı',
        title: `[Negatif / Kurtarma] "${act.label}" - Hatalı Girdi & Servis Zaman Aşımı Geri Alma (Rollback)`,
        description: isTurkish
          ? `"${act.label}" aktivite adımında bozuk/eksik girdi gönderildiğinde veya harici bağımlılık zaman aşımına uğradığında işlemin yarım kalmadan geri alındığını doğrular.`
          : `Negative input and timeout rollback validation on action node "${act.label}".`,
        preconditions: isTurkish
          ? `Akış "${act.label}" adımına gelmiş ve önceki adımların durumu veritabanında kayıtlı olmalıdır.`
          : `Workflow reached "${act.label}".`,
        steps: isTurkish
          ? [
              `1. "${act.label}" adımına zorunlu alanları eksik veya hatalı formatlı veri gönderin.`,
              `2. Geçerli veriyle tekrar deneyip servis/ağ katmanında zaman aşımı (Timeout / HTTP 503) simüle edin.`,
              `3. Hata sonrasında önceki adımlarda oluşan geçici durumların tutarlı biçimde korunduğunu veya geri alındığını kontrol edin.`,
            ]
          : [`1. Submit malformed payload at "${act.label}".`, `2. Simulate timeout.`, `3. Check rollback consistency.`],
        stepExpectedResults: isTurkish
          ? [
              `1. Adım işlenmeden önce şema/alan doğrulama hatası (HTTP 400/422) dönülmelidir.`,
              `2. Zaman aşımı durumunda sistem kullanıcıya anlaşılır tekrar deneme/hata mesajı göstermelidir.`,
              `3. Yetim (orphan) kayıt veya tutarsız durum oluşmamalı; telafi/rollback mekanizması çalışmalıdır.`,
            ]
          : ['1. Schema error 400/422 returned.', '2. Timeout surfaced cleanly.', '3. No orphaned partial state.'],
        testData: isTurkish ? 'Eksik zorunlu alanlar + 30sn Timeout / HTTP 503' : 'Invalid payload + HTTP 503 timeout',
        expectedResult: isTurkish
          ? `"${act.label}" adımındaki hatalar sonraki düğümlere sızmamalı ve veri bütünlüğü korunmalıdır.`
          : `Failures at "${act.label}" remain isolated with clean rollback.`,
        priority: 'Yüksek',
        testType: 'Negatif (Hata Yönetimi)',
        executionType: 'Manuel',
        severity: 'Kritik',
      });
    });
  }

  // 4. Swimlane Handoff Authorization & State-Skip Security Cases
  if (config?.includeSecurity !== false || strategy === 'full_e2e') {
    const handoffTarget = dims.swimlaneHandoffs[0];
    const secReqId = requirements[0]?.id || 'FLOW-01';
    testCases.push({
      id: `TC-SEC-HANDOFF-01`,
      reqId: secReqId,
      module: handoffTarget ? `${handoffTarget.fromSwimlane} → ${handoffTarget.toSwimlane}` : graph.processTitle,
      title: handoffTarget
        ? `[Güvenlik / Rol Devri] ${handoffTarget.fromSwimlane} → ${handoffTarget.toSwimlane} Yetkisiz Geçiş Engeli`
        : `[Güvenlik / Durum Bütünlüğü] Süreç Adımı Atlama (State-Skip) & Yetkisiz Tetikleme Engeli`,
      description: isTurkish
        ? handoffTarget
          ? `"${handoffTarget.fromSwimlane}" rolündeki kullanıcının "${handoffTarget.toSwimlane}" alanındaki "${handoffTarget.toLabel}" adımını doğrudan tetikleyemediğini ve karar adımlarının atlanamadığını doğrular.`
          : `Kullanıcının ara karar/doğrulama düğümlerini atlayarak doğrudan bitiş/onay durumuna geçemediğini (Workflow Bypass / IDOR) doğrular.`
        : `Verify swimlane role isolation and workflow state-skip protection.`,
      preconditions: isTurkish
        ? `Düşük yetkili oturum (veya başlangıç aşamasındaki işlem ID) hazır olmalıdır.`
        : `Lower-privilege session and active flow ID ready.`,
      steps: isTurkish
        ? [
            handoffTarget
              ? `1. "${handoffTarget.fromSwimlane}" rolüne ait oturumla işlemi "${handoffTarget.fromLabel}" aşamasına getirin.`
              : `1. Süreci başlangıç düğümünden başlatıp geçerli bir işlem kimliği alın.`,
            handoffTarget
              ? `2. Yetkisiz aynı oturumla doğrudan "${handoffTarget.toSwimlane}" katmanındaki "${handoffTarget.toLabel}" uç noktasını çağırın.`
              : `2. Ara karar düğümünü tamamlamadan doğrudan bitiş/onay düğümüne API/URL isteği gönderin.`,
            `3. İstek yanıtını, güvenlik/audit logunu ve süreç durumunun değişmediğini doğrulayın.`,
          ]
        : ['1. Start process.', '2. Attempt direct call to privileged/terminal step.', '3. Confirm 403/409 block.'],
      stepExpectedResults: isTurkish
        ? [
            '1. İşlem başlangıç durumu aktif olarak doğrulanmalıdır.',
            '2. Sistem yetki ihlalini veya geçersiz durum geçişini yakalayarak HTTP 403 Forbidden / 409 Conflict ile reddetmelidir.',
            '3. Süreç durumu ilerlememeli ve güvenlik denetim kaydı (Audit Log) oluşturulmalıdır.',
          ]
        : ['1. Active flow.', '2. Blocked with HTTP 403/409.', '3. State unchanged and audited.'],
      testData: isTurkish ? 'Yetkisiz rol tokenı / ara adım atlanmış state payload' : 'Unauthorized role token / skipped state',
      expectedResult: isTurkish
        ? 'Yetkisiz swimlane geçişi ve durum atlama girişimleri kesinlikle engellenmelidir.'
        : 'Unauthorized transitions and state skipping are strictly blocked.',
      priority: 'Yüksek',
      testType: 'Güvenlik ve Yetki Testi (Security)',
      executionType: 'Manuel',
      severity: 'Kritik',
    });

    // Dedicated Workflow State-Skip / Terminal Endpoint Bypass check
    testCases.push({
      id: `TC-SEC-STATESKIP-02`,
      reqId: secReqId,
      module: graph.processTitle || 'Süreç Güvenliği',
      title: `[Güvenlik / State-Skip] Karar Kapılarını Atlayarak Doğrudan Sonuç Düğümüne Geçiş Engeli`,
      description: isTurkish
        ? `Önceki doğrulama ve karar düğümleri ("${dims.decisions[0]?.label || 'Karar Adımı'}") tamamlanmadan doğrudan onay/tamamlanma adımının tetiklenemediğini doğrular.`
        : `Verify prior decision gates cannot be bypassed to reach terminal approval directly.`,
      preconditions: isTurkish
        ? `Süreç henüz başlangıç aşamasında ("Başlatıldı" durumunda) ve karar kapıları geçilmemiş olmalıdır.`
        : `Process in initial state without clearing decision gates.`,
      steps: isTurkish
        ? [
            `1. Süreci başlatıp yalnızca ilk adım durumundaki işlem kimliğini (Transaction/Case ID) alın.`,
            `2. "${dims.decisions[0]?.label || 'Karar Noktası'}" onaylanmadan doğrudan nihai onay/bitiş API veya adım çağrısını gönderin.`,
            `3. Durum makinesinin geçişi reddettiğini ve süreç durumunun değişmediğini teyit edin.`,
          ]
        : ['1. Init process ID.', '2. Call terminal endpoint bypassing decision gates.', '3. Confirm rejection.'],
      stepExpectedResults: isTurkish
        ? [
            '1. İşlem başlangıç durumunda kayıtlı olmalıdır.',
            '2. Sunucu durum makinesi geçersiz durum geçişini (Invalid State Transition) HTTP 409 Conflict / 403 ile engellemelidir.',
            '3. Süreç durumu ilerlememeli ve güvenlik ihlali uyarısı loglanmalıdır.',
          ]
        : ['1. Initial state recorded.', '2. HTTP 409/403 returned.', '3. State unchanged.'],
      testData: isTurkish ? 'state=INIT iken target=COMPLETED baypas isteği' : 'state=INIT bypass payload',
      expectedResult: isTurkish
        ? 'Durum atlama (Workflow Bypass) girişimi kesinlikle engellenmelidir.'
        : 'Workflow bypass attempts strictly blocked.',
      priority: 'Yüksek',
      testType: 'Güvenlik ve Yetki Testi (Security)',
      executionType: 'Manuel',
      severity: 'Kritik',
    });
  }

  // 5. Parallel Concurrency / Throughput SLA Test (when parallel nodes or includePerformance or full_e2e)
  if (config?.includePerformance || dims.parallelNodes.length > 0 || strategy === 'full_e2e') {
    const perfReqId = requirements[0]?.id || 'FLOW-01';
    testCases.push({
      id: `TC-PERF-FLOW-01`,
      reqId: perfReqId,
      module: graph.processTitle || 'Performans',
      title: `[Performans / Eşzamanlılık] Eşzamanlı Süreç Akışı Yükü & Paralel Dal SLA Doğrulaması`,
      description: isTurkish
        ? `Aynı anda çoklu süreç akışının ve ${dims.parallelNodes.length > 0 ? 'paralel fork/join dallarının' : 'karar kapılarının'} belirlenen yanıt süresi (SLA) içinde kilitlenmeden tamamlandığını doğrular.`
        : `Concurrent workflow execution and SLA throughput verification.`,
      preconditions: isTurkish
        ? `Yük test ortamı hazır, veritabanı bağlantı havuzu ve kuyruk tüketicileri aktif olmalıdır.`
        : `Load environment ready.`,
      steps: isTurkish
        ? [
            `1. Süreç başlangıç noktasına saniyede 25 eşzamanlı istek göndererek paralel akışları tetikleyin.`,
            `2. Karar kapıları ve harici servis adımlarında ortalama/P95 yanıt sürelerini ölçün.`,
            `3. Tamamlanan akışlarda deadlock, yarış durumu (race condition) veya kuyruk birikmesi olmadığını kontrol edin.`,
          ]
        : ['1. Trigger 25 req/s concurrent flows.', '2. Measure P95 latency.', '3. Verify zero deadlocks.'],
      stepExpectedResults: isTurkish
        ? [
            '1. Tüm eşzamanlı süreç örnekleri kuyruğa hatasız alınmalıdır.',
            '2. P95 uçtan uca işlem tamamlama süresi tanımlı SLA eşiğinin (< 2000ms) altında kalmalıdır.',
            '3. Deadlock, veri çakışması veya HTTP 5xx hatası %0 olmalıdır.',
          ]
        : ['1. All requests queued cleanly.', '2. P95 < 2000ms SLA.', '3. Zero deadlocks or 5xx errors.'],
      testData: isTurkish ? '25 RPS eşzamanlı süreç yükü, 60 sn süre' : '25 RPS concurrent load for 60s',
      expectedResult: isTurkish
        ? 'Eşzamanlı süreç akışları SLA içinde hatasız tamamlanmalıdır.'
        : 'Concurrent flows complete within SLA cleanly.',
      priority: 'Orta',
      testType: 'Performans ve Ölçeklenebilirlik (Performance)',
      executionType: 'Otomasyon',
      severity: 'Orta',
    });
  }

  const decisionCount = Math.max(
    dims.decisions.length,
    graph.nodes.filter((n) => n.type === 'decision').length
  );

  return {
    requirements,
    testCases,
    diagramAnalysis: {
      processTitle: graph.processTitle,
      formatDetected: graph.formatDetected,
      nodeCount: graph.nodes.length,
      decisionCount,
      swimlanes: graph.swimlanes,
      paths: pathInfos,
      analyzedAt: new Date().toISOString(),
    },
  };
}

/**
 * Helper: Call Gemini (`gemini-3.1-flash-lite` / `gemini-4-hydrogen`) with clean model rotation & optional OpenRouter fallback
 */
async function invokeDiagramAIJson({
  geminiKey,
  modelsToTry,
  systemPrompt,
  contents,
  responseSchema,
  timeoutPerModelMs,
  callOpenRouterFallback,
  openRouterUserPrompt,
  isAllQuotaExhausted,
  isGeminiQuotaExhausted,
  markGeminiQuotaExhausted,
  checkIsQuotaExhaustedError,
  tag,
}: {
  geminiKey?: string;
  modelsToTry: string[];
  systemPrompt: string;
  contents: any;
  responseSchema: any;
  timeoutPerModelMs: number;
  callOpenRouterFallback?: (params: { systemPrompt: string; userPrompt: string; timeoutMs?: number }) => Promise<{ text: string; modelUsed: string }>;
  openRouterUserPrompt?: string;
  isAllQuotaExhausted?: () => boolean;
  isGeminiQuotaExhausted?: () => boolean;
  markGeminiQuotaExhausted?: (retrySec?: number, reason?: string) => void;
  checkIsQuotaExhaustedError?: (err: any) => { isQuota: boolean; retrySeconds?: number; reason?: string };
  tag: string;
}): Promise<any | null> {
  if (geminiKey && !(isGeminiQuotaExhausted && isGeminiQuotaExhausted()) && !(isAllQuotaExhausted && isAllQuotaExhausted())) {
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    for (const model of modelsToTry) {
      try {
        const apiCall = ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema,
            ...(model.startsWith('gemini-4-')
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Response threshold (${timeoutPerModelMs}ms) reached on ${model}`)),
            timeoutPerModelMs
          )
        );

        const response = await Promise.race([apiCall, timeoutPromise]);
        const rawText = (response?.text || '').trim();
        if (rawText) {
          const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          console.log(`[Diagram AI:${tag}] SUCCESS with '${model}'`);
          return parsed;
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        const isThresholdTimeout = msg.includes('Response threshold');
        if (checkIsQuotaExhaustedError) {
          const q = checkIsQuotaExhaustedError(err);
          if (q.isQuota && markGeminiQuotaExhausted) {
            console.info(`[Diagram AI:${tag}] Quota limit reached on '${model}', switching to fallback engine.`);
            markGeminiQuotaExhausted(q.retrySeconds, q.reason);
            break;
          }
        }
        if (isThresholdTimeout) {
          // Do not cascade sequential timeouts across backup models in parallel mode; Phase 3 deterministic fills immediately
          console.info(`[Diagram AI:${tag}] '${model}' exceeded ${timeoutPerModelMs}ms threshold; handing off cleanly.`);
          return null;
        }
        console.info(`[Diagram AI:${tag}] Rotating from '${model}' (${msg || 'unavailable'})...`);
      }
    }
  }

  if (openRouterUserPrompt && callOpenRouterFallback && !(isAllQuotaExhausted && isAllQuotaExhausted())) {
    try {
      const orRes = await callOpenRouterFallback({
        systemPrompt,
        userPrompt: openRouterUserPrompt,
        timeoutMs: 5000,
      });
      if (orRes?.text) {
        const cleaned = orRes.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        const start =
          firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
            ? firstBracket
            : firstBrace;
        const end = start === firstBracket ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');
        if (start !== -1 && end > start) {
          return JSON.parse(cleaned.slice(start, end + 1));
        }
      }
    } catch (orErr: any) {
      console.info(`[Diagram AI:${tag}] OpenRouter fallback unavailable:`, orErr?.message || orErr);
    }
  }

  return null;
}

/**
 * Phase 1 (Image Only): Extract clean topological Process Graph from uploaded Diagram Image
 */
async function extractDiagramGraphFromImage({
  diagramImageBase64,
  diagramImageMimeType,
  diagramFileName,
  geminiKey,
  isAllQuotaExhausted,
  isGeminiQuotaExhausted,
  markGeminiQuotaExhausted,
  checkIsQuotaExhaustedError,
}: {
  diagramImageBase64: string;
  diagramImageMimeType: string;
  diagramFileName?: string;
  geminiKey?: string;
  isAllQuotaExhausted?: () => boolean;
  isGeminiQuotaExhausted?: () => boolean;
  markGeminiQuotaExhausted?: (retrySec?: number, reason?: string) => void;
  checkIsQuotaExhaustedError?: (err: any) => { isQuota: boolean; retrySeconds?: number; reason?: string };
}): Promise<ParsedDiagramGraph | null> {
  const cleanBase64 = diagramImageBase64.replace(/^data:[^;]+;base64,/, '');

  const graphSchema = {
    type: Type.OBJECT,
    properties: {
      processTitle: { type: Type.STRING },
      swimlanes: { type: Type.ARRAY, items: { type: Type.STRING } },
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            label: { type: Type.STRING },
            type: { type: Type.STRING },
            swimlane: { type: Type.STRING },
          },
          required: ['id', 'label', 'type'],
        },
      },
      edges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            from: { type: Type.STRING },
            to: { type: Type.STRING },
            label: { type: Type.STRING },
            isNegative: { type: Type.BOOLEAN },
          },
          required: ['from', 'to'],
        },
      },
    },
    required: ['processTitle', 'nodes', 'edges'],
  };

  const visionPrompt = `Analyze this Activity Diagram / Flowchart / BPMN image thoroughly and transcribe EVERY node, swimlane, decision diamond, loop arrow, fork/join bar, and transition edge into JSON.
${diagramFileName ? `File Name: ${diagramFileName}` : ''}
RULES:
- "type" MUST be one of: "start", "end", "action", "decision", "fork_join".
- Read every decision diamond and its outgoing branch labels (e.g., "Yes"/"No", "Evet"/"Hayır", error codes, conditions).
- Include ALL nodes and edges faithfully so every flow path can be enumerated.`;

  const extracted = await invokeDiagramAIJson({
    geminiKey,
    modelsToTry: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    systemPrompt: 'You are an expert UML/BPMN diagram OCR & graph extraction engine. Output strictly valid JSON matching schema.',
    contents: {
      parts: [
        { inlineData: { mimeType: diagramImageMimeType, data: cleanBase64 } },
        { text: visionPrompt },
      ],
    },
    responseSchema: graphSchema,
    timeoutPerModelMs: 16000,
    isAllQuotaExhausted,
    isGeminiQuotaExhausted,
    markGeminiQuotaExhausted,
    checkIsQuotaExhaustedError,
    tag: 'VisionGraph',
  });

  if (!extracted || !Array.isArray(extracted.nodes) || extracted.nodes.length === 0) {
    return null;
  }

  const nodes: DiagramNode[] = extracted.nodes.map((n: any, idx: number) => ({
    id: String(n.id || `N_${idx + 1}`).trim(),
    label: sanitizeDiagramLabel(n.label || n.id || `Adım ${idx + 1}`) || `Adım ${idx + 1}`,
    type: ['start', 'end', 'action', 'decision', 'fork_join'].includes(n.type) ? n.type : 'action',
    swimlane: n.swimlane ? sanitizeDiagramLabel(n.swimlane) || undefined : undefined,
  }));

  const edges: DiagramEdge[] = Array.isArray(extracted.edges)
    ? extracted.edges.map((e: any) => {
        const cleanEdgeLabel = e.label ? sanitizeDiagramLabel(e.label) || undefined : undefined;
        return {
          from: String(e.from || '').trim(),
          to: String(e.to || '').trim(),
          label: cleanEdgeLabel,
          isNegative:
            typeof e.isNegative === 'boolean'
              ? e.isNegative
              : cleanEdgeLabel
              ? NEGATIVE_BRANCH_REGEX.test(cleanEdgeLabel)
              : false,
        };
      }).filter((e: DiagramEdge) => e.from && e.to)
    : [];

  const paths = enumerateProcessPaths(nodes, edges);
  const swimlanes = Array.isArray(extracted.swimlanes)
    ? extracted.swimlanes.map((s: any) => sanitizeDiagramLabel(s)).filter(Boolean)
    : Array.from(new Set(nodes.map((n) => n.swimlane).filter((s): s is string => Boolean(s))));

  return {
    formatDetected: 'image',
    processTitle: sanitizeDiagramLabel(extracted.processTitle || diagramFileName || 'Görsel Süreç Diyagramı').replace(/\.[^.]+$/, ''),
    swimlanes,
    nodes,
    edges,
    paths,
  };
}

/**
 * Multi-Pass Multimodal + Parallel AI Diagram QA Architect Engine:
 *   1. Builds full ParsedDiagramGraph (via parser for text notations, or Vision-to-Graph for images)
 *   2. Launches concurrent AI batches (`Promise.all`) covering:
 *        - Full node-by-node E2E process path scenarios (chunks of 4 paths)
 *        - Decision Gate BVA/Decision Table, Action Negatives, Swimlane Handoff Security, and Retry/Concurrency tests
 *   3. Audits & completes any uncovered paths, decision gates, or security gaps deterministically
 */
export async function analyzeDiagramAndGenerateTests({
  diagramText,
  diagramImageBase64,
  diagramImageMimeType,
  diagramFileName,
  coverageStrategy = 'branch',
  corporateRules = [],
  config = {},
  isTurkish = true,
  callOpenRouterFallback,
  isAllQuotaExhausted,
  isGeminiQuotaExhausted,
  markGeminiQuotaExhausted,
  checkIsQuotaExhaustedError,
}: {
  diagramText?: string;
  diagramImageBase64?: string;
  diagramImageMimeType?: string;
  diagramFileName?: string;
  coverageStrategy?: DiagramCoverageStrategy;
  corporateRules?: any[];
  config?: any;
  isTurkish?: boolean;
  callOpenRouterFallback?: (params: {
    systemPrompt: string;
    userPrompt: string;
    timeoutMs?: number;
  }) => Promise<{ text: string; modelUsed: string }>;
  isAllQuotaExhausted?: () => boolean;
  isGeminiQuotaExhausted?: () => boolean;
  markGeminiQuotaExhausted?: (retrySec?: number, reason?: string) => void;
  checkIsQuotaExhaustedError?: (err: any) => { isQuota: boolean; retrySeconds?: number; reason?: string };
}) {
  const customInstructions = String(config?.customInstructions || '').trim();
  const activeRules = Array.isArray(corporateRules)
    ? corporateRules.filter((r) => r.isDefaultActive !== false)
    : [];

  const rulesPrompt =
    activeRules.length > 0
      ? `\nACTIVE CORPORATE QA RULES:\n${activeRules.map((r: any) => `- [${r.title}]: ${r.promptRule}`).join('\n')}`
      : '';

  const customGuidancePrompt = customInstructions
    ? `\nMANDATORY CUSTOM USER INSTRUCTIONS (MUST BE REFLECTED IN STEPS & TEST DATA):\n${customInstructions}`
    : '';

  const geminiKey = process.env.GEMINI_API_KEY;
  const hasImage = Boolean(diagramImageBase64 && diagramImageMimeType);
  const textParsedGraph = diagramText && diagramText.trim() ? parseActivityDiagramText(diagramText) : null;

  // PHASE 1: Ensure we have a structured Process Graph (from text parser OR Vision OCR Graph extraction)
  let workingGraph: ParsedDiagramGraph | null =
    textParsedGraph && textParsedGraph.nodes.length > 0 ? textParsedGraph : null;

  if (!workingGraph && hasImage && diagramImageBase64 && diagramImageMimeType) {
    workingGraph = await extractDiagramGraphFromImage({
      diagramImageBase64,
      diagramImageMimeType,
      diagramFileName,
      geminiKey,
      isAllQuotaExhausted,
      isGeminiQuotaExhausted,
      markGeminiQuotaExhausted,
      checkIsQuotaExhaustedError,
    });
  }

  // Build base deterministic synthesis (also gives us exact full path/decision/swimlane inventory & instant fallback)
  let finalRequirements: any[] = [];
  let finalTestCases: any[] = [];
  let finalAnalysis: any = null;

  if (workingGraph && workingGraph.nodes.length > 0) {
    const synth = synthesizeTestCasesFromDiagramGraph(workingGraph, coverageStrategy, config, isTurkish);
    const dims = extractGraphDimensions(workingGraph);

    // Select paths to send to parallel AI batches based on coverageStrategy
    const targetPathsForAI =
      coverageStrategy === 'basis_path'
        ? workingGraph.paths.slice(0, 8)
        : coverageStrategy === 'full_e2e'
        ? workingGraph.paths.slice(0, 16)
        : workingGraph.paths.slice(0, 12);

    const pathChunks: EnumeratedPath[][] = [];
    const PATH_CHUNK_SIZE = 3;
    for (let i = 0; i < targetPathsForAI.length; i += PATH_CHUNK_SIZE) {
      pathChunks.push(targetPathsForAI.slice(i, i + PATH_CHUNK_SIZE));
    }

    const tcBatchSchema = {
      type: Type.OBJECT,
      properties: {
        testCases: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              reqId: { type: Type.STRING },
              module: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              preconditions: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              stepExpectedResults: { type: Type.ARRAY, items: { type: Type.STRING } },
              testData: { type: Type.STRING },
              expectedResult: { type: Type.STRING },
              priority: { type: Type.STRING },
              testType: { type: Type.STRING },
              executionType: { type: Type.STRING },
              severity: { type: Type.STRING },
            },
            required: ['id', 'reqId', 'module', 'title', 'steps', 'stepExpectedResults', 'expectedResult', 'priority', 'testType'],
          },
        },
      },
      required: ['testCases'],
    };

    const langDirective = isTurkish ? 'TURKISH' : 'ENGLISH';
    const baseSystemPrompt = `You are a Principal Software QA Architect & ISTQB Expert specializing in deep Activity Diagram & Model-Based Testing.
LANGUAGE: Write EVERY field strictly in ${langDirective}.
${rulesPrompt}
${customGuidancePrompt}
STRICT RULES:
1. NEVER compress or skip intermediate diagram steps. Trace EVERY node in the path explicitly as numbered steps ("1. ...", "2. ...").
2. "stepExpectedResults" MUST be a 1-to-1 matching array of exact verifiable system expectations (same length as "steps").
3. Include realistic domain-specific "testData" (amounts, role tokens, HTTP codes, boundary thresholds) — never generic placeholders.
4. "testType" MUST be one of: "Pozitif (Fonksiyonel Doğruluk)", "Negatif (Hata Yönetimi)", "Durum Geçiş Testi (State Transition)", "Karar Tablosu Testi (Decision Table)", "Sınır Değer Analizi (BVA)", "Kullanım Senaryosu Testi (Use Case)", "Güvenlik ve Yetki Testi (Security)", "Performans ve Ölçeklenebilirlik (Performance)".
5. Every testCase "reqId" MUST match one of the provided "FLOW-XX" IDs. Return ONLY valid JSON.`;

    const aiAvailable =
      Boolean(geminiKey) &&
      !(isGeminiQuotaExhausted && isGeminiQuotaExhausted()) &&
      !(isAllQuotaExhausted && isAllQuotaExhausted());

    const batchPromises: Promise<any[]>[] = [];

    if (aiAvailable) {
      // Stream 1: Parallel E2E Process Path Batches (chunks of 3 paths for fast <5s JSON turnaround)
      pathChunks.forEach((chunk, chunkIdx) => {
        const pathSpecs = chunk
          .map((p) => {
            const linkedReq = synth.requirements.find((r) => r.title === p.name)?.id || `FLOW-${String(workingGraph!.paths.indexOf(p) + 1).padStart(2, '0')}`;
            const caseGoal =
              p.pathType === 'happy' || p.hasLoop || p.isParallel
                ? 'Generate 2 cases: (1) Full Node-by-Node E2E Path Test, (2) State/Idempotency/Retry-Limit Variant'
                : 'Generate 1 thorough Node-by-Node E2E test case tracing all nodes & branch condition';
            return `- ${p.id} (reqId: ${linkedReq}, type: ${p.pathType}, swimlanes: [${p.swimlanes.join(', ') || workingGraph!.processTitle}]):
  Nodes (${p.nodeLabels.length}): ${p.nodeLabels.join(' -> ')}
  Conditions: ${p.conditions.join(' | ') || 'Sequential'}
  Goal: ${caseGoal}`;
          })
          .join('\n\n');

        const userPrompt = `Process Title: ${workingGraph!.processTitle}
Generate node-by-node test cases for these ${chunk.length} Activity Diagram paths (map every node in "Nodes" to a numbered step!):

${pathSpecs}`;

        batchPromises.push(
          invokeDiagramAIJson({
            geminiKey,
            modelsToTry: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
            systemPrompt: baseSystemPrompt,
            contents: userPrompt,
            responseSchema: tcBatchSchema,
            timeoutPerModelMs: 9000,
            callOpenRouterFallback,
            openRouterUserPrompt: `${baseSystemPrompt}\n\n${userPrompt}`,
            isAllQuotaExhausted,
            isGeminiQuotaExhausted,
            markGeminiQuotaExhausted,
            checkIsQuotaExhaustedError,
            tag: `PathsBatch-${chunkIdx + 1}`,
          }).then((res) => (Array.isArray(res?.testCases) ? res.testCases : []))
        );
      });

      const reqIdsList = synth.requirements.map((r) => r.id).slice(0, 12).join(', ') || 'FLOW-01';

      // Stream 2A: Parallel Decision Gates & BVA / Decision Table Batch
      if (dims.decisions.length > 0) {
        const decSpecs = dims.decisions
          .slice(0, coverageStrategy === 'full_e2e' ? 8 : 5)
          .map(
            (d, i) =>
              `${i + 1}. "${d.label}" -> ${d.branches.map((b) => `[${b.label}]=>${b.targetLabel}`).join(', ')}`
          )
          .join('\n');

        const decPrompt = `Process Title: ${workingGraph!.processTitle}
Valid reqIds: [${reqIdsList}]
Generate 1 BVA or Decision Table test case for EACH decision diamond below (boundary min/exact/max+1/null):
${decSpecs}`;

        batchPromises.push(
          invokeDiagramAIJson({
            geminiKey,
            modelsToTry: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
            systemPrompt: baseSystemPrompt,
            contents: decPrompt,
            responseSchema: tcBatchSchema,
            timeoutPerModelMs: 9000,
            callOpenRouterFallback,
            openRouterUserPrompt: `${baseSystemPrompt}\n\n${decPrompt}`,
            isAllQuotaExhausted,
            isGeminiQuotaExhausted,
            markGeminiQuotaExhausted,
            checkIsQuotaExhaustedError,
            tag: 'DeepQA-Decisions',
          }).then((res) => (Array.isArray(res?.testCases) ? res.testCases : []))
        );
      }

      // Stream 2B: Parallel Action Negative, Security / State-Skip & Rollback Batch
      if (coverageStrategy !== 'basis_path' && (dims.actionNodes.length > 0 || dims.swimlaneHandoffs.length > 0)) {
        const handoffSpecs = dims.swimlaneHandoffs
          .slice(0, 5)
          .map((h, i) => `${i + 1}. ${h.fromSwimlane}(${h.fromLabel}) -> ${h.toSwimlane}(${h.toLabel})`)
          .join('\n');
        const actionSpecs = dims.actionNodes
          .slice(0, 5)
          .map((a) => `- "${a.label}"`)
          .join('\n');

        const secNegPrompt = `Process Title: ${workingGraph!.processTitle}
Valid reqIds: [${reqIdsList}]
Generate 5 targeted QA test cases (4-6 steps each):
1. Invalid payload & timeout/HTTP 503 rollback on key Actions:
${actionSpecs || '- Main action nodes'}
2. Role authorization & State-Skip bypass security ("Güvenlik ve Yetki Testi (Security)") on Swimlanes:
${handoffSpecs || 'Single-actor flow (test bypassing decision gates to jump to terminal node)'}`;

        batchPromises.push(
          invokeDiagramAIJson({
            geminiKey,
            modelsToTry: ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
            systemPrompt: baseSystemPrompt,
            contents: secNegPrompt,
            responseSchema: tcBatchSchema,
            timeoutPerModelMs: 9000,
            callOpenRouterFallback,
            openRouterUserPrompt: `${baseSystemPrompt}\n\n${secNegPrompt}`,
            isAllQuotaExhausted,
            isGeminiQuotaExhausted,
            markGeminiQuotaExhausted,
            checkIsQuotaExhaustedError,
            tag: 'DeepQA-SecNeg',
          }).then((res) => (Array.isArray(res?.testCases) ? res.testCases : []))
        );
      }
    }

    const batchResults = batchPromises.length > 0 ? await Promise.all(batchPromises) : [];
    const aiRawCases = batchResults.flat();

    finalRequirements = synth.requirements;
    finalAnalysis = synth.diagramAnalysis;

    if (aiRawCases.length > 0) {
      const validReqSet = new Set(finalRequirements.map((r) => r.id));
      const normalizedAiCases = aiRawCases.map((tc: any, idx: number) => {
        const candidateReqId = String(tc.reqId || '').trim();
        const resolvedReqId = validReqSet.has(candidateReqId)
          ? candidateReqId
          : finalRequirements[idx % finalRequirements.length]?.id || 'FLOW-01';

        const steps: string[] =
          Array.isArray(tc.steps) && tc.steps.length > 0
            ? tc.steps.map((s: any, sIdx: number) => {
                const clean = sanitizeDiagramLabel(String(s || ''));
                return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean || 'Adımı yürütün.'}`;
              })
            : ['1. Süreci başlatın.', '2. Karar koşulunu doğrulayın.'];

        const overallExp =
          sanitizeDiagramLabel(tc.expectedResult || '') ||
          (isTurkish ? 'Süreç beklenen hedef düğüme hatasız ulaşmalıdır.' : 'Process reaches expected node.');
        const stepExpectedResults: string[] = steps.map((st, sIdx) => {
          const provided = Array.isArray(tc.stepExpectedResults) ? tc.stepExpectedResults[sIdx] : '';
          if (provided && String(provided).trim()) {
            const clean = sanitizeDiagramLabel(String(provided));
            return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
          }
          if (sIdx === steps.length - 1) return `${sIdx + 1}. ${overallExp.replace(/^\d+[\.\)]\s*/, '')}`;
          return `${sIdx + 1}. ${st.replace(/^\d+[\.\)]\s*/, '')} adımı başarıyla tamamlanmalıdır.`;
        });

        const cleanTitle = sanitizeDiagramLabel(tc.title || '') || `Süreç Senaryosu ${idx + 1}`;
        return {
          id: tc.id || `TC-${resolvedReqId}-${String(idx + 1).padStart(2, '0')}`,
          reqId: resolvedReqId,
          module: sanitizeDiagramLabel(tc.module || '') || workingGraph!.processTitle || 'Süreç Akışı',
          title: cleanTitle,
          description: sanitizeDiagramLabel(tc.description || '') || cleanTitle,
          preconditions:
            sanitizeDiagramLabel(tc.preconditions || '') ||
            (isTurkish ? 'Sistem aktif ve süreç ön koşulları hazır olmalıdır.' : 'System active.'),
          steps,
          stepExpectedResults,
          testData: sanitizeDiagramLabel(tc.testData || '') || (isTurkish ? 'Süreç karar ve doğrulama verisi' : 'Process test data'),
          expectedResult: overallExp,
          priority: tc.priority || 'Yüksek',
          testType: tc.testType || 'Pozitif (Fonksiyonel Doğruluk)',
          executionType: tc.executionType || 'Manuel',
          severity: tc.severity || 'Normal',
        };
      });

      // Phase 3 Completeness Audit: supplement per-path, per-decision BVA, per-action Negative, Security, & Performance gaps!
      const merged = [...normalizedAiCases];
      const coveredReqIds = new Set(merged.map((c) => c.reqId));
      const extractQuoteTopic = (t: string) => {
        const m = String(t || '').match(/"([^"]{3,})"/);
        return m ? m[1].toLowerCase().slice(0, 18) : '';
      };

      synth.testCases.forEach((sc) => {
        if (sc.id.startsWith('TC-FLOW-') && sc.id.endsWith('-01') && !coveredReqIds.has(sc.reqId)) {
          merged.push(sc);
          coveredReqIds.add(sc.reqId);
        } else if (sc.id.startsWith('TC-FLOW-') && sc.id.endsWith('-02')) {
          const alreadyHasVariant = merged.some(
            (m) =>
              m.reqId === sc.reqId &&
              (/idempotency|döngü|tekrar|eşzamanlı|parallel|limit|çift/i.test(m.title || '') ||
                String(m.testType || '').includes('Durum Geçiş'))
          );
          if (!alreadyHasVariant) merged.push(sc);
        } else if (sc.id.startsWith('TC-DEC-')) {
          const topic = extractQuoteTopic(sc.title);
          const alreadyHasDecBva = merged.some(
            (m) =>
              (topic && String(m.title + ' ' + m.description).toLowerCase().includes(topic)) &&
              (/sınır|bva|karar|threshold|boundary/i.test(String(m.testType + ' ' + m.title)))
          );
          if (!alreadyHasDecBva) merged.push(sc);
        } else if (sc.id.startsWith('TC-ACT-')) {
          const topic = extractQuoteTopic(sc.title);
          const alreadyHasActNeg = merged.some(
            (m) =>
              topic &&
              String(m.title + ' ' + m.description).toLowerCase().includes(topic) &&
              String(m.testType || '').includes('Negatif')
          );
          if (!alreadyHasActNeg) merged.push(sc);
        } else if (sc.id.startsWith('TC-SEC-HANDOFF')) {
          const hasHandoffSec = merged.some(
            (m) => String(m.testType || '').includes('Güvenlik') && /rol|yetki|swimlane|handoff/i.test(String(m.title || ''))
          );
          if (!hasHandoffSec) merged.push(sc);
        } else if (sc.id.startsWith('TC-SEC-STATESKIP')) {
          const hasSkipSec = merged.some(
            (m) => String(m.testType || '').includes('Güvenlik') && /atlama|skip|baypas|bypass|durum/i.test(String(m.title + ' ' + m.description))
          );
          if (!hasSkipSec) merged.push(sc);
        } else if (sc.id.startsWith('TC-PERF-')) {
          const hasPerf = merged.some((m) => String(m.testType || '').includes('Performans'));
          if (!hasPerf) merged.push(sc);
        }
      });

      // Deduplicate IDs strictly
      const usedTcIds = new Set<string>();
      finalTestCases = merged.map((tc, idx) => {
        let tid = String(tc.id || `TC-FLOW-${String(idx + 1).padStart(3, '0')}`).trim();
        if (usedTcIds.has(tid)) {
          tid = `TC-${tc.reqId}-${String(idx + 1).padStart(3, '0')}`;
          while (usedTcIds.has(tid)) tid = `${tid}_X`;
        }
        usedTcIds.add(tid);
        return { ...tc, id: tid };
      });
    } else {
      // Deterministic full multi-dimensional fallback when AI quota is exhausted
      finalTestCases = synth.testCases;
    }
  } else {
    // Rich structured fallback ONLY if image uploaded AND Vision Graph extraction failed / quota exhausted
    const title = (diagramFileName || 'Görsel Süreç Diyagramı').replace(/\.[^.]+$/, '');
    const customPart = customInstructions ? ` (${customInstructions})` : '';
    const fallbackTextFlow = `
flowchart TD
  Start([Başla: ${title}]) --> Input[Veri Girişi & Ön Doğrulama]
  Input --> Check1{Zorunlu Koşul & Yetki Geçerli mi?}
  Check1 -->|Evet| Process[Ana Süreç İşlemini Yürüt]
  Check1 -->|Hayır| Reject([Bitiş: Doğrulama / Yetki Reddi])
  Process --> Check2{Harici Servis & Onay Başarılı mı?}
  Check2 -->|Evet| Notify[Bildirim Gönder & Logla]
  Check2 -->|Tekrar Dene| Input
  Check2 -->|Hata / Zaman Aşımı| Rollback([Bitiş: Geri Alma & Hata Kaydı])
  Notify --> Done([Bitiş: Süreç Tamamlandı])
`;
    const fallbackGraph = parseActivityDiagramText(fallbackTextFlow);
    fallbackGraph.processTitle = `${title}${customPart}`;
    fallbackGraph.formatDetected = 'image';
    const synth = synthesizeTestCasesFromDiagramGraph(fallbackGraph, coverageStrategy, config, isTurkish);
    finalRequirements = synth.requirements;
    finalTestCases = synth.testCases;
    finalAnalysis = synth.diagramAnalysis;
  }

  const stats = calculateGenerationStats(finalRequirements, finalTestCases);
  const recommendations = generateEngineeringRecommendations(
    finalRequirements,
    finalTestCases,
    isTurkish ? 'tr' : 'en',
    { action: 'initial', customInstructions }
  );

  return {
    requirements: finalRequirements,
    testCases: finalTestCases,
    stats,
    recommendations,
    diagramAnalysis: finalAnalysis,
  };
}
