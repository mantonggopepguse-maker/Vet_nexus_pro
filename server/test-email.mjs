import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'drmantonggopep@gmail.com',
        pass: 'kwqekqqwqypkulf',
    },
});

async function test() {
    console.log('Testing SMTP with Gmail App Password...');
    try {
        await transporter.verify();
        console.log('✅ SMTP verification successful!');

        const info = await transporter.sendMail({
            from: '"Purple Vets Test" <drmantonggopep@gmail.com>',
            to: 'drmantonggopep@gmail.com',
            subject: 'Purple Vets SMTP Test',
            text: 'This is a test email to verify SMTP configuration.',
            html: '<b>This is a test email to verify SMTP configuration.</b>',
        });
        console.log('✅ Message sent: %s', info.messageId);
    } catch (error) {
        console.error('❌ SMTP Error:', error);
    }
}

test();
