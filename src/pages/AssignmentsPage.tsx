import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Upload,
  CheckCircle2,
  Clock,
  FileText,
  Award,
  X,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  FileCheck2,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, uploadLocalFile } from '../lib/api';
import { registerEchoSubjects } from '../lib/echoSubjectOptions';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const STATUS_VARIANTS: Record<string, { variant: 'info' | 'warning' | 'success' | 'danger' | 'purple' | 'outline'; label: string }> = {
  assigned: { variant: 'outline', label: 'Assigned' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  submitted: { variant: 'info', label: 'Submitted' },
  under_review: { variant: 'purple', label: 'Under Review' },
  graded: { variant: 'success', label: 'Graded' },
  overdue: { variant: 'danger', label: 'Overdue' },
};

export function AssignmentsPage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawSubject, setSubjectFilter] = useEchoViewState('subject');
  const subjectFilter = data?.subjects?.some((s: { id: number }) => String(s.id) === rawSubject) ? rawSubject : 'all';
  const [statusFilter, setStatusFilter] = useEchoViewState('status');

  // Student submission modal
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [subText, setSubText] = useState('');
  const [subFile, setSubFile] = useState<File | null>(null);
  const [submittingWork, setSubmittingWork] = useState(false);

  // Teacher Create Assignment modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newInstr, setNewInstr] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('1');
  const [newClassSection, setNewClassSection] = useState('1-1');
  const [newDueDate, setNewDueDate] = useState('2026-11-15');
  const [newMaxMarks, setNewMaxMarks] = useState('50');
  const [newFile, setNewFile] = useState<File | null>(null);

  // Teacher Grading modal
  const [gradingSubmission, setGradingSubmission] = useState<{ sub: any; assignment: any } | null>(null);
  const [gradeMarks, setGradeMarks] = useState('');
  const [gradeLetter, setGradeLetter] = useState('A+');
  const [gradeRemarks, setGradeRemarks] = useState('');

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/assignments');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load assignments', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (user && data?.subjects) return registerEchoSubjects(user.id, data.subjects);
  }, [user?.id, data?.subjects]);

  const handleStudentSubmit = async (targetStatus: 'in_progress' | 'submitted') => {
    if (!activeAssignment) return;
    setSubmittingWork(true);
    try {
      let uploaded: { url: string; fileName: string } | null = null;
      if (subFile) {
        uploaded = await uploadLocalFile(subFile, 'submissions');
      }

      await apiFetch(`/api/assignments/${activeAssignment.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          status: targetStatus,
          textContent: subText,
          fileUrl: uploaded?.url || activeAssignment.submission?.fileUrl || null,
          fileName: uploaded?.fileName || activeAssignment.submission?.fileName || null,
        }),
      });

      setActiveAssignment(null);
      setSubFile(null);
      showToast(
        targetStatus === 'submitted' ? 'Assignment Submitted' : 'Draft Saved',
        targetStatus === 'submitted' ? 'Your teacher has been notified for grading.' : 'Saved as In Progress.',
        'success'
      );
      loadAssignments();
    } catch (err: any) {
      showToast('Submission failed', err.message, 'error');
    } finally {
      setSubmittingWork(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let uploaded: { url: string; fileName: string } | null = null;
      if (newFile) {
        uploaded = await uploadLocalFile(newFile, 'reference');
      }
      const [classId, sectionId] = newClassSection.split('-').map(Number);
      await apiFetch('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          instructions: newInstr,
          classId,
          sectionId,
          subjectId: Number(newSubjectId),
          dueDate: newDueDate,
          maxMarks: Number(newMaxMarks),
          attachmentUrl: uploaded?.url || null,
          attachmentName: uploaded?.fileName || null,
        }),
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewInstr('');
      setNewFile(null);
      showToast('Assignment Created', 'Assigned to all students in the selected section.', 'success');
      loadAssignments();
    } catch (err: any) {
      showToast('Creation failed', err.message, 'error');
    }
  };

  const handleGradeSubmission = async (requestResubmit = false) => {
    if (!gradingSubmission) return;
    try {
      await apiFetch(`/api/submissions/${gradingSubmission.sub.id}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({
          marksObtained: gradeMarks ? Number(gradeMarks) : null,
          grade: gradeLetter,
          teacherRemarks: gradeRemarks,
          status: requestResubmit ? 'in_progress' : 'graded',
          resubmissionRequested: requestResubmit,
        }),
      });
      setGradingSubmission(null);
      showToast(
        requestResubmit ? 'Resubmission Requested' : 'Submission Graded',
        'Student dashboard and notifications updated.',
        'success'
      );
      loadAssignments();
    } catch (err: any) {
      showToast('Grading failed', err.message, 'error');
    }
  };

  if (loading || !data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const isStaff = user?.role !== 'student';
  const allAssignments = data.assignments || [];
  const assignmentsList = allAssignments.filter((a: any) => {
    if (subjectFilter !== 'all' && String(a.subjectId) !== subjectFilter) return false;
    if (!isStaff && statusFilter !== 'all' && a.submission?.status !== statusFilter) return false;
    return true;
  });

  // Calculate metrics for summary row
  const studentTotal = allAssignments.length;
  const studentGraded = allAssignments.filter((a: any) => a.submission?.status === 'graded').length;
  const studentPending = allAssignments.filter((a: any) => ['assigned', 'in_progress', 'overdue'].includes(a.submission?.status)).length;
  const studentSubmitted = allAssignments.filter((a: any) => ['submitted', 'under_review'].includes(a.submission?.status)).length;

  const staffTotalSubmissions = allAssignments.reduce((acc: number, a: any) => acc + (a.submissions?.length || 0), 0);
  const staffAwaiting = allAssignments.reduce((acc: number, a: any) => acc + (a.submissions?.filter((s: any) => s.status !== 'graded').length || 0), 0);
  const staffGraded = allAssignments.reduce((acc: number, a: any) => acc + (a.submissions?.filter((s: any) => s.status === 'graded').length || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {!isStaff ? (
          <>
            <MetricCard
              title="Assigned Work"
              value={studentTotal}
              trend={{ direction: 'neutral', value: 'All active' }}
              icon={<BookOpen className="w-5 h-5" />}
              iconColor="slate"
            />
            <MetricCard
              title="Graded / Done"
              value={studentGraded}
              trend={{ direction: 'up', value: `${studentTotal > 0 ? Math.round((studentGraded / studentTotal) * 100) : 0}%`, label: 'completed' }}
              icon={<CheckCircle className="w-5 h-5" />}
              iconColor="emerald"
            />
            <MetricCard
              title="Awaiting Evaluation"
              value={studentSubmitted}
              trend={{ direction: 'neutral', value: 'In review queue' }}
              icon={<FileCheck2 className="w-5 h-5" />}
              iconColor="blue"
            />
            <MetricCard
              title="Pending Action"
              value={studentPending}
              trend={{ direction: studentPending > 0 ? 'down' : 'neutral', value: studentPending > 0 ? 'Action required' : 'All clear' }}
              icon={<Clock className="w-5 h-5" />}
              iconColor="amber"
            />
          </>
        ) : (
          <>
            <MetricCard
              title="Published Tasks"
              value={studentTotal}
              trend={{ direction: 'neutral', value: 'Active syllabus' }}
              icon={<BookOpen className="w-5 h-5" />}
              iconColor="slate"
            />
            <MetricCard
              title="Total Submissions"
              value={staffTotalSubmissions}
              trend={{ direction: 'up', value: 'Class responses' }}
              icon={<Layers className="w-5 h-5" />}
              iconColor="blue"
            />
            <MetricCard
              title="Awaiting Grading"
              value={staffAwaiting}
              trend={{ direction: staffAwaiting > 0 ? 'down' : 'up', value: staffAwaiting > 0 ? 'Queue pending' : 'Zero backlog' }}
              icon={<Clock className="w-5 h-5" />}
              iconColor="amber"
            />
            <MetricCard
              title="Evaluated"
              value={staffGraded}
              trend={{ direction: 'up', value: 'Marks recorded' }}
              icon={<CheckCircle className="w-5 h-5" />}
              iconColor="emerald"
            />
          </>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-700" />
            <span>Coursework & Assignment Manager</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isStaff
              ? 'Publish syllabus tasks, review uploaded submissions, and issue marks & remarks.'
              : 'Track deadlines, review instructor notes, submit solutions, and inspect grades.'}
          </p>
        </div>

        {isStaff && (
          <Button
            onClick={() => setCreateOpen(true)}
            variant="primary"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create New Assignment</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubjectFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subjectFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Subjects
          </button>
          {(data.subjects || []).map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSubjectFilter(String(s.id))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                subjectFilter === String(s.id)
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {!isStaff && (
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="graded">Graded</option>
            <option value="overdue">Overdue</option>
          </select>
        )}
      </div>

      {/* Assignments Cards */}
      <div className="space-y-3.5">
        {assignmentsList.map((asg: any) => {
          const sub = asg.submission;
          const statusInfo = sub ? STATUS_VARIANTS[sub.status] || { variant: 'outline' as const, label: sub.status } : null;

          return (
            <div key={asg.id} className="bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-mono text-xs font-bold">
                    {asg.subjectCode} • {asg.subjectName}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Instructor: {asg.teacherName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Due: <strong className="text-slate-800">{asg.dueDate}</strong>
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200/60">
                    Max {asg.maxMarks} pts
                  </span>
                  {!isStaff && statusInfo && (
                    <Badge variant={statusInfo.variant} size="sm">
                      {statusInfo.label}
                    </Badge>
                  )}
                </div>
              </div>

              <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">{asg.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{asg.description}</p>
              {asg.instructions && (
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-700 whitespace-pre-line">
                  <strong className="block text-slate-900 mb-1">Instructions:</strong>
                  {asg.instructions}
                </div>
              )}

              {/* Student View Footer: Submission Status, Marks, and Portal Button */}
              {!isStaff && sub && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    {sub.status === 'graded' ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                          <Award className="w-4 h-4" />
                          Score: {sub.marksObtained} / {asg.maxMarks} (Grade {sub.grade})
                        </span>
                        {sub.teacherRemarks && (
                          <span className="text-xs text-slate-600 italic">
                            Teacher Feedback: “{sub.teacherRemarks}”
                          </span>
                        )}
                      </div>
                    ) : sub.submittedAt ? (
                      <div className="text-xs text-slate-600">
                        Submitted on {new Date(sub.submittedAt).toLocaleString()}
                        {sub.fileName && <span className="ml-2 font-mono text-blue-700">({sub.fileName})</span>}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {sub.teacherRemarks || 'Ready for your text or file upload submission.'}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {asg.attachmentName && (
                      <button
                        type="button"
                        onClick={() => showToast('Reference Downloaded', `Opened ${asg.attachmentName}`, 'success')}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-700" />
                        <span>{asg.attachmentName}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setActiveAssignment(asg);
                        setSubText(sub.textContent || '');
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {sub.status === 'submitted' || sub.status === 'graded'
                          ? 'View / Update Submission'
                          : 'Open Submission Portal'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Staff View Footer: Student Submissions Table */}
              {isStaff && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Student Submissions ({asg.submissions?.length || 0})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(asg.submissions || []).map((s: any) => (
                      <div key={s.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{s.studentName}</span>
                            <Badge
                              variant={
                                s.status === 'graded'
                                  ? 'success'
                                  : s.status === 'submitted'
                                  ? 'info'
                                  : s.status === 'in_progress'
                                  ? 'warning'
                                  : 'outline'
                              }
                              size="sm"
                            >
                              {s.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {s.textContent && (
                            <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{s.textContent}</p>
                          )}
                          {s.fileName && (
                            <div className="text-[11px] font-mono text-blue-700 mt-1 truncate">📎 {s.fileName}</div>
                          )}
                          {s.status === 'graded' && (
                            <div className="mt-1.5 text-xs font-bold text-emerald-700">
                              Score: {s.marksObtained}/{asg.maxMarks} ({s.grade})
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setGradingSubmission({ sub: s, assignment: asg });
                            setGradeMarks(s.marksObtained !== null ? String(s.marksObtained) : String(Math.round(asg.maxMarks * 0.9)));
                            setGradeLetter(s.grade || 'A');
                            setGradeRemarks(s.teacherRemarks || 'Well-structured analytical solution.');
                          }}
                          className="mt-3 w-full py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 text-xs font-semibold"
                        >
                          {s.status === 'graded' ? 'Edit Grade / Remarks' : 'Review & Grade'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Student Submission Portal Modal */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setActiveAssignment(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">{activeAssignment.title}</h3>
                <p className="text-xs text-slate-500">
                  {activeAssignment.subjectName} • Max Marks: {activeAssignment.maxMarks}
                </p>
              </div>
              <button onClick={() => setActiveAssignment(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Written Solution / Notes
                </label>
                <textarea
                  rows={5}
                  value={subText}
                  onChange={e => setSubText(e.target.value)}
                  placeholder="Type your response, derivations, or summary notes here..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Solution Document (PDF, Word, Image, ZIP)
                </label>
                <input
                  type="file"
                  onChange={e => setSubFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submittingWork}
                  onClick={() => handleStudentSubmit('in_progress')}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Save as In-Progress
                </button>
                <button
                  type="button"
                  disabled={submittingWork}
                  onClick={() => handleStudentSubmit('submitted')}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingWork ? 'Submitting...' : 'Submit Final Work'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Create Assignment Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 max-h-[90vh] overflow-y-auto">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Create New Class Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Trigonometric Identities Problem Set"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class & Section</label>
                  <select
                    value={newClassSection}
                    onChange={e => setNewClassSection(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="1-1">Grade 10 — Section A</option>
                    <option value="1-2">Grade 10 — Section B</option>
                    <option value="2-3">Grade 9 — Section A</option>
                    <option value="3-4">Grade 11 — Section A</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <select
                    value={newSubjectId}
                    onChange={e => setNewSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {(data.subjects || []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Marks</label>
                  <input
                    type="number"
                    required
                    value={newMaxMarks}
                    onChange={e => setNewMaxMarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  required
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Step-by-Step Instructions</label>
                <textarea
                  rows={3}
                  value={newInstr}
                  onChange={e => setNewInstr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Reference File</label>
                <input
                  type="file"
                  onChange={e => setNewFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Grading Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setGradingSubmission(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-1">
              Grade Submission: {gradingSubmission.sub.studentName}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{gradingSubmission.assignment.title}</p>

            {gradingSubmission.sub.textContent && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 mb-4">
                <strong>Student Response:</strong> {gradingSubmission.sub.textContent}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Marks (Max {gradingSubmission.assignment.maxMarks})
                  </label>
                  <input
                    type="number"
                    value={gradeMarks}
                    onChange={e => setGradeMarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Letter Grade</label>
                  <select
                    value={gradeLetter}
                    onChange={e => setGradeLetter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {['A+', 'A', 'A-', 'B+', 'B', 'C', 'D'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teacher Remarks</label>
                <textarea
                  rows={3}
                  value={gradeRemarks}
                  onChange={e => setGradeRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => handleGradeSubmission(true)}
                  className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Request Resubmission</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGradingSubmission(null)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGradeSubmission(false)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    Save Grade
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

