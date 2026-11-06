import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Award,
  Plus,
  Printer,
  Star,
  CheckCircle2,
  XCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const CATEGORIES = [
  { id: 'all', label: 'All Achievements' },
  { id: 'academic', label: 'Academic' },
  { id: 'project', label: 'Projects' },
  { id: 'competition', label: 'Competitions' },
  { id: 'arts_cultural', label: 'Arts & Cultural' },
  { id: 'sports', label: 'Sports' },
  { id: 'award', label: 'Awards & Certificates' },
];

export function PortfolioPage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useEchoViewState('category');
  const [selectedStudentId, setSelectedStudentId] = useState<number>(1);

  // Add Portfolio Entry Modal
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryCategory, setEntryCategory] = useState('academic');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryIssuer, setEntryIssuer] = useState('');
  const [entryDate, setEntryDate] = useState('2026-11-05');

  // Add Teacher Feedback Modal
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [fbCategory, setFbCategory] = useState('academic_progress');
  const [fbRating, setFbRating] = useState('5');
  const [fbComment, setFbComment] = useState('');
  const [fbImprovement, setFbImprovement] = useState('');

  const loadPortfolios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/portfolios');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load portfolio', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/portfolios/entries', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          title: entryTitle,
          category: entryCategory,
          description: entryDesc,
          issuerOrEvent: entryIssuer,
          dateAchieved: entryDate,
        }),
      });
      setEntryModalOpen(false);
      setEntryTitle('');
      setEntryDesc('');
      setEntryIssuer('');
      showToast(
        user?.role === 'student' ? 'Submitted for Faculty Verification' : 'Portfolio Entry Added',
        user?.role === 'student' ? 'Your teacher/coordinator will verify this entry.' : 'Verified and added to student portfolio.',
        'success'
      );
      loadPortfolios();
    } catch (err: any) {
      showToast('Submission failed', err.message, 'error');
    }
  };

  const handleVerifyEntry = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/portfolios/entries/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationStatus: status,
          teacherRemarks: status === 'approved' ? 'Verified achievement documentation.' : 'Please attach event certificate.',
        }),
      });
      showToast(`Entry ${status}`, `Portfolio milestone marked as ${status}.`, 'success');
      loadPortfolios();
    } catch (err: any) {
      showToast('Verification failed', err.message, 'error');
    }
  };

  const handleCreateFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudentId,
          category: fbCategory,
          rating: Number(fbRating),
          comment: fbComment,
          areasOfImprovement: fbImprovement,
        }),
      });
      setFeedbackModalOpen(false);
      setFbComment('');
      setFbImprovement('');
      showToast('Faculty Feedback Recorded', 'Visible on the student portfolio and dashboard.', 'success');
      loadPortfolios();
    } catch (err: any) {
      showToast('Failed to add feedback', err.message, 'error');
    }
  };

  if (loading || !data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const isStaff = user?.role !== 'student';
  const currentStudent = isStaff
    ? (data.students || []).find((s: any) => s.id === selectedStudentId) || data.students?.[0]
    : data.student;

  const currentPortfolio = isStaff
    ? (data.portfolios || []).find((p: any) => p.studentId === currentStudent?.id) || {
        headline: `${currentStudent?.className} Scholar at Veritas Collegiate Academy`,
        introduction: 'Dedicated scholar engaged in STEM, humanities, and leadership.',
        skills: ['Analytical Problem Solving', 'Research', 'Public Speaking'],
        extracurriculars: ['House Debate Society', 'STEM Club'],
        careerGoals: 'University Honours & Research',
      }
    : data.portfolio;

  const entriesList = (data.entries || []).filter((e: any) => {
    if (isStaff && e.studentId !== currentStudent?.id) return false;
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    return true;
  });

  const feedbackList = (data.feedback || []).filter((f: any) =>
    isStaff ? f.studentId === currentStudent?.id : true
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-700" />
            <span>Student Portfolio, Achievements & Faculty Endorsements</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Comprehensive showcase of academic awards, projects, co-curricular milestones, and teacher feedback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
            >
              {(data.students || []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.className}-{s.sectionName})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setEntryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isStaff ? 'Add Verified Milestone' : 'Submit Achievement'}</span>
          </button>

          {isStaff && (
            <button
              onClick={() => setFeedbackModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Star className="w-4 h-4 text-amber-400" />
              <span>Write Teacher Feedback</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Export / Print Portfolio</span>
          </button>
        </div>
      </div>

      {/* Portfolio Showcase Header Card */}
      {currentStudent && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-18 h-18 rounded-2xl bg-slate-900 text-white font-heading font-bold text-2xl flex items-center justify-center shrink-0">
                {currentStudent.fullName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    {currentStudent.schoolId}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {currentStudent.className} — Section {currentStudent.sectionName}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800">
                    {currentStudent.house}
                  </span>
                </div>
                <h1 className="font-heading text-2xl font-bold text-slate-900 mt-1.5">{currentStudent.fullName}</h1>
                <p className="text-sm font-medium text-blue-700 mt-0.5">{currentPortfolio.headline}</p>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
                  {currentPortfolio.introduction}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Core Competencies & Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {(currentPortfolio.skills || []).map((sk: string) => (
                  <span key={sk} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                    {sk}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Extracurricular Leadership</div>
              <ul className="space-y-1 text-xs text-slate-700 font-medium">
                {(currentPortfolio.extracurriculars || []).map((ex: string) => (
                  <li key={ex} className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Higher Education & Career Goals</div>
              <p className="text-xs text-slate-700 leading-relaxed">{currentPortfolio.careerGoals}</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 no-print">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              categoryFilter === c.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Achievements & Teacher Feedback Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verified Milestones & Achievements */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-heading font-bold text-base text-slate-900">
            Documented Achievements, Projects & Milestones ({entriesList.length})
          </h3>
          {entriesList.map((entry: any) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-50 text-blue-700">
                    {entry.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500">{entry.issuerOrEvent}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">{entry.dateAchieved}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      entry.verificationStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : entry.verificationStatus === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {entry.verificationStatus === 'approved' ? 'Faculty Verified' : entry.verificationStatus}
                  </span>
                </div>
              </div>

              <h4 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-700 shrink-0" />
                <span>{entry.title}</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">{entry.description}</p>

              {entry.teacherRemarks && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600">
                  <strong>Faculty Endorsement:</strong> {entry.teacherRemarks}
                </div>
              )}

              {isStaff && entry.verificationStatus === 'pending' && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 no-print">
                  <button
                    onClick={() => handleVerifyEntry(entry.id, 'approved')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify & Approve</span>
                  </button>
                  <button
                    onClick={() => handleVerifyEntry(entry.id, 'rejected')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Return</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Holistic Teacher Feedback Panel */}
        <div className="space-y-4">
          <h3 className="font-heading font-bold text-base text-slate-900">
            Holistic Faculty Feedback ({feedbackList.length})
          </h3>
          {feedbackList.map((fb: any) => (
            <div key={fb.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{fb.teacherName}</span>
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: fb.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
              </div>
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
                {fb.category.replace('_', ' ')}
              </span>
              <p className="text-xs text-slate-700 mt-2 leading-relaxed">“{fb.comment}”</p>
              {fb.areasOfImprovement && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <strong>Next Milestone Focus:</strong> {fb.areasOfImprovement}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submit Portfolio Achievement Modal */}
      {entryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setEntryModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Submit Portfolio Milestone</h3>
              <button onClick={() => setEntryModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateEntry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title of Achievement / Project</label>
                <input
                  type="text"
                  required
                  value={entryTitle}
                  onChange={e => setEntryTitle(e.target.value)}
                  placeholder="e.g. National Science Bowl Finalist"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={entryCategory}
                    onChange={e => setEntryCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="academic">Academic</option>
                    <option value="project">Project</option>
                    <option value="competition">Competition</option>
                    <option value="arts_cultural">Arts & Cultural</option>
                    <option value="sports">Sports</option>
                    <option value="award">Award / Certificate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date Achieved</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issuing Organization / Event</label>
                <input
                  type="text"
                  required
                  value={entryIssuer}
                  onChange={e => setEntryIssuer(e.target.value)}
                  placeholder="e.g. State STEM Directorate"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Impact</label>
                <textarea
                  rows={3}
                  required
                  value={entryDesc}
                  onChange={e => setEntryDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEntryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Submit Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setFeedbackModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-3">
              Provide Structured Student Feedback
            </h3>
            <form onSubmit={handleCreateFeedback} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Evaluation Dimension</label>
                  <select
                    value={fbCategory}
                    onChange={e => setFbCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="academic_progress">Academic Progress</option>
                    <option value="participation">Classroom Participation</option>
                    <option value="behaviour">Behaviour & Conduct</option>
                    <option value="communication">Communication</option>
                    <option value="creativity">Creativity & Innovation</option>
                    <option value="leadership">Leadership</option>
                    <option value="improvement_area">Areas Requiring Improvement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rating (1–5 Stars)</label>
                  <select
                    value={fbRating}
                    onChange={e => setFbRating(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="5">5 — Exemplary</option>
                    <option value="4">4 — Proficient</option>
                    <option value="3">3 — Developing</option>
                    <option value="2">2 — Needs Support</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observation & Commendation</label>
                <textarea
                  rows={3}
                  required
                  value={fbComment}
                  onChange={e => setFbComment(e.target.value)}
                  placeholder="Write constructive feedback..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recommended Next Step</label>
                <input
                  type="text"
                  value={fbImprovement}
                  onChange={e => setFbImprovement(e.target.value)}
                  placeholder="Optional growth recommendation..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Publish Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

