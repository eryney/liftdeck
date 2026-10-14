// Generates the importable plan bundles:
//   npx vite-node scripts/plan-bundle.ts            > calisthenics-cut.liftdeck-plan.json
//   npx vite-node scripts/plan-bundle.ts boxer-cut  > boxer-cut-flex.liftdeck-plan.json
import { buildPlanBundle } from '../src/lib/planBundle';
import { BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, CALI_PLAN, CALI_TEMPLATES } from '../src/data/seedPlan';
import { EXERCISE_LIBRARY } from '../src/data/exercises';

const which = process.argv[2] ?? 'calisthenics-cut';
const bundle =
  which === 'boxer-cut'
    ? buildPlanBundle(BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, EXERCISE_LIBRARY)
    : buildPlanBundle(CALI_PLAN, CALI_TEMPLATES, EXERCISE_LIBRARY);
process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
