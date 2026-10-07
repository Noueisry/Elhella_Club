import { useQuery } from '@tanstack/react-query';
import * as api from '../services/administration.service';
export const useUsers = (page: number, limit: number) => useQuery({ queryKey: ['business', 'users', page, limit], queryFn: ({ signal }) => api.getUsers(page, limit, signal) });
export const useSettings = () => useQuery({ queryKey: ['business', 'settings'], queryFn: ({ signal }) => api.getSettings(signal) });
export const useRates = (page: number, limit: number) => useQuery({ queryKey: ['business', 'rates', page, limit], queryFn: ({ signal }) => api.getRates(page, limit, signal) });
