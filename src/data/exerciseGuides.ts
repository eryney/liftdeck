import { EXERCISE_LIBRARY } from './exercises';

export type Point = [number, number];
export type Muscle = 'chest' | 'lats' | 'upperBack' | 'shoulders' | 'biceps' | 'triceps' | 'abs' | 'obliques' | 'lowerBack' | 'glutes' | 'quads' | 'hamstrings' | 'calves' | 'forearms' | 'hipFlexors' | 'adductors';
export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: 'Chest', lats: 'Lats', upperBack: 'Upper back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  abs: 'Abdominals', obliques: 'Obliques', lowerBack: 'Spinal erectors', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves', forearms: 'Forearms / grip', hipFlexors: 'Hip flexors', adductors: 'Inner thighs',
};
export interface Pose {
  head: Point; shoulder: Point; hip: Point;
  arms: [[Point, Point], [Point, Point]];
  legs: [[Point, Point], [Point, Point]];
  front?: boolean;
}
export interface Prop { points: Point[]; band?: boolean }
export interface GuideFrame { label: string; pose: Pose; props: Prop[] }
export interface ExerciseGuideData {
  frames: [GuideFrame, GuideFrame]; main: Muscle[]; supporting: Muscle[]; detail: string;
}
const prop = (points: Point[], band = false): Prop => ({ points, band });
const chair = (x: number, y: number): Prop[] => [prop([[x, 153], [x, y], [x + 35, y], [x + 35, 153]])];
const step = (x: number, y = 137): Prop[] => [prop([[x, 154], [x, y], [x + 35, y], [x + 35, 154]])];
const bar = prop([[40, 18], [160, 18]]);
const p = (head: Point, shoulder: Point, hip: Point, a: [Point, Point], b: [Point, Point], l: [Point, Point], r: [Point, Point], front = false): Pose => ({ head, shoulder, hip, arms: [a, b], legs: [l, r], front });
const stand = (): Pose => p([100, 27], [100, 46], [100, 97], [[74, 73], [74, 98]], [[126, 73], [126, 98]], [[88, 122], [84, 150]], [[112, 122], [116, 150]], true);
const f = (label: string, pose: Pose, props: Prop[] = []): GuideFrame => ({ label, pose, props });
function guide(frames: [GuideFrame, GuideFrame], main: Muscle[], supporting: Muscle[] = [], detail = ''): ExerciseGuideData {
  return { frames, main, supporting, detail };
}
const sideStand = () => p([86, 25], [87, 44], [92, 96], [[70, 71], [66, 92]], [[103, 72], [103, 94]], [[84, 121], [84, 150]], [[104, 121], [110, 150]]);
function squat(bottom: boolean): Pose {
  return bottom ? p([77, 60], [83, 79], [112, 113], [[58, 82], [35, 80]], [[65, 87], [42, 85]], [[69, 120], [83, 150]], [[94, 124], [108, 150]]) : sideStand();
}
function split(bottom: boolean, raised = false): Pose {
  return bottom ? p([76, 54], [80, 73], [93, 109], [[58, 91], [46, 78]], [[90, 95], [72, 84]], [[61, 112], [52, 150]], [[128, 138], [156, raised ? 103 : 150]])
    : p([89, 26], [92, 45], [102, 91], [[73, 67], [68, 90]], [[105, 70], [108, 92]], [[72, 117], [52, 150]], [[132, 119], [156, raised ? 103 : 150]]);
}
function push(bottom: boolean, incline = false, decline = false): Pose {
  return p([49, bottom ? 112 : incline ? 55 : 73], [65, bottom ? 117 : incline ? 66 : 86], [115, decline ? 97 : incline ? 100 : bottom ? 131 : 115],
    [[bottom ? 83 : 61, bottom ? 135 : incline ? 90 : 119], [54, incline ? 113 : 150]],
    [[bottom ? 90 : 72, bottom ? 131 : incline ? 90 : 118], [67, incline ? 113 : 148]],
    [[143, decline ? 100 : 139], [171, decline ? 105 : 150]], [[145, decline ? 98 : 137], [178, decline ? 105 : 150]]);
}
function pull(top: boolean): Pose {
  return p([100, top ? 9 : 62], [100, top ? 28 : 80], [100, top ? 76 : 120],
    [[63, top ? 55 : 51], [62, 18]], [[137, top ? 55 : 51], [138, 18]],
    [[87, top ? 105 : 139], [93, top ? 132 : 155]], [[113, top ? 105 : 139], [107, top ? 132 : 155]], true);
}
function hinge(low: boolean): Pose {
  return low ? p([47, 65], [64, 76], [110, 96], [[68, 104], [72, 128]], [[77, 104], [82, 128]], [[90, 123], [86, 150]], [[114, 123], [119, 150]]) : sideStand();
}
function bridge(up: boolean, extended = false): Pose {
  return p([33, 141], [51, 138], [97, up ? 104 : 140], [[65, 148], [89, 150]], [[65, 145], [85, 148]],
    [[extended ? 132 : 131, extended ? 127 : 109], [extended ? 168 : 146, 150]], [[extended ? 136 : 138, extended ? 126 : 111], [extended ? 177 : 155, 150]]);
}
function plank(side = false): Pose {
  return p([43, 93], [58, 108], [110, 122], [[53, 148], [29, 150]], [[72, 143], [94, 148]], [[142, 136], [176, 151]], [[141, 133], [172, 148]], side);
}
function prone(up: boolean): Pose {
  return p([43, up ? 119 : 140], [60, up ? 133 : 144], [108, 143], [[36, up ? 127 : 144], [15, up ? 122 : 147]], [[40, up ? 130 : 142], [20, up ? 126 : 145]], [[141, up ? 136 : 146], [178, up ? 125 : 150]], [[145, up ? 139 : 146], [181, up ? 130 : 149]]);
}

