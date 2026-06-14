import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  alt: string;
  href?: string;
  className?: string;
  size?: "sm" | "md";
};

export function BrandLogo({ alt, href, className, size = "md" }: BrandLogoProps) {
  const height = size === "sm" ? 32 : 40;

  const img = (
    <Image
      src="/logo-kod-digor.png"
      alt={alt}
      width={1024}
      height={241}
      style={{ height, width: "auto", maxWidth: "100%" }}
      className="object-contain object-left"
      priority
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2",
          className
        )}
      >
        {img}
      </Link>
    );
  }

  return <div className={cn("inline-block", className)}>{img}</div>;
}
