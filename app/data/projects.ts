import type { Project } from "./types";

export const projects: Project[] = [
  {
    name: "个人主页",
    description:
      "就是你正在看的这个。Next.js + Tailwind，Docker 部署，AI 帮我写了八成代码。",
    tags: ["Next.js", "TypeScript", "Tailwind CSS", "Docker"],
    url: "https://mkt77.site",
    repo: "https://github.com/AzureXH/personal-site",
  },
  {
    name: "大文件上传",
    description:
      "切片上传 + SHA-256 校验 + Web Worker 哈希。拖拽文件即可上传，支持并发分片、断点重试。面试向——Worker 线程、并发控制、流式上传一应俱全。",
    tags: ["Next.js", "Web Worker", "SHA-256", "Streaming"],
    url: "/tools/file-upload",
    internal: true,
  },
];
