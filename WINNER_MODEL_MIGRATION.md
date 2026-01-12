# Winner Model Migration

## Changes Made

The `Winner` model has been updated to support prize claim tracking and better user relations:

### New Fields Added:
- `userId` (String?, optional) - References the User model for better data relations
- `user` (User?, optional relation) - Relation to User model
- `prize` (Prize, required relation) - Relation to Prize model
- `claimed` (Boolean, default: false) - Whether the prize has been claimed
- `claimedAt` (DateTime?, optional) - When the prize was claimed
- `createdAt` (DateTime, default: now()) - Record creation timestamp
- `updatedAt` (DateTime, auto-updated) - Record update timestamp

### Relations Updated:
- Added `winners` relation to `User` model
- Added `winners` relation to `Prize` model

## Migration Instructions

After pulling these changes, you need to apply the schema changes to your database:

```bash
# Push schema changes to database
npm run db:push

# Or if using prisma directly
npx prisma db push
```

**Warning:** Using `prisma db push` will modify your database schema without creating a migration file. This is suitable for development but for production, consider using `prisma migrate` if you need versioned migrations.

## Notes

- Existing `Winner` records will have `claimed = false` by default
- The `userId` field is optional to maintain compatibility with existing records that only have `telegramId`
- The `user` relation uses `SetNull` on delete, meaning if a user is deleted, their winner records remain but the user reference is nullified
