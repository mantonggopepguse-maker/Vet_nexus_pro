# Vet Nexus - Full Stack Veterinary Clinic Management System

A comprehensive clinic management system for veterinary practices built with React, TypeScript, Node.js, Express, Prisma, and PostgreSQL.

## Project Structure

```
Vet Nexus/
├── src/                    # Frontend React application
│   ├── components/
│   │   ├── views/         # Page components
│   │   ├── forms/         # Form components
│   │   └── shared/        # Reusable components
│   ├── services/          # API services
│   ├── types/             # TypeScript type definitions
│   ├── App.tsx            # Main app component
│   └── index.tsx          # Entry point
├── server/                # Backend Node.js/Express API
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── middleware/    # Express middleware
│   │   └── index.ts       # Server entry point
│   └── prisma/
│       ├── schema.prisma  # Database schema
│       └── seed.ts        # Database seeding
├── index.html             # HTML entry point
├── vite.config.ts         # Vite configuration
└── package.json           # Frontend dependencies
```

## Features

### Frontend
- 🎨 Modern, responsive UI with Tailwind CSS
- 📊 Dashboard with key metrics
- 👥 Client & Patient Management
- 💊 Inventory Management with barcode scanning
- 🏥 Treatment Records & Medical Notes
- 💰 Point of Sale (POS) System
- 📋 Procedure Templates
- ⚙️ Clinic Settings
- 🔐 Authentication & Authorization

### Backend
- 🔒 JWT-based authentication
- 📝 RESTful API
- 🗄️ PostgreSQL database with Prisma ORM
- ✅ Input validation with Zod
- 📊 Audit logging
- 🔄 Real-time data synchronization

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:5173`

### Backend Setup

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials and settings.

4. **Set up database:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   npm run prisma:seed
   ```

5. **Start backend server:**
   ```bash
   npm run dev
   ```

The backend will run on `http://localhost:5000`

## Default Login Credentials

After seeding the database:
- **Email:** admin@vetnexus.com
- **Password:** admin123

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (icons)
- Recharts (charts)
- Google Gemini AI (image analysis)

### Backend
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Zod Validation
- bcryptjs

## API Documentation

See [server/README.md](server/README.md) for detailed API documentation.

## Development

### Frontend Commands
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Commands
```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build TypeScript
npm start                # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:seed      # Seed database
```

## License

MIT

## Support

For support, email contact@vetnexus.com
