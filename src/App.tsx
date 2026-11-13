import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RequirementInput } from './components/RequirementInput';
import { TestCasesMatrix } from './components/TestCasesMatrix';
import { TraceabilityMatrixView } from './components/TraceabilityMatrixView';
import { StatsSummaryPanel } from './components/StatsSummaryPanel';
import { CoverageReportView } from './components/CoverageReportView';
import { TestExecutionView } from './components/TestExecutionView';
import { StaticTestView } from './components/StaticTestView';
import { AddTestCaseModal } from './components/AddTestCaseModal';
import { UserGuideModal } from './components/UserGuideModal';
import { ConfigurationHubModal, ConfigTab } from './components/ConfigurationHubModal';
import { ProjectBar } from './components/ProjectBar';
import { ShareProjectModal } from './components/ShareProjectModal';
import { DiagramImagePayload } from './components/ActivityDiagramPanel';
import { PRESET_TEMPLATES } from './data/presetTemplates';
import { SAMPLE_REQUIREMENT_DOCS } from './data/sampleRequirements';
import { SAMPLE_ACTIVITY_DIAGRAMS } from './data/sampleDiagrams';
import { AuthScreen } from './components/AuthScreen';
import {
  loadUserDataFromCloud,
  saveUserDataToCloud,
  subscribeToUserData,
  saveSharedProjectToCloud,
  deleteSharedProjectFromCloud,
  loadSharedProjectsForUser,
  subscribeToSharedProjectsForUser,
  subscribeToSharedProject,
  getSharedProjectById,
  getWorkspaceContentSignature,
  getProjectContentSignature,
  subscribeToQuotaStatus,
  getFirestoreUpgradeUrl,
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
  RequirementStaticTestReport,
  OverallStaticTestSummary,
  DiagramCoverageStrategy,
  DiagramAnalysisSummary,
} from './types';
import { exportTestCasesToExcel } from './utils/excelHelper';
import { generateNextTestCaseId, sortTestCasesById, resequenceTestCaseIds, ensureUniqueRequirementIds } from './utils/idGenerator';
import {
  getSavedCorporateRules,
  addCorporateRule,
  deleteCorporateRule,
  toggleCorporateRuleActive,
  resetCorporateRulesToDefault,
} from './utils/corporateMemoryStore';
import { safeFetchJson } from './utils/apiClient';
import {
  generateEngineeringRecommendations,
  calculateGenerationStats,
} from './utils/engineeringEvaluation';
import {
  FileSpreadsheet,
  Layers,
  FileCheck,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  X,
  CheckCircle2,
  Download,
  Sparkles,
  PieChart,
  Play,
  Trash2,
  GitBranch,
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
    setStaticTestReports({});
    setStaticTestSummary(null);
    setDiagramAnalysis(null);
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
  const createDefaultProject = (id?: string, name = 'Ana Proje'): Project => {
    const projId = id || ('proj_' + (currentUser?.id ? currentUser.id.slice(-6) : 'init') + '_' + Date.now());
    return {
      id: projId,
      name,
      description: 'Varsayılan Test Matrix Projesi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: currentUser?.id,
      ownerEmail: currentUser?.email,
      ownerName: currentUser?.name || 'Proje Yöneticisi',
      requirementText: SAMPLE_REQUIREMENT_DOCS[0].content,
      requirements: [],
      testCases: [],
      testRuns: DEFAULT_TEST_RUNS,
      generationStats: null,
      recommendations: [],
    };
  };

  const [projects, setProjects] = useState<Project[]>([createDefaultProject('proj_default_1')]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj_default_1');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);

  const handleOpenShareModal = (projectId?: string) => {
    setSharingProjectId(projectId || activeProjectId);
    setIsShareModalOpen(true);
  };

  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [generationStats, setGenerationStats] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>(DEFAULT_TEST_RUNS);
  const [activeRunId, setActiveRunId] = useState<string>('RUN-1');
  const [staticTestReports, setStaticTestReports] = useState<Record<string, RequirementStaticTestReport>>({});
  const [staticTestSummary, setStaticTestSummary] = useState<OverallStaticTestSummary | null>(null);
  const [isAnalyzingStaticTest, setIsAnalyzingStaticTest] = useState(false);
  const [diagramText, setDiagramText] = useState<string>(SAMPLE_ACTIVITY_DIAGRAMS[0].content);
  const [diagramImage, setDiagramImage] = useState<DiagramImagePayload | null>(null);
  const [diagramStrategy, setDiagramStrategy] = useState<DiagramCoverageStrategy>('branch');
  const [diagramAnalysis, setDiagramAnalysis] = useState<DiagramAnalysisSummary | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isQuotaBannerVisible, setIsQuotaBannerVisible] = useState(true);

  useEffect(() => {
    const unsub = subscribeToQuotaStatus((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });
    return () => unsub();
  }, []);

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
        setProjects((prev) => {
          const map = new Map<string, Project>();
          data.projects.forEach((p: Project) => map.set(p.id, p));
          // Preserve any shared projects from other owners already loaded
          prev.forEach((p) => {
            if (p.isShared && !map.has(p.id)) {
              map.set(p.id, p);
            }
          });
          return Array.from(map.values());
        });

        const validActiveId =
          data.activeProjectId && data.projects.some((p: Project) => p.id === data.activeProjectId)
            ? data.activeProjectId
            : data.projects[0].id;
        setActiveProjectId(validActiveId);

        const activeProj = data.projects.find((p: Project) => p.id === validActiveId) || data.projects[0];
        setRequirements(ensureUniqueRequirementIds(activeProj.requirements || []));
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
          requirements: ensureUniqueRequirementIds(data.requirements || []),
          testCases: data.testCases || [],
          testRuns: data.testRuns || DEFAULT_TEST_RUNS,
          generationStats: data.generationStats || null,
          recommendations: data.recommendations || [],
        };
        setProjects([migratedProj]);
        setActiveProjectId(migratedProj.id);
        setRequirements(ensureUniqueRequirementIds(migratedProj.requirements || []));
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
              if (!isMounted) return;
              if (sharedProjects && sharedProjects.length > 0) {
                setProjects((prev) => {
                  const map = new Map<string, Project>();
                  prev.forEach((p) => map.set(p.id, p));
                  sharedProjects.forEach((sp) => {
                    // If conflict on proj_default_1 with a remote project from someone else
                    const existing = map.get(sp.id);
                    if (existing && existing.id === 'proj_default_1' && sp.ownerEmail && sp.ownerEmail.toLowerCase().trim() !== (currentUser.email || '').toLowerCase().trim()) {
                      const newOwnId = `proj_${(currentUser.id || 'usr').slice(-6)}_default`;
                      map.delete('proj_default_1');
                      map.set(newOwnId, { ...existing, id: newOwnId, isShared: false });
                    }
                    map.set(sp.id, { ...(map.get(sp.id) || {}), ...sp, isShared: true });
                  });
                  return Array.from(map.values());
                });
              }

              // Check URL parameter for project invite link
              const urlParams = new URLSearchParams(window.location.search);
              const queryProjId = urlParams.get('projectId');
              if (queryProjId) {
                getSharedProjectById(queryProjId).then((target) => {
                  if (target && isMounted) {
                    setProjects((prev) => {
                      const exists = prev.some((p) => p.id === queryProjId);
                      if (exists) return prev.map((p) => (p.id === queryProjId ? { ...target, isShared: true } : p));
                      return [...prev, { ...target, isShared: true }];
                    });
                    setActiveProjectId(queryProjId);
                    setRequirements(ensureUniqueRequirementIds(target.requirements || []));
                    setTestCases(target.testCases || []);
                    setTestRuns(target.testRuns || DEFAULT_TEST_RUNS);
                    setGenerationStats(target.generationStats || null);
                    setRecommendations(target.recommendations || []);
                    setRequirementText(target.requirementText || '');
                  }
                }).catch(() => {});
              }
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

  // Realtime subscription to ALL shared projects accessible by this user
  useEffect(() => {
    if (!currentUser?.email) return;

    const unsubSharedList = subscribeToSharedProjectsForUser(
      currentUser.email,
      currentUser.id,
      (remoteSharedProjects) => {
        isRemoteUpdateRef.current = true;
        setProjects((prevProjects) => {
          const map = new Map<string, Project>();
          prevProjects.forEach((p) => map.set(p.id, p));

          (remoteSharedProjects || []).forEach((sp) => {
            const existing = map.get(sp.id);
            // If conflict on proj_default_1 with a remote project from another user
            if (existing && existing.id === 'proj_default_1' && sp.ownerEmail && sp.ownerEmail.toLowerCase().trim() !== (currentUser.email || '').toLowerCase().trim()) {
              const newOwnId = `proj_${(currentUser.id || 'usr').slice(-6)}_default`;
              map.delete('proj_default_1');
              map.set(newOwnId, { ...existing, id: newOwnId, isShared: false });
              setActiveProjectId((curr) => curr === 'proj_default_1' ? newOwnId : curr);
            }
            map.set(sp.id, {
              ...(map.get(sp.id) || {}),
              ...sp,
              isShared: true,
            });
          });

          return Array.from(map.values());
        });
      }
    );

    return () => {
      unsubSharedList();
    };
  }, [currentUser?.email, currentUser?.id]);

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
      setRequirements(ensureUniqueRequirementIds(remoteProj.requirements || []));
      setTestCases(remoteProj.testCases || []);
      setTestRuns(
        remoteProj.testRuns && remoteProj.testRuns.length > 0
          ? remoteProj.testRuns
          : DEFAULT_TEST_RUNS
      );
      setGenerationStats(remoteProj.generationStats || null);
      setRecommendations(remoteProj.recommendations || []);
      setRequirementText(remoteProj.requirementText || '');
      setStaticTestReports(remoteProj.staticTestReports || {});
      setStaticTestSummary(remoteProj.staticTestSummary || null);
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
          existing.recommendations === recommendations &&
          existing.staticTestReports === staticTestReports &&
          existing.staticTestSummary === staticTestSummary &&
          existing.diagramAnalysis === diagramAnalysis
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
            staticTestReports,
            staticTestSummary,
            diagramAnalysis,
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
    staticTestReports,
    staticTestSummary,
  ]);

  // Project Management Handlers
  const handleSelectProject = (projectId: string) => {
    if (projectId === activeProjectId) return;
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    setActiveProjectId(projectId);
    setRequirementText(targetProj.requirementText || '');
    setRequirements(ensureUniqueRequirementIds(targetProj.requirements || []));
    setTestCases(targetProj.testCases || []);
    setTestRuns(
      targetProj.testRuns && targetProj.testRuns.length > 0
        ? targetProj.testRuns
        : DEFAULT_TEST_RUNS
    );
    setGenerationStats(targetProj.generationStats || null);
    setRecommendations(targetProj.recommendations || []);
    setStaticTestReports(targetProj.staticTestReports || {});
    setStaticTestSummary(targetProj.staticTestSummary || null);
    setDiagramAnalysis(targetProj.diagramAnalysis || null);
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
      staticTestReports: {},
      staticTestSummary: null,
    };

    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProjId);
    setRequirementText(newProjText);
    setRequirements([]);
    setTestCases([]);
    setTestRuns(DEFAULT_TEST_RUNS);
    setGenerationStats(null);
    setRecommendations([]);
    setStaticTestReports({});
    setStaticTestSummary(null);
    setDiagramAnalysis(null);
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
      setRequirements(ensureUniqueRequirementIds(nextProject.requirements || []));
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
    const currentInState = projects.find((p) => p.id === updatedProject.id);
    const enrichedProject: Project = {
      ...(currentInState || {}),
      ...updatedProject,
      isShared: true,
      ...(updatedProject.id === activeProjectId
        ? {
            requirementText,
            requirements,
            testCases,
            testRuns,
            generationStats,
            recommendations,
          }
        : {}),
    };

    setProjects((prev) => {
      const exists = prev.some((p) => p.id === enrichedProject.id);
      if (exists) {
        return prev.map((p) => (p.id === enrichedProject.id ? enrichedProject : p));
      }
      return [...prev, enrichedProject];
    });

    await saveSharedProjectToCloud(enrichedProject, true);

    if (currentUser?.id) {
      const updatedProjectsList = projects.map((p) =>
        p.id === enrichedProject.id ? enrichedProject : p
      );
      if (!updatedProjectsList.some((p) => p.id === enrichedProject.id)) {
        updatedProjectsList.push(enrichedProject);
      }
      saveUserDataToCloud(currentUser.id, {
        projects: updatedProjectsList,
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
      staticTestReports,
      staticTestSummary,
      jiraConfig,
    };

    const signature = getWorkspaceContentSignature(payload);

    // Save to user-scoped localStorage immediately
    try {
      localStorage.setItem(`tm_workspace_${currentUser.id}`, JSON.stringify(payload));
    } catch {}

    // If update originated from cloud snapshot or cache, skip saving back to cloud
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      lastSavedPayloadStrRef.current = signature;
      return;
    }

    // Skip redundant network writes if payload content has not changed
    if (signature === lastSavedPayloadStrRef.current) {
      return;
    }

    // Debounced save to Firebase Firestore
    const timer = setTimeout(() => {
      lastSavedPayloadStrRef.current = signature;
      saveUserDataToCloud(currentUser.id, payload);

      // If active project is a shared project, also sync to sharedProjects
      const activeProj = projects.find((p) => p.id === activeProjectId);
      if (activeProj?.isShared) {
        saveSharedProjectToCloud({
          ...activeProj,
          requirementText,
          requirements,
          testCases,
          testRuns,
          generationStats,
          recommendations,
          staticTestReports,
          staticTestSummary,
        });
      }
    }, 2000);

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
    staticTestReports,
    staticTestSummary,
    jiraConfig,
  ]);

  const [activeTab, setActiveTab] = useState<'matrix' | 'execution' | 'coverage' | 'rtm' | 'stats' | 'static-test'>('matrix');

  // Trigger AI Test Case Generation
  const handleGenerate = async () => {
    const textToUse = requirementText.trim() || SAMPLE_REQUIREMENT_DOCS[0].content;
    if (!requirementText.trim()) {
      setRequirementText(textToUse);
    }

    const effectiveConfig: GenerationConfig = {
      ...generationConfig,
      selectedFunctionalTypes:
        Array.isArray(generationConfig.selectedFunctionalTypes) && generationConfig.selectedFunctionalTypes.length > 0
          ? generationConfig.selectedFunctionalTypes
          : [
              'Pozitif (Fonksiyonel Doğruluk)',
              'Negatif (Hata Yönetimi)',
              'Sınır Değer Analizi (BVA)',
            ],
      selectedNonFunctionalTypes:
        Array.isArray(generationConfig.selectedNonFunctionalTypes) && generationConfig.selectedNonFunctionalTypes.length > 0
          ? generationConfig.selectedNonFunctionalTypes
          : [
              'Güvenlik ve Yetki Testi (Security)',
            ],
    };

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const activeCorporateRules = corporateRules.filter((r) => r.isDefaultActive);
      const data = await safeFetchJson<GenerationResult>(
        '/api/generate-test-cases',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirementText: textToUse,
            templateColumns: activeTemplate.columns,
            corporateRules: activeCorporateRules,
            config: effectiveConfig,
          }),
        },
        'Test senaryoları üretilirken sunucu hatası oluştu.'
      );

      const finalReqs = ensureUniqueRequirementIds(data.requirements || []);
      const { resequencedTestCases } = resequenceTestCaseIds(data.testCases || []);
      const finalStats =
        data.stats || calculateGenerationStats(finalReqs, resequencedTestCases);
      const finalRecs =
        data.recommendations && data.recommendations.length > 0
          ? data.recommendations
          : generateEngineeringRecommendations(
              finalReqs,
              resequencedTestCases,
              generationConfig.language,
              { action: 'initial', customInstructions: effectiveConfig.customInstructions }
            );

      setRequirements(finalReqs);
      setTestCases(resequencedTestCases);
      setGenerationStats(finalStats);
      setRecommendations(finalRecs);
      setDiagramAnalysis(null);
      setActiveTab('matrix');
    } catch (err: any) {
      console.error('Generation Error:', err);
      setErrorMessage(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Trigger Test Case Generation from Activity Diagram / Process Flow
  const handleGenerateFromDiagram = async () => {
    const effectiveDiagramText = diagramText.trim() || (!diagramImage ? SAMPLE_ACTIVITY_DIAGRAMS[0].content : '');
    if (!diagramText.trim() && !diagramImage) {
      setDiagramText(effectiveDiagramText);
    }

    const effectiveConfig: GenerationConfig = {
      ...generationConfig,
      selectedFunctionalTypes:
        Array.isArray(generationConfig.selectedFunctionalTypes) && generationConfig.selectedFunctionalTypes.length > 0
          ? generationConfig.selectedFunctionalTypes
          : [
              'Pozitif (Fonksiyonel Doğruluk)',
              'Negatif (Hata Yönetimi)',
              'Sınır Değer Analizi (BVA)',
            ],
      selectedNonFunctionalTypes:
        Array.isArray(generationConfig.selectedNonFunctionalTypes) && generationConfig.selectedNonFunctionalTypes.length > 0
          ? generationConfig.selectedNonFunctionalTypes
          : ['Güvenlik ve Yetki Testi (Security)'],
    };

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const activeCorporateRules = corporateRules.filter((r) => r.isDefaultActive);
      const data = await safeFetchJson<GenerationResult>(
        '/api/generate-from-diagram',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diagramText: effectiveDiagramText,
            diagramImageBase64: diagramImage?.base64 || undefined,
            diagramImageMimeType: diagramImage?.mimeType || undefined,
            diagramFileName: diagramImage?.fileName || undefined,
            coverageStrategy: diagramStrategy,
            templateColumns: activeTemplate.columns,
            corporateRules: activeCorporateRules,
            config: effectiveConfig,
          }),
        },
        'Süreç diyagramı üzerinden test senaryoları üretilirken sunucu hatası oluştu.'
      );

      const finalReqs = ensureUniqueRequirementIds(data.requirements || []);
      const { resequencedTestCases } = resequenceTestCaseIds(data.testCases || []);
      const finalStats =
        data.stats || calculateGenerationStats(finalReqs, resequencedTestCases);
      const finalRecs =
        data.recommendations && data.recommendations.length > 0
          ? data.recommendations
          : generateEngineeringRecommendations(
              finalReqs,
              resequencedTestCases,
              generationConfig.language,
              { action: 'initial', customInstructions: effectiveConfig.customInstructions }
            );

      setRequirements(finalReqs);
      setTestCases(resequencedTestCases);
      setGenerationStats(finalStats);
      setRecommendations(finalRecs);
      setDiagramAnalysis(data.diagramAnalysis || null);
      setActiveTab('matrix');
    } catch (err: any) {
      console.error('Diagram Generation Error:', err);
      setErrorMessage(err.message || 'Diyagram analizi sırasında bir hata oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Static Testing of Requirements (Quality Gate before Test Design & Dev)
  const handleRunStaticTest = async () => {
    const textToUse = requirementText.trim() || SAMPLE_REQUIREMENT_DOCS[0].content;
    if (!requirementText.trim()) {
      setRequirementText(textToUse);
    }

    setIsAnalyzingStaticTest(true);
    setErrorMessage(null);

    try {
      const data = await safeFetchJson<any>(
        '/api/static-test-requirements',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirementText: textToUse,
            language: generationConfig.language,
          }),
        },
        'Gereksinim statik testi yapılırken sunucu hatası oluştu.'
      );

      if (data.requirements && data.requirements.length > 0) {
        setRequirements(ensureUniqueRequirementIds(data.requirements));
      }
      if (data.reports) {
        setStaticTestReports(data.reports);
      }
      if (data.summary) {
        setStaticTestSummary(data.summary);
      }
      setActiveTab('static-test');
    } catch (err: any) {
      console.error('Static Test Error:', err);
      setErrorMessage(err.message || 'Gereksinim statik testi yapılırken bir hata oluştu.');
    } finally {
      setIsAnalyzingStaticTest(false);
    }
  };

  const handleApplyImprovedRequirement = (reqId: string, improvedVersion: string) => {
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              description: improvedVersion,
              staticTestReport: r.staticTestReport
                ? {
                    ...r.staticTestReport,
                    qualityGateStatus: 'ready',
                    score: Math.max(90, r.staticTestReport.score),
                  }
                : undefined,
            }
          : r
      )
    );

    setStaticTestReports((prev) => {
      const current = prev[reqId];
      if (!current) return prev;
      return {
        ...prev,
        [reqId]: {
          ...current,
          qualityGateStatus: 'ready',
          score: Math.max(90, current.score),
        },
      };
    });

    setRequirementText((prev) => {
      if (prev.includes(reqId)) {
        return prev.replace(
          new RegExp(`(${reqId}[^\n]*\n)[\\s\\S]*?(?=\n(?:REQ-|TD-|#|$))`, 'i'),
          `$1${improvedVersion}\n`
        );
      }
      return `${prev}\n\n[${reqId} İYİLEŞTİRİLMİŞ SPEC]\n${improvedVersion}`;
    });
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
      const resData = await safeFetchJson<any>(
        '/api/refine-test-cases',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirementItem: reqObj,
            allRequirements: requirements,
            existingTestCases: existing,
            promptInstruction,
            language: generationConfig.language,
          }),
        },
        'Ek senaryolar üretilirken hata oluştu.'
      );

      if (resData.newTestCases && resData.newTestCases.length > 0) {
        addedCount = resData.newTestCases.length;
        let currentList = [...testCases];
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
        const updatedReqs = requirements.map((r) =>
          r.id === reqId
            ? {
                ...r,
                coverageStatus: 'Full' as const,
                gapDescription: undefined,
              }
            : r
        );

        setTestCases(resequencedTestCases);
        setRequirements(updatedReqs);

        const freshStats =
          resData.stats || calculateGenerationStats(updatedReqs, resequencedTestCases);
        const freshRecs =
          resData.recommendations && resData.recommendations.length > 0
            ? resData.recommendations
            : generateEngineeringRecommendations(
                updatedReqs,
                resequencedTestCases,
                generationConfig.language,
                {
                  action: 'refine',
                  reqId,
                  addedCount,
                  lastTestCaseTitle: resData.newTestCases[0]?.title,
                }
              );

        setGenerationStats(freshStats);
        setRecommendations(freshRecs);
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
      setGenerationStats(calculateGenerationStats(requirements, resequencedTestCases));
      setRecommendations(
        generateEngineeringRecommendations(
          requirements,
          resequencedTestCases,
          generationConfig.language,
          {
            action: 'update',
            reqId: updatedTc.reqId,
            lastTestCaseTitle: updatedTc.title,
          }
        )
      );
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

      setGenerationStats(calculateGenerationStats(requirements, resequencedTestCases));
      setRecommendations(
        generateEngineeringRecommendations(
          requirements,
          resequencedTestCases,
          generationConfig.language,
          { action: 'delete' }
        )
      );

      return resequencedTestCases;
    });
  };

  const handleAddTestCase = (newTc: TestCase) => {
    setTestCases((prev) => {
      const combined = [...prev, newTc];
      const { resequencedTestCases } = resequenceTestCaseIds(combined);
      setGenerationStats(calculateGenerationStats(requirements, resequencedTestCases));
      setRecommendations(
        generateEngineeringRecommendations(
          requirements,
          resequencedTestCases,
          generationConfig.language,
          {
            action: 'add',
            reqId: newTc.reqId,
            addedCount: 1,
            lastTestCaseTitle: newTc.title,
          }
        )
      );
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
    setStaticTestReports({});
    setStaticTestSummary(null);
    setDiagramAnalysis(null);
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
              staticTestReports: {},
              staticTestSummary: null,
              diagramAnalysis: null,
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

      {/* Cloud Quota Exceeded Notification Banner */}
      {isQuotaExceeded && isQuotaBannerVisible && (
        <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-2 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in shadow-inner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Bulut Veritabanı Günlük Yazma Kotası (Free Tier) Doldu:</strong> Tüm projeleriniz ve test senaryolarınız yerel tarayıcı hafızasında (Local Storage) güvenle korunmaktadır ve kesintisiz çalışmaya devam edebilirsiniz. Kotanız yarın sıfırlanacaktır.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={getFirestoreUpgradeUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] transition-colors flex items-center gap-1 shadow-sm"
            >
              <span>Firebase Konsolunda Yükselt</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => setIsQuotaBannerVisible(false)}
              className="p-1 hover:bg-white/10 rounded text-amber-300 transition-colors"
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Multi-Project Switcher & Manager Bar */}
      <ProjectBar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onOpenShareModal={handleOpenShareModal}
        language={generationConfig.language}
        currentUserEmail={currentUser?.email}
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
          onRunStaticTest={handleRunStaticTest}
          isAnalyzingStaticTest={isAnalyzingStaticTest}
          staticTestSummary={staticTestSummary}
          onOpenStaticTestTab={() => setActiveTab('static-test')}
          diagramText={diagramText}
          onChangeDiagramText={setDiagramText}
          diagramImage={diagramImage}
          onChangeDiagramImage={setDiagramImage}
          diagramStrategy={diagramStrategy}
          onChangeDiagramStrategy={setDiagramStrategy}
          onGenerateFromDiagram={handleGenerateFromDiagram}
        />

        {/* Extracted Activity Diagram Path Traceability Summary */}
        {diagramAnalysis && diagramAnalysis.paths && diagramAnalysis.paths.length > 0 && testCases.length > 0 && (
          <section className="bg-[#0D1117] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <GitBranch className="w-4 h-4 text-blue-400 shrink-0" />
                <h3 className="text-sm font-semibold text-white truncate">
                  {diagramAnalysis.processTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                <span>{diagramAnalysis.nodeCount} {generationConfig.language === 'en' ? 'nodes' : 'düğüm'}</span>
                <span aria-hidden="true">·</span>
                <span>{diagramAnalysis.decisionCount} {generationConfig.language === 'en' ? 'decisions' : 'karar noktası'}</span>
                <span aria-hidden="true">·</span>
                <span>{diagramAnalysis.paths.length} {generationConfig.language === 'en' ? 'process paths' : 'süreç yolu'}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2 pr-3 whitespace-nowrap">{generationConfig.language === 'en' ? 'Path' : 'Yol No'}</th>
                    <th className="py-2 pr-3 whitespace-nowrap">{generationConfig.language === 'en' ? 'Flow Ref' : 'Akış ID'}</th>
                    <th className="py-2 pr-3">{generationConfig.language === 'en' ? 'Branch & Decision Route' : 'Süreç Dalı & Karar Rotası'}</th>
                    <th className="py-2 whitespace-nowrap">{generationConfig.language === 'en' ? 'Type' : 'Tür'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {diagramAnalysis.paths.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 pr-3 font-mono text-slate-300 tabular-nums whitespace-nowrap">{p.id}</td>
                      <td className="py-2 pr-3 font-mono text-blue-400 tabular-nums whitespace-nowrap">{p.linkedReqId}</td>
                      <td className="py-2 pr-3 text-slate-200">
                        <div className="font-medium">{p.name}</div>
                        {p.nodes && p.nodes.length > 0 && (
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-2xl">
                            {p.nodes.join(' → ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap text-slate-300">
                        {p.pathType === 'happy'
                          ? generationConfig.language === 'en' ? 'Happy Path' : 'Ana Akış'
                          : p.pathType === 'negative'
                          ? generationConfig.language === 'en' ? 'Negative / Exception' : 'Hata / Red'
                          : p.pathType === 'loop'
                          ? generationConfig.language === 'en' ? 'Loop / Retry' : 'Döngü'
                          : p.pathType === 'parallel'
                          ? generationConfig.language === 'en' ? 'Parallel Fork' : 'Paralel Dal'
                          : generationConfig.language === 'en' ? 'Decision Branch' : 'Karar Dalı'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Results Navigation Tabs & Views */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* View Switching Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1117] border border-white/10 p-1.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Static Test & Quality Gate Tab */}
                <button
                  onClick={() => setActiveTab('static-test')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'static-test'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{generationConfig.language === 'en' ? 'Static Test & Quality Gate' : 'Statik Test & Kalite Kapısı'}</span>
                  {staticTestSummary && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        staticTestSummary.qualityGateResult === 'BLOCK'
                          ? 'bg-rose-500 text-white'
                          : staticTestSummary.qualityGateResult === 'CONDITIONAL'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {staticTestSummary.qualityGateResult === 'BLOCK'
                        ? `⛔ ${staticTestSummary.blockedCount}`
                        : `${staticTestSummary.overallScore}%`}
                    </span>
                  )}
                </button>

                {testCases.length > 0 && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Active View Content */}
            {activeTab === 'static-test' && (
              <StaticTestView
                requirements={requirements}
                requirementText={requirementText}
                staticTestReports={staticTestReports}
                staticTestSummary={staticTestSummary}
                isAnalyzing={isAnalyzingStaticTest}
                onRunStaticTest={handleRunStaticTest}
                onApplyImprovedRequirement={handleApplyImprovedRequirement}
                onProceedToTestGeneration={handleGenerate}
                language={generationConfig.language}
              />
            )}

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
                stats={generationStats || calculateGenerationStats(requirements, testCases)}
                recommendations={
                  recommendations && recommendations.length > 0
                    ? recommendations
                    : generateEngineeringRecommendations(
                        requirements,
                        testCases,
                        generationConfig.language
                      )
                }
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

            {activeTab === 'stats' && (
              <StatsSummaryPanel
                stats={generationStats || calculateGenerationStats(requirements, testCases)}
                recommendations={
                  recommendations && recommendations.length > 0
                    ? recommendations
                    : generateEngineeringRecommendations(
                        requirements,
                        testCases,
                        generationConfig.language
                      )
                }
                language={generationConfig.language}
              />
            )}
          </div>
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
        const targetProjId = sharingProjectId || activeProjectId;
        const projectToShare = projects.find((p) => p.id === targetProjId) || projects[0];
        return projectToShare ? (
          <ShareProjectModal
            isOpen={isShareModalOpen}
            onClose={() => {
              setIsShareModalOpen(false);
              setSharingProjectId(null);
            }}
            project={projectToShare}
            allProjects={projects}
            onSelectProjectToShare={(id) => setSharingProjectId(id)}
            currentUser={currentUser}
            onUpdateProjectSharing={handleUpdateProjectSharing}
            language={generationConfig.language}
          />
        ) : null;
      })()}

    </div>
  );
}

