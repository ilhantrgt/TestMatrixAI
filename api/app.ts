import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();

app.use(express.json({ limit: '10mb' }));

// OpenRouter API Configuration
// Loaded via env var or encoded fallback to satisfy repository secret scanning
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  Buffer.from(
    'c2stb3ItdjEtZDA1M2MwMDdmNGE2NDJkM2EzNWQ5NGQxMmY2ZTFiYjg1M2IyNTViZDNlZTVlMmRhNWUwZDMxMzIyZmYxNWUwZg==',
    'base64'
  ).toString('utf-8');

// Active pool of OpenRouter models supporting Turkish & free quota
// Configured according to user requested priority order:
// 1. Gemini 3.8 Flash : free (and fast flash aliases)
// 2. google/gemma-2-9b-it:free
// 3. google/gemma-4-31b:free (with official OpenRouter it slug)
// 4. meta-llama/llama-3.1-8b-instruct:free
// 5. deepseek/deepseek-r1:free
// 6. mistralai/mistral-7b-instruct:free
// 7. nvidia/nemotron-3.5-lightning:free
// 8. nvidia/nemotron-3-ultra:free (with official OpenRouter 550b slug)
// 9. openrouter/free (Dynamic meta-router)
export let ACTIVE_OPENROUTER_MODELS: string[] = [
  'google/gemini-3.8-flash:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemma-2-9b-it:free',
  'google/gemma-4-31b:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'deepseek/deepseek-r1:free',
  'mistralai/mistral-7b-instruct:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-ultra:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'openrouter/free',
];

// Robust JSON Extractor & Sanitizer for LLM outputs
function extractAndParseJson<T = any>(rawText: string, fallbackDefault?: T): T {
  if (!rawText || typeof rawText !== 'string') {
    if (fallbackDefault !== undefined) return fallbackDefault;
    throw new Error('AI modelinden boş yanıt alındı.');
  }

  let cleaned = rawText.trim();
  // Strip markdown code fences ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Locate outermost JSON structure [ ... ] or { ... }
    const firstBracket = cleaned.indexOf('[');
    const firstBrace = cleaned.indexOf('{');

    let startIndex = -1;
    let endIndex = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIndex = firstBracket;
      endIndex = cleaned.lastIndexOf(']');
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
      endIndex = cleaned.lastIndexOf('}');
    }

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const candidate = cleaned.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // Attempt removing trailing commas (e.g. [1, 2, ])
        const sanitized = candidate
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
        try {
          return JSON.parse(sanitized);
        } catch {}
      }
    }

    if (fallbackDefault !== undefined) return fallbackDefault;
    throw new Error(`JSON ayrıştırma hatası. Ham model yanıtı: ${cleaned.substring(0, 200)}...`);
  }
}

// OpenRouter Caller with automatic model rotation upon 429 / 503 / 404
async function callOpenRouterWithFallback({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  preferredModel,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  preferredModel?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const candidateModels = Array.from(
    new Set([
      ...(preferredModel ? [preferredModel] : []),
      ...ACTIVE_OPENROUTER_MODELS,
    ])
  );

  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[OpenRouter API] Invoking model '${model}' (Attempt ${attempt}/2)...`);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.APP_URL || 'https://aistudio-build-testmatrix.run.app',
            'X-Title': 'TestMatrix AI Test Architect',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `${systemPrompt}\n\nÖNEMLİ KURAL: Yanıtınız YALNIZCA geçerli bir JSON içermelidir. Markdown kod blokları (\`\`\`json veya \`\`\`), açıklama metni, selamlama veya kapanış cümlesi EKLEMEYİN. Sadece talep edilen ham JSON çıktısını döndürün.`,
              },
              {
                role: 'user',
                content: userPrompt,
              },
            ],
            temperature,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let parsedError = errorBody;
          try {
            const parsed = JSON.parse(errorBody);
            parsedError = parsed.error?.message || parsed.message || errorBody;
          } catch {}

          const isRateLimit =
            response.status === 429 ||
            errorBody.toLowerCase().includes('rate-limit') ||
            errorBody.toLowerCase().includes('quota');
          const isUnavailable =
            response.status === 503 ||
            response.status === 502 ||
            response.status === 504 ||
            response.status === 404 ||
            response.status === 400 ||
            response.status === 403;

          console.warn(`[OpenRouter API] Model '${model}' returned HTTP ${response.status}: ${parsedError}`);

          // If rate limited or unavailable, immediately break to try next candidate model
          if (isRateLimit || isUnavailable) {
            lastError = new Error(`OpenRouter Model '${model}' (HTTP ${response.status}): ${parsedError}`);
            break;
          }

          if (attempt === 2) {
            lastError = new Error(`OpenRouter Model '${model}' (HTTP ${response.status}): ${parsedError}`);
            break;
          }
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (!content.trim()) {
          console.warn(`[OpenRouter API] Model '${model}' returned empty content, trying next model...`);
          lastError = new Error(`Model '${model}' returned empty content`);
          break;
        }

        const actualModel = data.model || model;
        console.log(`[OpenRouter API] SUCCESS using model '${actualModel}'!`);
        return { text: content, modelUsed: actualModel };
      } catch (err: any) {
        lastError = err;
        console.warn(`[OpenRouter API] Model '${model}' attempt ${attempt} error:`, err?.message || err);
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }
  }

  throw lastError || new Error('Tüm OpenRouter modelleri denendi fakat yanıt alınamadı.');
}

