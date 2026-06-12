import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { sendInvite } from './functions/send-invite/resource';
import { sendPush } from './functions/send-push/resource';
import { registerToken } from './functions/register-token/resource';
import { ftpUpload } from './functions/ftp-upload/resource';
import { bedrockChat } from './functions/bedrock-chat/resource';
import { sendEmail } from './functions/send-email/resource';
import { customMessage } from './functions/custom-message/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  sendInvite,
  sendPush,
  registerToken,
  ftpUpload,
  bedrockChat,
  sendEmail,
  customMessage,
  storage,
});

// USER_PASSWORD_AUTH für iOS App aktivieren
backend.auth.resources.cfnResources.cfnUserPoolClient.explicitAuthFlows = [
  'ALLOW_USER_SRP_AUTH',
  'ALLOW_USER_PASSWORD_AUTH',
  'ALLOW_REFRESH_TOKEN_AUTH',
];

// send-invite: Cognito Rechte
backend.sendInvite.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: [
    'cognito-idp:AdminCreateUser',
    'cognito-idp:AdminGetUser',
    'cognito-idp:AdminUpdateUserAttributes',
  ],
  resources: [backend.auth.resources.userPool.userPoolArn],
}));
backend.sendInvite.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);

// send-push: SNS Rechte
backend.sendPush.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['sns:Publish'],
  resources: ['*'],
}));

// register-token: SNS Rechte
backend.registerToken.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: [
    'sns:CreatePlatformEndpoint',
    'sns:SetEndpointAttributes',
    'sns:GetEndpointAttributes',
  ],
  resources: ['*'],
}));

// PushToken-Tabelle ohne hardcodierten Stack-Namen anbinden.
const pushTokenTable = backend.data.resources.tables['PushToken'];
pushTokenTable.grantReadWriteData(backend.sendPush.resources.lambda);
pushTokenTable.grantReadWriteData(backend.registerToken.resources.lambda);
backend.sendPush.addEnvironment('PUSH_TOKEN_TABLE', pushTokenTable.tableName);
backend.registerToken.addEnvironment('PUSH_TOKEN_TABLE', pushTokenTable.tableName);

// APNs ist optional. Ohne ARN bleibt die App nutzbar, nur Push-Registrierung ist deaktiviert.
const APNS_ARN = process.env.APNS_PLATFORM_APP_ARN ?? 'NOT_CONFIGURED';
backend.registerToken.addEnvironment('APNS_PLATFORM_APP_ARN', APNS_ARN);

// bedrock-chat: Bedrock InvokeModel in us-east-1
// eu-central-1 Cross-Region Inference: Wildcard nötig, da Inference-Profile eigene ARNs haben
backend.bedrockChat.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['bedrock:InvokeModel'],
  resources: ['*'],
}));

// send-email: SES Rechte
// WICHTIG: Die Absenderadresse (FROM_EMAIL) muss in AWS SES verifiziert sein.
// AWS Console → SES → Verified identities → "info@example.invalid" verifizieren.
backend.sendEmail.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],
}));
const BRAND_NAME = process.env.BRAND_NAME ?? 'Immobilientool';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'info@example.invalid';
const CONTACT_PHONE = process.env.CONTACT_PHONE ?? '+41 00 000 00 00';
const CONTACT_ADDRESS = process.env.CONTACT_ADDRESS ?? 'Musterstrasse 1, 4000 Basel';
const PORTAL_URL = process.env.PORTAL_URL ?? 'https://example.invalid';

backend.sendEmail.addEnvironment('FROM_EMAIL', CONTACT_EMAIL);
backend.customMessage.addEnvironment('BRAND_NAME', BRAND_NAME);
backend.customMessage.addEnvironment('CONTACT_EMAIL', CONTACT_EMAIL);
backend.customMessage.addEnvironment('CONTACT_PHONE', CONTACT_PHONE);
backend.customMessage.addEnvironment('CONTACT_ADDRESS', CONTACT_ADDRESS);
backend.customMessage.addEnvironment('PORTAL_URL', PORTAL_URL);
