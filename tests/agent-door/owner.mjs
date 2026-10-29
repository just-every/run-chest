export default async function ({
  request,
  origin,
  claim,
  displayName,
  returnTo,
  reviewers,
  fixtures,
  token,
}) {
  const bootstrap = await request(new URL(claim.path, origin).href, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token: claim.token, displayName, returnTo }),
  });
  if (bootstrap.status !== 303) throw Error("Native owner claim failed");
  const cookie = bootstrap.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  await reviewers.initialize("colleague", { cookie });
  await reviewers.initialize("outside", { cookie });
  for (let i = 0; i < 12; i++) {
    const enrolled = await request(new URL("/api/chest/devices", origin).href, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Records desktop ${i + 1}`,
        platform: "linux",
      }),
    });
    if (!enrolled.ok) throw Error("Native device enrollment failed");
    await enrolled.body.cancel();
  }
  fixtures.set("https://scanner.example.invalid", { token });
  const scanning = await request(
    new URL("/api/chest/content-security/policy", origin).href,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled: true,
        sensitiveGroups: [],
        confirm: true,
      }),
    },
  );
  if (!scanning.ok) throw Error("Native scanner configuration failed");
  await scanning.body.cancel();
  const personalResponse = await request(
      new URL("/api/chest/files", origin).href,
      { headers: { Cookie: cookie, Origin: origin } },
    ),
    personal = (await personalResponse.json()).personal;
  for (let i = 0; i < 12; i++) {
    const held = await request(new URL("/api/chest/items", origin).href, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        space: personal,
        name: `Held ${i + 1}.txt`,
        base64: Buffer.from(`CHEST-QUARANTINE-FIXTURE ${i + 1}`).toString(
          "base64",
        ),
      }),
    });
    if (held.status !== 423)
      throw Error("Native quarantine fixture was not held");
    await held.body.cancel();
  }
  const synced = await request(new URL("/api/chest/files", origin).href, {
    headers: { Cookie: cookie, Origin: origin },
  });
  if (!synced.ok) throw Error("Native library initialization failed");
  await synced.body.cancel();
  return bootstrap;
}
