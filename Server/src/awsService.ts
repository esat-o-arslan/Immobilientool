import * as AmplifyApi from 'aws-amplify/api';
import outputs from '../amplify_outputs.json';

const client = (AmplifyApi as any).generateClient ? (AmplifyApi as any).generateClient() : null;

type GraphQLResult = { data?: any; errors?: any[] };

async function gql(query: string, variables?: Record<string, any>) {
  if (!client?.graphql) throw new Error('Amplify API client nicht verfügbar');
  return (await client.graphql({ query, variables })) as GraphQLResult;
}

export type CloudLoadResult = {
  ok: boolean;
  data: Record<string, any[]>;
  errors: string[];
};

const selections: Record<string, string> = {
  Liegenschaft: 'id liegenschaftNummer name strasse plz ort typ status zustand zustandText verwalterId verwaltungsbeginn einheiten createdAt updatedAt',
  KontaktPerson: 'id liegenschaftId vorname nachname name rolle email telefon adresse wohnungsNummer stockwerk kontoStatus cognitoSub portalSichtbar createdAt updatedAt',
  Mitarbeiter: 'id name funktion email telefon rolle gruppe rechteExtra rechteEntzogen status photoUrl adresse kinder jahreslohn lohnSichtbar teamSichtbar teamSortierung cognitoSub urlaubsKontingent eintrittsdatum createdAt updatedAt',
  Rolle: 'id name beschreibung rechte createdAt updatedAt',
  Schadenfall: 'id fallNummer titel beschreibung status prioritaet kategorie liegenschaftId personId liegenschaftAdresse plzOrt fotoUrl gemeldetVon frist verantwortlicherMitarbeiterId handwerkerId createdAt updatedAt',
  ChatMessage: 'id schadenfallId liegenschaftId personId absender absenderTyp nachricht zeitstempel createdAt updatedAt',
  Dokument: 'id liegenschaftId personId belegId mitarbeiterId titel kategorie jahr dateiname dateiUrl version freigabeStatus volltext sichtbarFuerKunden createdAt updatedAt',
  KalenderTermin: 'id titel typ liegenschaftId personIds handwerkerId mitarbeiterIds start ende ort beschreibung erinnerungMinuten sichtbarInApp status createdAt updatedAt',
  Handwerker: 'id firma gewerk kontaktperson email telefon notfallTelefon adresse einsatzgebiet bewertung stundensatz status bemerkung createdAt updatedAt',
  Schluessel: 'id liegenschaftId personId handwerkerId bezeichnung nummer anzahl objekt schliessung standort status ausgegebenAn ausgegebenAm rueckgabeAm empfaengerTyp empfaengerName empfaengerAdresse ausgabeOrt ausgegebenVon letzteBewegungAm bemerkung quittungDokumentId quittungDateiUrl quittungDateiname unterschriebeneQuittungDokumentId unterschriebeneQuittungDateiUrl unterschriebeneQuittungDateiname verlaufJson createdAt updatedAt',
  Abschluss: 'id liegenschaftId personId titel jahr kategorie dateiname dateiUrl sichtbarFuerEigentuemer sichtbarFuerMieter createdAt updatedAt',
  PortalInhalt: 'id bereich titel inhalt sortierung sichtbar createdAt updatedAt',
  StammdatenAenderung: 'id personId mitarbeiterId feld alterWert neuerWert status eingereichtVon geprueftVon notiz createdAt updatedAt',
  Einladung: 'id email rolle zielTyp zielId status gesendetAm createdBy tempPasswordHinweis createdAt updatedAt',
  UrlaubsAntrag: 'id mitarbeiterId mitarbeiterName email startDatum endDatum anzahlTage typ status beschreibung antragsDatum genehmigungsNotiz genehmigtVon genehmigtAm quelle createdAt updatedAt',
  ZeiterfassungEintrag: 'id mitarbeiterId email appEntryId startZeit endZeit startOrt endOrt pauseMinuten istUrlaub istKrank istUeberzeitabbau ueberzeitAbbauStunden istGesperrt createdAt updatedAt',
  SpesenSyncEintrag: 'id mitarbeiterId email appEntryId datum titel betrag kategorie status createdAt updatedAt',
  MitarbeiterDokument: 'id mitarbeiterId titel kategorie jahr dateiname dateiUrl vertraulich createdAt updatedAt',
  DokumentVorlage: 'id titel kategorie beschreibung status datenquelle felderJson vorlageDateiUrl sortierung createdAt updatedAt',
};

