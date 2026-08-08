import { env } from "next-runtime-env";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as memberRepo from "@kan/db/repository/member.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import { sendEmail } from "@kan/email";

import { createDatabaseHooks, getWorkspaceNameForNewUser } from "./hooks";

vi.mock("next-runtime-env", () => ({
  env: vi.fn(),
}));

vi.mock("@kan/db/repository/member.repo", () => ({
  getByEmailAndStatus: vi.fn(),
  getByPublicId: vi.fn(),
  acceptInvite: vi.fn(),
}));

vi.mock("@kan/db/repository/user.repo", () => ({
  update: vi.fn(),
}));

vi.mock("@kan/db/repository/workspace.repo", () => ({
  create: vi.fn(),
}));

vi.mock("@kan/email", () => ({
  notificationClient: null,
  sendEmail: vi.fn(),
}));

vi.mock("@kan/shared", () => ({
  createEmailUnsubscribeLink: vi.fn(),
  createS3Client: vi.fn(),
  generateUID: vi.fn(() => "workspace-123"),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
}));

vi.mock("@novu/api/models/components", () => ({
  ChatOrPushProviderEnum: { Discord: "discord" },
}));

const mockEnv = env as ReturnType<typeof vi.fn>;
const mockGetByEmailAndStatus = memberRepo.getByEmailAndStatus as ReturnType<
  typeof vi.fn
>;
const mockCreateWorkspace = workspaceRepo.create as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmail as ReturnType<typeof vi.fn>;

const db = {} as Parameters<typeof createDatabaseHooks>[0];

const fakeUser = {
  id: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  email: "test@example.com",
  emailVerified: false,
  name: "Test User",
};

describe("createDatabaseHooks", () => {
  const hooks = createDatabaseHooks(db);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("user.create.before", () => {
    it("allows sign-up when DISABLE_SIGN_UP is not set", async () => {
      mockEnv.mockReturnValue(undefined);

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).not.toHaveBeenCalled();
    });

    it("allows sign-up when DISABLE_SIGN_UP is false", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "false" : undefined,
      );

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).not.toHaveBeenCalled();
    });

    it("blocks sign-up when disabled and user has no pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      mockGetByEmailAndStatus.mockResolvedValue(undefined);

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(false);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "test@example.com",
        "invited",
      );
    });

    it("allows sign-up when disabled but user has a pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "test@example.com",
        "invited",
      );
    });

    it("blocks sign-up when disabled and invitation exists but domain is not allowed", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      process.env.BETTER_AUTH_ALLOWED_DOMAINS = "acme.com";
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(false);

      delete process.env.BETTER_AUTH_ALLOWED_DOMAINS;
    });

    // The user.create.before hook fires for ALL sign-up paths including
    // OIDC/social — verify invite bypass works regardless of auth method.
    it("allows OIDC/social sign-up when disabled but user has a pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      const oidcUser = {
        ...fakeUser,
        id: "user-oidc",
        email: "sso@corp.com",
        image: "https://provider.com/avatar.jpg",
      };
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-2",
        email: "sso@corp.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(oidcUser, {});
      expect(result).toBe(true);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "sso@corp.com",
        "invited",
      );
    });

    it("blocks OIDC/social sign-up when disabled and user has no pending invitation", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      const oidcUser = {
        ...fakeUser,
        id: "user-oidc",
        email: "random@external.com",
        image: "https://provider.com/avatar.jpg",
      };
      mockGetByEmailAndStatus.mockResolvedValue(undefined);

      const result = await hooks.user.create.before(oidcUser, {});
      expect(result).toBe(false);
      expect(mockGetByEmailAndStatus).toHaveBeenCalledWith(
        db,
        "random@external.com",
        "invited",
      );
    });

    it("allows sign-up when disabled, invitation exists, and domain is allowed", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_SIGN_UP" ? "true" : undefined,
      );
      process.env.BETTER_AUTH_ALLOWED_DOMAINS = "example.com";
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      const result = await hooks.user.create.before(fakeUser, {});
      expect(result).toBe(true);

      delete process.env.BETTER_AUTH_ALLOWED_DOMAINS;
    });
  });

  describe("getWorkspaceNameForNewUser", () => {
    it("uses the first name from a full name", () => {
      expect(getWorkspaceNameForNewUser(fakeUser)).toBe("Test's");
    });

    it("prefers provider first-name fields when present", () => {
      expect(
        getWorkspaceNameForNewUser({
          ...fakeUser,
          name: "Ignored Name",
          given_name: "Amanda",
        }),
      ).toBe("Amanda's");
    });

    it("falls back to My workspace when no name is available", () => {
      expect(
        getWorkspaceNameForNewUser({
          ...fakeUser,
          name: "",
        }),
      ).toBe("My workspace");
    });
  });

  describe("user.create.after", () => {
    it("creates a default workspace for new users", async () => {
      mockGetByEmailAndStatus.mockResolvedValue(undefined);

      await hooks.user.create.after(
        {
          ...fakeUser,
          name: "Amanda Jones",
        },
        {},
      );

      expect(mockCreateWorkspace).toHaveBeenCalledWith(db, {
        publicId: "workspace-123",
        name: "Amanda's",
        slug: "workspace-123",
        createdBy: "user-1",
        createdByEmail: "test@example.com",
      });
    });

    it("does not create a default workspace for invited users", async () => {
      mockGetByEmailAndStatus.mockResolvedValue({
        id: "member-1",
        email: "test@example.com",
        status: "invited",
      });

      await hooks.user.create.after(fakeUser, {});

      expect(mockCreateWorkspace).not.toHaveBeenCalled();
    });

    it("sends a welcome email for every newly created user", async () => {
      mockGetByEmailAndStatus.mockResolvedValue(undefined);

      await hooks.user.create.after(fakeUser, {});

      expect(mockSendEmail).toHaveBeenCalledWith(
        "test@example.com",
        "Welcome to shortlistOS",
        "WELCOME",
        { name: "Test User" },
      );
    });

    it("does not send a welcome email when email is disabled", async () => {
      mockEnv.mockImplementation((key: string) =>
        key === "NEXT_PUBLIC_DISABLE_EMAIL" ? "true" : undefined,
      );

      await hooks.user.create.after(fakeUser, {});

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
