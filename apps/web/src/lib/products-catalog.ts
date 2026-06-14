import {
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  Camera,
  Contact,
  FileText,
  FolderOpen,
  Globe,
  Globe2,
  HardDrive,
  KeyRound,
  Layout,
  Mail,
  Map,
  MessageSquare,
  Monitor,
  Network,
  Newspaper,
  Palette,
  Shield,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export type ProductKey =
  | "mail"
  | "contacts"
  | "chat"
  | "newsletter"
  | "drive"
  | "photos"
  | "office"
  | "notes"
  | "forms"
  | "website"
  | "calendar"
  | "conference"
  | "collab-tools"
  | "passwords"
  | "backups"
  | "ai"
  | "dns"
  | "vpn"
  | "proxy"
  | "browser"
  | "accounting"
  | "members"
  | "maps"
  | "video"
  | "opensource-support";

export type ProductStatus = "live" | "beta" | "in_progress" | "planned" | "research";
export type TaskStatus = "done" | "in_progress" | "planned" | "blocked";
export type ProductCategory =
  | "communication"
  | "productivity"
  | "security"
  | "infrastructure"
  | "collaboration"
  | "association"
  | "media"
  | "opensource";

export type RoadmapTask = {
  id: string;
  startMonth: string;
  endMonth: string;
  status: TaskStatus;
  dependsOn?: string[];
};

export type RoadmapPhase = {
  id: string;
  order: number;
  tasks: RoadmapTask[];
};

export type ProductDefinition = {
  key: ProductKey;
  slug: string;
  icon: LucideIcon;
  category: ProductCategory;
  status: ProductStatus;
  replaces: string[];
  relatedSlugs?: ProductKey[];
  phases: RoadmapPhase[];
  dashboardHref?: string;
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "communication",
  "productivity",
  "collaboration",
  "security",
  "infrastructure",
  "association",
  "media",
  "opensource",
];

export const PRODUCT_STATUSES: ProductStatus[] = [
  "live",
  "beta",
  "in_progress",
  "planned",
  "research",
];

function phase(id: string, order: number, tasks: RoadmapTask[]): RoadmapPhase {
  return { id, order, tasks };
}

function task(
  id: string,
  startMonth: string,
  endMonth: string,
  status: TaskStatus = "planned",
  dependsOn?: string[]
): RoadmapTask {
  return { id, startMonth, endMonth, status, dependsOn };
}

export const PRODUCT_DEFINITIONS: ProductDefinition[] = [
  {
    key: "mail",
    slug: "mail",
    icon: Mail,
    category: "communication",
    status: "live",
    replaces: ["Microsoft Outlook", "Gmail", "Proton Mail"],
    relatedSlugs: ["contacts", "calendar", "drive"],
    dashboardHref: "/signup",
    phases: [
      phase("foundations", 1, [
        task("domains", "2026-01", "2026-03", "done"),
        task("mailboxes", "2026-02", "2026-04", "done", ["domains"]),
        task("aliases", "2026-03", "2026-05", "done", ["mailboxes"]),
        task("webmail-jmap", "2026-04", "2026-06", "done", ["mailboxes"]),
        task("shared-mailboxes", "2026-05", "2026-07", "in_progress", ["mailboxes"]),
      ]),
      phase("security", 2, [
        task("tls-enforce", "2026-06", "2026-08", "in_progress", ["webmail-jmap"]),
        task("encryption-at-rest", "2026-07", "2026-10", "planned", ["tls-enforce"]),
        task("audit-logs", "2026-08", "2026-11", "planned", ["tls-enforce"]),
        task("dlp-basic", "2026-10", "2027-01", "planned", ["audit-logs"]),
        task("smime", "2027-01", "2027-04", "planned", ["encryption-at-rest"]),
      ]),
      phase("collaboration", 3, [
        task("delegation", "2027-02", "2027-05", "planned", ["shared-mailboxes"]),
        task("calendar-integration", "2027-04", "2027-07", "planned", ["delegation"]),
        task("contacts-sync", "2027-05", "2027-08", "planned", ["delegation"]),
        task("rules-filters", "2027-06", "2027-09", "planned", ["webmail-jmap"]),
      ]),
      phase("ecosystem", 4, [
        task("drive-attachments", "2027-08", "2027-11", "planned", ["contacts-sync"]),
        task("ai-triage", "2027-10", "2028-01", "planned", ["rules-filters"]),
        task("newsletter-bridge", "2028-01", "2028-04", "planned", ["ai-triage"]),
      ]),
      phase("sovereignty", 5, [
        task("multi-region", "2028-03", "2028-08", "planned", ["encryption-at-rest"]),
        task("federation", "2028-06", "2028-12", "planned", ["multi-region"]),
        task("cross-site-backup", "2028-09", "2029-03", "planned", ["federation"]),
      ]),
    ],
  },
  {
    key: "contacts",
    slug: "contacts",
    icon: Contact,
    category: "communication",
    status: "planned",
    replaces: ["Google Contacts", "Outlook Contacts", "Apple Contacts"],
    relatedSlugs: ["mail", "calendar", "chat"],
    phases: [
      phase("foundations", 1, [
        task("carddav-server", "2026-09", "2027-01", "planned"),
        task("vcard-import", "2026-11", "2027-02", "planned", ["carddav-server"]),
        task("groups-tags", "2027-01", "2027-04", "planned", ["vcard-import"]),
        task("search-filter", "2027-03", "2027-05", "planned", ["groups-tags"]),
      ]),
      phase("sync", 2, [
        task("mail-sync", "2027-04", "2027-07", "planned", ["search-filter"]),
        task("mobile-sync", "2027-06", "2027-09", "planned", ["carddav-server"]),
        task("deduplication", "2027-08", "2027-11", "planned", ["mail-sync"]),
      ]),
      phase("privacy", 3, [
        task("encryption-contacts", "2027-10", "2028-02", "planned", ["deduplication"]),
        task("sharing-permissions", "2028-01", "2028-04", "planned", ["encryption-contacts"]),
        task("gdpr-export", "2028-03", "2028-05", "planned", ["sharing-permissions"]),
      ]),
      phase("ecosystem", 4, [
        task("calendar-link", "2028-04", "2028-07", "planned", ["gdpr-export"]),
        task("chat-presence", "2028-06", "2028-09", "planned", ["calendar-link"]),
        task("association-directory", "2028-08", "2028-12", "planned", ["chat-presence"]),
      ]),
    ],
  },
  {
    key: "chat",
    slug: "chat",
    icon: MessageSquare,
    category: "communication",
    status: "planned",
    replaces: ["Microsoft Teams Chat", "Slack", "Google Chat"],
    relatedSlugs: ["conference", "collab-tools", "contacts"],
    phases: [
      phase("foundations", 1, [
        task("matrix-server", "2027-01", "2027-05", "planned"),
        task("rooms-channels", "2027-03", "2027-06", "planned", ["matrix-server"]),
        task("direct-messages", "2027-05", "2027-08", "planned", ["rooms-channels"]),
        task("file-sharing", "2027-07", "2027-10", "planned", ["direct-messages"]),
      ]),
      phase("security", 2, [
        task("e2ee-rooms", "2027-09", "2028-01", "planned", ["file-sharing"]),
        task("sso-integration", "2027-11", "2028-02", "planned", ["matrix-server"]),
        task("retention-policies", "2028-01", "2028-04", "planned", ["e2ee-rooms"]),
      ]),
      phase("collaboration", 3, [
        task("threads-reactions", "2028-03", "2028-06", "planned", ["retention-policies"]),
        task("bots-webhooks", "2028-05", "2028-08", "planned", ["threads-reactions"]),
        task("bridge-mail", "2028-07", "2028-10", "planned", ["bots-webhooks"]),
      ]),
      phase("ecosystem", 4, [
        task("conference-bridge", "2028-09", "2029-01", "planned", ["bridge-mail"]),
        task("office-embed", "2028-11", "2029-03", "planned", ["conference-bridge"]),
        task("federation-external", "2029-01", "2029-06", "planned", ["office-embed"]),
      ]),
    ],
  },
  {
    key: "newsletter",
    slug: "newsletter",
    icon: Newspaper,
    category: "communication",
    status: "planned",
    replaces: ["Mailchimp", "Brevo", "Substack"],
    relatedSlugs: ["mail", "forms", "website"],
    phases: [
      phase("foundations", 1, [
        task("list-management", "2027-06", "2027-09", "planned"),
        task("template-editor", "2027-08", "2027-11", "planned", ["list-management"]),
        task("smtp-sending", "2027-10", "2028-01", "planned", ["template-editor"]),
        task("unsubscribe-rgpd", "2027-12", "2028-03", "planned", ["smtp-sending"]),
      ]),
      phase("analytics", 2, [
        task("open-tracking", "2028-02", "2028-05", "planned", ["unsubscribe-rgpd"]),
        task("click-tracking", "2028-04", "2028-07", "planned", ["open-tracking"]),
        task("privacy-analytics", "2028-06", "2028-09", "planned", ["click-tracking"]),
      ]),
      phase("automation", 3, [
        task("drip-campaigns", "2028-08", "2028-12", "planned", ["privacy-analytics"]),
        task("segmentation", "2028-10", "2029-02", "planned", ["drip-campaigns"]),
        task("forms-integration", "2029-01", "2029-04", "planned", ["segmentation"]),
      ]),
    ],
  },
  {
    key: "drive",
    slug: "drive",
    icon: FolderOpen,
    category: "productivity",
    status: "planned",
    replaces: ["Google Drive", "OneDrive", "Nextcloud"],
    relatedSlugs: ["photos", "office", "backups"],
    phases: [
      phase("foundations", 1, [
        task("s3-storage", "2026-10", "2027-02", "planned"),
        task("file-browser", "2026-12", "2027-04", "planned", ["s3-storage"]),
        task("folders-sharing", "2027-02", "2027-05", "planned", ["file-browser"]),
        task("versioning", "2027-04", "2027-07", "planned", ["folders-sharing"]),
      ]),
      phase("sync", 2, [
        task("webdav", "2027-06", "2027-09", "planned", ["versioning"]),
        task("desktop-sync", "2027-08", "2027-12", "planned", ["webdav"]),
        task("mobile-app", "2027-10", "2028-02", "planned", ["desktop-sync"]),
      ]),
      phase("security", 3, [
        task("client-encryption", "2028-01", "2028-05", "planned", ["mobile-app"]),
        task("access-control", "2028-03", "2028-06", "planned", ["client-encryption"]),
        task("audit-trail", "2028-05", "2028-08", "planned", ["access-control"]),
      ]),
      phase("ecosystem", 4, [
        task("office-integration", "2028-07", "2028-11", "planned", ["audit-trail"]),
        task("mail-attachments", "2028-09", "2029-01", "planned", ["office-integration"]),
        task("ai-indexing", "2028-11", "2029-04", "planned", ["mail-attachments"]),
      ]),
    ],
  },
  {
    key: "photos",
    slug: "photos",
    icon: Camera,
    category: "media",
    status: "planned",
    replaces: ["Google Photos", "iCloud Photos", "Amazon Photos"],
    relatedSlugs: ["drive", "video"],
    phases: [
      phase("foundations", 1, [
        task("photo-library", "2027-03", "2027-07", "planned"),
        task("albums", "2027-05", "2027-08", "planned", ["photo-library"]),
        task("upload-mobile", "2027-07", "2027-10", "planned", ["albums"]),
        task("thumbnails", "2027-09", "2027-12", "planned", ["upload-mobile"]),
      ]),
      phase("privacy", 2, [
        task("e2ee-albums", "2027-11", "2028-03", "planned", ["thumbnails"]),
        task("face-detection-local", "2028-01", "2028-05", "planned", ["e2ee-albums"]),
        task("sharing-links", "2028-03", "2028-06", "planned", ["face-detection-local"]),
      ]),
      phase("features", 3, [
        task("search-tags", "2028-05", "2028-08", "planned", ["sharing-links"]),
        task("slideshow-export", "2028-07", "2028-10", "planned", ["search-tags"]),
        task("drive-bridge", "2028-09", "2029-01", "planned", ["slideshow-export"]),
      ]),
    ],
  },
  {
    key: "office",
    slug: "office",
    icon: FileText,
    category: "productivity",
    status: "planned",
    replaces: ["Microsoft Office", "Google Docs", "Notion"],
    relatedSlugs: ["drive", "collab-tools", "notes"],
    phases: [
      phase("foundations", 1, [
        task("document-editor", "2027-06", "2027-10", "planned"),
        task("spreadsheet-editor", "2027-08", "2027-12", "planned", ["document-editor"]),
        task("presentation-editor", "2027-10", "2028-02", "planned", ["spreadsheet-editor"]),
        task("odf-support", "2027-12", "2028-04", "planned", ["presentation-editor"]),
      ]),
      phase("collaboration", 2, [
        task("realtime-editing", "2028-02", "2028-06", "planned", ["odf-support"]),
        task("comments-mentions", "2028-04", "2028-07", "planned", ["realtime-editing"]),
        task("version-history", "2028-06", "2028-09", "planned", ["comments-mentions"]),
      ]),
      phase("ecosystem", 3, [
        task("drive-storage", "2028-08", "2028-11", "planned", ["version-history"]),
        task("templates", "2028-10", "2029-01", "planned", ["drive-storage"]),
        task("notion-blocks", "2028-12", "2029-05", "planned", ["templates"]),
        task("ai-assistant", "2029-02", "2029-06", "planned", ["notion-blocks"]),
      ]),
    ],
  },
  {
    key: "notes",
    slug: "notes",
    icon: BookOpen,
    category: "productivity",
    status: "planned",
    replaces: ["Notion", "Apple Notes", "Google Keep"],
    relatedSlugs: ["office", "collab-tools"],
    phases: [
      phase("foundations", 1, [
        task("note-editor", "2027-04", "2027-08", "planned"),
        task("notebooks", "2027-06", "2027-09", "planned", ["note-editor"]),
        task("markdown-support", "2027-08", "2027-11", "planned", ["notebooks"]),
        task("search", "2027-10", "2028-01", "planned", ["markdown-support"]),
      ]),
      phase("collaboration", 2, [
        task("shared-notes", "2028-01", "2028-04", "planned", ["search"]),
        task("realtime-sync", "2028-03", "2028-06", "planned", ["shared-notes"]),
        task("attachments", "2028-05", "2028-08", "planned", ["realtime-sync"]),
      ]),
      phase("ecosystem", 3, [
        task("office-bridge", "2028-07", "2028-10", "planned", ["attachments"]),
        task("ai-summarize", "2028-09", "2029-01", "planned", ["office-bridge"]),
        task("offline-mode", "2028-11", "2029-03", "planned", ["ai-summarize"]),
      ]),
    ],
  },
  {
    key: "forms",
    slug: "forms",
    icon: Layout,
    category: "productivity",
    status: "planned",
    replaces: ["Google Forms", "Microsoft Forms", "Typeform"],
    relatedSlugs: ["newsletter", "website", "members"],
    phases: [
      phase("foundations", 1, [
        task("form-builder", "2027-05", "2027-09", "planned"),
        task("field-types", "2027-07", "2027-10", "planned", ["form-builder"]),
        task("response-collection", "2027-09", "2027-12", "planned", ["field-types"]),
        task("export-csv", "2027-11", "2028-02", "planned", ["response-collection"]),
      ]),
      phase("privacy", 2, [
        task("anonymous-mode", "2028-01", "2028-04", "planned", ["export-csv"]),
        task("consent-checkboxes", "2028-03", "2028-05", "planned", ["anonymous-mode"]),
        task("data-retention", "2028-04", "2028-07", "planned", ["consent-checkboxes"]),
      ]),
      phase("automation", 3, [
        task("webhooks", "2028-06", "2028-09", "planned", ["data-retention"]),
        task("newsletter-signup", "2028-08", "2028-11", "planned", ["webhooks"]),
        task("members-registration", "2028-10", "2029-02", "planned", ["newsletter-signup"]),
      ]),
    ],
  },
  {
    key: "website",
    slug: "website",
    icon: Globe,
    category: "productivity",
    status: "planned",
    replaces: ["WordPress.com", "Wix", "Google Sites"],
    relatedSlugs: ["forms", "newsletter", "dns"],
    phases: [
      phase("foundations", 1, [
        task("site-builder", "2027-07", "2027-11", "planned"),
        task("templates", "2027-09", "2028-01", "planned", ["site-builder"]),
        task("custom-domain", "2027-11", "2028-03", "planned", ["templates"]),
        task("ssl-auto", "2028-01", "2028-04", "planned", ["custom-domain"]),
      ]),
      phase("content", 2, [
        task("blog-module", "2028-03", "2028-06", "planned", ["ssl-auto"]),
        task("media-gallery", "2028-05", "2028-08", "planned", ["blog-module"]),
        task("seo-tools", "2028-07", "2028-10", "planned", ["media-gallery"]),
      ]),
      phase("ecosystem", 3, [
        task("forms-embed", "2028-09", "2028-12", "planned", ["seo-tools"]),
        task("newsletter-widget", "2028-11", "2029-02", "planned", ["forms-embed"]),
        task("analytics-privacy", "2029-01", "2029-04", "planned", ["newsletter-widget"]),
      ]),
    ],
  },
  {
    key: "calendar",
    slug: "calendar",
    icon: Calendar,
    category: "collaboration",
    status: "in_progress",
    replaces: ["Google Calendar", "Outlook Calendar", "Apple Calendar"],
    relatedSlugs: ["mail", "conference", "contacts"],
    phases: [
      phase("foundations", 1, [
        task("caldav-server", "2026-08", "2026-12", "in_progress"),
        task("event-crud", "2026-10", "2027-02", "planned", ["caldav-server"]),
        task("recurrence", "2027-01", "2027-04", "planned", ["event-crud"]),
        task("reminders", "2027-03", "2027-06", "planned", ["recurrence"]),
      ]),
      phase("sharing", 2, [
        task("shared-calendars", "2027-05", "2027-08", "planned", ["reminders"]),
        task("invitations", "2027-07", "2027-10", "planned", ["shared-calendars"]),
        task("free-busy", "2027-09", "2027-12", "planned", ["invitations"]),
      ]),
      phase("ecosystem", 3, [
        task("mail-integration", "2027-11", "2028-02", "planned", ["free-busy"]),
        task("conference-links", "2028-01", "2028-04", "planned", ["mail-integration"]),
        task("contacts-attendees", "2028-03", "2028-06", "planned", ["conference-links"]),
      ]),
      phase("advanced", 4, [
        task("resource-booking", "2028-05", "2028-09", "planned", ["contacts-attendees"]),
        task("association-events", "2028-07", "2028-12", "planned", ["resource-booking"]),
      ]),
    ],
  },
  {
    key: "conference",
    slug: "conference",
    icon: Video,
    category: "collaboration",
    status: "planned",
    replaces: ["Zoom", "Google Meet", "Microsoft Teams"],
    relatedSlugs: ["chat", "calendar", "video"],
    phases: [
      phase("foundations", 1, [
        task("webrtc-core", "2027-08", "2027-12", "planned"),
        task("turn-stun", "2027-10", "2028-02", "planned", ["webrtc-core"]),
        task("room-management", "2027-12", "2028-04", "planned", ["turn-stun"]),
        task("screen-sharing", "2028-02", "2028-05", "planned", ["room-management"]),
      ]),
      phase("features", 2, [
        task("recording", "2028-04", "2028-08", "planned", ["screen-sharing"]),
        task("waiting-room", "2028-06", "2028-09", "planned", ["recording"]),
        task("breakout-rooms", "2028-08", "2028-11", "planned", ["waiting-room"]),
      ]),
      phase("ecosystem", 3, [
        task("calendar-scheduling", "2028-10", "2029-01", "planned", ["breakout-rooms"]),
        task("chat-integration", "2028-12", "2029-03", "planned", ["calendar-scheduling"]),
        task("ai-transcription", "2029-02", "2029-06", "planned", ["chat-integration"]),
      ]),
    ],
  },
  {
    key: "collab-tools",
    slug: "collab-tools",
    icon: Users,
    category: "collaboration",
    status: "planned",
    replaces: ["Microsoft 365 Teams", "Google Workspace", "Notion Teams"],
    relatedSlugs: ["chat", "office", "drive"],
    phases: [
      phase("foundations", 1, [
        task("workspace-rooms", "2028-01", "2028-05", "planned"),
        task("shared-docs", "2028-03", "2028-07", "planned", ["workspace-rooms"]),
        task("task-boards", "2028-05", "2028-09", "planned", ["shared-docs"]),
        task("activity-feed", "2028-07", "2028-11", "planned", ["task-boards"]),
      ]),
      phase("integration", 2, [
        task("chat-bridge", "2028-09", "2029-01", "planned", ["activity-feed"]),
        task("calendar-bridge", "2028-11", "2029-03", "planned", ["chat-bridge"]),
        task("drive-bridge", "2029-01", "2029-05", "planned", ["calendar-bridge"]),
      ]),
    ],
  },
  {
    key: "passwords",
    slug: "passwords",
    icon: KeyRound,
    category: "security",
    status: "planned",
    replaces: ["1Password", "Bitwarden Cloud", "LastPass"],
    relatedSlugs: ["backups", "browser"],
    phases: [
      phase("foundations", 1, [
        task("vault-core", "2027-02", "2027-06", "planned"),
        task("zero-knowledge", "2027-04", "2027-08", "planned", ["vault-core"]),
        task("browser-extension", "2027-06", "2027-10", "planned", ["zero-knowledge"]),
        task("totp-2fa", "2027-08", "2027-12", "planned", ["browser-extension"]),
      ]),
      phase("sharing", 2, [
        task("family-vault", "2027-11", "2028-03", "planned", ["totp-2fa"]),
        task("org-vault", "2028-01", "2028-05", "planned", ["family-vault"]),
        task("emergency-access", "2028-03", "2028-07", "planned", ["org-vault"]),
      ]),
      phase("ecosystem", 3, [
        task("sso-bridge", "2028-05", "2028-09", "planned", ["emergency-access"]),
        task("passkeys", "2028-07", "2028-12", "planned", ["sso-bridge"]),
        task("audit-security", "2028-10", "2029-02", "planned", ["passkeys"]),
      ]),
    ],
  },
  {
    key: "backups",
    slug: "backups",
    icon: HardDrive,
    category: "security",
    status: "planned",
    replaces: ["Backblaze", "iCloud Backup", "Veeam Cloud"],
    relatedSlugs: ["drive", "mail", "photos"],
    phases: [
      phase("foundations", 1, [
        task("backup-engine", "2027-01", "2027-05", "planned"),
        task("scheduled-jobs", "2027-03", "2027-07", "planned", ["backup-engine"]),
        task("incremental-backup", "2027-05", "2027-09", "planned", ["scheduled-jobs"]),
        task("restore-ui", "2027-07", "2027-11", "planned", ["incremental-backup"]),
      ]),
      phase("coverage", 2, [
        task("mail-backup", "2027-10", "2028-02", "planned", ["restore-ui"]),
        task("drive-backup", "2027-12", "2028-04", "planned", ["mail-backup"]),
        task("db-backup", "2028-02", "2028-06", "planned", ["drive-backup"]),
      ]),
      phase("sovereignty", 3, [
        task("offsite-replication", "2028-04", "2028-08", "planned", ["db-backup"]),
        task("client-encrypted", "2028-06", "2028-10", "planned", ["offsite-replication"]),
        task("disaster-recovery", "2028-08", "2029-02", "planned", ["client-encrypted"]),
      ]),
    ],
  },
  {
    key: "ai",
    slug: "ai",
    icon: Bot,
    category: "security",
    status: "research",
    replaces: ["ChatGPT", "Copilot", "Gemini"],
    relatedSlugs: ["office", "mail", "notes"],
    phases: [
      phase("foundations", 1, [
        task("local-llm", "2028-03", "2028-08", "planned"),
        task("privacy-gateway", "2028-05", "2028-09", "planned", ["local-llm"]),
        task("prompt-library", "2028-07", "2028-11", "planned", ["privacy-gateway"]),
        task("usage-quotas", "2028-09", "2029-01", "planned", ["prompt-library"]),
      ]),
      phase("integration", 2, [
        task("mail-assistant", "2028-11", "2029-03", "planned", ["usage-quotas"]),
        task("office-assistant", "2029-01", "2029-05", "planned", ["mail-assistant"]),
        task("search-assistant", "2029-03", "2029-07", "planned", ["office-assistant"]),
      ]),
      phase("sovereignty", 3, [
        task("self-hosted-models", "2029-05", "2029-10", "planned", ["search-assistant"]),
        task("federated-learning", "2029-08", "2030-02", "planned", ["self-hosted-models"]),
      ]),
    ],
  },
  {
    key: "dns",
    slug: "dns",
    icon: Globe2,
    category: "infrastructure",
    status: "in_progress",
    replaces: ["Cloudflare DNS", "Google Domains", "OVH DNS"],
    relatedSlugs: ["website", "mail", "vpn"],
    phases: [
      phase("foundations", 1, [
        task("dns-hosting", "2026-04", "2026-07", "done"),
        task("domain-registration", "2026-06", "2026-09", "in_progress", ["dns-hosting"]),
        task("dnssec", "2026-08", "2026-11", "planned", ["domain-registration"]),
        task("auto-records", "2026-10", "2027-01", "planned", ["dnssec"]),
      ]),
      phase("advanced", 2, [
        task("split-horizon", "2027-01", "2027-04", "planned", ["auto-records"]),
        task("api-management", "2027-03", "2027-06", "planned", ["split-horizon"]),
        task("health-checks", "2027-05", "2027-08", "planned", ["api-management"]),
      ]),
      phase("ecosystem", 3, [
        task("mail-autoconfig", "2027-07", "2027-10", "planned", ["health-checks"]),
        task("website-integration", "2027-09", "2027-12", "planned", ["mail-autoconfig"]),
        task("vpn-records", "2027-11", "2028-02", "planned", ["website-integration"]),
      ]),
    ],
  },
  {
    key: "vpn",
    slug: "vpn",
    icon: Shield,
    category: "infrastructure",
    status: "planned",
    replaces: ["NordVPN", "Proton VPN", "Tailscale"],
    relatedSlugs: ["dns", "proxy", "browser"],
    phases: [
      phase("foundations", 1, [
        task("wireguard-core", "2027-10", "2028-02", "planned"),
        task("user-provisioning", "2027-12", "2028-04", "planned", ["wireguard-core"]),
        task("split-tunneling", "2028-02", "2028-06", "planned", ["user-provisioning"]),
        task("kill-switch", "2028-04", "2028-07", "planned", ["split-tunneling"]),
      ]),
      phase("org", 2, [
        task("site-to-site", "2028-06", "2028-10", "planned", ["kill-switch"]),
        task("access-control", "2028-08", "2028-12", "planned", ["site-to-site"]),
        task("audit-logs", "2028-10", "2029-02", "planned", ["access-control"]),
      ]),
    ],
  },
  {
    key: "proxy",
    slug: "proxy",
    icon: Network,
    category: "infrastructure",
    status: "planned",
    replaces: ["Cloudflare Proxy", "Squid Enterprise"],
    relatedSlugs: ["vpn", "dns", "browser"],
    phases: [
      phase("foundations", 1, [
        task("reverse-proxy", "2028-01", "2028-05", "planned"),
        task("ssl-termination", "2028-03", "2028-06", "planned", ["reverse-proxy"]),
        task("load-balancing", "2028-05", "2028-08", "planned", ["ssl-termination"]),
        task("rate-limiting", "2028-07", "2028-10", "planned", ["load-balancing"]),
      ]),
      phase("privacy", 2, [
        task("forward-proxy", "2028-09", "2029-01", "planned", ["rate-limiting"]),
        task("content-filtering", "2028-11", "2029-03", "planned", ["forward-proxy"]),
        task("logging-privacy", "2029-01", "2029-05", "planned", ["content-filtering"]),
      ]),
    ],
  },
  {
    key: "browser",
    slug: "browser",
    icon: Monitor,
    category: "infrastructure",
    status: "research",
    replaces: ["Google Chrome", "Safari", "Microsoft Edge"],
    relatedSlugs: ["vpn", "passwords", "proxy"],
    phases: [
      phase("foundations", 1, [
        task("chromium-fork", "2029-01", "2029-08", "planned"),
        task("tracker-blocking", "2029-04", "2029-10", "planned", ["chromium-fork"]),
        task("kod-digor-sync", "2029-07", "2030-01", "planned", ["tracker-blocking"]),
      ]),
      phase("integration", 2, [
        task("password-autofill", "2029-10", "2030-04", "planned", ["kod-digor-sync"]),
        task("vpn-toggle", "2030-01", "2030-06", "planned", ["password-autofill"]),
        task("suite-shortcuts", "2030-03", "2030-08", "planned", ["vpn-toggle"]),
      ]),
    ],
  },
  {
    key: "accounting",
    slug: "accounting",
    icon: BarChart3,
    category: "association",
    status: "planned",
    replaces: ["QuickBooks", "Sage", "Odoo Comptabilité"],
    relatedSlugs: ["members", "forms"],
    phases: [
      phase("foundations", 1, [
        task("chart-accounts", "2027-04", "2027-08", "planned"),
        task("journal-entries", "2027-06", "2027-10", "planned", ["chart-accounts"]),
        task("invoices", "2027-08", "2027-12", "planned", ["journal-entries"]),
        task("bank-reconciliation", "2027-10", "2028-02", "planned", ["invoices"]),
      ]),
      phase("association", 2, [
        task("membership-fees", "2028-01", "2028-05", "planned", ["bank-reconciliation"]),
        task("donation-tracking", "2028-03", "2028-07", "planned", ["membership-fees"]),
        task("annual-reports", "2028-05", "2028-09", "planned", ["donation-tracking"]),
      ]),
      phase("compliance", 3, [
        task("fec-export", "2028-07", "2028-11", "planned", ["annual-reports"]),
        task("rgpd-accounting", "2028-09", "2029-01", "planned", ["fec-export"]),
        task("multi-org", "2028-11", "2029-04", "planned", ["rgpd-accounting"]),
      ]),
    ],
  },
  {
    key: "members",
    slug: "members",
    icon: Users,
    category: "association",
    status: "in_progress",
    replaces: ["HelloAsso", "AssoConnect", "Odoo Association"],
    relatedSlugs: ["accounting", "forms", "newsletter"],
    phases: [
      phase("foundations", 1, [
        task("member-registry", "2026-09", "2027-01", "in_progress"),
        task("roles-permissions", "2026-11", "2027-03", "planned", ["member-registry"]),
        task("membership-cards", "2027-01", "2027-05", "planned", ["roles-permissions"]),
        task("dues-tracking", "2027-03", "2027-07", "planned", ["membership-cards"]),
      ]),
      phase("engagement", 2, [
        task("event-registration", "2027-06", "2027-10", "planned", ["dues-tracking"]),
        task("volunteer-management", "2027-08", "2027-12", "planned", ["event-registration"]),
        task("communication-hub", "2027-10", "2028-02", "planned", ["volunteer-management"]),
      ]),
      phase("ecosystem", 3, [
        task("accounting-bridge", "2028-01", "2028-05", "planned", ["communication-hub"]),
        task("forms-onboarding", "2028-03", "2028-07", "planned", ["accounting-bridge"]),
        task("newsletter-segments", "2028-05", "2028-09", "planned", ["forms-onboarding"]),
      ]),
    ],
  },
  {
    key: "maps",
    slug: "maps",
    icon: Map,
    category: "association",
    status: "planned",
    replaces: ["Google Maps", "OpenStreetMap embed", "Mapbox"],
    relatedSlugs: ["website", "members"],
    phases: [
      phase("foundations", 1, [
        task("osm-tiles", "2028-02", "2028-06", "planned"),
        task("marker-management", "2028-04", "2028-08", "planned", ["osm-tiles"]),
        task("route-display", "2028-06", "2028-10", "planned", ["marker-management"]),
        task("geocoding", "2028-08", "2028-12", "planned", ["route-display"]),
      ]),
      phase("association", 2, [
        task("event-maps", "2028-10", "2029-02", "planned", ["geocoding"]),
        task("member-locator", "2028-12", "2029-04", "planned", ["event-maps"]),
        task("privacy-zones", "2029-02", "2029-06", "planned", ["member-locator"]),
      ]),
    ],
  },
  {
    key: "video",
    slug: "video",
    icon: Video,
    category: "media",
    status: "planned",
    replaces: ["YouTube", "Vimeo", "PeerTube"],
    relatedSlugs: ["photos", "conference", "website"],
    phases: [
      phase("foundations", 1, [
        task("upload-pipeline", "2028-04", "2028-08", "planned"),
        task("transcoding", "2028-06", "2028-10", "planned", ["upload-pipeline"]),
        task("player-embed", "2028-08", "2028-12", "planned", ["transcoding"]),
        task("channels", "2028-10", "2029-02", "planned", ["player-embed"]),
      ]),
      phase("community", 2, [
        task("comments-moderation", "2029-01", "2029-05", "planned", ["channels"]),
        task("playlists", "2029-03", "2029-07", "planned", ["comments-moderation"]),
        task("live-streaming", "2029-05", "2029-10", "planned", ["playlists"]),
      ]),
      phase("sovereignty", 3, [
        task("federation-activitypub", "2029-08", "2030-02", "planned", ["live-streaming"]),
        task("cdn-self-hosted", "2029-11", "2030-05", "planned", ["federation-activitypub"]),
      ]),
    ],
  },
  {
    key: "opensource-support",
    slug: "opensource-support",
    icon: Palette,
    category: "opensource",
    status: "in_progress",
    replaces: ["GitHub Sponsors", "Open Collective"],
    relatedSlugs: ["ai", "browser"],
    phases: [
      phase("foundations", 1, [
        task("project-directory", "2026-06", "2026-10", "in_progress"),
        task("donation-platform", "2026-08", "2027-01", "planned", ["project-directory"]),
        task("volunteer-matching", "2026-10", "2027-03", "planned", ["donation-platform"]),
        task("transparency-reports", "2027-01", "2027-05", "planned", ["volunteer-matching"]),
      ]),
      phase("infrastructure", 2, [
        task("ci-cd-hosting", "2027-04", "2027-08", "planned", ["transparency-reports"]),
        task("mirror-registries", "2027-06", "2027-10", "planned", ["ci-cd-hosting"]),
        task("security-audits", "2027-08", "2027-12", "planned", ["mirror-registries"]),
      ]),
      phase("ecosystem", 3, [
        task("kod-digor-integration", "2027-11", "2028-04", "planned", ["security-audits"]),
        task("bretagne-network", "2028-02", "2028-07", "planned", ["kod-digor-integration"]),
        task("eu-sovereignty-fund", "2028-05", "2028-12", "planned", ["bretagne-network"]),
      ]),
    ],
  },
];

export function getProductBySlug(slug: string): ProductDefinition | undefined {
  return PRODUCT_DEFINITIONS.find((p) => p.slug === slug);
}

export function getAllProductSlugs(): string[] {
  return PRODUCT_DEFINITIONS.map((p) => p.slug);
}

export function getProductsByCategory(category: ProductCategory): ProductDefinition[] {
  return PRODUCT_DEFINITIONS.filter((p) => p.category === category);
}

export function getTimelineBounds(): { start: string; end: string } {
  let min = "2099-12";
  let max = "2020-01";
  for (const product of PRODUCT_DEFINITIONS) {
    for (const phase of product.phases) {
      for (const t of phase.tasks) {
        if (t.startMonth < min) min = t.startMonth;
        if (t.endMonth > max) max = t.endMonth;
      }
    }
  }
  return { start: min, end: max };
}

export function getAllTasks(product: ProductDefinition): RoadmapTask[] {
  return product.phases.flatMap((p) => p.tasks);
}

export function getTaskProgress(product: ProductDefinition): number {
  const tasks = getAllTasks(product);
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  return Math.round(((done + inProgress * 0.5) / tasks.length) * 100);
}

export function getAdjacentProducts(slug: string): {
  prev: ProductDefinition | null;
  next: ProductDefinition | null;
} {
  const index = PRODUCT_DEFINITIONS.findIndex((p) => p.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? PRODUCT_DEFINITIONS[index - 1] : null,
    next: index < PRODUCT_DEFINITIONS.length - 1 ? PRODUCT_DEFINITIONS[index + 1] : null,
  };
}

export function monthToIndex(month: string, origin: string): number {
  const [y1, m1] = month.split("-").map(Number);
  const [y2, m2] = origin.split("-").map(Number);
  return (y1 - y2) * 12 + (m1 - m2);
}

export function generateMonthLabels(start: string, end: string): string[] {
  const labels: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    labels.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return labels;
}
