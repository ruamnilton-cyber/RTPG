import { prisma } from "../lib/prisma";

export async function logAction(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
}) {
  await prisma.actionLog.create({ data: params });
}
