import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function CommunicationPage() {
  const { user, showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('academic');
  const [issueDescription, setIssueDescription] = useState('');

  const loadCommunication = useCallback(async () => {
    try {
      const res = await apiFetch('/api/communication');
      setData(res);
      if (!selectedReqId && res.requests?.length) {
        setSelectedReqId(res.requests[0].id);
      }
      if (!recipientId && res.recipients?.length) {
        const firstStaff = res.recipients.find((r: any) => r.role !== 'student') || res.recipients[0];
        if (firstStaff) setRecipientId(String(firstStaff.id));
      }
    } catch (err: any) {
      showToast('Failed to load communications', err.message, 'error');
    }
  }, [selectedReqId, recipientId, showToast]);

  useEffect(() => {
    loadCommunication();
  }, [loadCommunication]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/communication', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: Number(recipientId),
          subject,
          category,
          issueDescription,
        }),
      });
      setCreateOpen(false);
      setSubject('');
      setIssueDescription('');
      setSelectedReqId(res.id);
      showToast('Conversation Request Sent', 'Recipient notified.', 'success');
      loadCommunication();
    } catch (err: any) {
      showToast('Request failed', err.message, 'error');
    }
  };

  const handleStatusChange = async (id: number, status: 'accepted' | 'rejected') => {
    try {
      await apiFetch(`/api/communication/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          responseNote: status === 'accepted' ? 'Request accepted — let us discuss below.' : 'Please consult during scheduled homeroom hours.',
        }),
      });
      showToast(`Request ${status}`, `Conversation status updated to ${status}.`, 'success');
      loadCommunication();
    } catch (err: any) {
      showToast('Status update failed', err.message, 'error');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqId || !newMessage.trim()) return;
    try {
      await apiFetch(`/api/communication/${selectedReqId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage }),
      });
      setNewMessage('');
      loadCommunication();
    } catch (err: any) {
      showToast('Message failed', err.message, 'error');
    }
  };

  if (!data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const activeThread = (data.requests || []).find((r: any) => r.id === selectedReqId) || data.requests?.[0];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-700" />
            <span>Academic Communication & Consultation Hub</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Structured conversation requests between students, subject faculty, academic coordinators, and the Principal’s office.
          </p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Request New Conversation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List of Requests */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 max-h-[600px] overflow-y-auto">
          <div className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Conversations ({data.requests?.length || 0})
          </div>
          {(data.requests || []).map((req: any) => (
            <button
              key={req.id}
              type="button"
              onClick={() => setSelectedReqId(req.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                activeThread?.id === req.id
                  ? 'bg-blue-50/80 border-blue-300'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {req.category}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    req.status === 'accepted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : req.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {req.status}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1.5 truncate">{req.subject}</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {req.requesterName} ↔ {req.recipientName}
              </div>
            </button>
          ))}
        </div>

        {/* Right Active Conversation Thread */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 flex flex-col min-h-[520px]">
          {activeThread ? (
            <>
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-base text-slate-900">{activeThread.subject}</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        activeThread.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeThread.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {activeThread.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Between <strong>{activeThread.requesterName}</strong> ({activeThread.requesterRole}) and{' '}
                    <strong>{activeThread.recipientName}</strong> ({activeThread.recipientRole})
                  </p>
                </div>

                {user?.role !== 'student' && activeThread.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleStatusChange(activeThread.id, 'accepted')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Request</span>
                    </button>
                    <button
                      onClick={() => handleStatusChange(activeThread.id, 'rejected')}
                      className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Messages Feed */}
              <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-96 bg-slate-50/50">
                {(activeThread.messages || []).map((msg: any) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className="text-[11px] text-slate-400 mb-1 px-1">
                        {msg.senderName} ({msg.senderRole}) • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div
                        className={`max-w-lg px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                          isMine
                            ? 'bg-blue-700 text-white rounded-br-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  disabled={activeThread.status === 'rejected'}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={
                    activeThread.status === 'rejected'
                      ? 'This request was declined.'
                      : 'Write a message in this thread...'
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={activeThread.status === 'rejected'}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Select a conversation to view messages.
            </div>
          )}
        </div>
      </div>

      {/* Create Request Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">Request a Conversation</h3>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Recipient</label>
                <select
                  value={recipientId}
                  onChange={e => setRecipientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  {(data.recipients || []).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName} ({r.role.toUpperCase()} • {r.schoolId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Topic Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="academic">Academic Doubt / Coursework</option>
                  <option value="attendance">Attendance & Leave</option>
                  <option value="counseling">Mentorship & Guidance</option>
                  <option value="administrative">Administrative / Event Coordination</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Heading</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Clarification on Calculus Lab Assignment"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Describe Your Question / Issue</label>
                <textarea
                  rows={3}
                  required
                  value={issueDescription}
                  onChange={e => setIssueDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
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

