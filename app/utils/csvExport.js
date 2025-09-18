/**
 * CSV Export Utility Functions
 */
import { formatDate } from './formatters';

/**
 * Escapes CSV field content and wraps in quotes if needed
 */
function escapeCSVField(field) {
  if (field == null) return '""';

  const stringField = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return `"${stringField}"`;
}

/**
 * Converts array of objects to CSV string
 */
function arrayToCSV(data, headers) {
  const csvRows = [];

  // Add headers
  csvRows.push(headers.map(escapeCSVField).join(','));

  // Add data rows
  data.forEach(row => {
    const csvRow = headers.map(header => escapeCSVField(row[header]));
    csvRows.push(csvRow.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Downloads CSV content as a file
 */
export function downloadCSV(csvContent, filename = 'export.csv') {
  // Add BOM for better Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export orders with line items (one row per line item)
 */
export function exportOrdersWithLineItems(orders, filename) {
  const exportData = [];

  orders.forEach(order => {
    const customer = order.customer;
    const customerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Guest'
      : 'Guest';

    const baseOrderData = {
      'Order Name': order.name,
      'Customer Name': customerName,
      'Customer Email': customer?.email || order.email || '',
      'Order Date': formatDate(order.createdAt),
      'Payment Status': order.displayFinancialStatus,
      'Fulfillment Status': order.displayFulfillmentStatus,
      'Order Total': order.currentTotalPriceSet.shopMoney.amount,
      'Currency': order.currentTotalPriceSet.shopMoney.currencyCode,
    };

    // If order has line items, create a row for each
    if (order.lineItems.edges.length > 0) {
      order.lineItems.edges.forEach(lineItemEdge => {
        const item = lineItemEdge.node;
        exportData.push({
          ...baseOrderData,
          'Product Name': item.name,
          'Quantity': item.quantity,
          'Unit Price': item.originalUnitPriceSet.shopMoney.amount,
          'Line Total': item.originalTotalSet.shopMoney.amount,
          'SKU': item.sku || '',
          'Variant': item.variant?.title || '',
          'Product ID': item.product?.id || '',
        });
      });
    } else {
      // If no line items, still create a row for the order
      exportData.push({
        ...baseOrderData,
        'Product Name': '',
        'Quantity': '',
        'Unit Price': '',
        'Line Total': '',
        'SKU': '',
        'Variant': '',
        'Product ID': '',
      });
    }
  });

  const headers = [
    'Order Name',
    'Customer Name',
    'Customer Email',
    'Order Date',
    'Payment Status',
    'Fulfillment Status',
    'Order Total',
    'Currency',
    'Product Name',
    'Quantity',
    'Unit Price',
    'Line Total',
    'SKU',
    'Variant',
    'Product ID'
  ];

  const csvContent = arrayToCSV(exportData, headers);

  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `orders_export_${timestamp}.csv`;

  downloadCSV(csvContent, finalFilename);
}

/**
 * Export orders summary (one row per order)
 */
export function exportOrdersSummary(orders, filename) {
  const exportData = orders.map(order => {
    const customer = order.customer;
    const customerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Guest'
      : 'Guest';

    const totalItems = order.lineItems.edges.reduce(
      (sum, edge) => sum + edge.node.quantity, 0
    );

    const uniqueProducts = order.lineItems.edges.length;

    return {
      'Order Name': order.name,
      'Customer Name': customerName,
      'Customer Email': customer?.email || order.email || '',
      'Order Date': formatDate(order.createdAt),
      'Payment Status': order.displayFinancialStatus,
      'Fulfillment Status': order.displayFulfillmentStatus,
      'Total Items': totalItems,
      'Unique Products': uniqueProducts,
      'Order Total': order.currentTotalPriceSet.shopMoney.amount,
      'Currency': order.currentTotalPriceSet.shopMoney.currencyCode,
    };
  });

  const headers = [
    'Order Name',
    'Customer Name',
    'Customer Email',
    'Order Date',
    'Payment Status',
    'Fulfillment Status',
    'Total Items',
    'Unique Products',
    'Order Total',
    'Currency'
  ];

  const csvContent = arrayToCSV(exportData, headers);

  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `orders_summary_${timestamp}.csv`;

  downloadCSV(csvContent, finalFilename);
}
