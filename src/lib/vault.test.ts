import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getMock, headMock, putMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  headMock: vi.fn(),
  putMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  del: deleteMock,
  get: getMock,
  head: headMock,
  put: putMock,
}));

import {
  deleteFromVault,
  downloadFromVault,
  headVaultFile,
  uploadToVault,
} from "@/lib/vault";

describe("private document vault storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads files to a private Blob store", async () => {
    putMock.mockResolvedValue({ pathname: "vault/client/matter/document/report.pdf" });

    await uploadToVault({
      pathname: "vault/client/matter/document/report.pdf",
      file: new ArrayBuffer(8),
      contentType: "application/pdf",
    });

    expect(putMock).toHaveBeenCalledWith(
      "vault/client/matter/document/report.pdf",
      expect.any(ArrayBuffer),
      {
        access: "private",
        contentType: "application/pdf",
        allowOverwrite: false,
      },
    );
  });

  it("reads private files by pathname for authenticated proxy delivery", async () => {
    getMock.mockResolvedValue({ statusCode: 200, stream: new ReadableStream() });

    await downloadFromVault("vault/client/matter/document/report.pdf");

    expect(getMock).toHaveBeenCalledWith(
      "vault/client/matter/document/report.pdf",
      { access: "private" },
    );
  });

  it("deletes and inspects files without exposing a public URL", async () => {
    deleteMock.mockResolvedValue(undefined);
    headMock.mockResolvedValue({ pathname: "vault/client/matter/document/report.pdf" });

    await deleteFromVault("vault/client/matter/document/report.pdf");
    await headVaultFile("vault/client/matter/document/report.pdf");

    expect(deleteMock).toHaveBeenCalledWith(
      "vault/client/matter/document/report.pdf",
    );
    expect(headMock).toHaveBeenCalledWith(
      "vault/client/matter/document/report.pdf",
    );
  });
});
