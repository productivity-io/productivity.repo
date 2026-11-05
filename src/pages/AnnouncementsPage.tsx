import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  ShieldAlert,
  Search,
  Plus,
  Paperclip,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, uploadLocalFile } from '../lib/api';

export function AnnouncementsPage() {
  const { user, showToast } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('academic');
  const [priority, setPriority] = useState('normal');
  const [expiresAt, setExpiresAt] = useState('2026-12-15');
  const [emergencyInstructions, setEmergencyInstructions] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Rejection / Edit modal
  const [rejectModalId, setRejectModalId] = useState<number | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState('');

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/announcements');
      setAnnouncements(data.announcements || []);
    } catch (err: any) {
      showToast('Error loading announcements', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleMarkRead = async (id: number) => {
    try {
      await apiFetch(`/api/announcements/${id}/read`, { method: 'POST' });
      setAnnouncements(prev =>
        prev.map(a => (a.id === id ? { ...a, isRead: true, readCount: (a.readCount || 0) + 1 } : a))
      );
    } catch {
      // ignore
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      let uploaded: { url: string; fileName: string } | null = null;
      if (attachmentFile) {
        uploaded = await uploadLocalFile(attachmentFile, 'circulars');
      }

      const res = await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          category: isEmergencyMode ? 'emergency' : category,
          priority: isEmergencyMode ? 'critical' : priority,
          expiresAt,
          isEmergency: isEmergencyMode,
          emergencyInstructions: isEmergencyMode ? emergencyInstructions : null,
          attachmentUrl: uploaded?.url || null,
          attachmentName: uploaded?.fileName || null,
        }),
      });

      setCreateOpen(false);
      setTitle('');
      setContent('');
      setEmergencyInstructions('');
      setAttachmentFile(null);

      if (res.approvalStatus === 'pending_approval') {
        showToast('Submitted for Principal Approval', 'Your announcement has been queued for executive sign-off.', 'success');
      } else {
        showToast(
          isEmergencyMode ? 'Emergency Alert Broadcasted' : 'Announcement Published',
          'Visible immediately across target dashboards.',
          'success'
        );
      }
      loadAnnouncements();
    } catch (err: any) {
      showToast('Failed to publish', err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (id: number, status: 'approved' | 'rejected', remarks?: string) => {
    try {
      await apiFetch(`/api/announcements/${id}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus: status, rejectionRemarks: remarks }),
      });
      setRejectModalId(null);
      setRejectionRemarks('');
      showToast(`Announcement ${status}`, `Updated status to ${status}.`, 'success');
      loadAnnouncements();
    } catch (err: any) {
      showToast('Action failed', err.message, 'error');
    }
  };

  const handleResubmit = async (ann: any) => {
    try {
      await apiFetch(`/api/announcements/${ann.id}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: ann.title,
          content: ann.content + ' (Revised per Principal feedback)',
        }),
      });
      showToast('Resubmitted for Approval', 'Sent back to the Principal’s queue.', 'success');
      loadAnnouncements();
    } catch (err: any) {
      showToast('Resubmit failed', err.message, 'error');
    }
  };

  const filtered = announcements.filter(a => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (readFilter === 'unread' && a.isRead) return false;
    if (readFilter === 'read' && !a.isRead) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || a.authorName.toLowerCase().includes(q);
    }
    return true;
  });

  const canPublish = user?.role === 'teacher' || user?.role === 'coordinator' || user?.role === 'principal';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-700" />
            <span>Announcements, Circulars & Emergency Alerts</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Official school communications, academic notices, and real-time safety protocols.
          </p>
        </div>

        {canPublish && (
          <div className="flex flex-wrap items-center gap-2">
            {user?.role === 'principal' && (
              <button
                onClick={() => {
                  setIsEmergencyMode(true);
                  setCreateOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Broadcast Emergency Alert</span>
              </button>
            )}
            <button
              onClick={() => {
                setIsEmergencyMode(false);
                setCategory(user?.role === 'teacher' ? 'class_specific' : 'school_wide');
                setCreateOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{user?.role === 'coordinator' ? 'Draft Announcement' : 'New Announcement'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search announcements by title, keyword, or author..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['all', 'emergency', 'school_wide', 'academic', 'class_specific', 'event'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                categoryFilter === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}

          <select
            aria-label="Read status filter"
            value={readFilter}
            onChange={e => setReadFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-36 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-800">No announcements match your filter</div>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search query or switching categories.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(ann => {
            const isEmergency = Boolean(ann.isEmergency || ann.category === 'emergency');
            return (
              <div
                key={ann.id}
                onClick={() => !ann.isRead && handleMarkRead(ann.id)}
                className={`rounded-2xl border p-6 transition-all ${
                  isEmergency
                    ? 'bg-red-50/70 border-red-300 shadow-sm'
                    : ann.approvalStatus === 'pending_approval'
                    ? 'bg-amber-50/40 border-amber-200'
                    : ann.approvalStatus === 'rejected'
                    ? 'bg-red-50/30 border-red-200'
                    : 'bg-white border-slate-200 hover:border-blue-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {isEmergency ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>CRITICAL EMERGENCY ALERT</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {ann.category.replace('_', ' ')}
                      </span>
                    )}

                    {ann.approvalStatus === 'pending_approval' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3" />
                        <span>Pending Principal Approval</span>
                      </span>
                    )}

                    {ann.approvalStatus === 'rejected' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        <XCircle className="w-3 h-3" />
                        <span>Returned for Revision</span>
                      </span>
                    )}

                    {!ann.isRead && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-700 text-white">
                        NEW
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>Published: {new Date(ann.publishedAt).toLocaleDateString()}</span>
                    {ann.expiresAt && <span>Expires: {ann.expiresAt.slice(0, 10)}</span>}
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Eye className="w-3.5 h-3.5" />
                      {ann.readCount || 1}
                    </span>
                  </div>
                </div>

                <h3 className={`font-heading text-lg font-bold ${isEmergency ? 'text-red-950' : 'text-slate-900'}`}>
                  {ann.title}
                </h3>
                <p className={`text-sm mt-2 leading-relaxed whitespace-pre-line ${isEmergency ? 'text-red-900' : 'text-slate-600'}`}>
                  {ann.content}
                </p>

                {isEmergency && ann.emergencyInstructions && (
                  <div className="mt-4 p-4 rounded-xl bg-white/90 border border-red-200 text-xs text-red-900 whitespace-pre-line">
                    <strong className="block font-bold uppercase tracking-wider text-red-700 mb-1">
                      Emergency Safety Instructions:
                    </strong>
                    {ann.emergencyInstructions}
                  </div>
                )}

                {ann.rejectionRemarks && (
                  <div className="mt-3 p-3 rounded-xl bg-red-100/70 border border-red-200 text-xs text-red-800">
                    <strong>Principal Remarks:</strong> {ann.rejectionRemarks}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-medium text-slate-500">
                    Issued by <strong className="text-slate-800">{ann.authorName}</strong>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {ann.attachmentName && (
                      <a
                        href={ann.attachmentUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => {
                          if (ann.attachmentUrl?.startsWith('/uploads/circulars/term1')) {
                            e.preventDefault();
                            showToast('Downloading Circular', `Saved ${ann.attachmentName}`, 'success');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-blue-700" />
                        <span>{ann.attachmentName}</span>
                      </a>
                    )}

                    {/* Principal Approval Controls */}
                    {user?.role === 'principal' && ann.approvalStatus === 'pending_approval' && (
                      <>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleApproval(ann.id, 'approved');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Publish</span>
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setRejectModalId(ann.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject with Remarks</span>
                        </button>
                      </>
                    )}

                    {/* Coordinator Resubmit Control */}
                    {user?.role === 'coordinator' && ann.approvalStatus === 'rejected' && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleResubmit(ann);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Revise & Resubmit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Announcement / Emergency Alert Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isEmergencyMode ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {isEmergencyMode ? <ShieldAlert className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">
                    {isEmergencyMode
                      ? 'Broadcast Critical Emergency Alert'
                      : user?.role === 'coordinator'
                      ? 'Draft Announcement (Submits for Principal Approval)'
                      : 'Publish Announcement'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isEmergencyMode
                      ? 'Bypasses approval queues and displays prominently on all dashboards'
                      : 'Select target category, expiry date, and attachments'}
                  </p>
                </div>
              </div>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Announcement Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Science Symposium Registration or Weather Safety Advisory"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              {!isEmergencyMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                    >
                      {user?.role !== 'teacher' && <option value="school_wide">School-Wide</option>}
                      <option value="class_specific">Class-Specific</option>
                      <option value="academic">Academic</option>
                      <option value="event">Event Notice</option>
                      {user?.role !== 'teacher' && <option value="transport">Transport</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Content</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write the full announcement details..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              {isEmergencyMode && (
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">
                    Mandatory Emergency Protocol Instructions
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={emergencyInstructions}
                    onChange={e => setEmergencyInstructions(e.target.value)}
                    placeholder="1. Proceed to assembly point...\n2. Contact Transport Control Desk..."
                    className="w-full px-3.5 py-2 rounded-xl border border-red-200 bg-red-50/30 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attachment (PDF, Word, Image — Max 10MB)
                </label>
                <input
                  type="file"
                  onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold"
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
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold ${
                    isEmergencyMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
                  }`}
                >
                  {submitting
                    ? 'Publishing...'
                    : isEmergencyMode
                    ? 'Broadcast Alert Now'
                    : user?.role === 'coordinator'
                    ? 'Submit for Approval'
                    : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject with Remarks Modal */}
      {rejectModalId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setRejectModalId(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-2">
              Return Announcement for Revision
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Provide constructive feedback for the Academic Coordinator so they can edit and resubmit.
            </p>
            <textarea
              rows={3}
              value={rejectionRemarks}
              onChange={e => setRejectionRemarks(e.target.value)}
              placeholder="e.g. Please attach the updated auditorium seating chart before publishing."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApproval(rejectModalId, 'rejected', rejectionRemarks)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Return with Remarks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

