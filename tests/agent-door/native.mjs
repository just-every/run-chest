// Named review, original scoped OAuth consent, and conservative native custody through public doors.
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
export default async function ({ request, origin, cookie, email }) {
  const json = async (path, body) => {
    const r = await request(new URL(path, origin).href, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.status !== 200) {
      const body = await r.json().catch(() => ({}));
      const code =
        typeof body.code === "string" && /^[a-z0-9_.-]+$/i.test(body.code)
          ? body.code
          : "unavailable";
      console.error("Native Undo HTTP " + r.status + " code=" + code);
      throw Error("native_undo_http_" + r.status);
    }
    return r.json();
  };
  let stage = "reviews";
  try {
    const { reviews } = await json("/agents/api/reviews");
    const review = reviews.find(
      (r) => r.tool === "chest.items.update" && r.undo.available,
    );
    assert.ok(review, "Native rename exposes its actual reversal");
    stage = "batch";
    const id = review.summary.nativeTarget.id,
      { batches } = await json("/api/chest/filing/batches"),
      batch = batches.find((b) => b.payload.items.some((i) => i.item === id));
    assert.ok(batch);
    const entry = batch.payload.items.find((i) => i.state === "applied");
    assert.ok(entry);
    const original = await json(`/api/chest/items/${entry.item}`);
    stage = "undo";
    const answer = await json(`/agents/api/reviews/${review.id}/undo`, {});
    assert.equal(answer.review.state, "undone");
    stage = "restored";
    const restored = await json(`/api/chest/items/${entry.item}`);
    assert.equal(restored.item.name, entry.afterName);
    assert.equal(restored.id, original.id);
    assert.equal(restored.item.current, original.item.current);
    assert.deepEqual(restored.grants, original.grants);
    stage = "audit";
    const audit = await json("/api/chest/audit"),
      row = audit.find(
        (r) => r.action === "item.rename" && r.object_id === entry.item,
      );
    assert.equal(row.actor, email);
    assert.equal(
      JSON.parse(row.detail).agent,
      undefined,
      "Human Undo has no agent actor",
    );
    stage = "scoped-oauth";
    const redirect = "https://agent-scope.example.invalid/callback",
      app = await json("/api/chest/integrations/clients", {
        name: "Version-scoped native clerk",
        redirects: [redirect],
        actions: ["versions"],
      }),
      verifier = randomBytes(32).toString("base64url");
    const params = new URLSearchParams({
      client_id: app.client.id,
      redirect_uri: redirect,
      response_type: "code",
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      scope: "versions",
      resource: entry.item,
      state: randomBytes(16).toString("hex"),
    });
    const consent = await request(
      new URL("/oauth/chest/authorize?" + params, origin).href,
      { headers: { Cookie: cookie } },
    );
    assert.equal(consent.status, 200);
    const intent = /name="intent" value="([^"]+)"/.exec(
      await consent.text(),
    )?.[1];
    assert.ok(intent);
    const allowed = await request(
      new URL("/oauth/chest/authorize", origin).href,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ intent, decision: "allow" }),
      },
    );
    assert.equal(allowed.status, 303);
    const exchanged = await request(
      new URL("/oauth/chest/token", origin).href,
      {
        method: "POST",
        headers: {
          Origin: "https://agent-scope.example.invalid",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: app.client.id,
          redirect_uri: redirect,
          code: new URL(allowed.headers.get("location")).searchParams.get(
            "code",
          ),
          code_verifier: verifier,
        }),
      },
    );
    assert.equal(exchanged.status, 200);
    const credential = await exchanged.json();
    const scoped = async (path, body, key) =>
      request(new URL("/api/chest/integrations/v1" + path, origin).href, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + credential.access_token,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(body),
      });
    const replacement = {
        filename: "Scoped native version.txt",
        base64: Buffer.from(
          "An immutable original authorized by the versions scope alone.",
        ).toString("base64"),
      },
      version = await scoped(
        `/items/${entry.item}/versions`,
        replacement,
        "native-versions-only",
      );
    assert.equal(version.status, 200);
    await version.body.cancel();
    const afterVersion = await json(`/api/chest/items/${entry.item}`);
    assert.equal(afterVersion.versions.length, restored.versions.length + 1);
    assert.notEqual(afterVersion.item.current, restored.item.current);
    const replay = await scoped(
      `/items/${entry.item}/versions`,
      replacement,
      "native-versions-only",
    );
    assert.equal(replay.status, 200);
    await replay.body.cancel();
    assert.equal(
      (await json(`/api/chest/items/${entry.item}`)).versions.length,
      afterVersion.versions.length,
    );
    const refused = await scoped(
      "/items",
      {
        space: restored.item.space,
        name: "Outside the original grant.txt",
        base64: replacement.base64,
      },
      "native-upload-refused",
    );
    assert.equal(refused.status, 403);
    await refused.body.cancel();
    await json(`/api/chest/integrations/grants/${credential.grant}/revoke`, {});
    const revoked = await scoped(
      `/items/${entry.item}/versions`,
      replacement,
      "native-revoked-version",
    );
    assert.equal(revoked.status, 401);
    await revoked.body.cancel();
    assert.equal(
      (await json(`/api/chest/items/${entry.item}`)).versions.length,
      afterVersion.versions.length,
    );
    stage = "custody";
    const held = await json("/api/chest/erasure", {
      email: "outside@outside.test",
      confirm: "outside@outside.test",
    });
    assert.equal(held.payload.state, "held");
    assert.ok(
      held.payload.targets.some(
        (t) => t.store === "agent decision custody" && t.status === "held",
      ),
    );
    const anonymize = await request(
      new URL("/api/chest/audit/identities/erase", origin).href,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, confirm: email }),
      },
    );
    assert.equal(anonymize.status, 409);
    assert.equal((await anonymize.json()).error, "agent_decision_custody_held");
  } catch (error) {
    console.error(
      "Native Undo failed: stage=" +
        stage +
        " type=" +
        error.name +
        " code=" +
        (error.code ?? "none"),
    );
    throw error;
  }
}
