import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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

// Styling helper for ExcelJS cells
function formatCell(
  cell: ExcelJS.Cell,
  opts: {
    fontBold?: boolean;
    fontColor?: string; // e.g. "000000" or "FFFFFF"
    fontSize?: number;
    bgColor?: string; // e.g. "FFC000", "D9D9D9", "385723"
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    wrapText?: boolean;
    border?: boolean;
  }
) {
  cell.font = {
    name: 'Calibri',
    size: opts.fontSize || 10,
    bold: !!opts.fontBold,
    color: opts.fontColor ? { argb: 'FF' + opts.fontColor.replace('#', '') } : { argb: 'FF000000' },
  };

  if (opts.bgColor) {
    const cleanHex = opts.bgColor.replace('#', '');
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + cleanHex },
    };
  }

  cell.alignment = {
    horizontal: opts.align || 'left',
    vertical: opts.valign || 'middle',
    wrapText: opts.wrapText !== false,
  };

  if (opts.border !== false) {
    const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FF808080' } };
    cell.border = {
      top: thinBorder,
      left: thinBorder,
      bottom: thinBorder,
      right: thinBorder,
    };
  }
}

/**
 * Exports test cases and RTM to Excel (.xlsx) file matching exact corporate template layout (3 Sheets: Kapak, Genel, Test Durumları)
 * Fully styled with colored bold headers, borders, custom column widths, and gridlines enabled.
 */
