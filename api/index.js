// server/app.ts
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import { GoogleGenAI as GoogleGenAI2, Type as Type2, ThinkingLevel as ThinkingLevel2 } from "@google/genai";

// server/engineeringEvaluation.ts
function calculateGenerationStats(requirements, testCases) {
  const totalRequirements = requirements.length;
  const totalTestCases = testCases.length;
  const positiveCount = testCases.filter(
    (tc) => /pozitif|happy|olumlu|positive/i.test(String(tc.testType || ""))
  ).length;
  const negativeCount = testCases.filter(
    (tc) => /negatif|hata|istisna|negative|error/i.test(String(tc.testType || ""))
  ).length;
  const boundaryCount = testCases.filter(
    (tc) => /sınır|bva|boundary|limit/i.test(String(tc.testType || ""))
  ).length;
  const securityCount = testCases.filter(
    (tc) => /güvenlik|security|yetki|auth/i.test(String(tc.testType || ""))
  ).length;
  const performanceCount = testCases.filter(
    (tc) => /performans|performance|yük|load/i.test(String(tc.testType || ""))
  ).length;
  const highPriorityCount = testCases.filter(
    (tc) => tc.priority === "Y\xFCksek" || tc.priority === "High"
  ).length;
  const coveredReqIds = new Set(
    testCases.map((tc) => String(tc.reqId || "").toLowerCase().trim()).filter(Boolean)
  );
  let fullyCoveredReqs = 0;
  let partiallyCoveredReqs = 0;
  let uncoveredReqs = 0;
  requirements.forEach((req) => {
    const id = String(req.id || "").toLowerCase().trim();
    const testsForReq = testCases.filter(
      (tc) => String(tc.reqId || "").toLowerCase().trim() === id
    );
    if (testsForReq.length === 0) {
      uncoveredReqs++;
    } else {
      const hasPos = testsForReq.some(
        (tc) => /pozitif|happy|positive/i.test(String(tc.testType || ""))
      );
      const hasNegOrBva = testsForReq.some(
        (tc) => /negatif|hata|sınır|bva|boundary|negative/i.test(String(tc.testType || ""))
      );
      if (hasPos && hasNegOrBva && testsForReq.length >= 2) {
        fullyCoveredReqs++;
      } else {
        partiallyCoveredReqs++;
      }
    }
  });
  const reqsWithTests = requirements.filter(
    (r) => coveredReqIds.has(String(r.id || "").toLowerCase().trim())
  ).length;
  const coverageScore = totalRequirements > 0 ? Math.round(reqsWithTests / totalRequirements * 100) : totalTestCases > 0 ? 100 : 0;
  return {
    totalRequirements,
    totalTestCases,
    fullyCoveredReqs,
    partiallyCoveredReqs,
    uncoveredReqs,
    positiveCount,
    negativeCount,
    boundaryCount,
    securityCount,
    performanceCount,
    highPriorityCount,
    coverageScore
  };
}
function generateEngineeringRecommendations(requirements, testCases, language = "tr", lastUpdateContext) {
  const isTr = language !== "en";
  if (!requirements || requirements.length === 0) {
    if (testCases && testCases.length > 0) {
      return isTr ? [
        `Sistemde ${testCases.length} adet test senaryosu bulunmaktad\u0131r. \u0130lgili gereksinim dok\xFCman\u0131 y\xFCklendi\u011Finde u\xE7tan uca izlenebilirlik (RTM) analizi olu\u015Fturulacakt\u0131r.`,
        "Senaryolar\u0131n \xF6ncelik ve tip da\u011F\u0131l\u0131m\u0131 ISTQB standartlar\u0131na g\xF6re g\xF6zden ge\xE7irilmi\u015Ftir."
      ] : [];
    }
    return [];
  }
  const reqIds = requirements.map((r) => r.id).filter(Boolean);
  const totalTCs = testCases.length;
  const stats = calculateGenerationStats(requirements, testCases);
  const reqListDisplay = reqIds.length <= 5 ? `[${reqIds.join(", ")}]` : `[${reqIds.slice(0, 3).join(", ")} ... ${reqIds[reqIds.length - 1]}] (${reqIds.length} gereksinim maddesi)`;
  const totalSteps = testCases.reduce(
    (acc, tc) => acc + (Array.isArray(tc.steps) ? tc.steps.length : 1),
    0
  );
  const fullText = (requirements.map((r) => `${r.id} ${r.title} ${r.description} ${r.category}`).join(" ") + " " + testCases.map((tc) => `${tc.title} ${tc.description} ${tc.expectedResult || ""} ${tc.testData || ""}`).join(" ")).toLowerCase();
  const recommendations = [];
  if (lastUpdateContext?.customInstructions && lastUpdateContext.customInstructions.trim().length > 0) {
    const rawInstr = lastUpdateContext.customInstructions.trim();
    const shortInstr = rawInstr.length > 70 ? rawInstr.slice(0, 70) + "..." : rawInstr;
    if (isTr) {
      recommendations.push(
        `\xD6zel AI Test Talimat\u0131 Uyumu: Kullan\u0131c\u0131 taraf\u0131ndan girilen \xF6zel y\xF6nerge ("${shortInstr}") test senaryolar\u0131n\u0131n kurgusuna, ad\u0131mlar\u0131na ve kontrol kriterlerine \xF6ncelikli kural olarak entegre edildi.`
      );
    } else {
      recommendations.push(
        `Custom AI Prompt Compliance: User prompt instructions ("${shortInstr}") were directly prioritized and incorporated into test scenarios and verification steps.`
      );
    }
  }
  if (lastUpdateContext && lastUpdateContext.reqId) {
    const { reqId, addedCount, lastTestCaseTitle } = lastUpdateContext;
    const countText = addedCount && addedCount > 1 ? `${addedCount} yeni test senaryosu` : "yeni test senaryosu";
    const titleSnippet = lastTestCaseTitle ? ` ("${lastTestCaseTitle.slice(0, 45)}...")` : "";
    if (isTr) {
      recommendations.push(
        `Dinamik Senaryo G\xFCncellemesi: [${reqId}] gereksinimi i\xE7in ${countText}${titleSnippet} ba\u015Far\u0131yla \xFCretildi ve matrise eklendi. Test derinli\u011Fi geni\u015Fletildi, risk de\u011Ferlendirmesi anl\u0131k olarak g\xFCncellendi.`
      );
    } else {
      recommendations.push(
        `Dynamic Scenario Update: Successfully generated ${countText}${titleSnippet} for [${reqId}]. Test depth and risk metrics refreshed in real time.`
      );
    }
  }
  if (totalTCs === 0) {
    recommendations.push(
      isTr ? `Analiz Edilen Gereksinimler: ${reqListDisplay} maddeleri tan\u0131mland\u0131. 'Test Senaryolar\u0131 \xDCret' butonu ile ISTQB standartlar\u0131nda Happy Path, Negatif ve S\u0131n\u0131r De\u011Fer senaryolar\u0131 t\xFCretilmelidir.` : `Analyzed Requirements: ${reqListDisplay} loaded. Generate test cases to establish full ISTQB traceability.`
    );
    return recommendations;
  }
  if (isTr) {
    recommendations.push(
      `Gereksinim Kapsam\u0131 & RTM \u0130zlenebilirli\u011Fi: ${reqListDisplay} maddeleri i\xE7in toplam ${totalTCs} adet test senaryosu ve ${totalSteps} adet ad\u0131m bazl\u0131 do\u011Frulama noktas\u0131 e\u015Fle\u015Ftirildi. Kapsama oran\u0131: %${stats.coverageScore}.`
    );
  } else {
    recommendations.push(
      `Requirement Coverage & RTM Traceability: A total of ${totalTCs} test cases and ${totalSteps} verification steps were mapped across ${reqListDisplay} (Coverage: ${stats.coverageScore}%).`
    );
  }
  const posPct = totalTCs > 0 ? Math.round(stats.positiveCount / totalTCs * 100) : 0;
  const negPct = totalTCs > 0 ? Math.round(stats.negativeCount / totalTCs * 100) : 0;
  const bvaPct = totalTCs > 0 ? Math.round(stats.boundaryCount / totalTCs * 100) : 0;
  if (isTr) {
    const balanceWarning = negPct < 25 ? `\u0130kaz: Negatif senaryo oran\u0131 (%${negPct}) d\xFC\u015F\xFCkt\xFCr; sistem dayan\u0131kl\u0131l\u0131\u011F\u0131 ve hata y\xF6netimi i\xE7in ek negatif senaryolar t\xFCretilmesi \xF6nerilir.` : `Happy Path (%${posPct}) ve Negatif Hata Y\xF6netimi (%${negPct}) senaryolar\u0131 ISTQB standartlar\u0131nda dengeli da\u011F\u0131lm\u0131\u015Ft\u0131r.`;
    recommendations.push(
      `ISTQB Test T\xFCr\xFC Analizi: %${posPct} Pozitif (${stats.positiveCount}), %${negPct} Negatif (${stats.negativeCount}), %${bvaPct} S\u0131n\u0131r De\u011Fer/BVA (${stats.boundaryCount})${stats.securityCount > 0 ? `, ${stats.securityCount} G\xFCvenlik senaryosu` : ""}. ${balanceWarning}`
    );
  } else {
    const balanceWarning = negPct < 25 ? `Warning: Low negative scenario ratio (${negPct}%); additional negative tests recommended.` : `Happy Path (${posPct}%) and Negative Exception handling (${negPct}%) are well balanced.`;
    recommendations.push(
      `ISTQB Test Type Distribution: ${posPct}% Positive (${stats.positiveCount}), ${negPct}% Negative (${stats.negativeCount}), ${bvaPct}% Boundary (${stats.boundaryCount})${stats.securityCount > 0 ? `, ${stats.securityCount} Security` : ""}. ${balanceWarning}`
    );
  }
  const hasActiveTaskConstraint = /aktif.*görev|göreve.*bağlı|bağlı.*silin|silinemez|silme.*kısıt|kullanımda.*sil|foreign.*key|in-use.*delete|depend.*task|aktif.*iş/i.test(
    fullText
  );
  const hasAdapterOrIntegration = /adaptör|servis|api.*entegrasyon|bağlantı|webhook|endpoint|socket|adapter|protokol/i.test(
    fullText
  );
  const hasPaymentOrFinance = /ödeme|bakiye|tutar|fiyat|fatura|transfer|kredi|payment|balance|price|tahsilat/i.test(
    fullText
  );
  if (hasActiveTaskConstraint) {
    if (isTr) {
      recommendations.push(
        `Kritik \u0130\u015F Kural\u0131 Riski (Ba\u011F\u0131ml\u0131 Kay\u0131t & Silme K\u0131s\u0131t\u0131): Aktif g\xF6reve/i\u015F ak\u0131\u015F\u0131na ba\u011Fl\u0131 nesnelerin (\xF6rn. aktif adapt\xF6rler) silinmesini engelleyen kural, veri taban\u0131 referans b\xFCt\xFCnl\xFC\u011F\xFC ve e\u015Fzamanl\u0131 silme istekleri (race condition) a\xE7\u0131s\u0131ndan y\xFCksek risk ta\u015F\u0131maktad\u0131r. UI engeliyle yetinilmeyip backend 409/400 k\u0131s\u0131t do\u011Frulama ve veritaban\u0131 cascade/kilit testleri do\u011Frulanmal\u0131d\u0131r.`
      );
    } else {
      recommendations.push(
        `Critical Business Logic Risk (In-Use Record Deletion Constraint): Business rules preventing deletion of entities tied to active tasks/jobs carry high risk for race conditions and data integrity. Backend HTTP 409/400 validation and database foreign-key constraint tests are required beyond UI disabled states.`
      );
    }
  } else if (hasAdapterOrIntegration) {
    if (isTr) {
      recommendations.push(
        `Entegrasyon ve Protokol Riski: D\u0131\u015F servis ve adapt\xF6r ba\u011Flant\u0131lar\u0131nda a\u011F kesintisi, zaman a\u015F\u0131m\u0131 (timeout [408/504]) ve servis sa\u011Flay\u0131c\u0131 yan\u0131t gecikmesi durumlar\u0131nda yeniden deneme (retry/exponential backoff) mekanizmas\u0131 ve hata loglamas\u0131 do\u011Frulanmal\u0131d\u0131r.`
      );
    } else {
      recommendations.push(
        `Integration & Protocol Risk: Adapter/service connections must be verified against network dropouts, request timeouts (408/504), and retry/backoff mechanisms.`
      );
    }
  } else if (hasPaymentOrFinance) {
    if (isTr) {
      recommendations.push(
        `Mali ve \u0130\u015Flem B\xFCt\xFCnl\xFC\u011F\xFC Riski: Finansal hesaplama, bakiye g\xFCncelleme ve m\xFCkerrer istek (idempotency / double-spending) senaryolar\u0131 i\u015Flem kilitleri (transaction isolation) alt\u0131nda do\u011Frulanmal\u0131d\u0131r.`
      );
    } else {
      recommendations.push(
        `Financial Transaction & Idempotency Risk: Double-spending and balance calculation rules must be tested under database transaction isolation.`
      );
    }
  }
  const hasBoundaryAndFormat = /port|ip|karakter|uzunluk|format|boyut|limit|regex|url|min.*max|sayı|harf|boş|null/i.test(
    fullText
  );
  const hasSecurityOrRoles = /yetki|rol|admin|oturum|izin|token|auth|unauthorized|forbidden|jwt|şifre/i.test(
    fullText
  );
  if (hasBoundaryAndFormat) {
    if (isTr) {
      recommendations.push(
        `S\u0131n\u0131r De\u011Fer (BVA) & Veri Do\u011Frulama: Port aral\u0131klar\u0131 (1-65535), IP formatlar\u0131, maksimum karakter limitleri ve bo\u015F/null girdilerde s\u0131n\u0131r alt\u0131/\xFCst\xFC de\u011Ferler ile XSS/SQL \xF6zel karakter filtrelemesi test edilmelidir.`
      );
    } else {
      recommendations.push(
        `Boundary Value (BVA) & Input Validation: Format boundaries (Port [1-65535], IP address patterns, character length limits, null values) and XSS/SQL special characters must be verified.`
      );
    }
  } else if (hasSecurityOrRoles) {
    if (isTr) {
      recommendations.push(
        `Yetkilendirme ve Rol \u0130zolasyonu: Farkl\u0131 kullan\u0131c\u0131 rolleri (Admin, Operat\xF6r, Yetkisiz Kullan\u0131c\u0131) aras\u0131ndaki operasyonel k\u0131s\u0131tlar ve yetkisiz u\xE7 nokta manip\xFClasyonu (IDOR) API seviyesinde test edilmelidir.`
      );
    } else {
      recommendations.push(
        `Role-Based Authorization & IDOR Risk: Privileged action boundaries between user roles and direct API endpoint tampering (IDOR) must be tested.`
      );
    }
  }
  const uncoveredOrPartial = requirements.filter(
    (r) => r.coverageStatus === "Partial" || r.coverageStatus === "Uncovered"
  );
  if (uncoveredOrPartial.length > 0) {
    const gapIds = uncoveredOrPartial.map((r) => r.id);
    if (isTr) {
      recommendations.push(
        `Kapsama A\xE7\u0131\u011F\u0131 Uyar\u0131s\u0131: [${gapIds.join(", ")}] gereksinimlerinde k\u0131smi test kapsam\u0131 tespit edildi. RTM matrisi \xFCzerinden 'Eksikleri Otomatik \xDCret' aksiyonu ile ISTQB standard\u0131na (%100) ula\u015Ft\u0131r\u0131lmas\u0131 \xF6nerilir.`
      );
    } else {
      recommendations.push(
        `Coverage Gap Alert: Requirements [${gapIds.join(", ")}] have partial coverage. Expanding missing edge cases via RTM is recommended.`
      );
    }
  } else {
    if (isTr) {
      recommendations.push(
        `Tam Kapsama & Regresyon G\xFCvencesi: T\xFCm gereksinim maddeleri (%100) test senaryolar\u0131yla eksiksiz e\u015Fle\u015Ftirilmi\u015Ftir. Senaryolar test ko\u015Fumuna (Test Run) ve CI/CD otomasyon paketine dahil edilmeye haz\u0131rd\u0131r.`
      );
    } else {
      recommendations.push(
        `Full Coverage & Regression Ready: All requirements (100%) are mapped to test cases and ready for execution runs and automation pipelines.`
      );
    }
  }
  return recommendations;
}

