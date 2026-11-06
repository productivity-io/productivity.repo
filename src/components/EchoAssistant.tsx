import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import widgetUrl from '../../echo-web/widget/widget.js?url';

type EchoConfig =
  | { enabled: false }
  | { enabled: true; siteId: string; apiBaseUrl: string };

export function EchoAssistant() {
  const { user } = useAuth();
  const userId = user?.id;

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
