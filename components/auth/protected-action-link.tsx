"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthGateModal, ProtectedAction } from "@/components/auth/auth-gate-modal";

export function ProtectedActionLink({
  href,
  action,
  className,
  children
}: {
  href: string;
  action: ProtectedAction;
  className?: string;
  children: ReactNode;
}) {
  const { appUser, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!loading && appUser) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setShowModal(true)} className={className}>
        {children}
      </button>
      <AuthGateModal open={showModal} action={action} redirectPath={href} onClose={() => setShowModal(false)} />
    </>
  );
}
