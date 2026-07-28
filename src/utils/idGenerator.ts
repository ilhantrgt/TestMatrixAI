import { TestCase } from '../types';

/**
 * Generates the next sequential Test Case ID for a given requirement ID.
 * Looks at existing test cases for that requirement, finds the highest numeric suffix,
 * and increments it by 1 (formatted with leading zeros matching the pattern).
 */
export function generateNextTestCaseId(reqId: string, testCases: TestCase[]): string {
  const targetReqId = reqId || 'REQ-01';

  // 1. Filter existing test cases matching targetReqId
  const matchingCases = testCases.filter(
    (tc) => tc.reqId && tc.reqId.toLowerCase().trim() === targetReqId.toLowerCase().trim()
  );

  let prefix = '';
  let maxNum = 0;
  let padLen = 3;

  if (matchingCases.length > 0) {
    // Extract prefix and highest number from existing test cases for this requirement
    for (const tc of matchingCases) {
      if (!tc.id) continue;
      // Matches e.g. "TC-PAY01-001", "TC-PAY01-1", "TC-REQ-PAY-01-005"
      const match = tc.id.match(/^(.*?[-_])(\d+)$/);
      if (match) {
        const p = match[1];
        const numStr = match[2];
        const val = parseInt(numStr, 10);
        if (!prefix) prefix = p;
        if (numStr.length > padLen) padLen = numStr.length;
        if (val > maxNum) maxNum = val;
      }
    }
  }

  // If no existing test cases had a matching prefix for this requirement, derive default prefix
  if (!prefix) {
    // Clean reqId: e.g. "REQ-PAY-01" -> "PAY01", "REQ-TRF-02" -> "TRF02", "REQ-01" -> "01"
    let cleanCode = targetReqId.replace(/^REQ[-_]?/i, '').replace(/[^a-zA-Z0-9]/g, '');
    if (!cleanCode) {
      cleanCode = targetReqId.replace(/[^a-zA-Z0-9]/g, '') || '01';
    }
    prefix = `TC-${cleanCode}-`;
  }

  // Next sequential number
  let nextNum = maxNum + 1;
  let nextId = `${prefix}${String(nextNum).padStart(padLen, '0')}`;

  // Ensure absolute uniqueness across all test cases
  while (testCases.some((tc) => tc.id === nextId)) {
    nextNum++;
    nextId = `${prefix}${String(nextNum).padStart(padLen, '0')}`;
  }

  return nextId;
}
