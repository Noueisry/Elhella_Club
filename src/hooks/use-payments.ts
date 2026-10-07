import { useQuery } from '@tanstack/react-query';
import * as api from '../services/payment.service';
import type { PaymentQuery } from '../models/payment';
export const usePayments = (params: PaymentQuery) => useQuery({ queryKey: ['business', 'payment-list', params], queryFn: ({ signal }) => api.getPayments(params, signal) });
export const usePayment = (id: string) => useQuery({ queryKey: ['business', 'payment', id], queryFn: ({ signal }) => api.getPayment(id, signal), enabled: Boolean(id) });
export const useReceipt = (id: string) => useQuery({ queryKey: ['business', 'receipt', id], queryFn: ({ signal }) => api.getReceipt(id, signal), enabled: Boolean(id) });
export const useReceiptHtml = (id: string) => useQuery({ queryKey: ['business', 'receipt-html', id], queryFn: ({ signal }) => api.getReceiptHtml(id, signal), enabled: Boolean(id), staleTime: 0 });
