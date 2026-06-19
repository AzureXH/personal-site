import Link from "next/link";
import { projects } from "../data/projects";

export default function Projects() {
  return (
    <section className="py-16 md:py-24 border-t border-border">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
        小玩具
      </h2>

      <div className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => (
          <div
            key={project.name}
            className="group bg-card p-6 sm:p-8 flex flex-col"
          >
            {/* Top rule */}
            <div className="w-8 h-px bg-fg mb-6" />

            <h3 className="text-lg font-semibold leading-snug">
              {project.name}
            </h3>
            <p className="mt-3 text-sm text-muted leading-relaxed flex-1">
              {project.description}
            </p>

            {/* Tags */}
            <div className="mt-5 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-mono text-muted/70"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Links */}
            <div className="mt-5 flex gap-6 text-sm font-medium">
              {project.url && project.internal ? (
                <Link
                  href={project.url}
                  className="text-fg hover:text-muted transition-colors"
                >
                  Visit →
                </Link>
              ) : project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg hover:text-muted transition-colors"
                >
                  Visit →
                </a>
              ) : null}
              {project.repo && (
                <a
                  href={project.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg hover:text-muted transition-colors"
                >
                  Source ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
