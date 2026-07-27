# Security Operations

## Encryption Key Management
- **Key Owner:** [Name], CTO/Lead Engineer
- **Key Service:** Vercel KMS
- **Rotation Schedule:** Quarterly (1st of Jan, Apr, Jul, Oct)
- **Rotation Runbook:** See `scripts/rotate-keys.ts`
- **Daraja Credentials Rotation:** Every 90 days or on suspicion of compromise
- **Clerk Webhook Secret Rotation:** On suspicion of compromise or annually