import { apiClient } from './api-client';
import type { ApiResponse } from '../types/api';
import type { PaymentDetail, PaymentPage, PaymentPreview, PaymentQuery, PaymentRequest, Receipt } from '../models/payment';
import { receiptHtml } from '../utils/receipt-html';
import { loadDocumentFonts } from '../utils/document-fonts';
import { documentPdf } from '../utils/document-pdf';

export async function getPayments(params: PaymentQuery, signal?: AbortSignal) { return (await apiClient.get<ApiResponse<PaymentPage>>('/payments', { params, signal })).data.data; }
export async function getPayment(id: string, signal?: AbortSignal) { return (await apiClient.get<ApiResponse<PaymentDetail>>(`/payments/${id}`, { signal })).data.data; }
export async function getReceipt(id: string, signal?: AbortSignal) { return (await apiClient.get<ApiResponse<Receipt>>(`/payments/${id}/receipt`, { signal })).data.data; }
export async function getReceiptHtml(id: string, signal?: AbortSignal) {
  const [receipt] = await Promise.all([getReceipt(id, signal), loadDocumentFonts()]);
  return receiptHtml(receipt);
}
export async function getReceiptPdf(id: string) {
  try { return await documentPdf(await getReceiptHtml(id)); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = error.response as { data?: unknown } | undefined;
      if (response?.data instanceof Blob) { try { response.data = JSON.parse(await response.data.text()); } catch { /* keep original error */ } }
    }
    throw error;
  }
}
export async function previewPayment(request: PaymentRequest) {
  return (await apiClient.post<ApiResponse<PaymentPreview>>('/payments/preview', { ...request.input,
    ...(request.replacementId ? { replacementPaymentId: request.replacementId, reason: request.reason } : {}) })).data.data;
}
export async function postPayment(request: PaymentRequest) {
  return (await apiClient.post<ApiResponse<PaymentDetail>>(request.replacementId ? `/payments/${request.replacementId}/replace` : '/payments', {
    ...request.input, ...(request.replacementId ? { reason: request.reason } : {}),
  }, { timeout: 30000 })).data.data;
}
export async function cancelPayment({ id, reason }: { id: string; reason: string }) {
  return (await apiClient.post<ApiResponse<PaymentDetail>>(`/payments/${id}/cancel`, { reason }, { timeout: 30000 })).data.data;
}
