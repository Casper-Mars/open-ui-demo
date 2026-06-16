import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";

// ── 类型定义 ──

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AppState {
  messages: Message[];
  conversationId: string;
  streaming: boolean;
  streamingContent: string;
}

// ── Action 类型 ──

export type AppAction =
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "APPEND_STREAM"; payload: string }
  | { type: "FINISH_STREAM" };

// ── Reducer ──

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case "APPEND_STREAM":
      return {
        ...state,
        streaming: true,
        streamingContent: state.streamingContent + action.payload,
      };

    case "FINISH_STREAM": {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: state.streamingContent,
        timestamp: Date.now(),
      };
      return {
        ...state,
        messages: [...state.messages, assistantMessage],
        streaming: false,
        streamingContent: "",
      };
    }

    default:
      return state;
  }
}

// ── 初始状态工厂 ──

function createInitialState(): AppState {
  return {
    messages: [],
    conversationId: crypto.randomUUID(),
    streaming: false,
    streamingContent: "",
  };
}

// ── Context ──

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

// ── Provider ──

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, null, createInitialState);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// ── Hook ──

export function useAppContext(): {
  state: AppState;
  dispatch: Dispatch<AppAction>;
} {
  const state = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);

  if (state === null || dispatch === null) {
    throw new Error("useAppContext must be used within an AppProvider");
  }

  return { state, dispatch };
}
