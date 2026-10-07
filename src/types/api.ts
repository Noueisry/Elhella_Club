export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: { code: string; message: string; requestId: string };
}

export interface LivenessStatus {
  status: 'ok';
  api: 'available';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessStatus {
  status: 'ok' | 'degraded';
  api: 'available';
  database: 'available' | 'unavailable';
  timestamp: string;
  businessTimezone: string;
}

export interface ServiceHealth {
  live: LivenessStatus;
  ready: ReadinessStatus;
}
