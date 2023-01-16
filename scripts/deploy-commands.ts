import { REST } from '@discordjs/rest';
import { commandHandlers } from '../src/commands';

const { Routes } = require('discord-api-types/v9');

export const TOKEN = process.env.DISCORD_TOKEN!;
export const GUILD_ID = process.env.DISCORD_GUILD_ID!;
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

const commands = commandHandlers.map((command) => command.definition.toJSON());

for (const command of commands) {
    console.log(`Deploying command: ${command.name}`);
}

const rest = new REST({ version: '9' }).setToken(TOKEN);

console.log(`Deploying now...`);
rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
    .then(() => console.log('Successfully registered application commands.'))
    .catch(console.error);
