import path from 'path';
import fs, { unlink } from 'fs';
import { google } from 'googleapis';
import moment from 'moment';
import { parseUnits } from 'ethers/lib/utils';
import { googleJwtClient } from '../client/google-jwt-client';
import { JWT } from 'google-auth-library';
import { ChannelId, sendMessage } from '../interactions/send-message';

interface SafeTransactionBatch {
    version: string;
    chainId: string;
    createdAt: number;
    meta: Meta;
    transactions: Transaction[];
}

interface Meta {
    name: string;
    description: string;
    txBuilderVersion: string;
    createdFromSafeAddress: string;
    createdFromOwnerAddress: string;
    checksum: string;
}

interface Transaction {
    to: string;
    value: string;
    data: any;
    contractMethod: ContractMethod;
    contractInputsValues: ContractInputsValues;
}

interface ContractMethod {
    inputs: Input[];
    name: string;
    payable: boolean;
}

interface Input {
    name: string;
    type: string;
    internalType?: string;
}

export interface ContractInputsValues {
    spender?: string;
    amount?: string;
    _reward_token?: string;
    _amount?: string;
}

type GoogleSheetCredentials = {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
};

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export async function scheduleOpFarmsReminder() {
    console.log('scheduling op farms reminder...');
    await opFarmsReminder();
    setInterval(opFarmsReminder, 604800000);
}

export async function opFarmsReminder(): Promise<void> {
    let credentials: GoogleSheetCredentials;
    let jwtClient: JWT;

    if (fs.existsSync(CREDENTIALS_PATH)) {
        credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
        jwtClient = await googleJwtClient.getAuthorizedSheetsClient(credentials.client_email, credentials.private_key);
    } else {
        throw Error('Could not find credentials file.');
    }

    var file = fs.readdirSync(process.cwd()).find((fn) => fn.startsWith('transaction'));

    // remove the old transaction json file
    if (file) {
        unlink(path.join(process.cwd(), file), (err) => {
            if (err) throw err;
            console.log(`${file} was deleted`);
        });
    }

    createJsonOutput(jwtClient, '1rhIgAvr0BQ2EPATqGyisiQEV0XFVMqmGgDuVpO9-inU', '!A:G');
}

async function createJsonOutput(auth: any, sheetId: string, sheetRange: string): Promise<void> {
    const sheets = google.sheets({ version: 'v4', auth });

    let result;
    try {
        result = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
        });
    } catch (e) {
        await sendMessage(ChannelId.MULTISIG_TX, {
            content: '@here SOMETHING WENT WRONG WITH OP FARMS!!',
        });
        throw Error('Could not find sheet name provided.');
    }

    const sheetsWithEpoch = result.data.sheets?.filter((sheet) => sheet.properties?.title?.includes('Epoch'));
    const sheetNames = sheetsWithEpoch?.map((sheet) => sheet.properties?.title);

    sheetNames?.forEach(async (name) => {
        let result;
        try {
            result = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${name}${sheetRange}`,
                valueRenderOption: 'UNFORMATTED_VALUE',
            });
        } catch (e) {
            throw Error('Could not find sheet name provided.');
        }
        const rows = result.data.values;

        if (rows?.length) {
            let gaugeTxns: Transaction[] = [];
            let canProcess = false;
            let fileName: string;
            let attachment;

            for (const row of rows) {
                if (!canProcess) {
                    canProcess = row[0] === 'Pool name';
                    continue;
                }
                const gaugeAddress: string = row[1];
                const rewardTokenAddress: string = row[3];
                const rewardTokenDecimals: number = row[4];
                const rewardTokenAmount: number = row[5];
                const epochStart: string = row[6];

                const epochStartTimestamp = moment(epochStart, 'MM/DD/YYYY').endOf('day').unix();
                const now = moment().unix();

                //if (now < epochStartTimestamp && now + 172800 > epochStartTimestamp) {
                if (now < epochStartTimestamp && now + 604800 > epochStartTimestamp) {
                    const rewardTokenAmountScaled = parseUnits(`${rewardTokenAmount}`, rewardTokenDecimals);

                    // add the approve transaction
                    gaugeTxns.push({
                        to: rewardTokenAddress,
                        value: '0',
                        data: null,
                        contractMethod: {
                            inputs: [
                                {
                                    internalType: 'address',
                                    name: 'spender',
                                    type: 'address',
                                },
                                {
                                    internalType: 'uint256',
                                    name: 'amount',
                                    type: 'uint256',
                                },
                            ],
                            name: 'approve',
                            payable: false,
                        },
                        contractInputsValues: {
                            spender: gaugeAddress,
                            amount: rewardTokenAmountScaled.toString(),
                        },
                    });

                    // add deposit_reward_token transaction
                    gaugeTxns.push({
                        to: gaugeAddress,
                        value: '0',
                        data: null,
                        contractMethod: {
                            inputs: [
                                {
                                    name: '_reward_token',
                                    type: 'address',
                                },
                                {
                                    name: '_amount',
                                    type: 'uint256',
                                },
                            ],
                            name: 'deposit_reward_token',
                            payable: false,
                        },
                        contractInputsValues: {
                            _reward_token: rewardTokenAddress,
                            _amount: rewardTokenAmountScaled.toString(),
                        },
                    });
                }
            }

            if (gaugeTxns.length > 0) {
                const transactionBatch: SafeTransactionBatch = {
                    version: '1.0',
                    chainId: '10',
                    createdAt: 1678892613523,
                    meta: {
                        name: 'Transactions Batch',
                        description: '',
                        txBuilderVersion: '1.13.3',
                        createdFromSafeAddress: '0x2a185C8A3C63d7bFe63aD5d950244FFe9d0a4b60',
                        createdFromOwnerAddress: '',
                        checksum: '0x5b857aee1f57636d022fbb0b9a7bc765a6de68875ed045c36dd1011ce10aabac',
                    },
                    transactions: gaugeTxns,
                };

                fileName = `transactionBatch_${new Date().getTime()}.json`;

                fs.writeFileSync(fileName, JSON.stringify(transactionBatch, null, 2));
                attachment = fs.readFileSync(fileName);

                await sendMessage(ChannelId.MULTISIG_TX, {
                    content: '@here OP farms:',
                    files: [attachment],
                });
            }
        } else {
            await sendMessage(ChannelId.MULTISIG_TX, {
                content: '@here SOMETHING WENT WRONG WITH OP FARMS!!',
            });
            throw new Error('No data found.');
        }
    });
}
