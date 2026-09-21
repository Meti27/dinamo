/**
 * The first screen, shown until the burger sequence is decoded.
 *
 * Deliberately plain: it is on screen for well under a second on a decent
 * connection, and the one thing it has to do is be honest about progress so a
 * slow connection does not look like a hung page. Built from the same tokens
 * as the stage it hands over to, so the fade reads as the site arriving rather
 * than as one screen being replaced by another.
 *
 * `done` starts the fade; the parent unmounts this a beat later.
 */
export default function Preloader({ progress, label, done }: {
  progress: number;
  label: string;
  done: boolean;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div
      className={done ? "preloader is-done" : "preloader"}
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      <div className="preloader-inner">
        <span className="preloader-word">DINAMO</span>
        <span className="preloader-bar">
          <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} />
        </span>
        <em className="preloader-pct">{label} {pct}%</em>
      </div>
    </div>
  );
}
