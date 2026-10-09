/**
 * Error handling utility for consistent error management
 */

export interface UserFriendlyError {
  title: string;
  userMessage: string;
  technicalDetail: string;
}

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number = 500,
    message: string = 'An error occurred'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCode = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  AUTH_REQUIRED: 'AUTH_REQUIRED',

  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export const errorHandler = {
  handle(error: any): UserFriendlyError {
    const technicalDetail = typeof error === 'string'
      ? error
      : error?.message || JSON.stringify(error) || 'Unknown technical error';

    const lower = technicalDetail.toLowerCase();

    if (lower.includes('unable to resolve host') || lower.includes('network') || lower.includes('fetch')) {
      return {
        title: "NO INTERNET",
        userMessage: "Please check your internet connection and try again.",
        technicalDetail
      };
    }

    if (lower.includes('timeout') || lower.includes('timed out')) {
      return {
        title: "CONNECTION TIMEOUT",
        userMessage: "The server is taking too long to respond. Please try again.",
        technicalDetail
      };
    }

    if (lower.includes('permission') || lower.includes('denied') || lower.includes('row-level security policy')) {
      return {
        title: "PERMISSION DENIED",
        userMessage: "You do not have permission to perform this action. Please check your account status.",
        technicalDetail
      };
    }

    if (lower.includes('invalid credentials') || lower.includes('invalid login credentials')) {
      return {
        title: "LOGIN FAILED",
        userMessage: "Invalid email or password. Please try again.",
        technicalDetail
      };
    }

    if (lower.includes('coroutine scope left the composition')) {
      return {
        title: "REQUEST CANCELLED",
        userMessage: "The request was cancelled because the component was unmounted.",
        technicalDetail
      };
    }

    // If the error message is short and likely user-friendly, show it directly
    if (technicalDetail.length < 60 && !lower.includes('http') && !lower.includes('exception') && !lower.includes('coroutine')) {
      return {
        title: "ERROR",
        userMessage: technicalDetail,
        technicalDetail
      };
    }

    return {
      title: "ERROR",
      userMessage: "We encountered an unexpected error. Please try again.",
      technicalDetail
    };
  }
};

export const handleError = (error: any): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  // Log the full error for debugging
  console.error('Handled error details:', error);

  let message = 'An unexpected error occurred';
  let code: string = ErrorCode.INTERNAL_ERROR;
  let statusCode = 500;

  const rawMessage =
    typeof error === 'string'
      ? error
      : typeof error?.message === 'string' && error.message.trim().length > 0
        ? error.message
        : null;

  if (rawMessage) {
    message = rawMessage;
    code = ErrorCode.INVALID_INPUT;
    statusCode = 400;

    const lowerMessage = message.toLowerCase();

    // Specific Supabase Auth mappings
    if (lowerMessage.includes('invalid login credentials')) {
      message = 'Invalid email or password';
      code = ErrorCode.INVALID_CREDENTIALS;
      statusCode = 401;
    } else if (lowerMessage.includes('gateway timeout') || lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      message = 'Server timeout. Please retry in a minute.';
      code = ErrorCode.TIMEOUT;
      statusCode = 504;
    } else if (lowerMessage.includes('already registered') || lowerMessage.includes('user already exists')) {
      message = 'Email already registered. Please sign in instead.';
      code = ErrorCode.EMAIL_ALREADY_EXISTS;
      statusCode = 409;
    } else if (lowerMessage.includes('weak password')) {
      message = 'Password is too weak';
      code = ErrorCode.WEAK_PASSWORD;
    } else if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      message = 'Too many requests. Please try again later.';
      statusCode = 429;
    } else if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      message = 'Network error. Please check your connection.';
      code = ErrorCode.NETWORK_ERROR;
    } else if (lowerMessage.includes('database') || lowerMessage.includes('postgres') || lowerMessage.includes('row-level security')) {
      message = 'A database error occurred. Please try again.';
      code = ErrorCode.DATABASE_ERROR;
      statusCode = 500;
    }
  } else if (error && typeof error === 'object') {
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}' && serialized !== 'null') {
        message = serialized;
      }
    } catch {
      // Keep the default fallback message when object serialization fails.
    }
  }

  return new AppError(code, statusCode, message);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePassword = (password: string): boolean => {
  // Minimum 6 characters
  return password.length >= 6;
};

export const validateDateRange = (start: Date, end: Date): boolean => {
  return start < end;
};
