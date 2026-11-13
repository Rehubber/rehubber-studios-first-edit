import posthog from "posthog-js"

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"

if (token && token !== "your_posthog_project_token_here" && host) {
  posthog.init(token, {
    api_host: host,
    defaults: "2025-05-24",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    logs: {
      serviceName: "rehubber-directory-web",
      environment: process.env.NODE_ENV,
    },
  })
}
