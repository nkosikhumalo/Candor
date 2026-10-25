const POLICYHOLDER = "ROLE_POLICYHOLDER";
const BENEFICIARY = "ROLE_BENEFICIARY";

function preMemberChat(req, res, next) {
  if (req.user?.role !== POLICYHOLDER || req.user?.membershipStatus !== "PRE_MEMBER") {
    return res.status(403).json({
      message: "This chat endpoint is for registered users who have not joined a policy yet.",
      code: "PRE_MEMBER_CHAT_ONLY",
    });
  }
  return next();
}

function memberChat(req, res, next) {
  if (![POLICYHOLDER, BENEFICIARY].includes(req.user?.role) || req.user?.membershipStatus === "PRE_MEMBER") {
    return res.status(403).json({
      message: "Policyholder or beneficiary access is required for this chat endpoint.",
      code: "MEMBER_CHAT_ONLY",
    });
  }
  return next();
}

module.exports = { memberChat, preMemberChat };
