// An error from a non-2xx API response. `status` is the HTTP status; `message` is the server's own
// message when it sent one, otherwise the generic "API Error: <status> <statusText>" text.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Builds the error for a failed response from its status line and (already parsed, possibly absent) JSON body.
export const buildApiError = (status: number, statusText: string, body: unknown): ApiError => {
  const serverMessage =
    typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
      ? body.message.trim()
      : '';
  return new ApiError(serverMessage || `API Error: ${status} ${statusText}`, status);
};

// True when `error` came from an API response with this HTTP status. Falls back to the old
// "API Error: <status>" text so an error built the previous way is still recognised.
export const hasApiStatus = (error: unknown, status: number): boolean => {
  if (error instanceof ApiError) return error.status === status;
  return error instanceof Error && error.message.includes(`API Error: ${status}`);
};
