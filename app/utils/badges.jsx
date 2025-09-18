import { Badge } from "@shopify/polaris";

/**
 * Returns a Shopify Polaris Badge component for order payment status.
 *
 * @param {string} status - The payment status from Shopify's displayFinancialStatus field
 * @returns {JSX.Element} A Polaris Badge component with status-specific styling
 */

export function getStatusBadge(status) {
  switch (status) {
    case "PAID":
      return <Badge status="success">Paid</Badge>;
    case "PENDING":
      return <Badge status="attention">Pending</Badge>;
    case "AUTHORIZED":
      return <Badge status="info">Authorized</Badge>;
    case "PARTIALLY_PAID":
      return <Badge status="warning">Partially Paid</Badge>;
    case "REFUNDED":
      return <Badge status="critical">Refunded</Badge>;
    case "VOIDED":
      return <Badge status="critical">Voided</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

/**
 * Returns a Shopify Polaris Badge component for order fulfillment status.
 *
 * @param {string} status - The fulfillment status from Shopify's displayFulfillmentStatus field
 * @returns {JSX.Element} A Polaris Badge component with status-specific styling
 *
 */
export function getFulfillmentBadge(status) {
  switch (status) {
    case "FULFILLED":
      return <Badge status="success">Fulfilled</Badge>;
    case "UNFULFILLED":
      return <Badge status="attention">Unfulfilled</Badge>;
    case "PARTIALLY_FULFILLED":
      return <Badge status="warning">Partially Fulfilled</Badge>;
    case "RESTOCKED":
      return <Badge status="info">Restocked</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}
