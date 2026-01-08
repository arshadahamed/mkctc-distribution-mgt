# 🏗️ System Architecture - Agro Distribution System

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Browser    │  │  Mobile App  │  │   Tablet     │          │
│  │  (Desktop)   │  │  (Future)    │  │   (Future)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   HTTP/HTTPS    │
                   └────────┬────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                    PRESENTATION LAYER                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Static Files (HTML, CSS, JavaScript)                   │    │
│  │  • index.html - Dashboard UI                            │    │
│  │  • styles.css - Agro-Green Design System                │    │
│  │  • app.js - Client-side Logic & Chart Rendering         │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                    APPLICATION LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Express.js Server (server.js)                          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  API Routes                                       │   │    │
│  │  │  • /api/auth         - Authentication            │   │    │
│  │  │  • /api/products     - Product Management        │   │    │
│  │  │  • /api/customers    - Customer Management       │   │    │
│  │  │  • /api/distribution - Truck Loading/Unloading   │   │    │
│  │  │  • /api/sales        - Invoice Management        │   │    │
│  │  │  • /api/payments     - Receipt Management        │   │    │
│  │  │  • /api/dashboard    - KPIs & Analytics          │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                      DOMAIN LAYER                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Business Logic & Data Access (Repositories)            │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  • productRepo.js     - Product CRUD             │   │    │
│  │  │  • customerRepo.js    - Customer CRUD            │   │    │
│  │  │  • distributionRepo.js - Load/Unload Logic       │   │    │
│  │  │  • salesRepo.js       - Invoice Generation       │   │    │
│  │  │  • paymentRepo.js     - Receipt & Allocation     │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  │                                                          │    │
│  │  Business Rules:                                         │    │
│  │  • Auto-generate invoice/receipt numbers                │    │
│  │  • Calculate variance (Load - Sold - Returned)          │    │
│  │  • Update customer balances in real-time                │    │
│  │  • Multi-invoice settlement logic                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Database Connection (lib/db.js)                        │    │
│  │  • Singleton Pattern                                    │    │
│  │  • Connection Pooling                                   │    │
│  │  • WAL Mode for Performance                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                      │
│  ┌─────────────────────────▼─────────────────────────────┐      │
│  │  SQLite Database (agro_distribution.db)               │      │
│  │  ┌────────────────────────────────────────────────┐   │      │
│  │  │  Tables:                                        │   │      │
│  │  │  • products, suppliers, departments             │   │      │
│  │  │  • customers, routes                            │   │      │
│  │  │  • trucks, truck_loads, load_items              │   │      │
│  │  │  • truck_unloads, unload_items                  │   │      │
│  │  │  • invoices, invoice_items                      │   │      │
│  │  │  • receipts, receipt_allocations                │   │      │
│  │  │  • shop_visits, users, audit_logs               │   │      │
│  │  └────────────────────────────────────────────────┘   │      │
│  └───────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Sales Invoice Creation Flow

```
┌─────────┐      ┌──────────┐      ┌────────────┐      ┌──────────┐
│ Sales   │      │  API     │      │ Sales      │      │ Database │
│ Person  │      │  Route   │      │ Repository │      │          │
└────┬────┘      └────┬─────┘      └─────┬──────┘      └────┬─────┘
     │                │                   │                   │
     │ Create Invoice │                   │                   │
     ├───────────────>│                   │                   │
     │                │ Validate Data     │                   │
     │                ├──────────────────>│                   │
     │                │                   │ Generate Invoice# │
     │                │                   ├──────────────────>│
     │                │                   │                   │
     │                │                   │ Insert Invoice    │
     │                │                   ├──────────────────>│
     │                │                   │                   │
     │                │                   │ Insert Items      │
     │                │                   ├──────────────────>│
     │                │                   │                   │
     │                │                   │ Update Balance    │
     │                │                   │ (if credit)       │
     │                │                   ├──────────────────>│
     │                │                   │                   │
     │                │ Return Invoice    │                   │
     │                │<──────────────────┤                   │
     │ Invoice Created│                   │                   │
     │<───────────────┤                   │                   │
```

