import type { Exercise } from '../types';

type Row = [
  id: string,
  name: string,
  category: Exercise['category'],
  equipment: Exercise['equipment'],
  flags?: { perHand?: boolean; perSide?: boolean; bodyweight?: boolean; compound?: boolean; timed?: boolean },
];

/** The original v1 library. Order and ids are stable; never remove from here. */
const V1_ROWS: Row[] = [
  // ── Chest ─────────────────────────────────────────────
  ['db-bench-press', 'Dumbbell Bench Press', 'Chest', 'dumbbell', { perHand: true, compound: true }],
  ['db-incline-press', 'Dumbbell Incline Bench Press', 'Chest', 'dumbbell', { perHand: true, compound: true }],
  ['db-fly', 'Dumbbell Fly', 'Chest', 'dumbbell', { perHand: true }],
  ['db-incline-fly', 'Dumbbell Incline Fly', 'Chest', 'dumbbell', { perHand: true }],
  ['bb-bench-press', 'Barbell Bench Press', 'Chest', 'barbell', { compound: true }],
  ['bb-incline-press', 'Barbell Incline Bench Press', 'Chest', 'barbell', { compound: true }],
  ['cable-chest-press', 'Cable Chest Press', 'Chest', 'cable', { compound: true }],
  ['cable-fly', 'Cable Fly / Crossover', 'Chest', 'cable'],
  ['push-up', 'Push-Up', 'Chest', 'bodyweight', { bodyweight: true, compound: true }],
  ['dip', 'Dip', 'Chest', 'bodyweight', { bodyweight: true, compound: true }],
  ['machine-chest-press', 'Machine Chest Press', 'Chest', 'machine', { compound: true }],
  ['pec-deck', 'Pec Deck', 'Chest', 'machine'],
  // ── Back ──────────────────────────────────────────────
  ['pull-up', 'Pull-Up', 'Back', 'bodyweight', { bodyweight: true, compound: true }],
  ['chin-up', 'Chin-Up', 'Back', 'bodyweight', { bodyweight: true, compound: true }],
  ['neutral-grip-pull-up', 'Neutral-Grip Pull-Up', 'Back', 'bodyweight', { bodyweight: true, compound: true }],
  ['lat-pulldown', 'Lat Pulldown', 'Back', 'cable', { compound: true }],
  ['db-one-arm-row', 'One-Arm Dumbbell Row', 'Back', 'dumbbell', { perSide: true, compound: true }],
  ['db-row', 'Dumbbell Row (two-arm)', 'Back', 'dumbbell', { perHand: true, compound: true }],
  ['bb-row', 'Barbell Row', 'Back', 'barbell', { compound: true }],
  ['cable-row', 'Seated Cable Row', 'Back', 'cable', { compound: true }],
  ['cable-pullover', 'Cable Pullover', 'Back', 'cable'],
  ['db-pullover', 'Dumbbell Pullover', 'Back', 'dumbbell'],
  ['inverted-row', 'Inverted Row', 'Back', 'bodyweight', { bodyweight: true, compound: true }],
  ['machine-row', 'Machine Row', 'Back', 'machine', { compound: true }],
  ['bb-deadlift', 'Barbell Deadlift', 'Back', 'barbell', { compound: true }],
  ['back-extension', 'Back Extension', 'Back', 'bodyweight', { bodyweight: true }],
  // ── Shoulders ─────────────────────────────────────────
  ['db-lateral-raise', 'Dumbbell Lateral Raise', 'Shoulders', 'dumbbell', { perHand: true }],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'Shoulders', 'cable', { perSide: true }],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders', 'dumbbell', { perHand: true, compound: true }],
  ['bb-overhead-press', 'Barbell Overhead Press', 'Shoulders', 'barbell', { compound: true }],
  ['db-rear-delt-fly', 'Dumbbell Rear-Delt Fly', 'Shoulders', 'dumbbell', { perHand: true }],
  ['cable-rear-delt-fly', 'Cable Rear-Delt Fly', 'Shoulders', 'cable'],
  ['face-pull', 'Cable Face Pull', 'Shoulders', 'cable'],
  ['db-front-raise', 'Dumbbell Front Raise', 'Shoulders', 'dumbbell', { perHand: true }],
  ['db-upright-row', 'Dumbbell Upright Row', 'Shoulders', 'dumbbell', { perHand: true }],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'Shoulders', 'machine', { compound: true }],
  ['machine-lateral-raise', 'Machine Lateral Raise', 'Shoulders', 'machine'],
  ['db-shrug', 'Dumbbell Shrug', 'Shoulders', 'dumbbell', { perHand: true }],
  // ── Biceps ────────────────────────────────────────────
  ['db-curl', 'Dumbbell Curl', 'Biceps', 'dumbbell', { perHand: true }],
  ['cable-curl', 'Cable Curl', 'Biceps', 'cable'],
  ['db-hammer-curl', 'Dumbbell Hammer Curl', 'Biceps', 'dumbbell', { perHand: true }],
  ['db-incline-curl', 'Dumbbell Incline Curl', 'Biceps', 'dumbbell', { perHand: true }],
  ['db-concentration-curl', 'Concentration Curl', 'Biceps', 'dumbbell', { perSide: true }],
  ['bb-curl', 'Barbell Curl', 'Biceps', 'barbell'],
  ['ez-bar-curl', 'EZ-Bar Curl', 'Biceps', 'barbell'],
  ['cable-hammer-curl', 'Cable Hammer Curl (rope)', 'Biceps', 'cable'],
  ['preacher-curl', 'Preacher Curl (machine)', 'Biceps', 'machine'],
  // ── Triceps ───────────────────────────────────────────
  ['cable-triceps-pushdown', 'Cable Triceps Pushdown', 'Triceps', 'cable'],
  ['cable-overhead-triceps', 'Overhead Cable Triceps Extension', 'Triceps', 'cable'],
  ['db-overhead-triceps', 'Dumbbell Overhead Triceps Extension', 'Triceps', 'dumbbell'],
  ['db-skullcrusher', 'Dumbbell Skullcrusher', 'Triceps', 'dumbbell', { perHand: true }],
  ['db-kickback', 'Dumbbell Kickback', 'Triceps', 'dumbbell', { perSide: true }],
  ['close-grip-bench', 'Close-Grip Bench Press', 'Triceps', 'barbell', { compound: true }],
  ['bench-dip', 'Bench Dip', 'Triceps', 'bodyweight', { bodyweight: true }],
  ['diamond-push-up', 'Diamond Push-Up', 'Triceps', 'bodyweight', { bodyweight: true }],
  // ── Quads ─────────────────────────────────────────────
  ['db-bulgarian-split-squat', 'Dumbbell Bulgarian Split Squat', 'Quads', 'dumbbell', { perHand: true, perSide: true, compound: true }],
  ['db-goblet-squat', 'Goblet Squat', 'Quads', 'dumbbell', { compound: true }],
  ['db-lunge', 'Dumbbell Lunge', 'Quads', 'dumbbell', { perHand: true, perSide: true, compound: true }],
  ['db-step-up', 'Dumbbell Step-Up', 'Quads', 'dumbbell', { perHand: true, perSide: true, compound: true }],
  ['bb-back-squat', 'Barbell Back Squat', 'Quads', 'barbell', { compound: true }],
  ['bb-front-squat', 'Barbell Front Squat', 'Quads', 'barbell', { compound: true }],
  ['leg-press', 'Leg Press', 'Quads', 'machine', { compound: true }],
  ['leg-extension', 'Leg Extension', 'Quads', 'machine'],
  ['bodyweight-squat', 'Bodyweight Squat', 'Quads', 'bodyweight', { bodyweight: true, compound: true }],
  ['pistol-squat', 'Pistol Squat', 'Quads', 'bodyweight', { bodyweight: true, perSide: true, compound: true }],
  // ── Hamstrings ────────────────────────────────────────
  ['db-rdl', 'Dumbbell Romanian Deadlift', 'Hamstrings', 'dumbbell', { perHand: true, compound: true }],
  ['bb-rdl', 'Barbell Romanian Deadlift', 'Hamstrings', 'barbell', { compound: true }],
  ['db-single-leg-rdl', 'Single-Leg Dumbbell RDL', 'Hamstrings', 'dumbbell', { perSide: true, compound: true }],
  ['leg-curl', 'Leg Curl (machine)', 'Hamstrings', 'machine'],
  ['nordic-curl', 'Nordic Hamstring Curl', 'Hamstrings', 'bodyweight', { bodyweight: true }],
  ['cable-pull-through', 'Cable Pull-Through', 'Hamstrings', 'cable', { compound: true }],
  // ── Glutes ────────────────────────────────────────────
  ['db-hip-thrust', 'Dumbbell Hip Thrust', 'Glutes', 'dumbbell', { compound: true }],
  ['single-leg-hip-thrust', 'Single-Leg Hip Thrust', 'Glutes', 'bodyweight', { bodyweight: true, perSide: true, compound: true }],
  ['bb-hip-thrust', 'Barbell Hip Thrust', 'Glutes', 'barbell', { compound: true }],
  ['glute-bridge', 'Glute Bridge', 'Glutes', 'bodyweight', { bodyweight: true }],
  ['cable-kickback', 'Cable Glute Kickback', 'Glutes', 'cable', { perSide: true }],
  ['hip-abduction', 'Hip Abduction (machine)', 'Glutes', 'machine'],
  // ── Calves ────────────────────────────────────────────
  ['standing-calf-raise', 'Standing Calf Raise', 'Calves', 'bodyweight', { bodyweight: true }],
  ['db-calf-raise', 'Dumbbell Calf Raise', 'Calves', 'dumbbell', { perHand: true }],
  ['single-leg-calf-raise', 'Single-Leg Calf Raise', 'Calves', 'bodyweight', { bodyweight: true, perSide: true }],
  ['seated-calf-raise', 'Seated Calf Raise (machine)', 'Calves', 'machine'],
  // ── Core ──────────────────────────────────────────────
  ['plank', 'Plank', 'Core', 'bodyweight', { bodyweight: true, timed: true }],
  ['hanging-knee-raise', 'Hanging Knee Raise', 'Core', 'bodyweight', { bodyweight: true }],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'Core', 'bodyweight', { bodyweight: true }],
  ['cable-crunch', 'Cable Crunch', 'Core', 'cable'],
  ['ab-wheel', 'Ab Wheel Rollout', 'Core', 'other', { bodyweight: true }],
  ['russian-twist', 'Russian Twist', 'Core', 'dumbbell'],
  ['cable-woodchop', 'Cable Woodchop', 'Core', 'cable', { perSide: true }],
  ['sit-up', 'Sit-Up', 'Core', 'bodyweight', { bodyweight: true }],
  ['side-plank', 'Side Plank', 'Core', 'bodyweight', { bodyweight: true, perSide: true }],
  // ── Full Body / Cardio ────────────────────────────────
  ['db-clean-press', 'Dumbbell Clean & Press', 'Full Body', 'dumbbell', { perHand: true, compound: true }],
  ['db-thruster', 'Dumbbell Thruster', 'Full Body', 'dumbbell', { perHand: true, compound: true }],
  ['farmers-carry', "Farmer's Carry", 'Full Body', 'dumbbell', { perHand: true, compound: true }],
  ['burpee', 'Burpee', 'Cardio', 'bodyweight', { bodyweight: true, compound: true }],
  ['jump-rope', 'Jump Rope', 'Cardio', 'other', { bodyweight: true }],
  ['shadowboxing', 'Shadowboxing', 'Cardio', 'bodyweight', { bodyweight: true }],
  ['heavy-bag', 'Heavy Bag Rounds', 'Cardio', 'other', { bodyweight: true }],
];

