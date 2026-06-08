import { profile } from "../data/profile";

export default function Footer() {
  return (
    <footer className="mt-auto bg-footer-bg text-footer-fg">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {/* Dot grid decorative */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-footer-muted" />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          {profile.links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-footer-muted hover:text-footer-fg transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <p className="mt-6 text-xs text-footer-muted/60">
          © {new Date().getFullYear()} {profile.name}
        </p>
      </div>
    </footer>
  );
}
