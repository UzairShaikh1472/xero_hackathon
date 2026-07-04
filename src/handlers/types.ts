export interface ApiSuccess<T> {
  ok: true;
  status: 200;
  body: T;
}

export interface ApiError {
  ok: false;
  status: number;
  body: { error: string };
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function ok<T>(body: T): ApiSuccess<T> {
  return { ok: true, status: 200, body };
}

export function err(status: number, error: string): ApiError {
  return { ok: false, status, body: { error } };
}
