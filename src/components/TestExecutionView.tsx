import React, { useState } from 'react';
import {
  TestCase,
  TestRun,
  TestCaseExecution,
  TestExecutionStatus,
  RequirementItem,
  JiraConfig,
  JiraIssueResponse,
} from '../types';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  Bug,
  Sparkles,
  Search,
  Filter,
  Download,
  CheckSquare,
  Square,
  ChevronRight,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  RotateCcw,
  Zap,
  User,
  Calendar,
  Activity,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

interface TestExecutionViewProps {
  testCases: TestCase[];
  requirements: RequirementItem[];
  jiraConfig?: JiraConfig;
  onOpenJiraModal?: () => void;
}

export const TestExecutionView: React.FC<TestExecutionViewProps> = ({
  testCases,
  requirements,
  jiraConfig,
  onOpenJiraModal,
}) => {
  // Mock initial test run
  const [testRuns, setTestRuns] = useState<TestRun[]>([
    {
      id: 'RUN-1',
      name: 'Sprint 24 Regresyon Test Koşumu',
      environment: 'Staging Env-1',
      createdAt: new Date().toISOString().slice(0, 10),
      executions: {},
    },
  ]);

  const [activeRunId, setActiveRunId] = useState<string>('RUN-1');
  const [isCreatingRun, setIsCreatingRun] = useState<boolean>(false);
  const [newRunName, setNewRunName] = useState<string>('');
  const [newRunEnv, setNewRunEnv] = useState<string>('Staging');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Interactive Execution Modal
  const [activeModalTc, setActiveModalTc] = useState<TestCase | null>(null);
  const [actualResultInput, setActualResultInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [bugIdInput, setBugIdInput] = useState<string>('');
  const [stepResults, setStepResults] = useState<Record<number, 'Passed' | 'Failed' | 'Untested'>>({});

  // AI Bug Generator state
  const [aiBugReport, setAiBugReport] = useState<string | null>(null);
  const [isGeneratingBug, setIsGeneratingBug] = useState<boolean>(false);
  const [copiedBug, setCopiedBug] = useState<boolean>(false);

  // Jira Integration State
  const [isCreatingJira, setIsCreatingJira] = useState<boolean>(false);
  const [jiraNotice, setJiraNotice] = useState<{ message: string; url?: string; key?: string } | null>(null);

  const handleSendToJira = async () => {
    if (!activeModalTc) return;

    setIsCreatingJira(true);
    setJiraNotice(null);

    try {
      const bugSummary = `[BUG] ${activeModalTc.id}: ${activeModalTc.title}`;
      const bugDescription = `h3. Test Case Bilgileri
* *ID:* ${activeModalTc.id}
* *Gereksinim:* ${activeModalTc.reqId}
* *Modül:* ${activeModalTc.module}
* *Öncelik:* ${activeModalTc.priority}
* *Ciddiyet:* ${activeModalTc.severity}

h3. Beklenen Sonuç
${activeModalTc.expectedResult}

h3. Gerçekleşen Sonuç / Hata Detayı
${actualResultInput || 'Test adımında uyumsuzluk tespit edildi.'}

h3. Test Adımları
${activeModalTc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${aiBugReport ? `\n\nh3. Yapay Zeka Tarafından Oluşturulan Detaylı Bug Raporu\n${aiBugReport}` : ''}`;

      const response = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: bugSummary,
          description: bugDescription,
          testCaseId: activeModalTc.id,
          reqId: activeModalTc.reqId,
          priority: activeModalTc.priority,
          jiraConfig,
        }),
      });

      const data: JiraIssueResponse = await response.json();

      if (data.success && data.issueKey) {
        setBugIdInput(data.issueKey);
        setJiraNotice({
          message: data.message || `${data.issueKey} Jira kaydı oluşturuldu.`,
          url: data.issueUrl,
          key: data.issueKey,
        });
      } else {
        setJiraNotice({
          message: 'Jira kaydı oluşturulamadı: ' + (data.message || 'Bilinmeyen hata'),
        });
      }
    } catch (error: any) {
      console.error('Jira Error:', error);
      setJiraNotice({ message: 'Jira sunucusuna bağlanırken hata oluştu.' });
    } finally {
      setIsCreatingJira(false);
    }
  };

  const activeRun = testRuns.find((r) => r.id === activeRunId) || testRuns[0];

  // Helper to get execution for a test case
  const getExecution = (tcId: string): TestCaseExecution => {
    return (
      activeRun.executions[tcId] || {
        testCaseId: tcId,
        status: 'Untested',
      }
    );
  };

  // Quick Status Updater
  const updateExecutionStatus = (
    tcId: string,
    status: TestExecutionStatus,
    actualRes?: string,
    notes?: string,
    bugId?: string,
    stepsRes?: Record<number, 'Passed' | 'Failed' | 'Untested'>
  ) => {
    setTestRuns((prev) =>
      prev.map((run) => {
        if (run.id !== activeRun.id) return run;

        const updatedExecutions = { ...run.executions };
        const existing = updatedExecutions[tcId] || { testCaseId: tcId, status: 'Untested' };

        updatedExecutions[tcId] = {
          ...existing,
          status,
          actualResult: actualRes !== undefined ? actualRes : existing.actualResult,
          notes: notes !== undefined ? notes : existing.notes,
          bugId: bugId !== undefined ? bugId : existing.bugId,
          stepResults: stepsRes !== undefined ? stepsRes : existing.stepResults,
          executedBy: 'QA Engineer',
          executedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        };

        return { ...run, executions: updatedExecutions };
      })
    );
  };

  // Create new Test Run Session
  const handleCreateTestRun = () => {
    if (!newRunName.trim()) return;
    const newRun: TestRun = {
      id: `RUN-${Date.now().toString().slice(-4)}`,
      name: newRunName,
      environment: newRunEnv,
      createdAt: new Date().toISOString().slice(0, 10),
      executions: {},
    };
    setTestRuns((prev) => [newRun, ...prev]);
    setActiveRunId(newRun.id);
    setNewRunName('');
    setIsCreatingRun(false);
  };

  // Execution Metrics
  const totalTCs = testCases.length;
  const executedTCs = testCases.filter(
    (tc) => getExecution(tc.id).status !== 'Untested'
  ).length;

  const passedCount = testCases.filter(
    (tc) => getExecution(tc.id).status === 'Passed'
  ).length;

  const failedCount = testCases.filter(
    (tc) => getExecution(tc.id).status === 'Failed'
  ).length;

  const blockedCount = testCases.filter(
    (tc) => getExecution(tc.id).status === 'Blocked'
  ).length;

  const untestedCount = totalTCs - (passedCount + failedCount + blockedCount);

  const passRate = totalTCs > 0 ? Math.round((passedCount / totalTCs) * 100) : 0;
  const progressPercent = totalTCs > 0 ? Math.round((executedTCs / totalTCs) * 100) : 0;

  // Filtered Test Cases
  const filteredTCs = testCases.filter((tc) => {
    const exec = getExecution(tc.id);
    const matchesSearch =
      tc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tc.reqId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || exec.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || tc.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Open Modal for detailed step execution
  const openExecutionModal = (tc: TestCase) => {
    const exec = getExecution(tc.id);
    setActiveModalTc(tc);
    setActualResultInput(exec.actualResult || '');
    setNotesInput(exec.notes || '');
    setBugIdInput(exec.bugId || '');
    setStepResults(exec.stepResults || {});
    setAiBugReport(null);
  };

  // Save Modal execution
  const saveModalExecution = (status: TestExecutionStatus) => {
    if (!activeModalTc) return;
    updateExecutionStatus(
      activeModalTc.id,
      status,
      actualResultInput,
      notesInput,
      bugIdInput,
      stepResults
    );
    setActiveModalTc(null);
  };

  // AI Automatic Bug Report Generator
  const generateAiBugReport = () => {
    if (!activeModalTc) return;
    setIsGeneratingBug(true);

    setTimeout(() => {
      const bugMarkdown = `### 🐛 Bug Raporu: ${activeModalTc.title}
**Test Senaryo ID:** ${activeModalTc.id} (${activeModalTc.reqId})
**Önem Derecesi (Severity):** ${activeModalTc.severity || 'Yüksek'}
**Ortam:** ${activeRun.environment}

#### 📋 Hata Adımları (Steps to Reproduce):
${activeModalTc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

#### 🎯 Beklenen Sonuç (Expected Result):
${activeModalTc.expectedResult}

#### ❌ Gerçekleşen Hatalı Sonuç (Actual Result):
${actualResultInput || 'Test adımları koşulurken beklenmeyen bir hata/istisna alındı.'}

#### 📝 QA Notları & Detaylar:
${notesInput || 'Arayüzde yanıt alınamadı veya doğrulama adımı başarısız oldu.'}
`;
      setAiBugReport(bugMarkdown);
      setIsGeneratingBug(false);
    }, 600);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBug(true);
    setTimeout(() => setCopiedBug(false), 2000);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Test Run Session Selector & Controls */}
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                Test Execution Suite
              </span>
              <span className="text-xs text-slate-400 font-medium">• Canlı Test Koşum & Hata Takip Modülü</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
              Test Koşum Oturumu: <span className="text-blue-400">{activeRun.name}</span>
            </h2>
          </div>

          {/* Active Run Switcher & New Session */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={activeRunId}
              onChange={(e) => setActiveRunId(e.target.value)}
              className="bg-[#0A0C10] border border-white/10 text-white text-xs rounded-xl px-3.5 py-2 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {testRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name} ({run.environment})
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsCreatingRun(!isCreatingRun)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Koşum Oturumu</span>
            </button>
          </div>
        </div>

        {/* Create Run Modal / Inline Form */}
        {isCreatingRun && (
          <div className="mt-4 p-4 bg-[#0A0C10] border border-blue-500/30 rounded-xl space-y-3 animate-in fade-in duration-200">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Yeni Test Koşum Oturumu Başlat
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Koşum Adı (Örn: Sprint 25 Regresyon)"
                value={newRunName}
                onChange={(e) => setNewRunName(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <select
                value={newRunEnv}
                onChange={(e) => setNewRunEnv(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-white text-xs p-2.5 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="Staging">Staging (Test Ortamı)</option>
                <option value="Pre-prod">Pre-prod (Ön Canlı)</option>
                <option value="Dev-Server">Dev Server</option>
                <option value="Production">Production (Canlı)</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCreateTestRun}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg w-full transition-colors"
                >
                  Oturumu Oluştur
                </button>
                <button
                  onClick={() => setIsCreatingRun(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2.5 rounded-lg transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Execution Metrics & Visual Progress Bar */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Koşum İlerlemesi: <strong>%{progressPercent}</strong> ({executedTCs} / {totalTCs} Koşuldu)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">Başarı Oranı (Pass Rate): <strong>%{passRate}</strong></span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Ortam: <strong className="text-white">{activeRun.environment}</strong></span>
            </div>
          </div>

          {/* Multi-segmented progress bar */}
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-white/10 p-0.5">
            <div
              style={{ width: `${(passedCount / totalTCs) * 100}%` }}
              className="bg-emerald-500 h-full transition-all duration-300 rounded-l"
              title={`Başarılı: ${passedCount}`}
            />
            <div
              style={{ width: `${(failedCount / totalTCs) * 100}%` }}
              className="bg-rose-500 h-full transition-all duration-300"
              title={`Başarısız: ${failedCount}`}
            />
            <div
              style={{ width: `${(blockedCount / totalTCs) * 100}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title={`Engellendi: ${blockedCount}`}
            />
          </div>

          {/* Counter Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div
              onClick={() => setStatusFilter(statusFilter === 'Passed' ? 'all' : 'Passed')}
              className={`cursor-pointer bg-[#0A0C10] p-3 rounded-xl border transition-all flex items-center justify-between ${
                statusFilter === 'Passed' ? 'border-emerald-500 bg-emerald-500/5' : 'border-emerald-500/20 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-300 font-medium">Başarılı (Pass)</span>
              </div>
              <span className="font-extrabold text-base text-emerald-400">{passedCount}</span>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'Failed' ? 'all' : 'Failed')}
              className={`cursor-pointer bg-[#0A0C10] p-3 rounded-xl border transition-all flex items-center justify-between ${
                statusFilter === 'Failed' ? 'border-rose-500 bg-rose-500/5' : 'border-rose-500/20 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span className="text-xs text-slate-300 font-medium">Başarısız (Fail)</span>
              </div>
              <span className="font-extrabold text-base text-rose-400">{failedCount}</span>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'Blocked' ? 'all' : 'Blocked')}
              className={`cursor-pointer bg-[#0A0C10] p-3 rounded-xl border transition-all flex items-center justify-between ${
                statusFilter === 'Blocked' ? 'border-amber-500 bg-amber-500/5' : 'border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300 font-medium">Engellendi (Blocked)</span>
              </div>
              <span className="font-extrabold text-base text-amber-400">{blockedCount}</span>
            </div>

            <div
              onClick={() => setStatusFilter(statusFilter === 'Untested' ? 'all' : 'Untested')}
              className={`cursor-pointer bg-[#0A0C10] p-3 rounded-xl border transition-all flex items-center justify-between ${
                statusFilter === 'Untested' ? 'border-slate-500 bg-slate-800/20' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300 font-medium">Koşulmadı (Untested)</span>
              </div>
              <span className="font-extrabold text-base text-slate-400">{untestedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Test Senaryosu / Req ID Ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0A0C10] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0C10] border border-white/10 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none"
          >
            <option value="all">Tüm Durumlar ({testCases.length})</option>
            <option value="Passed">Başarılı ({passedCount})</option>
            <option value="Failed">Başarısız ({failedCount})</option>
            <option value="Blocked">Engellendi ({blockedCount})</option>
            <option value="Untested">Koşulmadı ({untestedCount})</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#0A0C10] border border-white/10 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none"
          >
            <option value="all">Tüm Öncelikler</option>
            <option value="Yüksek">Yüksek Öncelikli</option>
            <option value="Orta">Orta Öncelikli</option>
            <option value="Düşük">Düşük Öncelikli</option>
          </select>
        </div>
      </div>

      {/* Test Cases Execution Table */}
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A0C10] border-b border-white/10 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5 pl-5">Test Case ID</th>
                <th className="p-3.5">Gereksinim</th>
                <th className="p-3.5">Başlık & Adımlar</th>
                <th className="p-3.5">Tür & Öncelik</th>
                <th className="p-3.5 text-center">Durum</th>
                <th className="p-3.5 text-center">Hızlı Koşum</th>
                <th className="p-3.5 text-right pr-5">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTCs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Arama/filtreye uygun test senaryosu bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredTCs.map((tc) => {
                  const exec = getExecution(tc.id);

                  return (
                    <tr
                      key={tc.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* ID */}
                      <td className="p-3.5 pl-5 font-mono font-bold text-blue-400 whitespace-nowrap">
                        {tc.id}
                      </td>

                      {/* Req ID */}
                      <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                        <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {tc.reqId}
                        </span>
                      </td>

                      {/* Title & Steps summary */}
                      <td className="p-3.5 max-w-xs">
                        <div className="font-bold text-slate-200 line-clamp-1">{tc.title}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {tc.steps.length} Adım • Beklenen: {tc.expectedResult}
                        </div>
                        {exec.bugId && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 rounded mt-1">
                            <Bug className="w-3 h-3" />
                            <span>{exec.bugId}</span>
                          </div>
                        )}
                      </td>

                      {/* Type & Priority */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            {tc.testType}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              tc.priority === 'Yüksek' || tc.priority === 'High'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {tc.priority}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {exec.status === 'Passed' && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Passed
                          </span>
                        )}
                        {exec.status === 'Failed' && (
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                        {exec.status === 'Blocked' && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Blocked
                          </span>
                        )}
                        {exec.status === 'Untested' && (
                          <span className="bg-slate-800 text-slate-400 border border-slate-700 font-medium px-2.5 py-1 rounded-full text-[11px] inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Untested
                          </span>
                        )}
                      </td>

                      {/* Quick Execution Buttons */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 bg-[#0A0C10] border border-white/10 p-1 rounded-xl">
                          <button
                            onClick={() => updateExecutionStatus(tc.id, 'Passed')}
                            className={`p-1.5 rounded-lg transition-all ${
                              exec.status === 'Passed'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                            }`}
                            title="Başarılı (Pass)"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateExecutionStatus(tc.id, 'Failed')}
                            className={`p-1.5 rounded-lg transition-all ${
                              exec.status === 'Failed'
                                ? 'bg-rose-600 text-white'
                                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                            }`}
                            title="Başarısız (Fail)"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateExecutionStatus(tc.id, 'Blocked')}
                            className={`p-1.5 rounded-lg transition-all ${
                              exec.status === 'Blocked'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                            }`}
                            title="Engellendi (Blocked)"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                          {exec.status !== 'Untested' && (
                            <button
                              onClick={() => updateExecutionStatus(tc.id, 'Untested')}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                              title="Sıfırla"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Action Detail Button */}
                      <td className="p-3.5 text-right pr-5 whitespace-nowrap">
                        <button
                          onClick={() => openExecutionModal(tc)}
                          className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ml-auto"
                        >
                          <span>Detaylı Koş</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step-by-Step Interactive Execution Modal */}
      {activeModalTc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D1117] border border-white/20 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20">
                    {activeModalTc.id}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    Bağlı Req: {activeModalTc.reqId}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                    {activeModalTc.testType}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{activeModalTc.title}</h3>
              </div>
              <button
                onClick={() => setActiveModalTc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Test Case Preconditions & Test Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#0A0C10] p-3.5 rounded-xl border border-white/5">
              <div>
                <strong className="text-slate-400 block mb-1">Ön Koşullar (Preconditions):</strong>
                <p className="text-slate-200">{activeModalTc.preconditions || 'Özel ön koşul yok.'}</p>
              </div>
              <div>
                <strong className="text-slate-400 block mb-1">Test Verisi (Test Data):</strong>
                <p className="text-slate-200 font-mono">{activeModalTc.testData || 'Varsayılan veriler.'}</p>
              </div>
            </div>

            {/* Step-by-Step Execution Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Adım Adım Koşum Kontrol Listesi ({activeModalTc.steps.length} Adım)</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Adımları tek tek doğrulayabilirsiniz
                </span>
              </h4>

              <div className="space-y-2">
                {activeModalTc.steps.map((stepStr, idx) => {
                  const stepStatus = stepResults[idx] || 'Untested';

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                        stepStatus === 'Passed'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : stepStatus === 'Failed'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                          : 'bg-[#0A0C10] border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-slate-500 font-bold shrink-0">{idx + 1}.</span>
                        <span>{stepStr}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            setStepResults((prev) => ({ ...prev, [idx]: 'Passed' }))
                          }
                          className={`p-1.5 rounded-lg text-xs font-semibold ${
                            stepStatus === 'Passed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-emerald-400'
                          }`}
                        >
                          Adım Tamam
                        </button>
                        <button
                          onClick={() =>
                            setStepResults((prev) => ({ ...prev, [idx]: 'Failed' }))
                          }
                          className={`p-1.5 rounded-lg text-xs font-semibold ${
                            stepStatus === 'Failed'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-rose-400'
                          }`}
                        >
                          Adım Hatalı
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expected Result & Actual Result Inputs */}
            <div className="space-y-3">
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-300">
                <strong>Beklenen Sonuç (Expected Result):</strong>
                <p className="mt-1 text-slate-200">{activeModalTc.expectedResult}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Gerçekleşen Sonuç (Actual Result):
                </label>
                <textarea
                  rows={2}
                  value={actualResultInput}
                  onChange={(e) => setActualResultInput(e.target.value)}
                  placeholder="Test koşulurken alınan gerçek ekran yanıtını veya hatayı yazın..."
                  className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    Hata / Bug Takip ID (Opsiyonel):
                  </label>
                  <input
                    type="text"
                    value={bugIdInput}
                    onChange={(e) => setBugIdInput(e.target.value)}
                    placeholder="Örn: JIRA-1044 veya GH-88"
                    className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    QA Notları:
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Ek test notları..."
                    className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* AI Bug Generator & Jira Integration Actions */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={generateAiBugReport}
                  disabled={isGeneratingBug}
                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{isGeneratingBug ? 'Bug Raporu Üretiliyor...' : '🤖 AI ile Otomatik Bug Raporu Üret'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendToJira}
                  disabled={isCreatingJira}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                >
                  <span className="font-bold font-mono bg-white text-blue-600 w-4 h-4 rounded flex items-center justify-center text-[10px]">
                    J
                  </span>
                  <span>{isCreatingJira ? 'Jira Kaydı Açılıyor...' : "Jira'da Hata Kaydı (Issue) Aç"}</span>
                </button>
              </div>

              {jiraNotice && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    jiraNotice.url
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>{jiraNotice.message}</span>
                  </div>
                  {jiraNotice.url && (
                    <a
                      href={jiraNotice.url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <span>{jiraNotice.key || 'Jira Gör'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {aiBugReport && (
                <div className="mt-3 p-3.5 bg-[#0A0C10] border border-amber-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-amber-400 font-bold">
                    <span>Oluşturulan Bug Raporu Taslağı (Markdown Format)</span>
                    <button
                      onClick={() => copyToClipboard(aiBugReport)}
                      className="text-slate-300 hover:text-white text-[11px] bg-slate-800 px-2 py-1 rounded flex items-center gap-1"
                    >
                      {copiedBug ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBug ? 'Kopyalandı!' : 'Jira için Kopyala'}</span>
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    {aiBugReport}
                  </pre>
                </div>
              )}
            </div>

            {/* Final Outcome Action Buttons */}
            <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveModalTc(null)}
                className="text-slate-400 hover:text-white text-xs px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                İptal
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveModalExecution('Passed')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PASSED Olarak Kaydet</span>
                </button>

                <button
                  type="button"
                  onClick={() => saveModalExecution('Failed')}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>FAILED Olarak Kaydet</span>
                </button>

                <button
                  type="button"
                  onClick={() => saveModalExecution('Blocked')}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-600/20 flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>BLOCKED Kaydet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
