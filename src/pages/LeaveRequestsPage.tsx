import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Plus,
  CheckCircle2,
  XCircle,
  Paperclip,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, uploadLocalFile } from '../lib/api';

export function LeaveRequestsPage() {
  const { user, showToast } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [startDate, setStartDate] = useState('2026-11-15');
  const [endDate, setEndDate] = useState('2026-11-16');
  const [leaveType, setLeaveType] = useState('medical');
  const [reason, setReason] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/leaves');
      setLeaves(res.leaves || []);
    } catch (err: any) {
      showToast('Failed to load leave requests', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let uploaded: { url: string; fileName: string } | null = null;
      if (docFile) {
        uploaded = await uploadLocalFile(docFile, 'leaves');
      }
      await apiFetch('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate,
          leaveType,
          reason,
          documentUrl: uploaded?.url || null,
          documentName: uploaded?.fileName || null,
        }),
      });
      setApplyOpen(false);
      setReason('');
      setDocFile(null);
      showToast('Leave Application Submitted', 'Forwarded to your Class Teacher & Academic Coordinator.', 'success');
      loadLeaves();
    } catch (err: any) {
      showToast('Application failed', err.message, 'error');
    }
  };

  const handleReview = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/leaves/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewerRemarks: status === 'approved' ? 'Leave approved; please catch up on class notes.' : 'Conflicts with scheduled practical examination.',
        }),
      });
      showToast(`Leave ${status}`, `Application marked as ${status}.`, 'success');
      loadLeaves();
    } catch (err: any) {
      showToast('Review failed', err.message, 'error');
    }
  };

  const isStaff = user?.role !== 'student';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-700" />
            <span>Leave Applications & Approval Workflow</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Apply for medical, family, or competition leave with supporting documents and track approval status.
          </p>
        </div>

        <button
          onClick={() => setApplyOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      ) : (
        <div className="space-y-4">
          {leaves.map(lv => (
            <div key={lv.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-50 text-blue-700">
                    {lv.leaveType} Leave
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {lv.applicantName} ({lv.className})
                  </span>
                </div>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase ${
                    lv.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : lv.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {lv.status}
                </span>
              </div>

              <div className="text-sm font-mono font-bold text-slate-800">
                Dates: {lv.startDate} → {lv.endDate}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5">{lv.reason}</p>

              {lv.reviewerRemarks && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <strong>Faculty/Coordinator Remarks:</strong> {lv.reviewerRemarks}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  {lv.documentName && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <Paperclip className="w-3.5 h-3.5" />
                      {lv.documentName}
                    </span>
                  )}
                </div>

                {isStaff && lv.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReview(lv.id, 'approved')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Leave</span>
                    </button>
                    <button
                      onClick={() => handleReview(lv.id, 'rejected')}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply for Leave Modal */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setApplyOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Submit Leave Request</h3>
              <button onClick={() => setApplyOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApply} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="medical">Medical Leave</option>
                  <option value="family">Family Event</option>
                  <option value="competition">External Competition / Olympiad</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Provide details..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supporting Document (Optional)</label>
                <input
                  type="file"
                  onChange={e => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApplyOpen(false)}
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

