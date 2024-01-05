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
        await jwtClient.authorize(function (err, result) {
            if (err) {
                console.log(`Error authorizing google jwt client: ${err}`);
                throw new Error(err);
            }
        });
        return jwtClient;
    }
}

export const googleJwtClient = new GoogleJwtClient();
