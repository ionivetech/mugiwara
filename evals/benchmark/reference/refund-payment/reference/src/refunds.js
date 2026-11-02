export async function refund(ctx, paymentId, amountCents) {
  const payment = ctx.payments.get(paymentId);
  if (!payment) throw new Error('unknown payment');
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new RangeError('refund must be a positive whole number of cents');
  const used = payment.refundedCents ?? 0;
  if (used + amountCents > payment.capturedCents) throw new Error('refund exceeds the captured amount');
  payment.refundedCents = used + amountCents; // reserve before awaiting so a concurrent call sees it
  try {
    const r = await ctx.gateway.refund(paymentId, amountCents);
    return { refundId: r.id, amountCents };
  } catch (e) {
    payment.refundedCents -= amountCents; // the gateway did not refund: give the amount back
    throw e;
  }
}
