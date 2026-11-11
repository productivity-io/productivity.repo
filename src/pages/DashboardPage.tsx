import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  BookOpen,
  Award,
  Megaphone,
  Calendar,
  Star,
  ArrowRight,
  Users,
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Sparkles,
  Briefcase,
  Bus,
  FileCheck2,
  Activity,
  Layers,
  MessageSquare,
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
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { MetricCard } from '../components/ui/MetricCard';
import { PageHeader } from '../components/ui/PageHeader';

export function DashboardPage() {
  const { user, academicYear, showToast } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/dashboard');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load dashboard', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, user?.id]);

  const handleQuickApproveAnnouncement = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/announcements/${id}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({
          approvalStatus: status,
          rejectionRemarks: status === 'rejected' ? 'Please refine target class details and resubmit.' : undefined,
        }),
      });
      showToast(`Announcement ${status}`, `Coordinator announcement has been ${status}.`, 'success');
      loadDashboard();
    } catch (err: any) {
      showToast('Action failed', err.message, 'error');
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-white rounded-2xl border border-slate-200/80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-28 bg-white rounded-2xl border border-slate-200/80" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-slate-200/80" />
          <div className="h-80 bg-white rounded-2xl border border-slate-200/80" />
        </div>
      </div>
    );
  }

  // ==========================================
  // 1. STUDENT DASHBOARD VIEW
  // ==========================================
  if (data.role === 'student') {
    const stu = data.student;
    return (
      <div className="space-y-6">
        {/* Welcome Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900 text-white font-heading font-bold text-lg sm:text-xl flex items-center justify-center shadow-xs shrink-0 tracking-tight">
              {stu.fullName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" size="xs" className="font-mono">
                  {stu.schoolId}
                </Badge>
                <Badge variant="info" size="xs">
                  {stu.className} — Sec {stu.sectionName} (Roll #{stu.rollNo})
                </Badge>
                <Badge variant="warning" size="xs">
                  {stu.house}
                </Badge>
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
                Welcome back, {stu.fullName}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Session AY {academicYear} • Homeroom: {stu.roomNumber}
              </p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<BookOpen className="w-3.5 h-3.5" />}
              onClick={() => navigate('/assignments')}
            >
              Submit Homework
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Briefcase className="w-3.5 h-3.5 text-blue-600" />}
              onClick={() => navigate('/portfolio')}
            >
              Portfolio
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Bus className="w-3.5 h-3.5 text-slate-500" />}
              onClick={() => navigate('/transport')}
            >
              Bus {stu.routeNumber || 'RT-101'}
            </Button>
          </div>
        </div>

        {/* 4 Key Student Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => navigate('/attendance')} className="cursor-pointer">
            <MetricCard
              title="Attendance Rate"
              value={`${data.attendancePercentage}%`}
              icon={<CalendarCheck className="w-5 h-5" />}
              iconColor="emerald"
              subtitle={`Today: ${data.todayAttendance?.status || 'Present'}`}
              badge={
                <Badge variant={data.todayAttendance?.status === 'absent' ? 'danger' : 'success'} size="xs" dot>
                  {data.todayAttendance?.status || 'Present'}
                </Badge>
              }
            />
          </div>

          <div onClick={() => navigate('/assignments')} className="cursor-pointer">
            <MetricCard
              title="Pending Work"
              value={`${data.pendingAssignments.length} Tasks`}
              icon={<BookOpen className="w-5 h-5" />}
              iconColor="blue"
              subtitle={`${data.allAssignments.filter((a: any) => a.submissionStatus === 'graded').length} graded`}
              badge={
                <Badge variant={data.pendingAssignments.length > 0 ? 'warning' : 'secondary'} size="xs">
                  {data.pendingAssignments.length > 0 ? 'Active' : 'Completed'}
                </Badge>
              }
            />
          </div>

          <div onClick={() => navigate('/examinations')} className="cursor-pointer">
            <MetricCard
              title="Academic Standing"
              value={`${stu.avgAcademicPercentage}%`}
              icon={<Award className="w-5 h-5" />}
              iconColor="indigo"
              subtitle="Term I Finals Nov 18"
              trend={{
                value: '+4.2%',
                direction: 'up',
                label: 'vs Unit Test I',
              }}
            />
          </div>

          <div onClick={() => navigate('/announcements')} className="cursor-pointer">
            <MetricCard
              title="Active Notices"
              value={`${data.latestAnnouncements.length} Bulletins`}
              icon={<Megaphone className="w-5 h-5" />}
              iconColor="amber"
              subtitle={data.emergencyAlerts?.length > 0 ? `${data.emergencyAlerts.length} Critical Alert active` : 'No emergencies'}
              badge={
                data.emergencyAlerts?.length > 0 ? (
                  <Badge variant="danger" size="xs" dot>
                    Emergency
                  </Badge>
                ) : (
                  <Badge variant="secondary" size="xs">
                    Normal
                  </Badge>
                )
              }
            />
          </div>
        </div>

        {/* Main Two-Column Grid: Today's Timetable & Pending Assignments */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-700" />
                  <span>Today’s Class Timetable (Thursday)</span>
                </h3>
                <p className="text-xs text-slate-500">Live room allocations, substitutions, and break periods</p>
              </div>
              <button
                onClick={() => navigate('/timetable')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Full Week</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {data.todayTimetable.map((slot: any) => (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    slot.isBreak
                      ? 'bg-slate-50/80 border-slate-200/60 text-slate-500'
                      : slot.status === 'substituted'
                      ? 'bg-amber-50/50 border-amber-200'
                      : slot.status === 'cancelled'
                      ? 'bg-red-50/40 border-red-200'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="text-xs font-mono font-semibold text-slate-600 w-24 shrink-0">
                      {slot.startTime} – {slot.endTime}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        <span>{slot.subjectName}</span>
                        {slot.status === 'substituted' && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Substituted
                          </span>
                        )}
                        {slot.status === 'cancelled' && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">
                            Merged / Notice
                          </span>
                        )}
                      </div>
                      {!slot.isBreak && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {slot.teacherName} • {slot.roomNumber}
                          {slot.statusNote && <span className="block text-amber-800 font-medium mt-0.5">{slot.statusNote}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-400">Period #{slot.periodNumber}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Pending Assignments & Upcoming Exams */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-base text-slate-900">Pending Assignments</h3>
                <button
                  onClick={() => navigate('/assignments')}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  Open Portal
                </button>
              </div>
              <div className="space-y-3">
                {data.pendingAssignments.map((asg: any) => (
                  <div
                    key={asg.id}
                    onClick={() => navigate('/assignments')}
                    className="p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-300 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-blue-700">{asg.subjectName}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          asg.submissionStatus === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : asg.submissionStatus === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {asg.submissionStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">{asg.title}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                      <span>Due: {asg.dueDate}</span>
                      <span>{asg.maxMarks} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Teacher Feedback */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-base text-slate-900">Recent Faculty Feedback</h3>
                <button
                  onClick={() => navigate('/portfolio')}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-3">
                {data.recentFeedback.slice(0, 3).map((fb: any) => (
                  <div key={fb.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{fb.teacherName}</span>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: fb.rating }).map((_, idx) => (
                          <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">“{fb.comment}”</p>
                    <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {fb.category.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Academic Performance Chart & Campus Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900">
                  Academic Performance Comparison (Mid-Term I vs. Unit Test II)
                </h3>
                <p className="text-xs text-slate-500">Subject-wise percentage scores across completed examinations</p>
              </div>
              <button
                onClick={() => navigate('/examinations')}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Report Cards →
              </button>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.subjectPerformance} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="subject" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="midTerm" name="Mid-Term Assessment I" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="unitTest" name="Unit Test II" fill="#64748b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Upcoming Events & Deadlines</h3>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Calendar
              </button>
            </div>
            <div className="space-y-3">
              {data.upcomingEvents.map((ev: any) => (
                <div key={ev.id} className="p-3 rounded-xl border border-slate-200/80 flex items-start gap-3">
                  <div className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-mono text-xs font-bold text-center shrink-0">
                    {ev.startDate.slice(5)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{ev.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {ev.startTime || 'All Day'} • {ev.location}
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

  // ==========================================
  // 2. TEACHER DASHBOARD VIEW
  // ==========================================
  if (data.role === 'teacher') {
    const teacher = data.teacher;
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {teacher.employeeCode}
              </span>
              <span className="text-xs font-medium text-slate-500">{teacher.department}</span>
            </div>
            <h2 className="font-heading text-2xl font-bold text-slate-900 mt-1">{teacher.fullName}</h2>
            <p className="text-xs sm:text-sm text-slate-500">{teacher.designation}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/attendance')}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Mark Attendance</span>
            </button>
            <button
              onClick={() => navigate('/assignments')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <BookOpen className="w-4 h-4" />
              <span>Create & Grade Assignments</span>
            </button>
          </div>
        </div>

        {/* Teacher KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => navigate('/directory')} className="cursor-pointer">
            <MetricCard
              title="Assigned Classes"
              value={`${data.stats.assignedClassesCount} Sections`}
              icon={<Users className="w-5 h-5" />}
              iconColor="slate"
              subtitle={`${data.stats.totalStudentsCount} Enrolled Students`}
              badge={<Badge variant="secondary" size="xs">Active</Badge>}
            />
          </div>

          <div onClick={() => navigate('/assignments')} className="cursor-pointer">
            <MetricCard
              title="Grading Queue"
              value={`${data.stats.pendingToGradeCount} Submissions`}
              icon={<BookOpen className="w-5 h-5" />}
              iconColor="blue"
              subtitle={`${data.teacherAssignments.length} active assignments published`}
              badge={<Badge variant="warning" size="xs">Pending Review</Badge>}
            />
          </div>

          <div onClick={() => navigate('/attendance')} className="cursor-pointer">
            <MetricCard
              title="Class Attendance"
              value={`${data.stats.avgAttendancePercentage}%`}
              icon={<CalendarCheck className="w-5 h-5" />}
              iconColor="emerald"
              subtitle="Daily & subject logs synced"
              trend={{
                value: '+1.8%',
                direction: 'up',
                label: 'vs school mean',
              }}
            />
          </div>

          <div onClick={() => navigate('/communication')} className="cursor-pointer">
            <MetricCard
              title="Student Requests"
              value={`${data.stats.pendingRequestsCount} Actionable`}
              icon={<MessageSquare className="w-5 h-5" />}
              iconColor="amber"
              subtitle="Communication & corrections"
              badge={<Badge variant="info" size="xs">Needs Action</Badge>}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Teaching Schedule */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Today’s Teaching Schedule</h3>
              <button onClick={() => navigate('/timetable')} className="text-xs font-semibold text-blue-700 hover:underline">
                Full Timetable →
              </button>
            </div>
            <div className="space-y-3">
              {data.todayTimetable.map((slot: any) => (
                <div key={slot.id} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Period #{slot.periodNumber}: {slot.subjectName} ({slot.className}-{slot.sectionName})
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {slot.startTime} – {slot.endTime} • {slot.roomNumber}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/attendance')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-xs font-semibold text-slate-700"
                  >
                    Roll Call
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Student Supervision & Quick Grading */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Assigned Students Overview</h3>
              <button onClick={() => navigate('/directory')} className="text-xs font-semibold text-blue-700 hover:underline">
                Supervision
              </button>
            </div>
            <div className="space-y-3">
              {data.assignedStudents.slice(0, 5).map((stu: any) => (
                <div key={stu.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{stu.fullName}</div>
                    <div className="text-[11px] text-slate-500">
                      {stu.className}-{stu.sectionName} • Att: {stu.attendancePercentage}%
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">
                    {stu.avgAcademicPercentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. COORDINATOR & PRINCIPAL EXECUTIVE DASHBOARD
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Executive Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{data.role === 'principal' ? 'Principal Executive Command Center' : 'Academic Coordinator Operations Hub'}</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">
            Institutional Performance & Governance — AY {academicYear}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time metrics across {data.stats.totalClasses} grades, {data.stats.totalTeachers} faculty members, and {data.stats.totalStudents} enrolled scholars.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data.role === 'principal' && (
            <button
              onClick={() => navigate('/announcements')}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Publish Emergency Alert</span>
            </button>
          )}
          <button
            onClick={() => navigate('/directory')}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Manage Directory</span>
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="w-4 h-4 text-blue-700" />
            <span>Reports & Exports</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/directory')} className="cursor-pointer">
          <MetricCard
            title="Campus Strength"
            value={`${data.stats.totalStudents} Students`}
            icon={<Users className="w-5 h-5" />}
            iconColor="blue"
            subtitle={`${data.stats.totalTeachers} Faculty • ${data.stats.totalCoordinators} Coordinators`}
            badge={<Badge variant="secondary" size="xs">Enrolled</Badge>}
          />
        </div>

        <div onClick={() => navigate('/attendance')} className="cursor-pointer">
          <MetricCard
            title="School-Wide Attendance"
            value={`${data.stats.overallAttendance}%`}
            icon={<UserCheck className="w-5 h-5" />}
            iconColor="emerald"
            subtitle="Across all active grade sections"
            trend={{
              value: '+0.9%',
              direction: 'up',
              label: 'vs yesterday',
            }}
          />
        </div>

        <div onClick={() => navigate('/examinations')} className="cursor-pointer">
          <MetricCard
            title="Academic Standing"
            value={`${data.stats.overallAcademic}% Avg`}
            icon={<Award className="w-5 h-5" />}
            iconColor="indigo"
            subtitle={`Completion Rate: ${data.stats.assignmentCompletionRate}%`}
            badge={<Badge variant="info" size="xs">Term I</Badge>}
          />
        </div>

        <div onClick={() => navigate('/announcements')} className="cursor-pointer">
          <MetricCard
            title="Pending Approvals"
            value={`${data.stats.pendingApprovalsCount} Items`}
            icon={<FileCheck2 className="w-5 h-5" />}
            iconColor="amber"
            subtitle={`${data.pendingAnnouncements.length} Circulars • ${data.pendingLeaves.length} Leaves`}
            badge={
              <Badge variant={data.stats.pendingApprovalsCount > 0 ? 'warning' : 'success'} size="xs" dot>
                {data.stats.pendingApprovalsCount > 0 ? 'Action Required' : 'All Clear'}
              </Badge>
            }
          />
        </div>
      </div>

      {/* Main Analytics & Approval Queue Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class-wise Attendance & Academic Comparison Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900">
                Class-Wise Attendance & Academic Performance Distribution
              </h3>
              <p className="text-xs text-slate-500">Live comparison across grades for AY {academicYear}</p>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-blue-700 hover:underline">
              Full Analytics →
            </button>
          </div>
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.classDistribution} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="className" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="avgAttendance" name="Attendance %" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avgAcademicScore" name="Academic Mean %" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Executive Approval Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Pending Approvals Queue</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {data.stats.pendingApprovalsCount} Pending
              </span>
            </div>

            <div className="space-y-3">
              {data.pendingAnnouncements.map((ann: any) => (
                <div key={ann.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      Announcement Draft
                    </span>
                    <span className="text-[11px] text-slate-500">{ann.authorName}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1.5">{ann.title}</div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{ann.content}</p>
                  {data.role === 'principal' && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        onClick={() => handleQuickApproveAnnouncement(ann.id, 'approved')}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Publish</span>
                      </button>
                      <button
                        onClick={() => handleQuickApproveAnnouncement(ann.id, 'rejected')}
                        className="py-1.5 px-2.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Return</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {data.pendingLeaves.slice(0, 2).map((lv: any) => (
                <div
                  key={lv.id}
                  onClick={() => navigate('/leave-requests')}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">Leave Request: {lv.leaveType.toUpperCase()}</div>
                    <div className="text-[11px] text-slate-500">{lv.startDate} to {lv.endDate}</div>
                  </div>
                  <span className="text-xs font-semibold text-blue-700">Review →</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/leave-requests')}
            className="mt-4 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
          >
            View All Pending Operations
          </button>
        </div>
      </div>

      {/* Curriculum Progress & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <span>Department Curriculum Completion Tracker</span>
            </h3>
            <button onClick={() => navigate('/directory')} className="text-xs font-semibold text-blue-700 hover:underline">
              Manage Subjects
            </button>
          </div>
          <div className="space-y-3">
            {data.subjects.map((sub: any) => (
              <div key={sub.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {sub.name} <span className="font-mono text-slate-400">({sub.code})</span>
                  </span>
                  <span className="font-bold text-blue-700">{sub.curriculumProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${sub.curriculumProgress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-base text-slate-900">Recent Institutional Audit Trail</h3>
            <button onClick={() => navigate('/settings')} className="text-xs font-semibold text-blue-700 hover:underline">
              Full Audit Log
            </button>
          </div>
          <div className="space-y-2.5">
            {data.auditLogs.slice(0, 5).map((log: any) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">{log.summary}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    By {log.actorName} ({log.actorRole}) • {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                  {log.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

