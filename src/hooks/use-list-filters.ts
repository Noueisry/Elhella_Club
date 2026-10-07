import { useSearchParams } from 'react-router-dom';

export function useListFilters() {
  const [params, setParams] = useSearchParams();
  const pageValue = Number(params.get('page') ?? 1), limitValue = Number(params.get('limit') ?? 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue : 1;
  const limit = [10, 25, 50].includes(limitValue) ? limitValue : 10;
  function set(name: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value); else next.delete(name);
      if (name !== 'page') next.delete('page');
      return next;
    }, { replace: true, flushSync: true });
  }
  return { params, page, limit, set };
}
