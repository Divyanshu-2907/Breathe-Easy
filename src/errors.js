export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class GeocodeNotFoundError extends AppError {
  constructor(city) {
    super(`City not found: ${city}`, 404, 'GEOCODE_NOT_FOUND');
    this.city = city;
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor(serviceName, timeoutMs) {
    super(
      `Upstream service (${serviceName}) timed out after ${timeoutMs}ms`,
      504,
      'UPSTREAM_TIMEOUT'
    );
    this.serviceName = serviceName;
  }
}

export class UpstreamApiError extends AppError {
  constructor(serviceName, status, statusText = '') {
    super(
      `Upstream service (${serviceName}) failed with status ${status}${statusText ? `: ${statusText}` : ''}`,
      502,
      'UPSTREAM_ERROR'
    );
    this.serviceName = serviceName;
    this.upstreamStatus = status;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}