const outputModels = (outputs as any)?.data?.model_introspection?.models ?? {};
const pluralFor = (model: string) => outputModels[model]?.pluralName ?? `${model}s`;

// Mit nextToken-Pagination — AppSync gibt ohne Limit max. 100 Einträge zurück
const pluralQuery = (model: string) => {
  const plural = pluralFor(model);
  return `query List${plural}($nextToken: String, $limit: Int) {
    list${plural}(nextToken: $nextToken, limit: $limit) {
      items { ${selections[model]} }
      nextToken
    }
  }`;
};
const createMutation = (model: string) => `mutation Create${model}($input: Create${model}Input!) { create${model}(input: $input) { ${selections[model]} } }`;
const updateMutation = (model: string) => `mutation Update${model}($input: Update${model}Input!) { update${model}(input: $input) { ${selections[model]} } }`;
const deleteMutation = (model: string) => `mutation Delete${model}($input: Delete${model}Input!) { delete${model}(input: $input) { id } }`;

const CORE_FIELDS: Partial<Record<string, string>> = {
  Mitarbeiter: 'id name funktion email telefon rolle gruppe rechteExtra rechteEntzogen status photoUrl adresse kinder jahreslohn lohnSichtbar teamSichtbar teamSortierung cognitoSub createdAt updatedAt',
};

function isUnknownFieldError(errors: any[]): boolean {
  return errors.some((e: any) => {
    const msg = String(e?.message ?? '').toLowerCase();
    return msg.includes('cannot query field') || msg.includes('unknown field') || msg.includes('did you mean') || msg.includes('field') && msg.includes('exist');
  });
}

export async function ladeModellAWS(model: keyof typeof selections) {
  const plural    = pluralFor(model);
  const query     = pluralQuery(model);
  const alleItems: any[] = [];
  let nextToken: string | null = null;

  do {
    const result: GraphQLResult = await gql(query, { nextToken, limit: 1000 });

    // Schema-Mismatch: neues Feld noch nicht deployed → Fallback auf Kernfelder
    if (result.errors && isUnknownFieldError(result.errors)) {
      const fallbackFields = CORE_FIELDS[model];
      if (fallbackFields) {
        const fbQuery = `query List${plural}($nextToken: String, $limit: Int) {
          list${plural}(nextToken: $nextToken, limit: $limit) { items { ${fallbackFields} } nextToken }
        }`;
        let fbToken: string | null = null;
        do {
          const fbResult: GraphQLResult = await gql(fbQuery, { nextToken: fbToken, limit: 1000 });
          if (fbResult.errors) break;
          const page = fbResult.data?.[`list${plural}`];
          alleItems.push(...(page?.items?.filter(Boolean) ?? []));
          fbToken = page?.nextToken ?? null;
        } while (fbToken);
        return alleItems;
      }
      throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
    }

    if (result.errors) {
      throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
    }

    const page = result.data?.[`list${plural}`];
    alleItems.push(...(page?.items?.filter(Boolean) ?? []));
    nextToken = page?.nextToken ?? null;

  } while (nextToken);

  return alleItems;
}

export async function ladeKontaktPersonenAWS() {
  return ladeModellAWS('KontaktPerson');
}

