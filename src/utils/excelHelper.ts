import * as XLSX from 'xlsx';
import { ExcelTemplateConfig, MappedFieldType, RequirementItem, TemplateColumn, TestCase } from '../types';

/**
 * Auto-detect mapped field type based on column header text
 */
export function autoDetectFieldMapping(headerName: string): MappedFieldType {
  const lower = headerName.toLowerCase().trim();

  if (lower.includes('test adım no') || lower.includes('tc id') || lower.includes('test case id') || lower.includes('test_id')) {
    return 'testCaseId';
  }
  if (lower.includes('test durum no') || lower.includes('req') || lower.includes('gereksinim') || lower.includes('requirement') || lower.includes('us id') || lower.includes('jira key')) {
    return 'reqId';
  }
  if (lower === 'sistem' || lower.includes('modül') || lower.includes('module') || lower.includes('component') || lower.includes('özellik') || lower.includes('feature')) {
    return 'module';
  }
  if (lower.includes('başlık') || lower.includes('title') || lower.includes('summary') || lower.includes('senaryo adı') || lower.includes('test durum adı') || lower.includes('test adı')) {
    return 'title';
  }
  if (lower.includes('açıklama') || lower.includes('description') || lower.includes('tanım')) {
    return 'description';
  }
  if (lower.includes('sağlayacak')) {
    return 'custom';
  }
  if (lower.includes('ön koşul') || lower.includes('precondition') || lower.includes('pre-condition') || lower.includes('hazırlık')) {
    return 'preconditions';
  }
  if (lower.includes('aksiyon') || lower.includes('adım') || lower.includes('step') || lower.includes('action') || lower.includes('islem')) {
    return 'steps';
  }
  if (lower.includes('veri') || lower.includes('data') || lower.includes('input') || lower.includes('girdi')) {
    return 'testData';
  }
  if (lower.includes('beklenen') || lower.includes('expected') || lower.includes('sonuç') || lower.includes('result')) {
    return 'expectedResult';
  }
  if (lower.includes('öncelik') || lower.includes('priority')) {
    return 'priority';
  }
  if (lower.includes('tip') || lower.includes('type') || lower.includes('tür')) {
    return 'testType';
  }
  if (lower.includes('otomasyon') || lower.includes('execution') || lower.includes('çalıştırma') || lower.includes('manuel')) {
    return 'executionType';
  }
  if (lower.includes('severity') || lower.includes('önem') || lower.includes('etki')) {
    return 'severity';
  }

  return 'custom';
}

/**
 * Parses uploaded Excel file buffer/arrayBuffer and extracts template headers
 */
export async function parseUploadedExcelTemplate(file: File): Promise<ExcelTemplateConfig> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Yüklenen Excel dosyasında sayfa bulunamadı.');
  }

  // Find best target sheet (prefer "Test Durumları", "Test Scenarios", "Tests", or sheets with multiple columns)
  let selectedSheetName = workbook.SheetNames[0];
  const preferredSheet = workbook.SheetNames.find((name) => {
    const l = name.toLowerCase();
    return l.includes('test durum') || l.includes('scenario') || l.includes('senaryo') || l.includes('test');
  });

  if (preferredSheet) {
    selectedSheetName = preferredSheet;
  }

  const worksheet = workbook.Sheets[selectedSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
  
  if (!jsonRows || jsonRows.length === 0) {
    throw new Error('Yüklenen Excel sayfasında içerik bulunamadı.');
  }

  // Find header row (scan rows 0-15 for row with most non-empty text cells)
  let headerRowIndex = 0;
  let rawHeaders: string[] = [];
  let maxColsCount = 0;

  for (let i = 0; i < Math.min(15, jsonRows.length); i++) {
    const row = jsonRows[i] as unknown[];
    if (row && Array.isArray(row) && row.length > 0) {
      const stringCols = row.map((cell) => String(cell || '').trim()).filter((str) => str.length > 0);
      if (stringCols.length > maxColsCount) {
        maxColsCount = stringCols.length;
        headerRowIndex = i;
        rawHeaders = row.map((cell) => String(cell || '').trim());
      }
    }
  }

  if (rawHeaders.length === 0 || maxColsCount === 0) {
    throw new Error('Excel dosyasında geçerli sütun başlıkları saptanamadı.');
  }

  // Filter out trailing empty header names
  const validHeaders = rawHeaders.filter((h) => h.length > 0);

  const columns: TemplateColumn[] = validHeaders.map((headerText, index) => {
    const mappedField = autoDetectFieldMapping(headerText);
    return {
      id: `custom_col_${index}_${Date.now()}`,
      name: headerText,
      mappedField,
      width: Math.max(headerText.length + 8, 18),
    };
  });

  return {
    templateName: file.name.replace(/\.[^/.]+$/, '') + ' (Özel Şablon)',
    sheetName: selectedSheetName,
    columns,
    headerRowIndex,
    isCustomUploaded: true,
  };
}

/**
 * Helper to parse any uploaded Excel file into clean requirement text
 */
export async function parseExcelToRequirementText(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  
  const textParts: string[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    
    if (rows && rows.length > 0) {
      textParts.push(`=== SAYFA: ${sheetName} ===`);
      rows.forEach((row, idx) => {
        const rowStr = Object.entries(row)
          .map(([key, val]) => {
            const cleanVal = String(val).trim();
            if (!cleanVal) return null;
            return `${key}: ${cleanVal}`;
          })
          .filter(Boolean)
          .join(' | ');

        if (rowStr) {
          textParts.push(`[Satır ${idx + 1}] ${rowStr}`);
        }
      });
      textParts.push('');
    }
  });

  return textParts.join('\n');
}

/**
 * Formats step list into clean numbered multiline text
 */
