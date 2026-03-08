import { rm } from "node:fs/promises";
import { createSessionCookie } from "../functions/_lib/auth.js";
import { onRequestGet as initReviews } from "../functions/db/init.js";
import { onRequestPost as postReview } from "../functions/review.js";
import { onRequestGet as getReviews } from "../functions/reviews.js";

const env = {
  SESSION_SECRET: "smoke-secret-123",
  REVIEWS_JSON_FILE: "data/smoke-reviews-db.json"
};

await rm(env.REVIEWS_JSON_FILE, { force: true });

let res = await initReviews({ env });
let out = await res.json();
if (!out.ok) throw new Error(`init failed: ${JSON.stringify(out)}`);

const cookie = await createSessionCookie({ id: "12345", username: "tester", global_name: "Tester", discriminator: "0", avatar: "" }, env);
res = await postReview({
  request: new Request("https://example.com/review", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "https://example.com",
      "referer": "https://example.com/",
      "cookie": cookie
    },
    body: JSON.stringify({ review: "Bardzo dobra współpraca", rating: 5 })
  }),
  env
});
out = await res.json();
if (!out.ok) throw new Error(`post review failed: ${JSON.stringify(out)}`);

res = await getReviews({ env });
out = await res.json();
if (!out.ok || !Array.isArray(out.items) || out.items.length < 1) {
  throw new Error(`list reviews failed: ${JSON.stringify(out)}`);
}

console.log("smoke-reviews: ok");