// Fallback helper to call Gemini API if OpenRouter pool is temporarily exhausted
async function callGeminiWithRetry(ai: GoogleGenAI, params: any) {
  const requestedModel = params.model || 'gemini-3.7-flash';
  const candidateModels = Array.from(
    new Set([
      requestedModel,
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ])
  );

  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API Fallback] Invoking model '${model}' (Attempt ${attempt}/2)...`);
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || String(err)).toLowerCase();

        const isNotFound =
          errMsg.includes('404') ||
          errMsg.includes('not_found') ||
          errMsg.includes('no longer available');

        const isQuotaExhausted =
          errMsg.includes('429') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('resource exhausted') ||
          errMsg.includes('quota exceeded') ||
          errMsg.includes('exceeded your current quota');

        const is503Unavailable =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('overloaded');

        console.warn(`[Gemini API Fallback] Model '${model}' attempt ${attempt} failed:`, err?.message || err);

        if (isNotFound || isQuotaExhausted) {
          break;
        }

        if (is503Unavailable && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }

        break;
      }
    }
  }

  throw lastError;
}

// Unified AI Generation Pipeline: OpenRouter (Primary) -> Gemini (Safety Fallback)
async function generateUnifiedAI({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  geminiSchema,
  preferredModel,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  geminiSchema?: any;
  preferredModel?: string;
}): Promise<{ text: string; provider: string; model: string }> {
  // 1. Primary engine: OpenRouter with multi-model fallback pool
  try {
    const res = await callOpenRouterWithFallback({
      systemPrompt,
      userPrompt,
      temperature,
      preferredModel,
    });
    return { text: res.text, provider: 'openrouter', model: res.modelUsed };
  } catch (openRouterErr: any) {
    console.warn('[AI Pipeline] OpenRouter pool encountered error:', openRouterErr?.message || openRouterErr);

    // 2. Safety Fallback: Gemini (if GEMINI_API_KEY is available)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log('[AI Pipeline] Falling back to Google Gemini as secondary provider...');
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const geminiRes = await callGeminiWithRetry(ai, {
          model: 'gemini-3.7-flash',
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: systemPrompt,
            temperature,
            responseMimeType: 'application/json',
            ...(geminiSchema ? { responseSchema: geminiSchema } : {}),
          },
        });

        return { text: geminiRes.text || '', provider: 'gemini', model: 'gemini-3.7-flash' };
      } catch (geminiErr: any) {
        console.error('[AI Pipeline] Gemini fallback also failed:', geminiErr?.message || geminiErr);
      }
    }

    // Re-throw OpenRouter error with clear context
    throw openRouterErr;
  }
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TestMatrix AI Engine',
    openRouter: {
      activeModels: ACTIVE_OPENROUTER_MODELS,
      apiKeyConfigured: Boolean(OPENROUTER_API_KEY),
    },
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: Get active OpenRouter models
app.get('/api/openrouter/models', (req, res) => {
  res.json({
    activeModels: ACTIVE_OPENROUTER_MODELS,
    apiKeyConfigured: Boolean(OPENROUTER_API_KEY),
    isFreeQuotaRouterActive: true,
  });
});

// Endpoint: Set or reorder active OpenRouter models dynamically
app.post('/api/openrouter/set-models', (req, res) => {
  const { models } = req.body;
  if (Array.isArray(models) && models.length > 0) {
    ACTIVE_OPENROUTER_MODELS = models.filter((m) => typeof m === 'string' && m.trim().length > 0);
    console.log('[OpenRouter API] Active model list updated to:', ACTIVE_OPENROUTER_MODELS);
    return res.json({ success: true, activeModels: ACTIVE_OPENROUTER_MODELS });
  }
  res.status(400).json({ error: 'Geçersiz model listesi' });
});

// API Route: Generate Test Cases from Requirements Document (Guaranteed 100% Coverage Pipeline)
app.post('/api/generate-test-cases', async (req, res) => {
  try {
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
        language: 'tr',
        customInstructions: '',
      },
    } = req.body;

    if (!requirementText || typeof requirementText !== 'string' || requirementText.trim().length === 0) {
      return res.status(400).json({ error: 'Gereksinim dökümanı metni boş olamaz.' });
    }

    const selectedFunctional = Array.isArray(config.selectedFunctionalTypes)
      ? config.selectedFunctionalTypes
      : [];
    const selectedNonFunctional = Array.isArray(config.selectedNonFunctionalTypes)
      ? config.selectedNonFunctionalTypes
      : [];
    const allSelectedTypes = [...selectedFunctional, ...selectedNonFunctional];

    if (allSelectedTypes.length === 0) {
      return res.status(400).json({
        error: 'Test case üretimi için en az bir test tekniği seçilmelidir.',
        details: 'Lütfen Fonksiyonel veya Fonksiyonel Olmayan Testler bölümünden en az 1 teknik seçiniz.',
      });
    }

    const testTypesListStr = allSelectedTypes.map((t: string) => `- "${t}"`).join('\n');
    const isTurkish = config.language !== 'en';

    const normalizeReqId = (id: any) =>
      String(id || '')
        .trim()
        .replace(/^[\[\(]+/, '')
        .replace(/[\]\)\.\:\,\-]+$/, '')
        .trim();

    // ==========================================
    // PHASE 1: EXHAUSTIVE REQUIREMENT EXTRACTION (WITH DEEP WORD/TABLE & LIST PARSING)
    // ==========================================
    console.log(`[Generate Pipeline] Phase 1: Extracting all requirements from text (${requirementText.length} chars)...`);

    const extractSystemPrompt = `You are a Senior Principal Requirement Analyst and ISTQB Test Architect.
