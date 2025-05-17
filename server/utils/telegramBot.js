const axios = require('axios');
const telegramConfig = require('../config/telegram');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class TelegramBot {
  constructor() {
    this.token = telegramConfig.botToken;
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    this.configPath = path.join(__dirname, '../config/telegram.json');
    console.log('TelegramBot initialized with config path:', this.configPath);
    this.loadConfig();
    
    // Flag to track if this is a fresh server start or a nodemon restart
    this.isServerRestart = false;
    this.lastStartTimestamp = 0;
    
    // Start listening for messages to get chat ID
    this.startPolling();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        console.log('Loading Telegram config from file');
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.chatId = config.chatId;
        this.enabled = config.enabled !== false;
        
        // Check if the server was restarted recently (within the last 60 seconds)
        if (config.lastStartTimestamp) {
          const now = Date.now();
          this.lastStartTimestamp = config.lastStartTimestamp;
          
          if ((now - config.lastStartTimestamp) < 60000) { // 60 seconds
            this.isServerRestart = true;
            console.log('Detected server restart within the last minute');
          }
        }
        
        console.log('Loaded config:', { chatId: this.chatId, enabled: this.enabled, isServerRestart: this.isServerRestart });
      } else {
        console.log('No config file found, using default config');
        this.chatId = telegramConfig.chatId;
        this.enabled = telegramConfig.enabled;
        this.saveConfig();
      }
    } catch (error) {
      console.error('Error loading Telegram config:', error);
      this.chatId = telegramConfig.chatId;
      this.enabled = telegramConfig.enabled;
    }
  }

  saveConfig() {
    try {
      // Update lastStartTimestamp to current time
      this.lastStartTimestamp = Date.now();
      
      console.log('Saving Telegram config:', { chatId: this.chatId, enabled: this.enabled, lastStartTimestamp: this.lastStartTimestamp });
      fs.writeFileSync(this.configPath, JSON.stringify({
        chatId: this.chatId,
        enabled: this.enabled,
        lastStartTimestamp: this.lastStartTimestamp
      }, null, 2));
      console.log('Config saved successfully');
    } catch (error) {
      console.error('Error saving Telegram config:', error);
    }
  }

  async startPolling() {
    if (!this.enabled) {
      console.log('Polling disabled: bot is not enabled');
      return;
    }

    console.log('Starting Telegram bot polling');
    let offset = 0;
    const poll = async () => {
      try {
        const response = await axios.get(`${this.apiUrl}/getUpdates`, {
          params: { offset, timeout: 30 }
        });

        const updates = response.data.result;
        if (updates.length > 0) {
          console.log('Received updates:', updates);
        }
        
        for (const update of updates) {
          offset = update.update_id + 1;
          
          // Skip old updates (older than 5 minutes)
          const updateTime = update.message?.date * 1000; // Convert to milliseconds
          if (updateTime && (Date.now() - updateTime) > 300000) {
            console.log('Skipping old update:', update.update_id);
            continue;
          }
          
          if (update.message && update.message.text === '/start') {
            console.log('Received /start command from chat:', update.message.chat.id);
            this.chatId = update.message.chat.id;
            this.saveConfig();
            
            // Send welcome message only for explicit /start commands from users
            await this.sendMessage('🟢 Stock Updates Bot started successfully!\n\nYou will receive notifications about stock synchronization here.');
            console.log('Telegram chat ID set:', this.chatId);
          }
        }
      } catch (error) {
        console.error('Telegram polling error:', error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
        }
      }
      
      // Continue polling
      setTimeout(poll, 3000);
    };

    poll();
    
    // Only send startup message if this is not a restart and we have a chat ID
    if (!this.isServerRestart && this.chatId) {
      console.log('Sending initial startup notification (first server start)');
      this.sendMessage('🚀 Stock Updates Bot service has been started.\nReady to send notifications about stock synchronization.');
    } else if (this.isServerRestart) {
      console.log('Skipping startup notification due to server restart');
    }
  }

  async sendMessage(text) {
    console.log('Attempting to send message:', { enabled: this.enabled, chatId: this.chatId });
    
    if (!this.enabled) {
      console.log('Telegram notifications disabled');
      return;
    }

    if (!this.chatId) {
      console.log('Telegram chat ID not set. Please start the bot with /start command');
      return;
    }

    try {
      console.log('Sending message to Telegram:', {
        chat_id: this.chatId,
        text: text.substring(0, 100) + '...' // Log first 100 chars
      });
      
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML'
      });
      
      if (!response.data.ok) {
        throw new Error(response.data.description || 'Unknown error');
      }
      
      console.log('Message sent successfully');
      return response.data;
    } catch (error) {
      console.error('Error sending Telegram message:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async sendSyncStartNotification(companyId, companyName) {
    try {
      console.log('Sending sync start notification for company:', companyId, companyName);
      const companyDisplay = companyName || companyId;
      const message = `🔄 Starting stock synchronization for company "${companyDisplay}"`;
      await this.sendMessage(message);
      console.log('Sync start notification sent');
    } catch (error) {
      console.error('Failed to send sync start notification:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  async sendSyncProgressNotification(companyId, companyName, fileName, progressMessage) {
    await this.loadConfig(); // Ensure config is fresh, though usually done at init
    if (!this.enabled) {
        console.log('Telegram notifications disabled, skipping progress message.');
        return;
    }

    let text = `⏳ Stock synchronization progress for company "${companyName}"`;
    if (fileName) {
      text += ` (File: ${fileName})`;
    }
    text += `:\n\n${progressMessage}`;

    try {
      await this.sendMessage(text);
      console.log(`Sync progress notification sent for company ${companyId} (File: ${fileName})`);
    } catch (error) {
      // Error is already logged in this.sendMessage, but we can add context
      console.error(`Failed to send progress notification specifically for ${companyName} (File: ${fileName}):`, error.message);
    }
  }

  async sendSyncSuccessNotification(companyId, stats, companyNameArg, reportPath = null) {
    try {
      console.log('Sending sync success notification for company:', companyId, stats);
      const companyDisplay = companyNameArg || stats.companyName || companyId;
      
      let message = `✅ Stock synchronization completed for <b>${companyDisplay}</b>\n\n` +
        `<b>📊 Statistics:</b>\n` +
        `• Total products from source: ${stats.totalProducts || 0}\n` +
        `• Successfully processed (created/updated): ${stats.processed || 0}\n` +
        `  - Created new: ${stats.created || 0}\n` +
        `  - Updated existing: ${stats.updated || 0}\n`;

      if (stats.replacedOtherCompanyProduct > 0) {
        message += `• Replaced products at other companies (cheaper): ${stats.replacedOtherCompanyProduct}\n`;
      }

      let skippedProductsMessage = '\n<b>🚫 Skipped Products:</b>\n';
      let skippedAny = false;

      if (stats.skippedInvalidStatus > 0) {
        skippedProductsMessage += `• Invalid status: ${stats.skippedInvalidStatus}\n`;
        skippedAny = true;
      }
      if (stats.skippedInvalidColor > 0) {
        skippedProductsMessage += `• Invalid color (not D-G): ${stats.skippedInvalidColor}\n`;
        skippedAny = true;
      }
      if (stats.skippedInvalidClarity > 0) {
        skippedProductsMessage += `• Invalid clarity: ${stats.skippedInvalidClarity}\n`;
        skippedAny = true;
      }
      if (stats.skippedInvalidPrice > 0) {
        skippedProductsMessage += `• Invalid price (0-150k): ${stats.skippedInvalidPrice}\n`;
        skippedAny = true;
      }
      if (stats.skippedInvalidCarat > 0) {
        skippedProductsMessage += `• Invalid carat (0.3-100): ${stats.skippedInvalidCarat}\n`;
        skippedAny = true;
      }
      if (stats.skippedMissingMedia > 0) {
        skippedProductsMessage += `• Missing photo & video: ${stats.skippedMissingMedia}\n`;
        skippedAny = true;
      }
      if (stats.skippedByApiFilter > 0) {
        skippedProductsMessage += `• Skipped by API config filter: ${stats.skippedByApiFilter}\n`;
        skippedAny = true;
      }
      if (stats.skippedByBlacklist > 0) {
        skippedProductsMessage += `• Blacklisted certificate: ${stats.skippedByBlacklist}\n`;
        skippedAny = true;
      }
      if (stats.skippedOnDealOrSold > 0) {
        skippedProductsMessage += `• Already on deal/sold (this company): ${stats.skippedOnDealOrSold}\n`;
        skippedAny = true;
      }
      if (stats.skippedCheaperExistsOtherCompany > 0) {
        skippedProductsMessage += `• Cheaper version exists (other company): ${stats.skippedCheaperExistsOtherCompany}\n`;
        skippedAny = true;
      }
      
      if (skippedAny) {
        message += skippedProductsMessage;
      } else {
        message += '\n<b>🚫 Skipped Products:</b>\n• No products skipped based on current rules.\n';
      }

      if (stats.apiErrors > 0) {
        message += `
<b>⚠️ API Errors during sync:</b> ${stats.apiErrors}
`;
      }
      
      message += `
🕒 Duration: ${stats.duration} seconds

` +
                 `ℹ️ Note: White diamonds (D-G) are prioritized. Strict validation rules are applied.`;

      await this.sendMessage(message);
      console.log('Sync success notification sent');

      // Send the report if path is provided
      if (reportPath) {
        const reportFileName = path.basename(reportPath);
        await this.sendReportDocument(reportPath, `📄 <b>Import Report:</b> ${reportFileName}`);
      }

    } catch (error) {
      console.error('Failed to send sync success notification or report:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  async sendSyncErrorNotification(companyId, error, companyName) {
    try {
      console.log('Sending sync error notification for company:', companyId, companyName);
      const companyDisplay = companyName || companyId;
      const message = `❌ Stock synchronization failed for company "${companyDisplay}"\n\n` +
        `Error: ${error.message}`;
      await this.sendMessage(message);
      console.log('Sync error notification sent');
    } catch (error) {
      console.error('Failed to send sync error notification:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  async sendQueueUpdateNotification(status) {
    try {
      console.log('Sending queue update notification:', status);
      const companyInfo = status.companyName ? 
        `for company "${status.companyName}"` : 
        (status.companyId ? `for company ${status.companyId}` : '');
        
      const message = `📋 Sync Queue Status ${companyInfo}:\n` +
        `• Running tasks: ${status.running}\n` +
        `• Tasks in queue: ${status.queued}`;
      await this.sendMessage(message);
      console.log('Queue update notification sent');
    } catch (error) {
      console.error('Failed to send queue update notification:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  async sendReportDocument(filePath, caption = '') {
    if (!this.enabled || !this.chatId) {
      console.log('Telegram document sending disabled or chat ID not set.');
      return;
    }
    if (!fs.existsSync(filePath)) {
      console.error(`[Telegram Report] File not found, cannot send: ${filePath}`);
      return;
    }

    // Check file size before attempting to send
    const fileSizeInBytes = fs.statSync(filePath).size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
    const MAX_TELEGRAM_FILE_SIZE_MB = 48; // Set a threshold (e.g., 48MB)

    if (fileSizeInMB > MAX_TELEGRAM_FILE_SIZE_MB) {
      console.warn(`[Telegram Report] Report file ${path.basename(filePath)} is too large (${fileSizeInMB.toFixed(2)}MB) to send via Telegram.`);
      const largeFileMessage = `📄 Report "${path.basename(filePath)}" was generated successfully but is too large (${fileSizeInMB.toFixed(2)}MB) to be sent via Telegram.\nIt is available on the server at: ${filePath}`;
      // Send a message indicating the file is too large
      try {
        await this.sendMessage(largeFileMessage);
        console.log('Sent notification about large report file.');
      } catch (messageError) {
        console.error('Failed to send notification about large report file:', messageError.message);
      }
      return; // Don't attempt to send the large file
    }

    const form = new FormData();
    form.append('chat_id', this.chatId);
    form.append('document', fs.createReadStream(filePath));
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }

    try {
      console.log(`Attempting to send document: ${filePath} to chat ID: ${this.chatId}`);
      const response = await axios.post(`${this.apiUrl}/sendDocument`, form, {
        headers: form.getHeaders(),
      });

      if (!response.data.ok) {
        throw new Error(response.data.description || 'Unknown error sending document');
      }
      console.log('Document sent successfully via Telegram.');
      return response.data;
    } catch (error) {
      console.error(`Error sending Telegram document: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      // Do not re-throw, as main notification might have succeeded
    }
  }
}

// Create singleton instance
const telegramBot = new TelegramBot();

module.exports = telegramBot; 