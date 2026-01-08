# 🚀 Quick Start Guide - Agro Distribution System

## PowerShell Execution Policy Issue

If you're seeing an error about "running scripts is disabled", you have two options:

### Option 1: Use Batch Files (Recommended)
Simply double-click these files:
1. **setup.bat** - Install dependencies and initialize database
2. **start-server.bat** - Start the application server

### Option 2: Enable PowerShell Scripts (One-time)
Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then you can use npm commands normally.

---

## Manual Setup Steps

If batch files don't work, follow these manual steps:

### Step 1: Open Command Prompt (cmd.exe)
- Press `Win + R`
- Type `cmd` and press Enter
- Navigate to project folder:
  ```
  cd d:\Freelance\MKC
  ```

### Step 2: Install Dependencies
```
npm install
```

### Step 3: Initialize Database
```
node scripts\init-db.js
```

### Step 4: Start Server
```
node server.js
```

### Step 5: Open Browser
Navigate to: **http://localhost:3000**

---

## Default Login Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

**Employee:**
- Username: `salesrep1`
- Password: `emp123`

---

## Troubleshooting

### Port Already in Use
If port 3000 is busy, edit `server.js` and change:
```javascript
const PORT = process.env.PORT || 3000;
```
to:
```javascript
const PORT = process.env.PORT || 3001;
```

### Database Locked
If you see "database is locked", close all other instances of the application.

### Missing Dependencies
Delete `node_modules` folder and `package-lock.json`, then run `npm install` again.

---

## Next Steps

1. ✅ Login to the dashboard
2. ✅ Explore the KPI cards
3. ✅ Check the sample data (products, customers)
4. ✅ Create a test invoice
5. ✅ Record a payment
6. ✅ View reports and charts

---

## Need Help?

Check the main **README.md** for complete documentation.