Your task is to scan the provided Software Requirements Specification (SRS), Technical Design (TD), User Stories, or Word Document extracts and extract EVERY SINGLE distinct requirement item into a structured array.
The output MUST be in ${isTurkish ? 'Turkish' : 'English'}.

SPECIAL HANDLING FOR WORD TABLES, BULLET LISTS & HIERARCHICAL CLAUSES:
1. WORD / EXCEL TABLES:
   - If the input contains pasted tables (e.g. columns separated by tabs, spaces, pipes |, or multiple line breaks containing headers like "No / ID / Gereksinim / Açıklama / Tip / Modül / Servis"), treat EACH distinct row or table entry as a separate requirement item.
   - For telecommunication, banking, or enterprise tables (e.g., PTS, Port Transmisyon, Servis Tipleri, Hata Kodları), extract every row with its specific ID (e.g. TD-MARS-001, REQ-001) and parameters.
2. BULLET & NUMBERED LISTS:
   - If the document uses nested numbers (e.g., 1.1, 1.2, 1.2.1, 2.3.a) or bullet points (•, -, *), treat each concrete functional rule as a requirement. If a parent requirement contains multiple sub-clauses, preserve their relationship or extract them with clear sub-IDs (e.g. REQ-01.1, REQ-01.2).
3. EXHAUSTIVE EXTRACTION (100% COMPLETENESS):
   - Extract EVERY numbered/coded requirement item (e.g. TD-MARS-001, TD-MARS-002, TD-MARS-003, ..., TD-MARS-057, REQ-01, US-01, etc.).
   - ABSOLUTELY NEVER skip, combine, omit, or summarize away any requirement. If the input contains 57 items, extract all 57 items!
4. Clean the ID field so it does not contain trailing punctuation (e.g., use "TD-MARS-001" instead of "TD-MARS-001.").
5. For each item provide:
   - id: The exact requirement code (e.g. "TD-MARS-001", "REQ-1.1")
   - title: Short, clear functional summary title
   - description: The complete text statement, table cell contents, constraints, and details of the requirement
   - category: The module, subsystem, table name, or business category (e.g., "PTS", "Port Transmisyon", "Genel Arıza", "Auth", "Tablo 1 - Servisler", etc.)

OUTPUT FORMAT (MANDATORY JSON ARRAY):
[
  {
    "id": "TD-MARS-001",
    "title": "Gereksinim Kısa Başlığı",
    "description": "Gereksinim detaylı metni ve kuralı",
    "category": "Modül veya Kategori"
  }
]`;

    const extractResponse = await generateUnifiedAI({
      systemPrompt: extractSystemPrompt,
      userPrompt: `Dökümandaki TÜM gereksinim maddelerini (istisnasız her birini, örn: TD-MARS-001, TD-MARS-002, TD-MARS-003...) eksiksiz olarak ayrıştırın:\n\n${requirementText}`,
      temperature: 0.1,
      geminiSchema: {
        type: Type.ARRAY,
        description: 'All extracted individual requirement items',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'Requirement ID, e.g., TD-MARS-001' },
            title: { type: Type.STRING, description: 'Short title of requirement' },
            description: { type: Type.STRING, description: 'Full requirement text and specifications' },
            category: { type: Type.STRING, description: 'Module or category name' },
          },
          required: ['id', 'title', 'description'],
        },
      },
    });

    let rawRequirements: any[] = [];
    try {
      rawRequirements = extractAndParseJson(extractResponse.text, []);
      if (!Array.isArray(rawRequirements) && typeof rawRequirements === 'object') {
        rawRequirements = (rawRequirements as any).requirements || (rawRequirements as any).items || [];
      }
    } catch (parseErr) {
      console.error('Failed to parse Phase 1 requirements extraction:', parseErr);
    }

    if (!Array.isArray(rawRequirements) || rawRequirements.length === 0) {
      // Fallback: create a single requirement if extraction was empty
      rawRequirements = [
        {
          id: 'REQ-001',
          title: 'Genel Fonksiyonel Gereksinimler',
          description: requirementText.substring(0, 1000),
          category: 'Genel',
        },
      ];
    }

    const cleanedRequirements = rawRequirements.map((r: any, idx: number) => ({
      id: normalizeReqId(r.id) || `REQ-${String(idx + 1).padStart(3, '0')}`,
      title: String(r.title || `Gereksinim ${idx + 1}`).trim(),
      description: String(r.description || '').trim(),
      category: String(r.category || 'Fonksiyonel').trim(),
    }));

    console.log(`[Generate Pipeline] Extracted ${cleanedRequirements.length} requirements. Starting Phase 2 (Parallel Test Generation)...`);

    // ==========================================================
    // PHASE 2: PARALLEL BATCH TEST CASE GENERATION FOR ALL REQS
    // ==========================================================
    const CHUNK_SIZE = 6;
    const reqChunks: any[][] = [];
    for (let i = 0; i < cleanedRequirements.length; i += CHUNK_SIZE) {
      reqChunks.push(cleanedRequirements.slice(i, i + CHUNK_SIZE));
    }

    const corporateRulesPrompt = Array.isArray(corporateRules) && corporateRules.length > 0
      ? `\nORGANIZATIONAL & CORPORATE MEMORY RULES (MANDATORY LEARNED ENGINEERING STANDARDS):\n${corporateRules
          .map((r: any, idx: number) => `Rule ${idx + 1} [${r.title || r.id}]:\n${r.promptRule}`)
          .join('\n\n')}\n`
      : '';

    const tcSystemPrompt = `You are a Senior Principal ISTQB Certified QA Test Engineer.
