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

function cleanNodeText(raw: string): { label: string; type: ClientDiagramNode['type'] } {
  const s = raw.trim();
  if (/^\(\[.*\]\)$/.test(s) || /^\(\(.*\)\)$/.test(s)) {
    const inner = s.replace(/^\(\[|\(\(|\)\)|\]\)$/g, '').trim();
    const isEnd = /bitiş|end|son|tamamland|iptal|bloke|red|onayland|forbidden/i.test(inner);
    return { label: inner, type: isEnd ? 'end' : 'start' };
  }
  if (/^\{.*\}$/.test(s)) {
    return { label: s.replace(/^\{|\}$/g, '').trim(), type: 'decision' };
  }
  if (/^\[\[.*\]\]$/.test(s)) {
    return { label: s.replace(/^\[\[|\]\]$/g, '').trim(), type: 'fork_join' };
  }
  if (/^\[.*\]$/.test(s) || /^\(.*\)$/.test(s)) {
    const inner = s.replace(/^\[|\(|\]|\)$/g, '').trim();
    const isDecision = inner.endsWith('?') || /^if\s+/i.test(inner);
    return { label: inner, type: isDecision ? 'decision' : 'action' };
  }
  const isDecision = s.endsWith('?') || /^if\s+/i.test(s);
  const isEnd = /^(end|bitiş|stop|finish)$/i.test(s);
  const isStart = /^(start|başla|başlangıç)$/i.test(s);
  return {
    label: s,
    type: isStart ? 'start' : isEnd ? 'end' : isDecision ? 'decision' : 'action',
  };
}

function detectFormat(rawText: string): DiagramFormat {
  const t = rawText.trim();
  if (/<bpmn:|<definitions|<mxGraphModel|<mxCell/i.test(t)) return 'bpmn_xml';
  if (/@startuml|@enduml|:[^;]+;\s*$/m.test(t)) return 'plantuml';
  if (/^\s*(flowchart|graph|stateDiagram)/im.test(t) || /-->/.test(t)) return 'mermaid';
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
    // Extract BPMN or Draw.io mxCell value labels
    const taskMatches = text.matchAll(/<(?:bpmn:)?(startEvent|endEvent|task|userTask|serviceTask|exclusiveGateway|parallelGateway|mxCell)[^>]*?(?:id="([^"]*)")?[^>]*?(?:name|value)="([^"]+)"/gi);
    let seq = 0;
    for (const m of taskMatches) {
      const tag = m[1].toLowerCase();
      const id = m[2] || `n_${++seq}`;
      const label = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!label) continue;
      let type: ClientDiagramNode['type'] = 'action';
      if (tag.includes('start')) type = 'start';
      else if (tag.includes('end')) type = 'end';
      else if (tag.includes('exclusive') || label.endsWith('?')) type = 'decision';
      else if (tag.includes('parallel')) type = 'fork_join';
      nodeMap.set(id, { id, label, type });
    }
    const flowMatches = text.matchAll(/<(?:bpmn:)?sequenceFlow[^>]*?sourceRef="([^"]+)"[^>]*?targetRef="([^"]+)"(?:[^>]*?name="([^"]*)")?/gi);
    for (const fm of flowMatches) {
      const label = fm[3]?.trim() || undefined;
      edges.push({
        from: fm[1],
        to: fm[2],
        label,
        isNegative: label ? NEGATIVE_EDGE_REGEX.test(label) : false,
      });
    }
    const mxEdgeMatches = text.matchAll(/<mxCell[^>]*?edge="1"[^>]*?(?:value="([^"]*)")?[^>]*?source="([^"]+)"[^>]*?target="([^"]+)"[^>]*?>/gi);
    for (const me of mxEdgeMatches) {
      const label = me[1]?.replace(/<[^>]+>/g, ' ').trim() || undefined;
      edges.push({
        from: me[2],
        to: me[3],
        label,
        isNegative: label ? NEGATIVE_EDGE_REGEX.test(label) : false,
      });
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
        processTitle = titleMatch[1].trim();
        continue;
      }
      const swimMatch = line.match(/^\|([^|]+)\|$/) || line.match(/^partition\s+"?([^"{]+)"?\s*\{?$/i);
      if (swimMatch) {
        currentSwimlane = swimMatch[1].trim();
        swimlanesSet.add(currentSwimlane);
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
        nodeMap.set(decId, { id: decId, label: ifMatch[1].trim(), type: 'decision', swimlane: currentSwimlane });
        if (prevId) edges.push({ from: prevId, to: decId });
        branchStack.push({ decisionId: decId, lastThenId: '' });
        prevId = decId;
        if (ifMatch[2]) {
          // Next node gets this edge label via marker
          branchStack[branchStack.length - 1].lastThenId = `LABEL:${ifMatch[2].trim()}`;
        }
        continue;
      }
      const elseMatch = line.match(/^else\s*(?:\(([^)]+)\))?/i);
      if (elseMatch && branchStack.length > 0) {
        const top = branchStack[branchStack.length - 1];
        top.lastThenId = prevId;
        prevId = top.decisionId;
        if (elseMatch[1]) {
          (top as any).elseLabel = elseMatch[1].trim();
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
        nodeMap.set(actId, { id: actId, label: actMatch[1].trim(), type: 'action', swimlane: currentSwimlane });
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
      if (/^(flowchart|graph|stateDiagram|%%)/i.test(line)) continue;
      const subMatch = line.match(/^subgraph\s+(?:[a-zA-Z0-9_\-]+\s*\[)?([^\]\n"]+|"[^"]+")\]?/i);
      if (subMatch) {
        currentSwimlane = subMatch[1].replace(/^"|"$/g, '').trim();
        swimlanesSet.add(currentSwimlane);
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
          const edgeLabel = (match[1] || inlineLabelMatch?.[1] || '').trim() || undefined;
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
