import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';
import { processInboundMessage } from './inbound.processor.js';
import { clearRedisAuthState, useRedisAuthState } from './redisAuthState.js';
import { dispatchTenantWebhookEvent } from '../webhooks/webhook-events.js';
import { WebhookEvent } from '@prisma/client';

type SessionMap = Map<string, WASocket>;
type ConnectMode = 'QR' | 'CODE';

type ConnectOptions = {
  mode?: ConnectMode;
  phoneNumber?: string;
};

function getTextMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const msg = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    ephemeralMessage?: { message?: unknown };
    viewOnceMessage?: { message?: unknown };
    viewOnceMessageV2?: { message?: unknown };
    documentWithCaptionMessage?: { message?: unknown };
  };

  // Some inbound messages come wrapped (ephemeral/viewOnce/documentWithCaption).
  const wrapped =
    msg.ephemeralMessage?.message ??
    msg.viewOnceMessage?.message ??
    msg.viewOnceMessageV2?.message ??
    msg.documentWithCaptionMessage?.message;

  if (wrapped) {
    return getTextMessage(wrapped);
  }

  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    null
  );
}

function toContactPhone(remoteJid: string): string {
  // Example: 5511999999999:12@s.whatsapp.net -> 5511999999999
  const jidPrefix = remoteJid.split('@')[0] ?? remoteJid;
  const base = jidPrefix.split(':')[0] ?? jidPrefix;
  return base.replace(/\D/g, '');
}

function pickBestPhoneFromJids(jids: Array<string | null | undefined>): string | null {
  for (const jid of jids) {
    if (!jid) {
      continue;
    }

    const normalized = toContactPhone(jid);

    // Phone-like values only. LID ids can be long digit blobs that are not phone numbers.
    if (normalized.length >= 10 && normalized.length <= 15) {
      return normalized;
    }
  }

  return null;
}

function extractContactPhoneFromMessageKey(
  key: {
    remoteJid?: string | null;
    participant?: string | null;
  },
  message?: unknown,
): string | null {
  const remoteJid = key.remoteJid ?? undefined;
  const participant = key.participant ?? undefined;
  const keyAny = key as Record<string, unknown>;
  const messageAny = message as Record<string, unknown> | undefined;

  const remoteJidAlt = typeof keyAny.remoteJidAlt === 'string' ? keyAny.remoteJidAlt : undefined;
  const participantAlt =
    typeof keyAny.participantAlt === 'string' ? keyAny.participantAlt : undefined;
  const remoteJidPn = typeof keyAny.remoteJidPn === 'string' ? keyAny.remoteJidPn : undefined;
  const participantPn = typeof keyAny.participantPn === 'string' ? keyAny.participantPn : undefined;

  const messageContextInfo = messageAny?.messageContextInfo as Record<string, unknown> | undefined;
  const contextParticipant =
    typeof messageContextInfo?.participant === 'string'
      ? messageContextInfo.participant
      : undefined;
  const contextParticipantPn =
    typeof messageContextInfo?.participantPn === 'string'
      ? messageContextInfo.participantPn
      : undefined;
  const contextRemoteJidPn =
    typeof messageContextInfo?.remoteJidPn === 'string'
      ? messageContextInfo.remoteJidPn
      : undefined;

  if (remoteJid === 'status@broadcast' || remoteJidAlt === 'status@broadcast') {
    return null;
  }

  // In group messages, remoteJid is the group ID and participant is the real sender.
  const isGroup = Boolean(remoteJid?.endsWith('@g.us') || remoteJidAlt?.endsWith('@g.us'));

  const candidates = isGroup
    ? [
        participantPn,
        participantAlt,
        contextParticipantPn,
        participant,
        contextParticipant,
        remoteJidPn,
      ]
    : [participantPn, remoteJidPn, participantAlt, remoteJidAlt, contextRemoteJidPn, remoteJid];

  return pickBestPhoneFromJids(candidates);
}

function toJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

export class WhatsAppService {
  private static sessions: SessionMap = new Map();

