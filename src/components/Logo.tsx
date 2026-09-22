/**
 * The crest, as a square with transparency around it.
 *
 * `public/dinamo.jpg` is the 4:3 source photo with a mottled blue backdrop; it
 * cannot be used directly, because a non-square image under `border-radius: 50%`
 * renders as an ellipse. `scripts/build-logo.py` cuts the disc out of it, at two
 * sizes: 512 for the location panel, which shows it at 220 CSS px, and 128 for
 * the nav and the footer, which show it at 44 and 36.
 *
 * The nav's copy is on the critical path — it is in the first paint — and was
 * being served the 512px file for a 44px slot: 14KB and five times the pixels it
 * could show, against 3KB for the small one.
 *
 * `priority` is the nav, and only the nav. The other two instances are eight
 * screens down; the location panel's is the 512px file, and it was being fetched
 * during the first paint alongside everything the first screen actually needs.
 */

/** above this many CSS px the small file would be upscaled at DPR 2 */
const SMALL_MAX = 64;

export default function Logo({ size, className, priority = false }: {
  size: number; className?: string; priority?: boolean;
}) {
  const stem = size <= SMALL_MAX ? "/dinamo-logo-128" : "/dinamo-logo";
  return (
    <picture>
      <source srcSet={`${stem}.avif`} type="image/avif" />
      <img className={className} src={`${stem}.webp`} alt="Dinamo"
        width={size} height={size}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        {...(priority ? { fetchPriority: "high" as const } : null)} />
    </picture>
  );
}
