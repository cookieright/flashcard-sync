import { expect, test } from "bun:test";
import { oauthReturnPath } from "./oauth-return-path";

test("consent return keeps authorization id and fragment", () => {
  expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#consent")).toBe("/.lovable/oauth/consent?authorization_id=abc#consent");
});
test("external return paths are rejected", () => {
  for (const path of ["//outside.invalid", "/\\outside.invalid", "https://outside.invalid", "/\noutside.invalid"]) expect(oauthReturnPath(path)).toBe("/");
});