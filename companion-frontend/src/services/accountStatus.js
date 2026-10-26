const BENEFICIARY_ROLE = "ROLE_BENEFICIARY";

export function isBeneficiaryAccount(user) {
  return user?.role === BENEFICIARY_ROLE || user?.membershipStatus === "BENEFICIARY";
}

export function isMemberAccount(user) {
  if (isBeneficiaryAccount(user)) return true;
  if (typeof user?.policyId === "string" ? user.policyId.trim() : user?.policyId) return true;
  if (user?.membershipStatus === "PRE_MEMBER" || user?.membershipStatus === "PENDING_REVIEW") return false;
  return false;
}

export function isPreMemberAccount(user) {
  if (isBeneficiaryAccount(user)) return false;
  if (typeof user?.policyId === "string" ? user.policyId.trim() : user?.policyId) return false;
  if (user?.membershipStatus === "PRE_MEMBER" || user?.membershipStatus === "PENDING_REVIEW") return true;
  return true;
}
