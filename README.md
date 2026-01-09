# Lottery Bot Management Dashboard

A Next.js application with App Router and Tailwind CSS for managing lottery bot operations via Telegram WebApp.

## Features

- **Telegram WebApp Authentication**: Secure authentication using Telegram Bot WebApp
- **Admin Management**: Super admin can add/remove administrators
- **Responsive Layout**: Fixed sidebar navigation with collapsible menu items
- **Message Templates**: Rich text editor for customizing lottery message templates with placeholder support
- **Lottery Management**: Comprehensive settings interface with three tabs:
  - **Basic Info**: Configure lottery title, media, description, participation methods, and draw settings
  - **Prize Settings**: Manage prizes with add/remove functionality
  - **Notification Settings**: Customize winner, creator, and group notifications

## Authentication

The application uses **Telegram WebApp** for authentication:

- **No username/password**: Authentication is handled through Telegram
- **Bot Commands**: Access the admin panel through Telegram bot commands
- **Role-based Access**: Support for SUPERADMIN and ADMIN roles
- **Secure**: Uses Telegram's WebApp initData validation

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- A Telegram Bot (created via [@BotFather](https://t.me/botfather))
- PostgreSQL database

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Szchiji/yhq.git
cd yhq
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see [Environment Variables](#environment-variables) section)

4. Initialize the database:
```bash
npm run db:generate
npm run db:push
```

5. Run the development server:
```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/yhq?schema=public` |
| `BOT_TOKEN` | Telegram Bot Token from @BotFather | `123456:ABC-DEF...` |
| `SUPER_ADMIN_ID` | Your Telegram User ID (numeric) | `123456789` |
| `WEBAPP_URL` | WebApp access URL | `https://your-domain.railway.app` |

### Getting Your Telegram User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your user ID
3. Use this ID as `SUPER_ADMIN_ID`

### Creating a Telegram Bot

1. Open [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token and set it as `BOT_TOKEN`
4. Set bot commands:
   ```
   /bot - Open admin panel
   /new - Create new lottery
   /newinvite - Create invite lottery
   /mylottery - View my lotteries
   ```

## Railway Deployment

### Prerequisites

1. A [Railway](https://railway.app) account
2. Your GitHub repository connected to Railway

### Deployment Steps

#### 1. Create a PostgreSQL Database

1. Go to your Railway project dashboard
2. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically provision a PostgreSQL database
4. Copy the `DATABASE_URL` from the database settings

#### 2. Configure Environment Variables

In your Railway project settings, add the following environment variables:

```env
DATABASE_URL=<your-postgresql-connection-string>
BOT_TOKEN=<your-telegram-bot-token>
SUPER_ADMIN_ID=<your-telegram-user-id>
WEBAPP_URL=<your-railway-app-url>
NODE_ENV=production
```

#### 3. Deploy the Application

1. Connect your GitHub repository to Railway
2. Railway will automatically detect it's a Next.js app
3. The deployment will start automatically

#### 4. Initialize the Database

After the first deployment, initialize the database schema:

**Option A: Using Railway CLI**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Generate Prisma client and push schema
railway run npm run db:generate
railway run npm run db:push
```

**Option B: Using Railway Dashboard**

1. Go to your Railway project
2. Open the deployed service
3. Click on **"Settings"** → **"Deploy"**
4. Add a **"Custom Start Command"**:
   ```bash
   npx prisma generate && npx prisma db push && npm run build && npm start
   ```

#### 5. Set Up Telegram Bot Webhook

After deployment, set the webhook URL for your bot:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.railway.app/api/telegram/webhook"}'
```

Replace `<BOT_TOKEN>` with your bot token and `your-domain.railway.app` with your Railway URL.

#### 6. Access Your Application

1. Open Telegram and message your bot
2. Send `/bot` command
3. Click the "打开后台管理" button
4. The Telegram WebApp will open with the admin panel

### Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `BOT_TOKEN` | Telegram Bot Token | Yes | `123456:ABC-DEF...` |
| `SUPER_ADMIN_ID` | Super Admin Telegram ID | Yes | `123456789` |
| `WEBAPP_URL` | WebApp URL | Yes | `https://xxx.railway.app` |
| `NODE_ENV` | Environment mode | No | `production` |

## Usage

### Accessing the Admin Panel

1. Open Telegram and find your bot
2. Send `/bot` command (only works for super admin and admins)
3. Click the WebApp button to open the admin panel

### Managing Admins (Super Admin Only)

1. Open the admin panel via `/bot` command
2. Navigate to "管理员设置" (Admin Settings)
3. Click "+ 添加管理员" to add a new admin
4. Enter the Telegram ID of the user you want to add as admin

### Bot Commands

- `/bot` - Open admin panel (admin/super admin only)
- `/new` - Create a new lottery (admin/super admin only)
- `/newinvite` - Create invite lottery link (admin/super admin only)
- `/mylottery` - View my lottery list (admin/super admin only)

## Database Maintenance

### Update Database Schema

When you make changes to `prisma/schema.prisma`:

```bash
railway run npx prisma db push
```

### View Database

Use Prisma Studio to view and edit data:

```bash
railway run npx prisma studio
```

### Database Backup

Railway automatically backs up PostgreSQL databases. You can also manually export:

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

## Troubleshooting

**Issue: Database connection fails**
- Verify `DATABASE_URL` is correctly set in Railway environment variables
- Ensure the PostgreSQL addon is running

**Issue: Bot webhook not working**
- Verify `BOT_TOKEN` is correct
- Check that webhook URL is set correctly
- Ensure the webhook endpoint is accessible from the internet

**Issue: Authentication fails**
- Make sure `BOT_TOKEN` matches the bot you're using
- Verify `SUPER_ADMIN_ID` is your correct Telegram user ID
- Check browser console for errors

**Issue: Prisma Client not generated**
- Run `railway run npx prisma generate` manually
- Check that build process includes `prisma generate`

## Local Development

### Setup Local PostgreSQL

1. Install PostgreSQL locally or use Docker:
```bash
docker run --name postgres-yhq -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

2. Create `.env` file (copy from `.env.example`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yhq?schema=public"
BOT_TOKEN="your-telegram-bot-token"
SUPER_ADMIN_ID="your-telegram-user-id"
WEBAPP_URL="http://localhost:3000"
```

3. Initialize database:
```bash
npm run db:generate
npm run db:push
```

4. For local development with Telegram WebApp, you'll need to:
   - Use a tunneling service like [ngrok](https://ngrok.com/) to expose your local server
   - Set the webhook to your ngrok URL
   - Update `WEBAPP_URL` to your ngrok URL

5. Run development server:
```bash
npm run dev
```

## Project Structure

```
yhq/
├── app/                      # Next.js App Router pages
│   ├── api/                 # API routes
│   │   ├── telegram/        # Telegram webhook handler
│   │   ├── auth/            # Authentication endpoints
│   │   └── admins/          # Admin management API
│   ├── layout.tsx           # Root layout with Telegram WebApp script
│   ├── page.tsx             # Home page with AuthGuard
│   ├── templates/           # Message templates page
│   ├── lottery/             # Lottery management pages
│   ├── users/               # User management
│   ├── admins/              # Admin settings (super admin only)
│   └── ...                  # Other pages
├── components/              # React components
│   ├── Sidebar.tsx          # Navigation sidebar with Telegram user info
│   ├── AuthGuard.tsx        # Authentication protection component
│   └── ...                  # Other components
├── hooks/                   # Custom React hooks
│   └── useTelegramWebApp.ts # Telegram WebApp integration hook
├── lib/                     # Utility libraries
│   ├── telegram.ts          # Telegram Bot API utilities
│   └── prisma.ts            # Prisma client
├── prisma/                  # Database schema
│   └── schema.prisma        # Prisma schema with Admin and User models
└── middleware.ts            # Next.js middleware (simplified for WebApp)
```

## Technologies Used

- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **PostgreSQL**: Database (for production)
- **Prisma**: ORM for database operations
- **Telegram Bot API**: Authentication and bot commands
- **Telegram WebApp**: Secure WebApp platform

## Security

- All authentication is handled through Telegram's secure WebApp platform
- InitData signature validation ensures requests come from Telegram
- Super admin can only be set via environment variable
- Admin management is restricted to super admin only
- No passwords or sensitive data stored in the application

## License

This project is private and proprietary.
## Security

- All authentication is handled through Telegram's secure WebApp platform
- InitData signature validation ensures requests come from Telegram
- Super admin can only be set via environment variable
- Admin management is restricted to super admin only
- No passwords or sensitive data stored in the application

## License

This project is private and proprietary.
