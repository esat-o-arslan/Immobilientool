import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION ?? 'eu-central-1' });

type EmailArgs = {
  to?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(addr: string): boolean {
  return EMAIL_RE.test(addr) && addr.length <= 320;
}

export const handler = async (event: { arguments?: EmailArgs }) => {
  const args = event.arguments ?? {};
  const { to, subject, htmlBody, textBody } = args;

  if (!to || !subject) {
    return { ok: false, message: 'Empfänger und Betreff sind erforderlich.' };
  }
  if (!isValidEmail(to)) {
    return { ok: false, message: 'Ungültige Empfängeradresse.' };
  }
  if (args.replyTo && !isValidEmail(args.replyTo)) {
    return { ok: false, message: 'Ungültige Antwortadresse.' };
  }

  const fromEmail = process.env.FROM_EMAIL ?? 'info@example.invalid';

  try {
    await ses.send(new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          ...(htmlBody ? { Html: { Data: htmlBody, Charset: 'UTF-8' } } : {}),
          Text: { Data: textBody ?? subject, Charset: 'UTF-8' },
        },
      },
      ...(args.replyTo ? { ReplyToAddresses: [args.replyTo] } : {}),
    }));

    return { ok: true, message: `E-Mail erfolgreich an ${to} versendet.` };
  } catch (err: any) {
    console.error('SES Fehler:', err);
    return { ok: false, message: `E-Mail-Fehler: ${err?.message ?? String(err)}` };
  }
};
