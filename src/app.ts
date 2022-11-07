import { client } from './client/discord-client';
import { registerSlashCommands } from './interactions/slash-commands';
import { scheduleTransactionReminders } from './crons/send_tx_reminders';
import { notifiyPreparedRewarders } from './crons/handle_prepared_rewarders';
import { notifiyEmptyRewarders } from './crons/remind_rewarder_empty';
import { updateRelics } from './crons/update_relic_positions';

const TOKEN = process.env.DISCORD_TOKEN!;

client.once('ready', (client) => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

registerSlashCommands();
scheduleTransactionReminders();
notifiyPreparedRewarders();
notifiyEmptyRewarders();
updateRelics();

client.login(TOKEN);
