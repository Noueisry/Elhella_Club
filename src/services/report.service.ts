import { apiClient } from './api-client';
import type { ApiResponse } from '../types/api';
import type { Report, ReportQuery } from '../models/report';
import { reportHtml } from '../utils/report-html';
import { loadDocumentFonts } from '../utils/document-fonts';
import { documentPdf } from '../utils/document-pdf';
export async function getReport(path: string, params: ReportQuery, signal?: AbortSignal) { return (await apiClient.get<ApiResponse<Report>>(path, { params, signal })).data.data; }
export async function getDocumentHtml(path: string, params: ReportQuery, signal?: AbortSignal) {
  const reportPath = path.replace(/\.(html|pdf)$/, '').replace(/(\/members\/[^/]+)\/statement$/, '$1/historical-statement');
  const [response] = await Promise.all([apiClient.get<ApiResponse<Report>>(reportPath, { params: { ...params, exportAll: true }, signal }), loadDocumentFonts()]);
  return reportHtml(response.data.data);
}
export async function getDocumentPdf(path: string, params: ReportQuery) {
  try { return await documentPdf(await getDocumentHtml(path, params), true); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = error.response as { data?: unknown } | undefined;
      if (response?.data instanceof Blob) { try { response.data = JSON.parse(await response.data.text()); } catch { /* preserve original */ } }
    }
    throw error;
  }
}
