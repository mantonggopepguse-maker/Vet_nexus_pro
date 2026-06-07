import { google } from 'googleapis';
import { prisma } from '../db.js';
import stream from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export class DriveService {
    private getOAuthClient() {
        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    getAuthUrl(state?: string) {
        const oauth2Client = this.getOAuthClient();
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent', // Force refresh token generation
            state
        });
    }

    async handleCallback(code: string, clinicId: string): Promise<any> {
        const oauth2Client = this.getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        await prisma.clinic.update({
            where: { id: clinicId },
            data: {
                googleDriveAccessToken: tokens.access_token,
                googleDriveRefreshToken: tokens.refresh_token,
            }
        });

        if (tokens.access_token && tokens.refresh_token) {
            await this.ensureClinicFolder(clinicId, tokens.access_token, tokens.refresh_token);
        }

        return tokens;
    }

    async handleClientCallback(code: string, clientId: string): Promise<any> {
        const oauth2Client = this.getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        await prisma.client.update({
            where: { id: clientId },
            data: {
                googleDriveAccessToken: tokens.access_token,
                googleDriveRefreshToken: tokens.refresh_token,
            }
        });

        if (tokens.access_token && tokens.refresh_token) {
            await this.ensureClientFolder(clientId, tokens.access_token, tokens.refresh_token);
        }

        return tokens;
    }

    private async getClient(clinicId: string) {
        const clinic = await prisma.clinic.findUnique({
            where: { id: clinicId },
            select: { googleDriveAccessToken: true, googleDriveRefreshToken: true }
        });

        if (!clinic?.googleDriveRefreshToken) {
            throw new Error('Clinic not connected to Google Drive');
        }

        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({
            access_token: clinic.googleDriveAccessToken,
            refresh_token: clinic.googleDriveRefreshToken
        });

        oauth2Client.on('tokens', async (tokens: any) => {
            if (tokens.access_token) {
                await prisma.clinic.update({
                    where: { id: clinicId },
                    data: { googleDriveAccessToken: tokens.access_token }
                });
            }
        });

        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    private async getClientDriveClient(clientId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { googleDriveAccessToken: true, googleDriveRefreshToken: true }
        });

        if (!client?.googleDriveRefreshToken) {
            throw new Error('Client not connected to Google Drive');
        }

        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({
            access_token: client.googleDriveAccessToken,
            refresh_token: client.googleDriveRefreshToken
        });

        oauth2Client.on('tokens', async (tokens: any) => {
            if (tokens.access_token) {
                await prisma.client.update({
                    where: { id: clientId },
                    data: { googleDriveAccessToken: tokens.access_token }
                });
            }
        });

        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    async ensureClinicFolder(clinicId: string, accessToken: string, refreshToken: string) {
        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });

        if (clinic?.googleDriveFolderId) return clinic.googleDriveFolderId;

        const fileMetadata = {
            name: `VetNexus_Clinic_${clinic?.slug || clinicId}`,
            mimeType: 'application/vnd.google-apps.folder',
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });

        if (file.data.id) {
            await prisma.clinic.update({
                where: { id: clinicId },
                data: { googleDriveFolderId: file.data.id }
            });
            return file.data.id;
        }
        throw new Error('Failed to create Drive folder');
    }

    async ensureClientFolder(clientId: string, accessToken: string, refreshToken: string) {
        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const client = await prisma.client.findUnique({ where: { id: clientId } });

        if (client?.googleDriveFolderId) return client.googleDriveFolderId;

        const fileMetadata = {
            name: `VetNexus_MyPets_${client?.firstName}_${client?.lastName}`,
            mimeType: 'application/vnd.google-apps.folder',
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });

        if (file.data.id) {
            await prisma.client.update({
                where: { id: clientId },
                data: { googleDriveFolderId: file.data.id }
            });
            return file.data.id;
        }
        throw new Error('Failed to create Drive folder');
    }

    async uploadFile(clinicId: string, fileBuffer: Buffer, fileName: string, mimeType: string) {
        const drive = await this.getClient(clinicId);
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });

        if (!clinic?.googleDriveFolderId) throw new Error('Drive folder not initialized');

        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [clinic.googleDriveFolderId],
            },
            media: { mimeType, body: bufferStream },
            fields: 'id, webContentLink, webViewLink, thumbnailLink',
        });

        if (response.data.id) {
            await drive.permissions.create({
                fileId: response.data.id,
                requestBody: { role: 'reader', type: 'anyone' },
            });
        }
        return response.data;
    }

    async uploadClientFile(clientId: string, fileBuffer: Buffer, fileName: string, mimeType: string) {
        const drive = await this.getClientDriveClient(clientId);
        const client = await prisma.client.findUnique({ where: { id: clientId } });

        if (!client?.googleDriveFolderId) throw new Error('Drive folder not initialized');

        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [client.googleDriveFolderId],
            },
            media: { mimeType, body: bufferStream },
            fields: 'id, webContentLink, webViewLink, thumbnailLink',
        });

        if (response.data.id) {
            await drive.permissions.create({
                fileId: response.data.id,
                requestBody: { role: 'reader', type: 'anyone' },
            });
        }
        return response.data;
    }

    async deleteFile(clinicId: string, fileId: string) {
        const drive = await this.getClient(clinicId);
        await drive.files.delete({ fileId: fileId });
    }

    async downloadFile(clinicId: string, fileId: string): Promise<Buffer> {
        const drive = await this.getClient(clinicId);
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );
        return Buffer.from(response.data as ArrayBuffer);
    }
}
export const driveService = new DriveService();
