import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RequirementInput } from './components/RequirementInput';
import { TestCasesMatrix } from './components/TestCasesMatrix';
import { TraceabilityMatrixView } from './components/TraceabilityMatrixView';
import { StatsSummaryPanel } from './components/StatsSummaryPanel';
import { CoverageReportView } from './components/CoverageReportView';
import { TestExecutionView } from './components/TestExecutionView';
import { AddTestCaseModal } from './components/AddTestCaseModal';
import { UserGuideModal } from './components/UserGuideModal';
import { ConfigurationHubModal, ConfigTab } from './components/ConfigurationHubModal';
import { ProjectBar } from './components/ProjectBar';
import { ShareProjectModal } from './components/ShareProjectModal';
import { PRESET_TEMPLATES } from './data/presetTemplates';
import { SAMPLE_REQUIREMENT_DOCS } from './data/sampleRequirements';
import { AuthScreen } from './components/AuthScreen';
import {
  loadUserDataFromCloud,
  saveUserDataToCloud,
  subscribeToUserData,
  saveSharedProjectToCloud,
  deleteSharedProjectFromCloud,
  loadSharedProjectsForUser,
  subscribeToSharedProject,
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
  Project,
  CorporateMemoryRule,
} from './types';
import { exportTestCasesToExcel } from './utils/excelHelper';
import { generateNextTestCaseId, sortTestCasesById, resequenceTestCaseIds } from './utils/idGenerator';
import {
  getSavedCorporateRules,
  addCorporateRule,
  deleteCorporateRule,
  toggleCorporateRuleActive,
  resetCorporateRulesToDefault,
} from './utils/corporateMemoryStore';
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<ConfigTab>('memory');

  const handleOpenSettings = (tab: ConfigTab = 'memory') => {
    setSettingsTab(tab);
    setIsSettingsModalOpen(true);
  };

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

  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [corporateRules, setCorporateRules] = useState<CorporateMemoryRule[]>(getSavedCorporateRules);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig>(getGuestJiraConfig);

  const handleAddCorporateRule = (newRule: Omit<CorporateMemoryRule, 'id' | 'createdAt'>) => {
    const created = addCorporateRule(newRule);
    setCorporateRules(getSavedCorporateRules());
  };

  const handleDeleteCorporateRule = (id: string) => {
    const updated = deleteCorporateRule(id);
    setCorporateRules(updated);
  };

  const handleToggleCorporateRule = (id: string) => {
    const updated = toggleCorporateRuleActive(id);
    setCorporateRules(updated);
  };

  const handleResetCorporateRules = () => {
    const updated = resetCorporateRulesToDefault();
    setCorporateRules(updated);
  };

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

  // User-scoped projects state
  const createDefaultProject = (id = 'proj_default_1', name = 'Ana Proje'): Project => ({
    id,
    name,
    description: 'Varsayılan Test Matrix Projesi',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requirementText: SAMPLE_REQUIREMENT_DOCS[0].content,
    requirements: [],
    testCases: [],
    testRuns: DEFAULT_TEST_RUNS,
    generationStats: null,
    recommendations: [],
  });

  const [projects, setProjects] = useState<Project[]>([createDefaultProject()]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj_default_1');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [generationStats, setGenerationStats] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>(DEFAULT_TEST_RUNS);
  const [activeRunId, setActiveRunId] = useState<string>('RUN-1');

  const lastSavedPayloadStrRef = React.useRef<string>('');
  const isRemoteUpdateRef = React.useRef<boolean>(false);

  // Load & Realtime Sync with Firebase Firestore Cloud DB (Strictly scoped by User ID)
  useEffect(() => {
    if (!currentUser?.id) {
      setIsCloudSyncReady(false);
      const defProj = createDefaultProject();
      setProjects([defProj]);
      setActiveProjectId(defProj.id);
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

    // 1. First load Jira config from cache
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

    // Helper to process workspace data (cached or from cloud)
    const processWorkspaceData = (data: any, fromRemote = false) => {
      if (!data) return;
      if (fromRemote) {
        isRemoteUpdateRef.current = true;
      }
      if (data.jiraConfig) setJiraConfig(data.jiraConfig);

      if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
        setProjects(data.projects);
        const validActiveId =
          data.activeProjectId && data.projects.some((p: Project) => p.id === data.activeProjectId)
            ? data.activeProjectId
            : data.projects[0].id;
        setActiveProjectId(validActiveId);

        const activeProj = data.projects.find((p: Project) => p.id === validActiveId) || data.projects[0];
        setRequirements(activeProj.requirements || []);
        setTestCases(activeProj.testCases || []);
        setTestRuns(
          activeProj.testRuns && activeProj.testRuns.length > 0
            ? activeProj.testRuns
            : DEFAULT_TEST_RUNS
        );
        setGenerationStats(activeProj.generationStats || null);
        setRecommendations(activeProj.recommendations || []);
        setRequirementText(activeProj.requirementText || '');
      } else {
        // Fallback/Migration from single project schema to multi-project schema
        const migratedProj: Project = {
          id: 'proj_default_1',
          name: 'Ana Proje',
          description: 'Varsayılan Projeniz',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          requirementText:
            data.requirementText !== undefined
              ? data.requirementText
              : SAMPLE_REQUIREMENT_DOCS[0].content,
          requirements: data.requirements || [],
          testCases: data.testCases || [],
          testRuns: data.testRuns || DEFAULT_TEST_RUNS,
          generationStats: data.generationStats || null,
          recommendations: data.recommendations || [],
        };
        setProjects([migratedProj]);
        setActiveProjectId(migratedProj.id);
        setRequirements(migratedProj.requirements || []);
        setTestCases(migratedProj.testCases || []);
        setTestRuns(migratedProj.testRuns || DEFAULT_TEST_RUNS);
        setGenerationStats(migratedProj.generationStats || null);
        setRecommendations(migratedProj.recommendations || []);
        setRequirementText(migratedProj.requirementText || '');
      }
    };

    // Load from local cache for fast load
    const cachedLocal = localStorage.getItem(userCacheKey);
    if (cachedLocal) {
      try {
        processWorkspaceData(JSON.parse(cachedLocal), false);
      } catch {}
    }

    // 2. Load authoritative cloud data from Firebase Firestore
    loadUserDataFromCloud(currentUser.id)
      .then((cloudData) => {
        if (!isMounted) return;
        if (cloudData) {
          processWorkspaceData(cloudData, true);
        }
        setIsCloudSyncReady(true);

        // Also fetch any collaborative projects shared with this user's email
        if (currentUser.email) {
          loadSharedProjectsForUser(currentUser.email, currentUser.id)
            .then((sharedProjects) => {
              if (!isMounted || !sharedProjects || sharedProjects.length === 0) return;
              setProjects((prev) => {
                const map: Record<string, Project> = {};
                prev.forEach((p) => {
                  map[p.id] = p;
                });
                sharedProjects.forEach((sp) => {
                  map[sp.id] = { ...sp, isShared: true };
                });
                const combined = Object.values(map);

                // Check URL parameter for project invite link
                const urlParams = new URLSearchParams(window.location.search);
                const queryProjId = urlParams.get('projectId');
                if (queryProjId && combined.some((p) => p.id === queryProjId)) {
                  setActiveProjectId(queryProjId);
                  const target = combined.find((p) => p.id === queryProjId);
                  if (target) {
                    setRequirements(target.requirements || []);
                    setTestCases(target.testCases || []);
                    setTestRuns(target.testRuns || DEFAULT_TEST_RUNS);
                    setGenerationStats(target.generationStats || null);
                    setRecommendations(target.recommendations || []);
                    setRequirementText(target.requirementText || '');
                  }
                }

                return combined;
              });
            })
            .catch((err) => console.warn('Error fetching shared projects:', err));
        }
      })
      .catch((err) => {
        console.warn('Error loading user cloud data:', err);
        if (isMounted) setIsCloudSyncReady(true);
      });

    // 3. Realtime listener for user workspace changes
    const unsubscribe = subscribeToUserData(currentUser.id, (updatedData) => {
      if (!isMounted) return;
      processWorkspaceData(updatedData, true);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.email]);

  // Real-time synchronization for active shared project
  useEffect(() => {
    if (!activeProjectId) return;
    const currentProj = projects.find((p) => p.id === activeProjectId);
    if (!currentProj?.isShared) return;

    let isMounted = true;
    const unsubShared = subscribeToSharedProject(activeProjectId, (remoteProj) => {
      if (!isMounted || !remoteProj) return;
      isRemoteUpdateRef.current = true;
      setProjects((prev) =>
        prev.map((p) => (p.id === remoteProj.id ? { ...remoteProj, isShared: true } : p))
      );
      setRequirements(remoteProj.requirements || []);
      setTestCases(remoteProj.testCases || []);
      setTestRuns(
        remoteProj.testRuns && remoteProj.testRuns.length > 0
          ? remoteProj.testRuns
          : DEFAULT_TEST_RUNS
      );
      setGenerationStats(remoteProj.generationStats || null);
      setRecommendations(remoteProj.recommendations || []);
      setRequirementText(remoteProj.requirementText || '');
    });

    return () => {
      isMounted = false;
      unsubShared();
    };
  }, [activeProjectId]);

  // Sync current active project state into the `projects` list (guarded against redundant references)
  useEffect(() => {
    if (!activeProjectId) return;
    setProjects((prevProjects) => {
      const existing = prevProjects.find((p) => p.id === activeProjectId);
      if (existing) {
        if (
          existing.requirementText === requirementText &&
          existing.requirements === requirements &&
          existing.testCases === testCases &&
          existing.testRuns === testRuns &&
          existing.generationStats === generationStats &&
          existing.recommendations === recommendations
        ) {
          return prevProjects;
        }
      }
      return prevProjects.map((p) => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            requirementText,
            requirements,
            testCases,
            testRuns,
            generationStats,
            recommendations,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
    });
  }, [
    activeProjectId,
    requirementText,
    requirements,
    testCases,
    testRuns,
    generationStats,
    recommendations,
  ]);

  // Project Management Handlers
  const handleSelectProject = (projectId: string) => {
    if (projectId === activeProjectId) return;
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    setActiveProjectId(projectId);
    setRequirementText(targetProj.requirementText || '');
    setRequirements(targetProj.requirements || []);
    setTestCases(targetProj.testCases || []);
    setTestRuns(
      targetProj.testRuns && targetProj.testRuns.length > 0
        ? targetProj.testRuns
        : DEFAULT_TEST_RUNS
    );
    setGenerationStats(targetProj.generationStats || null);
    setRecommendations(targetProj.recommendations || []);
  };

  const handleCreateProject = (
    name: string,
    description: string,
    startWithSample: boolean
  ) => {
    const newProjId = 'proj_' + Date.now();
    const newProjText = startWithSample ? SAMPLE_REQUIREMENT_DOCS[0].content : '';
    const newProject: Project = {
      id: newProjId,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: currentUser?.id,
      ownerEmail: currentUser?.email,
      ownerName: currentUser?.name || 'Proje Yöneticisi',
      isShared: false,
      members: [],
      sharedEmails: currentUser?.email ? [currentUser.email.toLowerCase().trim()] : [],
      requirementText: newProjText,
      requirements: [],
      testCases: [],
      testRuns: DEFAULT_TEST_RUNS,
      generationStats: null,
      recommendations: [],
    };

    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProjId);
    setRequirementText(newProjText);
    setRequirements([]);
    setTestCases([]);
    setTestRuns(DEFAULT_TEST_RUNS);
    setGenerationStats(null);
    setRecommendations([]);
  };

  const handleUpdateProject = (
    projectId: string,
    name: string,
    description: string
  ) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, name, description, updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return; // Must keep at least 1 project

    const targetProj = projects.find((p) => p.id === projectId);
    if (targetProj?.isShared && targetProj.ownerId === currentUser?.id) {
      deleteSharedProjectFromCloud(projectId).catch(() => {});
    }

    const remainingProjects = projects.filter((p) => p.id !== projectId);
    setProjects(remainingProjects);

    if (activeProjectId === projectId) {
      const nextProject = remainingProjects[0];
      setActiveProjectId(nextProject.id);
      setRequirementText(nextProject.requirementText || '');
      setRequirements(nextProject.requirements || []);
      setTestCases(nextProject.testCases || []);
      setTestRuns(
        nextProject.testRuns && nextProject.testRuns.length > 0
          ? nextProject.testRuns
          : DEFAULT_TEST_RUNS
      );
      setGenerationStats(nextProject.generationStats || null);
      setRecommendations(nextProject.recommendations || []);
    }
  };

  // Handler for updating project team members and collaborative sharing settings
  const handleUpdateProjectSharing = async (updatedProject: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    await saveSharedProjectToCloud(updatedProject);
    if (currentUser?.id) {
      saveUserDataToCloud(currentUser.id, {
        projects: projects.map((p) =>
          p.id === updatedProject.id ? updatedProject : p
        ),
      });
    }
  };

  // Push user workspace updates to Firebase Cloud DB and user-scoped localStorage
  useEffect(() => {
    if (!currentUser?.id || !isCloudSyncReady || projects.length === 0) return;

    const payload = {
      projects,
      activeProjectId,
      requirementText,
      requirements,
      testCases,
      testRuns,
      generationStats,
      recommendations,
      jiraConfig,
    };

    const payloadStr = JSON.stringify(payload);

    // Save to user-scoped localStorage
    localStorage.setItem(`tm_workspace_${currentUser.id}`, payloadStr);

    // If update originated from cloud snapshot or cache, skip saving back to cloud
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      lastSavedPayloadStrRef.current = payloadStr;
      return;
    }

    // Skip redundant network writes if payload has not changed
    if (payloadStr === lastSavedPayloadStrRef.current) {
      return;
    }

    // Debounced save to Firebase Firestore
    const timer = setTimeout(() => {
      lastSavedPayloadStrRef.current = payloadStr;
      saveUserDataToCloud(currentUser.id, payload);

      // If active project is a shared project, also sync to sharedProjects
      const activeProj = projects.find((p) => p.id === activeProjectId);
      if (activeProj?.isShared) {
        saveSharedProjectToCloud(activeProj);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    currentUser?.id,
    isCloudSyncReady,
    projects,
    activeProjectId,
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
      const activeCorporateRules = corporateRules.filter((r) => r.isDefaultActive);
      const response = await fetch('/api/generate-test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementText,
          templateColumns: activeTemplate.columns,
          corporateRules: activeCorporateRules,
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

  // Direct Excel Export with current active Test Run execution status
  const handleExportExcel = async () => {
    if (testCases.length === 0) return;
    const activeRun = testRuns.find((r) => r.id === activeRunId) || testRuns[0];
    await exportTestCasesToExcel(
      testCases,
      activeTemplate,
      requirements,
      `Gelistirme_Test_Durum_Dokumani.xlsx`,
      activeRun?.executions,
      activeRun?.name,
      generationConfig.language
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

    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              requirementText: '',
              requirements: [],
              testCases: [],
              testRuns: defaultRuns,
              generationStats: null,
              recommendations: [],
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
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
        onOpenSettingsModal={() => handleOpenSettings('memory')}
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
        activeRulesCount={corporateRules.filter((r) => r.isDefaultActive).length}
      />

      {/* Multi-Project Switcher & Manager Bar */}
      <ProjectBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        language={generationConfig.language}
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
          onOpenTemplateModal={() => handleOpenSettings('template')}
          onOpenCorporateMemoryModal={() => handleOpenSettings('memory')}
          activeCorporateRulesCount={corporateRules.filter((r) => r.isDefaultActive).length}
        />

        {/* Results Navigation Tabs & Views */}
        {testCases.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* View Switching Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1117] border border-white/10 p-1.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveTab('matrix')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'matrix'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{generationConfig.language === 'en' ? 'Test Cases' : 'Test Case Matrisi'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'matrix' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {testCases.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('execution')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'execution'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{generationConfig.language === 'en' ? 'Execution' : 'Test Koşumu'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('coverage')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'coverage'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5 text-blue-400" />
                  <span>{generationConfig.language === 'en' ? 'Coverage' : 'Kapsam Analizi'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('rtm')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'rtm'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{generationConfig.language === 'en' ? 'RTM' : 'İzlenebilirlik (RTM)'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('stats')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'stats'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{generationConfig.language === 'en' ? 'QA Metrics' : 'QA Metrikleri'}</span>
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
                onOpenJiraModal={() => handleOpenSettings('jira')}
                testRuns={testRuns}
                setTestRuns={setTestRuns}
                activeRunId={activeRunId}
                setActiveRunId={setActiveRunId}
                onExportExcel={handleExportExcel}
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

      {/* Unified Configuration & Settings Hub Modal */}
      <ConfigurationHubModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        initialTab={settingsTab}
        language={generationConfig.language}
        corporateRules={corporateRules}
        onAddCorporateRule={handleAddCorporateRule}
        onDeleteCorporateRule={handleDeleteCorporateRule}
        onToggleCorporateRule={handleToggleCorporateRule}
        onResetCorporateRules={handleResetCorporateRules}
        activeTemplate={activeTemplate}
        onSaveTemplate={(updated) => setActiveTemplate(updated)}
        jiraConfig={jiraConfig}
        onSaveJiraConfig={handleSaveJiraConfig}
        currentUser={currentUser}
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

      {/* Multi-User Collaborative Share Project Modal */}
      {(() => {
        const activeProj = projects.find((p) => p.id === activeProjectId) || projects[0];
        return activeProj ? (
          <ShareProjectModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            project={activeProj}
            currentUser={currentUser}
            onUpdateProjectSharing={handleUpdateProjectSharing}
            language={generationConfig.language}
          />
        ) : null;
      })()}

    </div>
  );
}

