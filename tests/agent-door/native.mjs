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

// Native effects accompany the mandatory MCP step under both conformance policies.
const changesBefore = new Map();
async function personJson({request, origin, cookie}, path) {
  const response = await request(new URL(path, origin).href, {headers:{Cookie:cookie}});
  assert.equal(response.status, 200);
  return response.json();
}
export async function beforeStep(c) {
  if (c.step.id === "request-changes")
    changesBefore.set(c.phase, await personJson(c, `/api/chest/items/${c.args.id}`));
}
export async function afterStep(c) {
  if (c.step.id !== "request-changes") return;
  const before = changesBefore.get(c.phase);
  const after = await personJson(c, `/api/chest/items/${c.args.id}`);
  const review = after.versions.find(v => v.id === c.args.version).review;
  assert.equal(review.state, "changes");
  assert.equal(review.message, c.args.message);
  assert.equal(review.reviewer, c.email);
  assert.equal(review.actor, c.result.preparedBy.label);
  assert.match(review.actor, / for /);
  assert.ok(Number.isFinite(Date.parse(review.at)));
  assert.equal(after.item.approved, before.item.approved);
  assert.equal(after.item.current, before.item.current);
  assert.deepEqual(after.grants, before.grants);
  assert.deepEqual(after.versions.map(({review, ...v}) => v), before.versions.map(({review, ...v}) => v));
  const rows = (await personJson(c, "/api/chest/audit")).filter(r =>
    r.action === "version.review.changes" && r.object_id === c.args.id);
  assert.equal(rows.length, 1);
  const detail = JSON.parse(rows[0].detail);
  assert.equal(detail.version, c.args.version);
  assert.equal(detail.message, c.args.message);
  assert.equal(detail.label, review.actor);
  changesBefore.delete(c.phase);
}

