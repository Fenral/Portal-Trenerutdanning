import { z } from "zod";

const DatabaseId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const Heading = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().trim().min(1).max(180),
});

const Paragraph = z.object({
  type: z.literal("paragraph"),
  text: z.string().trim().min(1).max(10_000),
});

const Image = z.object({
  type: z.literal("image"),
  assetId: DatabaseId,
  alt: z.string().trim().min(1).max(240),
  caption: z.string().trim().max(500).optional(),
});

const File = z.object({
  type: z.literal("file"),
  assetId: DatabaseId,
  label: z.string().trim().min(1).max(120),
});

const ExternalLink = z.object({
  type: z.literal("external_link"),
  url: z.string().url(),
  label: z.string().trim().min(1).max(120),
});

const VIDEO_HOSTS = {
  trackman: ["trackmangolf.com"],
  youtube: ["youtube.com", "youtube-nocookie.com", "youtu.be"],
} as const;

function isHostAllowed(hostname: string, allowedDomains: readonly string[]) {
  const normalizedHostname = hostname.toLowerCase();

  return allowedDomains.some(
    (domain) =>
      normalizedHostname === domain ||
      normalizedHostname.endsWith(`.${domain}`),
  );
}

const Video = z
  .object({
    type: z.literal("video"),
    provider: z.enum(["youtube", "trackman", "uploaded"]),
    url: z.string().url().optional(),
    assetId: DatabaseId.optional(),
    required: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.provider === "uploaded") {
      if (!value.assetId) {
        context.addIssue({
          code: "custom",
          message: "Opplastet video må peke på en mediefil",
          path: ["assetId"],
        });
      }

      if (value.url) {
        context.addIssue({
          code: "custom",
          message: "Opplastet video kan ikke bruke ekstern URL",
          path: ["url"],
        });
      }
      return;
    }

    if (!value.url) {
      context.addIssue({
        code: "custom",
        message: "Ekstern video må ha en URL",
        path: ["url"],
      });
      return;
    }

    const hostname = new URL(value.url).hostname;
    if (!isHostAllowed(hostname, VIDEO_HOSTS[value.provider])) {
      context.addIssue({
        code: "custom",
        message: "Videoleverandør og vertsnavn samsvarer ikke",
        path: ["url"],
      });
    }

    if (value.assetId) {
      context.addIssue({
        code: "custom",
        message: "Ekstern video kan ikke peke på en opplastet mediefil",
        path: ["assetId"],
      });
    }
  });

const Callout = z.object({
  type: z.literal("callout"),
  tone: z.enum(["info", "practice", "warning"]),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2_000),
});

const InteractiveSequence = z
  .object({
    type: z.literal("interactive_sequence"),
    desktopMode: z.enum(["scroll", "next_previous"]),
    mobileMode: z.literal("stacked"),
    steps: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          title: z.string().trim().min(1).max(120),
          text: z.string().trim().min(1).max(2_000),
          assetId: DatabaseId.optional(),
        }),
      )
      .min(2)
      .max(30),
  })
  .superRefine((value, context) => {
    const stepIds = value.steps.map((step) => step.id);
    if (new Set(stepIds).size !== stepIds.length) {
      context.addIssue({
        code: "custom",
        message: "Steg-ID-er må være unike",
        path: ["steps"],
      });
    }
  });

export const ContentBlock = z.discriminatedUnion("type", [
  Heading,
  Paragraph,
  Image,
  File,
  ExternalLink,
  Video,
  Callout,
  InteractiveSequence,
]);

export const ContentDocument = z.object({
  locale: z.literal("nb-NO"),
  format: z.enum(["short_page", "scroll_story"]),
  blocks: z.array(ContentBlock).min(1).max(200),
});

export type ContentDocument = z.infer<typeof ContentDocument>;