  private static normalizePairingPhone(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, '');
  }

  private static isE164WithoutPlus(phoneNumber: string): boolean {
    return /^\d{10,15}$/.test(phoneNumber);
  }

  static async sendFromActiveSession(
    tenantId: string,
    to: string,
    message: string,
  ): Promise<{ sent: boolean; errorMessage?: string }> {
    const socket = WhatsAppService.sessions.get(tenantId);
    if (!socket) {
      return { sent: false, errorMessage: 'Sessao WhatsApp nao conectada' };
    }

    try {
      const jid = toJid(to);
      await socket.sendMessage(jid, { text: message });
      return { sent: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Falha ao enviar mensagem';
      return { sent: false, errorMessage };
    }
  }

  constructor(private readonly app: FastifyInstance) {}

  private async requestPairingCode(
    tenantId: string,
    socket: WASocket,
    phoneNumber: string,
  ): Promise<string> {
    const normalized = WhatsAppService.normalizePairingPhone(phoneNumber);

    if (!WhatsAppService.isE164WithoutPlus(normalized)) {
      throw new AppError('phoneNumber must be E.164 without plus sign', 422);
    }

    const code = await socket.requestPairingCode(normalized);
    await this.app.redis.set(`wa:session:${tenantId}:pairingCode`, code, 'EX', 180);
    return code;
  }

  private async handleInboundMessage(
    tenantId: string,
    contactPhone: string,
    message: string,
    waMessageId?: string,
  ): Promise<void> {
    const payload = {
      tenantId,
      contactPhone,
      message,
      ...(waMessageId ? { waMessageId } : {}),
    };

    if (this.app.queueManager) {
      try {
        await this.app.queueManager.enqueueInboundMessage(payload);
        return;
      } catch (error) {
        this.app.log.error(
          error,
          'failed to enqueue inbound message, falling back to direct processing',
        );
      }
    }

    await processInboundMessage(this.app, payload, {
      sendOutboundMessage: async (target, content) =>
        WhatsAppService.sendFromActiveSession(tenantId, target, content),
    });
  }

  async connect(tenantId: string, options: ConnectOptions = {}) {
    const mode: ConnectMode = options.mode ?? 'QR';
    const phoneForCode = options.phoneNumber
      ? WhatsAppService.normalizePairingPhone(options.phoneNumber)
      : undefined;

    if (mode === 'CODE' && !phoneForCode) {
      throw new AppError('phoneNumber is required when mode is CODE', 422);
    }

    if (mode === 'CODE' && phoneForCode && !WhatsAppService.isE164WithoutPlus(phoneForCode)) {
      throw new AppError('phoneNumber must be E.164 without plus sign', 422);
    }

    if (mode === 'CODE') {
      const existingSocket = WhatsAppService.sessions.get(tenantId);
      if (existingSocket) {
        try {
          existingSocket.end(undefined);
        } catch {
          // noop
        }
        WhatsAppService.sessions.delete(tenantId);
      }

      await clearRedisAuthState(this.app.redis, tenantId);

      await this.app.prisma.whatsAppSession.updateMany({
        where: { tenantId },
        data: {
          status: 'DISCONNECTED',
          qrCode: null,
          qrExpiresAt: null,
        },
      });
    }

    if (WhatsAppService.sessions.has(tenantId)) {
      const existing = await this.app.prisma.whatsAppSession.findUnique({ where: { tenantId } });
      const socket = WhatsAppService.sessions.get(tenantId);

      let pairingCode: string | null = null;
      if (mode === 'CODE' && phoneForCode && socket) {
        try {
          pairingCode = await this.requestPairingCode(tenantId, socket, phoneForCode);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to generate pairing code';
          throw new AppError(message, 409);
        }
      }

      return {
        status: existing?.status ?? 'CONNECTING',
        qrCode: existing?.qrCode ?? null,
        pairingCode,
      };
    }

    const { state, saveCreds } = await useRedisAuthState(this.app.redis, tenantId);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      auth: state,
      version,
      markOnlineOnConnect: false,
    });

    WhatsAppService.sessions.set(tenantId, socket);

    await this.app.prisma.whatsAppSession.upsert({
      where: { tenantId },
      create: {
        tenantId,
        status: 'CONNECTING',
      },
      update: {
        status: 'CONNECTING',
      },
    });

    socket.ev.on('creds.update', async () => {
      await saveCreds();
    });

    let pairingCode: string | null = null;
    let lastPairingError: string | null = null;
    let resolvePairingWait: (() => void) | null = null;
    const pairingWait = new Promise<void>((resolve) => {
      resolvePairingWait = resolve;
    });
    let pairingRequestInFlight = false;
    let pairingResolved = false;

    const tryRequestPairingCode = async () => {
      if (pairingResolved || pairingRequestInFlight || mode !== 'CODE' || !phoneForCode) {
        return;
      }

      pairingRequestInFlight = true;
      try {
        pairingCode = await this.requestPairingCode(tenantId, socket, phoneForCode);
        pairingResolved = true;
        resolvePairingWait?.();
      } catch (error) {
        lastPairingError =
          error instanceof Error ? error.message : 'Unable to generate pairing code';
        this.app.log.warn(error, 'pairing code request failed, waiting for next connection update');
      } finally {
        pairingRequestInFlight = false;
      }
    };

    socket.ev.on('connection.update', async (update) => {
      if (update.qr) {
        await this.app.prisma.whatsAppSession.update({
          where: { tenantId },
          data: {
            status: 'CONNECTING',
            qrCode: update.qr,
            qrExpiresAt: new Date(Date.now() + 60 * 1000),
          },
        });

        await tryRequestPairingCode();
      }

      if (update.connection === 'connecting') {
        await tryRequestPairingCode();
      }

      if (update.connection === 'open') {
        await this.app.prisma.whatsAppSession.update({
          where: { tenantId },
          data: {
            status: 'CONNECTED',
            qrCode: null,
            qrExpiresAt: null,
            lastConnectedAt: new Date(),
          },
        });

        await this.app.redis.del(`wa:session:${tenantId}:pairingCode`);

        await dispatchTenantWebhookEvent(this.app, {
          tenantId,
          event: WebhookEvent.WA_CONNECTED,
          payload: {
            connectedAt: new Date().toISOString(),
          },
        });
      }

      if (update.connection === 'close') {
        const shouldReconnect =
          (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
            ?.statusCode !== DisconnectReason.loggedOut;

        await this.app.prisma.whatsAppSession.update({
          where: { tenantId },
          data: {
            status: 'DISCONNECTED',
            lastDisconnectedAt: new Date(),
          },
        });

        WhatsAppService.sessions.delete(tenantId);

        await dispatchTenantWebhookEvent(this.app, {
          tenantId,
          event: WebhookEvent.WA_DISCONNECTED,
          payload: {
            disconnectedAt: new Date().toISOString(),
            shouldReconnect,
          },
        });

        if (mode === 'CODE' && !pairingResolved) {
          resolvePairingWait?.();
        }

        if (shouldReconnect) {
          void this.connect(tenantId);
        }
      }
    });

    socket.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        if (message.key.fromMe) {
          continue;
        }

        const text = getTextMessage(message.message);
        if (!text) {
          continue;
        }

        const contactPhone = extractContactPhoneFromMessageKey(message.key, message.message);
        if (!contactPhone) {
          this.app.log.warn(
            {
              remoteJid: message.key.remoteJid,
              participant: message.key.participant,
              key: message.key,
            },
            'unable to resolve inbound sender phone',
          );
          continue;
        }

        const waMessageId = message.key.id ?? undefined;

        try {
          await this.handleInboundMessage(tenantId, contactPhone, text, waMessageId);
        } catch (error) {
          this.app.log.error(error, 'failed to process inbound whatsapp message');
        }
      }
    });

    if (mode === 'CODE') {
      // Wait until connection.update reaches at least connecting or qr flow before requesting code.
      await Promise.race([
        pairingWait,
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ]);

      if (!pairingCode) {
        throw new AppError(
          lastPairingError ?? 'Pairing code was not generated. Keep WhatsApp open and try again.',
          409,
        );
      }
    }

    return {
      status: 'CONNECTING',
      qrCode: null,
      pairingCode,
    };
  }

  async status(tenantId: string) {
    const session = await this.app.prisma.whatsAppSession.findUnique({ where: { tenantId } });
    if (!session) {
      return { status: 'DISCONNECTED', qrCode: null, pairingCode: null };
    }

    const pairingCode = await this.app.redis.get(`wa:session:${tenantId}:pairingCode`);

    return {
      status: session.status,
      qrCode: session.qrCode,
      pairingCode,
      phoneNumber: session.phoneNumber,
      lastConnectedAt: session.lastConnectedAt,
      lastDisconnectedAt: session.lastDisconnectedAt,
    };
  }

  async disconnect(tenantId: string) {
    const socket = WhatsAppService.sessions.get(tenantId);
    if (socket) {
      try {
        await socket.logout();
      } catch {
        socket.end(undefined);
      }
      WhatsAppService.sessions.delete(tenantId);
    }

    await this.app.prisma.whatsAppSession.updateMany({
      where: { tenantId },
      data: {
        status: 'DISCONNECTED',
        lastDisconnectedAt: new Date(),
      },
    });

    await this.app.redis.del(`wa:session:${tenantId}:pairingCode`);

    return { status: 'DISCONNECTED' };
  }

  async sendMessage(tenantId: string, to: string, message: string) {
    const result = await WhatsAppService.sendFromActiveSession(tenantId, to, message);
    if (!result.sent) {
      throw new AppError(result.errorMessage ?? 'Sessao WhatsApp nao conectada', 409);
    }

    await dispatchTenantWebhookEvent(this.app, {
      tenantId,
      event: WebhookEvent.MESSAGE_SENT,
      payload: {
        to,
        message,
        sentAt: new Date().toISOString(),
        source: 'manual',
      },
    });

    return {
      status: 'sent',
      to,
      tenantId,
      sentAt: new Date().toISOString(),
    };
  }

  async reconnectSessions() {
    const sessions = await this.app.prisma.whatsAppSession.findMany({
      where: { status: 'CONNECTED' },
    });

    this.app.log.info(`Attempting to reconnect ${sessions.length} WhatsApp session(s)`);

    for (const session of sessions) {
      try {
        await this.connect(session.tenantId, { mode: 'QR' });
        this.app.log.info(`Reconnected session for tenantId: ${session.tenantId}`);
      } catch (error) {
        this.app.log.warn(error, `Failed to reconnect session for tenantId: ${session.tenantId}`);
      }
    }
  }

  // Graceful cleanup: close all active sessions and clear memory
  // Prevents memory leaks from singleton session map on shutdown
  static async closeSessions() {
    for (const [tenantId, socket] of WhatsAppService.sessions.entries()) {
      try {
        if (socket.ws) {
          socket.ws.close();
        }
        socket.end(new Error('Graceful shutdown'));
      } catch (error) {
        // Ignore errors during shutdown
        console.error(`Failed to close session for ${tenantId}:`, error);
      }
    }

    // Clear the session map to release memory
    WhatsAppService.sessions.clear();
  }
}
