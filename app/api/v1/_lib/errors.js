import { NextResponse } from 'next/server';

export function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
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

export function validationError(message = 'Validation error') {
  return errorResponse(message, 422);
}
