import { client } from "./client/discord-client";
import { registerSlashCommands } from "./interactions/slash-commands";

const TOKEN = process.env.DISCORD_TOKEN!;

client.once("ready", (client) => {
  console.log(`Ready! Logged in as ${client.user.tag}`);
});

registerSlashCommands();

client.login(TOKEN);
