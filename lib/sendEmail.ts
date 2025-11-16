import "server-only";
import nodemailer from "nodemailer";
import path from "path";
import ejs from "ejs";
import { NextResponse } from "next/server";

interface SendEmailOptions {
  from: string;
  subject: string;
  templateName: string;
  templateData?: Record<string, unknown>;
  refreshToken: string;
  accessToken: string;
  attachments?: {
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType: string;
  }[];
}

export const sendEmail = async ({
  from,
  subject,
  templateName,
  templateData,
  attachments,
  refreshToken,
  accessToken,
}: SendEmailOptions) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: from,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: refreshToken,
        accessToken: accessToken,
      },
    });

    const templatePath = path.join(
      process.cwd(),
      "utils",
      "template",
      `${templateName}.ejs`
    );
    const html = await ejs.renderFile(templatePath, {
      emailBody: templateData,
    }).catch((renderError) => {
      console.error("EJS template rendering error:", renderError);
      throw new Error(`Template rendering failed: ${renderError.message}`);
    });
    const info = await transporter.sendMail({
      from: from,
      to: "lintworkspace@gmail.com",
      subject: subject,
      html: html,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        ...(attachment.content && { content: attachment.content }),
        ...(attachment.path && { path: attachment.path }),
        contentType: attachment.contentType,
      })),
    });
    console.log(`\u2709\uFE0F Email sent to ${from}: ${info.messageId}`);
    return NextResponse.json({ success: true, data: info });
  } catch (error: unknown) {
    console.error("email sending error", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : ("Unknown error" as string),
    };
  }
};
