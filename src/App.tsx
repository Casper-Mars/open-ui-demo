import { A2UIProvider } from "@a2ui/react";
import { AppProvider } from "./context/AppContext";
import ChatPanel from "./components/ChatPanel";
import A2UIPanel from "./components/A2UIPanel";

/**
 * App - 主布局
 *
 * 左侧：ChatPanel（聊天面板）
 * 右侧：A2UIPanel（A2UI 渲染面板）
 *
 * A2UIProvider 在 App 层包裹，使 ChatPanel 和 A2UIPanel 都能使用 useA2UI hook。
 */
function App() {
  return (
    <AppProvider>
      <A2UIProvider>
        <div className="flex h-screen w-screen bg-gray-50">
          {/* 左侧聊天面板 */}
          <aside className="w-[400px] shrink-0 border-r border-gray-200">
            <ChatPanel />
          </aside>

          {/* 右侧 A2UI 面板 */}
          <main className="flex-1 overflow-hidden">
            <A2UIPanel />
          </main>
        </div>
      </A2UIProvider>
    </AppProvider>
  );
}

export default App;
