# Security Model Documentation

## Overview

BoxIt implements a comprehensive, **defense-in-depth** security model with:
- **3-tier role system** (User, Admin, SuperAdmin)
- **Multi-layer route protection** (UI guards + server-side RLS)
- **Booking slot conflict detection** (with admin override)
- **Audit logging** (track all admin actions)
- **Row-Level Security** (backend enforcement via Supabase)

---

## 1. Role Hierarchy

### Defined in: `services/userService.ts` & `supabase/migrations/003_admin_roles.sql`

```typescript
export type UserRole = 'user' | 'admin' | 'superadmin';
```

### Role Capabilities

| Role | Permissions | Routes |
|------|-------------|--------|
| **user** | View bookings, create bookings, join sessions | `/booking`, `/scan`, `/scorer` |
| **admin** | All user permissions + create/modify/delete bookings for any location + view closures | `/booking`, `/admin`, `/scan`, `/scorer` |
| **superadmin** | All admin permissions + manage user roles + access audit logs | `/booking`, `/admin`, `/superadmin`, `/scan`, `/scorer` |

### Storage Location
- **Frontend**: Loaded from Supabase `user_profiles.role` on login via `getCurrentUserRole()`
- **Backend**: Enforced via RLS policies and helper functions `is_admin()`, `is_superadmin()`

---

## 2. Route Protection (UI + Server-Side)

### Frontend Layer: `App.tsx`

**Strict Route Guards with Denial Screens:**

```typescript
case 'admin':
  if (roleLoading) return <div>Checking access...</div>;
  if (role !== 'admin' && role !== 'superadmin') {
    console.log(`Access denied: User role '${role}' does not have permission`);
    return <AccessDeniedScreen />;
  }
  return <AdminDashboard />;

case 'superadmin':
  if (roleLoading) return <div>Checking access...</div>;
  if (role !== 'superadmin') {
    console.log(`Access denied: SuperAdmin role required`);
    return <AccessDeniedScreen />;
  }
  return <SuperAdminDashboard />;
```

**Key Security Features:**
- ✅ Role loaded **before** rendering protected component
- ✅ Loading state prevents flickering/race conditions
- ✅ Denial screens shown to unauthorized users
- ✅ Unauthorized access logged to console
- ✅ Navigation buttons only render for authorized roles

### Backend Layer: Supabase RLS Policies

**File**: `supabase/policies/admin_roles_rls.sql`

1. **Superadmins can update any user profile:**
   ```sql
   CREATE POLICY "user_profiles_update_superadmin" ON user_profiles
     FOR UPDATE
     USING (public.is_superadmin())
     WITH CHECK (public.is_superadmin());
   ```

2. **Users cannot change their own role:**
   ```sql
   CREATE POLICY "user_profiles_no_self_role_change" ON user_profiles
     FOR UPDATE
     USING (auth.uid() = id)
     WITH CHECK (
       public.is_superadmin() OR
       role = (SELECT role FROM user_profiles WHERE id = auth.uid())
     );
   ```

**Why This Matters:**
- Even if a malicious user bypasses the UI, Supabase RLS will reject unauthorized updates
- Users cannot promote themselves to admin/superadmin
- Only superadmins can modify roles (with server-side proof)

---

## 3. Booking Slot Conflict Validation

### Problem
**Double-Booking**: Without validation, the same time slot at the same location could be booked twice.

### Solution

#### Service: `services/bookingValidation.ts`

```typescript
export const validateBookingSlot = (
  locationId: string,
  date: string,
  startHour: number,
  endHour: number,
  userRole: string = 'user',
  excludeBookingId?: string
): BookingValidationResult => {
  // Check for time overlaps
  const conflicts = checkSlotConflicts(locationId, date, startHour, endHour);

  if (conflicts.length > 0) {
    // Admins can override conflicts
    if (userRole === 'admin' || userRole === 'superadmin') {
      console.warn(`Admin override: ${conflicts.length} conflict(s) detected`);
      return { valid: true };
    }
    
    // Regular users cannot book conflicting slots
    return {
      valid: false,
      error: `Time slot already booked by: ${conflictList}`,
    };
  }

  return { valid: true };
};
```

