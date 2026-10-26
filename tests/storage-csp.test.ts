import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildContentSecurityPolicy } from "../src/lib/security/csp.ts";

describe("storage image CSP", () => {
  it("allows the configured sandbox origin and preserves other protections", () => {
    const policy = buildContentSecurityPolicy(
      "http://storage.192.168.21.122.nip.io:8080/perizinan",
    );
    assert.ok(policy.includes("http://storage.192.168.21.122.nip.io:8080"));
    assert.ok(!policy.includes("/perizinan"));
    assert.ok(policy.includes("frame-ancestors 'none'"));
    assert.ok(
      policy.includes("connect-src 'self' https://*.tile.openstreetmap.org"),
    );
    assert.ok(!policy.includes("https://storage.lunaradev.my.id"));
  });

  it("preserves the existing production storage origin when configured", () => {
    const policy = buildContentSecurityPolicy(
      "https://storage.lunaradev.my.id",
    );
    assert.ok(policy.includes("img-src 'self' data: blob:"));
    assert.ok(policy.includes("https://storage.lunaradev.my.id"));
  });

  it("cannot inject directives through the configured URL path", () => {
    const policy = buildContentSecurityPolicy(
      "https://storage.example.test/path; img-src *",
    );
    assert.equal(policy.match(/img-src/g)?.length, 1);
    assert.ok(policy.includes("https://storage.example.test;"));
    assert.ok(!policy.includes("img-src *"));
  });

  it("rejects non-HTTP schemes and credential-bearing URLs", () => {
    for (const url of [
      "data:text/plain,test",
      "file:///tmp/image",
      "https://user:pass@storage.test",
    ])
      assert.throws(() => buildContentSecurityPolicy(url), /HTTP\(S\)/);
  });
});
