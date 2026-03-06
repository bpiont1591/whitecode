import { rm } from "node:fs/promises";
import { createSessionCookie } from "../functions/_lib/auth.js";
import { onRequestPost as postReview } from "../functions/review.js";
import { onRequestGet as getReviews } from "../functions/reviews.js";
import { onRequestGet as initDb } from "../functions/db/init.js";

const env = {
  SESSION_SECRET: "smoke-secret-123",
  LOCAL_DB_FILE: "data/smoke-profiles-db.json"
};

await rm(env.LOCAL_DB_FILE, { force: true });

const user = { id: "2002", username: "reviewer", global_name: "Reviewer", discriminator: "0", avatar: "" };
const cookie = await createSessionCookie(user, env);

let res = await initDb({ env });
let out = await res.json();
if (out.ok !== true && out.mode !== "file" && out.mode !== "memory") throw new Error(`db init unexpected: ${JSON.stringify(out)}`);

res = await postReview({
  request: jsonReq("https://example.com/review", { review: "Świetna współpraca", rating: 5 }, cookie),
  env
});
out = await res.json();
if (!out.ok) throw new Error(`review failed: ${JSON.stringify(out)}`);

res = await getReviews({ env });
out = await res.json();
if (!out.ok) throw new Error(`reviews failed: ${JSON.stringify(out)}`);
if (!Array.isArray(out.items) || out.items.length < 1) throw new Error(`reviews empty: ${JSON.stringify(out)}`);

console.log("smoke-reviews: ok");

function jsonReq(url, body, cookie) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "https://example.com",
      "referer": "https://example.com/",
      cookie
    },
    body: JSON.stringify(body)
  });
}
