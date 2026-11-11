import React, { useState } from 'react';
import { Project, ProjectMember, UserProfile } from '../types';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Copy,
  Check,
  Share2,
  X,
  Mail,
  Sparkles,
  ChevronDown,
  Globe2,
  CheckCircle2,
  FolderKanban,
} from 'lucide-react';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  allProjects?: Project[];
  onSelectProjectToShare?: (projectId: string) => void;
  currentUser: UserProfile | null;
  onUpdateProjectSharing: (updatedProject: Project) => Promise<void>;
  language: 'tr' | 'en';
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  allProjects = [],
  onSelectProjectToShare,
  currentUser,
  onUpdateProjectSharing,
  language,
}) => {
  const isEn = language === 'en';
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  if (!isOpen || !project) return null;

  const currentEmail = (currentUser?.email || '').toLowerCase().trim();
  const ownerEmail = (project.ownerEmail || currentEmail).toLowerCase().trim();
  
  // Safe ownership check: Owner is creator, matching email, matching userId, unassigned project, or admin/editor
  const isOwner =
    !project.ownerId ||
    !project.ownerEmail ||
    project.ownerId === currentUser?.id ||
    ownerEmail === currentEmail ||
    !ownerEmail ||
    (project.members || []).some(
      (m) =>
        m.email.toLowerCase().trim() === currentEmail &&
        (m.role === 'admin' || m.role === 'editor')
    );

  const members = project.members || [];

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const email = inviteEmail.toLowerCase().trim();
    if (!email) {
      setErrorMessage(isEn ? 'Please enter an email address.' : 'Lütfen geçerli bir e-posta adresi giriniz.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage(isEn ? 'Invalid email format (e.g. name@company.com).' : 'Geçersiz e-posta formatı (örn: ad@sirket.com).');
      return;
    }

    if (email === currentEmail) {
      setErrorMessage(
        isEn
          ? 'You cannot invite yourself to the project team.'
          : 'Kendinizi proje ekibine davet edemezsiniz (zaten bu oturumdasınız).'
      );
      return;
    }

    if (members.some((m) => m.email.toLowerCase() === email)) {
      setErrorMessage(
        isEn
          ? 'This colleague is already added to the project team.'
          : 'Bu kullanıcı zaten proje ekibine eklenmiş durumda.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const newMember: ProjectMember = {
        email,
        role: inviteRole,
        addedAt: new Date().toISOString(),
      };

      const updatedMembers = [...members, newMember];
      const updatedSharedEmails = Array.from(
        new Set([
          ownerEmail,
          currentEmail,
          ...(project.sharedEmails || []).map((e) => e.toLowerCase().trim()),
          email,
        ])
      ).filter(Boolean);

      const updatedProject: Project = {
        ...project,
        isShared: true,
        ownerId: project.ownerId || currentUser?.id,
        ownerEmail: project.ownerEmail || currentUser?.email || currentEmail,
        ownerName: project.ownerName || currentUser?.name || 'Proje Sahibi',
        members: updatedMembers,
        sharedEmails: updatedSharedEmails,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateProjectSharing(updatedProject);
      setInviteEmail('');
      setInviteRole('editor');
      setSuccessMessage(
        isEn
          ? `✓ Added ${email}! They can now view and edit this project in their workspace.`
          : `✓ ${email} başarıyla eklendi! Bu kullanıcı projeyi kendi panelinde görüp eşzamanlı çalışabilir.`
      );
      setTimeout(() => setSuccessMessage(null), 7000);
    } catch (err: any) {
      setErrorMessage(err?.message || (isEn ? 'Error adding member.' : 'Üye eklenirken bir hata oluştu.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnableSharing = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updatedSharedEmails = Array.from(
        new Set([
          ownerEmail,
          currentEmail,
          ...(project.sharedEmails || []).map((e) => e.toLowerCase().trim()),
        ])
      ).filter(Boolean);

      const updatedProject: Project = {
        ...project,
        isShared: true,
        ownerId: project.ownerId || currentUser?.id,
        ownerEmail: project.ownerEmail || currentUser?.email || currentEmail,
        ownerName: project.ownerName || currentUser?.name || 'Proje Yöneticisi',
        sharedEmails: updatedSharedEmails,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateProjectSharing(updatedProject);
      setSuccessMessage(
        isEn
          ? '✓ Project collaboration is now enabled! Share the link or invite members below.'
          : '✓ Proje ortak çalışmaya açıldı! Aşağıdan ekip arkadaşlarınızı davet edebilir veya linki paylaşabilirsiniz.'
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || (isEn ? 'Failed to enable sharing' : 'Paylaşım açılırken hata oluştu.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (emailToRemove: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updatedMembers = members.filter(
        (m) => m.email.toLowerCase() !== emailToRemove.toLowerCase()
      );
      const updatedSharedEmails = (project.sharedEmails || [])
        .map((e) => e.toLowerCase().trim())
        .filter((e) => e !== emailToRemove.toLowerCase());

      const updatedProject: Project = {
        ...project,
        members: updatedMembers,
        sharedEmails: updatedSharedEmails,
        isShared: true, // Keep project in shared pool
        updatedAt: new Date().toISOString(),
      };

      await onUpdateProjectSharing(updatedProject);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Üye çıkarılırken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMemberRole = async (member: ProjectMember) => {
    if (!isOwner) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const nextRole: 'editor' | 'viewer' = member.role === 'editor' ? 'viewer' : 'editor';
      const updatedMembers = members.map((m) =>
        m.email.toLowerCase() === member.email.toLowerCase()
          ? { ...m, role: nextRole }
          : m
      );

      const updatedProject: Project = {
        ...project,
        members: updatedMembers,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateProjectSharing(updatedProject);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Rol güncellenirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareableUrl = `${window.location.origin}/?projectId=${project.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative text-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Project Selector */}
        <div className="flex items-start gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-white">
                {isEn ? 'Share Project & Team Collaboration' : 'Projeyi Paylaş & Ekip Çalışması'}
              </h3>
              {project.isShared ? (
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isEn ? 'Sharing Active' : 'Paylaşım Aktif'}
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">
                  {isEn ? 'Private Project' : 'Özel Proje'}
                </span>
              )}
            </div>

            {/* Project Switcher Bar inside modal */}
            {allProjects.length > 1 && onSelectProjectToShare ? (
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                  className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 bg-indigo-950/60 hover:bg-indigo-950 border border-indigo-500/30 px-2.5 py-1 rounded-lg transition-all"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold truncate max-w-[220px]">{project.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                </button>

                {isProjectDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                      {isEn ? 'Select Project to Share' : 'Paylaşılacak Projeyi Seçin'}
                    </p>
                    {allProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onSelectProjectToShare(p.id);
                          setIsProjectDropdownOpen(false);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          p.id === project.id
                            ? 'bg-indigo-600/30 text-white font-semibold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {p.id === project.id && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {isEn ? 'Project:' : 'Proje:'}{' '}
                <strong className="text-indigo-300 font-semibold">{project.name}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Real-time Indicator banner */}
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-200">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isEn
              ? 'Shared projects synchronize in real-time. Team members added below can access this project simultaneously using their email accounts.'
              : 'Paylaşılan projeler anlık (eşzamanlı) senkronize edilir. Eklenen ekip arkadaşları kendi e-postalarıyla giriş yaptıklarında bu projeyi doğrudan görüp aynı proje üzerinde test üretebilir ve düzenleme yapabilirler.'}
          </p>
        </div>

        {/* Success notification */}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-300 animate-in fade-in">
            {errorMessage}
          </div>
        )}

        {/* If project is not yet shared, provide a 1-click enable button */}
        {!project.isShared && isOwner && (
          <div className="bg-slate-950/60 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">
                {isEn ? 'Enable Cloud Collaboration' : 'Ortak Çalışmayı Aktif Et'}
              </p>
              <p className="text-[11px] text-slate-400">
                {isEn ? 'Make this project accessible to team members' : 'Bu projeyi ekip üyelerinin erişimine açın'}
              </p>
            </div>
            <button
              onClick={handleEnableSharing}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Enable Sharing' : 'Paylaşımı Başlat'}</span>
            </button>
          </div>
        )}

        {/* Invite Form */}
        {isOwner ? (
          <form onSubmit={handleAddMember} className="space-y-2.5 pt-1">
            <label className="block text-xs font-semibold text-slate-300">
              {isEn ? 'Invite Team Member by Email' : 'E-posta ile Ekip Arkadaşı Ekle'}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={isEn ? 'colleague@company.com' : 'arkadasiniz@sirket.com'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 shrink-0"
              >
                <option value="editor">{isEn ? 'Editor (Can Edit)' : 'Düzenleyici (Tam Yetki)'}</option>
                <option value="viewer">{isEn ? 'Viewer (Read Only)' : 'Görüntüleyici (Salt Okunur)'}</option>
              </select>

              <button
                type="submit"
                disabled={isSubmitting || !inviteEmail.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.98]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isEn ? 'Invite & Share' : 'Davet Et ve Paylaş'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {isEn
                ? 'Invited colleagues can sign in using this email address to see and edit the project.'
                : 'Davet edilen kişi bu e-posta ile giriş yaptığında projeyi anında kendi listesinde görebilecektir.'}
            </p>
          </form>
        ) : (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
            {isEn
              ? 'You have collaborative access to this project. Only the project owner can invite new members.'
              : 'Bu projede ortak çalışma yetkiniz bulunmaktadır. Yalnızca proje sahibi yeni ekip arkadaşları davet edebilir.'}
          </div>
        )}

        {/* Member List */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>{isEn ? 'Project Team' : 'Proje Ekibi'} ({1 + members.length})</span>
            <span className="text-[11px] text-slate-500">{isEn ? 'Role & Access' : 'Rol & Yetki'}</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {/* Owner Row */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30 shrink-0">
                  {(ownerEmail || 'P').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                    <span>{project.ownerName || ownerEmail || 'Proje Sahibi'}</span>
                    {ownerEmail === currentEmail && (
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                        {isEn ? 'You' : 'Siz'}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{ownerEmail || 'Proje Yöneticisi'}</p>
                </div>
              </div>
              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                {isEn ? 'Project Owner' : 'Proje Sahibi'}
              </span>
            </div>

            {/* Invited Collaborators */}
            {members.map((member) => (
              <div
                key={member.email}
                className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30 shrink-0">
                    {member.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="font-semibold text-xs text-slate-200 truncate flex items-center gap-1.5">
                      <span>{member.name || member.email.split('@')[0]}</span>
                      {member.email.toLowerCase() === currentEmail && (
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                          {isEn ? 'You' : 'Siz'}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Role Button */}
                  <button
                    onClick={() => handleToggleMemberRole(member)}
                    disabled={!isOwner || isSubmitting}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                      member.role === 'editor'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                    title={isOwner ? (isEn ? 'Click to change role' : 'Rolü değiştirmek için tıklayın') : ''}
                  >
                    {member.role === 'editor'
                      ? isEn ? 'Editor' : 'Düzenleyici'
                      : isEn ? 'Viewer' : 'Görüntüleyici'}
                  </button>

                  {/* Remove Button (Owner only) */}
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveMember(member.email)}
                      disabled={isSubmitting}
                      className="p-1 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 rounded-md transition-colors"
                      title={isEn ? 'Remove Member' : 'Üyeyi Çıkar'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shareable Link Box */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isEn ? 'Direct Project Link' : 'Doğrudan Proje Paylaşım Bağlantısı'}</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-400 truncate select-all">
              {shareableUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{isEn ? 'Copied!' : 'Kopyalandı!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isEn ? 'Copy' : 'Kopyala'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            {isEn ? 'Close' : 'Kapat'}
          </button>
        </div>
      </div>
    </div>
  );
};
