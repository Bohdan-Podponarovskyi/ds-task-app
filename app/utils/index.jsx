import { Badge } from "@shopify/polaris";

export function formatCurrency(amount, currencyCode) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(parseFloat(amount));
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
