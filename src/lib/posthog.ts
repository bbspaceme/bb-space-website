import posthog from "posthog-js";

if (typeof window !== "undefined") {
  posthog.init(process.env.VITE_POSTHOG_KEY || "", {
    api_host: "https://app.posthog.com",
    autocapture: false, // Manual capture for control
    capture_pageview: true,
    persistence: "localStorage",
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") console.log("PostHog loaded");
    },
  });
}

export { posthog };
