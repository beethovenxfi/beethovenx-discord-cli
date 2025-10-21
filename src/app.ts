import { client } from './client/discord-client';
import { registerSlashCommands } from './interactions/slash-commands';
import { autoVoteDelegate } from './crons/vote_with_delegate';
import { claimStsRewards } from './crons/claim_sts_rewards';
import { scheduleDynamicEclpRangeUpdater } from './crons/remind_oor_dynamic_eclps';
import { scheduleTreasuryNotifications } from './crons/notifyTreasuryTxns';

const TOKEN = process.env.DISCORD_TOKEN!;

client.once('ready', (client) => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
registerSlashCommands();
// scheduleTransactionReminders();
// notifiyPreparedRewarders();
// notifiyEmptyRewarders();
// updateRelics();
// streamBeetsToReliquary();
// scheduleOpFarmsReminder();
// claimSftmxRewards();
claimStsRewards();
autoVoteDelegate();
scheduleDynamicEclpRangeUpdater();
scheduleTreasuryNotifications();
