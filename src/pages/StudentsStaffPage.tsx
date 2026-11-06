import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Layers,
  KeyRound,
  Power,
  Briefcase,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function StudentsStaffPage() {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useEchoViewState('tab');
  const [search, setSearch] = useEchoViewState('search');
  const [classFilter, setClassFilter] = useState('all');

  // Enroll Student Modal
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [stuName, setStuName] = useState('');
  const [stuEmail, setStuEmail] = useState('');
  const [stuClassSection, setStuClassSection] = useState('1-1');
  const [stuGuardian, setStuGuardian] = useState('');
  const [stuPhone, setStuPhone] = useState('');

  // Add Staff Modal
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffRole, setStaffRole] = useState('teacher');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDept, setStaffDept] = useState('Mathematics & Quantitative Sciences');
  const [staffDesignation, setStaffDesignation] = useState('Senior Faculty');

  // Add Subject Modal
  const [subjOpen, setSubjOpen] = useState(false);
  const [subjCode, setSubjCode] = useState('');
  const [subjName, setSubjName] = useState('');
  const [subjDept, setSubjDept] = useState('Sciences');

  const loadDirectory = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/directory');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load directory', err.message, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const [classId, sectionId] = stuClassSection.split('-').map(Number);
      const res = await apiFetch('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          fullName: stuName,
          email: stuEmail,
          classId,
          sectionId,
          guardianName: stuGuardian,
          guardianPhone: stuPhone,
        }),
      });
      setEnrollOpen(false);
      setStuName('');
      setStuEmail('');
      showToast('Student Enrolled', `Assigned ID: ${res.schoolId} (Default password: password123)`, 'success');
      loadDirectory();
    } catch (err: any) {
      showToast('Enrollment failed', err.message, 'error');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          role: staffRole,
          fullName: staffName,
          email: staffEmail,
          department: staffDept,
          designation: staffDesignation,
        }),
      });
      setStaffOpen(false);
      setStaffName('');
      setStaffEmail('');
      showToast('Staff Profile Created', `Assigned Code: ${res.schoolId}`, 'success');
      loadDirectory();
    } catch (err: any) {
      showToast('Failed to add staff', err.message, 'error');
    }
  };

  const handleToggleUserStatus = async (userId: number, currentActive: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      showToast('Account Status Updated', `User account ${!currentActive ? 'activated' : 'deactivated'}.`, 'success');
      loadDirectory();
    } catch (err: any) {
      showToast('Update failed', err.message, 'error');
    }
  };

  const handleResetPassword = async (userId: number, name: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ resetPassword: 'password123' }),
      });
      showToast('Password Reset', `Reset ${name}’s password to "password123".`, 'success');
    } catch (err: any) {
      showToast('Reset failed', err.message, 'error');
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/subjects', {
        method: 'POST',
        body: JSON.stringify({ code: subjCode, name: subjName, department: subjDept }),
      });
      setSubjOpen(false);
      setSubjCode('');
      setSubjName('');
      showToast('Subject Added', 'Curriculum directory updated.', 'success');
      loadDirectory();
    } catch (err: any) {
      showToast('Failed to add subject', err.message, 'error');
    }
  };

  if (!data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const canManage = user?.role === 'principal' || user?.role === 'coordinator';
  const filteredStudents = (data.students || []).filter((s: any) => {
    if (classFilter !== 'all' && String(s.classId) !== classFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.fullName.toLowerCase().includes(q) || s.schoolId.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-700" />
            <span>
              {user?.role === 'teacher'
                ? 'My Classes, Student Supervision & Records'
                : 'Institutional Student, Faculty & Academic Administration'}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete student records, faculty workload oversight, account security controls, and curriculum structure.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEnrollOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll Student</span>
            </button>
            {user?.role === 'principal' && (
              <button
                onClick={() => setStaffOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Faculty / Coordinator</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setTab('students')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'students' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Student Directory & Supervision ({data.students?.length || 0})
        </button>
        <button
          onClick={() => setTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'staff' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Teachers & Coordinators ({(data.teachers?.length || 0) + (data.coordinators?.length || 0)})
        </button>
        <button
          onClick={() => setTab('academics')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold ${
            tab === 'academics' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Classes, Sections & Subjects
        </button>
      </div>

      {tab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search students by name, School ID, or Admission No..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
            >
              <option value="all">All Grades</option>
              {(data.classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div tabIndex={0} role="region" aria-label="Student directory table" className="table-wrapper">
              <table className="text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Student Name</th>
                    <th className="py-3 px-4 font-semibold">ID / Roll</th>
                    <th className="py-3 px-4 font-semibold">Class & Section</th>
                    <th className="py-3 px-4 font-semibold">Attendance</th>
                    <th className="py-3 px-4 font-semibold">Academic Mean</th>
                    <th className="py-3 px-4 font-semibold">Conduct / Supervision Note</th>
                    <th className="py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((stu: any) => (
                    <tr key={stu.id} className="hover:bg-slate-50/70">
                      <th className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{stu.fullName}</div>
                        <div className="text-[11px] font-normal text-slate-500">Guardian: {stu.guardianName} ({stu.guardianPhone})</div>
                      </th>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {stu.schoolId} • #{stu.rollNo}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs">
                          {stu.className}-{stu.sectionName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">{stu.attendancePercentage}%</td>
                      <td className="py-3.5 px-4 font-bold text-blue-700">{stu.avgAcademicPercentage}%</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">{stu.disciplinaryNotes}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigate('/portfolio')}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600"
                            title="Inspect Portfolio"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>
                          {user?.role === 'principal' && (
                            <>
                              <button
                                onClick={() => handleResetPassword(stu.userId, stu.fullName)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600"
                                title="Reset Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(stu.userId, stu.isActive)}
                                className={`p-1.5 rounded-lg ${
                                  stu.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}
                                title={stu.isActive ? 'Deactivate Account' : 'Activate Account'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data.teachers || []).map((t: any) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {t.employeeCode} • Faculty
                  </span>
                  <span className="text-xs text-slate-500">Workload: {t.workloadHours} hrs/wk</span>
                </div>
                <h3 className="font-heading font-bold text-base text-slate-900">{t.fullName}</h3>
                <div className="text-xs font-semibold text-blue-700">{t.designation}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t.department} • {t.qualification}</div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">Assigned Classes & Subjects</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(t.assignedMappings || []).map((m: any) => (
                      <span key={m.id} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {m.className}-{m.sectionName}: {m.subjectName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {user?.role === 'principal' && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleResetPassword(t.userId, t.fullName)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => handleToggleUserStatus(t.userId, t.isActive)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      t.isActive ? 'bg-red-50 text-red-700' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {t.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'academics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-700" />
                <span>Subjects & Curriculum Syllabus Completion</span>
              </h3>
              {canManage && (
                <button
                  onClick={() => setSubjOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-blue-700 text-white text-xs font-semibold"
                >
                  + Add Subject
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data.subjects || []).map((s: any) => (
                <div key={s.id} className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-700">{s.code}</span>
                    <span className="text-xs font-semibold text-slate-500">{s.department}</span>
                  </div>
                  <div className="font-heading font-bold text-sm text-slate-900 mt-1">{s.name}</div>
                  <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span>Syllabus Progress</span>
                      <span>{s.curriculumProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${s.curriculumProgress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {enrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setEnrollOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Enroll New Student</h3>
              <button onClick={() => setEnrollOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEnrollStudent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={stuName}
                  onChange={e => setStuName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Email</label>
                <input
                  type="email"
                  required
                  value={stuEmail}
                  onChange={e => setStuEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Class & Section</label>
                <select
                  value={stuClassSection}
                  onChange={e => setStuClassSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="1-1">Grade 10 — Section A</option>
                  <option value="1-2">Grade 10 — Section B</option>
                  <option value="2-3">Grade 9 — Section A</option>
                  <option value="3-4">Grade 11 — Section A</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    required
                    value={stuGuardian}
                    onChange={e => setStuGuardian(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Phone</label>
                  <input
                    type="tel"
                    required
                    value={stuPhone}
                    onChange={e => setStuPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEnrollOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Create Student Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {staffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setStaffOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Add Faculty or Coordinator</h3>
            <form onSubmit={handleAddStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={staffRole}
                  onChange={e => setStaffRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="teacher">Teacher / Faculty</option>
                  <option value="coordinator">Academic Coordinator</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={e => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={e => setStaffEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  value={staffDept}
                  onChange={e => setStaffDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={staffDesignation}
                  onChange={e => setStaffDesignation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStaffOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {subjOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setSubjOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Add New Curriculum Subject</h3>
            <form onSubmit={handleAddSubject} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Code</label>
                <input
                  type="text"
                  required
                  value={subjCode}
                  onChange={e => setSubjCode(e.target.value)}
                  placeholder="e.g. BIO-107"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subjName}
                  onChange={e => setSubjName(e.target.value)}
                  placeholder="e.g. Molecular Biology & Genetics"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  value={subjDept}
                  onChange={e => setSubjDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubjOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