export async function ladeAWSArbeitsdaten(): Promise<CloudLoadResult> {
  const models = Object.keys(selections) as (keyof typeof selections)[];
  const data: Record<string, any[]> = {};
  const errors: string[] = [];
  await Promise.all(models.map(async (model) => {
    try {
      data[model] = await ladeModellAWS(model);
    } catch (error: any) {
      data[model] = [];
      errors.push(`${model}: ${error?.message ?? String(error)}`);
    }
  }));
  return { ok: errors.length === 0, data, errors };
}

export async function createAWS(model: keyof typeof selections, input: Record<string, any>) {
  const result = await gql(createMutation(model), { input });
  if (result.errors) {
    const error = new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    console.error(`createAWS ${model} failed:`, error, 'Input:', input, 'Result:', result);
    throw error;
  }
  const created = result.data?.[`create${model}`];
  if (!created?.id) {
    const error = new Error(`AWS create returned no ${model}`);
    console.error(`createAWS ${model} returned empty result:`, error, 'Input:', input, 'Result:', result);
    throw error;
  }
  return created;
}

export async function updateAWS(model: keyof typeof selections, input: Record<string, any>) {
  const result = await gql(updateMutation(model), { input });
  if (result.errors) {
    const error = new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    console.error(`updateAWS ${model} failed:`, error, 'Input:', input, 'Result:', result);
    throw error;
  }

  const updated = result.data?.[`update${model}`];
  if (!updated?.id) {
    const error = new Error(`AWS update returned no ${model}; create fallback required`);
    console.warn(`updateAWS ${model} returned empty result:`, 'Input:', input, 'Result:', result);
    throw error;
  }

  return updated;
}

export async function deleteAWS(model: keyof typeof selections, id: string) {
  const result = await gql(deleteMutation(model), { input: { id } });
  if (result.errors) {
    const error = new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    console.error(`deleteAWS ${model} failed:`, error, 'Id:', id, 'Result:', result);
    throw error;
  }

  return result.data?.[`delete${model}`];
}

export async function sendeAWSChatNachricht(inputOrSchadenfallId: Record<string, any> | string, text?: string) {
  const input = typeof inputOrSchadenfallId === 'string'
    ? { schadenfallId: inputOrSchadenfallId, absender: 'Verwaltung', absenderTyp: 'mitarbeiter', nachricht: text ?? '' }
    : inputOrSchadenfallId;
  return createAWS('ChatMessage', {
    ...input,
    zeitstempel: new Date().toISOString(),
  });
}

export async function sendePushBenachrichtigung(input: {
  empfaengerId?: string;
  empfaengerTyp: 'mitarbeiter' | 'kunde' | 'alle-mitarbeiter';
  titel: string;
  nachricht: string;
  daten?: Record<string, any>;
}) {
  const result = await gql(`mutation SendePush($empfaengerTyp: String!, $titel: String!, $nachricht: String!, $empfaengerId: String, $daten: String) {
    sendePushBenachrichtigung(empfaengerTyp: $empfaengerTyp, titel: $titel, nachricht: $nachricht, empfaengerId: $empfaengerId, daten: $daten) {
      ok message
    }
  }`, {
    empfaengerTyp: input.empfaengerTyp,
    titel: input.titel,
    nachricht: input.nachricht,
    empfaengerId: input.empfaengerId,
    daten: input.daten ? JSON.stringify(input.daten) : undefined,
  });
  if (result.errors) {
    console.warn('Push-Benachrichtigung Fehler:', result.errors.map((e: any) => e.message).join(', '));
  }
  return result.data?.sendePushBenachrichtigung;
}

