// A named person reverses the actual held filing through the native review door.
import assert from "node:assert/strict";
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
    if(r.status!==200){const body=await r.json().catch(()=>({}));const code=typeof body.code==='string'&&/^[a-z0-9_.-]+$/i.test(body.code)?body.code:'unavailable';console.error('Native Undo HTTP '+r.status+' code='+code);throw Error('native_undo_http_'+r.status)}
    return r.json();
  };
  let stage='reviews';
  try {
  const { reviews } = await json("/agents/api/reviews");
  const review = reviews.find(
    (r) => r.tool === "chest.filing.apply" && r.undo.available,
  );
  assert.ok(review, "Native filing exposes its actual reversal");
  stage='batch';
  const id = review.summary.nativeTarget.id,
    { batches } = await json("/api/chest/filing/batches"),
    batch = batches.find((b) => b.id === id);
  assert.ok(batch);
  const entry = batch.payload.items.find((i) => i.state === "applied");
  assert.ok(entry);
  const original = await json(`/api/chest/items/${entry.item}`);
  stage='undo';
  const answer = await json(`/agents/api/reviews/${review.id}/undo`, {});
  assert.equal(answer.review.state, "undone");
  stage='restored';
  const restored = await json(`/api/chest/items/${entry.item}`);
  assert.equal(restored.item.name, entry.before.name);
  assert.equal(restored.id, original.id);
  assert.equal(restored.item.current, original.item.current);
  assert.deepEqual(restored.grants, original.grants);
  stage='audit';
  const audit = await json("/api/chest/audit"),
    row = audit.find(
      (r) => r.action === "filing.batch.undo" && r.object_id === entry.item,
    );
  assert.equal(row.actor, email);
  assert.equal(
    JSON.parse(row.detail).agent,
    undefined,
    "Human Undo has no agent actor",
  );
  }catch(error){console.error('Native Undo failed: stage='+stage+' type='+error.name+' code='+(error.code??'none'));throw error}
}
