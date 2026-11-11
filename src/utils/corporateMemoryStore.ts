import { CorporateMemoryRule } from '../types';
import { DEFAULT_CORPORATE_RULES } from '../data/defaultCorporateRules';

const STORAGE_KEY = 'testmatrix_corporate_memory_rules_v1';

export function getSavedCorporateRules(): CorporateMemoryRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed with default corporate rules
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CORPORATE_RULES));
      return DEFAULT_CORPORATE_RULES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CORPORATE_RULES;
  } catch (err) {
    console.warn('Error reading corporate rules from localStorage:', err);
    return DEFAULT_CORPORATE_RULES;
  }
}

export function saveCorporateRules(rules: CorporateMemoryRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error('Error saving corporate rules:', err);
  }
}

export function addCorporateRule(rule: Omit<CorporateMemoryRule, 'id' | 'createdAt'>): CorporateMemoryRule {
  const current = getSavedCorporateRules();
  const newRule: CorporateMemoryRule = {
    ...rule,
    id: `RULE-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newRule, ...current];
  saveCorporateRules(updated);
  return newRule;
}

export function deleteCorporateRule(id: string): CorporateMemoryRule[] {
  const current = getSavedCorporateRules();
  const updated = current.filter((r) => r.id !== id);
  saveCorporateRules(updated);
  return updated;
}

export function toggleCorporateRuleActive(id: string): CorporateMemoryRule[] {
  const current = getSavedCorporateRules();
  const updated = current.map((r) => (r.id === id ? { ...r, isDefaultActive: !r.isDefaultActive } : r));
  saveCorporateRules(updated);
  return updated;
}

export function resetCorporateRulesToDefault(): CorporateMemoryRule[] {
  saveCorporateRules(DEFAULT_CORPORATE_RULES);
  return DEFAULT_CORPORATE_RULES;
}
