type CognitoCustomMessageEvent = {
  triggerSource: string;
  userName: string;
  request: {
    userAttributes: Record<string, string>;
    codeParameter?: string;
    usernameParameter?: string;
    linkParameter?: string;
  };
  response: {
    smsMessage?: string | null;
    emailMessage?: string | null;
    emailSubject?: string | null;
  };
};

const BRAND_NAME = process.env.BRAND_NAME ?? 'Immobilientool';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'info@example.invalid';
const CONTACT_PHONE = process.env.CONTACT_PHONE ?? '+41 00 000 00 00';
const CONTACT_ADDRESS = process.env.CONTACT_ADDRESS ?? 'Musterstrasse 1, 4000 Basel';
const PORTAL_URL = process.env.PORTAL_URL ?? 'https://example.invalid';

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${BRAND_NAME} Portal</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- Logo-Header -->
  <tr>
    <td style="background:#0e1d32;padding:32px 40px 28px;border-radius:14px 14px 0 0;text-align:center;">
      <p style="margin:0 0 4px;font-size:26px;color:#ffffff;letter-spacing:2px;font-weight:500;font-family:Georgia,serif;">${BRAND_NAME}</p>
      <p style="margin:0;font-size:9px;color:#475569;letter-spacing:4px;text-transform:uppercase;">Verwaltungsportal</p>
    </td>
  </tr>

  <!-- Farbstreifen -->
  <tr>
    <td style="height:4px;background:linear-gradient(90deg,#1e40af 0%,#3b82f6 50%,#1e40af 100%);"></td>
  </tr>

  <!-- Content -->
  <tr>
    <td style="background:#ffffff;padding:44px 44px 36px;">
      ${content}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;padding:28px 44px;border-radius:0 0 14px 14px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;line-height:2;">
        <strong style="color:#64748b;">${BRAND_NAME}</strong><br>
        ${CONTACT_ADDRESS}<br>
        <span style="color:#94a3b8;">${CONTACT_PHONE}</span>
        &nbsp;·&nbsp;
        <a href="mailto:${CONTACT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${CONTACT_EMAIL}</a>
      </p>
      <p style="margin:12px 0 0;color:#cbd5e1;font-size:10px;">Automatisch generierte Nachricht — bitte nicht direkt antworten.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function stepBadge(n: string): string {
  return `<span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#1e40af;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;margin-right:10px;vertical-align:middle;">${n}</span>`;
}

