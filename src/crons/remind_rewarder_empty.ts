import { ethers } from 'hardhat';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { inlineCode } from '@discordjs/builders';
import fs from 'fs';
import path from 'path';
import { ERC20 } from '../../masterchef-types';
import { TimeBasedMasterChefRewarder } from '../../masterchef-types/TimeBasedMasterChefRewarder';
import moment from 'moment';
import { TimeBasedMasterChefMultiTokenRewarder } from '../../masterchef-types/TimeBasedMasterChefMultiTokenRewarder';
import { formatFixed } from '@ethersproject/bignumber';
import axios from 'axios';
import { parseUnits } from 'ethers/lib/utils';

export async function notifiyEmptyRewarders() {
    console.log('Schedule checking for empty rewarders');
    await checkEmptyRewarders();
    setInterval(checkEmptyRewarders, 43200000);
}

async function checkEmptyRewarders() {
    console.log('checking for empty rewarders');

    try {
        const rewarders: string[] = JSON.parse(
            fs.readFileSync(path.join(__dirname, `../../.rewarder/rewarder-list.json`), 'utf-8'),
        );
        console.log('Checking rewarders: ', rewarders.toString());
        for (let rewarderAddress of rewarders) {
            try {
                await checkSingleTokenRewarder(rewarderAddress);
            } catch (e) {
                // check if it's a multitoken rewarder
                console.log(`SingleTokenRewarder check failed: ${rewarderAddress}`);
                try {
                    await checkMultiTokenRewarder(rewarderAddress);
                } catch (e) {
                    console.log('error checking for empty rewarders', e);
                }
            }
        }
    } catch (error) {
        console.log('error checking for empty rewarders', error);
    }
}

async function checkSingleTokenRewarder(rewarderAddress: string) {
    const rewarder = (await ethers.getContractAt(
        'TimeBasedMasterChefRewarder',
        rewarderAddress,
    )) as TimeBasedMasterChefRewarder;

    const rewardToken = await rewarder.rewardToken();
    const erc20 = (await ethers.getContractAt('ERC20', rewardToken)) as ERC20;
    const balance = await erc20.balanceOf(rewarder.address);
    const decimals = await erc20.decimals();
    const rewardPerSecond = await rewarder.rewardPerSecond();
    if (rewardPerSecond.eq(0)) {
        return;
    }

    const farmId = await rewarder.masterchefPoolIds('0');

    const currentBlock = await ethers.provider.getBlock('latest');

    const farmUsers = await axios.post<{
        data: { users: [{ address: string }] };
    }>('https://api.thegraph.com/subgraphs/name/beethovenxfi/masterchefv2', {
        query: `{
                    users(where: {pool: ${farmId}}){
                        address
                    }
                }`,
    });

    let totalPending = parseUnits('0');

    for (const user of farmUsers.data.data.users) {
        const pendingTokens = await rewarder.pendingToken(parseFloat(`${farmId}`), user.address, {
            blockTag: currentBlock.number,
        });
        totalPending = totalPending.add(pendingTokens);
    }

    const totalLeft = balance.sub(totalPending);
    const secondsLeft = totalLeft.div(rewardPerSecond);

    const runOutTime = currentBlock.timestamp + parseFloat(`${secondsLeft}`);
    const runOutMoment = moment.unix(runOutTime).utc();

    const seconds = balance.div(rewardPerSecond);
    if (moment().utc().unix > runOutMoment.unix) {
        await sendMessage(
            ChannelId.MULTISIG_TX,
            `@here Rewarder ${inlineCode(rewarderAddress)} is empty! Ran out at ${runOutMoment.toISOString()}
`,
        );
    } else {
        const days = runOutMoment.diff(moment(), 'days');
        if (days < 5) {
            await sendMessage(
                ChannelId.MULTISIG_TX,
                `Rewarder ${inlineCode(rewarderAddress)} running empty in under 5 days! 
Remaining reward tokens: ${inlineCode(formatFixed(balance, decimals))} ${await erc20.symbol()}
Estimated end of rewards: ${runOutMoment.toISOString()} 
`,
            );
        }
    }
}

async function checkMultiTokenRewarder(rewarderAddress: string) {
    const rewarder = (await ethers.getContractAt(
        'TimeBasedMasterChefMultiTokenRewarder',
        rewarderAddress,
    )) as TimeBasedMasterChefMultiTokenRewarder;

    const rewardTokens = await rewarder.getRewardTokens();
    let i = 0;
    for (const rewardToken of rewardTokens) {
        const erc20 = (await ethers.getContractAt('ERC20', rewardToken)) as ERC20;
        const balance = await erc20.balanceOf(rewarder.address);
        const decimals = await erc20.decimals();
        const rewardTokenConfig = await rewarder.rewardTokenConfigs(i);
        if (rewardTokenConfig.rewardsPerSecond.eq(0)) {
            return;
        }

        const seconds = balance.div(rewardTokenConfig.rewardsPerSecond);
        if (seconds.eq(0)) {
            await sendMessage(
                ChannelId.MULTISIG_TX,
                `@here Rewarder ${inlineCode(rewarderAddress)} is empty!
    `,
            );
        } else {
            const estimatedEndOfRewards = moment().add(seconds.toNumber(), 'seconds');
            const days = estimatedEndOfRewards.diff(moment(), 'days');
            if (days < 5) {
                await sendMessage(
                    ChannelId.MULTISIG_TX,
                    `Rewarder ${inlineCode(rewarderAddress)} running empty in under 5 days! 
    Remaining reward tokens: ${inlineCode(formatFixed(balance, decimals))} ${await erc20.symbol()}
    Estimated end of rewards: ${estimatedEndOfRewards.toISOString()} 
    `,
                );
            }
        }
        i++;
    }
}
