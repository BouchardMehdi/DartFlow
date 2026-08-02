import { createSerwistRoute } from "@serwist/turbopack";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [
    { url: "/~offline", revision: "dartflow-offline-v1" },
    { url: "/", revision: "dartflow-home-v1" },
  ],
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
