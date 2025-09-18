import {useEffect, useState} from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";

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
  Spinner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { GET_ORDERS } from "../graphql/queries";
import { formatCurrency, formatDate } from "../utils/formatters";
import { getStatusBadge, getFulfillmentBadge } from "../utils/badges";
import { exportOrdersWithLineItems, exportOrdersSummary } from "../utils/csvExport";

// Loader handles initial page load
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(GET_ORDERS, {
      variables: { first: 5, after: null },
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const responseJson = await response.json();

    if (responseJson.errors) {
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

// Action handles "load more" requests
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const after = formData.get("after");
    const first = parseInt(formData.get("first") || "5");

    const response = await admin.graphql(GET_ORDERS, {
      variables: { first, after },
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status}`);
    }

    const responseJson = await response.json();
    if (responseJson.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(responseJson.errors)}`);
    }

    return {
      orders: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo || {},
    };
  } catch (error) {
    console.error("Load more error:", error);
    return {
      orders: [],
      pageInfo: {},
      error: `Failed to load more orders: ${error.message}`,
    };
  }
};

export default function OrdersPage() {
  const { orders: initialOrders, pageInfo: initialPageInfo, error } = useLoaderData();
  const loadMoreFetcher = useFetcher();

  // Combine initial orders with loaded orders
  const [allOrders, setAllOrders] = useState(initialOrders);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);

  // Other states
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [exportPopoverActive, setExportPopoverActive] = useState(false);

  // Handle load more response
  useEffect(() => {
    if (loadMoreFetcher.data && !loadMoreFetcher.data.error) {
      const newOrders = loadMoreFetcher.data.orders;
      const newPageInfo = loadMoreFetcher.data.pageInfo;

      setAllOrders(prev => [...prev, ...newOrders]);
      setPageInfo(newPageInfo);
    }
  }, [loadMoreFetcher.data]);

  // Handle load more click - much simpler!
  const handleLoadMore = () => {
    if (pageInfo.hasNextPage && pageInfo.endCursor) {
      loadMoreFetcher.submit(
        {
          after: pageInfo.endCursor,
          first: "5"
        },
        { method: "post" }
      );
    }
  };

  const isLoadingMore = loadMoreFetcher.state === "submitting";

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

  if (!allOrders || allOrders.length === 0) {
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
    ? allOrders.find(edge => edge.node.id === selectedOrderId)?.node
    : null;

  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    } else {
      setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrderIds(allOrders.map(edge => edge.node.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  // Export handlers
  const getSelectedOrders = () => {
    return allOrders
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
    const orders = allOrders.map(edge => edge.node);
    exportOrdersWithLineItems(orders, `all_orders_${new Date().toISOString().split('T')[0]}.csv`);
    setExportPopoverActive(false);
  };

  const allSelected = allOrders.length > 0 && selectedOrderIds.length === allOrders.length;
  const someSelected = selectedOrderIds.length > 0 && selectedOrderIds.length < allOrders.length;

  const tableRows = allOrders.map((edge) => {
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
                  Recent Orders ({allOrders.length})
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  {selectedOrderIds.length > 0 && (
                    <Text as="p" variant="bodyMd" color="subdued">
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
                        variant="primary"
                        onClick={handleExportAll}
                        size="slim"
                      >
                        Export All
                      </Button>
                    )}
                    {pageInfo.hasNextPage && (
                      <Button
                        variant="secondary"
                        size="slim"
                        onClick={handleLoadMore}
                        loading={isLoadingMore}
                      >
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

              {/* Loading and error states */}
              {isLoadingMore && (
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text as="p" variant="bodyMd" color="subdued">Loading more orders...</Text>
                </InlineStack>
              )}

              {loadMoreFetcher.data?.error && (
                <Box background="bg-surface-critical-subdued" padding="200" borderRadius="100">
                  <Text as="p" variant="bodyMd" color="critical">
                    {loadMoreFetcher.data.error}
                  </Text>
                </Box>
              )}
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
