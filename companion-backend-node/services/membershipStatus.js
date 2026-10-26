const BENEFICIARY_ROLES = new Set(["ROLE_BENEFICIARY", "BENEFICIARY"]);
const NON_MEMBER_STATUSES = new Set(["PRE_MEMBER", "PENDING_REVIEW"]);

function normalizedPolicyId(value) {
  const policyId = typeof value === "string" ? value.trim() : value;
  return policyId || null;
}

function membershipStatusFor(user = {}) {
  const role = String(user.role || "").toUpperCase();
  if (BENEFICIARY_ROLES.has(role)) return "BENEFICIARY";

  // The linked policy is the source of truth for policyholders. Older rows
  // can still say PRE_MEMBER after a policy was attached to the account.
  if (normalizedPolicyId(user.policy_id || user.policyId)) return "MEMBER";

  const storedStatus = String(user.membership_status || user.membershipStatus || "").toUpperCase();
  if (NON_MEMBER_STATUSES.has(storedStatus)) return storedStatus;

  return "PRE_MEMBER";
}

module.exports = { membershipStatusFor, normalizedPolicyId };
