import { DiagramFormat } from '../types';

export interface ClientDiagramNode {
  id: string;
  label: string;
  type: 'start' | 'end' | 'action' | 'decision' | 'fork_join';
  swimlane?: string;
}

export interface ClientDiagramEdge {
  from: string;
  to: string;
  label?: string;
  isNegative?: boolean;
}

export interface ParsedClientDiagram {
  formatDetected: DiagramFormat;
  processTitle: string;
  swimlanes: string[];
  nodes: ClientDiagramNode[];
  edges: ClientDiagramEdge[];
  decisionCount: number;
}

const NEGATIVE_EDGE_REGEX =
  /\b(hayır|no|false|fail|error|hata|red|reject|iptal|cancel|geçersiz|invalid|blocked|bloke|timeout|yetersiz)\b/i;

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

function sanitizeDiagramLabel(raw: string): string {
  if (!raw) return '';
  let s = decodeHtmlEntities(String(raw));
  s = s
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(UNCLOSED_HTML_TAG_RE, ' ')
    .replace(/<\/?[a-zA-Z!][a-zA-Z0-9:-]*(?:\s+[^>]*)?\/?>/g, ' ')
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

function cleanNodeText(raw: string): { label: string; type: ClientDiagramNode['type'] } {
  const s = raw.trim();
  if (/^\(\[.*\]\)$/.test(s) || /^\(\(.*\)\)$/.test(s)) {
    const inner = sanitizeDiagramLabel(s.replace(/^\(\[|\(\(|\)\)|\]\)$/g, ''));
    const isEnd = /bitiş|end|son|tamamland|iptal|bloke|red|onayland|forbidden/i.test(inner);
    return { label: inner, type: isEnd ? 'end' : 'start' };
  }
  if (/^\{\{.*\}\}$/.test(s) || /^\{.*\}$/.test(s)) {
    return { label: sanitizeDiagramLabel(s.replace(/^\{\{?|\}?\}\}$/g, '')), type: 'decision' };
  }
  if (/^\[\[.*\]\]$/.test(s)) {
    return { label: sanitizeDiagramLabel(s.replace(/^\[\[|\]\]$/g, '')), type: 'fork_join' };
  }
  if (/^\[.*\]$/.test(s) || /^\(.*\)$/.test(s)) {
    const inner = sanitizeDiagramLabel(s.replace(/^\[|\(|\]|\)$/g, ''));
    const isDecision = inner.endsWith('?') || /^if\s+/i.test(inner);
    return { label: inner, type: isDecision ? 'decision' : 'action' };
  }
  const cleanS = sanitizeDiagramLabel(s);
  const isDecision = cleanS.endsWith('?') || /^if\s+/i.test(cleanS);
  const isEnd = /^(end|bitiş|stop|finish)$/i.test(cleanS);
  const isStart = /^(start|başla|başlangıç)$/i.test(cleanS);
  return {
    label: cleanS,
    type: isStart ? 'start' : isEnd ? 'end' : isDecision ? 'decision' : 'action',
  };
}

function detectFormat(rawText: string): DiagramFormat {
  const t = rawText.trim();
  if (/<bpmn:|<definitions|<mxGraphModel|<mxCell|<UserObject/i.test(t)) return 'bpmn_xml';
  if (/@startuml|@enduml|:[^;]+;\s*$/m.test(t)) return 'plantuml';
  if (/^\s*(flowchart|graph|stateDiagram)/im.test(t) || /-->|-\.->|==>/.test(t)) return 'mermaid';
  return 'text_flow';
}

