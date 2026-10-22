import { createSerwistRoute } from "@serwist/turbopack";
import { randomUUID } from "node:crypto";

// This route is generated at build time; each deployment must refresh its HTML cache.
const revision = randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [
    { url: "/~offline", revision },
    { url: "/", revision },
  ],
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
