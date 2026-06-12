import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const db = new DynamoDBClient({});
const sns = new SNSClient({});

type PushArgs = {
  empfaengerId?: string;
  empfaengerTyp?: string;
  titel?: string;
  nachricht?: string;
  daten?: string;
};

// Extract string value from DynamoDB AttributeValue without util-dynamodb
const str = (v: { S?: string } | undefined): string => v?.S ?? '';
const bool = (v: { BOOL?: boolean } | undefined): boolean => v?.BOOL ?? false;

export const handler = async (event: { arguments?: PushArgs }) => {
  const args = event.arguments ?? {};
  const PUSH_TOKEN_TABLE = process.env.PUSH_TOKEN_TABLE;
  if (!PUSH_TOKEN_TABLE) return { ok: false, message: 'PUSH_TOKEN_TABLE nicht konfiguriert.' };

  const titel = args.titel ?? 'Immobilientool';
  const nachricht = args.nachricht ?? '';
  const daten = args.daten ? JSON.parse(args.daten) : {};

  let endpointArns: string[] = [];

  if (args.empfaengerTyp === 'alle-mitarbeiter') {
    const result = await db.send(new ScanCommand({
      TableName: PUSH_TOKEN_TABLE,
      FilterExpression: 'userType = :t AND aktiv = :a',
      ExpressionAttributeValues: {
        ':t': { S: 'mitarbeiter' },
        ':a': { BOOL: true },
      },
    }));
    endpointArns = (result.Items ?? [])
      .map((item: Record<string, any>) => str(item.snsEndpointArn))
      .filter(Boolean);
  } else if (args.empfaengerId) {
    const result = await db.send(new ScanCommand({
      TableName: PUSH_TOKEN_TABLE,
      FilterExpression: 'userId = :uid AND aktiv = :a',
      ExpressionAttributeValues: {
        ':uid': { S: args.empfaengerId },
        ':a': { BOOL: true },
      },
    }));
    endpointArns = (result.Items ?? [])
      .map((item: Record<string, any>) => str(item.snsEndpointArn))
      .filter(Boolean);
  }

  if (endpointArns.length === 0) {
    return { ok: true, message: 'Kein registriertes Gerät gefunden.' };
  }

  const apnsPayload = JSON.stringify({
    APNS: JSON.stringify({
      aps: { alert: { title: titel, body: nachricht }, sound: 'default', badge: 1 },
      data: daten,
    }),
    APNS_SANDBOX: JSON.stringify({
      aps: { alert: { title: titel, body: nachricht }, sound: 'default', badge: 1 },
      data: daten,
    }),
    default: `${titel}: ${nachricht}`,
  });

  let sent = 0;
  for (const arn of endpointArns) {
    try {
      await sns.send(new PublishCommand({
        TargetArn: arn,
        Message: apnsPayload,
        MessageStructure: 'json',
      }));
      sent++;
    } catch (err: any) {
      console.warn(`SNS publish failed for ${arn}:`, err?.message);
    }
  }

  return { ok: true, message: `Push an ${sent}/${endpointArns.length} Gerät(e) gesendet.` };
};