/** v2 additions (BOXER CUT // FLEX). */
const V2_ROWS: Row[] = [
  ['cable-leg-curl', 'Cable Leg Curl', 'Hamstrings', 'cable', { perSide: true }],
];

/**
 * v3: the bodyweight library. Chains are ordered easiest → hardest; `level` is the index in the chain.
 * Progressive overload here is "move to the next variation", not "add plates".
 * [id, name, category, equipment, flags, progressionId, level, gear, cue]
 */
type BWRow = [
  id: string,
  name: string,
  category: Exercise['category'],
  flags: { perSide?: boolean; compound?: boolean; timed?: boolean; equipment?: Exercise['equipment'] },
  chain: string | null,
  gear: string | null,
  cue: string,
];

const BW = (rows: BWRow[]): Exercise[] => {
  const levelByChain = new Map<string, number>();
  return rows.map(([id, name, category, flags, chain, gear, cue]) => {
    const { equipment, ...rest } = flags;
    const ex: Exercise = { id, name, category, equipment: equipment ?? 'bodyweight', bodyweight: true, ...rest, cue };
    if (gear) ex.gear = gear;
    if (chain) {
      const level = levelByChain.get(chain) ?? 0;
      levelByChain.set(chain, level + 1);
      ex.progressionId = chain;
      ex.level = level;
    }
    return ex;
  });
};

