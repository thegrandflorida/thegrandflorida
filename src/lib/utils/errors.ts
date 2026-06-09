import { NextResponse } from 'next/server'

export interface AppError {
  code: string
  message: string
  status: number
  details?: unknown
}

export const Errors = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Authentication required', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', message: 'Insufficient permissions', status: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Resource not found', status: 404 },
  VALIDATION: (message: string, details?: unknown) =>
    ({ code: 'VALIDATION_ERROR', message, status: 422, details } as AppError),
  INTERNAL: (message = 'Internal server error') =>
    ({ code: 'INTERNAL_ERROR', message, status: 500 } as AppError),
  RATE_LIMITED: { code: 'RATE_LIMITED', message: 'Too many requests', status: 429 },
} as const

export function errorResponse(err: AppError | typeof Errors[keyof typeof Errors]) {
  const e = err as AppError
  return NextResponse.json(
    { error: { code: e.code, message: e.message, details: e.details } },
    { status: e.status }
  )
}

export function successResponse<T>(data: T, meta?: object, status = 200) {
  return NextResponse.json({ data, meta }, { status })
}
