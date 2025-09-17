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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { GET_ORDERS } from "../graphql/queries";
import { formatCurrency, formatDate, getStatusBadge, getFulfillmentBadge } from "../utils/index.jsx"

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    console.log("Attempting to fetch orders...");

    const response = await admin.graphql(GET_ORDERS);

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GraphQL response not ok:", errorText);
      throw new Error(`GraphQL request failed: ${response.status} - ${errorText}`);
    }

    const responseJson = await response.json();
    console.log("Response JSON:", JSON.stringify(responseJson, null, 2));

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
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
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

  const tableRows = orders.map((edge) => {
    const order = edge.node;
    const customer = order.customer;
    const customerName = customer
      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email
      : order.email || 'Guest';

    return [
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
                {pageInfo.hasNextPage && (
                  <Button variant="primary" size="slim">
                    Load More
                  </Button>
                )}
              </InlineStack>

              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                  'numeric',
                  'text'
                ]}
                headings={[
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
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