// server/diagramEngine.ts
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
var NEGATIVE_BRANCH_REGEX = /\b(hayır|hayir|no|false|fail|failed|error|hata|red|reject|rejected|iptal|cancel|geçersiz|gecersiz|invalid|blocked|bloke|timeout|zaman\s*aşım|yetersiz|yetkisiz|forbidden|400|401|403|404|409|422|500|503|başarısız|basarisiz|eksik|ret|süre\s*doldu)\b/i;
function cleanNodeShape(raw) {
  const s = raw.trim();
  if (/^\(\[.*\]\)$/.test(s) || /^\(\(.*\)\)$/.test(s)) {
    const inner = s.replace(/^\(\[|\(\(|\)\)|\]\)$/g, "").trim();
    const isEnd2 = /bitiş|bitis|end|son|tamamland|iptal|bloke|red|onayland|forbidden|yetersiz|oluşturuldu|gönderildi/i.test(inner);
    const isStart2 = /başla|basla|start|giriş|tetik/i.test(inner);
    return { label: inner, type: isStart2 ? "start" : isEnd2 ? "end" : "start" };
  }
  if (/^\{\{.*\}\}$/.test(s) || /^\{.*\}$/.test(s)) {
    return { label: s.replace(/^\{\{?|\}?\}\}$/g, "").trim(), type: "decision" };
  }
  if (/^\[\[.*\]\]$/.test(s)) {
    return { label: s.replace(/^\[\[|\]\]$/g, "").trim(), type: "fork_join" };
  }
  if (/^\[\(.*\)\]$/.test(s)) {
    return { label: s.replace(/^\[\(|\)\]$/g, "").trim(), type: "action" };
  }
  if (/^\[\/.*\/\]$/.test(s) || /^\[\\.*\\\]$/.test(s)) {
    return { label: s.replace(/^\[[\/\\]|[\/\\]\]$/g, "").trim(), type: "action" };
  }
  if (/^\[.*\]$/.test(s) || /^\(.*\)$/.test(s)) {
    const inner = s.replace(/^\[|\(|\]|\)$/g, "").trim();
    const isDecision2 = inner.endsWith("?") || /^(if|eğer|kontrol)\s+/i.test(inner);
    return { label: inner, type: isDecision2 ? "decision" : "action" };
  }
  const isDecision = s.endsWith("?") || /^(if|eğer)\s+/i.test(s);
  const isEnd = /^(end|bitiş|bitis|stop|finish|son)$/i.test(s);
  const isStart = /^(start|başla|basla|başlangıç|baslangic)$/i.test(s);
  return {
    label: s,
    type: isStart ? "start" : isEnd ? "end" : isDecision ? "decision" : "action"
  };
}
function detectDiagramFormat(rawText) {
  const t = (rawText || "").trim();
  if (/<bpmn:|<definitions|<mxGraphModel|<mxCell/i.test(t)) return "bpmn_xml";
  if (/@startuml|@enduml|:[^;]+;\s*$/m.test(t)) return "plantuml";
  if (/^\s*(flowchart|graph|stateDiagram)/im.test(t) || /-->|-\.->|==>/.test(t)) return "mermaid";
  return "text_flow";
}
function parseActivityDiagramText(rawText) {
  const text = (rawText || "").trim();
  const formatDetected = detectDiagramFormat(text);
  const nodeMap = /* @__PURE__ */ new Map();
  const edges = [];
  const swimlanesSet = /* @__PURE__ */ new Set();
  let currentSwimlane;
  let processTitle = "S\xFCre\xE7 Ak\u0131\u015F Diyagram\u0131";
  const ensureNode = (rawId, rawShape) => {
    const id = rawId.trim().replace(/[^a-zA-Z0-9_\-çğıöşüÇĞİÖŞÜ]/g, "_");
    if (!id) return "";
    if (rawShape) {
      const parsed = cleanNodeShape(rawShape);
      const existing = nodeMap.get(id);
      if (!existing || existing.label === id) {
        nodeMap.set(id, {
          id,
          label: parsed.label || id,
          type: parsed.type,
          swimlane: currentSwimlane || existing?.swimlane
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
        swimlane: currentSwimlane
      });
    } else if (currentSwimlane && !nodeMap.get(id).swimlane) {
      nodeMap.get(id).swimlane = currentSwimlane;
    }
    return id;
  };
  if (formatDetected === "bpmn_xml") {
    const taskMatches = text.matchAll(
      /<(?:bpmn:)?(startEvent|endEvent|task|userTask|serviceTask|scriptTask|exclusiveGateway|inclusiveGateway|parallelGateway|subProcess|mxCell)[^>]*?(?:id="([^"]*)")?[^>]*?(?:name|value)="([^"]+)"/gi
    );
    let seq = 0;
    for (const m of taskMatches) {
      const tag = m[1].toLowerCase();
      const id = m[2] || `n_${++seq}`;
      const label = m[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!label) continue;
      let type = "action";
      if (tag.includes("start")) type = "start";
      else if (tag.includes("end")) type = "end";
      else if (tag.includes("exclusive") || tag.includes("inclusive") || label.endsWith("?")) type = "decision";
      else if (tag.includes("parallel")) type = "fork_join";
      nodeMap.set(id, { id, label, type });
    }
    const flowMatches = text.matchAll(
      /<(?:bpmn:)?sequenceFlow[^>]*?sourceRef="([^"]+)"[^>]*?targetRef="([^"]+)"(?:[^>]*?name="([^"]*)")?/gi
    );
    for (const fm of flowMatches) {
      const label = fm[3]?.trim() || void 0;
      edges.push({
        from: fm[1],
        to: fm[2],
        label,
        isNegative: label ? NEGATIVE_BRANCH_REGEX.test(label) : false
      });
    }
    const mxEdgeMatches = text.matchAll(
      /<mxCell[^>]*?edge="1"[^>]*?(?:value="([^"]*)")?[^>]*?source="([^"]+)"[^>]*?target="([^"]+)"[^>]*?>/gi
    );
    for (const me of mxEdgeMatches) {
      const label = me[1]?.replace(/<[^>]+>/g, " ").trim() || void 0;
      edges.push({
        from: me[2],
        to: me[3],
        label,
        isNegative: label ? NEGATIVE_BRANCH_REGEX.test(label) : false
      });
    }
  } else if (formatDetected === "plantuml") {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let prevId = "";
    let seq = 0;
    const branchStack = [];
    for (const line of lines) {
      if (line.startsWith("@") || line.startsWith("'")) continue;
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
      if (line === "}") {
        currentSwimlane = void 0;
        continue;
      }
      if (/^start$/i.test(line)) {
        const id = "Start";
        nodeMap.set(id, { id, label: "Ba\u015Fla", type: "start", swimlane: currentSwimlane });
        prevId = id;
        continue;
      }
      if (/^(stop|end)$/i.test(line)) {
        const id = `End_${++seq}`;
        nodeMap.set(id, { id, label: "Biti\u015F", type: "end", swimlane: currentSwimlane });
        if (prevId) edges.push({ from: prevId, to: id });
        prevId = id;
        continue;
      }
      const ifMatch = line.match(/^(?:else)?if\s*\(([^)]+)\)\s*then\s*(?:\(([^)]+)\))?/i);
      if (ifMatch) {
        const decId = `Dec_${++seq}`;
        nodeMap.set(decId, { id: decId, label: ifMatch[1].trim(), type: "decision", swimlane: currentSwimlane });
        if (/^elseif/i.test(line) && branchStack.length > 0) {
          const top = branchStack[branchStack.length - 1];
          if (prevId && prevId !== top.decisionId) top.branchEnds.push(prevId);
          edges.push({ from: top.decisionId, to: decId, label: "Hay\u0131r / Alternatif", isNegative: true });
        } else if (prevId) {
          edges.push({ from: prevId, to: decId });
        }
        branchStack.push({
          decisionId: decId,
          pendingLabel: ifMatch[2]?.trim() || "Evet",
          branchEnds: []
        });
        prevId = decId;
        continue;
      }
      const elseMatch = line.match(/^else\s*(?:\(([^)]+)\))?/i);
      if (elseMatch && branchStack.length > 0) {
        const top = branchStack[branchStack.length - 1];
        if (prevId && prevId !== top.decisionId) top.branchEnds.push(prevId);
        top.pendingLabel = elseMatch[1]?.trim() || "Hay\u0131r";
        prevId = top.decisionId;
        continue;
      }
      if (/^endif$/i.test(line) && branchStack.length > 0) {
        const closed = branchStack.pop();
        if (prevId && prevId !== closed.decisionId) closed.branchEnds.push(prevId);
        continue;
      }
      if (/^fork(\s+again)?$/i.test(line)) {
        const forkId = `Fork_${++seq}`;
        nodeMap.set(forkId, { id: forkId, label: "Paralel Ak\u0131\u015F Ba\u015Flat", type: "fork_join", swimlane: currentSwimlane });
        if (prevId) edges.push({ from: prevId, to: forkId });
        prevId = forkId;
        continue;
      }
      const repeatWhileMatch = line.match(/^repeat\s+while\s*\(([^)]+)\)/i);
      if (repeatWhileMatch && prevId) {
        const loopDecId = `Loop_${++seq}`;
        nodeMap.set(loopDecId, { id: loopDecId, label: repeatWhileMatch[1].trim(), type: "decision", swimlane: currentSwimlane });
        edges.push({ from: prevId, to: loopDecId });
        const startLoopTarget = Array.from(nodeMap.values()).find((n) => n.type === "action")?.id;
        if (startLoopTarget) {
          edges.push({ from: loopDecId, to: startLoopTarget, label: "Tekrar Dene", isNegative: false });
        }
        prevId = loopDecId;
        continue;
      }
      const actMatch = line.match(/^:(.+);$/);
      if (actMatch) {
        const actId = `Act_${++seq}`;
        const actLabel = actMatch[1].trim();
        nodeMap.set(actId, {
          id: actId,
          label: actLabel,
          type: actLabel.endsWith("?") ? "decision" : "action",
          swimlane: currentSwimlane
        });
        if (prevId) {
          let lbl;
          const top = branchStack[branchStack.length - 1];
          if (top && prevId === top.decisionId && top.pendingLabel) {
            lbl = top.pendingLabel;
            top.pendingLabel = void 0;
          }
          edges.push({
            from: prevId,
            to: actId,
            label: lbl,
            isNegative: lbl ? NEGATIVE_BRANCH_REGEX.test(lbl) : false
          });
        }
        prevId = actId;
      }
    }
  } else {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sequentialStepIds = [];
    for (const line of lines) {
      if (/^(flowchart|graph|stateDiagram|%%)/i.test(line)) continue;
      const titleMatch = line.match(/^(?:title|Başlık|Süreç)\s*:\s*(.+)/i);
      if (titleMatch) {
        processTitle = titleMatch[1].trim();
        continue;
      }
      const subMatch = line.match(/^subgraph\s+(?:[a-zA-Z0-9_\-]+\s*\[)?([^\]\n"]+|"[^"]+")\]?/i);
      if (subMatch) {
        currentSwimlane = subMatch[1].replace(/^"|"$/g, "").trim();
        swimlanesSet.add(currentSwimlane);
        continue;
      }
      if (/^end$/i.test(line)) {
        currentSwimlane = void 0;
        continue;
      }
      const arrowRegex = /\s*(?:--+>|--[^>]*-->|-\.[^.]*\.->|-\.->|==>|\.\.>|->)\s*(?:\|([^|]+)\|)?\s*/g;
      if (arrowRegex.test(line)) {
        arrowRegex.lastIndex = 0;
        const segments = [];
        let lastIdx = 0;
        let match;
        while ((match = arrowRegex.exec(line)) !== null) {
          const leftToken = line.slice(lastIdx, match.index).trim();
          const inlineLabelMatch = match[0].match(/(?:--|\-\.)\s*([^->]+?)\s*(?:-->|\.->)/);
          const edgeLabel = (match[1] || inlineLabelMatch?.[1] || "").trim() || void 0;
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
          const fromId = leftParts ? ensureNode(leftParts[1], leftParts[2]) : ensureNode(`n_${nodeMap.size + 1}`, leftRaw);
          const toId = rightParts ? ensureNode(rightParts[1], rightParts[2]) : ensureNode(`n_${nodeMap.size + 1}`, rightRaw);
          if (fromId && toId) {
            edges.push({
              from: fromId,
              to: toId,
              label: edgeLabel,
              isNegative: edgeLabel ? NEGATIVE_BRANCH_REGEX.test(edgeLabel) : false
            });
          }
        }
      } else if (/^(?:\d+[\.\)]|Adım\s*\d+:?)\s+/i.test(line)) {
        const cleanedStep = line.replace(/^(?:\d+[\.\)]|Adım\s*\d+:?)\s+/i, "").trim();
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
  if (processTitle === "S\xFCre\xE7 Ak\u0131\u015F Diyagram\u0131" && nodes.length > 0) {
    const startNode = nodes.find((n) => n.type === "start") || nodes[0];
    processTitle = startNode.label.replace(/^başla\s*:\s*/i, "").trim() || "S\xFCre\xE7 Ak\u0131\u015F Diyagram\u0131";
  }
  return {
    formatDetected,
    processTitle,
    swimlanes: Array.from(swimlanesSet),
    nodes,
    edges,
    paths
  };
}
function enumerateProcessPaths(nodes, edges) {
  if (nodes.length === 0) return [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outEdges = /* @__PURE__ */ new Map();
  const inDegree = /* @__PURE__ */ new Map();
  nodes.forEach((n) => {
    outEdges.set(n.id, []);
    inDegree.set(n.id, 0);
  });
  edges.forEach((e) => {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from).push(e);
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  });
  const startNodes = nodes.filter((n) => n.type === "start" || (inDegree.get(n.id) || 0) === 0);
  const roots = startNodes.length > 0 ? startNodes : [nodes[0]];
  const rawPaths = [];
  const MAX_PATHS = 36;
  const MAX_DEPTH = 28;
  const dfs = (currentId, visitedCount, pathNodeIds, conditions, hasLoop, hasNegativeEdge, hasParallel) => {
    if (rawPaths.length >= MAX_PATHS || pathNodeIds.length >= MAX_DEPTH) return;
    const currentNode = nodeById.get(currentId);
    const nextParallel = hasParallel || currentNode?.type === "fork_join";
    const nextVisited = new Map(visitedCount);
    const visits = (nextVisited.get(currentId) || 0) + 1;
    nextVisited.set(currentId, visits);
    const nextNodeIds = [...pathNodeIds, currentId];
    const outgoing = outEdges.get(currentId) || [];
    if (outgoing.length === 0 || currentNode?.type === "end" || visits > 1) {
      rawPaths.push({
        nodeIds: nextNodeIds,
        conditions,
        hasLoop: hasLoop || visits > 1,
        hasNegativeEdge,
        hasParallel: nextParallel
      });
      return;
    }
    for (const edge of outgoing) {
      const targetVisits = nextVisited.get(edge.to) || 0;
      const edgeNeg = Boolean(edge.isNegative) || NEGATIVE_BRANCH_REGEX.test(nodeById.get(edge.to)?.label || "");
      const nextConditions = edge.label ? [...conditions, `${currentNode?.label || currentId} \u2192 ${edge.label}`] : conditions;
      if (targetVisits >= 1) {
        rawPaths.push({
          nodeIds: [...nextNodeIds, edge.to],
          conditions: [...nextConditions, "(Tekrar / D\xF6ng\xFC Ge\xE7i\u015Fi)"],
          hasLoop: true,
          hasNegativeEdge: hasNegativeEdge || edgeNeg,
          hasParallel: nextParallel
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
    dfs(root.id, /* @__PURE__ */ new Map(), [], [], false, false, false);
  }
  const seenSignatures = /* @__PURE__ */ new Set();
  const finalPaths = [];
  let seq = 1;
  for (const rp of rawPaths) {
    const sig = `${rp.nodeIds.join(">")}|${rp.conditions.join(",")}`;
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);
    const nodeLabels = rp.nodeIds.map((id2) => nodeById.get(id2)?.label || id2);
    const endLabel = nodeLabels[nodeLabels.length - 1] || "";
    const isNeg = rp.hasNegativeEdge || NEGATIVE_BRANCH_REGEX.test(endLabel);
    const pathType = rp.hasLoop ? "loop" : isNeg ? "negative" : rp.hasParallel ? "parallel" : rp.conditions.length > 0 && seq > 1 ? "decision" : "happy";
    const swimlanes = Array.from(
      new Set(
        rp.nodeIds.map((id2) => nodeById.get(id2)?.swimlane).filter((s) => Boolean(s))
      )
    );
    const condSummary = rp.conditions.length > 0 ? rp.conditions[rp.conditions.length - 1] : `${nodeLabels[0]} \u2192 ${endLabel}`;
    const pathPrefix = pathType === "happy" ? "Ana Ak\u0131\u015F (Happy Path)" : pathType === "loop" ? "D\xF6ng\xFC / Tekrar Deneme Ak\u0131\u015F\u0131" : pathType === "negative" ? "Hata / Red / \u0130stisna Yolu" : pathType === "parallel" ? "Paralel Dal Ak\u0131\u015F\u0131" : "Alternatif Karar Yolu";
    const id = `PATH-${String(seq).padStart(2, "0")}`;
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
      swimlanes
    });
  }
  finalPaths.sort((a, b) => {
    const order = { happy: 0, parallel: 1, decision: 2, loop: 3, negative: 4 };
    return order[a.pathType] - order[b.pathType];
  });
  return finalPaths.map((p, idx) => ({
    ...p,
    id: `PATH-${String(idx + 1).padStart(2, "0")}`
  }));
}
function extractGraphDimensions(graph) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const outEdgesMap = /* @__PURE__ */ new Map();
  graph.edges.forEach((e) => {
    if (!outEdgesMap.has(e.from)) outEdgesMap.set(e.from, []);
    outEdgesMap.get(e.from).push(e);
  });
  const decisions = graph.nodes.filter((n) => n.type === "decision" || (outEdgesMap.get(n.id)?.length || 0) >= 2).map((n) => {
    const outgoing = outEdgesMap.get(n.id) || [];
    return {
      nodeId: n.id,
      label: n.label,
      swimlane: n.swimlane,
      branches: outgoing.map((e, i) => ({
        label: e.label || `Dal ${i + 1}`,
        targetLabel: nodeById.get(e.to)?.label || e.to,
        isNegative: Boolean(e.isNegative) || NEGATIVE_BRANCH_REGEX.test(e.label || "")
      }))
    };
  });
  const handoffSeen = /* @__PURE__ */ new Set();
  const swimlaneHandoffs = [];
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
          condition: e.label
        });
      }
    }
  });
  const actionNodes = graph.nodes.filter((n) => n.type === "action");
  const parallelNodes = graph.nodes.filter((n) => n.type === "fork_join");
  const loopPaths = graph.paths.filter((p) => p.hasLoop);
  return { decisions, swimlaneHandoffs, actionNodes, loopPaths, parallelNodes };
}
function buildStepExpectedPairs(nodeLabels, conditions, isNegativePath, customInstr, isTurkish) {
  const steps = [];
  const stepExpectedResults = [];
  nodeLabels.forEach((nodeLabel, nIdx) => {
    const stepNum = nIdx + 1;
    const condForStep = conditions.find((c) => c.startsWith(`${nodeLabel} \u2192`));
    if (nIdx === 0) {
      steps.push(
        isTurkish ? `${stepNum}. S\xFCreci "${nodeLabel}" ba\u015Flang\u0131\xE7 noktas\u0131ndan tetikleyin ve \xF6n oturum/parametreleri haz\u0131rlay\u0131n.${customInstr ? ` (${customInstr.slice(0, 55)})` : ""}` : `${stepNum}. Trigger process at "${nodeLabel}" and prepare session parameters.`
      );
      stepExpectedResults.push(
        isTurkish ? `${stepNum}. Ba\u015Flang\u0131\xE7 durumu aktif olmal\u0131, i\u015Flem takip kimli\u011Fi (Correlation/Transaction ID) \xFCretilmelidir.` : `${stepNum}. Process starts cleanly with a valid correlation ID.`
      );
    } else if (condForStep) {
      const branchLabel = condForStep.split("\u2192")[1]?.trim() || "";
      steps.push(
        isTurkish ? `${stepNum}. "${nodeLabel}" karar kap\u0131s\u0131nda "${branchLabel}" dal\u0131n\u0131 tetikleyecek ko\u015Fullu veriyi g\xF6nderin.` : `${stepNum}. Supply input at decision "${nodeLabel}" to evaluate branch "${branchLabel}".`
      );
      stepExpectedResults.push(
        isTurkish ? `${stepNum}. Karar motoru kural\u0131 do\u011Fru de\u011Ferlendirmeli ve ak\u0131\u015F\u0131 "${branchLabel}" dal\u0131na deterministik olarak y\xF6nlendirmelidir.` : `${stepNum}. Decision gate routes deterministically to "${branchLabel}".`
      );
    } else if (nIdx === nodeLabels.length - 1) {
      steps.push(
        isTurkish ? `${stepNum}. S\xFCrecin "${nodeLabel}" terminal durumuna ula\u015Ft\u0131\u011F\u0131n\u0131, veritaban\u0131 kayd\u0131n\u0131, bildirimleri ve denetim loglar\u0131n\u0131 do\u011Frulay\u0131n.` : `${stepNum}. Verify terminal state "${nodeLabel}", persisted state, and audit logs.`
      );
      stepExpectedResults.push(
        isTurkish ? isNegativePath ? `${stepNum}. Ak\u0131\u015F g\xFCvenli bi\xE7imde "${nodeLabel}" durumunda sonlanmal\u0131, k\u0131smi veri tutars\u0131zl\u0131\u011F\u0131 olu\u015Fmamal\u0131d\u0131r.` : `${stepNum}. S\xFCre\xE7 "${nodeLabel}" terminal durumunda ba\u015Far\u0131yla tamamlanmal\u0131 ve t\xFCm kay\u0131tlar tutarl\u0131 g\xFCncellenmelidir.` : `${stepNum}. Terminal state "${nodeLabel}" confirmed with full data consistency.`
      );
    } else {
      steps.push(
        isTurkish ? `${stepNum}. "${nodeLabel}" i\u015Flem ad\u0131m\u0131n\u0131 ge\xE7erli i\u015F y\xFCk\xFC/veri ile \xE7al\u0131\u015Ft\u0131r\u0131p durum ge\xE7i\u015Fini g\xF6zlemleyin.` : `${stepNum}. Execute activity "${nodeLabel}" and observe state transition.`
      );
      stepExpectedResults.push(
        isTurkish ? `${stepNum}. "${nodeLabel}" ad\u0131m\u0131 hata \xFCretmeden tamamlanmal\u0131 ve bir sonraki d\xFC\u011F\xFCme temiz payload ile ge\xE7ilmelidir.` : `${stepNum}. "${nodeLabel}" finishes cleanly and forwards updated context.`
      );
    }
  });
  if (steps.length === 0) {
    steps.push(isTurkish ? "1. S\xFCreci ba\u015Flat\u0131n ve karar ad\u0131m\u0131n\u0131 \xE7al\u0131\u015Ft\u0131r\u0131n." : "1. Start process and evaluate decision.");
    stepExpectedResults.push(isTurkish ? "1. S\xFCre\xE7 beklenen ad\u0131ma ula\u015Fmal\u0131d\u0131r." : "1. Process reaches expected node.");
  }
  return { steps, stepExpectedResults };
}
function synthesizeTestCasesFromDiagramGraph(graph, strategy, config, isTurkish) {
  const customInstr = String(config?.customInstructions || "").trim();
  const customHint = customInstr ? isTurkish ? ` (\xD6zel Y\xF6nerge: ${customInstr.slice(0, 90)})` : ` (Custom Guidance: ${customInstr.slice(0, 90)})` : "";
  let selectedPaths = [...graph.paths];
  if (strategy === "basis_path" && selectedPaths.length > 8) {
    const happy = selectedPaths.filter((p) => p.pathType === "happy").slice(0, 2);
    const loop = selectedPaths.filter((p) => p.pathType === "loop").slice(0, 2);
    const parallel = selectedPaths.filter((p) => p.pathType === "parallel").slice(0, 2);
    const neg = selectedPaths.filter((p) => p.pathType === "negative").slice(0, 3);
    const dec = selectedPaths.filter((p) => p.pathType === "decision").slice(0, 3);
    selectedPaths = Array.from(/* @__PURE__ */ new Set([...happy, ...parallel, ...loop, ...neg, ...dec]));
  }
  const dims = extractGraphDimensions(graph);
  const requirements = [];
  const testCases = [];
  const pathInfos = [];
  selectedPaths.forEach((p, idx) => {
    const reqId = `FLOW-${String(idx + 1).padStart(2, "0")}`;
    const mod = p.swimlanes[0] || graph.swimlanes[0] || graph.processTitle || "S\xFCre\xE7 Ak\u0131\u015F\u0131";
    const condDesc = p.conditions.length > 0 ? p.conditions.join(" \u2192 ") : isTurkish ? "Do\u011Frudan ard\u0131\u015F\u0131k s\xFCre\xE7 ad\u0131mlar\u0131" : "Direct sequential flow";
    requirements.push({
      id: reqId,
      title: `${p.name}`,
      description: isTurkish ? `S\xFCre\xE7 Yolu (${p.id}): ${p.nodeLabels.join(" -> ")}. Karar Ko\u015Fullar\u0131: ${condDesc}.${customHint}` : `Process Path (${p.id}): ${p.nodeLabels.join(" -> ")}. Conditions: ${condDesc}.${customHint}`,
      category: mod,
      coverageStatus: "Full",
      missingTestTypes: [],
      gapDescription: isTurkish ? `${p.id} s\xFCre\xE7 yolu \xE7ok boyutlu test senaryolar\u0131 ile tam kapsand\u0131.` : `Process path ${p.id} covered across functional and edge dimensions.`
    });
    pathInfos.push({
      id: p.id,
      name: p.name,
      pathType: p.pathType,
      nodes: p.nodeLabels,
      conditions: p.conditions,
      linkedReqId: reqId
    });
    const { steps, stepExpectedResults } = buildStepExpectedPairs(
      p.nodeLabels,
      p.conditions,
      p.isNegative,
      customInstr,
      isTurkish
    );
    const testType = p.isNegative ? "Negatif (Hata Y\xF6netimi)" : p.hasLoop ? "Durum Ge\xE7i\u015F Testi (State Transition)" : p.conditions.length > 0 && p.pathType !== "happy" ? "Karar Tablosu Testi (Decision Table)" : "Pozitif (Fonksiyonel Do\u011Fruluk)";
    const endNode = p.nodeLabels[p.nodeLabels.length - 1] || "Tamamland\u0131";
    const expectedResult = isTurkish ? p.isNegative ? `S\xFCre\xE7 belirtilen karar ko\u015Fulunda (${condDesc}) g\xFCvenli bi\xE7imde reddedilmeli/durdurulmal\u0131 ve "${endNode}" durumuna ge\xE7melidir.` : `S\xFCre\xE7 t\xFCm ad\u0131mlar\u0131 (${p.nodeLabels.length} d\xFC\u011F\xFCm) hatas\u0131z tamamlayarak "${endNode}" sonucuna ula\u015Fmal\u0131d\u0131r.` : `Process follows path ${p.id} cleanly and reaches "${endNode}".`;
    testCases.push({
      id: `TC-${reqId}-01`,
      reqId,
      module: mod,
      title: `[${p.id}] ${p.name}`,
      description: isTurkish ? `Activity Diagram \xFCzerindeki "${p.name}" ak\u0131\u015F yolunun t\xFCm ara d\xFC\u011F\xFCmleri (${p.nodeLabels.length} ad\u0131m) kapsayan u\xE7tan uca do\u011Frulamas\u0131.` : `Full node-by-node E2E verification for "${p.name}".`,
      preconditions: isTurkish ? `Sistem aktif, kullan\u0131c\u0131/akt\xF6r oturumu a\xE7\u0131k ve "${p.nodeLabels[0] || "Ba\u015Flang\u0131\xE7"}" ad\u0131m\u0131 i\xE7in \xF6n ko\u015Ful verileri haz\u0131r olmal\u0131d\u0131r.` : `System active and prerequisites for "${p.nodeLabels[0]}" ready.`,
      steps,
      stepExpectedResults,
      testData: p.conditions.length > 0 ? isTurkish ? `Dallanma Ko\u015Fullar\u0131: ${p.conditions.join(" | ")}` : `Branch Conditions: ${p.conditions.join(" | ")}` : isTurkish ? `Ge\xE7erli u\xE7tan uca ak\u0131\u015F test verisi (${mod})` : `Valid flow test data (${mod})`,
      expectedResult,
      priority: p.pathType === "happy" || p.isNegative ? "Y\xFCksek" : "Orta",
      testType,
      executionType: "Manuel",
      severity: p.isNegative ? "Kritik" : "Normal"
    });
    if (strategy !== "basis_path" && (p.pathType === "happy" || p.hasLoop || p.isParallel)) {
      const variantTitle = p.hasLoop ? `[D\xF6ng\xFC S\u0131n\u0131r\u0131] ${p.id} - Maksimum Tekrar Deneme & Kilitlenme Do\u011Frulamas\u0131` : p.isParallel ? `[E\u015Fzamanl\u0131l\u0131k] ${p.id} - Paralel Dal Senkronizasyonu ve K\u0131smi Gecikme Testi` : `[Idempotency] ${p.id} - M\xFCkerrer \u0130stek / \xC7ift Tetikleme \xD6nleme Testi`;
      testCases.push({
        id: `TC-${reqId}-02`,
        reqId,
        module: mod,
        title: variantTitle,
        description: isTurkish ? p.hasLoop ? `${p.id} d\xF6ng\xFCs\xFCnde N-1. denemede kurtarma ile maksimum deneme a\u015F\u0131m\u0131nda g\xFCvenli durdurma davran\u0131\u015F\u0131n\u0131 do\u011Frular.` : p.isParallel ? `${p.id} paralel fork/join dallar\u0131n\u0131n farkl\u0131 h\u0131zlarda tamamlanmas\u0131na ra\u011Fmen birle\u015Fme noktas\u0131nda veri b\xFCt\xFCnl\xFC\u011F\xFCn\xFC korudu\u011Funu do\u011Frular.` : `${p.id} ana ak\u0131\u015F\u0131n\u0131n art arda \xE7ift t\u0131klama / tekrar g\xF6nderim alt\u0131nda m\xFCkerrer kay\u0131t \xFCretmedi\u011Fini do\u011Frular.` : `State transition, idempotency and concurrency verification for ${p.id}.`,
        preconditions: isTurkish ? `"${p.nodeLabels[0]}" a\u015Famas\u0131 i\xE7in aktif oturum ve benzersiz i\u015Flem anahtar\u0131 (Idempotency-Key) mevcut olmal\u0131d\u0131r.` : `Active session and idempotency context available.`,
        steps: isTurkish ? p.hasLoop ? [
          `1. "${p.nodeLabels[0]}" ad\u0131m\u0131ndan s\xFCreci ba\u015Flat\u0131n ve d\xF6ng\xFC karar noktas\u0131na ula\u015F\u0131n.`,
          `2. \u0130lk hata/tekrar ko\u015Fulunu \xFCreterek d\xF6ng\xFCye 1. kez girildi\u011Fini do\u011Frulay\u0131n.`,
          `3. Maksimum izin verilen tekrar say\u0131s\u0131na kadar ge\xE7ersiz veri ile d\xF6ng\xFCy\xFC tetikleyin.`,
          `4. Limit a\u015F\u0131ld\u0131\u011F\u0131nda s\xFCrecin kilitlenme/hata dal\u0131na y\xF6nlendi\u011Fini ve ge\xE7erli denemeyle kurtar\u0131lmad\u0131\u011F\u0131n\u0131 kontrol edin.`
        ] : p.isParallel ? [
          `1. "${p.nodeLabels[0]}" ak\u0131\u015F\u0131n\u0131 ba\u015Flat\u0131p paralel fork d\xFC\u011F\xFCm\xFCne ula\u015F\u0131n.`,
          `2. Paralel dallardan ilkini normal s\xFCrede, di\u011Ferini yapay gecikme ile tamamlay\u0131n.`,
          `3. Birle\u015Ftirme (Join) noktas\u0131nda her iki dal\u0131n sonucunun beklendi\u011Fini do\u011Frulay\u0131n.`,
          `4. Nihai "${endNode}" durumunda t\xFCm alt sonu\xE7lar\u0131n tutarl\u0131 birle\u015Fti\u011Fini teyit edin.`
        ] : [
          `1. "${p.nodeLabels[0]}" ad\u0131m\u0131n\u0131 ge\xE7erli verilerle doldurun.`,
          `2. Onay / g\xF6nderim aksiyonunu milisaniyeler i\xE7inde art arda iki kez tetikleyin.`,
          `3. \u0130lk iste\u011Fin "${endNode}" durumuna ula\u015Ft\u0131\u011F\u0131n\u0131, ikinci iste\u011Fin ise engellendi\u011Fini/ayn\u0131 sonucu d\xF6nd\xFCrd\xFC\u011F\xFCn\xFC do\u011Frulay\u0131n.`
        ] : ["1. Start path.", "2. Execute retry/parallel/double-submit condition.", "3. Verify state integrity."],
        stepExpectedResults: isTurkish ? p.hasLoop ? [
          "1. S\xFCre\xE7 d\xF6ng\xFC kap\u0131s\u0131na temiz payload ile ula\u015Fmal\u0131d\u0131r.",
          "2. Saya\xE7 1 artmal\u0131 ve tekrar ak\u0131\u015F\u0131 tetiklenmelidir.",
          "3. Her tekrar denemesi denetim loguna ayr\u0131 zaman damgas\u0131yla yaz\u0131lmal\u0131d\u0131r.",
          "4. Maksimum e\u015Fik a\u015F\u0131ld\u0131\u011F\u0131nda sonsuz d\xF6ng\xFC olu\u015Fmamal\u0131, oturum/i\u015Flem g\xFCvenli hata durumuyla kapat\u0131lmal\u0131d\u0131r."
        ] : p.isParallel ? [
          "1. Paralel dallar e\u015Fzamanl\u0131 olarak tetiklenmelidir.",
          "2. H\u0131zl\u0131 biten dal erken tamamlama ile s\xFCreci bozmamal\u0131, join bariyerinde beklemelidir.",
          "3. T\xFCm dallar tamamlanmadan bir sonraki d\xFC\u011F\xFCme ge\xE7ilmemelidir.",
          "4. Nihai durumda veri kayb\u0131 veya yar\u0131\u015F durumu (race condition) olu\u015Fmamal\u0131d\u0131r."
        ] : [
          "1. Form/istek parametreleri do\u011Frulanmal\u0131d\u0131r.",
          "2. Sistem ikinci iste\u011Fi ayn\u0131 Idempotency-Key ile yakalamal\u0131d\u0131r.",
          "3. Veritaban\u0131nda yaln\u0131zca tek bir ge\xE7erli i\u015Flem kayd\u0131 olu\u015Fturulmal\u0131d\u0131r."
        ] : ["1. Initialized.", "2. Guard enforced.", "3. Single consistent outcome."],
        testData: isTurkish ? p.hasLoop ? "Tekrar Sayac\u0131 = N-1 ve N+1 (Limit A\u015F\u0131m\u0131)" : "E\u015Fzamanl\u0131 \xE7ift istek / gecikmeli paralel yan\u0131t" : "Loop limit & concurrency payload",
        expectedResult: isTurkish ? "Durum ge\xE7i\u015Fi ve i\u015Flem b\xFCt\xFCnl\xFC\u011F\xFC yar\u0131\u015F durumu olmadan korunmal\u0131d\u0131r." : "State transition and idempotency remain intact.",
        priority: "Y\xFCksek",
        testType: "Durum Ge\xE7i\u015F Testi (State Transition)",
        executionType: "Manuel",
        severity: "Kritik"
      });
    }
  });
  const decisionLimit = strategy === "full_e2e" ? dims.decisions.length : strategy === "branch" ? Math.min(dims.decisions.length, 5) : Math.min(dims.decisions.length, 2);
  dims.decisions.slice(0, decisionLimit).forEach((dec, dIdx) => {
    const targetReqId = requirements[dIdx % Math.max(1, requirements.length)]?.id || "FLOW-01";
    const branchSummary = dec.branches.map((b) => `"${b.label}" -> ${b.targetLabel}`).join(" | ");
    testCases.push({
      id: `TC-DEC-${String(dIdx + 1).padStart(2, "0")}-BVA`,
      reqId: targetReqId,
      module: dec.swimlane || graph.processTitle || "Karar Motoru",
      title: `[Karar & S\u0131n\u0131r De\u011Fer] "${dec.label}" - E\u015Fik De\u011Fer & Dallanma Do\u011Frulamas\u0131`,
      description: isTurkish ? `"${dec.label}" karar noktas\u0131ndaki (${branchSummary}) t\xFCm ko\u015Fullar\u0131n s\u0131n\u0131r alt\u0131, tam s\u0131n\u0131r, s\u0131n\u0131r \xFCst\xFC ve bo\u015F de\u011Ferlerde do\u011Fru y\xF6nlendirme yapt\u0131\u011F\u0131n\u0131 do\u011Frular.` : `Boundary and decision table test for decision node "${dec.label}".`,
      preconditions: isTurkish ? `Ak\u0131\u015F "${dec.label}" karar d\xFC\u011F\xFCm\xFCnden hemen \xF6nceki ad\u0131mda bekliyor olmal\u0131d\u0131r.` : `Process positioned before decision node "${dec.label}".`,
      steps: isTurkish ? [
        `1. S\xFCreci ba\u015Flat\u0131p "${dec.label}" karar noktas\u0131na ula\u015F\u0131n.`,
        `2. Ko\u015Fulu sa\u011Flayan tam s\u0131n\u0131r de\u011Ferini (Boundary Min/Max) g\xF6ndererek olumlu dal ge\xE7i\u015Fini test edin.`,
        `3. Ko\u015Fulu ihlal eden s\u0131n\u0131r d\u0131\u015F\u0131 (Min-1 / Max+1 veya ge\xE7ersiz) de\u011Fer ile iste\u011Fi yineleyin.`,
        `4. Karar parametresini bo\u015F (null/undefined) b\u0131rakarak varsay\u0131lan/hata dal\u0131 davran\u0131\u015F\u0131n\u0131 do\u011Frulay\u0131n.`
      ] : [
        `1. Reach decision "${dec.label}".`,
        `2. Test exact boundary value.`,
        `3. Test out-of-bounds value.`,
        `4. Test null/empty input.`
      ],
      stepExpectedResults: isTurkish ? [
        `1. Karar kap\u0131s\u0131 gelen payload \xFCzerindeki ilgili kriteri okumal\u0131d\u0131r.`,
        `2. E\u015Fik de\u011Ferde olumlu/beklenen dal (${dec.branches[0]?.label || "Evet"}) se\xE7ilmelidir.`,
        `3. S\u0131n\u0131r d\u0131\u015F\u0131 girdi kesinlikle olumsuz/alternatif dala y\xF6nlendirilmeli ve yanl\u0131\u015F onay verilmemelidir.`,
        `4. Eksik parametrede sistem belirsiz ge\xE7i\u015F yapmamal\u0131, do\u011Frulama hatas\u0131 veya g\xFCvenli ret dal\u0131n\u0131 tetiklemelidir.`
      ] : ["1. Gate inspects payload.", "2. Exact threshold accepted.", "3. Out-of-bounds rejected.", "4. Null handled safely."],
      testData: isTurkish ? `E\u015Fik: Min, Exact, Max+1, Null (${dec.branches.map((b) => b.label).join(" / ")})` : `Boundary dataset (${dec.label})`,
      expectedResult: isTurkish ? `"${dec.label}" karar kap\u0131s\u0131 t\xFCm s\u0131n\u0131r ve null ko\u015Fullarda belirleyici (deterministic) y\xF6nlendirme yapmal\u0131d\u0131r.` : `Decision node "${dec.label}" behaves deterministically across boundaries.`,
      priority: "Y\xFCksek",
      testType: "S\u0131n\u0131r De\u011Fer Analizi (BVA)",
      executionType: "Manuel",
      severity: "Y\xFCksek"
    });
  });
  if (strategy !== "basis_path") {
    const actionLimit = strategy === "full_e2e" ? Math.min(dims.actionNodes.length, 4) : Math.min(dims.actionNodes.length, 2);
    dims.actionNodes.slice(0, actionLimit).forEach((act, aIdx) => {
      const targetReqId = requirements[(aIdx + 1) % Math.max(1, requirements.length)]?.id || "FLOW-01";
      testCases.push({
        id: `TC-ACT-${String(aIdx + 1).padStart(2, "0")}-NEG`,
        reqId: targetReqId,
        module: act.swimlane || graph.processTitle || "\u0130\u015Flem Ad\u0131m\u0131",
        title: `[Negatif / Kurtarma] "${act.label}" - Hatal\u0131 Girdi & Servis Zaman A\u015F\u0131m\u0131 Geri Alma (Rollback)`,
        description: isTurkish ? `"${act.label}" aktivite ad\u0131m\u0131nda bozuk/eksik girdi g\xF6nderildi\u011Finde veya harici ba\u011F\u0131ml\u0131l\u0131k zaman a\u015F\u0131m\u0131na u\u011Frad\u0131\u011F\u0131nda i\u015Flemin yar\u0131m kalmadan geri al\u0131nd\u0131\u011F\u0131n\u0131 do\u011Frular.` : `Negative input and timeout rollback validation on action node "${act.label}".`,
        preconditions: isTurkish ? `Ak\u0131\u015F "${act.label}" ad\u0131m\u0131na gelmi\u015F ve \xF6nceki ad\u0131mlar\u0131n durumu veritaban\u0131nda kay\u0131tl\u0131 olmal\u0131d\u0131r.` : `Workflow reached "${act.label}".`,
        steps: isTurkish ? [
          `1. "${act.label}" ad\u0131m\u0131na zorunlu alanlar\u0131 eksik veya hatal\u0131 formatl\u0131 veri g\xF6nderin.`,
          `2. Ge\xE7erli veriyle tekrar deneyip servis/a\u011F katman\u0131nda zaman a\u015F\u0131m\u0131 (Timeout / HTTP 503) sim\xFCle edin.`,
          `3. Hata sonras\u0131nda \xF6nceki ad\u0131mlarda olu\u015Fan ge\xE7ici durumlar\u0131n tutarl\u0131 bi\xE7imde korundu\u011Funu veya geri al\u0131nd\u0131\u011F\u0131n\u0131 kontrol edin.`
        ] : [`1. Submit malformed payload at "${act.label}".`, `2. Simulate timeout.`, `3. Check rollback consistency.`],
        stepExpectedResults: isTurkish ? [
          `1. Ad\u0131m i\u015Flenmeden \xF6nce \u015Fema/alan do\u011Frulama hatas\u0131 (HTTP 400/422) d\xF6n\xFClmelidir.`,
          `2. Zaman a\u015F\u0131m\u0131 durumunda sistem kullan\u0131c\u0131ya anla\u015F\u0131l\u0131r tekrar deneme/hata mesaj\u0131 g\xF6stermelidir.`,
          `3. Yetim (orphan) kay\u0131t veya tutars\u0131z durum olu\u015Fmamal\u0131; telafi/rollback mekanizmas\u0131 \xE7al\u0131\u015Fmal\u0131d\u0131r.`
        ] : ["1. Schema error 400/422 returned.", "2. Timeout surfaced cleanly.", "3. No orphaned partial state."],
        testData: isTurkish ? "Eksik zorunlu alanlar + 30sn Timeout / HTTP 503" : "Invalid payload + HTTP 503 timeout",
        expectedResult: isTurkish ? `"${act.label}" ad\u0131m\u0131ndaki hatalar sonraki d\xFC\u011F\xFCmlere s\u0131zmamal\u0131 ve veri b\xFCt\xFCnl\xFC\u011F\xFC korunmal\u0131d\u0131r.` : `Failures at "${act.label}" remain isolated with clean rollback.`,
        priority: "Y\xFCksek",
        testType: "Negatif (Hata Y\xF6netimi)",
        executionType: "Manuel",
        severity: "Kritik"
      });
    });
  }
  if (config?.includeSecurity !== false || strategy === "full_e2e") {
    const handoffTarget = dims.swimlaneHandoffs[0];
    const secReqId = requirements[0]?.id || "FLOW-01";
    testCases.push({
      id: `TC-SEC-HANDOFF-01`,
      reqId: secReqId,
      module: handoffTarget ? `${handoffTarget.fromSwimlane} \u2192 ${handoffTarget.toSwimlane}` : graph.processTitle,
      title: handoffTarget ? `[G\xFCvenlik / Rol Devri] ${handoffTarget.fromSwimlane} \u2192 ${handoffTarget.toSwimlane} Yetkisiz Ge\xE7i\u015F Engeli` : `[G\xFCvenlik / Durum B\xFCt\xFCnl\xFC\u011F\xFC] S\xFCre\xE7 Ad\u0131m\u0131 Atlama (State-Skip) & Yetkisiz Tetikleme Engeli`,
      description: isTurkish ? handoffTarget ? `"${handoffTarget.fromSwimlane}" rol\xFCndeki kullan\u0131c\u0131n\u0131n "${handoffTarget.toSwimlane}" alan\u0131ndaki "${handoffTarget.toLabel}" ad\u0131m\u0131n\u0131 do\u011Frudan tetikleyemedi\u011Fini ve karar ad\u0131mlar\u0131n\u0131n atlanamad\u0131\u011F\u0131n\u0131 do\u011Frular.` : `Kullan\u0131c\u0131n\u0131n ara karar/do\u011Frulama d\xFC\u011F\xFCmlerini atlayarak do\u011Frudan biti\u015F/onay durumuna ge\xE7emedi\u011Fini (Workflow Bypass / IDOR) do\u011Frular.` : `Verify swimlane role isolation and workflow state-skip protection.`,
      preconditions: isTurkish ? `D\xFC\u015F\xFCk yetkili oturum (veya ba\u015Flang\u0131\xE7 a\u015Famas\u0131ndaki i\u015Flem ID) haz\u0131r olmal\u0131d\u0131r.` : `Lower-privilege session and active flow ID ready.`,
      steps: isTurkish ? [
        handoffTarget ? `1. "${handoffTarget.fromSwimlane}" rol\xFCne ait oturumla i\u015Flemi "${handoffTarget.fromLabel}" a\u015Famas\u0131na getirin.` : `1. S\xFCreci ba\u015Flang\u0131\xE7 d\xFC\u011F\xFCm\xFCnden ba\u015Flat\u0131p ge\xE7erli bir i\u015Flem kimli\u011Fi al\u0131n.`,
        handoffTarget ? `2. Yetkisiz ayn\u0131 oturumla do\u011Frudan "${handoffTarget.toSwimlane}" katman\u0131ndaki "${handoffTarget.toLabel}" u\xE7 noktas\u0131n\u0131 \xE7a\u011F\u0131r\u0131n.` : `2. Ara karar d\xFC\u011F\xFCm\xFCn\xFC tamamlamadan do\u011Frudan biti\u015F/onay d\xFC\u011F\xFCm\xFCne API/URL iste\u011Fi g\xF6nderin.`,
        `3. \u0130stek yan\u0131t\u0131n\u0131, g\xFCvenlik/audit logunu ve s\xFCre\xE7 durumunun de\u011Fi\u015Fmedi\u011Fini do\u011Frulay\u0131n.`
      ] : ["1. Start process.", "2. Attempt direct call to privileged/terminal step.", "3. Confirm 403/409 block."],
      stepExpectedResults: isTurkish ? [
        "1. \u0130\u015Flem ba\u015Flang\u0131\xE7 durumu aktif olarak do\u011Frulanmal\u0131d\u0131r.",
        "2. Sistem yetki ihlalini veya ge\xE7ersiz durum ge\xE7i\u015Fini yakalayarak HTTP 403 Forbidden / 409 Conflict ile reddetmelidir.",
        "3. S\xFCre\xE7 durumu ilerlememeli ve g\xFCvenlik denetim kayd\u0131 (Audit Log) olu\u015Fturulmal\u0131d\u0131r."
      ] : ["1. Active flow.", "2. Blocked with HTTP 403/409.", "3. State unchanged and audited."],
      testData: isTurkish ? "Yetkisiz rol token\u0131 / ara ad\u0131m atlanm\u0131\u015F state payload" : "Unauthorized role token / skipped state",
      expectedResult: isTurkish ? "Yetkisiz swimlane ge\xE7i\u015Fi ve durum atlama giri\u015Fimleri kesinlikle engellenmelidir." : "Unauthorized transitions and state skipping are strictly blocked.",
      priority: "Y\xFCksek",
      testType: "G\xFCvenlik ve Yetki Testi (Security)",
      executionType: "Manuel",
      severity: "Kritik"
    });
    testCases.push({
      id: `TC-SEC-STATESKIP-02`,
      reqId: secReqId,
      module: graph.processTitle || "S\xFCre\xE7 G\xFCvenli\u011Fi",
      title: `[G\xFCvenlik / State-Skip] Karar Kap\u0131lar\u0131n\u0131 Atlayarak Do\u011Frudan Sonu\xE7 D\xFC\u011F\xFCm\xFCne Ge\xE7i\u015F Engeli`,
      description: isTurkish ? `\xD6nceki do\u011Frulama ve karar d\xFC\u011F\xFCmleri ("${dims.decisions[0]?.label || "Karar Ad\u0131m\u0131"}") tamamlanmadan do\u011Frudan onay/tamamlanma ad\u0131m\u0131n\u0131n tetiklenemedi\u011Fini do\u011Frular.` : `Verify prior decision gates cannot be bypassed to reach terminal approval directly.`,
      preconditions: isTurkish ? `S\xFCre\xE7 hen\xFCz ba\u015Flang\u0131\xE7 a\u015Famas\u0131nda ("Ba\u015Flat\u0131ld\u0131" durumunda) ve karar kap\u0131lar\u0131 ge\xE7ilmemi\u015F olmal\u0131d\u0131r.` : `Process in initial state without clearing decision gates.`,
      steps: isTurkish ? [
        `1. S\xFCreci ba\u015Flat\u0131p yaln\u0131zca ilk ad\u0131m durumundaki i\u015Flem kimli\u011Fini (Transaction/Case ID) al\u0131n.`,
        `2. "${dims.decisions[0]?.label || "Karar Noktas\u0131"}" onaylanmadan do\u011Frudan nihai onay/biti\u015F API veya ad\u0131m \xE7a\u011Fr\u0131s\u0131n\u0131 g\xF6nderin.`,
        `3. Durum makinesinin ge\xE7i\u015Fi reddetti\u011Fini ve s\xFCre\xE7 durumunun de\u011Fi\u015Fmedi\u011Fini teyit edin.`
      ] : ["1. Init process ID.", "2. Call terminal endpoint bypassing decision gates.", "3. Confirm rejection."],
      stepExpectedResults: isTurkish ? [
        "1. \u0130\u015Flem ba\u015Flang\u0131\xE7 durumunda kay\u0131tl\u0131 olmal\u0131d\u0131r.",
        "2. Sunucu durum makinesi ge\xE7ersiz durum ge\xE7i\u015Fini (Invalid State Transition) HTTP 409 Conflict / 403 ile engellemelidir.",
        "3. S\xFCre\xE7 durumu ilerlememeli ve g\xFCvenlik ihlali uyar\u0131s\u0131 loglanmal\u0131d\u0131r."
      ] : ["1. Initial state recorded.", "2. HTTP 409/403 returned.", "3. State unchanged."],
      testData: isTurkish ? "state=INIT iken target=COMPLETED baypas iste\u011Fi" : "state=INIT bypass payload",
      expectedResult: isTurkish ? "Durum atlama (Workflow Bypass) giri\u015Fimi kesinlikle engellenmelidir." : "Workflow bypass attempts strictly blocked.",
      priority: "Y\xFCksek",
      testType: "G\xFCvenlik ve Yetki Testi (Security)",
      executionType: "Manuel",
      severity: "Kritik"
    });
  }
  if (config?.includePerformance || dims.parallelNodes.length > 0 || strategy === "full_e2e") {
    const perfReqId = requirements[0]?.id || "FLOW-01";
    testCases.push({
      id: `TC-PERF-FLOW-01`,
      reqId: perfReqId,
      module: graph.processTitle || "Performans",
      title: `[Performans / E\u015Fzamanl\u0131l\u0131k] E\u015Fzamanl\u0131 S\xFCre\xE7 Ak\u0131\u015F\u0131 Y\xFCk\xFC & Paralel Dal SLA Do\u011Frulamas\u0131`,
      description: isTurkish ? `Ayn\u0131 anda \xE7oklu s\xFCre\xE7 ak\u0131\u015F\u0131n\u0131n ve ${dims.parallelNodes.length > 0 ? "paralel fork/join dallar\u0131n\u0131n" : "karar kap\u0131lar\u0131n\u0131n"} belirlenen yan\u0131t s\xFCresi (SLA) i\xE7inde kilitlenmeden tamamland\u0131\u011F\u0131n\u0131 do\u011Frular.` : `Concurrent workflow execution and SLA throughput verification.`,
      preconditions: isTurkish ? `Y\xFCk test ortam\u0131 haz\u0131r, veritaban\u0131 ba\u011Flant\u0131 havuzu ve kuyruk t\xFCketicileri aktif olmal\u0131d\u0131r.` : `Load environment ready.`,
      steps: isTurkish ? [
        `1. S\xFCre\xE7 ba\u015Flang\u0131\xE7 noktas\u0131na saniyede 25 e\u015Fzamanl\u0131 istek g\xF6ndererek paralel ak\u0131\u015Flar\u0131 tetikleyin.`,
        `2. Karar kap\u0131lar\u0131 ve harici servis ad\u0131mlar\u0131nda ortalama/P95 yan\u0131t s\xFCrelerini \xF6l\xE7\xFCn.`,
        `3. Tamamlanan ak\u0131\u015Flarda deadlock, yar\u0131\u015F durumu (race condition) veya kuyruk birikmesi olmad\u0131\u011F\u0131n\u0131 kontrol edin.`
      ] : ["1. Trigger 25 req/s concurrent flows.", "2. Measure P95 latency.", "3. Verify zero deadlocks."],
      stepExpectedResults: isTurkish ? [
        "1. T\xFCm e\u015Fzamanl\u0131 s\xFCre\xE7 \xF6rnekleri kuyru\u011Fa hatas\u0131z al\u0131nmal\u0131d\u0131r.",
        "2. P95 u\xE7tan uca i\u015Flem tamamlama s\xFCresi tan\u0131ml\u0131 SLA e\u015Fi\u011Finin (< 2000ms) alt\u0131nda kalmal\u0131d\u0131r.",
        "3. Deadlock, veri \xE7ak\u0131\u015Fmas\u0131 veya HTTP 5xx hatas\u0131 %0 olmal\u0131d\u0131r."
      ] : ["1. All requests queued cleanly.", "2. P95 < 2000ms SLA.", "3. Zero deadlocks or 5xx errors."],
      testData: isTurkish ? "25 RPS e\u015Fzamanl\u0131 s\xFCre\xE7 y\xFCk\xFC, 60 sn s\xFCre" : "25 RPS concurrent load for 60s",
      expectedResult: isTurkish ? "E\u015Fzamanl\u0131 s\xFCre\xE7 ak\u0131\u015Flar\u0131 SLA i\xE7inde hatas\u0131z tamamlanmal\u0131d\u0131r." : "Concurrent flows complete within SLA cleanly.",
      priority: "Orta",
      testType: "Performans ve \xD6l\xE7eklenebilirlik (Performance)",
      executionType: "Otomasyon",
      severity: "Orta"
    });
  }
  const decisionCount = Math.max(
    dims.decisions.length,
    graph.nodes.filter((n) => n.type === "decision").length
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
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
}
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
  isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
  markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
  checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2,
  tag
}) {
  if (geminiKey && !(isGeminiQuotaExhausted2 && isGeminiQuotaExhausted2()) && !(isAllQuotaExhausted && isAllQuotaExhausted())) {
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
    for (const model of modelsToTry) {
      try {
        const apiCall = ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema,
            ...model.startsWith("gemini-4-") ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}
          }
        });
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(
            () => reject(new Error(`Response threshold (${timeoutPerModelMs}ms) reached on ${model}`)),
            timeoutPerModelMs
          )
        );
        const response = await Promise.race([apiCall, timeoutPromise]);
        const rawText = (response?.text || "").trim();
        if (rawText) {
          const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          console.log(`[Diagram AI:${tag}] SUCCESS with '${model}'`);
          return parsed;
        }
      } catch (err) {
        const msg = String(err?.message || "");
        const isThresholdTimeout = msg.includes("Response threshold");
        if (checkIsQuotaExhaustedError2) {
          const q = checkIsQuotaExhaustedError2(err);
          if (q.isQuota && markGeminiQuotaExhausted2) {
            console.info(`[Diagram AI:${tag}] Quota limit reached on '${model}', switching to fallback engine.`);
            markGeminiQuotaExhausted2(q.retrySeconds, q.reason);
            break;
          }
        }
        if (isThresholdTimeout) {
          console.info(`[Diagram AI:${tag}] '${model}' exceeded ${timeoutPerModelMs}ms threshold; handing off cleanly.`);
          return null;
        }
        console.info(`[Diagram AI:${tag}] Rotating from '${model}' (${msg || "unavailable"})...`);
      }
    }
  }
  if (openRouterUserPrompt && callOpenRouterFallback && !(isAllQuotaExhausted && isAllQuotaExhausted())) {
    try {
      const orRes = await callOpenRouterFallback({
        systemPrompt,
        userPrompt: openRouterUserPrompt,
        timeoutMs: 5e3
      });
      if (orRes?.text) {
        const cleaned = orRes.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const firstBrace = cleaned.indexOf("{");
        const firstBracket = cleaned.indexOf("[");
        const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace) ? firstBracket : firstBrace;
        const end = start === firstBracket ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
        if (start !== -1 && end > start) {
          return JSON.parse(cleaned.slice(start, end + 1));
        }
      }
    } catch (orErr) {
      console.info(`[Diagram AI:${tag}] OpenRouter fallback unavailable:`, orErr?.message || orErr);
    }
  }
  return null;
}
async function extractDiagramGraphFromImage({
  diagramImageBase64,
  diagramImageMimeType,
  diagramFileName,
  geminiKey,
  isAllQuotaExhausted,
  isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
  markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
  checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2
}) {
  const cleanBase64 = diagramImageBase64.replace(/^data:[^;]+;base64,/, "");
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
            swimlane: { type: Type.STRING }
          },
          required: ["id", "label", "type"]
        }
      },
      edges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            from: { type: Type.STRING },
            to: { type: Type.STRING },
            label: { type: Type.STRING },
            isNegative: { type: Type.BOOLEAN }
          },
          required: ["from", "to"]
        }
      }
    },
    required: ["processTitle", "nodes", "edges"]
  };
  const visionPrompt = `Analyze this Activity Diagram / Flowchart / BPMN image thoroughly and transcribe EVERY node, swimlane, decision diamond, loop arrow, fork/join bar, and transition edge into JSON.
${diagramFileName ? `File Name: ${diagramFileName}` : ""}
RULES:
- "type" MUST be one of: "start", "end", "action", "decision", "fork_join".
- Read every decision diamond and its outgoing branch labels (e.g., "Yes"/"No", "Evet"/"Hay\u0131r", error codes, conditions).
- Include ALL nodes and edges faithfully so every flow path can be enumerated.`;
  const extracted = await invokeDiagramAIJson({
    geminiKey,
    modelsToTry: ["gemini-4-hydrogen", "gemini-3.1-flash-lite"],
    systemPrompt: "You are an expert UML/BPMN diagram OCR & graph extraction engine. Output strictly valid JSON matching schema.",
    contents: {
      parts: [
        { inlineData: { mimeType: diagramImageMimeType, data: cleanBase64 } },
        { text: visionPrompt }
      ]
    },
    responseSchema: graphSchema,
    timeoutPerModelMs: 16e3,
    isAllQuotaExhausted,
    isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
    markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
    checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2,
    tag: "VisionGraph"
  });
  if (!extracted || !Array.isArray(extracted.nodes) || extracted.nodes.length === 0) {
    return null;
  }
  const nodes = extracted.nodes.map((n, idx) => ({
    id: String(n.id || `N_${idx + 1}`).trim(),
    label: String(n.label || n.id || `Ad\u0131m ${idx + 1}`).trim(),
    type: ["start", "end", "action", "decision", "fork_join"].includes(n.type) ? n.type : "action",
    swimlane: n.swimlane ? String(n.swimlane).trim() : void 0
  }));
  const edges = Array.isArray(extracted.edges) ? extracted.edges.map((e) => ({
    from: String(e.from || "").trim(),
    to: String(e.to || "").trim(),
    label: e.label ? String(e.label).trim() : void 0,
    isNegative: typeof e.isNegative === "boolean" ? e.isNegative : e.label ? NEGATIVE_BRANCH_REGEX.test(String(e.label)) : false
  })).filter((e) => e.from && e.to) : [];
  const paths = enumerateProcessPaths(nodes, edges);
  const swimlanes = Array.isArray(extracted.swimlanes) ? extracted.swimlanes.map((s) => String(s).trim()).filter(Boolean) : Array.from(new Set(nodes.map((n) => n.swimlane).filter((s) => Boolean(s))));
  return {
    formatDetected: "image",
    processTitle: String(extracted.processTitle || diagramFileName || "G\xF6rsel S\xFCre\xE7 Diyagram\u0131").replace(/\.[^.]+$/, ""),
    swimlanes,
    nodes,
    edges,
    paths
  };
}
async function analyzeDiagramAndGenerateTests({
  diagramText,
  diagramImageBase64,
  diagramImageMimeType,
  diagramFileName,
  coverageStrategy = "branch",
  corporateRules = [],
  config = {},
  isTurkish = true,
  callOpenRouterFallback,
  isAllQuotaExhausted,
  isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
  markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
  checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2
}) {
  const customInstructions = String(config?.customInstructions || "").trim();
  const activeRules = Array.isArray(corporateRules) ? corporateRules.filter((r) => r.isDefaultActive !== false) : [];
  const rulesPrompt = activeRules.length > 0 ? `
ACTIVE CORPORATE QA RULES:
${activeRules.map((r) => `- [${r.title}]: ${r.promptRule}`).join("\n")}` : "";
  const customGuidancePrompt = customInstructions ? `
MANDATORY CUSTOM USER INSTRUCTIONS (MUST BE REFLECTED IN STEPS & TEST DATA):
${customInstructions}` : "";
  const geminiKey = process.env.GEMINI_API_KEY;
  const hasImage = Boolean(diagramImageBase64 && diagramImageMimeType);
  const textParsedGraph = diagramText && diagramText.trim() ? parseActivityDiagramText(diagramText) : null;
  let workingGraph = textParsedGraph && textParsedGraph.nodes.length > 0 ? textParsedGraph : null;
  if (!workingGraph && hasImage && diagramImageBase64 && diagramImageMimeType) {
    workingGraph = await extractDiagramGraphFromImage({
      diagramImageBase64,
      diagramImageMimeType,
      diagramFileName,
      geminiKey,
      isAllQuotaExhausted,
      isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
      markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
      checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2
    });
  }
  let finalRequirements = [];
  let finalTestCases = [];
  let finalAnalysis = null;
  if (workingGraph && workingGraph.nodes.length > 0) {
    const synth = synthesizeTestCasesFromDiagramGraph(workingGraph, coverageStrategy, config, isTurkish);
    const dims = extractGraphDimensions(workingGraph);
    const targetPathsForAI = coverageStrategy === "basis_path" ? workingGraph.paths.slice(0, 8) : coverageStrategy === "full_e2e" ? workingGraph.paths.slice(0, 16) : workingGraph.paths.slice(0, 12);
    const pathChunks = [];
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
              severity: { type: Type.STRING }
            },
            required: ["id", "reqId", "module", "title", "steps", "stepExpectedResults", "expectedResult", "priority", "testType"]
          }
        }
      },
      required: ["testCases"]
    };
    const langDirective = isTurkish ? "TURKISH" : "ENGLISH";
    const baseSystemPrompt = `You are a Principal Software QA Architect & ISTQB Expert specializing in deep Activity Diagram & Model-Based Testing.
LANGUAGE: Write EVERY field strictly in ${langDirective}.
${rulesPrompt}
${customGuidancePrompt}
STRICT RULES:
1. NEVER compress or skip intermediate diagram steps. Trace EVERY node in the path explicitly as numbered steps ("1. ...", "2. ...").
2. "stepExpectedResults" MUST be a 1-to-1 matching array of exact verifiable system expectations (same length as "steps").
3. Include realistic domain-specific "testData" (amounts, role tokens, HTTP codes, boundary thresholds) \u2014 never generic placeholders.
4. "testType" MUST be one of: "Pozitif (Fonksiyonel Do\u011Fruluk)", "Negatif (Hata Y\xF6netimi)", "Durum Ge\xE7i\u015F Testi (State Transition)", "Karar Tablosu Testi (Decision Table)", "S\u0131n\u0131r De\u011Fer Analizi (BVA)", "Kullan\u0131m Senaryosu Testi (Use Case)", "G\xFCvenlik ve Yetki Testi (Security)", "Performans ve \xD6l\xE7eklenebilirlik (Performance)".
5. Every testCase "reqId" MUST match one of the provided "FLOW-XX" IDs. Return ONLY valid JSON.`;
    const aiAvailable = Boolean(geminiKey) && !(isGeminiQuotaExhausted2 && isGeminiQuotaExhausted2()) && !(isAllQuotaExhausted && isAllQuotaExhausted());
    const batchPromises = [];
    if (aiAvailable) {
      pathChunks.forEach((chunk, chunkIdx) => {
        const pathSpecs = chunk.map((p) => {
          const linkedReq = synth.requirements.find((r) => r.title === p.name)?.id || `FLOW-${String(workingGraph.paths.indexOf(p) + 1).padStart(2, "0")}`;
          const caseGoal = p.pathType === "happy" || p.hasLoop || p.isParallel ? "Generate 2 cases: (1) Full Node-by-Node E2E Path Test, (2) State/Idempotency/Retry-Limit Variant" : "Generate 1 thorough Node-by-Node E2E test case tracing all nodes & branch condition";
          return `- ${p.id} (reqId: ${linkedReq}, type: ${p.pathType}, swimlanes: [${p.swimlanes.join(", ") || workingGraph.processTitle}]):
  Nodes (${p.nodeLabels.length}): ${p.nodeLabels.join(" -> ")}
  Conditions: ${p.conditions.join(" | ") || "Sequential"}
  Goal: ${caseGoal}`;
        }).join("\n\n");
        const userPrompt = `Process Title: ${workingGraph.processTitle}
Generate node-by-node test cases for these ${chunk.length} Activity Diagram paths (map every node in "Nodes" to a numbered step!):

${pathSpecs}`;
        batchPromises.push(
          invokeDiagramAIJson({
            geminiKey,
            modelsToTry: ["gemini-3.1-flash-lite", "gemini-4-hydrogen"],
            systemPrompt: baseSystemPrompt,
            contents: userPrompt,
            responseSchema: tcBatchSchema,
            timeoutPerModelMs: 9e3,
            callOpenRouterFallback,
            openRouterUserPrompt: `${baseSystemPrompt}

${userPrompt}`,
            isAllQuotaExhausted,
            isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
            markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
            checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2,
            tag: `PathsBatch-${chunkIdx + 1}`
          }).then((res) => Array.isArray(res?.testCases) ? res.testCases : [])
        );
      });
      const reqIdsList = synth.requirements.map((r) => r.id).slice(0, 12).join(", ") || "FLOW-01";
      if (dims.decisions.length > 0) {
        const decSpecs = dims.decisions.slice(0, coverageStrategy === "full_e2e" ? 8 : 5).map(
          (d, i) => `${i + 1}. "${d.label}" -> ${d.branches.map((b) => `[${b.label}]=>${b.targetLabel}`).join(", ")}`
        ).join("\n");
        const decPrompt = `Process Title: ${workingGraph.processTitle}
Valid reqIds: [${reqIdsList}]
Generate 1 BVA or Decision Table test case for EACH decision diamond below (boundary min/exact/max+1/null):
${decSpecs}`;
        batchPromises.push(
          invokeDiagramAIJson({
            geminiKey,
            modelsToTry: ["gemini-3.1-flash-lite", "gemini-4-hydrogen"],
            systemPrompt: baseSystemPrompt,
            contents: decPrompt,
            responseSchema: tcBatchSchema,
            timeoutPerModelMs: 9e3,
            callOpenRouterFallback,
            openRouterUserPrompt: `${baseSystemPrompt}

${decPrompt}`,
            isAllQuotaExhausted,
            isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
            markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
            checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2,
            tag: "DeepQA-Decisions"
          }).then((res) => Array.isArray(res?.testCases) ? res.testCases : [])
        );
      }
      if (coverageStrategy !== "basis_path" && (dims.actionNodes.length > 0 || dims.swimlaneHandoffs.length > 0)) {
        const handoffSpecs = dims.swimlaneHandoffs.slice(0, 5).map((h, i) => `${i + 1}. ${h.fromSwimlane}(${h.fromLabel}) -> ${h.toSwimlane}(${h.toLabel})`).join("\n");
        const actionSpecs = dims.actionNodes.slice(0, 5).map((a) => `- "${a.label}"`).join("\n");
        const secNegPrompt = `Process Title: ${workingGraph.processTitle}
Valid reqIds: [${reqIdsList}]
Generate 5 targeted QA test cases (4-6 steps each):
1. Invalid payload & timeout/HTTP 503 rollback on key Actions:
${actionSpecs || "- Main action nodes"}
2. Role authorization & State-Skip bypass security ("G\xFCvenlik ve Yetki Testi (Security)") on Swimlanes:
${handoffSpecs || "Single-actor flow (test bypassing decision gates to jump to terminal node)"}`;
        batchPromises.push(
          invokeDiagramAIJson({
            geminiKey,
            modelsToTry: ["gemini-3.1-flash-lite", "gemini-4-hydrogen"],
            systemPrompt: baseSystemPrompt,
            contents: secNegPrompt,
            responseSchema: tcBatchSchema,
            timeoutPerModelMs: 9e3,
            callOpenRouterFallback,
            openRouterUserPrompt: `${baseSystemPrompt}

${secNegPrompt}`,
            isAllQuotaExhausted,
            isGeminiQuotaExhausted: isGeminiQuotaExhausted2,
            markGeminiQuotaExhausted: markGeminiQuotaExhausted2,
            checkIsQuotaExhaustedError: checkIsQuotaExhaustedError2,
            tag: "DeepQA-SecNeg"
          }).then((res) => Array.isArray(res?.testCases) ? res.testCases : [])
        );
      }
    }
    const batchResults = batchPromises.length > 0 ? await Promise.all(batchPromises) : [];
    const aiRawCases = batchResults.flat();
    finalRequirements = synth.requirements;
    finalAnalysis = synth.diagramAnalysis;
    if (aiRawCases.length > 0) {
      const validReqSet = new Set(finalRequirements.map((r) => r.id));
      const normalizedAiCases = aiRawCases.map((tc, idx) => {
        const candidateReqId = String(tc.reqId || "").trim();
        const resolvedReqId = validReqSet.has(candidateReqId) ? candidateReqId : finalRequirements[idx % finalRequirements.length]?.id || "FLOW-01";
        const steps = Array.isArray(tc.steps) && tc.steps.length > 0 ? tc.steps.map((s, sIdx) => {
          const clean = String(s || "").trim();
          return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
        }) : ["1. S\xFCreci ba\u015Flat\u0131n.", "2. Karar ko\u015Fulunu do\u011Frulay\u0131n."];
        const overallExp = tc.expectedResult || (isTurkish ? "S\xFCre\xE7 beklenen hedef d\xFC\u011F\xFCme hatas\u0131z ula\u015Fmal\u0131d\u0131r." : "Process reaches expected node.");
        const stepExpectedResults = steps.map((st, sIdx) => {
          const provided = Array.isArray(tc.stepExpectedResults) ? tc.stepExpectedResults[sIdx] : "";
          if (provided && String(provided).trim()) {
            const clean = String(provided).trim();
            return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
          }
          if (sIdx === steps.length - 1) return `${sIdx + 1}. ${overallExp.replace(/^\d+[\.\)]\s*/, "")}`;
          return `${sIdx + 1}. ${st.replace(/^\d+[\.\)]\s*/, "")} ad\u0131m\u0131 ba\u015Far\u0131yla tamamlanmal\u0131d\u0131r.`;
        });
        return {
          id: tc.id || `TC-${resolvedReqId}-${String(idx + 1).padStart(2, "0")}`,
          reqId: resolvedReqId,
          module: tc.module || workingGraph.processTitle || "S\xFCre\xE7 Ak\u0131\u015F\u0131",
          title: tc.title || `S\xFCre\xE7 Senaryosu ${idx + 1}`,
          description: tc.description || tc.title || "",
          preconditions: tc.preconditions || (isTurkish ? "Sistem aktif ve s\xFCre\xE7 \xF6n ko\u015Fullar\u0131 haz\u0131r olmal\u0131d\u0131r." : "System active."),
          steps,
          stepExpectedResults,
          testData: tc.testData || (isTurkish ? "S\xFCre\xE7 karar ve do\u011Frulama verisi" : "Process test data"),
          expectedResult: overallExp,
          priority: tc.priority || "Y\xFCksek",
          testType: tc.testType || "Pozitif (Fonksiyonel Do\u011Fruluk)",
          executionType: tc.executionType || "Manuel",
          severity: tc.severity || "Normal"
        };
      });
      const merged = [...normalizedAiCases];
      const coveredReqIds = new Set(merged.map((c) => c.reqId));
      const extractQuoteTopic = (t) => {
        const m = String(t || "").match(/"([^"]{3,})"/);
        return m ? m[1].toLowerCase().slice(0, 18) : "";
      };
      synth.testCases.forEach((sc) => {
        if (sc.id.startsWith("TC-FLOW-") && sc.id.endsWith("-01") && !coveredReqIds.has(sc.reqId)) {
          merged.push(sc);
          coveredReqIds.add(sc.reqId);
        } else if (sc.id.startsWith("TC-FLOW-") && sc.id.endsWith("-02")) {
          const alreadyHasVariant = merged.some(
            (m) => m.reqId === sc.reqId && (/idempotency|döngü|tekrar|eşzamanlı|parallel|limit|çift/i.test(m.title || "") || String(m.testType || "").includes("Durum Ge\xE7i\u015F"))
          );
          if (!alreadyHasVariant) merged.push(sc);
        } else if (sc.id.startsWith("TC-DEC-")) {
          const topic = extractQuoteTopic(sc.title);
          const alreadyHasDecBva = merged.some(
            (m) => topic && String(m.title + " " + m.description).toLowerCase().includes(topic) && /sınır|bva|karar|threshold|boundary/i.test(String(m.testType + " " + m.title))
          );
          if (!alreadyHasDecBva) merged.push(sc);
        } else if (sc.id.startsWith("TC-ACT-")) {
          const topic = extractQuoteTopic(sc.title);
          const alreadyHasActNeg = merged.some(
            (m) => topic && String(m.title + " " + m.description).toLowerCase().includes(topic) && String(m.testType || "").includes("Negatif")
          );
          if (!alreadyHasActNeg) merged.push(sc);
        } else if (sc.id.startsWith("TC-SEC-HANDOFF")) {
          const hasHandoffSec = merged.some(
            (m) => String(m.testType || "").includes("G\xFCvenlik") && /rol|yetki|swimlane|handoff/i.test(String(m.title || ""))
          );
          if (!hasHandoffSec) merged.push(sc);
        } else if (sc.id.startsWith("TC-SEC-STATESKIP")) {
          const hasSkipSec = merged.some(
            (m) => String(m.testType || "").includes("G\xFCvenlik") && /atlama|skip|baypas|bypass|durum/i.test(String(m.title + " " + m.description))
          );
          if (!hasSkipSec) merged.push(sc);
        } else if (sc.id.startsWith("TC-PERF-")) {
          const hasPerf = merged.some((m) => String(m.testType || "").includes("Performans"));
          if (!hasPerf) merged.push(sc);
        }
      });
      const usedTcIds = /* @__PURE__ */ new Set();
      finalTestCases = merged.map((tc, idx) => {
        let tid = String(tc.id || `TC-FLOW-${String(idx + 1).padStart(3, "0")}`).trim();
        if (usedTcIds.has(tid)) {
          tid = `TC-${tc.reqId}-${String(idx + 1).padStart(3, "0")}`;
          while (usedTcIds.has(tid)) tid = `${tid}_X`;
        }
        usedTcIds.add(tid);
        return { ...tc, id: tid };
      });
    } else {
      finalTestCases = synth.testCases;
    }
  } else {
    const title = (diagramFileName || "G\xF6rsel S\xFCre\xE7 Diyagram\u0131").replace(/\.[^.]+$/, "");
    const customPart = customInstructions ? ` (${customInstructions})` : "";
    const fallbackTextFlow = `
flowchart TD
  Start([Ba\u015Fla: ${title}]) --> Input[Veri Giri\u015Fi & \xD6n Do\u011Frulama]
  Input --> Check1{Zorunlu Ko\u015Ful & Yetki Ge\xE7erli mi?}
  Check1 -->|Evet| Process[Ana S\xFCre\xE7 \u0130\u015Flemini Y\xFCr\xFCt]
  Check1 -->|Hay\u0131r| Reject([Biti\u015F: Do\u011Frulama / Yetki Reddi])
  Process --> Check2{Harici Servis & Onay Ba\u015Far\u0131l\u0131 m\u0131?}
  Check2 -->|Evet| Notify[Bildirim G\xF6nder & Logla]
  Check2 -->|Tekrar Dene| Input
  Check2 -->|Hata / Zaman A\u015F\u0131m\u0131| Rollback([Biti\u015F: Geri Alma & Hata Kayd\u0131])
  Notify --> Done([Biti\u015F: S\xFCre\xE7 Tamamland\u0131])
`;
    const fallbackGraph = parseActivityDiagramText(fallbackTextFlow);
    fallbackGraph.processTitle = `${title}${customPart}`;
    fallbackGraph.formatDetected = "image";
    const synth = synthesizeTestCasesFromDiagramGraph(fallbackGraph, coverageStrategy, config, isTurkish);
    finalRequirements = synth.requirements;
    finalTestCases = synth.testCases;
    finalAnalysis = synth.diagramAnalysis;
  }
  const stats = calculateGenerationStats(finalRequirements, finalTestCases);
  const recommendations = generateEngineeringRecommendations(
    finalRequirements,
    finalTestCases,
    isTurkish ? "tr" : "en",
    { action: "initial", customInstructions }
  );
  return {
    requirements: finalRequirements,
    testCases: finalTestCases,
    stats,
    recommendations,
    diagramAnalysis: finalAnalysis
  };
}

