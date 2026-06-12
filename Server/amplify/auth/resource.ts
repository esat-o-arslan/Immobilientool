import { defineAuth } from '@aws-amplify/backend';
import { customMessage } from '../functions/custom-message/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  triggers: {
    customMessage,
  },
});
