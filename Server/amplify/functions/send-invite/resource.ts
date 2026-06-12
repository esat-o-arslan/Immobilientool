import { defineFunction } from '@aws-amplify/backend';

export const sendInvite = defineFunction({
  name: 'send-invite',
  entry: './handler.ts',
  timeoutSeconds: 20,
  memoryMB: 512,
});