export async function ftpUploadInserat(input: {
  xmlContent: string;
  zipFileName: string;
  ftpHost: string;
  ftpPort?: number;
  ftpUser: string;
  ftpPassword: string;
  ftpRemotePath?: string;
  ftpSecure?: boolean;
}) {
  const result = await gql(`mutation FtpUpload(
    $xmlContent: String!, $zipFileName: String,
    $ftpHost: String!, $ftpPort: Int, $ftpUser: String!, $ftpPassword: String!,
    $ftpRemotePath: String, $ftpSecure: Boolean
  ) {
    ftpUpload(xmlContent: $xmlContent, zipFileName: $zipFileName,
      ftpHost: $ftpHost, ftpPort: $ftpPort, ftpUser: $ftpUser, ftpPassword: $ftpPassword,
      ftpRemotePath: $ftpRemotePath, ftpSecure: $ftpSecure) {
      ok message
    }
  }`, input);
  if (result.errors) {
    console.error('FTP Upload Fehler:', result.errors.map((e: any) => e.message).join(', '));
  }
  return result.data?.ftpUpload;
}

export async function registriereGeraetToken(input: {
  userId: string;
  userType: 'mitarbeiter' | 'kunde';
  deviceToken: string;
  platform?: string;
}) {
  const result = await gql(`mutation RegistriereToken($userId: String!, $userType: String!, $deviceToken: String!, $platform: String) {
    registriereGeraetToken(userId: $userId, userType: $userType, deviceToken: $deviceToken, platform: $platform) {
      ok endpointArn message
    }
  }`, input);
  if (result.errors) {
    console.warn('Token-Registrierung Fehler:', result.errors.map((e: any) => e.message).join(', '));
  }
  return result.data?.registriereGeraetToken;
}

export async function erstelleEinladungsauftrag(input: Record<string, any>) {
  const result = await gql(`mutation SendInvite($email: String!, $rolle: String!, $zielTyp: String!, $zielId: String!, $name: String) {
    sendInvite(email: $email, rolle: $rolle, zielTyp: $zielTyp, zielId: $zielId, name: $name) {
      ok
      message
      username
      status
    }
  }`, {
    email: input.email,
    rolle: input.rolle,
    zielTyp: input.zielTyp,
    zielId: input.zielId,
    name: input.name,
  });

  if (result.errors) {
    throw new Error(`AWS Einladung konnte nicht versendet werden: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data?.sendInvite;
}

export async function sendeEmail(input: {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
}) {
  const result = await gql(`mutation SendEmail($to: String!, $subject: String!, $htmlBody: String, $textBody: String, $replyTo: String) {
    sendEmail(to: $to, subject: $subject, htmlBody: $htmlBody, textBody: $textBody, replyTo: $replyTo) {
      ok message
    }
  }`, input);
  if (result.errors) {
    console.error('E-Mail Fehler:', result.errors.map((e: any) => e.message).join(', '));
  }
  return result.data?.sendEmail as { ok: boolean; message: string } | undefined;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type KIAktion = {
  typ: string;
  beschreibung: string;
  daten: Record<string, any>;
};

export async function bedrockChatAnfrage(
  messages: ChatMessage[],
  systemPrompt?: string,
  kontext?: string,
): Promise<{ ok: boolean; antwort: string; aktionen: KIAktion[] }> {
  const result = await gql(`
    mutation BedrockChat($messages: String!, $systemPrompt: String, $kontext: String) {
      bedrockChat(messages: $messages, systemPrompt: $systemPrompt, kontext: $kontext) {
        ok
        antwort
        aktionen
      }
    }
  `, {
    messages: JSON.stringify(messages),
    systemPrompt: systemPrompt ?? null,
    kontext: kontext ?? null,
  });

  if (result.errors) {
    return { ok: false, antwort: `KI-Fehler: ${result.errors.map((e: any) => e.message).join(', ')}`, aktionen: [] };
  }

  const raw = result.data?.bedrockChat ?? { ok: false, antwort: 'Keine Antwort.', aktionen: null };
  let aktionen: KIAktion[] = [];
  if (raw.aktionen) {
    try { aktionen = JSON.parse(raw.aktionen); } catch { /* ignore */ }
  }
  return { ...raw, aktionen };
}
