/**
 * ID Generation Utilities
 */

/** Generate a team ID like "TEAM-A3F7" */
export function generateTeamId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TEAM-${code}`;
}

/** Generate an invite ID like "INV-8K2M5X" */
export function generateInviteId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `INV-${code}`;
}