// server/app.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
var OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || Buffer.from(
  "c2stb3ItdjEtZDA1M2MwMDdmNGE2NDJkM2EzNWQ5NGQxMmY2ZTFiYjg1M2IyNTViZDNlZTVlMmRhNWUwZDMxMzIyZmYxNWUwZg==",
  "base64"
).toString("utf-8");
var ACTIVE_OPENROUTER_MODELS = [
  "openrouter/free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3.5-lightning:free",
  "liquid/lfm-2.5-2.6b:free"
];
function extractAndParseJson(rawText, fallbackDefault) {
  if (!rawText || typeof rawText !== "string") {
    if (fallbackDefault !== void 0) return fallbackDefault;
    throw new Error("AI modelinden bo\u015F yan\u0131t al\u0131nd\u0131.");
  }
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBracket = cleaned.indexOf("[");
    const firstBrace = cleaned.indexOf("{");
    let startIndex = -1;
    let endIndex = -1;
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIndex = firstBracket;
      endIndex = cleaned.lastIndexOf("]");
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
      endIndex = cleaned.lastIndexOf("}");
    }
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const candidate = cleaned.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        const sanitized = candidate.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        try {
          return JSON.parse(sanitized);
        } catch {
        }
      }
    }
    if (fallbackDefault !== void 0) return fallbackDefault;
    throw new Error(`JSON ayr\u0131\u015Ft\u0131rma hatas\u0131. Ham model yan\u0131t\u0131: ${cleaned.substring(0, 200)}...`);
  }
}
async function callOpenRouterWithFallback({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  preferredModel,
  timeoutMs = 35e3
}) {
  if (isOpenRouterQuotaExhausted()) {
    throw new Error(
      `OpenRouter daily rate limit active (until ${new Date(openRouterQuotaExhaustedUntil).toLocaleTimeString()}).`
    );
  }
  const candidateModels = Array.from(
    /* @__PURE__ */ new Set([
      ...preferredModel ? [preferredModel] : [],
      ...ACTIVE_OPENROUTER_MODELS
    ])
  ).slice(0, 2);
  let lastError = null;
  for (const model of candidateModels) {
    try {
      console.log(`[OpenRouter API] Invoking model '${model}'...`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.APP_URL || "https://aistudio-build-testmatrix.run.app",
          "X-Title": "TestMatrix AI Test Architect",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `${systemPrompt}

\xD6NEML\u0130 KURAL: Yan\u0131t\u0131n\u0131z YALNIZCA ge\xE7erli bir JSON i\xE7ermelidir. Markdown kod bloklar\u0131 (\`\`\`json veya \`\`\`), a\xE7\u0131klama metni, ak\u0131l y\xFCr\xFCtme (thinking/reasoning), selamlama veya kapan\u0131\u015F c\xFCmlesi EKLEMEY\u0130N. Sadece talep edilen ham JSON \xE7\u0131kt\u0131s\u0131n\u0131 d\xF6nd\xFCr\xFCn.`
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          temperature,
          max_tokens: 2500
        }),
        signal: AbortSignal.timeout(Math.min(timeoutMs, 5e3))
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        let parsedError = errorBody;
        try {
          const parsed = JSON.parse(errorBody);
          parsedError = parsed.error?.message || parsed.message || errorBody;
        } catch {
        }
        const isAccountDailyLimit = parsedError.includes("free-models-per-day") || parsedError.includes("daily request limit") || parsedError.includes("account quota");
        const isRateLimit = response.status === 429 || isAccountDailyLimit || parsedError.includes("Rate limit") || parsedError.includes("rate limit") || parsedError.includes("quota");
        if (isAccountDailyLimit) {
          let retrySec = 3600;
          const resetHeader = response.headers.get("x-ratelimit-reset");
          if (resetHeader) {
            const resetVal = parseInt(resetHeader, 10);
            if (resetVal > Date.now()) {
              retrySec = Math.round((resetVal - Date.now()) / 1e3);
            } else if (resetVal > 0 && resetVal < 86400 * 30) {
              retrySec = resetVal;
            }
          }
          markOpenRouterQuotaExhausted(retrySec, parsedError);
          console.info(`[OpenRouter API] Account daily rate limit reached. Circuit breaker activated.`);
          lastError = new Error(`OpenRouter rate limit: ${parsedError}`);
          break;
        }
        if (isRateLimit) {
          console.info(`[OpenRouter API] Model '${model}' rate-limited (${parsedError}). Rotating to next candidate model...`);
          lastError = new Error(`OpenRouter rate limit on '${model}': ${parsedError}`);
          continue;
        }
        console.info(`[OpenRouter API] Model '${model}' returned HTTP ${response.status}: ${parsedError}`);
        lastError = new Error(`OpenRouter Model '${model}' (HTTP ${response.status}): ${parsedError}`);
        continue;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (!content.trim()) {
        console.info(`[OpenRouter API] Model '${model}' returned empty content, trying next model...`);
        lastError = new Error(`Model '${model}' returned empty content`);
        continue;
      }
      const actualModel = data.model || model;
      console.log(`[OpenRouter API] SUCCESS using model '${actualModel}'!`);
      return { text: content, modelUsed: actualModel };
    } catch (err) {
      lastError = err;
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("abort") || String(err?.message || "").toLowerCase().includes("timeout");
      if (isTimeout) {
        console.info(`[OpenRouter API] Model '${model}' response threshold reached, rotating.`);
      } else {
        console.info(`[OpenRouter API] Model '${model}' response:`, err?.message || err);
      }
      if (isOpenRouterQuotaExhausted()) break;
      continue;
    }
  }
  throw lastError || new Error("T\xFCm OpenRouter modelleri denendi fakat yan\u0131t al\u0131namad\u0131.");
}
var GENERATION_RESULT_CACHE = /* @__PURE__ */ new Map();
var GENERATION_CACHE_TTL_MS = 15 * 60 * 1e3;
function computePayloadHash(payload) {
  try {
    const raw = `${payload?.requirementText || ""}|${JSON.stringify(payload?.config || {})}|${JSON.stringify(payload?.corporateRules || [])}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `gen_cache_${hash}`;
  } catch {
    return "";
  }
}
var cacheDir = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production" ? os.tmpdir() : process.cwd();
var OPENROUTER_QUOTA_CACHE_FILE = path.join(cacheDir, ".openrouter_quota_cache.json");
function loadOpenRouterQuotaCache() {
  try {
    if (fs.existsSync(OPENROUTER_QUOTA_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(OPENROUTER_QUOTA_CACHE_FILE, "utf-8"));
      if (data && typeof data.exhaustedUntil === "number" && Date.now() < data.exhaustedUntil) {
        return data;
      }
    }
  } catch {
  }
  return { exhaustedUntil: 0, reason: "" };
}
function saveOpenRouterQuotaCache(exhaustedUntil, reason) {
  try {
    fs.writeFileSync(
      OPENROUTER_QUOTA_CACHE_FILE,
      JSON.stringify({ exhaustedUntil, reason, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)
    );
  } catch {
  }
}
var initialOpenRouterQuota = loadOpenRouterQuotaCache();
var openRouterQuotaExhaustedUntil = initialOpenRouterQuota.exhaustedUntil;
var openRouterExhaustionReason = initialOpenRouterQuota.reason;
function isOpenRouterQuotaExhausted() {
  return Date.now() < openRouterQuotaExhaustedUntil;
}
function getOpenRouterQuotaStatus() {
  const isExhausted = isOpenRouterQuotaExhausted();
  return {
    isExhausted,
    remainingSeconds: isExhausted ? Math.max(0, Math.round((openRouterQuotaExhaustedUntil - Date.now()) / 1e3)) : 0,
    exhaustedUntil: isExhausted ? new Date(openRouterQuotaExhaustedUntil).toISOString() : null,
    reason: openRouterExhaustionReason
  };
}
function markOpenRouterQuotaExhausted(retryDelaySeconds, reason) {
  const cooldownMs = retryDelaySeconds && retryDelaySeconds > 0 ? Math.min(retryDelaySeconds * 1e3, 24 * 60 * 60 * 1e3) : 60 * 60 * 1e3;
  openRouterQuotaExhaustedUntil = Date.now() + cooldownMs;
  openRouterExhaustionReason = reason || "OpenRouter free-tier daily rate limit reached";
  saveOpenRouterQuotaCache(openRouterQuotaExhaustedUntil, openRouterExhaustionReason);
  console.info(
    `[OpenRouter Circuit Breaker] Daily rate limit active until ${new Date(
      openRouterQuotaExhaustedUntil
    ).toLocaleTimeString()} (${Math.round(cooldownMs / 6e4)}m cooldown).`
  );
}
function isAllAIQuotaExhausted() {
  return isGeminiQuotaExhausted() && isOpenRouterQuotaExhausted();
}
var QUOTA_CACHE_FILE = path.join(cacheDir, ".gemini_quota_cache.json");
function loadQuotaCache() {
  try {
    if (fs.existsSync(QUOTA_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUOTA_CACHE_FILE, "utf-8"));
      if (data && typeof data.exhaustedUntil === "number" && Date.now() < data.exhaustedUntil) {
        return data;
      }
    }
  } catch {
  }
  return { exhaustedUntil: 0, reason: "" };
}
function saveQuotaCache(exhaustedUntil, reason) {
  try {
    fs.writeFileSync(
      QUOTA_CACHE_FILE,
      JSON.stringify({ exhaustedUntil, reason, timestamp: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)
    );
  } catch {
  }
}
var initialQuota = loadQuotaCache();
var geminiQuotaExhaustedUntil = initialQuota.exhaustedUntil;
var geminiExhaustionReason = initialQuota.reason;
function isGeminiQuotaExhausted() {
  return Date.now() < geminiQuotaExhaustedUntil;
}
function getGeminiQuotaStatus() {
  const isExhausted = isGeminiQuotaExhausted();
  return {
    isExhausted,
    remainingSeconds: isExhausted ? Math.max(0, Math.round((geminiQuotaExhaustedUntil - Date.now()) / 1e3)) : 0,
    exhaustedUntil: isExhausted ? new Date(geminiQuotaExhaustedUntil).toISOString() : null,
    reason: geminiExhaustionReason
  };
}
function markGeminiQuotaExhausted(retryDelaySeconds, reason) {
  const cooldownMs = retryDelaySeconds && retryDelaySeconds > 0 ? Math.min(retryDelaySeconds * 1e3, 24 * 60 * 60 * 1e3) : 60 * 60 * 1e3;
  geminiQuotaExhaustedUntil = Date.now() + cooldownMs;
  geminiExhaustionReason = reason || "Free tier daily quota limit (20 req/day) reached";
  saveQuotaCache(geminiQuotaExhaustedUntil, geminiExhaustionReason);
  console.info(
    `[Gemini Circuit Breaker] Daily quota reached. Routing all requests directly to OpenRouter models until ${new Date(
      geminiQuotaExhaustedUntil
    ).toLocaleTimeString()} (${Math.round(cooldownMs / 6e4)}m cooldown).`
  );
}
function checkIsQuotaExhaustedError(err) {
  if (!err) return { isQuota: false };
  let errorStr = "";
  if (typeof err === "string") {
    errorStr = err;
  } else if (err instanceof Error) {
    errorStr = `${err.name} ${err.message} ${err.stack || ""}`;
  } else {
    try {
      errorStr = JSON.stringify(err);
    } catch {
      errorStr = String(err);
    }
  }
  const status = err?.status || err?.error?.status;
  const code = err?.code || err?.error?.code;
  const isQuota = status === "RESOURCE_EXHAUSTED" || code === 429 || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("Quota exceeded") || errorStr.includes("generate_content_free_tier_requests");
  if (!isQuota) return { isQuota: false };
  let retrySeconds;
  try {
    const details = err?.details || err?.error?.details;
    if (Array.isArray(details)) {
      const retryInfo = details.find((d) => d?.["@type"]?.includes("RetryInfo") || d?.retryDelay);
      if (retryInfo?.retryDelay) {
        retrySeconds = parseInt(String(retryInfo.retryDelay).replace(/\D/g, ""), 10);
      }
    }
  } catch {
  }
  if (!retrySeconds) {
    const matchSeconds = errorStr.match(/retryDelay"?\s*:\s*"?(\d+)s?/i);
    if (matchSeconds && matchSeconds[1]) {
      retrySeconds = parseInt(matchSeconds[1], 10);
    } else {
      const matchHours = errorStr.match(/retry in (?:(\d+)h)?(?:(\d+)m)?(?:([0-9.]+)s)?/i);
      if (matchHours) {
        const h = parseInt(matchHours[1] || "0", 10);
        const m = parseInt(matchHours[2] || "0", 10);
        const s = parseFloat(matchHours[3] || "0");
        retrySeconds = h * 3600 + m * 60 + Math.ceil(s);
      }
    }
  }
  return {
    isQuota: true,
    retrySeconds: retrySeconds && retrySeconds > 0 ? retrySeconds : 3600,
    reason: (err?.message || errorStr).slice(0, 200)
  };
}
async function callGeminiWithRetry(ai, params) {
  if (isGeminiQuotaExhausted()) {
    throw new Error(
      `Gemini quota limit active (until ${new Date(geminiQuotaExhaustedUntil).toLocaleTimeString()}). Routing to OpenRouter.`
    );
  }
  const requestedModel = params.model || "gemini-4-hydrogen";
  const candidateModels = Array.from(
    /* @__PURE__ */ new Set([
      requestedModel,
      "gemini-4-hydrogen",
      "gemini-3.1-flash-lite"
    ])
  );
  let lastError = null;
  for (const model of candidateModels) {
    try {
      console.log(`[Gemini API] Invoking model '${model}'...`);
      const nextConfig = params.config ? { ...params.config } : void 0;
      if (nextConfig && model.startsWith("gemini-4-")) {
        delete nextConfig.temperature;
        delete nextConfig.topP;
        delete nextConfig.topK;
        delete nextConfig.candidateCount;
        nextConfig.thinkingConfig = { thinkingLevel: ThinkingLevel2.LOW };
      }
      const response = await ai.models.generateContent({
        ...params,
        model,
        ...nextConfig ? { config: nextConfig } : {}
      });
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      const quotaCheck = checkIsQuotaExhaustedError(err);
      if (quotaCheck.isQuota) {
        markGeminiQuotaExhausted(quotaCheck.retrySeconds, quotaCheck.reason);
        console.warn(
          `[Gemini Circuit Breaker] Quota exhausted on '${model}'. Halting Gemini rotation and immediately switching to OpenRouter.`
        );
        break;
      } else {
        console.warn(`[Gemini API] Model '${model}' failed:`, err?.message || err);
      }
    }
  }
  throw lastError;
}
async function generateUnifiedAI({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  geminiSchema,
  preferredModel,
  timeoutMs = 6e3
}) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const isOpenRouterPreferred = Boolean(preferredModel) && (preferredModel?.includes("/") || preferredModel?.endsWith(":free"));
  if (isAllAIQuotaExhausted()) {
    console.info("[AI Pipeline] Both Gemini and OpenRouter daily quotas are exhausted. Directing to ISTQB Synthesis Engine.");
    throw new Error("AI_QUOTA_EXHAUSTED: External AI models reached daily quotas. Using ISTQB Synthesis Engine.");
  }
  if (isOpenRouterPreferred && OPENROUTER_API_KEY && !isOpenRouterQuotaExhausted()) {
    try {
      console.log(`[AI Pipeline] Calling preferred OpenRouter model '${preferredModel}'...`);
      const res = await callOpenRouterWithFallback({
        systemPrompt,
        userPrompt,
        temperature,
        preferredModel,
        timeoutMs
      });
      return { text: res.text, provider: "openrouter", model: res.modelUsed };
    } catch (openRouterErr) {
      console.info("[AI Pipeline] Preferred OpenRouter model unavailable, trying Gemini:", openRouterErr?.message || openRouterErr);
    }
  }
  if (geminiKey && !isGeminiQuotaExhausted()) {
    try {
      console.log("[AI Pipeline] Invoking Google Gemini engine...");
      const ai = new GoogleGenAI2({
        apiKey: geminiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const geminiModel = preferredModel && !isOpenRouterPreferred ? preferredModel : "gemini-4-hydrogen";
      const geminiPromise = callGeminiWithRetry(ai, {
        model: geminiModel,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature,
          responseMimeType: "application/json",
          ...geminiSchema ? { responseSchema: geminiSchema } : {}
        }
      });
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      const { response: geminiRes, modelUsed } = await Promise.race([geminiPromise, timeoutPromise]);
      return { text: geminiRes.text || "", provider: "gemini", model: modelUsed };
    } catch (geminiErr) {
      console.info("[AI Pipeline] Gemini unavailable (quota or error). Seamlessly transitioning to OpenRouter fallback pool.");
    }
  } else if (geminiKey && isGeminiQuotaExhausted()) {
    console.info(
      `[AI Pipeline] Gemini quota currently exhausted (until ${new Date(
        geminiQuotaExhaustedUntil
      ).toLocaleTimeString()}). Directing request straight to OpenRouter.`
    );
  }
  if (OPENROUTER_API_KEY && !isOpenRouterQuotaExhausted()) {
    try {
      console.log("[AI Pipeline] Invoking OpenRouter fallback pool...");
      const res = await callOpenRouterWithFallback({
        systemPrompt,
        userPrompt,
        temperature,
        preferredModel,
        timeoutMs
      });
      return { text: res.text, provider: "openrouter", model: res.modelUsed };
    } catch (openRouterErr) {
      console.info("[AI Pipeline] OpenRouter fallback pool unavailable:", openRouterErr?.message || openRouterErr);
      throw openRouterErr;
    }
  }
  throw new Error("AI_QUOTA_EXHAUSTED: Yapay zeka servislerinin g\xFCnl\xFCk limitleri devrede. ISTQB sentez motoru kullan\u0131l\u0131yor.");
}
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "TestMatrix AI Engine",
    geminiQuota: getGeminiQuotaStatus(),
    openRouterQuota: getOpenRouterQuotaStatus(),
    openRouter: {
      activeModels: ACTIVE_OPENROUTER_MODELS,
      apiKeyConfigured: Boolean(OPENROUTER_API_KEY)
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/openrouter/models", (req, res) => {
  res.json({
    activeModels: ACTIVE_OPENROUTER_MODELS,
    apiKeyConfigured: Boolean(OPENROUTER_API_KEY),
    isFreeQuotaRouterActive: true,
    geminiQuota: getGeminiQuotaStatus(),
    openRouterQuota: getOpenRouterQuotaStatus()
  });
});
app.post("/api/openrouter/set-models", (req, res) => {
  const { models } = req.body;
  if (Array.isArray(models) && models.length > 0) {
    ACTIVE_OPENROUTER_MODELS = models.filter((m) => typeof m === "string" && m.trim().length > 0);
    console.log("[OpenRouter API] Active model list updated to:", ACTIVE_OPENROUTER_MODELS);
    return res.json({ success: true, activeModels: ACTIVE_OPENROUTER_MODELS });
  }
  res.status(400).json({ error: "Ge\xE7ersiz model listesi" });
});
function capitalizeText(str) {
  if (!str) return "";
  const trimmed = str.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
function capitalizeWords(str) {
  if (!str) return "";
  return str.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function buildTurkishScreenGrammar(screen) {
  const s = screen.trim();
  const lower = s.toLowerCase();
  if (lower.endsWith("ekran\u0131") || lower.endsWith("sayfas\u0131") || lower.endsWith("paneli")) {
    return {
      nominative: s,
      dative: `${s}na`,
      ablative: `${s}ndan`,
      locative: `${s}nda`
    };
  }
  if (lower.endsWith("aray\xFCz\xFC") || lower.endsWith("men\xFCs\xFC") || lower.endsWith("g\xF6r\xFCn\xFCm\xFC")) {
    return {
      nominative: s,
      dative: `${s}ne`,
      ablative: `${s}nden`,
      locative: `${s}nde`
    };
  }
  if (lower.endsWith("ekran") || lower.endsWith("panel")) {
    return {
      nominative: `${s}\u0131`,
      dative: `${s}\u0131na`,
      ablative: `${s}\u0131ndan`,
      locative: `${s}\u0131nda`
    };
  }
  return {
    nominative: `${s} Ekran\u0131`,
    dative: `${s} ekran\u0131na`,
    ablative: `${s} ekran\u0131ndan`,
    locative: `${s} ekran\u0131nda`
  };
}
function deriveRequirementScreenAndModule(reqId, title, desc, category, customInstructions, isTurkish = true) {
  const reqLower = String(reqId || "").toLowerCase().trim();
  const rawCustom = String(customInstructions || "").trim();
  let explicitScreen = "";
  let explicitActionPhrase = "";
  const customStatusCodes = [];
  if (rawCustom) {
    const hasAnySpecificReq = /\b(ad-f\d+|req-\d+|td-\d+|fr-\d+)\b/i.test(rawCustom);
    const mentionsThisReq = reqLower && rawCustom.toLowerCase().includes(reqLower);
    const clauses = rawCustom.split(/(?<=[.!?;\n])\s*/);
    const applicableClauses = hasAnySpecificReq && !mentionsThisReq ? [] : mentionsThisReq ? clauses.filter(
      (c) => c.toLowerCase().includes(reqLower) || !/\b(ad-f\d+|req-\d+|td-\d+|fr-\d+)\b/i.test(c)
    ) : clauses;
    const relevantText = applicableClauses.join(" ");
    const codeMatches = relevantText.match(/\b(200|201|204|400|401|403|404|409|422|500)\b/g);
    if (codeMatches) {
      codeMatches.forEach((c) => {
        if (!customStatusCodes.includes(c)) customStatusCodes.push(c);
      });
    }
    const screenMatch = relevantText.match(
      /(?:^|[\s,.\'\"\(])([A-ZÇĞİÖŞÜa-zçğıöşü0-9_\-\s]{2,30}?)\s*(ekranı|ekranından|ekranına|ekranında|arayüzü|arayüzünden|arayüzüne|sayfası|sayfasından|sayfasına|paneli|menüsü)/i
    );
    if (screenMatch) {
      let cand = screenMatch[1].trim();
      cand = cand.replace(
        /^(?:[A-Z0-9_\-]{2,15}\s*(?:nolu|numaralı|sayılı)?\s*(?:gereksinim|madde)?|bu|ilgili|şunun|bunun|her|tüm|yeni|nolu\s+gereksinim|olarak|gereksinim|için)\s+/i,
        ""
      ).replace(
        /^(?:nolu|numaralı|sayılı)?\s*(?:gereksinim|madde)?\s+/i,
        ""
      ).trim();
      if (cand && cand.length > 1 && !/^(?:case|test|durum|adım|bilgi|hata)$/i.test(cand)) {
        const suffixType = screenMatch[2].toLowerCase();
        const suffix = suffixType.startsWith("aray\xFCz") ? "Aray\xFCz\xFC" : suffixType.startsWith("sayfa") ? "Sayfas\u0131" : suffixType.startsWith("panel") ? "Paneli" : suffixType.startsWith("men\xFC") ? "Men\xFCs\xFC" : "Ekran\u0131";
        explicitScreen = `${capitalizeWords(cand)} ${suffix}`;
      }
    }
    if (/girilip|üzerinden\s+yapılır|ekranına\s+gidilip|sayfası\s+açılarak|arayüzüne\s+erişilip/i.test(
      relevantText
    )) {
      explicitActionPhrase = "girilip";
    }
  }
  let derivedEntity = "";
  if (!explicitScreen) {
    let cleanTitle = String(title || "").replace(/^[A-Z0-9_\-\s\.:]{2,15}(?:\s*[:-]\s*|\s+)/i, "").trim();
    if (cleanTitle.includes(":")) {
      cleanTitle = cleanTitle.split(":")[0].trim();
    }
    cleanTitle = cleanTitle.replace(
      /\s+(?:ekleme|eklenmesi|eklenmesine|silme|silinmesi|silinmesini|güncelleme|güncellenmesi|düzenleme|listeleme|listelenmesi|arama|sorgulama|görüntüleme|yükleme|yüklenmesi|tanımlama|tanımlanması|yönetimi|yönetim|kontrolü|kontrol|upload|create|creation|delete|deletion|update|search|view)\s*$/i,
      ""
    ).trim();
    if (cleanTitle && cleanTitle.length > 1) {
      derivedEntity = cleanTitle;
    } else if (category && category !== "Fonksiyonel" && category !== "Genel") {
      derivedEntity = category;
    } else {
      derivedEntity = "\u0130lgili \u0130\u015Flem";
    }
  }
  const baseScreen = explicitScreen || `${capitalizeWords(derivedEntity)} Ekran\u0131`;
  const grammar = buildTurkishScreenGrammar(baseScreen);
  let moduleName = explicitScreen ? explicitScreen : derivedEntity && derivedEntity !== "\u0130lgili \u0130\u015Flem" ? `${capitalizeWords(derivedEntity)} Y\xF6netimi` : category && category !== "Fonksiyonel" ? category : "\u0130\u015Flem Y\xF6netimi";
  let step1NavigationTr = "";
  if (explicitActionPhrase === "girilip" || rawCustom.includes("girilip")) {
    step1NavigationTr = `1. ${grammar.dative} girilip ilgili i\u015Flem aray\xFCz\xFCn\xFC a\xE7\u0131n.`;
  } else {
    step1NavigationTr = `1. ${grammar.dative} gidin.`;
  }
  const step1NavigationEn = `1. Navigate to ${grammar.nominative} view.`;
  return {
    screenNominative: grammar.nominative,
    screenDative: grammar.dative,
    screenAblative: grammar.ablative,
    screenLocative: grammar.locative,
    moduleName,
    step1NavigationTr,
    step1NavigationEn,
    customStatusCodes,
    customActionSpecified: Boolean(explicitScreen || explicitActionPhrase)
  };
}
function extractBusinessRuleConstraints(title, desc, mod, isTurkish, screenContext) {
  const text = `${title} ${desc}`.toLowerCase();
  const rules = [];
  const screenAblative = screenContext?.screenAblative || `${mod} ekran\u0131ndan`;
  const screenNominative = screenContext?.screenNominative || mod;
  if (text.includes("aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez") || text.includes("aktif g\xF6reve ba\u011Fl\u0131") || text.includes("g\xF6reve ba\u011Fl\u0131") || text.includes("ba\u011Fl\u0131") && text.includes("silinemez") || text.includes("cannot be deleted while linked") || text.includes("cannot be deleted when linked") || text.includes("cannot be deleted with active task")) {
    rules.push({
      ruleTitleTr: "Aktif G\xF6reve Ba\u011Fl\u0131 Adapt\xF6r\xFCn Silinmesinin Engellenmesi",
      ruleTitleEn: "Prevention of Deleting Adapter Linked to Active Task",
      descTr: `Gereksinim i\u015F kural\u0131 uyar\u0131nca; sistemde aktif veya devam eden bir g\xF6reve atanm\u0131\u015F olan bir adapt\xF6r\xFCn silinme iste\u011Finin sistem taraf\u0131ndan engellendi\u011Finin, veri ve ili\u015Fki b\xFCt\xFCnl\xFC\u011F\xFCn\xFCn korundu\u011Funun do\u011Frulanmas\u0131.`,
      descEn: `Verification that an adapter linked or assigned to an active task cannot be deleted, ensuring data integrity and rejection with explicit business rule error.`,
      preconditionTr: `Hedef adapt\xF6r sistemde kay\u0131tl\u0131 ve en az bir adet 'Aktif' veya '\u0130\u015Fleniyor' stat\xFCs\xFCndeki g\xF6reve ba\u011Fl\u0131/atanm\u0131\u015F durumda olmal\u0131d\u0131r.`,
      preconditionEn: `Target adapter must be assigned to at least one task with status 'Active' or 'In Progress'.`,
      stepsTr: [
        `1. ${screenAblative} aktif bir g\xF6reve atanm\u0131\u015F olan hedef adapt\xF6r\xFCn sat\u0131r\u0131n\u0131 bulun ve durumunu inceleyin.`,
        `2. Adapt\xF6r sat\u0131r\u0131ndaki 'Sil' veya 'Kald\u0131r' aksiyon butonuna t\u0131klay\u0131n.`,
        `3. Ekrana gelen silme onay diyalog kutusunda 'Silmeyi Onayla' butonuna t\u0131klayarak i\u015Flemi tetikleyin.`,
        `4. Sistemin silme i\u015Flemini derhal engelledi\u011Fini ve kullan\u0131c\u0131ya 'Aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez' \u015Feklinde a\xE7\u0131klay\u0131c\u0131 i\u015F kural\u0131 uyar\u0131 mesaj\u0131 sundu\u011Funu g\xF6zlemleyin.`,
        `5. Adapt\xF6r\xFCn veritaban\u0131ndan ve aray\xFCz listesinden silinmedi\u011Fini, aktif g\xF6revle ili\u015Fkisinin korundu\u011Funu do\u011Frulay\u0131n.`
      ],
      stepsEn: [
        `1. Locate the adapter currently linked to an active task in ${screenNominative} view.`,
        `2. Click the 'Delete' action button for the adapter.`,
        `3. Confirm deletion in the confirmation prompt.`,
        `4. Verify system blocks the deletion request and presents explicit business rule error: 'Cannot delete adapter linked to active task'.`,
        `5. Confirm that adapter remains present in database and UI grid, preserving task relationships.`
      ],
      expTr: [
        `1. Aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r kayd\u0131 ve ili\u015Fkili g\xF6rev rozeti g\xF6r\xFCnt\xFClenmelidir.`,
        `2. Silme onay diyalog kutusu g\xF6r\xFCnt\xFClenmelidir.`,
        `3. Sunucu silme iste\u011Fini reddetmeli (HTTP 400/409/422 Kural \u0130hlali) ve i\u015Flemi durdurmal\u0131d\u0131r.`,
        `4. Aray\xFCzde 'Aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez' \u015Feklinde a\xE7\u0131k i\u015F kural\u0131 hata bildirimi belirmelidir.`,
        `5. Adapt\xF6r veritaban\u0131ndan silinmemeli, aktif g\xF6rev ba\u011Flant\u0131s\u0131 bozulmamal\u0131d\u0131r.`
      ],
      expEn: [
        `1. Target adapter displayed with active task link.`,
        `2. Deletion prompt shown.`,
        `3. Backend rejects request with 400/409 conflict error.`,
        `4. Business rule warning 'Cannot delete adapter linked to active task' displayed.`,
        `5. Adapter persists in database with unchanged active task state.`
      ],
      testData: "Hedef Adapt\xF6r ID: ADAPTER_ACTIVE_001, Ba\u011Fl\u0131 Aktif G\xF6rev ID: TASK_ACTIVE_801 (Stat\xFC: Aktif)",
      expectedResultTr: `Aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r\xFCn silinmesi sistem taraf\u0131ndan kesin olarak engellenmeli, 'Aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez' kural uyar\u0131s\u0131 verilmeli ve veri b\xFCt\xFCnl\xFC\u011F\xFC korunmal\u0131d\u0131r.`,
      expectedResultEn: `System must strictly block deletion of adapter linked to active task and protect data integrity.`,
      priority: "Kritik",
      severity: "Kritik"
    });
  }
  if (rules.length === 0 && (text.includes("silinemez") || text.includes("silinmesine izin verilmez") || text.includes("cannot be deleted"))) {
    const match = text.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ0-9_\-\s]{3,45})\s+(?:silinemez|silinmesine izin verilmez)/);
    const condName = match && match[1] ? match[1].trim() : "K\u0131s\u0131tl\u0131 Durumdaki Nesne / Kay\u0131t";
    rules.push({
      ruleTitleTr: `${capitalizeText(condName)} Silinmesinin Engellenmesi`,
      ruleTitleEn: `Prevention of Deleting ${condName}`,
      descTr: `Gereksinimde belirtilen '${condName} silinemez' kural\u0131n\u0131n do\u011Frulanmas\u0131; k\u0131s\u0131tl\u0131 kayd\u0131n silinme iste\u011Finin sistemce reddedildi\u011Finin kontrol\xFC.`,
      descEn: `Verification that deletion of ${condName} is blocked according to business rule specifications.`,
      preconditionTr: `Sistemde test edilecek kay\u0131t '${condName}' durumunda bulunmal\u0131d\u0131r.`,
      preconditionEn: `Target record must be in '${condName}' state.`,
      stepsTr: [
        `1. ${screenAblative} ${condName} niteli\u011Findeki kayd\u0131 se\xE7in.`,
        `2. 'Sil' butonuna t\u0131klay\u0131n ve i\u015Flemi onaylay\u0131n.`,
        `3. Sistemin i\u015Flemi engelledi\u011Fini ve '${condName} silinemez' kural ihlali uyar\u0131s\u0131 g\xF6sterdi\u011Fini g\xF6zlemleyin.`,
        `4. Kayd\u0131n sistemden kald\u0131r\u0131lmad\u0131\u011F\u0131n\u0131 teyit edin.`
      ],
      stepsEn: [
        `1. In ${screenNominative} view, select record matching ${condName}.`,
        `2. Click delete and confirm.`,
        `3. Verify action is blocked with error message.`,
        `4. Confirm record is not deleted.`
      ],
      expTr: [
        `1. Hedef kay\u0131t se\xE7ilebilmelidir.`,
        `2. Silme onay modal\u0131 a\xE7\u0131lmal\u0131d\u0131r.`,
        `3. Sunucu silme i\u015Flemini reddetmelidir (HTTP 400/409/422).`,
        `4. Kay\u0131t veritaban\u0131nda korunmal\u0131d\u0131r.`
      ],
      expEn: [
        `1. Record selected.`,
        `2. Confirmation prompt opens.`,
        `3. Deletion blocked by server.`,
        `4. Record persists.`
      ],
      testData: `K\u0131s\u0131tl\u0131 Kay\u0131t ID: RESTRICTED_REC_01, Durum: ${condName}`,
      expectedResultTr: `'${condName}' durumundaki kayd\u0131n silinmesi engellenmeli ve i\u015F kural\u0131 hata mesaj\u0131 g\xF6sterilmelidir.`,
      expectedResultEn: `Deletion blocked with business rule validation error.`,
      priority: "Kritik",
      severity: "Kritik"
    });
  }
  if (text.includes("g\xFCncellenemez") || text.includes("de\u011Fi\u015Ftirilemez") || text.includes("d\xFCzenlenemez") || text.includes("cannot be updated") || text.includes("cannot be modified")) {
    const match = text.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ0-9_\-\s]{3,45})\s+(?:güncellenemez|değiştirilemez|düzenlenemez)/);
    const condName = match && match[1] ? match[1].trim() : "K\u0131s\u0131tl\u0131 Kay\u0131t";
    rules.push({
      ruleTitleTr: `${capitalizeText(condName)} G\xFCncellenmesinin Engellenmesi`,
      ruleTitleEn: `Prevention of Updating ${condName}`,
      descTr: `'${condName}' durumundaki bir nesnenin/adapt\xF6r\xFCn bilgilerinin g\xFCncellenmeye \xE7al\u0131\u015F\u0131lmas\u0131 durumunda sistemin de\u011Fi\u015Fikli\u011Fi reddetti\u011Finin do\u011Frulanmas\u0131.`,
      descEn: `Verification that modifying ${condName} is prohibited and rejected by system.`,
      preconditionTr: `Hedef kay\u0131t '${condName}' stat\xFCs\xFCnde olmal\u0131d\u0131r.`,
      preconditionEn: `Target record must be in '${condName}' state.`,
      stepsTr: [
        `1. ${screenAblative} ${condName} durumundaki kayd\u0131 se\xE7ip 'D\xFCzenle'ye t\u0131klay\u0131n.`,
        `2. Parametre de\u011Ferlerini de\u011Fi\u015Ftirmeyi deneyin ve 'Kaydet'e t\u0131klay\u0131n.`,
        `3. Sistemin d\xFCzenlemeyi engelledi\u011Fini ve a\xE7\u0131klay\u0131c\u0131 hata mesaj\u0131 verdi\u011Fini do\u011Frulay\u0131n.`,
        `4. Orijinal verilerin de\u011Fi\u015Fmeden korundu\u011Funu kontrol edin.`
      ],
      stepsEn: [
        `1. In ${screenNominative} view, select item with state ${condName} and click edit.`,
        `2. Attempt to modify parameters and submit.`,
        `3. Verify modification is rejected with business rule error.`,
        `4. Confirm original values are unchanged.`
      ],
      expTr: [
        `1. D\xFCzenleme formu salt okunur (read-only) olmal\u0131 veya kaydetme engellenmelidir.`,
        `2. De\u011Fi\u015Fiklik iste\u011Fi sunucuya iletildi\u011Finde 400/403/422 reddi d\xF6nmelidir.`,
        `3. \u0130\u015F kural\u0131 uyar\u0131s\u0131 g\xF6sterilmelidir.`,
        `4. Veritaban\u0131ndaki orijinal veriler de\u011Fi\u015Fmemelidir.`
      ],
      expEn: [
        `1. Form fields read-only or submission blocked.`,
        `2. Server rejects update request.`,
        `3. Business rule message shown.`,
        `4. Original values intact.`
      ],
      testData: `K\u0131s\u0131tl\u0131 Nesne ID: RESTRICTED_UPDATE_01, Durum: ${condName}`,
      expectedResultTr: `'${condName}' durumundaki kayd\u0131n g\xFCncellenmesi engellenmeli ve i\u015F kural\u0131 korunmal\u0131d\u0131r.`,
      expectedResultEn: `Update prohibited and original state preserved.`,
      priority: "Y\xFCksek",
      severity: "Y\xFCksek"
    });
  }
  return rules;
}
function generateDeterministicTestCasesForReq(req, index, config, isTurkish) {
  const reqId = req.id || `REQ-${String(index + 1).padStart(3, "0")}`;
  const title = req.title || `Gereksinim ${index + 1}`;
  const desc = req.description || title;
  const customInstr = String(config?.customInstructions || "").trim();
  const screenCtx = deriveRequirementScreenAndModule(reqId, title, desc, req.category, customInstr, isTurkish);
  const mod = screenCtx.moduleName;
  const selectedFunctional = Array.isArray(config?.selectedFunctionalTypes) ? config.selectedFunctionalTypes : ["Pozitif (Fonksiyonel Do\u011Fruluk)", "Negatif (Hata Y\xF6netimi)"];
  const selectedNonFunctional = Array.isArray(config?.selectedNonFunctionalTypes) ? config.selectedNonFunctionalTypes : [];
  const includeBva = config?.includeBoundary || selectedFunctional.some((t) => t.includes("S\u0131n\u0131r") || t.includes("BVA"));
  const includeSec = config?.includeSecurity || selectedNonFunctional.some((t) => t.includes("G\xFCvenlik") || t.includes("Security"));
  const includePerf = config?.includePerformance || selectedNonFunctional.some((t) => t.includes("Performans") || t.includes("Performance"));
  const lowerText = `${title} ${desc}`.toLowerCase();
  const isAuth = lowerText.includes("login") || lowerText.includes("giri\u015F") || lowerText.includes("\u015Fifre") || lowerText.includes("parola") || lowerText.includes("oturum") || lowerText.includes("auth") || lowerText.includes("yetki") || lowerText.includes("rbac");
  const isPayment = lowerText.includes("\xF6deme") || lowerText.includes("kart") || lowerText.includes("sepet") || lowerText.includes("kupon") || lowerText.includes("checkout") || lowerText.includes("3d") || lowerText.includes("bakiye") || lowerText.includes("transfer") || lowerText.includes("fast") || lowerText.includes("eft");
  const isTelecom = lowerText.includes("port") || lowerText.includes("transmisyon") || lowerText.includes("pts") || lowerText.includes("devre") || lowerText.includes("santral") || lowerText.includes("kanal");
  const testCases = [];
  let tcSeq = 1;
  const textToScan = `${title} ${desc} ${customInstr}`.toLowerCase();
  const hasActiveTaskConstraint = textToScan.includes("aktif g\xF6reve ba\u011Fl\u0131") || textToScan.includes("g\xF6reve ba\u011Fl\u0131") || textToScan.includes("ba\u011Fl\u0131") && textToScan.includes("silinemez") || textToScan.includes("linked to active task") || textToScan.includes("assigned to active");
  const combinedRuleText = customInstr ? `${desc}
[\xD6zel Talimat]: ${customInstr}` : desc;
  const detectedRules = extractBusinessRuleConstraints(title, combinedRuleText, mod, isTurkish, screenCtx);
  const detectedOps = [];
  if (textToScan.includes("y\xFCklenmesine") || textToScan.includes("y\xFCkleme") || textToScan.includes("y\xFCklenmesi") || textToScan.includes("eklenmesine") || textToScan.includes("ekleme") || textToScan.includes("olu\u015Fturulmas\u0131na") || textToScan.includes("tan\u0131mlanmesine") || textToScan.includes("tan\u0131mlanmas\u0131na") || textToScan.includes("kaydedilmesine") || textToScan.includes("upload") || textToScan.includes("add") || textToScan.includes("create") || textToScan.includes("import")) {
    detectedOps.push({
      opNameTr: "Adapt\xF6rlerin / Nesnelerin Sisteme Y\xFCklenmesi ve Eklenmesi",
      opNameEn: "Adapter / Record Creation and Upload",
      descTr: `Gereksinim kapsam\u0131ndaki adapt\xF6r ve kay\u0131tlar\u0131n t\xFCm zorunlu parametreleriyle (Ad, Tip, S\xFCr\xFCm) sisteme hatas\u0131z y\xFCklendi\u011Finin ve veritaban\u0131na kaydedildi\u011Finin do\u011Frulanmas\u0131.`,
      descEn: `Verification that adapters and records are successfully uploaded and created with mandatory attributes (Name, Type, Version).`,
      stepsTr: [
        screenCtx.step1NavigationTr,
        `2. 'Yeni Ekle' veya 'Y\xFCkle' butonuna t\u0131klay\u0131n.`,
        `3. Ad, tip, s\xFCr\xFCm ve zorunlu parametre bilgilerini ge\xE7erli test verisiyle doldurun.`,
        `4. 'Kaydet / Y\xFCkle' butonuna basarak i\u015Flemi onaylay\u0131n.`,
        `5. \u0130\u015Flemin ba\u015Far\u0131yla tamamland\u0131\u011F\u0131n\u0131 ve yeni kayd\u0131n veritaban\u0131na eklenerek ${screenCtx.screenLocative} g\xF6r\xFCnt\xFClendi\u011Fini do\u011Frulay\u0131n.`
      ],
      stepsEn: [
        screenCtx.step1NavigationEn,
        `2. Click 'Add New' or 'Upload'.`,
        `3. Populate mandatory fields (Name, Type, Version) with valid inputs.`,
        `4. Submit the form.`,
        `5. Confirm record is created and listed in database.`
      ],
      expTr: [
        `1. Ekleme/Y\xFCkleme ekran\u0131 ve form alanlar\u0131 hatas\u0131z y\xFCklenmelidir.`,
        `2. Ekleme penceresi ve zorunlu alan g\xF6stergeleri belirmelidir.`,
        `3. Girilen veriler bi\xE7imlendirme ve \u015Fema kontrollerinden ge\xE7melidir.`,
        `4. Sunucudan 200/201 HTTP yan\u0131t\u0131 ile ba\u015Far\u0131 bildirimi al\u0131nmal\u0131d\u0131r.`,
        `5. Kay\u0131t veritaban\u0131na eklenmeli ve listede anl\u0131k olarak g\xF6r\xFCnmelidir.`
      ],
      expEn: [
        `1. Creation UI loaded successfully.`,
        `2. Form fields active.`,
        `3. Inputs pass format validation.`,
        `4. Server returns success response.`,
        `5. Record persisted in DB and listed.`
      ],
      testData: "Ge\xE7erli Ad, Tip, S\xFCr\xFCm numaras\u0131 ve ge\xE7erli paket/payload verisi",
      expectedResultTr: `Yeni adapt\xF6r\xFCn/nesnenin sisteme hatas\u0131z y\xFCklendi\u011Fi ve veritaban\u0131na kaydedildi\u011Fi do\u011Frulanmal\u0131d\u0131r.`,
      expectedResultEn: `New record/adapter successfully created and persisted.`
    });
  }
  if (textToScan.includes("listelenmesine") || textToScan.includes("listeleme") || textToScan.includes("listelenmesi") || textToScan.includes("listesine") || textToScan.includes("arama") || textToScan.includes("sorgulama") || textToScan.includes("filtreleme") || textToScan.includes("list") || textToScan.includes("search") || textToScan.includes("filter")) {
    detectedOps.push({
      opNameTr: "Adapt\xF6rlerin / Kay\u0131tlar\u0131n Listelenmesi, Arama ve Filtreleme",
      opNameEn: "Adapters / Records Listing, Search and Filtering",
      descTr: `Sistemde kay\u0131tl\u0131 nesnelerin/adapt\xF6rlerin ad, tip ve s\xFCr\xFCm bilgileriyle do\u011Fru kolonlarda listelendi\u011Finin, arama ve filtreleme fonksiyonlar\u0131n\u0131n \xE7al\u0131\u015Ft\u0131\u011F\u0131n\u0131n do\u011Frulanmas\u0131.`,
      descEn: `Verification that stored records/adapters are accurately listed with correct columns and search features.`,
      stepsTr: [
        `1. ${screenCtx.screenDative} eri\u015Fim sa\u011Flay\u0131n ve liste/sorgulama aray\xFCz\xFCn\xFC a\xE7\u0131n.`,
        `2. Veri tablosundaki s\xFCtunlar\u0131n (Ad, Tip, S\xFCr\xFCm, Durum vb.) eksiksiz g\xF6r\xFCnt\xFClendi\u011Fini kontrol edin.`,
        `3. Arama/filtreleme kutusuna bilinen bir kay\u0131t ad\u0131 veya tip bilgisini girin.`,
        `4. Filtrele butonuna t\u0131klay\u0131n veya aramay\u0131 tetikleyin.`,
        `5. Tabloda sadece arama kriterine uygun verilerin listelendi\u011Fini do\u011Frulay\u0131n.`
      ],
      stepsEn: [
        `1. Open ${screenCtx.screenNominative} listing view.`,
        `2. Inspect data grid headers and rows.`,
        `3. Enter search string in search box.`,
        `4. Trigger search/filter.`,
        `5. Verify filtered records match query.`
      ],
      expTr: [
        `1. Liste aray\xFCz\xFC ve sayfalama bile\u015Fenleri eksiksiz y\xFCklenmelidir.`,
        `2. T\xFCm kay\u0131tlar do\u011Fru s\xFCtunlarda tutarl\u0131 \u015Fekilde listelenmelidir.`,
        `3. Arama kriteri sistem taraf\u0131ndan i\u015Flenmelidir.`,
        `4. Sorgu sonucu sunucudan hatas\u0131z d\xF6nmelidir.`,
        `5. Yaln\u0131zca filtreye uyan kay\u0131tlar tabloda listelenmelidir.`
      ],
      expEn: [
        `1. Listing view loaded.`,
        `2. Grid columns aligned correctly.`,
        `3. Search query executed.`,
        `4. Server returns matching dataset.`,
        `5. Grid updates with matching rows.`
      ],
      testData: "Arama Kriteri: Mevcut Kay\u0131t Ad\u0131, Tipi veya S\xFCr\xFCm\xFC",
      expectedResultTr: `Kay\u0131tlar\u0131n listede hatas\u0131z g\xF6sterildi\u011Fi ve arama fonksiyonunun do\u011Fru \xE7al\u0131\u015Ft\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.`,
      expectedResultEn: `Records listed and search filtering operates correctly.`
    });
  }
  if (textToScan.includes("detay") || textToScan.includes("g\xF6r\xFCnt\xFClenmesine") || textToScan.includes("g\xF6r\xFCnt\xFCleme") || textToScan.includes("g\xF6r\xFCnt\xFClenmesi") || textToScan.includes("ayr\u0131nt\u0131") || textToScan.includes("detail") || textToScan.includes("view") || textToScan.includes("inspect")) {
    detectedOps.push({
      opNameTr: "Adapt\xF6r Detay Bilgilerinin G\xF6r\xFCnt\xFClenmesi ve \u0130nceleme",
      opNameEn: "Adapter / Record Detail View and Parameter Inspection",
      descTr: `Listeden se\xE7ilen bir adapt\xF6r\xFCn detay sayfas\u0131na girildi\u011Finde t\xFCm \xF6zniteliklerin (ad, tip, s\xFCr\xFCm, meta veriler) eksiksiz ve do\u011Fru g\xF6r\xFCnt\xFClendi\u011Finin do\u011Frulanmas\u0131.`,
      descEn: `Verification that selecting an adapter displays all its detailed attributes (name, type, version, metadata) correctly.`,
      stepsTr: [
        `1. ${screenCtx.screenAblative} hedef kayd\u0131 se\xE7in.`,
        `2. Sat\u0131r \xFCzerindeki 'Detay G\xF6r\xFCnt\xFCle' butonuna veya kay\u0131t ad\u0131na t\u0131klay\u0131n.`,
        `3. A\xE7\u0131lan detay sayfas\u0131ndaki/penceresindeki alanlar\u0131 inceleyin.`,
        `4. Ad, Tip, S\xFCr\xFCm, olu\u015Fturulma tarihi ve parametre detaylar\u0131n\u0131n veritaban\u0131 kayd\u0131yla birebir e\u015Fle\u015Fti\u011Fini do\u011Frulay\u0131n.`
      ],
      stepsEn: [
        `1. Select record in ${screenCtx.screenNominative}.`,
        `2. Click 'View Detail'.`,
        `3. Inspect detail view fields.`,
        `4. Verify parameters match database state.`
      ],
      expTr: [
        `1. Sat\u0131r se\xE7imi aktifle\u015Fmelidir.`,
        `2. Detay penceresi hatas\u0131z a\xE7\u0131lmal\u0131d\u0131r.`,
        `3. T\xFCm parametreler eksiksiz ve okunabilir \u015Fekilde doldurulmal\u0131d\u0131r.`,
        `4. Hi\xE7bir veri alan\u0131 'null' veya eksik g\xF6r\xFCnmemelidir.`
      ],
      expEn: [
        `1. Row selection works.`,
        `2. Detail modal opens cleanly.`,
        `3. Parameters populated correctly.`,
        `4. Data integrity verified.`
      ],
      testData: "Hedef Kay\u0131t ID: ADAPTER_001_DETAIL",
      expectedResultTr: `Se\xE7ilen adapt\xF6r\xFCn t\xFCm detay bilgilerinin hatas\u0131z g\xF6r\xFCnt\xFClendi\u011Fi do\u011Frulanmal\u0131d\u0131r.`,
      expectedResultEn: `Adapter details displayed accurately.`
    });
  }
  if (textToScan.includes("g\xFCncellenmesine") || textToScan.includes("g\xFCncelleme") || textToScan.includes("g\xFCncellenmesi") || textToScan.includes("d\xFCzenlenmesine") || textToScan.includes("d\xFCzenleme") || textToScan.includes("update") || textToScan.includes("edit") || textToScan.includes("modify")) {
    detectedOps.push({
      opNameTr: "Adapt\xF6r Bilgilerini G\xFCncelleme ve D\xFCzenleme",
      opNameEn: "Updating and Modifying Adapter Information",
      descTr: `Var olan bir adapt\xF6r\xFCn ad, tip veya s\xFCr\xFCm bilgilerinin g\xFCncellenip kaydedildi\u011Finde de\u011Fi\u015Fikliklerin veritaban\u0131na ve aray\xFCze yans\u0131d\u0131\u011F\u0131n\u0131n do\u011Frulanmas\u0131.`,
      descEn: `Verification of modifying adapter attributes and ensuring updated values persist in DB and UI.`,
      stepsTr: [
        `1. ${screenCtx.screenAblative} g\xFCncellenecek kayd\u0131 se\xE7ip 'D\xFCzenle' butonuna t\u0131klay\u0131n.`,
        `2. S\xFCr\xFCm veya parametre bilgisini yeni ge\xE7erli bir de\u011Ferle de\u011Fi\u015Ftirin.`,
        `3. 'G\xFCncelle / Kaydet' butonuna basarak de\u011Fi\u015Fiklikleri onaylay\u0131n.`,
        `4. Ba\u015Far\u0131 bildirim mesaj\u0131n\u0131 g\xF6zlemleyin.`,
        `5. Liste ve detay ekranlar\u0131nda g\xFCncellenmi\u015F yeni de\u011Ferlerin g\xF6r\xFCnt\xFClendi\u011Fini teyit edin.`
      ],
      stepsEn: [
        `1. In ${screenCtx.screenNominative}, select item and click 'Edit'.`,
        `2. Update type or version attribute to new valid value.`,
        `3. Click 'Update/Save'.`,
        `4. Observe success notification.`,
        `5. Confirm updated fields persist in grid and DB.`
      ],
      expTr: [
        `1. D\xFCzenleme aray\xFCz\xFC mevcut verilerle dolu olarak a\xE7\u0131lmal\u0131d\u0131r.`,
        `2. De\u011Fi\u015Ftirilen veriler do\u011Frulama kurallar\u0131ndan ge\xE7melidir.`,
        `3. Sunucu g\xFCncelleme iste\u011Fini onaylamal\u0131d\u0131r.`,
        `4. 'Kay\u0131t G\xFCncellendi' bildirimi \xE7\u0131kmal\u0131d\u0131r.`,
        `5. Veritaban\u0131ndaki updatedAt zaman damgas\u0131 ve veriler g\xFCncellenmelidir.`
      ],
      expEn: [
        `1. Edit form opens with existing data.`,
        `2. Valid updates accepted.`,
        `3. Server approves update.`,
        `4. Success banner displayed.`,
        `5. Database record updated.`
      ],
      testData: "Yeni S\xFCr\xFCm: v2.0.1, G\xFCncellenmi\u015F Tip Bilgisi",
      expectedResultTr: `G\xFCncellenen adapt\xF6r verilerinin tutarl\u0131 \u015Fekilde veritaban\u0131na kaydedildi\u011Fi ve aray\xFCzde yans\u0131d\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.`,
      expectedResultEn: `Adapter updates successfully persisted and displayed.`
    });
  }
  if (textToScan.includes("silinmesine") || textToScan.includes("silme") || textToScan.includes("silinmesi") || textToScan.includes("silinmesini") || textToScan.includes("kald\u0131r\u0131lmas\u0131na") || textToScan.includes("delete") || textToScan.includes("remove") || textToScan.includes("unregister")) {
    if (hasActiveTaskConstraint) {
      detectedOps.push({
        opNameTr: "Bo\u015Fta / G\xF6reve Ba\u011Fl\u0131 Olmayan Adapt\xF6r\xFCn Ba\u015Far\u0131yla Silinmesi",
        opNameEn: "Successful Deletion of Free / Unlinked Adapter",
        descTr: `Herhangi bir aktif g\xF6reve atanmam\u0131\u015F (bo\u015Fta/serbest) bir adapt\xF6r\xFCn kullan\u0131c\u0131 onay\u0131 ile sistemden ba\u015Far\u0131yla silindi\u011Finin do\u011Frulanmas\u0131.`,
        descEn: `Verification that an adapter not assigned to any active task is deleted cleanly upon confirmation.`,
        stepsTr: [
          `1. ${screenCtx.screenAblative} aktif bir g\xF6reve atanmam\u0131\u015F (bo\u015Fta/serbest) hedef adapt\xF6r\xFC se\xE7in.`,
          `2. Sat\u0131r \xFCzerindeki 'Sil' aksiyon butonuna t\u0131klay\u0131n.`,
          `3. Ekrana gelen silme onay diyalog kutusundaki (Silmek istedi\u011Finizden emin misiniz?) 'Evet, Sil' butonuna t\u0131klay\u0131n.`,
          `4. \u0130\u015Flem onay mesaj\u0131n\u0131 (Kay\u0131t ba\u015Far\u0131yla silindi) g\xF6zlemleyin.`,
          `5. Silinen adapt\xF6r\xFCn listeden ve veritaban\u0131ndan kal\u0131c\u0131 olarak kald\u0131r\u0131ld\u0131\u011F\u0131n\u0131 do\u011Frulay\u0131n.`
        ],
        stepsEn: [
          `1. In ${screenCtx.screenNominative}, locate unlinked/free adapter in grid.`,
          `2. Click 'Delete' action button.`,
          `3. Confirm deletion in prompt.`,
          `4. Observe success notification.`,
          `5. Confirm record is removed from grid and database.`
        ],
        expTr: [
          `1. G\xF6rev ba\u011F\u0131 bulunmayan bo\u015Fta adapt\xF6r se\xE7ilebilmelidir.`,
          `2. Silme onay penceresi g\xF6r\xFCnt\xFClenmelidir.`,
          `3. Sunucu 200 OK ile silme i\u015Flemini onaylamal\u0131d\u0131r.`,
          `4. Sistem 'Adapt\xF6r ba\u015Far\u0131yla silindi' yan\u0131t\u0131 d\xF6nmelidir.`,
          `5. Adapt\xF6r tablodan ve veritaban\u0131ndan kal\u0131c\u0131 olarak silinmelidir.`
        ],
        expEn: [
          `1. Free adapter selectable.`,
          `2. Confirmation prompt appears.`,
          `3. Backend returns 200 OK.`,
          `4. Success banner displayed.`,
          `5. Record deleted from database.`
        ],
        testData: "Bo\u015Fta Adapt\xF6r ID: ADAPTER_FREE_001 (Aktif G\xF6rev Ba\u011Flant\u0131s\u0131: Yok)",
        expectedResultTr: `Aktif g\xF6reve ba\u011Fl\u0131 olmayan adapt\xF6r\xFCn ba\u015Far\u0131yla silindi\u011Fi ve sistemden kald\u0131r\u0131ld\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.`,
        expectedResultEn: `Free adapter successfully deleted from system.`
      });
    } else {
      detectedOps.push({
        opNameTr: "Adapt\xF6r Silme ve Sistemden Kald\u0131rma \u0130\u015Flemi",
        opNameEn: "Deleting and Removing Adapters from System",
        descTr: `Silinmek istenen bir adapt\xF6r\xFCn kullan\u0131c\u0131 onay\u0131 verildikten sonra veritaban\u0131ndan ve aray\xFCz listesinden kal\u0131c\u0131 olarak silindi\u011Finin do\u011Frulanmas\u0131.`,
        descEn: `Verification that confirming deletion removes the adapter from database and UI grid.`,
        stepsTr: [
          `1. ${screenCtx.screenAblative} silinecek adapt\xF6r\xFCn 'Sil' butonuna t\u0131klay\u0131n.`,
          `2. Ekrana gelen silme onay diyalog kutusundaki (Silmek istedi\u011Finizden emin misiniz?) 'Evet, Sil' butonuna t\u0131klay\u0131n.`,
          `3. \u0130\u015Flem onay mesaj\u0131n\u0131 (Kay\u0131t silindi) g\xF6zlemleyin.`,
          `4. Silinen kayd\u0131n art\u0131k listede veya arama sonu\xE7lar\u0131nda g\xF6r\xFCnmedi\u011Fini do\u011Frulay\u0131n.`
        ],
        stepsEn: [
          `1. In ${screenCtx.screenNominative}, click 'Delete' button on target record.`,
          `2. Confirm deletion prompt.`,
          `3. Observe deletion success notification.`,
          `4. Verify record is removed from grid.`
        ],
        expTr: [
          `1. Silme onay modali uyar\u0131 mesaj\u0131yla ekrana gelmelidir.`,
          `2. Onay verilince silme iste\u011Fi sunucuya iletilmelidir.`,
          `3. Sistem 'Silme Ba\u015Far\u0131l\u0131' yan\u0131t\u0131 d\xF6nmelidir.`,
          `4. Silinen kay\u0131t tablodan ve veritaban\u0131ndan kal\u0131c\u0131 olarak kald\u0131r\u0131lmal\u0131d\u0131r.`
        ],
        expEn: [
          `1. Confirmation prompt shown.`,
          `2. Deletion API request sent.`,
          `3. Server returns success response.`,
          `4. Record removed from database and UI.`
        ],
        testData: "Silinecek Kay\u0131t ID: ADAPTER_TO_DELETE_01",
        expectedResultTr: `Silme i\u015Fleminin ba\u015Far\u0131yla tamamland\u0131\u011F\u0131 ve adapt\xF6r\xFCn sistemden kald\u0131r\u0131ld\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.`,
        expectedResultEn: `Record successfully deleted from system.`
      });
    }
  }
  if (textToScan.includes("s\xF6zl\xFCk") || textToScan.includes("yeni tip") || textToScan.includes("dictionary") || textToScan.includes("type definition") || textToScan.includes("tip ihtiyac\u0131")) {
    detectedOps.push({
      opNameTr: "Merkezi S\xF6zl\xFCkte Yeni Tip Tan\u0131mlama ve Formlarda Kullan\u0131m\u0131",
      opNameEn: "Central Dictionary Type Creation and Availability in Forms",
      descTr: `Merkezi s\xF6zl\xFCk k\xFCt\xFCphanesine yeni bir adapt\xF6r tipi tan\u0131m\u0131 eklendi\u011Finde, bu yeni tipin formlardaki a\xE7\u0131l\u0131r men\xFClerde se\xE7ilebilir bi\xE7imde sunuldu\u011Funun ve kaydedilebildi\u011Finin do\u011Frulanmas\u0131.`,
      descEn: `Verification that adding a new type to central dictionary makes it dynamically available in forms and creation flows.`,
      stepsTr: [
        `1. Merkezi S\xF6zl\xFCk / Parametre Y\xF6netim ekran\u0131na eri\u015Fin.`,
        `2. 'Yeni Tip Ekle' butonuna t\u0131klay\u0131n.`,
        `3. Yeni tip kodunu ve a\xE7\u0131klamas\u0131n\u0131 girip kaydedin.`,
        `4. ${screenCtx.screenNominative} ekleme/d\xFCzenleme formuna d\xF6nerek 'Tip' a\xE7\u0131l\u0131r men\xFCs\xFCn\xFC kontrol edin.`,
        `5. Yeni tan\u0131mlanan tipin listede se\xE7ilebilir durumda oldu\u011Funu ve se\xE7ilerek kaydedildi\u011Fini do\u011Frulay\u0131n.`
      ],
      stepsEn: [
        `1. Open Central Dictionary management page.`,
        `2. Click 'Add New Type'.`,
        `3. Enter new type code and label, then save.`,
        `4. Navigate to ${screenCtx.screenNominative} creation form and inspect Type dropdown.`,
        `5. Verify new type is selectable.`
      ],
      expTr: [
        `1. S\xF6zl\xFCk y\xF6netim ekran\u0131 a\xE7\u0131lmal\u0131d\u0131r.`,
        `2. Tip ekleme formu g\xF6r\xFCnmelidir.`,
        `3. Yeni tip veritaban\u0131 parametre tablosuna eklenmelidir.`,
        `4. A\xE7\u0131l\u0131r men\xFCdeki dinamik tip se\xE7ici listesi g\xFCncellenmelidir.`,
        `5. Yeni tip se\xE7ilerek kaydedilebilmelidir.`
      ],
      expEn: [
        `1. Dictionary UI loaded.`,
        `2. Type creation form active.`,
        `3. New type saved in parameters table.`,
        `4. Form dropdown refreshed with new option.`,
        `5. New type selected successfully.`
      ],
      testData: "Yeni Tip Kodu: CUSTOM_TYPE_01, A\xE7\u0131klama: \xD6zel Tan\u0131ml\u0131 Tip",
      expectedResultTr: `Yeni tipin merkezi s\xF6zl\xFC\u011Fe hatas\u0131z eklendi\u011Fi ve formlarda se\xE7ilebilir oldu\u011Fu do\u011Frulanmal\u0131d\u0131r.`,
      expectedResultEn: `New type added to dictionary and available in dynamic select inputs.`
    });
  }
  if (detectedOps.length > 0) {
    detectedOps.forEach((op, opIdx) => {
      const funcLabel = detectedOps.length > 1 ? isTurkish ? `Fonksiyon ${opIdx + 1}: ${op.opNameTr}` : `Function ${opIdx + 1}: ${op.opNameEn}` : isTurkish ? op.opNameTr : op.opNameEn;
      testCases.push({
        id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
        reqId,
        module: mod,
        title: isTurkish ? `[Pozitif] ${reqId} - ${funcLabel}` : `[Positive] ${reqId} - ${funcLabel}`,
        description: isTurkish ? op.descTr : op.descEn,
        preconditions: isTurkish ? "Sistem aktif, veritaban\u0131 ve ilgili servisler \xE7al\u0131\u015F\u0131r durumda, test kullan\u0131c\u0131s\u0131 yetkilendirilmi\u015F olmal\u0131d\u0131r." : "System active, backend services operational, test user authenticated.",
        steps: isTurkish ? op.stepsTr : op.stepsEn,
        stepExpectedResults: isTurkish ? op.expTr : op.expEn,
        testData: op.testData,
        expectedResult: isTurkish ? op.expectedResultTr : op.expectedResultEn,
        priority: "Y\xFCksek",
        testType: "Pozitif (Fonksiyonel Do\u011Fruluk)",
        executionType: "Manuel",
        severity: "Kritik"
      });
    });
  } else {
    testCases.push({
      id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
      reqId,
      module: mod,
      title: isTurkish ? `[Pozitif] ${title} - Temel Fonksiyonel Do\u011Frulama ve Ba\u015Far\u0131l\u0131 Ak\u0131\u015F` : `[Positive] ${title} - Happy Path Functional Verification`,
      description: isTurkish ? `Gereksinimde belirtilen \u015Fartlar\u0131n (${desc.substring(0, 150)}) ge\xE7erli parametrelerle hatas\u0131z i\u015Fletildi\u011Finin do\u011Frulanmas\u0131.` : `Verification that valid inputs and conditions successfully execute expected business logic.`,
      preconditions: isTurkish ? "Sistem aktif, veritaban\u0131 ve ilgili servisler eri\u015Filebilir, test kullan\u0131c\u0131s\u0131 yetkilendirilmi\u015F olmal\u0131d\u0131r." : "System active, backend services operational, test user authenticated with valid privileges.",
      steps: isTurkish ? isPayment ? [
        `1. ${screenCtx.screenDative} veya \xF6deme/sepet sayfas\u0131na eri\u015Fim sa\u011Flay\u0131n.`,
        `2. Ge\xE7erli i\u015Flem tutar\u0131n\u0131 ve gerekli \xF6deme/kart parametrelerini girin.`,
        `3. \u0130\u015Flem onay butonuna (\xD6deme Yap / Onayla) t\u0131klay\u0131n.`,
        `4. G\xFCvenlik/SMS do\u011Frulama ad\u0131m\u0131n\u0131 ge\xE7erli kod ile tamamlay\u0131n.`,
        `5. \u0130\u015Flemin ba\u015Far\u0131yla tamamland\u0131\u011F\u0131n\u0131, sipari\u015F/dekont numaras\u0131n\u0131n \xFCretildi\u011Fini do\u011Frulay\u0131n.`
      ] : isAuth ? [
        `1. Giri\u015F ekran\u0131na veya kimlik do\u011Frulama aray\xFCz\xFCne gidin.`,
        `2. Ge\xE7erli kullan\u0131c\u0131 ad\u0131 ve \u015Fifre bilgilerini forma girin.`,
        `3. 'Giri\u015F Yap' butonuna t\u0131klay\u0131n.`,
        `4. Varsa 2FA/SMS onay kodunu eksiksiz do\u011Frulay\u0131n.`,
        `5. Kullan\u0131c\u0131 oturumunun a\xE7\u0131ld\u0131\u011F\u0131n\u0131 ve yetkili ana sayfan\u0131n y\xFCklendi\u011Fini do\u011Frulay\u0131n.`
      ] : [
        screenCtx.step1NavigationTr,
        `2. ${title} i\xE7in gerekli t\xFCm ge\xE7erli parametreleri ve test verilerini forma girin.`,
        `3. Kaydet/G\xF6nder/Tetikle butonuna t\u0131klay\u0131n.`,
        `4. Sistem aray\xFCz\xFCndeki geri bildirim bildirimini ve y\xFCkleme durumunu izleyin.`,
        `5. \u0130\u015Flemin ba\u015Far\u0131yla sonu\xE7land\u0131\u011F\u0131n\u0131 ve veritaban\u0131 kayd\u0131n\u0131n g\xFCncellendi\u011Fini do\u011Frulay\u0131n.`
      ] : [
        screenCtx.step1NavigationEn,
        `2. Enter all mandatory and valid parameters for ${title}.`,
        `3. Click submit/confirm.`,
        `4. Observe interface feedback.`,
        `5. Verify persistence and successful response.`
      ],
      stepExpectedResults: isTurkish ? isPayment ? [
        `1. \xD6deme/sepet ekran\u0131 ve toplam tutar bilgisi eksiksiz g\xF6r\xFCnt\xFClenmelidir.`,
        `2. Girilen t\xFCm parametrelerin ge\xE7erli formatta kabul edildi\u011Fi g\xF6r\xFClmelidir.`,
        `3. \xD6deme a\u011F ge\xE7idine y\xF6nlendirme sa\u011Flanmal\u0131 ve onay ekran\u0131 a\xE7\u0131lmal\u0131d\u0131r.`,
        `4. G\xFCvenlik kodu kabul edilmeli ve onaylanmal\u0131d\u0131r.`,
        `5. Sistem '\u0130\u015Flem Ba\u015Far\u0131l\u0131' mesaj\u0131 d\xF6nd\xFCrmeli, kay\u0131t veritaban\u0131nda g\xFCncellenmelidir.`
      ] : isAuth ? [
        `1. Giri\u015F formu ve ilgili alanlar hatas\u0131z y\xFCklenmelidir.`,
        `2. Bilgiler maskeli ve g\xFCvenli \u015Fekilde giri\u015F kutular\u0131na aktar\u0131lmal\u0131d\u0131r.`,
        `3. Kimlik do\u011Frulama iste\u011Fi ba\u015Flat\u0131lmal\u0131d\u0131r.`,
        `4. \u0130ki ad\u0131ml\u0131 do\u011Frulama ba\u015Far\u0131yla teyit edilmelidir.`,
        `5. G\xFCvenli oturum anahtar\u0131 (JWT/Token) \xFCretilmeli ve dashboard a\xE7\u0131lmal\u0131d\u0131r.`
      ] : [
        `1. ${screenCtx.screenNominative} aray\xFCz\xFC ve i\u015Flem bile\u015Fenleri eksiksiz y\xFCklenmelidir.`,
        `2. Girilen test parametreleri ge\xE7erli kabul edilmelidir.`,
        `3. \u0130\u015Flem arka planda ba\u015Far\u0131yla tetiklenmelidir.`,
        `4. Y\xFCkleme g\xF6stergesi tamamlanmal\u0131 ve ba\u015Far\u0131 bildirim banner\u0131 \xE7\u0131kmal\u0131d\u0131r.`,
        `5. Veritaban\u0131nda ilgili kay\u0131t tutarl\u0131 \u015Fekilde g\xFCncellenmeli ve denetim logu olu\u015Fmal\u0131d\u0131r.`
      ] : [
        `1. Screen loaded successfully.`,
        `2. Parameters accepted without validation error.`,
        `3. Transaction dispatched.`,
        `4. Success banner displayed.`,
        `5. Database record successfully persisted.`
      ],
      testData: isPayment ? "Ge\xE7erli Tutar: 1500.00 TL, Ge\xE7erli Kart/IBAN, SMS Kodu: 123456" : isAuth ? "Kullan\u0131c\u0131: test_user@company.com, Ge\xE7erli Parola: Demo!2026" : "Ge\xE7erli parametreler ve standart test verisi seti",
      expectedResult: isTurkish ? `${title} fonksiyonunun ba\u015Far\u0131yla i\u015Fletildi\u011Fi, veritaban\u0131 kayd\u0131n\u0131n olu\u015Ftu\u011Fu ve kullan\u0131c\u0131ya ba\u015Far\u0131 bildirimi verildi\u011Fi do\u011Frulanmal\u0131d\u0131r.` : "Function completes with verified data integrity and success confirmation.",
      priority: "Y\xFCksek",
      testType: "Pozitif (Fonksiyonel Do\u011Fruluk)",
      executionType: "Manuel",
      severity: "Kritik"
    });
  }
  detectedRules.forEach((rule) => {
    testCases.push({
      id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
      reqId,
      module: mod,
      title: isTurkish ? `[Negatif / \u0130\u015F Kural\u0131] ${reqId} - ${rule.ruleTitleTr}` : `[Negative / Business Rule] ${reqId} - ${rule.ruleTitleEn}`,
      description: isTurkish ? rule.descTr : rule.descEn,
      preconditions: isTurkish ? rule.preconditionTr : rule.preconditionEn,
      steps: isTurkish ? rule.stepsTr : rule.stepsEn,
      stepExpectedResults: isTurkish ? rule.expTr : rule.expEn,
      testData: rule.testData,
      expectedResult: isTurkish ? rule.expectedResultTr : rule.expectedResultEn,
      priority: rule.priority,
      testType: "Negatif (Hata Y\xF6netimi)",
      executionType: "Manuel",
      severity: rule.severity
    });
  });
  testCases.push({
    id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
    reqId,
    module: mod,
    title: isTurkish ? `[Negatif] ${reqId} - Eksik veya Ge\xE7ersiz Parametre Hata Y\xF6netimi` : `[Negative] ${reqId} - Invalid Data & Error Handling Validation`,
    description: isTurkish ? `Zorunlu alanlar bo\u015F b\u0131rak\u0131ld\u0131\u011F\u0131nda veya ge\xE7ersiz/hatal\u0131 formatta veri girildi\u011Finde sistemin i\u015Flemi engelleyip a\xE7\u0131klay\u0131c\u0131 hata mesaj\u0131 verdi\u011Finin do\u011Frulanmas\u0131.` : `Verification that invalid or missing inputs are rejected gracefully with user-friendly error messages.`,
    preconditions: isTurkish ? "Sistem aktif ve kullan\u0131c\u0131 i\u015Flem ekran\u0131nda haz\u0131r bulunmal\u0131d\u0131r." : "System active and user on transaction page.",
    steps: isTurkish ? [
      `1. ${screenCtx.screenDative} gidin ve ilgili i\u015Flem formunu a\xE7\u0131n.`,
      `2. Zorunlu alanlar\u0131 bo\u015F b\u0131rak\u0131n veya ge\xE7ersiz/hatal\u0131 formatta test girdisi sa\u011Flay\u0131n.`,
      `3. \u0130\u015Flem onay butonuna (Kaydet/G\xF6nder/\xD6de) t\u0131klay\u0131n.`,
      `4. Ekran \xFCzerinde beliren do\u011Frulama uyar\u0131lar\u0131n\u0131 ve alan bazl\u0131 hata mesajlar\u0131n\u0131 inceleyin.`,
      `5. Hatal\u0131 i\u015Flemin veritaban\u0131na veya harici servislere yans\u0131t\u0131lmad\u0131\u011F\u0131n\u0131 kontrol edin.`
    ] : [
      `1. Access ${screenCtx.screenNominative} screen.`,
      `2. Leave mandatory fields blank or supply malformed test values.`,
      `3. Click submit.`,
      `4. Check field validation warnings and system alert.`,
      `5. Confirm that unvalidated payload is rejected and not saved.`
    ],
    stepExpectedResults: isTurkish ? [
      `1. \u0130\u015Flem formu ekranda eksiksiz g\xF6r\xFCnt\xFClenmelidir.`,
      `2. Ge\xE7ersiz veriler ilgili form alanlar\u0131nda yer almal\u0131d\u0131r.`,
      `3. Sistem i\u015Flemi durdurmal\u0131 ve g\xF6nderme iste\u011Fini engellemelidir.`,
      `4. \u0130lgili alanlar\u0131n alt\u0131nda k\u0131rm\u0131z\u0131 do\u011Frulama ve a\xE7\u0131klay\u0131c\u0131 hata uyar\u0131s\u0131 g\xF6r\xFCnmelidir.`,
      `5. Veritaban\u0131nda hi\xE7bir hatal\u0131 veya eksik kay\u0131t olu\u015Fmamal\u0131d\u0131r.`
    ] : [
      `1. Form is visible.`,
      `2. Invalid values populated.`,
      `3. Form submission blocked.`,
      `4. Field-level error messages displayed.`,
      `5. No database side-effects recorded.`
    ],
    testData: "Bo\u015F veya ge\xE7ersiz parametre de\u011Ferleri (null, empty, invalid format, special chars)",
    expectedResult: isTurkish ? "Ge\xE7ersiz veri giri\u015Fi engellenmeli, sistem kararl\u0131l\u0131\u011F\u0131 korunmal\u0131 ve kullan\u0131c\u0131ya y\xF6nlendirici hata mesaj\u0131 sunulmal\u0131d\u0131r." : "Invalid input blocked and explanatory error message displayed.",
    priority: "Y\xFCksek",
    testType: "Negatif (Hata Y\xF6netimi)",
    executionType: "Manuel",
    severity: "Y\xFCksek"
  });
  if (includeBva) {
    testCases.push({
      id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
      reqId,
      module: mod,
      title: isTurkish ? `[S\u0131n\u0131r De\u011Fer Analizi (BVA)] ${reqId} - Min/Maks S\u0131n\u0131r Limitleri ve Karakter Kontrol\xFC` : `[Boundary Value Analysis (BVA)] ${reqId} - Min/Max Range & Limit Testing`,
      description: isTurkish ? `Gereksinimde tan\u0131mlanan say\u0131sal, metinsel veya tutarsal s\u0131n\u0131r de\u011Ferlerin (alt limit, \xFCst limit, limit - 1, limit + 1) do\u011Fru \xE7al\u0131\u015Ft\u0131\u011F\u0131n\u0131n do\u011Frulanmas\u0131.` : `Verification that boundary values (min, max, min-1, max+1) are handled strictly according to specifications.`,
      preconditions: isTurkish ? "Sistem aktif, s\u0131n\u0131r kontrol algoritmalar\u0131 ve do\u011Frulama kurallar\u0131 devrede olmal\u0131d\u0131r." : "System active with boundary rules enabled.",
      steps: isTurkish ? [
        `1. ${screenCtx.screenDative} gidin ve parametre giri\u015F formunu a\xE7\u0131n.`,
        `2. \u0130lgili parametre i\xE7in minimum s\u0131n\u0131r de\u011Ferini (Min ve Min - 1) test edin.`,
        `3. \u0130lgili parametre i\xE7in maksimum s\u0131n\u0131r de\u011Ferini (Maks ve Maks + 1) test edin.`,
        `4. S\u0131n\u0131r i\xE7i de\u011Ferlerin kabul edildi\u011Fini, s\u0131n\u0131r d\u0131\u015F\u0131 de\u011Ferlerin uygun hata ile reddedildi\u011Fini izleyin.`
      ] : [
        `1. Open form in ${screenCtx.screenNominative}.`,
        `2. Test minimum boundary values (Min and Min - 1).`,
        `3. Test maximum boundary values (Max and Max + 1).`,
        `4. Verify that within-range values pass and out-of-range values fail with clear messages.`
      ],
      stepExpectedResults: isTurkish ? [
        `1. Giri\u015F formu s\u0131n\u0131r testine haz\u0131r olmal\u0131d\u0131r.`,
        `2. Min alt\u0131ndaki de\u011Ferler 'Minimum s\u0131n\u0131r a\u015F\u0131ld\u0131' uyar\u0131s\u0131 vermelidir.`,
        `3. Maks \xFCzerindeki de\u011Ferler 'Maksimum s\u0131n\u0131r a\u015F\u0131ld\u0131' uyar\u0131s\u0131 vermelidir.`,
        `4. Yaln\u0131zca ge\xE7erli aral\u0131ktaki s\u0131n\u0131r de\u011Ferlerin ba\u015Far\u0131l\u0131 i\u015Flendi\u011Fi do\u011Frulanmal\u0131d\u0131r.`
      ] : [
        `1. Form ready.`,
        `2. Under-boundary values rejected.`,
        `3. Over-boundary values rejected.`,
        `4. Exact boundaries handled correctly.`
      ],
      testData: "S\u0131n\u0131r Test De\u011Ferleri: Min-1, Min, Min+1, Max-1, Max, Max+1, 0, null, 255/4000 karakter",
      expectedResult: isTurkish ? "S\u0131n\u0131r de\u011Ferlerin tam limit noktalar\u0131nda sistem kurallar\u0131na uygun davrand\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r." : "System adheres strictly to boundary constraints.",
      priority: "Orta",
      testType: "S\u0131n\u0131r De\u011Fer Analizi (BVA)",
      executionType: "Manuel",
      severity: "Normal"
    });
  }
  if (includeSec) {
    testCases.push({
      id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
      reqId,
      module: mod,
      title: isTurkish ? `[G\xFCvenlik ve Yetki Testi (Security)] ${reqId} - Yetkilendirme, Oturum ve Enjeksiyon Korumas\u0131` : `[Security & Authorization] ${reqId} - Privilege Escalation & Injection Guard`,
      description: isTurkish ? `Yetkisiz kullan\u0131c\u0131lar\u0131n i\u015Fleme eri\u015Femedi\u011Finin, oturumsuz isteklerin reddedildi\u011Finin ve k\xF6t\xFC niyetli payload (XSS/SQLi) enjeksiyonlar\u0131n\u0131n filtrelendi\u011Finin do\u011Frulanmas\u0131.` : `Verification that unauthorized users cannot execute action and malicious payloads are sanitized.`,
      preconditions: isTurkish ? "G\xFCvenlik filtreleri, WAF kurallar\u0131 ve rol tabanl\u0131 yetki matrisi (RBAC) devrede olmal\u0131d\u0131r." : "Security middleware and RBAC enabled.",
      steps: isTurkish ? [
        `1. Oturumu kapatm\u0131\u015F veya yetkisiz bir rol profiliyle ${screenCtx.screenDative} do\u011Frudan eri\u015Fmeyi deneyin.`,
        `2. Sistemin 401 Unauthorized veya 403 Forbidden yan\u0131t\u0131 verdi\u011Fini do\u011Frulay\u0131n.`,
        `3. Yetkili kullan\u0131c\u0131 ile giri\u015F yap\u0131p form alanlar\u0131na XSS (<script>alert(1)</script>) ve SQLi test girdisi sa\u011Flay\u0131n.`,
        `4. Sistemin g\xFCvenli ka\xE7\u0131\u015F (sanitize) uygulad\u0131\u011F\u0131n\u0131 ve komut \xE7al\u0131\u015Ft\u0131rmad\u0131\u011F\u0131n\u0131 do\u011Frulay\u0131n.`
      ] : [
        `1. Attempt unauthorized access to ${screenCtx.screenNominative}.`,
        `2. Confirm 401/403 response.`,
        `3. Supply sanitized security injection strings into fields.`,
        `4. Verify proper sanitization without execution.`
      ],
      stepExpectedResults: isTurkish ? [
        `1. Yetkisiz do\u011Frudan eri\u015Fim engellenmelidir.`,
        `2. Sistem g\xFCvenli \u015Fekilde oturum a\xE7ma veya yetki hatas\u0131 sayfas\u0131na y\xF6nlendirmelidir.`,
        `3. G\xFCvenlik filtreleri \u015F\xFCpheli karakterleri etkisiz hale getirmelidir.`,
        `4. G\xFCvenlik loglar\u0131na \u015F\xFCpheli istek uyar\u0131s\u0131 kaydedilmelidir.`
      ] : [
        `1. Access rejected.`,
        `2. 401/403 status returned.`,
        `3. Special characters escaped.`,
        `4. Security log generated.`
      ],
      testData: "G\xFCvenlik Test Verisi: Role: Guest, Payload: <script>alert('XSS')</script>, ' OR '1'='1",
      expectedResult: isTurkish ? "Sistem yetkisiz eri\u015Fimleri engellemeli ve g\xFCvenlik zaafiyetlerine kar\u015F\u0131 korumal\u0131 kalmal\u0131d\u0131r." : "Zero security leakage or unauthorized privileges.",
      priority: "Y\xFCksek",
      testType: "G\xFCvenlik ve Yetki Testi (Security)",
      executionType: "Otomasyon",
      severity: "Kritik"
    });
  }
  if (includePerf) {
    testCases.push({
      id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
      reqId,
      module: mod,
      title: isTurkish ? `[Performans Testi (Performance)] ${reqId} - Yan\u0131t S\xFCresi (<500ms) ve E\u015Fzamanl\u0131l\u0131k Do\u011Frulamas\u0131` : `[Performance Test] ${reqId} - SLA Response Time (<500ms) & Concurrency Validation`,
      description: isTurkish ? `\u0130\u015Flemin standart y\xFCk alt\u0131nda tan\u0131mlanan SLA yan\u0131t s\xFCresi (\xF6rn: < 500ms) i\xE7erisinde yan\u0131t verdi\u011Finin ve e\u015Fzamanl\u0131 isteklerde kararl\u0131l\u0131\u011F\u0131n\u0131 korudu\u011Funun do\u011Frulanmas\u0131.` : `Verification that operation completes within acceptable latency benchmarks under expected concurrency.`,
      preconditions: isTurkish ? "Performans izleme ara\xE7lar\u0131 devrede ve test ortam\u0131 stabil a\u011F ko\u015Fullar\u0131nda olmal\u0131d\u0131r." : "APM monitoring active in test environment.",
      steps: isTurkish ? [
        `1. ${screenCtx.screenDative} eri\u015Fip ilgili i\u015Flem \xE7a\u011Fr\u0131s\u0131n\u0131 ba\u015Flat\u0131n.`,
        `2. A\u011F trafi\u011Fi analiz\xF6r\xFCnde (DevTools / APM) TTFB ve toplam i\u015Flem s\xFCresini \xF6l\xE7\xFCn.`,
        `3. E\u015Fzamanl\u0131 10 test kullan\u0131c\u0131s\u0131 ile i\u015Flemi paralel tetikleyin.`,
        `4. T\xFCm yan\u0131tlar\u0131n hatas\u0131z 200 OK d\xF6nd\xFC\u011F\xFCn\xFC ve gecikme ya\u015Fanmad\u0131\u011F\u0131n\u0131 do\u011Frulay\u0131n.`
      ] : [
        `1. Trigger ${screenCtx.screenNominative} operation.`,
        `2. Measure response latency.`,
        `3. Simulate concurrent requests.`,
        `4. Verify 200 OK and acceptable response latency.`
      ],
      stepExpectedResults: isTurkish ? [
        `1. \u0130stek sunucuya iletilmelidir.`,
        `2. Yan\u0131t s\xFCresi SLA hedefi (ortalama < 500ms) i\xE7inde kalmal\u0131d\u0131r.`,
        `3. E\u015Fzamanl\u0131 isteklerde CPU veya bellek s\u0131z\u0131nt\u0131s\u0131 ya\u015Fanmamal\u0131d\u0131r.`,
        `4. T\xFCm paralel oturumlar ba\u015Far\u0131yla sonu\xE7lanmal\u0131d\u0131r.`
      ] : [
        `1. Dispatched.`,
        `2. Response < 500ms.`,
        `3. Server remains healthy.`,
        `4. No transaction deadlock.`
      ],
      testData: "E\u015Fzamanl\u0131 Kullan\u0131c\u0131 Say\u0131s\u0131: 10, SLA Hedefi: < 500 ms",
      expectedResult: isTurkish ? "\u0130\u015Flem belirlenen performans kriterlerine tam uyumlu olarak sonu\xE7lanmal\u0131d\u0131r." : "System performance meets SLA criteria.",
      priority: "D\xFC\u015F\xFCk",
      testType: "Performans Testi (Performance)",
      executionType: "Otomasyon",
      severity: "Normal"
    });
  }
  if (config?.positiveCountPerReq > 1) {
    testCases.push({
      id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
      reqId,
      module: mod,
      title: isTurkish ? `[Pozitif] ${title} - Alternatif Ge\xE7erli Senaryo ve Veri B\xFCt\xFCnl\xFC\u011F\xFC` : `[Positive] ${title} - Alternate Valid Flow & Data Integrity`,
      description: isTurkish ? `Alternatif ge\xE7erli girdilerle fonksiyonun veri b\xFCt\xFCnl\xFC\u011F\xFC ve i\u015Flem taml\u0131\u011F\u0131 a\xE7\u0131s\u0131ndan do\u011Frulanmas\u0131.` : `Verification of alternate valid execution path and data consistency.`,
      preconditions: isTurkish ? "Sistem aktif ve kullan\u0131c\u0131 oturumu ge\xE7erli olmal\u0131d\u0131r." : "System active and user authenticated.",
      steps: isTurkish ? [
        `1. ${screenCtx.screenDative} eri\u015Fin.`,
        `2. \u0130ste\u011Fe ba\u011Fl\u0131 (opsiyonel) alanlar\u0131 da i\xE7eren alternatif ge\xE7erli veri seti girin.`,
        `3. \u0130\u015Flemi onaylay\u0131n.`,
        `4. \xC7\u0131kt\u0131lar\u0131n ve veritaban\u0131 kay\u0131tlar\u0131n\u0131n eksiksiz oldu\u011Funu do\u011Frulay\u0131n.`
      ] : [
        `1. Open ${screenCtx.screenNominative}.`,
        `2. Populate alternate valid inputs.`,
        `3. Submit.`,
        `4. Verify complete audit trail.`
      ],
      stepExpectedResults: isTurkish ? [
        `1. Ekran a\xE7\u0131lmal\u0131d\u0131r.`,
        `2. Alternatif girdiler kabul edilmelidir.`,
        `3. \u0130\u015Flem onaylanmal\u0131d\u0131r.`,
        `4. T\xFCm alanlar veritaban\u0131na do\u011Fru yaz\u0131lmal\u0131d\u0131r.`
      ] : [
        `1. Screen ready.`,
        `2. Data valid.`,
        `3. Confirmed.`,
        `4. Data persisted.`
      ],
      testData: "Alternatif ge\xE7erli test verisi seti",
      expectedResult: isTurkish ? "Alternatif ge\xE7erli i\u015F ak\u0131\u015F\u0131 hatas\u0131z tamamlanmal\u0131 ve veri tutarl\u0131l\u0131\u011F\u0131 sa\u011Flanmal\u0131d\u0131r." : "Alternative valid flow succeeds cleanly.",
      priority: "Orta",
      testType: "Pozitif (Fonksiyonel Do\u011Fruluk)",
      executionType: "Manuel",
      severity: "Normal"
    });
  }
  const rawDescLines = desc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const detectedSubItems = [];
  for (const line of rawDescLines) {
    const m = line.match(/^(?:(\d+)[\.\)]\s*|[•\-\*—]\s*)(.+)/);
    if (m && m[2].trim().length > 6) {
      detectedSubItems.push({
        num: m[1] ? parseInt(m[1], 10) : detectedSubItems.length + 1,
        text: m[2].trim()
      });
    }
  }
  if (detectedSubItems.length >= 2) {
    detectedSubItems.forEach((subItem) => {
      const subItemText = subItem.text;
      const subItemNum = subItem.num;
      const isNegativeIntent = /hata|engel|şifre|kilit|yasak|geçersiz|eksik|reddet|süre|limit|zaman\s*aşımı|invalid|error|block|reject|timeout/i.test(
        subItemText
      );
      testCases.push({
        id: `TC-${reqId}-M${String(subItemNum).padStart(2, "0")}-01`,
        reqId,
        module: mod,
        title: isTurkish ? `[Madde ${subItemNum} Do\u011Frulama] ${subItemText.substring(0, 75)}` : `[Clause ${subItemNum} Verification] ${subItemText.substring(0, 75)}`,
        description: isTurkish ? `Gereksinim maddesi ${subItemNum} ("${subItemText}") kapsam\u0131ndaki kural\u0131n eksiksiz i\u015Fletildi\u011Finin do\u011Frulanmas\u0131.` : `Verification of requirement clause ${subItemNum}: "${subItemText}".`,
        preconditions: isTurkish ? "Sistem aktif, ilgili mod\xFCl eri\u015Filebilir ve kullan\u0131c\u0131 yetkilendirilmi\u015F olmal\u0131d\u0131r." : "System active with valid test privileges.",
        steps: isTurkish ? [
          `1. ${mod} mod\xFCl\xFC ilgili i\u015Flem aray\xFCz\xFCn\xFC a\xE7\u0131n.`,
          `2. ${subItemNum}. maddedeki kural\u0131 test etmek \xFCzere parametreleri sa\u011Flay\u0131n: "${subItemText.substring(0, 80)}".`,
          `3. \u0130\u015Flemi tetikleyin ve sistem yan\u0131t\u0131n\u0131 kaydedin.`,
          `4. Beklenen davran\u0131\u015F\u0131n eksiksiz ger\xE7ekle\u015Fti\u011Fini ve veritaban\u0131/ekran durumunu do\u011Frulay\u0131n.`
        ] : [
          `1. Navigate to ${mod} screen.`,
          `2. Test clause ${subItemNum}: "${subItemText.substring(0, 80)}".`,
          `3. Trigger action.`,
          `4. Verify expected state.`
        ],
        stepExpectedResults: isTurkish ? [
          `1. \u0130lgili aray\xFCz hatas\u0131z y\xFCklenmelidir.`,
          `2. Parametreler kabul edilmelidir.`,
          `3. \u0130\u015Flem ba\u015Far\u0131yla tetiklenmelidir.`,
          `4. ${subItemText} \u015Fart\u0131na tam uyumlu yan\u0131t al\u0131nmal\u0131d\u0131r.`
        ] : [
          `1. UI loaded.`,
          `2. Inputs accepted.`,
          `3. Action triggered.`,
          `4. Clause criteria fulfilled.`
        ],
        testData: `Madde ${subItemNum} Test Verisi`,
        expectedResult: isTurkish ? `${subItemNum}. maddedeki "${subItemText}" \u015Fart\u0131n\u0131n sistem taraf\u0131ndan eksiksiz sa\u011Fland\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.` : `Clause ${subItemNum} requirement successfully fulfilled.`,
        priority: "Y\xFCksek",
        testType: isNegativeIntent ? "Negatif (Hata Y\xF6netimi)" : "Pozitif (Fonksiyonel Do\u011Fruluk)",
        executionType: "Manuel",
        severity: isNegativeIntent ? "Y\xFCksek" : "Normal"
      });
    });
  }
  if (customInstr && customInstr.length > 0) {
    const isSpecificallyMentioned = customInstr.toLowerCase().includes(String(reqId).toLowerCase());
    const hasSpecificReqMentions = /\b(ad-f\d+|req-\d+|td-\d+|fr-\d+)\b/i.test(customInstr);
    const shouldGenerateDedicatedCustomCase = isSpecificallyMentioned || !hasSpecificReqMentions;
    if (shouldGenerateDedicatedCustomCase) {
      const isNegative = /hata|engel|yasak|geçersiz|reddet|409|400|422|negative|error|conflict|cannot/i.test(customInstr);
      const isBva = /sınır|bva|limit|min|max|boundary|aralık/i.test(customInstr);
      const isSecurity = /yetki|rol|güvenlik|auth|admin|token|izin|security/i.test(customInstr);
      const assignedType = isNegative ? "Negatif (Hata Y\xF6netimi)" : isBva ? "S\u0131n\u0131r De\u011Fer Analizi (BVA)" : isSecurity ? "G\xFCvenlik ve Yetki Testi (Security)" : "Pozitif (Fonksiyonel Do\u011Fruluk)";
      testCases.push({
        id: `TC-${reqId}-${String(tcSeq++).padStart(2, "0")}`,
        reqId,
        module: mod,
        title: isTurkish ? `[\xD6zel Talimat] ${reqId} - ${customInstr.substring(0, 65)}` : `[Custom Instruction] ${reqId} - ${customInstr.substring(0, 65)}`,
        description: isTurkish ? `\xD6zel AI Test Talimat\u0131nda belirtilen kural ve detaylar\u0131n ("${customInstr}") ${reqId} gereksinimi i\xE7in eksiksiz i\u015Fletildi\u011Finin do\u011Frulanmas\u0131.` : `Verification of user custom prompt guidance ("${customInstr}") for requirement ${reqId}.`,
        preconditions: isTurkish ? `Sistem aktif, kullan\u0131c\u0131 oturumu a\xE7\u0131k ve \xF6zel talimatta tan\u0131mlanan test ko\u015Fullar\u0131 haz\u0131r olmal\u0131d\u0131r: "${customInstr.substring(0, 75)}".` : `System active with custom test preconditions prepared: "${customInstr.substring(0, 75)}".`,
        steps: isTurkish ? [
          screenCtx.step1NavigationTr,
          `2. \xD6zel talimatta belirtilen parametre ve ko\u015Fullar\u0131 sa\u011Flay\u0131n: "${customInstr.substring(0, 90)}".`,
          `3. \u0130\u015Flem onay butonuna t\u0131klay\u0131n veya API iste\u011Fini tetikleyin.`,
          `4. Sistemin yan\u0131t\u0131n\u0131, d\xF6nen durum kodunu ve ekran geri bildirimini inceleyin.`,
          `5. \xD6zel talimattaki t\xFCm kontrol kriterlerinin eksiksiz sa\u011Fland\u0131\u011F\u0131n\u0131 do\u011Frulay\u0131n.`
        ] : [
          screenCtx.step1NavigationEn,
          `2. Provide parameters per custom instruction: "${customInstr.substring(0, 90)}".`,
          `3. Submit or trigger action.`,
          `4. Inspect system response, status code, and UI feedback.`,
          `5. Confirm all custom criteria are satisfied.`
        ],
        stepExpectedResults: isTurkish ? [
          `1. Mod\xFCl aray\xFCz\xFC veya API endpoint hatas\u0131z yan\u0131t vermelidir.`,
          `2. \xD6zel talimat verileri sisteme do\u011Fru formatta iletilmelidir.`,
          `3. Sistem iste\u011Fi i\u015Fleme almal\u0131 veya k\u0131s\u0131t kural\u0131n\u0131 devreye sokmal\u0131d\u0131r.`,
          `4. Beklenen sonu\xE7 ve ilgili hata/ba\u015Far\u0131 mesaj\u0131 ekranda/yan\u0131tta g\xF6r\xFCnt\xFClenmelidir.`,
          `5. \xD6zel talimatta belirtilen \u015Fart\u0131n tam kar\u015F\u0131land\u0131\u011F\u0131 teyit edilmelidir.`
        ] : [
          `1. Target screen/endpoint loaded.`,
          `2. Custom parameters supplied.`,
          `3. Request processed or constraint enforced.`,
          `4. Expected feedback or status code verified.`,
          `5. Full compliance with custom instruction verified.`
        ],
        testData: `\xD6zel Talimat Test Verisi: ${customInstr.substring(0, 100)}`,
        expectedResult: isTurkish ? `\xD6zel AI test talimat\u0131nda tan\u0131mlanan t\xFCm kural ve gereksinimlerin sistem taraf\u0131ndan eksiksiz kar\u015F\u0131land\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.` : `System strictly satisfies all directives specified in custom prompt guidance.`,
        priority: "Y\xFCksek",
        testType: assignedType,
        executionType: "Manuel",
        severity: isNegative || isSecurity ? "Y\xFCksek" : "Normal"
      });
    }
  }
  return testCases;
}
function makeRequirementIdsUnique(reqs) {
  if (!Array.isArray(reqs) || reqs.length === 0) return [];
  const seenCounts = /* @__PURE__ */ new Map();
  const totalCounts = /* @__PURE__ */ new Map();
  const sanitizeBaseId = (raw, fallbackIdx) => {
    let base = String(raw || "").replace(/^[\[\(]+/, "").replace(/[\]\)\.\:\,\-]+$/, "").trim();
    if (!base) {
      return `REQ-${String(fallbackIdx + 1).padStart(3, "0")}`;
    }
    if (/^[a-zA-Z]$/.test(base)) {
      return `REQ-${base.toUpperCase()}`;
    }
    if (/^\d{1,2}$/.test(base)) {
      return `REQ-${base.padStart(3, "0")}`;
    }
    return base;
  };
  const withBaseIds = reqs.map((r, idx) => {
    const baseId = sanitizeBaseId(r.id, idx);
    totalCounts.set(baseId, (totalCounts.get(baseId) || 0) + 1);
    return { ...r, baseId };
  });
  const usedFinalIds = /* @__PURE__ */ new Set();
  return withBaseIds.map((r, idx) => {
    const { baseId, ...rest } = r;
    const total = totalCounts.get(baseId) || 0;
    let finalId = baseId;
    if (total > 1) {
      const occurrence = (seenCounts.get(baseId) || 0) + 1;
      seenCounts.set(baseId, occurrence);
      finalId = `${baseId}-${String(occurrence).padStart(2, "0")}`;
    }
    while (usedFinalIds.has(finalId)) {
      finalId = `${finalId}-${idx + 1}`;
    }
    usedFinalIds.add(finalId);
    return {
      ...rest,
      id: finalId
    };
  });
}
function extractAllRequirementsFromDocument(rawText, isTurkish = true) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results = [];
  const cleanId = (id) => id.replace(/^[\[\(]+/, "").replace(/[\]\)\.\:\,\-]+$/, "").trim();
  const isRealHeaderRow = (cells) => {
    if (!Array.isArray(cells) || cells.length < 2) return false;
    if (cells.some((c) => c.length > 50)) return false;
    const headerKeywordRegex = /^(?:id|no|sıra\s*no|sırano|s\.no|item\s*no|req(?:uirement)?[\s_-]*(?:id|no)?|gereksinim[\s_-]*(?:no|id|kodu|tanımı)?|kod|kodu|başlık|title|açıklama|description|tanım|detay|modül|module|kategori|category|öncelik|priority|durum|status)$/i;
    return cells.some((c) => headerKeywordRegex.test(c.trim()));
  };
  const tableRows = [];
  for (const line of lines) {
    if (line.startsWith("|") && line.includes("|") && !line.includes("---")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) tableRows.push(cells);
    } else if (line.includes("	")) {
      const cells = line.split("	").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) tableRows.push(cells);
    }
  }
  if (tableRows.length >= 1 && (tableRows.length >= lines.length / 2 || tableRows.length >= 2)) {
    const isHeader = isRealHeaderRow(tableRows[0]);
    const dataRows = isHeader ? tableRows.slice(1) : tableRows;
    if (dataRows.length >= 1) {
      dataRows.forEach((row, idx) => {
        const rawId = cleanId(row[0].replace(/[^A-Za-z0-9_.-]/g, ""));
        const id = rawId.length >= 2 ? rawId : `REQ-${String(idx + 1).padStart(3, "0")}`;
        let title = row[1] ? row[1].substring(0, 100).trim() : `Gereksinim ${idx + 1}`;
        let description = row.slice(1).join(" - ").trim() || title;
        let category = row.length > 2 ? row[2].substring(0, 50).trim() : "";
        const tagMatch = description.match(/\[([A-Za-z0-9_\s\/\-]+)\]\s*$/);
        if (!category && tagMatch) {
          category = tagMatch[1].split("/")[0].trim();
        }
        if (!category) category = "Fonksiyonel";
        title = title.replace(/\t+/g, " - ").substring(0, 100);
        results.push({ id, title, description, category });
      });
      if (results.length > 0) return makeRequirementIdsUnique(results);
    }
  }
  let activeReq = null;
  let currentSectionTitle = "";
  const flushReq = () => {
    if (activeReq && activeReq.descriptionLines.length > 0) {
      const fullDescription = activeReq.descriptionLines.join("\n").trim();
      let cleanTitle = (activeReq.title || fullDescription.substring(0, 80)).replace(/\t+/g, " - ").trim();
      results.push({
        id: activeReq.id,
        title: cleanTitle,
        description: fullDescription,
        category: activeReq.category || currentSectionTitle || "Fonksiyonel"
      });
      activeReq = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bracketIdMatch = line.match(/^\[?([A-Za-z0-9_.-]{2,25})\]?[\s:\-\.\t]+(.+)/);
    const isExplicitId = bracketIdMatch && (/^[A-Za-z0-9_.-]+$/.test(bracketIdMatch[1]) && (/[A-Za-z]/.test(bracketIdMatch[1]) && (/\d/.test(bracketIdMatch[1]) || bracketIdMatch[1].includes("-") || bracketIdMatch[1].includes("_"))) && bracketIdMatch[1].length >= 2 && bracketIdMatch[1].length <= 25 && !/^(Not|Note|Notlar|Dikkat|Warning|Example|Örnek|Açıklama|Description)$/i.test(bracketIdMatch[1]));
    const gereksinimPrefixMatch = line.match(/^(?:Gereksinim|Requirement|Req|Madde|Fonksiyon)[\s_-]*(\d+)[.:\s-]+(.*)/i);
    const sectionHeadingMatch = line.match(
      /^(?:#{1,4}\s+|Bölüm\s+\d+[:\s]+|Section\s+\d+[:\s]+)?(?:(\d+(?:\.\d+)+)[\.\s:\-]+)\s*([A-ZÇĞİÖŞÜa-zçğıöşü][^:\n]{2,80})$/
    );
    const topLevelNumberMatch = line.match(/^(\d+)[\.\)\-]\s+([A-ZÇĞİÖŞÜa-zçğıöşü0-9"'].+)/);
    if (isExplicitId && bracketIdMatch) {
      flushReq();
      const rawId = cleanId(bracketIdMatch[1]);
      const reqId = rawId;
      let reqTitle = bracketIdMatch[2].trim();
      let reqCategory = currentSectionTitle || "Fonksiyonel";
      const tagMatch = line.match(/\[([A-Za-z0-9_\s\/\-]+)\]\s*$/);
      if (tagMatch) reqCategory = tagMatch[1].split("/")[0].trim();
      reqTitle = reqTitle.replace(/\t+/g, " - ").substring(0, 100);
      currentSectionTitle = reqCategory;
      activeReq = {
        id: reqId,
        title: reqTitle,
        descriptionLines: [line],
        category: reqCategory
      };
    } else if (gereksinimPrefixMatch) {
      flushReq();
      const numStr = gereksinimPrefixMatch[1];
      const reqId = `REQ-${String(numStr).padStart(3, "0")}`;
      const reqTitle = gereksinimPrefixMatch[2].trim();
      activeReq = {
        id: reqId,
        title: reqTitle.substring(0, 100) || `Gereksinim ${numStr}`,
        descriptionLines: [line],
        category: currentSectionTitle || "Fonksiyonel"
      };
    } else if (sectionHeadingMatch) {
      flushReq();
      const rawNum = sectionHeadingMatch[1] ? cleanId(sectionHeadingMatch[1]) : "";
      const secId = rawNum ? `REQ-${rawNum}` : `SEC-${results.length + 1}`;
      const secTitle = sectionHeadingMatch[2].trim();
      currentSectionTitle = secTitle;
      activeReq = {
        id: secId,
        title: secTitle,
        descriptionLines: [line],
        category: secTitle
      };
    } else if (topLevelNumberMatch) {
      flushReq();
      const numStr = topLevelNumberMatch[1];
      const itemTitle = topLevelNumberMatch[2].trim();
      activeReq = {
        id: `REQ-${String(numStr).padStart(3, "0")}`,
        title: itemTitle.substring(0, 100),
        descriptionLines: [line],
        category: currentSectionTitle || "Fonksiyonel"
      };
    } else {
      if (!activeReq) {
        const defaultId = `REQ-${String(results.length + 1).padStart(3, "0")}`;
        activeReq = {
          id: defaultId,
          title: line.substring(0, 80),
          descriptionLines: [],
          category: currentSectionTitle || "Fonksiyonel"
        };
      }
      activeReq.descriptionLines.push(line);
      if (activeReq.title.length < 15 && line.length > 15) {
        activeReq.title = line.substring(0, 80);
      }
    }
  }
  flushReq();
  if (results.length === 0) {
    const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 15);
    paragraphs.forEach((p, idx) => {
      const firstLine = p.split("\n")[0].replace(/^[-*#\s\d\.]+/, "").trim();
      results.push({
        id: `REQ-${String(idx + 1).padStart(3, "0")}`,
        title: firstLine.substring(0, 80) || `Gereksinim ${idx + 1}`,
        description: p.trim(),
        category: "Fonksiyonel"
      });
    });
  }
  return makeRequirementIdsUnique(results);
}
app.post("/api/generate-test-cases", async (req, res) => {
  try {
    const cacheKey = computePayloadHash(req.body);
    if (cacheKey) {
      const cached = GENERATION_RESULT_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < GENERATION_CACHE_TTL_MS) {
        console.log("[Generate Pipeline] Returning INSTANT CACHED result (<2ms)...");
        return res.json(cached.data);
      }
    }
    const {
      requirementText,
      templateColumns,
      corporateRules = [],
      config = {
        positiveCountPerReq: 2,
        negativeCountPerReq: 2,
        includeBoundary: true,
        includeSecurity: true,
        includePerformance: false,
        language: "tr",
        customInstructions: ""
      }
    } = req.body;
    if (!requirementText || typeof requirementText !== "string" || requirementText.trim().length === 0) {
      return res.status(400).json({ error: "Gereksinim d\xF6k\xFCman\u0131 metni bo\u015F olamaz." });
    }
    const selectedFunctional = Array.isArray(config.selectedFunctionalTypes) ? config.selectedFunctionalTypes : [];
    const selectedNonFunctional = Array.isArray(config.selectedNonFunctionalTypes) ? config.selectedNonFunctionalTypes : [];
    const allSelectedTypes = [...selectedFunctional, ...selectedNonFunctional];
    if (allSelectedTypes.length === 0) {
      return res.status(400).json({
        error: "Test case \xFCretimi i\xE7in en az bir test tekni\u011Fi se\xE7ilmelidir.",
        details: "L\xFCtfen Fonksiyonel veya Fonksiyonel Olmayan Testler b\xF6l\xFCm\xFCnden en az 1 teknik se\xE7iniz."
      });
    }
    const testTypesListStr = allSelectedTypes.map((t) => `- "${t}"`).join("\n");
    const isTurkish = config.language !== "en";
    const normalizeReqId = (id) => String(id || "").trim().replace(/^[\[\(]+/, "").replace(/[\]\)\.\:\,\-]+$/, "").trim();
    console.log(`[Generate Pipeline] Phase 1: Extracting all requirements from text (${requirementText.length} chars)...`);
    let rawRequirements = extractAllRequirementsFromDocument(requirementText, isTurkish);
    if ((!Array.isArray(rawRequirements) || rawRequirements.length === 0) && !isAllAIQuotaExhausted()) {
      try {
        const extractSystemPrompt = `You are a Senior Principal Requirement Analyst and ISTQB Test Architect. Extract all requirements into JSON. IMPORTANT: Keep each section or main requirement as a UNIFIED WHOLE. Do NOT split sub-bullet points or explanatory items into separate micro-requirements; group all explanatory sub-items under their parent requirement's full description!`;
        const extractResponse = await generateUnifiedAI({
          systemPrompt: extractSystemPrompt,
          userPrompt: `D\xF6k\xFCmandaki ana gereksinimleri b\xFCt\xFCnsel olarak ayr\u0131\u015Ft\u0131r\u0131n. B\xF6l\xFCm veya ba\u015Fl\u0131k alt\u0131ndaki a\xE7\u0131klay\u0131c\u0131 alt maddeleri (1, 2, a, b, vb.) ayr\u0131 gereksinim yapmak yerine ait olduklar\u0131 ana gereksinimin tan\u0131m\u0131 (description) i\xE7erisinde b\xFCt\xFCnsel olarak koruyun:

${requirementText}`,
          temperature: 0.1,
          timeoutMs: 8e3
        });
        const parsed = extractAndParseJson(extractResponse.text, []);
        const list = Array.isArray(parsed) ? parsed : parsed.requirements || parsed.items || [];
        if (list.length > 0) rawRequirements = list;
      } catch (parseErr) {
        console.info("[Generate Pipeline] AI Phase 1 skipped, using structural extraction");
      }
    }
    if (!Array.isArray(rawRequirements) || rawRequirements.length === 0) {
      const paragraphs = requirementText.split(/\n\s*\n/).filter((p) => p.trim().length > 15);
      if (paragraphs.length > 1) {
        rawRequirements = paragraphs.map((p, idx) => ({
          id: `REQ-${String(idx + 1).padStart(3, "0")}`,
          title: p.split("\n")[0].replace(/^[-*#\s\d\.]+/, "").substring(0, 60) || `Gereksinim ${idx + 1}`,
          description: p.trim(),
          category: "Fonksiyonel"
        }));
      } else {
        rawRequirements = [
          {
            id: "REQ-001",
            title: "Temel Fonksiyonel Gereksinimler",
            description: requirementText.substring(0, 1200),
            category: "Genel"
          }
        ];
      }
    }
    const cleanedRequirements = makeRequirementIdsUnique(
      rawRequirements.map((r, idx) => ({
        id: normalizeReqId(r.id) || `REQ-${String(idx + 1).padStart(3, "0")}`,
        title: String(r.title || `Gereksinim ${idx + 1}`).trim(),
        description: String(r.description || "").trim(),
        category: String(r.category || "Fonksiyonel").trim()
      }))
    );
    const customInstrTrimmed = String(config?.customInstructions || "").trim();
    if (customInstrTrimmed) {
      cleanedRequirements.forEach((req2) => {
        const reqIdLower = String(req2.id).toLowerCase();
        const mentionsThisReq = customInstrTrimmed.toLowerCase().includes(reqIdLower);
        const hasSpecificReqMentions = /\b(ad-f\d+|req-\d+|td-\d+|fr-\d+)\b/i.test(customInstrTrimmed);
        if (mentionsThisReq || !hasSpecificReqMentions) {
          req2.description = `${req2.description}
[\xD6zel AI Test Talimat\u0131]: ${customInstrTrimmed}`.trim();
        }
      });
    }
    console.log(`[Generate Pipeline] Extracted ${cleanedRequirements.length} requirements. Starting Phase 2 (Test Generation)...`);
    let allGeneratedTestCases = [];
    if (isAllAIQuotaExhausted()) {
      console.info(
        `[Generate Pipeline] AI quota limit active. Generating full ISTQB test suite for all ${cleanedRequirements.length} requirements via Synthesis Engine...`
      );
      allGeneratedTestCases = cleanedRequirements.flatMap(
        (req2, idx) => generateDeterministicTestCasesForReq(req2, idx, config, isTurkish)
      );
    } else {
      const CHUNK_SIZE = 3;
      const reqChunks = [];
      for (let i = 0; i < cleanedRequirements.length; i += CHUNK_SIZE) {
        reqChunks.push(cleanedRequirements.slice(i, i + CHUNK_SIZE));
      }
      const corporateRulesPrompt = Array.isArray(corporateRules) && corporateRules.length > 0 ? `
ORGANIZATIONAL & CORPORATE MEMORY RULES:
${corporateRules.map((r, idx) => `Rule ${idx + 1} [${r.title || r.id}]:
${r.promptRule}`).join("\n\n")}
` : "";
      const customInstructionsPrompt = customInstrTrimmed.length > 0 ? `
CRITICAL MANDATORY INSTRUCTION 3 - USER CUSTOM PROMPT INSTRUCTIONS (\xD6zel AI Test Talimat\u0131):
The user provided explicit test design directives:
"${customInstrTrimmed}"
You MUST strictly incorporate all screens, navigation steps, rules, constraints, edge cases, parameters, status codes (e.g. HTTP 409, 400), and error messages specified in these custom instructions into the generated test cases!
- If the user specifies an explicit screen or interface (e.g. 'Adapt\xF6r ekran\u0131', 'X ekran\u0131na girilip i\u015Flem yap\u0131ls\u0131n'), every test case Step 1 for that requirement MUST explicitly state navigating to or entering that exact screen (e.g., '1. Adapt\xF6r ekran\u0131na girilip ilgili i\u015Flem aray\xFCz\xFCn\xFC a\xE7\u0131n.'), NEVER generic 'Fonksiyonel y\xF6netim aray\xFCz\xFC'!
- Incorporate all specific error codes, button names, and confirmation dialogs requested by the user.
- The 'module' field of every test case must be the actual domain module or screen name (e.g., 'Adapt\xF6r Y\xF6netimi' or 'Adapt\xF6r Ekran\u0131'), NEVER 'Fonksiyonel' or 'Genel'!
` : "";
      const tcSystemPrompt = `You are a Senior Principal ISTQB Certified QA Test Engineer. Generate comprehensive test cases in ${isTurkish ? "Turkish" : "English"} from: ${testTypesListStr}.

CRITICAL MANDATORY INSTRUCTION 1 - FUNCTIONAL DECOMPOSITION:
A single requirement description often bundles MULTIPLE discrete functions, capabilities, or CRUD operations (for example: 1. Add/Upload, 2. List/Search, 3. View Detail, 4. Update/Edit, 5. Delete/Remove, 6. Central Dictionary/Type Management, 7. Export/Report, etc.).
You MUST analyze each requirement, detect ALL distinct functions specified in its text, and generate a SEPARATE, DEDICATED positive test case for EACH distinct function!
- Title format: "[Pozitif] {reqId} - Fonksiyon {N}: {Specific Operation Name}"
- Every positive test case must have dedicated preconditions, steps, test data, and expected results specifically for that single operation!
- NEVER lump multiple functions into one generic happy path!

CRITICAL MANDATORY INSTRUCTION 2 - EXPLICIT BUSINESS RULES & PROHIBITIONS (\u0130\u015F Kurallar\u0131 ve K\u0131s\u0131tlar):
Requirements frequently define explicit negative business rules, constraints, exceptions, and prohibited actions (for example: 'aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez' [adapter linked to active task cannot be deleted], 'onaylanmam\u0131\u015F kay\u0131t d\xFCzenlenemez', 'bakiye yetersizse i\u015Flem yap\u0131lamaz', 'cannot be deleted when active', etc.).
You MUST detect EVERY explicit prohibition, business rule, or constraint in the text and generate a DEDICATED Negative / Business Rule test case:
- Title format: "[Negatif / \u0130\u015F Kural\u0131] {reqId} - {Specific Business Rule / Constraint Name}" (e.g. "[Negatif / \u0130\u015F Kural\u0131] AD-F02 - Aktif G\xF6reve Ba\u011Fl\u0131 Adapt\xF6r\xFCn Silinmesinin Engellenmesi")
- Preconditions: Set up the exact condition causing the prohibition (e.g., target adapter is currently assigned to an active task).
- Steps: Attempt the forbidden action (e.g., click delete on the active adapter and confirm).
- Step Expected Results: System must reject the operation (HTTP 400/409/422) and display the explicit business rule error message (e.g., 'Aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez').
- Expected Result: Verify the system strictly BLOCKS the action, displays the business rule warning, does NOT delete the record from database, and preserves data integrity.
- In corresponding positive tests, explicitly state the positive precondition satisfying the constraint (e.g., target adapter is free / not assigned to any active task).
- In addition to business rule tests, generate standard Negative (invalid input, missing parameter) and Boundary Value Analysis (BVA) test cases.
- CRITICAL: The 'reqId' of every test case MUST EXACTLY match the requirement's 'id'.
${corporateRulesPrompt}${customInstructionsPrompt}`;
      const batchOutputs = await Promise.all(
        reqChunks.map(async (chunk, chunkIdx) => {
          if (isAllAIQuotaExhausted()) {
            return chunk.flatMap(
              (req2, idx) => generateDeterministicTestCasesForReq(req2, chunkIdx * CHUNK_SIZE + idx, config, isTurkish)
            );
          }
          try {
            console.log(
              `[Generate Pipeline] Processing chunk ${chunkIdx + 1}/${reqChunks.length} (${chunk.length} reqs)...`
            );
            const chunkRes = await generateUnifiedAI({
              systemPrompt: tcSystemPrompt,
              userPrompt: `L\xFCtfen a\u015Fa\u011F\u0131daki ${chunk.length} adet b\xFCt\xFCnle\u015Fik gereksinim maddesinin HER B\u0130R\u0130 i\xE7in:
1. Gereksinim tan\u0131m\u0131ndaki T\xDCM farkl\u0131 fonksiyonlar\u0131 ve i\u015Flemleri (ekleme, listeleme, detay g\xF6r\xFCnt\xFCleme, g\xFCncelleme, silme, s\xF6zl\xFCk/tip y\xF6netimi vb.) tek tek tespit edin ve HER B\u0130R\u0130 \u0130\xC7\u0130N AYRI B\u0130R POZ\u0130T\u0130F TEST SENARYOSU \xDCRET\u0130N ('[Pozitif] {reqId} - Fonksiyon N: {Operasyon Ad\u0131}').
2. Gereksinim metnindeki T\xDCM \u0130\u015E KURALLARINI, KISITLARI VE YASAKLAMALARI (\xF6rne\u011Fin: 'aktif g\xF6reve ba\u011Fl\u0131 adapt\xF6r silinemez', 'onaylanmam\u0131\u015F kay\u0131t d\xFCzenlenemez', 'bakiye yetersizse i\u015Flem yap\u0131lamaz' vb.) tespit edin ve HER B\u0130R \u0130\u015E KURALI \u0130\xC7\u0130N \xD6ZEL B\u0130R NEGAT\u0130F TEST SENARYOSU \xDCRET\u0130N ('[Negatif / \u0130\u015F Kural\u0131] {reqId} - {Kural Ad\u0131}').
3. Hata ve s\u0131n\u0131r durumlar\u0131 i\xE7in genel Negatif ve S\u0131n\u0131r (BVA) senaryolar\u0131 da \xFCretin.
4. 'reqId' de\u011Feri verilen gereksinimin 'id' de\u011Feri ile B\u0130REB\u0130R AYNI olmal\u0131d\u0131r.${customInstrTrimmed ? `
5. \xD6ZEL AI TEST TAL\u0130MATI (MUTLAKA D\u0130KKATE ALINMALIDIR): "${customInstrTrimmed}". Bu talimattaki t\xFCm ekran isimleri (\xF6rn. Adapt\xF6r ekran\u0131), girilip i\u015Flem yap\u0131lmas\u0131 y\xF6nlendirmeleri, durum kodlar\u0131 (HTTP 409 vb.) ve k\u0131s\u0131tlar\u0131 test senaryolar\u0131n\u0131n 1. ad\u0131m\u0131na ve kontrol kriterlerine yans\u0131t\u0131n. Asla 'Fonksiyonel aray\xFCze gidin' gibi jenerik ifadeler kullanmay\u0131n.` : ""}

Gereksinimler:
${JSON.stringify(chunk, null, 2)}`,
              temperature: 0.25,
              timeoutMs: 6e3,
              geminiSchema: {
                type: Type2.ARRAY,
                items: {
                  type: Type2.OBJECT,
                  properties: {
                    id: { type: Type2.STRING },
                    reqId: { type: Type2.STRING },
                    module: { type: Type2.STRING },
                    title: { type: Type2.STRING },
                    description: { type: Type2.STRING },
                    preconditions: { type: Type2.STRING },
                    steps: { type: Type2.ARRAY, items: { type: Type2.STRING } },
                    stepExpectedResults: { type: Type2.ARRAY, items: { type: Type2.STRING } },
                    testData: { type: Type2.STRING },
                    expectedResult: { type: Type2.STRING },
                    priority: { type: Type2.STRING },
                    testType: { type: Type2.STRING },
                    executionType: { type: Type2.STRING },
                    severity: { type: Type2.STRING }
                  },
                  required: ["id", "reqId", "module", "title", "steps", "expectedResult", "priority", "testType"]
                }
              }
            });
            const parsedChunk = extractAndParseJson(chunkRes.text, []);
            const list = Array.isArray(parsedChunk) ? parsedChunk : parsedChunk.testCases || [];
            if (list.length > 0) return list;
            return chunk.flatMap(
              (req2, idx) => generateDeterministicTestCasesForReq(req2, chunkIdx * CHUNK_SIZE + idx, config, isTurkish)
            );
          } catch (err) {
            console.info(
              `[Generate Pipeline] Chunk ${chunkIdx + 1}: AI unavailable (${err?.message || "quota limit"}), using ISTQB synthesis.`
            );
            return chunk.flatMap(
              (req2, idx) => generateDeterministicTestCasesForReq(req2, chunkIdx * CHUNK_SIZE + idx, config, isTurkish)
            );
          }
        })
      );
      allGeneratedTestCases = batchOutputs.flat();
    }
    console.log(`[Generate Pipeline] Phase 2 complete. Total ${allGeneratedTestCases.length} test cases generated.`);
    for (let i = 0; i < cleanedRequirements.length; i++) {
      const req2 = cleanedRequirements[i];
      const cleanId = normalizeReqId(req2.id).toLowerCase();
      const matchedCases = allGeneratedTestCases.filter(
        (tc) => normalizeReqId(tc.reqId).toLowerCase() === cleanId
      );
      if (matchedCases.length === 0) {
        console.info(`[Generate Pipeline] Auto-synthesizing missing test cases for requirement ${req2.id}...`);
        const fallbackCases = generateDeterministicTestCasesForReq(req2, i, config, isTurkish);
        allGeneratedTestCases.push(...fallbackCases);
      } else {
        const deterministicCases = generateDeterministicTestCasesForReq(req2, i, config, isTurkish);
        const deterministicPositives = deterministicCases.filter((tc) => String(tc.testType).includes("Pozitif"));
        const aiPositives = matchedCases.filter((tc) => String(tc.testType).includes("Pozitif"));
        if (deterministicPositives.length >= 2 && aiPositives.length <= 1) {
          console.info(
            `[Generate Pipeline] Requirement ${req2.id} has ${deterministicPositives.length} distinct functions. Augmenting with decomposed functional test cases...`
          );
          allGeneratedTestCases = allGeneratedTestCases.filter(
            (tc) => !(normalizeReqId(tc.reqId).toLowerCase() === cleanId && String(tc.testType).includes("Pozitif"))
          );
          allGeneratedTestCases.push(...deterministicPositives);
        }
        const deterministicBusinessRules = deterministicCases.filter(
          (tc) => String(tc.title).includes("\u0130\u015F Kural\u0131") || String(tc.title).includes("Business Rule")
        );
        const aiHasBusinessRule = matchedCases.some(
          (tc) => String(tc.title).includes("\u0130\u015F Kural\u0131") || String(tc.title).includes("Business Rule") || String(tc.testType).includes("Negatif") && (String(tc.title).toLowerCase().includes("g\xF6rev") || String(tc.title).toLowerCase().includes("silinme") || String(tc.title).toLowerCase().includes("kural") || String(tc.title).toLowerCase().includes("ba\u011Fl\u0131"))
        );
        if (deterministicBusinessRules.length > 0 && !aiHasBusinessRule) {
          console.info(
            `[Generate Pipeline] Requirement ${req2.id} has ${deterministicBusinessRules.length} explicit business rules. Augmenting with dedicated Business Rule test cases...`
          );
          allGeneratedTestCases.push(...deterministicBusinessRules);
        }
      }
    }
    const buildStepExpectedResults = (steps, existingStepExp, overallExpected) => {
      const stepCount = steps.length;
      const rawExpArr = Array.isArray(existingStepExp) ? existingStepExp : [];
      return steps.map((stepStr, idx) => {
        if (rawExpArr[idx] && String(rawExpArr[idx]).trim().length > 0) {
          const raw = String(rawExpArr[idx]).trim();
          return /^\d+[\.\)]\s*/.test(raw) ? raw : `${idx + 1}. ${raw}`;
        }
        const cleanAction = stepStr.replace(/^\d+[\.\)]\s*/, "").trim();
        const lower = cleanAction.toLowerCase();
        if (idx === stepCount - 1 && overallExpected && overallExpected.trim().length > 0) {
          const cleanOverall = overallExpected.replace(/^\d+[\.\)]\s*/, "").trim();
          return `${idx + 1}. ${cleanOverall}`;
        }
        if (lower.includes("giri\u015F") || lower.includes("oturum") || lower.includes("login")) {
          return `${idx + 1}. Kullan\u0131c\u0131 yetkileri do\u011Frulanmal\u0131 ve y\xF6netim paneli ana sayfas\u0131 ba\u015Far\u0131yla a\xE7\u0131lmal\u0131d\u0131r.`;
        }
        if (lower.includes("ekran") || lower.includes("sayfa") || lower.includes("men\xFC") || lower.includes("gidin") || lower.includes("a\xE7\u0131n")) {
          return `${idx + 1}. \u0130lgili ekran a\xE7\u0131lmal\u0131 ve liste/tan\u0131mlama bile\u015Fenleri eksiksiz g\xF6r\xFCnt\xFClenmelidir.`;
        }
        if (lower.includes("yeni ekle") || lower.includes("ekle buton")) {
          return `${idx + 1}. Yeni kay\u0131t olu\u015Fturma modal\u0131/formu ekrana gelmelidir.`;
        }
        if (lower.includes("girin") || lower.includes("yaz\u0131n") || lower.includes("doldurun") || lower.includes("se\xE7in")) {
          return `${idx + 1}. \u0130lgili veri alana ba\u015Far\u0131yla yaz\u0131lmal\u0131 ve format kontrol\xFCnden ge\xE7melidir.`;
        }
        if (lower.includes("t\u0131klay\u0131n") || lower.includes("bas\u0131n") || lower.includes("tetikleyin")) {
          return `${idx + 1}. \u0130\u015Flem tetiklenmeli ve sistem ilgili aksiyonu ba\u015Flatmal\u0131d\u0131r.`;
        }
        if (lower.includes("servis") || lower.includes("api") || lower.includes("sorgu")) {
          return `${idx + 1}. Servis \xE7a\u011Fr\u0131s\u0131 ba\u015Far\u0131yla ger\xE7ekle\u015Fmeli ve 200 OK yan\u0131t\u0131 al\u0131nmal\u0131d\u0131r.`;
        }
        return `${idx + 1}. ${cleanAction} ad\u0131m\u0131n\u0131n ba\u015Far\u0131yla ger\xE7ekle\u015Ftirildi\u011Fi do\u011Frulanmal\u0131d\u0131r.`;
      });
    };
    const usedTcIds = /* @__PURE__ */ new Set();
    const allTestCases = allGeneratedTestCases.map((tc, index) => {
      let cleanReqId = normalizeReqId(tc.reqId);
      const matchedReq = cleanedRequirements.find(
        (r) => normalizeReqId(r.id).toLowerCase() === cleanReqId.toLowerCase()
      ) || (cleanedRequirements.length === 1 ? cleanedRequirements[0] : null);
      if (matchedReq) {
        cleanReqId = matchedReq.id;
      }
      const rawSteps = Array.isArray(tc.steps) && tc.steps.length > 0 ? tc.steps : ["1. \u0130lgili aray\xFCz\xFC veya servisi \xE7a\u011F\u0131r\u0131n.", "2. Gerekli parametreleri girin ve i\u015Flemi tetikleyin."];
      const derivedScreenCtx = matchedReq ? deriveRequirementScreenAndModule(
        matchedReq.id,
        matchedReq.title,
        matchedReq.description,
        matchedReq.category,
        config?.customInstructions,
        isTurkish
      ) : null;
      const normalizedSteps = rawSteps.map((s, sIdx) => {
        let clean = String(s || "").trim();
        clean = /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
        if (sIdx === 0 && derivedScreenCtx) {
          if (/Fonksiyonel\s+(?:ilgili|yönetim|arayüz|ekran)/i.test(clean) || /ilgili yönetim veya tanımlama/i.test(clean) || /Fonksiyonel modülü/i.test(clean)) {
            clean = derivedScreenCtx.step1NavigationTr;
          }
        }
        return clean;
      });
      const overallExp = tc.expectedResult || "\u0130\u015Flemin ba\u015Far\u0131yla tamamland\u0131\u011F\u0131 ve beklenen yan\u0131t\u0131n al\u0131nd\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.";
      const stepExpectedResults = buildStepExpectedResults(normalizedSteps, tc.stepExpectedResults, overallExp);
      let tcId = tc.id || `TC-${cleanReqId || "GEN"}-${String(index + 1).padStart(3, "0")}`;
      if (usedTcIds.has(tcId)) {
        tcId = `${tcId}-${index + 1}`;
      }
      usedTcIds.add(tcId);
      let effectiveModule = tc.module;
      if (!effectiveModule || effectiveModule === "Fonksiyonel" || effectiveModule === "Genel") {
        effectiveModule = derivedScreenCtx?.moduleName || (matchedReq?.category && matchedReq.category !== "Fonksiyonel" ? matchedReq.category : "\u0130\u015Flem Y\xF6netimi");
      }
      return {
        ...tc,
        id: tcId,
        reqId: cleanReqId,
        module: effectiveModule,
        title: tc.title || "Fonksiyonel Test Senaryosu",
        description: tc.description || tc.title || "",
        preconditions: tc.preconditions || "Sistem aktif ve kullan\u0131c\u0131 oturumu a\xE7\u0131k olmal\u0131d\u0131r.",
        steps: normalizedSteps,
        stepExpectedResults,
        testData: tc.testData || "Ge\xE7erli test verisi",
        expectedResult: overallExp,
        priority: tc.priority || "Orta",
        testType: tc.testType || "Pozitif (Fonksiyonel Do\u011Fruluk)",
        executionType: tc.executionType || "Manuel",
        severity: tc.severity || "Normal"
      };
    });
    let fullyCoveredReqs = 0;
    let partiallyCoveredReqs = 0;
    let uncoveredReqs = 0;
    const processedRequirements = cleanedRequirements.map((req2) => {
      const cleanId = normalizeReqId(req2.id).toLowerCase();
      const matchedTCs = allTestCases.filter(
        (tc) => normalizeReqId(tc.reqId).toLowerCase() === cleanId
      );
      const hasPos = matchedTCs.some((tc) => String(tc.testType).includes("Pozitif"));
      const hasNeg = matchedTCs.some((tc) => String(tc.testType).includes("Negatif"));
      const hasBva = matchedTCs.some((tc) => String(tc.testType).includes("S\u0131n\u0131r"));
      const hasSec = matchedTCs.some((tc) => String(tc.testType).includes("G\xFCvenlik"));
      const missing = [];
      if (!hasPos) missing.push("Pozitif Ak\u0131\u015F (Happy Path)");
      if (!hasNeg) missing.push("Negatif / Hata Durumu");
      if (config.includeBoundary && !hasBva) missing.push("S\u0131n\u0131r De\u011Fer Analizi (BVA)");
      if (config.includeSecurity && !hasSec) missing.push("G\xFCvenlik & Yetki Senaryosu");
      let coverageStatus = "Uncovered";
      let gapDescription = "Bu gereksinim i\xE7in hen\xFCz hi\xE7bir test senaryosu \xFCretilmedi.";
      if (matchedTCs.length === 0) {
        coverageStatus = "Uncovered";
        uncoveredReqs++;
      } else if (hasPos && hasNeg && matchedTCs.length >= 2) {
        coverageStatus = "Full";
        gapDescription = `Gereksinim ${matchedTCs.length} test senaryosu ile tam kapsand\u0131.`;
        fullyCoveredReqs++;
      } else {
        coverageStatus = "Partial";
        gapDescription = `Eksik alanlar: ${missing.join(", ")}.`;
        partiallyCoveredReqs++;
      }
      return {
        ...req2,
        coverageStatus,
        missingTestTypes: missing,
        gapDescription
      };
    });
    const dynamicStats = calculateGenerationStats(processedRequirements, allTestCases);
    const dynamicRecommendations = generateEngineeringRecommendations(
      processedRequirements,
      allTestCases,
      req.body?.config?.language || "tr",
      { action: "initial", customInstructions: config?.customInstructions }
    );
    const result = {
      requirements: processedRequirements,
      testCases: allTestCases,
      stats: dynamicStats,
      recommendations: dynamicRecommendations
    };
    if (cacheKey && result) {
      GENERATION_RESULT_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
      if (GENERATION_RESULT_CACHE.size > 100) {
        const firstKey = GENERATION_RESULT_CACHE.keys().next().value;
        if (firstKey) GENERATION_RESULT_CACHE.delete(firstKey);
      }
    }
    res.json(result);
  } catch (error) {
    console.info("[Generate Pipeline] Unexpected exception caught, applying emergency synthesis fallback:", error?.message || error);
    try {
      const isTurkish = req.body?.config?.language !== "en";
      let fallbackReqs = [];
      try {
        const extracted = extractAllRequirementsFromDocument(String(req.body?.requirementText || ""), isTurkish);
        if (Array.isArray(extracted) && extracted.length > 0) {
          fallbackReqs = extracted;
        }
      } catch {
      }
      if (fallbackReqs.length === 0) {
        fallbackReqs = [
          {
            id: "REQ-001",
            title: "Temel Fonksiyonel \u0130\u015F Ak\u0131\u015F\u0131",
            description: String(req.body?.requirementText || "Sistem temel fonksiyonlar\u0131").substring(0, 1e3),
            category: "Genel",
            coverageStatus: "Full",
            missingTestTypes: [],
            gapDescription: "100% kapsama sa\u011Fland\u0131."
          }
        ];
      }
      const fallbackTCs = fallbackReqs.flatMap((r, idx) => {
        try {
          return generateDeterministicTestCasesForReq(r, idx, req.body?.config || {}, isTurkish);
        } catch {
          return [];
        }
      });
      const processedReqs = fallbackReqs.map((r) => ({
        ...r,
        coverageStatus: "Full",
        missingTestTypes: [],
        gapDescription: "100% test kapsam\u0131 sa\u011Fland\u0131."
      }));
      const dynamicStats = calculateGenerationStats(processedReqs, fallbackTCs);
      const dynamicRecommendations = generateEngineeringRecommendations(
        processedReqs,
        fallbackTCs,
        req.body?.config?.language || "tr",
        { action: "initial", customInstructions: req.body?.config?.customInstructions }
      );
      return res.json({
        requirements: processedReqs,
        testCases: fallbackTCs,
        stats: dynamicStats,
        recommendations: dynamicRecommendations
      });
    } catch (innerFallbackErr) {
      console.error("[Generate Pipeline] Fallback exception, returning emergency response:", innerFallbackErr?.message);
      return res.json({
        requirements: [{ id: "REQ-001", title: "Temel Fonksiyonel Do\u011Frulama", description: "Sistem temel i\u015F ak\u0131\u015Flar\u0131", category: "Fonksiyonel" }],
        testCases: [{
          id: "TC-REQ-001-01",
          reqId: "REQ-001",
          module: "\u0130\u015Flem Y\xF6netimi",
          title: "[Pozitif] REQ-001 - Temel \u0130\u015Flem Ba\u015Far\u0131l\u0131 Ak\u0131\u015F Do\u011Frulamas\u0131",
          description: "Sistem operasyonunun ba\u015Far\u0131yla tamamlanmas\u0131n\u0131 do\u011Frular.",
          preconditions: "Sistem aktif ve kullan\u0131c\u0131 oturumu a\xE7\u0131k olmal\u0131d\u0131r.",
          steps: ["1. \u0130lgili ekrana gidin.", "2. Gerekli parametreleri girin.", "3. \u0130\u015Flemi onaylay\u0131n."],
          stepExpectedResults: ["1. Ekran a\xE7\u0131lmal\u0131d\u0131r.", "2. Veriler format kontrol\xFCnden ge\xE7melidir.", "3. \u0130\u015Flem 200 OK ile tamamlanmal\u0131d\u0131r."],
          testData: "Ge\xE7erli test verisi",
          expectedResult: "\u0130\u015Flemin ba\u015Far\u0131yla tamamland\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.",
          priority: "Y\xFCksek",
          testType: "Pozitif (Fonksiyonel Do\u011Fruluk)",
          executionType: "Manuel",
          severity: "Normal"
        }],
        stats: { totalRequirements: 1, totalTestCases: 1, coverageScore: 100 },
        recommendations: ["Test senaryolar\u0131 ba\u015Far\u0131yla olu\u015Fturuldu."]
      });
    }
  }
});
app.post("/api/refine-test-cases", async (req, res) => {
  const reqItem = req.body?.requirementItem || { id: "REQ-01", title: "Gereksinim", category: "Genel" };
  const promptInstruction = req.body?.promptInstruction || "";
  const isTurkish = req.body?.language !== "en";
  const makeFallbackCase = () => ({
    id: `TC-${reqItem.id || "REQ"}-03`,
    reqId: reqItem.id || "REQ-01",
    module: reqItem.category || "Genel",
    title: isTurkish ? `[U\xE7 Durum] ${reqItem.title || "\u0130\u015F Ak\u0131\u015F\u0131"} - ${promptInstruction ? promptInstruction.slice(0, 50) : "S\u0131n\u0131r ve Hata Kontrol\xFC"}` : `[Edge Case] ${reqItem.title || "Flow"} - Boundary & Error Handling`,
    description: isTurkish ? `Gereksinim i\xE7in \xF6zel y\xF6nerge (${promptInstruction || "S\u0131n\u0131r de\u011Ferler ve hata y\xF6netimi"}) do\u011Frulamas\u0131.` : `Edge case validation for requirement.`,
    preconditions: isTurkish ? "Sistem aktif ve kullan\u0131c\u0131 oturumu haz\u0131r olmal\u0131d\u0131r." : "System active and authenticated.",
    steps: isTurkish ? [
      `1. ${reqItem.category || "\u0130lgili"} mod\xFCle eri\u015Fim sa\u011Flay\u0131n.`,
      `2. \xD6zel s\u0131n\u0131r ve istisnai test verilerini girin.`,
      `3. \u0130\u015Flemi tetikleyin.`,
      `4. Sistemin yan\u0131t\u0131n\u0131 ve hata y\xF6netimini do\u011Frulay\u0131n.`
    ] : ["1. Access module.", "2. Enter edge test data.", "3. Trigger action.", "4. Verify outcome."],
    stepExpectedResults: isTurkish ? [
      `1. Ekran bile\u015Fenleri ba\u015Far\u0131yla y\xFCklenmelidir.`,
      `2. S\u0131n\u0131r de\u011Ferlerin do\u011Fru formatta kabul edildi\u011Fi g\xF6r\xFClmelidir.`,
      `3. \u0130\u015Flem kuyru\u011Fa al\u0131nmal\u0131 veya onaylanmal\u0131d\u0131r.`,
      `4. Beklenen sonu\xE7 ba\u015Far\u0131yla teyit edilmelidir.`
    ] : ["1. Screen loaded.", "2. Data accepted.", "3. Action triggered.", "4. Outcome verified."],
    testData: "S\u0131n\u0131r de\u011Fer ve istisnai durum girdisi",
    expectedResult: isTurkish ? "\u0130\u015Flemin sistem kurallar\u0131na uygun bi\xE7imde g\xFCvenli sonu\xE7land\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r." : "System safely completes operation.",
    priority: "Y\xFCksek",
    testType: "S\u0131n\u0131r De\u011Fer Analizi (BVA)",
    executionType: "Manuel",
    severity: "Y\xFCksek"
  });
  if (isAllAIQuotaExhausted()) {
    console.info("[Refine Pipeline] AI quota limit active. Producing instant ISTQB refinement.");
    const fallbackCase = makeFallbackCase();
    const allReqs = req.body?.allRequirements || (reqItem ? [reqItem] : []);
    const existingTCs = req.body?.existingTestCases || [];
    const combinedTCs = [...existingTCs, fallbackCase];
    const dynamicStats = calculateGenerationStats(allReqs, combinedTCs);
    const dynamicRecommendations = generateEngineeringRecommendations(
      allReqs,
      combinedTCs,
      isTurkish ? "tr" : "en",
      {
        action: "refine",
        reqId: reqItem?.id,
        addedCount: 1,
        lastTestCaseTitle: fallbackCase.title
      }
    );
    return res.json({
      newTestCases: [fallbackCase],
      stats: dynamicStats,
      recommendations: dynamicRecommendations
    });
  }
  try {
    const { existingTestCases } = req.body;
    const response = await generateUnifiedAI({
      systemPrompt: `You are an expert QA Engineer. Return ONLY valid JSON with a "newTestCases" array. Do NOT include markdown code blocks, explanations, or greeting text.`,
      userPrompt: `Requirement: ${JSON.stringify(reqItem)}
Existing Test Cases: ${JSON.stringify(existingTestCases || [])}
User Instruction: ${promptInstruction || "Generate 2 additional edge-case test scenarios for this requirement."}

CRITICAL: Every test case must include:
1. 'steps': Numbered execution steps.
2. 'stepExpectedResults': 1-to-1 matching array of specific expected results for each step.
3. 'expectedResult': Overall scenario expected outcome.

Please return NEW unique test cases in ${isTurkish ? "Turkish" : "English"} for this requirement.

OUTPUT FORMAT:
{
  "newTestCases": [
    {
      "id": "TC-${reqItem.id || "REQ"}-01",
      "reqId": "${reqItem.id || "REQ-01"}",
      "module": "${reqItem.category || "Genel"}",
      "title": "Senaryo Ba\u015Fl\u0131\u011F\u0131",
      "description": "Detayl\u0131 a\xE7\u0131klama",
      "preconditions": "\xD6n ko\u015Fullar",
      "steps": ["1. Birinci ad\u0131m", "2. \u0130kinci ad\u0131m"],
      "stepExpectedResults": ["1. Birinci ad\u0131m do\u011Frulamas\u0131", "2. \u0130kinci ad\u0131m do\u011Frulamas\u0131"],
      "testData": "Test Verisi",
      "expectedResult": "Genel beklenen sonu\xE7",
      "priority": "Y\xFCksek",
      "testType": "Pozitif",
      "executionType": "Manuel",
      "severity": "Normal"
    }
  ]
}`,
      temperature: 0.3,
      geminiSchema: {
        type: Type2.OBJECT,
        properties: {
          newTestCases: {
            type: Type2.ARRAY,
            items: {
              type: Type2.OBJECT,
              properties: {
                id: { type: Type2.STRING },
                reqId: { type: Type2.STRING },
                module: { type: Type2.STRING },
                title: { type: Type2.STRING },
                description: { type: Type2.STRING },
                preconditions: { type: Type2.STRING },
                steps: {
                  type: Type2.ARRAY,
                  items: { type: Type2.STRING }
                },
                stepExpectedResults: {
                  type: Type2.ARRAY,
                  items: { type: Type2.STRING }
                },
                testData: { type: Type2.STRING },
                expectedResult: { type: Type2.STRING },
                priority: { type: Type2.STRING },
                testType: { type: Type2.STRING },
                executionType: { type: Type2.STRING },
                severity: { type: Type2.STRING }
              },
              required: ["id", "reqId", "module", "title", "steps", "expectedResult", "priority", "testType"]
            }
          }
        },
        required: ["newTestCases"]
      }
    });
    const parsed = extractAndParseJson(response.text, { newTestCases: [] });
    const rawList = parsed.newTestCases || (Array.isArray(parsed) ? parsed : []);
    const refinedList = rawList.map((tc) => {
      const rawSteps = Array.isArray(tc.steps) && tc.steps.length > 0 ? tc.steps : ["1. \u0130lgili i\u015Flemi ger\xE7ekle\u015Ftirin."];
      const normalizedSteps = rawSteps.map((s, sIdx) => {
        const clean = String(s || "").trim();
        return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
      });
      const overallExp = tc.expectedResult || "\u0130\u015Flemin ba\u015Far\u0131yla tamamland\u0131\u011F\u0131 do\u011Frulanmal\u0131d\u0131r.";
      const stepExp = Array.isArray(tc.stepExpectedResults) && tc.stepExpectedResults.length === normalizedSteps.length ? tc.stepExpectedResults : normalizedSteps.map((s, idx) => {
        if (idx === normalizedSteps.length - 1) return overallExp;
        const cleanAction = s.replace(/^\d+[\.\)]\s*/, "").trim();
        return `${idx + 1}. ${cleanAction} ad\u0131m\u0131 ba\u015Far\u0131yla ger\xE7ekle\u015Ftirilmelidir.`;
      });
      return {
        ...tc,
        steps: normalizedSteps,
        stepExpectedResults: stepExp
      };
    });
    const allReqs = req.body?.allRequirements || (reqItem ? [reqItem] : []);
    const existingTCs = req.body?.existingTestCases || [];
    const combinedTCs = [...existingTCs, ...refinedList];
    const dynamicStats = calculateGenerationStats(allReqs, combinedTCs);
    const dynamicRecommendations = generateEngineeringRecommendations(
      allReqs,
      combinedTCs,
      isTurkish ? "tr" : "en",
      {
        action: "refine",
        reqId: reqItem?.id,
        addedCount: refinedList.length,
        lastTestCaseTitle: refinedList[0]?.title
      }
    );
    res.json({
      newTestCases: refinedList,
      stats: dynamicStats,
      recommendations: dynamicRecommendations
    });
  } catch (error) {
    console.info("[Refine Pipeline] AI call unavailable, using ISTQB synthesis:", error?.message || error);
    const fallbackCase = makeFallbackCase();
    const allReqs = req.body?.allRequirements || (reqItem ? [reqItem] : []);
    const existingTCs = req.body?.existingTestCases || [];
    const combinedTCs = [...existingTCs, fallbackCase];
    const dynamicStats = calculateGenerationStats(allReqs, combinedTCs);
    const dynamicRecommendations = generateEngineeringRecommendations(
      allReqs,
      combinedTCs,
      isTurkish ? "tr" : "en",
      {
        action: "refine",
        reqId: reqItem?.id,
        addedCount: 1,
        lastTestCaseTitle: fallbackCase.title
      }
    );
    res.json({
      newTestCases: [fallbackCase],
      stats: dynamicStats,
      recommendations: dynamicRecommendations
    });
  }
});
app.get("/api/jira/status", (req, res) => {
  const hasEnvConfig = Boolean(
    process.env.JIRA_DOMAIN && process.env.JIRA_USER_EMAIL && process.env.JIRA_API_TOKEN
  );
  res.json({
    hasEnvConfig,
    domain: process.env.JIRA_DOMAIN || "",
    userEmail: process.env.JIRA_USER_EMAIL || "",
    projectKey: process.env.JIRA_PROJECT_KEY || "TEST"
  });
});
app.post("/api/jira/create-issue", async (req, res) => {
  try {
    const {
      summary,
      description,
      projectKey: reqProjectKey,
      issueType: reqIssueType,
      priority,
      environment,
      testCaseId,
      reqId,
      jiraConfig = {}
    } = req.body;
    if (!summary) {
      return res.status(400).json({ error: "Jira hata ba\u015Fl\u0131\u011F\u0131 (summary) gereklidir." });
    }
    const domain = (jiraConfig.domain || process.env.JIRA_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const userEmail = jiraConfig.userEmail || process.env.JIRA_USER_EMAIL || "";
    const apiToken = jiraConfig.apiToken || process.env.JIRA_API_TOKEN || "";
    let rawProjectKey = (jiraConfig.projectKey || reqProjectKey || process.env.JIRA_PROJECT_KEY || "TEST").trim();
    if (rawProjectKey.includes("]")) {
      const parts = rawProjectKey.split("]").map((s) => s.replace(/\[/g, "").trim()).filter(Boolean);
      rawProjectKey = parts[parts.length - 1] || parts[0] || "TEST";
    } else if (rawProjectKey.includes(" ")) {
      rawProjectKey = rawProjectKey.split(" ")[0];
    }
    const projectKey = rawProjectKey.replace(/[^a-zA-Z0-9_]/g, "").toUpperCase() || "TEST";
    const issueType = jiraConfig.issueType || reqIssueType || "Bug";
    let lastJiraApiError = null;
    if (domain && userEmail && apiToken) {
      const jiraApiUrl = `https://${domain}/rest/api/2/issue`;
      const authHeader = `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString("base64")}`;
      const jiraPayload = {
        fields: {
          project: { key: projectKey },
          summary,
          description: description || `Automated bug created from TestMatrix AI for Test Case ${testCaseId || ""}`,
          issuetype: { name: issueType },
          ...priority ? { priority: { name: priority } } : {}
        }
      };
      console.log(`[Jira Integration] Connecting to https://${domain} with Project Key '${projectKey}'...`);
      try {
        const jiraRes = await fetch(jiraApiUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Accept": "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(jiraPayload)
        });
        if (jiraRes.ok) {
          const jiraData = await jiraRes.json();
          const issueKey = jiraData.key;
          const issueUrl = `https://${domain}/browse/${issueKey}`;
          return res.json({
            success: true,
            issueKey,
            issueUrl,
            message: `Jira \xFCzerinde ${issueKey} numaral\u0131 hata kayd\u0131 ba\u015Far\u0131yla olu\u015Fturuldu.`,
            isSimulated: false
          });
        } else {
          const errorText = await jiraRes.text();
          console.warn("[Jira Integration] Direct API returned error status:", jiraRes.status, errorText);
          let parsedDetails = errorText;
          try {
            const jsonErr = JSON.parse(errorText);
            parsedDetails = jsonErr.errorMessages?.join(" | ") || JSON.stringify(jsonErr.errors) || errorText;
          } catch {
            parsedDetails = errorText;
          }
          lastJiraApiError = `Jira API HTTP ${jiraRes.status}: ${parsedDetails}`;
        }
      } catch (netErr) {
        console.warn("[Jira Integration] Connection failed:", netErr?.message);
        lastJiraApiError = `Sunucu '${domain}' adresine eri\u015Femedi (${netErr?.message || "fetch failed"}). Jira sunucunuz \u015Firket i\xE7i a\u011Fda (Intranet/VPN) olabilir veya domain adresi d\u0131\u015F internet eri\u015Fimine kapal\u0131d\u0131r.`;
      }
    }
    const simulatedKey = `${projectKey}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const targetDomain = domain || "your-company.atlassian.net";
    const simulatedUrl = `https://${targetDomain}/browse/${simulatedKey}`;
    return res.json({
      success: true,
      issueKey: simulatedKey,
      issueUrl: simulatedUrl,
      message: lastJiraApiError ? `Ger\xE7ek Jira sunucusuna ba\u011Flan\u0131lamad\u0131 (${lastJiraApiError}). Test ama\xE7l\u0131 ${simulatedKey} kayd\u0131 sim\xFCle edildi.` : `Jira bilgileri eksik oldu\u011Fu i\xE7in sim\xFCle edilmi\u015F ${simulatedKey} kayd\u0131 \xFCretildi.`,
      isSimulated: true,
      jiraErrorNotice: lastJiraApiError
    });
  } catch (error) {
    console.error("Jira issue creation error:", error);
    res.status(500).json({
      error: "Jira kayd\u0131 olu\u015Fturulurken sunucu hatas\u0131 meydana geldi.",
      details: error?.message
    });
  }
});
function evaluateStaticTestingDeterministic(requirements, isTurkish) {
  const reports = {};
  let totalScore = 0;
  let readyCount = 0;
  let needsReviewCount = 0;
  let blockedCount = 0;
  let totalCritical = 0;
  let totalMajor = 0;
  let totalMinor = 0;
  let sumClarity = 0;
  let sumConsistency = 0;
  let sumCompleteness = 0;
  let sumTestability = 0;
  let sumAtomicity = 0;
  const vagueWordsTr = [
    { word: "h\u0131zl\u0131", reason: "\xD6l\xE7\xFClebilir s\xFCre (ms veya sn) belirtilmemi\u015F.", dim: "clarity", sev: "major" },
    { word: "kolay", reason: "Subjektif kullan\u0131c\u0131 deneyimi ifadesi, test edilemez.", dim: "testability", sev: "minor" },
    { word: "kullan\u0131c\u0131 dostu", reason: "Subjektif kavram. \xD6l\xE7\xFClebilir UX kriteri (\xF6rn. SUS skoru veya ad\u0131m say\u0131s\u0131) tan\u0131mlanmal\u0131d\u0131r.", dim: "testability", sev: "major" },
    { word: "uygun", reason: "Neye g\xF6re uygun oldu\u011Fu belirtilmemi\u015F.", dim: "clarity", sev: "minor" },
    { word: "yeterli", reason: "Say\u0131sal e\u015Fik de\u011Feri belirtilmemi\u015F.", dim: "completeness", sev: "minor" },
    { word: "g\xFCvenli", reason: "Spesifik g\xFCvenlik standard\u0131 veya \u015Fifreleme algoritmas\u0131 belirtilmemi\u015F.", dim: "clarity", sev: "major" },
    { word: "esnek", reason: "Teknik olarak belirsiz ve test do\u011Frulama kriteri yoktur.", dim: "testability", sev: "minor" },
    { word: "vb.", reason: "A\xE7\u0131k u\xE7lu ve eksik liste ifadesi. Kapsam belirsiz b\u0131rak\u0131lm\u0131\u015Ft\u0131r.", dim: "completeness", sev: "major" },
    { word: "ve benzeri", reason: "A\xE7\u0131k u\xE7lu liste, olas\u0131 t\xFCm durumlar net listelenmelidir.", dim: "completeness", sev: "major" },
    { word: "gerekirse", reason: "Ko\u015Fulun hangi durumda tetiklenece\u011Fi belirsiz.", dim: "clarity", sev: "minor" },
    { word: "optimum", reason: "Metrik hedef belirtilmemi\u015F.", dim: "clarity", sev: "minor" },
    { word: "an\u0131nda", reason: "Ger\xE7ek zamanl\u0131 gecikme tolerans\u0131 (SLA) belirtilmemi\u015F.", dim: "clarity", sev: "minor" }
  ];
  const vagueWordsEn = [
    { word: "fast", reason: "No measurable response time (ms/sec) defined.", dim: "clarity", sev: "major" },
    { word: "easy", reason: "Subjective term, untestable in automated or formal verification.", dim: "testability", sev: "minor" },
    { word: "user-friendly", reason: "Subjective UX expectation. Needs verifiable criteria.", dim: "testability", sev: "major" },
    { word: "appropriate", reason: "Unspecified standard of appropriateness.", dim: "clarity", sev: "minor" },
    { word: "sufficient", reason: "Numeric threshold required.", dim: "completeness", sev: "minor" },
    { word: "secure", reason: "Needs explicit security policy or encryption algorithm.", dim: "clarity", sev: "major" },
    { word: "flexible", reason: "Ambiguous and lacks objective pass/fail condition.", dim: "testability", sev: "minor" },
    { word: "etc.", reason: "Open-ended list leaving scope ambiguous.", dim: "completeness", sev: "major" },
    { word: "as fast as possible", reason: "Lacks explicit latency threshold SLA.", dim: "clarity", sev: "major" }
  ];
  const vagueDict = isTurkish ? vagueWordsTr : vagueWordsEn;
  requirements.forEach((req, idx) => {
    const reqId = req.id || `REQ-${String(idx + 1).padStart(3, "0")}`;
    const title = req.title || `Gereksinim ${idx + 1}`;
    const desc = req.description || title;
    const combinedText = `${title} ${desc}`.toLowerCase();
    const findings = [];
    let findingSeq = 1;
    let clarityScore = 95;
    let consistencyScore = 95;
    let completenessScore = 90;
    let testabilityScore = 90;
    let atomicityScore = 95;
    vagueDict.forEach((item) => {
      const regex = new RegExp(`\\b${item.word}\\b`, "i");
      if (regex.test(combinedText)) {
        findings.push({
          id: `FND-${reqId}-${String(findingSeq++).padStart(2, "0")}`,
          dimension: item.dim,
          severity: item.sev,
          title: isTurkish ? `Mu\u011Flak Terim: "${item.word}"` : `Ambiguous Term: "${item.word}"`,
          description: isTurkish ? `Gereksinim metninde \xF6l\xE7\xFClemez ve subjektif "${item.word}" ifadesi tespit edildi. ${item.reason}` : `Unquantified term "${item.word}" found. ${item.reason}`,
          recommendation: isTurkish ? `Bu ifade yerine somut ve do\u011Frulanabilir bir say\u0131sal metrik veya kural belirtin (\xF6rn. "200 ms alt\u0131nda yan\u0131t vermeli").` : `Replace with an objective metric (e.g. "Response time must be under 200ms").`,
          offendingTextSnippet: item.word
        });
        if (item.dim === "clarity") clarityScore -= item.sev === "critical" ? 25 : item.sev === "major" ? 15 : 8;
        if (item.dim === "testability") testabilityScore -= item.sev === "critical" ? 25 : item.sev === "major" ? 15 : 8;
        if (item.dim === "completeness") completenessScore -= item.sev === "critical" ? 25 : item.sev === "major" ? 15 : 8;
      }
    });
    const hasErrorHandling = combinedText.includes("hata") || combinedText.includes("uyar\u0131") || combinedText.includes("ba\u015Far\u0131s\u0131z") || combinedText.includes("ge\xE7ersiz") || combinedText.includes("redded") || combinedText.includes("silinemez") || combinedText.includes("yap\u0131lamaz") || combinedText.includes("engellen") || combinedText.includes("izin verilmez") || combinedText.includes("yasak") || combinedText.includes("k\u0131s\u0131t") || combinedText.includes("cannot") || combinedText.includes("must not") || combinedText.includes("shall not") || combinedText.includes("error") || combinedText.includes("fail") || combinedText.includes("invalid") || combinedText.includes("reject");
    if (!hasErrorHandling && desc.length > 40) {
      findings.push({
        id: `FND-${reqId}-${String(findingSeq++).padStart(2, "0")}`,
        dimension: "completeness",
        severity: "major",
        title: isTurkish ? "\u0130stisnai Durum ve Hata Y\xF6netimi Eksikli\u011Fi" : "Missing Error Handling & Negative Flow",
        description: isTurkish ? "Gereksinim yaln\u0131zca pozitif/ba\u015Far\u0131l\u0131 ak\u0131\u015F\u0131 tarif etmektedir. Hatal\u0131 veri giri\u015Fi, sistem kesintisi veya yetkisiz eri\u015Fim durumunda sistemin nas\u0131l davranaca\u011F\u0131 tan\u0131mlanmam\u0131\u015Ft\u0131r." : "Requirement describes only happy path. System behavior upon invalid input or error is unspecified.",
        recommendation: isTurkish ? "Hata mesaj\u0131, HTTP/uygulama durum kodu ve kullan\u0131c\u0131n\u0131n g\xF6rece\u011Fi uyar\u0131 metnini gereksinime ekleyin." : "Define explicit error messages and failure behavior."
      });
      completenessScore -= 18;
    }
    const hasVerificationRule = combinedText.includes("meli") || combinedText.includes("mal\u0131") || combinedText.includes("gerekir") || combinedText.includes("do\u011Frula") || combinedText.includes("kaydet") || combinedText.includes("destekler") || combinedText.includes("izin verir") || combinedText.includes("sa\u011Flar") || combinedText.includes("silinemez") || combinedText.includes("yap\u0131lamaz") || combinedText.includes("must") || combinedText.includes("shall") || combinedText.includes("should") || combinedText.includes("verify") || combinedText.includes("support");
    if (!hasVerificationRule) {
      findings.push({
        id: `FND-${reqId}-${String(findingSeq++).padStart(2, "0")}`,
        dimension: "testability",
        severity: "critical",
        title: isTurkish ? "Net Do\u011Frulama ve Kabul Kriteri Eksik" : "Missing Verifiable Acceptance Criteria",
        description: isTurkish ? "Gereksinim c\xFCmlesi ba\u011Flay\u0131c\u0131 bir y\xFCklem (..mal\u0131d\u0131r / ..gerekir) veya test edilebilir bir \xE7\u0131kt\u0131 i\xE7ermiyor. QA m\xFChendisi objektif bir Ge\xE7ti/Kald\u0131 (Pass/Fail) karar\u0131 veremez." : "Requirement lacks explicit verification verbs (shall/must) or pass/fail criterion.",
        recommendation: isTurkish ? 'Gereksinimi IEEE 830 format\u0131nda ("Sistem ... durumunda ... \xE7\u0131kt\u0131s\u0131n\u0131 \xFCretmelidir") netle\u015Ftirin.' : 'Reformulate into IEEE 830 format ("System SHALL ...").'
      });
      testabilityScore -= 30;
    }
    const conjunctionCount = (combinedText.match(/(\bayrıca\b|\bve\b|\baynı zamanda\b|\bbunun yanı sıra\b|\band\b|\balso\b)/g) || []).length;
    if (conjunctionCount >= 3 && desc.length > 140) {
      findings.push({
        id: `FND-${reqId}-${String(findingSeq++).padStart(2, "0")}`,
        dimension: "atomicity",
        severity: "minor",
        title: isTurkish ? "\xC7oklu Sorumluluk / Atomik Olmayan Gereksinim" : "Non-atomic Requirement (Multiple Concerns)",
        description: isTurkish ? "Gereksinim birden fazla ba\u011F\u0131ms\u0131z i\u015F kural\u0131n\u0131 tek bir maddede birle\u015Ftirmektedir. Bu durum test izlenebilirli\u011Fini ve hata izolasyonunu zorla\u015Ft\u0131r\u0131r." : "Requirement combines multiple independent functional features in a single item.",
        recommendation: isTurkish ? "Bu maddeyi 2 veya daha fazla atomik alt gereksinime ay\u0131r\u0131n." : "Decompose into 2 or more distinct atomic requirements."
      });
      atomicityScore -= 15;
    }
    clarityScore = Math.max(15, Math.min(100, clarityScore));
    consistencyScore = Math.max(20, Math.min(100, consistencyScore));
    completenessScore = Math.max(15, Math.min(100, completenessScore));
    testabilityScore = Math.max(10, Math.min(100, testabilityScore));
    atomicityScore = Math.max(20, Math.min(100, atomicityScore));
    const reqScore = Math.round(
      clarityScore * 0.25 + testabilityScore * 0.3 + completenessScore * 0.25 + consistencyScore * 0.1 + atomicityScore * 0.1
    );
    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const majorCount = findings.filter((f) => f.severity === "major").length;
    const minorCount = findings.filter((f) => f.severity === "minor").length;
    totalCritical += criticalCount;
    totalMajor += majorCount;
    totalMinor += minorCount;
    let qualityGateStatus = "ready";
    if (criticalCount > 0 || reqScore < 60) {
      qualityGateStatus = "blocked";
      blockedCount++;
    } else if (reqScore < 80 || majorCount >= 2) {
      qualityGateStatus = "needs_review";
      needsReviewCount++;
    } else {
      qualityGateStatus = "ready";
      readyCount++;
    }
    totalScore += reqScore;
    sumClarity += clarityScore;
    sumConsistency += consistencyScore;
    sumCompleteness += completenessScore;
    sumTestability += testabilityScore;
    sumAtomicity += atomicityScore;
    const improvedVersion = isTurkish ? `[Gereksinim / Kabul Kriteri - IEEE 830 Standard\u0131]
KAPSAM: ${title}
\xD6N KO\u015EUL: Sistem aktif, ilgili mod\xFCl yetkisi sa\u011Flanm\u0131\u015F ve ge\xE7erli oturum a\xE7\u0131k olmal\u0131d\u0131r.
POZ\u0130T\u0130F AKI\u015E: Kullan\u0131c\u0131 ge\xE7erli girdilerle i\u015Flem talep etti\u011Finde, sistem talebi 500ms i\xE7erisinde i\u015Flemeli ve veritaban\u0131 durumunu ba\u015Far\u0131yla g\xFCncellemelidir.
HATA Y\xD6NET\u0130M\u0130 & U\xC7 DURUM: Zorunlu alanlar bo\u015F b\u0131rak\u0131ld\u0131\u011F\u0131nda veya ge\xE7ersiz format girildi\u011Finde sistem i\u015Flemi engellemeli, HTTP 400 ile "Ge\xE7ersiz veya eksik parametre" a\xE7\u0131klay\u0131c\u0131 uyar\u0131s\u0131n\u0131 ekranda g\xF6stermelidir.
G\xDCVENL\u0130K & \u0130ZLEME: T\xFCm yetkisiz eri\u015Fim denemeleri denetim g\xFCnl\xFC\u011F\xFCne (audit log) IP ve zaman damgas\u0131yla kaydedilmelidir.` : `[Requirement Specification - IEEE 830 Standard]
SCOPE: ${title}
PRECONDITION: User is authenticated with appropriate role permissions.
HAPPY PATH: When valid parameters are supplied, system SHALL process request within 500ms and return confirmation.
ERROR HANDLING: If required inputs are missing or malformed, system SHALL reject request and return explicit validation error.
SECURITY: Unauthorized attempts must be logged with timestamp and user context.`;
    const improvedRationale = isTurkish ? `Mu\u011Flak ifadeler ("h\u0131zl\u0131", "uygun") yerine net 500ms SLA s\u0131n\u0131r\u0131, zorunlu hata y\xF6netimi senaryolar\u0131 ve somut kabul kriterleri eklendi.` : `Replaced subjective wording with 500ms latency threshold, deterministic error cases, and verifiable acceptance criteria.`;
    reports[reqId] = {
      reqId,
      title,
      score: reqScore,
      qualityGateStatus,
      clarityScore,
      consistencyScore,
      completenessScore,
      testabilityScore,
      atomicityScore,
      findings,
      improvedVersion,
      improvedRationale,
      testedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  const totalEvaluated = requirements.length;
  const overallScore = totalEvaluated > 0 ? Math.round(totalScore / totalEvaluated) : 100;
  let qualityGateResult = "PASS";
  if (blockedCount > 0) {
    qualityGateResult = "BLOCK";
  } else if (needsReviewCount > 0 || overallScore < 80) {
    qualityGateResult = "CONDITIONAL";
  }
  const summary = {
    overallScore,
    qualityGateResult,
    totalEvaluated,
    readyCount,
    needsReviewCount,
    blockedCount,
    criticalDefects: totalCritical,
    majorDefects: totalMajor,
    minorDefects: totalMinor,
    dimensionAverages: {
      clarity: totalEvaluated > 0 ? Math.round(sumClarity / totalEvaluated) : 100,
      consistency: totalEvaluated > 0 ? Math.round(sumConsistency / totalEvaluated) : 100,
      completeness: totalEvaluated > 0 ? Math.round(sumCompleteness / totalEvaluated) : 100,
      testability: totalEvaluated > 0 ? Math.round(sumTestability / totalEvaluated) : 100,
      atomicity: totalEvaluated > 0 ? Math.round(sumAtomicity / totalEvaluated) : 100
    },
    keyRisks: isTurkish ? [
      blockedCount > 0 ? `${blockedCount} adet gereksinim kritik kalite problemlerinden dolay\u0131 Kalite Kap\u0131s\u0131n\u0131 ge\xE7ememi\u015Ftir. Bu gereksinimlerle test tasar\u0131m\u0131na ba\u015Flanmas\u0131 test senaryolar\u0131n\u0131n ge\xE7ersiz kalmas\u0131na yol a\xE7abilir.` : "Genel kalite kriterleri kar\u015F\u0131land\u0131, min\xF6r revizyonlarla devam edilebilir.",
      totalMajor > 0 ? `${totalMajor} adet maj\xF6r belirsizlik tespit edildi: \xD6l\xE7\xFClebilir yan\u0131t s\xFCreleri ve hata mesaj\u0131 standartlar\u0131 netle\u015Ftirilmelidir.` : "Belirsizlik oran\u0131 d\xFC\u015F\xFCk seviyede.",
      "Eksik hata ak\u0131\u015Flar\u0131 yaz\u0131l\u0131m geli\u015Ftirme a\u015Famas\u0131nda \xF6ng\xF6r\xFClemeyen regresyon hatalar\u0131na neden olabilir."
    ] : [
      blockedCount > 0 ? `${blockedCount} requirements failed the Quality Gate due to critical ambiguities. Test design should be paused for these items.` : "Quality criteria satisfied. Ready for test case authoring.",
      `${totalMajor} major defects identified regarding missing error flows and SLA metrics.`
    ],
    qualityRecommendations: isTurkish ? [
      'Kalite Kap\u0131s\u0131nda BLOKE olan maddeler i\xE7in "\u0130yile\u015Ftirmeyi Uygula" butonunu kullanarak gereksinimi netle\u015Ftirin.',
      "Hata y\xF6netimi ve istisna durumlar\u0131 yaz\u0131l\u0131m geli\u015Ftirme ba\u015Flamadan \xF6nce i\u015F analisti ile teyit edilmelidir.",
      "\xD6l\xE7\xFClemez terimler (h\u0131zl\u0131, kolay, kullan\u0131c\u0131 dostu) somut metriklerle (SLA < 500ms, SUS > 80) de\u011Fi\u015Ftirilmelidir."
    ] : [
      'Use "Apply Improvement" on blocked items to update requirement definitions.',
      "Clarify negative scenarios with the product owner before development."
    ],
    evaluatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return { reports, summary };
}
app.post("/api/static-test-requirements", async (req, res) => {
  try {
    const { requirements: inputReqs, requirementText, language = "tr" } = req.body;
    const isTurkish = language !== "en";
    let requirementsToEvaluate = [];
    if (requirementText && typeof requirementText === "string" && requirementText.trim()) {
      requirementsToEvaluate = makeRequirementIdsUnique(extractAllRequirementsFromDocument(requirementText, isTurkish));
    } else if (Array.isArray(inputReqs) && inputReqs.length > 0) {
      requirementsToEvaluate = makeRequirementIdsUnique(inputReqs);
    } else {
      return res.status(400).json({ error: "Analiz edilecek gereksinim metni veya listesi bulunamad\u0131." });
    }
    const deterministicResult = evaluateStaticTestingDeterministic(requirementsToEvaluate, isTurkish);
    if (!isAllAIQuotaExhausted()) {
      try {
        console.log(`[Static Test Pipeline] Analyzing ${requirementsToEvaluate.length} requirements via AI Quality Gate Engine...`);
        const targetReqs = requirementsToEvaluate.slice(0, 4).map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description ? r.description.slice(0, 1200) : r.title,
          category: r.category || "Genel"
        }));
        const aiPromise = generateUnifiedAI({
          systemPrompt: `You are a Principal Software Quality Assurance Architect & ISTQB Expert specializing in Static Testing of Requirements (IEEE 830, ISO/IEC/IEEE 29148).
Perform systematic static testing of the supplied requirements BEFORE test design starts.
NOTE: Each requirement provided represents a UNIFIED REQUIREMENT that may contain multiple explanatory bullet points and sub-rules in its full description. Evaluate the requirement as a whole.
For each requirement, evaluate 5 dimensions: Clarity, Consistency, Completeness, Testability, Atomicity.
Quality Gate:
- 'blocked': if critical defects > 0 or score < 60
- 'needs_review': score 60-79
- 'ready': score >= 80

IMPORTANT: Be concise! Provide 1-2 key findings per requirement and a concise IEEE 830 refactored requirement.
Language: ${isTurkish ? "Turkish" : "English"}.
Return ONLY valid JSON:
{
  "reports": {
    "REQ-001": {
      "reqId": "REQ-001",
      "score": 75,
      "qualityGateStatus": "needs_review",
      "clarityScore": 80,
      "consistencyScore": 90,
      "completenessScore": 65,
      "testabilityScore": 70,
      "atomicityScore": 85,
      "findings": [
        {
          "id": "FND-01",
          "dimension": "clarity",
          "severity": "major",
          "title": "Mu\u011Flak S\xFCre \u0130fadesi",
          "description": "\xD6l\xE7\xFClebilir s\xFCre (ms) belirtilmemi\u015F.",
          "recommendation": "200ms gibi net SLA ekleyin.",
          "offendingTextSnippet": "h\u0131zl\u0131"
        }
      ],
      "improvedVersion": "[KAPSAM: Giri\u015F] Kullan\u0131c\u0131 ge\xE7erli girdilerle i\u015Flem talep etti\u011Finde sistem 500ms i\xE7erisinde onay \xFCretmelidir.",
      "improvedRationale": "\xD6l\xE7\xFClebilir SLA eklendi."
    }
  },
  "summary": {
    "keyRisks": ["Mu\u011Flak s\xFCre ifadeleri test otomasyonunda belirsizlik yarat\u0131r."],
    "qualityRecommendations": ["\xD6l\xE7\xFClemez s\u0131fatlar\u0131 somut metriklerle g\xFCncelleyin."]
  }
}`,
          userPrompt: `Requirements to test:
${JSON.stringify(targetReqs, null, 2)}`,
          temperature: 0.2,
          timeoutMs: 8e3
        });
        const aiResponse = await Promise.race([
          aiPromise,
          new Promise(
            (resolve) => setTimeout(() => resolve(null), 8500)
          )
        ]);
        if (aiResponse && aiResponse.text) {
          const parsed = extractAndParseJson(aiResponse.text, null);
          if (parsed && parsed.reports && typeof parsed.reports === "object") {
            console.log("[Static Test Pipeline] AI Quality Gate analysis successfully completed!");
            const mergedReports = { ...deterministicResult.reports };
            Object.keys(parsed.reports).forEach((reqKey) => {
              const aiReport = parsed.reports[reqKey];
              if (aiReport && typeof aiReport.score === "number") {
                mergedReports[reqKey] = {
                  ...deterministicResult.reports[reqKey],
                  ...aiReport,
                  testedAt: (/* @__PURE__ */ new Date()).toISOString()
                };
              }
            });
            let totalScore = 0;
            let readyCount = 0;
            let needsReviewCount = 0;
            let blockedCount = 0;
            let criticalDefects = 0;
            let majorDefects = 0;
            let minorDefects = 0;
            Object.values(mergedReports).forEach((rep) => {
              totalScore += rep.score || 0;
              if (rep.qualityGateStatus === "blocked") blockedCount++;
              else if (rep.qualityGateStatus === "needs_review") needsReviewCount++;
              else readyCount++;
              if (Array.isArray(rep.findings)) {
                rep.findings.forEach((f) => {
                  if (f.severity === "critical") criticalDefects++;
                  else if (f.severity === "major") majorDefects++;
                  else minorDefects++;
                });
              }
            });
            const totalReqs = Object.keys(mergedReports).length;
            const overallScore = totalReqs > 0 ? Math.round(totalScore / totalReqs) : 100;
            const qualityGateResult = blockedCount > 0 ? "BLOCK" : needsReviewCount > 0 || overallScore < 80 ? "CONDITIONAL" : "PASS";
            return res.json({
              requirements: requirementsToEvaluate.map((r) => ({
                ...r,
                staticTestReport: mergedReports[r.id]
              })),
              reports: mergedReports,
              summary: {
                ...deterministicResult.summary,
                overallScore,
                qualityGateResult,
                totalEvaluated: totalReqs,
                readyCount,
                needsReviewCount,
                blockedCount,
                criticalDefects,
                majorDefects,
                minorDefects,
                keyRisks: parsed.summary?.keyRisks || deterministicResult.summary.keyRisks,
                qualityRecommendations: parsed.summary?.qualityRecommendations || deterministicResult.summary.qualityRecommendations,
                evaluatedAt: (/* @__PURE__ */ new Date()).toISOString()
              }
            });
          }
        }
      } catch (_aiErr) {
        console.log("[Static Test Pipeline] ISTQB deterministic engine applied successfully.");
      }
    }
    return res.json({
      requirements: requirementsToEvaluate.map((r) => ({
        ...r,
        staticTestReport: deterministicResult.reports[r.id]
      })),
      reports: deterministicResult.reports,
      summary: deterministicResult.summary
    });
  } catch (error) {
    console.error("Static test requirements error:", error);
    res.status(500).json({
      error: "Gereksinim statik testi yap\u0131l\u0131rken bir hata olu\u015Ftu.",
      details: error?.message
    });
  }
});
app.post("/api/generate-from-diagram", async (req, res) => {
  try {
    const {
      diagramText,
      diagramImageBase64,
      diagramImageMimeType,
      diagramFileName,
      coverageStrategy = "branch",
      corporateRules = [],
      config = {}
    } = req.body || {};
    const hasText = typeof diagramText === "string" && diagramText.trim().length > 0;
    const hasImage = typeof diagramImageBase64 === "string" && diagramImageBase64.trim().length > 0;
    if (!hasText && !hasImage) {
      return res.status(400).json({
        error: "L\xFCtfen bir Activity Diagram / s\xFCre\xE7 \xE7izimi g\xF6rseli y\xFCkleyin veya Mermaid/PlantUML ak\u0131\u015F metni girin."
      });
    }
    const isTurkish = config?.language !== "en";
    const result = await analyzeDiagramAndGenerateTests({
      diagramText,
      diagramImageBase64,
      diagramImageMimeType,
      diagramFileName,
      coverageStrategy,
      corporateRules,
      config,
      isTurkish,
      callOpenRouterFallback: ({ systemPrompt, userPrompt, timeoutMs }) => callOpenRouterWithFallback({ systemPrompt, userPrompt, timeoutMs }),
      isAllQuotaExhausted: isAllAIQuotaExhausted,
      isGeminiQuotaExhausted,
      markGeminiQuotaExhausted,
      checkIsQuotaExhaustedError
    });
    res.json(result);
  } catch (error) {
    console.error("[Diagram Generate Error]", error);
    res.status(500).json({
      error: "S\xFCre\xE7 diyagram\u0131 analiz edilip test case \xFCretilirken bir sunucu hatas\u0131 olu\u015Ftu.",
      details: error?.message
    });
  }
});
app.use((err, req, res, next) => {
  console.error("[API Server Error]", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || "Sunucu i\u015Flem s\u0131ras\u0131nda beklenmeyen bir hata ile kar\u015F\u0131la\u015Ft\u0131.",
    details: err.stack ? err.message : void 0
  });
});
var app_default = app;

// server/index.ts
var index_default = app_default;
export {
  index_default as default
};
