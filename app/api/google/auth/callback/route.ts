import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL,
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateUid = req.nextUrl.searchParams.get("state");
  const { tokens } = await oAuth2Client.getToken(code as string);
  oAuth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  console.log("oauth2callback profile-> ", profile);

  const userEmail = profile.data.emailAddress;
  console.log("oauth2callback userEmail-> ", userEmail);
  console.log("✅ Logged in Gmail:", userEmail);

  if (!stateUid) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (tokens.refresh_token) {
    await supabase
      .from("user_tokens")
      .upsert(
        { user_id: stateUid, refresh_token: tokens.refresh_token, email: userEmail },
        { onConflict: "user_id" }
      );
  }

  return NextResponse.redirect(new URL("/", req.url));
}
