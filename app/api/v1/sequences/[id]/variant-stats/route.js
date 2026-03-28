import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, name')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Get steps grouped by step_order (variants share a step_order)
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, step_order, variant_key, subject, split_ratio')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true })
    .order('variant_key', { ascending: true });

  // Get emails for this sequence
  const { data: emails } = await supabase
    .from('emails')
    .select('step_id, direction, gmail_thread_id')
    .eq('sequence_id', id);

  const sentEmails = (emails || []).filter(e => e.direction === 'sent');
  const receivedEmails = (emails || []).filter(e => e.direction === 'received');

  // Group steps by step_order
  const stepOrderGroups = {};
  for (const step of (steps || [])) {
    if (!stepOrderGroups[step.step_order]) {
      stepOrderGroups[step.step_order] = [];
    }
    stepOrderGroups[step.step_order].push(step);
  }

  // Build variant comparison per step_order
  const variantComparisons = Object.entries(stepOrderGroups).map(([stepOrder, variants]) => {
    const variantStats = variants.map(variant => {
      const variantSent = sentEmails.filter(e => e.step_id === variant.id);
      const sentThreadIds = new Set(variantSent.map(s => s.gmail_thread_id));
      const variantReplies = receivedEmails.filter(e => sentThreadIds.has(e.gmail_thread_id));

      return {
        variant_key: variant.variant_key,
        subject: variant.subject,
        split_ratio: variant.split_ratio,
        sent: variantSent.length,
        replies: variantReplies.length,
        reply_rate: variantSent.length > 0 ? parseFloat((variantReplies.length / variantSent.length * 100).toFixed(1)) : 0,
      };
    });

    // Determine winner (variant with highest reply rate, minimum 5 sends)
    const qualified = variantStats.filter(v => v.sent >= 5);
    let winner = null;
    if (qualified.length > 1) {
      const best = qualified.reduce((a, b) => a.reply_rate > b.reply_rate ? a : b);
      if (best.reply_rate > 0) winner = best.variant_key;
    }

    return {
      step_order: parseInt(stepOrder),
      variants: variantStats,
      winner,
      has_enough_data: qualified.length > 1,
    };
  });

  return NextResponse.json({
    data: {
      sequence_id: id,
      sequence_name: sequence.name,
      steps: variantComparisons,
    },
  });
}
