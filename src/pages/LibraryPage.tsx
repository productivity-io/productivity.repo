import React, { useState, useEffect, useCallback } from 'react';
import {
  Library,
  Search,
  BookOpen,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function LibraryPage() {
  const { showToast } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'catalogue' | 'transactions'>('catalogue');

  const loadLibrary = useCallback(async () => {
    try {
      const res = await apiFetch('/api/library');
      setData(res);
    } catch (err: any) {
      showToast('Failed to load library', err.message, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleIssue = async (bookId: number) => {
    try {
      await apiFetch('/api/library/issue', {
        method: 'POST',
        body: JSON.stringify({ bookId, dueDate: '2026-11-24' }),
      });
      showToast('Book Issued', 'Recorded in your library circulation history.', 'success');
      loadLibrary();
    } catch (err: any) {
      showToast('Issue failed', err.message, 'error');
    }
  };

  const handleReturn = async (txId: number) => {
    try {
      await apiFetch(`/api/library/transactions/${txId}/return`, { method: 'PATCH' });
      showToast('Book Returned', 'Library inventory updated.', 'success');
      loadLibrary();
    } catch (err: any) {
      showToast('Return failed', err.message, 'error');
    }
  };

  if (!data) {
    return <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />;
  }

  const books = (data.books || []).filter((b: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
  });

  const overdueTxs = (data.transactions || []).filter((t: any) => t.status === 'overdue');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-700" />
            <span>Central Digital Library & Circulation Catalogue</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Search holdings, check rack locations, issue books, and manage due dates & overdue notices.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('catalogue')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'catalogue' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Book Catalogue ({data.books?.length || 0})
          </button>
          <button
            onClick={() => setTab('transactions')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold ${
              tab === 'transactions' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Issue History & Due Dates ({data.transactions?.length || 0})
          </button>
        </div>
      </div>

      {overdueTxs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-xs text-red-900">
              <strong>Overdue Notice:</strong> You have {overdueTxs.length} overdue library book(s) ({overdueTxs[0].bookTitle}). Please return or renew at the Circulation Desk.
            </div>
          </div>
          <button
            onClick={() => setTab('transactions')}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold shrink-0"
          >
            View Overdue
          </button>
        </div>
      )}

      {tab === 'catalogue' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search catalogue by title, author, ISBN, or subject category..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {books.map((book: any) => (
              <div key={book.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                      {book.category}
                    </span>
                    <span className="font-mono text-xs text-slate-500">ISBN: {book.isbn}</span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-slate-900">{book.title}</h3>
                  <div className="text-xs font-semibold text-slate-600 mt-0.5">{book.author}</div>
                  <p className="text-xs text-slate-500 mt-2">{book.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">{book.rackLocation}</span> •{' '}
                    <span className="text-emerald-700 font-bold">
                      {book.availableCopies} / {book.totalCopies} Available
                    </span>
                  </div>
                  <button
                    disabled={book.availableCopies <= 0}
                    onClick={() => handleIssue(book.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Issue Book</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-heading font-bold text-base text-slate-900 mb-4">Circulation & Issue Ledger</h3>
          <div className="space-y-3">
            {(data.transactions || []).map((tx: any) => (
              <div key={tx.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">{tx.bookTitle}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Issued: {tx.issueDate} • Due: <strong>{tx.dueDate}</strong>
                    {tx.returnDate && ` • Returned: ${tx.returnDate}`}
                  </div>
                  {tx.remarks && <div className="text-xs text-slate-600 mt-1">{tx.remarks}</div>}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      tx.status === 'returned'
                        ? 'bg-emerald-100 text-emerald-800'
                        : tx.status === 'overdue'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {tx.status}
                  </span>
                  {tx.status !== 'returned' && (
                    <button
                      onClick={() => handleReturn(tx.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Mark Returned</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

