// Generates the importable BOXER CUT // FLEX plan bundle: `npx vite-node scripts/plan-bundle.ts > boxer-cut-flex.liftdeck-plan.json`
import { buildPlanBundle } from '../src/lib/planBundle';
import { BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES } from '../src/data/seedPlan';
import { EXERCISE_LIBRARY } from '../src/data/exercises';

const bundle = buildPlanBundle(BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, EXERCISE_LIBRARY);
process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
