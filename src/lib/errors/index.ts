export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'APP_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'You must be signed in to perform this action.') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource could not be found.') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'A conflicting record already exists.') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input data.') {
    super(message, 'VALIDATION_ERROR', 422);
    this.name = 'ValidationError';
  }
}

export class CapabilityDisabledError extends AppError {
  constructor(capabilityKey: string) {
    super(
      `The "${capabilityKey}" capability is currently disabled for this Circle.`,
      'CAPABILITY_DISABLED',
      403
    );
    this.name = 'CapabilityDisabledError';
  }
}
