# Auto-Logout Timeout - Role-Based Configuration

## Overview
The system now automatically disables the auto-logout timeout for **Administrator/Admin** users while keeping it active for other roles (employees, sales reps, etc.).

## Feature Details

### ✅ Administrator Behavior
When a user with role `admin` or `administrator` logs in:
- **Session timer is automatically disabled**
- **Timer display is hidden** from the header
- **Unlimited session duration** - no automatic logout
- **Settings page shows** a special notice about this privilege

### ✅ Non-Admin User Behavior
When other users (employees, sales reps) log in:
- **Session timer is enabled** by default
- **Configurable timeout** via Settings (1-120 minutes)
- **Can manually disable** the timer if needed
- **Visual warning** when session is about to expire

## Implementation Details

### Automatic Detection
The system checks the user's role during initialization:
```javascript
const userRole = this.currentUser?.role?.toLowerCase();
const isAdmin = userRole === 'admin' || userRole === 'administrator';
```

### Session Timer Logic
- **Location**: `app.js` → `initSessionTimer()`
- **Trigger**: Called automatically after successful login
- **Admin Check**: Runs first, before any timer settings
- **Result**: Admins bypass all timer logic entirely

### Settings Page Enhancement
When admins visit the Settings page:
- **Timeout input** shows: `∞ (Unlimited)`
- **Enable checkbox** is disabled and unchecked
- **Green notice banner** displays: 
  > 👑 **Administrator Privilege:** Session timeout is automatically disabled for your account. You have unlimited session duration.

## User Experience

### For Administrators
1. Log in normally
2. Notice **no session timer** in the header
3. Work without interruption
4. Can stay logged in indefinitely
5. Settings page confirms unlimited access

### For Employees
1. Log in normally
2. See **session timer** counting down in header
3. Default: 10 minutes before auto-logout
4. Can adjust timeout in Settings (1-120 mins)
5. Can manually disable timer if allowed by policy

## Security Considerations

### Why Admins Get Unlimited Sessions?
- **Administrative tasks** often require extended periods
- **System maintenance** shouldn't be interrupted
- **Trusted users** with elevated privileges
- **Always available** for critical system issues

### Why Employees Have Timeouts?
- **Security best practice** for regular users
- **Prevents unauthorized access** from unattended terminals
- **Compliance requirement** in many industries
- **Reduces risk** of session hijacking

## Testing

### Test Admin Behavior
1. Log in as: `admin` / `admin123`
2. Verify: No timer in header
3. Go to Settings
4. Verify: Timer controls are disabled with green notice

### Test Employee Behavior
1. Log in as: `salesrep1` / `emp123`
2. Verify: Timer is visible in header (default 10:00)
3. Go to Settings
4. Verify: Can adjust timeout duration

## Configuration Override

If you need to force a timeout for admins:
```javascript
// In app.js, modify initSessionTimer():
const isAdmin = false; // Force disable admin privilege
```

**Not recommended** unless required by strict security policy.

## Related Files
- `/public/app.js` - Main timer logic
- `/middleware/auth.js` - Authentication middleware
- `/public/dashboard.html` - Settings view

---

**Feature Status**: ✅ Fully Implemented  
**Version**: 1.0  
**Last Updated**: 2026-01-03
