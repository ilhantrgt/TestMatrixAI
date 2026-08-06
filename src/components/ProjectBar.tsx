import React, { useState } from 'react';
import { Project } from '../types';
import {
  FolderKanban,
  Plus,
  ChevronDown,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  FileText,
  AlertTriangle,
  FolderPlus,
  Layers,
  X,
} from 'lucide-react';

interface ProjectBarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, description: string, startWithSample: boolean) => void;
  onUpdateProject: (projectId: string, name: string, description: string) => void;
  onDeleteProject: (projectId: string) => void;
  language: 'tr' | 'en';
}

export const ProjectBar: React.FC<ProjectBarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  language,
}) => {
  const isEn = language === 'en';
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [startWithSample, setStartWithSample] = useState(true);

  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');

  const [deleteTargetProject, setDeleteTargetProject] = useState<Project | null>(null);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const handleOpenCreateModal = () => {
    setNewProjectName('');
    setNewProjectDesc('');
    setStartWithSample(true);
    setIsCreateModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), newProjectDesc.trim(), startWithSample);
    setIsCreateModalOpen(false);
  };

  const handleOpenEditModal = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProjectId(proj.id);
    setEditProjectName(proj.name);
    setEditProjectDesc(proj.description || '');
    setIsEditModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectId || !editProjectName.trim()) return;
    onUpdateProject(editProjectId, editProjectName.trim(), editProjectDesc.trim());
    setIsEditModalOpen(false);
    setEditProjectId(null);
  };

  const handleOpenDeleteModal = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetProject(proj);
    setIsDeleteModalOpen(true);
    setIsDropdownOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (deleteTargetProject) {
      onDeleteProject(deleteTargetProject.id);
      setIsDeleteModalOpen(false);
      setDeleteTargetProject(null);
    }
  };

  return (
    <div className="bg-[#0B0F17] border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Project Selector */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <FolderKanban className="w-3.5 h-3.5 text-blue-400" />
              {isEn ? 'Active Project:' : 'Aktif Proje:'}
            </span>

            {/* Selector Dropdown Toggle */}
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="group flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border border-white/15 hover:border-blue-500/50 shadow-sm transition-all text-left"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold text-sm text-slate-100 truncate block max-w-[200px] sm:max-w-[300px]">
                  {activeProject ? activeProject.name : isEn ? 'Select Project' : 'Proje Seçin'}
                </span>
              </div>
              <span className="bg-blue-500/10 text-blue-300 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border border-blue-500/20 shrink-0">
                {(activeProject?.testCases || []).length} TC
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Backdrop when dropdown is open */}
          {isDropdownOpen && (
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsDropdownOpen(false)}
            />
          )}

          {/* Project List Dropdown */}
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 z-40 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 space-y-1 animate-in fade-in duration-150">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  {isEn ? 'Your Projects' : 'Projeleriniz'} ({projects.length})
                </span>
                <button
                  onClick={handleOpenCreateModal}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isEn ? 'New Project' : 'Yeni Proje'}</span>
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 py-1 custom-scrollbar">
                {projects.map((proj) => {
                  const isActive = proj.id === activeProjectId;
                  const tcCount = (proj.testCases || []).length;
                  const reqCount = (proj.requirements || []).length;

                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`group cursor-pointer rounded-xl p-2.5 transition-all flex items-center justify-between border ${
                        isActive
                          ? 'bg-blue-600/15 border-blue-500/40 text-white'
                          : 'bg-slate-950/40 hover:bg-slate-800/80 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/30'
                              : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                          }`}
                        >
                          <FolderKanban className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-semibold text-xs text-slate-100 truncate flex items-center gap-1.5">
                            <span className="truncate">{proj.name}</span>
                            {isActive && (
                              <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tcCount} {isEn ? 'test cases' : 'test senaryosu'} · {reqCount}{' '}
                            {isEn ? 'reqs' : 'gereksinim'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons (Edit & Delete) */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleOpenEditModal(proj, e)}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md transition-colors"
                          title={isEn ? 'Edit Project' : 'Projeyi Düzenle'}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {projects.length > 1 && (
                          <button
                            onClick={(e) => handleOpenDeleteModal(proj, e)}
                            className="p-1 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
                            title={isEn ? 'Delete Project' : 'Projeyi Sil'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Quick Actions (+ New Project Button) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl font-semibold text-xs shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{isEn ? '+ Create New Project' : '+ Yeni Proje Oluştur'}</span>
          </button>
        </div>
      </div>

      {/* CREATE NEW PROJECT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <FolderPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  {isEn ? 'Create New Project' : 'Yeni Proje Oluştur'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isEn
                    ? 'Organize requirements and test cases separately for each project.'
                    : 'Farklı modüller veya yazılımlar için ayrı projeler yönetin.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isEn ? 'Project Name' : 'Proje Adı'} *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={
                    isEn
                      ? 'e.g. Mobile Banking Payment Module'
                      : 'Örn: Mobil Bankacılık Ödeme Modülü'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isEn ? 'Description (Optional)' : 'Açıklama (Opsiyonel)'}
                </label>
                <input
                  type="text"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Brief project scope or team name'
                      : 'Proje kapsamı veya sürüm bilgisi'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Starter options */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-300">
                  {isEn ? 'Initial Requirements Content' : 'Başlangıç İçeriği'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStartWithSample(true)}
                    className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                      startWithSample
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Sample Document' : 'Örnek Döküman'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      {isEn ? 'Pre-filled login requirement' : 'Örnek giriş gereksinimi yükler'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStartWithSample(false)}
                    className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                      !startWithSample
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-blue-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Empty Slate' : 'Boş Döküman'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      {isEn ? 'Clean slate for custom PRD' : 'Kendi dökümanınızı yapıştırın'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  {isEn ? 'Cancel' : 'İptal'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md"
                >
                  {isEn ? 'Create Project' : 'Projeyi Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROJECT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              {isEn ? 'Edit Project Details' : 'Proje Bilgilerini Düzenle'}
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isEn ? 'Project Name' : 'Proje Adı'} *
                </label>
                <input
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isEn ? 'Description' : 'Açıklama'}
                </label>
                <input
                  type="text"
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  {isEn ? 'Cancel' : 'İptal'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md"
                >
                  {isEn ? 'Save Changes' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PROJECT CONFIRMATION MODAL */}
      {isDeleteModalOpen && deleteTargetProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-bold text-base text-white">
                {isEn ? 'Delete Project?' : 'Projeyi Silmek İstiyor musunuz?'}
              </h3>
              <p className="text-xs text-slate-300">
                <strong className="text-rose-400">"{deleteTargetProject.name}"</strong>{' '}
                {isEn
                  ? 'project and all associated test cases will be permanently removed.'
                  : 'projesi ve bu projeye ait tüm test senaryoları kalıcı olarak silinecektir.'}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-1/2 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {isEn ? 'Cancel' : 'Vazgeç'}
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="w-1/2 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md"
              >
                {isEn ? 'Delete Project' : 'Projeyi Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
