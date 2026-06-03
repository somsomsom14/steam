import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";
import { OnboardingClient } from "./OnboardingClient";

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) redirect("/");

  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();
  const { data: user } = await supabase
    .from("users")
    .select("steam_nickname, steam_avatar_url")
    .eq("id", session.userId)
    .single();

  return (
    <OnboardingClient
      steamNickname={user?.steam_nickname ?? ""}
      steamAvatarUrl={user?.steam_avatar_url ?? ""}
    />
  );
}
