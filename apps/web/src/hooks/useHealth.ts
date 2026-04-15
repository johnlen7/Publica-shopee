import { useQuery } from '@tanstack/react-query';
import type { HealthcheckResponse } from '@publica/shared';
import { apiFetch } from '../api/client';

export function useHealth() {
  return useQuery<HealthcheckResponse>({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthcheckResponse>('/health'),
    refetchInterval: 15_000,
  });
}