export function formatStepsText(steps: string[] | string): string {
  if (Array.isArray(steps)) {
    return steps
      .map((step, idx) => {
        const clean = step.trim();
        if (/^\d+[\.\)]/.test(clean)) return clean;
        return `${idx + 1}. ${clean}`;
      })
      .join('\n');
  }
  return String(steps || '');
}

/**
 * Gets the string value for a specific mapped field from a TestCase
 */
export function getValueForMappedField(
  tc: TestCase,
  column: TemplateColumn
): string {
  switch (column.mappedField) {
    case 'testCaseId':
      return tc.id || '';
    case 'reqId':
      return tc.reqId || '';
    case 'module':
      return tc.module || '';
    case 'title':
      return tc.title || '';
    case 'description':
      return tc.description || '';
    case 'preconditions':
      return tc.preconditions || '';
    case 'steps':
      return formatStepsText(tc.steps);
    case 'testData':
      return tc.testData || '';
    case 'expectedResult':
      return tc.expectedResult || '';
    case 'priority':
      return tc.priority || 'Orta';
    case 'testType':
      return tc.testType || 'Pozitif';
    case 'executionType':
      return tc.executionType || 'Manuel';
    case 'severity':
      return tc.severity || 'Normal';
    case 'custom':
      if (column.customKey && tc.customFields?.[column.customKey]) {
        return tc.customFields[column.customKey];
      }
      return column.defaultValue || '';
    default:
      return column.defaultValue || '';
  }
}

/**
 * Exports test cases and RTM to Excel (.xlsx) file matching exact template layout
 */
export function exportTestCasesToExcel(
  testCases: TestCase[],
  template: ExcelTemplateConfig,
  requirements: RequirementItem[],
  filename: string = 'Test_Senaryolari_Dokumani.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Build Test Cases Sheet Data
  const headers = template.columns.map((c) => c.name);
  const rowsData: string[][] = [headers];

  testCases.forEach((tc) => {
    const row = template.columns.map((col) => getValueForMappedField(tc, col));
    rowsData.push(row);
  });

  const tcSheet = XLSX.utils.aoa_to_sheet(rowsData);

  // Set column widths
  tcSheet['!cols'] = template.columns.map((col) => ({
    wch: col.width || Math.max(col.name.length + 5, 20),
  }));

  XLSX.utils.book_append_sheet(wb, tcSheet, template.sheetName || 'Test Scenarios');

  // 2. Build Requirements Traceability Matrix (RTM) Sheet
  const rtmHeaders = [
    'Gereksinim ID (Req ID)',
    'Gereksinim Başlığı',
    'Bağlı Test Case Sayısı',
    'Pozitif Senaryolar',
    'Negatif Senaryolar',
    'Sınır/Güvenlik/Diğer',
    'İzlenebilirlik / Kapsama Durumu',
    'Eşleşen Test Case ID\'leri',
  ];

  const rtmRows: string[][] = [rtmHeaders];

  requirements.forEach((req) => {
    const matchedTCs = testCases.filter(
      (tc) => tc.reqId.toLowerCase().trim() === req.id.toLowerCase().trim()
    );
    const positiveCount = matchedTCs.filter((tc) => tc.testType === 'Pozitif').length;
    const negativeCount = matchedTCs.filter((tc) => tc.testType === 'Negatif').length;
    const otherCount = matchedTCs.length - positiveCount - negativeCount;

    let status = 'Kapsanmadı';
    if (matchedTCs.length >= 3 && positiveCount >= 1 && negativeCount >= 1) {
      status = 'Tam Kapsandı (Tam Test)';
    } else if (matchedTCs.length > 0) {
      status = 'Kısmi Kapsandı';
    }

    const tcIdsList = matchedTCs.map((tc) => tc.id).join(', ');

    rtmRows.push([
      req.id,
      req.title,
      String(matchedTCs.length),
      String(positiveCount),
      String(negativeCount),
      String(otherCount),
      status,
      tcIdsList || 'Henüz test eklenmedi',
    ]);
  });

  const rtmSheet = XLSX.utils.aoa_to_sheet(rtmRows);
  rtmSheet['!cols'] = [
    { wch: 22 },
    { wch: 38 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 28 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(wb, rtmSheet, 'Traceability Matrix (RTM)');

  // 3. Build Executive Summary Sheet
  const summaryRows = [
    ['Test Projesi Yönetici Özeti', ''],
    ['Rapor Oluşturulma Tarihi', new Date().toLocaleString('tr-TR')],
    ['Kullanılan Şablon Yapısı', template.templateName],
    [''],
    ['Metrik', 'Değer'],
    ['Toplam Analiz Edilen Gereksinim', String(requirements.length)],
    ['Toplam Üretilen Test Senaryosu', String(testCases.length)],
    ['Pozitif (Happy Path) Senaryo Sayısı', String(testCases.filter((tc) => tc.testType === 'Pozitif').length)],
    ['Negatif / Hatalı Durum Senaryo Sayısı', String(testCases.filter((tc) => tc.testType === 'Negatif').length)],
    ['Sınır Değer (Boundary) Senaryoları', String(testCases.filter((tc) => tc.testType === 'Sınır Değer (Boundary)').length)],
    ['Güvenlik / Yetkilendirme Senaryoları', String(testCases.filter((tc) => tc.testType === 'Güvenlik').length)],
    ['Yüksek Öncelikli (High Priority) Testler', String(testCases.filter((tc) => tc.priority === 'Yüksek' || tc.priority === 'High').length)],
    ['Ortalama Gereksinim Başına Test Sayısı', requirements.length > 0 ? (testCases.length / requirements.length).toFixed(1) : '0'],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 38 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Test Metrikleri Özeti');

  // Trigger download
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
