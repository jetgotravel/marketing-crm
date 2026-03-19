import { NextResponse } from 'next/server';

export function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

// Sanitize Supabase/DB errors — never leak internals to clients
export function dbError(error) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('DB error:', error.message, error.code);
  }
  return errorResponse('Internal server error', 500);
}

export function notFound(resource = 'Resource') {
  return errorResponse(`${resource} not found`, 404);
}

export function badRequest(message = 'Bad request') {
  return errorResponse(message, 400);
}

export function unauthorized(message = 'Unauthorized') {
  return errorResponse(message, 401);
}

export function conflict(message = 'Conflict') {
  return errorResponse(message, 409);
}
