// Package scripts in the historical checkout use the same supported queue and CLI as this test.
import {main} from '@runeditrun/rer/internal/cli/main.mjs';
import {queuedCommandLine} from '@runeditrun/rer/queued-entry';
process.exitCode=await (process.argv[2]==='queue'?queuedCommandLine(process.argv.slice(3)):main(process.argv.slice(2)));
