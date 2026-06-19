export interface SocialLink {
  label: string;
  url: string;
}

export interface Profile {
  name: string;
  title: string;
  bio: string;
  avatar?: string;
  links: SocialLink[];
}

export interface Project {
  name: string;
  description: string;
  tags: string[];
  url?: string;
  repo?: string;
  /**
   * When true, `url` is treated as an app-relative path — use Next.js <Link>
   * for client-side navigation instead of an external <a>.
   */
  internal?: boolean;
}
