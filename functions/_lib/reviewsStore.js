export async function ensureReviewsSchema() {
  return { ok: false, disabled: true };
}

export async function saveReview() {
  throw new Error("Reviews system is disabled");
}

export async function listReviews() {
  return [];
}
