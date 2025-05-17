# LGDEAL LLC Management Company Setup

## Overview

LGDEAL LLC serves as the management company for the lab-grown diamond marketplace. This document explains how the system is configured to route all transactions through LGDEAL LLC and the special privileges granted to LGDEAL LLC supervisors.

## Key Features

### LGDEAL LLC as Management Company

- All transactions in the marketplace flow through LGDEAL LLC
- LGDEAL LLC does not maintain its own diamond inventory
- Each purchase transaction creates two linked transactions:
  1. Buyer-to-LGDEAL transaction
  2. LGDEAL-to-Seller transaction
- LGDEAL LLC earns a commission on each transaction

### Administrative Privileges

- Supervisors at LGDEAL LLC automatically receive admin privileges
- These users can:
  - View and manage all transactions
  - Update transaction statuses
  - Access admin-only features
  - Oversee the entire marketplace

## Technical Implementation

### Configuration

The marketplace configuration is stored in `server/config/marketplace.js`:

```javascript
const config = {
  // LGDEAL LLC is the management company for all transactions
  managementCompany: {
    name: 'LGDEAL LLC',
    // Management company's commission percentage (as decimal)
    transactionFee: 0.05, // 5% fee on each transaction
    // Minimum fee per transaction in USD
    minimumFee: 25
  },
  
  // Additional configuration options...
};
```

### Middleware

The following middleware components manage LGDEAL LLC's special status:

1. **LGDEAL Admin Middleware** (`server/middleware/lgdealAdminMiddleware.js`):
   - Identifies supervisors from LGDEAL LLC
   - Grants them admin privileges automatically

2. **Auth Middleware** (`server/middleware/auth.js`):
   - Includes LGDEAL Admin Middleware in authentication flow
   - Sets `isLgdealSupervisor` property for authorized users

3. **Admin Auth Middleware** (`server/middleware/adminAuth.js`):
   - Allows both regular admins and LGDEAL LLC supervisors to access admin routes

### Transaction Model

Transactions are modeled in `server/models/Transaction.js` with:

- Support for paired transactions (buyer-to-LGDEAL and LGDEAL-to-seller)
- Transaction status tracking
- Fee calculation and management
- Payment and shipping details

### Transaction Service

The `transactionService` in `server/services/transactionService.js` handles:

1. **Creating Purchase Transactions**:
   - Creates both buyer-to-LGDEAL and LGDEAL-to-seller transactions
   - Calculates fees based on marketplace configuration
   - Links the paired transactions with cross-references

2. **Processing Transactions**:
   - Updates transaction statuses
   - Handles payment and shipping information
   - Manages paired transaction synchronization

3. **Querying Transactions**:
   - Retrieves transaction details
   - Filters and sorts transactions
   - Handles pagination

## API Endpoints

### Transaction Endpoints

- `POST /api/transactions` - Create a new purchase transaction
- `GET /api/transactions` - Get current user's transactions
- `GET /api/transactions/:id` - Get transaction details
- `PUT /api/transactions/:id/status` - Update transaction status (admin/LGDEAL only)

### LGDEAL Admin Endpoints

- `GET /api/admin/transactions` - Get all LGDEAL LLC transactions (admin/LGDEAL only)
- `GET /api/marketplace/lgdeal` - Get LGDEAL LLC company information

## Usage Guide

### Making a Purchase

When a buyer purchases a diamond:

1. The system creates a buyer-to-LGDEAL transaction with:
   - Original price + LGDEAL fee
   - Status set to "pending"
   
2. The system simultaneously creates a LGDEAL-to-seller transaction with:
   - Original price only (fee is kept by LGDEAL)
   - Status set to "pending"
   
3. LGDEAL supervisors can process the transactions through the admin interface

### Managing Transactions

LGDEAL supervisors and administrators can:

1. View all transactions in the system
2. Update transaction statuses (pending, processing, completed, failed, cancelled)
3. Add payment and shipping details
4. Track fees and manage the marketplace flow

## Future Enhancements

Planned enhancements for the LGDEAL transaction system:

1. **Escrow Services**: Add option for holding funds in escrow for high-value transactions
2. **Payment Integration**: Direct integration with payment processors
3. **Automated Dispute Resolution**: Tools for handling transaction disputes
4. **Reporting Dashboard**: Advanced analytics for LGDEAL LLC administrators

## Troubleshooting

Common issues and solutions:

1. **Missing Admin Privileges**: Ensure the user is a supervisor at LGDEAL LLC company
2. **Transaction Creation Failure**: Check that the product exists and is available
3. **Fee Calculation Issues**: Verify the marketplace configuration settings 