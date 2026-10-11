
const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const {
  addMessageCoin,
  addVoiceTime,
  spendCoins
} = require('../utils/apfelCoins');

const voiceSessions = new Map();
const VOICE_INTERVAL = 30 * 60 * 1000;

function sessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function startVoiceSession(member) {
  if (!member || member.user.bot) return;

  const key = sessionKey(member.guild.id, member.id);
  if (!voiceSessions.has(key)) {
    voiceSessions.set(key, {
      startedAt: Date.now(),
      lastAwardAt: Date.now()
    });
  }
}

function stopVoiceSession(guildId, userId) {
  const key = sessionKey(guildId, userId);
  const session = voiceSessions.get(key);
  if (!session) return;

  const elapsed = Date.now() - session.lastAwardAt;
  const completeBlocks = Math.floor(elapsed / VOICE_INTERVAL);

  if (completeBlocks > 0) {
    addVoiceTime(guildId, userId, completeBlocks * VOICE_INTERVAL);
    session.lastAwardAt += completeBlocks * VOICE_INTERVAL;
  }

  // Noch nicht volle 30 Minuten werden hier nicht gutgeschrieben.
  // Der Rest bleibt für die nächste Sitzung erhalten.
  voiceSessions.delete(key);
}

function getTicketCategoryId() {
  return process.env.APFEL_TICKET_CATEGORY_ID;
}

