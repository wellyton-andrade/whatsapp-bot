import { MessageType } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type {
  InboundMessageJobData,
  InboundMessageJobResult,
} from '../../shared/queue/salesQueue.js';

type ConversationState = {
  flowId: string;
  currentStepId: string;
  variables: Record<string, string>;
};

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => variables[key] ?? '');
}

export async function processInboundMessage(
  app: FastifyInstance,
  payload: InboundMessageJobData,
): Promise<InboundMessageJobResult> {
  const now = new Date();

  const contact = await app.prisma.contact.upsert({
    where: {
      tenantId_phone: {
        tenantId: payload.tenantId,
        phone: payload.contactPhone,
      },
    },
    create: {
      tenantId: payload.tenantId,
      phone: payload.contactPhone,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      lastSeenAt: now,
    },
  });

  let conversation = await app.prisma.conversation.findFirst({
    where: {
      tenantId: payload.tenantId,
      contactId: contact.id,
      status: {
        in: ['ACTIVE', 'WAITING_INPUT'],
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeFlow = await app.prisma.flow.findFirst({
    where: { tenantId: payload.tenantId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!conversation) {
    conversation = await app.prisma.conversation.create({
      data: {
        tenantId: payload.tenantId,
        contactId: contact.id,
        ...(activeFlow?.id ? { flowId: activeFlow.id } : {}),
      },
    });
  }

  await app.prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: MessageType.TEXT,
      content: payload.message,
      ...(payload.waMessageId !== undefined ? { waMessageId: payload.waMessageId } : {}),
      status: 'SENT',
    },
  });

  if (!activeFlow) {
    return {
      processedAt: now.toISOString(),
      tenantId: payload.tenantId,
      contactPhone: payload.contactPhone,
      replySent: false,
    };
  }

  const stateKey = `conversation:state:${conversation.id}`;
  const currentStateRaw = await app.redis.get(stateKey);
  const currentState = currentStateRaw ? (JSON.parse(currentStateRaw) as ConversationState) : null;

  const steps = await app.prisma.flowStep.findMany({
    where: { flowId: activeFlow.id },
    include: {
      template: true,
      conditions: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  if (steps.length === 0) {
    return {
      processedAt: now.toISOString(),
      tenantId: payload.tenantId,
      contactPhone: payload.contactPhone,
      replySent: false,
    };
  }

  const variables: Record<string, string> = currentState?.variables ?? {};
  let currentStep =
    steps.find((step) => step.id === currentState?.currentStepId) ??
    steps.find((step) => step.waitForInput) ??
    steps[0];

  if (!currentStep) {
    return {
      processedAt: now.toISOString(),
      tenantId: payload.tenantId,
      contactPhone: payload.contactPhone,
      replySent: false,
    };
  }

  if (currentStep.inputVariable && currentStep.waitForInput) {
    variables[currentStep.inputVariable] = payload.message;
    const currentNextStepId = currentStep.nextStepId;
    const currentOrder = currentStep.order;
    const nextById = currentNextStepId ? steps.find((step) => step.id === currentNextStepId) : null;
    const nextByOrder = steps.find((step) => step.order > currentOrder);
    currentStep = nextById ?? nextByOrder ?? currentStep;
  }

  if (currentStep.type === 'CONDITIONAL' && currentStep.conditions.length > 0) {
    const normalized = payload.message.toLowerCase();
    for (const condition of currentStep.conditions) {
      const value = condition.value.toLowerCase();
      const matched =
        (condition.operator === 'EQUALS' && normalized === value) ||
        (condition.operator === 'CONTAINS' && normalized.includes(value)) ||
        (condition.operator === 'STARTS_WITH' && normalized.startsWith(value)) ||
        (condition.operator === 'IS_NUMBER' && !Number.isNaN(Number(payload.message))) ||
        (condition.operator === 'REGEX_MATCH' && new RegExp(condition.value).test(payload.message));

      if (matched) {
        const target = steps.find((step) => step.id === condition.nextStepId);
        if (target) {
          currentStep = target;
        }
        break;
      }
    }
  }

  let reply = '';

  if (currentStep.template) {
    if (
      currentStep.template.type === 'LIST' &&
      Array.isArray(currentStep.template.listItems) &&
      currentStep.template.listItems.length > 0
    ) {
      const options = currentStep.template.listItems
        .map((item, index) => {
          const parsed = item as { label?: string };
          return `${index + 1}. ${parsed.label ?? String(item)}`;
        })
        .join('\n');

      reply = `${renderTemplate(currentStep.template.content, variables)}\n\n${options}`;
    } else {
      reply = renderTemplate(currentStep.template.content, variables);
    }
  } else if (currentStep.invalidMessage) {
    reply = renderTemplate(currentStep.invalidMessage, variables);
  }

  if (reply) {
    await app.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: MessageType.TEXT,
        content: reply,
        status: 'SENT',
      },
    });
  }

  const nextStep = currentStep.nextStepId
    ? steps.find((step) => step.id === currentStep.nextStepId)
    : steps.find((step) => step.order > currentStep.order);

  await app.prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      currentStepId: nextStep?.id ?? currentStep.id,
      status: nextStep ? (nextStep.waitForInput ? 'WAITING_INPUT' : 'ACTIVE') : 'FINISHED',
      ...(nextStep ? {} : { endedAt: now }),
    },
  });

  const state: ConversationState = {
    flowId: activeFlow.id,
    currentStepId: nextStep?.id ?? currentStep.id,
    variables,
  };

  await app.redis.set(stateKey, JSON.stringify(state), 'EX', 60 * 60 * 24 * 7);

  return {
    processedAt: now.toISOString(),
    tenantId: payload.tenantId,
    contactPhone: payload.contactPhone,
    replySent: reply.length > 0,
  };
}
