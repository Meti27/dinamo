/**
 * The crest, as a square with transparency around it.
 *
 * `public/dinamo.jpg` is the 4:3 source photo with a mottled blue backdrop; it
 * cannot be used directly, because a non-square image under `border-radius: 50%`
 * renders as an ellipse. `scripts/build-logo.py` cuts the disc out of it.
 */
export default function Logo({ size, className }: { size: number; className?: string }) {
  return (
    <picture>
      <source srcSet="/dinamo-logo.avif" type="image/avif" />
      <img className={className} src="/dinamo-logo.webp" alt="Dinamo"
        width={size} height={size} />
    </picture>
  );
}
