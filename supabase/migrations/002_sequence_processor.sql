-- Sequence processor: runs every 5 minutes via pg_cron
-- Processes active enrollments where next_step_at has passed

create or replace function process_sequence_steps()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
  next_step record;
  selected_variant record;
  step_delay integer;
begin
  -- Select all due enrollments
  for rec in
    select
      se.id as enrollment_id,
      se.sequence_id,
      se.contact_id,
      se.current_step_order,
      s.tenant_id
    from sequence_enrollments se
    join sequences s on s.id = se.sequence_id
    where se.status = 'active'
      and se.next_step_at <= now()
    for update of se skip locked
  loop
    -- Handle A/B variants: pick a random step at this step_order
    select * into selected_variant
    from sequence_steps
    where sequence_id = rec.sequence_id
      and step_order = rec.current_step_order
    order by random()
    limit 1;

    -- If no step found at current order, mark completed
    if selected_variant is null then
      update sequence_enrollments
      set status = 'completed', updated_at = now()
      where id = rec.enrollment_id;

      insert into activities (tenant_id, contact_id, activity_type, metadata)
      values (
        rec.tenant_id,
        rec.contact_id,
        'sequence_completed',
        jsonb_build_object(
          'sequence_id', rec.sequence_id,
          'enrollment_id', rec.enrollment_id
        )
      );

      continue;
    end if;

    -- Log step sent activity
    insert into activities (tenant_id, contact_id, activity_type, metadata)
    values (
      rec.tenant_id,
      rec.contact_id,
      'sequence_step_sent',
      jsonb_build_object(
        'sequence_id', rec.sequence_id,
        'enrollment_id', rec.enrollment_id,
        'step_id', selected_variant.id,
        'step_order', selected_variant.step_order,
        'step_type', selected_variant.step_type,
        'variant_key', selected_variant.variant_key,
        'subject', coalesce(selected_variant.subject, ''),
        'channel', selected_variant.channel
      )
    );

    -- Find next step (next distinct step_order after current)
    select ss.step_order, ss.delay_days into next_step
    from sequence_steps ss
    where ss.sequence_id = rec.sequence_id
      and ss.step_order > rec.current_step_order
    order by ss.step_order asc
    limit 1;

    if next_step is null then
      -- No more steps — mark completed
      update sequence_enrollments
      set status = 'completed',
          current_step_order = rec.current_step_order,
          updated_at = now()
      where id = rec.enrollment_id;

      insert into activities (tenant_id, contact_id, activity_type, metadata)
      values (
        rec.tenant_id,
        rec.contact_id,
        'sequence_completed',
        jsonb_build_object(
          'sequence_id', rec.sequence_id,
          'enrollment_id', rec.enrollment_id
        )
      );
    else
      -- Advance to next step
      step_delay := coalesce(next_step.delay_days, 0);
      update sequence_enrollments
      set current_step_order = next_step.step_order,
          next_step_at = now() + (step_delay || ' days')::interval,
          updated_at = now()
      where id = rec.enrollment_id;
    end if;
  end loop;
end;
$$;

-- Note: scheduling is handled by Vercel Cron (vercel.json)
-- instead of pg_cron, which requires the cron extension.
