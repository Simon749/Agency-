# Notification Channel Comparison: SMS vs WhatsApp (Kenya)

## Cost Analysis (per message, KES)

| Channel | Cost | Notes |
|---------|------|-------|
| Africa's Talking SMS | ~0.80 - 1.20 KES | Local routing, reliable |
| Meta WhatsApp (Business) | ~0.50 - 0.80 KES | Template messages; cheaper at scale |
| Twilio WhatsApp | ~1.00 - 1.50 KES | Higher cost, easier API |

## Delivery & Engagement (Kenya-specific)

| Metric | SMS | WhatsApp |
|--------|-----|----------|
| Open rate | ~90% | ~98% |
| Read receipt | No | Yes |
| Rich media | No | Images, PDFs, buttons |
| Offline delivery | 48h retry | 30-day session window |
| Phone requirement | Any phone | Smartphone + data |

## PropFlow Recommendation

### Phase 1 (Launch): SMS Primary
- Africa's Talking for all notifications
- WhatsApp opt-in for early adopters

### Phase 2 (Scale): Hybrid
- WhatsApp primary for tenants with smartphones
- SMS fallback for:
  - Non-smartphones (common in lower-income segments)
  - WhatsApp template not yet approved
  - WhatsApp delivery failure

### Phase 3: WhatsApp-First
- Once 70%+ tenant base has WhatsApp
- Use WhatsApp for:
  - Payment confirmations (instant, rich)
  - Lease document delivery (PDF)
  - Complaint photo sharing (tenant → manager)

## Implementation Notes

1. **Templates must be pre-approved by Meta** (24-48h review)
2. **Session messages** (replies within 24h) are cheaper than templates
3. **Opt-in required** — tenants must explicitly consent to WhatsApp
4. **Kenya-specific**: Safaricom data bundles often include WhatsApp — tenants may have WhatsApp even without general data