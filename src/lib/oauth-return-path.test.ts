import { strict as assert } from "node:assert";
import { test } from "node:test";
import { oauthReturnPath } from "./oauth-return-path";

test("consent return keeps authorization id and fragment", () => {
  assert.equal(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc#consent"), "/.lovable/oauth/consent?authorization_id=abc#consent");
});
test("external return paths are rejected", () => {
  for (const path of ["//outside.invalid", "/\\outside.invalid", "https://outside.invalid", "/\noutside.invalid"]) assert.equal(oauthReturnPath(path), "/");
});