-- AlterTable
-- Anchor for the exact text that was flagged inside the proof body. Optional because legacy rows
-- (pre-ML pipeline) only stored indices into the proof content; the websocket falls back to slicing
-- the content if this column is null when rehydrating ``DocumentState.errors`` on rejoin.
ALTER TABLE "Error" ADD COLUMN "problematicContent" TEXT;
