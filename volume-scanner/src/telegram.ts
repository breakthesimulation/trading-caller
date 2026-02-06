// Telegram Bot Integration for Volume Alerts

import axios from 'axios';
import type { VolumeSpike, SentAlert } from './types.js';
import { formatSpikeAlert } from './detector.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TelegramConfig {
  botToken: string;
  defaultChatId?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export class TelegramNotifier {
  private config: TelegramConfig;
  private sentAlerts: Map<string, SentAlert[]> = new Map();
  
  constructor(config: TelegramConfig) {
    this.config = config;
  }
  
  /**
   * Check if the notifier is configured
   */
  isConfigured(): boolean {
    return !!this.config.botToken;
  }
  
  /**
   * Send a text message to a chat
   */
  async sendMessage(
    chatId: string,
    text: string,
    options?: {
      parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
      disableWebPagePreview?: boolean;
      disableNotification?: boolean;
    }
  ): Promise<TelegramMessage | null> {
    if (!this.config.botToken) {
      console.error('[Telegram] Bot token not configured');
      return null;
    }
    
    try {
      const response = await axios.post<TelegramResponse<TelegramMessage>>(
        `${TELEGRAM_API}${this.config.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode || 'Markdown',
          disable_web_page_preview: options?.disableWebPagePreview ?? true,
          disable_notification: options?.disableNotification ?? false,
        },
        { timeout: 10000 }
      );
      
      if (!response.data.ok) {
        console.error('[Telegram] Send failed:', response.data.description);
        return null;
      }
      
      return response.data.result || null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[Telegram] Send error:', error.response?.data || error.message);
      } else {
        console.error('[Telegram] Send error:', error);
      }
      return null;
    }
  }
  
  /**
   * Send a volume spike alert
   */
  async sendSpikeAlert(
    spike: VolumeSpike,
    chatId?: string
  ): Promise<SentAlert | null> {
    const targetChat = chatId || this.config.defaultChatId;
    
    if (!targetChat) {
      console.error('[Telegram] No chat ID provided');
      return null;
    }
    
    const message = formatSpikeAlert(spike);
    const result = await this.sendMessage(targetChat, message);
    
    if (!result) {
      return null;
    }
    
    const alert: SentAlert = {
      spikeId: spike.id,
      tokenAddress: spike.token.address,
      chatId: targetChat,
      sentAt: new Date(),
      messageId: result.message_id,
    };
    
    // Track sent alert
    const key = `${spike.token.address}:${targetChat}`;
    const existing = this.sentAlerts.get(key) || [];
    existing.push(alert);
    this.sentAlerts.set(key, existing);
    
    return alert;
  }
  
  /**
   * Check if we should send an alert (respecting cooldown)
   */
  shouldSendAlert(
    tokenAddress: string,
    chatId: string,
    cooldownMs: number
  ): boolean {
    const key = `${tokenAddress}:${chatId}`;
    const alerts = this.sentAlerts.get(key);
    
    if (!alerts || alerts.length === 0) {
      return true;
    }
    
    const lastAlert = alerts[alerts.length - 1];
    const timeSinceLast = Date.now() - lastAlert.sentAt.getTime();
    
    return timeSinceLast >= cooldownMs;
  }
  
  /**
   * Get recent alerts for a token
   */
  getRecentAlerts(tokenAddress: string, chatId: string): SentAlert[] {
    const key = `${tokenAddress}:${chatId}`;
    return this.sentAlerts.get(key) || [];
  }
  
  /**
   * Clear old alerts from memory
   */
  cleanupOldAlerts(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    for (const [key, alerts] of this.sentAlerts.entries()) {
      const filtered = alerts.filter(a => a.sentAt.getTime() > cutoff);
      if (filtered.length === 0) {
        this.sentAlerts.delete(key);
      } else {
        this.sentAlerts.set(key, filtered);
      }
    }
  }
  
  /**
   * Get bot info
   */
  async getBotInfo(): Promise<any> {
    if (!this.config.botToken) {
      return null;
    }
    
    try {
      const response = await axios.get(
        `${TELEGRAM_API}${this.config.botToken}/getMe`,
        { timeout: 10000 }
      );
      
      return response.data.result;
    } catch (error) {
      console.error('[Telegram] Failed to get bot info:', error);
      return null;
    }
  }
  
  /**
   * Verify bot token is valid
   */
  async verifyToken(): Promise<boolean> {
    const info = await this.getBotInfo();
    return !!info;
  }
}

/**
 * Create a TelegramNotifier from environment variables
 */
export function createTelegramNotifier(): TelegramNotifier {
  return new TelegramNotifier({
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    defaultChatId: process.env.TELEGRAM_CHAT_ID,
  });
}
