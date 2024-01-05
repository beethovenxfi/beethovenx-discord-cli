import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export class GoogleJwtClient {
    public async getAuthorizedSheetsClient(user: string, privateKey: string): Promise<JWT> {
        const jwtClient = new google.auth.JWT(
            user,
            undefined,
            privateKey,
            'https://www.googleapis.com/auth/spreadsheets',
        );
        await jwtClient.authorize();
        return jwtClient;
    }
}

export const googleJwtClient = new GoogleJwtClient();
