const { getRazorpayClient } = require('../config/razorpay');

const createPayout = async ({ amount, paymentMethod, paymentDetails, transactionId }) => {
  const razorpay = getRazorpayClient();
  const amountInPaise = Math.round(parseFloat(amount) * 100);

  let fundAccount;
  if (paymentMethod === 'UPI') {
    fundAccount = {
      account_type: 'vpa',
      vpa: { address: paymentDetails.upi_id },
    };
  } else if (paymentMethod === 'BANK') {
    fundAccount = {
      account_type: 'bank_account',
      bank_account: {
        name: paymentDetails.account_holder_name || 'Account Holder',
        ifsc: paymentDetails.ifsc_code,
        account_number: paymentDetails.account_number,
      },
    };
  } else {
    throw new Error('Invalid payment method');
  }

  const payout = await razorpay.payouts.create({
    account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
    amount: amountInPaise,
    currency: 'INR',
    mode: paymentMethod === 'UPI' ? 'UPI' : 'NEFT',
    purpose: 'payout',
    fund_account: {
      ...fundAccount,
      contact: {
        name: paymentDetails.account_holder_name || 'User',
        type: 'employee',
      },
    },
    notes: { transactionId },
  });

  return payout;
};

module.exports = { createPayout };
