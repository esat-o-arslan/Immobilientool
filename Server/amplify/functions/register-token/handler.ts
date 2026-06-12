import { DynamoDBClient, ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, CreatePlatformEndpointCommand, SetEndpointAttributesCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

const db = new DynamoDBClient({});
const sns = new SNSClient({});

type TokenArgs = {
  userId?: string;
  userType?: string;
  deviceToken?: string;
  platform?: string;
};

const str = (v: { S?: string } | undefined): string => v?.S ?? '';

export const handler = async (event: { arguments?: TokenArgs }) => {
  const args = event.arguments ?? {};
  const PUSH_TOKEN_TABLE = process.env.PUSH_TOKEN_TABLE;
  const APNS_PLATFORM_APP_ARN = process.env.APNS_PLATFORM_APP_ARN;

  if (!PUSH_TOKEN_TABLE) return { ok: false, message: 'PUSH_TOKEN_TABLE nicht konfiguriert.' };
  if (!APNS_PLATFORM_APP_ARN || APNS_PLATFORM_APP_ARN === 'NOT_CONFIGURED') {
    return { ok: false, message: 'APNs ist für diese Installation nicht konfiguriert.' };
  }
  if (!args.userId || !args.deviceToken) return { ok: false, message: 'userId und deviceToken sind Pflichtfelder.' };

  const now = new Date().toISOString();

  // Vorhandenes Token für diesen User suchen
  const existing = await db.send(new ScanCommand({
    TableName: PUSH_TOKEN_TABLE,
    FilterExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': { S: args.userId } },
  }));
  const existingItem = existing.Items?.[0];
  const existingId = existingItem ? str(existingItem.id) : null;
  const existingArn = existingItem ? str(existingItem.snsEndpointArn) : null;
  const existingCreatedAt = existingItem ? str(existingItem.createdAt) : null;

  // SNS Platform Endpoint erstellen oder aktualisieren
  let endpointArn: string;
  try {
    if (existingArn) {
      await sns.send(new SetEndpointAttributesCommand({
        EndpointArn: existingArn,
        Attributes: { Token: args.deviceToken, Enabled: 'true' },
      }));
      endpointArn = existingArn;
    } else {
      const result = await sns.send(new CreatePlatformEndpointCommand({
        PlatformApplicationArn: APNS_PLATFORM_APP_ARN,
        Token: args.deviceToken,
        CustomUserData: `${args.userId}|${args.userType ?? 'mitarbeiter'}`,
      }));
      endpointArn = result.EndpointArn!;
    }
  } catch (err: any) {
    return { ok: false, message: `SNS Endpoint Fehler: ${err?.message ?? String(err)}` };
  }

  // Token in DynamoDB speichern — manuell marshalled (kein util-dynamodb)
  const id = existingId ?? randomUUID();
  await db.send(new PutItemCommand({
    TableName: PUSH_TOKEN_TABLE,
    Item: {
      id: { S: id },
      userId: { S: args.userId },
      userType: { S: args.userType ?? 'mitarbeiter' },
      deviceToken: { S: args.deviceToken },
      platform: { S: args.platform ?? 'ios' },
      snsEndpointArn: { S: endpointArn },
      aktiv: { BOOL: true },
      createdAt: { S: existingCreatedAt ?? now },
      updatedAt: { S: now },
      __typename: { S: 'PushToken' },
    },
  }));

  return { ok: true, endpointArn, message: 'Gerät erfolgreich registriert.' };
};
