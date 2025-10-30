import axios from 'axios';
import { client } from './client/discord-client';
import { updateRelics } from './crons/update_relic_positions';
import { claimAllStSRewards } from './crons/claim_sts_rewards';
import { streamBeets } from './crons/stream_beets_reliquary';
import { updateDynamicEclpRanges } from './crons/remind_oor_dynamic_eclps';
import { sendTreasuryNotifications } from './crons/notifyTreasuryTxns';

const TOKEN = process.env.DISCORD_TOKEN!;

async function debugMe(): Promise<void> {
    // await client.once('ready', (client) => {
    //     console.log(`Ready! Logged in as ${client.user.tag}`);
    // });

    await client.login(TOKEN);
    // await opFarmsReminder();

    // type response = {
    //     proposal: string;
    //     inventivesReceived: number;
    //     choiceHuman: Record<string, number>;
    //     choice: Record<string, number>;
    // };

    // const { data } = await axios.post<response>('http://127.0.0.1:8000/vote', {
    //     walletAddress: '0x641e10Cd6132D3e3FA01bfd65d2e0afCf64b136A',
    //     market: 'beets',
    //     md_selection: 'mdSelection',
    // });

    // console.log(data);

    // claimAllStSRewards();
    await updateDynamicEclpRanges();
    // await sendTreasuryNotifications();

    // type rewarderOutput = {
    //     address: string;
    //     rewardTokenAddress: string;
    //     rewardTokenSymbol: string;
    //     rewardTokenBalance: string;
    //     rewardsPerSecond: string;
    //     masterchefFarmId: string;
    // };
    // let rewarders: string[] = [
    //     '0x42c4Bf52F233532eB085849349e87a1885089583',
    //     '0xA81E2bA1035f973c734f1eD23a0c0D6d197dd229',
    //     '0x163E710A4263b9a45b745d4Fab6f39CC35553AD9',
    //     '0x58b86B32F560d025594ADFF02073Ae18976C4700',
    //     '0x849a9806C58ecfdEb2038bD8D629072D8d36EfB2',
    //     '123123',
    // ];
    // let rewardersOut: rewarderOutput[] = [];
    // for (const rewarderAddress of rewarders) {
    //     if (!ethers.utils.isAddress(rewarderAddress)) {
    //         continue;
    //     }
    //     const rewarder = (await ethers.getContractAt(
    //         'TimeBasedMasterChefRewarder',
    //         rewarderAddress,
    //     )) as unknown as TimeBasedMasterChefRewarder;
    //     const masterchefFarmId = await rewarder.masterchefPoolIds(0);
    //     const rewardTokenAddress = await rewarder.rewardToken();
    //     const rewardToken = (await ethers.getContractAt('ERC20', rewardTokenAddress)) as unknown as ERC20;
    //     const rewardTokenSymbol = await rewardToken.symbol();
    //     const rewardTokenBalance = await rewardToken.balanceOf(rewarderAddress);
    //     const rewardPerSecond = await rewarder.rewardPerSecond();
    //     rewardersOut.push({
    //         address: rewarderAddress,
    //         rewardTokenAddress: rewardTokenAddress,
    //         rewardTokenBalance: rewardTokenBalance.toString(),
    //         rewardsPerSecond: rewardPerSecond.toString(),
    //         rewardTokenSymbol: rewardTokenSymbol,
    //         masterchefFarmId: masterchefFarmId.toString(),
    //     });
    //     console.log(JSON.stringify(rewardersOut, null, 2));
    // }
}
// updateRelics();

debugMe();
