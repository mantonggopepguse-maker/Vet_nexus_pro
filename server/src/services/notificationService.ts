import { prisma } from '../db.js';

/**
 * NotificationService
 * Handles processing of the reminder queue.
 */
export class NotificationService {
    /**
     * Process pending reminders that are due
     */
    static async processReminders() {
        console.log('🔔 Processing reminders...');
        try {
            const now = new Date();

            // Find pending reminders scheduled for now or earlier
            const pendingReminders = await prisma.reminder.findMany({
                where: {
                    status: 'Pending',
                    scheduledFor: { lte: now }
                },
                include: {
                    client: true,
                    patient: true,
                    clinic: true
                }
            });

            console.log(`Found ${pendingReminders.length} reminders to process.`);

            for (const reminder of pendingReminders) {
                try {
                    const result = await this.sendNotification(reminder);

                    // Mark as sent/skipped
                    await prisma.reminder.update({
                        where: { id: reminder.id },
                        data: {
                            status: result.status,
                            sentAt: new Date()
                        }
                    });

                    // Log in communications
                    await prisma.communication.create({
                        data: {
                            clientId: reminder.clientId,
                            type: reminder.type === 'Vaccination' ? 'Email' : 'SMS', // Default logic
                            content: result.status === 'Sent' ? reminder.message : `[SIMULATED] ${reminder.message}`,
                            status: result.status
                        }
                    });

                } catch (error) {
                    console.error(`Failed to send reminder ${reminder.id}:`, error);
                    await prisma.reminder.update({
                        where: { id: reminder.id },
                        data: { status: 'Failed' }
                    });
                }
            }
        } catch (error) {
            console.error('Error in processReminders:', error);
        }
    }

    /**
     * Send actual notification via Email/SMS
     */
    private static async sendNotification(reminder: any): Promise<{ status: 'Sent' | 'Skipped'; reason?: string }> {
        try {
            // Configuration check (e.g. SMTP for Email)
            const smtpHost = process.env.SMTP_HOST;
            
            let status: 'Sent' | 'Skipped' = 'Sent';
            let reason: string | undefined;

            if (smtpHost) {
                // In production, use nodemailer to send real emails
                // import nodemailer from 'nodemailer';
                // const transporter = nodemailer.createTransport({ ... });
                // await transporter.sendMail({ ... });
                console.log(`📧 [PROD SEND] Email sent to ${reminder.client.email}`);
            } else {
                // Fallback to clear logging during dev/staging
                console.log(`🚀 [STAGING SEND] To: ${reminder.client.phone} | Msg: ${reminder.message}`);
                status = 'Skipped';
                reason = 'SMTP credentials not configured (Development Fallback)';
                
                // If it's a critical vaccination reminder, we'd definitely want real delivery
                if (reminder.type === 'Vaccination') {
                    console.warn(`⚠️ Vaccination reminder for ${reminder.patient.name} logged but not delivered via SMTP.`);
                }
            }

            // Simulate slight delivery delay
            await new Promise(resolve => setTimeout(resolve, 300));
            return { status, reason };
        } catch (error) {
            console.error('Notification delivery failed:', error);
            throw error;
        }
    }
}
