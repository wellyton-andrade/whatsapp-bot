import path from 'node:path';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../shared/errors/appError.js';

type SessionMap = Map<string, WASocket>;

function getTextMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const msg = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
  };

  return msg.conversation ?? msg.extendedTextMessage?.text ?? null;
}

function toJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

export class WhatsAppService {
  private static sessions: SessionMap = new Map();

  constructor(private readonly app: FastifyInstance) {}

  async connect(tenantId: string) {
    if (WhatsAppService.sessions.has(tenantId)) {
      const existing = await this.app.prisma.whatsAppSession.findUnique({ where: { tenantId } });
      return {
        status: existing?.status ?? 'CONNECTING',
        qrCode: existing?.qrCode ?? null,
      };
    }

    const sessionDir = path.join(process.cwd(), '.wa-sessions', tenantId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
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
      await this.app.redis.set(`wa:session:${tenantId}:creds`, JSON.stringify(state.creds));
    });

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

        const remoteJid = message.key.remoteJid;
        if (!remoteJid) {
          continue;
        }

        const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

        if (this.app.queueManager) {
          await this.app.queueManager.enqueueInboundMessage({
            tenantId,
            contactPhone,
            message: text,
            ...(message.key.id ? { waMessageId: message.key.id } : {}),
          });
        }
      }
    });

    return {
      status: 'CONNECTING',
      qrCode: null,
    };
  }

  async status(tenantId: string) {
    const session = await this.app.prisma.whatsAppSession.findUnique({ where: { tenantId } });
    if (!session) {
      return { status: 'DISCONNECTED', qrCode: null };
    }

    return {
      status: session.status,
      qrCode: session.qrCode,
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

    return { status: 'DISCONNECTED' };
  }

  async sendMessage(tenantId: string, to: string, message: string) {
    const socket = WhatsAppService.sessions.get(tenantId);
    if (!socket) {
      throw new AppError('Sessao WhatsApp nao conectada', 409);
    }

    const jid = toJid(to);
    await socket.sendMessage(jid, { text: message });

    return {
      status: 'sent',
      to,
      tenantId,
      sentAt: new Date().toISOString(),
    };
  }
}
