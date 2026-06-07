# Vet Nexus Backend API

Backend server for the Vet Nexus Clinic Management System built with Node.js, Express, Prisma, and PostgreSQL.

## Features

- 🔐 JWT Authentication & Authorization
- 👥 User & Staff Management
- 🐾 Client & Patient Management
- 💊 Inventory Management with Stock Tracking
- 🏥 Treatment Records & Procedures
- 💰 Point of Sale (POS) System
- 📊 Audit Logging
- ⚙️ Clinic Settings Management

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and update:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `JWT_SECRET` - A secure random string
   - `ALLOWED_ORIGINS` - Frontend URLs (comma-separated)

3. **Set up the database:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Seed the database (optional):**
   ```bash
   npm run prisma:seed
   ```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## Production

Build and start the production server:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get single client
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get single patient
- `POST /api/patients` - Create patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Inventory
- `GET /api/inventory` - Get all items
- `GET /api/inventory/:id` - Get single item
- `POST /api/inventory` - Create item
- `PUT /api/inventory/:id` - Update item
- `POST /api/inventory/batch` - Add stock batch
- `DELETE /api/inventory/:id` - Delete item

### Procedures
- `GET /api/procedures` - Get all procedures
- `GET /api/procedures/:id` - Get single procedure
- `POST /api/procedures` - Create procedure
- `PUT /api/procedures/:id` - Update procedure
- `DELETE /api/procedures/:id` - Delete procedure

### Treatments
- `GET /api/treatments` - Get all treatments
- `GET /api/treatments/:id` - Get single treatment
- `POST /api/treatments` - Create treatment
- `PUT /api/treatments/:id` - Update treatment
- `DELETE /api/treatments/:id` - Delete treatment

### Sales
- `GET /api/sales` - Get all sales
- `GET /api/sales/:id` - Get single sale
- `POST /api/sales` - Create sale
- `DELETE /api/sales/:id` - Delete sale

### Settings
- `GET /api/settings` - Get clinic settings
- `PUT /api/settings` - Update clinic settings

### Audit Logs
- `GET /api/audit` - Get audit logs
- `POST /api/audit` - Create audit log

## Database Management

View database in Prisma Studio:
```bash
npm run prisma:studio
```

Create a new migration:
```bash
npm run prisma:migrate
```

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT
- **Validation:** Zod
- **TypeScript:** Full type safety

## License

MIT