### 2. Truck Distribution Workflow

```
Morning:                    Field:                   Evening:
┌──────────┐              ┌──────────┐             ┌──────────┐
│ Load     │              │ Sales    │             │ Unload   │
│ Truck    │              │ Activity │             │ & Verify │
└────┬─────┘              └────┬─────┘             └────┬─────┘
     │                          │                        │
     │ 1. Create Load           │                        │
     │    Record                │                        │
     │                          │                        │
     │ 2. Add Products          │                        │
     │    with Quantities       │                        │
     │                          │                        │
     │ 3. Assign to Truck       │ 4. Create Invoices    │
     │    & Driver              │    from Truck Stock   │
     │                          │                        │
     │                          │ 5. Deduct from        │
     │                          │    Virtual Inventory  │
     │                          │                        │
     │                          │                        │ 6. Count Remaining
     │                          │                        │    Stock
     │                          │                        │
     │                          │                        │ 7. Calculate Variance
     │                          │                        │    (Loaded - Sold - Returned)
     │                          │                        │
     │                          │                        │ 8. Generate Report
```

### 3. Payment Recovery Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Customer │      │ Sales    │      │ Payment  │      │ Customer │
│ Payment  │      │ Rep      │      │ Repo     │      │ Balance  │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                  │                  │
     │ Make Payment    │                  │                  │
     ├────────────────>│                  │                  │
     │                 │ Create Receipt   │                  │
     │                 ├─────────────────>│                  │
     │                 │                  │ Generate Receipt#│
     │                 │                  │                  │
     │                 │                  │ Get Outstanding  │
     │                 │                  │ Invoices         │
     │                 │                  │                  │
     │                 │ Select Invoices  │                  │
     │                 │ to Settle        │                  │
     │                 ├─────────────────>│                  │
     │                 │                  │ Allocate Amount  │
     │                 │                  │ to Invoices      │
     │                 │                  │                  │
     │                 │                  │ Update Balance   │
     │                 │                  ├─────────────────>│
     │                 │                  │ Balance -= Amount│
     │                 │ Receipt Created  │                  │
     │                 │<─────────────────┤                  │
     │ Receipt Copy    │                  │                  │
     │<────────────────┤                  │                  │
```

---

## Entity Relationship Diagram (Detailed)

```
┌─────────────┐
│  suppliers  │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────▼──────┐       ┌──────────────┐
│  products   │───────│ departments  │
└──────┬──────┘  N:1  └──────────────┘
       │
       ├───────────────┌──────────────┐
       │          N:1  │ categories   │
       │               └──────────────┘
       │
       ├───────────────┌──────────────┐
       │          N:1  │   brands     │
       │               └──────────────┘
       │
       │
┌──────▼──────────┐
│  load_items     │
│  (Truck Load)   │
└──────┬──────────┘
       │ N
       │
       │ 1
┌──────▼──────────┐       ┌──────────┐
│  truck_loads    │───────│  trucks  │
└──────┬──────────┘  N:1  └──────────┘
       │
       │ 1
       │
       │ N
┌──────▼──────────┐
│ unload_items    │
│ (Truck Unload)  │
└─────────────────┘


┌──────────┐
│  routes  │
└────┬─────┘
     │ 1
     │
     │ N
┌────▼──────┐       ┌──────────────┐
│ customers │───────│ shop_visits  │
└────┬──────┘  1:N  └──────────────┘
     │
     │ 1
     │
     │ N
┌────▼──────┐       ┌──────────────────┐
│ invoices  │───────│ invoice_items    │
└────┬──────┘  1:N  └──────────────────┘
     │
     │ N
     │
     │ M
