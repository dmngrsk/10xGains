import { registerAuthCommands } from './commands/auth';
import { registerElementCommands } from './commands/elements';
import { registerMaterialCommands } from './commands/material';
import { registerNavigationCommands } from './commands/navigation';

// Custom Cypress commands, grouped by concern in ./commands/*. Imported for its side effects
// from support/e2e.ts, which registers every command before the specs run.
registerAuthCommands();
registerNavigationCommands();
registerElementCommands();
registerMaterialCommands();