async function handleApfelButton(interaction) {
  if (!interaction.isButton()) return false;

  const parts = interaction.customId.split(':');
  if (parts[0] !== 'apfel') return false;

  const action = parts[1];

  if (action === 'buy') {
    const productId = parts[2];
    const products = {
      rank: { name: 'Apfel Rank', price: 500 },
      plus: { name: 'Apfel+ Rank', price: 830 },
      active: { name: 'Aktiver Spieler Rank', price: 350 }
    };

    const product = products[productId];
    if (!product) {
      await interaction.reply({
        content: '❌ Dieses Produkt gibt es nicht.',
        ephemeral: true
      });
      return true;
    }

    const categoryId = getTicketCategoryId();
    const guild = interaction.client.guilds.cache.first();

    if (!categoryId || !guild) {
      await interaction.reply({
        content: '❌ Der Ticket-Shop ist nicht richtig eingerichtet. Bitte melde dich beim Team.',
        ephemeral: true
      });
      return true;
    }

    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) {
      await interaction.reply({
        content: '❌ Die konfigurierte Ticket-Kategorie wurde nicht gefunden.',
        ephemeral: true
      });
      return true;
    }

    const accountModule = require('../utils/apfelCoins');

    let account;
    try {
      account = accountModule.getAccount(guild.id, interaction.user.id);
    } catch (error) {
      console.error('[APFEL] Konto konnte nicht geladen werden:', error);
      await interaction.reply({
        content: '❌ Dein Konto konnte gerade nicht geladen werden.',
        ephemeral: true
      });
      return true;
    }

    if (account.balance < product.price) {
      await interaction.reply({
        content: `❌ Du hast nicht genug Apfel Coins!\n\nPreis: **${product.price}** 🍎\nDein Kontostand: **${account.balance}** 🍎`,
        ephemeral: true
      });
      return true;
    }

    // Zuerst Ticket erstellen. Erst wenn das gelingt, werden Coins abgezogen.
    let ticket;
    try {
      ticket = await guild.channels.create({
        name: `apfel-kauf-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .slice(0, 90),
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: `Apfel-Shop-Kauf | User: ${interaction.user.id} | Produkt: ${product.name}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ]
      });
    } catch (error) {
      console.error('[APFEL] Ticket konnte nicht erstellt werden:', error);
      await interaction.reply({
        content: '❌ Das Ticket konnte nicht erstellt werden. Es wurden keine Coins abgezogen.',
        ephemeral: true
      });
      return true;
    }

    try {
      spendCoins(guild.id, interaction.user.id, product.price);
    } catch (error) {
      await ticket.delete().catch(() => {});
      await interaction.reply({
        content: `❌ Der Kauf konnte nicht abgeschlossen werden: ${error.message}`,
        ephemeral: true
      });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🍎 Neuer Apfel-Shop-Kauf')
      .setDescription(
        `**Spieler:** ${interaction.user}\n` +
        `**Produkt:** ${product.name}\n` +
        `**Preis:** ${product.price} Apfel Coins\n\n` +
        'Ein Teammitglied kann den Kauf übernehmen, bestätigen oder das Ticket schließen.'
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`apfel:claim:${interaction.user.id}`)
        .setLabel('Claim')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`apfel:confirm:${interaction.user.id}`)
        .setLabel('Kauf Bestätigen')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`apfel:close:${interaction.user.id}`)
        .setLabel('Kauf Ticket Schließen')
        .setStyle(ButtonStyle.Danger)
    );

    await ticket.send({
      content: `${interaction.user}`,
      embeds: [embed],
      components: [row]
    });

    await interaction.reply({
      content: `✅ Dein Kauf wurde angenommen! **${product.price} Apfel Coins** wurden abgezogen.\nDein Ticket: ${ticket}`,
      ephemeral: true
    });

    try {
      await interaction.user.send(
        `🍎 Dein Kauf für **${product.name}** wurde angenommen.\n` +
        `Abgezogen: **${product.price} Apfel Coins**\n` +
        `Ticket: ${ticket.name}\n\n` +
        'Das Team bearbeitet deinen Antrag.'
      );
    } catch {
      // Der Kauf bleibt bestehen, auch wenn DMs geschlossen sind.
    }

    return true;
  }

  const isTeam = interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );

  if (!isTeam) {
    await interaction.reply({
      content: '❌ Nur Administratoren dürfen diese Ticket-Aktion ausführen.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'claim') {
    await interaction.reply({
      content: `👋 Dieses Ticket wird von ${interaction.user} bearbeitet.`
    });
    return true;
  }

  if (action === 'confirm') {
    await interaction.reply({
      content: `✅ Der Kauf wurde von ${interaction.user} als bestätigt markiert. Bitte gib den Rang gemäß euren Serverregeln frei.`
    });
    return true;
  }

  if (action === 'close') {
    await interaction.reply({
      content: '🔒 Dieses Kauf-Ticket wird in 5 Sekunden gelöscht.'
    });

    setTimeout(() => {
      interaction.channel?.delete('Apfel-Shop-Kauf-Ticket geschlossen').catch(() => {});
    }, 5000);

    return true;
  }

  return false;
}

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    // Bereits beim Start in Voice-Channels befindliche User erfassen.
    for (const guild of client.guilds.cache.values()) {
      for (const state of guild.voiceStates.cache.values()) {
        if (state.channel && !state.member?.user.bot) {
          startVoiceSession(state.member);
        }
      }
    }

    client.on(Events.MessageCreate, message => {
      if (!message.guild || message.author.bot) return;

      try {
        addMessageCoin(message.guild.id, message.author.id);
      } catch (error) {
        console.error('[APFEL] Message-Coins fehlgeschlagen:', error);
      }
    });

    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

      const wasInVoice = Boolean(oldState.channelId);
      const isInVoice = Boolean(newState.channelId);

      if (!wasInVoice && isInVoice) {
        startVoiceSession(member);
      } else if (wasInVoice && !isInVoice) {
        stopVoiceSession(member.guild.id, member.id);
      }
    });

    // Volle 30-Minuten-Blöcke werden gutgeschrieben, auch wenn der User
    // weiterhin im Voice ist. Der verbleibende Rest bleibt in der Sitzung.
    setInterval(() => {
      for (const [key, session] of voiceSessions.entries()) {
        const [guildId, userId] = key.split(':');
        const elapsed = Date.now() - session.lastAwardAt;
        const completeBlocks = Math.floor(elapsed / VOICE_INTERVAL);

        if (completeBlocks > 0) {
          try {
            addVoiceTime(
              guildId,
              userId,
              completeBlocks * VOICE_INTERVAL
            );
            session.lastAwardAt += completeBlocks * VOICE_INTERVAL;
          } catch (error) {
            console.error('[APFEL] Voice-Coins fehlgeschlagen:', error);
          }
        }
      }
    }, 60 * 1000);

    client.on(Events.InteractionCreate, async interaction => {
      try {
        await handleApfelButton(interaction);
      } catch (error) {
        console.error('[APFEL] Button-Fehler:', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Es ist ein Fehler aufgetreten.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    });

    console.log('[APFEL] Coin-Events gestartet.');
  }
};