export function parseDiagramForPreview(rawText: string): ParsedClientDiagram {
  const text = (rawText || '').trim();
  if (!text) {
    return {
      formatDetected: 'text_flow',
      processTitle: '',
      swimlanes: [],
      nodes: [],
      edges: [],
      decisionCount: 0,
    };
  }

  const formatDetected = detectFormat(text);
  const nodeMap = new Map<string, ClientDiagramNode>();
  const edges: ClientDiagramEdge[] = [];
  const swimlanesSet = new Set<string>();
  let currentSwimlane: string | undefined;
  let processTitle = 'Süreç Akış Diyagramı';

  const ensureNode = (rawId: string, rawShape?: string) => {
    const id = rawId.trim().replace(/[^a-zA-Z0-9_\-çğıöşüÇĞİÖŞÜ]/g, '_');
    if (!id) return '';
    if (rawShape) {
      const parsed = cleanNodeText(rawShape);
      const existing = nodeMap.get(id);
      if (!existing || existing.label === id) {
        nodeMap.set(id, {
          id,
          label: parsed.label || id,
          type: parsed.type,
          swimlane: currentSwimlane || existing?.swimlane,
        });
      }
    } else if (!nodeMap.has(id)) {
      const parsed = cleanNodeText(rawId);
      nodeMap.set(id, {
        id,
        label: parsed.label,
        type: parsed.type,
        swimlane: currentSwimlane,
      });
    }
    return id;
  };

  if (formatDetected === 'bpmn_xml') {
    const isDrawio = /<mxGraphModel|<mxCell|<UserObject/i.test(text);
    if (isDrawio) {
      const swimlaneById = new Map<string, string>();
      const edgeById = new Map<string, ClientDiagramEdge>();
      const pendingEdgeLabels: { parentId: string; label: string }[] = [];

      const handleMxCell = (attrs: Record<string, string>) => {
        const id = attrs.id || `cell_${nodeMap.size + edges.length + 1}`;
        const label = sanitizeDiagramLabel(attrs.label || attrs.value || attrs.name || '');
        const style = (attrs.style || '').toLowerCase();
        const isEdge = attrs.edge === '1' || (Boolean(attrs.source) && Boolean(attrs.target));

        if (isEdge && attrs.source && attrs.target) {
          const edgeObj: ClientDiagramEdge = {
            from: attrs.source,
            to: attrs.target,
            label: label || undefined,
            isNegative: label ? NEGATIVE_EDGE_REGEX.test(label) : false,
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
        if (!label || ((id === '0' || id === '1') && !label)) return;

        let type: ClientDiagramNode['type'] = 'action';
        if (style.includes('rhombus') || label.endsWith('?')) type = 'decision';
        else if (style.includes('ellipse') || style.includes('terminator')) {
          type = /bitiş|end|son|tamamland|iptal|bloke|red|hata/i.test(label) ? 'end' : 'start';
        } else if (/^(başla|start|başlangıç)/i.test(label)) type = 'start';
        else if (/^(bitiş|end|stop|son|iptal|red)/i.test(label)) type = 'end';

        nodeMap.set(id, { id, label, type, swimlane: attrs.parent ? swimlaneById.get(attrs.parent) : undefined });
      };

      const remaining = text.replace(
        /<(?:UserObject|object)\b([^>]*)>\s*(?:<mxCell\b([^>]*)\/?>)?[\s\S]*?<\/(?:UserObject|object)>/gi,
        (_, wAttrs, cAttrs) => {
          handleMxCell({ ...parseXmlAttributes(cAttrs || ''), ...parseXmlAttributes(wAttrs || '') });
          return '';
        }
      );
      for (const m of remaining.matchAll(/<mxCell\b([^>]*)>/gi)) {
        handleMxCell(parseXmlAttributes(m[1] || ''));
      }
      pendingEdgeLabels.forEach(({ parentId, label }) => {
        const edge = edgeById.get(parentId);
        if (edge) {
          edge.label = edge.label ? `${edge.label} ${label}` : label;
          edge.isNegative = NEGATIVE_EDGE_REGEX.test(edge.label);
        }
      });
    } else {
      let seq = 0;
      for (const m of text.matchAll(/<(?:bpmn:)?(startEvent|endEvent|task|userTask|serviceTask|exclusiveGateway|parallelGateway)\b([^>]*)>/gi)) {
        const tag = m[1].toLowerCase();
        const attrs = parseXmlAttributes(m[2] || '');
        const id = attrs.id || `n_${++seq}`;
        const label = sanitizeDiagramLabel(attrs.name || attrs.value || '');
        if (!label) continue;
        let type: ClientDiagramNode['type'] = 'action';
        if (tag.includes('start')) type = 'start';
        else if (tag.includes('end')) type = 'end';
        else if (tag.includes('exclusive') || label.endsWith('?')) type = 'decision';
        else if (tag.includes('parallel')) type = 'fork_join';
        nodeMap.set(id, { id, label, type });
      }
      for (const fm of text.matchAll(/<(?:bpmn:)?sequenceFlow\b([^>]*)>/gi)) {
        const attrs = parseXmlAttributes(fm[1] || '');
        if (!attrs.sourceRef || !attrs.targetRef) continue;
        const label = sanitizeDiagramLabel(attrs.name || '') || undefined;
        edges.push({
          from: attrs.sourceRef,
          to: attrs.targetRef,
          label,
          isNegative: label ? NEGATIVE_EDGE_REGEX.test(label) : false,
        });
      }
    }
  } else if (formatDetected === 'plantuml') {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let prevId = '';
    let seq = 0;
    const branchStack: { decisionId: string; lastThenId: string }[] = [];

    for (const line of lines) {
      if (line.startsWith('@') || line.startsWith('\'')) continue;
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
      const ifMatch = line.match(/^if\s*\(([^)]+)\)\s*then\s*(?:\(([^)]+)\))?/i);
      if (ifMatch) {
        const decId = `Dec_${++seq}`;
        const decLabel = sanitizeDiagramLabel(ifMatch[1]);
        nodeMap.set(decId, { id: decId, label: decLabel || decId, type: 'decision', swimlane: currentSwimlane });
        if (prevId) edges.push({ from: prevId, to: decId });
        branchStack.push({ decisionId: decId, lastThenId: '' });
        prevId = decId;
        if (ifMatch[2]) {
          // Next node gets this edge label via marker
          branchStack[branchStack.length - 1].lastThenId = `LABEL:${sanitizeDiagramLabel(ifMatch[2])}`;
        }
        continue;
      }
      const elseMatch = line.match(/^else\s*(?:\(([^)]+)\))?/i);
      if (elseMatch && branchStack.length > 0) {
        const top = branchStack[branchStack.length - 1];
        top.lastThenId = prevId;
        prevId = top.decisionId;
        if (elseMatch[1]) {
          (top as any).elseLabel = sanitizeDiagramLabel(elseMatch[1]);
        }
        continue;
      }
      if (/^endif$/i.test(line) && branchStack.length > 0) {
        branchStack.pop();
        continue;
      }
      const actMatch = line.match(/^:(.+);$/);
      if (actMatch) {
        const actId = `Act_${++seq}`;
        const actLabel = sanitizeDiagramLabel(actMatch[1]);
        if (!actLabel) continue;
        nodeMap.set(actId, { id: actId, label: actLabel, type: 'action', swimlane: currentSwimlane });
        if (prevId) {
          let lbl: string | undefined;
          const top = branchStack[branchStack.length - 1];
          if (top && prevId === top.decisionId) {
            if (top.lastThenId?.startsWith('LABEL:')) {
              lbl = top.lastThenId.replace('LABEL:', '');
              top.lastThenId = '';
            } else if ((top as any).elseLabel) {
              lbl = (top as any).elseLabel;
              delete (top as any).elseLabel;
            }
          }
          edges.push({
            from: prevId,
            to: actId,
            label: lbl,
            isNegative: lbl ? NEGATIVE_EDGE_REGEX.test(lbl) : false,
          });
        }
        prevId = actId;
      }
    }
  } else {
    // Mermaid, generic arrow notation, or numbered steps
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sequentialStepIds: string[] = [];
    for (const line of lines) {
      if (/^(?:flowchart|graph|stateDiagram|%%|style\s+|classDef\s+|class\s+|linkStyle\s+|click\s+|direction\s+)/i.test(line)) continue;
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

      // Split chains like: A[Start] -->|Yes| B{Check} --> C[Done]
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
              isNegative: edgeLabel ? NEGATIVE_EDGE_REGEX.test(edgeLabel) : false,
            });
          }
        }
      } else if (/^(?:\d+[\.\)]|Adım\s*\d+:?)\s+/i.test(line)) {
        const cleanedStep = line.replace(/^(?:\d+[\.\)]|Adım\s*\d+:?)\s+/i, '').trim();
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
  const decisionCount = nodes.filter((n) => n.type === 'decision').length;

  return {
    formatDetected,
    processTitle,
    swimlanes: Array.from(swimlanesSet),
    nodes,
    edges,
    decisionCount,
  };
}
