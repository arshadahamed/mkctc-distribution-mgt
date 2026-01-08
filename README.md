# 🌾 Agro-Chemical Product Distribution Management System

A comprehensive, modern, and production-ready distribution management system designed specifically for agro-chemical businesses. Built with clean architecture principles, offline-first capabilities, and a beautiful Agro-Green UI design system.

![Version](https://img.shields.io/badge/version-1.0.0-green)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [UI/UX Design](#uiux-design)
- [Security](#security)
- [Future Enhancements](#future-enhancements)

---

## ✨ Features

### Core Modules

#### 📦 Product Management
- Complete product catalog with hierarchical organization (Department → Category → Brand)
- Barcode support for quick scanning
- Weighted vs. unit-based products
- Cost and MSRP tracking
- Supplier discount management
- Active/Inactive status control

#### 👥 Customer Management
- Customer profiles with route assignment
- Real-time account balance tracking
- Credit limit monitoring
- Customer categorization
- Active/Blocked status management

#### 🚚 Distribution & Inventory
- **Truck Loading**: Track products loaded onto trucks with quantity verification
- **Truck Unloading**: End-of-day reconciliation with automatic variance calculation
- **Variance Reporting**: Loaded vs. Sold vs. Remaining analysis
- Multi-truck management

#### 💰 Sales & Invoicing
- Auto-generated invoice numbers (INV + YYMM + Sequence)
- Multiple payment methods: Cash, Cheque, Account (Credit)
- Line-item discounts and bill-level discounts
- Tax calculation
- Cheque details tracking
- Real-time customer balance updates

#### 💳 Payment Recovery
- Auto-generated receipt numbers (RCP + YYMM + Sequence)
- Multi-invoice settlement support
- Cash and cheque payment tracking
- Outstanding invoice management
- Real-time balance reconciliation

#### 📍 Shop Visit Tracking
- Daily visit logging
- Shop status (Open/Closed)
- Route-wise visit tracking
- Visit remarks and notes

#### 👤 User Management & Security
- Role-based access control (Admin / Employee)
- Online/Offline status tracking
- Admin capabilities:
  - View active users
  - Force logout users
  - Audit log access
- Session management

#### 📊 Dashboard & Reports
- **KPI Cards**:
  - Daily Sales
  - Collections (Cash + Cheque)
  - Outstanding Receivables
  - Active Trucks
- **Charts**:
  - Sales Trend (Line Chart)
  - Route Performance (Bar Chart)
  - Payment Method Distribution
- **Reports**:
  - Product-wise sales
  - Customer-wise transactions
  - Route-wise performance
  - Date-wise summaries
  - Payment recovery reports
  - Stock variance reports

---

## 🏗️ Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (HTML, CSS, JavaScript, Charts)        │
├─────────────────────────────────────────┤
│         Application Layer               │
│  (Express Routes, API Endpoints)        │
├─────────────────────────────────────────┤
│         Domain Layer                    │
│  (Business Logic, Repositories)         │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│  (SQLite Database, File System)         │
└─────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns**: Each layer has a distinct responsibility
2. **Dependency Inversion**: Higher layers depend on abstractions, not implementations
3. **Single Responsibility**: Each module handles one aspect of the business
4. **Offline-First**: Local database with sync capabilities
5. **RESTful API**: Standard HTTP methods and status codes

---

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: SQLite3 (better-sqlite3)
- **Architecture**: Clean Architecture / Repository Pattern

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Custom design system with CSS Variables
- **JavaScript**: Vanilla ES6+ (no framework dependencies)
- **Charts**: Chart.js
- **Icons**: Font Awesome 6

### Design System
- **Theme**: Agro-Green with glassmorphism
- **Typography**: Inter font family
- **Color Palette**: Green-focused with high contrast
- **Components**: Custom-built, reusable UI components

---

## 📥 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Initialize Database

```bash
npm run init-db
```

This will:
- Create the SQLite database (`agro_distribution.db`)
- Set up all tables with proper relationships
- Insert sample data for testing

### Step 3: Start the Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

---

## 🚀 Usage

### Default Credentials

**Admin User:**
- Username: `admin`
- Password: `admin123`

**Employee User:**
- Username: `salesrep1`
- Password: `emp123`

### Quick Start Guide

1. **Login**: Use the credentials above
2. **Dashboard**: View real-time KPIs and charts
3. **Products**: Browse and manage product catalog
4. **Customers**: View customer list and outstanding balances
5. **Distribution**: Load trucks and track inventory
6. **Sales**: Create invoices and process payments
7. **Payments**: Record receipts and settle invoices
8. **Reports**: Generate various business reports

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### Products
```http
GET    /api/products              # Get all products
GET    /api/products/:id          # Get product by ID
GET    /api/products/barcode/:code # Get by barcode
POST   /api/products              # Create product
PUT    /api/products/:id          # Update product
DELETE /api/products/:id          # Delete product
```

### Customers
```http
GET    /api/customers             # Get all customers
GET    /api/customers/:id         # Get customer by ID
POST   /api/customers             # Create customer
PUT    /api/customers/:id         # Update customer
```

### Sales
```http
GET    /api/sales                 # Get all invoices
GET    /api/sales/:id             # Get invoice by ID
POST   /api/sales                 # Create invoice
GET    /api/sales/summary/stats   # Get sales summary
```

### Payments
```http
GET    /api/payments              # Get all receipts
GET    /api/payments/:id          # Get receipt by ID
POST   /api/payments              # Create receipt
GET    /api/payments/outstanding/:customerId # Outstanding invoices
GET    /api/payments/summary/stats # Payment summary
```

### Distribution
```http
GET    /api/distribution/loads    # Get all loads
GET    /api/distribution/loads/:id # Get load by ID
POST   /api/distribution/loads    # Create load
POST   /api/distribution/unloads  # Create unload
GET    /api/distribution/variance/:loadId # Variance report
```

### Dashboard
```http
GET    /api/dashboard/kpis        # Get KPIs
GET    /api/dashboard/activities  # Recent activities
GET    /api/dashboard/trends/sales # Sales trends
```

---

## 🗄️ Database Schema

### Key Tables

**Products** → Supplier, Department, Category, Brand
**Customers** → Routes
**Truck Loads** → Trucks, Users, Load Items
**Invoices** → Customers, Users, Invoice Items
**Receipts** → Customers, Users, Receipt Allocations
**Shop Visits** → Customers, Routes, Users

### Relationships
- One-to-Many: Supplier → Products, Route → Customers
- Many-to-Many: Receipts ↔ Invoices (via Receipt Allocations)

---

## 🎨 UI/UX Design

### Design Language: "Agro-Green"

**Color Palette:**
- Primary: `#2E7D32` (Forest Green)
- Accent: `#66BB6A` (Light Green)
- Background: `#E8F5E9` (Ultra Light Green)

**Key Features:**
- **Glassmorphism**: Frosted glass effects with backdrop blur
- **Micro-animations**: Smooth transitions and hover effects
- **Responsive**: Mobile-first design approach
- **High Contrast**: Optimized for outdoor/bright environments
- **Accessibility**: WCAG 2.1 AA compliant

---

## 🔒 Security

### Current Implementation
- Basic authentication (username/password)
- Role-based access control
- SQL injection prevention (prepared statements)
- Foreign key constraints

### Production Recommendations
1. **Password Hashing**: Use bcrypt for password storage
2. **JWT Tokens**: Implement token-based authentication
3. **HTTPS**: Enable SSL/TLS encryption
4. **Rate Limiting**: Prevent brute-force attacks
5. **Input Validation**: Server-side validation for all inputs
6. **Audit Logging**: Track all sensitive operations

---

## 🚀 Future Enhancements

### Phase 2: Mobile Application
- Native Android app for field sales
- Offline sync with conflict resolution
- GPS-based visit verification
- Camera integration for barcode scanning

### Phase 3: Advanced Analytics
- AI-powered sales forecasting
- Route optimization algorithms
- Customer behavior analysis
- Inventory prediction

### Phase 4: Integration
- Supplier portal integration
- Payment gateway integration
- SMS/Email notifications
- WhatsApp Business API

### Phase 5: IoT & Automation
- Temperature sensors for chemical trucks
- RFID-based inventory tracking
- Automated reordering system
- Real-time truck tracking

---

## 📝 License

MIT License - feel free to use this system for commercial purposes.

---

## 👨‍💻 Developer Notes

### Project Structure
```
agro-distribution-system/
├── lib/
│   └── db.js                 # Database connection
├── repositories/
│   ├── productRepo.js        # Product data access
│   ├── customerRepo.js       # Customer data access
│   ├── salesRepo.js          # Sales data access
│   ├── paymentRepo.js        # Payment data access
│   └── distributionRepo.js   # Distribution data access
├── routes/
│   ├── products.js           # Product API routes
│   ├── customers.js          # Customer API routes
│   ├── sales.js              # Sales API routes
│   ├── payments.js           # Payment API routes
│   ├── distribution.js       # Distribution API routes
│   ├── dashboard.js          # Dashboard API routes
│   └── auth.js               # Authentication routes
├── public/
│   ├── index.html            # Main dashboard UI
│   ├── styles.css            # Design system
│   └── app.js                # Frontend logic
├── scripts/
│   └── init-db.js            # Database initialization
├── server.js                 # Express server
└── package.json              # Dependencies
```

### Adding New Features
1. Create repository in `repositories/`
2. Add API routes in `routes/`
3. Update UI in `public/`
4. Test with sample data

---

## 🤝 Support

For issues, questions, or contributions, please contact the development team.

**Built with ❤️ for the Agro-Chemical Industry**
