# Quick Setup Guide for Vet Nexus

## 🚀 Quick Start

### Step 1: Backend Setup (Supabase Connected)

The backend is configured to use Supabase.

1. **Verify Environment Variables**:
   Check `server/.env` contains your Supabase credentials:
   ```env
   DATABASE_URL="postgresql://postgres.suzggpvxwzxovdhwrmeu:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.suzggpvxwzxovdhwrmeu:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
   ```

2. **Install Dependencies**:
   ```powershell
   cd server
   npm install
   ```

3. **Push Schema to DB**:
   ```powershell
   npx prisma db push
   ```

4. **Seed Database**:
   ```powershell
   npm run prisma:seed
   ```

5. **Start Backend**:
   ```powershell
   npm run dev
   ```

### Step 2: Frontend Setup

1. **Install Dependencies**:
   ```powershell
   cd ..
   npm install
   ```

2. **Start Frontend**:
   ```powershell
   npm run dev
   ```

## 🔑 Default Login

- **Email:** admin@vetnexus.com
- **Password:** admin123

## 🔄 Configuration

- **API Service**: The frontend now communicates with the backend via `src/services/apiService.ts`.
- **Database**: Prisma configured for Supabase connection pooling.

## 🐛 Troubleshooting

- **Supabase Connection**: If `db push` fails, try `npx prisma db push --accept-data-loss`.
- **Backend Startup**: If modules are missing, ensure `npm install` completed successfully in the `server` directory.