/** Two schematic key positions for every bundled exercise. Variants modify their own pose and setup. */
export function exerciseGuide(id: string): ExerciseGuideData | null {
  const ex = EXERCISE_LIBRARY.find((e) => e.id === id);
  if (!ex) return null; // Custom exercises never get an unrelated illustration.
  const chain = ex.progressionId;
  let g: ExerciseGuideData;
  if (chain === 'pull' || chain === 'chin' || id === 'neutral-grip-pull-up' || id === 'dead-hang' || chain === 'muscleup') {
    let start = pull(false), end = pull(true);
    const props: Prop[] = [bar];
    let labels: [string, string] = ['Hang', 'Pull up'];
    if (id === 'scapular-pull-up' || id === 'dead-hang') {
      end = pull(false); end.shoulder[1] -= 6; end.head[1] -= 6; end.hip[1] -= 6;
      labels = ['Hang', 'Shoulders down'];
    }
    if (id.includes('archer') || id.includes('typewriter')) {
      end.shoulder = [73, 28]; end.head = [73, 9]; end.hip = [77, 77];
      end.arms = [[[55, 52], [53, 18]], [[121, 22], [160, 18]]];
      labels[1] = id.includes('typewriter') ? 'Traverse at top' : 'Pull to one hand';
    }
    if (id.includes('one-arm')) {
      start.arms[1] = [[131, 103], [136, 127]]; end.arms[1] = [[135, 68], [136, 93]];
      start.arms[0] = [[83, 48], [91, 18]]; end.arms[0] = [[67, 64], [91, 18]];
      if (id.includes('assisted')) {
        props.push(prop([[132, 18], [132, 112]], true));
        start.arms[1] = [[133, 88], [132, 70]]; end.arms[1] = [[137, 67], [132, 70]];
      }
    }
    if (chain === 'muscleup') {
      end.head = [100, 12]; end.shoulder = [100, 31]; end.hip = [100, 76];
      labels[1] = 'Pull chest high';
      if (id.includes('muscle-up')) {
        // Raise the support bar in the coordinate system's body frame, with shoulders above the hands.
        props[0] = prop([[40, 88], [160, 88]]);
        start = p([100, 67], [100, 85], [100, 126], [[61, 108], [62, 88]], [[139, 108], [138, 88]], [[83, 142], [80, 155]], [[117, 142], [120, 155]], true);
        end = p([100, 18], [100, 37], [100, 88], [[70, 62], [62, 88]], [[130, 62], [138, 88]], [[86, 115], [86, 147]], [[114, 115], [114, 147]], true);
        labels = ['Pull / transition', 'Press to support'];
      }
    }
    if (id.includes('negative')) { [start, end] = [end, start]; labels = ['Start at top', 'Lower slowly']; }
    const propsFor = (pose: Pose) => id.includes('band-assisted') ? [...props,prop([[100,18],pose.legs[0][1],pose.legs[1][1],[100,18]],true)] : props;
    g = guide([f(labels[0], start, propsFor(start)), f(labels[1], end, propsFor(end))], chain === 'chin' ? ['lats', 'biceps'] : ['lats', 'upperBack'], ['biceps', 'forearms', 'abs']);
  } else if (chain === 'bandrow' || id === 'band-romanian-deadlift') {
    const start = hinge(true), end = id === 'band-romanian-deadlift' ? hinge(false) : hinge(true);
    if (chain === 'bandrow') end.arms = [[[100, 73], [85, 92]], [[111, 78], [96, 96]]];
    const bands = (pose: Pose) => [prop([pose.arms[0][1], [86, 150], [119, 150], pose.arms[1][1]], true)];
    g = guide([f('Hinge at hips', start, bands(start)), f(chain === 'bandrow' ? 'Pull to ribs' : 'Stand tall', end, bands(end))], chain === 'bandrow' ? ['lats', 'upperBack'] : ['hamstrings', 'glutes'], chain === 'bandrow' ? ['biceps', 'lowerBack'] : ['lowerBack', 'abs']);
  } else if (chain === 'push' || chain === 'row' || id === 'inverted-row' || id === 'forearm-plank') {
    const incline = id.includes('incline') || id === 'one-arm-push-up-elevated';
    const decline = id === 'decline-push-up';
    let a = push(false, incline, decline), b = push(true, incline, decline);
    let props: Prop[] = incline ? chair(32, 113) : decline ? chair(155, 105) : [];
    if (id.includes('one-arm')) { a.arms[1] = [[89, 90], [112, 113]]; b.arms[1] = [[88, 110], [112, 129]]; }
    if (id === 'diamond-push-up') { a.arms[0][1] = [62, 150]; a.arms[1][1] = [65, 150]; b.arms[0][1] = [62, 150]; b.arms[1][1] = [65, 150]; }
    if (id === 'pseudo-planche-push-up') { a.arms[0][1] = [98, 150]; a.arms[1][1] = [105, 150]; b.arms[0][1] = [98, 150]; b.arms[1][1] = [105, 150]; }
    if (id === 'archer-push-up') { a.arms[1] = [[111, 120], [149, 151]]; b.arms[1] = [[116, 133], [149, 151]]; }
    if (chain === 'row' || id === 'inverted-row') {
      props = [prop([[25, 155], [25, 64], [110, 64], [110, 155]])];
      a = p([42, 120], [58, 125], [110, 139], [[62, 94], [65, 64]], [[74, 94], [78, 64]], [[141, 145], [172, 151]], [[144, 142], [177, 150]]);
      b = p([42, 69], [58, 82], [110, 110], [[82, 99], [65, 64]], [[91, 97], [78, 64]], [[141, 131], [172, 151]], [[144, 129], [177, 150]]);
      if (id.includes('feet-elevated')) {
        for (const pose of [a,b]) { pose.legs[0][1][1] = 109; pose.legs[1][1][1] = 109; }
        props.push(...chair(156, 109));
      }
      if (id.includes('one-arm')) { a.arms[1] = [[84, 130], [76, 120]]; b.arms[1] = [[84, 100], [76, 80]]; }
      if (id.includes('archer')) { a.arms[1] = [[108, 95], [138, 64]]; b.arms[1] = [[104, 77], [138, 64]]; props[0] = prop([[25,155],[25,64],[153,64],[153,155]]); }
      g = guide([f('Arms extended', a, props), f('Chest to edge', b, props)], ['lats', 'upperBack'], ['biceps', 'abs']);
    } else if (id === 'forearm-plank') {
      a = plank(); a.hip = [104, 135]; a.legs = [[[125,150],[153,142]],[[134,150],[163,142]]];
      g = guide([f('Knees down', a), f('Brace and hold', plank())], ['abs'], ['obliques', 'shoulders', 'glutes']);
    } else g = guide([f('Arms extended', a, props), f('Lower chest', b, props)], id === 'diamond-push-up' ? ['triceps', 'chest'] : ['chest'], ['triceps', 'shoulders', 'abs']);
  } else if (chain === 'squat' || chain === 'lunge' || ['band-front-squat', 'cossack-squat', 'deep-squat-hold', 'jump-squat', 'broad-jump'].includes(id)) {
    const isSplit = id.includes('split') || id.includes('lunge');
    const raised = id.includes('bulgarian');
    let a = isSplit ? split(false, raised) : squat(false), b = isSplit ? split(true, raised) : squat(true);
    const props: Prop[] = raised ? chair(146, 103) : [];
    if (id.includes('pistol')) {
      a.legs[1] = [[135,115],[159,119]]; b.legs[1] = [[143,116],[176,120]];
      if (id.includes('assisted')) { a.arms[0] = [[54,56],[35,63]]; b.arms[0] = [[55,77],[35,63]]; props.push(prop([[35,20],[35,155]])); }
    }
    if (id.includes('shrimp') || id.includes('skater')) {
      a.legs[1] = [[120,119],[145,101]]; b.legs[1] = [[137,145],[158,119]];
      if (id.includes('shrimp')) { a.arms[1] = [[121,77],[145,101]]; b.arms[1] = [[133,99],[158,119]]; }
    }
    if (id.includes('deficit') || id === 'elevated-pistol-squat') props.push(...step(70,150));
    if (id === 'cossack-squat') {
      a = stand(); a.legs = [[[65,121],[30,150]],[[135,121],[170,150]]];
      b = p([63,65],[63,83],[73,118],[[39,105],[43,86]],[[95,105],[87,86]],[[35,123],[30,150]],[[124,134],[170,150]],true);
    }
    const bands = (pose: Pose) => id === 'band-front-squat' ? [prop([[83,150],[65,62],[111,62],[110,150]],true)] : [];
    if (id === 'band-front-squat') for (const pose of [a,b]) pose.arms = [[[67,83],[65,62]],[[115,82],[111,62]]];
    let labels: [string,string] = ['Stand / set stance', 'Lower with control'];
    if (id === 'deep-squat-hold') labels[1] = 'Hold deep squat';
    if (id === 'jump-squat' || id === 'broad-jump') {
      a = squat(true); b = sideStand(); b.head[1] -= 12; b.shoulder[1] -= 12; b.hip[1] -= 12;
      b.legs = [[[84,105],[82,132]],[[110,105],[119,132]]]; b.arms = [[[63,29],[51,10]],[[105,20],[121,8]]];
      labels = ['Load the legs', id === 'broad-jump' ? 'Jump forward' : 'Jump up'];
    }
    g = guide([f(labels[0],a,[...props,...bands(a)]), f(labels[1],b,[...props,...bands(b)])], ['quads','glutes'], ['hamstrings','abs', ...(id === 'cossack-squat' ? ['adductors' as Muscle] : [])]);
  } else if (chain === 'hinge' || chain === 'glute') {
    let a = bridge(false), b = bridge(true); let props: Prop[] = []; let labels: [string,string] = ['Hips lowered','Drive hips up'];
    if (id.includes('sliding')) { a = bridge(true,true); b = bridge(true); labels = ['Heels out','Curl heels in']; props = [prop([[142,154],[184,154]])]; }
    if (id.includes('single-leg')) { a.legs[1] = [[120,104],[137,74]]; b.legs[1] = [[117,77],[134,47]]; }
    if (id.includes('hip-thrust')) {
      props.push(...chair(22,111));
      for (const pose of [a,b]) { pose.head[1] -= 27; pose.shoulder[1] -= 27; }
      b.hip[1] = 105; a.hip[1] = 135;
      if (id.includes('elevated')) { a.legs[0][1][1] = 111; b.legs[0][1][1] = 111; props.push(...chair(137,111)); }
    }
    if (id.includes('nordic')) {
      a = p([78,32],[81,51],[88,101],[[60,78],[43,78]],[[94,80],[83,87]],[[93,147],[136,148]],[[103,147],[144,148]]);
      b = p([34,108],[51,115],[87,134],[[37,134],[32,150]],[[61,140],[51,152]],[[96,147],[136,148]],[[103,147],[144,148]]);
      props = [prop([[130,138],[155,138],[155,154]])]; labels = ['Kneel, ankles secured','Lower as one unit'];
      if (id.includes('overhead')) { a.arms = [[[70,25],[62,5]],[[87,23],[87,5]]]; b.arms = [[[27,108],[9,99]],[[34,117],[12,111]]]; }
    }
    g = guide([f(labels[0],a,props),f(labels[1],b,props)], chain === 'hinge' ? ['hamstrings'] : ['glutes'], ['glutes','hamstrings','abs'].filter((m) => m !== (chain === 'hinge' ? 'hamstrings' : 'glutes')) as Muscle[]);
  } else if (chain === 'dip') {
    const bench = id.includes('bench');
    const a = p([86,28],[88,47],[98,94],[[67,71],[54,97]],[[75,72],[62,97]],[[129,120],[157,151]],[[136,120],[167,151]]);
    const b = p([88,64],[90,83],[104,127],[[54,78],[54,97]],[[65,84],[62,97]],[[134,136],[157,151]],[[140,136],[167,151]]);
    let props = chair(25,97);
    if (!bench) {
      a.front = b.front = true;
      a.arms = [[[62,69],[52,97]],[[124,69],[135,97]]]; b.arms = [[[55,75],[52,97]],[[128,75],[135,97]]];
      a.legs = [[[82,120],[100,140]],[[115,120],[132,140]]]; b.legs = [[[85,144],[110,153]],[[117,144],[142,153]]];
      props = [...chair(17,97),...chair(135,97)];
    } else if (id.includes('elevated')) {
      for (const pose of [a,b]) { pose.legs[0][1][1] = 109; pose.legs[1][1][1] = 109; }
      props.push(...chair(151,109));
    }
    g = guide([f('Support at top',a,props),f('Bend elbows',b,props)], bench ? ['triceps'] : ['chest','triceps'], ['shoulders']);
  } else if (chain === 'calf') {
    const a = stand(), b = stand(); const props = step(75,146);
    for (const pose of [a,b]) {
      if (id !== 'standing-calf-raise') pose.legs[1] = [[116,112],[133,99]];
    }
    b.head[1] -= 8; b.shoulder[1] -= 8; b.hip[1] -= 8;
    b.legs[0] = [[86,115],[83,138]];
    if (id === 'standing-calf-raise') b.legs[1] = [[114,115],[117,138]];
    g = guide([f('Heel lowers',a,props),f('Rise onto toes',b,props)],['calves'],[]);
  } else if (id === 'dead-bug' || id === 'floor-reverse-crunch' || id === 'reverse-crunch') {
    const a = p([34,143],[52,141],[105,141],[[61,113],[64,84]],[[70,112],[75,84]],[[109,104],[145,104]],[[119,108],[155,108]]);
    const b: Pose = structuredClone(a);
    if (id === 'dead-bug') { b.arms[0] = [[33,126],[12,111]]; b.legs[1] = [[140,140],[177,146]]; }
    else { b.hip = [103,121]; b.legs = [[[83,97],[108,75]],[[94,99],[120,77]]]; for (const pose of [a,b]) pose.arms = [[[70,150],[91,151]],[[72,146],[93,147]]]; }
    g = guide([f('Set up on back',a),f(id === 'dead-bug' ? 'Opposite arm + leg' : 'Curl pelvis up',b)],['abs'],id === 'dead-bug' ? ['obliques'] : ['hipFlexors']);
  } else if (chain === 'side') {
    const a = plank(), b = plank();
    a.hip[1] = 145; b.arms[1] = [[91,99],[110,122]];
    let props: Prop[] = [];
    if (id !== 'side-plank') {
      props = chair(157,109); a.legs[0][1] = [176,109]; b.legs[0][1] = [176,109];
      if (id.includes('copenhagen')) {
        if (id.includes('short')) { a.legs[0] = [[164,109],[182,133]]; b.legs[0] = [[164,109],[182,133]]; }
        b.legs[1] = [[140,126],[173,132]];
      } else { a.legs[1][1] = [173,109]; b.legs[1][1] = [173,109]; }
    }
    g = guide([f('Elbow below shoulder',a,props),f('Lift hips and hold',b,props)], id.includes('copenhagen') ? ['adductors','obliques'] : ['obliques'],['shoulders','glutes']);
  } else if (id === 'arch-raise' || id === 'prone-y-raise') {
    if (id === 'prone-y-raise') {
      const a = stand(), b = stand();
      a.arms = [[[65,34],[43,20]],[[135,34],[157,20]]];
      b.arms = [[[65,26],[43,8]],[[135,26],[157,8]]];
      g = guide([f('Face down, arms in Y',a),f('Lift arms slightly',b)],['upperBack','shoulders']);
    } else g = guide([f('Lie face down',prone(false)),f('Lift, then lower',prone(true))],['lowerBack','glutes'],['hamstrings']);
  } else if (chain === 'vpush' || id === 'wall-handstand-hold') {
    const pike = id.includes('pike');
    let a = p([54,101],[65,84],[108,57],[[56,119],[47,151]],[[74,118],[66,151]],[[138,105],[166,151]],[[145,104],[176,151]]);
    let b = structuredClone(a); b.head = [49,139]; b.shoulder = [66,119]; b.arms = [[[85,134],[47,151]],[[94,130],[66,151]]];
    let props: Prop[] = [];
    if (!pike) {
      a = p([91,108],[92,89],[101,48],[[78,119],[74,151]],[[109,119],[113,151]],[[111,28],[124,8]],[[117,28],[130,8]]);
      b = p([89,140],[92,122],[100,77],[[65,134],[74,151]],[[121,134],[113,151]],[[112,49],[129,24]],[[118,49],[133,24]]);
      props = [prop([[135,4],[135,155]])];
    } else if (id.includes('elevated')) { a.legs[0][1][1] = 105; a.legs[1][1][1] = 105; b.legs = structuredClone(a.legs); props = chair(151,105); }
    if (id.includes('partial') || id.includes('deficit')) props.push(...step(id.includes('partial') ? 76 : 50,143));
    if (id.includes('negative')) g = guide([f('Start in support',a,props),f('Lower slowly',b,props)],['shoulders','triceps'],['abs']);
    else g = guide([f('Set up',b,props),f(id.includes('hold') ? 'Push tall and hold' : 'Press up',a,props)],['shoulders','triceps'],['abs']);
  } else if (chain === 'frontlever' || chain === 'planche' || chain === 'dragon' || chain === 'lsit' || chain === 'hangcore') {
    // Library-only skill positions remain distinct from upright bar work in the default program.
    let a = bridge(false), b = bridge(true); let props: Prop[] = []; let labels: [string,string] = ['Set up','Hold position'];
    if (chain === 'hangcore') {
      a = pull(false); b = pull(false); props = [bar];
      b.legs = id === 'hanging-knee-raise' ? [[[70,115],[70,143]],[[126,115],[126,143]]] : [[[127,106],[167,96]],[[132,113],[174,105]]];
      if (id.includes('toes') || id.includes('windshield')) b.legs = [[[124,69],[141,24]],[[133,74],[151,29]]];
      labels = ['Hang still','Raise knees / legs'];
    } else if (chain === 'lsit') {
      a = p([57,80],[66,98],[84,138],[[51,121],[42,150]],[[81,123],[94,150]],[[124,145],[169,150]],[[128,140],[176,147]]);
      b = structuredClone(a); b.hip[1] = 116;
      b.legs = id.includes('tuck') ? [[[118,104],[119,134]],[[124,105],[128,135]]] : [[[128,113],[172,113]],[[130,119],[179,119]]];
      if (id.includes('one-leg')) b.legs[1] = [[114,98],[125,126]];
      if (id === 'v-sit') b.legs = [[[117,79],[148,37]],[[125,85],[158,44]]];
      if (id === 'hollow-body-hold') { a = bridge(false); b = p([33,119],[50,131],[102,145],[[31,110],[10,95]],[[39,109],[21,93]],[[139,132],[176,119]],[[145,137],[183,125]]); }
      labels = ['Set up on floor','Lift and hold'];
    } else if (chain === 'frontlever') {
      a = pull(false); props = [bar];
      b = p([42,90],[60,99],[106,102],[[67,58],[74,18]],[[82,58],[91,18]],[[140,103],[179,104]],[[144,109],[181,112]]);
      if (id.includes('tuck')) b.legs = id.includes('advanced') ? [[[114,133],[141,121]],[[122,136],[152,126]]] : [[[82,118],[112,136]],[[93,124],[127,142]]];
      if (id.includes('one-leg')) b.legs[1] = [[92,125],[124,143]];
      if (id.includes('straddle')) b.legs = [[[141,87],[180,77]],[[141,122],[180,140]]];
      labels = ['Hang','Lever hold'];
    } else if (chain === 'planche') {
      a = push(false); b = push(false);
      b.head = [34,76]; b.shoulder = [50,91]; b.hip = [102,100]; b.arms = [[[66,121],[83,151]],[[77,120],[94,151]]];
      b.legs = id.includes('tuck') ? [[[86,126],[115,133]],[[99,128],[129,138]]] : [[[140,91],[179,78]],[[142,117],[180,133]]];
      if (id === 'planche-lean') b.legs = a.legs;
      if (id.includes('advanced')) b.legs = [[[114,129],[145,128]],[[121,133],[155,131]]];
      labels = ['Support position',id === 'planche-lean' ? 'Lean forward' : 'Lift and hold'];
    } else {
      a = bridge(false); b = p([34,142],[50,138],[86,105],[[37,122],[17,133]],[[49,119],[25,128]],[[115,76],[144,46]],[[122,80],[154,50]]);
      props = [prop([[15,110],[15,155]])];
      if (id.includes('tuck')) b.legs = [[[77,76],[101,90]],[[86,75],[111,91]]];
      labels = ['Shoulders supported','Lift body as a unit'];
      if (id.includes('negative')) { [a,b] = [b,a]; labels = ['Start raised','Lower slowly']; }
    }
    g = guide([f(labels[0],a,props),f(labels[1],b,props)], chain === 'frontlever' ? ['lats','abs'] : chain === 'planche' ? ['shoulders','abs'] : ['abs','hipFlexors'], chain === 'planche' ? ['chest','triceps'] : ['obliques']);
  } else if (id.startsWith('band-')) {
    let a = stand(), b = stand(); let propsA: Prop[] = [], propsB: Prop[] = []; let main: Muscle[] = ['shoulders'], support: Muscle[] = []; let labels: [string,string] = ['Start','Finish'];
    if (id === 'band-shoulder-press') {
      a.arms = [[[67,71],[64,43]],[[133,71],[136,43]]]; b.arms = [[[77,28],[77,7]],[[123,28],[123,7]]]; main = ['shoulders']; support = ['triceps','abs']; labels = ['Hands at shoulders','Press overhead'];
    } else if (id === 'band-curl') {
      b.arms = [[[73,74],[84,48]],[[127,74],[116,48]]]; main = ['biceps']; support = ['forearms']; labels = ['Arms long','Curl, elbows still'];
    } else if (id === 'band-lateral-raise') {
      b.arms = [[[53,55],[20,61]],[[147,55],[180,61]]]; labels = ['Arms by sides','Raise to shoulders'];
    } else if (id === 'band-pull-apart') {
      a.arms = [[[80,62],[89,67]],[[120,62],[111,67]]]; b.arms = [[[52,55],[21,56]],[[148,55],[179,56]]]; main = ['upperBack','shoulders']; labels = ['Band at chest height','Pull hands apart'];
    } else if (id === 'band-overhead-triceps-extension') {
      for (const pose of [a,b]) pose.arms[0] = [[82,18],[94,52]];
      a.arms[1] = b.arms[1] = [[135,75],[108,86]]; b.arms[0] = [[82,18],[69,3]];
      main = ['triceps']; labels = ['Elbow points up','Straighten upper arm'];
      propsA = [prop([a.arms[0][1],a.arms[1][1]],true)]; propsB = [prop([b.arms[0][1],b.arms[1][1]],true)];
    } else if (id === 'band-chest-press' || id === 'band-pallof-press' || id === 'band-row' || id === 'band-face-pull' || id === 'band-pushdown') {
      a = sideStand(); b = sideStand();
      a.arms = [[[103,69],[127,54]],[[109,75],[137,60]]]; b.arms = [[[120,47],[155,47]],[[127,54],[164,54]]];
      main = id === 'band-chest-press' ? ['chest'] : ['abs','obliques']; support = id === 'band-chest-press' ? ['triceps','shoulders'] : [];
      labels = ['Hands at chest','Press forward'];
      if (id === 'band-row' || id === 'band-face-pull') {
        [a,b] = [b,a]; main = id === 'band-row' ? ['lats','upperBack'] : ['upperBack','shoulders']; support = ['biceps']; labels = ['Arms long',id === 'band-row' ? 'Pull to ribs' : 'Pull toward face'];
      }
      if (id === 'band-pushdown') { b = sideStand(); main = ['triceps']; support = []; labels = ['Elbows tucked','Straighten elbows']; }
      const anchor: Point = id === 'band-chest-press' ? [75,54] : id === 'band-pushdown' ? [150,15] : [180,58];
      propsA = [prop([a.arms[0][1],anchor,a.arms[1][1]],true)]; propsB = [prop([b.arms[0][1],anchor,b.arms[1][1]],true)];
    } else if (id === 'band-seated-row') {
      a = p([61,57],[68,76],[86,138],[[103,85],[140,94]],[[110,93],[148,99]],[[126,132],[172,150]],[[132,138],[180,150]]);
      b = structuredClone(a); b.arms = [[[62,108],[89,109]],[[76,114],[102,113]]];
      main = ['lats','upperBack']; support = ['biceps']; labels = ['Sit tall, arms long','Pull to ribs'];
      propsA = [prop([a.arms[0][1],[172,150],a.arms[1][1]],true)]; propsB = [prop([b.arms[0][1],[172,150],b.arms[1][1]],true)];
    }
    if (!propsA.length) {
      propsA = [prop(id === 'band-pull-apart' ? [a.arms[0][1],a.arms[1][1]] : [a.arms[0][1],[84,150],[116,150],a.arms[1][1]],true)];
      propsB = [prop(id === 'band-pull-apart' ? [b.arms[0][1],b.arms[1][1]] : [b.arms[0][1],[84,150],[116,150],b.arms[1][1]],true)];
    }
    g = guide([f(labels[0],a,propsA),f(labels[1],b,propsB)],main,support);
  } else if (id === 'bear-crawl' || id === 'monkey' || id === 'frogger') {
    const a = p([43,93],[59,107],[117,99],[[55,130],[47,151]],[[75,128],[76,151]],[[103,133],[147,151]],[[142,132],[169,151]]);
    const b = structuredClone(a); b.arms[0][1] = [22,151]; b.legs[1] = [[118,133],[146,150]];
    if (id !== 'bear-crawl') { b.hip = [96,111]; b.legs = [[[67,130],[62,150]],[[113,132],[104,150]]]; }
    g = guide([f('Hands and feet set',a),f(id === 'bear-crawl' ? 'Opposite hand + foot' : 'Shift / hop feet',b)],['abs','quads','shoulders'],['glutes']);
  } else return null;
  // The written cue distinguishes tempo, grip, support and range between adjacent variations.
  return { ...g, detail: ex.cue ?? '', supporting: g.supporting.filter((m) => !g.main.includes(m)) };
}
