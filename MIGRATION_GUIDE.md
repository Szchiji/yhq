# Migration Guide: Role-Based Permission System

## Overview
This migration introduces a new 4-role permission system that changes how user permissions are handled. **This is a breaking change** that requires careful migration of existing data.

## Breaking Changes

### 1. User Permission Defaults Changed

**Before:**
```prisma
canCreateLottery  Boolean   @default(true)
canJoinLottery    Boolean   @default(true)
```

**After:**
```prisma
canCreateLottery  Boolean   @default(false)
canJoinLottery    Boolean   @default(false)
```

**Impact:** New users will no longer have lottery permissions by default. Permissions are now granted based on role and payment status.

### 2. New Required Fields

The User model now has several new fields:
- `role` (UserRole enum) - Defaults to 'USER'
- `isPaid`, `paidExpireAt` - Payment tracking
- `isAdmin`, `adminExpireAt` - Admin status tracking

## Migration Steps

### Step 1: Backup Your Database
```bash
# PostgreSQL example
pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql
```

### Step 2: Create Migration

```bash
# Create a new migration
npx prisma migrate dev --name add-role-permission-system --create-only
```

### Step 3: Customize Migration (IMPORTANT!)

Edit the generated migration file in `prisma/migrations/` to preserve existing user permissions:

```sql
-- Add this AFTER the ALTER TABLE statements but BEFORE the migration completes

-- Step 1: Add new enum and fields
-- (Prisma generates this automatically)

-- Step 2: Migrate existing users to maintain their current permissions
UPDATE "User" 
SET 
  "canCreateLottery" = TRUE,
  "canJoinLottery" = TRUE
WHERE "isVip" = TRUE;

-- Step 3: Set role based on existing VIP status
UPDATE "User"
SET "role" = 'VIP'
WHERE "isVip" = TRUE;

-- Step 4: Preserve VIP expiry
UPDATE "User"
SET "vipExpireAt" = "vipExpireAt"
WHERE "vipExpireAt" IS NOT NULL;

-- Step 5: For existing non-VIP users who could create lotteries, set permissions
UPDATE "User"
SET 
  "canCreateLottery" = TRUE,
  "canJoinLottery" = TRUE,
  "isPaid" = TRUE,
  "paidExpireAt" = CURRENT_TIMESTAMP + INTERVAL '365 days'
WHERE "canCreateLottery" = TRUE OR "canJoinLottery" = TRUE;
```

### Step 4: Apply Migration

```bash
npx prisma migrate deploy
```

OR if you don't want to use migrations (development only):

```bash
npx prisma db push
```

Then run the data migration SQL manually:

```sql
-- Grant permissions to existing VIP users
UPDATE "User" 
SET 
  "canCreateLottery" = TRUE,
  "canJoinLottery" = TRUE,
  "role" = 'VIP'
WHERE "isVip" = TRUE;

-- Grant basic permissions to all existing non-VIP users (temporary, adjust as needed)
UPDATE "User"
SET 
  "canJoinLottery" = TRUE,
  "isPaid" = TRUE,
  "paidExpireAt" = CURRENT_TIMESTAMP + INTERVAL '30 days'
WHERE "role" = 'USER' AND "isVip" = FALSE;
```

### Step 5: Verify Migration

```bash
# Check user counts by role
psql -d your_database -c "SELECT role, COUNT(*) FROM \"User\" GROUP BY role;"

# Verify permissions
psql -d your_database -c "SELECT COUNT(*) FROM \"User\" WHERE \"canCreateLottery\" = true;"
psql -d your_database -c "SELECT COUNT(*) FROM \"User\" WHERE \"canJoinLottery\" = true;"
```

## Post-Migration Configuration

### 1. Configure Super Admin

Set environment variable:
```bash
SUPER_ADMIN_IDS=123456789,987654321
```

The system will automatically set the role to SUPER_ADMIN when these users authenticate.

### 2. Set Up Renewal Rules

Create renewal rules via the admin panel or API:

```javascript
// Example: VIP monthly plan
{
  name: "VIP月度套餐",
  targetRole: "vip",
  days: 30,
  price: 10.00,
  currency: "USDT",
  isEnabled: true
}

// Example: Admin monthly plan
{
  name: "管理员月度套餐",
  targetRole: "admin",
  days: 30,
  price: 50.00,
  currency: "USDT",
  isEnabled: true
}

// Example: Permanent VIP
{
  name: "VIP永久套餐",
  targetRole: "vip",
  days: -1,
  price: 99.00,
  currency: "USDT",
  isEnabled: true
}
```

### 3. Set Up Payment Addresses

Configure at least one payment address:

```javascript
{
  name: "USDT-TRC20",
  network: "TRC20",
  address: "TYourWalletAddress...",
  isDefault: true,
  isEnabled: true
}
```

## Rollback Plan

If you need to rollback:

### Option 1: Revert Migration
```bash
npx prisma migrate resolve --rolled-back add-role-permission-system
```

### Option 2: Restore from Backup
```bash
# Stop your application first
psql -U username -d database_name < backup_20240110.sql
```

### Option 3: Manual Rollback
```sql
-- Remove new tables
DROP TABLE IF EXISTS "PaymentOrder" CASCADE;
DROP TABLE IF EXISTS "BillingSetting" CASCADE;
DROP TABLE IF EXISTS "RenewalRule" CASCADE;
DROP TABLE IF EXISTS "PaymentAddress" CASCADE;
DROP TABLE IF EXISTS "ScheduledMessage" CASCADE;
DROP TABLE IF EXISTS "ForcedJoinChannel" CASCADE;
DROP TABLE IF EXISTS "UserGroup" CASCADE;

-- Remove new columns from User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
ALTER TABLE "User" DROP COLUMN IF EXISTS "isPaid";
ALTER TABLE "User" DROP COLUMN IF EXISTS "paidExpireAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "isAdmin";
ALTER TABLE "User" DROP COLUMN IF EXISTS "adminExpireAt";

-- Restore default values
ALTER TABLE "User" ALTER COLUMN "canCreateLottery" SET DEFAULT true;
ALTER TABLE "User" ALTER COLUMN "canJoinLottery" SET DEFAULT true;

-- Drop enum
DROP TYPE IF EXISTS "UserRole";
```

## Testing Checklist

After migration, verify:

- [ ] Existing VIP users can still create lotteries
- [ ] Existing VIP users can join lotteries
- [ ] Super admin can access all features
- [ ] New users are created with correct defaults (USER role, no permissions)
- [ ] Payment order creation works
- [ ] Payment confirmation updates user permissions correctly
- [ ] Role-based menu display works in frontend
- [ ] API permission checks work (try accessing admin endpoints as regular user)

## Support

If you encounter issues during migration:

1. Check Prisma logs: `npx prisma db push --verbose`
2. Review database state: `psql -d your_database -c "\d \"User\""`
3. Check application logs for permission errors
4. Verify environment variables are set correctly

## Timeline

Recommended migration timeline:
1. **Day 0**: Review this guide and test on staging/development
2. **Day 1**: Create database backup
3. **Day 2**: Apply migration during low-traffic period
4. **Day 3**: Monitor for issues and adjust as needed
5. **Day 4+**: Configure renewal rules and payment addresses
