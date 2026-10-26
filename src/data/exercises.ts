import type { Exercise } from '../types';

/**
 * The library: bodyweight only. A pull-up bar, the floor, a wall, a sturdy table, a couple of chairs.
 * A few optional band moves for people who pick up a set of bands.
 *
 * Chains are ordered easiest → hardest; `level` is the index in the chain. Progressive overload here is
 * "move to the next variation", not "add plates". Rung order follows the r/bodyweightfitness Recommended
 * Routine and Steven Low's Overcoming Gravity, with the standard household substitutions for rings/dip bars.
 *
 * Ids that shipped in earlier versions are kept verbatim so history keeps resolving.
 */
type Row = [
  id: string,
  name: string,
  category: Exercise['category'],
  flags: { perSide?: boolean; timed?: boolean; band?: boolean },
  chain: string | null,
  gear: string | null,
  cue: string,
];

const build = (rows: Row[]): Exercise[] => {
  const levelByChain = new Map<string, number>();
  return rows.map(([id, name, category, flags, chain, gear, cue]) => {
    const ex: Exercise = { id, name, category, equipment: flags.band ? 'band' : 'bodyweight', bodyweight: true, cue };
    if (flags.perSide) ex.perSide = true;
    if (flags.timed) ex.timed = true;
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

export const EXERCISE_LIBRARY: Exercise[] = build([
  // ── PULL-UP CHAIN · vertical pull ──────────────────────────────────────────────────────────
  ['scapular-pull-up', 'Scapular pull-up', 'Back', {}, 'pull', 'pull-up bar', 'Dead hang. Pull the shoulder blades down and back so the body rises a few inches with straight arms. Pause, lower.'],
  ['negative-pull-up', 'Negative pull-up', 'Back', {}, 'pull', 'pull-up bar', 'Jump or step to the top, lower in 3–5 s under control. Each slow descent is one rep.'],
  ['band-assisted-pull-up', 'Band-assisted pull-up', 'Back', { band: true }, 'pull', 'pull-up bar + band', 'Band over the bar, under one foot or knee. Use the thinnest band that keeps you in the rep range.'],
  ['pull-up', 'Pull-up', 'Back', {}, 'pull', 'pull-up bar', 'Dead-hang start, chin clears the bar, 2-s controlled descent. No kipping.'],
  ['archer-pull-up', 'Archer pull-up', 'Back', { perSide: true }, 'pull', 'pull-up bar', 'Wide grip. Pull to one hand while the other arm straightens along the bar. Alternate sides, count reps per side.'],
  ['typewriter-pull-up', 'Typewriter pull-up', 'Back', {}, 'pull', 'pull-up bar', 'Pull up to one hand, slide across to the other at the top, lower. One full traverse is one rep.'],
  ['one-arm-pull-up-negative', 'One-arm pull-up (negative)', 'Back', { perSide: true }, 'pull', 'pull-up bar', 'Jump to the top with one hand, lower in 5+ s. Free hand off the bar. One slow descent is one rep.'],
  ['one-arm-pull-up-assisted', 'One-arm pull-up (assisted)', 'Back', { perSide: true }, 'pull', 'pull-up bar + towel or band', 'Working hand on the bar, other hand low on a towel or band hanging from the bar. Lower your grip on the towel over weeks.'],
  ['one-arm-pull-up', 'One-arm pull-up', 'Back', { perSide: true }, 'pull', 'pull-up bar', 'Full dead hang to chin over bar on one arm. Keep the shoulder packed, no swing.'],

  // ── CHIN-UP CHAIN · vertical pull, underhand ───────────────────────────────────────────────
  ['negative-chin-up', 'Negative chin-up', 'Biceps', {}, 'chin', 'pull-up bar', 'Underhand grip. Jump to the top, lower in 3–5 s.'],
  ['band-assisted-chin-up', 'Band-assisted chin-up', 'Biceps', { band: true }, 'chin', 'pull-up bar + band', 'Underhand. Band under one foot. Thinnest band that keeps you in the rep range.'],
  ['chin-up', 'Chin-up', 'Biceps', {}, 'chin', 'pull-up bar', 'Underhand grip. Chin over the bar, elbows to the ribs, 2-s controlled descent.'],
  ['archer-chin-up', 'Archer chin-up', 'Biceps', { perSide: true }, 'chin', 'pull-up bar', 'Wide underhand or mixed grip. Pull to one side while the other arm straightens. Count reps per side.'],
  ['one-arm-chin-negative', 'One-arm chin-up (negative)', 'Biceps', { perSide: true }, 'chin', 'pull-up bar', 'Jump to the top with one hand, lower in 5+ s. One slow descent is one rep.'],
  ['one-arm-chin-assisted', 'One-arm chin-up (assisted)', 'Biceps', { perSide: true }, 'chin', 'pull-up bar + towel or band', 'Working hand underhand on the bar, other hand low on a towel. Lower the assisting grip over weeks.'],
  ['one-arm-chin-up', 'One-arm chin-up', 'Biceps', { perSide: true }, 'chin', 'pull-up bar', 'Dead hang to chin over bar on one arm, underhand.'],

  // ── MUSCLE-UP CHAIN · explosive pull (needs clearance above the bar) ─────────────────────
  ['explosive-pull-up', 'Explosive pull-up', 'Back', {}, 'muscleup', 'pull-up bar with space above', 'Pull as fast as you can so the chest reaches the bar. Lower slowly. Stop the set when speed drops.'],
  ['chest-to-bar-pull-up', 'Chest-to-bar pull-up', 'Back', {}, 'muscleup', 'pull-up bar with space above', 'Pull until the bar touches the chest, lean back slightly at the top. Controlled descent.'],
  ['high-pull-up', 'High pull-up', 'Back', {}, 'muscleup', 'pull-up bar with space above', 'Pull until the bar reaches the sternum or lower. Elbows drive down and back.'],
  ['muscle-up-negative', 'Muscle-up (negative)', 'Back', {}, 'muscleup', 'pull-up bar with space above', 'Jump or press to the top support position, lower the transition as slowly as you can, then lower the pull. One descent is one rep.'],
  ['bar-muscle-up', 'Bar muscle-up', 'Back', {}, 'muscleup', 'pull-up bar with space above', 'Explosive pull, wrists roll over the bar, press to lockout. Minimal kip.'],

  // ── ROW CHAIN · horizontal pull ────────────────────────────────────────────────────────────
  ['table-row-incline', 'Table row (body angled)', 'Back', {}, 'row', 'sturdy table', 'Lie under a table edge, grip it, heels on the floor with the body at 45°. Pull chest to the edge.'],
  ['table-row', 'Table row (horizontal)', 'Back', {}, 'row', 'sturdy table', 'Body straight and horizontal under the table edge. Squeeze the shoulder blades at the top.'],
  ['table-row-feet-elevated', 'Table row (feet elevated)', 'Back', {}, 'row', 'sturdy table + chair', 'Heels on a chair so the body is level or declined. Pause 1 s with the chest at the edge.'],
  ['archer-table-row', 'Archer row', 'Back', { perSide: true }, 'row', 'sturdy table', 'Pull to one hand while the other arm straightens along the edge. Count reps per side.'],
  ['one-arm-table-row', 'One-arm row (table)', 'Back', { perSide: true }, 'row', 'sturdy table', 'One hand on the edge, the other across the chest. Hips square, no rotation.'],

  // ── FRONT LEVER CHAIN · straight-arm pull, timed ───────────────────────────────────────────
  ['tuck-front-lever', 'Tuck front lever', 'Back', { timed: true }, 'frontlever', 'pull-up bar', 'Hang, pull the hips up to bar height with knees tucked to the chest, arms straight. Back flat and parallel to the floor. Seconds held.'],
  ['advanced-tuck-front-lever', 'Advanced tuck front lever', 'Back', { timed: true }, 'frontlever', 'pull-up bar', 'Same, but open the hips so the thighs point straight down. Flat back, straight arms. Seconds held.'],
  ['one-leg-front-lever', 'One-leg front lever', 'Back', { timed: true }, 'frontlever', 'pull-up bar', 'One leg extended fully, the other tucked. Swap legs halfway. Seconds held.'],
  ['straddle-front-lever', 'Straddle front lever', 'Back', { timed: true }, 'frontlever', 'pull-up bar', 'Both legs straight and wide, body flat as a board. Seconds held.'],
  ['front-lever', 'Front lever', 'Back', { timed: true }, 'frontlever', 'pull-up bar', 'Full body horizontal, legs together, arms straight. Seconds held.'],

  // ── PLANCHE CHAIN · straight-arm push, timed ───────────────────────────────────────────────
  ['planche-lean', 'Planche lean', 'Shoulders', { timed: true }, 'planche', null, 'Push-up top position, fingers turned out. Lean the shoulders forward past the hands, elbows locked, shoulders protracted. Seconds held.'],
  ['tuck-planche', 'Tuck planche', 'Shoulders', { timed: true }, 'planche', 'floor or two chairs', 'From a deep lean, lift the tucked knees off the floor. Round the upper back, arms straight. Seconds held.'],
  ['advanced-tuck-planche', 'Advanced tuck planche', 'Shoulders', { timed: true }, 'planche', 'floor or two chairs', 'Open the hips so the back is flat and the thighs point down. Arms straight. Seconds held.'],
  ['straddle-planche', 'Straddle planche', 'Shoulders', { timed: true }, 'planche', 'floor or two chairs', 'Legs straight and wide, body horizontal, arms straight. Seconds held.'],

  // ── PUSH-UP CHAIN · horizontal push ────────────────────────────────────────────────────────
  ['incline-push-up', 'Incline push-up', 'Chest', {}, 'push', 'table or counter', 'Hands on a table edge. Body straight, elbows ~45°, chest to the edge.'],
  ['push-up', 'Push-up', 'Chest', {}, 'push', null, 'Hands under shoulders, body one straight line. Chest to the floor, full lockout.'],
  ['diamond-push-up', 'Diamond push-up', 'Triceps', {}, 'push', null, 'Thumbs and index fingers touch under the chest. Elbows tight to the ribs.'],
  ['decline-push-up', 'Decline push-up', 'Chest', {}, 'push', 'chair', 'Feet on a chair, hands under shoulders. Nose to the floor, no sagging hips.'],
  ['pseudo-planche-push-up', 'Pseudo planche push-up', 'Chest', {}, 'push', null, 'Hands by your hips, fingers turned out, lean forward so the shoulders pass the hands. Protract hard at the top.'],
  ['archer-push-up', 'Archer push-up', 'Chest', { perSide: true }, 'push', null, 'Wide hands. Lower to one hand while the other arm straightens out to the side. Count reps per side.'],
  ['one-arm-push-up-elevated', 'One-arm push-up (hands elevated)', 'Chest', { perSide: true }, 'push', 'table or chair', 'Working hand on a table or chair, feet wide, free hand behind the back. Fight the twist.'],
  ['one-arm-push-up', 'One-arm push-up', 'Chest', { perSide: true }, 'push', null, 'Feet wide, hips square, elbow tracks back. Chest to the floor.'],

  // ── HANDSTAND PUSH-UP CHAIN · vertical push ────────────────────────────────────────────────
  ['pike-push-up', 'Pike push-up', 'Shoulders', {}, 'vpush', null, 'Hips high, feet close. Head travels forward to a spot between the hands. Full lockout.'],
  ['elevated-pike-push-up', 'Elevated pike push-up', 'Shoulders', {}, 'vpush', 'chair', 'Feet on a chair, torso vertical. Head to the floor between the hands, press to lockout.'],
  ['wall-hspu-negative', 'Wall handstand push-up (negative)', 'Shoulders', {}, 'vpush', 'wall', 'Kick up to the wall, lower in 3–5 s to a pillow, kick down and reset. Eccentrics only.'],
  ['wall-hspu-partial', 'Wall handstand push-up (partial)', 'Shoulders', {}, 'vpush', 'wall', 'Back to the wall. Lower to a stack of books or a pillow, press out. Lower the target over weeks.'],
  ['wall-hspu', 'Wall handstand push-up', 'Shoulders', {}, 'vpush', 'wall', 'Full range: head lightly touches the floor, press to lockout. Ribs down, no banana back.'],
  ['wall-hspu-deficit', 'Deficit wall handstand push-up', 'Shoulders', {}, 'vpush', 'wall + two books or blocks', 'Hands on books so the head drops below the hands. Full lockout every rep.'],

  // ── DIP CHAIN · chest, triceps ─────────────────────────────────────────────────────────────
  ['bench-dip', 'Bench dip', 'Triceps', {}, 'dip', 'chair', 'Hands on a chair behind you, feet on the floor. Elbows straight back, 90° at the bottom.'],
  ['bench-dip-elevated', 'Bench dip (feet elevated)', 'Triceps', {}, 'dip', 'two chairs', 'Hands on one chair, heels on another. Elbows back, shoulders down away from the ears.'],
  ['chair-dip', 'Parallel dip (two chairs)', 'Chest', {}, 'dip', 'two sturdy chair backs or a counter corner', 'Hands on two chair backs or a counter corner. Lean slightly forward, lower until the shoulders are at elbow height, press out.'],
  ['chair-dip-deep', 'Deep paused dip', 'Chest', {}, 'dip', 'two sturdy chair backs or a counter corner', 'Same setup, 2-s pause at the bottom, slow eccentric.'],

  // ── SQUAT CHAIN · single-leg squat ─────────────────────────────────────────────────────────
  ['bodyweight-squat', 'Bodyweight squat', 'Quads', {}, 'squat', null, 'Full depth, heels down, knees out. 3-s descent to make it count.'],
  ['split-squat', 'Split squat', 'Quads', { perSide: true }, 'squat', null, 'Long stance, back knee to just above the floor, torso tall. Front shin stays near vertical.'],
  ['bulgarian-split-squat-bw', 'Bulgarian split squat', 'Quads', { perSide: true }, 'squat', 'chair', 'Rear foot on a chair. Sink straight down, front knee tracks over the toes. Slow 3-s descent.'],
  ['assisted-pistol-squat', 'Assisted pistol squat', 'Quads', { perSide: true }, 'squat', 'doorframe or pole', 'Hold a doorframe lightly for balance. Sit all the way down on one leg, drive up.'],
  ['pistol-squat', 'Pistol squat', 'Quads', { perSide: true }, 'squat', null, 'Free leg straight out front, sit all the way down and stand without touching down.'],
  ['shrimp-squat', 'Shrimp squat', 'Quads', { perSide: true }, 'squat', null, 'Hold the back foot behind you, lower until the back knee kisses the floor, stand. Lean forward as needed.'],
  ['elevated-pistol-squat', 'Deficit pistol squat', 'Quads', { perSide: true }, 'squat', 'chair or step', 'Stand on a chair or step so the free leg can drop below the standing foot. Full depth.'],

  // ── LUNGE CHAIN · split-stance knee ────────────────────────────────────────────────────────
  ['reverse-lunge', 'Reverse lunge', 'Quads', { perSide: true }, 'lunge', null, 'Step back, lower the rear knee toward the floor, drive through the front heel to stand.'],
  ['deficit-reverse-lunge', 'Deficit reverse lunge', 'Quads', { perSide: true }, 'lunge', 'step', 'Front foot on a step. Longer range at the bottom, slow 3-s descent.'],
  ['skater-squat', 'Skater squat', 'Quads', { perSide: true }, 'lunge', 'pillow', 'Stand on one leg, hinge forward and lower the free knee to a pillow behind you, stand up.'],
  ['deficit-skater-squat', 'Deficit skater squat', 'Quads', { perSide: true }, 'lunge', 'step', 'Skater squat standing on a step so the knee drops lower. Arms forward as a counterweight.'],

  // ── NORDIC CHAIN · knee flexion ────────────────────────────────────────────────────────────
  ['sliding-leg-curl', 'Sliding leg curl', 'Hamstrings', {}, 'hinge', 'towel on a smooth floor', 'On your back, heels on a towel, bridge up, slide the heels out and pull them back without dropping the hips.'],
  ['single-leg-sliding-leg-curl', 'Single-leg sliding leg curl', 'Hamstrings', { perSide: true }, 'hinge', 'towel on a smooth floor', 'Same bridge, one heel does the work while the other leg is held off the floor.'],
  ['nordic-negative', 'Nordic curl (negative)', 'Hamstrings', {}, 'hinge', 'ankles anchored under a couch', 'Kneel with the ankles anchored. Lower the body forward as slowly as you can, catch with the hands, push back up.'],
  ['nordic-curl', 'Nordic curl', 'Hamstrings', {}, 'hinge', 'ankles anchored under a couch', 'Lower slowly, then pull yourself back up with the hamstrings. A small hand push only if needed.'],
  ['nordic-curl-overhead', 'Nordic curl (arms overhead)', 'Hamstrings', {}, 'hinge', 'ankles anchored under a couch', 'Arms straight overhead for the whole rep. Lower to the floor and pull back up without hands.'],

  // ── HIP THRUST CHAIN · hip extension ───────────────────────────────────────────────────────
  ['glute-bridge', 'Glute bridge', 'Glutes', {}, 'glute', null, 'Feet flat, drive the hips to full extension, 1-s squeeze. Ribs down.'],
  ['single-leg-glute-bridge', 'Single-leg glute bridge', 'Glutes', { perSide: true }, 'glute', null, 'Shoulders on the floor, one foot planted. Drive the hips up, squeeze 1 s at the top.'],
  ['single-leg-hip-thrust', 'Single-leg hip thrust', 'Glutes', { perSide: true }, 'glute', 'chair or couch', 'Shoulders on a chair, one foot planted. Hips to full lockout, chin tucked.'],
  ['elevated-single-leg-hip-thrust', 'Single-leg hip thrust (feet elevated)', 'Glutes', { perSide: true }, 'glute', 'two chairs', 'Shoulders on one chair, working foot on another. Full lockout, slow 3-s lower.'],

  // ── CALF CHAIN ─────────────────────────────────────────────────────────────────────────────
  ['standing-calf-raise', 'Calf raise', 'Calves', {}, 'calf', 'step', 'Both feet on a step edge. Full stretch at the bottom, 1-s squeeze at the top.'],
  ['single-leg-calf-raise', 'Single-leg calf raise', 'Calves', { perSide: true }, 'calf', 'step', 'One foot on a step edge, light fingertip balance. Full range, no bouncing.'],
  ['deficit-calf-raise', 'Single-leg deficit calf raise', 'Calves', { perSide: true }, 'calf', 'step', 'Ball of the foot on a step edge, heel drops below. 2-s pause at the bottom stretch, full rise.'],

  // ── HANGING CORE CHAIN · hip flexion, anti-extension ───────────────────────────────────────
  ['hanging-knee-raise', 'Hanging knee raise', 'Core', {}, 'hangcore', 'pull-up bar', 'Hang, pull the knees to the chest, curl the pelvis up. Lower without swinging.'],
  ['hanging-leg-raise', 'Hanging leg raise', 'Core', {}, 'hangcore', 'pull-up bar', 'Straight legs to horizontal or higher, slow lower, no swing.'],
  ['toes-to-bar', 'Toes-to-bar', 'Core', {}, 'hangcore', 'pull-up bar', 'Straight legs, lift the toes to the bar with a slight lat pull. Control the way down.'],
  ['hanging-windshield-wiper', 'Hanging windshield wiper', 'Core', {}, 'hangcore', 'pull-up bar', 'Legs up at bar height, sweep side to side. One full left-right sweep is one rep.'],

  // ── L-SIT CHAIN · compression, timed ───────────────────────────────────────────────────────
  ['hollow-body-hold', 'Hollow body hold', 'Core', { timed: true }, 'lsit', null, 'Lower back glued to the floor, arms overhead, legs straight and low. Breathe. Seconds held.'],
  ['tuck-l-sit', 'Tuck L-sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'Hands by the hips, press down, lift the hips and tucked knees off the floor. Seconds held.'],
  ['one-leg-l-sit', 'One-leg L-sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'One leg straight, the other tucked. Swap halfway through the set. Seconds held.'],
  ['l-sit', 'L-sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'Both legs straight at hip height, toes pointed. Seconds held.'],
  ['v-sit', 'V-sit', 'Core', { timed: true }, 'lsit', 'floor or two chairs', 'Legs lifted above hip height, torso leaning back, arms straight. Seconds held.'],

  // ── SIDE CHAIN · lateral core, timed ───────────────────────────────────────────────────────
  ['side-plank', 'Side plank', 'Core', { timed: true, perSide: true }, 'side', null, 'Elbow under the shoulder, hips high and stacked. Seconds per side.'],
  ['side-plank-elevated', 'Side plank (feet elevated)', 'Core', { timed: true, perSide: true }, 'side', 'chair', 'Feet on a chair, forearm on the floor. Hips high, body straight. Seconds per side.'],
  ['copenhagen-plank-short', 'Copenhagen plank (short lever)', 'Core', { timed: true, perSide: true }, 'side', 'chair', 'Top knee on a chair, bottom leg lifted. Squeeze the top knee into the chair. Seconds per side.'],
  ['copenhagen-plank', 'Copenhagen plank (long lever)', 'Core', { timed: true, perSide: true }, 'side', 'chair', 'Top ankle on the chair, body straight, bottom leg hovering. Seconds per side.'],

  // ── DRAGON FLAG CHAIN · anterior core ──────────────────────────────────────────────────────
  ['reverse-crunch', 'Reverse crunch', 'Core', {}, 'dragon', null, 'Lie flat, hands anchored overhead on something solid, curl the knees to the chest and lift the hips. Lower slowly.'],
  ['dragon-flag-tuck', 'Tuck dragon flag', 'Core', {}, 'dragon', 'something to grip behind the head', 'Body up on the shoulder blades, knees tucked. Lower the whole body as one piece, stop before it touches.'],
  ['dragon-flag-negative', 'Dragon flag (negative)', 'Core', {}, 'dragon', 'something to grip behind the head', 'Straight body from the shoulders, lower as slowly as possible, reset with a tuck. Eccentrics only.'],
  ['dragon-flag', 'Dragon flag', 'Core', {}, 'dragon', 'something to grip behind the head', 'Straight body down and up without the hips sagging. Only the shoulder blades touch.'],

  // ── FIXED ACCESSORIES · no chain, progress by reps or seconds ──────────────────────────────
  ['prone-y-raise', 'Prone Y raise', 'Shoulders', {}, null, null, 'Lie face down, arms in a Y, thumbs up. Lift as high as possible, 1-s squeeze. Light but brutal.'],
  ['arch-raise', 'Arch raise', 'Back', {}, null, null, 'Face down, lift the chest and thighs together, 1-s hold at the top. Lower back and glutes.'],
  ['cossack-squat', 'Cossack squat', 'Quads', { perSide: true }, null, null, 'Wide stance, sit all the way to one side with the other leg straight and toes up. Alternate.'],
  ['wall-handstand-hold', 'Wall handstand hold', 'Shoulders', { timed: true }, null, 'wall', 'Chest to wall or back to wall. Push tall through the shoulders, ribs in. Seconds held.'],
  ['dead-hang', 'Dead hang', 'Back', { timed: true }, null, 'pull-up bar', 'Relaxed hang, then active hang (shoulders down). Grip and shoulder health. Seconds held.'],
  ['deep-squat-hold', 'Deep squat hold', 'Quads', { timed: true }, null, null, 'Feet flat, chest up, knees pushed out. Shift weight around. Seconds held.'],
  ['jump-squat', 'Jump squat', 'Quads', {}, null, null, 'Quarter squat, jump as high as you can, land soft and quiet. Stop the set when height drops.'],
  ['broad-jump', 'Broad jump', 'Full Body', {}, null, 'space', 'Two-foot takeoff, land soft and stuck. Walk back between reps. Power, not conditioning.'],
  ['bear-crawl', 'Bear crawl', 'Full Body', { timed: true }, null, 'floor space', 'Hands and feet, knees off the floor, hips low. Opposite hand and foot move together. Seconds.'],
  ['monkey', 'Monkey (lateral)', 'Full Body', { timed: true }, null, 'floor space', 'From a deep squat, plant both hands to the side and hop the feet across. Flow side to side. Seconds.'],
  ['frogger', 'Frogger', 'Full Body', { timed: true }, null, 'floor space', 'Deep squat, hands forward, hop the feet to the hands, repeat. Soft landings. Seconds.'],
  ['inverted-row', 'Inverted row (low bar)', 'Back', {}, null, 'low bar', 'Hang under a low bar, body straight, pull the chest to the bar. Only if your bar can sit low.'],
  ['neutral-grip-pull-up', 'Neutral-grip pull-up', 'Back', {}, null, 'pull-up bar with neutral handles', 'Palms facing each other. Chin over the bar, controlled descent.'],
  ['band-face-pull', 'Band face pull', 'Shoulders', { band: true }, null, 'band anchored to the bar', 'Pull to the face with elbows high, finish with the hands beside the ears. Slow return.'],
  ['band-lateral-raise', 'Band lateral raise', 'Shoulders', { band: true }, null, 'band', 'Stand on the band, raise to shoulder height with a soft elbow. Lean slightly forward.'],
  ['band-curl', 'Band curl', 'Biceps', { band: true }, null, 'band', 'Stand on the band, curl without swinging. Slow eccentric.'],
  ['band-pushdown', 'Band triceps pushdown', 'Triceps', { band: true }, null, 'band anchored to the bar', 'Elbows pinned, extend to lockout and squeeze.'],
  ['band-row', 'Band row', 'Back', { band: true }, null, 'band anchored to a door or the bar', 'Pull to the lower ribs, shoulder blades together, pause 1 s.'],
  ['band-pallof-press', 'Band Pallof press', 'Core', { perSide: true, band: true }, null, 'band anchored at chest height', 'Side-on to the anchor, press the band straight out and back. Hips do not rotate.'],
]);

export const LIBRARY_IDS: ReadonlySet<string> = new Set(EXERCISE_LIBRARY.map((e) => e.id));

/**
 * Library ids from earlier versions that no longer exist (gym equipment, boxing, retired rungs).
 * Rows with these ids are hidden from pickers; history that references them still displays by name.
 */
export const RETIRED_CHAIN_MEMBERS: ReadonlySet<string> = new Set([
  'mike-tyson-push-up', 'l-sit-pull-up', 'l-sit-chin-up',
  'bw-triceps-ext-high', 'bw-triceps-ext-low', 'sphinx-push-up',
]);
