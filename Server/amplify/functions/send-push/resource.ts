import { defineFunction } from '@aws-amplify/backend';

export const sendPush = defineFunction({
  name: 'send-push',
  entry: './handler.ts',
  timeoutSeconds: 15,
});