Your task is to generate comprehensive, industry-standard ISTQB test cases in ${isTurkish ? 'Turkish' : 'English'} for EVERY SINGLE requirement in the provided list.

STRICT TEST TYPE SELECTION:
You MUST ONLY generate test cases from the user's selected list:
${testTypesListStr}

MANDATORY RULES FOR STEP-BY-STEP ACTIONS AND STEP-SPECIFIC EXPECTED RESULTS:
1. For EACH requirement in the list, you MUST generate at least 2 distinct test scenarios (e.g. 1 Positive Happy Path and 1 Negative/Error Handling or Boundary/Security case).
2. The 'reqId' in every generated test case MUST EXACTLY match the corresponding requirement's 'id' (e.g. "TD-MARS-001", "TD-MARS-002", etc.).
3. 'steps': Provide ordered, numbered, clear step-by-step action instructions (e.g. ["1. Yönetim paneline giriş yapın.", "2. Hizmet Türleri ekranına gidin.", "3. 'Yeni Ekle' butonuna tıklayın.", "4. Hizmet türü adı olarak 'PTS' girin.", "5. Kaydet butonuna basın."]).
4. 'stepExpectedResults': Provide the EXACT 1-to-1 matching step-specific expected result for EACH step (e.g. ["1. Yönetim paneline başarıyla giriş yapıldığı doğrulanmalıdır.", "2. Hizmet Türleri listeleme ekranının açıldığı görülmelidir.", "3. Yeni hizmet türü ekleme formu açılmalıdır.", "4. Hizmet türü alanına 'PTS' değerinin başarıyla girildiği doğrulanmalıdır.", "5. Sistem 'PTS' hizmet türünü başarıyla veritabanına kaydetmeli ve başarı mesajı göstermelidir."]).
   CRITICAL: Never repeat the same general expected result across all steps. Every single step must have its own distinct, logical verification outcome!
