import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'immobilienPortalStorage',
  access: (allow) => ({
    'schaeden/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'dokumente/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'mitarbeiter/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'schluessel/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'portal/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'formulare/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'profile-images/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'inserate/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  }),
});
