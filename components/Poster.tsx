import Image from "next/image";

/**
 * A film poster from Apple's image CDN, decorative (the title is always next
 * to it). `unoptimized`: Apple already serves the requested size, so this
 * skips Next's image optimiser and its remote-host config. Without a URL it
 * keeps the space as a plain frame so lists stay aligned.
 */
export default function Poster({ url, width, className = "" }: { url: string | null; width: number; className?: string }) {
  const height = Math.round(width * 1.5);
  const frame = `shrink-0 rounded-sm border border-seam bg-reel ${className}`;
  if (!url) return <span aria-hidden="true" className={frame} style={{ width, height }} />;
  return (
    <Image
      src={url}
      alt=""
      width={width}
      height={height}
      unoptimized
      loading="lazy"
      className={`object-cover ${frame}`}
      style={{ width, height }}
    />
  );
}
