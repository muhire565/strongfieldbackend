import { supabaseAdmin } from './src/services/supabase.admin.js';

async function fix() {
  console.log('Starting retroactive balance fix...');
  const { data: sales, error: saleErr } = await supabaseAdmin.from('sales').select('*').eq('status', 'voided');
  if (saleErr) {
    console.error('Error fetching sales:', saleErr);
    return;
  }
  
  console.log(`Found ${sales.length} voided sales.`);
  for (const sale of sales) {
    const { data: txs, error: txErr } = await supabaseAdmin
      .from('finance_transactions')
      .select('*')
      .eq('reference_id', String(sale.id))
      .eq('reference_type', 'sale_void');
      
    if (txErr) {
      console.error('Error fetching txs:', txErr);
      continue;
    }
      
    if (txs.length === 0) {
      console.log(`Sale ${sale.sale_number} (ID: ${sale.id}) missing void reversal!`);
      const { data: credits } = await supabaseAdmin
        .from('finance_transactions')
        .select('*')
        .eq('reference_id', String(sale.id))
        .eq('reference_type', 'sale');
        
      if (!credits || credits.length === 0) {
        console.log(`No original payment credits found for sale ${sale.id}, nothing to reverse.`);
        continue;
      }
        
      for (const credit of credits) {
        console.log(`Reversing credit of ${credit.amount} via ${credit.payment_mode}`);
        const { error: insErr } = await supabaseAdmin.from('finance_transactions').insert({
          branch_id: credit.branch_id,
          transaction_type: credit.transaction_type === 'credit_payment_received' ? 'credit_payment_refunded' : 'pos_sale_refund',
          direction: 'debit',
          payment_mode: credit.payment_mode,
          amount: credit.amount,
          description: `Void refund for sale ${sale.sale_number} (retroactive fix)`,
          reference_id: String(sale.id),
          reference_type: 'sale_void',
          performed_by: credit.performed_by
        });
        if (insErr) {
            console.error('Error inserting reversal:', insErr);
        } else {
            console.log('Successfully inserted reversal.');
        }
      }
    } else {
      console.log(`Sale ${sale.sale_number} already has void reversal.`);
    }
  }
  console.log('Done fixing retroactively!');
}

fix();
