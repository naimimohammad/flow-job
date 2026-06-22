import { logger } from '../utils/logger';

export type Context = { [key: string]: any };

export async function validateOrder(context: Context) {
    context.order = { id: '123', amount: 100 }; // Mock order data
  logger.info('validateOrder called');
  console.log(context);
  // simple validation
  if (!context.order || !context.order.id) {
    throw new Error('Invalid order');
  }
  return { valid: true };
}

export async function chargePayment(context: Context) {
  logger.info('chargePayment called');
  console.log(context , "from chargePayment");
  // simulate async charge
  await new Promise((r) => setTimeout(r, 200));
  return { charged: true };
}

export async function sendEmail(context: Context) {
  logger.info('sendEmail called');
  await new Promise((r) => setTimeout(r, 100));
  return { sent: true };
}




export const registry: Record<string, (context: Context) => Promise<any>> = {
  validateOrder,
  chargePayment,
  sendEmail,
};
