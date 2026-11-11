import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Megaphone,
  CalendarCheck,
  Clock,
  BookOpen,
  Award,
  Briefcase,
  Users,
  Bus,
  PhoneCall,
  HelpCircle,
  FileCheck2,
  Calendar,
  Library,
  MessageSquare,
  BarChart3,
  Settings,
  UserCheck,
  ArrowRight,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth, UserRole } from '../../context/AuthContext';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Switch Role';
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  roles?: UserRole[];
}

export function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const switchDemoRole = async (username: string) => {
    try {
      await login(username, 'password123', true);
      navigate('/dashboard');
      onClose();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = [
    // Core navigation
    {
      id: 'nav-dashboard',
      title: 'Dashboard Overview',
      category: 'Navigation',
      icon: <LayoutDashboard className="w-4 h-4 text-slate-500" />,
      action: () => { navigate('/dashboard'); onClose(); },
      keywords: ['home', 'overview', 'stats'],
    },
    {
      id: 'nav-announcements',
      title: 'Announcements & Emergency Alerts',
      category: 'Navigation',
      icon: <Megaphone className="w-4 h-4 text-blue-500" />,
      action: () => { navigate('/announcements'); onClose(); },
      keywords: ['news', 'alerts', 'circulars'],
    },
    {
      id: 'nav-attendance',
      title: 'Attendance Portal',
      category: 'Navigation',
      icon: <CalendarCheck className="w-4 h-4 text-emerald-500" />,
      action: () => { navigate('/attendance'); onClose(); },
      keywords: ['present', 'absent', 'leaves', 'records'],
    },
    {
      id: 'nav-timetable',
      title: 'Class Timetable',
      category: 'Navigation',
      icon: <Clock className="w-4 h-4 text-purple-500" />,
      action: () => { navigate('/timetable'); onClose(); },
      keywords: ['schedule', 'periods', 'classes'],
    },
    {
      id: 'nav-assignments',
      title: 'Homework & Assignments',
      category: 'Navigation',
      icon: <BookOpen className="w-4 h-4 text-amber-500" />,
      action: () => { navigate('/assignments'); onClose(); },
      keywords: ['tasks', 'submissions', 'homework'],
    },
    {
      id: 'nav-examinations',
      title: 'Examinations & Report Cards',
      category: 'Navigation',
      icon: <Award className="w-4 h-4 text-rose-500" />,
      action: () => { navigate('/examinations'); onClose(); },
      keywords: ['exams', 'marks', 'grades', 'report card'],
    },
    {
      id: 'nav-portfolio',
      title: 'Student Portfolios',
      category: 'Navigation',
      icon: <Briefcase className="w-4 h-4 text-indigo-500" />,
      action: () => { navigate('/portfolio'); onClose(); },
      keywords: ['achievements', 'awards', 'cv'],
    },
    {
      id: 'nav-directory',
      title: 'Students & Faculty Directory',
      category: 'Navigation',
      icon: <Users className="w-4 h-4 text-teal-500" />,
      action: () => { navigate('/directory'); onClose(); },
      keywords: ['students', 'staff', 'teachers', 'roster'],
      roles: ['teacher', 'coordinator', 'principal'],
    },
    {
      id: 'nav-communication',
      title: 'Communication Hub',
      category: 'Navigation',
      icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
      action: () => { navigate('/communication'); onClose(); },
      keywords: ['messages', 'chat', 'requests'],
    },
    {
      id: 'nav-leave',
      title: 'Leave Requests',
      category: 'Navigation',
      icon: <FileCheck2 className="w-4 h-4 text-amber-500" />,
      action: () => { navigate('/leave-requests'); onClose(); },
      keywords: ['apply leave', 'sick leave', 'vacation'],
    },
    {
      id: 'nav-calendar',
      title: 'Academic Calendar & Events',
      category: 'Navigation',
      icon: <Calendar className="w-4 h-4 text-rose-500" />,
      action: () => { navigate('/calendar'); onClose(); },
      keywords: ['holidays', 'events', 'schedule'],
    },
    {
      id: 'nav-library',
      title: 'Digital Library Catalogue',
      category: 'Navigation',
      icon: <Library className="w-4 h-4 text-indigo-500" />,
      action: () => { navigate('/library'); onClose(); },
      keywords: ['books', 'issue', 'catalogue'],
    },
    {
      id: 'nav-transport',
      title: 'Campus Transport & Routes',
      category: 'Navigation',
      icon: <Bus className="w-4 h-4 text-amber-500" />,
      action: () => { navigate('/transport'); onClose(); },
      keywords: ['bus', 'routes', 'driver', 'pickup'],
    },
    {
      id: 'nav-lostfound',
      title: 'Campus Lost & Found',
      category: 'Navigation',
      icon: <HelpCircle className="w-4 h-4 text-teal-500" />,
      action: () => { navigate('/lost-and-found'); onClose(); },
      keywords: ['lost', 'found', 'claims', 'items'],
    },
    {
      id: 'nav-contacts',
      title: 'Emergency & Directory Contacts',
      category: 'Navigation',
      icon: <PhoneCall className="w-4 h-4 text-emerald-500" />,
      action: () => { navigate('/contacts'); onClose(); },
      keywords: ['helpline', 'emergency', 'phone', 'support'],
    },
    {
      id: 'nav-reports',
      title: 'Reports & Analytics',
      category: 'Navigation',
      icon: <BarChart3 className="w-4 h-4 text-purple-500" />,
      action: () => { navigate('/reports'); onClose(); },
      keywords: ['analytics', 'performance', 'charts'],
      roles: ['coordinator', 'principal', 'teacher'],
    },
    {
      id: 'nav-settings',
      title: 'Account Settings & Preferences',
      category: 'Navigation',
      icon: <Settings className="w-4 h-4 text-slate-500" />,
      action: () => { navigate('/settings'); onClose(); },
      keywords: ['profile', 'password', 'notifications'],
    },

    // Demo role switching
    {
      id: 'role-student',
      title: 'Switch View: Student Portal (Aarav Sharma)',
      category: 'Switch Role',
      icon: <UserCheck className="w-4 h-4 text-blue-500" />,
      action: () => switchDemoRole('student1'),
      keywords: ['student', 'switch', 'role', 'demo'],
    },
    {
      id: 'role-teacher',
      title: 'Switch View: Faculty Workspace (Julian Mercer)',
      category: 'Switch Role',
      icon: <UserCheck className="w-4 h-4 text-emerald-500" />,
      action: () => switchDemoRole('teacher1'),
      keywords: ['teacher', 'faculty', 'switch', 'role', 'demo'],
    },
    {
      id: 'role-coordinator',
      title: 'Switch View: Academic Coordinator (Marcus Sterling)',
      category: 'Switch Role',
      icon: <UserCheck className="w-4 h-4 text-indigo-500" />,
      action: () => switchDemoRole('coordinator1'),
      keywords: ['coordinator', 'academic', 'switch', 'role', 'demo'],
    },
    {
      id: 'role-principal',
      title: 'Switch View: Principal Executive (Dr. Eleanor Vance)',
      category: 'Switch Role',
      icon: <UserCheck className="w-4 h-4 text-slate-900" />,
      action: () => switchDemoRole('principal'),
      keywords: ['principal', 'executive', 'admin', 'switch', 'role', 'demo'],
    },
  ];

  // Filter items by user role & search query
  const filtered = items.filter(item => {
    if (item.roles && user && !item.roles.includes(user.role)) return false;
    if (!query.trim()) return true;
    const cleanQ = query.toLowerCase().trim();
    const titleMatch = item.title.toLowerCase().includes(cleanQ);
    const keywordMatch = item.keywords?.some(k => k.toLowerCase().includes(cleanQ));
    const catMatch = item.category.toLowerCase().includes(cleanQ);
    return titleMatch || keywordMatch || catMatch;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page name, or search..."
            className="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-slate-400 text-slate-800"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs"
          >
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono border border-slate-200 text-slate-500">
              ESC
            </kbd>
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100/50">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching pages or actions found for "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                  idx === selectedIndex
                    ? 'bg-blue-50/70 text-blue-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      idx === selectedIndex
                        ? 'bg-white border-blue-200 text-blue-600 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {item.icon}
                  </div>
                  <span className="font-medium truncate">{item.title}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {item.category}
                  </span>
                  {idx === selectedIndex && (
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600 animate-in slide-in-from-left-1 duration-150" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-white rounded border border-slate-200 font-mono text-[9px] text-slate-600 mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white rounded border border-slate-200 font-mono text-[9px] text-slate-600 mr-1">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>MCB Quick Command</span>
          </div>
        </div>
      </div>
    </div>
  );
}
