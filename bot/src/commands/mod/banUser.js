const {
  SlashCommandBuilder,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SectionBuilder,
} = require("discord.js");
const supabase = require("../../utils/supabase");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banne einen User von diesem Server")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Banne einen User")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Der zu bannende User")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Der Grund für den Bann")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Der Typ des Banns (z.B. 'permanent', 'temporary')")
            .setRequired(true)
            .addChoices({ name: "Permanent", value: "perm" })
        )
    ),
  run: async ({ interaction, client, handler }) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason");
      const type = interaction.options.getString("type");

      const logChannel = client.channels.cache.get("1163164124683964507");
      const userId = user.id;
      const guild = interaction.guild;

      await interaction.deferReply({
        ephemeral: true,
      });

      await user.send("Du wurdest von einem Server gebannt.");

      await guild.bans.create(userId);
      await interaction.editReply({
        content: `Der User ${user.username} wurde erfolgreich gebannt.`,
      });
    }
  },
  options: {},
};
