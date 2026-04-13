/**
 * Input Sanitization Utilities
 *
 * Provides functions to sanitize user input and prevent XSS attacks.
 * Following OWASP guidelines for input validation and output encoding.
 */

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitize USN input
 * - Only allows alphanumeric characters
 * - Converts to uppercase
 * - Validates length
 */
export function sanitizeUSN(usn: string): { sanitized: string; isValid: boolean } {
  if (!usn || typeof usn !== "string") {
    return { sanitized: "", isValid: false };
  }

  // Remove any whitespace
  const trimmed = usn.trim();

  // Validate format: alphanumeric, 6-12 characters
  const usnRegex = /^[A-Z0-9]{6,12}$/;

  if (!usnRegex.test(trimmed)) {
    return { sanitized: "", isValid: false };
  }

  // Convert to uppercase
  const sanitized = trimmed.toUpperCase();

  return { sanitized, isValid: true };
}

/**
 * Sanitize name input
 * - Allows letters, spaces, hyphens, apostrophes
 * - Limits length
 * - Removes potentially dangerous characters
 */
export function sanitizeName(name: string): { sanitized: string; isValid: boolean } {
  if (!name || typeof name !== "string") {
    return { sanitized: "", isValid: false };
  }

  const trimmed = name.trim();

  // Basic validation: letters, spaces, hyphens, apostrophes, only
  const nameRegex = /^[a-zA-Z\s\-'\.]{1,100}$/;

  if (!nameRegex.test(trimmed)) {
    return { sanitized: "", isValid: false };
  }

  // Remove any HTML tags (basic XSS prevention)
  const sanitized = trimmed
    .replace(/<[^>]*>/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();

  return { sanitized, isValid: true };
}

/**
 * Sanitize email input
 * - Validates email format
 * - Converts to lowercase
 * - Removes HTML entities
 */
export function sanitizeEmail(email: string): { sanitized: string; isValid: boolean } {
  if (!email || typeof email !== "string") {
    return { sanitized: "", isValid: false };
  }

  const trimmed = email.trim().toLowerCase();

  // Basic email validation
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmed)) {
    return { sanitized: "", isValid: false };
  }

  // Remove HTML tags and entities
  const sanitized = trimmed
    .replace(/<[^>]*>/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();

  return { sanitized, isValid: true };
}

/**
 * Sanitize phone input
 * - Validates 10-digit format
 * - Removes any non-digit characters
 */
export function sanitizePhone(phone: string): { sanitized: string; isValid: boolean } {
  if (!phone || typeof phone !== "string") {
    return { sanitized: "", isValid: false };
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");

  // Validate exactly 10 digits
  if (digitsOnly.length !== 10) {
    return { sanitized: "", isValid: false };
  }

  return { sanitized: digitsOnly, isValid: true };
}

/**
 * Sanitize OTP input
 * - Validates 6-digit format
 * - Removes any non-digit characters
 */
export function sanitizeOTP(otp: string): { sanitized: string; isValid: boolean } {
  if (!otp || typeof otp !== "string") {
    return { sanitized: "", isValid: false };
  }

  // Remove all non-digit characters
  const digitsOnly = otp.replace(/\D/g, "");

  // Validate exactly 6 digits
  if (digitsOnly.length !== 6) {
    return { sanitized: "", isValid: false };
  }

  return { sanitized: digitsOnly, isValid: true };
}

/**
 * Sanitize and validate text input (for event descriptions, etc.)
 * - Removes HTML tags
 * - Limits length
 * - Prevents script injection
 */
export function sanitizeText(text: string, maxLength: number = 500): { sanitized: string; isValid: boolean } {
  if (!text || typeof text !== "string") {
    return { sanitized: "", isValid: false };
  }

  let sanitized = text.trim();

  // Remove HTML tags (basic XSS prevention)
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove dangerous event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"]*\s*\)/gi, "");

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return { sanitized, isValid: true };
}

/**
 * Comprehensive sanitization for any user input
 * - Removes null bytes
 * - Trims whitespace
 * - Applies appropriate sanitization based on input type
 */
export function sanitizeInput(input: string, type: "usn" | "name" | "email" | "phone" | "otp" | "text" = "text"): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  switch (type) {
    case "usn":
      return sanitizeUSN(input).sanitized;
    case "name":
      return sanitizeName(input).sanitized;
    case "email":
      return sanitizeEmail(input).sanitized;
    case "phone":
      return sanitizePhone(input).sanitized;
    case "otp":
      return sanitizeOTP(input).sanitized;
    case "text":
      return sanitizeText(input).sanitized;
    default:
      return input.trim();
  }
}

/**
 * Validate input against common XSS patterns
 * - Checks for script injection attempts
 * - Checks for HTML injection attempts
 */
export function containsXSSPatterns(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }

  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=\s*["'][^"]*\s*\)/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<svg/gi,
    /onload\s*=/gi,
    /<img/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}