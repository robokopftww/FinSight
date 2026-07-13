export type AdvisorWindowState = {
  open: boolean;
  hasOpened: boolean;
};

export type AdvisorWindowAction = { type: "open" } | { type: "close" };

export const initialAdvisorWindowState: AdvisorWindowState = {
  open: false,
  hasOpened: false,
};

export function advisorWindowReducer(
  state: AdvisorWindowState,
  action: AdvisorWindowAction,
): AdvisorWindowState {
  if (action.type === "open") {
    return { open: true, hasOpened: true };
  }

  return { ...state, open: false };
}
