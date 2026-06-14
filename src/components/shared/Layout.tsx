import React, { ReactNode } from 'react';
import {
  LayoutDashboard,
  Package,
  Stethoscope,
  Users,
  Settings,
  LogOut,
  Menu,
  CreditCard,
  PawPrint,
  ClipboardList,
  ShieldCheck,
  UserRound,
  Shield,
  X,
  TrendingUp,
  CalendarDays,
  Plus,
  ShoppingCart,
  DollarSign,
  FileSpreadsheet,
  Search,
  Bell,
  Sparkles,
  Building2,
  Calculator,
  Microscope,
  Wifi,
  WifiOff,
  Activity,
  ListOrdered
} from 'lucide-react';
import { AppView, User, ClinicSettings } from '../../types';
import { CommandPalette } from './CommandPalette';
import { hasAccess } from '../../config/permissions';
import { Logo } from './Logo';
import { api } from '../../services/apiService';
import { toast } from 'sonner';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface LayoutProps {
  children: ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  user: User | null;
  settings: ClinicSettings;
}

const SidebarItem = ({ icon: Icon, label, active = false, badgeCount, onClick }: { icon: React.ElementType, label: string, active?: boolean, badgeCount?: number, onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`group flex items-center gap-3 px-4 py-3 rounded-[1.4rem] cursor-pointer transition-all duration-300 ease-out active:scale-[0.98] border ${active
      ? 'bg-white text-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.12)] border-white/80'
      : 'text-slate-600 border-transparent hover:bg-white/72 hover:text-slate-800 hover:border-white hover:translate-x-1'
      }`}
  >
    <div className={`w-9 h-9 rounded-[1rem] flex items-center justify-center transition-all duration-300 ease-out ${active ? 'bg-teal-50 text-teal-600 shadow-sm scale-105' : 'bg-slate-100 group-hover:bg-teal-50 text-slate-500 group-hover:text-teal-600 group-hover:scale-105'}`}>
        <Icon className="w-4.5 h-4.5 flex-shrink-0" />
    </div>
    <span className={`font-semibold text-sm ${active ? 'text-slate-800' : 'text-slate-600'}`}>{label}</span>
    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-500'}`}>
        {badgeCount}
      </span>
    )}
  </div>
);

const SidebarGroupHeader = ({ label }: { label: string }) => (
  <div className="px-4 mt-6 mb-2">
    <span className="text-[11px] font-semibold text-slate-400">{label}</span>
  </div>
);

