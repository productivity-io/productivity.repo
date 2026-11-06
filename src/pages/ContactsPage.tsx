import { useEchoViewState } from '../lib/useEchoViewState';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhoneCall,
  Mail,
  MapPin,
  Clock,
  MessageSquare,
  Search,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

export function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useEchoViewState('search');
  const [category, setCategory] = useEchoViewState('category');

  useEffect(() => {
    apiFetch('/api/contacts')
      .then(res => setContacts(res.contacts || []))
      .catch(() => {});
  }, []);

  const filtered = contacts.filter(c => {
    if (category !== 'all' && c.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.contactPerson.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.roleTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-700" />
            <span>Quick Campus Contacts & Department Directory</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Direct extensions for Homeroom Teachers, Subject Faculty, Academic Coordinator, Principal’s Office, Transport, Infirmary, Library & IT.
          </p>
        </div>
        <button
          onClick={() => navigate('/communication')}
          className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Open Communication Hub</span>
        </button>
      </div>

      {/* Search & Category Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by teacher name, office, or department..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['all', 'academic', 'administration', 'transport', 'emergency', 'support'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize ${
                category === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div
            key={c.id}
            className={`rounded-2xl border p-5 flex flex-col justify-between ${
              c.category === 'emergency'
                ? 'bg-red-50/40 border-red-200'
                : 'bg-white border-slate-200 hover:border-blue-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    c.category === 'emergency'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {c.category}
                </span>
                <span className="font-mono text-xs font-bold text-slate-600">{c.extension}</span>
              </div>

              <h3 className="font-heading font-bold text-base text-slate-900">{c.contactPerson}</h3>
              <div className="text-xs font-semibold text-blue-700">{c.roleTitle}</div>
              <div className="text-xs text-slate-500 mt-0.5">{c.department}</div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{c.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.officeLocation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.availableHours}</span>
                </div>
              </div>
            </div>

            {c.linkedUserId && (
              <button
                onClick={() => navigate('/communication')}
                className="mt-4 w-full py-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Initiate Portal Conversation</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

