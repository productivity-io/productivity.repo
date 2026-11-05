import React, { useState, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  Plus,
  MapPin,
  Calendar,
  CheckCircle2,
  Archive,
  Hand,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, uploadLocalFile } from '../lib/api';

export function LostAndFoundPage() {
  const { user, showToast } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found' | 'archived'>('all');

  // Report Modal
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<'lost' | 'found'>('lost');
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('electronics');
  const [location, setLocation] = useState('');
  const [dateReported, setDateReported] = useState('2026-11-05');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Claim Modal
  const [claimingItem, setClaimingItem] = useState<any | null>(null);
  const [claimNote, setClaimNote] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/lost-found');
      setItems(res.items || []);
    } catch (err: any) {
      showToast('Failed to load Lost & Found', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        const up = await uploadLocalFile(photoFile, 'lostfound');
        photoUrl = up.url;
      }
      await apiFetch('/api/lost-found', {
        method: 'POST',
        body: JSON.stringify({
          type: reportType,
          itemName,
          description,
          category,
          location,
          dateReported,
          photoUrl,
        }),
      });
      setReportOpen(false);
      setItemName('');
      setDescription('');
      setLocation('');
      setPhotoFile(null);
      showToast('Report Published', `Listed under ${reportType.toUpperCase()} items.`, 'success');
      loadItems();
    } catch (err: any) {
      showToast('Failed to submit report', err.message, 'error');
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingItem) return;
    try {
      await apiFetch(`/api/lost-found/${claimingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'claim', claimNote }),
      });
      setClaimingItem(null);
      setClaimNote('');
      showToast('Claim Request Submitted', 'Awaiting Coordinator/Principal verification.', 'success');
      loadItems();
    } catch (err: any) {
      showToast('Claim failed', err.message, 'error');
    }
  };

  const handleAdminStatus = async (id: number, status: string, verificationNote: string) => {
    try {
      await apiFetch(`/api/lost-found/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, verificationNote }),
      });
      showToast('Status Updated', `Item marked as ${status}.`, 'success');
      loadItems();
    } catch (err: any) {
      showToast('Update failed', err.message, 'error');
    }
  };

  const isStaff = user?.role === 'coordinator' || user?.role === 'principal';

  const filtered = items.filter(it => {
    if (typeFilter === 'archived') return it.status === 'archived';
    if (it.status === 'archived') return false;
    if (typeFilter !== 'all' && it.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-700" />
            <span>Campus Lost & Found Registry</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Report lost or found belongings, submit ownership claims, and track administrative verification.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setReportType('lost');
              setReportOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report Lost Item</span>
          </button>
          <button
            onClick={() => {
              setReportType('found');
              setReportOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report Found Item</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'All Active Reports' },
          { id: 'lost', label: 'Lost Items' },
          { id: 'found', label: 'Found Items' },
          { id: 'archived', label: 'Archived / Resolved' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTypeFilter(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              typeFilter === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      item.type === 'lost' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-700">
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="font-heading font-bold text-base text-slate-900">{item.itemName}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">{item.description}</p>

                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.dateReported}</span>
                  </div>
                </div>

                {item.claimNote && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <strong>Claim Note:</strong> {item.claimNote}
                  </div>
                )}

                {item.verificationNote && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    <strong>Coordinator Verification:</strong> {item.verificationNote}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Contact: {item.contactInfo}</span>
                <div className="flex items-center gap-2">
                  {item.status !== 'claimed' && item.status !== 'archived' && (
                    <button
                      onClick={() => setClaimingItem(item)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>Submit Claim</span>
                    </button>
                  )}

                  {isStaff && item.status !== 'archived' && (
                    <>
                      <button
                        onClick={() => handleAdminStatus(item.id, 'claimed', 'Verified ownership and handed over.')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Claimed</span>
                      </button>
                      <button
                        onClick={() => handleAdminStatus(item.id, 'archived', 'Case resolved and archived.')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setReportOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-base text-slate-900">
                Report {reportType === 'lost' ? 'Lost' : 'Found'} Item
              </h3>
              <button onClick={() => setReportOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReport} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="e.g. Casio FX-991CW Scientific Calculator"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="electronics">Electronics</option>
                    <option value="books">Books & Notebooks</option>
                    <option value="apparel">Apparel & Uniform</option>
                    <option value="accessories">Water Bottle / Accessories</option>
                    <option value="sports_gear">Sports Gear</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={dateReported}
                    onChange={e => setDateReported(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Location</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Newton Wing Corridor / Library"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Identifying Description</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Photograph</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
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

      {/* Claim Modal */}
      {claimingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setClaimingItem(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <h3 className="font-heading font-bold text-base text-slate-900 mb-2">
              Claim Item: {claimingItem.itemName}
            </h3>
            <form onSubmit={handleClaim} className="space-y-4">
              <textarea
                rows={3}
                required
                value={claimNote}
                onChange={e => setClaimNote(e.target.value)}
                placeholder="Describe any distinguishing mark, serial number, or initials to verify ownership..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClaimingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold">
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

