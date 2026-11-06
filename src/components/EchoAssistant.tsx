import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import widgetUrl from '../../echo-web/widget/widget.js?url';
import { resolvePortalCommand, ECHO_PAGES } from '../lib/echoCommands';

type EchoConfig =
  | { enabled: false }
  | { enabled: true; siteId: string; apiBaseUrl: string };

export function EchoAssistant() {
  const { user, academicYears, setAcademicYear } = useAuth();
  const userId = user?.id;
  const location = useLocation();
  const navigate = useNavigate();
  // Keep the authenticated widget/conversation mounted while the router changes pages.
  const current = useRef({ user, location, navigate, academicYears, setAcademicYear });
  current.current = { user, location, navigate, academicYears, setAcademicYear };
  const trail = useRef<string[]>([]);
  useEffect(() => { trail.current = []; }, [userId]);
  useEffect(() => {
    if (!userId || !ECHO_PAGES.some(page => page.path === location.pathname)) return;
    const view = location.pathname + location.search;
    if (trail.current.at(-1) !== view) trail.current.push(view);
    trail.current = trail.current.slice(-20);
  }, [userId, location.pathname, location.search]);

  useEffect(() => {
    if (userId === undefined) return;

    const controller = new AbortController();
    const instance = crypto.randomUUID();
    let disposed = false;
    let script: HTMLScriptElement | undefined;
    const removeWidget = () => {
      document.querySelectorAll(`echo-chat-widget[data-instance="${instance}"]`).forEach(host => {
        host.dispatchEvent(new Event('echo-widget:destroy'));
      });
    };

    const handleCommand = (event: Event) => {
      const host = event.target;
      if (!(host instanceof HTMLElement) || host.dataset.instance !== instance) return;
      const detail = (event as CustomEvent<{ message: string; reply?: string }>).detail;
      const state = current.current;
      if (!state.user || state.user.id !== userId || typeof detail?.message !== 'string') return;
      const action = resolvePortalCommand(detail.message, {
        path: state.location.pathname, search: state.location.search, role: state.user.role,
        academicYears: state.academicYears.map(year => year.name),
      });
      if (!action) return;
      if (action.back) {
        if (trail.current.length < 2) { detail.reply = 'There is no previous portal view in this session.'; return; }
        trail.current.pop();
        state.navigate(trail.current.at(-1)!, { replace: true });
      } else if (action.href) state.navigate(action.href);
      else if (action.academicYear) state.setAcademicYear(action.academicYear);
      detail.reply = action.reply;
    };
    document.addEventListener('echo-widget:command', handleCommand);

    apiFetch<EchoConfig>('/api/echo/config', { signal: controller.signal }).then(config => {
      if (disposed || !config.enabled) return;
      script = document.createElement('script');
      script.src = widgetUrl;
      script.dataset.site = config.siteId;
      script.dataset.api = config.apiBaseUrl;
      script.dataset.instance = instance;
      script.onload = () => { if (disposed) removeWidget(); };
      script.onerror = () => { if (!disposed) console.warn('ECHO chat widget could not load.'); };
      document.body.append(script);
    }).catch(error => {
      if (!disposed && error.name !== 'AbortError') console.warn('ECHO chat is currently unavailable.');
    });

    return () => {
      disposed = true;
      document.removeEventListener('echo-widget:command', handleCommand);
      controller.abort();
      if (script) {
        script.dataset.cancelled = 'true';
        script.remove();
      }
      removeWidget();
    };
  }, [userId]);

  return null;
}
