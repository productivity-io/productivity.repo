import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileWarning,
  Users,
  Save,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

export function AttendancePage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Student view state
  const [studentTab, setStudentTab] = useEchoViewState('tab');
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrAttId, setCorrAttId] = useState<number>(0);
  const [corrRequestedStatus, setCorrRequestedStatus] = useState('present');
  const [corrReason, setCorrReason] = useState('');

  // Staff view state
  const [selectedClassId, setSelectedClassId] = useState<number>(1);
  const [selectedSectionId, setSelectedSectionId] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-05');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [rollCallMap, setRollCallMap] = useState<Record<number, { status: string; remarks: string }>>({});
  const [savingRollCall, setSavingRollCall] = useState(false);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/attendance');
      setData(res);

      if (res.students) {
        const initialMap: Record<number, { status: string; remarks: string }> = {};
        for (const stu of res.students) {
          const existing = (res.records || []).find(
            (r: any) =>
              r.studentId === stu.id &&
              r.date === selectedDate &&
              (selectedSubjectId ? r.subjectId === Number(selectedSubjectId) : r.subjectId === null)
          );
          initialMap[stu.id] = {
            status: existing?.status || 'present',
            remarks: existing?.remarks || '',
          };
        }
        setRollCallMap(initialMap);
      }
    } catch (err: any) {
      showToast('Failed to load attendance', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedSubjectId, showToast]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleBulkStatus = (status: string) => {
    if (!data?.students) return;
    const next: Record<number, { status: string; remarks: string }> = { ...rollCallMap };
    for (const s of data.students) {
      if (s.classId === selectedClassId && s.sectionId === selectedSectionId) {
        next[s.id] = { status, remarks: next[s.id]?.remarks || '' };
      }
    }
    setRollCallMap(next);
  };

  const handleSaveAttendance = async () => {
    if (!data?.students) return;
    setSavingRollCall(true);
    try {
      const classStudents = data.students.filter(
        (s: any) => s.classId === selectedClassId && s.sectionId === selectedSectionId
      );
      const entries = classStudents.map((s: any) => ({
        studentId: s.id,
        status: rollCallMap[s.id]?.status || 'present',
        remarks: rollCallMap[s.id]?.remarks || '',
      }));

      await apiFetch('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          classId: selectedClassId,
          sectionId: selectedSectionId,
          subjectId: selectedSubjectId ? Number(selectedSubjectId) : null,
          entries,
        }),
      });
      showToast('Attendance Saved', `Recorded attendance for ${entries.length} students on ${selectedDate}.`, 'success');
      loadAttendance();
    } catch (err: any) {
      showToast('Failed to save attendance', err.message, 'error');
    } finally {
      setSavingRollCall(false);
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/attendance/correction', {
        method: 'POST',
        body: JSON.stringify({
          attendanceId: corrAttId,
          requestedStatus: corrRequestedStatus,
          reason: corrReason,
        }),
      });
      setCorrOpen(false);
      setCorrReason('');
      showToast('Correction Requested', 'Your class teacher has been notified.', 'success');
      loadAttendance();
    } catch (err: any) {
      showToast('Request failed', err.message, 'error');
    }
  };

  const handleReviewCorrection = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/attendance/correction/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewRemarks: status === 'approved' ? 'Verified and updated in official register.' : 'Insufficient documentation.',
        }),
      });
      showToast(`Request ${status}`, `Attendance correction #${id} ${status}.`, 'success');
      loadAttendance();
    } catch (err: any) {
      showToast('Review failed', err.message, 'error');
    }
  };

  if (loading || !data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  // ==========================================
  // STUDENT ATTENDANCE PORTAL
  // ==========================================
  if (user?.role === 'student') {
    const stu = data.student;
    const dailyRecords = (data.records || []).filter((r: any) => r.subjectId === null);
    const subjectRecords = (data.records || []).filter((r: any) => r.subjectId !== null);
    const presentCount = dailyRecords.filter((r: any) => r.status === 'present').length;
    const lateCount = dailyRecords.filter((r: any) => r.status === 'late').length;
    const excusedCount = dailyRecords.filter((r: any) => r.status === 'excused').length;
    const absentCount = dailyRecords.filter((r: any) => r.status === 'absent').length;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-700" />
              <span>My Attendance Register & Monthly Calendar</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {stu.fullName} ({stu.schoolId}) • {stu.className} — Section {stu.sectionName}
            </p>
          </div>
          <button
            onClick={() => {
              const firstNonPresent = dailyRecords.find((r: any) => r.status !== 'present') || dailyRecords[0];
              if (firstNonPresent) setCorrAttId(firstNonPresent.id);
              setCorrOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <FileWarning className="w-4 h-4" />
            <span>Request Attendance Correction</span>
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 sm:gap-4">
          <MetricCard
            title="Overall Attendance"
            value={`${stu.attendancePercentage}%`}
            iconColor="blue"
            subtitle="Above 85% requirement"
            badge={<Badge variant="success" size="xs">Compliant</Badge>}
          />
          <MetricCard
            title="Present Days"
            value={presentCount}
            iconColor="emerald"
            subtitle="Full sessions verified"
          />
          <MetricCard
            title="Late Arrivals"
            value={lateCount}
            iconColor="amber"
            subtitle="Morning bell delays"
          />
          <MetricCard
            title="Excused / Duty"
            value={excusedCount}
            iconColor="indigo"
            subtitle="Approved school duties"
          />
          <MetricCard
            title="Unexcused Absent"
            value={absentCount}
            iconColor="rose"
            subtitle="Requires medical slip"
            badge={absentCount > 0 ? <Badge variant="danger" size="xs">Attention</Badge> : undefined}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto">
          {[
            { id: 'daily', label: 'Daily Homeroom Register & Calendar' },
            { id: 'subject', label: 'Subject-Wise Period Attendance' },
            { id: 'corrections', label: `Correction Requests (${data.corrections?.length || 0})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setStudentTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                studentTab === t.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {studentTab === 'daily' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Monthly Calendar Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-heading font-bold text-base text-slate-900 mb-3">
                Attendance Heatmap (Oct – Nov 2026)
              </h3>
              <div className="grid grid-cols-4 gap-2.5">
                {dailyRecords.map((r: any) => (
                  <div
                    key={r.id}
                    className={`p-2.5 rounded-xl border text-center ${
                      r.status === 'present'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : r.status === 'late'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : r.status === 'excused'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    <div className="text-[11px] font-mono font-bold">{r.date.slice(5)}</div>
                    <div className="text-[10px] font-semibold uppercase mt-0.5">{r.status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Historical Daily Attendance Log</h3>
              <div tabIndex={0} role="region" aria-label="Daily attendance history" className="table-wrapper">
                <table className="text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Session</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyRecords.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <th className="py-3 px-4 font-mono font-semibold text-slate-900">{r.date}</th>
                        <td className="py-3 px-4 text-slate-600">Daily Homeroom</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                              r.status === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : r.status === 'excused'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{r.remarks || 'Verified on time'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {studentTab === 'subject' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Subject-Wise Attendance Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {(data.subjects || []).map((sub: any) => (
                <div key={sub.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-blue-700">{sub.code}</span>
                    <span className="text-xs font-bold text-emerald-700">96% Present</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{sub.name}</div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: '96%' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {subjectRecords.map((sr: any) => (
                <div key={sr.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{sr.subjectName}</span> • <span className="font-mono text-slate-500">{sr.date}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800">
                    {sr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {studentTab === 'corrections' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-heading font-bold text-base text-slate-900">Submitted Attendance Correction Requests</h3>
            {(data.corrections || []).map((c: any) => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Date: {c.date} — Change <span className="uppercase text-amber-700">{c.currentStatus}</span> to{' '}
                    <span className="uppercase text-emerald-700">{c.requestedStatus}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{c.reason}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    c.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : c.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Request Correction Modal */}
        {corrOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setCorrOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
              <h3 className="font-heading font-bold text-base text-slate-900 mb-3">Request Attendance Correction</h3>
              <form onSubmit={handleRequestCorrection} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Date / Record</label>
                  <select
                    value={corrAttId}
                    onChange={e => setCorrAttId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {dailyRecords.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.date} — Recorded as {r.status.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Status</label>
                  <select
                    value={corrRequestedStatus}
                    onChange={e => setCorrRequestedStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="present">Present</option>
                    <option value="excused">Excused (School Duty / Medical)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Explanation & Supporting Note</label>
                  <textarea
                    rows={3}
                    required
                    value={corrReason}
                    onChange={e => setCorrReason(e.target.value)}
                    placeholder="Provide reason (e.g. Bus delay slip or Olympiad participation)..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // STAFF ATTENDANCE MANAGEMENT (Teacher, Coordinator, Principal)
  // ==========================================
  const classStudents = (data.students || []).filter(
    (s: any) => s.classId === selectedClassId && s.sectionId === selectedSectionId
  );

  return (
    <div className="space-y-6">
      {/* Header & Roll Call Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-700" />
            <span>Attendance Management & Discrepancy Resolution</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Mark daily or subject-wise attendance, bulk update statuses, and review student correction requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={`${selectedClassId}-${selectedSectionId}`}
            onChange={e => {
              const [c, s] = e.target.value.split('-').map(Number);
              setSelectedClassId(c);
              setSelectedSectionId(s);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
          >
            <option value="1-1">Grade 10 — Section A</option>
            <option value="1-2">Grade 10 — Section B</option>
            <option value="2-3">Grade 9 — Section A</option>
            <option value="3-4">Grade 11 — Section A</option>
          </select>

          <select
            value={selectedSubjectId}
            onChange={e => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
          >
            <option value="">Daily Homeroom Attendance</option>
            {(data.subjects || []).map((sub: any) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} ({sub.code})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
          />
        </div>
      </div>

      {/* Roll Call Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-heading font-bold text-base text-slate-900">
              Student Roll Call Register ({classStudents.length} Students)
            </h3>
            <p className="text-xs text-slate-500">
              Changes synchronize immediately with the Student Dashboard and institutional analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatus('present')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Present</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={savingRollCall}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingRollCall ? 'Saving Register...' : 'Save Attendance Register'}</span>
            </button>
          </div>
        </div>

        <div tabIndex={0} role="region" aria-label="Student attendance roll call table" className="table-wrapper">
          <table className="text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Student</th>
                <th className="py-3 px-4 font-semibold">Roll / ID</th>
                <th className="py-3 px-4 font-semibold">Overall %</th>
                <th className="py-3 px-4 font-semibold">Mark Status ({selectedDate})</th>
                <th className="py-3 px-4 font-semibold">Remarks / Audit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classStudents.map((stu: any) => {
                const current = rollCallMap[stu.id]?.status || 'present';
                return (
                  <tr key={stu.id} className="hover:bg-slate-50/60">
                    <th className="py-3.5 px-4 font-semibold text-slate-900">{stu.fullName}</th>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                      #{stu.rollNo} • {stu.schoolId}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold ${
                          stu.attendancePercentage < 85 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {stu.attendancePercentage}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {(['present', 'absent', 'late', 'excused'] as const).map(st => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setRollCallMap(prev => ({
                                ...prev,
                                [stu.id]: { status: st, remarks: prev[stu.id]?.remarks || '' },
                              }))
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize border transition-all ${
                              current === st
                                ? st === 'present'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : st === 'absent'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : st === 'late'
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        value={rollCallMap[stu.id]?.remarks || ''}
                        onChange={e =>
                          setRollCallMap(prev => ({
                            ...prev,
                            [stu.id]: { status: current, remarks: e.target.value },
                          }))
                        }
                        placeholder="Optional note..."
                        className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Correction Requests Queue & Faculty Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-heading font-bold text-base text-slate-900 mb-4">
            Student Attendance Correction Requests
          </h3>
          <div className="space-y-3">
            {(data.corrections || []).map((c: any) => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {c.studentName} ({c.className}-{c.sectionName})
                  </span>
                  <span className="text-xs font-mono text-slate-500">{c.date}</span>
                </div>
                <div className="text-xs font-semibold text-blue-700 mt-1">
                  Change {c.currentStatus.toUpperCase()} → {c.requestedStatus.toUpperCase()}
                </div>
                <p className="text-xs text-slate-600 mt-1">{c.reason}</p>
                {c.status === 'pending' ? (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleReviewCorrection(c.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      Approve & Update Register
                    </button>
                    <button
                      onClick={() => handleReviewCorrection(c.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="inline-block mt-2 text-[11px] font-bold uppercase text-slate-500">
                    Status: {c.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Teacher-wise Attendance Monitoring (Coordinator / Principal) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-heading font-bold text-base text-slate-900 mb-4">
            Faculty Daily Check-In & Attendance Monitor
          </h3>
          <div className="space-y-3">
            {(data.teachers || []).map((t: any) => (
              <div key={t.id} className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{t.fullName}</div>
                  <div className="text-[11px] text-slate-500">
                    {t.employeeCode} • {t.department}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    {t.todayAttendance?.status || 'Present'}
                  </span>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    In: {t.todayAttendance?.checkInTime || '07:45 AM'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

