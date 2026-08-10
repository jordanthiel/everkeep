/** Full-bleed atmospheric scene: organized papers on a quiet desk. */
export function HeroScene() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,#5C6B4A_0%,transparent_45%),radial-gradient(ellipse_at_90%_80%,#C4A574_0%,transparent_40%),linear-gradient(160deg,#2C3427_0%,#3A4533_38%,#4A5740_72%,#3D3A36_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.55\'/%3E%3C/svg%3E")'
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full animate-drift"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g opacity="0.92">
          <rect x="720" y="180" width="520" height="640" rx="8" fill="#F8F5F0" transform="rotate(6 980 500)" />
          <rect x="700" y="210" width="480" height="40" rx="4" fill="#E5DDD2" transform="rotate(6 940 230)" />
          <rect x="710" y="280" width="360" height="14" rx="3" fill="#D4CCC0" transform="rotate(6 890 287)" />
          <rect x="715" y="320" width="300" height="14" rx="3" fill="#D4CCC0" transform="rotate(6 865 327)" />
          <rect x="720" y="360" width="340" height="14" rx="3" fill="#D4CCC0" transform="rotate(6 890 367)" />
        </g>
        <g opacity="0.96">
          <rect x="420" y="220" width="500" height="620" rx="8" fill="#FDFCFA" transform="rotate(-4 670 530)" />
          <path
            d="M480 300 H820 M480 350 H760 M480 400 H800 M480 450 H700"
            stroke="#A89F91"
            strokeWidth="10"
            strokeLinecap="round"
            transform="rotate(-4 670 380)"
          />
          <path
            d="M670 720 V640"
            stroke="#C4A574"
            strokeWidth="12"
            strokeLinecap="round"
            transform="rotate(-4 670 680)"
          />
        </g>
        <g opacity="0.88">
          <rect x="180" y="300" width="420" height="520" rx="8" fill="#F0EBE3" transform="rotate(-10 390 560)" />
          <rect x="220" y="360" width="280" height="12" rx="3" fill="#A89F91" transform="rotate(-10 360 366)" />
          <rect x="230" y="400" width="220" height="12" rx="3" fill="#A89F91" transform="rotate(-10 340 406)" />
        </g>
        <circle cx="1180" cy="160" r="90" fill="#C4A574" opacity="0.18" />
        <circle cx="220" cy="720" r="140" fill="#1F261C" opacity="0.25" />
      </svg>

      <div className="absolute inset-0 bg-gradient-to-r from-ivory-100 via-ivory-100/92 to-ivory-100/35 md:via-ivory-100/80 md:to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ivory-100 to-transparent" />
    </div>
  )
}
