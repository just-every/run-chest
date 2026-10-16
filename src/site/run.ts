import type { RunData } from '../base/run-site'
import { repository } from './shell/repository'

/** Every string and command the run site's Run page (run-chest.com/run) shows. */
export const run: RunData = {
  name: 'Chest',
  repository,
  clone: 'npx -y @runeditrun/rer dev just-every/run-chest',
  folder: 'run-chest',
  requirements: 'Runs on macOS, Linux or Windows with WSL2, with git. The installer brings Node when it is missing, and rer brings pnpm.',
  licence: 'MIT',
  docs: true,
  hosted: [],
}
