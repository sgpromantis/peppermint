import { prisma } from "../../../prisma";

/**
 * Hardcoded list of prohibited addresses.
 * Emails to these addresses are ALWAYS blocked, regardless of any configuration.
 */
export const PROHIBITED_ADDRESSES: string[] = [
  "pool@ticket.promantis.de",
];

/**
 * Loop prevention: Check if an email address belongs to a system-monitored mailbox
 * or is on the hardcoded prohibited list.
 * 
 * Prevents sending outgoing emails (confirmations, notifications) to addresses
 * that are monitored by the IMAP service or used as the SMTP sender.
 * Sending to such addresses would create an infinite loop:
 *   IMAP receives → creates ticket → sends confirmation → IMAP receives → ...
 * 
 * Checks against:
 * 0. Hardcoded prohibited addresses (ALWAYS blocked)
 * 1. All IMAP queue addresses (emailQueue.username)
 * 2. The SMTP sender address (email.user)
 * 3. The SMTP reply address (email.reply)
 */
export async function isSystemAddress(emailAddress: string): Promise<boolean> {
  if (!emailAddress) return false;

  const addr = emailAddress.toLowerCase().trim();

  // Check hardcoded prohibited addresses first
  if (PROHIBITED_ADDRESSES.includes(addr)) {
    console.warn(`[Loop Prevention] Blocked send to PROHIBITED address: ${addr}`);
    return true;
  }

  // Check IMAP queue addresses
  const queues = await prisma.emailQueue.findMany({
    select: { username: true },
  });
  const imapAddresses = queues.map(q => q.username.toLowerCase().trim());

  if (imapAddresses.includes(addr)) {
    console.warn(`[Loop Prevention] Blocked send to IMAP-monitored address: ${addr}`);
    return true;
  }

  // Check SMTP sender/reply addresses
  const smtpConfig = await prisma.email.findFirst({
    select: { user: true, reply: true },
  });

  if (smtpConfig) {
    if (smtpConfig.user && smtpConfig.user.toLowerCase().trim() === addr) {
      console.warn(`[Loop Prevention] Blocked send to SMTP sender address: ${addr}`);
      return true;
    }
    if (smtpConfig.reply && smtpConfig.reply.toLowerCase().trim() === addr) {
      console.warn(`[Loop Prevention] Blocked send to SMTP reply address: ${addr}`);
      return true;
    }
  }

  return false;
}
