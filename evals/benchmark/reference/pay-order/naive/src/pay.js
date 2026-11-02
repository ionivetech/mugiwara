export async function payOrder(ctx, { key, orderId, amountCents }) {
  if (ctx.payments.has(key)) return ctx.payments.get(key);
  const charge = await ctx.gateway.charge(amountCents);
  const result = { chargeId: charge.id, amountCents };
  ctx.payments.set(key, result);
  return result;
}
