import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { CommandHandler } from "./index";
import moment from "moment";
import { MODERATOR_ROLE } from "../config/config";
import { ChannelId, sendMessage } from "../interactions/send-message";

const reminderIds: Map<string, NodeJS.Timeout> = new Map<
  string,
  NodeJS.Timeout
>();

async function execute(interaction: CommandInteraction) {
  const eta = interaction.options.getNumber("eta")!;
  const transaction = interaction.options.getString("transaction")!;

  const reminderDuration = (eta - moment().unix()) * 1000;
  const reminderId = setTimeout(async () => {
    await sendMessage(ChannelId.MULTISIG_TX, `@here Reminder:${transaction}`);
  }, reminderDuration);

  reminderIds.set(transaction, reminderId);

  await interaction.reply({
    content: `Reminder for tx ${transaction} set to ${moment.unix(eta)}!`,
    ephemeral: true,
  });
}

export const txReminder: CommandHandler = {
  definition: new SlashCommandBuilder()
    .setName("set_tx_reminder")
    .setDescription("schedules a transaction reminder")
    .addStringOption((option) =>
      option
        .setName("transaction")
        .setDescription("Transaction id")
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName("eta")
        .setDescription("Time of execution")
        .setRequired(true)
    )
    .setDefaultPermission(false),
  execute,
  permissionRoles: [MODERATOR_ROLE],
};