export async function exportTestCasesToExcel(
  testCases: TestCase[],
  _template: ExcelTemplateConfig,
  requirements: RequirementItem[],
  filename: string = 'Gelistirme_Test_Durum_Dokumani.xlsx'
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AI Test Studio';
  wb.created = new Date();

  const todayStr = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const mainModuleOrReq = requirements[0]?.title || testCases[0]?.module || 'Yazılım Geliştirme Test Senaryoları';
  const mainDemandNo = requirements[0]?.id || 'REQ-2026-01';

  // ==========================================
  // SHEET 1: Kapak
  // ==========================================
  const kapakSheet = wb.addWorksheet('Kapak', { views: [{ showGridLines: true }] });
  
  kapakSheet.columns = [
    { width: 18 }, // A
    { width: 28 }, // B
    { width: 16 }, // C
    { width: 22 }, // D
    { width: 20 }, // E
    { width: 18 }, // F
    { width: 18 }, // G
    { width: 18 }, // H
    { width: 14 }, // I
    { width: 14 }, // J
  ];

  // Row 1: Logo & Title
  kapakSheet.mergeCells('A1:C3');
  const a1 = kapakSheet.getCell('A1');
  a1.value = 'TURK TELEKOM';
  formatCell(a1, { fontBold: true, fontSize: 13, fontColor: '002060', bgColor: 'F2F2F2', align: 'center', valign: 'middle' });

  kapakSheet.mergeCells('D1:J1');
  const d1 = kapakSheet.getCell('D1');
  d1.value = 'TEKNOLOJİ BAŞKANLIĞI GELİŞTİRME TEST DURUM DÖKÜMANI';
  formatCell(d1, { fontBold: true, fontSize: 11, fontColor: '000000', bgColor: 'D9D9D9', align: 'center', valign: 'middle' });

  // Row 2: Doc Info Headers
  kapakSheet.mergeCells('D2:E2');
  kapakSheet.getCell('D2').value = 'Doküman No';
  formatCell(kapakSheet.getCell('D2'), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' });

  kapakSheet.mergeCells('F2:G2');
  kapakSheet.getCell('F2').value = 'Yürürlük Tarihi';
  formatCell(kapakSheet.getCell('F2'), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' });

  kapakSheet.getCell('H2').value = 'Sürüm Tarihi';
  formatCell(kapakSheet.getCell('H2'), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' });

  kapakSheet.getCell('I2').value = 'Sürüm No';
  formatCell(kapakSheet.getCell('I2'), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' });

  kapakSheet.getCell('J2').value = 'Sayfa No';
  formatCell(kapakSheet.getCell('J2'), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' });

  // Row 3: Doc Info Values
  kapakSheet.mergeCells('D3:E3');
  kapakSheet.getCell('D3').value = 'TT-TD-2026-001';
  formatCell(kapakSheet.getCell('D3'), { align: 'center' });

  kapakSheet.mergeCells('F3:G3');
  kapakSheet.getCell('F3').value = todayStr;
  formatCell(kapakSheet.getCell('F3'), { align: 'center' });

  kapakSheet.getCell('H3').value = todayStr;
  formatCell(kapakSheet.getCell('H3'), { align: 'center' });

  kapakSheet.getCell('I3').value = '1.0';
  formatCell(kapakSheet.getCell('I3'), { align: 'center' });

  kapakSheet.getCell('J3').value = '1 / 1';
  formatCell(kapakSheet.getCell('J3'), { align: 'center' });

  // Row 6: Demand Info
  kapakSheet.mergeCells('A6:C6');
  kapakSheet.getCell('A6').value = 'TALEP NO / TALEP ADI';
  formatCell(kapakSheet.getCell('A6'), { fontBold: true, fontSize: 10, bgColor: 'D9D9D9', align: 'center' });

  kapakSheet.mergeCells('D6:J6');
  kapakSheet.getCell('D6').value = `${mainDemandNo} / ${mainModuleOrReq}`;
  formatCell(kapakSheet.getCell('D6'), { fontBold: true, fontSize: 10, align: 'left' });

  // Row 10: Hazırlayan Table Header
  const h10 = ['Hazırlayan', 'Görevi', 'Tarih', 'İmza'];
  h10.forEach((text, i) => {
    const cell = kapakSheet.getCell(10, i + 1);
    cell.value = text;
    formatCell(cell, { fontBold: true, bgColor: 'D9D9D9', align: 'center' });
  });

  // Row 11: Hazırlayan Data
  const d11 = ['AI Test Generator', 'Senior Kıdemli Test Uzmanı', todayStr, 'Dijital İmzalı'];
  d11.forEach((text, i) => {
    const cell = kapakSheet.getCell(11, i + 1);
    cell.value = text;
    formatCell(cell, { align: i === 0 || i === 1 ? 'left' : 'center' });
  });

  // Row 15: Onaylayan Table Header
  const h15 = ['Onaylayan', 'Görevi', 'Tarih', 'İmza'];
  h15.forEach((text, i) => {
    const cell = kapakSheet.getCell(15, i + 1);
    cell.value = text;
    formatCell(cell, { fontBold: true, bgColor: 'D9D9D9', align: 'center' });
  });

  // Row 16: Onaylayan Data
  const d16 = ['Test Yönetim Müdürü', 'Test Yöneticisi Lead', todayStr, '-'];
  d16.forEach((text, i) => {
    const cell = kapakSheet.getCell(16, i + 1);
    cell.value = text;
    formatCell(cell, { align: i === 0 || i === 1 ? 'left' : 'center' });
  });

  // Row 21: Değişiklik Başlık
  kapakSheet.getCell('A21').value = 'DEĞİŞİKLİK KAYITLARI';
  formatCell(kapakSheet.getCell('A21'), { fontBold: true, fontSize: 10, border: false });

  // Row 22: Değişiklik Table Header
  const h22 = ['Tarih', 'Hazırlayan', 'Sürüm', 'Değişiklik Açıklaması'];
  h22.forEach((text, i) => {
    const cell = kapakSheet.getCell(22, i + 1);
    cell.value = text;
    formatCell(cell, { fontBold: true, bgColor: 'D9D9D9', align: 'center' });
  });

  // Row 23: Değişiklik Data
  const d23 = [todayStr, 'AI Test Engine', '1.0', 'İlk Test Durumu Dokümanı Oluşturuldu'];
  d23.forEach((text, i) => {
    const cell = kapakSheet.getCell(23, i + 1);
    cell.value = text;
    formatCell(cell, { align: i === 3 || i === 1 ? 'left' : 'center' });
  });

  // Apply borders to merged range cells on Kapak
  ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'].forEach((addr) => {
    formatCell(kapakSheet.getCell(addr), { fontBold: true, fontSize: 13, fontColor: '002060', bgColor: 'F2F2F2', align: 'center' });
  });
  ['D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1'].forEach((addr) => {
    formatCell(kapakSheet.getCell(addr), { fontBold: true, fontSize: 11, bgColor: 'D9D9D9', align: 'center' });
  });
  ['D2', 'E2'].forEach((addr) => formatCell(kapakSheet.getCell(addr), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' }));
  ['F2', 'G2'].forEach((addr) => formatCell(kapakSheet.getCell(addr), { fontBold: true, fontSize: 9, bgColor: 'D9D9D9', align: 'center' }));
  ['D3', 'E3'].forEach((addr) => formatCell(kapakSheet.getCell(addr), { align: 'center' }));
  ['F3', 'G3'].forEach((addr) => formatCell(kapakSheet.getCell(addr), { align: 'center' }));
  ['A6', 'B6', 'C6'].forEach((addr) => formatCell(kapakSheet.getCell(addr), { fontBold: true, bgColor: 'D9D9D9', align: 'center' }));
  ['D6', 'E6', 'F6', 'G6', 'H6', 'I6', 'J6'].forEach((addr) => formatCell(kapakSheet.getCell(addr), { fontBold: true, align: 'left' }));

  // ==========================================
  // SHEET 2: Genel
  // ==========================================
  const genelSheet = wb.addWorksheet('Genel', { views: [{ showGridLines: true }] });

  genelSheet.columns = [
    { width: 20 }, // FR/NFR ID
    { width: 24 }, // Kullanım Durumu ID
    { width: 38 }, // Kullanım Durumu Adı
    { width: 20 }, // Test Durumu ID
    { width: 48 }, // Test Durumu Adı
    { width: 38 }, // Ön Koşul
    { width: 28 }, // Test Durum Bağımlılığı
  ];

  // Header Row 1: Matching image 2 colors exactly
  const genelHeaders = [
    { text: 'FR/NFR ID', bgColor: 'FFE699' },            // Gold/Orange
    { text: 'Kullanım Durumu ID', bgColor: 'FFF2CC' },    // Light Yellow
    { text: 'Kullanım Durumu Adı', bgColor: 'FFF2CC' },   // Light Yellow
    { text: 'Test Durumu ID', bgColor: 'D9E1F2' },        // Light Blue/Lavender
    { text: 'Test Durumu Adı', bgColor: 'D9E1F2' },       // Light Blue/Lavender
    { text: 'Ön Koşul', bgColor: 'D9E1F2' },              // Light Blue/Lavender
    { text: 'Test Durum Bağımlılığı', bgColor: 'D9E1F2' },// Light Blue/Lavender
  ];

  const gHeaderRow = genelSheet.getRow(1);
  gHeaderRow.height = 26;

  genelHeaders.forEach((col, idx) => {
    const cell = gHeaderRow.getCell(idx + 1);
    cell.value = col.text;
    formatCell(cell, {
      fontBold: true,
      fontColor: '000000',
      bgColor: col.bgColor,
      align: 'center',
      valign: 'middle',
    });
  });

  // Map to store Test Case IDs formatted as TD.01, TD.02
  const tcIdToTdNoMap: Record<string, string> = {};

  testCases.forEach((tc, idx) => {
    let tdNo = tc.id;
    if (!tdNo || !/^TD\.\d+/i.test(tdNo)) {
      tdNo = `TD.${String(idx + 1).padStart(2, '0')}`;
    }
    tcIdToTdNoMap[tc.id] = tdNo;

    const matchedReq = requirements.find(
      (r) => r.id.toLowerCase().trim() === tc.reqId.toLowerCase().trim()
    );
    const reqIndex = requirements.findIndex(
      (r) => r.id.toLowerCase().trim() === tc.reqId.toLowerCase().trim()
    );

    const frId = tc.reqId || (matchedReq ? matchedReq.id : 'FR-01');
    const ucId = matchedReq ? `UC.${String(Math.max(reqIndex, 0) + 1).padStart(2, '0')}` : 'UC.01';
    const ucName = matchedReq ? matchedReq.title : (tc.module || 'Genel Senaryo');
    const onKosul = tc.preconditions || 'OK';
    const bagimlilik = tc.customFields?.dependency || '-';

    const row = genelSheet.addRow([
      frId,
      ucId,
      ucName,
      tdNo,
      tc.title,
      onKosul,
      bagimlilik,
    ]);

    row.height = 22;

    formatCell(row.getCell(1), { align: 'center' });
    formatCell(row.getCell(2), { align: 'center' });
    formatCell(row.getCell(3), { align: 'left' });
    formatCell(row.getCell(4), { align: 'center', fontBold: true });
    formatCell(row.getCell(5), { align: 'left' });
    formatCell(row.getCell(6), { align: 'left' });
    formatCell(row.getCell(7), { align: 'center' });
  });

  // ==========================================
  // SHEET 3: Test Durumları
  // ==========================================
  const testDurumlariSheet = wb.addWorksheet('Test Durumları', { views: [{ showGridLines: true }] });

  testDurumlariSheet.columns = [
    { width: 18 }, // Test Durum No
    { width: 20 }, // Test Adım No
    { width: 22 }, // Sistem
    { width: 30 }, // Test Adım Ön Koşulu (Varsa)
    { width: 30 }, // Ön Koşulu Sağlayacak Sistem (Varsa)
    { width: 28 }, // Test Adım Verisi (Varsa)
    { width: 48 }, // Aksiyon
    { width: 45 }, // Beklenen Sonuç
    { width: 32 }, // Gerçekleşen Sonuç
    { width: 28 }, // Açıklama
  ];

  // Header Row 1: Matching image 3 colors exactly
  // Yellow (#FFC000) for A-F & J, Dark Green (#385723) with white text for G-I
  const testDurumlariHeaders = [
    { text: 'Test Durum No', bgColor: 'FFC000', fontColor: '000000' },
    { text: 'Test Adım No', bgColor: 'FFC000', fontColor: '000000' },
    { text: 'Sistem', bgColor: 'FFC000', fontColor: '000000' },
    { text: 'Test Adım Ön Koşulu (Varsa)', bgColor: 'FFC000', fontColor: '000000' },
    { text: 'Ön Koşulu Sağlayacak Sistem (Varsa)', bgColor: 'FFC000', fontColor: '000000' },
    { text: 'Test Adım Verisi (Varsa)', bgColor: 'FFC000', fontColor: '000000' },
    { text: 'Aksiyon', bgColor: '385723', fontColor: 'FFFFFF' },
    { text: 'Beklenen Sonuç', bgColor: '385723', fontColor: 'FFFFFF' },
    { text: 'Gerçekleşen Sonuç\n(Geçti/Kaldı/Koşturulmadı)', bgColor: '385723', fontColor: 'FFFFFF' },
    { text: 'Açıklama', bgColor: 'FFC000', fontColor: '000000' },
  ];

  const tdHeaderRow = testDurumlariSheet.getRow(1);
  tdHeaderRow.height = 32;

  testDurumlariHeaders.forEach((col, idx) => {
    const cell = tdHeaderRow.getCell(idx + 1);
    cell.value = col.text;
    formatCell(cell, {
      fontBold: true,
      fontColor: col.fontColor,
      bgColor: col.bgColor,
      align: 'center',
      valign: 'middle',
    });
  });

  testCases.forEach((tc, idx) => {
    const tdNo = tcIdToTdNoMap[tc.id] || `TD.${String(idx + 1).padStart(2, '0')}`;
    const sistem = tc.module || mainModuleOrReq || 'Sistem';
    const prereqSystem = tc.customFields?.prereqSystem || 'İlgili Sistem';

    let stepsArr: string[] = [];
    if (Array.isArray(tc.steps) && tc.steps.length > 0) {
      stepsArr = tc.steps;
    } else if (typeof tc.steps === 'string' && (tc.steps as string).trim()) {
      stepsArr = (tc.steps as string).split('\n').filter((s) => s.trim());
    }

    if (stepsArr.length === 0) {
      stepsArr = [tc.title];
    }

    stepsArr.forEach((stepTextRaw, stepIdx) => {
      const cleanAction = stepTextRaw.replace(/^\d+[\.\)]\s*/, '').trim();
      const stepNo = `${tdNo}.${String(stepIdx + 1).padStart(2, '0')}`;

      const stepPrecondition = stepIdx === 0 ? (tc.preconditions || '') : '';
      const stepPrereqSystem = stepIdx === 0 && tc.preconditions ? prereqSystem : '';
      const stepTestData = stepIdx === 0 ? (tc.testData || '') : '';
      const stepDescription = stepIdx === 0 ? (tc.description || tc.testType || '') : '';

      const row = testDurumlariSheet.addRow([
        tdNo,
        stepNo,
        sistem,
        stepPrecondition,
        stepPrereqSystem,
        stepTestData,
        cleanAction,
        tc.expectedResult || '',
        'Koşturulmadı',
        stepDescription,
      ]);

      row.height = 24;

      formatCell(row.getCell(1), { align: 'center', fontBold: true });
      formatCell(row.getCell(2), { align: 'center' });
      formatCell(row.getCell(3), { align: 'left' });
      formatCell(row.getCell(4), { align: 'left' });
      formatCell(row.getCell(5), { align: 'left' });
      formatCell(row.getCell(6), { align: 'left' });
      formatCell(row.getCell(7), { align: 'left' });
      formatCell(row.getCell(8), { align: 'left' });
      formatCell(row.getCell(9), { align: 'center' });
      formatCell(row.getCell(10), { align: 'left' });
    });
  });

  // Write and trigger download in browser
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

