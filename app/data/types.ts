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
}
