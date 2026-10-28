import type { RunData } from '../base/run-site'
import { runPricing } from '../base/run-pricing'
import { repository } from './shell/repository'

/** Every string and command the run site's Run page (run-chest.com/run) shows. */
export const run: RunData = {
  name: 'Chest',
  repository,
  clone: 'npx -y @runeditrun/rer dev just-every/run-chest',
  licence: 'MIT',
  docs: true,
  paths: { product: null },
  pricing: runPricing,
}