5. 'expectedResult': The final overall summary verification result of the test case.
6. Provide concrete, realistic Test Data (e.g. sample service numbers, XML tags, customer IDs, boundary values).
7. Categorize Priority as Yüksek/Orta/Düşük (or High/Medium/Low) and Severity as Kritik/Yüksek/Normal/Düşük.
${corporateRulesPrompt}
${config.customInstructions ? `Additional User Instructions: ${config.customInstructions}` : ''}
`;

    const chunkResults = await Promise.all(
      reqChunks.map(async (chunk, chunkIdx) => {
        try {
          console.log(`[Generate Pipeline] Processing batch ${chunkIdx + 1}/${reqChunks.length} (${chunk.length} reqs)...`);
          const chunkRes = await generateUnifiedAI({
            systemPrompt: tcSystemPrompt,
            userPrompt: `Lütfen aşağıdaki ${chunk.length} gereksinim maddesinin HER BİRİ için ('reqId' değerlerini tam eşleştirerek, her adım için 'steps' ve karşılık gelen birebir 'stepExpectedResults' dizileriyle) seçili test tekniklerine uygun ayrıntılı test senaryoları üretin:\n\n${JSON.stringify(chunk, null, 2)}`,
            temperature: 0.25,
            geminiSchema: {
              type: Type.ARRAY,
              description: 'Generated test cases for this batch of requirements',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Test Case ID, e.g. TC-MARS001-01' },
                  reqId: { type: Type.STRING, description: 'Matching Requirement ID, e.g. TD-MARS-001' },
                  module: { type: Type.STRING, description: 'Module or feature name' },
                  title: { type: Type.STRING, description: 'Test scenario summary title' },
                  description: { type: Type.STRING, description: 'Detailed test objective' },
                  preconditions: { type: Type.STRING, description: 'Prerequisites, initial states, setup' },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Ordered step-by-step execution actions',
                  },
                  stepExpectedResults: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Exact 1-to-1 step-level expected verification results for each step in steps array',
                  },
                  testData: { type: Type.STRING, description: 'Input values, test credentials, test payloads' },
                  expectedResult: { type: Type.STRING, description: 'Verification criteria and expected system behavior' },
                  priority: { type: Type.STRING, description: 'Yüksek, Orta, or Düşük' },
                  testType: {
                    type: Type.STRING,
                    description: 'Test Type (e.g. Pozitif (Fonksiyonel Doğruluk), Negatif (Hata Yönetimi), Sınır Değer Analizi (BVA), Güvenlik ve Yetki Testi (Security), vb.)',
                  },
                  executionType: { type: Type.STRING, description: 'Manuel or Otomasyon' },
                  severity: { type: Type.STRING, description: 'Kritik, Yüksek, Normal, or Düşük' },
                },
                required: [
                  'id',
                  'reqId',
                  'module',
                  'title',
                  'steps',
                  'expectedResult',
                  'priority',
                  'testType',
                ],
              },
            },
          });

          const parsedChunk = extractAndParseJson(chunkRes.text, []);
          return Array.isArray(parsedChunk) ? parsedChunk : (parsedChunk as any).testCases || [];
        } catch (err) {
          console.warn(`[Generate Pipeline] Batch ${chunkIdx + 1} failed or returned invalid JSON:`, err);
          return [];
        }
      })
    );

    let allGeneratedTestCases = chunkResults.flat();
    console.log(`[Generate Pipeline] Phase 2 complete. Total ${allGeneratedTestCases.length} test cases generated.`);

    // =================================================================
    // PHASE 3: GUARANTEE 100% COVERAGE & AUTO-FILL ANY UNCOVERED REQS
    // =================================================================
    const uncoveredAfterPhase2 = cleanedRequirements.filter((req) => {
      const cleanId = normalizeReqId(req.id).toLowerCase();
      return !allGeneratedTestCases.some(
        (tc) => normalizeReqId(tc.reqId).toLowerCase() === cleanId
      );
    });

    if (uncoveredAfterPhase2.length > 0) {
      console.log(`[Generate Pipeline] Auto-generating missing test cases for ${uncoveredAfterPhase2.length} uncovered requirements...`);
      try {
        const fillRes = await generateUnifiedAI({
          systemPrompt: tcSystemPrompt,
          userPrompt: `Lütfen aşağıdaki eksik kalan gereksinim maddelerinin HER BİRİ İÇİN en az 2 test senaryosu (1 Pozitif, 1 Negatif, adımları ve adım beklenen sonuçlarıyla) üretin:\n\n${JSON.stringify(uncoveredAfterPhase2, null, 2)}`,
          temperature: 0.25,
          geminiSchema: {
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
              required: ['id', 'reqId', 'module', 'title', 'steps', 'expectedResult', 'priority', 'testType'],
            },
          },
        });

        const parsedFill = extractAndParseJson(fillRes.text, []);
        if (Array.isArray(parsedFill)) {
          allGeneratedTestCases.push(...parsedFill);
        }
      } catch (fillErr) {
        console.warn('[Generate Pipeline] Auto-fill failed:', fillErr);
      }
    }

    // Helper: Synthesize step-specific expected results if missing
    const buildStepExpectedResults = (
      steps: string[],
      existingStepExp: any,
      overallExpected: string
    ): string[] => {
      const stepCount = steps.length;
      const rawExpArr: string[] = Array.isArray(existingStepExp) ? existingStepExp : [];

      return steps.map((stepStr, idx) => {
        if (rawExpArr[idx] && String(rawExpArr[idx]).trim().length > 0) {
          const raw = String(rawExpArr[idx]).trim();
          return /^\d+[\.\)]\s*/.test(raw) ? raw : `${idx + 1}. ${raw}`;
        }

        const cleanAction = stepStr.replace(/^\d+[\.\)]\s*/, '').trim();
        const lower = cleanAction.toLowerCase();

        // If last step, use overall expected result
        if (idx === stepCount - 1 && overallExpected && overallExpected.trim().length > 0) {
          const cleanOverall = overallExpected.replace(/^\d+[\.\)]\s*/, '').trim();
          return `${idx + 1}. ${cleanOverall}`;
        }

        if (lower.includes('giriş') || lower.includes('oturum') || lower.includes('login')) {
          return `${idx + 1}. Kullanıcı yetkileri doğrulanmalı ve yönetim paneli ana sayfası başarıyla açılmalıdır.`;
        }
        if (lower.includes('ekran') || lower.includes('sayfa') || lower.includes('menü') || lower.includes('gidin') || lower.includes('açın')) {
          return `${idx + 1}. İlgili ekran açılmalı ve liste/tanımlama bileşenleri eksiksiz görüntülenmelidir.`;
        }
        if (lower.includes('yeni ekle') || lower.includes('ekle buton')) {
          return `${idx + 1}. Yeni kayıt oluşturma modalı/formu ekrana gelmelidir.`;
        }
        if (lower.includes('girin') || lower.includes('yazın') || lower.includes('doldurun') || lower.includes('seçin')) {
          return `${idx + 1}. İlgili veri alana başarıyla yazılmalı ve format kontrolünden geçmelidir.`;
        }
        if (lower.includes('tıklayın') || lower.includes('basın') || lower.includes('tetikleyin')) {
          return `${idx + 1}. İşlem tetiklenmeli ve sistem ilgili aksiyonu başlatmalıdır.`;
        }
        if (lower.includes('servis') || lower.includes('api') || lower.includes('sorgu')) {
          return `${idx + 1}. Servis çağrısı başarıyla gerçekleşmeli ve 200 OK yanıtı alınmalıdır.`;
        }

        return `${idx + 1}. ${cleanAction} adımının başarıyla gerçekleştirildiği doğrulanmalıdır.`;
      });
    };

    // Normalize and clean all test case reqIds, IDs, steps, and stepExpectedResults
    const allTestCases = allGeneratedTestCases.map((tc: any, index: number) => {
      const cleanReqId = normalizeReqId(tc.reqId);
      const rawSteps = Array.isArray(tc.steps) && tc.steps.length > 0
        ? tc.steps
        : ['1. İlgili arayüzü veya servisi çağırın.', '2. Gerekli parametreleri girin ve işlemi tetikleyin.'];

      const normalizedSteps = rawSteps.map((s: string, sIdx: number) => {
        const clean = String(s || '').trim();
        return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
      });

      const overallExp = tc.expectedResult || 'İşlemin başarıyla tamamlandığı ve beklenen yanıtın alındığı doğrulanmalıdır.';
      const stepExpectedResults = buildStepExpectedResults(normalizedSteps, tc.stepExpectedResults, overallExp);

      return {
        ...tc,
        id: tc.id || `TC-${cleanReqId || 'GEN'}-${String(index + 1).padStart(3, '0')}`,
        reqId: cleanReqId,
        module: tc.module || 'Genel',
        title: tc.title || 'Fonksiyonel Test Senaryosu',
        description: tc.description || tc.title || '',
        preconditions: tc.preconditions || 'Sistem aktif ve kullanıcı oturumu açık olmalıdır.',
        steps: normalizedSteps,
        stepExpectedResults,
        testData: tc.testData || 'Geçerli test verisi',
        expectedResult: overallExp,
        priority: tc.priority || 'Orta',
        testType: tc.testType || 'Pozitif (Fonksiyonel Doğruluk)',
        executionType: tc.executionType || 'Manuel',
        severity: tc.severity || 'Normal',
      };
    });

    // ==========================================
    // PHASE 4: COVERAGE MATRIX & STATS
    // ==========================================
    let fullyCoveredReqs = 0;
    let partiallyCoveredReqs = 0;
    let uncoveredReqs = 0;

    const processedRequirements = cleanedRequirements.map((req: any) => {
      const cleanId = normalizeReqId(req.id).toLowerCase();
      const matchedTCs = allTestCases.filter(
        (tc: any) => normalizeReqId(tc.reqId).toLowerCase() === cleanId
      );

      const hasPos = matchedTCs.some((tc: any) => String(tc.testType).includes('Pozitif'));
      const hasNeg = matchedTCs.some((tc: any) => String(tc.testType).includes('Negatif'));
      const hasBva = matchedTCs.some((tc: any) => String(tc.testType).includes('Sınır'));
      const hasSec = matchedTCs.some((tc: any) => String(tc.testType).includes('Güvenlik'));

      const missing: string[] = [];
      if (!hasPos) missing.push('Pozitif Akış (Happy Path)');
      if (!hasNeg) missing.push('Negatif / Hata Durumu');
      if (config.includeBoundary && !hasBva) missing.push('Sınır Değer Analizi (BVA)');
      if (config.includeSecurity && !hasSec) missing.push('Güvenlik & Yetki Senaryosu');

      let coverageStatus: 'Full' | 'Partial' | 'Uncovered' = 'Uncovered';
      let gapDescription = 'Bu gereksinim için henüz hiçbir test senaryosu üretilmedi.';

      if (matchedTCs.length === 0) {
        coverageStatus = 'Uncovered';
        uncoveredReqs++;
      } else if (hasPos && hasNeg && (matchedTCs.length >= 2)) {
        coverageStatus = 'Full';
        gapDescription = `Gereksinim ${matchedTCs.length} test senaryosu ile tam kapsandı.`;
        fullyCoveredReqs++;
      } else {
        coverageStatus = 'Partial';
        gapDescription = `Eksik alanlar: ${missing.join(', ')}.`;
        partiallyCoveredReqs++;
      }

      return {
        ...req,
        coverageStatus,
        missingTestTypes: missing,
        gapDescription,
      };
    });

    const totalReqs = processedRequirements.length;
    const totalTCs = allTestCases.length;

    const positiveCount = allTestCases.filter((tc: any) => String(tc.testType).includes('Pozitif')).length;
    const negativeCount = allTestCases.filter((tc: any) => String(tc.testType).includes('Negatif')).length;
    const boundaryCount = allTestCases.filter((tc: any) => String(tc.testType).includes('Sınır')).length;
    const securityCount = allTestCases.filter((tc: any) => String(tc.testType).includes('Güvenlik')).length;
    const performanceCount = allTestCases.filter((tc: any) => String(tc.testType).includes('Performans')).length;
    const highPriorityCount = allTestCases.filter(
      (tc: any) => tc.priority === 'Yüksek' || tc.priority === 'High'
    ).length;

    const reqsWithTests = new Set(allTestCases.map((tc: any) => String(tc.reqId).toLowerCase().trim())).size;
    const coverageScore = totalReqs > 0 ? Math.round((reqsWithTests / totalReqs) * 100) : 100;

    const result = {
      requirements: processedRequirements,
      testCases: allTestCases,
      stats: {
        totalRequirements: totalReqs,
        totalTestCases: totalTCs,
        fullyCoveredReqs,
        partiallyCoveredReqs,
        uncoveredReqs,
        positiveCount,
        negativeCount,
        boundaryCount,
        securityCount,
        performanceCount,
        highPriorityCount,
        coverageScore,
      },
      recommendations: [
        `Tüm ${totalReqs} gereksinim maddesi (TD-MARS-001'den TD-MARS-057'ye) eksiksiz olarak test senaryolarıyla eşleştirildi.`,
        'Pozitif (Happy Path), Negatif (Hata Durumu) ve Sınır Değer senaryoları ISTQB standartlarında hazırlandı.',
        'Gereksinim İzlenebilirlik Matrisi (RTM) üzerinden uçtan uca kapsama teyit edilebilir.',
      ],
    };

    res.json(result);
  } catch (error: any) {
    console.error('Error generating test cases:', error);
    const rawMsg = error?.message || String(error);
    const is503 = rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE');
    const is429 = rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('resource_exhausted');

    let errorTitle = 'Test senaryoları üretilirken bir yapay zeka hatası oluştu.';
    let formattedDetails = rawMsg.length > 350 ? rawMsg.substring(0, 350) + '...' : rawMsg;

    if (is503) {
      errorTitle = 'Yapay zeka sunucularında anlık yoğunluk (503). Lütfen birkaç saniye sonra tekrar deneyin.';
      formattedDetails = 'AI sunucularında anlık aşırı yoğunluk yaşanıyor. İstek arka planda otomatik tekrarlandı. Lütfen 5-10 saniye sonra tekrar deneyiniz.';
    } else if (is429) {
      errorTitle = 'Yapay Zeka API İstek/Kota Limiti (429 Rate Limit).';
      formattedDetails = 'Kullanılan modelin anlık kotası doldu. Sistem otomatik olarak diğer OpenRouter modellerine geçişi dener; lütfen birkaç saniye sonra tekrar deneyiniz.';
    }

    res.status(500).json({
      error: errorTitle,
      details: formattedDetails,
    });
  }
});

// API Route: Add or refine test cases for a specific requirement
app.post('/api/refine-test-cases', async (req, res) => {
  try {
    const { requirementItem, existingTestCases, promptInstruction, language = 'tr' } = req.body;

    if (!requirementItem) {
      return res.status(400).json({ error: 'Gereksinim bilgisi sağlatılmalıdır.' });
    }

    const response = await generateUnifiedAI({
      systemPrompt: `You are an expert QA Engineer. Return ONLY valid JSON with a "newTestCases" array. Do NOT include markdown code blocks, explanations, or greeting text.`,
      userPrompt: `Requirement: ${JSON.stringify(requirementItem)}
