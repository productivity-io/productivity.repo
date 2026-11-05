import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Users,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function CalendarEventsPage() {
  const { user, showToast } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('academic');
  const [startDate, setStartDate] = useState('2026-11-16');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [location, setLocation] = useState('Founders Auditorium');
  const [isPersonal, setIsPersonal] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/events');
      setEvents(res.events || []);
    } catch (err: any) {
      showToast('Failed to load calendar', err.message, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          startDate,
          endDate: startDate,
          startTime,
          location,
          isPersonalReminder: user?.role === 'student' ? true : isPersonal,
          participantCount: isPersonal ? 1 : 120,
        }),
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      showToast('Calendar Updated', 'Event added to schedule.', 'success');
      loadEvents();
    } catch (err: any) {
      showToast('Failed to add event', err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
    showToast('Removed from Calendar', 'Event deleted.');
    loadEvents();
  };

  const filtered = events.filter(ev => {
    if (categoryFilter === 'personal') return ev.isPersonalReminder;
    if (categoryFilter !== 'all' && ev.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-700" />
            <span>Institutional Calendar, Events & Personal Reminders</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Holidays, cultural showcases, sports championships, competitions, exam dates, and personal study reminders.
          </p>
        </div>

        <button
          onClick={() => {
            setIsPersonal(user?.role === 'student');
            setModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{user?.role === 'student' ? 'Add Personal Reminder' : 'Schedule Event / Reminder'}</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'competition', 'cultural', 'sports', 'examination', 'holiday', 'deadline', 'personal'].map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize ${
              categoryFilter === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(ev => (
          <div key={ev.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    ev.isPersonalReminder
                      ? 'bg-amber-100 text-amber-800'
                      : ev.category === 'holiday'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {ev.isPersonalReminder ? 'Personal Reminder' : ev.category}
                </span>
                <span className="font-mono text-xs font-bold text-slate-700">
                  {ev.startDate} {ev.endDate !== ev.startDate ? `→ ${ev.endDate}` : ''}
                </span>
              </div>

              <h3 className="font-heading font-bold text-base text-slate-900">{ev.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">{ev.description}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {ev.startTime || 'All Day'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {ev.location}
                </span>
                {!ev.isPersonalReminder && ev.participantCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {ev.participantCount}
                  </span>
                )}
              </div>

              {(ev.isPersonalReminder || user?.role === 'principal' || user?.role === 'coordinator') && (
                <button
                  onClick={() => handleDelete(ev.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Remove event"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">
                {user?.role === 'student' ? 'Add Personal Study Reminder' : 'Schedule Event or Reminder'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="academic">Academic</option>
                    <option value="competition">Competition</option>
                    <option value="cultural">Cultural</option>
                    <option value="sports">Sports</option>
                    <option value="holiday">Holiday</option>
                    <option value="deadline">Deadline</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Save to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

