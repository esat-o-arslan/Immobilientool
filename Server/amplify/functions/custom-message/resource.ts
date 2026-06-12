import { defineFunction } from '@aws-amplify/backend';

export const customMessage = defineFunction({
  name: 'custom-message',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  resourceGroupName: 'auth',
});