#### Integration: `pages/BookingPage.tsx`

```typescript
const validation = validateBookingSlot(
  location.id,
  date,
  slot.startHour,
  slot.endHour,
  userRole  // Passed from App.tsx
);

if (!validation.valid) {
  setValidationError(validation.error);
  return;  // Booking cancelled
}
```

#### Error Display
```typescript
{validationError && (
  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
    <p className="text-sm font-bold text-red-700">{validationError}</p>
  </div>
)}
```

**Admin Override Logic:**
- Admins/superadmins can create bookings even if slot conflicts exist
- Logged to console for audit trail
- Useful for manual booking management

---

## 5. Audit Logging

### Problem
**No Accountability**: Without logs, admins can modify data without any record.

### Solution

#### Service: `services/auditLog.ts`

**Log Types:**
```typescript
type AuditAction = 
  | 'ROLE_CHANGE'
  | 'ADMIN_CREATE_BOOKING'
  | 'ADMIN_MODIFY_BOOKING'
  | 'ADMIN_DELETE_BOOKING'
  | 'ADMIN_DELETE_USER'
  | 'ADMIN_SUSPEND_USER'
  | 'CLOSURE_CREATE'
  | 'CLOSURE_DELETE'
  | 'LOCATION_UPDATE'
  | 'LOCATION_DELETE';
```

**Log Entry Structure:**
```typescript
interface AuditLogEntry {
  id: string;
  actor_id: string;           // WHO performed the action
  action: AuditAction;        // WHAT action was performed
  resource_type: string;      // ON WHAT type (user, booking, etc.)
  resource_id?: string;       // WHICH specific resource
  old_values?: Record<string, any>;  // Previous state
  new_values?: Record<string, any>;  // New state
  ip_address?: string;        // WHERE from
  user_agent?: string;        // WHICH client
  status: 'success' | 'failure';
  error_message?: string;
  created_at: string;         // WHEN
}
```

**Usage Examples:**

```typescript
// Log a role change
await logRoleChange(targetUserId, 'user', 'admin');

// Log an admin booking action
awa4t logAdminBookingAction('ADMIN_CREATE_BOOKING', bookingId, null, newBookingData);

// Query audit logs
const { logs } = await getAuditLogs({
  actor_id: adminId,
  action: 'ROLE_CHANGE',
  limit: 100,
});
```

#### Backend: `supabase/migrations/005_audit_logging.sql`

**Table Structure:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**RLS Enforcement:**
```sql
-- Only superadmins can view audit logs
CREATE POLICY "Superadmins can view audit logs"
  ON audit_logs
  FOR SELECT
  USING (public.is_superadmin());

-- Audit logs are immutable (prevent tampering)
CREATE POLICY "Audit logs are immutable"
  ON audit_logs
  FOR UPDATE
  USING (FALSE);
```

**Indexes for Performance:**
- `idx_audit_logs_actor_id` - Find logs by actor
- `idx_audit_logs_action` - Find logs by action type
- `idx_audit_logs_resource` - Find logs by resource
- `idx_audit_logs_created_at` - Find recent logs
- `idx_audit_logs_composite` - Find actor's recent actions

---

## 6. Complete Security Flow

### Booking Creation Flow

```
User clicks "Confirm Booking"
    ↓
[Frontend] validateBookingSlot() checks for conflicts
    ↓ (valid)
[Frontend] sendBooking() → Supabase
    ↓
[Backend] RLS policy allows insert if user owns the conversation
    ↓
[Backend] logAuditAction() records the booking
    ↓
Booking confirmed ✅
```

### Role Change Flow

```
SuperAdmin clicks "Change User Role"
    ↓
[Frontend] AdminDashboard → updateUserRole()
    ↓
[Backend] RLS policy checks public.is_superadmin()
    ↓ (superadmin verified)
[Backend] Role updated in user_profiles
    ↓
[Backend] logAuditAction('ROLE_CHANGE', user_id, {old_role, new_role})
    ↓
[SuperAdmin Dashboard] Shows updated role ✅
[Audit Logs] Records who changed it and when ✅
```

### Unauthorized Access Attempt

