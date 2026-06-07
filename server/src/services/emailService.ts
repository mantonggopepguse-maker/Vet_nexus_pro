import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: (process.env.SMTP_PORT || '465') === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const FROM = `"${process.env.SMTP_FROM_NAME || 'Vet Nexus'}" <${process.env.SMTP_USER}>`;
const EMAIL_SEND_TIMEOUT_MS = 20000;

export interface EmailDeliveryResult {
  delivered: boolean;
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  reason?: string;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailDeliveryResult> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_PASS === 'YOUR_GMAIL_APP_PASSWORD_HERE') {
      console.warn('SMTP credentials not configured or still using a placeholder. Email not sent.');
      console.log(`[DEV FALLBACK] To: ${to} | Subject: ${subject}`);
      return {
        delivered: false,
        status: 'SKIPPED',
        reason: 'SMTP credentials are missing or still set to a placeholder.',
      };
    }

    const sendPromise = transporter.sendMail({ from: FROM, to, subject, html });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Email send timed out after 20s')), EMAIL_SEND_TIMEOUT_MS)
    );

    await Promise.race([sendPromise, timeoutPromise]);
    console.log(`Email sent to ${to}: ${subject}`);
    return { delivered: true, status: 'SENT' };
  } catch (error: any) {
    console.error(`Failed to send email to ${to}:`, error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV FALLBACK] To: ${to} | Subject: ${subject}`);
    }
    return {
      delivered: false,
      status: 'FAILED',
      reason: error?.message || 'Unknown email delivery error',
    };
  }
}

const baseEmailShell = (title: string, subtitle: string, body: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
      <tr><td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${title}</h1>
              <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">${subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">Copyright ${new Date().getFullYear()} Vet Nexus | This is an automated message, please do not reply.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

export async function sendVerificationEmail(to: string, code: string): Promise<EmailDeliveryResult> {
  const body = `
    <p style="color:#374151;font-size:16px;margin:0 0 24px;">Hello,</p>
    <p style="color:#374151;font-size:16px;margin:0 0 32px;">
      Use the verification code below to complete your registration. This code expires in <strong>15 minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 32px;">
      <span style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:12px;padding:20px 48px;font-size:36px;font-weight:800;letter-spacing:12px;color:#1d4ed8;">
        ${code}
      </span>
    </div>
    <p style="color:#6b7280;font-size:14px;margin:0;">
      If you did not create a Vet Nexus account, you can safely ignore this email.
    </p>`;

  return sendEmail(to, 'Your Vet Nexus Verification Code', baseEmailShell('Vet Nexus', 'Verify Your Email Address', body));
}

export async function sendPasswordResetEmail(to: string, name: string, code: string): Promise<EmailDeliveryResult> {
  const body = `
    <p style="color:#374151;font-size:16px;margin:0 0 24px;">Hi ${name},</p>
    <p style="color:#374151;font-size:16px;margin:0 0 32px;">
      We received a request to reset your Vet Nexus password. Use the code below - it expires in <strong>15 minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 32px;">
      <span style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:12px;padding:20px 48px;font-size:36px;font-weight:800;letter-spacing:12px;color:#1d4ed8;">
        ${code}
      </span>
    </div>
    <p style="color:#6b7280;font-size:14px;margin:0 0 16px;">
      If you did not request a password reset, please ignore this email - your account is safe.
    </p>
    <p style="color:#6b7280;font-size:14px;margin:0;">
      For security, this code can only be used once.
    </p>`;

  return sendEmail(to, 'Your Vet Nexus Password Reset Code', baseEmailShell('Vet Nexus', 'Password Reset Request', body));
}

export async function sendPortalInviteEmail(params: {
  to: string;
  clientName: string;
  clinicName: string;
  inviteLink: string;
  expiresAt: Date;
}): Promise<EmailDeliveryResult> {
  const { to, clientName, clinicName, inviteLink, expiresAt } = params;
  const expiryLabel = expiresAt.toLocaleString();

  const body = `
    <p style="color:#374151;font-size:16px;margin:0 0 18px;">Hello ${clientName},</p>
    <p style="color:#374151;font-size:16px;margin:0 0 24px;">
      ${clinicName} invited you to activate your client portal access.
    </p>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
      Use the secure button below to set your password and complete setup.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${inviteLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;">
        Activate Client Portal
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;word-break:break-word;margin:0 0 16px;">
      If the button does not open, copy and paste this link: ${inviteLink}
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:0;">
      This invitation expires on ${expiryLabel}.
    </p>`;

  return sendEmail(to, `${clinicName} invited you to the client portal`, baseEmailShell('Vet Nexus Client Portal', `Secure invitation from ${clinicName}`, body));
}

export async function sendPortalCredentialsEmail(params: {
  to: string;
  clientName: string;
  clinicName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}): Promise<EmailDeliveryResult> {
  const { to, clientName, clinicName, email, temporaryPassword, loginUrl } = params;
  const body = `
    <p style="color:#374151;font-size:16px;margin:0 0 18px;">Hello ${clientName},</p>
    <p style="color:#374151;font-size:16px;margin:0 0 24px;">
      ${clinicName} created client portal login details for you.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
      <p style="color:#6b7280;font-size:13px;margin:0;"><strong>Temporary password:</strong> ${temporaryPassword}</p>
    </div>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
      You will be asked to change this password after signing in.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;">
        Sign In to Client Portal
      </a>
    </div>`;

  return sendEmail(to, `${clinicName} client portal login details`, baseEmailShell('Vet Nexus Client Portal', `Login details from ${clinicName}`, body));
}
