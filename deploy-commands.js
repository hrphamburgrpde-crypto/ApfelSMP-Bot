
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const commandsPath = path.join(__dirname, 'src', 'commands');
const commands = [];

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN fehlt!');
}

if (!process.env.CLIENT_ID) {
  throw new Error('CLIENT_ID fehlt!');
}

if (!process.env.GUILD_ID) {
  throw new Error('GUILD_ID fehlt!');
}

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  try {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)];

    const command = require(filePath);

    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`[COMMAND] ${file} wird registriert.`);
    } else {
      console.warn(`[WARNUNG] ${file} hat kein command.data.`);
    }
  } catch (error) {
    console.error(`[FEHLER] ${file} konnte nicht geladen werden:`, error);
    process.exitCode = 1;
    process.exit();
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registriere ${commands.length} Befehle für Server ${process.env.GUILD_ID}...`);

    const result = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(`✅ ${result.length} Guild-Commands erfolgreich registriert.`);
    console.log('Registrierte Befehle:', result.map(c => `/${c.name}`).join(', '));
  } catch (error) {
    console.error('❌ Registrierung fehlgeschlagen:', error);
    process.exitCode = 1;
  }
})();
