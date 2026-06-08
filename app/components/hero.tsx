import { profile } from "../data/profile";

export default function Hero() {
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  return (
    <section className="pt-24 pb-16 md:pt-36 md:pb-24 flex flex-col md:flex-row md:items-center gap-10 md:gap-16">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-fg flex items-center justify-center select-none">
          <span className="text-2xl md:text-3xl font-bold tracking-tight">
            {initials}
          </span>
        </div>
      </div>

      {/* Text */}
      <div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          {profile.name}
          <span className="block text-muted text-2xl md:text-3xl lg:text-4xl font-normal mt-3">
            {profile.title}
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted leading-relaxed">
          {profile.bio}
        </p>
      </div>
    </section>
  );
}
