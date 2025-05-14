const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Client, Intents } = require('discord.js');
require('dotenv').config();

const GITHUB_PACKAGE_JSON_URL = process.env.GITHUB_PACKAGE_JSON_URL;
const localPackageJsonPath = path.join(__dirname, 'package.json');

async function checkForUpdates(client) {
  try {
    if (!GITHUB_PACKAGE_JSON_URL) {
      console.error('GITHUB_PACKAGE_JSON_URL is not defined in the .env file.');
      return;
    }

    const response = await axios.get(GITHUB_PACKAGE_JSON_URL);
    const remotePackageJson = response.data;

    const localPackageJson = JSON.parse(fs.readFileSync(localPackageJsonPath, 'utf-8'));

    if (remotePackageJson.version !== localPackageJson.version) {
      console.log('A new version of the bot is available:', remotePackageJson.version);

      const application = await client.application.fetch();
      const botOwner = application.owner;

      if (botOwner) {
        if (botOwner.members) {
          // If the bot owner is a team, notify all members
          botOwner.members.forEach(member => {
            member.send(`A new version of the bot is available: ${remotePackageJson.version}. Please update from version ${localPackageJson.version}.`)
              .catch(err => console.error('Failed to send DM to team member:', err));
          });
        } else {
          // If the bot owner is a single user
          botOwner.send(`A new version of the bot is available: ${remotePackageJson.version}. Please update from version ${localPackageJson.version}.`)
            .catch(err => console.error('Failed to send DM to bot owner:', err));
        }
      } else {
        console.error('Could not fetch bot owner information.');
      }
    } else {
      console.log('The bot is up to date.');
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

module.exports = { checkForUpdates };
