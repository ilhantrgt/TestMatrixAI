import React, { useState } from 'react';
import { Project, ProjectMember, UserProfile } from '../types';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Trash2,
  Copy,
  Check,
  Share2,
  Link2,
  X,
  Mail,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  currentUser: UserProfile | null;
  onUpdateProjectSharing: (updatedProject: Project) => Promise<void>;
  language: 'tr' | 'en';
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  currentUser,
  onUpdateProjectSharing,
  language,
}) => {
  const isEn = language === 'en';
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const currentEmail = (currentUser?.email || '').toLowerCase().trim();
  const ownerEmail = (project.ownerEmail || currentEmail).toLowerCase().trim();
  const isOwner = !project.ownerEmail || ownerEmail === currentEmail;
  const members = project.members || [];

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const email = inviteEmail.toLowerCase().trim();
    if (!email) {
      setErrorMessage(isEn ? 'Please enter a valid email address.' : 'Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setErrorMessage(isEn ? 'Invalid email format.' : 'Geçersiz e-posta formatı.');
      return;
    }

    if (email === ownerEmail) {
      setErrorMessage(isEn ? 'The project owner already has full access.' : 'Proje sahibi zaten tüm yetkilere sahiptir.');
      return;
    }

    if (members.some((m) => m.email.toLowerCase() === email)) {
      setErrorMessage(isEn ? 'This user is already a member of this project.' : 'Bu kullanıcı zaten proje ekibinde kayıtlı.');
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
          ...(project.sharedEmails || []),
          email,
        ])
      );

      const updatedProject: Project = {
        ...project,
        isShared: true,
        ownerId: project.ownerId || currentUser?.id,
        ownerEmail: project.ownerEmail || currentUser?.email,
        ownerName: project.ownerName || currentUser?.name || 'Proje Sahibi',
        members: updatedMembers,
        sharedEmails: updatedSharedEmails,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateProjectSharing(updatedProject);
      setInviteEmail('');
      setInviteRole('editor');
    } catch (err: any) {
      setErrorMessage(err.message || 'Üye eklenirken bir hata oluştu.');
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
      const updatedSharedEmails = (project.sharedEmails || []).filter(
        (e) => e.toLowerCase() !== emailToRemove.toLowerCase()
      );

      const updatedProject: Project = {
        ...project,
        members: updatedMembers,
        sharedEmails: updatedSharedEmails,
        isShared: updatedMembers.length > 0,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateProjectSharing(updatedProject);
    } catch (err: any) {
      setErrorMessage(err.message || 'Üye çıkarılırken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMemberRole = async (member: ProjectMember) => {
    if (!isOwner) return;
    setIsSubmitting(true);
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
      setErrorMessage(err.message || 'Rol güncellenirken bir hata oluştu.');
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
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white truncate">
                {isEn ? 'Share Project & Team Collaboration' : 'Projeyi Paylaş & Ekip Çalışması'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {isEn ? 'Project:' : 'Proje:'} <strong className="text-indigo-300 font-semibold">{project.name}</strong>
            </p>
          </div>
        </div>

        {/* Real-time Indicator banner */}
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-200">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isEn
              ? 'Shared projects sync in real-time. Team members added here can access this project simultaneously using their email accounts.'
              : 'Eklenen ekip arkadaşlarınız sisteme kendi e-postalarıyla giriş yaptıklarında bu projeyi doğrudan görüp eşzamanlı (anlık) çalışabilirler.'}
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Invite Form (only owner can invite) */}
        {isOwner ? (
          <form onSubmit={handleAddMember} className="space-y-3 pt-1">
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
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="editor">{isEn ? 'Editor (Can Edit)' : 'Düzenleyici (Yetkili)'}</option>
                <option value="viewer">{isEn ? 'Viewer (Read Only)' : 'Görüntüleyici (Salt Okunur)'}</option>
              </select>

              <button
                type="submit"
                disabled={isSubmitting || !inviteEmail.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isEn ? 'Invite' : 'Davet Et'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
            {isEn
              ? 'Only the project owner can invite new members or change team permissions.'
              : 'Yalnızca proje sahibi yeni üyeler davet edebilir veya yetkileri değiştirebilir.'}
          </div>
        )}

        {/* Member List */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>{isEn ? 'Team Members' : 'Proje Ekibi'} ({1 + members.length})</span>
            <span className="text-[11px] text-slate-500">{isEn ? 'Role & Access' : 'Rol & Erişim'}</span>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {/* Owner Row */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30 shrink-0">
                  {ownerEmail.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                    <span>{project.ownerName || ownerEmail}</span>
                    {ownerEmail === currentEmail && (
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                        {isEn ? 'You' : 'Siz'}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{ownerEmail}</p>
                </div>
              </div>
              <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" />
                {isEn ? 'Owner' : 'Proje Sahibi'}
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
                  {/* Role Button / Badge */}
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
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            {isEn ? 'Direct Project Link' : 'Doğrudan Proje Paylaşım Bağlantısı'}
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
