import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RequirementInput } from './components/RequirementInput';
import { TemplateConfiguratorModal } from './components/TemplateConfiguratorModal';
import { TestCasesMatrix } from './components/TestCasesMatrix';
import { TraceabilityMatrixView } from './components/TraceabilityMatrixView';
import { StatsSummaryPanel } from './components/StatsSummaryPanel';
import { CoverageReportView } from './components/CoverageReportView';
import { TestExecutionView } from './components/TestExecutionView';
import { JiraModal } from './components/JiraModal';
import { AddTestCaseModal } from './components/AddTestCaseModal';
import { UserGuideModal } from './components/UserGuideModal';
import { PRESET_TEMPLATES } from './data/presetTemplates';
import { SAMPLE_REQUIREMENT_DOCS } from './data/sampleRequirements';
import { AuthScreen } from './components/AuthScreen';
import {
  loadUserDataFromCloud,
  saveUserDataToCloud,
  subscribeToUserData,
} from './firebase';
import {
  ExcelTemplateConfig,
  GenerationConfig,
  GenerationResult,
  RequirementItem,
  TestCase,
  JiraConfig,
  TestRun,
  UserProfile,
} from './types';
import { exportTestCasesToExcel } from './utils/excelHelper';
import { generateNextTestCaseId, sortTestCasesById, resequenceTestCaseIds } from './utils/idGenerator';
import {
  FileSpreadsheet,
  Layers,
  FileCheck,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Download,
  Sparkles,
  PieChart,
  Play,
  Trash2,
} from 'lucide-react';

