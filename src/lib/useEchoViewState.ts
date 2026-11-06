import { useLocation, useSearchParams } from 'react-router-dom';
import { ECHO_VIEWS, viewValue } from './echoCommands';

/** Bind existing read-only controls to validated URL state; forms and mutation handlers stay separate. */
export function useEchoViewState(field: string): [string, (value: string) => void] {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const rule = ECHO_VIEWS[pathname]?.[field];
  if (!rule) throw new Error('Unsupported portal view field.');
  const setValue = (value: string) => {
    if (value.length > 200 || (rule.values && !rule.values.includes(value))) return;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value === rule.initial) next.delete('echo_' + field);
      else next.set('echo_' + field, value);
      return next;
    }, { replace: true });
  };
  return [viewValue(pathname, field, params), setValue];
}
