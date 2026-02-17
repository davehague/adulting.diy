// server/api/sendEmail.ts
import Mailjet from "node-mailjet";

const mailjet = new Mailjet({
  apiKey: process.env.MJ_APIKEY_PUBLIC,
  apiSecret: process.env.MJ_APIKEY_PRIVATE,
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { to, subject, html } = body;
  try {
    const request = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: "dave@promptblocks.app",
            Name: "David Hague",
          },
          To: [
            {
              Email: `${to}`,
              Name: `${to}`,
            },
          ],
          Subject: `${subject}`,
          HTMLPart: `${html}`,
        },
      ],
    });

    return {
      success: true,
      message: "Email sent successfully",
    };
  } catch (error) {
    console.error(
      "Failed to send email with error:",
      error instanceof Error ? error.message : error
    );
    return {
      success: false,
      message: "Failed to send email",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