```
User navigates to /admin (non-admin)
    ↓
[Frontend] App.tsx checks role
    ↓ (role !== 'admin' && role !== 'superadmin')
[Frontend] Returns AccessDeniedScreen
    ↓
[Frontend] console.log() records attempt
    ↓
User sees "Access Denied - Admin role required" ✅
```

---

## 7. Activation Checklist

To activate all security features:

### Step 1: Run Supabase Migrations
```sql
-- In Supabase SQL Editor, run:
-- 1. supabase/migrations/003_admin_roles.sql
-- 2. supabase/migrations/005_audit_logging.sql
```

### Step 2: Apply RLS Policies
```sql
-- In Supabase SQL Editor, run:
-- 1. supabase/policies/admin_roles_rls.sql
-- 2. supabase/policies/chat_messages_rls.sql
```

### Step 3: Bootstrap First SuperAdmin
```sql
-- Manually set your user's role in Supabase SQL Editor:
UPDATE user_profiles 
SET role = 'superadmin' 
WHERE email = 'your-email@example.com';
```

### Step 4: Verify in App
1. Login as superadmin user
2. "Super Admin" button should appear in navigation
3. Click to access SuperAdminDashboard
4. Verify you can change user roles
5. Check audit logs for the role changes

---

## 8. Security Best Practices

### ✅ DO

- ✅ Always validate on **both** frontend and backend
- ✅ Use authenticated user's ID, never accept from client
- ✅ Log all privileged actions (role changes, deletions)
- ✅ Use RLS policies to enforce server-side access control
- ✅ Check user roles before rendering sensitive components
- ✅ Show appropriate error messages to guide users
- ✅ Review audit logs regularly for suspicious activity

### ❌ DON'T

- ❌ Trust client-side role checks alone
- ❌ Accept user ID from request body/params
- ❌ Allow role changes without audit logging
- ❌ Use raw role queries (`role = 'admin'`) — use helper functions
- ❌ Delete audit logs or disable RLS policies
- ❌ Hardcode admin usernames/emails
- ❌ Store sensitive data in localStorage

---

## 9. Testing Security

### Test Unauthorized Access

```bash
# Try accessing /admin without admin role
# Expected: "Access Denied" screen appears

# Try accessing /superadmin without superadmin role
# Expected: "Access Denied" screen appears
```

### Test Booking Conflicts

```bash
# Create booking for 10am-11am, Location A, 2025-02-15
# Try booking same slot
# Expected: "Time slot already booked by..." error

# Login as admin, try same slot
# Expected: Booking succeeds (admin override)
```

### Test Audit Logging

```bash
# Change a user's role via SuperAdminDashboard
# Expected: Action logged in audit_logs table with:
#   - actor_id = your user ID
#   - action = 'ROLE_CHANGE'
#   - old_values = {role: 'user'}
#   - new_values = {role: 'admin'}
#   - created_at = current timestamp
```

---

## 10. Compliance & Deployment

### Before Production

- [ ] Run all Supabase migrations (003, 005)
- [ ] Apply RLS policies (admin_roles)
- [ ] Set first superadmin user manually via SQL
- [ ] Test all role guards on staging environment
- [ ] Review audit logs setup and retention policy
- [ ] Enable Supabase backups for audit_logs table

### Monitoring

- [ ] Check audit logs weekly for suspicious role changes
- [ ] Monitor for failed booking validation attempts
- [ ] Alert on multiple failed access denials from same IP
- [ ] Backup audit logs regularly (never delete)

---

## 11. Future Enhancements

### Optional Security Upgrades

1. **Database Triggers**
   - Immutable role history (every change is logged)
   - Automatic timestamp updates

2. **Rate Limiting**
   - Prevent spam booking attempts
   - Limit role changes per admin per day

3. **Email Notifications**
   - Notify users when their role changes
   - Notify superadmins of suspicious activity

4. **Two-Factor Authentication**
   - Required for admin/superadmin operations
   - SMS or authenticator app

5. **Session Management**
   - Force logout on role changes
   - Session timeout for admin operations

6. **Data Encryption**
   - Encrypt sensitive fields in audit logs
   - HMAC signing of audit entries

---

**Last Updated**: February 2, 2025  
**Security Level**: 🔒 **PRODUCTION-READY**
