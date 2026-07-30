import React, { useState, useEffect } from 'react';
import { JiraConfig } from '../types';
import {
  ExternalLink,
  CheckCircle2,
  Lock,
  Key,
  Globe,
  User,
  Folder,
  Save,
  HelpCircle,
  X,
  Zap,
} from 'lucide-react';

interface JiraModalProps {
  isOpen: boolean;
  onClose: () => void;
  jiraConfig: JiraConfig;
  onSaveConfig: (config: JiraConfig) => void;
}

export const JiraModal: React.FC<JiraModalProps> = ({
  isOpen,
  onClose,
  jiraConfig,
  onSaveConfig,}) => {
  const [form, setForm] = useState<JiraConfig>(jiraConfig);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(jiraConfig || {
        domain: '',
        userEmail: '',
        apiToken: '',
        projectKey: 'TEST',
        issueType: 'Bug',
      });
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(form);
    setTestResult('Jira ayarları kaydedildi!');
    setTimeout(() => {
      setTestResult(null);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0D1117] border border-white/20 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200 text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              J
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Atlassian Jira Entegrasyon Ayarları</h3>
              <p className="text-xs text-slate-400">
                Hata kayıtlarını doğrudan Jira projenize aktarın.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-xl text-xs text-blue-300 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>Güvenli Atlassian REST API Bağlantısı</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Jira API Token'ınızı Atlassian profil ayarlarınızdan (Security &gt; API Tokens) ücretsiz oluşturabilirsiniz. Bilgiler yalnızca tarayıcınızda saklanır.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Jira Domain */}
          <div className="space-y-1">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Jira Domain URL:
            </label>
            <input
              type="text"
              placeholder="Örn: sirketiniz.atlassian.net"
              value={form.domain || ''}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* User Email */}
          <div className="space-y-1">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              Atlassian Kullanıcı E-postası:
            </label>
            <input
              type="email"
              placeholder="Örn: qa.engineer@company.com"
              value={form.userEmail || ''}
              onChange={(e) => setForm({ ...form, userEmail: e.target.value })}
              className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* API Token */}
          <div className="space-y-1">
            <label className="text-slate-300 font-bold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Jira API Token:
            </label>
            <input
              type="password"
              placeholder="ATATT3xFfGF0r..."
              value={form.apiToken || ''}
              onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
              className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Project Key & Issue Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                Proje Anahtarı (Project Key):
              </label>
              <input
                type="text"
                placeholder="Örn: PROJ veya QA"
                value={form.projectKey || ''}
                onChange={(e) => setForm({ ...form, projectKey: e.target.value.toUpperCase() })}
                className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-white font-mono font-bold uppercase placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                Hata Tipi (Issue Type):
              </label>
              <select
                value={form.issueType || 'Bug'}
                onChange={(e) => setForm({ ...form, issueType: e.target.value })}
                className="w-full bg-[#0A0C10] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-blue-500"
              >
                <option value="Bug">Bug (Hata)</option>
                <option value="Task">Task (Görev)</option>
                <option value="Improvement">Improvement (Geliştirme)</option>
              </select>
            </div>
          </div>

          {testResult && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{testResult}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-blue-400 flex items-center gap-1 text-[11px]"
            >
              <span>Token Oluştur</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors font-medium"
              >
                Kapat
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Ayarları Kaydet</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
