export function payOrder(ctx, { key, orderId, amountCents }) {
  // Store the in-flight promise so a concurrent retry shares it; forget it when the charge fails.
  let payment = ctx.payments.get(key);
  if (!payment) {
    payment = ctx.gateway.charge(amountCents).then((c) => ({ chargeId: c.id, amountCents }));
    ctx.payments.set(key, payment);
    payment.catch(() => ctx.payments.delete(key));
  }
  return payment;
}