export const handler = async (event: CognitoCustomMessageEvent): Promise<CognitoCustomMessageEvent> => {
  const { triggerSource, request } = event;
  const rawName  = request.userAttributes?.name || request.userAttributes?.given_name || '';
  const name     = esc(rawName);
  const greeting = name ? `Guten Tag, ${name}` : 'Guten Tag';

  // ── Einladung (Admin hat Benutzer angelegt) ────────────────────────────
  if (triggerSource === 'CustomMessage_AdminCreateUser') {
    event.response.emailSubject = `Willkommen bei ${BRAND_NAME} – Ihre Zugangsdaten`;
    event.response.emailMessage = layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0e1d32;">${greeting} 👋</h1>
      <p style="margin:0 0 6px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Willkommen im ${BRAND_NAME} Verwaltungsportal</p>

      <p style="margin:20px 0 24px;font-size:15px;color:#374151;line-height:1.75;">
        Ihr persönlicher Zugang zum Verwaltungsportal wurde eingerichtet.
        Über das Portal können Sie Schadensmeldungen einreichen, Dokumente einsehen,
        Termine verwalten und direkt mit unserem Team kommunizieren.
      </p>

      <!-- Zugangsdaten-Box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:28px 24px;">
            <p style="margin:0 0 16px;font-size:11px;color:#0369a1;font-weight:700;text-transform:uppercase;letter-spacing:2px;text-align:center;">
              🔐 Ihre Zugangsdaten
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e0f2fe;">
                  <span style="font-size:12px;color:#64748b;font-weight:600;">BENUTZERNAME&nbsp;(E-Mail)</span>
                  <p style="margin:4px 0 0;font-size:15px;color:#0e1d32;font-weight:600;">{username}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 0;">
                  <span style="font-size:12px;color:#64748b;font-weight:600;">TEMPORÄRES PASSWORT</span>
                  <p style="margin:8px 0 0;font-size:28px;font-weight:800;letter-spacing:8px;color:#1e40af;font-family:'Courier New',Courier,monospace;text-align:center;">
                    {####}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA Button -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="${PORTAL_URL}" style="display:inline-block;background:#1e40af;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.5px;">
              → Jetzt zum Portal anmelden
            </a>
          </td>
        </tr>
      </table>

      <!-- Erste Schritte -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f8fafc;border-radius:10px;padding:20px;">
        <tr><td style="padding:0 0 14px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;">So geht's weiter:</p>
        </td></tr>
        <tr><td style="padding:6px 0;">${stepBadge('1')} <span style="font-size:14px;color:#374151;">Portal öffnen: <a href="${PORTAL_URL}" style="color:#1e40af;text-decoration:none;">${PORTAL_URL}</a></span></td></tr>
        <tr><td style="padding:6px 0;">${stepBadge('2')} <span style="font-size:14px;color:#374151;">Benutzername (E-Mail) und obiges temporäres Passwort eingeben</span></td></tr>
        <tr><td style="padding:6px 0;">${stepBadge('3')} <span style="font-size:14px;color:#374151;">Beim ersten Login neues persönliches Passwort festlegen</span></td></tr>
        <tr><td style="padding:6px 0;">${stepBadge('4')} <span style="font-size:14px;color:#374151;">Portal erkunden — bei Fragen stehen wir gerne zur Verfügung</span></td></tr>
      </table>

      <!-- Passwort-Anforderungen -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:14px 18px;">
            <p style="margin:0;color:#713f12;font-size:13px;line-height:1.7;">
              <strong>Passwort-Anforderungen:</strong> Mindestens 8 Zeichen, Gross- und Kleinbuchstaben,
              mindestens eine Ziffer und ein Sonderzeichen (z.B. <code style="background:#fef9c3;padding:1px 4px;border-radius:3px;">!@#$%</code>).
            </p>
          </td>
        </tr>
      </table>

      <!-- Sicherheitshinweis -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;">
            <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.65;">
              <strong>Sicherheitshinweis:</strong> Teilen Sie Ihre Zugangsdaten nie mit anderen Personen.
              Das Portal-Team wird Sie <strong>niemals</strong> nach Ihrem Passwort fragen.
            </p>
          </td>
        </tr>
      </table>
    `);
  }

  // ── Passwort vergessen ─────────────────────────────────────────────────
  if (triggerSource === 'CustomMessage_ForgotPassword') {
    event.response.emailSubject = `Ihr Bestätigungscode – ${BRAND_NAME} Portal`;
    event.response.emailMessage = layout(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0e1d32;">${greeting},</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.75;">
        Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. Hier ist Ihr Bestätigungscode:
      </p>

      <!-- Code Box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:32px 24px;text-align:center;">
            <p style="margin:0 0 10px;font-size:11px;color:#0369a1;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Bestätigungscode</p>
            <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:14px;color:#1e40af;font-family:'Courier New',Courier,monospace;">{####}</p>
            <p style="margin:12px 0 0;font-size:12px;color:#64748b;">Gültig für 60 Minuten</p>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <a href="${PORTAL_URL}" style="display:inline-block;background:#1e40af;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;">
              → Zum Portal (Passwort zurücksetzen)
            </a>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;">
            <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.65;">
              Falls Sie diese Anfrage <strong>nicht selbst ausgelöst</strong> haben, ignorieren Sie diese E-Mail.
              Ihr Passwort bleibt unverändert. Bei Verdacht auf unbefugten Zugriff kontaktieren Sie uns unter
              <a href="mailto:${CONTACT_EMAIL}" style="color:#dc2626;">${CONTACT_EMAIL}</a>.
            </p>
          </td>
        </tr>
      </table>
    `);
  }

  // ── E-Mail-Adresse verifizieren ────────────────────────────────────────
  if (triggerSource === 'CustomMessage_VerifyUserAttribute' || triggerSource === 'CustomMessage_UpdateUserAttribute') {
    event.response.emailSubject = `E-Mail-Adresse bestätigen – ${BRAND_NAME} Portal`;
    event.response.emailMessage = layout(`
      <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#0e1d32;">${greeting},</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.75;">
        Bitte bestätigen Sie Ihre E-Mail-Adresse mit folgendem Code:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:28px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;color:#0369a1;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Bestätigungscode</p>
            <p style="margin:0;font-size:38px;font-weight:800;letter-spacing:12px;color:#1e40af;font-family:'Courier New',Courier,monospace;">{####}</p>
          </td>
        </tr>
      </table>
    `);
  }

  return event;
};
