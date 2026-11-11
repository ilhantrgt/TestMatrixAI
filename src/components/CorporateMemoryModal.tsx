import React, { useState } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Layers,
  BookOpen,
  Info,
  Save,
  Tag,
  Shield,
} from 'lucide-react';
import { CorporateMemoryRule } from '../types';

interface CorporateMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: CorporateMemoryRule[];
  onAddRule: (rule: Omit<CorporateMemoryRule, 'id' | 'createdAt'>) => void;
  onDeleteRule: (id: string) => void;
  onToggleRule: (id: string) => void;
  onResetDefaults: () => void;
}

export const CorporateMemoryModal: React.FC<CorporateMemoryModalProps> = ({
  isOpen,
  onClose,
  rules,
  onAddRule,
  onDeleteRule,
  onToggleRule,
  onResetDefaults,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Telekomünikasyon');
  const [newPromptRule, setNewPromptRule] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newExampleContext, setNewExampleContext] = useState('');

  if (!isOpen) return null;

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPromptRule.trim()) return;

    onAddRule({
      title: newTitle.trim(),
      category: newCategory.trim() || 'Genel',
      promptRule: newPromptRule.trim(),
      isDefaultActive: true,
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      exampleContext: newExampleContext.trim(),
    });

    setNewTitle('');
    setNewPromptRule('');
    setNewTags('');
    setNewExampleContext('');
    setShowAddForm(false);
  };

  const activeCount = rules.filter((r) => r.isDefaultActive).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Kalıcı Sistem Öğrenmesi & Kurumsal Hafıza
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] rounded-full font-semibold">
                  {activeCount} Aktif Kural
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Her test üretiminde yapay zekaya otomatik aktarılan kalıcı şirket ve modül test kuralları.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Info Banner */}
          <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">
                Nasıl Çalışır?
              </p>
              <p className="text-slate-300 leading-relaxed">
                Burada tanımladığınız kurallar, siz her defasında tekrar prompt girmek zorunda kalmayın diye tüm test üretim ve iyileştirme pipeline'larına <strong>otomatik ve kalıcı olarak enjekte edilir</strong>.
              </p>
            </div>
          </div>

          {/* Add Rule Button or Form */}
          {!showAddForm ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Kurumsal Kural / Öğrenim Ekle</span>
              </button>

              <button
                onClick={onResetDefaults}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Varsayılan Kurallara Sıfırla</span>
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleCreateRule}
              className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-4 space-y-3 shadow-inner animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Yeni Kalıcı Kural Tanımla
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Vazgeç
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Kural Başlığı *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Örn: MAE Askı Kodları & Durum Geçişleri"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Kategori / Modül
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Örn: Telekomünikasyon, XML, Güvenlik"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Yapay Zeka Test Üretim Kuralı (Prompt) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newPromptRule}
                  onChange={(e) => setNewPromptRule(e.target.value)}
                  placeholder="Yapay zekanın bu tür gereksinimleri gördüğünde uyması gereken zorunlu test kurallarını yazın... (Örn: 'Dökümanda CIHAZ_TOPLAMA alanı geçtiğinde 1 (Evet) ve 0 (Hayır) için sınır değer ve negatif doğrulama senaryosu üret')"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Etiketler (Virgülle ayırın)
                  </label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="MAE, TTVPN, XML, BVA"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Örnek Bağlam / Not (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={newExampleContext}
                    onChange={(e) => setNewExampleContext(e.target.value)}
                    placeholder="Örn: 5. ve 6. iş emri maddeleri için"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow"
                >
                  Kuralı Kaydet & Aktifleştir
                </button>
              </div>
            </form>
          )}

          {/* Rule Cards List */}
          <div className="space-y-3 pt-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-xl border transition-all ${
                  rule.isDefaultActive
                    ? 'bg-slate-850/80 border-slate-700 hover:border-indigo-500/60'
                    : 'bg-slate-950/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        {rule.title}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded text-[10px] font-mono">
                        {rule.category}
                      </span>
                      {rule.tags?.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-300 rounded text-[10px]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    {rule.exampleContext && (
                      <p className="text-[11px] text-slate-400 italic">
                        Bağlam: {rule.exampleContext}
                      </p>
                    )}
                  </div>

                  {/* Toggle and Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onToggleRule(rule.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                        rule.isDefaultActive
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{rule.isDefaultActive ? 'Aktif' : 'Devre Dışı'}</span>
                    </button>

                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Kuralı Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prompt Instruction Body */}
                <div className="mt-3 p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {rule.promptRule}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 text-xs text-slate-400">
          <span>
            {activeCount} / {rules.length} kural yeni test üretimlerinde otomatik devreye girecek.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