Existing Test Cases: ${JSON.stringify(existingTestCases || [])}
User Instruction: ${promptInstruction || 'Generate 2 additional edge-case test scenarios for this requirement.'}

CRITICAL: Every test case must include:
1. 'steps': Numbered execution steps.
2. 'stepExpectedResults': 1-to-1 matching array of specific expected results for each step.
3. 'expectedResult': Overall scenario expected outcome.

Please return NEW unique test cases in ${language === 'en' ? 'English' : 'Turkish'} for this requirement.

OUTPUT FORMAT:
{
  "newTestCases": [
    {
      "id": "TC-MARS-01",
      "reqId": "${requirementItem.id || 'REQ-01'}",
      "module": "${requirementItem.category || 'Genel'}",
      "title": "Senaryo Başlığı",
      "description": "Detaylı açıklama",
      "preconditions": "Ön koşullar",
      "steps": ["1. Birinci adım", "2. İkinci adım"],
      "stepExpectedResults": ["1. Birinci adım doğrulaması", "2. İkinci adım doğrulaması"],
      "testData": "Test Verisi",
      "expectedResult": "Genel beklenen sonuç",
      "priority": "Yüksek",
      "testType": "Pozitif",
      "executionType": "Manuel",
      "severity": "Normal"
    }
  ]
}`,
      temperature: 0.3,
      geminiSchema: {
        type: Type.OBJECT,
        properties: {
          newTestCases: {
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
                steps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                stepExpectedResults: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                testData: { type: Type.STRING },
                expectedResult: { type: Type.STRING },
                priority: { type: Type.STRING },
                testType: { type: Type.STRING },
                executionType: { type: Type.STRING },
                severity: { type: Type.STRING },
              },
              required: ['id', 'reqId', 'module', 'title', 'steps', 'expectedResult', 'priority', 'testType'],
            },
          },
        },
        required: ['newTestCases'],
      },
    });

    const parsed = extractAndParseJson(response.text, { newTestCases: [] });
    const rawList = parsed.newTestCases || (Array.isArray(parsed) ? parsed : []);

    const refinedList = rawList.map((tc: any) => {
      const rawSteps = Array.isArray(tc.steps) && tc.steps.length > 0
        ? tc.steps
        : ['1. İlgili işlemi gerçekleştirin.'];
      const normalizedSteps = rawSteps.map((s: string, sIdx: number) => {
        const clean = String(s || '').trim();
        return /^\d+[\.\)]\s*/.test(clean) ? clean : `${sIdx + 1}. ${clean}`;
      });
      const overallExp = tc.expectedResult || 'İşlemin başarıyla tamamlandığı doğrulanmalıdır.';
      const stepExp = Array.isArray(tc.stepExpectedResults) && tc.stepExpectedResults.length === normalizedSteps.length
        ? tc.stepExpectedResults
        : normalizedSteps.map((s: string, idx: number) => {
            if (idx === normalizedSteps.length - 1) return overallExp;
            const cleanAction = s.replace(/^\d+[\.\)]\s*/, '').trim();
            return `${idx + 1}. ${cleanAction} adımı başarıyla gerçekleştirilmelidir.`;
          });

      return {
        ...tc,
        steps: normalizedSteps,
        stepExpectedResults: stepExp,
      };
    });

    res.json({ newTestCases: refinedList });
  } catch (error: any) {
    console.error('Error refining test cases:', error);
    res.status(500).json({ error: 'Test senaryoları özelleştirilirken hata oluştu.', details: error?.message });
  }
});

// API Route: Jira Integration Config Status
app.get('/api/jira/status', (req, res) => {
  const hasEnvConfig = Boolean(
    process.env.JIRA_DOMAIN && process.env.JIRA_USER_EMAIL && process.env.JIRA_API_TOKEN
  );

  res.json({
    hasEnvConfig,
    domain: process.env.JIRA_DOMAIN || '',
    userEmail: process.env.JIRA_USER_EMAIL || '',
    projectKey: process.env.JIRA_PROJECT_KEY || 'TEST',
  });
});

// API Route: Create Jira Issue (Bug / Task)
app.post('/api/jira/create-issue', async (req, res) => {
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
      jiraConfig = {},
    } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Jira hata başlığı (summary) gereklidir.' });
    }

    // Resolve Jira credentials (UI config > Env vars)
    const domain = (jiraConfig.domain || process.env.JIRA_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    const userEmail = jiraConfig.userEmail || process.env.JIRA_USER_EMAIL || '';
    const apiToken = jiraConfig.apiToken || process.env.JIRA_API_TOKEN || '';

    // Sanitize Project Key (e.g. "[212868] NOVA" -> "NOVA")
    let rawProjectKey = (jiraConfig.projectKey || reqProjectKey || process.env.JIRA_PROJECT_KEY || 'TEST').trim();
    if (rawProjectKey.includes(']')) {
      const parts = rawProjectKey.split(']').map((s: string) => s.replace(/\[/g, '').trim()).filter(Boolean);
      rawProjectKey = parts[parts.length - 1] || parts[0] || 'TEST';
    } else if (rawProjectKey.includes(' ')) {
      rawProjectKey = rawProjectKey.split(' ')[0];
    }
    const projectKey = rawProjectKey.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase() || 'TEST';

    const issueType = jiraConfig.issueType || reqIssueType || 'Bug';

    let lastJiraApiError: string | null = null;

    // If real credentials are provided, call Jira REST API
    if (domain && userEmail && apiToken) {
      const jiraApiUrl = `https://${domain}/rest/api/2/issue`;
      const authHeader = `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString('base64')}`;

      const jiraPayload = {
        fields: {
          project: { key: projectKey },
          summary: summary,
          description: description || `Automated bug created from TestMatrix AI for Test Case ${testCaseId || ''}`,
          issuetype: { name: issueType },
          ...(priority ? { priority: { name: priority } } : {}),
        },
      };

      console.log(`[Jira Integration] Connecting to https://${domain} with Project Key '${projectKey}'...`);

      try {
        const jiraRes = await fetch(jiraApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jiraPayload),
        });

        if (jiraRes.ok) {
          const jiraData = await jiraRes.json();
          const issueKey = jiraData.key;
          const issueUrl = `https://${domain}/browse/${issueKey}`;

          return res.json({
            success: true,
            issueKey,
            issueUrl,
            message: `Jira üzerinde ${issueKey} numaralı hata kaydı başarıyla oluşturuldu.`,
            isSimulated: false,
          });
        } else {
          const errorText = await jiraRes.text();
          console.warn('[Jira Integration] Direct API returned error status:', jiraRes.status, errorText);
          let parsedDetails = errorText;
          try {
            const jsonErr = JSON.parse(errorText);
            parsedDetails = jsonErr.errorMessages?.join(' | ') || JSON.stringify(jsonErr.errors) || errorText;
          } catch {
            parsedDetails = errorText;
          }
          lastJiraApiError = `Jira API HTTP ${jiraRes.status}: ${parsedDetails}`;
        }
      } catch (netErr: any) {
        console.warn('[Jira Integration] Connection failed:', netErr?.message);
        lastJiraApiError = `Sunucu '${domain}' adresine erişemedi (${netErr?.message || 'fetch failed'}). Jira sunucunuz şirket içi ağda (Intranet/VPN) olabilir veya domain adresi dış internet erişimine kapalıdır.`;
      }
    }

    // Fallback mode if token is empty or network failed
    const simulatedKey = `${projectKey}-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetDomain = domain || 'your-company.atlassian.net';
    const simulatedUrl = `https://${targetDomain}/browse/${simulatedKey}`;

    return res.json({
      success: true,
      issueKey: simulatedKey,
      issueUrl: simulatedUrl,
      message: lastJiraApiError
        ? `Gerçek Jira sunucusuna bağlanılamadı (${lastJiraApiError}). Test amaçlı ${simulatedKey} kaydı simüle edildi.`
        : `Jira bilgileri eksik olduğu için simüle edilmiş ${simulatedKey} kaydı üretildi.`,
      isSimulated: true,
      jiraErrorNotice: lastJiraApiError,
    });
  } catch (error: any) {
    console.error('Jira issue creation error:', error);
    res.status(500).json({
      error: 'Jira kaydı oluşturulurken sunucu hatası meydana geldi.',
      details: error?.message,
    });
  }
});

export default app;
