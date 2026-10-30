// Normal rer verify retains the full existing native suite. CI selects a required
// shard from the same manifest; every shard remains in the workflow's final gate.
import { run, verificationPlan } from './verify-app.mjs';
const selected = process.env.SEED_VERIFY_SHARD;
if (!selected) {
  run('pnpm run build && pnpm run typecheck && pnpm run test:chest:core && pnpm run test:site');
} else {
  const plan = await verificationPlan();
  const shard = [...plan.push, ...plan.nightly].find(item => item.name === selected);
  if (!shard) throw Error(`Unknown verification shard: ${selected}`);
  for (const command of shard.commands) run(command);
}
