import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import widgetUrl from '../../echo-web/widget/widget.js?url';
import { resolvePortalCommand, ECHO_PAGES, portalHelp } from '../lib/echoCommands';
import { confirmPortalAction } from '../lib/echoActionFeedback';

type EchoConfig =
  | { enabled: false }
  | { enabled: true; siteId: string; apiBaseUrl: string };

export function EchoAssistant() {
  const { user, academicYear, academicYears, setAcademicYear } = useAuth();
  const userId = user?.id;
  const location = useLocation();
  const navigate = useNavigate();
  // Keep the authenticated widget/conversation mounted while the router changes pages.
  const current = useRef({ user, location, navigate, academicYear, academicYears, setAcademicYear });
  current.current = { user, location, navigate, academicYear, academicYears, setAcademicYear };
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
      const detail = (event as CustomEvent<{ message: string; reply?: string; replyPromise?: Promise<string> }>).detail;
      const state = current.current;
      if (!state.user || state.user.id !== userId || typeof detail?.message !== 'string') return;
      const action = resolvePortalCommand(detail.message, {
        path: state.location.pathname, search: state.location.search, role: state.user.role,
        academicYears: state.academicYears.map(year => year.name),
      });
      if (!action) return;
      let expectedHref = action.href;
      if (action.back) {
        if (trail.current.length < 2) { detail.reply = 'There is no previous portal view in this session.'; return; }
        trail.current.pop();
        expectedHref = trail.current.at(-1)!;
        flushSync(() => { state.navigate(expectedHref!, { replace: true }); });
      } else if (action.href) {
        flushSync(() => { state.navigate(action.href!); });
      } else if (action.academicYear) {
        flushSync(() => { state.setAcademicYear(action.academicYear!); });
      }
      if (expectedHref || action.academicYear) {
        const expected = expectedHref ? new URL(expectedHref, window.location.origin) : null;
        detail.replyPromise = confirmPortalAction(() => {
          const observed = current.current;
          return observed.user?.id === userId && (expected
            ? observed.location.pathname === expected.pathname && observed.location.search === expected.search
              && window.location.pathname === expected.pathname && window.location.search === expected.search
            : observed.academicYear === action.academicYear);
        }, expected ? 'View confirmed. ' + action.reply : action.reply, controller.signal);
      } else detail.reply = action.reply;
    };
    const handleContext = (event: Event) => {
      const host = event.target;
      const state = current.current;
      if (!(host instanceof HTMLElement) || host.dataset.instance !== instance || state.user?.id !== userId) return;
      (event as CustomEvent).detail.context = portalHelp({
        path: state.location.pathname, search: state.location.search, role: state.user.role,
        academicYears: state.academicYears.map(year => year.name),
      });
    };
    document.addEventListener('echo-widget:command', handleCommand);
    document.addEventListener('echo-widget:context', handleContext);

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
      document.removeEventListener('echo-widget:context', handleContext);
      controller.abort();
      if (script) {
        script.dataset.cancelled = 'true';
        script.remove();
      }
      removeWidget();
    };
  }, [userId]);

  useEffect(() => {
    document.querySelectorAll('echo-chat-widget').forEach(host => host.dispatchEvent(new Event('echo-widget:refresh-context')));
  }, [userId, user?.role, location.pathname, location.search]);

  return null;
}
