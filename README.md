# Lottery Bot Management Dashboard

A Next.js application with App Router and Tailwind CSS for managing lottery bot operations.

## Features

- **Responsive Layout**: Fixed sidebar navigation with collapsible menu items
- **Message Templates**: Rich text editor for customizing lottery message templates with placeholder support
- **Lottery Management**: Comprehensive settings interface with three tabs:
  - **Basic Info**: Configure lottery title, media, description, participation methods, and draw settings
  - **Prize Settings**: Manage prizes with add/remove functionality
  - **Notification Settings**: Customize winner, creator, and group notifications

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

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

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Build

Create a production build:

```bash
npm run build
```

### Start Production Server

After building, start the production server:

```bash
npm start
```

## Authentication

The application includes a complete user authentication system:

- **Login/Register**: User registration and login with JWT tokens
- **Protected Routes**: Middleware-based route protection
- **Session Management**: HttpOnly cookies for secure token storage
- **User Roles**: Support for SUPERADMIN and ADMIN roles

### Default Admin Credentials

After setting up the database (see deployment instructions), use these credentials to login:

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password immediately after first login!

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
JWT_SECRET=<generate-a-strong-random-secret-key>
NODE_ENV=production
```

**Generate a secure JWT secret:**
```bash
# Use openssl to generate a random secret
openssl rand -base64 32
```

#### 3. Deploy the Application

1. Connect your GitHub repository to Railway
2. Railway will automatically detect it's a Next.js app
3. The deployment will start automatically

#### 4. Initialize the Database

After the first deployment, you need to set up the database schema and create the default admin user:

**Option A: Using Railway CLI**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Generate Prisma client
railway run npm run db:generate

# Push database schema
railway run npm run db:push

# Create default admin user
railway run npm run db:seed
```

**Option B: Using Railway Dashboard**

1. Go to your Railway project
2. Open the deployed service
3. Click on **"Settings"** → **"Deploy"**
4. Add a **"Custom Start Command"**:
   ```bash
   npx prisma generate && npx prisma db push && npm run build && npm start
   ```
5. For seeding, you may need to run it via Railway Shell:
   - Go to service → "Settings" → "Shell"
   - Run: `npm run db:seed`

#### 5. Access Your Application

1. Get your Railway app URL from the project dashboard
2. Navigate to `your-app-url/login`
3. Login with default credentials (admin/admin123)
4. **Change the default password immediately!**

### Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for JWT token signing | Yes | `your-super-secret-key` |
| `NODE_ENV` | Environment mode | No | `production` |

### Database Maintenance

#### Update Database Schema

When you make changes to `prisma/schema.prisma`:

```bash
railway run npx prisma db push
```

#### View Database

Use Prisma Studio to view and edit data:

```bash
railway run npx prisma studio
```

#### Database Backup

Railway automatically backs up PostgreSQL databases. You can also manually export:

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

### Troubleshooting

**Issue: Database connection fails**
- Verify `DATABASE_URL` is correctly set in Railway environment variables
- Ensure the PostgreSQL addon is running

**Issue: JWT token errors**
- Make sure `JWT_SECRET` is set and is a strong random string
- Clear browser cookies and try logging in again

**Issue: Prisma Client not generated**
- Run `railway run npx prisma generate` manually
- Check that build process includes `prisma generate`

## Local Development with Database

### Setup Local PostgreSQL

1. Install PostgreSQL locally or use Docker:
```bash
docker run --name postgres-yhq -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

2. Create `.env` file (copy from `.env.example`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yhq?schema=public"
JWT_SECRET="your-local-dev-secret-key"
```

3. Initialize database:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4. Run development server:
```bash
npm run dev
```

## Project Structure

```
yhq/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx           # Root layout with sidebar
│   ├── page.tsx             # Home page
│   ├── templates/           # Message templates page
│   ├── settings/            # Lottery management page
│   ├── announcements/       # Placeholder page
│   ├── groups/              # Placeholder page
│   ├── forced-join/         # Placeholder page
│   ├── users/               # Placeholder page
│   └── scheduled/           # Placeholder page
├── components/              # React components
│   └── Sidebar.tsx          # Navigation sidebar
├── public/                  # Static assets
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies
```

## Technologies Used

- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS processing
- **PostgreSQL**: Database (for production)
- **Prisma**: ORM for database operations
- **JWT**: Authentication with JSON Web Tokens
- **bcryptjs**: Password hashing

## Pages

### Message Templates (`/templates`)
- Tab-based interface for different template types
- Rich text editor with formatting toolbar
- Placeholder chips for dynamic content
- Button preview and management

### Lottery Management (`/settings`)
- **Basic Info Tab**: Form inputs for lottery configuration
- **Prize Settings Tab**: Prize list management with modal dialog
- **Notification Settings Tab**: Customizable notification templates

## License

This project is private and proprietary.
