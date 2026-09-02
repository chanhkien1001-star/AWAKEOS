/** CLI entry: `npm run demo`. */
import { runDemo } from './run-demo.ts';

runDemo({ log: (line) => console.log(line) })
  .then((r) => {
    console.log(`\n✓ demo complete — ${r.interventions} Awareness Window(s), ${r.silences} Silence(s), ${r.mirror.observableFacts.length} mirror fact(s)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
