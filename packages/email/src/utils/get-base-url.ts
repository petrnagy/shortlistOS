import { env } from "next-runtime-env";

const LOCAL_BASE_URL = "http://localhost:3000";

export const getBaseUrl = () => {
  if ("window" in globalThis) {
    return LOCAL_BASE_URL;
  }

  return env("NEXT_PUBLIC_BASE_URL") ?? LOCAL_BASE_URL;
};
