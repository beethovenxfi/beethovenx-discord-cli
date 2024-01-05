import path from 'path';
import fs, { unlink } from 'fs';
import { google } from 'googleapis';
import moment from 'moment';
import { parseUnits } from 'ethers/lib/utils';
import { googleJwtClient } from '../client/google-jwt-client';
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

export async function scheduleOpFarmsReminder() {
    console.log('scheduling op farms reminder...');
    await opFarmsReminder();
    setInterval(opFarmsReminder, 43200000); // every 12 hrs
}

export async function opFarmsReminder(): Promise<void> {
    const now = moment();
    if (!(now.day() === 3 && now.hour() < 11)) {
        return;
    }

    let jwtClient;
    let authError: boolean = false;

    jwtClient = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL!,
        undefined,
        process.env.GOOGLE_CLIENT_PRIVATE_KEY!,
        'https://www.googleapis.com/auth/spreadsheets',
    );
    await jwtClient.authorize(function (err, result) {
        if (err) {
            console.log(`Error authorizing google jwt client: ${err}`);
            authError = true;
        }
    });

    console.log(`authError: ${authError}`);
    if (authError) {
        console.log(`Could not get google sheet credentials.`);
        await sendMessage(
            ChannelId.MULTISIG_TX,
            'SOMETHING WENT WRONG WITH OP FARMS! Could not get google sheet credentials',
        );
        return;
    }

    try {
        const file = fs.readdirSync(process.cwd()).find((fn) => fn.startsWith('transaction'));

        // remove the old transaction json file
        if (file) {
            unlink(path.join(process.cwd(), file), (err) => {
                if (err) {
                    console.log(`Could not delete file: Error ${err}`);
                    return;
                }
                console.log(`${file} was deleted`);
            });
        }
    } catch (e) {
        console.log(`Could not get or delete stored json file. Error: ${e}`);
        await sendMessage(
            ChannelId.MULTISIG_TX,
            'SOMETHING WENT WRONG WITH OP FARMS! Could not get or delete stored json file',
        );
        return;
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
        await sendMessage(ChannelId.MULTISIG_TX, 'SOMETHING WENT WRONG WITH OP FARMS! Could not get google sheet.');
        console.log(`Could not find any sheets! Error: ${e}`);
        return;
    }

    const sheetsWithEpoch = result.data.sheets?.filter((sheet) => sheet.properties?.title?.includes('Epoch'));
    const sheetNames = sheetsWithEpoch?.map((sheet) => sheet.properties?.title);

    sheetNames?.forEach(async (name) => {
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${name}${sheetRange}`,
            valueRenderOption: 'UNFORMATTED_VALUE',
        });

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
            await sendMessage(
                ChannelId.MULTISIG_TX,
                'SOMETHING WENT WRONG WITH OP FARMS!! Did not find data in the google sheet',
            );
            console.log('No data found.');
        }
    });
}
