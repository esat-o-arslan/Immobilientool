import { defineFunction } from '@aws-amplify/backend';

export const ftpUpload = defineFunction({
  name: 'ftp-upload',
  entry: './handler.ts',
  timeoutSeconds: 60,
});
