# AgroDistribution™ Enterprise Resource Planning (ERP)
## User Manual & Technical Documentation
**Version 1.0.0 | Date: January 9, 2026**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [User Manual: Functional Workflows](#2-user-manual-functional-workflows)
   - [2.1 Authentication & Security](#21-authentication--security)
   - [2.2 Inventory & Product Management](#22-inventory--product-management)
   - [2.3 Customer & Route Management](#23-customer--route-management)
   - [2.4 Sales & POS Workflow](#24-sales--pos-workflow)
   - [2.5 Distribution & Truck Optimization](#25-distribution--truck-optimization)
   - [2.6 Financial Operations](#26-financial-operations)
3. [Admin Features](#3-admin-features)
   - [3.1 User Management](#31-user-management)
   - [3.2 System Audit & Error Logs](#32-system-audit--error-logs)
   - [3.3 Backup & Recovery](#33-backup--recovery)
4. [Technical Documentation](#4-technical-documentation)
   - [4.1 System Architecture](#41-system-architecture)
   - [4.2 Database Design (Schema)](#42-database-design-schema)
   - [4.3 API Reference](#43-api-reference)
   - [4.4 Security Implementation](#44-security-implementation)
5. [Deployment & Maintenance](#5-deployment--maintenance)
6. [Troubleshooting & Support](#6-troubleshooting--support)

---

## 1. Introduction
The **AgroDistribution™ ERP** is a comprehensive, full-stack management solution designed for agro-chemical distribution centers. It streamlines complex operations including high-velocity inventory tracking, field-based distribution via truck loads, real-time invoicing, and multi-tier financial reconciliation.

Built with a "Local-First, Cloud-Ready" philosophy, the system utilizes a high-performance Node.js backend with an optimized SQLite (WAL-enabled) data engine and a premium Vanilla JavaScript frontend design system ("Agro-Green").

---

## 2. User Manual: Functional Workflows

### 2.1 Authentication & Security
- **Secure Login**: Access the system via the credentials provided by the administrator. The login portal uses industry-standard hashing (Bcrypt) to protect passwords.
- **Session Management**: Each session is protected by JWT (JSON Web Tokens) or Secure Cookie-based sessions.
- **Auto-Logout**: For security, inactive sessions are automatically terminated based on role-specific timeout thresholds.

### 2.2 Inventory & Product Management
The system tracks products across multiple dimensions (Department, Category, Brand, Size).
- **Product Registry**: Add new products with chemical names, SKU codes, barcodes, and pricing (Cost vs. MSRP).
- **Smart Sizing**: Manage products in various liquid and solid units (Litres, Kilograms, Packets) including "Units per Carton" for wholesale tracking.
- **Stock Tracking**: Real-time monitoring of available warehouse stock.

### 2.3 Customer & Route Management
- **Route Optimization**: Group customers into geographical "Routes" (e.g., North District, South Route) for efficient distribution delivery.
- **Customer Profiles**: Store detailed contact info, categorical tags (Retailer, Distributor), and real-time credit balances.
- **Shop Visit Logs**: Field staff can log shop visits, status (Open/Closed), and general feedback via the "Shop Visits" module.

### 2.4 Sales & POS Workflow
- **POS Interface**: A streamlined interface to select customers, add products via search or barcode, and apply tiered discounts.
- **Payment Methods**:
  - **Cash**: Immediate settlement.
  - **Cheque**: Detailed tracking of cheque numbers, banks, and clearance dates.
  - **Account (Credit)**: Automatically updates the customer's ledger balance.
  - **Split Payment**: Allows multi-method settlement (e.g., partial cash, partial cheque).
- **Invoice Printing**: Professional A4 and POS-format thermal receipt printing options.

### 2.5 Distribution & Truck Optimization
This is a core module for mobile sales teams.
- **Creating Truck Loads**: Select items from the warehouse and "load" them into a specific vehicle. This creates a "Virtual Inventory" assigned to that truck.
- **Field Sales**: While in the field, invoices are deducted from the specific truck load inventory rather than the main warehouse.
- **Truck Unloading & Reconciliation**:
  - At the end of the day, input the "Returned" quantities.
  - The system automatically calculates **Sold** vs. **Remaining**.
  - **Variance Analysis**: Identifies discrepancies (e.g., missing stock) and requires justification.

### 2.6 Financial Operations
- **Payment Collection**: Record receipts against outstanding invoices. Smart allocation logic ensures the "Oldest First" (FIFO) settlement or manual allocation.
- **Expense Tracking**: Categorized logging of operational costs (Fuel, Food, Maintenance, Salaries).
- **Debtor Management**: Real-time "Master Ageing List" to track long-overdue receivables.

---

## 3. Admin Features

### 3.1 User Management
Administrators can:
- Create and manage Users (Roles: Admin, Employee).
- Block/Unblock accounts and monitor "Last Login" activity.
- Assign granular permissions for modules.

### 3.2 System Audit & Error Logs
A newly redesigned "Intelligence Center" allows monitoring:
- **Audit Trail**: Tracking every Create, Update, and Delete action with user timestamps.
- **Error Tracking**: Visibility into system-level exceptions.
- **Action Categories**: Filtering logs by protocol action (LOGIN, DELETE, UPDATE, etc.).

### 3.3 Backup & Recovery
- **Automatic Backups**: Scheduled midnight backups to prevent data loss.
- **Manual Control**: Administrators can trigger manual backups or restore the system from a specific historical point.

---

## 4. Technical Documentation

### 4.1 System Architecture
The system follows a **Service-Repository Architecture**:
- **Presentation Layer**: HTML5, Vanilla CSS (Agro-Green Design System), Chart.js for data visualization.
- **Application Layer**: Node.js & Express.js server providing RESTful APIs.
- **Logic Layer (Repositories)**: Encapsulated business logic away from the API routes for better testability.
- **Database Layer**: SQLite with WAL (Write-Ahead Logging) mode enabled for high-concurrency performance.

### 4.2 Database Design (Schema)
Key Tables:
- `products`: Primary inventory record (linked to brands, categories).
- `customers`: Ledger-linked profiles.
- `invoices` & `invoice_items`: Sales data.
- `receipts` & `receipt_allocations`: Financial recovery data.
- `truck_loads` & `load_items`: Distribution management.
- `audit_logs`: System protocol tracking.

### 4.3 API Reference
**Endpoints Table (Partial List):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login`| Authenticates user and initiates session. |
| GET | `/api/products` | Retrieves paginated product list with search. |
| POST | `/api/sales/invoice` | Generates a new invoice and updates ledgers. |
| GET | `/api/dashboard/kpis` | Aggregates daily, monthly, and YTD performance. |
| DELETE | `/api/dashboard/logs`| Purges audit trails (Admin only). |

### 4.4 Security Implementation
1. **Password Hashing**: Bcrypt with salt rounds.
2. **Authorization**: Middleware-level checks (`isAdmin`, `isAuthenticated`).
3. **Data Integrity**: Foreign key constraints and transaction isolation (Transaction Batching).
4. **Input Sanitization**: Prepared SQL statements to prevent SQL Injection.

---

## 5. Deployment & Maintenance

### Installation
1.  **Environment**: Ensure Node.js (v16+) is installed.
2.  **Dependencies**: Run `npm install`.
3.  **Database Init**: Run `npm run init-db` to create the schema and admin account.
4.  **Start System**: Execute `npm start`.

### Maintenance Tasks
- **Log Rotation**: Periodically clear logs using the Admin Panel.
- **Database Integrity**: Periodically run `VACUUM` on the SQLite database (handled by maintenance script).
- **Backup Offshoring**: It is recommended to copy the `backups/` directory to encrypted cloud storage weekly.

---

## 6. Troubleshooting & Support

- **Server Won't Start**: Check if port 3000 is occupied (`EADDRINUSE`).
- **Data Not Saving**: Ensure the `agro_distribution.db` file is not marked as "Read Only" and the process has write permissions.
- **Login Issues**: Verify that cookies are enabled in the browser; the system requires them for secure session handling.

---
**Technical Writer Note:** *This document is generated by the AI Senior Technical Architect for MKC Trade Center. For further technical support, consult the internal ARCHITECTURE.md and PROJECT_SUMMARY.md files.*
