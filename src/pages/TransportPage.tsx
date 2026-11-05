import React, { useState, useEffect, useCallback } from 'react';
import {
  Bus,
  MapPin,
  Phone,
  User,
  AlertTriangle,
  ShieldCheck,
  Clock,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function TransportPage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueRouteId, setIssueRouteId] = useState('1');
  const [issueType, setIssueType] = useState('Schedule Delay');
  const [issueDesc, setIssueDesc] = useState('');

  // Staff route notice update
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [routeNotice, setRouteNotice] = useState('');

  const loadTransport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/transport');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load transport data', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTransport();
  }, [loadTransport]);

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/transport/issues', {
        method: 'POST',
        body: JSON.stringify({
          routeId: Number(issueRouteId),
          issueType,
          description: issueDesc,
        }),
      });
      setIssueOpen(false);
      setIssueDesc('');
      showToast('Transport Issue Logged', 'Transport Operations & Principal’s office notified.', 'success');
      loadTransport();
    } catch (err: any) {
      showToast('Failed to report issue', err.message, 'error');
    }
  };

  const handleUpdateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    try {
      await apiFetch(`/api/transport/routes/${editingRoute.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notice: routeNotice }),
      });
      setEditingRoute(null);
      showToast('Route Advisory Published', 'Students assigned to this route have been notified.', 'success');
      loadTransport();
    } catch (err: any) {
      showToast('Update failed', err.message, 'error');
    }
  };

  if (loading || !data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const isStaff = user?.role === 'principal' || user?.role === 'coordinator';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-700" />
            <span>Campus Transport Fleet, Routes & Timings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Assigned bus routes, pickup/drop-off schedules, verified driver & attendant directory, and issue reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Live GPS Telemetry: Reserved for Phase 2 Cloud Integration</span>
          </span>
          <button
            onClick={() => setIssueOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Report Transport Issue</span>
          </button>
        </div>
      </div>

      {/* Student's Assigned Bus Highlight */}
      {data.studentRoute && (
        <div className="bg-blue-950 text-white rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase">
              My Assigned School Bus • {data.studentRoute.routeNumber}
            </span>
            <span className="text-xs font-mono text-blue-200">
              Transport Control Desk: {data.studentRoute.transportContact}
            </span>
          </div>

          <h3 className="font-heading text-xl font-bold">{data.studentRoute.routeName}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-blue-800/70 text-xs">
            <div>
              <div className="text-blue-300">Assigned Vehicle</div>
              <div className="font-bold text-sm mt-0.5">
                {data.studentRoute.vehicle?.busNumber} ({data.studentRoute.vehicle?.registrationNo})
              </div>
              <div className="text-blue-300 mt-0.5">{data.studentRoute.vehicle?.model}</div>
            </div>
            <div>
              <div className="text-blue-300">Verified Driver</div>
              <div className="font-bold text-sm mt-0.5">{data.studentRoute.driver?.fullName}</div>
              <div className="text-blue-300 mt-0.5">{data.studentRoute.driver?.phone}</div>
            </div>
            <div>
              <div className="text-blue-300">Bus Attendant</div>
              <div className="font-bold text-sm mt-0.5">{data.studentRoute.attendantName}</div>
              <div className="text-blue-300 mt-0.5">{data.studentRoute.attendantPhone}</div>
            </div>
            <div>
              <div className="text-blue-300">Departure Timings</div>
              <div className="font-bold text-sm mt-0.5">
                Morning: {data.studentRoute.morningDeparture}
              </div>
              <div className="text-blue-300 mt-0.5">Afternoon: {data.studentRoute.afternoonDeparture}</div>
            </div>
          </div>
        </div>
      )}

      {/* All Routes Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(data.routes || []).map((route: any) => (
          <div key={route.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-xs font-bold">
                  {route.routeNumber} • {route.vehicle?.busNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                  {route.status}
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900">{route.routeName}</h3>

              <div className="grid grid-cols-2 gap-3 mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-semibold text-slate-900">Driver: {route.driver?.fullName}</div>
                    <div className="text-slate-500">{route.driver?.phone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-semibold text-slate-900">Attendant: {route.attendantName}</div>
                    <div className="text-slate-500">{route.attendantPhone}</div>
                  </div>
                </div>
              </div>

              {/* Stops Timeline */}
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Scheduled Pickup & Drop-Off Points
                </div>
                <div className="space-y-2">
                  {(route.stops || []).map((stop: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>{stop.name}</span>
                      </div>
                      <div className="font-mono text-slate-500">
                        AM: {stop.morningTime} • PM: {stop.afternoonTime}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {route.notice && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <strong>Route Notice:</strong> {route.notice}
                </div>
              )}
            </div>

            {isStaff && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">{route.assignedStudentCount} students assigned</span>
                <button
                  onClick={() => {
                    setEditingRoute(route);
                    setRouteNotice(route.notice || '');
                  }}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  Update Route Advisory →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reported Transport Issues */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Transport Issue & Support Log</h3>
        <div className="space-y-3">
          {(data.issues || []).map((iss: any) => (
            <div key={iss.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900">{iss.issueType}</div>
                <p className="text-xs text-slate-600 mt-0.5">{iss.description}</p>
                {iss.resolutionNote && (
                  <p className="text-xs text-emerald-700 font-medium mt-1">Resolution: {iss.resolutionNote}</p>
                )}
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                {iss.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Report Issue Modal */}
      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setIssueOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Report a Transport Issue</h3>
              <button onClick={() => setIssueOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReportIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route</label>
                <select
                  value={issueRouteId}
                  onChange={e => setIssueRouteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  {(data.routes || []).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.routeNumber} — {r.routeName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Category</label>
                <select
                  value={issueType}
                  onChange={e => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="Schedule Delay">Schedule Delay</option>
                  <option value="Pickup Point Change Request">Pickup Point Change Request</option>
                  <option value="Lost Item on Bus">Lost Item on Bus</option>
                  <option value="Safety / Conduct Feedback">Safety / Conduct Feedback</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Details</label>
                <textarea
                  rows={3}
                  required
                  value={issueDesc}
                  onChange={e => setIssueDesc(e.target.value)}
                  placeholder="Describe timing, stop location, or issue details..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIssueOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Edit Route Notice Modal */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setEditingRoute(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-3">
              Publish Transport Notice ({editingRoute.routeNumber})
            </h3>
            <form onSubmit={handleUpdateNotice} className="space-y-4">
              <textarea
                rows={3}
                value={routeNotice}
                onChange={e => setRouteNotice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRoute(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Update Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

