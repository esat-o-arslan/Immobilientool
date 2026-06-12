import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { sendInvite } from '../functions/send-invite/resource';
import { sendPush } from '../functions/send-push/resource';
import { registerToken } from '../functions/register-token/resource';
import { ftpUpload } from '../functions/ftp-upload/resource';
import { bedrockChat } from '../functions/bedrock-chat/resource';
import { sendEmail } from '../functions/send-email/resource';

const authenticated = (allow: any) => [allow.authenticated()];

const schema = a.schema({
  Liegenschaft: a.model({
    liegenschaftNummer: a.string().required(),
    name: a.string().required(),
    strasse: a.string().required(),
    plz: a.string().required(),
    ort: a.string().required(),
    typ: a.string().default('Mietliegenschaft'),
    status: a.string().default('Aktiv'),
    zustand: a.string(),
    zustandText: a.string(),
    verwalterId: a.string(),
    verwaltungsbeginn: a.date(),
    einheiten: a.integer().default(1),
  }).authorization(authenticated),

  KontaktPerson: a.model({
    liegenschaftId: a.string().required(),
    vorname: a.string(),
    nachname: a.string(),
    name: a.string().required(),
    rolle: a.string().required(),
    email: a.string().required(),
    telefon: a.string(),
    adresse: a.string(),
    kontoStatus: a.string().default('Nicht eingeladen'),
    wohnungsNummer: a.string(),
    stockwerk: a.string(),
    cognitoSub: a.string(),
    portalSichtbar: a.boolean().default(true),
  }).authorization(authenticated),

  Mitarbeiter: a.model({
    name: a.string().required(),
    funktion: a.string().required(),
    email: a.string().required(),
    telefon: a.string(),
    rolle: a.string().default('Mitarbeiter'),
    gruppe: a.string().default('Mitarbeiter'),
    rechteExtra: a.string().array(),
    rechteEntzogen: a.string().array(),
    status: a.string().default('Aktiv'),
    photoUrl: a.string(),
    adresse: a.string(),
    kinder: a.integer().default(0),
    jahreslohn: a.float(),
    lohnSichtbar: a.boolean().default(false),
    teamSichtbar: a.boolean().default(false),
    teamSortierung: a.integer().default(100),
    cognitoSub: a.string(),
    urlaubsKontingent: a.integer().default(25),
    eintrittsdatum: a.date(),
  }).authorization(authenticated),

  Rolle: a.model({
    name: a.string().required(),
    beschreibung: a.string(),
    rechte: a.string().array(),
  }).authorization(authenticated),

  Schadenfall: a.model({
    fallNummer: a.string(),
    titel: a.string().required(),
    beschreibung: a.string().required(),
    status: a.enum(['OFFEN', 'IN_BEARBEITUNG', 'OFFERTEN_EINGEHOLT', 'HANDWERKER_BEAUFTRAGT', 'BELEG_NACHGEREICHT', 'ERLEDIGT', 'ARCHIVIERT']),
    prioritaet: a.string().default('Normal'),
    kategorie: a.string().default('Schaden'),
    liegenschaftId: a.string(),
    personId: a.string(),
    handwerkerId: a.string(),
    liegenschaftAdresse: a.string().required(),
    plzOrt: a.string().required(),
    fotoUrl: a.string(),
    bilder: a.string().array(),
    gemeldetVon: a.string(),
    frist: a.date(),
    verantwortlicherMitarbeiterId: a.string(),
  }).authorization(authenticated),

  ChatMessage: a.model({
    schadenfallId: a.string(),
    liegenschaftId: a.string(),
    personId: a.string(),
    absender: a.string().required(),
    absenderTyp: a.string().default('mitarbeiter'),
    nachricht: a.string().required(),
    zeitstempel: a.datetime(),
  }).authorization(authenticated),

  Dokument: a.model({
    liegenschaftId: a.string().required(),
    personId: a.string(),
    belegId: a.string(),
    mitarbeiterId: a.string(),
    titel: a.string().required(),
    kategorie: a.string().required(),
    jahr: a.integer().required(),
    dateiname: a.string().required(),
    dateiUrl: a.string(),
    version: a.integer().default(1),
    freigabeStatus: a.string().default('Intern'),
    volltext: a.string(),
    sichtbarFuerKunden: a.boolean().default(false),
  }).authorization(authenticated),

  KalenderTermin: a.model({
    titel: a.string().required(),
    typ: a.string().required(),
    liegenschaftId: a.string().required(),
    personIds: a.string().array(),
    handwerkerId: a.string(),
    mitarbeiterIds: a.string().array(),
    start: a.datetime().required(),
    ende: a.datetime().required(),
    ort: a.string(),
    beschreibung: a.string(),
    erinnerungMinuten: a.integer().default(1440),
    sichtbarInApp: a.boolean().default(true),
    status: a.string().default('Geplant'),
  }).authorization(authenticated),

  Handwerker: a.model({
    firma: a.string().required(),
    gewerk: a.string().required(),
    kontaktperson: a.string(),
    email: a.string(),
    telefon: a.string(),
    notfallTelefon: a.string(),
    adresse: a.string(),
    einsatzgebiet: a.string(),
    bewertung: a.float(),
    stundensatz: a.float(),
    status: a.string().default('Aktiv'),
    bemerkung: a.string(),
  }).authorization(authenticated),

  Schluessel: a.model({
    liegenschaftId: a.string().required(),
    personId: a.string(),
    handwerkerId: a.string(),
    bezeichnung: a.string().required(),
    nummer: a.string().required(),
    anzahl: a.integer().default(1),
    objekt: a.string(),
    schliessung: a.string(),
    standort: a.string(),
    status: a.string().default('Verfügbar'),
    ausgegebenAn: a.string(),
    ausgegebenAm: a.date(),
    rueckgabeAm: a.date(),
    empfaengerTyp: a.string(),
    empfaengerName: a.string(),
    empfaengerAdresse: a.string(),
    ausgabeOrt: a.string(),
    ausgegebenVon: a.string(),
    letzteBewegungAm: a.datetime(),
    bemerkung: a.string(),
    quittungDokumentId: a.string(),
    quittungDateiUrl: a.string(),
    quittungDateiname: a.string(),
    unterschriebeneQuittungDokumentId: a.string(),
    unterschriebeneQuittungDateiUrl: a.string(),
    unterschriebeneQuittungDateiname: a.string(),
    verlaufJson: a.string(),
  }).authorization(authenticated),

  Abschluss: a.model({
    liegenschaftId: a.string().required(),
    personId: a.string(),
    titel: a.string().required(),
    jahr: a.integer().required(),
    kategorie: a.string().required(),
    dateiname: a.string().required(),
    dateiUrl: a.string(),
    sichtbarFuerEigentuemer: a.boolean().default(true),
    sichtbarFuerMieter: a.boolean().default(false),
  }).authorization(authenticated),

  PortalInhalt: a.model({
    bereich: a.string().required(),
    titel: a.string().required(),
    inhalt: a.string(),
    sortierung: a.integer().default(100),
    sichtbar: a.boolean().default(true),
  }).authorization(authenticated),

  StammdatenAenderung: a.model({
    personId: a.string(),
    mitarbeiterId: a.string(),
    feld: a.string().required(),
    alterWert: a.string(),
    neuerWert: a.string().required(),
    status: a.string().default('Offen'),
    eingereichtVon: a.string().required(),
    geprueftVon: a.string(),
    notiz: a.string(),
  }).authorization(authenticated),

  Einladung: a.model({
    email: a.string().required(),
    rolle: a.string().required(),
    zielTyp: a.string().required(),
    zielId: a.string().required(),
    status: a.string().default('Ausstehend'),
    gesendetAm: a.datetime(),
    createdBy: a.string(),
    tempPasswordHinweis: a.string(),
  }).authorization(authenticated),

  MitarbeiterDokument: a.model({
    mitarbeiterId: a.string().required(),
    titel: a.string().required(),
    kategorie: a.string().required(),
    jahr: a.integer().required(),
    dateiname: a.string().required(),
    dateiUrl: a.string(),
    vertraulich: a.boolean().default(true),
  }).authorization(authenticated),

  DokumentVorlage: a.model({
    titel: a.string().required(),
    kategorie: a.string().default('Allgemein'),
    beschreibung: a.string(),
    status: a.string().default('Entwurf'),
    datenquelle: a.string(),
    felderJson: a.string(),
    vorlageDateiUrl: a.string(),
    sortierung: a.integer().default(100),
  }).authorization(authenticated),

  SendInviteResult: a.customType({
    ok: a.boolean(),
    message: a.string(),
    username: a.string(),
    status: a.string(),
  }),

  sendInvite: a
    .mutation()
    .arguments({
      email: a.string().required(),
      rolle: a.string().required(),
      zielTyp: a.string().required(),
      zielId: a.string().required(),
      name: a.string(),
    })
    .returns(a.ref('SendInviteResult'))
    .handler(a.handler.function(sendInvite))
    .authorization(authenticated),

  // ── Push-Benachrichtigungen ────────────────────────────────────────────────

  PushToken: a.model({
    userId: a.string().required(),
    userType: a.string().required(),   // 'mitarbeiter' | 'kunde'
    deviceToken: a.string().required(),
    platform: a.string().default('ios'),
    snsEndpointArn: a.string(),
    aktiv: a.boolean().default(true),
  }).authorization(authenticated),

  PushResult: a.customType({
    ok: a.boolean(),
    message: a.string(),
    endpointArn: a.string(),
  }),

  registriereGeraetToken: a
    .mutation()
    .arguments({
      userId: a.string().required(),
      userType: a.string().required(),
      deviceToken: a.string().required(),
      platform: a.string(),
    })
    .returns(a.ref('PushResult'))
    .handler(a.handler.function(registerToken))
    .authorization(authenticated),

  FtpUploadResult: a.customType({
    ok: a.boolean(),
    message: a.string(),
  }),

  ftpUpload: a
    .mutation()
    .arguments({
      xmlContent: a.string().required(),
      zipFileName: a.string(),
      ftpHost: a.string().required(),
      ftpPort: a.integer(),
      ftpUser: a.string().required(),
      ftpPassword: a.string().required(),
      ftpRemotePath: a.string(),
      ftpSecure: a.boolean(),
    })
    .returns(a.ref('FtpUploadResult'))
    .handler(a.handler.function(ftpUpload))
    .authorization(authenticated),

  sendePushBenachrichtigung: a
    .mutation()
    .arguments({
      empfaengerId: a.string(),
      empfaengerTyp: a.string().required(),
      titel: a.string().required(),
      nachricht: a.string().required(),
      daten: a.string(),
    })
    .returns(a.ref('PushResult'))
    .handler(a.handler.function(sendPush))
    .authorization(authenticated),

  // ── E-Mail via SES ────────────────────────────────────────────────────────

  EmailResult: a.customType({
    ok: a.boolean(),
    message: a.string(),
  }),

  sendEmail: a
    .mutation()
    .arguments({
      to:       a.string().required(),
      subject:  a.string().required(),
      htmlBody: a.string(),
      textBody: a.string(),
      replyTo:  a.string(),
    })
    .returns(a.ref('EmailResult'))
    .handler(a.handler.function(sendEmail))
    .authorization(authenticated),

  // ── Bedrock KI ────────────────────────────────────────────────────────────

  BedrockChatResult: a.customType({
    ok: a.boolean(),
    antwort: a.string(),
    aktionen: a.string(),   // JSON-Array von KI-vorgeschlagenen Aktionen
  }),

  bedrockChat: a
    .mutation()
    .arguments({
      messages:     a.string().required(),  // JSON-Array [{role, content}]
      systemPrompt: a.string(),             // view-spezifischer Kontext
      kontext:      a.string(),             // zusätzliche Strukturinfos
    })
    .returns(a.ref('BedrockChatResult'))
    .handler(a.handler.function(bedrockChat))
    .authorization(authenticated),

  // ── Urlaubsanträge ─────────────────────────────────────────────────────────

  UrlaubsAntrag: a.model({
    mitarbeiterId: a.string(),
    mitarbeiterName: a.string().required(),
    email: a.string(),
    startDatum: a.date().required(),
    endDatum: a.date().required(),
    anzahlTage: a.float(),
    typ: a.string().default('Ferien'),          // Ferien | Krank | Überzeitabbau | Sonstiges
    status: a.string().default('Ausstehend'),   // Ausstehend | Genehmigt | Abgelehnt
    beschreibung: a.string(),
    antragsDatum: a.datetime(),
    genehmigungsNotiz: a.string(),
    genehmigtVon: a.string(),
    genehmigtAm: a.datetime(),
    quelle: a.string().default('Portal'),       // Portal | App
  }).authorization(authenticated),

  // ── Zeiterfassung (Sync aus App) ───────────────────────────────────────────

  ZeiterfassungEintrag: a.model({
    mitarbeiterId: a.string(),
    email: a.string(),
    appEntryId: a.string(),
    startZeit: a.datetime().required(),
    endZeit: a.datetime(),
    startOrt: a.string(),
    endOrt: a.string(),
    pauseMinuten: a.integer().default(0),
    istUrlaub: a.boolean().default(false),
    istKrank: a.boolean().default(false),
    istUeberzeitabbau: a.boolean().default(false),
    ueberzeitAbbauStunden: a.float().default(0),
    istGesperrt: a.boolean().default(false),
  }).authorization(authenticated),

  SpesenSyncEintrag: a.model({
    mitarbeiterId: a.string(),
    email: a.string(),
    appEntryId: a.string(),
    datum: a.date().required(),
    titel: a.string().required(),
    betrag: a.float(),
    kategorie: a.string(),
    status: a.string().default('Eingereicht'),  // Eingereicht | Genehmigt | Abgelehnt
  }).authorization(authenticated),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
