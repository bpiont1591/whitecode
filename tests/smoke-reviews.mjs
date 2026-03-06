import { rm } from "node:fs/promises";
import { createSessionCookie } from "../functions/_lib/auth.js";
import { onRequestPost as createProfile } from "../functions/api/profile/create.js";
import { onRequestPost as addReview } from "../functions/api/review.js";
import { onRequestGet as getProfile } from "../functions/api/profile.js";
import { onRequestPost as reportReview } from "../functions/api/report/index.js";
import { onRequestPost as resolveReport } from "../functions/api/report/resolve.js";
import { onRequestPost as deleteProfile } from "../functions/api/profile/delete.js";

const env = {
  SESSION_SECRET: "smoke-secret-123",
  LOCAL_DB_FILE: "data/smoke-profiles-db.json"
};

const owner = { id: "1001", username: "owner", global_name: "Owner", discriminator: "0", avatar: "" };
const reviewer = { id: "2002", username: "reviewer", global_name: "Reviewer", discriminator: "0", avatar: "" };

await rm(env.LOCAL_DB_FILE, { force: true });

const ownerCookie = await createSessionCookie(owner, env);
const reviewerCookie = await createSessionCookie(reviewer, env);

let res;

res = await createProfile({
  request: jsonReq("https://example.com/api/profile/create", { slug: "zetooo" }, ownerCookie),
  env
});
assertOk(await res.json(), "create profile");

res = await addReview({
  request: jsonReq("https://example.com/api/review", { user: "zetooo", rating: "legit", reason: "Szybka wysyłka" }, reviewerCookie),
  env
});
assertOk(await res.json(), "add review");

res = await getProfile({ request: new Request("https://example.com/api/profile?user=zetooo"), env });
const profileOut = await res.json();
assertOk(profileOut, "get profile");
const reviewId = profileOut?.profile?.reviews?.[0]?.id;
if (!reviewId) throw new Error("review id missing");

res = await reportReview({
  request: jsonReq("https://example.com/api/report", { user: "zetooo", reviewId, reason: "test report" }, ownerCookie),
  env
});
assertOk(await res.json(), "report review");

res = await getProfile({ request: new Request("https://example.com/api/profile?user=zetooo"), env });
const profileWithReport = await res.json();
const reportId = profileWithReport?.profile?.reports?.[0]?.id;
if (!reportId) throw new Error("report id missing");

res = await resolveReport({
  request: jsonReq("https://example.com/api/report/resolve", { user: "zetooo", reportId }, ownerCookie),
  env
});
assertOk(await res.json(), "resolve report");

res = await deleteProfile({
  request: jsonReq("https://example.com/api/profile/delete", { user: "zetooo" }, ownerCookie),
  env
});
assertOk(await res.json(), "delete profile");

res = await createProfile({
  request: jsonReq("https://example.com/api/profile/create", { slug: "zetooo" }, ownerCookie),
  env
});
assertOk(await res.json(), "recreate profile");

console.log("smoke-reviews: ok");

function jsonReq(url, body, cookie) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
    body: JSON.stringify(body)
  });
}

function assertOk(out, step) {
  if (!out?.ok) {
    throw new Error(`${step} failed: ${JSON.stringify(out)}`);
  }
}
