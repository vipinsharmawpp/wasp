import { afterEach, describe, expect, test } from "vitest";

import {
  assertVercelAppNameIsValid,
  getClientAppUrl,
  getClientProjectName,
  getServerAppUrl,
  getServerProjectName,
} from "../../../src/providers/vercel/brandedUrls.js";

describe("Vercel project name prediction", () => {
  test("derives the deterministic <app>-server project name", () => {
    expect(getServerProjectName("my-app")).toBe("my-app-server");
  });

  test("derives the deterministic <app>-client project name", () => {
    expect(getClientProjectName("my-app")).toBe("my-app-client");
  });
});

describe("Vercel production URL overrides", () => {
  // A project may serve a custom domain, which the project name cannot express. The
  // override is what the deployment already knows, not something looked up — so the
  // determinism above survives: both URLs are still settled before either deploy runs.
  afterEach(() => {
    delete process.env.WASP_VERCEL_SERVER_URL;
    delete process.env.WASP_VERCEL_CLIENT_URL;
  });

  test("prefers WASP_VERCEL_SERVER_URL over the derived server name", () => {
    process.env.WASP_VERCEL_SERVER_URL = "https://api.example.com";
    expect(getServerAppUrl("my-app")).toBe("https://api.example.com");
  });

  test("prefers WASP_VERCEL_CLIENT_URL over the derived client name", () => {
    process.env.WASP_VERCEL_CLIENT_URL = "https://app.example.com";
    expect(getClientAppUrl("my-app")).toBe("https://app.example.com");
  });

  test("overriding one leaves the other derived", () => {
    process.env.WASP_VERCEL_SERVER_URL = "https://api.example.com";
    expect(getClientAppUrl("my-app")).toBe("https://my-app-client.vercel.app");
  });

  // An unset variable and one set to whitespace are the same thing: a deployment that
  // did not ask for an override. An empty string reaching the client as the API base
  // would make every request relative to the client's own origin.
  test.each(["", "   "])("treats %o as no override at all", (value) => {
    process.env.WASP_VERCEL_SERVER_URL = value;
    expect(getServerAppUrl("my-app")).toBe("https://my-app-server.vercel.app");
  });

  // Rejected rather than passed through: this value is baked into the client bundle and
  // written to WASP_SERVER_URL, so a bad one is found only once requests start failing.
  test.each([
    "http://api.example.com",
    "https://api.example.com/",
    "https://api.example.com/v1",
    "api.example.com",
  ])("refuses %o, which is not a bare https origin", (value) => {
    process.env.WASP_VERCEL_SERVER_URL = value;
    expect(() => getServerAppUrl("my-app")).toThrow(/bare https origin/);
  });
});

describe("Vercel production URL prediction", () => {
  // Deterministic URLs derived from the project names are what solve the
  // client<->server chicken-and-egg: both URLs are known before either
  // deploy runs.
  test("predicts https://<app>-server.vercel.app for the server", () => {
    expect(getServerAppUrl("my-app")).toBe("https://my-app-server.vercel.app");
  });

  test("predicts https://<app>-client.vercel.app for the client", () => {
    expect(getClientAppUrl("my-app")).toBe("https://my-app-client.vercel.app");
  });

  test("prediction matches the project name it is derived from", () => {
    expect(getServerAppUrl("wvtest-launch-e2e")).toBe(
      `https://${getServerProjectName("wvtest-launch-e2e")}.vercel.app`,
    );
    expect(getClientAppUrl("wvtest-launch-e2e")).toBe(
      `https://${getClientProjectName("wvtest-launch-e2e")}.vercel.app`,
    );
  });
});

describe("assertVercelAppNameIsValid", () => {
  test("accepts lowercase names with digits, hyphens and dots", () => {
    expect(() => assertVercelAppNameIsValid("my-app-2")).not.toThrow();
    expect(() => assertVercelAppNameIsValid("app.v2")).not.toThrow();
  });

  test("rejects names with uppercase, spaces or a leading separator", () => {
    expect(() => assertVercelAppNameIsValid("MyApp")).toThrow();
    expect(() => assertVercelAppNameIsValid("my app")).toThrow();
    expect(() => assertVercelAppNameIsValid("-my-app")).toThrow();
    expect(() => assertVercelAppNameIsValid("")).toThrow();
  });

  test("rejects names too long to fit the -server/-client suffix", () => {
    expect(() => assertVercelAppNameIsValid("a".repeat(91))).toThrow();
    expect(() => assertVercelAppNameIsValid("a".repeat(90))).not.toThrow();
  });
});
