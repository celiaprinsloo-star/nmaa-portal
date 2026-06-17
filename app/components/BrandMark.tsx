import Image from "next/image";

type BrandMarkProps = {
  compact?: boolean;
};

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={compact ? "brand-mark compact-brand" : "brand-mark"}>
      <Image
        src="/nmaa-logo.png"
        alt="NMAA logo"
        width={compact ? 48 : 86}
        height={compact ? 62 : 110}
        priority={!compact}
      />
      <div>
        <p className="brand-title">NMAA SA</p>
        <p className="brand-subtitle">National Portal</p>
      </div>
    </div>
  );
}
