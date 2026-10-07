import { useQuery } from '@tanstack/react-query';
import { getServiceHealth } from '../services/health.service';

export function useServiceHealth() {
  return useQuery({
    queryKey: ['service-health'],
    queryFn: getServiceHealth,
    staleTime: 15000,
    refetchInterval: 30000,
    retry: 1,
  });
}
