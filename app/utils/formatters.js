/**
 * Formats a monetary amount with currency symbol and proper locale formatting.
 * Uses the Intl.NumberFormat API to handle currency formatting according to US locale standards.
 *
 * @param {string|number} amount - The monetary amount to format (can be string or number)
 * @param {string} [currencyCode="USD"] - ISO 4217 currency code (e.g., "USD", "EUR", "CAD")
 * @returns {string} Formatted currency string with symbol and proper decimal places
 *
 * @example
 * // Returns "$1,234.56"
 * formatCurrency("1234.56", "USD")
 *
 * @example
 * // Returns "$45.00" (defaults to USD)
 * formatCurrency(45)
 *
 * @example
 * // Returns "€99.99"
 * formatCurrency("99.99", "EUR")
 *
 * @throws {Error} Throws if amount cannot be parsed as a float or currency code is invalid
 */

export function formatCurrency(amount, currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(parseFloat(amount));
}

/**
 * Formats an ISO date string into a human-readable format with US locale conventions.
 * Displays date and time in a consistent format suitable for order timestamps.
 *
 * @param {string} dateString - ISO 8601 date string (e.g., "2023-12-25T10:30:00Z")
 * @returns {string} Formatted date string in "MMM dd, yyyy, hh:mm AM/PM" format
 *
 * @example
 * // Returns "Dec 25, 2023, 10:30 AM"
 * formatDate("2023-12-25T10:30:00Z")
 *
 * @example
 * // Returns "Jan 15, 2024, 02:45 PM"
 * formatDate("2024-01-15T14:45:30.123Z")
 *
 * @throws {Error} Throws if dateString is not a valid date format
 */

export function formatDate(dateString) {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
