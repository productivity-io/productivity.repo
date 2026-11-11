import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  CalendarCheck,
  Clock,
  BookOpen,
  Award,
  Briefcase,
  Bus,
  PhoneCall,
  HelpCircle,
  FileCheck2,
  Calendar,
  Library,
  MessageSquare,
  UserCheck,
  Users,
  BarChart3,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldAlert,
  Sparkles,
  CheckCheck,
  Trash2,
  Menu,
  X,
  GraduationCap,
  PlusCircle,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth, UserRole } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { CommandPalette } from '../ui/CommandPalette';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    category: 'Core Workspace',
    items: [
      { label: 'Dashboard Overview', path: '/dashboard', icon: LayoutDashboard, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Announcements & Alerts', path: '/announcements', icon: Megaphone, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Attendance Portal', path: '/attendance', icon: CalendarCheck, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Class Timetable', path: '/timetable', icon: Clock, roles: ['student', 'teacher', 'coordinator', 'principal'] },
    ],
  },
  {
    category: 'Academics & Growth',
    items: [
      { label: 'Homework & Assignments', path: '/assignments', icon: BookOpen, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Examinations & Results', path: '/examinations', icon: Award, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Student Portfolios', path: '/portfolio', icon: Briefcase, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Students & Faculty', path: '/directory', icon: Users, roles: ['teacher', 'coordinator', 'principal'] },
    ],
  },
  {
    category: 'Campus Operations',
    items: [
      { label: 'Communication Hub', path: '/communication', icon: MessageSquare, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Leave Requests', path: '/leave-requests', icon: FileCheck2, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Calendar & Events', path: '/calendar', icon: Calendar, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Digital Library', path: '/library', icon: Library, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Campus Transport', path: '/transport', icon: Bus, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Lost & Found', path: '/lost-and-found', icon: HelpCircle, roles: ['student', 'teacher', 'coordinator', 'principal'] },
      { label: 'Quick Contacts', path: '/contacts', icon: PhoneCall, roles: ['student', 'teacher', 'coordinator', 'principal'] },
    ],
  },
  {
    category: 'Governance & Account',
    items: [
      { label: 'Reports & Analytics', path: '/reports', icon: BarChart3, roles: ['coordinator', 'principal', 'teacher'] },
      { label: 'Profile & Settings', path: '/settings', icon: Settings, roles: ['student', 'teacher', 'coordinator', 'principal'] },
    ],
  },
];

const ROLE_LABELS: Record<UserRole, { title: string; badgeClass: string }> = {
  student: { title: 'Student Portal', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  teacher: { title: 'Faculty Workspace', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  coordinator: { title: 'Academic Coordinator', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  principal: { title: 'Principal Executive', badgeClass: 'bg-slate-900 text-white border-slate-800' },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, academicYear, setAcademicYear, academicYears, schoolSettings, login, logout, toasts, dismissToast, showToast } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; subtitle: string; category: string; url: string }>>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCategory, setNotifCategory] = useState<string>('all');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [emergencyBanner, setEmergencyBanner] = useState<any | null>(null);
  const [emergencyExpanded, setEmergencyExpanded] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const fetchNotificationsAndEmergency = useCallback(async () => {
    if (!user) return;
    try {
      const [notifData, annData] = await Promise.all([
        apiFetch('/api/notifications'),
        apiFetch('/api/announcements'),
      ]);
      setNotifications(notifData.notifications || []);
      setUnreadCount(notifData.unreadCount || 0);
      const activeEmergency = (annData.announcements || []).find((a: any) => a.isEmergency && a.approvalStatus === 'approved');
      setEmergencyBanner(activeEmergency || null);
    } catch {
      // ignore background error
    }
  }, [user]);

  useEffect(() => {
    fetchNotificationsAndEmergency();
  }, [fetchNotificationsAndEmergency, location.pathname]);

  // Global keyboard shortcut Cmd+K / Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileMenuOpen(false);
        setQuickActionsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!user) return null;

  const roleMeta = ROLE_LABELS[user.role];

  const handleMarkNotificationRead = async (id: number, url: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH', body: JSON.stringify({ isRead: true }) });
      fetchNotificationsAndEmergency();
      setNotifOpen(false);
      if (url) navigate(url);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    fetchNotificationsAndEmergency();
    showToast('Notifications Updated', 'All notifications marked as read.', 'success');
  };

  const handleClearNotifications = async () => {
    await apiFetch('/api/notifications/clear', { method: 'DELETE' });
    fetchNotificationsAndEmergency();
    showToast('Notifications Cleared', 'Notification history cleared.');
  };

  const handleQuickRoleSwitch = async (demoUsername: string) => {
    try {
      setProfileMenuOpen(false);
      await login(demoUsername, 'password123', true);
      navigate('/dashboard');
    } catch (err: any) {
      showToast('Role Switch Error', err.message, 'error');
    }
  };

  // Current breadcrumb name
  const currentNavItem = NAV_GROUPS.flatMap(g => g.items).find(i => location.pathname.startsWith(i.path));
  const pageTitle = currentNavItem?.label || 'Dashboard Overview';

  const filteredNotifications = notifications.filter(n =>
    notifCategory === 'all' ? true : notifCategory === 'unread' ? !n.isRead : n.category === notifCategory
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/80 transition-all duration-200 select-none shrink-0 z-30 ${
          collapsed ? 'w-20' : 'w-68'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shadow-xs shrink-0 tracking-tight">
              MCB
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="font-heading font-bold text-sm text-slate-900 tracking-tight truncate flex items-center gap-1.5">
                  <span>MCB Veritas</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="System Operational" />
                </div>
                <div className="text-[11px] font-medium text-slate-500 truncate">
                  {roleMeta.title}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => item.roles.includes(user.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.category}>
                {!collapsed && (
                  <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.category}
                  </div>
                )}
                <div className="space-y-1">
                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-700 rounded-r-full" />
                            )}
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-700'
                              }`}
                            />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom User Compact Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center shrink-0">
              {user.fullName
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{user.fullName}</div>
                <div className="text-[11px] font-mono text-slate-500 truncate">{user.schoolId}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-full bg-white h-full flex flex-col shadow-xl z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-mono font-bold text-xs">
                  MCB
                </div>
                <div>
                  <span className="font-heading font-bold text-sm text-slate-900 block leading-tight">MCB Veritas</span>
                  <span className="text-[10px] text-slate-500 font-medium">{roleMeta.title}</span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
              {NAV_GROUPS.map(group => {
                const visible = group.items.filter(i => i.roles.includes(user.role));
                if (!visible.length) return null;
                return (
                  <div key={group.category}>
                    <div className="px-3 mb-1 text-[11px] font-semibold uppercase text-slate-400">{group.category}</div>
                    {visible.map(item => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                              isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                            }`
                          }
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          {/* Left: Mobile Trigger + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.badgeClass}`}>
                {roleMeta.title}
              </span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-heading font-semibold text-slate-900 truncate text-base">
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Center/Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/70 text-slate-500 text-xs font-medium border border-slate-200/80 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Search students, assignments, books...</span>
              <span className="md:hidden">Search</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white text-slate-600 rounded border border-slate-200">
                ⌘K
              </kbd>
            </button>

            {/* Academic Year Selector */}
            <select
              aria-label="Academic Year"
              value={academicYear}
              onChange={e => {
                setAcademicYear(e.target.value);
                showToast('Academic Session Switched', `Viewing records for ${e.target.value}`);
              }}
              className="hidden xl:block px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {academicYears.map(yr => (
                <option key={yr.id} value={yr.name}>
                  AY {yr.name} {yr.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>

            {/* Quick Actions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQuickActionsOpen(prev => !prev);
                  setNotifOpen(false);
                  setProfileMenuOpen(false);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Quick Action</span>
              </button>

              {quickActionsOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-40">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {roleMeta.title} Shortcuts
                  </div>
                  {user.role === 'student' && (
                    <>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/assignments'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Submit Homework Assignment</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/leave-requests'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Apply for Student Leave</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/portfolio'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Add Portfolio Achievement</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/communication'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Message a Subject Teacher</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </>
                  )}
                  {user.role === 'teacher' && (
                    <>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/attendance'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Mark Class Attendance</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/assignments'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Create New Assignment</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/examinations'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Enter Examination Marks</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/portfolio'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Provide Student Feedback</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </>
                  )}
                  {(user.role === 'coordinator' || user.role === 'principal') && (
                    <>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/announcements'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>{user.role === 'principal' ? 'Publish Emergency Alert' : 'Draft Announcement'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/directory'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Manage Students & Faculty</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => { setQuickActionsOpen(false); navigate('/reports'); }}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>Export Institutional Reports</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Unified Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(prev => !prev);
                  setProfileMenuOpen(false);
                  setQuickActionsOpen(false);
                }}
                aria-label="Notifications"
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-semibold text-sm text-slate-900">Notification Center</h3>
                      <p className="text-[11px] text-slate-500">{unreadCount} unread updates</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        title="Mark all as read"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 text-xs flex items-center gap-1"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleClearNotifications}
                        title="Clear all notifications"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
                    {['all', 'unread', 'emergency', 'assignment', 'grading', 'attendance', 'announcement'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNotifCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize whitespace-nowrap transition-colors ${
                          notifCategory === cat
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-10 px-4 text-center text-xs text-slate-400">
                        No notifications in this category.
                      </div>
                    ) : (
                      filteredNotifications.map(n => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleMarkNotificationRead(n.id, n.linkUrl)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                            !n.isRead ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              n.priority === 'critical'
                                ? 'bg-red-600'
                                : !n.isRead
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900 truncate">{n.title}</span>
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {n.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile & Fast Role Switcher Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(prev => !prev);
                  setNotifOpen(false);
                  setQuickActionsOpen(false);
                }}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center">
                  {user.fullName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">{user.fullName}</div>
                  <div className="text-[10px] text-slate-500 capitalize">{user.role}</div>
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-40">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900">{user.fullName}</div>
                    <div className="text-[11px] text-slate-500">{user.email}</div>
                    <div className="mt-1 inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      ID: {user.schoolId}
                    </div>
                  </div>

                  {/* Instant demo role switching is development-only. */}
                  {import.meta.env.DEV && (
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>Instant Demo Role Switcher</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: 'Student (Aarav)', username: 'student1', role: 'student' },
                        { label: 'Teacher (Mercer)', username: 'teacher1', role: 'teacher' },
                        { label: 'Coordinator', username: 'coordinator1', role: 'coordinator' },
                        { label: 'Principal (Vance)', username: 'principal', role: 'principal' },
                      ].map(demo => (
                        <button
                          key={demo.username}
                          type="button"
                          onClick={() => handleQuickRoleSwitch(demo.username)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-medium text-left truncate border transition-colors ${
                            user.role === demo.role
                              ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {demo.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  )}

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4 text-slate-400" />
                      <span>Profile & Account Preferences</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Prominent Emergency Alert Banner */}
        {emergencyBanner && (
          <div className="bg-red-600 text-white px-4 lg:px-8 py-2.5 shadow-sm no-print">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
                <div className="text-xs sm:text-sm">
                  <span className="font-bold uppercase tracking-wide bg-white text-red-700 px-1.5 py-0.5 rounded text-[10px] mr-2">
                    Critical Alert
                  </span>
                  <span className="font-semibold">{emergencyBanner.title}:</span>{' '}
                  <span className="text-red-50">{emergencyBanner.content}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {emergencyBanner.emergencyInstructions && (
                  <button
                    type="button"
                    onClick={() => setEmergencyExpanded(prev => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-xs font-semibold border border-red-400/40 whitespace-nowrap"
                  >
                    {emergencyExpanded ? 'Hide Protocol' : 'Emergency Protocol'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEmergencyBanner(null)}
                  className="p-1 rounded hover:bg-red-700 text-red-100"
                  title="Dismiss banner for this session"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {emergencyExpanded && emergencyBanner.emergencyInstructions && (
              <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-red-500/50 text-xs text-red-50 whitespace-pre-line">
                <strong className="block mb-1 text-white">Mandatory Safety Instructions:</strong>
                {emergencyBanner.emergencyInstructions}
              </div>
            )}
          </div>
        )}

        {/* Main Workspace Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Search Command Palette Modal */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Toast Notification Stack */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none no-print">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-lg border flex items-start justify-between gap-3 transition-all ${
              t.variant === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : t.variant === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t.title}</div>
              {t.description && <div className="text-xs opacity-85 mt-0.5">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="opacity-60 hover:opacity-100 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

