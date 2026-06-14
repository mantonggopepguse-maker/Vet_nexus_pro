// CRITICAL: Load environment variables FIRST, before any imports that might use them
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { prisma } from './db.js';
import rateLimit from 'express-rate-limit';

// Rate Limiters
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per 15 mins (generous for SPA)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit login attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' }
});

// Import routes
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import patientRoutes from './routes/patients.js';
import inventoryRoutes from './routes/inventory.js';
import procedureRoutes from './routes/procedures.js';
import treatmentRoutes from './routes/treatments.js';
import salesRoutes from './routes/sales.js';
import settingsRoutes from './routes/settings.js';
import auditRoutes from './routes/audit.js';
import superadminRoutes from './routes/superadmin.js';
import driveRoutes from './routes/drive.js';
import appointmentRoutes from './routes/appointments.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';
import expenseRoutes from './routes/expenses.js';
import aiImagingRoutes from './routes/ai-imaging.js';
import clientAuthRoutes from './routes/clientAuth.js';
import reportsRoutes from './routes/reports.js';
import portalRoutes from './routes/portal.js';
import consentRoutes from './routes/consent.js';
import subscriptionRoutes from './routes/subscription.js';
import searchRoutes from './routes/search.js';
import vaccinationRoutes from './routes/vaccinations.js';
import reminderRoutes from './routes/reminders.js';
import profileRoutes from './routes/profile.js';
import reconciliationRoutes from './routes/reconciliation.js';
import aiScribeRoutes from './routes/ai-scribe.js';
import aiActivityRoutes from './routes/ai-activity.js';
import aiClientRoutes from './routes/ai-client.js';
import aiOperationsRoutes from './routes/ai-operations.js';
import aiDiagnosticRoutes from './routes/ai-diagnostic.js';
import triggerRemindersRoutes from './routes/trigger-reminders.js';
import triggerCleanupRoutes from './routes/trigger-cleanup.js';
import hospitalizationRoutes from './routes/hospitalization.js';
import labRoutes from './routes/labs.js';
import shiftRoutes from './routes/shifts.js';
import branchRoutes from './routes/branches.js';
import triageRoutes from './routes/triage.js';
import surgeryRoutes from './routes/surgery.js';
import narcoticsRoutes from './routes/narcotics.js';
import referralRoutes from './routes/referrals.js';
import departmentsRouter from './routes/departments.js';
import queueRouter from './routes/queue.js';
import financialRoutes from './routes/financials.js';
import firebaseRoutes from './routes/firebase.js';
import { initializeSubscriptionPlans } from './services/subscriptionService.js';
import { NotificationService } from './services/notificationService.js';

import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Initialize Express app
const app = express();
const PORT = Number(process.env.PORT) || 8080;
const defaultAllowedOrigins = [
    'https://vetnexus-180033031286.us-central1.run.app',
    'https://purplevets.vetnexuspro.com',
    'https://app.vetnexuspro.com',
    'https://vetnexuspro.com',
    'https://www.vetnexuspro.com',
    'http://localhost:3000',
    'http://localhost:5173',
];
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const allowedOrigins = configuredAllowedOrigins.length > 0
    ? configuredAllowedOrigins
    : defaultAllowedOrigins;

// Enable 'trust proxy' for Cloud Run / Rate Limiting
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the React app
const frontendPath = path.join(__dirname, '../../dist');
app.use(express.static(frontendPath, {
    maxAge: '1d', // Cache static assets for 1 day to reduce Cloud Run requests
    etag: false
}));

// Request logging middleware (Development only to save Cloud Logging costs)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate Limiting
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/vaccinations', vaccinationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/ai-scribe', aiScribeRoutes);
app.use('/api/ai-activity', aiActivityRoutes);
app.use('/api/ai-client', aiClientRoutes);
app.use('/api/ai-operations', aiOperationsRoutes);
app.use('/api/ai-diagnostic', aiDiagnosticRoutes);
app.use('/api/ai-imaging', aiImagingRoutes);
app.use('/api/trigger-reminders', triggerRemindersRoutes);
app.use('/api/trigger-cleanup', triggerCleanupRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/auth/client', clientAuthRoutes);
app.use('/api/hospitalization', hospitalizationRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/surgeries', surgeryRoutes);
app.use('/api/narcotics', narcoticsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/departments', departmentsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/financials', financialRoutes);
app.use('/api/firebase', firebaseRoutes);

// Initialize subscription plans on startup
initializeSubscriptionPlans().catch(console.error);

// Note: Reminder processing has been moved to a dedicated Cloud Scheduler endpoint
// to reduce Cloud Run costs by allowing instances to scale to zero.
// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// Fallback to React app for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