┌────▼──────────┐   ┌──────────────────┐
│   receipts    │───│receipt_allocations│
└───────────────┘ M:N└──────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Authentication Layer                                 │
│     • Username/Password validation                       │
│     • Session management                                 │
│     • Login/Logout tracking                              │
│                                                          │
│  2. Authorization Layer                                  │
│     • Role-Based Access Control (RBAC)                   │
│     • Admin vs Employee permissions                      │
│     • Resource-level access control                      │
│                                                          │
│  3. Data Protection Layer                                │
│     • SQL Injection prevention (Prepared Statements)     │
│     • Foreign Key constraints                            │
│     • Transaction integrity (ACID)                       │
│                                                          │
│  4. Audit Layer                                          │
│     • Activity logging                                   │
│     • User action tracking                               │
│     • Timestamp all operations                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Performance Optimization

### Database Level
1. **Indexes**: Created on frequently queried columns
   - `products.barcode`
   - `customers.route_id`
   - `invoices.customer_id`
   - `invoices.invoice_date`

2. **WAL Mode**: Write-Ahead Logging for better concurrency

3. **Prepared Statements**: Cached query plans

### Application Level
1. **Singleton Pattern**: Single database connection
2. **Transaction Batching**: Bulk operations in single transaction
3. **Lazy Loading**: Load data only when needed

### Frontend Level
1. **Chart.js**: Hardware-accelerated canvas rendering
2. **Debouncing**: Search input optimization
3. **Local Caching**: Reduce API calls

---

## Scalability Considerations

### Current Architecture (Single Server)
- **Capacity**: ~100 concurrent users
- **Database**: SQLite (suitable for < 1TB data)
- **Deployment**: Single server

### Future Scaling Path

```
Phase 1 (Current)          Phase 2 (Growth)         Phase 3 (Enterprise)
┌──────────┐              ┌──────────┐              ┌──────────┐
│  SQLite  │     ───>     │PostgreSQL│     ───>     │PostgreSQL│
│  Single  │              │  Single  │              │  Cluster │
│  Server  │              │  Server  │              │  + Redis │
└──────────┘              └──────────┘              └──────────┘
                                                           │
                                                           ▼
                                                    ┌──────────┐
                                                    │   Load   │
                                                    │ Balancer │
                                                    └──────────┘
                                                           │
                                                    ┌──────┴──────┐
                                                    │             │
                                                ┌───▼───┐   ┌─────▼──┐
                                                │Server1│   │Server2 │
                                                └───────┘   └────────┘
```

---

## Deployment Architecture

### Development Environment
```
Developer Machine
├── Node.js Server (localhost:3000)
├── SQLite Database (local file)
└── Browser (Chrome/Firefox)
```

### Production Environment (Recommended)
```
┌─────────────────────────────────────┐
│         Cloud Server (VPS)          │
│  ┌───────────────────────────────┐  │
│  │  Nginx (Reverse Proxy)        │  │
│  │  • SSL/TLS Termination        │  │
│  │  • Static file serving        │  │
│  │  • Gzip compression           │  │
│  └────────────┬──────────────────┘  │
│               │                      │
│  ┌────────────▼──────────────────┐  │
│  │  Node.js Application          │  │
│  │  • Express Server             │  │
│  │  • API Routes                 │  │
│  │  • Business Logic             │  │
│  └────────────┬──────────────────┘  │
│               │                      │
│  ┌────────────▼──────────────────┐  │
│  │  SQLite/PostgreSQL Database   │  │
│  │  • Data persistence           │  │
│  │  • Backup & Recovery          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Technology Decisions & Rationale

| Technology | Rationale |
|-----------|-----------|
| **SQLite** | Lightweight, zero-config, perfect for offline-first, embedded deployment |
| **Express.js** | Minimal, flexible, industry-standard Node.js framework |
| **Vanilla JS** | No framework lock-in, faster load times, easier maintenance |
| **Chart.js** | Simple, beautiful charts with good performance |
| **CSS Variables** | Dynamic theming, easy customization, no preprocessor needed |
| **Repository Pattern** | Clean separation, testable, swappable data sources |

---

This architecture is designed to be:
- ✅ **Scalable**: Easy to migrate to PostgreSQL/MySQL
- ✅ **Maintainable**: Clear separation of concerns
- ✅ **Testable**: Repository pattern enables unit testing
- ✅ **Offline-First**: SQLite enables local-first architecture
- ✅ **Extensible**: Modular design for easy feature additions
