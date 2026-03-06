import { onRequestPost as postReview } from "../functions/review.js";
import { onRequestGet as getReviews } from "../functions/reviews.js";

let res = await postReview({});
let out = await res.json();
if (res.status !== 410 || out.ok !== false) throw new Error(`review endpoint should be disabled: ${JSON.stringify(out)}`);

res = await getReviews({});
out = await res.json();
if (!out.ok || !Array.isArray(out.items) || out.items.length !== 0) {
  throw new Error(`reviews endpoint should return empty list: ${JSON.stringify(out)}`);
}

console.log("smoke-reviews-disabled: ok");
