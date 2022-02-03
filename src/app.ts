import { client } from "./client/discord-client";
import {
  cliCommands,
  registerSlashCommands,
} from "./interactions/slash-commands";
import { GUILD_ID } from "../scripts/deploy-commands";
import { scheduleTransactionReminders } from "./crons/send_tx_reminders";

const TOKEN = process.env.DISCORD_TOKEN!;

client.once("ready", (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  client.application.commands.fetch({ guildId: GUILD_ID }).then((commands) => {
    commands.forEach((command) => {
      const commandHandler = cliCommands.get(command.name);
      if (commandHandler && commandHandler.permissionRoles) {
        for (let role of commandHandler.permissionRoles) {
          console.log(`Granting permission for ${command.name} to ${role}`);
          command.permissions
            .set({
              guild: GUILD_ID,
              permissions: [{ type: "ROLE", id: role, permission: true }],
            })
            .then(() =>
              console.log(`Granted permission for ${command.name} to ${role}`)
            )
            .catch((error) => console.error(error));
        }
      }
    });
  });
});

registerSlashCommands();
scheduleTransactionReminders();

client.login(TOKEN);
