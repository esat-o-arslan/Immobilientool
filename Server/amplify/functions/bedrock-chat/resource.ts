import { defineFunction } from '@aws-amplify/backend';

export const bedrockChat = defineFunction({
  name: 'bedrock-chat',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 512,
});
