import { A2uiSurface } from "@a2ui/react/v0_9";
import type { SurfaceModel } from "@a2ui/web_core/v0_9";

/**
 * A2UIPanel - 右侧 A2UI 渲染面板
 *
 * 通过 props 接收 surfaces 数组，使用 @a2ui/react/v0_9 的 A2uiSurface 逐一渲染。
 * 无 surface 时显示空状态提示，多个 surface 时可滚动查看。
 */
export default function A2UIPanel({
  surfaces,
}: {
  surfaces: SurfaceModel[];
}) {
  // 空状态：没有任何 surface
  if (surfaces.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-gray-400 max-w-xs">
          <svg
            className="mx-auto mb-4 w-16 h-16 opacity-40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
            />
          </svg>
          <p className="text-sm leading-relaxed">
            暂无 A2UI 界面，发送消息后 AI 将在此处生成交互界面
          </p>
        </div>
      </div>
    );
  }

  // 有 surface：全部渲染，可滚动
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {surfaces.map((surface) => (
        <A2uiSurface
          key={surface.id}
          surface={surface}
        />
      ))}
    </div>
  );
}
