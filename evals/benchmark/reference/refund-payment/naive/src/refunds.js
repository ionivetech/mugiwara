export async function refund(ctx, paymentId, amountCents) {
  const payment = ctx.payments.get(paymentId);
  if (!payment) throw new Error('unknown payment');
  if (amountCents > payment.capturedCents) throw new Error('refund exceeds the captured amount');
  const r = await ctx.gateway.refund(paymentId, amountCents);
  return { refundId: r.id, amountCents };
}
