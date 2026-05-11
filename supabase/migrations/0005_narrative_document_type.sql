-- Add document_type to program_narratives to support multiple document kinds
-- per award period (Logic Models, Continuation Documents, etc.)

ALTER TABLE program_narratives
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'narrative';

COMMENT ON COLUMN program_narratives.document_type IS
  'One of: narrative, logic_model, continuation, evaluation, budget, other';
