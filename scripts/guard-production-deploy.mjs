const approval = process.env.JRA_APPROVE_PRODUCTION_DEPLOY;

if (approval !== "roman-approved-production") {
  console.error("production deploy blocked.");
  console.error("Set JRA_APPROVE_PRODUCTION_DEPLOY=roman-approved-production only after Roman explicitly approves production deployment in the current thread.");
  process.exit(1);
}

console.log("production deploy approval token present.");
