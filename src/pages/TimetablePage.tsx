import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  User,
  Coffee,
  AlertCircle,
  Edit3,
  X,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { MetricCard } from '../components/ui/MetricCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function TimetablePage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useEchoViewState('view');
  const [selectedDay, setSelectedDay] = useEchoViewState('day');
  const [selectedClassSection, setSelectedClassSection] = useState<string>('1-1');
  const [teacherViewMode, setTeacherViewMode] = useState<'class' | 'personal'>('class');

  // Edit slot modal
  const [editingSlot, setEditingSlot] = useState<any | null>(null);
  const [slotStatus, setSlotStatus] = useState('scheduled');
  const [subTeacherId, setSubTeacherId] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/timetable');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load timetable', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    try {
      await apiFetch(`/api/timetable/${editingSlot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: slotStatus,
          substitutionTeacherId: subTeacherId ? Number(subTeacherId) : null,
          statusNote,
        }),
      });
      setEditingSlot(null);
      showToast('Timetable Updated', 'Students and faculty have been notified of the schedule change.', 'success');
      loadTimetable();
    } catch (err: any) {
      showToast('Update failed', err.message, 'error');
    }
  };

  if (loading || !data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const [classId, sectionId] = selectedClassSection.split('-').map(Number);
  const isStaff = user?.role !== 'student';

  const filteredSlots = (data.timetables || []).filter((t: any) => {
    if (user?.role === 'teacher' && teacherViewMode === 'personal') {
      const myTeacher = (data.teachers || []).find((tc: any) => tc.userId === user.id);
      if (myTeacher) {
        return t.teacherId === myTeacher.id || t.substitutionTeacherId === myTeacher.id;
      }
    }
    return t.classId === classId && t.sectionId === sectionId;
  });

  const activeAlerts = filteredSlots.filter((s: any) => s.status === 'substituted' || s.status === 'cancelled');
  const labPeriods = filteredSlots.filter((s: any) => (s.roomNumber || '').toLowerCase().includes('lab')).length;

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Scheduled Periods"
          value={filteredSlots.length}
          trend={{ direction: 'neutral', value: '7 per day' }}
          icon={<Clock className="w-5 h-5" />}
          iconColor="slate"
        />
        <MetricCard
          title="Active Substitutions"
          value={activeAlerts.length}
          trend={{ direction: activeAlerts.length > 0 ? 'down' : 'up', value: activeAlerts.length > 0 ? 'Notice active' : 'All regular faculty' }}
          icon={<AlertCircle className="w-5 h-5" />}
          iconColor={activeAlerts.length > 0 ? 'amber' : 'emerald'}
        />
        <MetricCard
          title="Lab / Practical Hours"
          value={labPeriods}
          trend={{ direction: 'neutral', value: 'Physics & Chem labs' }}
          icon={<Layers className="w-5 h-5" />}
          iconColor="blue"
        />
        <MetricCard
          title="Academic Session"
          value="Week 12"
          subtitle="Term I In-Session"
          trend={{ direction: 'neutral', value: 'On track' }}
          icon={<Calendar className="w-5 h-5" />}
          iconColor="slate"
        />
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-700" />
            <span>Academic Schedule & Room Allocations</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Synchronized period schedules, laboratory practical allocations, break intervals, and live substitution notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'teacher' && (
            <div className="flex p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setTeacherViewMode('class')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  teacherViewMode === 'class' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Class Schedule
              </button>
              <button
                onClick={() => setTeacherViewMode('personal')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  teacherViewMode === 'personal' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                My Teaching Slots
              </button>
            </div>
          )}

          {isStaff && teacherViewMode === 'class' && (
            <select
              value={selectedClassSection}
              onChange={e => setSelectedClassSection(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="1-1">Grade 10 — Section A (Room 302)</option>
              <option value="1-2">Grade 10 — Section B (Room 304)</option>
              <option value="2-3">Grade 9 — Section A (Room 201)</option>
              <option value="3-4">Grade 11 — Section A (Room 405)</option>
            </select>
          )}

          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                viewMode === 'weekly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                viewMode === 'daily' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Daily Focus
            </button>
          </div>
        </div>
      </div>

      {/* Substitution / Cancelled Class Notifications Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Active Substitution & Schedule Advisories
              </div>
              {activeAlerts.map((al: any) => (
                <div key={al.id} className="text-xs text-amber-800">
                  <strong>{al.dayOfWeek} • Period #{al.periodNumber} ({al.subjectName}):</strong>{' '}
                  {al.statusNote || `Status updated to ${al.status.toUpperCase()}`}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily Selector if in Daily Mode */}
      {viewMode === 'daily' && (
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                selectedDay === day ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      )}

      {/* Timetable Display */}
      <div className="grid grid-cols-1 gap-6">
        {(viewMode === 'weekly' ? DAYS : [selectedDay]).map(day => {
          const daySlots = filteredSlots
            .filter((s: any) => s.dayOfWeek === day)
            .sort((a: any, b: any) => a.periodNumber - b.periodNumber);

          return (
            <div key={day} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-heading font-bold text-base text-slate-900">{day}</h3>
                <span className="text-xs font-medium text-slate-500">{daySlots.length} Scheduled Slots</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {daySlots.map((slot: any) => (
                  <div
                    key={slot.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      slot.isBreak
                        ? 'bg-slate-50 border-slate-200/70'
                        : slot.status === 'substituted'
                        ? 'bg-amber-50/60 border-amber-300'
                        : slot.status === 'cancelled'
                        ? 'bg-red-50/50 border-red-200'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold text-slate-500">
                          {slot.startTime} – {slot.endTime}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            slot.isBreak
                              ? 'bg-slate-200 text-slate-700'
                              : slot.status === 'substituted'
                              ? 'bg-amber-200 text-amber-900'
                              : slot.status === 'cancelled'
                              ? 'bg-red-200 text-red-800'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {slot.isBreak ? 'Break' : slot.status}
                        </span>
                      </div>

                      <div className="font-heading font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        {slot.isBreak && <Coffee className="w-4 h-4 text-slate-400" />}
                        <span>{slot.subjectName}</span>
                      </div>

                      {!slot.isBreak && (
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {slot.status === 'substituted' && slot.substitutionTeacherName
                                ? `${slot.substitutionTeacherName} (Sub)`
                                : slot.teacherName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{slot.roomNumber}</span>
                          </div>
                          {slot.statusNote && (
                            <p className="text-[11px] font-medium text-amber-900 bg-amber-100/70 p-1.5 rounded-lg mt-1.5">
                              {slot.statusNote}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {isStaff && !slot.isBreak && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSlot(slot);
                          setSlotStatus(slot.status);
                          setSubTeacherId(slot.substitutionTeacherId ? String(slot.substitutionTeacherId) : '');
                          setStatusNote(slot.statusNote || '');
                        }}
                        className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Manage Slot / Substitute</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Timetable Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setEditingSlot(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">
                Update Period #{editingSlot.periodNumber} ({editingSlot.dayOfWeek})
              </h3>
              <button onClick={() => setEditingSlot(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Period Status</label>
                <select
                  value={slotStatus}
                  onChange={e => setSlotStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="scheduled">Scheduled (Normal)</option>
                  <option value="substituted">Substituted</option>
                  <option value="cancelled">Cancelled / Merged</option>
                </select>
              </div>

              {slotStatus === 'substituted' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Substitute Faculty</label>
                  <select
                    value={subTeacherId}
                    onChange={e => setSubTeacherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="">Select Teacher...</option>
                    {(data.teachers || []).map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notification Note for Students</label>
                <textarea
                  rows={2}
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  placeholder="e.g. Substituted by Ms. Sophia Chen in Lab 2B..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Save & Notify Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

