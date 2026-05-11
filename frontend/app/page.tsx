'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Role } from "@/types/api";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
      } else {
        let target = "/dashboard";
        if (user.role === Role.SR) target = "/sr-dashboard";
        else if (user.role === Role.MANAGER) target = "/manager-dashboard";
        else if (user.role === Role.DELIVERY_MAN) target = "/my-deliveries";
        router.push(target);
      }
    }
  }, [user, isLoading, router]);

  return null;
}
