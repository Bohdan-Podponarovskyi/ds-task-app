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
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { GET_ORDERS } from "../graphql/queries";
import { formatCurrency, formatDate } from "../utils/formatters";
import { getStatusBadge, getFulfillmentBadge } from "../utils/badges";
import { exportOrdersWithLineItems, exportOrdersSummary } from "../utils/csvExport";

// Loader handles initial page load
export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    console.log("Starting GraphQL request for orders");
    const response = await admin.graphql(GET_ORDERS, {
      variables: { first: 5, after: null },
    });

    // Log response details for debugging
    console.log("GraphQL response status:", response.status);
    console.log("GraphQL response ok:", response.ok);

    if (!response.ok) {
      console.error(`GraphQL request failed with status ${response.status}`);
      // Try to get response text for more details
      let errorText = 'Unknown error';
      try {
        errorText = await response.text();
        console.error("Error response text:", errorText);
      } catch (e) {
        console.error("Could not read error response:", e);
      }

      throw new Error(`GraphQL request failed: ${response.status} - ${errorText}`);
    }

    const responseJson = await response.json();
    console.log("GraphQL response data structure:", {
      hasData: !!responseJson.data,
      hasOrders: !!responseJson.data?.orders,
      hasEdges: !!responseJson.data?.orders?.edges,
      edgesLength: responseJson.data?.orders?.edges?.length || 0,
      hasErrors: !!responseJson.errors
    });

    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(responseJson.errors)}`);
    }

    return {
      orders: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo || {},
      success: true,
    };
  } catch (error) {
    console.error("Loader error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Check if it's an authentication redirect
    if (error.message?.includes('redirect') || error.status === 302) {
      return {
        orders: [],
        pageInfo: {},
        error: "Authentication session expired. Please refresh the page to re-authenticate.",
        authError: true,
      };
    }

    return {
      orders: [],
      pageInfo: {},
      error: `Failed to load orders: ${error.message}`,
      success: false,
    };
  }
};

// Action handles "load more" requests
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    const formData = await request.formData();
    const after = formData.get("after");
    const first = parseInt(formData.get("first") || "5");

    console.log("Loading more orders:", { first, after });

    const response = await admin.graphql(GET_ORDERS, {
      variables: { first, after },
    });

    if (!response.ok) {
      console.error("Load more GraphQL request failed:", response.status);
      let errorText = 'Unknown error';
      try {
        errorText = await response.text();
      } catch (e) {
        console.error("Could not read error response:", e);
      }
      throw new Error(`GraphQL request failed: ${response.status} - ${errorText}`);
    }

    const responseJson = await response.json();
    if (responseJson.errors) {
      console.error("Load more GraphQL errors:", responseJson.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(responseJson.errors)}`);
    }

    return {
      orders: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo || {},
      success: true,
    };
  } catch (error) {
    console.error("Action error:", error);

    // Check if it's an authentication redirect
    if (error.message?.includes('redirect') || error.status === 302) {
      return {
        orders: [],
        pageInfo: {},
        error: "Authentication session expired. Please refresh the page to re-authenticate.",
        authError: true,
      };
    }

    return {
      orders: [],
      pageInfo: {},
      error: `Failed to load more orders: ${error.message}`,
      success: false,
    };
  }
};

export default function OrdersPage() {
  const { orders: initialOrders, pageInfo: initialPageInfo, error, authError, success } = useLoaderData();
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
                {authError && (
                  <Banner status="warning">
                    Your session may have expired. Try refreshing the page or reinstalling the app.
                  </Banner>
                )}
                <Text as="h2" variant="headingMd">
                  Error Loading Orders
                </Text>
                <Text variant="bodyMd" color="critical" as="p">
                  {error}
                </Text>
                <InlineStack gap="200">
                  <Button
                    onClick={() => window.location.reload()}
                    variant="primary"
                  >
                    Refresh Page
                  </Button>
                  {authError && (
                    <Button
                      onClick={() => {
                        // Force re-authentication by going to the root and back
                        window.location.href = '/app';
                      }}
                      variant="secondary"
                    >
                      Re-authenticate
                    </Button>
                  )}
                </InlineStack>
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
                {success === false && (
                  <Banner status="info">
                    There was an issue loading orders, but no specific error was returned.
                  </Banner>
                )}
                <Text as="h2" variant="headingMd">
                  No Orders Found
                </Text>
                <Text variant="bodyMd" as="p">
                  {success === false
                    ? "Unable to load orders from your store. Please try refreshing the page."
                    : "You don't have any orders yet. When customers place orders, they'll appear here."
                  }
                </Text>
                {success === false && (
                  <Button
                    onClick={() => window.location.reload()}
                    variant="primary"
                  >
                    Retry
                  </Button>
                )}
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
              {success && (
                <Banner status="success">
                  Successfully loaded {allOrders.length} orders from your store.
                </Banner>
              )}

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
                    {loadMoreFetcher.data.authError && (
                      <>
                        <br />
                        <Button
                          size="slim"
                          onClick={() => window.location.reload()}
                          variant="primary"
                        >
                          Refresh Page
                        </Button>
                      </>
                    )}
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
