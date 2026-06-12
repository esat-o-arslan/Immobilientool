import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});

type InviteArguments = {
  email?: string;
  rolle?: string;
  zielTyp?: string;
  zielId?: string;
  name?: string;
};

const normalizeEmail = (email?: string) => email?.trim().toLowerCase() ?? '';

const userAttributes = (email: string, name?: string) => [
  { Name: 'email', Value: email },
  { Name: 'email_verified', Value: 'true' },
  ...(name?.trim() ? [{ Name: 'name', Value: name.trim() }] : []),
];

export const handler = async (event: { arguments?: InviteArguments }) => {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) throw new Error('USER_POOL_ID fehlt in der Lambda-Umgebung.');

  const args = event.arguments ?? {};
  const email = normalizeEmail(args.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Bitte eine gültige E-Mail-Adresse angeben.');
  }

  const attributes = userAttributes(email, args.name);

  try {
    const created = await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: attributes,
      DesiredDeliveryMediums: ['EMAIL'],
    }));

    return {
      ok: true,
      message: 'Cognito Einladung wurde per E-Mail versendet.',
      username: created.User?.Username ?? email,
      status: 'Versendet',
    };
  } catch (error: any) {
    if (error?.name !== 'UsernameExistsException') throw error;
  }

  await client.send(new AdminUpdateUserAttributesCommand({
    UserPoolId: userPoolId,
    Username: email,
    UserAttributes: attributes,
  }));

  try {
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: attributes,
      DesiredDeliveryMediums: ['EMAIL'],
      MessageAction: MessageActionType.RESEND,
    }));

    return {
      ok: true,
      message: 'Cognito Einladung wurde erneut per E-Mail versendet.',
      username: email,
      status: 'Erneut versendet',
    };
  } catch (error: any) {
    await client.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: email,
    }));

    return {
      ok: true,
      message: 'Benutzer existiert bereits in Cognito. Attribute wurden aktualisiert.',
      username: email,
      status: 'Bereits vorhanden',
    };
  }
};
