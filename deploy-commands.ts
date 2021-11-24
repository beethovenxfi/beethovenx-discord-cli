import { REST } from "@discordjs/rest";
import { commandHandlers } from "./src/commands";

const { Routes } = require("discord-api-types/v9");

const TOKEN = process.env.DISCORD_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

const commands = commandHandlers.map((command) => command.definition.toJSON());

const rest = new REST({ version: "9" }).setToken(TOKEN);

rest
  .put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log("Successfully registered application commands."))
  .catch(console.error);
