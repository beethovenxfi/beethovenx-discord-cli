import { client } from './client/discord-client';
import { registerSlashCommands } from './interactions/slash-commands';
import { scheduleTransactionReminders } from './crons/send_tx_reminders';
import { notifiyPreparedRewarders } from './crons/handle_prepared_rewarders';
import { notifiyEmptyRewarders } from './crons/remind_rewarder_empty';
import { streamBeetsToReliquary } from './crons/stream_beets_reliquary';
import { scheduleOpFarmsReminder } from './crons/send_op_farms_reminder';
import { claimSftmxRewards } from './crons/claim_sftmx_rewards';
import { autoVoteDelegate } from './crons/vote_with_delegate';

const TOKEN = process.env.DISCORD_TOKEN!;

client.once('ready', (client) => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
registerSlashCommands();
scheduleTransactionReminders();
notifiyPreparedRewarders();
notifiyEmptyRewarders();
// updateRelics();
// streamBeetsToReliquary();
scheduleOpFarmsReminder();
claimSftmxRewards();
autoVoteDelegate();
