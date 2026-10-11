
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'apfel-coins.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try {
    if (!fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, '{}', 'utf8');
    }

    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (error) {
    console.error('[APFEL COINS] Lesen fehlgeschlagen:', error);
    throw new Error('Die Coin-Daten konnten nicht gelesen werden.');
  }
}

function saveData(data) {
  const tempFile = `${FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempFile, FILE);
}

function getAccount(guildId, userId) {
  const data = loadData();

  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      balance: 0,
      earnedToday: 0,
      dailyDate: new Date().toLocaleDateString('en-CA', {
        timeZone: 'Europe/Berlin'
      }),
      voiceMilliseconds: 0
    };
    saveData(data);
  }

  const account = data[guildId][userId];
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Berlin'
  });

  if (account.dailyDate !== today) {
    account.dailyDate = today;
    account.earnedToday = 0;
    saveData(data);
  }

  return account;
}

function updateAccount(guildId, userId, callback) {
  const data = loadData();

  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      balance: 0,
      earnedToday: 0,
      dailyDate: new Date().toLocaleDateString('en-CA', {
        timeZone: 'Europe/Berlin'
      }),
      voiceMilliseconds: 0
    };
  }

  const account = data[guildId][userId];
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Berlin'
  });

  if (account.dailyDate !== today) {
    account.dailyDate = today;
    account.earnedToday = 0;
  }

  const result = callback(account);

  saveData(data);
  return result;
}

function addCoins(guildId, userId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Der Betrag muss größer als 0 sein.');
  }

  return updateAccount(guildId, userId, account => {
    account.balance = Math.round((account.balance + amount) * 100) / 100;
    account.earnedToday =
      Math.round((account.earnedToday + amount) * 100) / 100;
    return account.balance;
  });
}

function takeCoins(guildId, userId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Der Betrag muss größer als 0 sein.');
  }

  return updateAccount(guildId, userId, account => {
    if (account.balance < amount) {
      throw new Error('Der Spieler hat nicht genug Apfel Coins.');
    }

    account.balance = Math.round((account.balance - amount) * 100) / 100;
    return account.balance;
  });
}

function spendCoins(guildId, userId, amount) {
  return takeCoins(guildId, userId, amount);
}

function addMessageCoin(guildId, userId) {
  return addCoins(guildId, userId, 0.5);
}

function addVoiceTime(guildId, userId, milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;

  return updateAccount(guildId, userId, account => {
    account.voiceMilliseconds += milliseconds;

    const completeBlocks = Math.floor(
      account.voiceMilliseconds / (30 * 60 * 1000)
    );

    if (completeBlocks > 0) {
      const earned = completeBlocks * 8;
      account.balance = Math.round((account.balance + earned) * 100) / 100;
      account.earnedToday =
        Math.round((account.earnedToday + earned) * 100) / 100;

      account.voiceMilliseconds -= completeBlocks * 30 * 60 * 1000;
    }

    return account.balance;
  });
}

function getBalance(guildId, userId) {
  return getAccount(guildId, userId).balance;
}

module.exports = {
  getAccount,
  addCoins,
  takeCoins,
  spendCoins,
  addMessageCoin,
  addVoiceTime,
  getBalance
};
