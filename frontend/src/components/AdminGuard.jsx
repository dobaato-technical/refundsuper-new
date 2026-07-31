"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthed } from "@/lib/auth";

/**
 * Client-side guard for /admin/* routes. Redirects unauthenticated visitors
 * to /admin/login. Renders nothing until the check has run to avoid flashing
 * protected content.
 */
export default function AdminGuard({ children }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      router.replace("/admin/login");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) return null;
  return children;
}
