import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const uid = urlObj.searchParams.get("uid") || undefined;
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL,
  );
  const url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh token
    // scope: ["https://www.googleapis.com/auth/gmail.send"],
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://mail.google.com/", // <-- this is full access (optional but strong)
    ],
    state: uid,
  });
  return NextResponse.redirect(url);
}
