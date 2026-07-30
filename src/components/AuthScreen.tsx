import React, { useState } from 'react';
import { UserProfile } from '../types';
import { saveUserProfileToCloud, findUserInCloudByEmail } from '../firebase';
import {
  Sparkles,
  Lock,
  Mail,
  User,
  Briefcase,
  Eye,
  EyeOff,
  CheckCircle2,
  Globe,
  ArrowRight,
  ShieldCheck,
  Check,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  language: 'tr' | 'en';
  onToggleLanguage: () => void;
}

const DEFAULT_DEMO_USERS: UserProfile[] = [
  {
    id: 'usr_demo_lead',
    name: 'Ahmet Yılmaz',
    email: 'ahmet.qa@testmatrix.ai',
    password: '123456',
    role: 'Lead Test Automation Specialist',
    provider: 'email',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_demo_po',
    name: 'Ece Demir',
    email: 'ece.po@company.com',
    password: '123456',
    role: 'Senior Product Owner',
    provider: 'email',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_demo_ilhan',
    name: 'İlhan Turgut',
    email: 'ilhantrgt@gmail.com',
    password: '123456',
    role: 'QA Architect',
    provider: 'email',
    createdAt: new Date().toISOString(),
  },
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  language,
  onToggleLanguage,
}) => {
  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Senior QA Automation Engineer');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Modal State
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');

  // Pre-saved users in localStorage with fallback to default demo users
  const getRegisteredUsers = (): UserProfile[] => {
    try {
      const stored = localStorage.getItem('tm_registered_users');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_DEMO_USERS;
  };

  const saveRegisteredUser = (newUser: UserProfile) => {
    const existing = getRegisteredUsers();
    const updated = [...existing.filter((u) => u.email.toLowerCase() !== newUser.email.toLowerCase()), newUser];
    localStorage.setItem('tm_registered_users', JSON.stringify(updated));
    saveUserProfileToCloud(newUser);
  };

  // Handle standard Login submission with strict user & password checks
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg(
        isEn
          ? 'Please enter both email address and password.'
          : 'Lütfen e-posta adresi ve şifrenizi giriniz.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Search local storage registered users
      const registeredUsers = getRegisteredUsers();
      let foundUser = registeredUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );

      // 2. Search Firestore cloud database if not found locally
      if (!foundUser) {
        const cloudUser = await findUserInCloudByEmail(cleanEmail);
        if (cloudUser) {
          foundUser = cloudUser;
        }
      }

      // 3. User Existence Verification Check!
      if (!foundUser) {
        setErrorMsg(
          isEn
            ? 'No account found with this email. Please create an account from the "Create Account" tab first.'
            : 'Bu e-posta adresi ile kayıtlı bir kullanıcı bulunamadı. Lütfen önce "Kayıt Ol" sekmesinden hesap oluşturun.'
        );
        setIsSubmitting(false);
        return;
      }

      // 4. Password Verification Check!
      const expectedPassword = foundUser.password || '123456';
      if (cleanPassword !== expectedPassword) {
        setErrorMsg(
          isEn
            ? 'Incorrect password. Please verify your password and try again.'
            : 'Girilen şifre hatalı. Lütfen şifrenizi kontrol edip tekrar deneyin.'
        );
        setIsSubmitting(false);
        return;
      }

      // Successful verification
      saveRegisteredUser(foundUser);
      onLoginSuccess(foundUser);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(
        isEn
          ? 'An error occurred during sign in. Please try again.'
          : 'Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Registration submission with existence checks
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName) {
      setErrorMsg(isEn ? 'Please enter your full name.' : 'Lütfen ad soyad giriniz.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg(
        isEn ? 'Please enter a valid email address.' : 'Lütfen geçerli bir e-posta adresi giriniz.'
      );
      return;
    }
    if (cleanPassword.length < 6) {
      setErrorMsg(
        isEn
          ? 'Password must be at least 6 characters long.'
          : 'Şifreniz en az 6 karakter olmalıdır.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user already exists in local storage or Firestore
      const registeredUsers = getRegisteredUsers();
      const existingLocal = registeredUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );
      const existingCloud = await findUserInCloudByEmail(cleanEmail);

      if (existingLocal || existingCloud) {
        setErrorMsg(
          isEn
            ? 'An account with this email address already exists. Please sign in instead.'
            : 'Bu e-posta adresi ile kayıtlı bir hesap zaten var. Lütfen "Giriş Yap" sekmesini kullanın.'
        );
        setIsSubmitting(false);
        return;
      }

      const newUser: UserProfile = {
        id: 'usr_' + Date.now(),
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role: role.trim() || 'Software QA Engineer',
        provider: 'email',
        createdAt: new Date().toISOString(),
      };

      saveRegisteredUser(newUser);
      onLoginSuccess(newUser);
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg(
        isEn
          ? 'An error occurred during account creation. Please try again.'
          : 'Hesap oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignInClick = () => {
    setIsGoogleModalOpen(true);
  };

  const handleConfirmGoogleLogin = async (selectedEmail?: string, selectedName?: string) => {
    const finalEmail = (selectedEmail || googleEmailInput || 'ilhantrgt@gmail.com').trim().toLowerCase();

    let finalName = (selectedName || googleNameInput || '').trim();
    if (!finalName || finalName === 'Google Kullanıcısı') {
      const localPart = finalEmail.split('@')[0];
      finalName = localPart
        .split(/[._-]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
    }

    setIsSubmitting(true);
    try {
      // Look for existing account with same email in local storage or Firestore
      const registeredUsers = getRegisteredUsers();
      let existingUser = registeredUsers.find(
        (u) => u.email.toLowerCase() === finalEmail
      );

      if (!existingUser) {
        const cloudUser = await findUserInCloudByEmail(finalEmail);
        if (cloudUser) existingUser = cloudUser;
      }

      let googleUser: UserProfile;

      if (existingUser) {
        googleUser = {
          ...existingUser,
          name: existingUser.name && existingUser.name !== 'Google Kullanıcısı' ? existingUser.name : finalName,
          provider: 'google',
        };
      } else {
        googleUser = {
          id: 'usr_g_' + finalEmail.replace(/[^a-z0-9]/g, '_'),
          name: finalName,
          email: finalEmail,
          role: 'Software QA Engineer',
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`,
          provider: 'google',
          createdAt: new Date().toISOString(),
        };
      }

      saveRegisteredUser(googleUser);
      setIsGoogleModalOpen(false);
      onLoginSuccess(googleUser);
    } catch (err) {
      console.error('Google login error:', err);
      // Fallback
      const fallbackUser: UserProfile = {
        id: 'usr_g_' + finalEmail.replace(/[^a-z0-9]/g, '_'),
        name: finalName,
        email: finalEmail,
        role: 'Software QA Engineer',
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      saveRegisteredUser(fallbackUser);
      setIsGoogleModalOpen(false);
      onLoginSuccess(fallbackUser);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Demo Login
  const handleQuickDemoLogin = (roleType: string) => {
    const demoUsers: Record<string, UserProfile> = {
      lead: {
        id: 'usr_demo_lead',
        name: 'Ahmet Yılmaz',
        email: 'ahmet.qa@testmatrix.ai',
        role: 'Lead Test Automation Specialist',
        provider: 'email',
        createdAt: new Date().toISOString(),
      },
      po: {
        id: 'usr_demo_po',
        name: 'Ece Demir',
        email: 'ece.po@company.com',
        role: 'Senior Product Owner',
        provider: 'email',
        createdAt: new Date().toISOString(),
      },
    };

    const targetUser = demoUsers[roleType] || demoUsers.lead;
    saveRegisteredUser(targetUser);
    onLoginSuccess(targetUser);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Subtle Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Bar / Brand Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-slate-100 tracking-tight">
                TestMatrix AI
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-md border border-indigo-500/30">
                v2.5 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {isEn
                ? 'Automated Test Case & RTM Generation Suite'
                : 'Otomatik Test Case & Gereksinim İzlenebilirlik Platformu'}
            </p>
          </div>
        </div>

        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors shadow-sm"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{language === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}</span>
        </button>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10 my-4">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {activeTab === 'login'
                ? isEn
                  ? 'Welcome Back'
                  : 'Platforma Giriş Yapın'
                : isEn
                ? 'Create QA Account'
                : 'Yeni Hesap Oluşturun'}
            </h2>
            <p className="text-xs text-slate-400">
              {isEn
                ? 'Generate AI test cases & RTM matrices directly from SRS specs'
                : 'Gereksinim dökümanlarınızdan saniyeler içinde test senaryoları üretin'}
            </p>
          </div>

          {/* Social Sign In (Google) */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              className="w-full bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm py-2.5 px-4 rounded-xl transition-all duration-150 flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-[0.99]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.14C3.25 21.27 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.73 1.27 6.59l4.01 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isEn ? 'Sign in with Google' : 'Google Hesabı ile Giriş Yap'}</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-slate-900 px-3 text-[11px] uppercase font-mono text-slate-500 font-semibold absolute">
                {isEn ? 'OR EMAIL' : 'VEYA E-POSTA İLE'}
              </span>
            </div>
          </div>

          {/* Form Switcher Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => {
                setActiveTab('login');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-center transition-all ${
                activeTab === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isEn ? 'Sign In' : 'Giriş Yap'}
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-center transition-all ${
                activeTab === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isEn ? 'Create Account' : 'Kayıt Ol'}
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {isEn ? 'Email Address' : 'E-Posta Adresi'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isEn ? 'qa.lead@company.com' : 'ornek@kurum.com'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {isEn ? 'Password' : 'Şifre'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                  <span>{isEn ? 'Remember me' : 'Beni hatırla'}</span>
                </label>
                <span className="text-indigo-400 hover:underline cursor-pointer">
                  {isEn ? 'Forgot password?' : 'Şifremi unuttum'}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{isEn ? 'Verifying Credentials...' : 'Kullanıcı Doğrulanıyor...'}</span>
                  </>
                ) : (
                  <>
                    <span>{isEn ? 'Sign In to Workspace' : 'Giriş Yap'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isEn ? 'Full Name' : 'Ad Soyad'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isEn ? 'John Doe' : 'Mert Yılmaz'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isEn ? 'Email Address' : 'E-Posta Adresi'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isEn ? 'qa.lead@company.com' : 'ornek@kurum.com'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isEn ? 'QA / Product Role' : 'Unvan / Rol'}
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="Senior QA Automation Engineer">
                      Senior QA Automation Engineer
                    </option>
                    <option value="Software Test Specialist">
                      Software Test Specialist / Tester
                    </option>
                    <option value="Lead QA / Test Manager">Lead QA / Test Manager</option>
                    <option value="Product Owner / Business Analyst">
                      Product Owner / Business Analyst
                    </option>
                    <option value="Software Developer / Architect">
                      Software Developer / Architect
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {isEn ? 'Set Password' : 'Şifre Belirleyin'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEn ? 'At least 6 characters' : 'En az 6 karakter'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 text-sm mt-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{isEn ? 'Creating Account...' : 'Hesap Oluşturuluyor...'}</span>
                  </>
                ) : (
                  <>
                    <span>{isEn ? 'Create Account & Continue' : 'Hesabı Oluştur ve Başla'}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Helper */}
          <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isEn
                  ? 'Quick Demo Login (No credentials needed):'
                  : 'Hızlı Deneme Girişi (Şifresiz):'}
              </span>
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => handleQuickDemoLogin('lead')}
                className="text-[11px] bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-lg transition-colors font-mono"
              >
                👤 QA Lead
              </button>
              <button
                onClick={() => handleQuickDemoLogin('po')}
                className="text-[11px] bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-lg transition-colors font-mono"
              >
                👤 Product Owner
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-500 border-t border-slate-900 relative z-10">
        <p>TestMatrix AI — ISTQB Standard Compliant Test Engineering Suite</p>
      </footer>

      {/* Google Account Selector Modal */}
      {isGoogleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-white rounded-full mx-auto flex items-center justify-center shadow-md">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.14C3.25 21.27 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.73 1.27 6.59l4.01 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-lg text-white">
                {isEn ? 'Google Account Login' : 'Google ile Oturum Açın'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEn
                  ? 'Select a saved Google profile or type custom Google email'
                  : 'TestMatrix AI platformuna Google kimliğiniz ile bağlanın'}
              </p>
            </div>

            {/* Quick pre-set Google accounts */}
            <div className="space-y-2">
              <button
                onClick={() =>
                  handleConfirmGoogleLogin(
                    'ilhantrgt@gmail.com',
                    'İlhan Turgut'
                  )
                }
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  IT
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">İlhan Turgut</p>
                  <p className="text-[11px] text-slate-400">ilhantrgt@gmail.com</p>
                </div>
                <Check className="w-4 h-4 text-emerald-400 ml-auto" />
              </button>

              <button
                onClick={() =>
                  handleConfirmGoogleLogin(
                    'qa.specialist@gmail.com',
                    'Canan Özkan'
                  )
                }
                className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  CÖ
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Canan Özkan</p>
                  <p className="text-[11px] text-slate-400">qa.specialist@gmail.com</p>
                </div>
              </button>
            </div>

            {/* Custom Google Email input */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <p className="text-[11px] text-slate-400 font-medium">
                {isEn ? 'Farklı bir Google hesabı kullan:' : 'Farklı Google e-postası girin:'}
              </p>
              <input
                type="email"
                value={googleEmailInput}
                onChange={(e) => setGoogleEmailInput(e.target.value)}
                placeholder="kullanici@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                value={googleNameInput}
                onChange={(e) => setGoogleNameInput(e.target.value)}
                placeholder={isEn ? 'Full Name (Optional)' : 'Ad Soyad (Opsiyonel)'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleConfirmGoogleLogin()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-xl transition-colors shadow-md"
              >
                {isEn ? 'Continue with this Google Email' : 'Bu Google Hesabı ile Devam Et'}
              </button>
            </div>

            <button
              onClick={() => setIsGoogleModalOpen(false)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors pt-1"
            >
              {isEn ? 'Cancel' : 'İptal'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
