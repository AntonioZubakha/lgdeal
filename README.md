# LGDEAL Marketplace

Платформа LGDEAL - это маркетплейс для торговли бриллиантами и драгоценными камнями. 

## Структура проекта

- `/server` - Серверная часть приложения (Node.js, Express, MongoDB)
  - `/controllers` - Контроллеры API
  - `/models` - Mongoose модели
  - `/routes` - Маршруты API
  - `/middleware` - Промежуточное ПО
  - `/config` - Конфигурационные файлы
  - `/utils` - Утилиты

## Основные возможности

- Аутентификация и авторизация пользователей
- Управление компаниями и пользователями
- Каталог товаров (бриллианты, драгоценные камни)
- Корзина покупок
- Система сделок с поддержкой различных статусов
- Документооборот (инвойсы, трекинг доставки)

## Процесс сделки

Система поддерживает два типа сделок:
1. Прямые сделки покупателя с LGDEAL (buyer-to-lgdeal)
2. Сделки LGDEAL с поставщиками (lgdeal-to-seller)

Стадии сделки:
- Запрос (request)
- Переговоры (negotiation)
- Оплата и доставка (payment_delivery)
- Завершение (completed)
- Отмена (cancelled)

## Технический стек

- Backend: Node.js, Express, MongoDB (Mongoose)
- Frontend: React, Redux, Material-UI
- Аутентификация: JWT
- Хранение файлов: локальная файловая система

## Разработка

### Требования
- Node.js v14+
- MongoDB v4+

### Установка и запуск

```bash
# Установка зависимостей для сервера
cd server
npm install

# Запуск сервера для разработки
npm run dev
```

## План развития

- Реализация системы альтернативных предложений в сделках
- Рефакторинг контроллера сделок для улучшения поддерживаемости
- Улучшение интерфейса переговоров
- Добавление статистики и аналитики 

# Deal Management System Documentation

This document provides a comprehensive overview of the deal management system, including deal types, stages, statuses, user roles, and key processes.

## 1. Core Concepts

### 1.1. Deal Types

The system primarily handles two main types of deals, facilitating transactions between buyers, sellers, and the LGDEAL platform:

*   **`buyer-to-lgdeal` (B2L):**
    *   A deal initiated by a buyer to purchase products.
    *   LGDEAL acts as the seller from the buyer's perspective.
    *   This deal can represent:
        *   A direct sale from LGDEAL's own stock.
        *   A sale where LGDEAL sources products from other sellers (creating paired `lgdeal-to-seller` deals).
*   **`lgdeal-to-seller` (L2S):**
    *   A deal where LGDEAL acts as the buyer, purchasing products from a seller.
    *   These are typically created in conjunction with a `buyer-to-lgdeal` deal when LGDEAL sources products.
    *   They can also be created for acquiring alternative products.
*   **Direct LGDEAL Deal:**
    *   A special case of `buyer-to-lgdeal` where all products are from LGDEAL's own inventory.
    *   In this scenario, LGDEAL effectively acts in a dual role (seller to the buyer, and internally fulfilling the order). There are no paired `lgdeal-to-seller` deals.

### 1.2. User Roles

User roles are determined dynamically based on the deal type and the user's affiliation:

*   **`buyer`:** The user or company purchasing products in a `buyer-to-lgdeal` deal.
*   **`seller`:** The user or company selling products in an `lgdeal-to-seller` deal.
*   **`LGDEAL seller`:** An LGDEAL administrator acting as the seller in a `buyer-to-lgdeal` deal (when LGDEAL is fulfilling the order, either from its stock or by sourcing).
*   **`LGDEAL buyer`:** An LGDEAL administrator acting as the buyer in an `lgdeal-to-seller` deal (when LGDEAL is acquiring products from a supplier).
*   **`LGDEAL dual-role`:** An LGDEAL administrator in a "Direct LGDEAL Deal" where LGDEAL is both the direct seller to the end buyer and manages the fulfillment without external sellers.

LGDEAL administrators (`isLgdealSupervisor`) have broader access and can manage deals based on the platform's role in the transaction.

### 1.3. Product Alternatives