const DEFAULT_TEST_RUNS: TestRun[] = [
  {
    id: 'RUN-1',
    name: 'Sprint 24 Regresyon Test Koşumu',
    environment: 'Staging Env-1',
    createdAt: new Date().toISOString().slice(0, 10),
    executions: {},
  },
];

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('tm_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isCloudSyncReady, setIsCloudSyncReady] = useState<boolean>(false);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('tm_user_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('tm_user_session');
    setIsCloudSyncReady(false);
    setRequirements([]);
    setTestCases([]);
    setGenerationStats(null);
    setRecommendations([]);
    setTestRuns(DEFAULT_TEST_RUNS);
    setRequirementText(SAMPLE_REQUIREMENT_DOCS[0].content);
  };

  // State
  const [requirementText, setRequirementText] = useState<string>(
    SAMPLE_REQUIREMENT_DOCS[0].content
  );
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    positiveCountPerReq: 2,
    negativeCountPerReq: 2,
    selectedFunctionalTypes: [
      'Pozitif (Fonksiyonel Doğruluk)',
      'Negatif (Hata Yönetimi)',
      'Sınır Değer Analizi (BVA)',
    ],
    selectedNonFunctionalTypes: [
      'Güvenlik ve Yetki Testi (Security)',
    ],
    includeBoundary: true,
    includeSecurity: true,
    includePerformance: false,
    language: 'tr',
    customInstructions: '',
  });

  const [activeTemplate, setActiveTemplate] = useState<ExcelTemplateConfig>(
    PRESET_TEMPLATES[0]
  );
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Add Manual Test Case Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedReqForAddModal, setSelectedReqForAddModal] = useState<string | undefined>(undefined);

  const handleOpenAddModal = (reqId?: string) => {
    setSelectedReqForAddModal(reqId);
    setIsAddModalOpen(true);
  };

  // Jira Integration State
  const DEFAULT_JIRA_CONFIG: JiraConfig = {
    domain: '',
    userEmail: '',
    apiToken: '',
    projectKey: 'TEST',
    issueType: 'Bug',
  };

  const getGuestJiraConfig = (): JiraConfig => {
    const saved = localStorage.getItem('tm_jira_config');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_JIRA_CONFIG;
  };

  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig>(getGuestJiraConfig);

  const handleSaveJiraConfig = (newConfig: JiraConfig) => {
    setJiraConfig(newConfig);
    if (currentUser?.id) {
      localStorage.setItem(`tm_jira_config_${currentUser.id}`, JSON.stringify(newConfig));
      saveUserDataToCloud(currentUser.id, { jiraConfig: newConfig });
    } else {
      localStorage.setItem('tm_jira_config', JSON.stringify(newConfig));
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefiningReqId, setIsRefiningReqId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // User-scoped workspace state
  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [generationStats, setGenerationStats] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>(DEFAULT_TEST_RUNS);
  const [activeRunId, setActiveRunId] = useState<string>('RUN-1');

  // Load & Realtime Sync with Firebase Firestore Cloud DB (Strictly scoped by User ID)
  useEffect(() => {
    if (!currentUser?.id) {
      setIsCloudSyncReady(false);
      setRequirements([]);
      setTestCases([]);
      setGenerationStats(null);
      setRecommendations([]);
      setTestRuns(DEFAULT_TEST_RUNS);
      setRequirementText(SAMPLE_REQUIREMENT_DOCS[0].content);
      setJiraConfig(getGuestJiraConfig());
      return;
    }

    let isMounted = true;
    setIsCloudSyncReady(false);

    const userCacheKey = `tm_workspace_${currentUser.id}`;
    const userJiraCacheKey = `tm_jira_config_${currentUser.id}`;

    // 1. First load Jira config & workspace from user-scoped localStorage cache for fast startup
    const cachedJira = localStorage.getItem(userJiraCacheKey);
    if (cachedJira) {
      try {
        setJiraConfig(JSON.parse(cachedJira));
      } catch {
        setJiraConfig(DEFAULT_JIRA_CONFIG);
      }
    } else {
      setJiraConfig(DEFAULT_JIRA_CONFIG);
    }

    const cachedLocal = localStorage.getItem(userCacheKey);
    if (cachedLocal) {
      try {
        const parsed = JSON.parse(cachedLocal);
        setRequirements(parsed.requirements || []);
        setTestCases(parsed.testCases || []);
        setTestRuns(parsed.testRuns || DEFAULT_TEST_RUNS);
        setGenerationStats(parsed.generationStats || null);
        setRecommendations(parsed.recommendations || []);
        if (parsed.jiraConfig) setJiraConfig(parsed.jiraConfig);
        if (parsed.requirementText) setRequirementText(parsed.requirementText);
      } catch {
        // ignore
      }
    } else {
      // Reset to empty workspace for a new user
      setRequirements([]);
      setTestCases([]);
      setGenerationStats(null);
      setRecommendations([]);
      setTestRuns(DEFAULT_TEST_RUNS);
      setRequirementText(SAMPLE_REQUIREMENT_DOCS[0].content);
    }

    // 2. Load authoritative cloud data from Firebase Firestore
    loadUserDataFromCloud(currentUser.id)
      .then((cloudData) => {
        if (!isMounted) return;
        if (cloudData) {
          setRequirements(cloudData.requirements || []);
          setTestCases(cloudData.testCases || []);
          setTestRuns(
            cloudData.testRuns && cloudData.testRuns.length > 0
              ? cloudData.testRuns
              : DEFAULT_TEST_RUNS
          );
          setGenerationStats(cloudData.generationStats || null);
          setRecommendations(cloudData.recommendations || []);
          if (cloudData.jiraConfig) {
            setJiraConfig(cloudData.jiraConfig);
            localStorage.setItem(userJiraCacheKey, JSON.stringify(cloudData.jiraConfig));
          }
          if (cloudData.requirementText) {
            setRequirementText(cloudData.requirementText);
          }
        }
        setIsCloudSyncReady(true);
      })
      .catch((err) => {
        console.warn('Error loading user cloud data:', err);
        if (isMounted) setIsCloudSyncReady(true);
      });

    // 3. Realtime listener for user workspace changes
    const unsubscribe = subscribeToUserData(currentUser.id, (updatedData) => {
      if (!isMounted) return;
      if (updatedData.requirements !== undefined) setRequirements(updatedData.requirements);
      if (updatedData.testCases !== undefined) setTestCases(updatedData.testCases);
      if (updatedData.testRuns !== undefined) setTestRuns(updatedData.testRuns);
      if (updatedData.generationStats !== undefined) setGenerationStats(updatedData.generationStats);
      if (updatedData.recommendations !== undefined) setRecommendations(updatedData.recommendations);
      if (updatedData.requirementText !== undefined) setRequirementText(updatedData.requirementText);
      if (updatedData.jiraConfig !== undefined) {
        setJiraConfig(updatedData.jiraConfig || DEFAULT_JIRA_CONFIG);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.id]);

  // Push user workspace updates to Firebase Cloud DB and user-scoped localStorage
  useEffect(() => {
    if (!currentUser?.id || !isCloudSyncReady) return;

    const payload = {
      requirementText,
      requirements,
      testCases,
      testRuns,
      generationStats,
      recommendations,
      jiraConfig,
    };

    // Save to user-scoped localStorage
    localStorage.setItem(`tm_workspace_${currentUser.id}`, JSON.stringify(payload));

    // Debounced save to Firebase Firestore
    const timer = setTimeout(() => {
      saveUserDataToCloud(currentUser.id, payload);
    }, 800);

    return () => clearTimeout(timer);
  }, [
    currentUser?.id,
    isCloudSyncReady,
    requirementText,
    requirements,
    testCases,
    testRuns,
    generationStats,
    recommendations,
    jiraConfig,
  ]);

  const [activeTab, setActiveTab] = useState<'matrix' | 'execution' | 'coverage' | 'rtm' | 'stats'>('matrix');

  // Trigger AI Test Case Generation
  const handleGenerate = async () => {
    if (!requirementText.trim()) return;

    const selectedFunctional = generationConfig.selectedFunctionalTypes || [];
    const selectedNonFunctional = generationConfig.selectedNonFunctionalTypes || [];
    if (selectedFunctional.length + selectedNonFunctional.length === 0) {
      setErrorMessage(
        'Lütfen test case üretimi için en az bir test tekniği seçiniz! (Fonksiyonel veya Fonksiyonel Olmayan Testler bölümünden seçim yapabilirsiniz).'
      );
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate-test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementText,
          templateColumns: activeTemplate.columns,
          config: generationConfig,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const detailMsg = errJson.details ? `: ${errJson.details}` : '';
        throw new Error((errJson.error || 'Test senaryoları üretilirken sunucu hatası oluştu.') + detailMsg);
      }

      const data: GenerationResult = await response.json();
      setRequirements(data.requirements || []);
      const { resequencedTestCases } = resequenceTestCaseIds(data.testCases || []);
      setTestCases(resequencedTestCases);
      setGenerationStats(data.stats);
      setRecommendations(data.recommendations || []);
      setActiveTab('matrix');
    } catch (err: any) {
      console.error('Generation Error:', err);
      setErrorMessage(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add / Refine test cases for a single requirement
  const handleRefineRequirement = async (
    reqId: string,
    promptInstruction: string
  ): Promise<number> => {
    const reqObj = requirements.find((r) => r.id === reqId);
    if (!reqObj) return 0;

    setIsRefiningReqId(reqId);
    let addedCount = 0;
    try {
      const existing = testCases.filter((tc) => tc.reqId === reqId);
      const response = await fetch('/api/refine-test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementItem: reqObj,
          existingTestCases: existing,
          promptInstruction,
          language: generationConfig.language,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.newTestCases && resData.newTestCases.length > 0) {
          addedCount = resData.newTestCases.length;
          setTestCases((prev) => {
            let currentList = [...prev];
            for (const rawTc of resData.newTestCases) {
              const sequentialId = generateNextTestCaseId(reqId, currentList);
              const formattedTc: TestCase = {
                ...rawTc,
                id: sequentialId,
                reqId: reqId,
              };
              currentList.push(formattedTc);
            }
            const { resequencedTestCases } = resequenceTestCaseIds(currentList);
            return resequencedTestCases;
          });
          setRequirements((prevReqs) =>
            prevReqs.map((r) =>
              r.id === reqId
                ? {
                    ...r,
                    coverageStatus: 'Full',
                    gapDescription: undefined,
                  }
                : r
            )
          );
        }
      }
    } catch (err) {
      console.error('Refine Error:', err);
    } finally {
      setIsRefiningReqId(null);
    }
    return addedCount;
  };

  // Auto generate missing test cases for a specific requirement across full ISTQB scope
  const handleAutoGenerateMissingForReq = async (req: RequirementItem): Promise<number> => {
    const prompt = `EXPAND TEST COVERAGE: Please generate missing test scenarios for requirement ${req.id} (${req.title}) to achieve full ISTQB coverage. Generate test cases covering all remaining ISTQB test types: Negative error handling, Boundary Value Analysis (BVA), Equivalence Partitioning (EP), Security & Authorization, Performance/Load, and Usability/UX if not already present.`;
    return await handleRefineRequirement(req.id, prompt);
  };

  // Expand coverage across all requirements
  const handleExpandAllCoverage = async (): Promise<number> => {
    let totalAdded = 0;
    for (const req of requirements) {
      const added = await handleAutoGenerateMissingForReq(req);
      totalAdded += added || 0;
    }
    return totalAdded;
  };

  // CRUD Operations on Test Cases with Sequential Auto-Reordering
  const handleUpdateTestCase = (updatedTc: TestCase) => {
    setTestCases((prev) => {
      const updated = prev.map((tc) => (tc.id === updatedTc.id ? updatedTc : tc));
      const { resequencedTestCases } = resequenceTestCaseIds(updated);
      return resequencedTestCases;
    });
  };

  const handleDeleteTestCase = (tcId: string) => {
    setTestCases((prev) => {
      const filtered = prev.filter((tc) => tc.id !== tcId);
      const { resequencedTestCases, idMap } = resequenceTestCaseIds(filtered);

      // Remap test runs if test case IDs shifted
      if (Object.keys(idMap).length > 0) {
        setTestRuns((prevRuns) =>
          prevRuns.map((run) => {
            const newExecutions: Record<string, any> = {};
            Object.entries(run.executions || {}).forEach(([oldId, exec]) => {
              if (oldId !== tcId) {
                const targetId = idMap[oldId] || oldId;
                newExecutions[targetId] = { ...(exec as object), tcId: targetId };
              }
            });
            return { ...run, executions: newExecutions };
          })
        );
      }

      return resequencedTestCases;
    });
  };

  const handleAddTestCase = (newTc: TestCase) => {
    setTestCases((prev) => {
      const combined = [...prev, newTc];
      const { resequencedTestCases } = resequenceTestCaseIds(combined);
      return resequencedTestCases;
    });
  };

  // Direct Excel Export
  const handleExportExcel = async () => {
    if (testCases.length === 0) return;
    await exportTestCasesToExcel(
      testCases,
      activeTemplate,
      requirements,
      `Gelistirme_Test_Durum_Dokumani.xlsx`
    );
  };

  // Reset Confirmation State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const executeReset = () => {
    const isEn = generationConfig.language === 'en';
    setRequirementText('');
    setTestCases([]);
    setRequirements([]);
    setGenerationStats(null);
    setRecommendations([]);
    const defaultRuns: TestRun[] = [
      {
        id: 'RUN-1',
        name: isEn ? 'Sprint 24 Regression Test Run' : 'Sprint 24 Regresyon Test Koşumu',
        environment: 'Staging Env-1',
        createdAt: new Date().toISOString().slice(0, 10),
        executions: {},
      },
    ];
    setTestRuns(defaultRuns);
    setActiveRunId('RUN-1');
    localStorage.removeItem('tm_requirements');
    localStorage.removeItem('tm_test_cases');
    localStorage.removeItem('tm_generation_stats');
    localStorage.removeItem('tm_test_runs');
    localStorage.removeItem('tm_active_run_id');
    setIsResetModalOpen(false);
  };


  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        language={generationConfig.language}
        onToggleLanguage={() =>
          setGenerationConfig({
            ...generationConfig,
            language: generationConfig.language === 'tr' ? 'en' : 'tr',
          })
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Application Header */}
      <Header
        templateName={activeTemplate.templateName}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        onOpenJiraModal={() => setIsJiraModalOpen(true)}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onExportExcel={handleExportExcel}
        onReset={handleReset}
        hasTestCases={testCases.length > 0}
        language={generationConfig.language}
        onToggleLanguage={() =>
          setGenerationConfig({
            ...generationConfig,
            language: generationConfig.language === 'tr' ? 'en' : 'tr',
          })
        }
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-4 rounded-xl flex items-start gap-3 shadow-lg animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <strong className="font-bold text-sm block text-rose-100">Hata Oluştu</strong>
              <p className="mt-1 text-rose-300">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold text-xs"
            >
              Kapat
            </button>
          </div>
        )}

        {/* 1. Requirements Input & AI Config Section */}
        <RequirementInput
          requirementText={requirementText}
          onChangeRequirementText={setRequirementText}
          config={generationConfig}
          onChangeConfig={setGenerationConfig}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          activeTemplateName={activeTemplate.templateName}
          onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        />

        {/* Results Navigation Tabs & Views */}
        {testCases.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* View Switching Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1117] border border-white/10 p-2 rounded-2xl">
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setActiveTab('matrix')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'matrix'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Test Case Matrisi ({testCases.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('execution')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'execution'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Play className="w-4 h-4 text-emerald-400" />
                  <span>Test Koşumu (Execution)</span>
                </button>

                <button
                  onClick={() => setActiveTab('coverage')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'coverage'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <PieChart className="w-4 h-4 text-blue-400" />
                  <span>Kapsam & Eksik Analizi</span>
                </button>

                <button
                  onClick={() => setActiveTab('rtm')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'rtm'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  <span>İzlenebilirlik Matrisi (RTM)</span>
                </button>

                <button
                  onClick={() => setActiveTab('stats')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'stats'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>QA Metrikleri</span>
                </button>
              </div>
            </div>

            {/* Active View Content */}
            {activeTab === 'matrix' && (
              <TestCasesMatrix
                testCases={testCases}
                requirements={requirements}
                template={activeTemplate}
                onUpdateTestCase={handleUpdateTestCase}
                onDeleteTestCase={handleDeleteTestCase}
                onAddTestCase={handleAddTestCase}
                onRefineRequirement={handleRefineRequirement}
                isRefiningReqId={isRefiningReqId}
                onExportExcel={handleExportExcel}
                onOpenAddModal={handleOpenAddModal}
                language={generationConfig.language}
              />
            )}

            {activeTab === 'execution' && (
              <TestExecutionView
                testCases={testCases}
                requirements={requirements}
                jiraConfig={jiraConfig}
                onOpenJiraModal={() => setIsJiraModalOpen(true)}
                testRuns={testRuns}
                setTestRuns={setTestRuns}
                activeRunId={activeRunId}
                setActiveRunId={setActiveRunId}
                language={generationConfig.language}
              />
            )}

            {activeTab === 'coverage' && (
              <CoverageReportView
                requirements={requirements}
                testCases={testCases}
                stats={generationStats || {
                  totalRequirements: requirements.length,
                  totalTestCases: testCases.length,
                  positiveCount: 0,
                  negativeCount: 0,
                  boundaryCount: 0,
                  securityCount: 0,
                  performanceCount: 0,
                  highPriorityCount: 0,
                  coverageScore: 100,
                }}
                recommendations={recommendations}
                onAutoGenerateMissing={handleAutoGenerateMissingForReq}
                onExpandAllCoverage={handleExpandAllCoverage}
                isRefining={Boolean(isRefiningReqId)}
                isRefiningReqId={isRefiningReqId}
                language={generationConfig.language}
              />
            )}

            {activeTab === 'rtm' && (
              <TraceabilityMatrixView
                requirements={requirements}
                testCases={testCases}
                language={generationConfig.language}
              />
            )}

            {activeTab === 'stats' && generationStats && (
              <StatsSummaryPanel
                stats={generationStats}
                recommendations={recommendations}
                language={generationConfig.language}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0A0C10] py-6 text-center text-xs text-slate-500">
        <p>TestMatrix AI — Software Test Engineering & Requirement Specification Suite</p>
      </footer>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  {generationConfig.language === 'en' ? 'Clear All Data?' : 'Tüm Verileri Temizle?'}
                </h3>
                <p className="text-xs text-slate-400">
                  {generationConfig.language === 'en'
                    ? 'This action will clear requirement text, generated test cases, and test run records.'
                    : 'Gereksinim metnini, üretilen tüm test senaryolarını ve test koşum verilerini tamamen temizlemek istediğinize emin misiniz?'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                {generationConfig.language === 'en' ? 'Cancel' : 'İptal'}
              </button>
              <button
                onClick={executeReset}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md shadow-rose-900/40 transition-colors"
              >
                {generationConfig.language === 'en' ? 'Yes, Clear All' : 'Evet, Hepsini Temizle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Customizer Modal */}
      <TemplateConfiguratorModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        activeTemplate={activeTemplate}
        onSaveTemplate={(updated) => setActiveTemplate(updated)}
        language={generationConfig.language}
      />

      {/* Jira Integration Config Modal */}
      <JiraModal
        isOpen={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        jiraConfig={jiraConfig}
        onSaveConfig={handleSaveJiraConfig}
        language={generationConfig.language}
      />

      {/* User Guide Modal */}
      <UserGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        language={generationConfig.language}
      />

      {/* Manual Test Case Add Modal */}
      <AddTestCaseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        requirements={requirements}
        testCases={testCases}
        defaultReqId={selectedReqForAddModal}
        onAddTestCase={handleAddTestCase}
        language={generationConfig.language}
      />

    </div>
  );
}