// Shared conformance signatures exercise the real sponsor mapping, policy and MCP admission.
// This native leg is also run by the existing governance browser journey in push Verify.
export async function changesThroughMcp(h, owner) {
  const {webcrypto, randomUUID} = await import("node:crypto");
  const {signJws, seconds, accessToken, policyEnvelope, autonomousPolicy} =
    await import("../../src/modules/agent-door/conformance/crypto.mjs");
  const pair = await webcrypto.subtle.generateKey({name:"ECDSA", namedCurve:"P-256"}, true, ["sign","verify"]);
  const kid = randomUUID(), publicKey = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
  const signer = {issuer:"https://synthetic-chest-1.invalid", installationId:randomUUID(), kid, privateKey:pair.privateKey};
  const email = ["synthetic-chest-reviewer","example.test"].join("@");
  const sub = "synthetic-chest-reviewer", business = "synthetic-chest-business", agentId = randomUUID(), grant = randomUUID();
  const keys = {[kid]:{...publicKey, kid, alg:"ES256", use:"sig"}};
  Object.assign(h.vars, {
    RER_OWNER_CLAIM_ISSUER:signer.issuer,
    RER_OWNER_CLAIM_INSTALLATION_ID:signer.installationId,
    RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys),
    RER_BUSINESS_TRUST:JSON.stringify({v:1, issuer:signer.issuer, audience:h.origin, subject:signer.installationId, email:h.vars.OWNER_EMAIL, keys}),
  });
  await h.stop(); await h.start();
  const iat = seconds();
  const settings = await signJws(pair.privateKey, kid, "rer-business-settings+jwt", {
    v:1, iss:signer.issuer, aud:h.origin, sub:signer.installationId, business, email:h.vars.OWNER_EMAIL,
    owner_id:"synthetic-chest-owner", jti:randomUUID(), iat, exp:iat+300, rev:1, values:{}, logo:null,
    team:[{id:sub,email,name:"Jordan Lee",role:"member",invite:1}],
  });
  const bound = await h.fetch("/api/rer/business-settings", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({settings})});
  assert.equal(bound.status, 200); assert.equal((await bound.json()).rev, 1);
  await h.api("/people", owner, {action:"resend-invite", email});
  const reviewer = await h.signIn(email, true);
  const signing = {signer, business, origin:h.origin, revision:0, seq:0};
  const policy = await policyEnvelope(signing, autonomousPolicy());
  const adopted = await h.fetch("/api/rer/agent-policy", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({policy:policy.policy})});
  assert.equal(adopted.status, 200); await adopted.body.cancel();
  const credential = () => accessToken({...signing,person:{sub,email},agentId,consent:grant,surface:{specialist:"records clerk",tools:[{scope:"read"},{scope:"decisions:write"}]}});
  const label = "Agent door conformance for Jordan Lee";
  const space = await h.api("/spaces", owner, {name:"Exact decision records"});
  const members = active => [{principal:h.vars.OWNER_EMAIL,role:"manager"},...(active?[{principal:email,role:"viewer"}]:[])];
  await h.api(`/spaces/${space.id}/members`, owner, {members:members(true)});
  const folder = await h.api("/items", owner, {space:space.id,type:"folder",name:"Payment review"});
  await h.api(`/items/${folder.id}/governance`, owner, {reviewer:email});
  const originals = [Buffer.from("synthetic-chest-1: agreed payment period."),Buffer.from("synthetic-chest-2: proposed changed payment period."),Buffer.from("synthetic-chest-3: another pending original.")];
  const file = await h.api("/items", owner, {parent:folder.id,name:"Payment terms.txt",base64:originals[0].toString("base64")});
  const approved = file.payload.current;
  await h.api(`/items/${file.id}/versions/${approved}/review`, reviewer, {action:"approve"});
  const replacement = await h.api(`/items/${file.id}/versions`, owner, {base64:originals[1].toString("base64")});
  const version = replacement.payload.versions.at(-1).id;
  const later = await h.api(`/items/${file.id}/versions`, owner, {base64:originals[2].toString("base64")});
  const pending = later.payload.versions.at(-1).id;
  const message = "Keep the agreed payment period. <b>Review required</b>";
  const args = {id:file.id,version,action:"changes",message,idempotency_key:"synthetic-chest-request-changes"};
  const call = async input => {
    const response = await h.fetch("/mcp/chest", {
      method:"POST", headers:{authorization:"Bearer "+await credential(),"content-type":"application/json","MCP-Protocol-Version":"2025-11-25",accept:"application/json, text/event-stream"},
      body:JSON.stringify({jsonrpc:"2.0",id:1,method:["tools","call"].join("/"),params:{name:"chest.decisions.record",arguments:input}}),
    });
    const body = await response.json();
    assert.equal(response.status, 200, body.error?.data?.code ?? body.error?.message ?? body.code);
    return body.result;
  };
  const snapshot = async (id=file.id) => {
    const detail = await h.api(`/items/${id}`, owner);
    return {item:detail.item,versions:detail.versions,grants:detail.grants,revision:detail.revision};
  };
  const audits = async (id=file.id) => (await h.api("/audit", owner)).filter(r =>
    r.object_id === id && r.action.startsWith("version.review."));
  const before = await snapshot(), auditBefore = await audits();
  const answer = await call(args);
  assert.equal(answer.isError, false);
  assert.deepEqual(answer._meta["com.runeditrun/decision"].classes.map(c=>c.class), ["standard"]);
  const after = await snapshot(), review = after.versions.find(v=>v.id===version).review;
  assert.equal(review.actor, label);
  assert.equal(review.preparedBy.label, label);
  assert.equal(review.preparedBy.agent, agentId);
  assert.equal(review.preparedBy.grant, grant);
  assert.equal(review.reviewer, email);
  assert.equal(review.message, message);
  assert.equal(review.state, "changes");
  assert.ok(Number.isFinite(Date.parse(review.at)));
  assert.equal(after.item.approved, approved);
  assert.equal(after.item.current, approved);
  assert.deepEqual(after.grants, before.grants);
  assert.deepEqual(after.versions.map(({review,...v})=>v),before.versions.map(({review,...v})=>v));
  for (const prior of before.versions.filter(v=>v.id!==version))
    assert.deepEqual(after.versions.find(v=>v.id===prior.id),prior,"only the requested exact version receives a decision");
  const decisionRows = (await audits()).filter(r=>r.action==="version.review.changes");
  assert.equal(decisionRows.length, 1);
  const audit = decisionRows[0], detail = JSON.parse(audit.detail);
  assert.equal(audit.actor, "agent:"+agentId);
  assert.equal(detail.version, version); assert.equal(detail.message, message);
  assert.equal(detail.label, label); assert.equal(detail.agent, agentId); assert.equal(detail.grant, grant);
  const agents = await h.fetch("/agents/api/agents", {headers:{cookie:owner}});
  assert.equal(agents.status, 200);
  const authenticated = (await agents.json()).agents.find(a=>a.id===agentId);
  assert.equal(authenticated.sponsor.name, "Jordan Lee");
  assert.equal(detail.sponsor, authenticated.sponsor.id);
  assert.equal(review.preparedBy.sponsor, authenticated.sponsor.id);
  assert.equal((await audits()).length, auditBefore.length+1);
  for (const restart of [false,true]) {
    if (restart) {await h.stop(); await h.start()}
    const replay = await call(args);
    assert.equal(replay.isError, false);
    assert.deepEqual(replay.structuredContent, answer.structuredContent);
    assert.deepEqual(await snapshot(), after);
    assert.equal((await audits()).filter(r=>r.action==="version.review.changes").length, 1);
  }
  console.log("PROBE SURFACE-011 1: MCP exact submitted replacement -> standard, authenticated agent for reviewer, one changes decision and audit across retry and Worker restart; approved pointer and grants retained");
  const refuse = async (input, code) => {
    const state = await snapshot(input.id), rows = await audits(input.id);
    const denied = await call(input);
    assert.equal(denied.isError, true);
    assert.deepEqual(JSON.parse(denied.content[0].text), {code,...(code==="version_not_submitted"?{native_status:409}:code==="assigned_reviewer_required"?{native_status:403}:{})});
    assert.equal(denied._meta["com.runeditrun/error"].code, code);
    assert.equal(denied.structuredContent, undefined);
    for (const secret of [state.item.name,message,email,originals[1].toString()])
      assert.ok(!JSON.stringify(denied).includes(secret),"refusal discloses no original, reviewer or decision reason");
    assert.deepEqual(await snapshot(input.id), state);
    assert.deepEqual(await audits(input.id), rows);
  };
  for (const restart of [false,true]) {
    if(restart){await h.stop();await h.start()}
    await refuse({...args,idempotency_key:"synthetic-chest-consumed"}, "version_not_submitted");
  }
  // A second submitted version preserves the allowed control while authority changes.
  await h.api(`/spaces/${space.id}/members`, owner, {members:members(false)});
  for (const restart of [false,true]) {
    if(restart){await h.stop();await h.start()}
    await refuse({...args,version:pending,idempotency_key:"synthetic-chest-revoked"}, "resource_unavailable");
    await refuse(args, "resource_unavailable");
  }
  await h.api(`/spaces/${space.id}/members`, owner, {members:members(true)});
  await h.api(`/items/${folder.id}/governance`, owner, {reviewer:h.vars.OWNER_EMAIL});
  const unassigned = await h.api("/items", owner, {parent:folder.id,name:"Unassigned review.txt",base64:Buffer.from("synthetic-chest-4: another reviewer's original.").toString("base64")});
  const untouched = await h.api(`/items/${unassigned.id}`, owner);
  for (const restart of [false,true]) {
    if(restart){await h.stop();await h.start()}
    await refuse({...args,id:unassigned.id,version:unassigned.payload.current,idempotency_key:"synthetic-chest-unassigned"}, "assigned_reviewer_required");
  }
  assert.deepEqual((await h.api(`/items/${unassigned.id}`, owner)).versions, untouched.versions);
  assert.equal((await h.api("/audit", owner)).filter(r=>r.object_id===unassigned.id&&r.action==="version.review.changes").length,0);
  for (const [index,v] of later.payload.versions.entries()) {
    const response = await h.fetch(`/api/chest/items/${file.id}/bytes/${v.id}?download=true`, {headers:{cookie:owner}});
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, originals[index]);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), v.checksum);
  }
  console.log("PROBE SURFACE-011 refusals: consumed version, revoked access including captured retry across restart, and unassigned reviewer -> symbolic content-free errors, unchanged versions and successful decision audit; all three original hashes retained");
  return {id:file.id,version,approved,pending,label,message,review,audit,reviewer};
}
