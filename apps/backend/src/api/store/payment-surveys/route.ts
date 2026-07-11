import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

// #224: capture why customers abandon payment. Raw pg table (same pattern as
// payfast_pending) — analytics glue, not a domain model.
export const SURVEY_REASONS = [
  'payment_method_unsupported',
  'unexpected_costs',
  'comparing_prices',
  'technical_problem',
  'changed_mind',
  'other',
] as const

let tableReady = false
async function ensureTable(knex: any) {
  if (tableReady) return
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS payment_cancel_survey (
      id           bigserial PRIMARY KEY,
      m_payment_id text,
      reasons      text[]      NOT NULL,
      message      text,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  tableReady = true
}

type SurveyBody = {
  reasons?: string[]
  message?: string
  m_payment_id?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { reasons, message, m_payment_id } = (req.body ?? {}) as SurveyBody

  const validReasons = (Array.isArray(reasons) ? reasons : []).filter((r): r is string =>
    (SURVEY_REASONS as readonly string[]).includes(r),
  )
  const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, 1000) : ''
  if (!validReasons.length && !trimmedMessage) {
    return res.status(400).json({ error: 'at least one reason or a message is required' })
  }

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  await ensureTable(knex)
  await knex.raw(
    `INSERT INTO payment_cancel_survey (m_payment_id, reasons, message) VALUES (?, ?, ?)`,
    [
      typeof m_payment_id === 'string' ? m_payment_id.slice(0, 100) : null,
      validReasons,
      trimmedMessage || null,
    ],
  )

  return res.status(200).json({ success: true })
}
