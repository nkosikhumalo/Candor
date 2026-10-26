const BENEFICIARY_ROLES = new Set(["ROLE_BENEFICIARY", "BENEFICIARY"]);
const NON_MEMBER_STATUSES = new Set(["PRE_MEMBER", "PENDING_REVIEW"]);

function normalizedPolicyId(value) {
  const policyId = typeof value === "string" ? value.trim() : value;
  return policyId || null;
}

function membershipStatusFor(user = {}) {
  const role = String(user.role || "").toUpperCase();
  if (BENEFICIARY_ROLES.has(role)) return "BENEFICIARY";

  const storedStatus = String(user.membership_status || user.membershipStatus || "").toUpperCase();
  if (NON_MEMBER_STATUSES.has(storedStatus)) return storedStatus;

  // A policyholder is a member only when the account is linked to a policy.
  // This also repairs stale MEMBER statuses in existing database rows/JWTs.
  return normalizedPolicyId(user.policy_id || user.policyId) ? "MEMBER" : "PRE_MEMBER";
}

module.exports = { membershipStatusFor, normalizedPolicyId };