const MobileNavItem = ({ icon: Icon, active = false, onClick }: { icon: React.ElementType, active?: boolean, onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`h-12 w-full rounded-[1.15rem] cursor-pointer transition-all duration-300 ease-out active:scale-95 flex items-center justify-center border ${active ? 'bg-white text-teal-600 shadow-[0_12px_24px_rgba(15,23,42,0.12)] border-white' : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-white/55'}`}
  >
    <Icon className="w-5 h-5" />
  </div>
);

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, onLogout, user, settings }) => {
  const isSuperAdmin = user?.isSuperAdmin;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [portalUnreadCount, setPortalUnreadCount] = React.useState(0);
  const lastPortalUnreadRef = React.useRef(0);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!user || isSuperAdmin) {
      setPortalUnreadCount(0);
      lastPortalUnreadRef.current = 0;
      return;
    }

    let mounted = true;
    const loadUnread = async () => {
      try {
        const conversations = await api.aiClient.getConversations({ platform: 'PORTAL' });
        const unread = conversations.reduce((sum, conversation) => sum + (conversation.unreadForClinic || 0), 0);
        if (mounted) {
          if (lastPortalUnreadRef.current > 0 && unread > lastPortalUnreadRef.current) {
            toast.info('New client portal message waiting in the inbox.');
          }
          lastPortalUnreadRef.current = unread;
          setPortalUnreadCount(unread);
        }
      } catch (error) {
        // Ignore polling failures; the sidebar should stay usable.
      }
    };

    loadUnread();
    const interval = setInterval(loadUnread, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.id, isSuperAdmin]);

  const handleNavigate = (view: AppView, id?: string) => {
    onNavigate(view);
    if (id) {
      // Dispatch custom event for App.tsx to handle detail views
      const event = new CustomEvent('app-navigate', { detail: { view, id } });
      window.dispatchEvent(event);
    }
    setIsMobileMenuOpen(false);
    setIsDesktopMenuOpen(false);
  };

  const [isQuickAccessOpen, setIsQuickAccessOpen] = React.useState(false);

  const isOnline = useOnlineStatus();

  const ConnectivityBanner = () => {
    if (isOnline) return null;
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500/95 backdrop-blur-md text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg">
        <WifiOff className="w-4 h-4" />
        <span>You are offline. Some features may be limited until connection is restored.</span>
      </div>
    );
  };

  // Helper to render filtered sidebar items
  const renderSidebarItems = () => {
    const groups = [
      {
        label: 'Operations',
        items: [
          { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'APPOINTMENTS', label: 'Appointments', icon: CalendarDays },
          { id: 'PATIENT_QUEUE', label: 'Queue', icon: ListOrdered },
        ]
      },
      {
        label: 'Clinical',
        items: [
          { id: 'HOSPITALIZATION', label: 'Hospitalization', icon: Activity },
          { id: 'ICU_BOARD', label: 'ICU Board', icon: Activity },
        ]
      },
      {
        label: 'Clients and pets',
        items: [
          { id: 'CLIENTS', label: 'Clients', icon: Users },
          { id: 'PATIENTS', label: 'Patients', icon: PawPrint },
          { id: 'TREATMENTS', label: 'Treatments', icon: Stethoscope },
        ]
      },
      {
        label: 'Lab and tools',
        items: [
          { id: 'LAB_HUB', label: 'Lab', icon: Microscope },
          { id: 'PROCEDURES', label: 'Procedures', icon: ClipboardList },
          { id: 'CLINICAL_CALCULATORS', label: 'Calculators', icon: Calculator },
        ]
      },
      {
        label: 'Financials',
        items: [
          { id: 'POS', label: 'Billing', icon: CreditCard },
          { id: 'SALES_HISTORY', label: 'Sales History', icon: ClipboardList },
          { id: 'EXPENSES', label: 'Expenses', icon: DollarSign },
          { id: 'REPORTS', label: 'Reports', icon: TrendingUp },
          { id: 'FREE_INVOICE', label: 'Invoice', icon: FileSpreadsheet },
        ]
      },
      {
        label: 'Stock',
        items: [
          { id: 'INVENTORY', label: 'Inventory', icon: Package },
          { id: 'NARCOTICS_LOCKBOX', label: 'Controlled drugs', icon: Shield },
        ]
      },
      {
        label: 'Admin',
        items: [
          { id: 'AI_HUB', label: 'AI help', icon: Sparkles, badgeCount: portalUnreadCount },
          { id: 'STAFF', label: 'Staff', icon: UserRound },
          { id: 'REMINDERS', label: 'Reminders', icon: Bell },
          { id: 'AUDIT_LOG', label: 'Audit Log', icon: ShieldCheck },
          { id: 'BRANCHES', label: 'Branches', icon: Building2 },
          { id: 'SETTINGS', label: 'Settings', icon: Settings },
        ]
      }
    ];

    return groups.map((group, gIdx) => {
      const visibleItems = group.items.filter(item => hasAccess(user, item.id as AppView));
      if (visibleItems.length === 0) return null;

      return (
        <div key={group.label} className={gIdx === 0 ? '' : 'mt-2'}>
          <SidebarGroupHeader label={group.label} />
          <div className="space-y-0.5">
            {visibleItems.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={currentView === item.id}
                badgeCount={item.badgeCount}
                onClick={() => handleNavigate(item.id as AppView)}
              />
            ))}
          </div>
        </div>
      );
    });
  };

  // Unified soft teal foundation
  const getPageFoundation = () => {
    return 'var(--aura-dashboard)';
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-1000 dashboard-shell" style={{ backgroundColor: getPageFoundation() } as React.CSSProperties}>
      <ConnectivityBanner />
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
      />

      <button
        onClick={() => setIsDesktopMenuOpen(true)}
        className="hidden md:flex fixed top-4 left-6 z-40 w-14 h-14 rounded-[1.6rem] bg-white/50 backdrop-blur-3xl border border-white/70 shadow-[0_22px_50px_rgba(148,163,184,0.22)] items-center justify-center text-slate-700 hover:bg-white hover:text-[#14B8A6] hover:border-[#14B8A6]/30 hover:-translate-y-1 transition-all duration-300 ease-out group ring-1 ring-white/30"
      >
        <Menu className="w-6 h-6" />
        {/* Tooltip */}
        <div className="absolute left-[calc(100%+0.5rem)] px-3 py-1.5 bg-white/90 backdrop-blur-md text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/50">
          Menu
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-white/90 border-l border-b border-white/50 rotate-45"></div>
        </div>
      </button>

      {/* Desktop Search Button */}
      <button
        onClick={() => setIsCommandPaletteOpen(true)}
        className="hidden md:flex fixed top-4 left-24 z-40 w-14 h-14 rounded-[1.6rem] bg-white/50 backdrop-blur-3xl border border-white/70 shadow-[0_22px_50px_rgba(148,163,184,0.22)] items-center justify-center text-slate-700 hover:bg-white hover:text-[#14B8A6] hover:border-[#14B8A6]/30 hover:-translate-y-1 transition-all duration-300 ease-out group ring-1 ring-white/30"
      >
        <Search className="w-6 h-6" />
        {/* Tooltip */}
        <div className="absolute left-[calc(100%+0.5rem)] px-3 py-1.5 bg-white/90 backdrop-blur-md text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/50">
          Search
          <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-white/90 border-l border-b border-white/50 rotate-45"></div>
        </div>
      </button>

      {/* Desktop Sidebar Overlay */}
      {isDesktopMenuOpen && (
        <div className="hidden md:block fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsDesktopMenuOpen(false)}
          ></div>

          {/* Sidebar Drawer */}
          <div className="relative w-80 h-full bg-[linear-gradient(180deg,#eef8f5,#f9fbfc)] backdrop-blur-[40px] shadow-2xl border-r border-white/70 flex flex-col animate-slide-in-left ring-1 ring-white/50 text-slate-800">
            {/* Header */}
            <div className="p-8 flex justify-between items-center border-b border-slate-200/70">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.5rem] bg-white flex items-center justify-center border border-slate-200 shadow-inner">
                    <Logo size="lg" />
                </div>
                <div>
                  <h2 className="font-extrabold text-xl text-slate-800 tracking-tight leading-none">{settings.name || 'Vet Nexus'}</h2>
                  <p className="text-xs text-slate-500 mt-1">Clinic account</p>
                </div>
              </div>
              <button
                onClick={() => setIsDesktopMenuOpen(false)}
                className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all border border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 motion-stagger">
              {isSuperAdmin ? (
                <SidebarItem
                  icon={Shield}
                  label="Super Admin"
                  active={currentView === 'SUPER_ADMIN'}
                  onClick={() => handleNavigate('SUPER_ADMIN')}
                />
              ) : (
                <>
                  {renderSidebarItems()}
                </>
              )}
            </div>

            {/* Footer - Logout */}
            <div className="p-6 border-t border-slate-200/70">
              <button
                onClick={onLogout}
                className="w-full py-4 rounded-[1.25rem] flex items-center justify-center gap-2 font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300 ease-out border border-slate-200"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-50 px-4 py-3 flex justify-between items-center bg-white/90 backdrop-blur-2xl border-b border-slate-200/70">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-white/45 border border-white/70 shadow-sm overflow-hidden cursor-pointer"
            onClick={() => onNavigate(isSuperAdmin ? 'SUPER_ADMIN' : 'SETTINGS')}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="DP" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#14B8A6] text-white font-black text-xs uppercase">
                {user?.name?.charAt(0) || (isSuperAdmin ? 'S' : 'V')}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-400 leading-none">{isSuperAdmin ? 'System' : 'Signed in'}</span>
            <span className="font-bold text-sm text-slate-800 truncate max-w-[8rem]">{user?.name?.split(' ')[0] || (isSuperAdmin ? 'Admin' : 'Dr')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isSuperAdmin && (
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-10 h-10 rounded-xl bg-white/50 border border-white/70 flex items-center justify-center text-slate-700 shadow-xl"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-white/50 border border-white/70 flex items-center justify-center text-slate-700 shadow-xl"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      {!isSuperAdmin && (
        <div className="md:hidden fixed bottom-[calc(0.85rem+env(safe-area-inset-bottom))] left-3 right-3 h-[4.6rem] bg-white/86 backdrop-blur-2xl border border-white/80 rounded-[26px] px-2.5 grid grid-cols-5 items-center gap-1.5 z-50 shadow-[0_20px_46px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-slate-200/70 motion-panel">
          <MobileNavItem icon={LayoutDashboard} active={currentView === 'DASHBOARD'} onClick={() => handleNavigate('DASHBOARD')} />
          <MobileNavItem icon={Users} active={currentView === 'CLIENTS'} onClick={() => handleNavigate('CLIENTS')} />

          <div className="relative h-12 w-full flex items-center justify-center">
            <button
              onClick={() => setIsQuickAccessOpen(!isQuickAccessOpen)}
              className="w-full h-12 rounded-[1.15rem] bg-gradient-to-br from-teal-500 to-teal-700 shadow-[0_14px_26px_rgba(20,184,166,0.28),inset_0_1px_0_rgba(255,255,255,0.24)] flex items-center justify-center text-white active:scale-95 transition-all duration-300 ease-out border border-white/80"
            >
              <Plus className={`w-6 h-6 transition-transform duration-500 ${isQuickAccessOpen ? 'rotate-45' : ''}`} />
            </button>
            {isQuickAccessOpen && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-slide-up motion-stagger">
                <button onClick={() => { handleNavigate('POS'); setIsQuickAccessOpen(false); }} className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-50 text-teal-600 font-semibold text-sm">
                  <ShoppingCart className="w-4 h-4" /> <span>Billing</span>
                </button>
                <button onClick={() => { handleNavigate('CLIENTS'); setIsQuickAccessOpen(false); }} className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-sm">
                  <Users className="w-4 h-4" /> <span>Add Client</span>
                </button>
                <button onClick={() => { handleNavigate('PATIENTS'); setIsQuickAccessOpen(false); }} className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-sm">
                  <PawPrint className="w-4 h-4" /> <span>Add Patient</span>
                </button>
              </div>
            )}
          </div>

          <MobileNavItem icon={PawPrint} active={currentView === 'PATIENTS'} onClick={() => handleNavigate('PATIENTS')} />
          <MobileNavItem icon={Settings} active={currentView === 'SETTINGS'} onClick={() => handleNavigate('SETTINGS')} />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          <div className="relative w-72 h-full bg-[linear-gradient(180deg,#eef8f5,#f9fbfc)] backdrop-blur-2xl shadow-2xl border-l border-white/70 flex flex-col animate-slide-in-right text-slate-800">
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
              <span className="font-extrabold text-xl text-slate-800">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 motion-stagger">
              {isSuperAdmin ? (
                <SidebarItem
                  icon={Shield}
                  label="Super Admin"
                  active={currentView === 'SUPER_ADMIN'}
                  onClick={() => handleNavigate('SUPER_ADMIN')}
                />
              ) : (
                <>
                  {renderSidebarItems()}
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-200/70">
              <button
                onClick={onLogout}
                className="w-full py-4 rounded-[1.25rem] flex items-center justify-center gap-2 font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:-translate-y-0.5 transition-all duration-300 ease-out border border-slate-200"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative bg-transparent">
        <div className="w-full px-3 py-4 md:p-8 md:pt-24 max-w-[1600px] mx-auto pb-32 md:pb-8 relative z-10">
          <div key={currentView} className="motion-page">
            {children}
          </div>
        </div>

        {/* Branding Watermark - Single Angle */}
        <div className="fixed bottom-6 right-8 pointer-events-none z-50 opacity-20">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">vet nexus</span>
        </div>
      </main>
    </div>
  );
};
