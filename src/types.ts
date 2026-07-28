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
  testType: 'Pozitif' | 'Negatif' | 'Sınır Değer (Boundary)' | 'Güvenlik' | 'Performans' | 'Kullanılabilirlik';
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
  includeBoundary: boolean;
  includeSecurity: boolean;
  includePerformance: boolean;
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