*   During deal initiation (from cart), the system automatically searches for alternative products for each item.
*   For each alternative found, a separate `lgdeal-to-seller` deal is pre-emptively created (in `pending` status) to secure the alternative from its supplier. This deal is linked to the main `buyer-to-lgdeal` deal.
*   LGDEAL managers can later select an alternative for an item in the main `buyer-to-lgdeal` deal. This action:
    *   Updates the main deal with the alternative product and its price.
    *   Automatically cancels the `lgdeal-to-seller` deal associated with the *original* product (if it wasn't an LGDEAL stock item).
    *   Automatically cancels the `lgdeal-to-seller` deals associated with other *unselected* alternatives for that item.
    *   The `lgdeal-to-seller` deal for the *selected* alternative proceeds.

## 2. Deal Lifecycle: Stages and Statuses

Deals progress through a defined lifecycle, marked by stages and specific statuses within those stages.

### 2.1. Stage Order

1.  `request`
2.  `negotiation`
3.  `payment_delivery`
4.  `completed`
5.  `cancelled` (Can be reached from most stages/statuses)

### 2.2. Stages and Statuses Detailed

#### 2.2.1. `request` Stage

*   **`pending`**:
    *   Initial status when a deal is created (both B2L and L2S).
    *   Awaiting approval from the seller (or LGDEAL acting as seller/buyer).
    *   *Transitions to:* `approved`, `rejected` (by seller/LGDEAL), `cancelled`, or `negotiating` (if B2L is approved and moves to negotiation).
*   **`approved`**:
    *   The request has been approved by the relevant party.
    *   *Transitions to:* (Typically leads to a stage change to `negotiation`).
*   **`rejected`**:
    *   The request has been rejected.
    *   *Transitions to:* (Effectively an end state for this path, deal might be cancelled).

#### 2.2.2. `negotiation` Stage

*   **`negotiating`**:
    *   Default status when a deal enters the negotiation stage.
    *   Open for proposals from buyer or seller.
    *   Direct LGDEAL deals (all products from LGDEAL stock) automatically enter this status after creation.
    *   *Transitions to:* `terms_proposed`, `seller_counter_offer`, `seller_final_offer`, `awaiting_invoice` (if terms accepted), `cancelled`.
*   **`terms_proposed`**:
    *   Buyer (or LGDEAL acting as buyer) has submitted a price/terms proposal.
    *   Awaiting seller's response.
    *   *Transitions to:* `seller_counter_offer`, `seller_final_offer` (if seller counters), `awaiting_invoice` (if seller accepts), `cancelled`.
*   **`seller_counter_offer`**:
    *   Seller (or LGDEAL acting as seller) has submitted a counter-proposal.
    *   Awaiting buyer's response.
    *   *Transitions to:* `terms_proposed` (if buyer counters again), `awaiting_invoice` (if buyer accepts), `cancelled`.
*   **`seller_final_offer`**:
    *   Seller (or LGDEAL acting as seller) has submitted a final offer (e.g., maintaining original price).
    *   Awaiting buyer's response.
    *   *Transitions to:* `awaiting_invoice` (if buyer accepts), `cancelled`.

#### 2.2.3. `payment_delivery` Stage

*   **`awaiting_invoice`**:
    *   Negotiation terms have been accepted.
    *   Waiting for the seller (or LGDEAL as seller) to upload the invoice.
    *   *Transitions to:* `invoice_pending`, `cancelled`.
*   **`invoice_pending`**:
    *   Invoice has been uploaded by the seller.
    *   Waiting for the buyer to make payment or for LGDEAL to confirm/reject the invoice (if LGDEAL is buyer).
    *   *Transitions to:* `awaiting_invoice` (if rejected), `awaiting_payment`, `cancelled`.
*   **`awaiting_payment`**:
    *   Invoice has been accepted/confirmed (implicitly or explicitly).
    *   Waiting for the buyer to make payment and for the seller/LGDEAL to confirm receipt.
    *   *Transitions to:* `payment_received`, `cancelled`.
*   **`payment_received`**:
    *   Payment has been confirmed by the seller/LGDEAL.
    *   Waiting for the seller/LGDEAL to ship the products and add tracking information.
    *   *Transitions to:* `shipped`, `cancelled`.
*   **`shipping_documents_uploaded`** (Intermediate status, likely before `shipped`):
    *   Seller has uploaded shipping documents. This is an optional step before or concurrent with adding tracking.
*   **`shipped`**:
    *   Products have been shipped, tracking information provided.
    *   Waiting for the buyer to confirm delivery.
    *   *Transitions to:* `completed` (upon delivery confirmation), `cancelled` (if issues arise).

#### 2.2.4. `completed` Stage

*   **`completed`**:
    *   Buyer has confirmed delivery.
    *   The deal is successfully concluded.
    *   Products involved are marked as "Sold" and their certificates (if any) are blacklisted as "product_sold".
    *   No further transitions.

#### 2.2.5. `cancelled` Stage

*   **`cancelled`**:
    *   The deal has been cancelled by either party or the system (e.g., due to alternative selection).
    *   Products involved are deleted from the system (if not LGDEAL stock that can be re-listed).
    *   Certificates of products (if any) are blacklisted as "deal_cancelled".
    *   No further transitions.

### 2.3. Stage and Status Transitions Validation

*   `isValidStageTransition(currentStage, newStage)`:
    *   Generally, stages must progress in the defined order.
    *   Moving to `cancelled` stage is always allowed.
*   `isValidStatusTransition(currentStatus, newStatus, stage)`:
    *   Defines allowed status changes within a given stage.
    *   Specific rules apply, e.g., `pending` in `request` can go to `approved`, `rejected`, or `cancelled`.
    *   Moving to `cancelled` status is generally allowed.
    *   Special conditions exist for stage-crossing status changes, e.g.:
        *   From `negotiation` (various statuses like `terms_proposed`, `seller_counter_offer`) to `payment_delivery` stage, the new status must be `awaiting_invoice`.
        *   From `request` (`pending` status) to `negotiation` stage, the new status must be `negotiating`.

## 3. Key Deal Processes

### 3.1. Deal Initiation (`initiateDealFromCart`)

1.  **Trigger:** Buyer initiates checkout from cart.
2.  **Input:** `cartItemIds`, `shippingAddress`.
3.  **Buyer Validation:** Checks buyer and buyer's company.
4.  **LGDEAL Company:** Identifies the LGDEAL management company.
5.  **Product Processing & Grouping:**
    *   For each cart item:
        *   Validates product and price.
        *   Identifies seller company.
        *   **Alternative Product Search:** `findAlternativeProducts()` is called for *each* primary product.
            *   `getColorSearchCriteria()`: Finds primary color +/- 1 grade.
            *   Searches for products with similar shape, clarity, weight (carat +/- 0.03), and color criteria, not sold, not on another deal.
        *   **Alternative L2S Deal Creation:** For each *found alternative*:
            *   Finds an active seller user from the alternative product's company.
            *   Generates a unique deal number (e.g., `...altsX`).
            *   Creates an `lgdeal-to-seller` (L2S) deal:
                *   Type: `lgdeal-to-seller`.
                *   LGDEAL is the buyer, alternative's supplier is the seller.
                *   Amount: Alternative product price * 0.96.
                *   Fee: 4% of the 96% amount.
                *   Stage: `request`, Status: `pending`.
                *   `pairedDealId`: Placeholder (updated later with main B2L deal ID).
                *   Notes indicate it's for an alternative product.
                *   Shipping from alternative seller to LGDEAL.
            *   Saves this L2S deal and stores its ID.
        *   The original product is added to `allProducts` list for the main B2L deal, along with `suggestedAlternatives` (which includes the alternative product ID and the ID of the L2S deal created for it).
    *   If product belongs to LGDEAL: It's added to `lgdealProducts` list and no L2S deal is created for it.
    *   If product belongs to another seller:
        *   Finds an active seller user.
        *   Groups the product under its seller in `sellerGroups` for creating a primary L2S deal.
6.  **Buyer-to-LGDEAL (B2L) Deal Creation:**
    *   Generates a buyer deal number.
    *   Creates the main `Deal` object:
        *   Type: `buyer-to-lgdeal`.
        *   Buyer is the initiator, LGDEAL is the seller.
        *   Amount: Total of original product prices.
        *   Stage: `request`, Status: `pending`.
        *   `products`: Contains entries for each original product, including `suggestedAlternatives`.
        *   Shipping details from buyer's input.
    *   Saves the B2L deal.
7.  **Update Alternative L2S Deals:**
    *   Updates all L2S deals created for alternatives with the `pairedDealId` (ID of the saved B2L deal) and updates notes with the B2L deal number.
8.  **Primary LGDEAL-to-Seller (L2S) Deal Creation:**
    *   For each group in `sellerGroups` (i.e., for each external seller of primary products):
        *   Generates a seller deal number (e.g., `...a`, `...b`).
        *   Creates an L2S deal:
            *   Type: `lgdeal-to-seller`.
            *   LGDEAL is the buyer, group's seller is the seller.
            *   Amount: Sum of (product price * 0.96) for that seller.
            *   Fee: 4% of this amount.
            *   Stage: `request`, Status: `pending`.
            *   `pairedDealId`: ID of the B2L deal.
            *   Shipping from seller to LGDEAL.
        *   Saves the L2S deal and stores its ID.
9.  **Update B2L Deal:**
    *   Adds IDs of all created primary L2S deals to `pairedDealIds` array in the B2L deal.
    *   Saves the B2L deal again.
10. **Direct LGDEAL Deal Handling:**
    *   If all products are from LGDEAL stock (no primary L2S deals created, `sellerDeals.length === 0 && lgdealProducts.length > 0`):
        *   The B2L deal stage is immediately set to `negotiation` and status to `negotiating`.
11. **Mark Products:**
    *   Updates `Product` documents: `onDeal = true`, `dealId = savedBuyerDeal._id`, `status = 'OnDeal'`.
12. **Clear Cart:** Removes items from buyer's cart.
13. **Response:** Returns IDs of created B2L and L2S deals.

### 3.2. Negotiation (`submitNegotiationProposal`, `acceptNegotiationTerms`)

#### 3.2.1. Submitting a Proposal (`submitNegotiationProposal`)

1.  **Authorization:**
    *   User must be buyer, seller, or authorized LGDEAL admin for the specific deal type.
    *   Direct LGDEAL deals (`isDirectLgdealDeal`): LGDEAL admin can act as either party.
2.  **Validation:**
    *   Deal must be in `negotiation` stage.
    *   Status must be `negotiating`, `terms_proposed`, or `seller_counter_offer`.
    *   Price must be > 0.
    *   Total discount cannot exceed a cap (e.g., 20% for users, 30% for LGDEAL admin).
3.  **Proposal Creation:**
    *   Calculates individual product prices proportionally based on the proposed total price.
    *   Proposal object includes: `proposedBy`, `proposedDate`, `price`, `products` (with new prices), `deliveryTerms`, `additionalTerms`, `status: 'proposed'`, `shippingCost`.
4.  **Deal Update:**
    *   Adds proposal to `deal.negotiationDetails.proposedTerms`.
    *   Updates `deal.status`:
        *   If proposed by buyer/LGDEAL buyer: `terms_proposed`.
        *   If proposed by seller/LGDEAL seller: `seller_counter_offer` or `seller_final_offer` (if terms include "maintains original price").
        *   If direct LGDEAL deal: status depends on current context (e.g., counter if replying, proposed if initial).
    *   Adds to activity log.
    *   Saves deal.

#### 3.2.2. Accepting Terms (`acceptNegotiationTerms`)

1.  **Authorization:**
    *   User must be the counterparty to the proposal (cannot accept their own proposal, *unless* it's a direct LGDEAL deal and the user is an LGDEAL admin).
    *   User must be part of the deal.
2.  **Validation:**
    *   Deal must be in `negotiation` stage.
    *   Proposal must exist.
3.  **Deal Update:**
    *   Sets accepted proposal `status: 'accepted'`.
    *   Copies accepted proposal details to `deal.negotiationDetails.finalTerms`.
    *   Updates `deal.shippingDetails.cost` with the shipping cost from the accepted proposal.
    *   **Stage/Status Change:** Sets `deal.stage = 'payment_delivery'` and `deal.status = 'awaiting_invoice'`.
    *   Adds to activity log.
    *   Saves deal.
4.  **Paired Deal Logic (L2S accepted by LGDEAL):**
    *   If an `lgdeal-to-seller` deal's terms are accepted by LGDEAL (acting as buyer) and it has a `pairedDealId` (linking to a B2L deal):
        *   The paired B2L deal's status might be updated (e.g., to `negotiating` or a status indicating supplier terms accepted).

### 3.3. Payment and Delivery

#### 3.3.1. Upload Invoice (`uploadInvoice` in `paymentDelivery.js`)

1.  **Authorization:** Seller or LGDEAL admin (acting as seller, including in direct LGDEAL deals).
2.  **Action:**
    *   Saves invoice file.
    *   Updates `deal.paymentDetails.invoiceFilename`, `deal.invoiceUrl`.
    *   Sets `deal.status = 'invoice_pending'`.
    *   Adds to activity log.
    *   Saves deal.

#### 3.3.2. Upload Shipping Documents (`uploadShippingDocuments` in `paymentDelivery.js`)

1.  **Authorization:** Seller or LGDEAL admin (acting as seller).
2.  **Action:**
    *   Saves document files.
    *   Adds document details to `deal.shippingDocuments` array.
    *   Sets `deal.status = 'shipping_documents_uploaded'`.
    *   Adds to activity log.
    *   Saves deal.

#### 3.3.3. Add Tracking Number (`addTrackingNumber` in `paymentDelivery.js`)

1.  **Authorization:** Seller or LGDEAL admin (acting as seller).
2.  **Action:**
    *   Updates `deal.shippingDetails.trackingNumber`, `deal.shippingDetails.carrier`.
    *   Sets `deal.status = 'shipped'`.
    *   Adds to activity log.
    *   Saves deal.

#### 3.3.4. Confirm Delivery (`confirmDelivery` in `state.js`)

1.  **Authorization:** Buyer or LGDEAL admin (acting as buyer in L2S, or in direct B2L deals).
2.  **Validation:** Deal stage must be `payment_delivery` and status `shipped`.
3.  **Action:**
    *   Sets `deal.stage = 'completed'`, `deal.status = 'completed'`.
    *   Updates `deal.deliveryDetails` (and/or `deal.shippingDetails`) with delivery date and confirmer.
    *   Adds to activity log.
    *   Saves deal.
4.  **Paired Deal Completion:**
    *   If a `buyer-to-lgdeal` is completed, any `pairedDealIds` (L2S deals) are also automatically moved to `completed` status.
5.  **Product Processing:** Calls `processProductsOnDealEnd(deal, 'completed', userId)`.

### 3.4. Deal State Management (`updateDealStage`, `confirmDelivery`, `selectAlternativeProduct` in `state.js`)

#### 3.4.1. Update Deal Stage/Status (`updateDealStage`)

*   **Authorization:** User role must be valid for the deal.
*   **Validation:**
    *   `isValidStageTransition()` for stage changes.
    *   `isValidStatusTransition()` for status changes.
    *   Shipping cost, if provided, must be non-negative.
*   **Special Logic for `negotiation` to `payment_delivery` transition:**
    *   If no negotiation occurred, default final terms are created using original prices and current shipping cost.
    *   If `negotiationDetails.finalTerms` are provided in request body, they are validated and used.
    *   Otherwise, the last proposal is used to create final terms.
    *   Ensures `deal.shippingDetails.cost` is consistent with final terms.
*   **Action:**
    *   Updates `deal.stage`, `deal.status`, `deal.notes`.
    *   Updates `deal.shippingDetails.cost` if provided.
    *   Adds to activity log.
    *   Saves deal.
*   **Product Processing on Completion/Cancellation:** If new status is `completed` (and stage is `completed`) or `cancelled`, calls `processProductsOnDealEnd()`.

#### 3.4.2. `processProductsOnDealEnd(deal, status, userId)` (Helper Function)

*   **If `status === 'completed'`:**
    *   Updates `Product` status to `'Sold'` for all products in the deal.
    *   For products with certificate numbers, adds entries to `BlacklistedCertificate` with `reason: 'product_sold'`.
*   **If `status === 'cancelled'`:**
    *   Deletes `Product` documents for all products in the deal.
    *   For products with certificate numbers, adds entries to `BlacklistedCertificate` with `reason: 'deal_cancelled'`.
*   Blacklist entries are inserted using `insertMany` with `ordered: false` to ignore duplicate errors (e.g., if a certificate is already blacklisted).

#### 3.4.3. Select Alternative Product (`selectAlternativeProduct`)

1.  **Authorization:** Only LGDEAL Supervisors (`req.user.isLgdealSupervisor`).
2.  **Validation:**
    *   Deal must be `buyer-to-lgdeal`.
    *   Original product and suggested alternative must exist in the deal.
3.  **Deal Update (Main B2L Deal):**
    *   Marks the original product entry: `originalProductStruckOut = true`.
    *   Sets `selectedAlternativeProduct` to the ID of the chosen alternative.
    *   Stores `originalPriceBeforeSwap`.
    *   Updates the `price` of this item in the deal to the alternative product's actual price.
    *   Recalculates `deal.amount` (total deal amount).
    *   Adds an activity log detailing the product swap.
    *   Saves the main B2L deal.
4.  **Automatic Cancellation of Related L2S Deals:**
    *   **Original Product's L2S Deal:** If the *original* product had an associated L2S deal (i.e., it was sourced from an external seller), this L2S deal is marked for cancellation.
    *   **Unselected Alternatives' L2S Deals:** All L2S deals created for *other, unselected* alternatives for this specific product line item are marked for cancellation.
    *   The L2S deal for the *selected* alternative remains active.
    *   Updates these L2S deals to `stage: 'cancelled'`, `status: 'cancelled'`, with appropriate notes and activity log entries.

### 3.5. Deal Retrieval

Various endpoints exist to retrieve deals based on user roles and context:

*   `getBuyerDeals`:
    *   LGDEAL Supervisor: Gets all `lgdeal-to-seller` deals (where LGDEAL is buyer).
    *   Regular User: Gets their `buyer-to-lgdeal` deals.
*   `getSellerDeals`:
    *   LGDEAL Supervisor: Gets all `buyer-to-lgdeal` deals (where LGDEAL is seller).
    *   Regular User: Gets `lgdeal-to-seller` deals where they or their company is the seller.
*   `getDealById`:
    *   Retrieves a specific deal by ID.
    *   Populates extensive details (products, alternatives, companies, logs).
    *   Authorization: User must be LGDEAL admin, buyer, seller, or belong to buyer/seller company.
    *   Determines `userRole`, `allowedActions`, and `isDirectLgdealDeal` for the response.
*   `getSupervisorDashboardDeals`:
    *   For LGDEAL Supervisors.
    *   Fetches main customer sales (`buyer-to-lgdeal` where LGDEAL is seller) and all LGDEAL supplier purchases (`lgdeal-to-seller` where LGDEAL is buyer).
    *   Categorizes supplier purchases as `standaloneSupplierPurchase`, `primarySupplierPurchase` (for an original product in a paired B2L deal), or `alternativeSupplierPurchase` (for a selected alternative in a paired B2L deal).
    *   Provides `counterpartyName` and `linkedToDealNumber` for clarity.

## 4. Allowed Actions (`getAllowedActions`)

The `getAllowedActions(deal, userRole, isDirectLgdealDeal)` helper function determines what actions a user can perform on a deal based on its current state (stage, status) and the user's role.

Examples of actions:

*   **Request Stage:** `approve_request`, `reject_request`, `cancel_deal`.
*   **Negotiation Stage:** `submit_proposal`, `counter_offer`, `accept_terms`, `move_to_payment`, `cancel_deal`.
*   **Payment & Delivery Stage:** `upload_invoice`, `accept_invoice`, `reject_invoice`, `confirm_payment`, `add_tracking`, `confirm_delivery`, `cancel_deal`.

The specific actions available depend heavily on whether the user is a buyer, seller, or an LGDEAL admin (and in what capacity LGDEAL is involved, including direct deals).

## 5. Helper Functions (`helpers.js`)

*   `determineLgdealRole()`: Determines if LGDEAL is acting as buyer or seller in a deal based on `dealType`.
*   `determineUserRole()`: Determines the current user's role in a specific deal.
*   `isValidStageTransition()`: Validates if a stage change is allowed.
*   `isValidStatusTransition()`: Validates if a status change is allowed within a stage.
*   `processProductsOnDealEnd()`: Handles product status updates and blacklisting on deal completion or cancellation.
*   `getAllowedActions()`: Determines permissible actions for a user on a deal.
*   `getColorSearchCriteria()`: Used by `findAlternativeProducts` to define color range for search.
*   `findAlternativeProducts()`: Searches for alternative products based on criteria like shape, carat, clarity, and color.

This documentation should provide a solid understanding of the deal flow and management within the system.

## 6. Product Data Parsing and Processing Logic

This section details how product data is parsed, validated, and processed when imported into the system, either via file uploads (XLSX, CSV) or through API synchronization with supplier systems. The primary logic resides in `server/utils/productUtils.js`.

### 6.1. Overview of Processing Steps

1.  **Source Data Acquisition:**
    *   **File Uploads (`inventoryController.js`):**
        *   XLSX/CSV files are parsed. Headers are mapped to internal field names using `productUtils.findMatchingField` based on `COLUMN_MAPPINGS`.
        *   An `id` is generated (UUIDv4) if not present in the source row.
    *   **API Sync (`companyApiController.js`):**
        *   Data is fetched from the supplier's API.
        *   A `dataKey` from `CompanyApiConfig` is used to locate the array of products within the API response.
        *   Filters defined in `CompanyApiConfig` can be applied to the raw product list.
        *   The `productUtils.getFieldValue` helper is used to extract data based on common field name variations.
        *   An `id` is generated (UUIDv4) if not resolvable from common ID fields (e.g., `id`, `stone_id`, `stock_id`, `report_no`).

2.  **Pre-filtering and Checks (Common to both sources):**
    *   **Blacklisted Certificates:** Products with certificate numbers found in the `BlacklistedCertificate` collection are skipped.
    *   **Existing Products on Deal/Sold:** Products that already exist in the database *for the same company* and have a status of `OnDeal` or `Sold` are skipped during API sync. During file upload, this check also prevents re-importing such items.

3.  **Individual Product Processing (`productUtils.processProduct` and helpers):**
    *   Each product record undergoes detailed validation and transformation.
    *   If a product fails critical validation (like invalid status or color for white diamonds), it is skipped.

4.  **Database Update:**
    *   **File Uploads:**
        *   `replace` mode: Existing products for the company (not `OnDeal` or `Sold`) are deleted, and new valid products are inserted.
        *   `update` mode: Existing products (not `OnDeal` or `Sold`) are updated based on `id`, and new products are inserted (upsert).
    *   **API Sync:**
        *   Existing products for the company (not `OnDeal` or `Sold`) are deleted.
        *   New valid products from the API are inserted.

### 6.2. Field Mapping (`COLUMN_MAPPINGS`, `getFieldValue`)

*   The `productUtils.COLUMN_MAPPINGS` object defines a list of common header names (from files) or field names (from APIs) that map to the internal `Product` schema fields.
    *   Example: `price` can be mapped from "price", "total price", "cost", "NET_VALUE", etc.
*   `productUtils.findMatchingField(headerName)`: Used during file parsing to find the internal field name corresponding to a column header.
*   `productUtils.getFieldValue(product, primaryField, alternativeFields = [])`: Used during API sync to retrieve a value from a product object, checking the `primaryField` first, then a list of `alternativeFields`.

### 6.3. Key Field Processing, Validation, and Default Values

The `Product` schema is defined in `server/models/Product.js`. Many fields have `default` values in the schema. The processing logic in `productUtils.js` further refines or provides values.

| Field                 | Processing & Validation Logic (`productUtils.js`)                                                                                                                                                                                            | Default (Schema/Util)         | Notes                                                                                                        |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **`id`**              | - File: Generated as UUIDv4 if not in source. <br/> - API: Extracted via `getFieldValue` (from `id`, `stone_id`, etc.) or generated as UUIDv4 if not found.                                                                                    | N/A (Generated if missing)    | **Primary Key** for product identification within the system.                                                |
| `company`             | Assigned the `_id` of the company uploading/syncing the inventory.                                                                                                                                                                         | N/A (Assigned by controller)  | **Required**. Links product to a supplier.                                                                   |
| `shape`               | Normalized using `productUtils.normalizeShape` based on `SHAPE_MAPPING`. E.g., "RD", "ROUND", "Brilliant" all become "Round". If no match, original value is kept.                                                                               | `''` (empty string)           |                                                                                                              |
| `carat`               | Parsed as `parseFloat`.                                                                                                                                                                                                                      | `0`                           |                                                                                                              |
| **`color`**           | Validated by `productUtils.validateDiamondColor`. **Only 'D', 'E', 'F', 'G' are considered valid for import.** Other colors result in the product being skipped. Value is normalized to uppercase (e.g., 'd' -> 'D').                         | `''`                          | **Crucial Validation**: Non-compliant products are filtered out.                                               |
| `stoneType`           | Uses value from source if present. Otherwise, `productUtils.determineStoneType` sets it to 'fancy diamond' if color implies it (pink, blue, etc.), else 'diamond'.                                                                           | `'diamond'`                   |                                                                                                              |
| `overtone`            | Formatted using `productUtils.formatFieldValue` (trims string).                                                                                                                                                                                | `''`                          |                                                                                                              |
| `intensity`           | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `clarity`             | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `cut`                 | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `polish`              | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| **`price`**           | Parsed as `parseFloat`. If `price` is 0 or missing, but `pricePerCarat` and `carat` are present, `price` is calculated (`pricePerCarat * carat`). Rounded to 2 decimal places.                                                               | `0`                           |                                                                                                              |
| `pricePerCarat`       | Parsed as `parseFloat`. If `pricePerCarat` is 0 or missing, but `price` and `carat` are present, `pricePerCarat` is calculated (`price / carat`). Rounded to 2 decimal places. (This specific calculation is in `companyApiController`) | `0` (Schema)                  | `processProduct` ensures final price is calculated. `companyApiController` handles `pricePerCarat` calculation. |
| `symmetry`            | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `location`            | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `technology`          | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `photo`               | Validated by `productUtils.validateUrl` (checks for `http://` or `https://` prefix).                                                                                                                                                         | `''`                          | Invalid URLs become empty strings.                                                                           |
| `video`               | Validated by `productUtils.validateUrl`.                                                                                                                                                                                                     | `''`                          | Invalid URLs become empty strings.                                                                           |
| `sold`                | Converted to Boolean.                                                                                                                                                                                                                        | `false`                       |                                                                                                              |
| `onDeal`              | (Schema default)                                                                                                                                                                                                                             | `false`                       | Managed by deal logic, not directly during initial parsing.                                                  |
| `dealId`              | (Schema default)                                                                                                                                                                                                                             | `null`                        | Managed by deal logic.                                                                                       |
| **`status`**          | Validated by `productUtils.validateProductStatus`. Values like 'available', '1', 'on stock', 'true' are normalized to `'available'`. **If status is not recognized as available, the product is skipped.**                                  | `'available'`                 | **Crucial Validation**: Non-compliant products are filtered out.                                               |
| `measurement1`        | Parsed from `measurements` string or individual fields (`measurement1`, `length`, etc.) using `productUtils.parseMeasurements` and `getFieldValue`. `parseFloat`.                                                                         | `0`                           | See `parseMeasurements` details below.                                                                       |
| `measurement2`        | Parsed similarly to `measurement1`.                                                                                                                                                                                                          | `0`                           |                                                                                                              |
| `measurement3`        | Parsed similarly to `measurement1`.                                                                                                                                                                                                          | `0`                           |                                                                                                              |
| `tableSize`           | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `crownHeight`         | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `pavilionDepth`       | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `girdle`              | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `culet`               | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `totalDepth`          | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `fluorescence`        | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `ha`                  | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          | (Hearts and Arrows)                                                                                          |
| `certificateInstitute`| Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `certificateNumber`   | Value is processed to remove non-digit characters (e.g., "GIA-123" becomes "123"). Then parsed as `parseInt`.                                                                                                                               | `0`                           | String in API sync, converted to number in `processProduct`.                                                 |
| `link`                | Automatically generated as `/product/[productId]` by `processProduct`. For API sync, it's also `https://in-diamonds.com/product/[productId]`.                                                                                              | (Generated)                   |                                                                                                              |
| `createdAt`           | (Schema default)                                                                                                                                                                                                                             | `Date.now`                    |                                                                                                              |
| `updatedAt`           | (Schema default, and updated by `formatProductData` during manual product updates)                                                                                                                                                         | `Date.now`                    |                                                                                                              |

**Mandatory Fields for Successful Processing:**
While the schema defines `id` and `company` as `required`, the processing logic ensures these are always present:
*   `company`: Provided by the system based on the uploader or API config.
*   `id`: Generated if not extractable from the source.
A product *will be skipped* if:
*   Its `status` is not considered 'available' (see `validateProductStatus`).
*   Its `color` is not 'D', 'E', 'F', or 'G' (see `validateDiamondColor`).
*   Its `certificateNumber` is found in the `BlacklistedCertificate` collection.
*   During API sync or file upload, if a product with the same `id` for the same `company` already exists and is marked `OnDeal` or `Sold`.

### 6.4. Specific Parsing Logic Details

#### 6.4.1. `parseMeasurements(measurementsString)`
This function attempts to parse a single string containing product dimensions (length, width, height) into `measurement1`, `measurement2`, and `measurement3`.
*   It tries to match common patterns:
    *   `7.26*7.30*4.60` (asterisk delimited)
    *   `7.26x7.30x4.60` (x delimited)
    *   `7.26-7.30-4.60` (hyphen delimited)
    *   `7.26 7.30 4.60` (space delimited)
    *   `7.26,7.30,4.60` (comma delimited)
    *   `7.26/7.30/4.60` (slash delimited)
*   If these patterns don't match, it attempts to find all numbers in the string. If 3 or more numbers are found, it uses the first three. If 2 are found, it uses them for `measurement1` and `measurement2`. If 1 is found, it's used for `measurement1`.
*   Individual fields like `measurement1`, `length`, `width`, `height` (if present in source data) can override values parsed from a combined `measurements` string.

#### 6.4.2. `normalizeShape(shapeString)`
*   Converts input to uppercase and trims whitespace.
*   Compares against `SHAPE_MAPPING`:
    *   First checks for direct matches with standard shape names (e.g., "ROUND").
    *   Then checks against an array of common variations for each standard shape (e.g., "RD", "RBC" for "Round").
*   If a match is found, the standard shape name is returned. Otherwise, the original input string is returned.

#### 6.4.3. `validateDiamondColor(colorString)`
*   Normalizes input to uppercase.
*   **Crucially, it only returns `isValid: true` if the normalized color is 'D', 'E', 'F', or 'G'.**
*   All other colors, or empty input, result in `isValid: false`, leading to the product being skipped during import/sync.

#### 6.4.4. `validateProductStatus(statusString)`
*   Normalizes input to lowercase.
*   A list of `allowedValues` (e.g., "available", "1", "on stock", "true") are all considered valid and result in `normalizedStatus: 'available'` and `isValid: true`.
*   Any other status string results in `isValid: false`, and the product is skipped. If no status is provided, it defaults to `'available'` and `isValid: true`.

### 6.5. Future Enhancements and Considerations
*   **More Granular Error Reporting:** Provide detailed feedback on why specific products were skipped during upload/sync.
*   **Configurable Validation Rules:** Allow administrators to define or modify validation rules (e.g., allowed color ranges, mandatory fields per supplier) perhaps via `CompanyApiConfig`.
*   **Dry Run Mode:** Implement a "dry run" option for uploads/syncs to preview changes and validation issues without committing to the database.
*   **Handling of Fancy Colors:** The current `validateDiamondColor` strictly filters for D-G. If fancy colored diamonds need to be supported, this logic (and potentially `determineStoneType`) would require significant updates.
*   **Unit Price vs. Total Price:** Ensure consistent handling and calculation if one is missing. The current logic primarily calculates total price from unit price, and API sync has a separate calculation for price per carat.

This detailed breakdown should clarify how product data is handled and help in refining these rules further.

##### 6.2.2. Field Validation Rules:

*   **`status` (Статус продукта):**
    *   При импорте проверяется функцией `validateProductStatus`.
    *   Значения типа "available", "1", "on stock", "in stock", "yes", "true" (без учета регистра) нормализуются в `available`.
    *   Любые другие значения считаются невалидными, и продукт с таким статусом пропускается (учитывается в `stats.skippedInvalidStatus`).
*   **`color` (Цвет бриллианта):**
    *   Проверяется функцией `validateDiamondColor`.
    *   Допустимы только стандартные "белые" цвета: `D`, `E`, `F`, `G` (без учета регистра).
    *   Продукты с другими цветами пропускаются (учитывается в `stats.skippedInvalidColor`).
    *   На основе цвета также определяется `stoneType` (`diamond` или `fancy diamond`).
*   **`clarity` (Чистота):**
    *   **Обязательное поле.**
    *   Допустимые значения (без учета регистра, после нормализации): `VS2`, `VS1`, `VVS2`, `VVS1`, `EX`, `IF`.
    *   Продукты с другими значениями или без значения чистоты пропускаются (учитывается в `stats.skippedInvalidClarity`).
*   **`price` (Цена):**
    *   **Обязательное поле.**
    *   Должна быть числом в диапазоне от `0` до `150000` включительно.
    *   Цена рассчитывается или используется напрямую; если итоговая цена выходит за пределы диапазона, продукт пропускается (учитывается в `stats.skippedInvalidPrice`).
*   **`carat` (Вес в каратах):**
    *   **Обязательное поле.**
    *   Должен быть числом в диапазоне от `0.3` до `100` включительно.
    *   Продукты, у которых вес выходит за пределы этого диапазона, пропускаются (учитывается в `stats.skippedInvalidCarat`).
*   **`certificateNumber` и `certificateInstitute` (Номер и институт сертификата):**
    *   Ключевые поля для идентификации уникального камня.
    *   Номер сертификата приводится к строке и `trim`-мится.
*   **`photo`, `video` (Медиа-ссылки):**
    *   **Обязательно наличие хотя бы одной валидной ссылки.**
    *   Каждая ссылка (фото и видео) проверяется функцией `validateUrl` (должна начинаться с `http://` или `https://`).
    *   Если обе ссылки (`photo` и `video`) отсутствуют или невалидны после проверки, продукт пропускается (учитывается в `stats.skippedMissingMedia`).

This documentation should provide a solid understanding of the deal flow and management within the system.

## 6. Product Data Parsing and Processing Logic

This section details how product data is parsed, validated, and processed when imported into the system, either via file uploads (XLSX, CSV) or through API synchronization with supplier systems. The primary logic resides in `server/utils/productUtils.js`.

### 6.1. Overview of Processing Steps

1.  **Source Data Acquisition:**
    *   **File Uploads (`inventoryController.js`):**
        *   XLSX/CSV files are parsed. Headers are mapped to internal field names using `productUtils.findMatchingField` based on `COLUMN_MAPPINGS`.
        *   An `id` is generated (UUIDv4) if not present in the source row.
    *   **API Sync (`companyApiController.js`):**
        *   Data is fetched from the supplier's API.
        *   A `dataKey` from `CompanyApiConfig` is used to locate the array of products within the API response.
        *   Filters defined in `CompanyApiConfig` can be applied to the raw product list.
        *   The `productUtils.getFieldValue` helper is used to extract data based on common field name variations.
        *   An `id` is generated (UUIDv4) if not resolvable from common ID fields (e.g., `id`, `stone_id`, `stock_id`, `report_no`).

2.  **Pre-filtering and Checks (Common to both sources):**
    *   **Blacklisted Certificates:** Products with certificate numbers found in the `BlacklistedCertificate` collection are skipped.
    *   **Existing Products on Deal/Sold:** Products that already exist in the database *for the same company* and have a status of `OnDeal` or `Sold` are skipped during API sync. During file upload, this check also prevents re-importing such items.

3.  **Individual Product Processing (`productUtils.processProduct` and helpers):**
    *   Each product record undergoes detailed validation and transformation.
    *   If a product fails critical validation (like invalid status or color for white diamonds), it is skipped.

4.  **Database Update:**
    *   **File Uploads:**
        *   `replace` mode: Existing products for the company (not `OnDeal` or `Sold`) are deleted, and new valid products are inserted.
        *   `update` mode: Existing products (not `OnDeal` or `Sold`) are updated based on `id`, and new products are inserted (upsert).
    *   **API Sync:**
        *   Existing products for the company (not `OnDeal` or `Sold`) are deleted.
        *   New valid products from the API are inserted.

### 6.2. Field Mapping (`COLUMN_MAPPINGS`, `getFieldValue`)

*   The `productUtils.COLUMN_MAPPINGS` object defines a list of common header names (from files) or field names (from APIs) that map to the internal `Product` schema fields.
    *   Example: `price` can be mapped from "price", "total price", "cost", "NET_VALUE", etc.
*   `productUtils.findMatchingField(headerName)`: Used during file parsing to find the internal field name corresponding to a column header.
*   `productUtils.getFieldValue(product, primaryField, alternativeFields = [])`: Used during API sync to retrieve a value from a product object, checking the `primaryField` first, then a list of `alternativeFields`.

### 6.3. Key Field Processing, Validation, and Default Values

The `Product` schema is defined in `server/models/Product.js`. Many fields have `default` values in the schema. The processing logic in `productUtils.js` further refines or provides values.

| Field                 | Processing & Validation Logic (`productUtils.js`)                                                                                                                                                                                            | Default (Schema/Util)         | Notes                                                                                                        |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **`id`**              | - File: Generated as UUIDv4 if not in source. <br/> - API: Extracted via `getFieldValue` (from `id`, `stone_id`, etc.) or generated as UUIDv4 if not found.                                                                                    | N/A (Generated if missing)    | **Primary Key** for product identification within the system.                                                |
| `company`             | Assigned the `_id` of the company uploading/syncing the inventory.                                                                                                                                                                         | N/A (Assigned by controller)  | **Required**. Links product to a supplier.                                                                   |
| `shape`               | Normalized using `productUtils.normalizeShape` based on `SHAPE_MAPPING`. E.g., "RD", "ROUND", "Brilliant" all become "Round". If no match, original value is kept.                                                                               | `''` (empty string)           |                                                                                                              |
| `carat`               | Parsed as `parseFloat`.                                                                                                                                                                                                                      | `0`                           |                                                                                                              |
| **`color`**           | Validated by `productUtils.validateDiamondColor`. **Only 'D', 'E', 'F', 'G' are considered valid for import.** Other colors result in the product being skipped. Value is normalized to uppercase (e.g., 'd' -> 'D').                         | `''`                          | **Crucial Validation**: Non-compliant products are filtered out.                                               |
| `stoneType`           | Uses value from source if present. Otherwise, `productUtils.determineStoneType` sets it to 'fancy diamond' if color implies it (pink, blue, etc.), else 'diamond'.                                                                           | `'diamond'`                   |                                                                                                              |
| `overtone`            | Formatted using `productUtils.formatFieldValue` (trims string).                                                                                                                                                                                | `''`                          |                                                                                                              |
| `intensity`           | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `clarity`             | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `cut`                 | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `polish`              | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| **`price`**           | Parsed as `parseFloat`. If `price` is 0 or missing, but `pricePerCarat` and `carat` are present, `price` is calculated (`pricePerCarat * carat`). Rounded to 2 decimal places.                                                               | `0`                           |                                                                                                              |
| `pricePerCarat`       | Parsed as `parseFloat`. If `pricePerCarat` is 0 or missing, but `price` and `carat` are present, `pricePerCarat` is calculated (`price / carat`). Rounded to 2 decimal places. (This specific calculation is in `companyApiController`) | `0` (Schema)                  | `processProduct` ensures final price is calculated. `companyApiController` handles `pricePerCarat` calculation. |
| `symmetry`            | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `location`            | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `technology`          | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `photo`               | Validated by `productUtils.validateUrl` (checks for `http://` or `https://` prefix).                                                                                                                                                         | `''`                          | Invalid URLs become empty strings.                                                                           |
| `video`               | Validated by `productUtils.validateUrl`.                                                                                                                                                                                                     | `''`                          | Invalid URLs become empty strings.                                                                           |
| `sold`                | Converted to Boolean.                                                                                                                                                                                                                        | `false`                       |                                                                                                              |
| `onDeal`              | (Schema default)                                                                                                                                                                                                                             | `false`                       | Managed by deal logic, not directly during initial parsing.                                                  |
| `dealId`              | (Schema default)                                                                                                                                                                                                                             | `null`                        | Managed by deal logic.                                                                                       |
| **`status`**          | Validated by `productUtils.validateProductStatus`. Values like 'available', '1', 'on stock', 'true' are normalized to `'available'`. **If status is not recognized as available, the product is skipped.**                                  | `'available'`                 | **Crucial Validation**: Non-compliant products are filtered out.                                               |
| `measurement1`        | Parsed from `measurements` string or individual fields (`measurement1`, `length`, etc.) using `productUtils.parseMeasurements` and `getFieldValue`. `parseFloat`.                                                                         | `0`                           | See `parseMeasurements` details below.                                                                       |
| `measurement2`        | Parsed similarly to `measurement1`.                                                                                                                                                                                                          | `0`                           |                                                                                                              |
| `measurement3`        | Parsed similarly to `measurement1`.                                                                                                                                                                                                          | `0`                           |                                                                                                              |
| `tableSize`           | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `crownHeight`         | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `pavilionDepth`       | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `girdle`              | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `culet`               | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `totalDepth`          | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `fluorescence`        | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `ha`                  | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          | (Hearts and Arrows)                                                                                          |
| `certificateInstitute`| Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `certificateNumber`   | Value is processed to remove non-digit characters (e.g., "GIA-123" becomes "123"). Then parsed as `parseInt`.                                                                                                                               | `0`                           | String in API sync, converted to number in `processProduct`.                                                 |
| `link`                | Automatically generated as `/product/[productId]` by `processProduct`. For API sync, it's also `https://in-diamonds.com/product/[productId]`.                                                                                              | (Generated)                   |                                                                                                              |
| `createdAt`           | (Schema default)                                                                                                                                                                                                                             | `Date.now`                    |                                                                                                              |
| `updatedAt`           | (Schema default, and updated by `formatProductData` during manual product updates)                                                                                                                                                         | `Date.now`                    |                                                                                                              |

**Mandatory Fields for Successful Processing:**
While the schema defines `id` and `company` as `required`, the processing logic ensures these are always present:
*   `company`: Provided by the system based on the uploader or API config.
*   `id`: Generated if not extractable from the source.
A product *will be skipped* if:
*   Its `status` is not considered 'available' (see `validateProductStatus`).
*   Its `color` is not 'D', 'E', 'F', or 'G' (see `validateDiamondColor`).
*   Its `certificateNumber` is found in the `BlacklistedCertificate` collection.
*   During API sync or file upload, if a product with the same `id` for the same `company` already exists and is marked `OnDeal` or `Sold`.

### 6.4. Specific Parsing Logic Details

#### 6.4.1. `parseMeasurements(measurementsString)`
This function attempts to parse a single string containing product dimensions (length, width, height) into `measurement1`, `measurement2`, and `measurement3`.
*   It tries to match common patterns:
    *   `7.26*7.30*4.60` (asterisk delimited)
    *   `7.26x7.30x4.60` (x delimited)
    *   `7.26-7.30-4.60` (hyphen delimited)
    *   `7.26 7.30 4.60` (space delimited)
    *   `7.26,7.30,4.60` (comma delimited)
    *   `7.26/7.30/4.60` (slash delimited)
*   If these patterns don't match, it attempts to find all numbers in the string. If 3 or more numbers are found, it uses the first three. If 2 are found, it uses them for `measurement1` and `measurement2`. If 1 is found, it's used for `measurement1`.
*   Individual fields like `measurement1`, `length`, `width`, `height` (if present in source data) can override values parsed from a combined `measurements` string.

#### 6.4.2. `normalizeShape(shapeString)`
*   Converts input to uppercase and trims whitespace.
*   Compares against `SHAPE_MAPPING`:
    *   First checks for direct matches with standard shape names (e.g., "ROUND").
    *   Then checks against an array of common variations for each standard shape (e.g., "RD", "RBC" for "Round").
*   If a match is found, the standard shape name is returned. Otherwise, the original input string is returned.

#### 6.4.3. `validateDiamondColor(colorString)`
*   Normalizes input to uppercase.
*   **Crucially, it only returns `isValid: true` if the normalized color is 'D', 'E', 'F', or 'G'.**
*   All other colors, or empty input, result in `isValid: false`, leading to the product being skipped during import/sync.

#### 6.4.4. `validateProductStatus(statusString)`
*   Normalizes input to lowercase.
*   A list of `allowedValues` (e.g., "available", "1", "on stock", "true") are all considered valid and result in `normalizedStatus: 'available'` and `isValid: true`.
*   Any other status string results in `isValid: false`, and the product is skipped. If no status is provided, it defaults to `'available'` and `isValid: true`.

### 6.5. Future Enhancements and Considerations
*   **More Granular Error Reporting:** Provide detailed feedback on why specific products were skipped during upload/sync.
*   **Configurable Validation Rules:** Allow administrators to define or modify validation rules (e.g., allowed color ranges, mandatory fields per supplier) perhaps via `CompanyApiConfig`.
*   **Dry Run Mode:** Implement a "dry run" option for uploads/syncs to preview changes and validation issues without committing to the database.
*   **Handling of Fancy Colors:** The current `validateDiamondColor` strictly filters for D-G. If fancy colored diamonds need to be supported, this logic (and potentially `determineStoneType`) would require significant updates.
*   **Unit Price vs. Total Price:** Ensure consistent handling and calculation if one is missing. The current logic primarily calculates total price from unit price, and API sync has a separate calculation for price per carat.

This detailed breakdown should clarify how product data is handled and help in refining these rules further.

##### 6.2.2. Field Validation Rules:

*   **`status` (Статус продукта):**
    *   При импорте проверяется функцией `validateProductStatus`.
    *   Значения типа "available", "1", "on stock", "in stock", "yes", "true" (без учета регистра) нормализуются в `available`.
    *   Любые другие значения считаются невалидными, и продукт с таким статусом пропускается (учитывается в `stats.skippedInvalidStatus`).
*   **`color` (Цвет бриллианта):**
    *   Проверяется функцией `validateDiamondColor`.
    *   Допустимы только стандартные "белые" цвета: `D`, `E`, `F`, `G` (без учета регистра).
    *   Продукты с другими цветами пропускаются (учитывается в `stats.skippedInvalidColor`).
    *   На основе цвета также определяется `stoneType` (`diamond` или `fancy diamond`).
*   **`clarity` (Чистота):**
    *   **Обязательное поле.**
    *   Допустимые значения (без учета регистра, после нормализации): `VS2`, `VS1`, `VVS2`, `VVS1`, `EX`, `IF`.
    *   Продукты с другими значениями или без значения чистоты пропускаются (учитывается в `stats.skippedInvalidClarity`).
*   **`price` (Цена):**
    *   **Обязательное поле.**
    *   Должна быть числом в диапазоне от `0` до `150000` включительно.
    *   Цена рассчитывается или используется напрямую; если итоговая цена выходит за пределы диапазона, продукт пропускается (учитывается в `stats.skippedInvalidPrice`).
*   **`carat` (Вес в каратах):**
    *   **Обязательное поле.**
    *   Должен быть числом в диапазоне от `0.3` до `100` включительно.
    *   Продукты, у которых вес выходит за пределы этого диапазона, пропускаются (учитывается в `stats.skippedInvalidCarat`).
*   **`certificateNumber` и `certificateInstitute` (Номер и институт сертификата):**
    *   Ключевые поля для идентификации уникального камня.
    *   Номер сертификата приводится к строке и `trim`-мится.
*   **`photo`, `video` (Медиа-ссылки):**
    *   **Обязательно наличие хотя бы одной валидной ссылки.**
    *   Каждая ссылка (фото и видео) проверяется функцией `validateUrl` (должна начинаться с `http://` или `https://`).
    *   Если обе ссылки (`photo` и `video`) отсутствуют или невалидны после проверки, продукт пропускается (учитывается в `stats.skippedMissingMedia`).

This documentation should provide a solid understanding of the deal flow and management within the system.

## 6. Product Data Parsing and Processing Logic

This section details how product data is parsed, validated, and processed when imported into the system, either via file uploads (XLSX, CSV) or through API synchronization with supplier systems. The primary logic resides in `server/utils/productUtils.js`.

### 6.1. Overview of Processing Steps

1.  **Source Data Acquisition:**
    *   **File Uploads (`inventoryController.js`):**
        *   XLSX/CSV files are parsed. Headers are mapped to internal field names using `productUtils.findMatchingField` based on `COLUMN_MAPPINGS`.
        *   An `id` is generated (UUIDv4) if not present in the source row.
    *   **API Sync (`companyApiController.js`):**
        *   Data is fetched from the supplier's API.
        *   A `dataKey` from `CompanyApiConfig` is used to locate the array of products within the API response.
        *   Filters defined in `CompanyApiConfig` can be applied to the raw product list.
        *   The `productUtils.getFieldValue` helper is used to extract data based on common field name variations.
        *   An `id` is generated (UUIDv4) if not resolvable from common ID fields (e.g., `id`, `stone_id`, `stock_id`, `report_no`).

2.  **Pre-filtering and Checks (Common to both sources):**
    *   **Blacklisted Certificates:** Products with certificate numbers found in the `BlacklistedCertificate` collection are skipped.
    *   **Existing Products on Deal/Sold:** Products that already exist in the database *for the same company* and have a status of `OnDeal` or `Sold` are skipped during API sync. During file upload, this check also prevents re-importing such items.

3.  **Individual Product Processing (`productUtils.processProduct` and helpers):**
    *   Each product record undergoes detailed validation and transformation.
    *   If a product fails critical validation (like invalid status or color for white diamonds), it is skipped.

4.  **Database Update:**
    *   **File Uploads:**
        *   `replace` mode: Existing products for the company (not `OnDeal` or `Sold`) are deleted, and new valid products are inserted.
        *   `update` mode: Existing products (not `OnDeal` or `Sold`) are updated based on `id`, and new products are inserted (upsert).
    *   **API Sync:**
        *   Existing products for the company (not `OnDeal` or `Sold`) are deleted.
        *   New valid products from the API are inserted.

### 6.2. Field Mapping (`COLUMN_MAPPINGS`, `getFieldValue`)

*   The `productUtils.COLUMN_MAPPINGS` object defines a list of common header names (from files) or field names (from APIs) that map to the internal `Product` schema fields.
    *   Example: `price` can be mapped from "price", "total price", "cost", "NET_VALUE", etc.
*   `productUtils.findMatchingField(headerName)`: Used during file parsing to find the internal field name corresponding to a column header.
*   `productUtils.getFieldValue(product, primaryField, alternativeFields = [])`: Used during API sync to retrieve a value from a product object, checking the `primaryField` first, then a list of `alternativeFields`.

### 6.3. Key Field Processing, Validation, and Default Values

The `Product` schema is defined in `server/models/Product.js`. Many fields have `default` values in the schema. The processing logic in `productUtils.js` further refines or provides values.

| Field                 | Processing & Validation Logic (`productUtils.js`)                                                                                                                                                                                            | Default (Schema/Util)         | Notes                                                                                                        |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **`id`**              | - File: Generated as UUIDv4 if not in source. <br/> - API: Extracted via `getFieldValue` (from `id`, `stone_id`, etc.) or generated as UUIDv4 if not found.                                                                                    | N/A (Generated if missing)    | **Primary Key** for product identification within the system.                                                |
| `company`             | Assigned the `_id` of the company uploading/syncing the inventory.                                                                                                                                                                         | N/A (Assigned by controller)  | **Required**. Links product to a supplier.                                                                   |
| `shape`               | Normalized using `productUtils.normalizeShape` based on `SHAPE_MAPPING`. E.g., "RD", "ROUND", "Brilliant" all become "Round". If no match, original value is kept.                                                                               | `''` (empty string)           |                                                                                                              |
| `carat`               | Parsed as `parseFloat`.                                                                                                                                                                                                                      | `0`                           |                                                                                                              |
| **`color`**           | Validated by `productUtils.validateDiamondColor`. **Only 'D', 'E', 'F', 'G' are considered valid for import.** Other colors result in the product being skipped. Value is normalized to uppercase (e.g., 'd' -> 'D').                         | `''`                          | **Crucial Validation**: Non-compliant products are filtered out.                                               |
| `stoneType`           | Uses value from source if present. Otherwise, `productUtils.determineStoneType` sets it to 'fancy diamond' if color implies it (pink, blue, etc.), else 'diamond'.                                                                           | `'diamond'`                   |                                                                                                              |
| `overtone`            | Formatted using `productUtils.formatFieldValue` (trims string).                                                                                                                                                                                | `''`                          |                                                                                                              |
| `intensity`           | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `clarity`             | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `cut`                 | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `polish`              | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| **`price`**           | Parsed as `parseFloat`. If `price` is 0 or missing, but `pricePerCarat` and `carat` are present, `price` is calculated (`pricePerCarat * carat`). Rounded to 2 decimal places.                                                               | `0`                           |                                                                                                              |
| `pricePerCarat`       | Parsed as `parseFloat`. If `pricePerCarat` is 0 or missing, but `price` and `carat` are present, `pricePerCarat` is calculated (`price / carat`). Rounded to 2 decimal places. (This specific calculation is in `companyApiController`) | `0` (Schema)                  | `processProduct` ensures final price is calculated. `companyApiController` handles `pricePerCarat` calculation. |
| `symmetry`            | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `location`            | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `technology`          | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          |                                                                                                              |
| `photo`               | Validated by `productUtils.validateUrl` (checks for `http://` or `https://` prefix).                                                                                                                                                         | `''`                          | Invalid URLs become empty strings.                                                                           |
| `video`               | Validated by `productUtils.validateUrl`.                                                                                                                                                                                                     | `''`                          | Invalid URLs become empty strings.                                                                           |
| `sold`                | Converted to Boolean.                                                                                                                                                                                                                        | `false`                       |                                                                                                              |
| `onDeal`              | (Schema default)                                                                                                                                                                                                                             | `false`                       | Managed by deal logic, not directly during initial parsing.                                                  |
| `dealId`              | (Schema default)                                                                                                                                                                                                                             | `null`                        | Managed by deal logic.                                                                                       |
| **`status`**          | Validated by `productUtils.validateProductStatus`. Values like 'available', '1', 'on stock', 'true' are normalized to `'available'`. **If status is not recognized as available, the product is skipped.**                                  | `'available'`                 | **Crucial Validation**: Non-compliant products are filtered out.                                               |
| `measurement1`        | Parsed from `measurements` string or individual fields (`measurement1`, `length`, etc.) using `productUtils.parseMeasurements` and `getFieldValue`. `parseFloat`.                                                                         | `0`                           | See `parseMeasurements` details below.                                                                       |
| `measurement2`        | Parsed similarly to `measurement1`.                                                                                                                                                                                                          | `0`                           |                                                                                                              |
| `measurement3`        | Parsed similarly to `measurement1`.                                                                                                                                                                                                          | `0`                           |                                                                                                              |
| `tableSize`           | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `crownHeight`         | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `pavilionDepth`       | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `girdle`              | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `culet`               | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `totalDepth`          | `parseFloat`.                                                                                                                                                                                                                                | `0`                           |                                                                                                              |
| `fluorescence`        | Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `ha`                  | Formatted using `productUtils.formatFieldValue`.                                                                                                                                                                                             | `''`                          | (Hearts and Arrows)                                                                                          |
| `certificateInstitute`| Formatted using `productUtils.formatFieldValue` and converted to uppercase.                                                                                                                                                                  | `''`                          |                                                                                                              |
| `certificateNumber`   | Value is processed to remove non-digit characters (e.g., "GIA-123" becomes "123"). Then parsed as `parseInt`.                                                                                                                               | `0`                           | String in API sync, converted to number in `processProduct`.                                                 |
| `link`                | Automatically generated as `/product/[productId]` by `processProduct`. For API sync, it's also `https://in-diamonds.com/product/[productId]`.                                                                                              | (Generated)                   |                                                                                                              |
| `createdAt`           | (Schema default)                                                                                                                                                                                                                             | `Date.now`                    |                                                                                                              |
| `updatedAt`           | (Schema default, and updated by `formatProductData` during manual product updates)                                                                                                                                                         | `Date.now`                    |                                                                                                              |

**Mandatory Fields for Successful Processing:**
While the schema defines `id` and `company` as `required`, the processing logic ensures these are always present:
*   `company`: Provided by the system based on the uploader or API config.
*   `id`: Generated if not extractable from the source.
A product *will be skipped* if:
*   Its `status` is not considered 'available' (see `validateProductStatus`).
*   Its `color` is not 'D', 'E', 'F', or 'G' (see `validateDiamondColor`).
*   Its `certificateNumber` is found in the `BlacklistedCertificate` collection.
*   During API sync or file upload, if a product with the same `id` for the same `company` already exists and is marked `OnDeal` or `Sold`.

### 6.4. Specific Parsing Logic Details

#### 6.4.1. `parseMeasurements(measurementsString)`
This function attempts to parse a single string containing product dimensions (length, width, height) into `measurement1`, `measurement2`, and `measurement3`.
*   It tries to match common patterns:
    *   `7.26*7.30*4.60` (asterisk delimited)
    *   `7.26x7.30x4.60` (x delimited)
    *   `7.26-7.30-4.60` (hyphen delimited)
    *   `7.26 7.30 4.60` (space delimited)
    *   `7.26,7.30,4.60` (comma delimited)
    *   `7.26/7.30/4.60` (slash delimited)
*   If these patterns don't match, it attempts to find all numbers in the string. If 3 or more numbers are found, it uses the first three. If 2 are found, it uses them for `measurement1` and `measurement2`. If 1 is found, it's used for `measurement1`.
*   Individual fields like `measurement1`, `length`, `width`, `height` (if present in source data) can override values parsed from a combined `measurements` string.

#### 6.4.2. `normalizeShape(shapeString)`
*   Converts input to uppercase and trims whitespace.
*   Compares against `SHAPE_MAPPING`:
    *   First checks for direct matches with standard shape names (e.g., "ROUND").
    *   Then checks against an array of common variations for each standard shape (e.g., "RD", "RBC" for "Round").
*   If a match is found, the standard shape name is returned. Otherwise, the original input string is returned.

#### 6.4.3. `validateDiamondColor(colorString)`
*   Normalizes input to uppercase.
*   **Crucially, it only returns `isValid: true` if the normalized color is 'D', 'E', 'F', or 'G'.**
*   All other colors, or empty input, result in `isValid: false`, leading to the product being skipped during import/sync.

#### 6.4.4. `validateProductStatus(statusString)`
*   Normalizes input to lowercase.
*   A list of `allowedValues` (e.g., "available", "1", "on stock", "true") are all considered valid and result in `normalizedStatus: 'available'` and `isValid: true`.
*   Any other status string results in `isValid: false`, and the product is skipped. If no status is provided, it defaults to `'available'` and `isValid: true`.

### 6.5. Future Enhancements and Considerations
*   **More Granular Error Reporting:** Provide detailed feedback on why specific products were skipped during upload/sync.
*   **Configurable Validation Rules:** Allow administrators to define or modify validation rules (e.g., allowed color ranges, mandatory fields per supplier) perhaps via `CompanyApiConfig`.
*   **Dry Run Mode:** Implement a "dry run" option for uploads/syncs to preview changes and validation issues without committing to the database.
*   **Handling of Fancy Colors:** The current `validateDiamondColor` strictly filters for D-G. If fancy colored diamonds need to be supported, this logic (and potentially `determineStoneType`) would require significant updates.
*   **Unit Price vs. Total Price:** Ensure consistent handling and calculation if one is missing. The current logic primarily calculates total price from unit price, and API sync has a separate calculation for price per carat.

This detailed breakdown should clarify how product data is handled and help in refining these rules further.

##### 6.2.2. Field Validation Rules:

*   **`status` (Статус продукта):**
    *   При импорте проверяется функцией `validateProductStatus`.
    *   Значения типа "available", "1", "on stock", "in stock", "yes", "true" (без учета регистра) нормализуются в `available`.
    *   Любые другие значения считаются невалидными, и продукт с таким статусом пропускается (учитывается в `stats.skippedInvalidStatus`).
*   **`color` (Цвет бриллианта):**
    *   Проверяется функцией `validateDiamondColor`.
    *   Допустимы только стандартные "белые" цвета: `D`, `E`, `F`, `G` (без учета регистра).
    *   Продукты с другими цветами пропускаются (учитывается в `stats.skippedInvalidColor`).
    *   На основе цвета также определяется `stoneType` (`diamond` или `fancy diamond`).
*   **`clarity` (Чистота):**
    *   **Обязательное поле.**
    *   Допустимые значения (без учета регистра, после нормализации): `VS2`, `VS1`, `VVS2`, `VVS1`, `EX`, `IF`.
    *   Продукты с другими значениями или без значения чистоты пропускаются (учитывается в `stats.skippedInvalidClarity`).
*   **`price` (Цена):**
    *   **Обязательное поле.**
    *   Должна быть числом в диапазоне от `0` до `150000` включительно.
    *   Цена рассчитывается или используется напрямую; если итоговая цена выходит за пределы диапазона, продукт пропускается (учитывается в `stats.skippedInvalidPrice`).
*   **`carat` (Вес в каратах):**
    *   **Обязательное поле.**
    *   Должен быть числом в диапазоне от `0.3` до `100` включительно.
    *   Продукты, у которых вес выходит за пределы этого диапазона, пропускаются (учитывается в `stats.skippedInvalidCarat`).
*   **`certificateNumber` и `certificateInstitute` (Номер и институт сертификата):**
    *   Ключевые поля для идентификации уникального камня.
    *   Номер сертификата приводится к строке и `trim`-мится.
*   **`photo`, `video` (Медиа-ссылки):**
    *   **Обязательно наличие хотя бы одной валидной ссылки.**
    *   Каждая ссылка (фото и видео) проверяется функцией `validateUrl` (должна начинаться с `http://` или `https://`).
    *   Если обе ссылки (`photo` и `video`) отсутствуют или невалидны после проверки, продукт пропускается (учитывается в `stats.skippedMissingMedia`).

This documentation should provide a solid understanding of the deal flow and management within the system. 