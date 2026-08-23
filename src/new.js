import './env.js'

import { isCancel, cancel, text } from '@clack/prompts';
import * as items from  './items.js'

envReplace = [
  'ALIAJS_DEFAULT_LOCATION',
  'ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN',
]

// TODO SSH public key
// TODO check against other tools to see what they do to manage ssh access ... Capistrano, Pulumi,
// ? maybe ? https://claude.ai/chat/14e0ed8b-6e32-4792-b472-beffa6dc963a
// ssh-keygen -t ed25519 -C "process.env.ALIAJS_KEY_NAME" -f ~/.ssh/process.env.ALIAJS_KEY_NAME
// cat ~/.ssh/process.env.ALIAJS_KEY_NAME.pub

// for []

const value = await text({
  message: 'What is the meaning of life?',
})

// TODO setItems []

if (isCancel(value)) {
  cancel('Operation cancelled.');
  process.exit(0);
}
