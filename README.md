# 🏠 RentFlow — Smart Rent Management Application

A comprehensive, full-stack rent management platform for **landlords** and **tenants** to manage properties, track payments, generate receipts, and analyze finances — all from a single dashboard.

**Live App:** [https://rentflow-app.onrender.com](https://rentflow-app.onrender.com)

---

## 📋 Table of Contents

- [Features Overview](#-features-overview)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [User Roles](#-user-roles)
- [Module-by-Module Breakdown](#-module-by-module-breakdown)
  - [Authentication](#1--authentication)
  - [Dashboard](#2--dashboard)
  - [Properties](#3--properties)
  - [Tenants](#4--tenants)
  - [Transactions](#5--transactions)
  - [Rent Agreements](#6--rent-agreements)
  - [Advance Amount](#7--advance-amount)
  - [Shared Bills](#8--shared-bills)
  - [Reports & Analytics](#9--reports--analytics)
  - [Rent Receipt Generator](#10--rent-receipt-generator)
  - [Admin Panel](#11--admin-panel)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Automated Features](#-automated-features)
- [PWA & Mobile App](#-pwa--mobile-app)
- [Setup & Deployment](#-setup--deployment)

---

## ✨ Features Overview

| Feature | Description |
|---------|-------------|
| 🔐 **Multi-role Auth** | Landlord, Tenant, and Admin roles with JWT-based authentication |
| 🏢 **Property Management** | Add, edit, delete properties with rent amounts and due dates |
| 👥 **Tenant Management** | Track tenants, lease periods, auto-link user accounts |
| 💰 **Transaction Tracking** | Record rent payments with status tracking (Paid/Pending/Overdue) |
| 📄 **Rent Agreements** | Upload, view, download, and replace agreement documents (PDF/Image) |
| 💵 **Advance Payments** | Track security deposits and advance amounts per tenant |
| 🧾 **Shared Bills** | Upload utility bills with automatic 50/50 split calculation |
| 📊 **Reports & Analytics** | Monthly/yearly charts, payment mode breakdown, CSV export |
| 📑 **Rent Receipt Generator** | Generate professional PDF receipts with one click (client-side) |
| 👤 **Admin Panel** | User management, password reset, role changes |
| 📱 **WhatsApp Reminders** | Send rent reminders directly via WhatsApp |
| ⏰ **Auto Rent Generation** | Cron job auto-creates pending transactions on the 5th of every month |
| 🌐 **PWA Support** | Installable as a Progressive Web App |
| 📲 **Mobile App Ready** | Capacitor integration for Android and iOS builds |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL (Neon — serverless) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **File Upload** | Multer (agreements, receipts, bills) |
| **PDF Generation** | jsPDF (client-side, CDN) |
| **Charts** | Chart.js |
| **Scheduling** | node-cron (auto rent generation) |
| **Mobile** | Capacitor (Android + iOS) |
| **Hosting** | Render (web service) |
| **Fonts** | Google Fonts (Inter) + Material Symbols |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  public/index.html  ←  public/app.js             │
│                     ←  public/styles.css          │
│  Chart.js (CDN)     ←  jsPDF (CDN)               │
│  Service Worker     ←  PWA Manifest               │
├──────────────────────────────────────────────────┤
│                  EXPRESS SERVER                   │
│  server.js  →  routes/                           │
│    ├── auth.js        (login, register, profile) │
│    ├── properties.js  (CRUD properties)          │
│    ├── tenants.js     (CRUD tenants)             │
│    ├── transactions.js(CRUD + summary + filters) │
│    ├── dashboard.js   (landlord/tenant stats)    │
│    ├── agreements.js  (upload/replace/delete)    │
│    ├── advances.js    (CRUD advance payments)    │
│    ├── bills.js       (shared bills 50/50)       │
│    └── admin.js       (user management)          │
│  middleware/auth.js   (JWT verify + role check)  │
│  db.js               (PostgreSQL pool + schema)  │
├──────────────────────────────────────────────────┤
│               POSTGRESQL (Neon)                  │
│  users · properties · tenants · transactions     │
│  activity_log · rent_agreements                  │
│  advance_payments · shared_bills                 │
└──────────────────────────────────────────────────┘
```

---

## 👤 User Roles

### Landlord
- Full access to all modules
- Add/edit/delete properties, tenants, transactions
- Upload agreements, track advances, manage shared bills
- View reports, generate receipts, send WhatsApp reminders

### Tenant
- View assigned properties and lease details
- View own transactions, pending payments, and dues
- View agreements uploaded by landlord
- View advance payments and shared bills
- Access reports for own payment history
- Generate rent receipts

### Admin
- User management panel (list all users)
- Reset any user's password
- Edit user details (name, email, role, phone)
- Delete user accounts
- View activity logs

---

## 📦 Module-by-Module Breakdown

### 1. 🔐 Authentication

| Feature | Details |
|---------|---------|
| **Registration** | Name, email, password, phone, role selection (Landlord/Tenant) |
| **Login** | Supports both email and phone number login |
| **JWT Tokens** | 7-day expiry, stored in localStorage |
| **Auto-link** | Tenants auto-link to existing tenant records via email/phone match |
| **Profile Update** | Users can update name and phone |
| **Phone Uniqueness** | Enforced at registration and update |

**Endpoints:**
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login (email or phone)
- `GET /api/auth/me` — Get current user profile
- `PUT /api/auth/me` — Update profile

---

### 2. 📊 Dashboard

**Landlord Dashboard:**
- **Stats Cards:** Property count, Active tenants, This month's income, Overdue count
- **Upcoming Dues:** List of pending/overdue payments with tenant and property info
- **Recent Activity:** Activity log feed (registrations, payments, etc.)
- **Recent Transactions:** Latest 10 transactions table

**Tenant Dashboard:**
- **Pending Rent Alert Banner:** Prominent alert showing total pending amount with overdue/upcoming breakdown
- **Stats Cards:** Total paid, Pending amount, Active leases
- **Upcoming Dues:** Payments due with dates
- **Recent Payments:** Own payment history

**Endpoints:**
- `GET /api/dashboard/landlord` — Landlord stats + upcoming dues + activity
- `GET /api/dashboard/tenant` — Tenant stats + dues + recent payments

---

### 3. 🏢 Properties

| Action | Role | Details |
|--------|------|---------|
| **Add Property** | Landlord | Name, address, rent amount, due day (1-28), type (Apartment/House/Commercial/Parking) |
| **Edit Property** | Landlord | Modify any field |
| **Delete Property** | Landlord | Cascading delete (removes linked tenants, transactions) |
| **View Properties** | All | Card grid with icon, address, rent, tenant count, due day |

**Endpoints:**
- `GET /api/properties` — List (landlord: own, tenant: assigned)
- `POST /api/properties` — Create
- `PUT /api/properties/:id` — Update
- `DELETE /api/properties/:id` — Delete

---

### 4. 👥 Tenants

| Action | Role | Details |
|--------|------|---------|
| **Add Tenant** | Landlord | Select property → Name, email, phone, lease start/end dates |
| **Edit Tenant** | Landlord | Update contact info and lease dates |
| **Delete Tenant** | Landlord | Soft removal |
| **View Tenants** | All | Data table with property name, email, phone, lease period |
| **Auto-Link** | System | When a user registers as tenant, their account auto-links to tenant records matching their email or phone |

**Endpoints:**
- `GET /api/tenants` — List
- `POST /api/tenants` — Create
- `PUT /api/tenants/:id` — Update
- `DELETE /api/tenants/:id` — Delete

---

### 5. 💰 Transactions

| Action | Role | Details |
|--------|------|---------|
| **Add Transaction** | All | Property, tenant, amount (auto-fills from property rent), due date, mode (Cash/Bank Transfer/UPI/Cheque/Other), status, date paid, notes, receipt upload |
| **Edit Transaction** | All | Modify amount, dates, mode, status, notes |
| **Mark as Paid** | All | One-click mark paid with today's date |
| **Delete Transaction** | All | Permanent removal |
| **Filter** | All | By property, status (Paid/Pending/Overdue), date range (from/to) |
| **Receipt Upload** | All | Attach JPG, PNG, PDF, WebP files |
| **WhatsApp Reminder** | Landlord | Send payment reminder via WhatsApp with pre-filled message |

**Payment Modes:** Cash, Bank Transfer, UPI, Cheque, Other

**Statuses:** Paid ✅, Pending ⚠️, Overdue ❌

**Endpoints:**
- `GET /api/transactions` — List with filters
- `GET /api/transactions/summary` — Annual/monthly summary for reports
- `POST /api/transactions` — Create (multipart for receipt upload)
- `PUT /api/transactions/:id` — Update
- `DELETE /api/transactions/:id` — Delete

---

### 6. 📄 Rent Agreements

| Action | Role | Details |
|--------|------|---------|
| **Upload Agreement** | Landlord | Select property → Upload PDF/JPG/PNG/WebP |
| **View Agreement** | All | Preview (image inline, PDF click-to-open) |
| **Download** | All | Download original file |
| **Replace** | Landlord | Upload a new version for same property |
| **Delete** | Landlord | Remove agreement |

**Supported Formats:** PDF, JPG, JPEG, PNG, WebP

**Endpoints:**
- `GET /api/agreements` — List all agreements
- `POST /api/agreements/:propertyId` — Upload/replace (multipart)
- `DELETE /api/agreements/:propertyId` — Delete

---

### 7. 💵 Advance Amount

| Action | Role | Details |
|--------|------|---------|
| **Add Advance** | Landlord | Select property → tenant → amount, date, notes |
| **Edit Advance** | Landlord | Modify amount, date, notes |
| **Delete Advance** | Landlord | Remove record |
| **View Summary** | All | Total advance amount card + payment count |
| **Filter** | Landlord | Filter by property |

**Endpoints:**
- `GET /api/advances` — List with optional property filter + total
- `POST /api/advances` — Create
- `PUT /api/advances/:id` — Update
- `DELETE /api/advances/:id` — Delete

---

### 8. 🧾 Shared Bills (50/50 Split)

| Action | Role | Details |
|--------|------|---------|
| **Upload Bill** | Landlord | Property, tenant, bill name, total amount, due date, file attachment |
| **Auto-Split** | System | Automatically calculates 50% tenant share |
| **Mark Paid** | Landlord | One-click mark as paid |
| **Edit Bill** | Landlord | Modify name, amount (recalculates split), due date, status |
| **Delete Bill** | Landlord | Remove bill |
| **View Document** | All | Open uploaded bill file in new tab |
| **Filter** | All | By property, status |

**Endpoints:**
- `GET /api/bills` — List with filters
- `POST /api/bills` — Create (multipart for file)
- `PUT /api/bills/:id` — Update
- `PATCH /api/bills/:id/status` — Quick status update
- `DELETE /api/bills/:id` — Delete

---

### 9. 📊 Reports & Analytics

| Feature | Details |
|---------|---------|
| **Year Filter** | Select specific year or "All Time" |
| **Property Filter** | Filter by specific property (Landlord only) |
| **Summary Cards** | Total collected, Outstanding, Total transactions, Overdue count |
| **Monthly Bar Chart** | Collected vs Pending by month (Chart.js) |
| **Payment Mode Donut** | Breakdown by payment mode (Cash/UPI/NEFT/Cheque) |
| **Property Breakdown** | Table: collected, outstanding, transaction count per property |
| **CSV Export** | Download all transactions as CSV |

**Endpoints:**
- `GET /api/transactions/summary?year=&property_id=` — Summary data
- CSV is generated client-side from transaction data

---

### 10. 📑 Rent Receipt Generator

**Hassle-free PDF receipt generation for tax saving (HRA claims)**

| Feature | Details |
|---------|---------|
| **Smart Auto-fill** | Landlords select Property → Tenant; form populates from existing data |
| **Owner auto-fill** | Owner name and phone pre-filled from logged-in user profile |
| **PAN Warning** | Auto-shows warning when monthly rent × 12 > ₹1,00,000 |
| **Payment Mode** | Cash / UPI / NEFT / Cheque |
| **Transaction Ref** | Auto-hidden for Cash; shows for other modes |
| **Date Range** | Start date → End date; generates one receipt per month |
| **PDF Layout** | 2 receipts per A4 page, bordered boxes |
| **Receipt No.** | Auto-incremented (001, 002, 003...) |
| **Revenue Stamp** | Placeholder shown when Cash payment > ₹5,000 |
| **Amount in Words** | Indian numbering — supports lakh/crore |
| **Instant Download** | Client-side PDF via jsPDF, zero server calls |

**Receipt Format:**
```
┌──────────────────────────────────────────────────┐
│              HOUSE RENT RECEIPT                   │
│                                                   │
│  Receipt No: 001                Dated: 01 July 2025│
│                                                   │
│  This is to acknowledge the receipt from [Tenant] │
│  the sum of Rupees 14000/- (Rupees fourteen       │
│  thousand only) in lieu of rent payment for the   │
│  month of July 2025, towards the property bearing │
│  the address "[Address]".                         │
│                                                   │
│  Rent Period:      July 2025                      │
│  Mode of Payment:  Cash                           │
│                                                   │
│  Owner's Name and Address                         │
│  ─────────────────────────                        │
│  [Owner Name]                                     │
│  PAN: [PAN]                                       │
│  [Owner Address]                                  │
│                                                   │
│                     [Revenue Stamp]               │
│                                                   │
│                              Signature            │
│                             ([Owner Name])        │
└──────────────────────────────────────────────────┘
```

---

### 11. 👤 Admin Panel

| Action | Details |
|--------|---------|
| **View All Users** | Table with name, email, role, phone, registration date |
| **Search** | Filter users by name or email |
| **Edit User** | Change name, email, role, phone |
| **Reset Password** | Set new password for any user (minimum 6 chars) |
| **Delete User** | Remove user account (cannot delete own admin account) |
| **Activity Log** | All admin actions are logged |

**Endpoints:**
- `GET /api/admin/users` — List all users
- `PUT /api/admin/users/:id` — Edit user
- `POST /api/admin/users/:id/reset-password` — Reset password
- `DELETE /api/admin/users/:id` — Delete user

---

## 📡 API Reference

All endpoints are prefixed with `/api`. Authentication is via `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | ❌ | Register new user |
| `POST` | `/auth/login` | ❌ | Login |
| `GET` | `/auth/me` | ✅ | Get current user |
| `PUT` | `/auth/me` | ✅ | Update profile |
| `GET` | `/dashboard/landlord` | ✅ | Landlord dashboard data |
| `GET` | `/dashboard/tenant` | ✅ | Tenant dashboard data |
| `GET` | `/properties` | ✅ | List properties |
| `POST` | `/properties` | ✅ | Create property |
| `PUT` | `/properties/:id` | ✅ | Update property |
| `DELETE` | `/properties/:id` | ✅ | Delete property |
| `GET` | `/tenants` | ✅ | List tenants |
| `POST` | `/tenants` | ✅ | Create tenant |
| `PUT` | `/tenants/:id` | ✅ | Update tenant |
| `DELETE` | `/tenants/:id` | ✅ | Delete tenant |
| `GET` | `/transactions` | ✅ | List transactions (with filters) |
| `GET` | `/transactions/summary` | ✅ | Reports summary data |
| `POST` | `/transactions` | ✅ | Create transaction (multipart) |
| `PUT` | `/transactions/:id` | ✅ | Update transaction |
| `DELETE` | `/transactions/:id` | ✅ | Delete transaction |
| `GET` | `/agreements` | ✅ | List agreements |
| `POST` | `/agreements/:propId` | ✅ | Upload/replace agreement (multipart) |
| `DELETE` | `/agreements/:propId` | ✅ | Delete agreement |
| `GET` | `/advances` | ✅ | List advance payments |
| `POST` | `/advances` | ✅ | Create advance payment |
| `PUT` | `/advances/:id` | ✅ | Update advance payment |
| `DELETE` | `/advances/:id` | ✅ | Delete advance payment |
| `GET` | `/bills` | ✅ | List shared bills |
| `POST` | `/bills` | ✅ | Create shared bill (multipart) |
| `PUT` | `/bills/:id` | ✅ | Update bill |
| `PATCH` | `/bills/:id/status` | ✅ | Quick status update |
| `DELETE` | `/bills/:id` | ✅ | Delete bill |
| `GET` | `/admin/users` | 🔒 Admin | List all users |
| `PUT` | `/admin/users/:id` | 🔒 Admin | Edit user |
| `POST` | `/admin/users/:id/reset-password` | 🔒 Admin | Reset password |
| `DELETE` | `/admin/users/:id` | 🔒 Admin | Delete user |
| `GET` | `/health` | ❌ | Health check |

---

## 🗄 Database Schema

### Tables

```sql
users              — id, name, email, password_hash, role, phone, avatar_color, created_at
properties         — id, owner_id, name, address, rent_amount, due_day, property_type, is_active, created_at
tenants            — id, property_id, user_id, name, email, phone, lease_start, lease_end, is_active, created_at
transactions       — id, property_id, tenant_id, amount, date_paid, due_date, mode, status, receipt_path, notes, created_by, created_at
activity_log       — id, user_id, action, details, created_at
rent_agreements    — id, property_id, file_name, file_path, file_type, uploaded_by, created_at, updated_at
advance_payments   — id, property_id, tenant_id, amount, paid_date, notes, created_by, created_at
shared_bills       — id, property_id, tenant_id, bill_name, total_amount, tenant_share, due_date, file_path, status, created_by, created_at
```

### Relationships

```
users ──┬── properties (owner_id)
        ├── tenants (user_id, auto-linked)
        ├── transactions (created_by)
        ├── activity_log (user_id)
        ├── rent_agreements (uploaded_by)
        ├── advance_payments (created_by)
        └── shared_bills (created_by)

properties ──┬── tenants (property_id)
             ├── transactions (property_id)
             ├── rent_agreements (property_id)
             ├── advance_payments (property_id)
             └── shared_bills (property_id)

tenants ──┬── transactions (tenant_id)
          ├── advance_payments (tenant_id)
          └── shared_bills (tenant_id)
```

---

## ⏰ Automated Features

### Monthly Rent Transaction Generation
- **Schedule:** Runs at `00:01 on the 5th of every month` (IST)
- **Logic:** Creates `pending` transactions for all active tenants with active properties
- **Deduplication:** Skips if a transaction already exists for that tenant + property + month
- **Amount:** Uses the property's `rent_amount`
- **Notes:** Auto-labeled e.g. "Auto-generated rent for July 2025"

### Tenant Auto-Linking
- When a user registers as a **tenant**, the system automatically links their account to existing tenant records matching their **email** or **phone number**
- This allows tenants to see their properties, transactions, and dues immediately after registration

---

## 📱 PWA & Mobile App

### Progressive Web App (PWA)
- **Service Worker:** Caches assets for offline-capable experience
- **Manifest:** Installable on mobile home screens
- **Theme Color:** `#6366f1` (Indigo)

### Capacitor (Native Mobile)
- Pre-configured for **Android** and **iOS** builds
- When running as a native app, API calls route to the cloud server (`https://rentflow-app.onrender.com`)
- Build commands:
  ```bash
  npx cap sync          # Sync web assets to native projects
  npx cap open android  # Open Android Studio
  npx cap open ios      # Open Xcode
  ```

---

## 🚀 Setup & Deployment

### Prerequisites
- Node.js ≥ 18
- PostgreSQL database (or Neon serverless)

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
JWT_SECRET=your-secret-key
ADMIN_EMAIL=admin@rentflow.com     # Default admin email
ADMIN_PASSWORD=AdminPassword123     # Default admin password
PORT=3000                           # Optional, defaults to 3000
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/Sujayjgowda/rentflow-app.git
cd rentflow-app

# Install dependencies
npm install

# Start the server
npm run dev

# App runs at http://localhost:3000
```

### Deployment (Render)

1. Push to GitHub (`main` branch)
2. Render auto-deploys from the repo
3. Set environment variables in Render dashboard
4. Database tables are auto-created on first run
5. Admin account is auto-seeded if none exists

---

## 📁 Project Structure

```
rentflow-app/
├── public/                  # Frontend (served as static files)
│   ├── index.html           # Main HTML (SPA shell)
│   ├── app.js               # All frontend logic (~2300 lines)
│   ├── styles.css           # All styles (~2100 lines)
│   ├── sw.js                # Service Worker (PWA)
│   ├── manifest.json        # PWA manifest
│   └── icons/               # App icons (various sizes)
├── routes/                  # API route handlers
│   ├── auth.js              # Register, login, profile
│   ├── properties.js        # Property CRUD
│   ├── tenants.js           # Tenant CRUD
│   ├── transactions.js      # Transaction CRUD + summary
│   ├── dashboard.js         # Dashboard stats
│   ├── agreements.js        # Agreement upload/manage
│   ├── advances.js          # Advance payment CRUD
│   ├── bills.js             # Shared bills CRUD
│   └── admin.js             # Admin user management
├── middleware/
│   └── auth.js              # JWT authentication + role middleware
├── uploads/                 # Uploaded files (agreements, receipts, bills)
│   ├── agreements/
│   └── bills/
├── android/                 # Capacitor Android project
├── ios/                     # Capacitor iOS project
├── server.js                # Express server + cron setup
├── db.js                    # Database connection + schema init
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

---

## 📜 License

This project is privately maintained by **Sujay Gowda**.

---

*Built with ❤️ for hassle-free rent management*
