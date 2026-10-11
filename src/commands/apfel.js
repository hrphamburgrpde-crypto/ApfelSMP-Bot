
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const coins = require('../utils/apfelCoins');

const PRODUCTS = [
  { id: 'rank', name: 'Apfel Rank', price: 500 },
  { id: 'plus', name: 'Apfel+ Rank', price: 830 },
  { id: 'active', name: 'Aktiver Spieler Rank', price: 350 }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apfel')
    .setDescription('Apfel-Coins-Konto, Shop und Administration')
    .addSubcommand(sub =>
      sub
        .setName('konto')
        .setDescription('Zeigt dein Apfel-Coins-Konto')
    )
    .addSubcommand(sub =>
      sub
        .setName('shop')
        .setDescription('Öffnet den Apfel-Shop per Direktnachricht')
    )
    .addSubcommandGroup(group =>
      group
        .setName('coins')
        .setDescription('Apfel Coins verwalten')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Gibt einem User Apfel Coins')
            .addUserOption(option =>
              option.setName('user').setDescription('Der User').setRequired(true)
            )
            .addNumberOption(option =>
              option
                .setName('amount')
                .setDescription('Anzahl Coins, auch 0.5 möglich')
                .setMinValue(0.5)
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('take')
            .setDescription('Zieht einem User Apfel Coins ab')
            .addUserOption(option =>
              option.setName('user').setDescription('Der User').setRequired(true)
            )
            .addNumberOption(option =>
              option
                .setName('amount')
                .setDescription('Anzahl Coins, auch 0.5 möglich')
                .setMinValue(0.5)
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('balance')
            .setDescription('Zeigt den Kontostand eines Users')
            .addUserOption(option =>
              option.setName('user').setDescription('Der User').setRequired(true)
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Dieser Befehl funktioniert nur auf einem Server.',
        ephemeral: true
      });
    }

    if (group === 'coins') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '❌ Nur Administratoren dürfen diesen Befehl verwenden.',
          ephemeral: true
        });
      }

      const user = interaction.options.getUser('user', true);
      const amount = interaction.options.getNumber('amount');
      let balance;

      try {
        if (subcommand === 'add') {
          balance = coins.addCoins(guildId, user.id, amount);
        } else if (subcommand === 'take') {
          balance = coins.takeCoins(guildId, user.id, amount);
        } else {
          balance = coins.getBalance(guildId, user.id);
        }
      } catch (error) {
        return interaction.reply({
          content: `❌ ${error.message}`,
          ephemeral: true
        });
      }

      return interaction.reply({
        content: `🍎 Konto von ${user}:\nKontostand: **${balance} Apfel Coins**`,
        ephemeral: true
      });
    }

    if (subcommand === 'konto') {
      const account = coins.getAccount(guildId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🍎 Dein Apfel-Coins-Konto')
        .setDescription(
          `**Kontostand:** ${account.balance} Apfel Coins\n` +
          `**Heute verdient:** ${account.earnedToday} Apfel Coins\n\n` +
          '**So verdienst du Coins:**\n' +
          '💬 Pro Nachricht: **0,5 Coins**\n' +
          '🎙️ Pro 30 Minuten im Voice: **8 Coins**\n\n' +
          '🛒 Zum Einlösen: **/apfel shop**'
        )
        .setFooter({ text: 'ApfelSMP • Apfel Coins' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'shop') {
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🍎 Apfel-Shop')
        .setDescription(
          'Wähle einen Rang aus. Der Bot prüft dein Konto und erstellt nach erfolgreichem Kauf ein Ticket.\n\n' +
          PRODUCTS.map(p => `**${p.name}** — ${p.price} Apfel Coins`).join('\n')
        )
        .setFooter({ text: 'ApfelSMP • Dein Guthaben wird beim Kauf abgezogen.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apfel:buy:rank')
          .setLabel('Apfel Rank (500)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('apfel:buy:plus')
          .setLabel('Apfel+ Rank (830)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('apfel:buy:active')
          .setLabel('Aktiver Spieler (350)')
          .setStyle(ButtonStyle.Secondary)
      );

      try {
        await interaction.user.send({ embeds: [embed], components: [row] });

        return interaction.reply({
          content: '📩 Ich habe dir den Apfel-Shop per DM geschickt!',
          ephemeral: true
        });
      } catch {
        return interaction.reply({
          content: '❌ Ich konnte dir keine DM schicken. Aktiviere deine Direktnachrichten für diesen Server und versuche es erneut.',
          ephemeral: true
        });
      }
    }
  }
};

