import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart3,
  Settings,
  Download,
  Printer,
  Database,
  Lock,
  Bell,
  Shield,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function ReportsSettingsPage() {
  const { user, refreshUser, showToast } = useAuth();
  const location = useLocation();
  const isReportsRoute = location.pathname.startsWith('/reports');

  const [activeSection, setActiveSection] = useState<'profile' | 'reports' | 'school_settings'>(
    isReportsRoute ? 'reports' : 'profile'
  );
  const [directoryData, setDirectoryData] = useState<any | null>(null);
  const [settingsData, setSettingsData] = useState<any | null>(null);

  // Profile form state
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.roleDetails?.address || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [prefs, setPrefs] = useState(
    user?.preferences || { emailAlerts: true, inAppAlerts: true, emergencySound: true, assignmentReminders: true }
  );

  // School settings state
  const [schoolName, setSchoolName] = useState('Veritas Collegiate Academy');
  const [tagline, setTagline] = useState('Excellence in Inquiry, Integrity & Innovation');

  useEffect(() => {
    setActiveSection(location.pathname.startsWith('/reports') ? 'reports' : 'profile');
  }, [location.pathname]);

  const loadData = useCallback(async () => {
    try {
      const sRes = await apiFetch('/api/settings');
      setSettingsData(sRes);
      if (sRes.settings) {
        setSchoolName(sRes.settings.schoolName);
        setTagline(sRes.settings.tagline);
      }
      if (user?.role !== 'student') {
        const dRes = await apiFetch('/api/admin/directory');
        setDirectoryData(dRes);
      }
    } catch {
      // ignore
    }
  }, [user?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ phone, address, preferences: prefs }),
      });
      await refreshUser();
      showToast('Profile Saved', 'Contact details and notification preferences updated.', 'success');
    } catch (err: any) {
      showToast('Failed to update profile', err.message, 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password Updated', 'Your local account password has been changed.', 'success');
    } catch (err: any) {
      showToast('Password update failed', err.message, 'error');
    }
  };

  const handleExportCSV = (type: 'students' | 'staff' | 'subjects') => {
    let csv = '';
    if (type === 'students' && directoryData?.students) {
      csv = 'School ID,Admission No,Full Name,Class,Section,Attendance %,Academic Mean %\n';
      for (const s of directoryData.students) {
        csv += `"${s.schoolId}","${s.admissionNo}","${s.fullName}","${s.className}","${s.sectionName}",${s.attendancePercentage},${s.avgAcademicPercentage}\n`;
      }
    } else if (type === 'staff' && directoryData?.teachers) {
      csv = 'Employee Code,Full Name,Department,Designation,Workload Hours\n';
      for (const t of directoryData.teachers) {
        csv += `"${t.employeeCode}","${t.fullName}","${t.department}","${t.designation}",${t.workloadHours}\n`;
      }
    } else {
      csv = 'Code,Subject Name,Department,Syllabus Progress %\n';
      for (const sub of directoryData?.subjects || []) {
        csv += `"${sub.code}","${sub.name}","${sub.department}",${sub.curriculumProgress}\n`;
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veritas_${type}_report_2026.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV Report Exported', `Downloaded veritas_${type}_report_2026.csv`, 'success');
  };

  const handleBackupDatabase = async () => {
    try {
      const snapshot = await apiFetch('/api/settings/backup');
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veritas_sqlite_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Local Backup Exported', 'Full SQLite snapshot saved as JSON.', 'success');
      loadData();
    } catch (err: any) {
      showToast('Backup failed', err.message, 'error');
    }
  };

  const handleResetDemoDatabase = async () => {
    try {
      await apiFetch('/api/settings/reset-seed', { method: 'POST' });
      showToast('Database Restored to Seed Baseline', 'All sample records refreshed.', 'success');
      loadData();
    } catch (err: any) {
      showToast('Reset failed', err.message, 'error');
    }
  };

  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ schoolName, tagline }),
      });
      await refreshUser();
      showToast('Institutional Settings Saved', 'School branding and configuration updated.', 'success');
    } catch (err: any) {
      showToast('Save failed', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            {activeSection === 'reports' ? (
              <>
                <BarChart3 className="w-5 h-5 text-blue-700" />
                <span>Institutional Reports, Analytics & Data Exports</span>
              </>
            ) : (
              <>
                <Settings className="w-5 h-5 text-blue-700" />
                <span>Account Profile, Preferences & Institutional Settings</span>
              </>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage personal preferences, export CSV/PDF analytics, and configure school-wide governance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSection('profile')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
              activeSection === 'profile' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            My Profile & Security
          </button>
          {user?.role !== 'student' && (
            <button
              onClick={() => setActiveSection('reports')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
                activeSection === 'reports' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Reports & CSV Exports
            </button>
          )}
          {user?.role === 'principal' && (
            <button
              onClick={() => setActiveSection('school_settings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
                activeSection === 'school_settings' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              School Governance & Backup
            </button>
          )}
        </div>
      </div>

      {/* 1. PROFILE & ACCOUNT PREFERENCES */}
      {activeSection === 'profile' && user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">
              Personal Information & Notification Preferences
            </h3>

            {/* Read-only School Assigned Academic Info for Students */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6 text-xs">
              <div>
                <div className="text-slate-400 uppercase font-semibold">Full Name</div>
                <div className="font-bold text-slate-900 mt-0.5">{user.fullName}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase font-semibold">Official ID</div>
                <div className="font-mono font-bold text-blue-700 mt-0.5">{user.schoolId}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase font-semibold">Assigned Role</div>
                <div className="font-bold text-slate-900 capitalize mt-0.5">{user.role}</div>
              </div>
              {user.role === 'student' && user.roleDetails && (
                <>
                  <div>
                    <div className="text-slate-400 uppercase font-semibold">Class & Section (Locked)</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {user.roleDetails.className} — {user.roleDetails.sectionName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 uppercase font-semibold">Admission & Roll No (Locked)</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {user.roleDetails.admissionNo} (#{user.roleDetails.rollNo})
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 uppercase font-semibold">Parent / Guardian</div>
                    <div className="font-bold text-slate-900 mt-0.5">{user.roleDetails.guardianName}</div>
                  </div>
                </>
              )}
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                {user.role === 'student' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  <span>Notification Channel Preferences</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {[
                    { key: 'inAppAlerts', label: 'In-App Real-Time Notifications' },
                    { key: 'assignmentReminders', label: 'Assignment & Exam Deadline Reminders' },
                    { key: 'emergencySound', label: 'Critical Emergency Alert Banner Priority' },
                    { key: 'emailAlerts', label: 'Daily Summary Digest' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean((prefs as any)[item.key])}
                        onChange={e => setPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-700"
                      />
                      <span className="font-medium text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold">
                Save Profile & Preferences
              </button>
            </form>
          </div>

          {/* Password Management */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-700" />
              <span>Password Management</span>
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (Min 6 chars)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. REPORTS & EXPORTS */}
      {activeSection === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">Student Academic & Attendance Report</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Complete roster with class-wise attendance percentages and aggregate examination averages.
                </p>
              </div>
              <button
                onClick={() => handleExportCSV('students')}
                className="mt-4 py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Student CSV</span>
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">Faculty Workload & Activity Report</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Teacher directory, department allocations, weekly teaching hours, and assigned sections.
                </p>
              </div>
              <button
                onClick={() => handleExportCSV('staff')}
                className="mt-4 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Faculty CSV</span>
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">Printable Institutional Summary PDF</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Formatted executive report suitable for board review or archival printing.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="mt-4 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>

          {directoryData?.students && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-heading font-bold text-base text-slate-900 mb-4">
                Student Attendance vs. Academic Performance Matrix
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={directoryData.students} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="fullName" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="attendancePercentage" name="Attendance %" fill="#059669" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="avgAcademicPercentage" name="Academic Average %" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. PRINCIPAL SCHOOL GOVERNANCE & LOCAL BACKUP */}
      {activeSection === 'school_settings' && user?.role === 'principal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-700" />
              <span>Institutional Branding & Configuration</span>
            </h3>
            <form onSubmit={handleSaveSchoolSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institution Name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Motto / Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                Save School Configuration
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="font-heading font-bold text-sm text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-700" />
                <span>Local SQLite Database Backup & Demo Reset</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Export a complete JSON snapshot of all local tables or reset the local database back to the clean seeded state.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleBackupDatabase}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Local Backup Snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDemoDatabase}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Seeded Demo Data</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">
              System Audit Logs ({settingsData?.auditLogs?.length || 0})
            </h3>
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {(settingsData?.auditLogs || []).map((log: any) => (
                <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{log.actorName} ({log.actorRole})</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1">{log.summary}</p>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

