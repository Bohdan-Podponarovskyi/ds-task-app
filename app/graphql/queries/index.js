export const GET_ORDERS = `
  #graphql
  query GetOrdersWithLineItems {
    orders(first: 10) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          email
          customer {
            id
            firstName
            lastName
            email
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                name
                quantity
                sku
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                  title
                }
                product {
                  id
                  title
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;
