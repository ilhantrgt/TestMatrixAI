import React, { useState } from 'react';
import {
  TestCase,
  RequirementItem,
  ExcelTemplateConfig,
} from '../types';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowUpDown,
  Download,
  AlertCircle,
} from 'lucide-react';
import { formatStepsText, getValueForMappedField } from '../utils/excelHelper';
import { generateNextTestCaseId, sortTestCasesById } from '../utils/idGenerator';
import { EditTestCaseModal } from './EditTestCaseModal';

interface TestCasesMatrixProps {
  testCases: TestCase[];
  requirements: RequirementItem[];
  template: ExcelTemplateConfig;
  onUpdateTestCase: (updatedTc: TestCase) => void;
  onDeleteTestCase: (tcId: string) => void;
  onAddTestCase: (newTc: TestCase) => void;
  onRefineRequirement: (reqId: string, promptInstruction: string) => void;
  isRefiningReqId?: string | null;
  onExportExcel: () => void;
  onOpenAddModal?: (reqId?: string) => void;
  language?: 'tr' | 'en';
}

export const TestCasesMatrix: React.FC<TestCasesMatrixProps> = ({
  testCases,
  requirements,
  template,
  onUpdateTestCase,
  onDeleteTestCase,
  onAddTestCase,
  onRefineRequirement,
  isRefiningReqId,
  onExportExcel,
  onOpenAddModal,
  language = 'tr',
}) => {
  const isEn = language === 'en';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReqFilter, setSelectedReqFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'req' | 'module' | 'none'>('req');

  // Modal Editing State
  const [editingModalTc, setEditingModalTc] = useState<TestCase | null>(null);

  // Inline Editing State
  const [editingTcId, setEditingTcId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TestCase | null>(null);

  // AI Refine Prompt Drawer state per requirement
  const [activeRefineReqId, setActiveRefineReqId] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState('');

  const handleStartEdit = (tc: TestCase) => {
    setEditingModalTc(tc);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      onUpdateTestCase(editForm);
      setEditingTcId(null);
      setEditForm(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingTcId(null);
    setEditForm(null);
  };

  const handleAddNewRow = (reqIdToUse?: string) => {
    const targetReq = reqIdToUse || requirements[0]?.id || 'REQ-01';
    const reqObj = requirements.find((r) => r.id === targetReq);
    const newTc: TestCase = {
      id: generateNextTestCaseId(targetReq, testCases),
      reqId: targetReq,
      module: reqObj?.category || (isEn ? 'General Module' : 'Genel Modül'),
      title: isEn ? 'New Test Scenario' : 'Yeni Test Senaryosu',
      description: isEn ? 'Manually added test scenario' : 'Manuel eklenen test senaryosu',
      preconditions: isEn ? 'System is ready' : 'Sistem hazır durumda',
      steps: [isEn ? '1. Execute test step.' : '1. Test adımını gerçekleştir.'],
      testData: isEn ? 'Sample data' : 'Örnek veri',
      expectedResult: isEn ? 'System behaves as expected.' : 'Sistem beklenen davranışı sergiler.',
      priority: 'Orta',
      testType: 'Pozitif',
      executionType: 'Manuel',
      severity: 'Normal',
    };
    onAddTestCase(newTc);
    handleStartEdit(newTc);
  };

  // Filter Test Cases
  const filteredCases = testCases.filter((tc) => {
    if (selectedReqFilter !== 'all' && tc.reqId !== selectedReqFilter) return false;
    if (selectedTypeFilter !== 'all' && tc.testType !== selectedTypeFilter) return false;
    if (selectedPriorityFilter !== 'all' && tc.priority !== selectedPriorityFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = tc.id.toLowerCase().includes(q);
      const matchTitle = tc.title.toLowerCase().includes(q);
      const matchSteps = Array.isArray(tc.steps)
        ? tc.steps.some((s) => s.toLowerCase().includes(q))
        : String(tc.steps).toLowerCase().includes(q);
      const matchExpected = tc.expectedResult.toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchSteps && !matchExpected) return false;
    }
    return true;
  });

  // Grouping logic with deterministic sorting by Test Case ID
  const groupedData: { groupKey: string; items: TestCase[] }[] = [];
  if (groupBy === 'req') {
    const reqMap = new Map<string, TestCase[]>();
    filteredCases.forEach((tc) => {
      const key = tc.reqId || (isEn ? 'Other' : 'Diğer');
      if (!reqMap.has(key)) reqMap.set(key, []);
      reqMap.get(key)!.push(tc);
    });
    reqMap.forEach((items, groupKey) =>
      groupedData.push({ groupKey, items: sortTestCasesById(items) })
    );
  } else if (groupBy === 'module') {
    const modMap = new Map<string, TestCase[]>();
    filteredCases.forEach((tc) => {
      const key = tc.module || (isEn ? 'General Module' : 'Genel Modül');
      if (!modMap.has(key)) modMap.set(key, []);
      modMap.get(key)!.push(tc);
    });
    modMap.forEach((items, groupKey) =>
      groupedData.push({ groupKey, items: sortTestCasesById(items) })
    );
  } else {
    groupedData.push({
      groupKey: isEn ? 'All Test Scenarios' : 'Tüm Test Senaryoları',
      items: sortTestCasesById(filteredCases),
    });
  }

  const getPriorityBadgeClass = (p: string) => {
    if (p === 'Yüksek' || p === 'High') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (p === 'Orta' || p === 'Medium') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  };

  const getTypeBadgeClass = (t: string) => {
    if (!t) return 'bg-slate-700 text-slate-300 border-slate-600';
    if (t.includes('Pozitif') || t.includes('Positive')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (t.includes('Negatif') || t.includes('Negative')) return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (t.includes('Sınır') || t.includes('BVA') || t.includes('Boundary') || t.includes('Eşdeğer')) return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    if (t.includes('Güvenlik') || t.includes('Security')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (t.includes('Performans') || t.includes('Yük') || t.includes('Performance')) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    if (t.includes('Kullanılabilirlik') || t.includes('Erişilebilirlik') || t.includes('UX')) return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    if (t.includes('Regresyon') || t.includes('Yeniden')) return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    if (t.includes('Kabul') || t.includes('UAT') || t.includes('SIT')) return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-200">
      {/* Matrix Controls & Filter Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base text-white flex items-center gap-2">
              <span>{isEn ? 'Test Case Matrix' : 'Test Case Matrisi'}</span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono">
                {filteredCases.length} {isEn ? 'Scenarios' : 'Senaryo'}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Group By Selector */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg text-xs font-medium border border-slate-700">
              <span className="text-slate-400 px-1.5 text-[11px]">{isEn ? 'Group:' : 'Grupla:'}</span>
              <button
                onClick={() => setGroupBy('req')}
                className={`px-2 py-1 rounded ${
                  groupBy === 'req' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Req ID
              </button>
              <button
                onClick={() => setGroupBy('module')}
                className={`px-2 py-1 rounded ${
                  groupBy === 'module' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {isEn ? 'Module' : 'Modül'}
              </button>
              <button
                onClick={() => setGroupBy('none')}
                className={`px-2 py-1 rounded ${
                  groupBy === 'none' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {isEn ? 'Flat List' : 'Düz Liste'}
              </button>
            </div>

            <button
              onClick={() => (onOpenAddModal ? onOpenAddModal() : handleAddNewRow())}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? 'Add Manual Test Case' : 'Manuel Test Case Ekle'}</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isEn
                  ? 'Search test title, steps or results...'
                  : 'Test adı, adımları veya sonuçlarda ara...'
              }
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Requirement Filter */}
          <select
            value={selectedReqFilter}
            onChange={(e) => setSelectedReqFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">
              {isEn ? `All Requirements (${requirements.length})` : `Tüm Gereksinimler (${requirements.length})`}
            </option>
            {requirements.map((req) => (
              <option key={req.id} value={req.id}>
                {req.id} - {req.title.slice(0, 30)}...
              </option>
            ))}
          </select>

          {/* Test Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{isEn ? 'All Test Types (ISTQB)' : 'Tüm Test Tipleri (ISTQB)'}</option>
            <optgroup label={isEn ? 'Functional Tests' : 'Fonksiyonel Testler'}>
              <option value="Pozitif">{isEn ? 'Positive (Functional Accuracy)' : 'Pozitif (Fonksiyonel Doğruluk)'}</option>
              <option value="Negatif">{isEn ? 'Negative (Error Handling)' : 'Negatif (Hata Yönetimi)'}</option>
              <option value="Sınır">{isEn ? 'Boundary Value Analysis (BVA)' : 'Sınır Değer Analizi (BVA)'}</option>
              <option value="Eşdeğer">{isEn ? 'Equivalence Partitioning (EP)' : 'Eşdeğer Sınıflandırma (EP)'}</option>
            </optgroup>
            <optgroup label={isEn ? 'Non-Functional Tests' : 'Fonksiyonel Olmayan Testler'}>
              <option value="Performans">{isEn ? 'Performance Testing' : 'Performans Testi (Performance)'}</option>
              <option value="Güvenlik">{isEn ? 'Security & Permissions' : 'Güvenlik ve Yetki Testi (Security)'}</option>
              <option value="Kullanılabilirlik">{isEn ? 'Usability / UX' : 'Kullanılabilirlik Testi (Usability / UX)'}</option>
            </optgroup>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">{isEn ? 'All Priorities' : 'Tüm Öncelikler'}</option>
            <option value="Yüksek">{isEn ? 'High Priority' : 'Yüksek Öncelik'}</option>
            <option value="Orta">{isEn ? 'Medium Priority' : 'Orta Öncelik'}</option>
            <option value="Düşük">{isEn ? 'Low Priority' : 'Düşük Öncelik'}</option>
          </select>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
        {groupedData.length === 0 || filteredCases.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">
              {isEn ? 'No test cases match your filter criteria.' : 'Arama kriterlerinize uygun test senaryosu bulunamadı.'}
            </p>
            <p className="text-xs text-slate-600">
              {isEn ? 'Clear filters or add a new test case above.' : 'Filtreleri temizleyin veya yukarıdan yeni test case ekleyin.'}
            </p>
          </div>
        ) : (
          groupedData.map((group) => {
            const reqObj = requirements.find((r) => r.id === group.groupKey);

            return (
              <div key={group.groupKey} className="border-b border-slate-800 last:border-b-0">
                {/* Group Header Bar */}
                <div className="bg-slate-800/80 px-4 py-2.5 flex items-center justify-between border-y border-slate-700/60 sticky top-0 z-20 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-indigo-300 font-mono bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                      {group.groupKey}
                    </span>
                    {reqObj && <span className="text-xs font-semibold text-slate-200">{reqObj.title}</span>}
                    <span className="text-[11px] text-slate-400">
                      ({group.items.length} {isEn ? 'Tests' : 'Test'})
                    </span>
                  </div>

                  {/* Action buttons for this requirement group */}
                  <div className="flex items-center gap-2">
                    {reqObj && (
                      <button
                        onClick={() =>
                          setActiveRefineReqId(activeRefineReqId === reqObj.id ? null : reqObj.id)
                        }
                        className="text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isEn ? 'AI Refine Scenario' : 'Bu Gereksinime AI Test Ekle'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Refine Drawer if active */}
                {activeRefineReqId === reqObj?.id && (
                  <div className="bg-slate-950/90 p-4 border-b border-amber-500/30 space-y-2 text-xs">
                    <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {isEn
                          ? `Derive Extra Test Scenarios for [${reqObj.id}]:`
                          : `[${reqObj.id}] İçin Ekstra Test Senaryoları Türet:`}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder={
                          isEn
                            ? 'e.g. Add SQL injection checks or timeout handling...'
                            : "Örn: 'Güvenlik ve SQL injection senaryoları ekle' veya 'Zaman aşımı durumlarını detaylandır'..."
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => {
                          onRefineRequirement(reqObj.id, refinePrompt);
                          setActiveRefineReqId(null);
                          setRefinePrompt('');
                        }}
                        disabled={isRefiningReqId === reqObj.id}
                        className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        {isRefiningReqId === reqObj.id
                          ? isEn
                            ? 'Generating...'
                            : 'Üretiliyor...'
                          : isEn
                          ? 'Generate & Add'
                          : 'Üret ve Ekle'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Test Cases Table */}
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-28">{isEn ? 'TC ID' : 'Test ID'}</th>
                      <th className="py-2.5 px-3 w-48">{isEn ? 'Test Title' : 'Test Başlığı'}</th>
                      <th className="py-2.5 px-3 w-36">{isEn ? 'Pre-conditions' : 'Ön Koşul'}</th>
                      <th className="py-2.5 px-3">{isEn ? 'Test Steps' : 'Test Adımları'}</th>
                      <th className="py-2.5 px-3 w-40">{isEn ? 'Test Data' : 'Test Verisi'}</th>
                      <th className="py-2.5 px-3 w-52">{isEn ? 'Expected Result' : 'Beklenen Sonuç'}</th>
                      <th className="py-2.5 px-3 w-24 text-center">{isEn ? 'Priority' : 'Öncelik'}</th>
                      <th className="py-2.5 px-3 w-28 text-center">{isEn ? 'Test Type' : 'Test Tipi'}</th>
                      <th className="py-2.5 px-3 w-20 text-center">{isEn ? 'Actions' : 'İşlem'}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/60">
                    {group.items.map((tc) => {
                      return (
                        <tr
                          key={tc.id}
                          className="hover:bg-slate-800/40 transition-colors group align-top"
                        >
                          {/* Test ID */}
                          <td className="py-3 px-3 font-mono font-bold text-indigo-300">
                            {tc.id}
                          </td>

                          {/* Title */}
                          <td className="py-3 px-3 font-semibold text-slate-100">
                            {tc.title}
                          </td>

                          {/* Preconditions */}
                          <td className="py-3 px-3 text-slate-400 text-[11px] leading-relaxed">
                            {tc.preconditions || '-'}
                          </td>

                          {/* Test Steps */}
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {formatStepsText(tc.steps)}
                          </td>

                          {/* Test Data */}
                          <td className="py-3 px-3 text-slate-300 font-mono text-[11px] bg-slate-950/30 rounded p-1">
                            {tc.testData || '-'}
                          </td>

                          {/* Expected Result */}
                          <td className="py-3 px-3 text-emerald-300/90 text-[11px] leading-relaxed">
                            {tc.expectedResult}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadgeClass(
                                tc.priority
                              )}`}
                            >
                              {tc.priority}
                            </span>
                          </td>

                          {/* Test Type */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getTypeBadgeClass(
                                tc.testType
                              )}`}
                            >
                              {tc.testType}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center opacity-80 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartEdit(tc)}
                                className="text-slate-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 transition-colors"
                                title={isEn ? 'Edit' : 'Düzenle'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteTestCase(tc.id)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                                title={isEn ? 'Delete' : 'Sil'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>

      {/* Spacious Edit Test Case Modal */}
      <EditTestCaseModal
        isOpen={Boolean(editingModalTc)}
        onClose={() => setEditingModalTc(null)}
        testCase={editingModalTc}
        requirements={requirements}
        onSave={onUpdateTestCase}
        language={language}
      />
    </div>
  );
};

