import { defineFunction } from '@aws-amplify/backend';

export const registerToken = defineFunction({
  name: 'register-token',
  entry: './handler.ts',
  timeoutSeconds: 15,
});
