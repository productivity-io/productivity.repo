import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  Calendar,
  Printer,
  Plus,
  Edit,
  X,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  CheckCircle2,
  BookOpen,
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
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export function ExaminationsPage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useEchoViewState('tab');
  const [selectedExamId, setSelectedExamId] = useState<number>(1);

  // Staff Enter Marks Modal
  const [marksOpen, setMarksOpen] = useState(false);
  const [markStudentId, setMarkStudentId] = useState('1');
  const [markSubjectId, setMarkSubjectId] = useState('1');
  const [marksObtained, setMarksObtained] = useState('95');
  const [teacherRemarks, setTeacherRemarks] = useState('Excellent analytical work.');

  const loadExaminations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/examinations');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load examinations', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadExaminations();
  }, [loadExaminations]);

  const handleEnterMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/examinations/${selectedExamId}/marks`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: Number(markStudentId),
          subjectId: Number(markSubjectId),
          marksObtained: Number(marksObtained),
          maxMarks: 100,
          teacherRemarks,
        }),
      });
      setMarksOpen(false);
      showToast('Marks Recorded', 'Student grade and examination analytics updated.', 'success');
      loadExaminations();
    } catch (err: any) {
      showToast('Failed to save marks', err.message, 'error');
    }
  };

  if (loading || !data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const isStaff = user?.role !== 'student';
  const examMarks = (data.marks || []).filter((m: any) => m.examinationId === selectedExamId);

  // Build comparison chart data
  const comparisonData = (data.subjects || []).map((sub: any) => {
    const m1 = (data.marks || []).find((m: any) => m.subjectId === sub.id && m.examinationId === 1 && (!isStaff || m.studentId === 1));
    const m2 = (data.marks || []).find((m: any) => m.subjectId === sub.id && m.examinationId === 2 && (!isStaff || m.studentId === 1));
    return {
      subject: sub.code,
      fullName: sub.name,
      midTerm: m1?.marksObtained || 88,
      unitTest: m2?.marksObtained || 90,
    };
  });

  const firstRc = (data.reportCards || [])[0] || {};
  const currentAvg = firstRc.percentage ? `${firstRc.percentage}%` : '94.6%';
  const classRank = firstRc.rankInClass ? `#${firstRc.rankInClass}` : '#1';

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <MetricCard
          title="Academic Score (Mid-Term)"
          value={currentAvg}
          trend={{ direction: 'up', value: '+3.2%', label: 'vs baseline' }}
          icon={<Award className="w-5 h-5" />}
          iconColor="emerald"
        />
        <MetricCard
          title="Section Standing"
          value={classRank}
          subtitle="Top decile in Grade 10-A"
          trend={{ direction: 'neutral', value: '38 scholars' }}
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="blue"
        />
        <MetricCard
          title="Term I Finals"
          value="Nov 18"
          subtitle="Commencing in 6 Days"
          trend={{ direction: 'neutral', value: '5 Papers' }}
          icon={<Calendar className="w-5 h-5" />}
          iconColor="amber"
        />
        <MetricCard
          title="Ledger Verification"
          value="100%"
          subtitle="All subjects synchronized"
          trend={{ direction: 'up', value: 'Verified' }}
          icon={<CheckCircle2 className="w-5 h-5" />}
          iconColor="slate"
        />
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-700" />
            <span>Examinations, Grading & Official Transcripts</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Verified assessment schedules, subject-wise marks ledger, comparative analytics, and printable transcripts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <Button
              onClick={() => setMarksOpen(true)}
              variant="primary"
              size="sm"
            >
              <Edit className="w-4 h-4 mr-1.5" />
              <span>Enter / Update Marks</span>
            </Button>
          )}
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            <span>Print / PDF Transcript</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 no-print">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'results', label: 'Marks, Grades & Analytics' },
            { id: 'timetable', label: 'Upcoming Exam Timetable (Term I Finals)' },
            { id: 'report_card', label: 'Official Report Card View' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={selectedExamId}
          onChange={e => setSelectedExamId(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {(data.examinations || []).map((ex: any) => (
            <option key={ex.id} value={ex.id}>
              {ex.name} ({ex.status.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Performance Comparison Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              Examination Comparison: Mid-Term Assessment I vs. Unit Test II
            </h3>
            <p className="text-xs text-slate-500 mb-4">Subject-wise marks out of 100</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                    itemStyle={{ color: '#ffffff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="midTerm" name="Mid-Term Assessment I" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="unitTest" name="Unit Test II" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject-wise Marks Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">
              Subject-Wise Assessment Ledger
            </h3>
            <div tabIndex={0} role="region" aria-label="Subject-wise marks table" className="table-wrapper">
              <table className="text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    {isStaff && <th className="py-3 px-4 font-semibold">Student</th>}
                    <th className="py-3 px-4 font-semibold">Subject</th>
                    <th className="py-3 px-4 font-semibold">Marks Obtained</th>
                    <th className="py-3 px-4 font-semibold">Grade</th>
                    <th className="py-3 px-4 font-semibold">Faculty Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examMarks.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      {isStaff && <th className="py-3.5 px-4 font-semibold text-slate-900">{m.studentName}</th>}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {m.subjectName} <span className="font-mono text-xs text-slate-400">({m.subjectCode})</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {m.marksObtained} / {m.maxMarks}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {m.grade}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{m.teacherRemarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timetable' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="mb-4">
            <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              <span>Term I Final Examination Schedule (Nov 18 – Nov 27, 2026)</span>
            </h3>
            <p className="text-xs text-slate-500">Reporting time: 08:40 AM • Bring School ID Card & Geometry Box</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data.schedules || []).map((sch: any) => (
              <div key={sch.id} className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    {sch.examDate}
                  </span>
                  <span className="text-xs text-slate-500">{sch.startTime} – {sch.endTime}</span>
                </div>
                <div className="font-heading font-bold text-base text-slate-900 mt-2">
                  {sch.subjectName} ({sch.subjectCode})
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Venue: <strong>{sch.roomNumber}</strong> • Max Marks: {sch.maxMarks} (Pass: {sch.passingMarks})
                </div>
                {sch.syllabusNotes && (
                  <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <strong>Syllabus Coverage:</strong> {sch.syllabusNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'report_card' && (
        <div className="bg-white rounded-2xl border-2 border-slate-900 p-8 max-w-4xl mx-auto shadow-sm">
          <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Official Academic Transcript
              </div>
              <h2 className="font-heading text-2xl font-bold text-slate-900 mt-1">
                Veritas Collegiate Academy
              </h2>
              <p className="text-xs text-slate-500">
                100 Founders Parkway, Northridge Academic District • Affiliation #INT-SCH-884201
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-900">Academic Session 2026–2027</div>
              <div className="text-xs text-slate-500">Mid-Term Assessment I Report Card</div>
            </div>
          </div>

          {(data.reportCards || []).slice(0, 1).map((rc: any) => (
            <div key={rc.id} className="mt-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500 uppercase">Scholar Name</div>
                  <div className="text-sm font-bold text-slate-900">{data.student?.fullName || 'Aarav Sharma'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 uppercase">Class & Section</div>
                  <div className="text-sm font-bold text-slate-900">Grade 10 — Section A</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 uppercase">Aggregate Score</div>
                  <div className="text-sm font-bold text-blue-700">
                    {rc.totalMarks} / {rc.maxTotalMarks} ({rc.percentage}%)
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 uppercase">Overall Grade & Rank</div>
                  <div className="text-sm font-bold text-emerald-700">
                    Grade {rc.overallGrade} (Rank #{rc.rankInClass})
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs">
                  <strong className="text-slate-900">Class Teacher’s Remarks:</strong>{' '}
                  <span className="text-slate-600">{rc.classTeacherRemarks}</span>
                </div>
                <div className="text-xs">
                  <strong className="text-slate-900">Principal’s Endorsement:</strong>{' '}
                  <span className="text-slate-600">{rc.principalRemarks}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Staff Enter Marks Modal */}
      {marksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setMarksOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Enter Student Examination Marks</h3>
              <button onClick={() => setMarksOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEnterMarks} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student</label>
                <select
                  value={markStudentId}
                  onChange={e => setMarkStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  {(data.students || []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.schoolId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <select
                  value={markSubjectId}
                  onChange={e => setMarkSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  {(data.subjects || []).map((sub: any) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marks Obtained (Out of 100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={marksObtained}
                  onChange={e => setMarksObtained(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={teacherRemarks}
                  onChange={e => setTeacherRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMarksOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Save Marks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

