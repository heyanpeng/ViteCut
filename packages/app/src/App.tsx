import { useEffect } from "react";
import { Tooltip } from "radix-ui";
import { Theme } from "@radix-ui/themes";
import { ToasterProvider } from "@/components/Toaster";
import { useToast } from "@/components/Toaster";
import { AuthProvider, useAuth } from "@/contexts";
import { LoginModal } from "@/components/LoginModal";
import { EditorLayout } from "@/editor";
import { subscribeTaskStream } from "@/utils/taskStream";

/**
 * AppContent 组件
 * - 负责渲染主编辑器布局
 * - 检查登录状态，未登录时弹出登录模态框
 * - 监听并订阅任务流（登录后）
 */
function AppContent() {
  const { token, isLoading } = useAuth();
  const { showToast } = useToast();

  // 登录后订阅后端任务流 SSE
  useEffect(() => {
    if (!token) return;
    const unsubscribe = subscribeTaskStream((payload) => {
      if (payload.status === "success") {
        showToast(`${payload.label} 已完成`, "success");
        return;
      }
      if (payload.status === "failed") {
        showToast(payload.message || `${payload.label} 失败`, "error");
      }
    });
    // 返回解绑函数，组件卸载时自动断开
    return unsubscribe;
  }, [token, showToast]);

  return (
    <>
      <EditorLayout />
      {/* 未登录且已加载完成时弹出登录框 */}
      {!isLoading && !token && <LoginModal />}
    </>
  );
}

/**
 * App 组件（应用入口）
 * - 配置主题
 * - 提供认证和通知上下文
 * - 配置 Tooltip 提示
 * - 包裹主内容
 */
function App() {
  return (
    <Theme appearance="dark" radius="medium">
      <AuthProvider>
        <ToasterProvider>
          <Tooltip.Provider delayDuration={300} skipDelayDuration={200}>
            <AppContent />
          </Tooltip.Provider>
        </ToasterProvider>
      </AuthProvider>
    </Theme>
  );
}

export default App;
