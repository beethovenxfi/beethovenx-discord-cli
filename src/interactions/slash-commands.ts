import { client } from "../client/discord-client";
import { Collection } from "discord.js";
import { commandHandlers } from "../commands";

const commands: Collection<string, any> = new Collection();

export function registerSlashCommands() {
  commandHandlers.forEach((handler) => {
    commands.set(handler.definition.name, handler);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) {
      return;
    }

    const command = commands.get(interaction.commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  });
}
