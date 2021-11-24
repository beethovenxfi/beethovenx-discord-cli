import { client } from "./src/client/discord-client";
import { registerSlashCommands } from "./src/interactions/slash-commands";

const TOKEN = process.env.DISCORD_TOKEN!;

client.once("ready", (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

registerSlashCommands();

client.login(TOKEN);