const V3_BODYWEIGHT: Exercise[] = BW([
  // ── PUSH-UP CHAIN (horizontal push · chest, front delt, triceps) ───────────────
  ['incline-push-up', 'Incline Push-Up', 'Chest', { compound: true }, 'push', 'table or counter', 'Hands on a table edge. Body straight, elbows ~45°, chest to the edge.'],
  // 'push-up' and 'diamond-push-up' are v1 ids; they are re-tagged into the chain below
  ['mike-tyson-push-up', 'Mike Tyson Push-Up', 'Chest', { compound: true }, 'push', 'wall', 'Feet flat against a wall, hands under shoulders. Sit the hips back to the heels, then drive forward and down into a push-up, press out, repeat. One push = one rep.'],
  ['decline-push-up', 'Decline Push-Up', 'Chest', { compound: true }, 'push', 'chair', 'Feet on a chair, hands under shoulders. Nose to the floor, no sagging hips.'],
  ['pseudo-planche-push-up', 'Pseudo Planche Push-Up', 'Chest', { compound: true }, 'push', null, 'Hands by your hips, fingers turned out, lean forward so shoulders pass the hands. Protract hard at the top.'],
  ['archer-push-up', 'Archer Push-Up', 'Chest', { compound: true, perSide: true }, 'push', null, 'Wide hands. Lower to one hand while the other arm straightens out to the side. Count reps per side.'],
  ['one-arm-push-up-elevated', 'One-Arm Push-Up (hands elevated)', 'Chest', { compound: true, perSide: true }, 'push', 'table or chair', 'Working hand on a table or chair, feet wide, free hand behind the back. Fight the twist.'],
  ['one-arm-push-up', 'One-Arm Push-Up', 'Chest', { compound: true, perSide: true }, 'push', null, 'Feet wide, hips square, elbow tracks back. Pick a height so you have 5+ reps in you.'],
  // ── HANDSTAND CHAIN (vertical push · shoulders, triceps, upper chest) ──────────
  ['pike-push-up', 'Pike Push-Up', 'Shoulders', { compound: true }, 'vpush', null, 'Hips high, feet close. Head travels forward to a spot between your hands. Full lockout.'],
  ['elevated-pike-push-up', 'Elevated Pike Push-Up', 'Shoulders', { compound: true }, 'vpush', 'chair', 'Feet on a chair, torso vertical. Head to the floor between the hands, press to lockout.'],
  ['wall-hspu-negative', 'Wall Handstand Push-Up (negative)', 'Shoulders', { compound: true }, 'vpush', 'wall', 'Kick up to the wall, lower in 3–5 s to a pillow, kick down and reset. Eccentrics only.'],
  ['wall-hspu-partial', 'Wall Handstand Push-Up (partial)', 'Shoulders', { compound: true }, 'vpush', 'wall', 'Back to the wall. Lower to a stack of books or a pillow, press out. Lower the target over weeks.'],
  ['wall-hspu', 'Wall Handstand Push-Up', 'Shoulders', { compound: true }, 'vpush', 'wall', 'Full range: head lightly touches the floor, press to lockout. Ribs down, no banana back.'],
  // ── DIP CHAIN (chest, triceps) ─────────────────────────────────────────────────
  // 'bench-dip' is a v1 id; re-tagged below
  ['bench-dip-elevated', 'Bench Dip (feet elevated)', 'Triceps', { compound: true }, 'dip', 'two chairs', 'Hands on one chair, heels on another. Elbows back, shoulders down away from the ears.'],
  ['chair-dip', 'Chair / Corner Dip', 'Chest', { compound: true }, 'dip', 'two sturdy chairs or a counter corner', 'Hands on two chair backs or a counter corner. Lean slightly forward, lower until shoulders are at elbow height.'],
  ['chair-dip-deep', 'Deep Paused Dip', 'Chest', { compound: true }, 'dip', 'two sturdy chairs or a counter corner', 'Same setup, 2-second pause at the bottom, slow eccentric. Add a backpack once this is 3×12.'],
  // ── PULL-UP CHAIN (lats, upper back, biceps) ───────────────────────────────────
  ['scapular-pull-up', 'Scapular Pull-Up', 'Back', { compound: true }, 'pull', 'pull-up bar', 'Dead hang. Pull the shoulder blades down and back so the body rises a few inches with straight arms.'],
  ['negative-pull-up', 'Negative Pull-Up', 'Back', { compound: true }, 'pull', 'pull-up bar', 'Jump or step to the top, lower in 3–5 s under control. Each rep is one slow descent.'],
  ['band-assisted-pull-up', 'Band-Assisted Pull-Up', 'Back', { compound: true, equipment: 'band' }, 'pull', 'pull-up bar + band', 'Band under one foot or knee. Use the thinnest band that lets you reach the rep range.'],
  // 'pull-up' is a v1 id; re-tagged below
  ['l-sit-pull-up', 'L-Sit Pull-Up', 'Back', { compound: true }, 'pull', 'pull-up bar', 'Legs straight out at hip height for the whole set. Pull chest to bar, no swing.'],
  ['archer-pull-up', 'Archer Pull-Up', 'Back', { compound: true, perSide: true }, 'pull', 'pull-up bar', 'Wide grip. Pull to one hand while the other arm straightens along the bar. Count reps per side.'],
  ['typewriter-pull-up', 'Typewriter Pull-Up', 'Back', { compound: true }, 'pull', 'pull-up bar', 'Pull up to one hand, slide across to the other at the top, lower. Each traverse is one rep.'],
  // ── CHIN-UP CHAIN (lats, biceps) ───────────────────────────────────────────────
  ['negative-chin-up', 'Negative Chin-Up', 'Biceps', { compound: true }, 'chin', 'pull-up bar', 'Underhand grip. Jump to the top, lower in 3–5 s.'],
  ['band-assisted-chin-up', 'Band-Assisted Chin-Up', 'Biceps', { compound: true, equipment: 'band' }, 'chin', 'pull-up bar + band', 'Underhand. Band under one foot. Thinnest band that keeps you in the rep range.'],
  // 'chin-up' is a v1 id; re-tagged below
  ['l-sit-chin-up', 'L-Sit Chin-Up', 'Biceps', { compound: true }, 'chin', 'pull-up bar', 'Legs out at hip height, underhand grip, chin clears the bar on every rep.'],
  ['archer-chin-up', 'Archer Chin-Up', 'Biceps', { compound: true, perSide: true }, 'chin', 'pull-up bar', 'Mixed/underhand wide grip, pull to one side with the other arm straightening. Count reps per side.'],
  ['one-arm-chin-negative', 'One-Arm Chin-Up (negative)', 'Biceps', { compound: true, perSide: true }, 'chin', 'pull-up bar', 'Jump to the top with one hand, lower in 5+ s. One slow descent is one rep.'],
  // ── ROW CHAIN (horizontal pull · mid-back, rear delts, biceps) ─────────────────
  ['table-row-incline', 'Table Row (body angled)', 'Back', { compound: true }, 'row', 'sturdy table', 'Lie under a table edge, grip it, heels on the floor with body at 45°. Pull chest to the edge.'],
  ['table-row', 'Table Row (horizontal)', 'Back', { compound: true }, 'row', 'sturdy table', 'Body straight and horizontal under the table edge. Squeeze the shoulder blades at the top.'],
  ['table-row-feet-elevated', 'Table Row (feet elevated)', 'Back', { compound: true }, 'row', 'sturdy table + chair', 'Heels on a chair so the body is level or declined. Pause 1 s with chest at the edge.'],
  ['archer-table-row', 'Archer Row', 'Back', { compound: true, perSide: true }, 'row', 'sturdy table', 'Pull to one hand while the other arm straightens along the edge. Count reps per side.'],
  ['one-arm-table-row', 'One-Arm Row (table)', 'Back', { compound: true, perSide: true }, 'row', 'sturdy table', 'One hand on the edge, the other across the chest. Keep hips square, no rotation.'],
  // ── TRICEPS CHAIN (bodyweight extension) ───────────────────────────────────────
  ['bw-triceps-ext-high', 'Bodyweight Triceps Extension (table)', 'Triceps', {}, 'tri', 'table or counter', 'Hands on a table edge, body straight. Let the head pass the hands by bending only the elbows, press back.'],
  ['bw-triceps-ext-low', 'Bodyweight Triceps Extension (low)', 'Triceps', {}, 'tri', 'chair or step', 'Same move with hands on a chair or step. Elbows stay pointed forward.'],
  ['sphinx-push-up', 'Sphinx Push-Up', 'Triceps', {}, 'tri', null, 'From a forearm plank, press up to a push-up top by extending the elbows, lower forearms back down.'],
  // ── SQUAT CHAIN (quads, glutes) ─────────────────────────────────────────────────
  // 'bodyweight-squat' is a v1 id; re-tagged below
  ['split-squat', 'Split Squat', 'Quads', { compound: true, perSide: true }, 'squat', null, 'Long stance, back knee to just above the floor, torso tall. Front shin stays vertical-ish.'],
  ['bulgarian-split-squat-bw', 'Bulgarian Split Squat', 'Quads', { compound: true, perSide: true }, 'squat', 'chair', 'Rear foot on a chair. Sink straight down, front knee tracks over the toes. Slow 3-s descent.'],
  ['assisted-pistol-squat', 'Assisted Pistol Squat', 'Quads', { compound: true, perSide: true }, 'squat', 'doorframe or pole', 'Hold a doorframe lightly for balance. Sit all the way down on one leg, drive up.'],
  // 'pistol-squat' is a v1 id; re-tagged below
  ['shrimp-squat', 'Shrimp Squat', 'Quads', { compound: true, perSide: true }, 'squat', null, 'Hold the back foot behind you, lower until the back knee kisses the floor, stand. Lean forward as needed.'],
  ['elevated-pistol-squat', 'Deficit Pistol Squat', 'Quads', { compound: true, perSide: true }, 'squat', 'chair or step', 'Stand on a chair or step so the free leg can drop below the standing foot. Full depth.'],
  // ── LUNGE CHAIN (quads, glutes) ─────────────────────────────────────────────────
  ['reverse-lunge', 'Reverse Lunge', 'Quads', { compound: true, perSide: true }, 'lunge', null, 'Step back, lower the rear knee toward the floor, drive through the front heel to stand.'],
  ['deficit-reverse-lunge', 'Deficit Reverse Lunge', 'Quads', { compound: true, perSide: true }, 'lunge', 'step', 'Front foot on a step. Longer range at the bottom, slow 3-s descent.'],
  ['skater-squat', 'Skater Squat', 'Quads', { compound: true, perSide: true }, 'lunge', 'pillow', 'Stand on one leg, hinge forward and lower the free knee to a pillow behind you, stand up.'],
  ['deficit-skater-squat', 'Deficit Skater Squat', 'Quads', { compound: true, perSide: true }, 'lunge', 'step', 'Skater squat standing on a step so the knee drops lower. Arms forward as a counterweight.'],
  // ── HINGE / NORDIC CHAIN (hamstrings) ───────────────────────────────────────────
  ['sliding-leg-curl', 'Sliding Leg Curl', 'Hamstrings', { compound: true }, 'hinge', 'towel on a smooth floor', 'Lie on your back, heels on a towel, bridge up, slide heels out and pull them back without dropping the hips.'],
  ['single-leg-sliding-leg-curl', 'Single-Leg Sliding Leg Curl', 'Hamstrings', { compound: true, perSide: true }, 'hinge', 'towel on a smooth floor', 'Same bridge, one heel does the work while the other leg is held off the floor.'],
  ['nordic-negative', 'Nordic Curl (negative)', 'Hamstrings', { compound: true }, 'hinge', 'ankles anchored under a couch', 'Kneel with ankles anchored. Lower the body forward as slowly as you can, catch with the hands, push back up.'],
  // 'nordic-curl' is a v1 id; re-tagged below
  // ── HIP THRUST CHAIN (glutes, hamstrings) ──────────────────────────────────────
  // 'glute-bridge' is a v1 id; re-tagged below
  ['single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'Glutes', { compound: true, perSide: true }, 'glute', null, 'Shoulders on the floor, one foot planted. Drive the hips up, squeeze 1 s at the top.'],
  // 'single-leg-hip-thrust' is a v1 id; re-tagged below
  ['elevated-single-leg-hip-thrust', 'Single-Leg Hip Thrust (feet elevated)', 'Glutes', { compound: true, perSide: true }, 'glute', 'two chairs', 'Shoulders on one chair, working foot on another. Full lockout, slow 3-s lower.'],
  // ── CALF CHAIN ─────────────────────────────────────────────────────────────────
  // 'standing-calf-raise' and 'single-leg-calf-raise' are v1 ids; re-tagged below
  ['deficit-calf-raise', 'Single-Leg Deficit Calf Raise', 'Calves', { perSide: true }, 'calf', 'step', 'Ball of the foot on a step edge, heel drops below. 2-s pause at the bottom stretch, full rise.'],
  // ── HANGING CORE CHAIN (abs, hip flexors, grip) ────────────────────────────────
  // 'hanging-knee-raise' and 'hanging-leg-raise' are v1 ids; re-tagged below
  ['toes-to-bar', 'Toes-to-Bar', 'Core', {}, 'hangcore', 'pull-up bar', 'Straight legs, lift the toes to the bar with a slight lat pull. Control the way down, no swing.'],
  ['hanging-windshield-wiper', 'Hanging Windshield Wiper', 'Core', {}, 'hangcore', 'pull-up bar', 'Legs up at bar height, sweep side to side. One full left-right sweep is one rep.'],
  // ── L-SIT CHAIN (timed · abs, hip flexors, triceps) ────────────────────────────
  ['hollow-body-hold', 'Hollow Body Hold', 'Core', { timed: true }, 'lsit', null, 'Lower back glued to the floor, arms overhead, legs straight and low. Breathe. Seconds held.'],
  ['tuck-l-sit', 'Tuck L-Sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'Hands by the hips, press down, lift the hips and tucked knees off the floor. Seconds held.'],
  ['one-leg-l-sit', 'One-Leg L-Sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'One leg straight, the other tucked. Swap halfway through the set. Seconds held.'],
  ['l-sit', 'L-Sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'Both legs straight at hip height, toes pointed. Seconds held.'],
  // ── SIDE CHAIN (timed · obliques, adductors) ───────────────────────────────────
  // 'side-plank' is a v1 id; re-tagged below
  ['side-plank-elevated', 'Side Plank (feet elevated)', 'Core', { timed: true, perSide: true }, 'side', 'chair', 'Feet on a chair, forearm on the floor. Hips high, body straight. Seconds per side.'],
  ['copenhagen-plank-short', 'Copenhagen Plank (short lever)', 'Core', { timed: true, perSide: true }, 'side', 'chair', 'Top knee on a chair, bottom leg lifted. Squeeze the top knee into the chair. Seconds per side.'],
  ['copenhagen-plank', 'Copenhagen Plank (long lever)', 'Core', { timed: true, perSide: true }, 'side', 'chair', 'Top ankle on the chair, body straight, bottom leg hovering. Seconds per side.'],
  // ── DRAGON FLAG CHAIN (anterior core) ──────────────────────────────────────────
  ['reverse-crunch', 'Reverse Crunch', 'Core', {}, 'dragon', null, 'Lie flat, hands anchored overhead on something solid, curl knees to chest and lift the hips. Lower slowly.'],
  ['dragon-flag-tuck', 'Tuck Dragon Flag', 'Core', {}, 'dragon', 'something to grip behind the head', 'Body up on the shoulder blades, knees tucked. Lower the whole body as one piece, stop before it touches.'],
  ['dragon-flag-negative', 'Dragon Flag (negative)', 'Core', {}, 'dragon', 'something to grip behind the head', 'Straight body from the shoulders, lower as slowly as possible, reset with a tuck. Eccentrics only.'],
  ['dragon-flag', 'Dragon Flag', 'Core', {}, 'dragon', 'something to grip behind the head', 'Straight body down and up without the hips sagging. Only the shoulder blades touch.'],
  // ── FIXED ACCESSORIES (no chain · progress by reps, tempo, or band) ────────────
  ['prone-y-raise', 'Prone Y Raise', 'Shoulders', {}, null, null, 'Lie face down, arms in a Y, thumbs up. Lift as high as possible, 1-s squeeze. Light but brutal.'],
  ['arch-raise', 'Arch Raise (Superman)', 'Back', {}, null, null, 'Face down, lift chest and thighs together, 1-s hold at the top. Lower back and glutes.'],
  ['cossack-squat', 'Cossack Squat', 'Quads', { compound: true, perSide: true }, null, null, 'Wide stance, sit all the way to one side with the other leg straight and toes up. Alternate.'],
  ['wall-handstand-hold', 'Wall Handstand Hold', 'Shoulders', { timed: true }, null, 'wall', 'Chest to wall or back to wall. Push tall through the shoulders, ribs in. Seconds held.'],
  ['dead-hang', 'Dead Hang', 'Back', { timed: true }, null, 'pull-up bar', 'Relaxed hang, then active hang (shoulders down). Grip and shoulder health. Seconds held.'],
  ['deep-squat-hold', 'Deep Squat Hold', 'Quads', { timed: true }, null, null, 'Feet flat, chest up, knees pushed out. Shift weight around. Seconds held.'],
  ['jump-squat', 'Jump Squat', 'Quads', { compound: true }, null, null, 'Quarter squat, jump as high as you can, land soft and quiet. Stop the set when height drops.'],
  ['broad-jump', 'Broad Jump', 'Full Body', { compound: true }, null, 'space', 'Two-foot takeoff, land soft and stuck. Walk back between reps. Power, not conditioning.'],
  ['bear-crawl', 'Bear Crawl', 'Full Body', { timed: true }, null, 'floor space', 'Hands and feet, knees off the floor, hips low. Opposite hand and foot move together. Seconds.'],
  ['monkey', 'Monkey (lateral)', 'Full Body', { timed: true }, null, 'floor space', 'From a deep squat, plant both hands to the side and hop the feet across. Flow side to side. Seconds.'],
  ['frogger', 'Frogger', 'Full Body', { timed: true }, null, 'floor space', 'Deep squat, hands forward, hop the feet to the hands, repeat. Soft landings. Seconds.'],
  ['band-face-pull', 'Band Face Pull', 'Shoulders', { equipment: 'band' }, null, 'band anchored to the bar', 'Pull to the face with elbows high, finish with the hands beside the ears. Slow return.'],
  ['band-lateral-raise', 'Band Lateral Raise', 'Shoulders', { equipment: 'band' }, null, 'band', 'Stand on the band, raise to shoulder height with a soft elbow. Lean slightly forward.'],
  ['band-curl', 'Band Curl', 'Biceps', { equipment: 'band' }, null, 'band', 'Stand on the band, curl without swinging. Slow eccentric.'],
  ['band-pushdown', 'Band Triceps Pushdown', 'Triceps', { equipment: 'band' }, null, 'band anchored to the bar', 'Elbows pinned, extend to lockout and squeeze.'],
  ['band-row', 'Band Row', 'Back', { equipment: 'band', compound: true }, null, 'band anchored to a door or the bar', 'Pull to the lower ribs, shoulder blades together, pause 1 s.'],
  ['band-pallof-press', 'Band Pallof Press', 'Core', { perSide: true, equipment: 'band' }, null, 'band anchored at chest height', 'Side-on to the anchor, press the band straight out and back. Hips do not rotate.'],
]);

/** v1 exercises that now sit inside a progression chain, with the position they occupy. */
const V1_CHAIN_PLACEMENT: Record<string, { progressionId: string; after: string | null; gear?: string; cue: string; timed?: boolean }> = {
  'push-up': { progressionId: 'push', after: 'incline-push-up', cue: 'Hands under shoulders, body one straight line. Chest to the floor, full lockout.' },
  'diamond-push-up': { progressionId: 'push', after: 'push-up', cue: 'Thumbs and index fingers touch under the chest. Elbows tight to the ribs.' },
  'bench-dip': { progressionId: 'dip', after: null, gear: 'chair', cue: 'Hands on a chair behind you, feet on the floor. Elbows straight back, 90° at the bottom.' },
  'pull-up': { progressionId: 'pull', after: 'band-assisted-pull-up', gear: 'pull-up bar', cue: 'Dead hang start, chin clears the bar, controlled 2-s descent. No kipping.' },
  'chin-up': { progressionId: 'chin', after: 'band-assisted-chin-up', gear: 'pull-up bar', cue: 'Underhand grip. Chin over the bar, elbows to the ribs, controlled descent.' },
  'bodyweight-squat': { progressionId: 'squat', after: null, cue: 'Full depth, heels down, knees out. Slow 3-s descent to make it count.' },
  'pistol-squat': { progressionId: 'squat', after: 'assisted-pistol-squat', cue: 'Free leg straight out front, sit all the way down and stand without touching down.' },
  'nordic-curl': { progressionId: 'hinge', after: 'nordic-negative', gear: 'ankles anchored under a couch', cue: 'Lower slowly, then pull yourself back up with the hamstrings. Use a small hand push only if needed.' },
  'glute-bridge': { progressionId: 'glute', after: null, cue: 'Feet flat, drive hips to full extension, 1-s squeeze. Ribs down.' },
  'single-leg-hip-thrust': { progressionId: 'glute', after: 'single-leg-glute-bridge', gear: 'chair or couch', cue: 'Shoulders on a chair, one foot planted. Hips to full lockout, chin tucked.' },
  'standing-calf-raise': { progressionId: 'calf', after: null, gear: 'step', cue: 'Both feet on a step edge. Full stretch at the bottom, 1-s squeeze at the top.' },
  'single-leg-calf-raise': { progressionId: 'calf', after: 'standing-calf-raise', gear: 'step', cue: 'One foot on a step edge, light fingertip balance. Full range, no bouncing.' },
  'hanging-knee-raise': { progressionId: 'hangcore', after: null, gear: 'pull-up bar', cue: 'Hang, pull knees to chest, curl the pelvis up. Lower without swinging.' },
  'hanging-leg-raise': { progressionId: 'hangcore', after: 'hanging-knee-raise', gear: 'pull-up bar', cue: 'Straight legs to horizontal or higher, slow lower, no swing.' },
  'side-plank': { progressionId: 'side', after: null, timed: true, cue: 'Elbow under shoulder, hips high and stacked. Seconds per side.' },
};

/** Inserts the v1 chain members into the chain order and renumbers levels. */
function placeV1InChains(v1: Exercise[], v3: Exercise[]): Exercise[] {
  const all = [...v1, ...v3];
  for (const [id, place] of Object.entries(V1_CHAIN_PLACEMENT)) {
    const ex = all.find((e) => e.id === id);
    if (!ex) continue;
    ex.progressionId = place.progressionId;
    ex.cue = place.cue;
    if (place.gear) ex.gear = place.gear;
    if (place.timed) ex.timed = true;
    ex.bodyweight = true;
  }
  // rebuild level numbers chain by chain, honouring `after` for the v1 members
  const chains = new Set(all.filter((e) => e.progressionId).map((e) => e.progressionId as string));
  for (const chain of chains) {
    const v3Members = v3.filter((e) => e.progressionId === chain).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const order: Exercise[] = [...v3Members];
    const v1Members = Object.entries(V1_CHAIN_PLACEMENT).filter(([, p]) => p.progressionId === chain);
    // insert in a stable order so chained `after` references resolve
    const pending = v1Members.map(([id, p]) => ({ ex: all.find((e) => e.id === id)!, after: p.after }));
    let guard = 0;
    while (pending.length && guard++ < 50) {
      const item = pending.shift()!;
      if (item.after == null) {
        order.unshift(item.ex);
        continue;
      }
      const idx = order.findIndex((e) => e.id === item.after);
      if (idx >= 0) order.splice(idx + 1, 0, item.ex);
      else pending.push(item);
    }
    order.forEach((e, i) => (e.level = i));
  }
  return all;
}

const V1_LIBRARY: Exercise[] = V1_ROWS.map(([id, name, category, equipment, flags]) => ({ id, name, category, equipment, ...flags }));
const V2_LIBRARY: Exercise[] = V2_ROWS.map(([id, name, category, equipment, flags]) => ({ id, name, category, equipment, ...flags }));

export const EXERCISE_LIBRARY: Exercise[] = [...placeV1InChains(V1_LIBRARY, V3_BODYWEIGHT), ...V2_LIBRARY];

/** Ids that shipped in the 1.0 library (used to decide what a plan bundle must carry for older apps). */
export const V1_LIBRARY_IDS: ReadonlySet<string> = new Set(V1_ROWS.map((r) => r[0]));
