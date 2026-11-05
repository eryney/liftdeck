import { exerciseGuide, MUSCLE_NAMES } from '../data/exerciseGuides';
import type { GuideFrame, Muscle, Point, Pose } from '../data/exerciseGuides';
import { EXERCISE_LIBRARY } from '../data/exercises';

const pts = (points: Point[]) => points.map((p) => p.join(',')).join(' ');
function Figure({ pose }: { pose: Pose }) {
  const { shoulder: s, hip: h } = pose;
  const dx = h[0] - s[0], dy = h[1] - s[1], length = Math.hypot(dx, dy) || 1;
  const normal: Point = [-dy / length, dx / length];
  const offset = (p: Point, width: number): Point => [p[0] + normal[0] * width, p[1] + normal[1] * width];
  const shoulders: [Point,Point] = pose.front ? [offset(s,14),offset(s,-14)] : [offset(s,3),offset(s,-3)];
  const hips: [Point,Point] = pose.front ? [offset(h,8),offset(h,-8)] : [offset(h,3),offset(h,-3)];
  const limb = (points: Point[], far = false, key = '') => <polyline key={key} points={pts(points)} fill="none" stroke={far ? '#8a9aa8' : '#dbe4e9'} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />;
  return <g>
    {limb([shoulders[1],...pose.arms[1]],true)}
    {limb([hips[1],...pose.legs[1]],true)}
    <polygon points={pts([offset(s,pose.front ? 15 : 10),offset(s,pose.front ? -15 : -10),offset(h,-8),offset(h,8)])} fill="#bbc9d2" stroke="#dbe4e9" strokeWidth="2" strokeLinejoin="round" />
    <line x1={pose.head[0]} y1={pose.head[1]} x2={s[0]} y2={s[1]} stroke="#dbe4e9" strokeWidth="8" />
    {limb([shoulders[0],...pose.arms[0]])}
    {limb([hips[0],...pose.legs[0]])}
    <circle cx={pose.head[0]} cy={pose.head[1]} r="8" fill="#dbe4e9" />
    <circle cx={h[0]} cy={h[1]} r="8" fill="#bbc9d2" />
  </g>;
}
function Frame({ frame, exerciseName, index }: { frame: GuideFrame; exerciseName: string; index: number }) {
  return <div className="exercise-guide__frame">
    <svg viewBox="0 0 200 166" role="img" aria-label={`${exerciseName}: ${frame.label}`}>
      <path d="M12 157H188" stroke="#34424d" strokeWidth="1" />
      {frame.props.filter((p) => !p.band).map((p,i) => <polyline key={i} points={pts(p.points)} fill="none" stroke="#668ca8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
      <Figure pose={frame.pose} />
      {frame.props.filter((p) => p.band).map((p,i) => <polyline key={i} points={pts(p.points)} fill="none" stroke="#f4bf66" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <div className="exercise-guide__caption"><span>{index + 1}</span>{frame.label}</div>
  </div>;
}

/** Front and back regions are a schematic muscle map, not a measure of activation. */
export function MuscleMap({ main, supporting }: { main: Muscle[]; supporting: Muscle[] }) {
  const color = (m: Muscle) => main.includes(m) ? '#f28e68' : supporting.includes(m) ? '#72b9e7' : '#465562';
  const body = <g fill="#34424d" stroke="#5b6c7a" strokeWidth="0.8">
    <ellipse cx="50" cy="16" rx="9" ry="12" />
    <path d="M44 28L44 34L29 40L22 61L18 86L14 104L21 107L28 86L33 65L36 89L32 109L34 137L36 158L46 158L47 134L50 113L53 134L54 158L64 158L66 137L68 109L64 89L67 65L72 86L79 107L86 104L82 86L78 61L71 40L56 34L56 28Z" />
  </g>;
  return <svg className="muscle-map" viewBox="0 0 210 180" role="img" aria-label={`Main muscles: ${main.map((m) => MUSCLE_NAMES[m]).join(', ')}. Supporting muscles: ${supporting.map((m) => MUSCLE_NAMES[m]).join(', ') || 'none highlighted'}`}>
    <g>
      {body}
      <path d="M32 43Q38 39 48 43L48 57Q38 61 32 54ZM52 43Q62 39 68 43L68 54Q62 61 52 57Z" fill={color('chest')} />
      <path d="M28 43L34 42L33 55L26 59ZM66 42L72 43L74 59L67 55Z" fill={color('shoulders')} />
      <path d="M27 61L33 58L29 77L23 79ZM67 58L73 61L77 79L71 77Z" fill={color('biceps')} />
      <path d="M23 82L28 81L22 99L18 101ZM72 81L77 82L82 101L78 99Z" fill={color('forearms')} />
      <path d="M43 61H57L58 84L50 94L42 84Z" fill={color('abs')} />
      <path d="M35 62L40 62L40 84L36 88ZM60 62H65L64 88L60 84Z" fill={color('obliques')} />
      <path d="M37 91L46 95L44 106L36 102ZM54 95L63 91L64 102L56 106Z" fill={color('hipFlexors')} />
      <path d="M35 107L43 109L44 129L36 135ZM57 109L65 107L64 135L56 129Z" fill={color('quads')} />
      <path d="M44 106L48 109L46 125L44 122ZM52 109L56 106L56 122L54 125Z" fill={color('adductors')} />
      <path d="M36 138L42 136L43 150L38 152ZM58 136L64 138L62 152L57 150Z" fill={color('calves')} />
      <text x="50" y="174" textAnchor="middle">Front</text>
    </g>
    <g transform="translate(110 0)">
      {body}
      <path d="M45 32H55L63 44L50 61L37 44Z" fill={color('upperBack')} />
      <path d="M34 49L43 57L48 65L43 81L36 70ZM66 49L57 57L52 65L57 81L64 70Z" fill={color('lats')} />
      <path d="M28 43L35 41L35 52L26 59ZM65 41L72 43L74 59L65 52Z" fill={color('shoulders')} />
      <path d="M26 61L32 59L29 78L23 79ZM68 59L74 61L77 79L71 78Z" fill={color('triceps')} />
      <path d="M44 66L49 64V90L42 88ZM51 64L56 66L58 88L51 90Z" fill={color('lowerBack')} />
      <path d="M36 93L48 91L49 105Q42 113 34 105ZM52 91L64 93L66 105Q58 113 51 105Z" fill={color('glutes')} />
      <path d="M35 112L45 113L44 133L36 133ZM55 113L65 112L64 133L56 133Z" fill={color('hamstrings')} />
      <path d="M36 137L44 136L43 150L38 154ZM56 136L64 137L62 154L57 150Z" fill={color('calves')} />
      <text x="50" y="174" textAnchor="middle">Back</text>
    </g>
  </svg>;
}

export function ExerciseGuide({ exerciseId, showCue = false }: { exerciseId: string; showCue?: boolean }) {
  const guide = exerciseGuide(exerciseId);
  if (!guide) return null;
  const name = EXERCISE_LIBRARY.find((e) => e.id === exerciseId)!.name;
  return <figure className="exercise-guide" data-testid="exercise-guide" data-exercise={exerciseId}>
    <div className="exercise-guide__frames">
      {guide.frames.map((frame,i) => <Frame key={i} frame={frame} index={i} exerciseName={name} />)}
    </div>
    <figcaption className="exercise-guide__muscles">
      <MuscleMap main={guide.main} supporting={guide.supporting} />
      <div className="grow">
        <div className="guide-main"><span className="guide-dot" />Main muscles</div>
        <div className="small">{guide.main.map((m) => MUSCLE_NAMES[m]).join(', ')}</div>
        {guide.supporting.length > 0 && <><div className="guide-support mt8"><span className="guide-dot" />Supporting</div><div className="faint tiny">{guide.supporting.map((m) => MUSCLE_NAMES[m]).join(', ')}</div></>}
      </div>
    </figcaption>
    {showCue && <p className="exercise-guide__cue small">{guide.detail}</p>}
  </figure>;
}
