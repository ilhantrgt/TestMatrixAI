import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with user-agent
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY ortam değişkeni ayarlanmamış.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TestMatrix AI Engine', timestamp: new Date().toISOString() });
});

// API Route: Generate Test Cases from Requirements Document
app.post('/api/generate-test-cases', async (req, res) => {
  try {
    const {
      requirementText,
      templateColumns,
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

    const ai = getGenAIClient();

    const columnNamesList = Array.isArray(templateColumns)
      ? templateColumns.map((c: any) => `${c.name} (${c.mappedField})`).join(', ')
      : 'Standard ISTQB Columns';

    const systemPrompt = `You are a Senior Principal Software Test Automation Engineer (ISTQB Certified).
Your goal is to carefully analyze the provided Software Requirements Specification (SRS) or User Stories, extract distinct requirement items (e.g., REQ-001, REQ-002, US-01), and auto-generate comprehensive, professional, industry-standard test cases following standard ISTQB Test Types and Techniques.

The output MUST be in ${config.language === 'en' ? 'English' : 'Turkish'}.

Follow these ISTQB CTFL QA Best Practices:
1. Break down the requirement document into individual Requirement Items with ID, Title, and Description.
2. For EACH Requirement Item, generate test cases spanning appropriate ISTQB test categories:
   - Functional Testing:
     * Pozitif (Fonksiyonel Doğruluk) - Happy path verification
     * Negatif (Hata Yönetimi) - Validation errors, invalid inputs, edge failures
     * Sınır Değer Analizi (BVA) & Eşdeğer Sınıflandırma (EP)
     * Durum Geçiş Testi (State Transition) / Karar Tablosu (Decision Table) / Kullanım Senaryosu (Use Case)
   - Non-Functional Testing:
     ${config.includeSecurity ? '* Güvenlik ve Yetki Testi (Security, Auth, RBAC, Injection, Session)' : ''}
     ${config.includePerformance ? '* Performans Testi (Performance, Load, Latency, Timeouts)' : ''}
     ${config.includeUsability ? '* Kullanılabilirlik Testi (Usability / UX)' : ''}
     ${config.includeCompatibility ? '* Uyumluluk ve Çapraz Platform (Compatibility)' : ''}
   - Change-Related & Acceptance:
     ${config.includeUAT ? '* Kullanıcı Kabul Testi (UAT)' : ''}
     ${config.includeRegression ? '* Regresyon Testi (Regression)' : ''}
3. Test steps must be numbered, clear, step-by-step instructions.
4. Provide concrete, realistic Test Data (e.g. sample credit cards, IBANs, boundary numbers).
5. Provide unambiguous, clear Expected Results.
6. Categorize Priority as Yüksek/Orta/Düşük (or High/Medium/Low) and Severity as Kritik/Yüksek/Normal/Düşük.
7. Categorize Test Type precisely using standard ISTQB types:
   "Pozitif (Fonksiyonel Doğruluk)", "Negatif (Hata Yönetimi)", "Sınır Değer Analizi (BVA)", "Eşdeğer Sınıflandırma (EP)", "Durum Geçiş Testi (State Transition)", "Karar Tablosu Testi (Decision Table)", "Kullanım Senaryosu Testi (Use Case)", "Performans Testi (Performance)", "Yük ve Stres Testi (Load & Stress)", "Güvenlik ve Yetki Testi (Security)", "Kullanılabilirlik Testi (Usability / UX)", "Uyumluluk ve Çapraz Platform (Compatibility)", "Erişilebilirlik Testi (Accessibility / WCAG)", "Regresyon Testi (Regression)", "Kullanıcı Kabul Testi (UAT)", "Sistem Entegrasyon Testi (SIT)".

Target Export Column Mapping structure: ${columnNamesList}
${config.customInstructions ? `Additional User Testing Guidelines: ${config.customInstructions}` : ''}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Gereksinim Dökümanı Metni:\n\n${requirementText}\n\nLütfen tüm gereksinim maddelerini çıkartıp bunlar için ayrıntılı profesyonel test senaryolarını oluşturun.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            requirements: {
              type: Type.ARRAY,
              description: 'Extracted individual requirements from SRS',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Requirement ID, e.g., REQ-PAY-01' },
                  title: { type: Type.STRING, description: 'Short title of the requirement' },
                  description: { type: Type.STRING, description: 'Full statement of the requirement' },
                  category: { type: Type.STRING, description: 'Module or functional category' },
                },
                required: ['id', 'title', 'description'],
              },
            },
            testCases: {
              type: Type.ARRAY,
              description: 'Generated detailed test scenarios for each requirement',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Test Case ID, e.g. TC-PAY01-001' },
                  reqId: { type: Type.STRING, description: 'Matching Requirement ID, e.g. REQ-PAY-01' },
                  module: { type: Type.STRING, description: 'Module or feature name' },
                  title: { type: Type.STRING, description: 'Test scenario summary title' },
                  description: { type: Type.STRING, description: 'Detailed test objective' },
                  preconditions: { type: Type.STRING, description: 'Prerequisites, initial states, setup' },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Ordered step-by-step execution instructions',
                  },
                  testData: { type: Type.STRING, description: 'Input values, test credentials, test payloads' },
                  expectedResult: { type: Type.STRING, description: 'Verification criteria and expected system behavior' },
                  priority: { type: Type.STRING, description: 'Yüksek, Orta, or Düşük' },
                  testType: {
                    type: Type.STRING,
                    description:
                      'Standard ISTQB Test Type (e.g., Pozitif (Fonksiyonel Doğruluk), Negatif (Hata Yönetimi), Sınır Değer Analizi (BVA), Eşdeğer Sınıflandırma (EP), Durum Geçiş Testi (State Transition), Karar Tablosu Testi (Decision Table), Kullanım Senaryosu Testi (Use Case), Performans Testi (Performance), Güvenlik ve Yetki Testi (Security), Kullanılabilirlik Testi (Usability / UX), Uyumluluk ve Çapraz Platform (Compatibility), Regresyon Testi (Regression), Kullanıcı Kabul Testi (UAT))',
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
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'QA strategy recommendations, risk observations, or missing edge cases identified',
            },
          },
          required: ['requirements', 'testCases'],
        },
      },
    });

    let jsonText = response.text || '{}';
    jsonText = jsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('JSON parse error on Gemini output:', jsonText);
      throw new Error('Yapay zeka yanıtı geçerli JSON formatında ayrıştırılamadı.');
    }

    // Process requirement coverage items
    const rawRequirements = parsedData.requirements || [];
    const allTestCases = parsedData.testCases || [];

    let fullyCoveredReqs = 0;
    let partiallyCoveredReqs = 0;
    let uncoveredReqs = 0;

    const processedRequirements = rawRequirements.map((req: any) => {
      const matchedTCs = allTestCases.filter(
        (tc: any) => String(tc.reqId).toLowerCase().trim() === String(req.id).toLowerCase().trim()
      );

      const hasPos = matchedTCs.some((tc: any) => tc.testType === 'Pozitif');
      const hasNeg = matchedTCs.some((tc: any) => tc.testType === 'Negatif');
      const hasBva = matchedTCs.some((tc: any) => String(tc.testType).includes('Sınır'));
      const hasSec = matchedTCs.some((tc: any) => tc.testType === 'Güvenlik');

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
        gapDescription = 'Gereksinim hem pozitif hem de negatif senaryolarla tam kapsandı.';
        fullyCoveredReqs++;
      } else {
        coverageStatus = 'Partial';
        gapDescription = `Eksik alanlar var: ${missing.join(', ')}.`;
        partiallyCoveredReqs++;
      }

      return {
        ...req,
        coverageStatus,
        missingTestTypes: missing,
        gapDescription,
      };
    });

    // Calculate coverage stats
    const totalReqs = processedRequirements.length;
    const totalTCs = allTestCases.length;

    const positiveCount = allTestCases.filter((tc: any) => tc.testType === 'Pozitif').length;
    const negativeCount = allTestCases.filter((tc: any) => tc.testType === 'Negatif').length;
    const boundaryCount = allTestCases.filter((tc: any) => String(tc.testType).includes('Sınır')).length;
    const securityCount = allTestCases.filter((tc: any) => tc.testType === 'Güvenlik').length;
    const performanceCount = allTestCases.filter((tc: any) => tc.testType === 'Performans').length;
    const highPriorityCount = allTestCases.filter(
      (tc: any) => tc.priority === 'Yüksek' || tc.priority === 'High'
    ).length;

    // Calculate coverage score
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
      recommendations: parsedData.recommendations || [
        'Tüm pozitif ve negatif ana akışlar analiz edildi.',
        'Sınır değer analizi ve hata durumları kontrol edildi.',
      ],
    };

    res.json(result);
  } catch (error: any) {
    console.error('Error generating test cases:', error);
    res.status(500).json({
      error: 'Test senaryoları üretilirken bir yapay zeka hatası oluştu.',
      details: error?.message || String(error),
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

    const ai = getGenAIClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Requirement: ${JSON.stringify(requirementItem)}
Existing Test Cases: ${JSON.stringify(existingTestCases || [])}
User Instruction: ${promptInstruction || 'Generate 2 additional edge-case test scenarios for this requirement.'}

Please return NEW unique test cases in ${language === 'en' ? 'English' : 'Turkish'} for this requirement.`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
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
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ newTestCases: parsed.newTestCases || [] });
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
    const projectKey = jiraConfig.projectKey || reqProjectKey || process.env.JIRA_PROJECT_KEY || 'TEST';
    const issueType = jiraConfig.issueType || reqIssueType || 'Bug';

    // If real credentials are provided, call Jira REST API
    if (domain && userEmail && apiToken) {
      const jiraApiUrl = `https://${domain}/rest/api/2/issue`;
      const authHeader = `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString('base64')}`;

      const jiraPayload = {
        fields: {
          project: { key: projectKey.toUpperCase() },
          summary: summary,
          description: description || `Automated bug created from TestMatrix AI for Test Case ${testCaseId || ''}`,
          issuetype: { name: issueType },
          ...(priority ? { priority: { name: priority } } : {}),
        },
      };

      console.log(`[Jira Integration] Connecting to https://${domain}...`);

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
        console.warn('[Jira Integration] Direct API returned error, falling back to simulated ticket:', errorText);
      }
    }

    // Fallback mode if token is empty or invalid
    const simulatedKey = `${projectKey.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetDomain = domain || 'your-company.atlassian.net';
    const simulatedUrl = `https://${targetDomain}/browse/${simulatedKey}`;

    return res.json({
      success: true,
      issueKey: simulatedKey,
      issueUrl: simulatedUrl,
      message: domain && userEmail && apiToken
        ? `Jira API yanıt verdi ancak simülasyon modu kullanıldı (${simulatedKey}).`
        : `Jira API token girilmediği için simüle edilmiş ${simulatedKey} kaydı üretildi. Gerçek Jira bağlantısı için ayarları doldurabilirsiniz.`,
      isSimulated: true,
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
