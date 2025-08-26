// app/auth/callback.tsx
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function finishAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("✅ Login success:", session.user.email);
        router.replace("/"); // go to home
      } else {
        console.log("⚠️ No session found");
        router.replace("/signin");
      }
    }
    finishAuth();
  }, []);

  return null; // no UI needed
}
