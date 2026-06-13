export type ActionResult = {
  ok: boolean;
  message: string;
  detail?: string;
  warning?: boolean;
} | null;

export const INITIAL_ACTION_RESULT: ActionResult = null;
