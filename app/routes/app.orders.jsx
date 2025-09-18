import { useState } from "react";
import { useLoaderData } from "@remix-run/react";
import {
  Box,
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
  DataTable,
  Button,
  InlineStack,
  Divider,
  Checkbox,
  ButtonGroup,
  Popover,
  ActionList,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { GET_ORDERS } from "../graphql/queries";
import { formatCurrency, formatDate } from "../utils/formatters";
import { getStatusBadge, getFulfillmentBadge } from "../utils/badges";
import { exportOrdersWithLineItems, exportOrdersSummary } from "../utils/csvExport";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    console.log("Attempting to fetch orders...");

    const response = await admin.graphql(GET_ORDERS);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GraphQL response not ok:", errorText);
      throw new Error(`GraphQL request failed: ${response.status} - ${errorText}`);
    }

    const responseJson = await response.json();

    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(responseJson.errors)}`);
    }

    return {
      orders: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo || {},
    };
  } catch (error) {
    console.error("Error fetching orders:", error);
    return {
      orders: [],
      pageInfo: {},
      error: `Failed to load orders: ${error.message}`,
    };
  }
};

export default function OrdersPage() {
  const { orders, pageInfo, error } = useLoaderData();
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [exportPopoverActive, setExportPopoverActive] = useState(false);

  if (error) {
    return (
      <Page>
        <TitleBar title="Orders" />
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Error Loading Orders
                </Text>
                <Text variant="bodyMd" color="critical" as="p">
                  {error}
                </Text>
                <Button
                  onClick={() => window.location.reload()}
                  variant="primary"
                >
                  Retry
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Page>
        <TitleBar title="Orders" />
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  No Orders Found
                </Text>
                <Text variant="bodyMd" as="p">
                  You don't have any orders yet. When customers place orders, they'll appear here.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const selectedOrder = selectedOrderId
    ? orders.find(edge => edge.node.id === selectedOrderId)?.node
    : null;

  // Selection handlers
  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    } else {
      setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrderIds(orders.map(edge => edge.node.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  // Export handlers
  const getSelectedOrders = () => {
    return orders
      .filter(edge => selectedOrderIds.includes(edge.node.id))
      .map(edge => edge.node);
  };

  const handleExportDetailed = () => {
    const selectedOrders = getSelectedOrders();
    if (selectedOrders.length === 0) {
      alert('Please select orders to export');
      return;
    }

    exportOrdersWithLineItems(selectedOrders);
    setExportPopoverActive(false);
  };

  const handleExportSummary = () => {
    const selectedOrders = getSelectedOrders();
    if (selectedOrders.length === 0) {
      alert('Please select orders to export');
      return;
    }

    exportOrdersSummary(selectedOrders);
    setExportPopoverActive(false);
  };

  const handleExportAll = () => {
    const allOrders = orders.map(edge => edge.node);
    exportOrdersWithLineItems(allOrders, `all_orders_${new Date().toISOString().split('T')[0]}.csv`);
    setExportPopoverActive(false);
  };

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;
  const someSelected = selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length;

  const tableRows = orders.map((edge) => {
    const order = edge.node;
    const customer = order.customer;
    const customerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email
      : order.email || 'Guest';

    const isSelected = selectedOrderIds.includes(order.id);

    return [
      <Checkbox
        key={`checkbox-${order.id}`}
        checked={isSelected}
        onChange={(checked) => handleSelectOrder(order.id, checked)}
      />,
      order.name,
      customerName,
      formatDate(order.createdAt),
      getStatusBadge(order.displayFinancialStatus),
      getFulfillmentBadge(order.displayFulfillmentStatus),
      formatCurrency(
        order.currentTotalPriceSet.shopMoney.amount,
        order.currentTotalPriceSet.shopMoney.currencyCode
      ),
      <Button
        key={order.id}
        size="slim"
        onClick={() => setSelectedOrderId(order.id)}
      >
        View Details
      </Button>
    ];
  });

  // Export popover activator
  const exportActivator = (
    <Button
      variant="primary"
      onClick={() => setExportPopoverActive(!exportPopoverActive)}
      disabled={selectedOrderIds.length === 0}
      size="slim"
    >
      Export ({selectedOrderIds.length})
    </Button>
  );

  return (
    <Page>
      <TitleBar title="Orders" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Recent Orders ({orders.length})
                </Text>
                <InlineStack gap="200">
                  {selectedOrderIds.length > 0 && (
                    <Text variant="bodyMd" color="subdued">
                      {selectedOrderIds.length} selected
                    </Text>
                  )}
                  <ButtonGroup>
                    {selectedOrderIds.length > 0 && (
                      <Popover
                        active={exportPopoverActive}
                        activator={exportActivator}
                        onClose={() => setExportPopoverActive(false)}
                      >
                        <ActionList
                          items={[
                            {
                              content: 'Export Selected (Detailed)',
                              helpText: 'One row per product in each order',
                              onAction: handleExportDetailed
                            },
                            {
                              content: 'Export Selected (Summary)',
                              helpText: 'One row per order with totals',
                              onAction: handleExportSummary
                            },
                            {
                              content: 'Export All Orders',
                              helpText: 'Export all visible orders with details',
                              onAction: handleExportAll
                            }
                          ]}
                        />
                      </Popover>
                    )}
                    {selectedOrderIds.length === 0 && (
                      <Button
                        variant="secondary"
                        onClick={handleExportAll}
                        size="slim"
                      >
                        Export All
                      </Button>
                    )}
                    {pageInfo.hasNextPage && (
                      <Button variant="secondary" size="slim">
                        Load More
                      </Button>
                    )}
                  </ButtonGroup>
                </InlineStack>
              </InlineStack>

              <DataTable
                columnContentTypes={[
                  'text', // Checkbox
                  'text', // Order
                  'text', // Customer
                  'text', // Date
                  'text', // Payment Status
                  'text', // Fulfillment Status
                  'numeric', // Total
                  'text' // Actions
                ]}
                headings={[
                  <Checkbox
                    key="select-all"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                   />,
                  'Order',
                  'Customer',
                  'Date',
                  'Payment Status',
                  'Fulfillment Status',
                  'Total',
                  'Actions'
                ]}
                rows={tableRows}
                hoverable
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {selectedOrder && (
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">
                    Order Details
                  </Text>
                  <Button
                    size="slim"
                    onClick={() => setSelectedOrderId(null)}
                  >
                    ✕
                  </Button>
                </InlineStack>

                <Divider />

                <BlockStack gap="300">
                  <Box>
                    <Text as="h4" variant="headingSm">Order {selectedOrder.name}</Text>
                    <Text as="p" variant="bodyMd" color="subdued">
                      Created: {formatDate(selectedOrder.createdAt)}
                    </Text>
                  </Box>

                  {selectedOrder.customer && (
                    <Box>
                      <Text as="h4" variant="headingSm">Customer</Text>
                      <Text as="p" variant="bodyMd">
                        {selectedOrder.customer.firstName} {selectedOrder.customer.lastName}
                      </Text>
                      <Text as="p" variant="bodyMd" color="subdued">
                        {selectedOrder.customer.email}
                      </Text>
                    </Box>
                  )}

                  {selectedOrder.email && !selectedOrder.customer && (
                    <Box>
                      <Text as="h4" variant="headingSm">Contact</Text>
                      <Text variant="bodyMd" as="p">
                        {selectedOrder.email}
                      </Text>
                    </Box>
                  )}

                  <Box>
                    <Text as="h4" variant="headingSm">Status</Text>
                    <InlineStack gap="200">
                      {getStatusBadge(selectedOrder.displayFinancialStatus)}
                      {getFulfillmentBadge(selectedOrder.displayFulfillmentStatus)}
                    </InlineStack>
                  </Box>

                  <Divider />

                  <InlineStack align="space-between">
                    <Text as="h4" variant="headingSm">Total</Text>
                    <Text variant="headingSm" as="p">
                      {formatCurrency(
                        selectedOrder.currentTotalPriceSet.shopMoney.amount,
                        selectedOrder.currentTotalPriceSet.shopMoney.currencyCode
                      )}
                    </Text>
                  </InlineStack>
                </BlockStack>

                <Divider />

                <Box>
                  <Text as="h4" variant="headingSm">Products</Text>
                  <BlockStack gap="200">
                    {selectedOrder.lineItems.edges.map((lineItemEdge) => {
                      const item = lineItemEdge.node;
                      return (
                        <Box key={item.id} padding="200" background="bg-surface-secondary" borderRadius="100">
                          <BlockStack gap="100">
                            <InlineStack align="space-between">
                              <Text as="p" variant="bodyMd" fontWeight="semibold">{item.name}</Text>
                              <Text as="p" variant="bodyMd">Qty: {item.quantity}</Text>
                            </InlineStack>

                            {item.variant && item.variant.title && item.variant.title !== 'Default Title' && (
                              <Text as="p" variant="bodySm" color="subdued">
                                Variant: {item.variant.title}
                              </Text>
                            )}

                            {item.sku && (
                              <Text as="p" variant="bodySm" color="subdued">
                                SKU: {item.sku}
                              </Text>
                            )}

                            <InlineStack align="space-between">
                              <Text as="p" variant="bodySm">
                                {formatCurrency(
                                  item.originalUnitPriceSet.shopMoney.amount,
                                  item.originalUnitPriceSet.shopMoney.currencyCode
                                )} each
                              </Text>
                              <Text as="p" variant="bodyMd" fontWeight="semibold">
                                {formatCurrency(
                                  item.originalTotalSet.shopMoney.amount,
                                  item.originalTotalSet.shopMoney.currencyCode
                                )}
                              </Text>
                            </InlineStack>
                          </BlockStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                </Box>

              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
