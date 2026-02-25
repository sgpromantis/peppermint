import { prisma } from "../prisma";

/**
 * Get the next ticket number based on MAX(Number) + 1.
 * This ensures sequential numbering even when tickets are deleted.
 */
export async function getNextTicketNumber(): Promise<number> {
  const result = await prisma.ticket.aggregate({
    _max: {
      Number: true,
    },
  });

  return (result._max.Number ?? 0) + 1;
}

/**
 * Reset the PostgreSQL sequence to match the current max ticket number.
 * This is useful if the sequence gets out of sync.
 */
export async function resetTicketNumberSequence(): Promise<{
  maxNumber: number;
  sequenceReset: boolean;
}> {
  const result = await prisma.ticket.aggregate({
    _max: {
      Number: true,
    },
  });

  const maxNumber = result._max.Number ?? 0;

  // Reset the PostgreSQL sequence to continue from maxNumber + 1
  await prisma.$executeRaw`SELECT setval('"Ticket_Number_seq"', ${maxNumber}, true)`;

  return {
    maxNumber,
    sequenceReset: true,
  };
}
