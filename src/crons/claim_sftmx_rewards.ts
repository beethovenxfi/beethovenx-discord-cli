import { BigNumber } from 'ethers';
import { parseFixed } from '@ethersproject/bignumber';
import ftmstakingAbi from '../../abi/FTMStaking.json';
import { proposedGasPriceFantom } from '../utils';
import { ChannelId, sendMessage } from '../interactions/send-message';
import { networkConfig } from '../config/config';
import { inlineCode } from '@discordjs/builders';
const { ethers } = require('hardhat');

const ftmStakingContract = '0xB458BfC855ab504a8a327720FcEF98886065529b';

export async function claimSftmxRewards() {
    console.log('Schedule claim sftmx rewards');
    await claimAllSftmxRewards();
    // every 4 hours
    setInterval(claimAllSftmxRewards, 4 * 60 * 60000);
}

async function claimAllSftmxRewards() {
    console.log('claiming sftmx rewards');
    const sftmx = await ethers.getContractAt(ftmstakingAbi, ftmStakingContract);

    const updaterBalance: BigNumber = await ethers.provider.getBalance(networkConfig.walletAddresses.relicUpdater);
    if (updaterBalance.lt(parseFixed(`1`, 18))) {
        return;
    }

    try {
        const gasPrice = await proposedGasPriceFantom();
        if (parseFloat(gasPrice) < 100) {
            const txn = await sftmx.claimRewardsAll({
                gasPrice: parseFloat(gasPrice) * 5968460,
            });
            await txn.wait();
        } else {
            await sendMessage(ChannelId.SERVER_STATUS, `Did not claim sftmx rewards, gas price too high: ${gasPrice}!`);
            console.log(`Did not claim sftmx rewards, gas price too high: ${gasPrice}!`);
        }
    } catch (e) {
        console.log(`Failed to claim sftmx rewards.`);
    }
}
