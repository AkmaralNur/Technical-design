import { useQuery } from '@tanstack/react-query';
import { getStations } from '../api';

export function useStations() {
  return useQuery({ queryKey: ['stations'], queryFn: getStations, staleTime: 10 * 60 * 1000 });
}
