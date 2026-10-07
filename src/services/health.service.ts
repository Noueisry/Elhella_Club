import { isAxiosError } from 'axios';
import type { ApiResponse, LivenessStatus, ReadinessStatus, ServiceHealth } from '../types/api';
import { apiClient } from './api-client';

async function getReadiness(): Promise<ReadinessStatus> {
  try {
    const response = await apiClient.get<ApiResponse<ReadinessStatus>>('/health/ready');
    return response.data.data;
  } catch (error) {
    if (isAxiosError<ApiResponse<ReadinessStatus>>(error)
      && error.response?.status === 503
      && error.response.data?.data?.status === 'degraded') {
      return error.response.data.data;
    }
    throw error;
  }
}

export async function getServiceHealth(): Promise<ServiceHealth> {
  const [live, ready] = await Promise.all([
    apiClient.get<ApiResponse<LivenessStatus>>('/health/live'),
    getReadiness(),
  ]);
  return { live: live.data.data, ready };
}
