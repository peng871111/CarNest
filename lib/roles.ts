import { UserRole } from "@/types";

export const ROLE_PLACEHOLDERS: Array<{
  role: UserRole;
  title: string;
  description: string;
}> = [
  {
    role: "buyer",
    title: "Buyer",
    description: "Browse inventory, save interest, and prepare for offers and viewing requests in a later phase."
  },
  {
    role: "seller",
    title: "Seller",
    description: "List vehicles through CarNest and manage approvals once seller tools are added in the next phase."
  },
  {
    role: "admin",
    title: "Admin",
    description: "Oversee vehicle approvals and marketplace operations when the admin console is introduced."
  }
];
