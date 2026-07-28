import React, { useState } from 'react';
import { Header } from './components/Header';
import { RequirementInput } from './components/RequirementInput';
import { TemplateConfiguratorModal } from './components/TemplateConfiguratorModal';
import { TestCasesMatrix } from './components/TestCasesMatrix';
import { TraceabilityMatrixView } from './components/TraceabilityMatrixView';
import { StatsSummaryPanel } from './components/StatsSummaryPanel';
import { CoverageReportView } from './components/CoverageReportView';
import { TestExecutionView } from './components/TestExecutionView';
import { JiraModal } from './components/JiraModal';
import { PRESET_TEMPLATES } from './data/presetTemplates';
import { SAMPLE_REQUIREMENT_DOCS } from './data/sampleRequirements';
import {
  ExcelTemplateConfig,
  GenerationConfig,
  GenerationResult,
  RequirementItem,
  TestCase,
  JiraConfig,
} from './types';
import { exportTestCasesToExcel } from './utils/excelHelper';
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
} from 'lucide-react';

export default function App() {
  // State
  const [requirementText, setRequirementText] = useState<string>(
    SAMPLE_REQUIREMENT_DOCS[0].content
  );
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>({
    positiveCountPerReq: 2,
    negativeCountPerReq: 2,
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

  // Jira Integration State
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig>(() => {
    const saved = localStorage.getItem('tm_jira_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      domain: '',
      userEmail: '',
      apiToken: '',
      projectKey: 'TEST',
      issueType: 'Bug',
    };
  });

  const handleSaveJiraConfig = (newConfig: JiraConfig) => {
    setJiraConfig(newConfig);
    localStorage.setItem('tm_jira_config', JSON.stringify(newConfig));
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefiningReqId, setIsRefiningReqId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result States
  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [generationStats, setGenerationStats] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<'matrix' | 'execution' | 'coverage' | 'rtm' | 'stats'>('matrix');

  // Trigger AI Test Case Generation
  const handleGenerate = async () => {
    if (!requirementText.trim()) return;

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
      setTestCases(data.testCases || []);
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
  ) => {
    const reqObj = requirements.find((r) => r.id === reqId);
    if (!reqObj) return;

    setIsRefiningReqId(reqId);
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
          setTestCases((prev) => [...prev, ...resData.newTestCases]);
        }
      }
    } catch (err) {
      console.error('Refine Error:', err);
    } finally {
      setIsRefiningReqId(null);
    }
  };

  // Auto generate missing test cases for a specific requirement
  const handleAutoGenerateMissingForReq = (req: RequirementItem) => {
    const prompt = `Generate missing test scenarios for requirement ${req.id} (${req.title}). Focus on missing edge cases, negative flows, boundary values, and security checks.`;
    handleRefineRequirement(req.id, prompt);
  };

  // CRUD Operations on Test Cases
  const handleUpdateTestCase = (updatedTc: TestCase) => {
    setTestCases((prev) => prev.map((tc) => (tc.id === updatedTc.id ? updatedTc : tc)));
  };

  const handleDeleteTestCase = (tcId: string) => {
    setTestCases((prev) => prev.filter((tc) => tc.id !== tcId));
  };

  const handleAddTestCase = (newTc: TestCase) => {
    setTestCases((prev) => [newTc, ...prev]);
  };

  // Direct Excel Export
  const handleExportExcel = () => {
    if (testCases.length === 0) return;
    exportTestCasesToExcel(
      testCases,
      activeTemplate,
      requirements,
      `Test_Cases_${activeTemplate.templateName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
    );
  };

  const handleReset = () => {
    if (confirm('Tüm üretilmiş test case verilerini temizlemek istediğinize emin misiniz?')) {
      setTestCases([]);
      setRequirements([]);
      setGenerationStats(null);
      setRecommendations([]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Application Header */}
      <Header
        templateName={activeTemplate.templateName}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        onOpenJiraModal={() => setIsJiraModalOpen(true)}
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

              {/* Excel Direct Download CTA */}
              <button
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-950 flex items-center gap-2 transition-all transform active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Excel Olarak Dışa Aktar (.xlsx)</span>
              </button>
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
              />
            )}

            {activeTab === 'execution' && (
              <TestExecutionView
                testCases={testCases}
                requirements={requirements}
                jiraConfig={jiraConfig}
                onOpenJiraModal={() => setIsJiraModalOpen(true)}
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
                isRefining={Boolean(isRefiningReqId)}
              />
            )}

            {activeTab === 'rtm' && (
              <TraceabilityMatrixView requirements={requirements} testCases={testCases} />
            )}

            {activeTab === 'stats' && generationStats && (
              <StatsSummaryPanel stats={generationStats} recommendations={recommendations} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0A0C10] py-6 text-center text-xs text-slate-500">
        <p>TestMatrix AI — Software Test Engineering & Requirement Specification Suite</p>
      </footer>

      {/* Template Customizer Modal */}
      <TemplateConfiguratorModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        activeTemplate={activeTemplate}
        onSaveTemplate={(updated) => setActiveTemplate(updated)}
      />

      {/* Jira Integration Config Modal */}
      <JiraModal
        isOpen={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        jiraConfig={jiraConfig}
        onSaveConfig={handleSaveJiraConfig}
      />
    </div>
  );
}

