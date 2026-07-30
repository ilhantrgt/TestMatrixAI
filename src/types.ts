export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: string;
  avatarUrl?: string;
  provider: 'email' | 'google';
  createdAt: string;
}

export type MappedFieldType =
  | 'testCaseId'
  | 'reqId'
  | 'module'
  | 'title'
  | 'description'
  | 'preconditions'
  | 'steps'
  | 'testData'
  | 'expectedResult'
  | 'priority'
  | 'testType'
  | 'executionType'
  | 'severity'
  | 'custom';

export const FUNCTIONAL_TEST_TYPES = [
  'Pozitif (Fonksiyonel Doğruluk)',
  'Negatif (Hata Yönetimi)',
  'Sınır Değer Analizi (BVA)',
  'Eşdeğer Sınıflandırma (EP)',
  'Durum Geçiş Testi (State Transition)',
  'Karar Tablosu Testi (Decision Table)',
  'Kullanım Senaryosu Testi (Use Case)',
] as const;

export const NON_FUNCTIONAL_TEST_TYPES = [
  'Performans Testi (Performance)',
  'Yük ve Stres Testi (Load & Stress)',
  'Güvenlik ve Yetki Testi (Security)',
  'Kullanılabilirlik Testi (Usability / UX)',
  'Uyumluluk ve Çapraz Platform (Compatibility)',
  'Erişilebilirlik Testi (Accessibility / WCAG)',
  'Güvenilirlik ve Kurtarılabilirlik (Reliability)',
  'Regresyon Testi (Regression)',
  'Kullanıcı Kabul Testi (UAT)',
] as const;

export const ISTQB_TEST_TYPES = [
  ...FUNCTIONAL_TEST_TYPES,
  ...NON_FUNCTIONAL_TEST_TYPES,
] as const;

export type ISTQBTestType = (typeof ISTQB_TEST_TYPES)[number] | string;

export interface TemplateColumn {
  id: string;
  name: string; // The exact column header text in the Excel sheet
  mappedField: MappedFieldType;
  defaultValue?: string; // Static fallback value if mappedField is custom or empty
  customKey?: string;
  width?: number;
}

export interface ExcelTemplateConfig {
  templateName: string;
  sheetName: string;
  columns: TemplateColumn[];
  headerRowIndex: number;
  isCustomUploaded?: boolean;
}

export interface TestCase {
  id: string; // e.g. TC-REQ01-01
  reqId: string; // e.g. REQ-01
  module: string; // e.g. Authentication
  title: string;
  description: string;
  preconditions: string;
  steps: string[]; // List of step strings e.g. ["1. Open login page", "2. Enter valid email"]
  testData: string;
  expectedResult: string;
  priority: 'Yüksek' | 'Orta' | 'Düşük' | 'High' | 'Medium' | 'Low';
  testType: ISTQBTestType;
  executionType: 'Manuel' | 'Otomasyon';
  severity: 'Kritik' | 'Yüksek' | 'Normal' | 'Düşük';
  customFields?: Record<string, string>;
}

export interface RequirementItem {
  id: string; // e.g. REQ-001
  title: string;
  description: string;
  category?: string;
  coverageStatus?: 'Full' | 'Partial' | 'Uncovered';
  missingTestTypes?: string[];
  gapDescription?: string;
}

export interface GenerationConfig {
  positiveCountPerReq: number;
  negativeCountPerReq: number;
  selectedFunctionalTypes?: string[];
  selectedNonFunctionalTypes?: string[];
  includeBoundary: boolean;
  includeSecurity: boolean;
  includePerformance: boolean;
  includeUsability?: boolean;
  includeCompatibility?: boolean;
  includeRegression?: boolean;
  includeUAT?: boolean;
  selectedIstqbTypes?: string[];
  language: 'tr' | 'en';
  customInstructions?: string;
}

export interface GenerationStats {
  totalRequirements: number;
  totalTestCases: number;
  fullyCoveredReqs?: number;
  partiallyCoveredReqs?: number;
  uncoveredReqs?: number;
  positiveCount: number;
  negativeCount: number;
  boundaryCount: number;
  securityCount: number;
  performanceCount: number;
  highPriorityCount: number;
  coverageScore: number;
}

export interface GenerationResult {
  requirements: RequirementItem[];
  testCases: TestCase[];
  stats: GenerationStats;
  recommendations?: string[];
}

export interface SampleRequirementDoc {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
}

export type TestExecutionStatus = 'Passed' | 'Failed' | 'Blocked' | 'Untested' | 'In Progress';

export interface TestCaseExecution {
  testCaseId: string;
  status: TestExecutionStatus;
  actualResult?: string;
  notes?: string;
  bugId?: string;
  bugTitle?: string;
  executedBy?: string;
  executedAt?: string;
  stepResults?: Record<number, 'Passed' | 'Failed' | 'Untested'>;
}

export interface TestRun {
  id: string;
  name: string;
  environment: string;
  createdAt: string;
  executions: Record<string, TestCaseExecution>;
}

export interface JiraConfig {
  domain: string; // e.g. company.atlassian.net
  userEmail: string; // e.g. dev@company.com
  apiToken: string; // Jira API token
  projectKey: string; // e.g. PROJ, QA, SCRUM
  issueType: string; // e.g. Bug, Hata, Task
}

export interface JiraIssuePayload {
  summary: string;
  description: string;
  projectKey?: string;
  issueType?: string;
  testCaseId?: string;
  reqId?: string;
  priority?: string;
  environment?: string;
  jiraConfig?: Partial<JiraConfig>;
}

export interface JiraIssueResponse {
  success: boolean;
  issueKey: string; // e.g. PROJ-1042
  issueUrl: string; // e.g. https://company.atlassian.net/browse/PROJ-1042
  message?: string;
  isSimulated?: boolean;
}
