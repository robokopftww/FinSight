export type OverviewRefreshState =
  | { status: "idle" }
  | { status: "refreshing" }
  | { status: "success" }
  | { status: "error"; message: string };

export type OverviewRefreshAction =
  | { type: "start" }
  | { type: "succeed" }
  | { type: "fail"; message: string };

export const initialOverviewRefreshState: OverviewRefreshState = { status: "idle" };

export function overviewRefreshReducer(
  _state: OverviewRefreshState,
  action: OverviewRefreshAction,
): OverviewRefreshState {
  switch (action.type) {
    case "start":
      return { status: "refreshing" };
    case "succeed":
      return { status: "success" };
    case "fail":
      return { status: "error", message: action.message };
  }
}
