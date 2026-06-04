export interface ApiResponse<T = void> {
  status: boolean | "SUCCESS" | "FAILURE";
  message: string;
  data: T;
  error?: string;
  referenceId?: string;
  requestTime?: string;
  requestType?: string;
}
